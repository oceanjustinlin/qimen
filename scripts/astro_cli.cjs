#!/usr/bin/env node
'use strict';

/**
 * astro_cli.cjs — 西洋占星本命盘（回归黄道，默认 Placidus 宫制、平均交点）
 * ──────────────────────────────────────────────────────────────────────────────
 * 用法：
 *   echo '{"birth":{"date":"1990-05-17","time":"10:20","location":{"place":"杭州"}}}' | node scripts/astro_cli.cjs
 *   node scripts/astro_cli.cjs --file input.json
 *   node scripts/astro_cli.cjs --date 1990-05-17 --time 10:20 --place 杭州
 *   node scripts/astro_cli.cjs --date 1990-05-17 --time 10:20 --lat 40.71 --lng -74.01 --tz America/New_York --house-system whole_sign
 * 输出：统一外层（lib/cliEnvelope）；失败为 {ok:false,code,message,hint} 且退出码 1
 *
 * 与八字/紫微不同：西洋星盘不做真太阳时，而是“当地法定时间 + IANA 时区 → UTC”，再配合出生地经纬度。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { parseDateTimeNew, parseDateTimeLegacy } = require(path.join(__dirname, '..', 'lib', 'birthInput.cjs'));
const { ok, toFailure } = require(path.join(__dirname, '..', 'lib', 'cliEnvelope.cjs'));
const { buildNatalChart } = require(path.join(__dirname, '..', 'lib', 'astro', 'chart.cjs'));
const { placeForAstro } = require(path.join(__dirname, '..', 'lib', 'astro', 'places.cjs'));
const { isValidTimeZone, localToUtc, formatOffset, fmtClock } = require(path.join(__dirname, '..', 'lib', 'astro', 'time.cjs'));
const { HOUSE_SYSTEMS, HOUSE_SYSTEM_NAMES, ORB_PRESETS } = require(path.join(__dirname, '..', 'lib', 'astro', 'constants.cjs'));

const RULESET = 'astro-western-v1';
const MODES = ['chart'];
const NODES = ['mean', 'true'];
const YEAR_MIN = 1800;
const YEAR_MAX = 2200;

let engineVersion;
function getEngineVersion() {
  if (engineVersion === undefined) {
    try {
      // astronomy-engine 的 exports 不暴露 package.json，按入口文件所在目录读取
      const pkg = path.join(path.dirname(require.resolve('astronomy-engine')), 'package.json');
      engineVersion = `astronomy-engine@${JSON.parse(fs.readFileSync(pkg, 'utf8')).version}`;
    } catch {
      engineVersion = 'astronomy-engine';
    }
  }
  return engineVersion;
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const isBlank = (v) => v === undefined || v === null || v === '';

function parseClock(birth) {
  if (!isBlank(birth.calendar) && String(birth.calendar).toLowerCase() !== 'solar') {
    throw makeError('CALENDAR_UNSUPPORTED', `暂不支持${String(birth.calendar).toLowerCase() === 'lunar' ? '农历' : `历法 ${birth.calendar}`}输入，请换算为公历后再传`);
  }
  const legacy = isBlank(birth.date) && isBlank(birth.time) && !isBlank(birth.year);
  const clock = legacy ? parseDateTimeLegacy(birth) : parseDateTimeNew(birth);
  if (clock.year < YEAR_MIN || clock.year > YEAR_MAX) {
    throw makeError('DATE_OUT_OF_RANGE', `出生年份 ${clock.year} 超出支持范围（${YEAR_MIN}–${YEAR_MAX}）`);
  }
  return clock;
}

function coordinate(value, name, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw makeError('LOCATION_REQUIRED', `${name} 不是 ${min}～${max} 之间的数字：${value}`);
  }
  return n;
}

// 坐标优先；只给地名时从地名库取坐标与时区。显式 timezone 总是优先。
function resolveLocation(loc) {
  const l = loc && typeof loc === 'object' ? loc : {};
  const hasCoords = !isBlank(l.latitude) || !isBlank(l.longitude);
  let out;
  if (hasCoords) {
    if (isBlank(l.latitude) || isBlank(l.longitude)) {
      throw makeError('LOCATION_REQUIRED', '西洋星盘需要同时提供纬度 latitude 与经度 longitude（或只给出生地 place）');
    }
    out = {
      label: isBlank(l.place) ? null : String(l.place),
      latitude: coordinate(l.latitude, 'latitude', -90, 90),
      longitude: coordinate(l.longitude, 'longitude', -180, 180),
      timezone: null,
      source: 'coordinates',
    };
    if (isBlank(l.timezone) && !isBlank(l.place)) {
      // 坐标 + 地名：时区仍可从地名推出
      try { out.timezone = placeForAstro(l.place).timezone; } catch { /* 地名解析不了时要求显式时区 */ }
    }
  } else if (!isBlank(l.place)) {
    const p = placeForAstro(l.place);
    out = { ...p, source: 'birthplaces' };
  } else {
    throw makeError('LOCATION_REQUIRED', '缺少出生地：宫位与上升点需要出生地纬度。请提供 place，或 latitude + longitude + timezone');
  }
  if (!isBlank(l.timezone)) {
    if (!isValidTimeZone(String(l.timezone))) throw makeError('TIMEZONE_INVALID', `时区无效：${l.timezone}`);
    out.timezone = String(l.timezone);
  }
  if (!out.timezone) {
    throw makeError('LOCATION_REQUIRED', `无法确定出生地${out.label ? `“${out.label}”` : ''}的时区，请补充 IANA 时区 timezone（如 America/New_York）`);
  }
  return out;
}

