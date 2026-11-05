'use strict';
// 统一出生信息解析：新格式 {date,time,gender,location} 与旧格式 {year,month,day,hour,minute} 归一，
// 并复用网页端的真太阳时换算（含 1986-1991 夏令时）。

const { getSolarTimeAdjustment } = require('../src/utils/baziProfileInput.mjs');
const { searchBirthplaces } = require('../src/utils/birthplaceSearch.mjs');

const EXACT_SCORE = 120;
const MAX_CANDIDATES = 5;
// 直接传经度时只接受东经 73°–135°（含边界）；范围外视为不支持
const CHINA_LNG_MIN = 73;
const CHINA_LNG_MAX = 135;

const fail = (code, message, extra) => {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
};

const pad2 = (n) => String(n).padStart(2, '0');

const GENDER_MAP = new Map([
  ['男', '男'], ['m', '男'], ['male', '男'], ['乾造', '男'], ['乾', '男'], ['1', '男'],
  ['女', '女'], ['f', '女'], ['female', '女'], ['坤造', '女'], ['坤', '女'], ['0', '女'],
]);

const normalizeGender = (raw) => {
  const key = String(raw ?? '').trim().toLowerCase();
  const g = GENDER_MAP.get(key);
  if (!g) throw fail('BIRTH_INCOMPLETE', `性别无法识别：${raw === undefined ? '缺失' : raw}（请用 男/女）`);
  return g;
};

// 用 Date.UTC 构造并回读，拒绝 2 月 30 日、24:00 等非法值
const buildClock = (year, month, day, hour, minute) => {
  const nums = [year, month, day, hour, minute];
  if (!nums.every((n) => Number.isInteger(n))) throw fail('BIRTH_INCOMPLETE', '出生日期或时间不是有效的整数');
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (year < 1 || year > 9999 || d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month
    || d.getUTCDate() !== day || d.getUTCHours() !== hour || d.getUTCMinutes() !== minute) {
    throw fail('BIRTH_INCOMPLETE', `出生日期时间不合法：${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`);
  }
  return { year, month, day, hour, minute };
};

const isBlank = (v) => v === undefined || v === null || v === '';

