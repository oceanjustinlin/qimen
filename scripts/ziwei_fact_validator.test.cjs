'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run: runZiweiCli } = require('./ziwei_cli.cjs');
const { validateZiweiChart } = require('../lib/ziweiFactValidator.cjs');

function profile(birth, gender = '男') {
  return {
    profile_id: 'fictional-validator-case',
    gender,
    birth_date: birth,
    adjusted_birth_date: birth,
    solar_time_mode: 'clock',
    solar_time_adjustment_minutes: 0,
  };
}

function buildChart(birth = '1990-05-15 10:30:00', target = '2026-11-03 12:00:00', gender = '男') {
  return runZiweiCli({
    mode: 'natal',
    profile_snapshot: profile(birth, gender),
    ...(target ? { target_datetime: target, options: { include_horoscope: true } } : {}),
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function failedIds(fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, 'ZIWEI_FACT_INVARIANT_FAILED');
    return error.details.map((item) => item.id);
  }
  assert.fail('预期校验失败');
}

test('合法命盘通过全部不变量，结果可重放', () => {
  const chart = buildChart();
  const before = clone(chart);
  const result = validateZiweiChart(chart, { requiredScopes: ['natal', 'decadal', 'yearly'], traceId: 'trace-1' });

  assert.deepEqual(chart, before);
  assert.equal(result.schema_version, 'ziwei-validated-chart/v1');
  assert.equal(result.validated, true);
  assert.equal(result.trace_id, 'trace-1');
  assert.equal(result.engine_version, 'iztro@2.5.8');
  assert.match(result.chart_ref, /^chart:sha256:[0-9a-f]{64}$/);
  assert.deepEqual(result.invariants, [
    'envelope_valid',
    'twelve_palaces_unique',
    'life_body_present',
    'relations_closed',
    'stars_unique_and_natal_mutagens_consistent',
    'decadal_sequence_consistent',
    'period_mapping_consistent',
  ]);
  assert.deepEqual(validateZiweiChart(clone(chart), { requiredScopes: ['natal', 'decadal', 'yearly'], traceId: 'trace-1' }), result);
});

test('覆盖阴阳男女、早晚子时与多种五行局的虚构盘全部通过', () => {
  const cases = [
    ['1986-02-03 04:20:00', '女'],
    ['1998-07-26 18:29:00', '男'],
    ['2001-12-31 23:30:00', '女'],
    ['1975-03-09 00:15:00', '男'],
    ['1963-10-18 13:05:00', '女'],
    ['2010-06-01 07:45:00', '男'],
  ];
  cases.forEach(([birth, gender]) => {
    const chart = buildChart(birth, '2030-01-15 09:00:00', gender);
    assert.doesNotThrow(
      () => validateZiweiChart(chart, { requiredScopes: ['natal', 'decadal', 'yearly'] }),
      `${birth} ${gender}`,
    );
  });
});

test('宫位结构被破坏时报出对应不变量，且一次列出全部失败项', () => {
  const chart = buildChart();

  const duplicated = clone(chart);
  duplicated.natal.palaces[1].palace_key = duplicated.natal.palaces[0].palace_key;
  assert.deepEqual(failedIds(() => validateZiweiChart(duplicated)), ['twelve_palaces_unique']);

  const twoBodies = clone(chart);
  twoBodies.natal.palaces.forEach((palace) => { palace.is_body_palace = true; });
  assert.deepEqual(failedIds(() => validateZiweiChart(twoBodies)), ['life_body_present']);

  const brokenRelation = clone(chart);
  brokenRelation.natal.palaces[0].relations.opposite = brokenRelation.natal.palaces[1].palace_key;
  assert.deepEqual(failedIds(() => validateZiweiChart(brokenRelation)), ['relations_closed']);

  const multiple = clone(chart);
  multiple.natal.palaces[0].relations.opposite = multiple.natal.palaces[1].palace_key;
  multiple.natal.palaces[3].decadal.start_age += 1;
  assert.deepEqual(
    failedIds(() => validateZiweiChart(multiple)).sort(),
    ['decadal_sequence_consistent', 'relations_closed'].sort(),
  );
});

test('四化与星曜不一致、动态星混入本命时拒绝', () => {
  const chart = buildChart();
  const findStar = (copy, name) => copy.natal.palaces
    .flatMap((palace) => [...palace.major_stars, ...palace.minor_stars, ...palace.adjective_stars])
    .find((star) => star.name === name);

  const extraMutagen = clone(chart);
  findStar(extraMutagen, '紫微').mutagen = '禄';
  assert.deepEqual(failedIds(() => validateZiweiChart(extraMutagen)), ['stars_unique_and_natal_mutagens_consistent']);

  const dynamicStar = clone(chart);
  findStar(dynamicStar, '紫微').scope = 'yearly';
  assert.deepEqual(failedIds(() => validateZiweiChart(dynamicStar)), ['stars_unique_and_natal_mutagens_consistent']);

  const summaryMismatch = clone(chart);
  summaryMismatch.natal.natal_mutagens.忌 = '紫微';
  assert.deepEqual(failedIds(() => validateZiweiChart(summaryMismatch)), ['stars_unique_and_natal_mutagens_consistent']);
});

test('运限命宫映射、四化与所需快照必须一致', () => {
  const chart = buildChart();

  const shifted = clone(chart);
  shifted.horoscope.yearly.index = (shifted.horoscope.yearly.index + 1) % 12;
  assert.deepEqual(failedIds(() => validateZiweiChart(shifted)), ['period_mapping_consistent']);

  const wrongMutagens = clone(chart);
  wrongMutagens.horoscope.decadal.mutagens = [...wrongMutagens.horoscope.decadal.mutagens].reverse();
  assert.deepEqual(failedIds(() => validateZiweiChart(wrongMutagens)), ['period_mapping_consistent']);

  const natalOnly = buildChart('1990-05-15 10:30:00', null);
  assert.doesNotThrow(() => validateZiweiChart(natalOnly));
  assert.deepEqual(
    failedIds(() => validateZiweiChart(natalOnly, { requiredScopes: ['natal', 'yearly'] })),
    ['period_mapping_consistent'],
  );
  assert.throws(
    () => validateZiweiChart(chart, { requiredScopes: ['weekly'] }),
    (error) => error.code === 'ZIWEI_FACT_INVARIANT_FAILED',
  );
});

test('外层结构无效时只报 envelope，不继续执行依赖它的检查', () => {
  assert.deepEqual(failedIds(() => validateZiweiChart(null)), ['envelope_valid']);
  const chart = buildChart();
  chart.schema_version = 'ziwei-cli/v0';
  assert.deepEqual(failedIds(() => validateZiweiChart(chart)), ['envelope_valid']);
});

test('CLI 拒绝早于出生或超出十二大限的运限目标时间', () => {
  assert.throws(
    () => buildChart('1990-05-15 10:30:00', '1990-05-14 12:00:00'),
    (error) => error.code === 'TARGET_BEFORE_BIRTH',
  );
  assert.throws(
    () => buildChart('1990-05-15 10:30:00', '1990-05-14'),
    (error) => error.code === 'TARGET_BEFORE_BIRTH',
  );
  assert.doesNotThrow(() => buildChart('1990-05-15 10:30:00', '1990-05-15'));
  // 水二局虚构盘：十二大限覆盖到 121 岁，之后 iztro 返回 index=-1 的无效大限。
  assert.throws(
    () => buildChart('1920-01-13 00:08:00', '2042-01-01 16:08:00', '女'),
    (error) => error.code === 'TARGET_OUT_OF_DECADAL_RANGE',
  );
});
