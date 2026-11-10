import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const birth = { date: '1990-05-01', time: '14:00', gender: '男' };
let client;

before(async () => {
  client = new Client({ name: 'e2e', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
});
after(async () => { await client.close(); });

const call = (name, args) => client.callTool({ name, arguments: args });

test('listTools 返回 5 个工具', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['astro', 'bazi', 'calendar', 'qimen', 'ziwei']);
  assert.ok(tools.every((t) => t.inputSchema.properties && t.description.includes('.')));
});

test('astro 本命盘正常；缺出生地 → isError，code LOCATION_REQUIRED', async () => {
  const ok = await call('astro', { birth: { date: '1990-05-17', time: '10:20', location: { place: '杭州' } } });
  assert.notEqual(ok.isError, true);
  assert.equal(ok.structuredContent.system, 'astro');
  const bad = await call('astro', { birth: { date: '1990-05-17', time: '10:20' } });
  assert.equal(bad.isError, true);
  assert.equal(bad.structuredContent.code, 'LOCATION_REQUIRED');
});

test('bazi chart 正常', async () => {
  const r = await call('bazi', { birth, mode: 'chart' });
  assert.equal(r.structuredContent.ok, true);
  assert.notEqual(r.isError, true);
  assert.equal(JSON.parse(r.content[0].text).ok, true);
});

test('bazi 缺 time → isError true，code TIME_REQUIRED', async () => {
  const r = await call('bazi', { birth: { date: '1990-05-01', gender: '男' } });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.code, 'TIME_REQUIRED');
});

test('参数校验失败 → BAD_JSON 外层而非 SDK 默认文本', async () => {
  const r = await call('bazi', { birth: { ...birth, time: '2pm' }, mode: 'nope' });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.ok, false);
  assert.equal(r.structuredContent.code, 'BAD_JSON');
  assert.match(r.structuredContent.message, /mode/);
  assert.match(r.structuredContent.message, /birth\.time/);
  assert.doesNotMatch(r.content[0].text, /Input validation error/);
});

test('未知工具名 → BAD_JSON 外层，isError true', async () => {
  const r = await call('nope', {});
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.code, 'BAD_JSON');
  assert.match(r.structuredContent.message, /nope/);
  assert.doesNotMatch(r.content[0].text, /not found/i);
});

test('ziwei evidence 正常；topic=health → TOPIC_UNSUPPORTED', async () => {
  const ok = await call('ziwei', { birth, mode: 'evidence', topic: 'career' });
  assert.equal(ok.structuredContent.ok, true);
  const bad = await call('ziwei', { birth, mode: 'evidence', topic: 'health' });
  assert.equal(bad.isError, true);
  assert.equal(bad.structuredContent.code, 'TOPIC_UNSUPPORTED');
});

test('qimen question 正常；mode=question 缺 question → QUESTION_REQUIRED', async () => {
  const ok = await call('qimen', { mode: 'question', question: '这次面试能成吗', cast_time: '2026-11-05T14:30:00' });
  assert.equal(ok.structuredContent.ok, true);
  const bad = await call('qimen', { mode: 'question' });
  assert.equal(bad.isError, true);
  assert.equal(bad.structuredContent.code, 'QUESTION_REQUIRED');
});

test('calendar true_solar 纽约 → PLACE_UNSUPPORTED；杭州与经度均可', async () => {
  const bad = await call('calendar', { action: 'true_solar', date: '1990-05-01', time: '14:00', location: { place: '纽约' } });
  assert.equal(bad.isError, true);
  assert.equal(bad.structuredContent.code, 'PLACE_UNSUPPORTED');
  const a = await call('calendar', { action: 'true_solar', date: '1990-05-01', time: '14:00', location: { place: '杭州' } });
  assert.equal(a.structuredContent.ok, true);
  const b = await call('calendar', { action: 'true_solar', date: '1990-05-01', time: '14:00', location: { longitude: 120.16 } });
  assert.equal(b.structuredContent.ok, true);
});

test('Node 版本检查：低于 22.12 给出中文错误，22.12 及以上通过', async () => {
  const { nodeVersionError } = await import('../src/server.mjs');
  for (const v of ['22.11.0', '20.19.5', '18.20.0', '21.99.0']) {
    const msg = nodeVersionError(v);
    assert.match(msg, /22\.12/, v);
    assert.match(msg, /Node/, v);
    assert.ok(msg.includes(v), v);
  }
  for (const v of ['22.12.0', '22.20.1', '23.0.0', '24.1.0']) assert.equal(nodeVersionError(v), null, v);
});
