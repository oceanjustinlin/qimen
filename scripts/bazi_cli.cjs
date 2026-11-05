#!/usr/bin/env node
'use strict';

/**
 * bazi_cli.cjs — 八字分析 skill 的确定性计算内核（薄封装）
 * ──────────────────────────────────────────────────────────────────────────────
 * 职责：把「生辰 + 问题」跑成结构化 JSON，供 skill 的 LLM 层解读。
 *   ① 换算   Solar → 四柱 baZi + 起运 yun           （lunar-javascript，对齐 worker）
 *   ② 排盘   buildCompleteBaziDetail                （lib/baziCore，确定性原局决策）
 *   ③④⑤ 问事 buildBaziQuestionPrompt                （lib/baziQuestionCore，跑 static/status/timing）
 * CLI 只做确定性计算，绝不生成解读文案（文案留给 SKILL.md 的 LLM 层）。
 *
 * 复用生产同一批函数（worker/src/index.js:2766-2771 / :1484 同源），不改 lib。
 *
 * 用法：
 *   echo '{"birth":{"date":"1990-05-01","time":"14:00","gender":"男","location":{"place":"北京"}},"question":"..."}' | node scripts/bazi_cli.cjs
 *   node scripts/bazi_cli.cjs --file input.json
 *   node scripts/bazi_cli.cjs --mode chart --date 1990-05-01 --time 14:00 --gender 男
 * ──────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { Solar } = require('lunar-javascript');
const { buildCompleteBaziDetail } = require(path.join(__dirname, '..', 'lib', 'baziCore'));
const {
  buildBaziQuestionPrompt,
  inferBaziRouteFromQuestion,
  normalizeBaziSemanticRoute,
} = require(path.join(__dirname, '..', 'lib', 'baziQuestionCore'));
const { parseBirth } = require(path.join(__dirname, '..', 'lib', 'birthInput.cjs'));
const { ok, toFailure } = require(path.join(__dirname, '..', 'lib', 'cliEnvelope.cjs'));

// ── 输入读取：优先 stdin JSON，其次 --file，最后 flags ─────────────────────────
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
  // 1) --file
  if (flags.file) {
    try {
      return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
    } catch (e) {
      throw makeError('BAD_JSON', `--file 无法读取或不是合法 JSON：${e.message}`);
    }
  }
  // 2) stdin JSON（非 flags 场景）
  const stdin = readStdin();
  if (stdin) {
    try {
      return JSON.parse(stdin);
    } catch (e) {
      throw makeError('BAD_JSON', `stdin 不是合法 JSON：${e.message}`);
    }
  }
  // 3) flags 拼装（便捷路径）：--date --time --gender [--place|--longitude] [--question] [--mode] [--currentYear]
  if (flags.date) {
    const birth = { date: String(flags.date), gender: flags.gender === undefined ? '男' : String(flags.gender) };
    if (flags.time !== undefined) birth.time = String(flags.time);
    if (flags.place !== undefined || flags.longitude !== undefined) {
      birth.location = {};
      if (typeof flags.place === 'string') birth.location.place = flags.place;
      if (typeof flags.longitude === 'string') birth.location.longitude = Number(flags.longitude);
    }
    if (flags['time-basis'] !== undefined) birth.time_basis = String(flags['time-basis']);
    const out = { birth };
    if (typeof flags.mode === 'string') out.mode = flags.mode;
    if (typeof flags.question === 'string') out.question = flags.question;
    const cy = flags.currentYear !== undefined ? flags.currentYear : flags['current-year'];
    if (cy !== undefined) out.current_year = parseInt(cy, 10);
    return out;
  }
  throw makeError('NO_INPUT', '未提供输入：请用 stdin JSON、--file，或 --date/--time/--gender flags');
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// ── 换算 + 排盘 → detail + profile ───────────────────────────────────────────
const MALE_SET = new Set(['男', 'M', 'male', '乾造', '乾', 1, '1']);

function isMaleGender(gender) {
  return MALE_SET.has(gender);
}

// birth 可以是 parseBirth 的产物（NormalizedBirth），也可以是新/旧格式原始输入（此时先经 parseBirth 归一）。
// 排盘一律用 effective 时间（有出生地/经度时即真太阳时）。
function buildProfile(birth, currentYear) {
  const nb = birth && typeof birth === 'object' && birth.effective && birth.clock ? birth : parseBirth(birth);
  const { year, month, day, hour, minute } = nb.effective;

  const isMale = isMaleGender(nb.gender);
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const baZi = solar.getLunar().getEightChar(); // 默认 sect=2：夜子时算当日（对齐现有口径）
  const yun = baZi.getYun(isMale ? 1 : 0);
  const detail = buildCompleteBaziDetail({ baZi, yun, isMale, currentYear });

  const gz = detail.pillars.ganzhi;
  const baziStr = [gz.year, gz.month, gz.day, gz.time].filter(Boolean).join(' ');

  const profile = {
    bazi_detail: detail,
    bazi_str: baziStr,
    gender: nb.gender,
    ri_zhu: detail.ri_zhu,
    birth_year: year,
  };
  return { profile, detail, baziStr, isMale, birth: nb };
}

// ── 输出整形：只暴露确定性产物，丢弃 prompt 文案 ─────────────────────────────
function slimDayun(dayunList = []) {
  return dayunList.map((d) => ({
    id: d.id,
    start_year: d.start_year,
    end_year: d.end_year,
    start_age: d.start_age,
    end_age: d.end_age,
    gan: d.gan,
    zhi: d.zhi,
    shi_shen: d.shi_shen,
  }));
}

function buildChart(detail, baziStr) {
  return {
    bazi_str: baziStr,
    day_master: (detail.ri_zhu || '').charAt(0),
    ri_zhu: detail.ri_zhu,
    qi_yun: detail.base_info?.qi_yun || null,
    pillars: detail.matrix?.pillars || [],
    dayun_list: slimDayun(detail.matrix?.dayun_list),
    current_dayun: detail.matrix?.current_dayun || null,
    current_liunian: detail.matrix?.current_liunian || null,
  };
}

function buildStatic(detail) {
  return {
    geju: detail.geju || null,
    geju_info: detail.geju_info || null,
    strong_weak: detail.strong_weak || null,
    strength_detail: detail.strength_detail || null,
    five_shens: detail.five_shens || null,
    favorable_gods: detail.favorable_gods || null,
    unfavorable_gods: detail.unfavorable_gods || null,
    tiaohou_detail: detail.tiaohou_detail || null,
    chengge_detail: detail.chengge_detail || null,
    image_analysis: detail.image_analysis || null,
    decision_chain: detail.decision_chain || null,
    classic_verdict: detail.classic_verdict || null,
  };
}

function buildQuestionSection(profile, question, route) {
  // 保证走引擎路径：默认 branch:'bazi'，让 inferBaziRouteFromQuestion 自动定 analysis_mode
  const inRoute = { branch: 'bazi', ...(route || {}) };
  const semanticRoute = normalizeBaziSemanticRoute(inferBaziRouteFromQuestion(question, inRoute));
  const { pipelineResult } = buildBaziQuestionPrompt({ profile, question, route: inRoute });

  const section = {
    route: {
      analysis_mode: semanticRoute.analysis_mode || null,
      secondary_mode: semanticRoute.secondary_mode || null,
      branch: semanticRoute.branch || null,
      target_source: semanticRoute.target_source || null,
      time_scope: semanticRoute.time_scope || null,
    },
    engine_ran: Boolean(pipelineResult),
    limitations: [],
  };

  if (!pipelineResult) {
    // llm_derived / legacy：无后端目标，引擎跳过应期扫描
    section.limitations.push('llm_derived_or_legacy：无后端目标元素，引擎未产出结构化推演，需由 LLM 依静态盘推导');
    return section;
  }

  section.target_spec = pipelineResult.targetSpec || null;
  section.state_report = pipelineResult.stateReport || null;
  if (pipelineResult.dynamicReport) section.dynamic_report = pipelineResult.dynamicReport;
  if (pipelineResult.timingCandidates) section.timing_candidates = pipelineResult.timingCandidates;
  if (pipelineResult.scanned_years) section.scanned_years = pipelineResult.scanned_years;
  if (pipelineResult.time_scope) section.time_scope = pipelineResult.time_scope;
  if (Array.isArray(pipelineResult.limitations)) section.limitations.push(...pipelineResult.limitations);
  return section;
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

/**
 * run(input) → 统一输出外层 Envelope（出错时抛带 code 的 Error，由调用方用 toFailure 转换）
 * input: { birth, mode?: 'chart'|'question', question?, current_year?, route? }
 *   birth 兼容新格式 {date,time,gender,location?,time_basis?} 与旧格式 {calendar,year,month,day,hour,minute,gender}
 *   旧字段 currentYear 仍兼容。
 */
