import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadEngine } from '../src/engine.mjs';

test('loadEngine 返回四个 run 函数与 schemaPath', () => {
  const e = loadEngine();
  for (const k of ['bazi', 'ziwei', 'qimen', 'calendar']) {
    assert.equal(typeof e[k], 'function', k);
  }
  assert.ok(existsSync(e.schemaPath));
  assert.match(e.schemaPath, /xuanxue-output\.schema\.json$/);
});

test('bazi 排盘可用', () => {
  const r = loadEngine().bazi({ birth: { date: '1990-05-01', time: '14:00', gender: '男' } });
  assert.equal(r.ok, true);
});
