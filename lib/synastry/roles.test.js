'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mapRoles, archetypeOf, roleCaveats } = require('./roles');
const { collectAux, tianyiBranches } = require('./aux');
const { sampleView } = require('./samples');
const W = require('./weights');

test('五对天干五合都是「相合」，牵系高于任何同性相克', () => {
  for (const [a, b] of [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']]) {
    assert.equal(archetypeOf(a, b), 'xianghe');
    assert.equal(archetypeOf(b, a), 'xianghe');
  }
  const heTie = W.role.archetypeTie.xianghe;
  // 同性相克：甲戊、甲庚 → 驾驭与受制
  assert.equal(archetypeOf('甲', '戊'), 'jiayu');
  assert.equal(archetypeOf('甲', '庚'), 'jiayu');
  assert.ok(heTie > W.role.archetypeTie.jiayu);
  for (const k of Object.keys(W.role.archetypeTie)) {
    if (k !== 'xianghe') assert.ok(heTie > W.role.archetypeTie[k]);
  }
});

test('六种原型', () => {
  assert.equal(archetypeOf('甲', '甲'), 'tongdao');
  assert.equal(archetypeOf('甲', '乙'), 'jinghe');
  assert.equal(archetypeOf('甲', '丙'), 'gongyang');
  assert.equal(archetypeOf('甲', '壬'), 'gongyang');
  assert.equal(archetypeOf('甲', '丁'), 'qifa');
  assert.equal(archetypeOf('甲', '癸'), 'qifa');
});

test('S1 对 S4 为同道', () => {
  const evs = mapRoles(sampleView('S1'), sampleView('S4'), 'friend');
  const a = evs.find((e) => e.id === 'role.archetype');
  assert.equal(a.kind, 'tongdao');
});

test('相生、相克的原型在 seed 里写明谁生谁、谁克谁', () => {
  const s1 = sampleView('S1');
  const s5 = sampleView('S5'); // 丙
  const a = mapRoles(s1, s5, 'friend').find((e) => e.id === 'role.archetype');
  assert.equal(a.kind, 'gongyang');
  assert.match(a.seed, /\{A\}的甲木生\{B\}的丙火/);
  const s3 = sampleView('S3'); // 庚
  const b = mapRoles(s1, s3, 'friend').find((e) => e.id === 'role.archetype');
  assert.match(b.seed, /\{B\}的庚金克\{A\}的甲木/);
});

test('friend 类型下没有任何配偶星证据', () => {
  const evs = mapRoles(sampleView('S1'), sampleView('S2'), 'friend');
  assert.equal(evs.some((e) => e.id.startsWith('role.spouse_')), false);
});

test('romance：S1（男）与 S2（女）星见互见', () => {
  const evs = mapRoles(sampleView('S1'), sampleView('S2', { gender: 'F' }), 'romance');
  const seenA = evs.find((e) => e.id === 'role.spouse_star_seen' && e.dir === 'A<-B');
  const seenB = evs.find((e) => e.id === 'role.spouse_star_seen' && e.dir === 'B<-A');
  assert.ok(seenA && seenB);
  assert.match(seenA.seed, /妻星/);
  assert.match(seenB.seed, /夫星/);
  assert.equal(seenA.basis, 'derived');
  const shown = evs.find((e) => e.id === 'role.spouse_star_shown');
  if (shown) assert.equal(shown.basis, 'tradition_unverified');
});

test('romance 性别缺失：不生成星见星透，并给出 caveat', () => {
  const A = sampleView('S1', { gender: null });
  const B = sampleView('S2', { gender: null });
  const evs = mapRoles(A, B, 'romance');
  assert.equal(evs.some((e) => e.id === 'role.spouse_star_seen' || e.id === 'role.spouse_star_shown'), false);
  assert.ok(evs.some((e) => e.id === 'role.spouse_palace_he'));
  assert.equal(roleCaveats(A, B, 'romance').length, 1);
  assert.equal(roleCaveats(A, B, 'friend').length, 0);
});

test('天乙贵人：与页面的 tianyiBranches 等价', () => {
  assert.deepEqual(tianyiBranches('甲'), ['未', '丑']);
  assert.deepEqual(tianyiBranches('己'), ['申', '子']);
  const evs = collectAux(sampleView('S1'), sampleView('S2'));
  // S2 日支丑是甲的贵人；S1 日支子是己的贵人
  assert.ok(evs.some((e) => e.id === 'aux.tianyi' && e.dir === 'A<-B'));
  assert.ok(evs.some((e) => e.id === 'aux.tianyi' && e.dir === 'B<-A'));
});

test('生肖与纳音为 folk，量值全为 0', () => {
  const evs = collectAux(sampleView('S1'), sampleView('S2'));
  const folk = evs.filter((e) => e.basis === 'folk');
  assert.deepEqual(folk.map((e) => e.id).sort(), ['aux.nayin', 'aux.shengxiao']);
  for (const e of folk) {
    assert.equal(e.tie, 0);
    assert.equal(e.strain, 0);
    assert.deepEqual(e.benefit, { A: 0, B: 0 });
  }
  assert.match(folk.find((e) => e.id === 'aux.shengxiao').seed, /属相猴与羊/);
});
