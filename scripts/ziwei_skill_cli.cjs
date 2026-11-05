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
  if (flags.file) return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
  if (flags.date && flags.time && flags.gender) {
    return {
      birth: { date: flags.date, time: flags.time, gender: flags.gender },
      question: typeof flags.question === 'string' ? flags.question : undefined,
      route: {
        topic: flags.topic || 'overall',
        time_scope: flags.year
          ? { type: flags.scope || 'cross_period', start_year: Number(flags.year), end_year: Number(flags['end-year'] || flags.year) }
          : { type: 'natal' },
      },
    };
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

// birth.time_basis = "true_solar" 表示用户给的已是真太阳时，作为校正时间传入；
// 其余情况按民用钟表时间传入，并保留引擎的 ZIWEI_USING_UNADJUSTED_PROFILE_TIME 警告。
function toProfileSnapshot(birth = {}) {
  if (!birth.date || !birth.time || !birth.gender) {
    throw skillError('BIRTH_INCOMPLETE', '紫微排盘需要公历出生日期、精确到分钟的出生时间和性别。');
  }
  const datetime = `${birth.date} ${birth.time.length === 5 ? `${birth.time}:00` : birth.time}`;
  return birth.time_basis === 'true_solar'
    ? { gender: birth.gender, birth_date: datetime, adjusted_birth_date: datetime, solar_time_mode: 'apparent' }
    : { gender: birth.gender, birth_date: datetime };
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
  try {
    return composeEvidenceReport({ chart, topic, report_preset: preset });
  } catch (error) {
    return { error: { code: error.code || 'REPORT_ERROR', message: error.message } };
  }
}

function run(input, { now = new Date() } = {}) {
  const currentYear = Number(input.currentYear) || now.getFullYear();
  const profile = input.profile_snapshot || toProfileSnapshot(input.birth);
  const route = normalizeRoute(input.route, currentYear);

  const natalChart = runZiweiCli({ mode: 'natal', profile_snapshot: profile });
  const { natal } = natalChart;

  const periods = route.years.map((year) => {
    // 取当年 7 月 1 日：确保落在该干支流年内（农历新年之后），避免 1–2 月仍属上一流年。
    const target = `${year}-07-01`;
    const chart = runZiweiCli({ mode: 'natal', profile_snapshot: profile, target_datetime: target });
    const dynamic = deriveDynamicFeatureSet(chart);
    return {
      year,
      target_datetime: chart.horoscope.target_datetime,
      decadal: summarizePeriod(chart.horoscope.decadal, natal.palaces),
      yearly: summarizePeriod(chart.horoscope.yearly, natal.palaces),
      dynamic_snapshots: dynamic.snapshots,
      dynamic_features: dynamic.features,
      annual_overview: runReport(chart, 'overall', 'annual_overview'),
      ...(input.options?.include_raw_horoscope ? { raw_horoscope: chart.horoscope } : {}),
    };
  });

  const topicReport = runReport(natalChart, route.topic, 'standard');
  const limitations = [];
  if (!topicReport.error && topicReport.conclusions.length === 0) {
    limitations.push('该主题没有命中已审核命题，解读只能基于盘面结构推断，须如实标注。');
  }
  if (periods.length && periods.every((p) => !p.annual_overview.error && p.annual_overview.conclusions.length === 0)) {
    limitations.push('流年层暂无已审核命题；运限部分只能读取叠宫与四化落点等确定性事实，再做标注过的推断。');
  }

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    engine: natalChart.engine,
    input: natalChart.input,
    question: input.question || null,
    route,
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
    },
    natal_features: deriveFeatureSet(natalChart),
    evidence: { topic_report: topicReport },
    periods,
    warnings: natalChart.warnings,
    limitations,
  };
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(run(readInput()))}\n`);
  } catch (error) {
    const code = error.code || 'ZIWEI_SKILL_ERROR';
    process.stdout.write(`${JSON.stringify({ ok: false, code, error: error.message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { run, buildBoard, normalizeRoute, toProfileSnapshot };
