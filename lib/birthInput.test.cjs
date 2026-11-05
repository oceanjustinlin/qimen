const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBirth, resolvePlace } = require('./birthInput.cjs');

test('新格式：杭州 1990-05-01 14:00，含 1990 夏令时', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '杭州' } });
  assert.equal(b.solar_time.place_label, '浙江 - 杭州市');
  assert.equal(b.solar_time.daylight_saving_minutes, -60);
  assert.equal(b.solar_time.total_minutes, -56);
  assert.equal(b.solar_time.adjusted, '1990-05-01 13:04');
  assert.deepEqual(b.effective, { year: 1990, month: 5, day: 1, hour: 13, minute: 4 });
});
test('乌鲁木齐 -187 分钟', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '女', location: { place: '乌鲁木齐' } });
  assert.equal(b.solar_time.total_minutes, -187);
});
test('换算跨日：乌鲁木齐 1990-05-01 01:00 → 前一天', () => {
  assert.equal(parseBirth({ date: '1990-05-01', time: '01:00', gender: '男', location: { place: '乌鲁木齐' } }).effective.day, 30);
});
test('无 location：按钟表时间且给 warning，不做夏令时', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男' });
  assert.equal(b.solar_time, null);
  assert.deepEqual(b.effective, b.clock);
  assert.ok(b.warnings.some((w) => w.includes('未做真太阳时校正')));
});
test('time_basis=true_solar：不再换算', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', time_basis: 'true_solar', location: { place: '杭州' } });
  assert.deepEqual(b.effective, b.clock);
  assert.equal(b.time_basis, 'true_solar');
});
test('longitude 优先于 place，且不解析 place', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '杭州', longitude: 87.6 } });
  assert.equal(b.solar_time.longitude, 87.6);
  assert.equal(b.solar_time.place_label, null);
  // place 即使无法解析也不报错
  assert.doesNotThrow(() => parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '朝阳区', longitude: 120 } }));
});
test('朝阳区 → PLACE_AMBIGUOUS，带北京与长春候选', () => {
  assert.throws(() => resolvePlace('朝阳区'), (e) => e.code === 'PLACE_AMBIGUOUS'
    && e.candidates.length <= 5
    && e.candidates.some((c) => c.label.includes('北京') && typeof c.longitude === 'number')
    && e.candidates.some((c) => c.label.includes('长春')));
});
test('纽约 → PLACE_UNSUPPORTED；经度 -74 → PLACE_UNSUPPORTED', () => {
  assert.throws(() => resolvePlace('纽约'), { code: 'PLACE_UNSUPPORTED' });
  assert.throws(() => parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { longitude: -74 } }), { code: 'PLACE_UNSUPPORTED' });
});
test('香港可用并带港台夏令时 warning', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '香港' } });
  assert.ok(b.warnings.some((w) => w.includes('夏令时')));
});
test('查无此地 → PLACE_NOT_FOUND', () => { assert.throws(() => resolvePlace('不存在的地方xyz'), { code: 'PLACE_NOT_FOUND' }); });
test('缺 time → TIME_REQUIRED（新旧格式都是）', () => {
  assert.throws(() => parseBirth({ date: '1990-05-01', gender: '男' }), { code: 'TIME_REQUIRED' });
  assert.throws(() => parseBirth({ calendar: 'solar', year: 1990, month: 5, day: 1, gender: '男' }), { code: 'TIME_REQUIRED' });
});
test('非法日期时间 → BIRTH_INCOMPLETE', () => {
  for (const [date, time] of [['1990-02-30', '10:00'], ['1990-05-01', '24:00'], ['1990-05-01', '14:60'], ['1990/5/1', '14:00']]) {
    assert.throws(() => parseBirth({ date, time, gender: '男' }), { code: 'BIRTH_INCOMPLETE' }, `${date} ${time}`);
  }
});
test('旧格式兼容：year/month/day/hour/minute 与新格式等价', () => {
  assert.deepEqual(parseBirth({ calendar: 'solar', year: 1990, month: 5, day: 1, hour: 14, minute: 0, gender: 'male' }).clock,
    parseBirth({ date: '1990-05-01', time: '14:00', gender: '男' }).clock);
});
test('农历 → CALENDAR_UNSUPPORTED；性别非法 → BIRTH_INCOMPLETE', () => {
  assert.throws(() => parseBirth({ calendar: 'lunar', date: '1990-05-01', time: '14:00', gender: '男' }), { code: 'CALENDAR_UNSUPPORTED' });
  assert.throws(() => parseBirth({ calendar: 'lunar', year: 1990, month: 5, day: 1, hour: 14, gender: '男' }), { code: 'CALENDAR_UNSUPPORTED' });
  assert.throws(() => parseBirth({ date: '1990-05-01', time: '14:00', gender: '未知' }), { code: 'BIRTH_INCOMPLETE' });
  assert.throws(() => parseBirth({ date: '1990-05-01', time: '14:00' }), { code: 'BIRTH_INCOMPLETE' });
});

test('直接传经度的边界：73 与 135 可用；72.9 与 135.1 → PLACE_UNSUPPORTED', () => {
  const mk = (longitude) => () => parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { longitude } });
  assert.doesNotThrow(mk(73));
  assert.doesNotThrow(mk(135));
  assert.throws(mk(72.9), { code: 'PLACE_UNSUPPORTED' });
  assert.throws(mk(135.1), { code: 'PLACE_UNSUPPORTED' });
});

// I1：港澳台不套用大陆 1986–1991 夏令时
for (const place of ['香港', '澳门', '台北']) {
  test(`${place} 1988-07-01 00:30 不扣大陆夏令时，仍带港澳台夏令时 warning`, () => {
    const b = parseBirth({ date: '1988-07-01', time: '00:30', gender: '男', location: { place } });
    assert.equal(b.solar_time.daylight_saving_minutes, 0);
    assert.ok(b.warnings.some((w) => w.includes('港澳台历史夏令时未校正')));
  });
}
test('香港 1988-07-01 00:30 → 只做经度与均时差，日期不倒退到 6 月 30 日', () => {
  const b = parseBirth({ date: '1988-07-01', time: '00:30', gender: '男', location: { place: '香港' } });
  assert.match(b.solar_time.adjusted, /^1988-07-01 /);
});
test('杭州 1990 仍扣 -60 夏令时（大陆不受影响）', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '杭州' } });
  assert.equal(b.solar_time.daylight_saving_minutes, -60);
  assert.ok(!b.warnings.some((w) => w.includes('港澳台')));
});
