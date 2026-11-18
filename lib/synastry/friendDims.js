'use strict';
/**
 * 朋友合盘五维度的投影（spec §6.2，T1.7）。
 * 五个维度的名称、顺序、每个维度两个来源的页面结构保留，来源改由证据计算。
 *
 *   d1 同频：日干原型的牵系量 / 日柱与月柱之间的合、同
 *   d2 义气：互济的正向部分 / 对方盘中我的印星是否为我所喜，加天乙贵人
 *   d3 消耗：互济的负向部分（增病、伤用）/ 落在喜用字上的冲刑害克（恒不大于 0）
 *   d4 成长：调候互济与得药 / 日干原型里的相生
 *   d5 钱财：对方盘中生我财、夺我财的力量 / 日支与月支的合冲
 *
 * 除消耗外，各来源先减去随机配对的中位数再缩放，所以人群的中位数落在 0 附近。
 */

const E = require('./elements');
const W = require('./weights');
const { evWeight } = require('./score');

let DEFAULT_NORMS = null;
function defaultNorms() {
  if (DEFAULT_NORMS) return DEFAULT_NORMS;
  try {
    DEFAULT_NORMS = require('./norms.json');
  } catch (e) {
    DEFAULT_NORMS = {};
  }
  return DEFAULT_NORMS;
}

const SOURCES = ['d1s1', 'd1s3', 'd2s1', 'd2s3', 'd3s1', 'd3s3', 'd4s1', 'd4s3', 'd5s1', 'd5s3'];
const CENTERED = new Set(['d1s1', 'd1s3', 'd2s1', 'd2s3', 'd4s1', 'd4s3', 'd5s1', 'd5s3']);

// 日干原型里的相生程度（成长来源二）
const GROWTH_BY_ARCHETYPE = { qifa: 1.0, gongyang: 0.7, xianghe: 0.3, tongdao: 0, jinghe: -0.3, jiayu: -0.6 };

const DM = new Set(['day', 'month']);
const posOf = (s) => (s ? String(s).split('.')[0] : null);
const inDayMonth = (ev) => DM.has(posOf(ev.locus.a)) && DM.has(posOf(ev.locus.b));
const isZhi = (ev) => String(ev.locus.a || '').endsWith('.zhi') && String(ev.locus.b || '').endsWith('.zhi');

const sumBy = (list, f) => list.reduce((s, x) => s + f(x), 0);
const sideBenefit = (ev, side) => ev.benefit[side];

/**
 * 原始来源量（未缩放）。views 为 { A, B } 两人的 toView 结果，钱财维度要用到占比。
 */
function rawSources(evidence, views) {
  const rt = 'friend';
  const w = (ev) => evWeight(ev, rt);
  const comp = evidence.filter((e) => e.layer === 'complement');
  const bonds = evidence.filter((e) => e.layer === 'bond');
  const archetype = evidence.find((e) => e.id === 'role.archetype');

  // d1
  const d1s1 = archetype ? archetype.tie : 0;
  const d1s3 = sumBy(bonds.filter(inDayMonth), (e) => (e.tie - e.strain) * w(e));

  // d2
  const supportKinds = new Set(['need_supply', 'daymaster_as_yong']);
  const support = (side) => Math.max(0, sumBy(comp.filter((e) => supportKinds.has(e.kind)), (e) => sideBenefit(e, side)));
  const d2s1 = (support('A') + support('B')) / 2;
  const yinFor = (Self, Other) => {
    const yinWx = E.SHENG_BY[Self.dayWx];
    return (Other.ratio[yinWx] || 0) * (Self.need[yinWx] || 0) * 3;
  };
  const tianyi = sumBy(evidence.filter((e) => e.id === 'aux.tianyi'), (e) => (e.benefit.A + e.benefit.B) * w(e));
  const d2s3 = views ? (yinFor(views.A, views.B) + yinFor(views.B, views.A)) / 2 + tianyi : tianyi;

  // d3（恒不大于 0）
  const drainKinds = new Set(['aggravate', 'harm_yong']);
  const drain = (side) => sumBy(comp, (e) => {
    const v = sideBenefit(e, side);
    if (drainKinds.has(e.kind)) return Math.min(0, v);
    if (e.kind === 'need_supply') return Math.min(0, v);
    return 0;
  });
  const d3s1 = Math.min(0, (drain('A') + drain('B')) / 2);
  const hitKinds = new Set(['chong', 'xing', 'hai', 'zixing', 'gan_ke', 'gan_ke_yy']);
  const hits = (side) => sumBy(bonds.filter((e) => hitKinds.has(e.kind)), (e) => Math.min(0, sideBenefit(e, side)) * w(e));
  const d3s3 = Math.min(0, (hits('A') + hits('B')) / 2);

  // d4
  const growKinds = new Set(['tiaohou', 'remedy']);
  const d4s1 = sumBy(comp.filter((e) => growKinds.has(e.kind)), (e) => e.benefit.A + e.benefit.B) / 2;
  const d4s3 = archetype ? (GROWTH_BY_ARCHETYPE[archetype.kind] || 0) : 0;

  // d5
  const wealthFor = (Self, Other) => {
    const caiWx = E.KE[Self.dayWx];
    const shiWx = E.SHENG[Self.dayWx];
    const biWx = Self.dayWx;
    const n = Self.need[caiWx] || 0;
    const r = Other.ratio;
    // 我以财为喜：对方的财、食伤助我，比劫夺我；我以财为忌：方向相反
    return n * ((r[caiWx] || 0) + (r[shiWx] || 0) - (r[biWx] || 0)) * 3;
  };
  const d5s1 = views ? (wealthFor(views.A, views.B) + wealthFor(views.B, views.A)) / 2 : 0;
  const d5s3 = sumBy(bonds.filter((e) => inDayMonth(e) && isZhi(e)), (e) => (e.tie - e.strain) * w(e));

  return { d1s1, d1s3, d2s1, d2s3, d3s1, d3s3, d4s1, d4s3, d5s1, d5s3 };
}