function resolveOptions(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const house = isBlank(o.house_system) ? 'placidus' : String(o.house_system);
  if (!HOUSE_SYSTEMS.includes(house)) {
    throw makeError('HOUSE_SYSTEM_UNSUPPORTED', `不支持的宫制：${house}（可选 ${HOUSE_SYSTEMS.join(' / ')}）`);
  }
  const node = isBlank(o.node) ? 'mean' : String(o.node);
  if (!NODES.includes(node)) throw makeError('OPTION_INVALID', `node 只能是 ${NODES.join(' / ')}：${node}`);
  const orbs = isBlank(o.orbs) ? 'standard' : String(o.orbs);
  if (!Object.hasOwn(ORB_PRESETS, orbs)) throw makeError('OPTION_INVALID', `orbs 只能是 ${Object.keys(ORB_PRESETS).join(' / ')}：${orbs}`);
  return { house_system: house, node, orbs };
}

const pad2 = (n) => String(n).padStart(2, '0');

function run(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw makeError('BAD_JSON', '输入必须是 JSON 对象');
  const mode = isBlank(input.mode) ? 'chart' : String(input.mode);
  if (!MODES.includes(mode)) throw makeError('MODE_INVALID', `astro 目前只支持 mode=chart（本命盘）：${mode}`);
  const birth = input.birth && typeof input.birth === 'object' ? input.birth : null;
  if (!birth) throw makeError('BIRTH_INCOMPLETE', '缺少出生信息 birth');
  if (birth.time_basis === 'true_solar') {
    throw makeError('BIRTH_INCOMPLETE', '西洋星盘使用当地钟表时间（法定时间），不接受真太阳时；请传原始出生钟表时间');
  }

  const clock = parseClock(birth);
  const location = resolveLocation(birth.location);
  const options = resolveOptions(input.options);
  const conv = localToUtc(clock, location.timezone);
  const built = buildNatalChart({ utc: conv.utc, latitude: location.latitude, longitude: location.longitude, options });

  const warnings = [];
  if (conv.warning) warnings.push(conv.warning);
  warnings.push(...built.warnings);

  return ok({
    system: 'astro',
    mode,
    engine_version: getEngineVersion(),
    ruleset: RULESET,
    input: {
      date: `${clock.year}-${pad2(clock.month)}-${pad2(clock.day)}`,
      time: `${pad2(clock.hour)}:${pad2(clock.minute)}`,
      local: fmtClock(clock),
      timezone: location.timezone,
      utc_offset: formatOffset(conv.offset_minutes),
      utc: conv.utc.toISOString().replace('.000Z', 'Z'),
      julian_day: Number(built.frame.julian_day.toFixed(5)),
      location: {
        label: location.label,
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
      },
      options,
    },
    conventions: {
      zodiac: 'tropical（回归黄道）',
      house_system: `${built.chart.house_system}（${HOUSE_SYSTEM_NAMES[built.chart.house_system]}）`,
      node: options.node === 'mean' ? 'mean（平均交点）' : 'true（真实交点）',
      coordinates: '地心、真春分点黄道坐标（ecliptic of date）',
      time_basis: '当地法定钟表时间按 IANA 时区换算为 UTC，不做真太阳时',
      timezone_source: 'IANA tzdata（Node 内置 Intl）',
      orbs: ORB_PRESETS[options.orbs],
    },
    chart: built.chart,
    judgments: {},
    evidence: [],
    confidence: 'high',
    limitations: [
      '本工具只给天文事实与相位，不含断语库；解读必须基于盘面字段，不得自行编造度数、宫位或相位',
      '上升点与宫头对出生时间很敏感：时间每差约 4 分钟，上升点移动约 1°；出生时间不准时宫位结论要保守',
      '未计算凯龙星、莉莉丝、小行星与福点；相位只含合、六合、刑、拱、冲五种主相位',
    ],
    warnings,
  });
}

// ── 命令行入口 ──────────────────────────────────────────────────────────────
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
  if (typeof flags.file === 'string') {
    try {
      return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
    } catch (err) {
      throw makeError('BAD_JSON', `--file 无法读取或不是合法 JSON：${err.message}`);
    }
  }
  if (typeof flags.date === 'string') {
    const birth = { date: flags.date };
    if (typeof flags.time === 'string') birth.time = flags.time;
    const location = {};
    if (typeof flags.place === 'string') location.place = flags.place;
    if (typeof flags.lat === 'string') location.latitude = Number(flags.lat);
    if (typeof flags.lng === 'string') location.longitude = Number(flags.lng);
    if (typeof flags.tz === 'string') location.timezone = flags.tz;
    if (Object.keys(location).length) birth.location = location;
    const options = {};
    if (typeof flags['house-system'] === 'string') options.house_system = flags['house-system'];
    if (typeof flags.node === 'string') options.node = flags.node;
    if (typeof flags.orbs === 'string') options.orbs = flags.orbs;
    return { birth, mode: typeof flags.mode === 'string' ? flags.mode : 'chart', options };
  }
  if (process.stdin.isTTY) throw makeError('NO_INPUT', '请通过 stdin JSON、--file，或 --date/--time/--place 提供输入。');
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { raw = ''; }
  if (!raw.trim()) throw makeError('NO_INPUT', 'stdin 为空。');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw makeError('BAD_JSON', `stdin 不是合法 JSON：${err.message}`);
  }
}

function main() {
  try {
    process.stdout.write(JSON.stringify(run(buildInput()), null, 2) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify(toFailure(err, { engine_version: getEngineVersion(), input_summary: 'astro' }), null, 2) + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { run };