const parseDateTimeNew = (raw) => {
  if (isBlank(raw.date)) throw fail('BIRTH_INCOMPLETE', '缺少出生日期 date（格式 YYYY-MM-DD）');
  if (isBlank(raw.time)) throw fail('TIME_REQUIRED', '缺少出生时间 time（格式 HH:mm）；时辰未知无法排盘');
  const date = String(raw.date);
  const time = String(raw.time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail('BIRTH_INCOMPLETE', `出生日期格式应为 YYYY-MM-DD：${date}`);
  if (!/^\d{2}:\d{2}$/.test(time)) throw fail('BIRTH_INCOMPLETE', `出生时间格式应为 HH:mm：${time}`);
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return buildClock(y, mo, d, h, mi);
};

const parseDateTimeLegacy = (raw) => {
  if ([raw.year, raw.month, raw.day].some(isBlank)) throw fail('BIRTH_INCOMPLETE', '缺少出生年月日 year/month/day');
  if (isBlank(raw.hour)) throw fail('TIME_REQUIRED', '缺少出生时间 hour；时辰未知无法排盘');
  return buildClock(Number(raw.year), Number(raw.month), Number(raw.day), Number(raw.hour), isBlank(raw.minute) ? 0 : Number(raw.minute));
};

const toCandidate = (p) => ({ label: p.label, longitude: p.lng });

// 精确命中的记录按（省, 市）分组：同一城市下的区县视为同一地点，优先取市级记录
const pickRepresentative = (group, query) => (
  group.find((p) => p.county === p.city)
  || group.find((p) => p.name === query)
  || group[0]
);

const resolvePlace = (place) => {
  const query = String(place ?? '').trim();
  if (!query) throw fail('PLACE_NOT_FOUND', '出生地为空');
  const results = searchBirthplaces(query, 50);
  if (!results.length) throw fail('PLACE_NOT_FOUND', `查无此出生地：${query}，请改用经度（longitude）或更具体的地名`);

  const exact = results.filter((p) => p.score >= EXACT_SCORE);
  let chosen;
  if (exact.length) {
    const groups = new Map();
    for (const p of exact) {
      const key = `${p.country}|${p.admin1}|${p.city || p.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const reps = [...groups.values()].map((g) => pickRepresentative(g, query));
    if (reps.length === 1) {
      [chosen] = reps;
    } else {
      throw fail('PLACE_AMBIGUOUS', `出生地“${query}”有多个匹配，请指明省市或改用经度：${reps.slice(0, MAX_CANDIDATES).map((p) => p.label).join('；')}`,
        { candidates: reps.slice(0, MAX_CANDIDATES).map(toCandidate) });
    }
  } else {
    const seen = new Set();
    const cands = results.filter((p) => (seen.has(p.label) ? false : seen.add(p.label))).slice(0, MAX_CANDIDATES);
    throw fail('PLACE_AMBIGUOUS', `出生地“${query}”无精确匹配，是否指：${cands.map((p) => p.label).join('；')}`,
      { candidates: cands.map(toCandidate) });
  }

  if (chosen.country !== '中国') {
    throw fail('PLACE_UNSUPPORTED', `暂不支持中国以外的出生地：${chosen.label}`);
  }
  return { label: chosen.label, longitude: chosen.lng, country: chosen.country, admin1: chosen.admin1 };
};

const isHkMoTw = (admin1, label) => admin1 === '港澳台' || /香港|澳门|台湾/.test(label || '');

// 地名库把港澳台记录的 admin1 统一写成“港澳台”，而 getSolarTimeAdjustment 只认 香港/澳门/台湾，
// 不映射会被当成大陆、误扣 1986–1991 年大陆夏令时。这里按县/市名映射到它能识别的 admin1。
const solarAdmin1 = (admin1, label) => {
  if (!isHkMoTw(admin1, label)) return admin1;
  if (/香港/.test(label || '')) return '香港';
  if (/澳门|澳門/.test(label || '')) return '澳门';
  return '台湾';
};

const parseBirth = (raw) => {
  if (!raw || typeof raw !== 'object') throw fail('BIRTH_INCOMPLETE', '缺少出生信息');
  if (!isBlank(raw.calendar) && String(raw.calendar).toLowerCase() !== 'solar') {
    throw fail('CALENDAR_UNSUPPORTED', `暂不支持${String(raw.calendar).toLowerCase() === 'lunar' ? '农历' : `历法 ${raw.calendar}`}输入，请换算为公历后再传`);
  }
  const clock = isBlank(raw.date) && isBlank(raw.time) && !isBlank(raw.year)
    ? parseDateTimeLegacy(raw)
    : (!isBlank(raw.date) || !isBlank(raw.time) ? parseDateTimeNew(raw) : parseDateTimeLegacy(raw));
  const gender = normalizeGender(raw.gender);
  const timeBasis = raw.time_basis === 'true_solar' ? 'true_solar' : 'clock';
  if (!isBlank(raw.time_basis) && raw.time_basis !== 'clock' && raw.time_basis !== 'true_solar') {
    throw fail('BIRTH_INCOMPLETE', `time_basis 只能是 clock 或 true_solar：${raw.time_basis}`);
  }

  const out = {
    date: `${clock.year}-${pad2(clock.month)}-${pad2(clock.day)}`,
    time: `${pad2(clock.hour)}:${pad2(clock.minute)}`,
    gender,
    time_basis: timeBasis,
    clock,
    effective: { ...clock },
    solar_time: null,
    warnings: [],
  };

  if (timeBasis === 'true_solar') return out;

  const loc = raw.location && typeof raw.location === 'object' ? raw.location : {};
  let longitude = null;
  let placeLabel = null;
  let admin1 = '';
  if (!isBlank(loc.longitude)) {
    // 经度优先，不再解析 place
    longitude = Number(loc.longitude);
    if (!Number.isFinite(longitude)) throw fail('BIRTH_INCOMPLETE', `经度不是有效数字：${loc.longitude}`);
    if (longitude < CHINA_LNG_MIN || longitude > CHINA_LNG_MAX) {
      throw fail('PLACE_UNSUPPORTED', `经度 ${longitude} 不在中国范围内，暂不支持`);
    }
  } else if (!isBlank(loc.place)) {
    const p = resolvePlace(loc.place);
    longitude = p.longitude;
    placeLabel = p.label;
    admin1 = solarAdmin1(p.admin1, p.label);
    if (isHkMoTw(p.admin1, p.label)) out.warnings.push('港澳台历史夏令时未校正（也不套用大陆 1986–1991 年夏令时）');
  }

  if (longitude === null) {
    out.warnings.push('未提供出生地或经度，未做真太阳时校正，按钟表时间排盘（也不做夏令时）');
    return out;
  }

  const adj = getSolarTimeAdjustment({ ...clock, longitude, country: '中国', admin1, mode: 'apparent' });
  const a = adj.adjusted;
  out.effective = { year: a.year, month: a.month, day: a.day, hour: a.hour, minute: a.minute };
  out.solar_time = {
    place_label: placeLabel,
    longitude: adj.longitude,
    daylight_saving_minutes: adj.daylightSavingMinutes,
    longitude_minutes: adj.longitudeMinutes,
    equation_minutes: adj.equationMinutes,
    total_minutes: adj.totalMinutes,
    adjusted: `${a.year}-${pad2(a.month)}-${pad2(a.day)} ${pad2(a.hour)}:${pad2(a.minute)}`,
  };
  return out;
};

module.exports = { parseBirth, resolvePlace };
