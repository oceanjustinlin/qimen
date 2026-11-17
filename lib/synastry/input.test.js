'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Solar } = require('lunar-javascript');
const { normalizePerson, resolveStable, toCompact, toView, applySolarCorrection } = require('./input');
const { samplePerson } = require('./samples');

test('时辰已知：只排一次盘，四柱与样本一致', () => {
  const p = samplePerson('S1');
  assert.equal(p.hourKnown, true);
  assert.equal(p.charts.length, 1);
  const gz = p.charts[0].detail.pillars.ganzhi;
  assert.deepEqual([gz.year, gz.month, gz.day, gz.time], ['壬申', '壬寅', '甲子', '己巳']);
});

test('时辰不详：十二个时辰各排一次，时柱为空串', () => {
  const p = samplePerson('S1', { hourKnown: false });
  assert.equal(p.hourKnown, false);
  assert.equal(p.charts.length, 12);
  assert.deepEqual(p.charts.map((c) => c.hourIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const c = toCompact(p);
  assert.equal(c.gans[3], '');
  assert.equal(c.zhis[3], '');
  assert.equal(c.dayGan, '甲');
  // 三柱占比合计 100
  const sum = Object.values(c.wuxing_ratio).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 1e-6);
  // 视图里没有时柱
  assert.deepEqual(toView(p).pillars.map((x) => x.pos), ['year', 'month', 'day']);
});

test('时辰不详：结论不依赖任何「默认时辰」', () => {
  const p = samplePerson('S1', { hourKnown: false });
  const base = resolveStable(p.charts);
  // 把十二组盘的顺序整体旋转（相当于换一个起点），稳定结论不变
  for (let k = 1; k < 12; k += 1) {
    const rotated = [...p.charts.slice(k), ...p.charts.slice(0, k)];
    const r = resolveStable(rotated);
    assert.equal(r.strongWeak, base.strongWeak);
    assert.equal(r.yongWuxing, base.yongWuxing);
  }
  // 喜忌与占比不再等于「假设午时」那一组
  const noon = p.charts[6].detail;
  const c = toCompact(p);
  assert.notDeepEqual(c.wuxing_ratio, noon.wuxing_ratio);
});

test('时辰不详：十二组一致与不一致各一例', () => {
  const stable = resolveStable(samplePerson('S1', { hourKnown: false }).charts);
  assert.equal(stable.stable, true);
  assert.ok(stable.agree >= 10);
  const unstable = resolveStable(samplePerson('S3', { hourKnown: false }).charts);
  assert.equal(unstable.stable, false);
  assert.ok(unstable.agree < 10);
});

test('真太阳时修正跨日：子时减 90 分钟回到前一天 22:30', () => {
  const p = normalizePerson({ birth_date: '2000-01-02', hour_index: 0, tst_correction_min: -90 }, { currentYear: 2026 });
  assert.deepEqual(p.solarTime, { y: 2000, m: 1, d: 1, h: 22, min: 30 });
  const jan1 = Solar.fromYmdHms(2000, 1, 1, 12, 0, 0).getLunar().getEightChar().getDay();
  assert.equal(p.charts[0].detail.pillars.ganzhi.day, jan1);

  const q = normalizePerson({ birth_date: '2000-01-02', hour_index: 0, tst_correction_min: 0 }, { currentYear: 2026 });
  assert.deepEqual(q.solarTime, { y: 2000, m: 1, d: 2, h: 0, min: 0 });
  const jan2 = Solar.fromYmdHms(2000, 1, 2, 12, 0, 0).getLunar().getEightChar().getDay();
  assert.equal(q.charts[0].detail.pillars.ganzhi.day, jan2);
});

test('applySolarCorrection：正向跨日与跨年', () => {
  assert.deepEqual(applySolarCorrection(1999, 12, 31, 22, 120), { y: 2000, m: 1, d: 1, h: 0, min: 0 });
  assert.deepEqual(applySolarCorrection(2000, 3, 1, 0, -30), { y: 2000, m: 2, d: 29, h: 23, min: 30 });
});

test('性别归一', () => {
  assert.equal(normalizePerson({ birth_date: '1992-02-18', hour_index: 5, gender: '女' }).gender, 'F');
  assert.equal(normalizePerson({ birth_date: '1992-02-18', hour_index: 5 }).gender, null);
});
