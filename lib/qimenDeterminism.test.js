// issue #24 回归：排盘与评分/应期链路的确定性错误。每个 test 对应审核报告的一项。
const test = require('node:test');
const assert = require('node:assert/strict');
const { Solar } = require('lunar-javascript');

const { buildQimenChart, buildEvidencePalaces, buildSymbolContext } = require('./qimenChart.js');
const { buildQimenEvidence } = require('./qimenPipeline.js');
const { getYongshenRule } = require('./qimenYongshenRules.js');
const {
  calculateQimenScore,
  evaluateNamedFormation,
  resolveHostGuestSymbols,
  getCoreSymbols
} = require('./qimenScoringEngine.js');
const { buildTimingAnalysis, buildTimingPromptSection, scanFutureTriggers } = require('./qimenTimingRules.js');
const { matchesSymbol, normalizeGod, normalizeDoor, normalizeStar } = require('./qimenSymbols.js');

function palace(overrides = {}) {
  return {
    index: 8, name: '乾6宫', element: '金',
    door: '杜门', star: '天柱', god: '朱雀', sky: '壬', earth: '戊',
    isKong: false, hasMa: false, isZhiShi: false, isDayStem: false, isHourStem: false,
    ...overrides
  };
}

// ── 排盘层 ──

test('年/月柱按交节时刻：立春前后与定局同口径', () => {
  const before = buildQimenChart({ year: 2026, month: 2, day: 4, hour: 3, minute: 0 });
  const after = buildQimenChart({ year: 2026, month: 2, day: 4, hour: 9, minute: 0 });
  assert.equal(before.qimenData.pillars.year, '乙巳');
  assert.equal(before.qimenData.pillars.month, '己丑');
  assert.equal(before.qimenData.ju_info.jieqi, '大寒');
  assert.equal(after.qimenData.pillars.year, '丙午');
  assert.equal(after.qimenData.pillars.month, '庚寅');
  assert.equal(after.qimenData.ju_info.jieqi, '立春');
});

test('晚子时按夜子时口径：日柱/日空/定元属当日，时柱起次日子时，且 chart 与 pipeline 同口径', () => {
  // 2026-01-04 戊寅日 23:30：时柱甲子（己日子时），日柱仍戊寅，定元随当日符头。
  const late = buildQimenChart({ year: 2026, month: 1, day: 4, hour: 23, minute: 30 });
  assert.equal(late.qimenData.pillars.hour, '甲子');
  assert.equal(late.qimenData.pillars.day, '戊寅');
  assert.equal(late.qimenData.auxiliary.kong_wang.day, '申酉');
  assert.equal(late.qimenData.ju_info.name, '陽遁4局');
  assert.equal(late.qimenData.ju_info.yuan, '下元');

  // 次日 00:30 入己卯日早子时
  const early = buildQimenChart({ year: 2026, month: 1, day: 5, hour: 0, minute: 30 });
  assert.equal(early.qimenData.pillars.day, '己卯');
  assert.equal(early.qimenData.ju_info.name, '陽遁1局');

  const ev = buildQimenEvidence({ year: 2026, month: 1, day: 4, hour: 23, minute: 30, intent: { branch: 'qimen', category: 'general' } });
  assert.equal(ev.ganzhiDay, late.qimenData.pillars.day);
  assert.equal(ev.ganzhiHour, late.qimenData.pillars.hour);
  assert.equal(ev.backendScoreInput.intent.dayStem, '戊');
});

test('天禽值符寄坤：有效宫同时承载值符神、天芮与寄星天禽，中宫不承载门星神', () => {
  const chart = buildQimenChart({ year: 2026, month: 9, day: 6, hour: 4, minute: 0 });
  assert.equal(chart.zhiFuStar, '天禽');
  const palaces = chart.qimenData.palaces;
  const effective = palaces[chart.effectiveZhiFuPalaceIndex];
  assert.equal(chart.qimenData.ju_info.zhi_fu_palace, `落${effective.name}`);
  assert.equal(effective.god, '值符');
  assert.equal(effective.star, '天芮');
  assert.equal(effective.ji_star, '天禽');
  assert.deepEqual(palaces.filter((p) => p.god === '值符').map((p) => p.index), [chart.effectiveZhiFuPalaceIndex]);
  assert.equal(palaces[4].is_center, true);
  assert.equal(palaces[4].star, undefined);
  assert.equal(palaces[4].god, undefined);

  // 用神「天禽星」可定位到寄宫
  const evidence = buildEvidencePalaces(chart);
  const hit = evidence.find((p) => matchesSymbol(p, '天禽星', buildSymbolContext(chart)));
  assert.equal(hit.index, chart.effectiveZhiFuPalaceIndex);
});

