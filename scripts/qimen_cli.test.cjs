'use strict';

/**
 * qimen_cli.test.cjs — parity 冒烟测试
 * 锁定不变量：CLI 是 buildQimenEvidence 的无损封装；cast_time 解析与错误码正确。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(__dirname, 'qimen_cli.cjs');
const { buildQimenEvidence } = require(path.join(ROOT, 'lib', 'qimenPipeline'));
const { classifyByRules } = require(path.join(ROOT, 'lib', 'divinationRouter'));
const { normalizeDivinationRoute } = require(path.join(ROOT, 'lib', 'divinationCategories'));
const { resolveCastTime, run } = require(CLI);

test('run(question) 与直接调用 buildQimenEvidence 结果一致', () => {
  const input = { mode: 'question', question: '下周面试能过吗', cast_time: '2026-11-05T09:30:00+08:00' };
  const intent = normalizeDivinationRoute(classifyByRules(input.question, { forceBranch: 'qimen' }));
  const parts = { year: 2026, month: 11, day: 5, hour: 9, minute: 30 };
  const ref = buildQimenEvidence({
    ...parts,
    panTimeParts: parts,
    baseTime: new Date('2026-11-05T09:30:00+08:00'),
    question: input.question,
    intent,
  });
  const out = run(input);
  assert.deepEqual(out.chart.qimenData, ref.qimenData);
  assert.deepEqual(out.judgments.score, ref.backendScoreAudit);
  assert.deepEqual(out.judgments.formations, ref.backendFormationTags);
  assert.deepEqual(out.judgments.timing, ref.timingAnalysis);
  assert.deepEqual(out.judgments.yongshen, ref.yongshenRule);
  assert.equal(out.ruleset, 'dunjia-yanyi-siku-v1');
  assert.equal(out.chart.qimenData.pan_time_source, 'custom');
  // 输出必须可 JSON 序列化（不含 lunar-javascript 对象）
  assert.doesNotThrow(() => JSON.stringify(out));
});

test('resolveCastTime: Z 时间换算为北京时间', () => {
  assert.deepEqual(resolveCastTime('2026-11-05T01:00:00Z'), { year: 2026, month: 11, day: 5, hour: 9, minute: 0, source: 'custom' });
});

test('resolveCastTime: 无时区按 timezone 理解', () => {
  assert.equal(resolveCastTime('2026-11-05T23:10:00', 'Asia/Shanghai').hour, 23);
  const r = resolveCastTime('2026-11-05T23:10:00', 'America/New_York');
  assert.deepEqual([r.day, r.hour, r.minute], [5, 23, 10]);
});

test('resolveCastTime: 缺省取 now 的北京时间', () => {
  const r = resolveCastTime(undefined, 'Asia/Shanghai', new Date('2026-11-05T16:30:00Z'));
  assert.deepEqual([r.day, r.hour, r.minute, r.source], [6, 0, 30, 'now']);
});

test('mode=chart 不需要 question', () => {
  const out = run({ mode: 'chart', cast_time: '2026-11-05T09:30:00+08:00' });
  assert.equal(out.chart.palaces.length, 9);
  assert.equal(out.judgments, undefined);
  assert.equal(out.system, 'qimen');
});

test('mode=question 缺 question → 子进程 ok:false QUESTION_REQUIRED，退出码 1', () => {
  let status = 0;
  let stdout = '';
  try {
    execFileSync('node', [CLI], { input: JSON.stringify({ mode: 'question' }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    status = e.status;
    stdout = e.stdout;
  }
  assert.equal(status, 1);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'QUESTION_REQUIRED');
});

test('非法 cast_time → CAST_TIME_INVALID', () => {
  assert.throws(() => run({ mode: 'chart', cast_time: 'abc' }), { code: 'CAST_TIME_INVALID' });
  assert.throws(() => run({ mode: 'chart', cast_time: '2026-13-45T09:30:00' }), { code: 'CAST_TIME_INVALID' });
});

test('flags 路径端到端输出 ok:true', () => {
  const stdout = execFileSync('node', [CLI, '--mode', 'chart', '--cast-time', '2026-11-05T09:30:00+08:00'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = JSON.parse(stdout);
  assert.equal(out.ok, true);
  assert.equal(out.input.cast_time.hour, 9);
});