function run(input = {}) {
  const inp = input && typeof input === 'object' ? input : {};
  const question = typeof inp.question === 'string' ? inp.question.trim() : '';
  const mode = inp.mode || (question ? 'question' : 'chart');
  if (mode !== 'chart' && mode !== 'question') {
    throw makeError('MODE_INVALID', `mode 只能是 chart 或 question，收到：${mode}`);
  }
  const rawYear = inp.current_year !== undefined ? inp.current_year : inp.currentYear;
  const currentYear = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear();

  const nb = parseBirth(inp.birth);
  if (mode === 'question' && !question) throw makeError('QUESTION_REQUIRED', 'mode=question 需要 question 字段');

  const { profile, detail, baziStr } = buildProfile(nb, currentYear);

  const judgments = buildStatic(detail);
  let limitations = [];
  let confidence = null;
  if (mode === 'question') {
    const section = buildQuestionSection(profile, question, inp.route);
    judgments.question = section;
    limitations = [...section.limitations];
    const c = section.target_spec && section.target_spec.confidence;
    confidence = VALID_CONFIDENCE.has(c) ? c : null;
  }

  const normalizedInput = { ...nb, mode, current_year: currentYear };
  if (mode === 'question') normalizedInput.question = question;

  return ok({
    system: 'bazi',
    mode,
    engine_version: detail.engine_version || null,
    ruleset: null,
    input: normalizedInput,
    conventions: { zi_hour: '夜子时算当日' },
    chart: buildChart(detail, baziStr),
    judgments,
    confidence,
    limitations,
    warnings: [...nb.warnings],
  });
}

if (require.main === module) {
  try {
    process.stdout.write(JSON.stringify(run(buildInput()), null, 2) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify(toFailure(err, {}), null, 2) + '\n');
    process.exit(1);
  }
}

// 供 parity 测试在进程内直接比对（buildChart/buildStatic 是否无损映射引擎产物），并供 MCP 进程内调用 run
module.exports = {
  run,
  buildProfile,
  buildChart,
  buildStatic,
  buildQuestionSection,
  isMaleGender,
  slimDayun,
};
