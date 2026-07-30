'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(__dirname, 'ziwei_cli.cjs');
const {
  buildZiweiInput,
  makeZiweiError,
} = require(path.join(ROOT, 'lib', 'ziweiProfileAdapter.cjs'));

function profile(overrides = {}) {
  return {
    profile_id: 'test-profile',
    gender: '女',
    birth_date: '2000-08-16 03:30:00',
    adjusted_birth_date: '2000-08-16 03:18:00',
    solar_time_mode: 'apparent',
    solar_time_adjustment_minutes: -12,
    ...overrides,
  };
}

function runCli(input) {
  return JSON.parse(execFileSync('node', [CLI], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  }));
}

function runCliExpectFail(input) {
  try {
    execFileSync('node', [CLI], { input: JSON.stringify(input), encoding: 'utf8' });
    assert.fail('应以非零退出');
  } catch (error) {
    assert.equal(error.status, 1);
    return JSON.parse(error.stdout);
  }
}

test('优先使用档案的校正出生时间，并保留太阳时来源', () => {
  const input = buildZiweiInput(profile());

  assert.equal(input.birth.date_str, '2000-8-16');
  assert.equal(input.birth.time_index, 2);
  assert.equal(input.birth.time_label, '寅时');
  assert.equal(input.birth.gender, 'female');
  assert.equal(input.source.time_source, 'profile_adjusted');
  assert.equal(input.source.time_correction_minutes, -12);
  assert.deepEqual(input.warnings, []);
});

test('旧档案回退民用时间时会保留唯一警告', () => {
  const input = buildZiweiInput(profile({ adjusted_birth_date: null }));

  assert.equal(input.birth.date_str, '2000-8-16');
  assert.equal(input.source.time_source, 'profile_legacy_clock');
  assert.deepEqual(input.warnings, ['ZIWEI_USING_UNADJUSTED_PROFILE_TIME']);
});

test('早子时与晚子时分别映射为 0 和 12，且不改变民用日期', () => {
  const early = buildZiweiInput(profile({ adjusted_birth_date: '2000-08-16 00:30:00' }));
  const late = buildZiweiInput(profile({ adjusted_birth_date: '2000-08-16 23:30:00' }));

  assert.equal(early.birth.date_str, '2000-8-16');
  assert.equal(early.birth.time_index, 0);
  assert.equal(late.birth.date_str, '2000-8-16');
  assert.equal(late.birth.time_index, 12);
});

test('缺少出生时分会返回稳定的 PROFILE_BIRTH_TIME_MISSING 错误', () => {
  assert.throws(
    () => buildZiweiInput(profile({ adjusted_birth_date: '2000-08-16' })),
    (error) => error.code === 'PROFILE_BIRTH_TIME_MISSING',
  );
  assert.equal(makeZiweiError('PROFILE_BIRTH_TIME_MISSING', 'x').code, 'PROFILE_BIRTH_TIME_MISSING');
});

test('CLI 生成完整十二宫本命盘，并暴露稳定审计元数据', () => {
  const out = runCli({ mode: 'natal', profile_snapshot: profile() });

  assert.equal(out.ok, true);
  assert.equal(out.schema_version, 'ziwei-cli/v1');
  assert.equal(out.engine.library, 'iztro');
  assert.equal(out.engine.library_version, '2.5.8');
  assert.equal(out.input.time_source, 'profile_adjusted');
  assert.equal(out.input.time_index, 2);
  assert.equal(out.natal.palaces.length, 12);
  assert.equal(new Set(out.natal.palaces.map((palace) => palace.palace_key)).size, 12);
  assert.equal(out.natal.palaces.filter((palace) => palace.palace_key === '命宫').length, 1);
  assert.equal(out.natal.palaces.filter((palace) => palace.is_body_palace).length, 1);
  out.natal.palaces.forEach((palace) => {
    assert.ok(palace.earthly_branch);
    assert.ok(palace.decadal);
    assert.equal(palace.relations.opposite.length > 0, true);
    assert.equal(palace.relations.trine.length, 2);
  });
});

test('CLI 不接受缺失出生时分的档案', () => {
  const out = runCliExpectFail({
    mode: 'natal',
    profile_snapshot: profile({ adjusted_birth_date: '2000-08-16' }),
  });

  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'PROFILE_BIRTH_TIME_MISSING');
});

test('CLI 将无效运限目标统一为 TARGET_DATETIME_INVALID', () => {
  const out = runCliExpectFail({
    mode: 'natal',
    profile_snapshot: profile(),
    target_datetime: 'not-a-date',
    options: { include_horoscope: true },
  });

  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'TARGET_DATETIME_INVALID');
});
