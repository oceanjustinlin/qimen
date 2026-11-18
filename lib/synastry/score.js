'use strict';
/**
 * 四问与结构类型（spec §6.1，理论文档第 6 节）。
 *
 * 缘 = 归一化( Σ tie × 位置系数 × 依据系数 )
 * 和 = 100 − 归一化( Σ strain × 位置系数 × 依据系数 )
 * 益 = 按 P95 缩放( Σ benefit × 位置系数 × 依据系数 ) × 相处密度
 * 久 = 底色（同步层未开放）
 *
 * 归一化把随机配对分布的第 50 百分位映射到 50，第 95 百分位映射到 90（norms.json）。
 */

const W = require('./weights');

const SUMMED_LAYERS = new Set(['complement', 'bond', 'role', 'aux']);

let DEFAULT_NORMS = null;
function defaultNorms() {
  if (DEFAULT_NORMS) return DEFAULT_NORMS;
  try {
    // eslint-disable-next-line global-require
    DEFAULT_NORMS = require('./norms.json');
  } catch (e) {
    DEFAULT_NORMS = {};
  }
  return DEFAULT_NORMS;
}

const FALLBACK = {
  tie: { p50: 6, p95: 14 },
  strain: { p50: 4, p95: 11 },
  benefitAbs: { p50: 1.5, p95: 5 },
};

function normsFor(norms, relationType) {
  const n = (norms || defaultNorms())[relationType] || {};
  return {
    tie: n.tie || FALLBACK.tie,
    strain: n.strain || FALLBACK.strain,
    benefitAbs: n.benefitAbs || FALLBACK.benefitAbs,
  };
}

function posOf(locusPart) {
  if (!locusPart) return null;
  return String(locusPart).split('.')[0];
}

function positionCoef(ev, relationType) {
  const table = W.position[relationType] || W.position.friend;
  const ca = table[posOf(ev.locus && ev.locus.a)];
  const cb = table[posOf(ev.locus && ev.locus.b)];
  if (ev.layer !== 'bond') return 1;   // 位置系数只用于干支勾连
  if (ca && cb) return Math.sqrt(ca * cb);
  return ca || cb || 1;
}

function evWeight(ev, relationType) {
  return positionCoef(ev, relationType) * (W.basisCoef[ev.basis] ?? 1);
}

/** 原始量 */
function rawTotals(evidence, relationType) {
  let tie = 0, strain = 0, bA = 0, bB = 0;
  for (const ev of evidence) {
    if (!SUMMED_LAYERS.has(ev.layer)) continue;
    const w = evWeight(ev, relationType);
    tie += ev.tie * w;
    strain += ev.strain * w;
    bA += ev.benefit.A * w;
    bB += ev.benefit.B * w;
  }
  return { tie, strain, benefitA: bA, benefitB: bB };
}

/** P50 → 50，P95 → 90，超出 P95 后渐近 100 */
function normalize(raw, { p50, p95 }) {
  if (!(p50 > 0) || !(p95 > p50)) return 50;
  let s;
  if (raw <= p50) s = (50 * Math.max(0, raw)) / p50;
  else if (raw <= p95) s = 50 + (40 * (raw - p50)) / (p95 - p50);
  else s = 90 + 10 * (1 - Math.exp(-(raw - p95) / (p95 - p50)));
  return Math.round(Math.max(0, Math.min(100, s)));
}

/** 有正负的量：|P95| → 90 */
function scaleSigned(raw, { p95 }) {
  if (!(p95 > 0)) return 0;
  const s = (raw / p95) * 90;
  return Math.max(-100, Math.min(100, s));
}

function gradeTie(s) { return s >= W.grade.tieDeep ? '深' : s >= W.grade.tieMid ? '中' : '浅'; }
function gradeEase(s) { return s >= W.grade.easeSmooth ? '顺' : s >= W.grade.easeMid ? '有磨合' : '多摩擦'; }
function gradeSide(v) { return v >= W.grade.benefit ? '得益' : v <= -W.grade.benefit ? '受损' : '平'; }
function gradeBenefit(a, b) {
  const t = W.grade.benefit;
  if (a >= t && b >= t) return '互相';
  if (a >= t || b >= t) return '偏向一方';
  if (a <= -t || b <= -t) return '互耗';
  return '各不相干';
}
function gradeLasting(s) { return s >= W.grade.lastingStable ? '稳' : s >= W.grade.lastingMid ? '看年份' : '多变'; }

/**
 * @param {object[]} evidence
 * @param {{ A: { stability }, B: { stability } }} baselines
 * @param {'friend'|'romance'} relationType
 * @param {object} [norms] 缺省时读 norms.json
 */
function scoreFourQuestions(evidence, baselines, relationType = 'friend', norms) {
  const N = normsFor(norms, relationType);
  const raw = rawTotals(evidence, relationType);
  const density = W.density[relationType] ?? 1;

  const tieScore = normalize(raw.tie, N.tie);
  const easeScore = 100 - normalize(raw.strain, N.strain);
  const bA = Math.round(scaleSigned(raw.benefitA, N.benefitAbs) * density);
  const bB = Math.round(scaleSigned(raw.benefitB, N.benefitAbs) * density);

  const sA = W.stabilityScore[baselines && baselines.A && baselines.A.stability] ?? 60;
  const sB = W.stabilityScore[baselines && baselines.B && baselines.B.stability] ?? 60;
  const palaceClash = evidence.filter((e) => e.id === 'bond.spouse_palace.clash').length;
  const lastingScore = Math.max(0, Math.min(100, Math.round((sA + sB) / 2 - palaceClash * W.spousePalaceClashLasting)));

  return {
    tie: { score: tieScore, grade: gradeTie(tieScore) },
    ease: { score: easeScore, grade: gradeEase(easeScore) },
    benefit: { A: bA, B: bB, gradeA: gradeSide(bA), gradeB: gradeSide(bB), grade: gradeBenefit(bA, bB) },
    lasting: { score: lastingScore, grade: gradeLasting(lastingScore), available: false },
    raw,
  };
}

/**
 * 结构类型（理论文档第 6 节的表）：
 * 缘深：双向得益为相成；只有一方得益为偏济；都不得益为纠缠（牵系深却彼此无益）。
 * 缘浅：至少一方得益且没有一方受损为淡益；其余为平行。
 * 表里没写的两种组合（缘深而双方都不得益、缘浅而只有一方得益）按上面归类，
 * 依据是随机配对的分布：这样五种结构的占比都落在 5% 到 45% 之间（eval/synastry/distribution.json）。
 */
function classifyStructure(fq) {
  const t = W.grade.benefit;
  const deep = fq.tie.score >= W.grade.tieDeep;
  const a = fq.benefit.A >= t;
  const b = fq.benefit.B >= t;
  const hurt = fq.benefit.A <= -t || fq.benefit.B <= -t;
  if (deep) {
    if (a && b) return '相成';
    if (a || b) return '偏济';
    return '纠缠';
  }
  return (a || b) && !hurt ? '淡益' : '平行';
}

module.exports = {
  scoreFourQuestions,
  classifyStructure,
  rawTotals,
  normalize,
  scaleSigned,
  positionCoef,
  evWeight,
  normsFor,
};
