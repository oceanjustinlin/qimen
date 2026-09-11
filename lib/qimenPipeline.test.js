const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQimenEvidence } = require('./qimenPipeline.js');
const { buildQimenChart } = require('./qimenChart.js');

// 固定起局时刻 + 已分类 route，证据包可复现。
const FIXED = { year: 2026, month: 6, day: 25, hour: 14, minute: 42 };
const INTENT = { branch: 'qimen', category: 'career_business', subcategory: 'job_search', confidence: 'high' };

function run(extra = {}) {
  return buildQimenEvidence({ ...FIXED, intent: INTENT, question: '这次面试能成吗', ...extra });
}

test('排盘量与 buildQimenChart 同源一致（局式/值符不漂）', () => {
  const ev = run();
  const chart = buildQimenChart(FIXED);
  assert.equal(ev.qimen_structure, chart.qimen_structure);
  assert.equal(ev.zhiFuStar, chart.zhiFuStar);
  assert.equal(ev.qimen_structure, '陰遁3局');
  assert.equal(ev.zhiFuStar, '天芮');
});

test('每宫带 stem_relation 与 prosperity（深度字段进证据包）', () => {
  const ev = run();
  assert.equal(ev.timingPalaces.length, 9);
  const nonCenter = ev.timingPalaces.filter((p) => p.index !== 4);
  // 非中宫宫位至少多数能定出天地盘干生克
  const withRel = nonCenter.filter((p) => p.stem_relation && p.stem_relation.length);
  assert.ok(withRel.length >= 6, `stem_relation 覆盖不足: ${withRel.length}`);
  // 旺衰按月令补算，至少有宫被标注
  const withPros = ev.timingPalaces.filter((p) => p.prosperity);
  assert.ok(withPros.length >= 6, `prosperity 覆盖不足: ${withPros.length}`);
});

test('日干与时干只按天盘明干/寄干定位，不由地盘同干和数组顺序抢占', () => {
  const ev = buildQimenEvidence({
    year: 2026, month: 9, day: 1, hour: 2, minute: 0,
    intent: INTENT,
    question: '当前局势如何'
  });
  const dayPalaces = ev.timingPalaces.filter((p) => p.isDayStem);
  assert.deepEqual(dayPalaces.map((p) => p.name), ['艮8宫']);
  assert.equal(dayPalaces[0].sky, '戊');
  assert.equal(ev.timingPalaces.find((p) => p.name === '兑7宫').isDayStemEarth, true);
});

test('评分输入显式携带节令四干、六甲遁仪和伏反吟事实', () => {
  const ev = run();
  const scoreIntent = ev.backendScoreInput.intent;
  assert.equal(scoreIntent.yearStem, ev.chart.yearStem);
  assert.equal(scoreIntent.monthStem, ev.chart.monthStem);
  assert.equal(scoreIntent.dayStemVisible, ev.chart.dayStemVisible);
  assert.equal(scoreIntent.hourStemVisible, ev.chart.hourStemVisible);
  assert.equal(scoreIntent.xunHead, ev.xunHead);
  assert.equal(typeof scoreIntent.isFuYin, 'boolean');
  assert.equal(typeof scoreIntent.isFanYin, 'boolean');
});

test('门迫、入墓、击刑字段由确定性盘面计算后进入评分宫位', () => {
  const ev = run();
  assert.ok(ev.timingPalaces.every((p) => typeof p.isDoorPressured === 'boolean'));
  assert.ok(ev.timingPalaces.every((p) => typeof p.isTomb === 'boolean'));
  assert.ok(ev.timingPalaces.every((p) => typeof p.isPunishment === 'boolean'));
});

test('评分链路产出可审计结构', () => {
  const ev = run();
  const audit = ev.backendScoreAudit;
  assert.equal(typeof audit.final_score, 'number');
  assert.ok(audit.final_score >= 0 && audit.final_score <= 100);
  assert.ok(Array.isArray(audit.adjustments));
  assert.ok(audit.deltas && typeof audit.deltas === 'object');
});

test('格局 tag 带落宫 palace_index', () => {
  const ev = run();
  for (const tag of ev.backendFormationTags) {
    assert.ok('palace_index' in tag);
    if (tag.palace_index != null) {
      assert.match(tag.palace, /宫$/);
    }
  }
});

test('纯奇门分支屏蔽命主八字', () => {
  const ev = run({ baziInfo: '甲子 丙寅 戊午 庚申' });
  assert.equal(ev.effectiveBaziInfo, '未提供八字信息');
  assert.equal(ev.hasBaziInfo, false);
});

test('hybrid 分支保留八字信息', () => {
  const ev = run({ intent: { ...INTENT, branch: 'hybrid' }, baziInfo: '甲子 丙寅 戊午 庚申' });
  assert.equal(ev.effectiveBaziInfo, '甲子 丙寅 戊午 庚申');
  assert.equal(ev.hasBaziInfo, true);
});

test('pan_time_source 标注：custom vs now', () => {
  const now = run();
  assert.equal(now.qimenData.pan_time_source, 'now');
  const custom = run({ panTimeParts: { ...FIXED } });
  assert.equal(custom.qimenData.pan_time_source, 'custom');
  assert.deepEqual(custom.qimenData.pan_time, { ...FIXED });
});

test('缺 intent 抛错（route 必须先分类）', () => {
  assert.throws(() => buildQimenEvidence({ ...FIXED }), /intent/);
});
