'use strict';

/**
 * baziCareerScore.js — 事业 state_score 扰动（缺失项 G4·事业切片）
 * ──────────────────────────────────────────────────────────────────────────────
 * 依据 docs/bazi-career-framework-final.md §5：
 *   - direction 是一等公民（已由 baziCareerDirection 决定并经 19 例验证）。
 *   - state_score 是【派生量】：在 base_capacity 上叠加"方向 × 激活幅度"的【有限增量】。
 *   - 红线(R1/R2 评审)：扰动式叠加，绝不把大运流年当新柱重跑 calculateStrength。
 *   - 三指标 state_score / activation / volatility / confidence 互相独立。
 *
 * 因 gold case 只验方向、不验绝对分，本模块给【可辩护的单调公式】，
 * 测其性质（吉>base>凶、激活独立于方向、限幅），而非精确数值。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const clamp = (v, lo = 2, hi = 98) => Math.max(lo, Math.min(hi, v));

/** 不同触发规则的方向幅度系数（坍塌/用神破最猛，喜忌兜底最小）。 */
const RULE_MAGNITUDE = {
  R1: 1.0,
  R1prime: 1.0,
  R2: 0.9,
  R3: 0.7,
  R3b: 0.55,
  R4: 0.2,
  baseline: 0,
  none: 0.1,
};

/**
 * 先天承载 base_capacity（静态，0–100）。
 * 由事业星制化配置 + 强弱 + 格局成势 决定。纯启发式、单调、可解释。
 */
function computeBaseCapacity(picture) {
  const cfg = picture.career_star_config || {};
  let v = 50;
  const notes = [];

  // 事业星配置
  if (cfg.has_qisha) {
    if (cfg.qisha_controlled) { v += 8; notes.push('七杀有制+8'); }
    else { v -= 6; notes.push('七杀无制-6'); }
  }
  if (cfg.has_shangguan) {
    if (cfg.shangguan_resolved) { v += 6; notes.push('伤官有解+6'); }
    else { v -= 4; notes.push('伤官无解-4'); }
  }
  if (cfg.has_yangren) { v += 3; notes.push('羊刃(刚)+3'); }

  // 强弱：中和最能任官，偏枯减分
  const sw = picture.strength?.label || picture.strength?.strongWeak;
  if (sw === '中和') { v += 6; notes.push('中和+6'); }
  else if (sw === '偏强' || sw === '偏弱') { v += 2; notes.push('偏强弱+2'); }
  else if (sw === '极强' || sw === '极弱') { v -= 4; notes.push('极偏-4'); }

  // 特殊格成势：借势承载高
  if (picture.pattern_type === '特殊') { v += 8; notes.push('特殊格成势+8'); }

  return { value: clamp(v, 10, 90), notes };
}

/**
 * 激活度 activation（0–100，与方向无关）：岁运对事业星宫的触发强度。
 * 由引动条数 + 结构性事件 决定。
 */
function computeActivation(transitResult) {
  const inds = transitResult.inducements || [];
  const flags = transitResult.flags || {};
  const careerInds = inds.filter((i) => i.target && i.target.role === '事业星');
  let v = 22;
  v += Math.min(3, careerInds.length) * 16;            // 事业星引动越多越活
  v += Math.min(2, inds.length - careerInds.length) * 6; // 其它引动(禄/到位)
  if (flags.structural_collapse) v += 20;               // 坍塌是强事件
  if (flags.special_flow) v += 14;
  if (flags.yongshen_broken) v += 16;
  // 转折信号(冲提运/反吟)在 evidence 里体现，加少量
  const ev = transitResult.evidence || [];
  if (ev.some((e) => e.includes('冲提运') || e.includes('反吟'))) v += 8;
  return clamp(Math.round(v), 0, 100);
}

/**
 * 当年状态分 state_score = base_capacity ± 方向×激活幅度（扰动，带阻尼）。
 */
function computeStateScore({ base_capacity, direction, rule, activation }) {
  const mag = RULE_MAGNITUDE[rule] != null ? RULE_MAGNITUDE[rule] : 0.5;
  // 阻尼：激活越高摆幅越大，但封顶（不让单年扰动吃掉整个底盘）
  const swing = Math.round((activation / 100) * 30 * mag);
  let delta = 0;
  if (direction === '吉') delta = +swing;
  else if (direction === '凶') delta = -swing;
  else delta = 0; // 中性
  return { score: clamp(base_capacity + delta), delta, swing };
}

/** 波动度 volatility（0–100）：相对上一年的变化幅度；无上一年则由激活近似。 */
function computeVolatility({ state_score, prevScore, activation }) {
  if (typeof prevScore === 'number') {
    return clamp(Math.round(Math.abs(state_score - prevScore) * 2.2 + activation * 0.15), 0, 100);
  }
  return clamp(Math.round(activation * 0.5), 0, 100);
}

/** 置信度 confidence（0–100）：证据一致度。多条同向引动 / 星宫运限齐中 → 升。 */
function computeConfidence(transitResult, direction) {
  const inds = transitResult.inducements || [];
  const careerInds = inds.filter((i) => i.target && i.target.role === '事业星');
  let v = 45;
  v += Math.min(3, careerInds.length) * 10;
  if (direction === '吉' || direction === '凶') v += 10; // 方向明确
  if (direction === '中性') v -= 10;
  return clamp(Math.round(v), 0, 100);
}

/**
 * 综合：由 picture + transitResult(含 direction) 产出四指标。
 * @param {object} p
 * @param {object} p.picture
 * @param {object} p.transitResult  buildTransitSituation 输出（flags/inducements/evidence）
 * @param {object} p.direction      decideDirection 输出（direction/rule）
 * @param {number} [p.prevScore]    上一年 state_score（算波动）
 */
function scoreCareerNode({ picture, transitResult, direction, prevScore } = {}) {
  const base = computeBaseCapacity(picture);
  const activation = computeActivation(transitResult);
  const ss = computeStateScore({
    base_capacity: base.value,
    direction: direction.direction,
    rule: direction.rule,
    activation,
  });
  const volatility = computeVolatility({ state_score: ss.score, prevScore, activation });
  const confidence = computeConfidence(transitResult, direction.direction);
  return {
    base_capacity: base.value,
    base_notes: base.notes,
    state_score: ss.score,
    score_delta: ss.delta,
    activation,
    volatility,
    confidence,
    // 三指标分离声明（防误用）
    _independent: ['state_score 顺遂度', 'activation 触发强度', 'volatility 变化幅度', 'confidence 证据一致度'],
  };
}

module.exports = {
  computeBaseCapacity,
  computeActivation,
  computeStateScore,
  computeVolatility,
  computeConfidence,
  scoreCareerNode,
  RULE_MAGNITUDE,
};
