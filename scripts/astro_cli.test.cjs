'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run } = require('./astro_cli.cjs');
const { validateEnvelope } = require('../lib/cliEnvelope.cjs');
const { bodyPositions, siderealFrame, signedDelta } = require('../lib/astro/ephemeris.cjs');
const { angles, computeHouses, houseOf } = require('../lib/astro/houses.cjs');
const { localToUtc } = require('../lib/astro/time.cjs');
const GOLD = require('../fixtures/astro-gold/swisseph-reference.json');

const CLI = path.join(__dirname, 'astro_cli.cjs');
const ARCMIN = 1 / 60;
const diff = (a, b) => Math.abs(signedDelta(a, b));
const hangzhou = { date: '1990-05-17', time: '10:20', location: { place: '杭州' } };

const expectCode = (input, code) => {
  assert.throws(() => run(input), (err) => err.code === code);
};

// ── 与 Swiss Ephemeris 对照 ─────────────────────────────────────────────
for (const c of GOLD.cases) {
  test(`金标对照：${c.name}`, () => {
    const [y, mo, d] = c.date.split('-').map(Number);
    const [h, mi] = c.time.split(':').map(Number);
    const conv = localToUtc({ year: y, month: mo, day: d, hour: h, minute: mi }, c.timezone);
    assert.equal(conv.utc.toISOString().replace('.000Z', 'Z'), c.utc, '时区换算');

    const mean = bodyPositions(conv.utc, { node: 'mean' });
    for (const [key, [lon, speed]] of Object.entries(c.bodies)) {
      const b = mean.find((x) => x.key === key);
      assert.ok(diff(b.longitude, lon) < ARCMIN, `${key} 黄经 ${b.longitude} vs ${lon}`);
      assert.ok(Math.abs(b.speed - speed) < 0.01, `${key} 速度 ${b.speed} vs ${speed}`);
      assert.equal(b.speed < 0, speed < 0, `${key} 逆行判断`);
    }
    assert.ok(diff(mean.at(-1).longitude, c.mean_node) < ARCMIN, '平均交点');
    const tn = bodyPositions(conv.utc, { node: 'true' }).at(-1).longitude;
    assert.ok(diff(tn, c.true_node) < ARCMIN, `真实交点 ${tn} vs ${c.true_node}`);

    const f = siderealFrame(conv.utc, c.longitude);
    const ax = angles(f.ramc, f.obliquity, c.latitude);
    assert.ok(diff(ax.asc, c.asc) < 2 * ARCMIN, `上升 ${ax.asc} vs ${c.asc}`);
    assert.ok(diff(ax.mc, c.mc) < 2 * ARCMIN, `天顶 ${ax.mc} vs ${c.mc}`);
    const { system, cusps } = computeHouses('placidus', f.ramc, f.obliquity, c.latitude, ax);
    assert.equal(system, 'placidus');
    cusps.forEach((cusp, i) => assert.ok(diff(cusp, c.placidus[i]) < 2 * ARCMIN, `第 ${i + 1} 宫 ${cusp} vs ${c.placidus[i]}`));
  });
}

// ── 宫位 ───────────────────────────────────────────────────────────────
test('整宫制与等宫制：宫头间隔 30°，整宫制从上升所在星座 0° 起', () => {
  const r = run({ birth: hangzhou, options: { house_system: 'whole_sign' } });
  assert.equal(r.chart.house_system, 'whole_sign');
  assert.equal(r.chart.houses[0].cusp_longitude, 90);
  assert.equal(r.chart.houses[0].sign, r.chart.angles.asc.sign);
  const e = run({ birth: hangzhou, options: { house_system: 'equal' } });
  assert.equal(e.chart.houses[0].cusp_longitude, e.chart.angles.asc.longitude);
});

test('高纬度 Placidus 无解时改用整宫制并给 warning', () => {
  const r = run({ birth: { date: '1990-01-01', time: '12:00', location: { latitude: 69.65, longitude: 18.96, timezone: 'Europe/Oslo' } } });
  assert.equal(r.chart.house_system, 'whole_sign');
  assert.match(r.conventions.house_system, /^whole_sign/);
  assert.ok(r.warnings.some((w) => /Placidus/.test(w)));
});

