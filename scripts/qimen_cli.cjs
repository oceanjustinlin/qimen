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
 * ──────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { buildQimenEvidence } = require(path.join(__dirname, '..', 'lib', 'qimenPipeline'));
const { classifyByRules } = require(path.join(__dirname, '..', 'lib', 'divinationRouter'));
const { normalizeDivinationRoute } = require(path.join(__dirname, '..', 'lib', 'divinationCategories'));
const { QIMEN_RULESET_VERSION } = require(path.join(__dirname, '..', 'lib', 'qimenClassicalRules'));

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
  const hasFlags = ['mode', 'question', 'cast-time', 'timezone', 'bazi-info'].some((k) => flags[k] !== undefined);
  if (hasFlags) {
    const out = {};
    if (typeof flags.mode === 'string') out.mode = flags.mode;
    if (typeof flags.question === 'string') out.question = flags.question;
    if (typeof flags['cast-time'] === 'string') out.cast_time = flags['cast-time'];
    if (typeof flags.timezone === 'string') out.timezone = flags.timezone;
    if (typeof flags['bazi-info'] === 'string') out.bazi_info = flags['bazi-info'];
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

// ── 主逻辑 ───────────────────────────────────────────────────────────────────
function run(input = {}) {
  const timezone = input.timezone || DEFAULT_TIMEZONE;
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  const mode = input.mode || (question ? 'question' : 'chart');
  if (mode !== 'chart' && mode !== 'question') {
    throw makeError('MODE_INVALID', `mode 只能是 chart 或 question，收到：${mode}`);
  }
  if (mode === 'question' && !question) {
    throw makeError('QUESTION_REQUIRED', 'mode=question 需要 question 字段');
  }

  const cast = resolveCastTime(input.cast_time, timezone);
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
  if (input.bazi_info) evArgs.baziInfo = String(input.bazi_info);
  const ev = buildQimenEvidence(evArgs);

  const out = {
    ok: true,
    system: 'qimen',
    mode,
    ruleset: QIMEN_RULESET_VERSION,
    input: {
      cast_time: { ...parts, source },
      timezone,
      question: mode === 'question' ? question : null,
    },
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
  };
  if (mode === 'question') {
    out.judgments = {
      intent: ev.intent,
      yongshen: ev.yongshenRule,
      score: ev.backendScoreAudit,
      formations: ev.backendFormationTags,
      timing: ev.timingAnalysis,
      polarity: ev.polarityOverrides,
    };
  }
  return out;
}

if (require.main === module) {
  try {
    const output = run(buildInput());
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } catch (err) {
    const payload = { ok: false, code: err.code || 'ERROR', error: err.message || String(err) };
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(1);
  }
}

module.exports = { resolveCastTime, run, wallToInstant };
