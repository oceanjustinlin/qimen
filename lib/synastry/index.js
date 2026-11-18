'use strict';
/**
 * 双人合盘引擎入口（spec §3、§4.2）。
 *
 *   normalizePerson ×2 → toView ×2 → 底色、互济、勾连、角色、辅证 → 四问 → 结构类型 →（朋友）五维度
 *
 * 证据 seed 与 caveats 里的 {A}、{B} 是两个人名字的占位符，用 fillNames 替换。
 */

const W = require('./weights');
const { normalizePerson, toView, toCompact } = require('./input');
const { assessBaseline } = require('./baseline');
const { assessComplement } = require('./complement');
const { scanBonds } = require('./bonds');
const { mapRoles, roleCaveats } = require('./roles');
const { collectAux } = require('./aux');
const { scoreFourQuestions, classifyStructure, evWeight } = require('./score');
const { projectFriendDims } = require('./friendDims');
const { makeEvidence, minConfidence } = require('./evidence');

const RELATION_TYPES = ['friend', 'romance'];

function normalizeRelationType(t) {
  return RELATION_TYPES.includes(t) ? t : 'friend';
}

function fillNames(text, names = {}) {
  return String(text || '')
    .replace(/\{A\}/g, names.A || '甲方')
    .replace(/\{B\}/g, names.B || '乙方');
}

function hourCaveats(V, token) {
  if (V.hourKnown) return [];
  if (V.stable) return [`${token}时辰不详，未使用时柱；喜忌取十二个时辰里一致的结论`];
  return [`${token}时辰不详，且不同时辰的喜忌不一致，以${token}为受方的结论只作参考`];
}

function overallConfidence(A, B, evidence, relationType) {
  const parts = [];
  for (const V of [A, B]) {
    if (!V.hourKnown) parts.push(V.stable ? 'mid' : 'low');
    if (V.borderline) parts.push('mid');
    if (V.special) parts.push('low');
  }
  // 主要证据（按加权量值取前八条）中 book 与 derived 的占比
  const scored = evidence
    .filter((e) => ['complement', 'bond', 'role', 'aux'].includes(e.layer))
    .map((e) => ({ e, m: (e.tie + e.strain + Math.abs(e.benefit.A) + Math.abs(e.benefit.B)) * evWeight(e, relationType) }))
    .filter((x) => x.m > 0)
    .sort((x, y) => y.m - x.m)
    .slice(0, 8);
  if (scored.length) {
    const solid = scored.filter((x) => x.e.basis === 'book' || x.e.basis === 'derived').length / scored.length;
    if (solid < 0.5) parts.push('mid');
  }
  return minConfidence(...parts);
}

/**
 * @param {{ A, B, relationType, norms }} input A、B 为 normalizePerson 的输出
 */
function buildSynastryReport({ A: pA, B: pB, relationType: rt, norms } = {}) {
  const relationType = normalizeRelationType(rt);
  const A = toView(pA);
  const B = toView(pB);

  const baseA = assessBaseline(A, relationType, 'A');
  const baseB = assessBaseline(B, relationType, 'B');

  const evidence = [
    ...baseA.evidence,
    ...baseB.evidence,
    ...assessComplement(A, B, relationType),
    ...scanBonds(A, B, relationType),
    ...mapRoles(A, B, relationType),
    ...collectAux(A, B),
  ].filter((e) => !e.needsHour || (A.hourKnown && B.hourKnown));

  const fq = scoreFourQuestions(evidence, { A: baseA, B: baseB }, relationType, norms);
  const { raw, ...fourQuestions } = fq;
  const structure = classifyStructure(fourQuestions);

  const caveats = [
    ...hourCaveats(A, '{A}'),
    ...hourCaveats(B, '{B}'),
    ...roleCaveats(A, B, relationType),
  ];
  if (A.special || B.special) caveats.push('有一方为特殊格局，喜忌的判断把握较低');

  const report = {
    engineVersion: W.engineVersion,
    relationType,
    hourKnown: { A: A.hourKnown, B: B.hourKnown },
    evidence,
    fourQuestions,
    structure,
    baseline: { A: baseA.stability, B: baseB.stability },
    confidence: overallConfidence(A, B, evidence, relationType),
    caveats,
    raw,
  };
  if (relationType === 'friend') {
    report.friendDims = projectFriendDims(report, { A, B }, norms);
  }
  return report;
}

/**
 * Worker 用：由两份出生信息得到接口返回（A、B 的现有字段不变，新增 report）。
 */
function buildCompatibilityResponse(profileA, profileB, { relationType, currentYear, norms } = {}) {
  const pA = normalizePerson(profileA, { currentYear });
  const pB = normalizePerson(profileB, { currentYear });
  const report = buildSynastryReport({ A: pA, B: pB, relationType, norms });
  return { A: toCompact(pA), B: toCompact(pB), report };
}

module.exports = {
  buildSynastryReport,
  buildCompatibilityResponse,
  normalizePerson,
  toView,
  toCompact,
  makeEvidence,
  fillNames,
  normalizeRelationType,
  RELATION_TYPES,
};
