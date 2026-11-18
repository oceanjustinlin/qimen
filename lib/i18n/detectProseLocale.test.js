'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { withLocaleRetry, cjkRatio, proseMatchesLocale, sectionsMatchLocale, jsonMatchesLocale } = require('./detectProseLocale.js');

test('spec 验收 1–3', () => {
  assert.equal(proseMatchesLocale('The Open Door (开门) sits in Zhen 3 (震3宫), which favors action.', 'en-US'), true);
  assert.equal(proseMatchesLocale('日干落震三宫，临开门，利于行动。', 'en-US'), false);
  assert.equal(proseMatchesLocale('任何中文', 'zh-CN'), true);
});

test('cjkRatio 去掉括号内容', () => {
  assert.equal(cjkRatio('Open (开门)'), 0);
  assert.ok(cjkRatio('开门 open') > 0.3);
  assert.equal(cjkRatio(''), 0);
});

test('中英混写超过阈值算不匹配', () => {
  assert.equal(proseMatchesLocale('This month 事业运势偏弱，需要谨慎行事。', 'en-US'), false);
});

test('多段与 JSON', () => {
  assert.equal(sectionsMatchLocale({ a: 'All good here.', b: '全是中文的段落。' }, 'en-US'), false);
  assert.equal(sectionsMatchLocale(['All good here.', 'Also fine (财星).'], 'en-US'), true);
  assert.equal(jsonMatchesLocale({ summary: 'A steady day overall.', tone: 'positive', items: [{ text: 'Keep the pace.' }] }, 'en-US'), true);
  assert.equal(jsonMatchesLocale({ summary: '今天整体平稳，宜守不宜攻。' }, 'en-US'), false);
  assert.equal(jsonMatchesLocale({ summary: '今天整体平稳' }, 'zh-CN'), true);
});

test('spec 验收 4：先中文后英文 → 英文、只重试一次；两次中文 → mixed 不报错', async () => {
  const replies = [{ summary: '今天整体平稳，宜守不宜攻。' }, { summary: 'A steady day; hold your ground.' }];
  let calls = 0;
  const ok = await withLocaleRetry(async (i) => { calls += 1; return replies[i]; }, { contentLocale: 'en-US' });
  assert.equal(calls, 2);
  assert.equal(ok.mixed, false);
  assert.equal(ok.result.summary, replies[1].summary);

  const zh = { summary: '今天整体平稳，宜守不宜攻。' };
  const bad = await withLocaleRetry(async () => zh, { contentLocale: 'en-US' });
  assert.equal(bad.attempts, 2);
  assert.equal(bad.mixed, true);
});

test('spec 验收 5：中文请求只调一次', async () => {
  let calls = 0;
  const r = await withLocaleRetry(async () => { calls += 1; return { summary: '中文' }; }, { contentLocale: 'zh-CN' });
  assert.equal(calls, 1);
  assert.equal(r.mixed, false);
});
