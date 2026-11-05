#!/usr/bin/env node
'use strict';

// 紫微斗数 skill 的单入口证据包 CLI。
// 只串联已有的确定性模块，不新增任何安星、四化或断语逻辑：
//   ziwei_cli（iztro 排盘）→ 派生特征 → ziwei_report_evidence（已审核命题匹配）。
// 用法与 bazi_cli.cjs 对齐：stdin JSON、--file，或 --date/--time/--gender 便捷参数。

const fs = require('fs');
const path = require('path');
const { run: runZiweiCli } = require('./ziwei_cli.cjs');
const { composeEvidenceReport } = require('./ziwei_report_evidence.cjs');
const { deriveFeatureSet } = require('../lib/ziweiFeatureDeriver.cjs');
const { deriveDynamicFeatureSet } = require('../lib/ziweiDynamicFeatures.cjs');
const { parseBirth } = require('../lib/birthInput.cjs');
const { ok, toFailure } = require('../lib/cliEnvelope.cjs');

const SCHEMA_VERSION = 'ziwei-skill/v1';
const TOPICS = ['overall', 'career', 'wealth', 'relationship'];
const TIME_SCOPES = ['natal', 'decadal', 'yearly', 'cross_period'];
const MAX_YEARS = 10;

// 盘面固定按传统 4×4 布局输出：外圈十二宫、中间 2×2 为中宫。行优先，null 表示中宫格。
const BOARD_LAYOUT = [
  ['巳', '午', '未', '申'],
  ['辰', null, null, '酉'],
  ['卯', null, null, '戌'],
  ['寅', '丑', '子', '亥'],
];

function skillError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function readInput() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.file) {
    try {
      return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
    } catch (error) {
      throw skillError('BAD_JSON', `--file 无法读取或不是合法 JSON：${error.message}`);
    }
  }
  if (flags.date) {
    // 不设默认：缺 --time / --gender 由 parseBirth 报 TIME_REQUIRED / BIRTH_INCOMPLETE
    const birth = { date: String(flags.date) };
    if (flags.time !== undefined) birth.time = String(flags.time);
    if (flags.gender !== undefined) birth.gender = String(flags.gender);
    if (flags.place !== undefined || flags.longitude !== undefined) {
      birth.location = {};
      if (typeof flags.place === 'string') birth.location.place = flags.place;
      if (typeof flags.longitude === 'string') birth.location.longitude = Number(flags.longitude);
    }
    if (flags['time-basis'] !== undefined) birth.time_basis = String(flags['time-basis']);
    const out = { birth, topic: flags.topic || 'overall' };
    if (typeof flags.mode === 'string') out.mode = flags.mode;
    if (typeof flags.question === 'string') out.question = flags.question;
    if (flags.year) {
      out.time_scope = { type: flags.scope || 'cross_period', start_year: Number(flags.year), end_year: Number(flags['end-year'] || flags.year) };
    }
    return out;
  }
  if (process.stdin.isTTY) {
    throw skillError('NO_INPUT', '请通过 stdin JSON、--file，或 --date/--time/--gender 提供输入。');
  }
  const raw = fs.readFileSync(0, 'utf8').trim();
  if (!raw) throw skillError('NO_INPUT', 'stdin 为空。');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw skillError('BAD_JSON', `stdin 不是合法 JSON：${error.message}`);
  }
}

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDateTime = (t) => `${t.year}-${pad2(t.month)}-${pad2(t.day)} ${pad2(t.hour)}:${pad2(t.minute)}:00`;

// 入参为 parseBirth 的产物（NormalizedBirth）。
// 有出生地换算（solar_time）或用户声明 time_basis=true_solar 时，把 effective 作为校正时间传入引擎（apparent）；
// 其余情况只传民用钟表时间，并保留引擎的 ZIWEI_USING_UNADJUSTED_PROFILE_TIME 警告。
function toProfileSnapshot(nb) {
  const birthDate = fmtDateTime(nb.clock);
  if (nb.solar_time || nb.time_basis === 'true_solar') {
    return { gender: nb.gender, birth_date: birthDate, adjusted_birth_date: fmtDateTime(nb.effective), solar_time_mode: 'apparent' };
  }
  return { gender: nb.gender, birth_date: birthDate };
}

function normalizeRoute(route = {}, currentYear) {
  const topic = route.topic || 'overall';
  if (!TOPICS.includes(topic)) {
    throw skillError('TOPIC_UNSUPPORTED', `topic 仅支持 ${TOPICS.join(' / ')}；其他主题请归入最接近的一类，或用 overall。`);
  }
  const scope = route.time_scope || { type: 'natal' };
  if (!TIME_SCOPES.includes(scope.type)) {
    throw skillError('TIME_SCOPE_INVALID', `time_scope.type 仅支持 ${TIME_SCOPES.join(' / ')}。`);
  }
  if (scope.type === 'natal') return { topic, time_scope: { type: 'natal' }, years: [] };
  const start = Number(scope.start_year || currentYear);
  const end = Number(scope.end_year || start);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    throw skillError('TIME_SCOPE_INVALID', 'start_year / end_year 必须是整数且 end_year ≥ start_year。');
  }
  if (end - start + 1 > MAX_YEARS) {
    throw skillError('TIME_SCOPE_TOO_WIDE', `一次最多扫描 ${MAX_YEARS} 个流年，请缩小区间。`);
  }
  const years = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return { topic, time_scope: { type: scope.type, start_year: start, end_year: end }, years };
}

