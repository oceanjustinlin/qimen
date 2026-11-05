'use strict';
// 统一出生信息解析：新格式 {date,time,gender,location} 与旧格式 {year,month,day,hour,minute} 归一，
// 并复用网页端的真太阳时换算（含 1986-1991 夏令时）。

const { getSolarTimeAdjustment } = require('../src/utils/baziProfileInput.mjs');
const { searchBirthplaces } = require('../src/utils/birthplaceSearch.mjs');

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

// 与 birthplaceSearch 的 normalize 保持一致：去空白、连字符等分隔符，便于“浙江 - 杭州市”与“浙江杭州市”互认
const norm = (v) => String(v || '').trim().toLowerCase().replace(/[\s'’`·.\-–—_/|,，、]/g, '');

// 全量地名索引（空查询会按人口返回全部记录，并带 label 与 searchTokens）
let allPlaces;
const getAllPlaces = () => (allPlaces ??= searchBirthplaces('', Infinity).map((p) => ({ ...p, normLabel: norm(p.label) })));

// 区县/城市常被省略的后缀：“海淀”视同“海淀区”，“朝阳”同时视同“朝阳市”“朝阳区”“朝阳县”
const IMPLIED_SUFFIXES = ['', '区', '县', '市', '新区'];
// 省级前缀可带的后缀
const ADMIN_SUFFIXES = ['壮族自治区', '回族自治区', '维吾尔自治区', '特别行政区', '自治区', '省', '市', ''];
// 不在 admin1 中、但用户常写的省级名：地名库把港澳台合并为“港澳台”
const ADMIN_ALIASES = [
  { name: '台湾', admin1: '港澳台', filter: (p) => !/香港|澳门/.test(p.label) },
  { name: '臺灣', admin1: '港澳台', filter: (p) => !/香港|澳门/.test(p.label) },
  { name: '香港', admin1: '港澳台', filter: (p) => /香港/.test(p.label) },
  { name: '澳门', admin1: '港澳台', filter: (p) => /澳门/.test(p.label) },
];

// 港澳台记录的 city 都是“港澳台”，按 city 分组会把香港、澳门、台北并成一个地点，须改按县市名分组；
// 同名的“台北市/台北县”是相邻的同一都会区，视为同一地点（代表记录取“市”）
const placeKey = (p) => `${p.country}|${p.admin1}|${p.admin1 === '港澳台' ? String(p.county || p.name).replace(/[市县]$/, '') : (p.city || p.name)}`;

// 精确命中的记录按（国家, 省, 市）分组：同一城市下的区县视为同一地点，优先取市级记录
const pickRepresentative = (group, q) => (
  group.find((p) => p.county === p.city)
  || group.find((p) => norm(p.name) === q)
  || group.find((p) => /市$/.test(p.county || p.name))
  || group[0]
);

const groupReps = (records, q) => {
  const groups = new Map();
  for (const p of records) {
    const key = placeKey(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  // 组内按人口排序，组间按代表记录人口排序，候选列表更稳定
  return [...groups.values()]
    .map((g) => pickRepresentative(g, q))
    .sort((a, b) => (b.population || 0) - (a.population || 0));
};

// 记录的某个检索词与 q（或 q + 省略的区/县/市后缀）完全相同
const tokenExact = (records, q) => {
  const wanted = new Set(IMPLIED_SUFFIXES.map((s) => q + s));
  return records.filter((p) => p.searchTokens.some((t) => wanted.has(t)));
};

// “浙江杭州”“浙江省杭州市”“北京朝阳”“台湾台北”：剥掉省级前缀，在该省范围内重查
const adminPrefixed = (all, q) => {
  const admins = [...new Set(all.map((p) => p.admin1).filter(Boolean))]
    .map((a) => ({ name: a, admin1: a, filter: () => true }))
    .concat(ADMIN_ALIASES);
  const tries = [];
  for (const a of admins) {
    for (const suf of ADMIN_SUFFIXES) {
      const prefix = norm(a.name + suf);
      if (q.length > prefix.length && q.startsWith(prefix)) tries.push({ ...a, rest: q.slice(prefix.length), len: prefix.length });
    }
  }
  tries.sort((x, y) => y.len - x.len);
  for (const t of tries) {
    const scope = all.filter((p) => p.admin1 === t.admin1 && t.filter(p));
    const hit = tokenExact(scope, t.rest);
    if (hit.length) return { records: hit, rest: t.rest };
  }
  return null;
};

const ambiguous = (query, reps, fuzzy) => {
  const shown = reps.slice(0, MAX_CANDIDATES);
  const list = shown.map((p) => p.label).join('；');
  const message = fuzzy
    ? `出生地“${query}”无精确匹配，是否指：${list}？请确认后把候选标签原样传回，或改用经度`
    : `出生地“${query}”有 ${reps.length} 个匹配，请指明省市（可把候选标签原样传回）或改用经度：${list}`;
  return fail('PLACE_AMBIGUOUS', message, { candidates: shown.map(toCandidate) });
};

const choose = (query, q) => {
  const all = getAllPlaces();
  // 1. 标签精确匹配（含去分隔符形式）：我们自己返回的候选标签必须能原样回传
  const byLabel = all.filter((p) => p.normLabel === q);
  if (byLabel.length) return byLabel[0];

  // 2. 检索词精确匹配（含省略的区/县/市后缀）
  let records = tokenExact(all, q);
  let keyQ = q;
  // 3. 省级前缀 + 地名
  if (!records.length) {
    const pref = adminPrefixed(all, q);
    if (pref) ({ records, rest: keyQ } = pref);
  }
  // 4. 只有省级别名（如“台湾”）：列出该地区的城市
  if (!records.length) {
    const alias = ADMIN_ALIASES.find((a) => norm(a.name) === q);
    if (alias) records = all.filter((p) => p.admin1 === alias.admin1 && alias.filter(p));
  }
  if (records.length) {
    const reps = groupReps(records, keyQ);
    if (reps.length === 1) return reps[0];
    throw ambiguous(query, reps, false);
  }

  // 5. 模糊匹配：只给候选，不替用户做主
  const results = searchBirthplaces(query, 50);
  if (!results.length) throw fail('PLACE_NOT_FOUND', `查无此出生地：${query}，请改用经度（longitude）或更具体的地名`);
  const seen = new Set();
  const cands = results.filter((p) => (seen.has(p.label) ? false : seen.add(p.label)));
  throw ambiguous(query, cands, true);
};

const resolvePlace = (place) => {
  const query = String(place ?? '').trim();
  if (!query) throw fail('PLACE_NOT_FOUND', '出生地为空');
  const chosen = choose(query, norm(query));
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
