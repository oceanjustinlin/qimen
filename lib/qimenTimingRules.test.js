const test = require('node:test');
const assert = require('node:assert/strict');
const { Solar } = require('lunar-javascript');

const {
  buildTimingPromptSection,
  buildTimingAnalysis,
  scanFutureTriggers
} = require('./qimenTimingRules');

const baseContext = {
  generatedAt: new Date(2026, 4, 12, 10, 30, 0),
  targetSymbols: [
    { symbol: '开门', role: '岗位机会', weight: 'primary' },
    { symbol: '值符', role: '领导态度', weight: 'primary' }
  ],
  chart: {
    dayKongBranches: ['寅', '卯'],
    hourKongBranches: ['寅', '卯'],
    dayMa: '申',
    hourMa: '寅',
    palaces: [
      { index: 0, name: '巽4宫', branches: ['辰', '巳'], door: '休门', star: '天冲', god: '九天', sky: '乙', earth: '戊', isKong: false, hasMa: false },
      { index: 1, name: '离9宫', branches: ['午'], door: '开门', star: '天英', god: '值符', sky: '丙', earth: '己', isKong: true, hasMa: false },
      { index: 2, name: '坤2宫', branches: ['未', '申'], door: '生门', star: '天芮', god: '六合', sky: '戊', earth: '庚', isKong: false, hasMa: true }
    ]
  }
};

test('buildTimingAnalysis prioritizes kongwang before ma star', () => {
  const analysis = buildTimingAnalysis(baseContext);

  assert.equal(analysis.method, 'qimen-timing-v1');
  assert.equal(analysis.p1_candidates[0].timing_type, 'kongwang_fill_or_clash');
  assert.equal(analysis.p1_candidates[0].target_symbol, '开门');
  assert.match(analysis.p1_candidates[0].basis.join('\n'), /空亡/);
});

test('scanFutureTriggers finds fill and clash hits without full chart rerendering', () => {
  const hits = scanFutureTriggers({
    startDate: new Date(2026, 4, 12, 10, 30, 0),
    days: 14,
    p1Candidates: [
      {
        timing_type: 'kongwang_fill_or_clash',
        target_symbol: '开门',
        target_role: '岗位机会',
        branches: ['寅', '卯'],
        basis: ['开门所在宫逢空亡']
      }
    ],
    maxHits: 8
  });

  assert.ok(hits.length > 0);
  assert.ok(hits.some((hit) => hit.trigger === 'fill_kongwang'));
  assert.ok(hits.some((hit) => hit.trigger === 'clash_kongwang'));
  assert.equal(hits[0].scan_method, 'branch_trigger_scan');
});

test('buildTimingAnalysis adds recheck status for top scanned candidates', () => {
  const analysis = buildTimingAnalysis({
    ...baseContext,
    solarFactory: (date) => Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), 0, 0),
    recheckLimit: 2
  });

  assert.ok(analysis.p2_scan.candidates.length > 0);
  assert.ok(analysis.p3_recheck.length <= 2);
  assert.ok(analysis.p3_recheck[0].candidate);
  assert.ok(analysis.p3_recheck[0].recheck);
});

test('buildTimingPromptSection constrains LLM to timing candidates', () => {
  const section = buildTimingPromptSection({
    method: 'qimen-timing-v1',
    p1_candidates: [{ timing_type: 'kongwang_fill_or_clash', target_symbol: '开门', target_role: '岗位机会', target_palace: '离9宫', trigger: '填实空亡或冲空', basis: ['开门落空'] }],
    p2_scan: { candidates: [{ date: '2026-05-13', time_branch: '申', trigger: 'clash_kongwang', basis: '申冲寅' }] },
    p3_recheck: [{ candidate: { date: '2026-05-13', time_branch: '申', basis: '申冲寅' }, recheck: { target_symbol: '开门', target_palace: '坤2宫', target_is_kong: false, target_door: '开门' } }]
  });

  assert.match(section, /结构化定应期/);
  assert.match(section, /先看空亡，再看马星/);
  assert.match(section, /当前盘判断/);
  assert.match(section, /未来触发窗口/);
  assert.match(section, /复核提示/);
  assert.match(section, /2026-05-13/);
  assert.doesNotMatch(section, /P1/);
  assert.doesNotMatch(section, /P2/);
  assert.doesNotMatch(section, /P3/);
  assert.doesNotMatch(section, /"timing_type"/);
});

test('scanFutureTriggers skips hours that already ended before the casting time', () => {
  const startDate = new Date(2026, 10, 11, 21, 29, 0);
  const hits = scanFutureTriggers({
    startDate,
    days: 10,
    p1Candidates: [
      { timing_type: 'kongwang_fill_or_clash', target_symbol: '值符', target_role: '领导', branches: ['辰', '巳'], confidence: 'medium' },
      { timing_type: 'kongwang_fill_or_clash', target_symbol: '开门', target_role: '岗位', branches: ['辰', '巳'], confidence: 'medium' }
    ],
    maxHits: 12
  });

  assert.ok(hits.length > 0);
  for (const hit of hits) {
    const end = new Date(`${hit.date}T${String(hit.hour).padStart(2, '0')}:00:00`).getTime() + 3600000;
    if (hit.time_branch) assert.ok(end > startDate.getTime(), `${hit.date} ${hit.time_branch} 已过去`);
    else assert.notEqual(hit.date, '2026-11-11', '晚间起局不列当日日级窗口');
  }
  // 同一时间点不重复
  const keys = hits.map((hit) => `${hit.date}|${hit.time_branch}`);
  assert.equal(new Set(keys).size, keys.length);
  // 两个用神同时被引动时合并
  assert.ok(hits.some((hit) => hit.target_symbols.length === 2));
  // 时辰级命中有上限，后面要留给日级窗口
  assert.ok(hits.filter((hit) => hit.time_branch).length <= 4);
  assert.ok(hits.some((hit) => !hit.time_branch));
});
