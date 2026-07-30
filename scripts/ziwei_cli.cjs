#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { astro } = require('iztro');
const IZTRO_VERSION = require('iztro/package.json').version;
const { buildZiweiInput, makeZiweiError, parseLocalDateTime } = require(path.join(__dirname, '..', 'lib', 'ziweiProfileAdapter.cjs'));

const SCHEMA_VERSION = 'ziwei-cli/v1';
const MUTAGENS = ['禄', '权', '科', '忌'];

function readStdin() {
  const input = fs.readFileSync(0, 'utf8').trim();
  return input || null;
}

function parseFlags(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    flags[key] = next && !next.startsWith('--') ? next : true;
    if (flags[key] === next) index += 1;
  }
  return flags;
}

function buildInput() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.file) return JSON.parse(fs.readFileSync(flags.file, 'utf8'));

  const stdin = readStdin();
  if (stdin) {
    try {
      return JSON.parse(stdin);
    } catch (error) {
      throw makeZiweiError('BAD_JSON', `stdin 不是合法 JSON：${error.message}`);
    }
  }

  if (flags.date && flags.time && flags.gender) {
    return {
      mode: 'natal',
      profile_snapshot: {
        gender: flags.gender,
        birth_date: `${flags.date} ${flags.time}:00`,
      },
      target_datetime: flags.target || null,
      options: { include_horoscope: Boolean(flags.target) },
    };
  }

  throw makeZiweiError('PROFILE_INCOMPLETE', '请通过 stdin JSON、--file，或 --date/--time/--gender 提供出生信息。');
}

function palaceKey(name) {
  const normalized = String(name || '').trim();
  return normalized.endsWith('宫') ? normalized : `${normalized}宫`;
}

function normalizeStar(star = {}) {
  return {
    name: star.name || '',
    type: star.type || '',
    scope: star.scope || '',
    brightness: star.brightness || '',
    mutagen: star.mutagen || '',
  };
}

function buildRelations(palaceKeys, index) {
  return {
    opposite: palaceKeys[(index + 6) % 12],
    trine: [palaceKeys[(index + 4) % 12], palaceKeys[(index + 8) % 12]],
  };
}

function normalizePalaces(rawPalaces) {
  if (!Array.isArray(rawPalaces) || rawPalaces.length !== 12) {
    throw makeZiweiError('ZIWEI_CHART_INVALID', '紫微排盘未返回完整十二宫。');
  }

  const palaceKeys = rawPalaces.map((palace) => palaceKey(palace.name));
  if (new Set(palaceKeys).size !== 12) {
    throw makeZiweiError('ZIWEI_CHART_INVALID', '紫微排盘返回重复宫位。');
  }

  return rawPalaces.map((palace, index) => ({
    palace_key: palaceKeys[index],
    index,
    heavenly_stem: palace.heavenlyStem || null,
    earthly_branch: palace.earthlyBranch || null,
    is_body_palace: Boolean(palace.isBodyPalace),
    is_original_palace: Boolean(palace.isOriginalPalace),
    major_stars: (palace.majorStars || []).map(normalizeStar),
    minor_stars: (palace.minorStars || []).map(normalizeStar),
    adjective_stars: (palace.adjectiveStars || []).map(normalizeStar),
    changsheng12: palace.changsheng12 || null,
    boshi12: palace.boshi12 || null,
    jiangqian12: palace.jiangqian12 || null,
    suiqian12: palace.suiqian12 || null,
    decadal: palace.decadal ? {
      start_age: palace.decadal.range?.[0] ?? null,
      end_age: palace.decadal.range?.[1] ?? null,
      heavenly_stem: palace.decadal.heavenlyStem || null,
      earthly_branch: palace.decadal.earthlyBranch || null,
    } : null,
    ages: Array.isArray(palace.ages) ? palace.ages : [],
    relations: buildRelations(palaceKeys, index),
  }));
}

function extractNatalMutagens(palaces) {
  const mutagens = { 禄: '', 权: '', 科: '', 忌: '' };
  palaces.flatMap((palace) => [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.adjective_stars,
  ]).forEach((star) => {
    if (MUTAGENS.includes(star.mutagen)) mutagens[star.mutagen] = star.name;
  });
  return mutagens;
}

function normalizePeriod(period) {
  if (!period) return null;
  return {
    index: Number.isInteger(period.index) ? period.index : null,
    heavenly_stem: period.heavenlyStem || null,
    earthly_branch: period.earthlyBranch || null,
    palace_keys: Array.isArray(period.palaceNames) ? period.palaceNames.map(palaceKey) : [],
    mutagens: Array.isArray(period.mutagen) ? period.mutagen : [],
    stars: Array.isArray(period.stars) ? period.stars.map((stars) => stars.map(normalizeStar)) : [],
  };
}

