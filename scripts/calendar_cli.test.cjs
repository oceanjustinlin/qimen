'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(__dirname, 'calendar_cli.cjs');
const { validateEnvelope } = require(path.join(ROOT, 'lib', 'cliEnvelope.cjs'));
const { run } = require(CLI);

test('convert 1990-05-01 14:00 → 四柱 庚午 庚辰 丙寅 乙未，农历 庚午年四月初七', () => {
  const out = run({ action: 'convert', date: '1990-05-01', time: '14:00' });
  assert.equal(out.system, 'calendar');
  assert.equal(out.mode, 'convert');
  assert.equal(out.chart.lunar, '庚午年四月初七');
  assert.deepEqual(out.chart.ganzhi, { year: '庚午', month: '庚辰', day: '丙寅', time: '乙未' });
  assert.equal(out.conventions.zi_hour, '夜子时算当日');
  assert.equal(out.conventions.timezone, 'Asia/Shanghai');
  assert.equal(validateEnvelope(out).valid, true);
});

test('true_solar 杭州 → total_minutes -56', () => {
  const out = run({ action: 'true_solar', date: '1990-05-01', time: '14:00', location: { place: '杭州' } });
  assert.equal(out.mode, 'true_solar');
  assert.equal(out.chart.solar_time.total_minutes, -56);
  assert.equal(out.chart.solar_time.adjusted, '1990-05-01 13:04');
  assert.deepEqual(out.conventions, { timezone: 'Asia/Shanghai' });
  assert.equal(validateEnvelope(out).valid, true);
});

test('jieqi 2026 → 24 项，含立春，按时间升序', () => {
  const out = run({ action: 'jieqi', year: 2026 });
  const list = out.chart.jieqi;
  assert.equal(list.length, 24);
  assert.equal(new Set(list.map((x) => x.name)).size, 24);
  assert.ok(list.every((x) => x.datetime.startsWith('2026-') && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(x.datetime)));
  assert.deepEqual(list.map((x) => x.datetime), [...list.map((x) => x.datetime)].sort());
  assert.equal(list[0].name, '小寒');
  assert.equal(list[23].name, '冬至');
  assert.equal(list.find((x) => x.name === '立春').datetime, '2026-02-04 04:02:08');
  assert.equal(validateEnvelope(out).valid, true);
});

test('jieqi date=2026-02-04 → previous 或 next 为立春', () => {
  const out = run({ action: 'jieqi', date: '2026-02-04' });
  const names = [out.chart.previous.name, out.chart.next.name];
  assert.ok(names.includes('立春'));
  assert.equal(out.chart.previous.name, '大寒');
  assert.equal(out.chart.next.name, '立春');
  assert.equal(validateEnvelope(out).valid, true);
});

test('jieqi 缺 year/date → BAD_JSON', () => {
  assert.throws(() => run({ action: 'jieqi' }), (e) => e.code === 'BAD_JSON');
});

test('action 缺失 → BAD_JSON；CLI 失败信封通过 schema', () => {
  assert.throws(() => run({ date: '1990-05-01', time: '14:00' }), (e) => e.code === 'BAD_JSON');
  const r = spawnSync('node', [CLI], { input: JSON.stringify({ date: '1990-05-01' }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'BAD_JSON');
  assert.equal(validateEnvelope(body).valid, true);
});

test('错误码透传：convert 缺时间 → TIME_REQUIRED；true_solar 缺地点 → BIRTH_INCOMPLETE', () => {
  assert.throws(() => run({ action: 'convert', date: '1990-05-01' }), (e) => e.code === 'TIME_REQUIRED');
  assert.throws(() => run({ action: 'true_solar', date: '1990-05-01', time: '14:00' }), (e) => e.code === 'BIRTH_INCOMPLETE');
});

test('CLI stdin 与 flags 均可用', () => {
  const a = JSON.parse(execFileSync('node', [CLI], { input: JSON.stringify({ action: 'convert', date: '1990-05-01', time: '14:00' }), encoding: 'utf8' }));
  const b = JSON.parse(execFileSync('node', [CLI, '--action', 'convert', '--date', '1990-05-01', '--time', '14:00'], { encoding: 'utf8' }));
  assert.deepEqual(a, b);
  assert.equal(validateEnvelope(a).valid, true);
});
