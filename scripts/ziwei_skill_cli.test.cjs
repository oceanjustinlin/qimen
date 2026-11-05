'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CLI = path.join(__dirname, 'ziwei_skill_cli.cjs');
const { run, normalizeRoute, toProfileSnapshot } = require(CLI);
const { parseBirth } = require('../lib/birthInput.cjs');
const { validateEnvelope } = require('../lib/cliEnvelope.cjs');

const BIRTH = { date: '1990-05-01', time: '14:00', gender: '男' };

function runCli(input, args = []) {
  try {
    return { status: 0, out: JSON.parse(execFileSync('node', [CLI, ...args], { input: JSON.stringify(input), encoding: 'utf8' })) };
  } catch (error) {
    return { status: error.status, out: JSON.parse(error.stdout) };
  }
}

test('本命模式输出 4×4 盘面、十二宫与主题证据，不含运限', () => {
  const result = run({ birth: BIRTH, mode: 'evidence', topic: 'career' }, { now: new Date('2026-11-05') });

  assert.equal(result.ok, true);
  assert.equal(result.system, 'ziwei');
  assert.equal(validateEnvelope(result).valid, true);
  assert.equal(result.chart.palaces.length, 12);
  assert.equal(result.chart.board.length, 4);
  assert.deepEqual(result.chart.board[1].slice(1, 3), [null, null]);
  assert.deepEqual(result.chart.board[0].map((cell) => cell.branch), ['巳', '午', '未', '申']);
  assert.equal(result.chart.board.flat().filter(Boolean).length, 12);
  assert.equal(result.judgments.topic_report.topic, 'career');
  assert.deepEqual(result.chart.periods, []);
});

test('跨期模式逐年给出运限宫职映射，且与引擎动态特征一致', () => {
  const result = run({
    birth: BIRTH,
    topic: 'career',
    time_scope: { type: 'cross_period', start_year: 2026, end_year: 2027 },
  });

  assert.deepEqual(result.chart.periods.map((period) => period.year), [2026, 2027]);
  for (const period of result.chart.periods) {
    const yearlySnapshot = period.dynamic_snapshots.find((snap) => snap.scope === 'yearly');
    assert.equal(period.yearly.life_palace_maps_to, yearlySnapshot.life_palace_maps_to);
    assert.equal(Object.keys(period.yearly.role_to_natal).length, 12);
    assert.equal(new Set(Object.values(period.yearly.role_to_natal)).size, 12);
    assert.equal(period.raw_horoscope, undefined);
  }
  assert.notEqual(result.chart.periods[0].yearly.stem_branch, result.chart.periods[1].yearly.stem_branch);
});

test('time_scope 缺年份时默认取 currentYear', () => {
  const route = normalizeRoute({ topic: 'wealth', time_scope: { type: 'yearly' } }, 2026);
  assert.deepEqual(route.years, [2026]);
});

test('真太阳时口径作为校正时间传入，民用时间保留未校正警告', () => {
  assert.equal(toProfileSnapshot(parseBirth({ ...BIRTH, time_basis: 'true_solar' })).adjusted_birth_date, '1990-05-01 14:00:00');
  const clock = run({ birth: BIRTH });
  assert.ok(clock.warnings.includes('ZIWEI_USING_UNADJUSTED_PROFILE_TIME'));
  const solar = run({ birth: { ...BIRTH, time_basis: 'true_solar' } });
  assert.ok(!solar.warnings.includes('ZIWEI_USING_UNADJUSTED_PROFILE_TIME'));
});

test('错误以 JSON + 非零退出码返回', () => {
  assert.deepEqual(
    [runCli({ birth: { date: '1990-05-01', gender: '男' } }).out.code, runCli({ birth: { date: '1990-05-01', gender: '男' } }).status],
    ['TIME_REQUIRED', 1],
  );
  assert.equal(runCli({ birth: BIRTH, topic: 'health' }).out.code, 'TOPIC_UNSUPPORTED');
  assert.equal(
    runCli({ birth: BIRTH, time_scope: { type: 'yearly', start_year: 2020, end_year: 2035 } }).out.code,
    'TIME_SCOPE_TOO_WIDE',
  );
});

test('便捷 flags 路径可用', () => {
  const { status, out } = runCli(null, ['--date', '1990-05-01', '--time', '14:00', '--gender', '男', '--topic', 'wealth', '--year', '2026']);
  assert.equal(status, 0);
  assert.equal(out.ok, true);
  assert.equal(out.input.topic, 'wealth');
  assert.deepEqual(out.chart.periods.map((period) => period.year), [2026]);
});