function starLabel(star) {
  return `${star.name}${star.brightness ? `(${star.brightness})` : ''}${star.mutagen ? `化${star.mutagen}` : ''}`;
}

function buildBoard(natal) {
  const byBranch = new Map(natal.palaces.map((palace) => [palace.earthly_branch, palace]));
  return BOARD_LAYOUT.map((row) => row.map((branch) => {
    if (!branch) return null;
    const palace = byBranch.get(branch);
    return {
      branch,
      palace_key: palace.palace_key,
      stem_branch: `${palace.heavenly_stem}${palace.earthly_branch}`,
      is_body_palace: palace.is_body_palace,
      major_stars: palace.major_stars.map(starLabel),
      minor_stars: palace.minor_stars.map(starLabel),
      decadal: palace.decadal ? `${palace.decadal.start_age}-${palace.decadal.end_age}` : null,
    };
  }));
}

function summarizePeriod(period, natalPalaces) {
  if (!period) return null;
  // iztro 的 palace_keys[i] 是本命第 i 宫（地支序）在该运限中的宫职。
  // 这里展开成「运限宫职 → 本命宫」，避免解读时把下标关系读反。
  const roleToNatal = {};
  period.palace_keys.forEach((role, index) => {
    roleToNatal[role] = natalPalaces[index].palace_key;
  });
  return {
    stem_branch: `${period.heavenly_stem}${period.earthly_branch}`,
    life_palace_maps_to: roleToNatal['命宫'] || null,
    role_to_natal: roleToNatal,
    mutagens: Object.fromEntries(['禄', '权', '科', '忌'].map((m, i) => [m, period.mutagens[i] || ''])),
  };
}

function runReport(chart, topic, preset) {
  return composeEvidenceReport({ chart, topic, report_preset: preset });
}

// 证据来源元数据：只取登记信息（标题、页码、章节），绝不读取或输出摘录正文字段。
let sourceMetaCache;
function loadSourceMeta() {
  if (sourceMetaCache) return sourceMetaCache;
  sourceMetaCache = new Map();
  const root = path.join(__dirname, '..', 'knowledge', 'ziwei', 'sources');
  for (const dir of fs.readdirSync(root)) {
    const file = path.join(root, dir, 'excerpts.jsonl');
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      sourceMetaCache.set(row.id, { title: row.title, printed_page: row.printed_page, section: row.section });
    }
  }
  return sourceMetaCache;
}

