'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./elements');
const { makeEvidence } = require('./evidence');
const { buildSynastryReport, buildCompatibilityResponse, fillNames } = require('./index');
const { samplePerson } = require('./samples');

test('needVector(S1)：火 +1.5、土 +1.0、水 −1.3', () => {
  const d = samplePerson('S1').charts[0].detail;
  const v = E.needVector(d);
  assert.equal(v.火, 1.5);
  assert.equal(v.土, 1.0);
  assert.equal(v.水, -1.3);
});

test('tenGod', () => {
  assert.equal(E.tenGod('甲', '己'), '正财');
  assert.equal(E.tenGod('己', '甲'), '正官');
  assert.equal(E.tenGod('甲', '甲'), '比肩');
  assert.equal(E.tenGod('甲', '庚'), '七杀');
  assert.equal(E.tenGod('甲', '丙'), '食神');
  assert.equal(E.tenGod('甲', '癸'), '正印');
});

test('shenToWuxing', () => {
  assert.equal(E.shenToWuxing('甲', '正财'), '土');
  assert.equal(E.shenToWuxing('甲', '食神'), '火');
  assert.equal(E.shenToWuxing('甲', '正印'), '水');
  assert.equal(E.shenToWuxing('甲', '七杀'), '金');
});

test('makeEvidence 校验取值范围', () => {
  assert.throws(() => makeEvidence({ id: 'x', layer: 'bond', kind: 'k', tie: 5 }));
  assert.throws(() => makeEvidence({ id: 'x', layer: 'nope', kind: 'k' }));
  assert.throws(() => makeEvidence({ id: 'x', layer: 'bond', kind: 'k', benefit: { A: 4 } }));
  assert.throws(() => makeEvidence({ id: 'x', layer: 'bond', kind: 'k', dir: 'A->B' }));
  const ev = makeEvidence({ id: 'x', layer: 'aux', kind: 'k', tie: 2, basis: 'folk', benefit: { A: 1 } });
  assert.equal(ev.tie, 0);
  assert.deepEqual(ev.benefit, { A: 0, B: 0 });
});

test('报告形态：friend 含 friendDims，romance 不含任何 total 字段', () => {
  const friend = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S2') });
  assert.equal(friend.engineVersion, 'synastry/1');
  assert.equal(friend.relationType, 'friend');
  assert.ok(friend.friendDims);
  assert.ok(['相成', '纠缠', '偏济', '淡益', '平行'].includes(friend.structure));
  for (const k of ['tie', 'ease', 'benefit', 'lasting']) assert.ok(friend.fourQuestions[k]);
  assert.equal(friend.fourQuestions.lasting.available, false);

  const romance = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S2', { gender: 'F' }), relationType: 'romance' });
  assert.equal(romance.relationType, 'romance');
  assert.equal(romance.friendDims, undefined);
  assert.doesNotMatch(JSON.stringify(romance), /"total"/);
});

test('时辰不详：报告里没有 needsHour 证据，caveats 写明', () => {
  const r = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S3', { hourKnown: false }) });
  assert.equal(r.evidence.some((e) => e.needsHour), false);
  assert.equal(r.evidence.some((e) => /time/.test(`${e.locus.a} ${e.locus.b}`)), false);
  assert.deepEqual(r.hourKnown, { A: true, B: false });
  assert.ok(r.caveats.some((c) => c.startsWith('{B}时辰不详')));
  assert.equal(r.confidence, 'low');
});

test('对称性：交换 A 与 B', () => {
  const ab = buildSynastryReport({ A: samplePerson('S1'), B: samplePerson('S4') });
  const ba = buildSynastryReport({ A: samplePerson('S4'), B: samplePerson('S1') });
  assert.equal(ab.evidence.length, ba.evidence.length);
  assert.equal(ab.fourQuestions.tie.score, ba.fourQuestions.tie.score);
  assert.equal(ab.fourQuestions.ease.score, ba.fourQuestions.ease.score);
  assert.equal(ab.fourQuestions.lasting.score, ba.fourQuestions.lasting.score);
  assert.equal(ab.fourQuestions.benefit.A, ba.fourQuestions.benefit.B);
  assert.equal(ab.fourQuestions.benefit.B, ba.fourQuestions.benefit.A);
  assert.equal(ab.structure, ba.structure);
  assert.equal(ab.friendDims.total, ba.friendDims.total);
});

test('buildCompatibilityResponse 保留 A、B 的现有字段', () => {
  const r = buildCompatibilityResponse(
    { birth_date: '1992-02-18', hour_index: 5, gender: 'M' },
    { birth_date: '1992-01-14', hour_index: -1, gender: 'F' },
    { currentYear: 2026 },
  );
  for (const side of ['A', 'B']) {
    for (const k of ['dayGan', 'gans', 'zhis', 'dayZhi', 'yearZhi', 'monthZhi', 'five_shens', 'wuxing_ratio']) {
      assert.ok(k in r[side], `${side}.${k}`);
    }
  }
  assert.equal(r.B.gans[3], '');
  assert.equal(r.report.relationType, 'friend');
});

test('fillNames', () => {
  assert.equal(fillNames('{A}与{B}', { A: '阿澈', B: '小满' }), '阿澈与小满');
});
