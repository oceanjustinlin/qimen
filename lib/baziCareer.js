'use strict';

/**
 * baziCareer.js — 事业线引擎顶层入口（人生轴产品消费）
 * ──────────────────────────────────────────────────────────────────────────────
 * 组合：运限(G1) + 原局画像(§1) + 引动(G2/G3) + 方向决策(§3) + 状态分(G4)。
 * 一次调用 = 评估某个大运/流年节点的事业状态。
 *
 * 模块依赖（均为本仓 lib，读现有引擎、不改问事 pipeline）：
 *   baziYunxian / baziCareerPicture / baziInducement / baziCareerDirection
 *   / baziCareerTransit / baziCareerScore
 *
 * 设计要点见 docs/bazi-career-framework-final.md：
 *   direction 为一等公民（19 例验证）；state_score 等为派生量；三指标独立。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const { getYunxian } = require('./baziYunxian');
const { assessCareerNode } = require('./baziCareerTransit');
const { scoreCareerNode } = require('./baziCareerScore');

/**
 * 评估某一事业节点（大运或流年）。
 * @param {object} p
 * @param {{year,month,day,hour}} p.pillars  原局四柱
 * @param {string} p.transitGz               岁运干支（大运或流年）
 * @param {'dayun'|'liunian'} [p.layer]
 * @param {number} [p.age]                   命主当时年龄 → 运限对位
 * @param {object} [p.hints]                 原文判断（structural_collapse/yongshen_broken/special_flow/flow/disease/favorable）
 * @param {number} [p.prevScore]             上一节点 state_score（算波动）
 * @param {string[]} [p.referenceStems]      流年扫描时并入大运干支（应局）
 * @param {string[]} [p.referenceBranches]
 * @returns {{
 *   yunxian: object|null,
 *   picture: object,
 *   direction: {direction:string, rule:string, reason:string},
 *   inducements: object[],
 *   evidence: string[],
 *   metrics: {base_capacity:number, state_score:number, activation:number, volatility:number, confidence:number}
 * }}
 */
function assessCareer({ pillars, transitGz, layer = 'dayun', age = null, hints = {}, prevScore, referenceStems = [], referenceBranches = [] } = {}) {
  const node = assessCareerNode({ pillars, transitGz, layer, hints, referenceStems, referenceBranches });
  const scores = scoreCareerNode({
    picture: node.picture,
    transitResult: node.transit,
    direction: node.direction,
    prevScore,
  });
  return {
    yunxian: age != null ? getYunxian(age) : null,
    picture: node.picture,
    direction: node.direction,
    inducements: node.transit.inducements,
    evidence: node.transit.evidence,
    metrics: {
      base_capacity: scores.base_capacity,
      state_score: scores.state_score,
      score_delta: scores.score_delta,
      activation: scores.activation,
      volatility: scores.volatility,
      confidence: scores.confidence,
    },
  };
}

module.exports = { assessCareer };