function collectEvidence(reports) {
  const meta = loadSourceMeta();
  const seen = new Set();
  const items = [];
  for (const report of reports) {
    for (const conclusion of report.conclusions) {
      for (const sourceId of conclusion.evidence_ids) {
        const key = `${conclusion.proposition_id}|${sourceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const m = meta.get(sourceId) || {};
        const item = { rule_id: conclusion.proposition_id, source_id: sourceId };
        if (typeof m.title === 'string') item.title = m.title;
        if (typeof m.printed_page === 'string' || typeof m.printed_page === 'number') item.printed_page = m.printed_page;
        if (typeof m.section === 'string') item.section = m.section;
        items.push(item);
      }
    }
  }
  return items;
}

// 取引擎各结论自带 confidence 中最保守的一档；没有结论则为 null。
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };
function deriveConfidence(reports) {
  let min = null;
  for (const report of reports) {
    for (const conclusion of report.conclusions) {
      const rank = CONFIDENCE_RANK[conclusion.confidence];
      if (rank && (min === null || rank < CONFIDENCE_RANK[min])) min = conclusion.confidence;
    }
  }
  return min;
}

/**
 * run(input) → 统一输出外层 Envelope（出错时抛带 code 的 Error，由调用方用 toFailure 转换）
 * input: { birth, mode?: 'chart'|'evidence', topic?, time_scope?, current_year?, question? }
 *   旧 mode 'natal' 视为 chart；旧 route:{topic,time_scope} 与 currentYear 仍兼容。
 *   未指定 mode 时：给了 topic 或 time_scope 为 evidence，否则 chart。
 */
function run(input = {}, { now = new Date() } = {}) {
  const inp = input && typeof input === 'object' ? input : {};
  const route = inp.route && typeof inp.route === 'object' ? inp.route : {};
  const topicIn = inp.topic !== undefined ? inp.topic : route.topic;
  const scopeIn = inp.time_scope !== undefined ? inp.time_scope : route.time_scope;
  let mode = inp.mode === 'natal' ? 'chart' : inp.mode;
  if (mode === undefined) mode = (topicIn !== undefined || scopeIn !== undefined) ? 'evidence' : 'chart';
  if (mode !== 'chart' && mode !== 'evidence') {
    throw skillError('MODE_INVALID', `mode 只能是 chart 或 evidence，收到：${mode}`);
  }
  const rawYear = inp.current_year !== undefined ? inp.current_year : inp.currentYear;
  const currentYear = Number.isFinite(Number(rawYear)) && rawYear !== undefined && rawYear !== null ? Number(rawYear) : now.getFullYear();

  const nb = parseBirth(inp.birth);
  const normalized = normalizeRoute({ topic: topicIn, time_scope: scopeIn }, currentYear);
  const profile = toProfileSnapshot(nb);

  const natalChart = runZiweiCli({ mode: 'natal', profile_snapshot: profile });
  const { natal } = natalChart;
  const evidenceMode = mode === 'evidence';

  const periods = [];
  const annualOverviews = [];
  for (const year of normalized.years) {
    // 取当年 7 月 1 日：确保落在该干支流年内（农历新年之后），避免 1–2 月仍属上一流年。
    let chart;
    try {
      chart = runZiweiCli({ mode: 'natal', profile_snapshot: profile, target_datetime: `${year}-07-01` });
    } catch (error) {
      // 运限年份早于出生或超出大限：属于调用方的时间范围问题，归为 TIME_SCOPE_INVALID 而非引擎错误
      if (error.code === 'TARGET_BEFORE_BIRTH' || error.code === 'TARGET_OUT_OF_DECADAL_RANGE') {
        throw skillError('TIME_SCOPE_INVALID', `${year} 年超出可推算范围：${error.message}`);
      }
      throw error;
    }
    const dynamic = deriveDynamicFeatureSet(chart);
    periods.push({
      year,
      target_datetime: chart.horoscope.target_datetime,
      decadal: summarizePeriod(chart.horoscope.decadal, natal.palaces),
      yearly: summarizePeriod(chart.horoscope.yearly, natal.palaces),
      dynamic_snapshots: dynamic.snapshots,
      dynamic_features: dynamic.features,
      ...(inp.options?.include_raw_horoscope ? { raw_horoscope: chart.horoscope } : {}),
    });
    if (evidenceMode) annualOverviews.push({ year, report: runReport(chart, 'overall', 'annual_overview') });
  }

  const judgments = {};
  const limitations = [];
  let evidence = [];
  let confidence = null;
  if (evidenceMode) {
    const topicReport = runReport(natalChart, normalized.topic, 'standard');
    judgments.topic_report = topicReport;
    judgments.annual_overviews = annualOverviews;
    const reports = [topicReport, ...annualOverviews.map((a) => a.report)];
    evidence = collectEvidence(reports);
    confidence = deriveConfidence(reports);
    if (topicReport.conclusions.length === 0) {
      limitations.push('该主题没有命中已审核命题，解读只能基于盘面结构推断，须如实标注。');
    }
    if (annualOverviews.length && annualOverviews.every((a) => a.report.conclusions.length === 0)) {
      limitations.push('流年层暂无已审核命题；运限部分只能读取叠宫与四化落点等确定性事实，再做标注过的推断。');
    }
  }

  const normalizedInput = { ...nb, mode, topic: normalized.topic, time_scope: normalized.time_scope, current_year: currentYear };
  if (typeof inp.question === 'string' && inp.question.trim()) normalizedInput.question = inp.question.trim();

  return ok({
    system: 'ziwei',
    mode,
    engine_version: `${natalChart.engine.library}@${natalChart.engine.library_version}`,
    ruleset: SCHEMA_VERSION,
    input: normalizedInput,
    conventions: { zi_hour: '晚子时算次日' },
    chart: {
      solar_date: natal.solar_date,
      lunar_date: natal.lunar_date,
      chinese_date: natal.chinese_date,
      five_elements_class: natal.five_elements_class,
      soul_star: natal.soul,
      body_star: natal.body,
      soul_palace_branch: natal.soul_palace_branch,
      body_palace_branch: natal.body_palace_branch,
      natal_mutagens: natal.natal_mutagens,
      board_layout: 'rows: 巳午未申 / 辰··酉 / 卯··戌 / 寅丑子亥；null 为中宫',
      board: buildBoard(natal),
      palaces: natal.palaces,
      natal_features: deriveFeatureSet(natalChart),
      periods,
    },
    judgments,
    evidence,
    confidence,
    limitations,
    warnings: [...new Set([...nb.warnings, ...(natalChart.warnings || [])])],
  });
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(run(readInput()))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(toFailure(error, {}))}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { run, buildBoard, normalizeRoute, toProfileSnapshot };
