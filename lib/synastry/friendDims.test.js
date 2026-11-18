'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tierOf } = require('./friendDims');
const { buildSynastryReport } = require('./index');
const { samplePerson } = require('./samples');
const W = require('./weights');
const dist = require('../../eval/synastry/distribution.json');
const norms = require('./norms.json');

const PAIRS = [['S1', 'S2'], ['S1', 'S3'], ['S1', 'S4'], ['S1', 'S5'], ['S5', 'S6'], ['S2', 'S3'], ['S4', 'S6']];

test('五维度：消耗恒不大于 0，各维度在 −100 到 100', () => {
  for (const [x, y] of PAIRS) {
    const f = buildSynastryReport({ A: samplePerson(x), B: samplePerson(y) }).friendDims;
    assert.ok(f.d3 <= 0, `${x}${y} d3 ${f.d3}`);
    for (const k of ['d1', 'd2', 'd3', 'd4', 'd5', 'total']) {
      assert.ok(f[k] >= -100 && f[k] <= 100, `${x}${y} ${k} ${f[k]}`);
    }
    assert.ok(W.friend.tierLabels.includes(f.tier));
    for (const d of ['d1', 'd2', 'd3', 'd4', 'd5']) {
      assert.equal(typeof f.raw[d].s1, 'number');
      assert.equal(typeof f.raw[d].s3, 'number');
    }
    assert.ok(f.raw.d3.s1 <= 0 && f.raw.d3.s3 <= 0);
    assert.ok(f.parts.d3.s1 <= 0 && f.parts.d3.s3 <= 0);
    for (const d of ['d1', 'd2', 'd4', 'd5']) assert.ok(Math.abs(f.parts[d].s1 + f.parts[d].s3 - f[d]) <= 1, `${x}${y} ${d} parts`);
  }
});

test('S1 对 S2（日柱天合地合）同频为正', () => {
  const f = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S2') }).friendDims;
  assert.ok(f.d1 > 0);
});

test('八档称号与分数线', () => {
  assert.equal(norms.friend.tierCuts.length, 7);
  const cuts = norms.friend.tierCuts;
  for (let i = 1; i < cuts.length; i += 1) assert.ok(cuts[i] < cuts[i - 1]);
  assert.equal(tierOf(100, cuts).tier, '天生对盘');
  assert.equal(tierOf(-100, cuts).tier, '不对盘');
});

test('一万对随机样本：称号占比与目标偏差不超过 3 个百分点', () => {
  for (const [label, target] of Object.entries(dist.friend.tierTarget)) {
    const got = dist.friend.tier[label] || 0;
    assert.ok(Math.abs(got - target) <= 0.03, `${label} ${got} vs ${target}`);
  }
});