// ── 评分层 ──

test('P0-6 核心计分取 yongshen.primary/secondary，而非输出审计清单', () => {
  const rule = getYongshenRule('career_business');
  const core = getCoreSymbols(rule);
  assert.ok(core.has('日干'), '日干在 primary 中，必须计分');
  assert.ok(core.has('开门'));
  assert.ok(core.has('值使门'));

  // 规则未声明 yongshen 时才回退审计清单
  const fallback = getCoreSymbols({ outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['时干'] } });
  assert.deepEqual([...fallback], ['时干']);

  const result = calculateQimenScore({
    intent: { category: 'career_business', dayStem: '丙', hourStem: '壬' },
    palaces: [
      palace({ index: 0, name: '巽4宫', element: '木', isDayStem: true, sky: '丙', door: '休门', star: '天辅', god: '六合' }),
      palace({ index: 1, name: '离9宫', element: '火', isHourStem: true, sky: '壬', door: '开门' })
    ],
    yongshenRule: { ...rule, outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['开门'] } }
  });
  assert.ok(result.yongshen_nodes.some((node) => node.palace_index === 0), '日干宫进入核心计分');
});

test('P0-7 主客按领域用神取：事业=日干/开门，诉讼等未声明领域回退日干/时干', () => {
  assert.deepEqual(
    (({ host, guest }) => ({ host, guest }))(resolveHostGuestSymbols(getYongshenRule('career_business'), { category: 'career_business' })),
    { host: '日干', guest: '开门' }
  );
  assert.equal(resolveHostGuestSymbols(getYongshenRule('health_action'), { category: 'health_action' }).guest, '天芮星');
  assert.equal(resolveHostGuestSymbols({ hostGuest: { host: '值符', guest: '开门' } }, {}).host, '值符');
  assert.equal(resolveHostGuestSymbols(getYongshenRule('lawsuit_legal'), { category: 'lawsuit_legal' }).source, 'fallback');

  // 开门宫（金）克日干宫（木）：事业题按开门克我计负，不再拿时干宫（水生木）误算成正
  const result = calculateQimenScore({
    intent: { category: 'career_business', dayStem: '丙', hourStem: '壬' },
    palaces: [
      palace({ index: 0, name: '巽4宫', element: '木', isDayStem: true, sky: '丙' }),
      palace({ index: 7, name: '坎1宫', element: '水', isHourStem: true, sky: '壬', door: '休门' }),
      palace({ index: 5, name: '兑7宫', element: '金', door: '开门', sky: '庚' })
    ],
    yongshenRule: getYongshenRule('career_business')
  });
  assert.deepEqual(result.host_guest, { host: '日干', guest: '开门', source: 'domain' });
  assert.equal(result.relations[0].relation, 'control');
  assert.ok(result.deltas.relation < 0);
});

test('P0-8 符号归一化：拆 /、去星后缀、繁简门名、天干只看天盘、甲取遁仪', () => {
  const p = palace({ door: '開門', star: '天芮', god: '太陰', sky: '乙', earth: '庚', isDayStem: true });
  assert.ok(matchesSymbol(p, '天芮星'));
  assert.ok(matchesSymbol(p, '开门'));
  assert.ok(matchesSymbol(p, '太阴'));
  assert.ok(matchesSymbol(p, '时干/日干'));
  assert.ok(matchesSymbol(p, '丙/乙'));
  assert.ok(!matchesSymbol(p, '庚'), '地盘庚不再与天盘用神重复命中');
  assert.ok(matchesSymbol(palace({ sky: '戊' }), '甲', { jiaHiddenStem: '戊' }));
  assert.ok(!matchesSymbol(palace({ sky: '戊' }), '甲', { jiaHiddenStem: '己' }));
  assert.ok(matchesSymbol(palace({ sky: '丁', ji_sky: '戊' }), '戊'), '寄干计入天盘');
  assert.equal(normalizeDoor('驚門'), '惊门');
  assert.equal(normalizeStar('天沖星'), '天冲');
});

test('P0-8 关系类用神（乙/庚）不再因地盘同字让两宫同时计分', () => {
  const result = calculateQimenScore({
    intent: { category: 'relationship', dayStem: '丙', hourStem: '壬' },
    palaces: [
      palace({ index: 0, name: '巽4宫', element: '木', sky: '乙', earth: '戊' }),
      palace({ index: 1, name: '离9宫', element: '火', sky: '辛', earth: '乙' })
    ],
    yongshenRule: { yongshen: { primary: [{ symbol: '乙' }] } }
  });
  assert.deepEqual(result.yongshen_nodes.map((n) => n.palace_index), [0]);
});

