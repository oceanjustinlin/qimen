'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessComplement } = require('./complement');

/** 只含本层用到字段的最小命盘视图 */
function fake({ dayGan, dayWx, need, ratio, yong, strength = 2, hourKnown = true, stable = true, yongConfidence = 'HIGH', gods = [], pillars }) {
  return {
    dayGan,
    dayWx,
    need: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0, ...need },
    ratio: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0, ...ratio },
    strengthScore: strength,
    hourKnown,
    stable,
    borderline: yongConfidence === 'LOW',
    special: false,
    pillars: pillars || [{ pos: 'year', gan: '' }, { pos: 'month', gan: '' }, { pos: 'day', gan: dayGan }],
    detail: {
      pillars: { ganzhi: { day: `${dayGan}子` } },
      five_shens: { yong, yong_confidence: yongConfidence },
      tiaohou_detail: { primary_gods: gods },
    },
  };
}

// 供方：日主丙火，火占 50%
const giver = fake({ dayGan: '丙', dayWx: '火', ratio: { 火: 0.5, 土: 0.2, 木: 0.1, 金: 0.1, 水: 0.1 }, yong: '正印' });

test('同一股气，对喜它的人是益，对忌它的人是损', () => {
  // 受方甲木身弱，用神食神（火）
  const likesFire = fake({ dayGan: '甲', dayWx: '木', need: { 火: 1.5, 水: -1.3 }, ratio: { 水: 0.4, 木: 0.3, 金: 0.3 }, yong: '食神' });
  const ev1 = assessComplement(likesFire, giver);
  const dm = ev1.find((e) => e.id === 'complement.daymaster_as_yong' && e.dir === 'A<-B');
  assert.ok(dm);
  assert.ok(dm.benefit.A > 0);
  const ns1 = ev1.find((e) => e.id === 'complement.need_supply' && e.dir === 'A<-B');
  assert.ok(ns1.benefit.A > 0);

  // 受方用神改为水，忌神为火
  const hatesFire = fake({ dayGan: '甲', dayWx: '木', need: { 水: 1.5, 火: -1.3 }, ratio: { 火: 0.4, 木: 0.3, 土: 0.3 }, yong: '正印' });
  const ev2 = assessComplement(hatesFire, giver);
  const ns2 = ev2.find((e) => e.id === 'complement.need_supply' && e.dir === 'A<-B');
  assert.ok(ns2.benefit.A < 0);
  assert.equal(ev2.some((e) => e.id === 'complement.daymaster_as_yong' && e.dir === 'A<-B'), false);
});

test('受方用神把握低：该方向全部证据 confidence 为 low', () => {
  const r = fake({ dayGan: '甲', dayWx: '木', need: { 火: 1.5 }, ratio: { 水: 0.5 }, yong: '食神', yongConfidence: 'LOW' });
  const evs = assessComplement(r, giver).filter((e) => e.dir === 'A<-B');
  assert.ok(evs.length > 0);
  assert.ok(evs.every((e) => e.confidence === 'low'));
});

test('时辰不详且结论不稳的受方：量值减半', () => {
  const base = { dayGan: '甲', dayWx: '木', need: { 火: 1.5, 水: -1.3 }, ratio: { 水: 0.4, 木: 0.3, 金: 0.3 }, yong: '食神' };
  const known = assessComplement(fake(base), giver).find((e) => e.id === 'complement.daymaster_as_yong');
  const unstable = assessComplement(fake({ ...base, hourKnown: false, stable: false }), giver).find((e) => e.id === 'complement.daymaster_as_yong');
  assert.equal(unstable.benefit.A, known.benefit.A / 2);
  assert.equal(unstable.confidence, 'low');
  const stable = assessComplement(fake({ ...base, hourKnown: false, stable: true }), giver).find((e) => e.id === 'complement.daymaster_as_yong');
  assert.equal(stable.benefit.A, known.benefit.A);
  assert.equal(stable.confidence, 'mid');
});

test('调候互济：对方月干或日干出现所需调候神，量值更高', () => {
  const r = fake({ dayGan: '庚', dayWx: '金', need: { 火: 1.0 }, ratio: { 水: 0.5 }, yong: '七杀', gods: [{ gan: '丙', wuxing: '火' }] });
  const evs = assessComplement(r, giver);
  const th = evs.find((e) => e.id === 'complement.tiaohou' && e.dir === 'A<-B');
  assert.ok(th);
  assert.equal(th.locus.b, 'day.gan');
  assert.equal(th.benefit.A, 1.2);
});

test('得药与伤用', () => {
  // 受方病在水（忌），供方土木多：得药
  const r = fake({ dayGan: '丙', dayWx: '火', need: { 水: -1.3, 木: 1.5 }, ratio: { 水: 0.5, 火: 0.2, 木: 0.05 }, yong: '正印' });
  const remedyGiver = fake({ dayGan: '戊', dayWx: '土', ratio: { 土: 0.4, 木: 0.3, 金: 0.3 }, yong: '正印' });
  assert.ok(assessComplement(r, remedyGiver).some((e) => e.id === 'complement.remedy' && e.benefit.A > 0));
  // 供方水多：增病
  const waterGiver = fake({ dayGan: '壬', dayWx: '水', ratio: { 水: 0.5, 金: 0.5 }, yong: '正印' });
  assert.ok(assessComplement(r, waterGiver).some((e) => e.id === 'complement.aggravate' && e.benefit.A < 0));
  // 受方用神木（印）不足 12%，供方最旺的金克木：伤用
  const metalGiver = fake({ dayGan: '庚', dayWx: '金', ratio: { 金: 0.6, 土: 0.4 }, yong: '正印' });
  assert.ok(assessComplement(r, metalGiver).some((e) => e.id === 'complement.harm_yong' && e.benefit.A < 0));
});

test('两个方向各自独立', () => {
  const a = fake({ dayGan: '甲', dayWx: '木', need: { 火: 1.5 }, ratio: { 木: 0.6, 水: 0.4 }, yong: '食神' });
  const evs = assessComplement(a, giver);
  assert.ok(evs.some((e) => e.dir === 'A<-B'));
  assert.ok(evs.some((e) => e.dir === 'B<-A'));
  assert.ok(evs.filter((e) => e.dir === 'A<-B').every((e) => e.benefit.B === 0));
  assert.ok(evs.filter((e) => e.dir === 'B<-A').every((e) => e.benefit.A === 0));
});
