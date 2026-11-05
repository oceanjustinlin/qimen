#!/usr/bin/env node
'use strict';

/**
 * calendar_cli.cjs — 历法工具（公农历转换、真太阳时、节气）
 * ──────────────────────────────────────────────────────────────────────────────
 * 用法：
 *   echo '{"action":"convert","date":"1990-05-01","time":"14:00"}' | node scripts/calendar_cli.cjs
 *   node scripts/calendar_cli.cjs --file input.json
 *   node scripts/calendar_cli.cjs --action true_solar --date 1990-05-01 --time 14:00 --place 杭州
 *   node scripts/calendar_cli.cjs --action jieqi --year 2026   （或 --date 2026-02-04）
 * 输出：统一外层（lib/cliEnvelope）；失败为 {ok:false,code,message,hint} 且退出码 1
 * ──────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { Solar, Lunar } = require('lunar-javascript');
const { parseBirth } = require(path.join(__dirname, '..', 'lib', 'birthInput.cjs'));
const { ok, toFailure } = require(path.join(__dirname, '..', 'lib', 'cliEnvelope.cjs'));

const ACTIONS = ['convert', 'true_solar', 'jieqi'];
const TIMEZONE = 'Asia/Shanghai';
// lunar-javascript 节气表里首尾的几个键是大写英文
const JIEQI_ALIAS = {
  DA_XUE: '大雪', DONG_ZHI: '冬至', XIAO_HAN: '小寒', DA_HAN: '大寒', LI_CHUN: '立春', YU_SHUI: '雨水', JING_ZHE: '惊蛰',
};

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
  const hasFlags = ['action', 'date', 'time', 'place', 'longitude', 'year'].some((k) => flags[k] !== undefined);
  if (hasFlags) {
    const out = {};
    if (typeof flags.action === 'string') out.action = flags.action;
    if (typeof flags.date === 'string') out.date = flags.date;
    if (typeof flags.time === 'string') out.time = flags.time;
    if (typeof flags.year === 'string') out.year = Number(flags.year);
    const loc = {};
    if (typeof flags.place === 'string') loc.place = flags.place;
    if (typeof flags.longitude === 'string') loc.longitude = flags.longitude;
    if (Object.keys(loc).length) out.location = loc;
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
  throw makeError('NO_INPUT', '未收到输入');
}

// ── 生辰校验：复用 parseBirth，历法动作不需要性别，内部用占位值且不输出 ────────────
function parseClock(input, extra = {}) {
  const birth = parseBirth({
    date: input.date, time: input.time, gender: '男', calendar: input.calendar, ...extra,
  });
  return birth;
}

const pad2 = (n) => String(n).padStart(2, '0');

function runConvert(input) {
  const birth = parseClock(input);
  const c = birth.clock;
  const solar = Solar.fromYmdHms(c.year, c.month, c.day, c.hour, c.minute, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  ec.setSect(2); // 夜子时算当日
  return ok({
    system: 'calendar',
    mode: 'convert',
    input: { date: birth.date, time: birth.time },
    conventions: { zi_hour: '夜子时算当日', timezone: TIMEZONE },
    chart: {
      solar: `${birth.date} ${birth.time}`,
      lunar: `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      ganzhi: { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() },
    },
  });
}

function runTrueSolar(input) {
  let location = input.location;
  if (typeof location === 'string') location = { place: location };
  const loc = location && typeof location === 'object' ? location : {};
  if ((loc.longitude === undefined || loc.longitude === null || loc.longitude === '')
    && (loc.place === undefined || loc.place === null || loc.place === '')) {
    throw makeError('BIRTH_INCOMPLETE', '真太阳时换算需要出生地：请提供 location.place 或 location.longitude');
  }
  const birth = parseClock(input, { location, time_basis: 'clock' });
  return ok({
    system: 'calendar',
    mode: 'true_solar',
    input: { date: birth.date, time: birth.time, location },
    conventions: { timezone: TIMEZONE },
    chart: { solar_time: birth.solar_time },
    warnings: birth.warnings,
  });
}

function jieqiOfYear(year) {
  const merged = new Map();
  for (const y of [year - 1, year, year + 1]) {
    const table = Lunar.fromYmd(y, 1, 1).getJieQiTable();
    for (const [key, solar] of Object.entries(table)) {
      const name = JIEQI_ALIAS[key] || key;
      merged.set(`${name}|${solar.toYmdHms()}`, { name, datetime: solar.toYmdHms() });
    }
  }
  return [...merged.values()].sort((a, b) => (a.datetime < b.datetime ? -1 : 1));
}

function runJieqi(input) {
  const hasYear = input.year !== undefined && input.year !== null && input.year !== '';
  const hasDate = input.date !== undefined && input.date !== null && input.date !== '';
  if (!hasYear && !hasDate) throw makeError('BAD_JSON', 'jieqi 需要 year（如 2026）或 date（如 2026-02-04）');
  const base = { system: 'calendar', mode: 'jieqi', conventions: { timezone: TIMEZONE } };

  if (hasYear) {
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1 || year > 9999) throw makeError('BAD_JSON', `year 必须是 1–9999 的整数：${input.year}`);
    const list = jieqiOfYear(year).filter((x) => x.datetime.startsWith(`${year}-`));
    return ok({ ...base, input: { year }, chart: { jieqi: list } });
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input.date));
  if (!m) throw makeError('BAD_JSON', `date 格式应为 YYYY-MM-DD：${input.date}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== mo || probe.getUTCDate() !== d) {
    throw makeError('BAD_JSON', `date 不是合法日期：${input.date}`);
  }
  const date = `${y}-${pad2(mo)}-${pad2(d)}`;
  // 以当日 00:00:00 为基准：previous 为此刻之前（含）最近一个，next 为之后第一个
  const stamp = `${date} 00:00:00`;
  const all = [...jieqiOfYear(y - 1), ...jieqiOfYear(y), ...jieqiOfYear(y + 1)]
    .sort((a, b) => (a.datetime < b.datetime ? -1 : 1))
    .filter((x, i, arr) => i === 0 || x.datetime !== arr[i - 1].datetime || x.name !== arr[i - 1].name);
  const nextIdx = all.findIndex((x) => x.datetime >= stamp);
  if (nextIdx <= 0) throw makeError('BAD_JSON', `date 超出可查询范围：${date}`);
  return ok({
    ...base,
    input: { date },
    chart: { previous: all[nextIdx - 1], next: all[nextIdx] },
  });
}

function run(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw makeError('BAD_JSON', '输入必须是 JSON 对象');
  const { action } = input;
  if (!ACTIONS.includes(action)) {
    throw makeError('BAD_JSON', `action 缺失或无效：${action === undefined ? '缺失' : action}（可选 ${ACTIONS.join(' / ')}）`);
  }
  if (action === 'convert') return runConvert(input);
  if (action === 'true_solar') return runTrueSolar(input);
  return runJieqi(input);
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

module.exports = { run };
