'use strict';
/**
 * 出生信息归一（spec §7、§13 T0.1、T0.2）。
 *
 * - 时辰已知：按时辰中点排一次盘，真太阳时修正按分钟加减，跨日时日期一起进退。
 * - 时辰不详：十二个时辰各排一次，强弱与用神五行至少十组一致时采用，否则记为不定。
 *   不再用「假设午时」的假时柱。
 */

const { Solar } = require('lunar-javascript');
const { buildCompleteBaziDetail } = require('../baziCore');
const E = require('./elements');
const W = require('./weights');

// 子丑…亥 → 排盘用的钟点（与 Worker 现有约定一致）
const ZHI_MID_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function parseGender(g) {
  if (g === 'M' || g === '男' || g === 'male') return 'M';
  if (g === 'F' || g === '女' || g === 'female') return 'F';
  return null;
}

function parseDate(s) {
  const parts = String(s || '').split('-').map(Number);
  return {
    y: parts[0] || 2000,
    m: parts[1] || 1,
    d: parts[2] || 1,
  };
}

/**
 * 真太阳时修正：在出生日期时间上加减分钟，日期随之进退。
 * @returns {{ y, m, d, h, min }}
 */
function applySolarCorrection(y, m, d, h, correctionMin) {
  const ms = Date.UTC(y, m - 1, d, h, 0, 0) + Math.round(Number(correctionMin) || 0) * 60000;
  const t = new Date(ms);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    min: t.getUTCMinutes(),
  };
}

function buildDetail(dt, isMale, currentYear) {
  const solar = Solar.fromYmdHms(dt.y, dt.m, dt.d, dt.h, dt.min, 0);
  const baZi = solar.getLunar().getEightChar();
  return buildCompleteBaziDetail({
    baZi,
    yun: baZi.getYun(isMale ? 1 : 0),
    isMale,
    currentYear,
  });
}

/**
 * @param {object} profile { birth_date, hour_index, tst_correction_min, gender, name }
 * @param {object} [opts] { currentYear }
 * @returns {{ hourKnown, hourIndex, gender, name, solarTime, charts: [{ hourIndex, detail }] }}
 */
function normalizePerson(profile, opts = {}) {
  const p = profile || {};
  const currentYear = opts.currentYear || new Date().getFullYear();
  const { y, m, d } = parseDate(p.birth_date);
  const hi = Number.parseInt(p.hour_index ?? -1, 10);
  const hourKnown = Number.isInteger(hi) && hi >= 0 && hi <= 11;
  const gender = parseGender(p.gender);
  const isMale = gender === 'M';

  if (hourKnown) {
    const dt = applySolarCorrection(y, m, d, ZHI_MID_HOURS[hi], p.tst_correction_min || 0);
    return {
      hourKnown: true,
      hourIndex: hi,
      gender,
      name: p.name || '',
      solarTime: dt,
      charts: [{ hourIndex: hi, detail: buildDetail(dt, isMale, currentYear) }],
    };
  }

  // 时辰不详：十二个时辰各排一次。不做真太阳时修正，以免子时把日期推到前一天。
  const charts = ZHI_MID_HOURS.map((h, idx) => ({
    hourIndex: idx,
    detail: buildDetail({ y, m, d, h, min: 0 }, isMale, currentYear),
  }));
  return {
    hourKnown: false,
    hourIndex: -1,
    gender,
    name: p.name || '',
    solarTime: { y, m, d, h: null, min: null },
    charts,
  };
}

/** 年、月、日三柱的五行占比（百分数），不含时柱。天干记 1，藏干按本中余气 0.6/0.3/0.1 记 1。 */
function wuxingRatio3(detail) {
  const acc = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  const pillars = ((detail && detail.matrix && detail.matrix.pillars) || []).filter((pl) => pl.name !== '时');
  const HID = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
  for (const pl of pillars) {
    const gw = E.ganWuxing(pl.gan);
    if (gw) acc[gw] += 1;
    const hs = (pl.hidden_stems || []).map((h) => (typeof h === 'string' ? h : h.gan)).filter(Boolean);
    const ws = HID[hs.length] || hs.map(() => 1 / hs.length);
    hs.forEach((g, i) => {
      const wx = E.ganWuxing(g);
      if (wx) acc[wx] += ws[i];
    });
  }
  const total = Object.values(acc).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const wx of E.WUXING) out[wx] = (acc[wx] / total) * 100;
  return out;
}

