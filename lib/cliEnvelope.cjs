'use strict';
// 统一输出外层与错误码（spec §4.3 / §4.4）。
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const SCHEMA_PATH = path.join(__dirname, '..', 'schemas', 'xuanxue-output.schema.json');

const ERROR_HINTS = {
  NO_INPUT: '未收到输入。请通过 stdin 传入 JSON，或使用 --file / 便捷参数提供输入',
  BAD_JSON: '输入不是合法 JSON。请检查引号、逗号和括号后重新生成输入',
  BIRTH_INCOMPLETE: '出生信息不完整。请向用户询问缺失的年、月、日等字段后重试',
  CALENDAR_UNSUPPORTED: '不支持该历法。请向用户确认是公历还是农历，并改用受支持的历法重试',
  QUESTION_REQUIRED: '问事模式必须提供具体问题。请向用户询问想问的具体事情',
  TOPIC_UNSUPPORTED: '不支持该主题。请改用受支持的主题（如 overall、career、wealth、relationship）',
  TIME_SCOPE_INVALID: '时间范围无效。请向用户确认要看的年份或区间，并使用合法的 time_scope 重试',
  TIME_SCOPE_TOO_WIDE: '时间范围过宽（一次最多 10 个流年）。请缩小范围或分多次查询',
  TIME_REQUIRED: '请向用户询问出生时辰（精确到分钟）',
  PLACE_NOT_FOUND: '未找到该出生地。请向用户确认城市名称（可补充省/国家），或直接提供出生地经度',
  PLACE_UNSUPPORTED: '该出生地暂不支持自动换算真太阳时。请向用户询问出生地经度，或改用受支持的地点',
  PLACE_AMBIGUOUS: '出生地有多个候选，请向用户确认具体是哪一个后重试',
  ENGINE_ERROR: '引擎出现非预期错误。请不要自行心算排盘；可检查输入后重试，仍失败请向用户如实说明',
  CAST_TIME_INVALID: '起局时间无效。请使用合法的 ISO 时间（如 2026-11-05T14:30:00）',
  TIMEZONE_INVALID: '时区无效。请使用 IANA 时区名（如 Asia/Shanghai）',
  MODE_INVALID: '模式无效。请使用该体系支持的 mode（如 chart、question、evidence）',
};

function ok(fields = {}) {
  const f = fields || {};
  return {
    ok: true,
    system: f.system,
    mode: f.mode,
    engine_version: f.engine_version ?? null,
    ruleset: f.ruleset ?? null,
    input: f.input ?? {},
    conventions: f.conventions ?? {},
    chart: f.chart ?? {},
    judgments: f.judgments ?? {},
    evidence: f.evidence ?? [],
    confidence: f.confidence ?? null,
    limitations: f.limitations ?? [],
    warnings: f.warnings ?? [],
  };
}

const SINGLE_CANDIDATE_HINT = '出生地无精确匹配，请向用户确认是否为下列地点；确认后把候选标签原样作为 place 传回即可';

function ambiguousHint(candidates) {
  const shown = (Array.isArray(candidates) ? candidates : []).slice(0, 5);
  const list = shown.map((c, i) => `${i + 1}. ${c.label}（经度 ${c.longitude}）`).join('；');
  if (!list) return ERROR_HINTS.PLACE_AMBIGUOUS;
  if (shown.length === 1) return `${SINGLE_CANDIDATE_HINT}。候选：${list}`;
  return `${ERROR_HINTS.PLACE_AMBIGUOUS}（可把候选标签原样作为 place 传回）。候选：${list}`;
}

function fail(code, message, extra = {}) {
  const hint = code === 'PLACE_AMBIGUOUS'
    ? ambiguousHint(extra && extra.candidates)
    : (ERROR_HINTS[code] || ERROR_HINTS.ENGINE_ERROR);
  return { ok: false, code, message: String(message ?? ''), hint };
}

function toFailure(err, { engine_version, input_summary } = {}) {
  const code = err && err.code;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(ERROR_HINTS, code) && code !== 'ENGINE_ERROR') {
    return fail(code, err.message, { candidates: err.candidates });
  }
  const f = fail('ENGINE_ERROR', '引擎内部错误（详情已隐藏）');
  f.engine_version = engine_version ?? null;
  f.input_summary = input_summary ?? null;
  return f;
}

let validator;
function validateEnvelope(obj) {
  if (!validator) {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    validator = new Ajv({ allErrors: true, strict: false }).compile(schema);
  }
  const valid = validator(obj) === true;
  return { valid, errors: valid ? [] : validator.errors };
}

module.exports = { ok, fail, toFailure, validateEnvelope, ERROR_HINTS };