test('houseOf：宫头跨 0° 时也能正确落宫', () => {
  const cusps = [350, 20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320];
  assert.equal(houseOf(355, cusps), 1);
  assert.equal(houseOf(5, cusps), 1);
  assert.equal(houseOf(20, cusps), 2);
  assert.equal(houseOf(349.9, cusps), 12);
});

// ── 时区 ───────────────────────────────────────────────────────────────
test('中国 1986–1991 夏令时由 tzdata 处理', () => {
  const r = run({ birth: hangzhou });
  assert.equal(r.input.utc_offset, '+09:00');
  assert.equal(r.input.utc, '1990-05-17T01:20:00Z');
  const winter = run({ birth: { ...hangzhou, date: '1990-12-17' } });
  assert.equal(winter.input.utc_offset, '+08:00');
});

test('夏令时跳过与重复的时刻：给 warning 而不报错', () => {
  const gap = run({ birth: { date: '2021-03-14', time: '02:30', location: { latitude: 40.71, longitude: -74.01, timezone: 'America/New_York' } } });
  assert.ok(gap.warnings.some((w) => /不存在/.test(w)));
  const dup = run({ birth: { date: '2021-11-07', time: '01:30', location: { latitude: 40.71, longitude: -74.01, timezone: 'America/New_York' } } });
  assert.equal(dup.input.utc_offset, '-04:00');
  assert.ok(dup.warnings.some((w) => /两次/.test(w)));
});

test('地名自动带出时区：香港、台北、纽约', () => {
  assert.equal(run({ birth: { ...hangzhou, location: { place: '香港' } } }).input.timezone, 'Asia/Hong_Kong');
  assert.equal(run({ birth: { ...hangzhou, location: { place: '台北' } } }).input.timezone, 'Asia/Taipei');
  assert.equal(run({ birth: { ...hangzhou, location: { place: '纽约' } } }).input.timezone, 'America/New_York');
});

test('坐标 + 地名：坐标优先，时区从地名推出；显式 timezone 优先', () => {
  const r = run({ birth: { ...hangzhou, location: { place: '杭州', latitude: 30, longitude: 120 } } });
  assert.equal(r.input.location.latitude, 30);
  assert.equal(r.input.timezone, 'Asia/Shanghai');
  const t = run({ birth: { ...hangzhou, location: { place: '杭州', timezone: 'Asia/Tokyo' } } });
  assert.equal(t.input.timezone, 'Asia/Tokyo');
});

// ── 外层与字段 ─────────────────────────────────────────────────────────
test('统一外层通过 schema 校验，字段齐全', () => {
  const r = run({ birth: hangzhou });
  const v = validateEnvelope(r);
  assert.ok(v.valid, JSON.stringify(v.errors));
  assert.equal(r.system, 'astro');
  assert.equal(r.mode, 'chart');
  assert.match(r.engine_version, /^astronomy-engine@\d/);
  assert.equal(r.ruleset, 'astro-western-v1');
  assert.deepEqual(r.input.options, { house_system: 'placidus', node: 'mean', orbs: 'standard' });
  assert.deepEqual(r.chart.bodies.map((b) => b.key), ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'north_node']);
  assert.deepEqual(Object.keys(r.chart.angles), ['asc', 'mc', 'dsc', 'ic']);
  assert.equal(r.chart.houses.length, 12);
  assert.deepEqual(r.judgments, {});
  assert.deepEqual(r.evidence, []);
  assert.ok(r.limitations.length >= 2);
});

test('盘面字段：杭州 1990-05-17 10:20', () => {
  const r = run({ birth: hangzhou });
  const sun = r.chart.bodies.find((b) => b.key === 'sun');
  assert.equal(sun.sign, '金牛');
  assert.equal(sun.degree, '25°53′');
  assert.equal(sun.house, 11);
  assert.equal(r.chart.bodies.find((b) => b.key === 'mercury').retrograde, true);
  assert.equal(r.chart.bodies.find((b) => b.key === 'north_node').retrograde, false);
  assert.equal(r.chart.angles.asc.sign, '巨蟹');
  assert.equal(r.chart.angles.mc.sign, '白羊');
  assert.equal(r.chart.derived.sect, 'day');
  assert.equal(r.chart.derived.chart_ruler, 'moon');
  const vn = r.chart.aspects.find((a) => a.a === 'venus' && a.b === 'neptune');
  assert.equal(vn.type, 'square');
  assert.ok(vn.orb < 0.5);
  // 相位按容许度升序
  const orbs = r.chart.aspects.map((a) => a.orb);
  assert.deepEqual(orbs, [...orbs].sort((x, y) => x - y));
  const el = r.chart.distribution.elements;
  assert.equal(el.fire + el.earth + el.air + el.water, 10);
});