/**
 * 十二组盘的稳定结论（§7）。
 * @returns {{ strongWeak, yongWuxing, stable, agree, wuxingRatio3, repIndex }}
 */
function resolveStable(charts) {
  const list = charts || [];
  if (list.length === 0) return { strongWeak: null, yongWuxing: null, stable: false, agree: 0, wuxingRatio3: null, repIndex: -1 };
  const keyOf = (c) => `${c.detail.strong_weak}|${E.yongWuxing(c.detail)}`;
  const counts = new Map();
  list.forEach((c) => counts.set(keyOf(c), (counts.get(keyOf(c)) || 0) + 1));
  let bestKey = null;
  let best = -1;
  // 按子到亥的顺序遍历，平票时取先出现者，结果与任何「默认时辰」无关
  list.forEach((c) => {
    const k = keyOf(c);
    if (counts.get(k) > best) { best = counts.get(k); bestKey = k; }
  });
  const repIndex = list.findIndex((c) => keyOf(c) === bestKey);
  const [strongWeak, yong] = bestKey.split('|');
  const stable = list.length === 1 ? true : best >= W.hourStableMin;
  return {
    strongWeak,
    yongWuxing: yong === 'null' ? null : yong,
    stable,
    agree: best,
    wuxingRatio3: wuxingRatio3(list[repIndex].detail),
    repIndex,
  };
}

/**
 * 引擎各层使用的统一视图。
 */
function toView(person) {
  const resolved = resolveStable(person.charts);
  const rep = person.charts[Math.max(0, resolved.repIndex)].detail;
  const gz = (rep.pillars && rep.pillars.ganzhi) || {};
  const ch = (s, i) => (s || '')[i] || '';
  const pillars = [
    { pos: 'year', gan: ch(gz.year, 0), zhi: ch(gz.year, 1) },
    { pos: 'month', gan: ch(gz.month, 0), zhi: ch(gz.month, 1) },
    { pos: 'day', gan: ch(gz.day, 0), zhi: ch(gz.day, 1) },
  ];
  if (person.hourKnown) pillars.push({ pos: 'time', gan: ch(gz.time, 0), zhi: ch(gz.time, 1) });

  const ratioPct = person.hourKnown ? (rep.wuxing_ratio || {}) : resolved.wuxingRatio3;
  const ratio = {};
  for (const wx of E.WUXING) ratio[wx] = (Number(ratioPct[wx]) || 0) / 100;

  const score = rep.strength_detail && Number(rep.strength_detail.total_score);
  const borderline = (rep.five_shens && rep.five_shens.yong_confidence === 'LOW')
    || (Number.isFinite(score) && score >= W.borderline.low && score <= W.borderline.high);
  const special = Array.isArray(rep.special_patterns) && rep.special_patterns.length > 0;

  return {
    name: person.name,
    gender: person.gender,
    hourKnown: person.hourKnown,
    stable: resolved.stable,
    pillars,
    dayGan: ch(gz.day, 0),
    dayZhi: ch(gz.day, 1),
    dayWx: E.ganWuxing(ch(gz.day, 0)),
    detail: rep,
    need: E.needVector(rep),
    ratio,
    strengthScore: Number.isFinite(score) ? score : 5,
    borderline,
    special,
    person,
  };
}

/** Worker 返回里 A、B 的现有字段（形态不变） */
function toCompact(person) {
  const resolved = resolveStable(person.charts);
  const rep = person.charts[Math.max(0, resolved.repIndex)].detail;
  const gz = (rep.pillars && rep.pillars.ganzhi) || {};
  const ch = (s, i) => (s || '')[i] || '';
  const known = person.hourKnown;
  return {
    dayGan: ch(gz.day, 0),
    gans: [ch(gz.year, 0), ch(gz.month, 0), ch(gz.day, 0), known ? ch(gz.time, 0) : ''],
    zhis: [ch(gz.year, 1), ch(gz.month, 1), rep.day_zhi || ch(gz.day, 1), known ? ch(gz.time, 1) : ''],
    dayZhi: rep.day_zhi || '',
    yearZhi: rep.year_zhi || '',
    monthZhi: rep.month_zhi || '',
    five_shens: rep.five_shens || {},
    wuxing_ratio: known ? (rep.wuxing_ratio || {}) : resolved.wuxingRatio3,
  };
}

module.exports = {
  ZHI_MID_HOURS,
  ZHI_ORDER,
  parseGender,
  applySolarCorrection,
  normalizePerson,
  resolveStable,
  wuxingRatio3,
  toView,
  toCompact,
};
