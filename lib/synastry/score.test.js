'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, classifyStructure, scoreFourQuestions } = require('./score');
const { buildSynastryReport } = require('./index');
const { samplePerson } = require('./samples');
const dist = require('../../eval/synastry/distribution.json');

test('normalize：P50 → 50，P95 → 90，单调且不超过 100', () => {
  const n = { p50: 10, p95: 20 };
  assert.equal(normalize(0, n), 0);
  assert.equal(normalize(10, n), 50);
  assert.equal(normalize(20, n), 90);
  assert.ok(normalize(100, n) <= 100);
  let prev = -1;
  for (let x = 0; x < 60; x += 0.5) {
    const s = normalize(x, n);
    assert.ok(s >= prev);
    prev = s;
  }
});

test('结构类型的判定表', () => {
  const fq = (tie, A, B) => ({ tie: { score: tie }, benefit: { A, B } });
  assert.equal(classifyStructure(fq(80, 30, 30)), '相成');
  assert.equal(classifyStructure(fq(80, 30, -30)), '偏济');
  assert.equal(classifyStructure(fq(80, -30, -30)), '纠缠');
  assert.equal(classifyStructure(fq(30, 30, 30)), '淡益');
  assert.equal(classifyStructure(fq(30, 30, 0)), '淡益');
  assert.equal(classifyStructure(fq(30, 30, -30)), '平行');
  assert.equal(classifyStructure(fq(30, 0, 0)), '平行');
});

test('S1 对 S2 的缘高于 S1 对 S5', () => {
  const r12 = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S2') });
  const r15 = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S5') });
  assert.ok(r12.fourQuestions.tie.score > r15.fourQuestions.tie.score,
    `${r12.fourQuestions.tie.score} vs ${r15.fourQuestions.tie.score}`);
});

test('folk 证据不影响分数', () => {
  const r = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S2') });
  const base = { A: { stability: r.baseline.A }, B: { stability: r.baseline.B } };
  const without = r.evidence.filter((e) => e.basis !== 'folk');
  const a = scoreFourQuestions(r.evidence, base, 'friend');
  const b = scoreFourQuestions(without, base, 'friend');
  assert.deepEqual(a, b);
});

test('校准分布：缘的中位数在 48 到 52，五种结构都在 5% 到 45%', () => {
  for (const rt of ['friend', 'romance']) {
    const d = dist[rt];
    assert.ok(d.tie.p50 >= 48 && d.tie.p50 <= 52, `${rt} tie p50 ${d.tie.p50}`);
    for (const s of ['相成', '纠缠', '偏济', '淡益', '平行']) {
      const share = d.structure[s] || 0;
      assert.ok(share >= 0.05 && share <= 0.45, `${rt} ${s} ${share}`);
    }
  }
});
