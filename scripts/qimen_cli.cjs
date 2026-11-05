#!/usr/bin/env node
'use strict';

/**
 * qimen_cli.cjs — 奇门遁甲 skill 的确定性计算内核（薄封装）
 * ──────────────────────────────────────────────────────────────────────────────
 * 职责：把「起局时间 + 问题」跑成结构化 JSON，供 skill 的 LLM 层解读。
 *   复用生产同一管线 lib/qimenPipeline.buildQimenEvidence（worker/src/index.js 同源），不改 lib。
 *   intent 只走规则路由 classifyByRules（forceBranch:'qimen'），不调 LLM。
 * CLI 只做确定性计算，绝不生成解读文案。
 *
 * 用法：
 *   echo '{"mode":"question","question":"...","cast_time":"2026-11-05T09:30:00+08:00"}' | node scripts/qimen_cli.cjs
 *   node scripts/qimen_cli.cjs --file input.json
 *   node scripts/qimen_cli.cjs --mode chart --cast-time 2026-11-05T09:30:00+08:00 --timezone Asia/Shanghai
 *   可选生辰背景：JSON 的 birth 字段，或 --date --time --gender [--place]
 * 输出：统一外层（lib/cliEnvelope）；失败为 {ok:false,code,message,hint} 且退出码 1
 * ──────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { buildQimenEvidence } = require(path.join(__dirname, '..', 'lib', 'qimenPipeline'));
const { classifyByRules } = require(path.join(__dirname, '..', 'lib', 'divinationRouter'));
const { normalizeDivinationRoute } = require(path.join(__dirname, '..', 'lib', 'divinationCategories'));
const { QIMEN_RULESET_VERSION } = require(path.join(__dirname, '..', 'lib', 'qimenClassicalRules'));
const { parseBirth } = require(path.join(__dirname, '..', 'lib', 'birthInput.cjs'));
const { ok, toFailure } = require(path.join(__dirname, '..', 'lib', 'cliEnvelope.cjs'));
const { Solar } = require('lunar-javascript');

const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_QUESTION = '当前局势吉凶如何？';

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// ── 输入读取：--file，其次 flags，其次 stdin JSON ─────────────────────────────
function readStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw && raw.trim() ? raw : null;
  } catch (_) {
    return null;
  }
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function buildInput() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.file) {
    try {
      return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
    } catch (e) {
      throw makeError('BAD_JSON', `--file 无法读取或不是合法 JSON：${e.message}`);
    }
  }
  const hasFlags = ['mode', 'question', 'cast-time', 'timezone', 'date', 'time', 'gender', 'place'].some((k) => flags[k] !== undefined);
  if (hasFlags) {
    const out = {};
    if (typeof flags.mode === 'string') out.mode = flags.mode;
    if (typeof flags.question === 'string') out.question = flags.question;
    if (typeof flags['cast-time'] === 'string') out.cast_time = flags['cast-time'];
    if (typeof flags.timezone === 'string') out.timezone = flags.timezone;
    if (flags.date !== undefined) {
      // 缺 --time / --gender 由 parseBirth 报 TIME_REQUIRED / BIRTH_INCOMPLETE
      const birth = { date: String(flags.date) };
      if (flags.time !== undefined) birth.time = String(flags.time);
      if (flags.gender !== undefined) birth.gender = String(flags.gender);
      if (typeof flags.place === 'string') birth.location = { place: flags.place };
      out.birth = birth;
    }
    return out;
  }
  const stdin = readStdin();
  if (stdin) {
    try {
      return JSON.parse(stdin);
    } catch (e) {
      throw makeError('BAD_JSON', `stdin 不是合法 JSON：${e.message}`);
    }
  }
  return {}; // 无输入：默认以当前时刻起局（chart）
}

// ── 时间解析 ─────────────────────────────────────────────────────────────────
function assertTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  } catch (_) {
    throw makeError('TIMEZONE_INVALID', `无效的时区：${timezone}`);
  }
}

function wallPartsOf(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

// 时区在 date 时刻相对 UTC 的偏移（毫秒）
function tzOffsetMs(date, timezone) {
  if (timezone === DEFAULT_TIMEZONE) return 8 * 3600 * 1000;
  const w = wallPartsOf(date, timezone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

// 某时区的墙上时间 → 绝对时刻
function wallToInstant(parts, timezone) {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  let guess = naive - tzOffsetMs(new Date(naive), timezone);
  guess = naive - tzOffsetMs(new Date(guess), timezone); // 二次修正，覆盖夏令时边界
  return new Date(guess);
}

const NAIVE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
const OFFSET_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

function invalidCastTime(castTime) {
  return makeError('CAST_TIME_INVALID', `无法解析起局时间：${castTime}（期望 ISO 8601，如 2026-11-05T09:30:00+08:00）`);
}

function resolveCastTime(castTime, timezone = DEFAULT_TIMEZONE, now = new Date()) {
  assertTimezone(timezone);
  if (castTime === undefined || castTime === null || castTime === '') {
    return { ...wallPartsOf(now, timezone), source: 'now' };
  }
  const text = String(castTime).trim();

  if (OFFSET_SUFFIX_RE.test(text) && /^\d{4}-\d{2}-\d{2}[T ]/.test(text)) {
    const date = new Date(text.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) throw invalidCastTime(castTime);
    return { ...wallPartsOf(date, timezone), source: 'custom' };
  }

  const m = NAIVE_RE.exec(text);
  if (!m) throw invalidCastTime(castTime);
  const parts = {
    year: +m[1], month: +m[2], day: +m[3],
    hour: m[4] === undefined ? 0 : +m[4],
    minute: m[5] === undefined ? 0 : +m[5],
  };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  if (
    check.getUTCFullYear() !== parts.year || check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day || check.getUTCHours() !== parts.hour || check.getUTCMinutes() !== parts.minute
  ) {
    throw invalidCastTime(castTime);
  }
  return { ...parts, source: 'custom' };
}

// ── 生辰四柱 ─────────────────────────────────────────────────────────────────
// 按 parseBirth 的 effective 时间（有出生地则为真太阳时）经 lunar-javascript 排四柱，
// 格式同网页端 currentBaziString：年 月 日 时，空格分隔。
function baziStringOf(effective) {
  const { year, month, day, hour, minute } = effective;
  const ec = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar().getEightChar();
  return `${ec.getYear()} ${ec.getMonth()} ${ec.getDay()} ${ec.getTime()}`;
}

// ── 主逻辑 ───────────────────────────────────────────────────────────────────
function buildEvidence(ev) {
  const items = [
    ...(ev.backendFormationTags || []).map((t) => ({ rule_id: t.name, section: 'named_formation' })),
    ...((ev.backendScoreAudit && ev.backendScoreAudit.adjustments) || []).map((a) => ({
      rule_id: a.signal || a.name,
      section: a.layer || 'named_formation',
    })),
  ].filter((e) => typeof e.rule_id === 'string' && e.rule_id);
  const seen = new Set();
  return items.filter((e) => {
    const key = `${e.rule_id}|${e.section}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const CONFIDENCE_LEVELS = ['high', 'medium', 'low'];

/**
 * run(input) → 统一输出外层 Envelope（出错时抛带 code 的 Error，由调用方用 toFailure 转换）
 * input: { mode?, question?, cast_time?, timezone?, birth? }
 */