test('P0-8a 四干只取 pipeline 注入值，不再从宫位 .earth 反猜', () => {
  // 旧逻辑：intent 无 dayStem 时取 isDayStem 宫的地盘干（庚）与时干宫地盘（甲）→ 误报五不遇时
  const guessed = evaluateNamedFormation(
    [palace({ isDayStem: true, sky: '丙', earth: '甲' }), palace({ index: 0, isHourStem: true, sky: '壬', earth: '庚' })],
    { category: 'general' }
  );
  assert.ok(!guessed.hits.some((h) => h.signal === '五不遇时'));

  // 注入后：甲日庚时（阳克阳）命中
  const injected = evaluateNamedFormation([palace()], { category: 'general', dayStem: '甲', hourStem: '庚' });
  assert.ok(injected.hits.some((h) => h.signal === '五不遇时'));

  // 伏干格用可见日干：甲日遁戊，庚加地盘戊即伏干
  const fuGan = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '戊' })],
    { category: 'general', dayStem: '甲', dayStemVisible: '戊' }
  );
  assert.ok(fuGan.hits.some((h) => h.signal === '伏干格'));
});

test('P0-8a pipeline 注入四柱干与可见干', () => {
  const ev = buildQimenEvidence({ year: 2026, month: 9, day: 1, hour: 2, minute: 0, intent: { branch: 'qimen', category: 'career_business' } });
  const intent = ev.backendScoreInput.intent;
  for (const key of ['yearStem', 'monthStem', 'dayStem', 'hourStem', 'dayStemVisible', 'hourStemVisible', 'yearStemVisible', 'monthStemVisible', 'jiaHiddenStem']) {
    assert.ok(intent[key], `${key} 必须注入`);
  }
});

test('P0-8b 中5宫即使缺 is_center 标志也不计分', () => {
  const result = calculateQimenScore({
    intent: { category: 'general', dayStem: '丙', hourStem: '壬' },
    palaces: [palace({ index: 4, name: '中5宫', element: '土', isDayStem: true, door: '开门', star: '天禽', god: '值符' })],
    yongshenRule: { yongshen: { primary: [{ symbol: '日干' }] } }
  });
  assert.equal(result.yongshen_nodes.length, 0);
  assert.equal(result.deltas.macro, 0);
});

test('P1-5 八神繁体字形（太陰/勾陳/滕蛇）正常计分并命中人假格', () => {
  assert.equal(normalizeGod('滕蛇'), '腾蛇');
  assert.equal(normalizeGod('螣蛇'), '腾蛇');
  assert.equal(normalizeGod('太陰'), '太阴');
  assert.equal(normalizeGod('勾陳'), '勾陈');

  const score = (god) => calculateQimenScore({
    intent: { category: 'general', dayStem: '丙', hourStem: '壬' },
    palaces: [palace({ isDayStem: true, god, door: '杜门', star: '天柱' })],
    yongshenRule: { yongshen: { primary: [{ symbol: '日干' }] } }
  }).yongshen_nodes[0].components.god;
  assert.equal(score('太陰'), 2);
  assert.equal(score('勾陳'), -2);

  const renJia = evaluateNamedFormation([palace({ door: '驚門', sky: '丙', god: '滕蛇' })], { category: 'general' });
  assert.ok(renJia.hits.some((h) => h.signal === '人假格'));
  const zhenZha = evaluateNamedFormation([palace({ door: '開門', sky: '乙', god: '太陰' })], { category: 'general' });
  assert.ok(zhenZha.hits.some((h) => h.signal === '真诈格'));
});

// ── 应期层 ──

test('P0-9 应期扫描：日级命中每天只记一次，且不含起局前已过去的时辰', () => {
  const start = new Date(2026, 4, 12, 10, 30, 0);
  const hits = scanFutureTriggers({
    startDate: start,
    days: 10,
    maxHits: 50,
    p1Candidates: [{ timing_type: 'kongwang_fill_or_clash', target_symbol: '开门', branches: ['寅', '卯'] }]
  });
  assert.ok(hits.length > 0);
  const dayKeys = hits.filter((h) => h.branch_type === 'day').map((h) => `${h.date}|${h.trigger}|${h.basis}`);
  assert.equal(new Set(dayKeys).size, dayKeys.length, '日级命中不重复');
  for (const h of hits) {
    const end = new Date(`${h.date}T${String(h.hour).padStart(2, '0')}:00:00`).getTime() + 60 * 60 * 1000;
    assert.ok(end > start.getTime(), `${h.date} ${h.hour} 时已过去`);
  }
  assert.ok(!hits.some((h) => h.date === '2026-05-12' && h.hour < 10));
});

