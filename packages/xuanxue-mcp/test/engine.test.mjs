import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadEngine } from '../src/engine.mjs';

test('loadEngine 返回五个 run 函数与 schemaPath', () => {
  const e = loadEngine();
  for (const k of ['bazi', 'ziwei', 'qimen', 'calendar', 'astro']) {
    assert.equal(typeof e[k], 'function', k);
  }
  assert.equal(typeof e.cliEnvelope.toFailure, 'function');
  assert.equal(typeof e.cliEnvelope.fail, 'function');
  assert.ok(existsSync(e.schemaPath));
  assert.match(e.schemaPath, /xuanxue-output\.schema\.json$/);
});

test('astro 本命盘可用', () => {
  const r = loadEngine().astro({ birth: { date: '1990-05-17', time: '10:20', location: { place: '杭州' } } });
  assert.equal(r.ok, true);
  assert.equal(r.system, 'astro');
});

test('bazi 排盘可用', () => {
  const r = loadEngine().bazi({ birth: { date: '1990-05-01', time: '14:00', gender: '男' } });
  assert.equal(r.ok, true);
});
