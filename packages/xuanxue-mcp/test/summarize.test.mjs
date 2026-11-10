import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEnvelope, TRIM_WARNING } from '../src/summarize.mjs';
import { loadEngine } from '../src/engine.mjs';

const birth = { date: '1990-05-01', time: '14:00', gender: '男' };

test('失败外层与 calendar 原样返回', () => {
  const failure = { ok: false, code: 'TIME_REQUIRED', message: 'm', hint: 'h' };
  assert.equal(summarizeEnvelope('bazi', failure), failure);
  const cal = loadEngine().calendar({ action: 'jieqi', year: 2026 });
  assert.equal(summarizeEnvelope('calendar', cal), cal);
});

test('不修改传入的引擎外层（深拷贝）', () => {
  const env = loadEngine().ziwei({ birth, mode: 'evidence', topic: 'career', current_year: 2026 });
  const before = JSON.stringify(env);
  const out = summarizeEnvelope('ziwei', env);
  assert.equal(JSON.stringify(env), before);
  assert.notEqual(out, env);
  assert.ok(out.warnings.includes(TRIM_WARNING));
});

test('bazi chart 模式无可精简字段时不加 warning', () => {
  const env = loadEngine().bazi({ birth, mode: 'chart' });
  const out = summarizeEnvelope('bazi', env);
  assert.deepEqual(out, env);
  assert.ok(!out.warnings.includes(TRIM_WARNING));
});

test('qimen 问事输出本身不大：summary 与 full 相同', () => {
  const env = loadEngine().qimen({ mode: 'question', question: '这次面试能成吗', cast_time: '2026-11-05T14:30:00' });
  assert.deepEqual(summarizeEnvelope('qimen', env), env);
});

test('astro summary：容许度大于 5° 的宽相位折叠为计数，full 原样', () => {
  const env = loadEngine().astro({ birth: { date: '1990-05-17', time: '10:20', location: { place: '杭州' } } });
  const wide = env.chart.aspects.filter((a) => a.orb > 5).length;
  assert.ok(wide > 0);
  const s = summarizeEnvelope('astro', env);
  assert.ok(s.chart.aspects.every((a) => a.orb <= 5));
  assert.equal(s.chart.aspects_omitted.count, wide);
  assert.ok(s.warnings.includes(TRIM_WARNING));
  assert.equal(env.chart.aspects_omitted, undefined, '不修改原外层');
});