test('便捷 flags 缺 --gender / --time 时报错，不静默默认', () => {
  assert.equal(runCli(null, ['--date', '1990-05-01', '--time', '14:00']).out.code, 'BIRTH_INCOMPLETE');
  assert.equal(runCli(null, ['--date', '1990-05-01', '--gender', '男']).out.code, 'TIME_REQUIRED');
});

test('run(evidence) 通过 schema，evidence 项不含正文字段', () => {
  const env = run({ birth: { date: '1990-05-01', time: '14:00', gender: '女' }, mode: 'evidence', topic: 'career' });
  assert.equal(validateEnvelope(env).valid, true);
  assert.ok(env.evidence.length > 0);
  for (const e of env.evidence) for (const k of ['ocr_text', 'corrected_text', 'correction_notes']) assert.equal(e[k], undefined);
  assert.ok(env.evidence.every((e) => e.rule_id && e.source_id));
  assert.ok(['high', 'medium', 'low'].includes(env.confidence));
});

test('整个信封不含任何古籍摘录正文（含 judgments）', () => {
  const fs = require('node:fs');
  const env = run({ birth: BIRTH, mode: 'evidence', topic: 'career', time_scope: { type: 'yearly', start_year: 2026 } });
  const dump = JSON.stringify(env);
  assert.ok(!/ocr_text|corrected_text|correction_notes/.test(dump));
  const root = path.join(__dirname, '..', 'knowledge', 'ziwei', 'sources');
  for (const dir of fs.readdirSync(root)) {
    const file = path.join(root, dir, 'excerpts.jsonl');
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const row = JSON.parse(line);
      for (const text of [row.corrected_text, row.ocr_text]) {
        if (text && text.length >= 12) assert.ok(!dump.includes(text.slice(0, 12)), `泄露摘录：${row.id}`);
      }
    }
  }
});

test('chart 模式不含证据；旧 mode=natal 视为 chart', () => {
  const env = run({ birth: BIRTH, mode: 'natal' });
  assert.equal(env.mode, 'chart');
  assert.deepEqual(env.evidence, []);
  assert.equal(env.confidence, null);
  assert.equal(validateEnvelope(env).valid, true);
});

test('mode 非法 → MODE_INVALID（抛出带 code 的错误）', () => {
  assert.throws(() => run({ birth: BIRTH, mode: 'x' }), (e) => e.code === 'MODE_INVALID');
});

test('conventions.zi_hour 为晚子时算次日', () => {
  assert.equal(run({ birth: BIRTH }).conventions.zi_hour, '晚子时算次日');
});

test('time_scope 11 年 → TIME_SCOPE_TOO_WIDE；topic=health → TOPIC_UNSUPPORTED', () => {
  assert.throws(
    () => run({ birth: BIRTH, time_scope: { type: 'yearly', start_year: 2020, end_year: 2030 } }),
    (e) => e.code === 'TIME_SCOPE_TOO_WIDE',
  );
  assert.throws(() => run({ birth: BIRTH, topic: 'health' }), (e) => e.code === 'TOPIC_UNSUPPORTED');
});

test('带 location：传给引擎的 adjusted_birth_date 等于 effective', () => {
  const nb = parseBirth({ ...BIRTH, location: { place: '乌鲁木齐' } });
  const snap = toProfileSnapshot(nb);
  assert.equal(snap.adjusted_birth_date, '1990-05-01 10:53:00');
  assert.equal(snap.birth_date, '1990-05-01 14:00:00');
  assert.equal(snap.solar_time_mode, 'apparent');
  const env = run({ birth: { ...BIRTH, location: { place: '乌鲁木齐' } } });
  assert.equal(env.input.effective.hour, 10);
  assert.ok(!env.warnings.includes('ZIWEI_USING_UNADJUSTED_PROFILE_TIME'));
  assert.deepEqual(toProfileSnapshot(parseBirth(BIRTH)), { gender: '男', birth_date: '1990-05-01 14:00:00' });
});

test('运限年份早于出生 → TIME_SCOPE_INVALID（不是 ENGINE_ERROR）', () => {
  assert.throws(
    () => run({ birth: BIRTH, time_scope: { type: 'yearly', start_year: 1980 } }),
    (e) => e.code === 'TIME_SCOPE_INVALID',
  );
});
