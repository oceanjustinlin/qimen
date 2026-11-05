const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, fail, toFailure, validateEnvelope, ERROR_HINTS } = require('./cliEnvelope.cjs');

test('ok() 补全默认字段并通过 schema', () => {
  const env = ok({ system: 'bazi', mode: 'chart', input: {}, conventions: {}, chart: {} });
  assert.deepEqual([env.evidence, env.limitations, env.warnings], [[], [], []]);
  assert.deepEqual(env.judgments, {});
  assert.equal(env.confidence, null);
  assert.equal(env.engine_version, null);
  assert.equal(env.ruleset, null);
  assert.equal(env.ok, true);
  assert.equal(validateEnvelope(env).valid, true);
});

test('schema 拒绝未知 system 和非法 confidence', () => {
  const base = ok({ system: 'bazi', mode: 'chart', input: {}, conventions: {}, chart: {} });
  assert.equal(validateEnvelope({ ...base, system: 'tarot' }).valid, false);
  assert.equal(validateEnvelope({ ...base, confidence: 'very' }).valid, false);
  assert.equal(validateEnvelope({ ...base, confidence: 'low' }).valid, true);
});

test('schema 的 evidence 项要求 rule_id 且不允许额外字段', () => {
  const base = ok({ system: 'qimen', mode: 'chart', input: {}, conventions: {}, chart: {} });
  assert.equal(validateEnvelope({ ...base, evidence: [{ rule_id: 'r1', source_id: 's', title: 't', printed_page: 3, section: 'x' }] }).valid, true);
  assert.equal(validateEnvelope({ ...base, evidence: [{ title: 't' }] }).valid, false);
  assert.equal(validateEnvelope({ ...base, evidence: [{ rule_id: 'r1', text: '原文' }] }).valid, false);
});

test('schema 校验失败分支 ok:false', () => {
  assert.equal(validateEnvelope(fail('TIME_REQUIRED', 'm')).valid, true);
  assert.equal(validateEnvelope({ ok: false, code: 'X', message: 'm' }).valid, false);
});

test('fail(TIME_REQUIRED) 带中文 hint', () => {
  assert.match(fail('TIME_REQUIRED', '缺少出生时间').hint, /出生时辰/);
});

test('fail(PLACE_AMBIGUOUS) 在 hint 中列出前 5 个候选及经度', () => {
  const candidates = Array.from({ length: 7 }, (_, i) => ({ label: `地${i}`, longitude: 100 + i }));
  const f = fail('PLACE_AMBIGUOUS', 'm', { candidates });
  assert.match(f.hint, /地0/);
  assert.match(f.hint, /104/);
  assert.doesNotMatch(f.hint, /地5/);
});

test('ERROR_HINTS 覆盖 spec 列出的全部错误码', () => {
  for (const c of ['NO_INPUT','BAD_JSON','BIRTH_INCOMPLETE','CALENDAR_UNSUPPORTED','QUESTION_REQUIRED','TOPIC_UNSUPPORTED',
    'TIME_SCOPE_INVALID','TIME_SCOPE_TOO_WIDE','TIME_REQUIRED','PLACE_NOT_FOUND','PLACE_UNSUPPORTED','PLACE_AMBIGUOUS','ENGINE_ERROR','CAST_TIME_INVALID',
    'TIMEZONE_INVALID','MODE_INVALID'])
    assert.ok(ERROR_HINTS[c], c);
});

test('toFailure：无 code 的异常 → ENGINE_ERROR，不含堆栈', () => {
  const f = toFailure(new TypeError('x is undefined'), { engine_version: '1.8.29', input_summary: { system: 'bazi' } });
  assert.equal(f.code, 'ENGINE_ERROR');
  assert.equal(f.engine_version, '1.8.29');
  assert.deepEqual(f.input_summary, { system: 'bazi' });
  assert.doesNotMatch(JSON.stringify(f), /at .*\.cjs:\d+/);
  assert.equal(validateEnvelope(f).valid, true);
});

test('toFailure：已知 code 映射并携带 candidates；未知 code 走 ENGINE_ERROR', () => {
  const err = Object.assign(new Error('多个地点'), { code: 'PLACE_AMBIGUOUS', candidates: [{ label: '甲', longitude: 120.5 }] });
  const f = toFailure(err);
  assert.equal(f.code, 'PLACE_AMBIGUOUS');
  assert.match(f.hint, /甲/);
  assert.equal(toFailure(Object.assign(new Error('boom'), { code: 'ECONNRESET' })).code, 'ENGINE_ERROR');
  assert.equal(toFailure(Object.assign(new Error('t'), { code: 'TIMEZONE_INVALID' })).code, 'TIMEZONE_INVALID');
});