function run(input = {}) {
  const inp = input && typeof input === 'object' ? input : {};
  const timezone = inp.timezone || DEFAULT_TIMEZONE;
  const question = typeof inp.question === 'string' ? inp.question.trim() : '';
  const mode = inp.mode || (question ? 'question' : 'chart');
  if (mode !== 'chart' && mode !== 'question') {
    throw makeError('MODE_INVALID', `mode 只能是 chart 或 question，收到：${mode}`);
  }
  if (mode === 'question' && !question) {
    throw makeError('QUESTION_REQUIRED', 'mode=question 需要 question 字段');
  }

  const hasBirth = inp.birth !== undefined && inp.birth !== null;
  const nb = hasBirth ? parseBirth(inp.birth) : null;
  const birthBazi = nb ? baziStringOf(nb.effective) : null;

  const cast = resolveCastTime(inp.cast_time, timezone);
  const { source, ...parts } = cast;
  const effectiveQuestion = mode === 'question' ? question : DEFAULT_QUESTION;
  const intent = normalizeDivinationRoute(classifyByRules(effectiveQuestion, { forceBranch: 'qimen' }));

  const evArgs = {
    ...parts,
    panTimeParts: source === 'custom' ? { ...parts } : null,
    // 起局时刻的绝对时间：保证应期扫描 generatedAt 不随进程时区漂移
    baseTime: wallToInstant(parts, timezone),
    question: effectiveQuestion,
    intent,
  };
  if (birthBazi) evArgs.baziInfo = birthBazi;
  const ev = buildQimenEvidence(evArgs);

  const normalizedInput = {
    cast_time: { ...parts, source },
    timezone,
    question: mode === 'question' ? question : null,
  };
  if (nb) {
    normalizedInput.birth = nb;
    normalizedInput.birth_bazi = birthBazi;
  }

  const limitations = [];
  if (nb) {
    limitations.push('纯奇门分支为避免命局偏倚，引擎不把命主八字带入用神与评分；生辰四柱仅作背景记录于 input.birth_bazi。');
  }

  const envelope = {
    system: 'qimen',
    mode,
    engine_version: null,
    ruleset: QIMEN_RULESET_VERSION,
    input: normalizedInput,
    conventions: { timezone, qimen_method: '时家转盘 · 拆补法 · 天禽寄坤' },
    chart: {
      qimenData: ev.qimenData,
      palaces: ev.timingPalaces,
      palacesText: ev.palacesText,
      juResult: ev.juResult,
      xunHead: ev.xunHead,
      zhiFuStar: ev.zhiFuStar,
      zhiShiDoor: ev.zhiShiDoor,
      ganzhiDay: ev.ganzhiDay,
      ganzhiHour: ev.ganzhiHour,
    },
    judgments: {},
    evidence: [],
    confidence: null,
    limitations,
    warnings: nb ? [...new Set(nb.warnings)] : [],
  };
  if (mode === 'question') {
    envelope.judgments = {
      intent: ev.intent,
      yongshen: ev.yongshenRule,
      score: ev.backendScoreAudit,
      formations: ev.backendFormationTags,
      timing: ev.timingAnalysis,
      polarity: ev.polarityOverrides,
    };
    envelope.evidence = buildEvidence(ev);
    const c = ev.backendScoreAudit && ev.backendScoreAudit.confidence;
    envelope.confidence = CONFIDENCE_LEVELS.includes(c) ? c : null;
  }
  return ok(envelope);
}

function main() {
  try {
    process.stdout.write(JSON.stringify(run(buildInput()), null, 2) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify(toFailure(err, {}), null, 2) + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { resolveCastTime, run, wallToInstant, baziStringOf };