function normalizeHoroscope(astrolabe, targetDateTime) {
  if (!targetDateTime) return null;
  const isDateOnly = /^\d{4}-\d{1,2}-\d{1,2}$/.test(targetDateTime);
  let parsed;
  try {
    parsed = parseLocalDateTime(isDateOnly ? `${targetDateTime} 00:00:00` : targetDateTime);
  } catch (_) {
    throw makeZiweiError('TARGET_DATETIME_INVALID', '运限目标时间必须为合法的 YYYY-MM-DD 或 YYYY-MM-DD HH:mm[:ss]。');
  }
  const target = isDateOnly
    ? { date_str: parsed.date_str, time_index: undefined, datetime: parsed.date_str }
    : (() => {
      const minuteOfDay = parsed.hour * 60 + parsed.minute;
      const timeIndex = minuteOfDay < 60 ? 0 : minuteOfDay >= 1380 ? 12 : Math.floor((minuteOfDay - 60) / 120) + 1;
      return { date_str: parsed.date_str, time_index: timeIndex, datetime: parsed.datetime };
    })();
  const raw = astrolabe.horoscope(target.date_str, target.time_index);
  return {
    target_datetime: target.datetime,
    decadal: normalizePeriod(raw.decadal),
    yearly: normalizePeriod(raw.yearly),
    monthly: normalizePeriod(raw.monthly),
    daily: normalizePeriod(raw.daily),
    hourly: normalizePeriod(raw.hourly),
  };
}

function buildNatalChart(input) {
  const astrolabe = astro.withOptions({
    type: 'solar',
    dateStr: input.birth.date_str,
    timeIndex: input.birth.time_index,
    gender: input.birth.gender,
    fixLeap: true,
    language: 'zh-CN',
  });
  const palaces = normalizePalaces(astrolabe.palaces);
  const soulPalace = palaces.find((palace) => palace.earthly_branch === astrolabe.earthlyBranchOfSoulPalace);
  const bodyPalaces = palaces.filter((palace) => palace.is_body_palace);
  if (!soulPalace || bodyPalaces.length !== 1) {
    throw makeZiweiError('ZIWEI_CHART_INVALID', '紫微盘缺少命宫或唯一身宫。');
  }

  return {
    astrolabe,
    natal: {
      solar_date: astrolabe.solarDate,
      lunar_date: astrolabe.lunarDate,
      chinese_date: astrolabe.chineseDate,
      five_elements_class: astrolabe.fiveElementsClass,
      soul: astrolabe.soul,
      body: astrolabe.body,
      soul_palace_branch: astrolabe.earthlyBranchOfSoulPalace,
      body_palace_branch: astrolabe.earthlyBranchOfBodyPalace,
      natal_mutagens: extractNatalMutagens(palaces),
      palaces,
    },
  };
}

function run(input) {
  const profile = input?.profile_snapshot || input?.profile;
  const normalizedInput = buildZiweiInput(profile);
  const { astrolabe, natal } = buildNatalChart(normalizedInput);
  const includeHoroscope = input?.options?.include_horoscope === true || Boolean(input?.target_datetime);
  if (includeHoroscope && !input?.target_datetime) {
    throw makeZiweiError('TARGET_DATETIME_INVALID', '请求运限快照时必须提供 target_datetime。');
  }

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    engine: {
      library: 'iztro',
      library_version: IZTRO_VERSION,
      school: 'iztro-default',
      calendar: 'solar',
      language: 'zh-CN',
      fix_leap: true,
    },
    input: {
      time_source: normalizedInput.source.time_source,
      solar_datetime: normalizedInput.birth.solar_datetime,
      time_index: normalizedInput.birth.time_index,
      time_label: normalizedInput.birth.time_label,
      gender: astrolabe.gender,
      time_correction_minutes: normalizedInput.source.time_correction_minutes,
    },
    natal,
    horoscope: includeHoroscope ? normalizeHoroscope(astrolabe, input.target_datetime) : null,
    warnings: normalizedInput.warnings,
  };
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(run(buildInput()))}\n`);
  } catch (error) {
    const code = error.code || 'ZIWEI_LIBRARY_ERROR';
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message: error.message || '紫微排盘失败。' } })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  buildNatalChart,
  normalizeHoroscope,
  normalizePalaces,
  run,
};
