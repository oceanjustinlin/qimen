'use strict';
/**
 * 合盘引擎的五行与十神基础换算。
 * 页面 public/wrapped.html 里的 shenWx 与 compScore 的需求向量逻辑移到这里。
 */

const W = require('./weights');

const WUXING = ['金', '木', '水', '火', '土'];

const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const GAN_YANG = { 甲: true, 乙: false, 丙: true, 丁: false, 戊: true, 己: false, 庚: true, 辛: false, 壬: true, 癸: false };
// 地支阴阳（子寅辰午申戌为阳）
const ZHI_YANG = { 子: true, 丑: false, 寅: true, 卯: false, 辰: true, 巳: false, 午: true, 未: false, 申: true, 酉: false, 戌: true, 亥: false };

/** 我生 */
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 我克 */
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
/** 生我 */
const SHENG_BY = Object.fromEntries(Object.entries(SHENG).map(([a, b]) => [b, a]));
/** 克我 */
const KE_BY = Object.fromEntries(Object.entries(KE).map(([a, b]) => [b, a]));

function ganWuxing(gan) { return GAN_WX[gan] || null; }
function zhiWuxing(zhi) { return ZHI_WX[zhi] || null; }
function charWuxing(ch) { return GAN_WX[ch] || ZHI_WX[ch] || null; }
function isYangGan(gan) { return GAN_YANG[gan] === true; }

/** 由日干与十神名得到该十神的五行 */
function shenToWuxing(dayGan, shenName) {
  const dw = GAN_WX[dayGan];
  if (!dw || !shenName) return null;
  if (shenName === '比肩' || shenName === '劫财') return dw;
  if (shenName === '食神' || shenName === '伤官') return SHENG[dw];
  if (shenName === '正财' || shenName === '偏财') return KE[dw];
  if (shenName === '正官' || shenName === '七杀') return KE_BY[dw];
  if (shenName === '正印' || shenName === '偏印') return SHENG_BY[dw];
  return null;
}

/** 五行关系的十神类别：比劫 食伤 财 官杀 印 */
function relationClass(dayWx, otherWx) {
  if (!dayWx || !otherWx) return null;
  if (dayWx === otherWx) return '比劫';
  if (SHENG[dayWx] === otherWx) return '食伤';
  if (KE[dayWx] === otherWx) return '财';
  if (KE_BY[dayWx] === otherWx) return '官杀';
  if (SHENG_BY[dayWx] === otherWx) return '印';
  return null;
}

/** otherGan 对 dayGan 而言是什么十神 */
function tenGod(dayGan, otherGan) {
  const dw = GAN_WX[dayGan];
  const ow = GAN_WX[otherGan];
  if (!dw || !ow) return null;
  const same = GAN_YANG[dayGan] === GAN_YANG[otherGan];
  switch (relationClass(dw, ow)) {
    case '比劫': return same ? '比肩' : '劫财';
    case '食伤': return same ? '食神' : '伤官';
    case '财': return same ? '偏财' : '正财';
    case '官杀': return same ? '七杀' : '正官';
    case '印': return same ? '偏印' : '正印';
    default: return null;
  }
}

/**
 * 由 five_shens 得到五行的需求向量：用 +1.5、喜 +1.0、闲 0、仇 −1.0、忌 −1.3。
 * 同一五行出现在多个类别时，取绝对值最大的那个。
 * @param {object} detail buildCompleteBaziDetail 的返回值，或至少含 five_shens 与日干
 * @param {string} [dayGanOverride]
 */
function needVector(detail, dayGanOverride) {
  const dayGan = dayGanOverride || dayGanOf(detail);
  const fs = (detail && detail.five_shens) || {};
  const vec = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  const seen = {};
  const T = W.needTier;
  const add = (shen, c) => {
    const wx = shenToWuxing(dayGan, shen);
    if (!wx) return;
    if (seen[wx] == null || Math.abs(c) > Math.abs(seen[wx])) seen[wx] = c;
  };
  const list = (x) => (Array.isArray(x) ? x : (x ? [x] : []));
  list(fs.yong).forEach((s) => add(s, T.yong));
  list(fs.xi).forEach((s) => add(s, T.xi));
  list(fs.xian).forEach((s) => add(s, T.xian));
  list(fs.chou).forEach((s) => add(s, T.chou));
  list(fs.ji).forEach((s) => add(s, T.ji));
  for (const wx of WUXING) if (seen[wx] != null) vec[wx] = seen[wx];
  return vec;
}

function dayGanOf(detail) {
  const day = detail && detail.pillars && detail.pillars.ganzhi && detail.pillars.ganzhi.day;
  return (day || '')[0] || '';
}

/** 用神五行 */
function yongWuxing(detail) {
  const fs = (detail && detail.five_shens) || {};
  return shenToWuxing(dayGanOf(detail), fs.yong) || null;
}

module.exports = {
  WUXING,
  GAN_WX,
  ZHI_WX,
  GAN_YANG,
  ZHI_YANG,
  SHENG,
  KE,
  SHENG_BY,
  KE_BY,
  ganWuxing,
  zhiWuxing,
  charWuxing,
  isYangGan,
  shenToWuxing,
  relationClass,
  tenGod,
  needVector,
  dayGanOf,
  yongWuxing,
};
