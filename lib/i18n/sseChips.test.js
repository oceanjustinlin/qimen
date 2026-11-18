'use strict';
// T3.4：chip / tag 旧字段与改造前逐字一致，同时带新 key。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const c = require('./sseChips.js');

test('奇门 step 0 / 3 / 4', () => {
  assert.deepEqual(c.qimenCategoryChip('career_business', 'qimen'), { main: '事业运势', sub: '奇门遁甲', mainKey: 'enum.category.career_business', subKey: 'sse.chip.branchQimen' });
  assert.equal(c.qimenCategoryChip('unknown_cat', 'hybrid').main, '综合运势');
  assert.equal(c.qimenCategoryChip('unknown_cat', 'hybrid').subKey, 'sse.chip.branchHybrid');
  assert.deepEqual(c.qimenWindowsChip([]), { main: '发现 0 个窗口', sub: '暂无明确窗口', mainKey: 'sse.chip.windowsFound', mainParams: { n: 0 }, subKey: 'sse.chip.noWindow' });
  assert.equal(c.qimenWindowsChip([{}]).sub, '近日');
  assert.equal(c.qimenWindowsChip([{}]).subKey, 'sse.chip.windowSoon');
  assert.equal(c.qimenWindowsChip([{ date: '11-20' }]).sub, '11-20');
  assert.equal(c.qimenWindowsChip([{ date: '11-20' }]).subKey, undefined);
  assert.deepEqual(c.qimenPreScoreChip(72), { main: '初分 72', sub: '中上吉', mainKey: 'sse.chip.preScore', mainParams: { score: 72 }, subKey: 'enum.scoreBand.aboveAverage' });
  assert.equal(c.qimenPreScoreChip(55).sub, '中平');
  assert.equal(c.qimenPreScoreChip(30).sub, '偏凶');
});

test('奇门 engine_complete tags：局名不加 key', () => {
  const tags = c.qimenEngineTags({ category: 'relationship', structure: '阳遁6局', score: 61, windowCount: 3 });
  assert.deepEqual(tags.map((t) => t.label), ['感情婚恋', '阳遁6局', '初分61 · 中平', '3个应期窗口']);
  assert.equal(tags[1].labelKey, undefined);
  assert.equal(tags[2].isScore, true);
  assert.deepEqual(tags[2].labelParams, { score: 61, bandKey: 'enum.scoreBand.average' });
  assert.equal(c.qimenEngineTags({ category: 'general', structure: 'x', score: 80, windowCount: 0 }).length, 3);
});

test('八字问事 step 0–4 与 tags', () => {
  assert.deepEqual(c.baziCategoryChip('finance_wealth'), { main: '财运分析', sub: '八字命理', mainKey: 'enum.category.finance_wealth', subKey: 'sse.chip.branchBazi' });
  assert.deepEqual(c.baziDayMasterChip('甲', ''), { main: '日主甲', sub: '命盘就绪', mainKey: 'sse.bazi.dayMaster', mainParams: { symbol: '甲' }, subKey: 'sse.bazi.chartReady' });
  assert.equal(c.baziDayMasterChip('甲', '身弱').sub, '身弱');
  assert.equal(c.baziDayMasterChip('甲', '身弱').subKey, undefined);
  assert.deepEqual(c.baziModeChip('timing', 'bazi'), { main: '时间推演', sub: '八字命理', mainKey: 'sse.bazi.mode.timing', subKey: 'sse.chip.branchBazi' });
  assert.equal(c.baziModeChip('timing', 'hybrid').sub, '综合推演');
  assert.deepEqual(c.baziModeChip('weird'), { main: '分析模式', sub: '命理分析', mainKey: 'sse.bazi.modeFallback', subKey: 'sse.bazi.analysisFallback' });
  assert.deepEqual(c.baziScopeChip('next_3_years', null), { main: '近三年', sub: '命局推演', mainKey: 'sse.bazi.scope.next_3_years', subKey: 'sse.bazi.scopeSub' });
  assert.deepEqual(c.baziScopeChip('specified_range', '2022–2028'), { main: '命局综合', sub: '2022–2028', mainKey: 'sse.bazi.scope.unknown' });
  assert.equal(c.baziFavorableChip(''), null);
  assert.deepEqual(c.baziFavorableChip('木火'), { main: '喜木火', sub: '忌神已标记', mainKey: 'sse.bazi.favorable', mainParams: { symbol: '木火' }, subKey: 'sse.bazi.godsMarked' });
  const tags = c.baziEngineTags({ category: 'career_business', dayMaster: '甲', favorable: '木', mode: 'status' });
  assert.deepEqual(tags.map((t) => t.label), ['事业运势', '日主甲', '喜木', '当下状态']);
  assert.ok(tags.every((t) => t.labelKey));
});

test('八字档案 step 0–2', () => {
  assert.deepEqual(c.profileStep(0, 10, 'validate'), { type: 'step', index: 0, pct: 10, label: '校验档案', labelKey: 'sse.profile.validate' });
  assert.equal(c.profileStep(2, 50, 'llm').label, 'AI 断语生成');
});

test('Worker：llm_retry 带 messageKey、llm_error 带 code，chip 走构造函数', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../worker/src/index.js'), 'utf8');
  assert.equal((src.match(/type: 'llm_retry', message: 'AI 重新推演中…', messageKey: 'sse.llmRetry'/g) || []).length, 2);
  assert.match(src, /type: 'llm_error', message: 'AI 深度断语暂时不可用，已保留规则引擎结果', code: 'LLM_UNAVAILABLE_PARTIAL'/);
  assert.doesNotMatch(src, /chip: \{ main: `初分/);
  assert.doesNotMatch(src, /chip: \{ main: `发现/);
  assert.doesNotMatch(src, /chip: \{ main: `日主/);
});
