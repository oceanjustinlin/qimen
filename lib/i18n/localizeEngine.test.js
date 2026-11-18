'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { localizeEnginePayload, collectByPath, isPureSymbol, sha256Hex } = require('./localizeEngine.js');

const payload = () => ({
  weekly_tag: '稳中求进',
  event_forecast: { career: '本周事业重现实成果。', wealth: '本周财富信号偏正向。' },
  hits: [{ reason: '开门临生门，利于推进' }, { reason: '甲' }],
  score: 72,
  llm: '这一段是 LLM 的，不碰',
});
const PATHS = ['weekly_tag', 'event_forecast.*', 'hits.*.reason'];
const spy = () => {
  const calls = { get: 0, put: [], translate: 0 };
  return {
    calls,
    tm: { getMany: async () => { calls.get += 1; return {}; }, putMany: async (rows) => { calls.put.push(rows); } },
    translate: async (list) => { calls.translate += 1; return list.map((s) => `EN:${s.length}`); },
  };
};

test('路径收集支持 * 通配', () => {
  assert.deepEqual(collectByPath(payload(), 'hits.*.reason').map((h) => h.path), [['hits', 0, 'reason'], ['hits', 1, 'reason']]);
  assert.equal(collectByPath(payload(), 'event_forecast.*').length, 2);
});

test('验收 1：zh-CN 返回同一引用，不调用 tm / translate', async () => {
  const p = payload(); const s = spy();
  const r = await localizeEnginePayload(p, { contentLocale: 'zh-CN', paths: PATHS, tm: s.tm, translate: s.translate });
  assert.equal(r.payload, p);
  assert.equal(s.calls.get + s.calls.translate, 0);
});

test('验收 2：全部命中词条时不调 tm 与 translate；纯符号直接双语化', async () => {
  const s = spy();
  const catalog = { 稳中求进: { en: 'Steady progress' }, '本周事业重现实成果。': { en: 'Career: concrete results.' }, '本周财富信号偏正向。': 'Money leans positive.', 开门临生门利于推进: 'x', '开门临生门，利于推进': { en: 'Open Door meets Life Door.' } };
  const r = await localizeEnginePayload(payload(), { contentLocale: 'en-US', paths: PATHS, catalog, tm: s.tm, translate: s.translate });
  assert.equal(s.calls.get + s.calls.translate, 0);
  assert.equal(r.payload.weekly_tag, 'Steady progress');
  assert.equal(r.payload.event_forecast.wealth, 'Money leans positive.');
  assert.equal(r.payload.hits[1].reason, 'Jia (甲)');
  assert.equal(r.payload.llm, '这一段是 LLM 的，不碰');
  assert.ok(isPureSymbol('甲'));
});

test('验收 3：词条未命中、记忆命中时不调 translate', async () => {
  const s = spy();
  const all = ['稳中求进', '本周事业重现实成果。', '本周财富信号偏正向。', '开门临生门，利于推进'];
  const hs = await Promise.all(all.map(sha256Hex));
  s.tm.getMany = async (asked) => { s.calls.get += 1; return Object.fromEntries(asked.map((h) => [h, `TM:${hs.indexOf(h)}`])); };
  const r = await localizeEnginePayload(payload(), { contentLocale: 'en-US', paths: PATHS, tm: s.tm, translate: s.translate });
  assert.equal(s.calls.translate, 0);
  assert.equal(r.stats.tmHits, 4);
  assert.equal(r.payload.weekly_tag, 'TM:0');
});

test('验收 4：都未命中时 translate 只调一次，结果写入 tm', async () => {
  const s = spy(); const bg = [];
  const r = await localizeEnginePayload(payload(), { contentLocale: 'en-US', paths: PATHS, tm: s.tm, translate: s.translate, waitUntil: (p) => bg.push(p) });
  await Promise.all(bg);
  assert.equal(s.calls.translate, 1);
  assert.equal(r.stats.translated, 4);
  assert.equal(s.calls.put.length, 1);
  assert.equal(s.calls.put[0].length, 4);
  assert.equal(s.calls.put[0][0].locale, 'en-US');
});

test('验收 5：超预算按时返回、保留原文，后台补完写回', async () => {
  const s = spy(); const bg = [];
  s.translate = async (list) => { await new Promise((r) => setTimeout(r, 200)); return list.map(() => 'late'); };
  const t0 = Date.now();
  const r = await localizeEnginePayload(payload(), { contentLocale: 'en-US', paths: PATHS, tm: s.tm, translate: s.translate, budgetMs: 30, waitUntil: (p) => bg.push(p) });
  assert.ok(Date.now() - t0 < 150);
  assert.ok(r.stats.fallback > 0);
  assert.equal(r.payload.weekly_tag, '稳中求进');
  assert.equal(bg.length, 1);
  await bg[0];
  assert.equal(s.calls.put.length, 1);
});

test('验收 6：translate 抛错不抛出，字段保留原文', async () => {
  const s = spy();
  s.translate = async () => { throw new Error('boom'); };
  const r = await localizeEnginePayload(payload(), { contentLocale: 'en-US', paths: PATHS, tm: s.tm, translate: s.translate });
  assert.equal(r.payload.event_forecast.career, '本周事业重现实成果。');
  assert.equal(r.stats.fallback, 4);
});

test('验收 7：入参不变', async () => {
  const p = payload(); const before = JSON.stringify(p);
  await localizeEnginePayload(p, { contentLocale: 'en-US', paths: PATHS, translate: async (l) => l.map(() => 'x') });
  assert.equal(JSON.stringify(p), before);
});
