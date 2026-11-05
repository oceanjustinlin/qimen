'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CLI = path.join(__dirname, 'ziwei_skill_cli.cjs');
const { run, normalizeRoute, toProfileSnapshot } = require(CLI);

const BIRTH = { date: '1990-05-01', time: '14:00', gender: '男' };

function runCli(input, args = []) {
  try {
    return { status: 0, out: JSON.parse(execFileSync('node', [CLI, ...args], { input: JSON.stringify(input), encoding: 'utf8' })) };
  } catch (error) {
    return { status: error.status, out: JSON.parse(error.stdout) };
  }
}

test('本命模式输出 4×4 盘面、十二宫与主题证据，不含运限', () => {
  const result = run({ birth: BIRTH, route: { topic: 'career' } }, { now: new Date('2026-11-05') });

  assert.equal(result.ok, true);
  assert.equal(result.schema_version, 'ziwei-skill/v1');
  assert.equal(result.chart.palaces.length, 12);
  assert.equal(result.chart.board.length, 4);
  assert.deepEqual(result.chart.board[1].slice(1, 3), [null, null]);
  assert.deepEqual(result.chart.board[0].map((cell) => cell.branch), ['巳', '午', '未', '申']);
  assert.equal(result.chart.board.flat().filter(Boolean).length, 12);
  assert.equal(result.evidence.topic_report.topic, 'career');
  assert.deepEqual(result.periods, []);
});

test('跨期模式逐年给出运限宫职映射，且与引擎动态特征一致', () => {
  const result = run({
    birth: BIRTH,
    route: { topic: 'career', time_scope: { type: 'cross_period', start_year: 2026, end_year: 2027 } },
  });

  assert.deepEqual(result.periods.map((period) => period.year), [2026, 2027]);
  for (const period of result.periods) {
    const yearlySnapshot = period.dynamic_snapshots.find((snap) => snap.scope === 'yearly');
    assert.equal(period.yearly.life_palace_maps_to, yearlySnapshot.life_palace_maps_to);
    assert.equal(Object.keys(period.yearly.role_to_natal).length, 12);
    assert.equal(new Set(Object.values(period.yearly.role_to_natal)).size, 12);
    assert.equal(period.raw_horoscope, undefined);
  }
  assert.notEqual(result.periods[0].yearly.stem_branch, result.periods[1].yearly.stem_branch);
});

test('time_scope 缺年份时默认取 currentYear', () => {
  const route = normalizeRoute({ topic: 'wealth', time_scope: { type: 'yearly' } }, 2026);
  assert.deepEqual(route.years, [2026]);
});

test('真太阳时口径作为校正时间传入，民用时间保留未校正警告', () => {
  assert.equal(toProfileSnapshot({ ...BIRTH, time_basis: 'true_solar' }).adjusted_birth_date, '1990-05-01 14:00:00');
  const clock = run({ birth: BIRTH });
  assert.ok(clock.warnings.includes('ZIWEI_USING_UNADJUSTED_PROFILE_TIME'));
  const solar = run({ birth: { ...BIRTH, time_basis: 'true_solar' } });
  assert.ok(!solar.warnings.includes('ZIWEI_USING_UNADJUSTED_PROFILE_TIME'));
});

test('错误以 JSON + 非零退出码返回', () => {
  assert.deepEqual(
    [runCli({ birth: { date: '1990-05-01', gender: '男' } }).out.code, runCli({ birth: { date: '1990-05-01', gender: '男' } }).status],
    ['BIRTH_INCOMPLETE', 1],
  );
  assert.equal(runCli({ birth: BIRTH, route: { topic: 'health' } }).out.code, 'TOPIC_UNSUPPORTED');
  assert.equal(
    runCli({ birth: BIRTH, route: { time_scope: { type: 'yearly', start_year: 2020, end_year: 2035 } } }).out.code,
    'TIME_SCOPE_TOO_WIDE',
  );
});

test('便捷 flags 路径可用', () => {
  const { status, out } = runCli(null, ['--date', '1990-05-01', '--time', '14:00', '--gender', '男', '--topic', 'wealth', '--year', '2026']);
  assert.equal(status, 0);
  assert.equal(out.route.topic, 'wealth');
  assert.deepEqual(out.periods.map((period) => period.year), [2026]);
});