test('P0-8 应期能定位 日干 / 天芮星 / 繁体门名，且不落中宫', () => {
  const analysis = buildTimingAnalysis({
    generatedAt: new Date(2026, 4, 12, 10, 0, 0),
    targetSymbols: [{ symbol: '日干' }, { symbol: '天芮星' }, { symbol: '开门' }, { symbol: '戊' }],
    chart: {
      dayKongBranches: ['寅', '卯'], hourKongBranches: ['寅', '卯'],
      palaces: [
        { index: 0, name: '巽4宫', branches: ['辰', '巳'], door: '開門', star: '天沖', god: '九天', sky: '乙', earth: '戊', isDayStem: true },
        { index: 2, name: '坤2宫', branches: ['未', '申'], door: '生門', star: '天芮', god: '六合', sky: '丁', earth: '庚' },
        { index: 4, name: '中5宫', is_center: true, sky: '戊', earth: '戊', star: '天禽' }
      ]
    },
    scanDays: 3,
    recheckLimit: 0
  });
  const targets = analysis.p1_candidates.map((c) => `${c.target_symbol}@${c.target_palace}`);
  assert.ok(targets.includes('日干@巽4宫'));
  assert.ok(targets.includes('天芮星@坤2宫'));
  assert.ok(targets.includes('开门@巽4宫'));
  assert.ok(!targets.some((t) => t.endsWith('中5宫')), '中宫不作用神落宫');
});

test('P0-10 复核找不到用神时不得回 target_is_kong=false 形成假转吉', () => {
  const analysis = buildTimingAnalysis({
    generatedAt: new Date(2026, 4, 12, 10, 0, 0),
    targetSymbols: [{ symbol: '开门' }],
    chart: {
      dayKongBranches: ['午'], hourKongBranches: [],
      palaces: [{ index: 1, name: '离9宫', branches: ['午'], door: '开门', star: '天英', god: '值符', sky: '丙', earth: '己', isKong: true }]
    },
    scanDays: 2,
    recheckLimit: 1,
    solarFactory: (d) => Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), 0, 0)
  });
  const recheck = analysis.p3_recheck[0].recheck;
  assert.equal(recheck.target_found, true, '开门每盘必有落宫');

  const section = buildTimingPromptSection({
    p1_candidates: [],
    p2_scan: { candidates: [] },
    p3_recheck: [{ candidate: { date: '2026-05-13', time_branch: '申' }, recheck: { target_symbol: '天乙', target_found: false, target_is_kong: null } }]
  });
  assert.match(section, /未定位到该用神，不能作为转吉依据/);
  assert.doesNotMatch(section, /不再空亡/);
});

test('P0-10 复核盘与主盘同源：晚子时候选也能给出确定的复核结果', () => {
  const analysis = buildTimingAnalysis({
    generatedAt: new Date(2026, 0, 4, 22, 0, 0),
    targetSymbols: [{ symbol: '日干' }],
    chart: {
      dayKongBranches: ['子'], hourKongBranches: [],
      palaces: [{ index: 7, name: '坎1宫', branches: ['子'], door: '休门', star: '天蓬', god: '值符', sky: '戊', earth: '戊', isDayStem: true, isKong: true }]
    },
    scanDays: 1,
    recheckLimit: 12,
    scanMaxHits: 12
  });
  for (const { recheck } of analysis.p3_recheck) {
    assert.equal(typeof recheck.target_found, 'boolean');
    if (recheck.target_found) assert.equal(typeof recheck.target_is_kong, 'boolean');
  }
});

test('pipeline 端到端：事业题主客为日干/开门，应期能定位日干', () => {
  const ev = buildQimenEvidence({ year: 2026, month: 9, day: 1, hour: 10, minute: 0, intent: { branch: 'qimen', category: 'career_business' } });
  assert.equal(ev.backendScoreAudit.host_guest.host, '日干');
  assert.equal(ev.backendScoreAudit.host_guest.guest, '开门');
  assert.ok(ev.timingAnalysis.p1_candidates.some((c) => c.target_symbol === '日干'));
  for (const item of ev.timingAnalysis.p3_recheck) {
    assert.ok(item.recheck.target_found === true || item.recheck.target_is_kong === null);
  }
});
