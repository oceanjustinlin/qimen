// I3：默认 detail=summary 时主路径输出不超过 Claude Code 的 MCP 输出上限（按 20k 估算 token 控制）
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { loadEngine } from '../src/engine.mjs';

const serverPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const birth = { date: '1990-05-01', time: '14:00', gender: '男', location: { place: '杭州' } };
const TRIM_WARNING = '已精简输出；如需完整数据请传 detail: "full"';
const LIMIT = 20_000;
let client;

// 估算口径：CJK 字符记 1 token，其余字符每 3.5 个记 1 token
export const estimateTokens = (s) => {
  let cjk = 0;
  let other = 0;
  for (const ch of s) {
    if (/[　-〿㐀-鿿豈-﫿＀-￯]/u.test(ch)) cjk += 1;
    else other += 1;
  }
  return Math.ceil(cjk + other / 3.5);
};

before(async () => {
  client = new Client({ name: 'size', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
});
after(async () => { await client.close(); });

const call = (name, args) => client.callTool({ name, arguments: args });
const { validateEnvelope } = loadEngine().cliEnvelope;

const MAIN_PATHS = {
  'bazi question': ['bazi', { birth, mode: 'question', question: '我什么时候能升职', current_year: 2026 }],
  'ziwei evidence': ['ziwei', { birth, mode: 'evidence', topic: 'career', current_year: 2026 }],
  'ziwei evidence + 10 个流年 cross_period': ['ziwei', { birth, mode: 'evidence', topic: 'career', current_year: 2026, time_scope: { type: 'cross_period', start_year: 2026, end_year: 2035 } }],
  'qimen question': ['qimen', { mode: 'question', question: '这次面试能成吗', cast_time: '2026-11-05T14:30:00', birth }],
};

for (const [label, [name, args]] of Object.entries(MAIN_PATHS)) {
  test(`${label}：默认 summary 输出 ≤ ${LIMIT} 估算 token，且通过 validateEnvelope`, async () => {
    const r = await call(name, args);
    assert.equal(r.structuredContent.ok, true, r.content[0].text.slice(0, 300));
    const textTokens = estimateTokens(r.content[0].text);
    const structTokens = estimateTokens(JSON.stringify(r.structuredContent));
    console.error(`[size] ${label}: text≈${textTokens} structured≈${structTokens}`);
    assert.ok(textTokens <= LIMIT, `content text ≈ ${textTokens} tokens`);
    assert.ok(structTokens <= LIMIT, `structuredContent ≈ ${structTokens} tokens`);
    const v = validateEnvelope(r.structuredContent);
    assert.equal(v.valid, true, JSON.stringify(v.errors));
  });
}

test('content text 是紧凑 JSON（无缩进），且与 structuredContent 一致', async () => {
  const r = await call('bazi', { birth, mode: 'chart' });
  const text = r.content[0].text;
  assert.doesNotMatch(text, /\n/);
  assert.equal(text, JSON.stringify(r.structuredContent));
});

test('bazi/ziwei/qimen 的 inputSchema 有 detail（summary | full），calendar 没有', async () => {
  const { tools } = await client.listTools();
  for (const t of tools) {
    const d = t.inputSchema.properties.detail;
    if (t.name === 'calendar') assert.equal(d, undefined);
    else assert.deepEqual(d.enum, ['summary', 'full'], t.name);
  }
});

test('detail 非法值 → BAD_JSON', async () => {
  const r = await call('bazi', { birth, mode: 'chart', detail: 'all' });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.code, 'BAD_JSON');
  assert.match(r.structuredContent.message, /detail/);
});

test('bazi question summary：timing_candidates 只留引擎排序前 5 个，并给出精简 warning', async () => {
  const [name, args] = MAIN_PATHS['bazi question'];
  const full = (await call(name, { ...args, detail: 'full' })).structuredContent;
  const sum = (await call(name, args)).structuredContent;
  const fullTc = full.judgments.question.timing_candidates;
  assert.ok(fullTc.length > 5, `full 有 ${fullTc.length} 个候选`);
  const sumTc = sum.judgments.question.timing_candidates;
  assert.equal(sumTc.length, 5);
  assert.deepEqual(sumTc.map((c) => c.year), fullTc.slice(0, 5).map((c) => c.year));
  assert.ok(sum.warnings.includes(TRIM_WARNING), sum.warnings.join('|'));
  assert.ok(!full.warnings.includes(TRIM_WARNING));
});

test('ziwei summary：natal_features 换成按宫位的精简摘要，periods 不带 dynamic_features 原文', async () => {
  const [name, args] = MAIN_PATHS['ziwei evidence + 10 个流年 cross_period'];
  const sum = (await call(name, args)).structuredContent;
  assert.equal(sum.chart.natal_features, undefined);
  const s = sum.chart.natal_features_summary;
  assert.equal(Object.keys(s.by_palace).length, 12);
  assert.ok(s.by_palace['官禄宫']);
  assert.ok(s.methods && typeof s.methods === 'object');
  assert.equal(sum.chart.periods.length, 10);
  for (const p of sum.chart.periods) {
    assert.equal(p.dynamic_features, undefined);
    assert.ok(p.dynamic_features_summary, `period ${p.year}`);
  }
  assert.ok(sum.warnings.includes(TRIM_WARNING));
});

test('detail: "full" 返回与引擎（CLI run）完全相同的外层', async () => {
  const engine = loadEngine();
  for (const [name, args] of Object.values(MAIN_PATHS)) {
    const r = await call(name, { ...args, detail: 'full' });
    assert.deepEqual(r.structuredContent, JSON.parse(JSON.stringify(engine[name](args))), name);
  }
});
