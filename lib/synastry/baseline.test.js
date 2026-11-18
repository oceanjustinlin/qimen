'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessBaseline, targetSpecFor } = require('./baseline');
const { sampleView } = require('./samples');

const STABILITIES = ['strong', 'stable', 'dynamic', 'buried', 'damaged'];

test('S1 到 S6：两种关系类型都能评估，取值合法', () => {
  for (const code of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']) {
    for (const rt of ['friend', 'romance']) {
      const r = assessBaseline(sampleView(code), rt, 'A');
      assert.ok(STABILITIES.includes(r.stability), `${code} ${rt} ${r.stability}`);
      assert.equal(r.evidence.length, 1);
      assert.equal(r.evidence[0].id, 'baseline.stability');
      assert.equal(r.evidence[0].tie, 0);
    }
  }
});

test('时辰不详：取十二组里出现最多的等级，confidence 为 mid', () => {
  const r = assessBaseline(sampleView('S1', { hourKnown: false }), 'friend', 'B');
  assert.ok(STABILITIES.includes(r.stability));
  assert.equal(r.confidence, 'mid');
  assert.equal(r.evidence[0].dir, 'B<-A');
});

test('targetSpec 取值', () => {
  assert.deepEqual(targetSpecFor('M', 'romance').primary_shishen, ['正财', '偏财']);
  assert.deepEqual(targetSpecFor('F', 'romance').primary_shishen, ['正官', '七杀']);
  assert.deepEqual(targetSpecFor(null, 'romance').primary_shishen, []);
  assert.deepEqual(targetSpecFor('M', 'romance').primary_gongwei, ['日支']);
  assert.deepEqual(targetSpecFor('M', 'friend').primary_gongwei, ['月柱']);
});
