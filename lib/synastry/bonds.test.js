'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scanBonds } = require('./bonds');
const { swapEvidence } = require('./evidence');
const { sampleView } = require('./samples');

const has = (evs, id) => evs.some((e) => e.id === id);

test('S1 对 S2：日干甲己合、日支子丑合，日柱天合地合', () => {
  const evs = scanBonds(sampleView('S1'), sampleView('S2'), 'friend');
  assert.ok(has(evs, 'bond.day_gan.ganhe'));
  assert.ok(has(evs, 'bond.day_zhi.liuhe'));
  assert.ok(has(evs, 'bond.day_pillar.double_he'));
  assert.ok(!has(evs, 'bond.day_pillar.clash'));
});

test('S1 对 S3：日干甲庚同性相克、日支子午冲，日柱天克地冲', () => {
  const evs = scanBonds(sampleView('S1'), sampleView('S3'), 'friend');
  const ke = evs.find((e) => e.id === 'bond.day_gan.gan_ke');
  assert.ok(ke);
  assert.equal(ke.strain, 1.5);
  assert.ok(has(evs, 'bond.day_zhi.chong'));
  assert.ok(has(evs, 'bond.day_pillar.clash'));
});

test('S5 对 S6：日干丙辛合、日支寅亥合', () => {
  const evs = scanBonds(sampleView('S5'), sampleView('S6'), 'friend');
  assert.ok(has(evs, 'bond.day_gan.ganhe'));
  assert.ok(has(evs, 'bond.day_zhi.liuhe'));
  assert.ok(has(evs, 'bond.day_pillar.double_he'));
});

test('S1 对 S4：日干相同、日支子午冲', () => {
  const evs = scanBonds(sampleView('S1'), sampleView('S4'), 'friend');
  assert.ok(has(evs, 'bond.day_gan.gan_same'));
  assert.ok(has(evs, 'bond.day_zhi.chong'));
});

test('同一对地支命中多种关系时各出一条：巳申既合又刑', () => {
  // S1 年支申，S2 时支巳
  const evs = scanBonds(sampleView('S1'), sampleView('S2'), 'friend');
  const pair = evs.filter((e) => e.locus.a === 'year.zhi' && e.locus.b === 'time.zhi');
  const kinds = pair.map((e) => e.kind).sort();
  assert.deepEqual(kinds, ['liuhe', 'xing']);
});

test('交换 A 与 B：条数不变，mutual 的 tie、strain 不变，benefit 互换', () => {
  for (const [x, y] of [['S1', 'S2'], ['S1', 'S3'], ['S5', 'S6'], ['S1', 'S4']]) {
    for (const rt of ['friend', 'romance']) {
      const ab = scanBonds(sampleView(x), sampleView(y), rt);
      const ba = scanBonds(sampleView(y), sampleView(x), rt);
      assert.equal(ab.length, ba.length, `${x}${y} ${rt}`);
      const key = (e) => JSON.stringify([e.id, e.dir, e.locus.a, e.locus.b, e.tie, e.strain, e.benefit.A, e.benefit.B]);
      const left = ab.map(key).sort();
      const right = ba.map(swapEvidence).map(key).sort();
      assert.deepEqual(left, right, `${x}${y} ${rt}`);
    }
  }
});

test('时辰不详：没有涉及时柱的证据', () => {
  const evs = scanBonds(sampleView('S1'), sampleView('S2', { hourKnown: false }), 'friend');
  assert.ok(evs.length > 0);
  assert.equal(evs.some((e) => /^time/.test(e.locus.a || '') || /^time/.test(e.locus.b || '')), false);
  assert.equal(evs.some((e) => e.needsHour), false);
});

test('顺逆：冲到忌神为正，冲到喜用为负', () => {
  // S1 日支子（水，S1 忌）被 S3 日支午冲：对 S1 为正
  const evs = scanBonds(sampleView('S1'), sampleView('S3'), 'friend');
  const chong = evs.find((e) => e.id === 'bond.day_zhi.chong');
  assert.ok(chong.benefit.A > 0);
});

test('婚恋：冲配偶宫另出一条，只有张力', () => {
  const evs = scanBonds(sampleView('S1'), sampleView('S3'), 'romance');
  const pc = evs.filter((e) => e.id === 'bond.spouse_palace.clash');
  assert.ok(pc.length >= 2);
  for (const e of pc) {
    assert.equal(e.tie, 0);
    assert.deepEqual(e.benefit, { A: 0, B: 0 });
  }
  const friend = scanBonds(sampleView('S1'), sampleView('S3'), 'friend');
  assert.ok(!has(friend, 'bond.spouse_palace.clash'));
});

test('两盘补全三合局', () => {
  // 构造：A 有申、子，B 有辰
  const mk = (pillars) => ({
    pillars, need: { 金: 0, 木: 0, 水: 1, 火: 0, 土: 0 }, dayZhi: pillars[2].zhi, borderline: false, special: false,
  });
  const A = mk([{ pos: 'year', gan: '', zhi: '申' }, { pos: 'month', gan: '', zhi: '卯' }, { pos: 'day', gan: '', zhi: '子' }]);
  const B = mk([{ pos: 'year', gan: '', zhi: '丑' }, { pos: 'month', gan: '', zhi: '辰' }, { pos: 'day', gan: '', zhi: '巳' }]);
  const evs = scanBonds(A, B, 'friend');
  const c = evs.find((e) => e.id === 'bond.complete.sanhe_water');
  assert.ok(c);
  assert.equal(c.tie, 2.5);
  assert.ok(c.benefit.A > 0);
});