function scaleSource(key, raw, dimNorms) {
  const n = (dimNorms && dimNorms[key]) || { center: 0, p95: 1 };
  const x = CENTERED.has(key) ? raw - (n.center || 0) : raw;
  const p95 = n.p95 > 0 ? n.p95 : 1;
  return Math.max(-100, Math.min(100, (x / p95) * 90));
}

function tierOf(total, cuts) {
  const labels = W.friend.tierLabels;
  const classes = W.friend.tierClasses;
  const cs = Array.isArray(cuts) && cuts.length === labels.length - 1 ? cuts : [60, 35, 12, -5, -22, -42, -65];
  for (let i = 0; i < cs.length; i += 1) {
    if (total >= cs[i]) return { tier: labels[i], tierClass: classes[i], tierIndex: i };
  }
  return { tier: labels[labels.length - 1], tierClass: classes[classes.length - 1], tierIndex: labels.length - 1 };
}

/**
 * @param {{ evidence: object[] }} report
 * @param {{ A, B }} views
 * @param {object} [norms]
 */
function projectFriendDims(report, views, norms) {
  return projectFromSources(rawSources(report.evidence, views), norms);
}

/** 由原始来源量得到五维度、总分与称号（校准脚本也用它） */
function projectFromSources(src, norms) {
  const N = ((norms || defaultNorms()).friend) || {};
  const s = {};
  for (const k of SOURCES) s[k] = scaleSource(k, src[k], N.dims);
  const DW = W.friend.dimSourceWeights;
  const dim = (d) => s[`${d}s1`] * DW[d].s1 + s[`${d}s3`] * DW[d].s3;
  const d1 = Math.round(dim('d1'));
  const d2 = Math.round(dim('d2'));
  const d3 = Math.min(0, Math.round(dim('d3')));
  const d4 = Math.round(dim('d4'));
  const d5 = Math.round(dim('d5'));
  const TW = W.friend.totalWeights;
  const weighted = d1 * TW.d1 + d2 * TW.d2 + d3 * TW.d3 + d4 * TW.d4 + d5 * TW.d5;
  const totalScale = (N.total && N.total.p95 > 0) ? 90 / N.total.p95 : 1.25;
  const total = Math.round(Math.max(-100, Math.min(100, weighted * totalScale)));
  const t = tierOf(total, N.tierCuts);
  const r = (x) => Math.round(x);
  return {
    d1, d2, d3, d4, d5,
    total,
    tier: t.tier,
    tierClass: t.tierClass,
    tierIndex: t.tierIndex,
    raw: {
      d1: { s1: r(s.d1s1), s3: r(s.d1s3) },
      d2: { s1: r(s.d2s1), s3: r(s.d2s3) },
      d3: { s1: r(Math.min(0, s.d3s1)), s3: r(Math.min(0, s.d3s3)) },
      d4: { s1: r(s.d4s1), s3: r(s.d4s3) },
      d5: { s1: r(s.d5s1), s3: r(s.d5s3) },
    },
    // 计分页的两段条：各来源乘以维度内权重后的贡献
    parts: Object.fromEntries(['d1', 'd2', 'd3', 'd4', 'd5'].map((d) => {
      const p1 = s[`${d}s1`] * DW[d].s1;
      const p3 = s[`${d}s3`] * DW[d].s3;
      return [d, d === 'd3' ? { s1: r(Math.min(0, p1)), s3: r(Math.min(0, p3)) } : { s1: r(p1), s3: r(p3) }];
    })),
    weighted,
  };
}

module.exports = { projectFriendDims, projectFromSources, rawSources, tierOf, SOURCES, CENTERED };