test('tight 容许度只保留更紧的相位', () => {
  const std = run({ birth: hangzhou }).chart.aspects;
  const tight = run({ birth: hangzhou, options: { orbs: 'tight' } }).chart.aspects;
  assert.ok(tight.length < std.length);
  assert.ok(tight.every((a) => a.orb <= 5));
});

// ── 错误码 ─────────────────────────────────────────────────────────────
test('错误码：缺时间、缺地点、坐标不全、无效时区、宫制、选项、年份、mode、真太阳时', () => {
  expectCode({ birth: { date: '1990-05-17', location: { place: '杭州' } } }, 'TIME_REQUIRED');
  expectCode({ birth: { date: '1990-05-17', time: '10:20' } }, 'LOCATION_REQUIRED');
  expectCode({ birth: { ...hangzhou, location: { latitude: 30 } } }, 'LOCATION_REQUIRED');
  expectCode({ birth: { ...hangzhou, location: { latitude: 30, longitude: 120 } } }, 'LOCATION_REQUIRED');
  expectCode({ birth: { ...hangzhou, location: { latitude: 95, longitude: 120, timezone: 'Asia/Shanghai' } } }, 'LOCATION_REQUIRED');
  expectCode({ birth: { ...hangzhou, location: { place: '杭州', timezone: 'Mars/Olympus' } } }, 'TIMEZONE_INVALID');
  expectCode({ birth: hangzhou, options: { house_system: 'koch' } }, 'HOUSE_SYSTEM_UNSUPPORTED');
  expectCode({ birth: hangzhou, options: { node: 'osculating' } }, 'OPTION_INVALID');
  expectCode({ birth: hangzhou, options: { orbs: 'wide' } }, 'OPTION_INVALID');
  expectCode({ birth: { ...hangzhou, date: '1700-01-01' } }, 'DATE_OUT_OF_RANGE');
  expectCode({ birth: hangzhou, mode: 'transit' }, 'MODE_INVALID');
  expectCode({ birth: { ...hangzhou, time_basis: 'true_solar' } }, 'BIRTH_INCOMPLETE');
  expectCode({ birth: { ...hangzhou, location: { place: '朝阳' } } }, 'PLACE_AMBIGUOUS');
  expectCode({}, 'BIRTH_INCOMPLETE');
});

test('不需要性别', () => {
  assert.equal(run({ birth: hangzhou }).ok, true);
});

// ── 命令行 ─────────────────────────────────────────────────────────────
test('CLI：便捷参数与 stdin', () => {
  const a = spawnSync(process.execPath, [CLI, '--date', '1990-05-17', '--time', '10:20', '--lat', '40.71', '--lng', '-74.01', '--tz', 'America/New_York', '--house-system', 'equal'], { encoding: 'utf8' });
  assert.equal(a.status, 0, a.stdout);
  const out = JSON.parse(a.stdout);
  assert.equal(out.input.timezone, 'America/New_York');
  assert.equal(out.chart.house_system, 'equal');

  const b = spawnSync(process.execPath, [CLI], { input: JSON.stringify({ birth: hangzhou }), encoding: 'utf8' });
  assert.equal(b.status, 0);
  assert.equal(JSON.parse(b.stdout).system, 'astro');
});

test('CLI：失败输出 {ok:false,code,message,hint} 且退出码 1', () => {
  const r = spawnSync(process.execPath, [CLI, '--date', '1990-05-17', '--place', '杭州'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.equal(out.code, 'TIME_REQUIRED');
  assert.ok(out.hint);
  assert.ok(validateEnvelope(out).valid);
});
