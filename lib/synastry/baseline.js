'use strict';
/**
 * 第 0 层 底色：各自单盘里这类关系的基础（spec §5.1，理论文档 4.1）。
 * 复用 assessOriginalChartState，不另写规则。
 */

const { assessOriginalChartState } = require('../baziStateAssessor');
const E = require('./elements');
const { makeEvidence } = require('./evidence');

const STABILITIES = ['strong', 'stable', 'dynamic', 'buried', 'damaged'];
const STABILITY_LABEL = { strong: '强旺稳固', stable: '平稳安静', dynamic: '动荡不稳', buried: '封藏入墓', damaged: '受损变质' };

function targetSpecFor(gender, relationType) {
  if (relationType === 'romance') {
    const shishen = gender === 'M' ? ['正财', '偏财'] : gender === 'F' ? ['正官', '七杀'] : [];
    return { primary_shishen: shishen, primary_gongwei: ['日支'], extra_static_checks: [] };
  }
  return { primary_shishen: ['比肩', '劫财'], primary_gongwei: ['月柱'], extra_static_checks: [] };
}

function stabilityOf(detail, gender, relationType) {
  const need = E.needVector(detail);
  const fav = new Set(E.WUXING.filter((wx) => need[wx] > 0));
  const unfav = new Set(E.WUXING.filter((wx) => need[wx] < 0));
  try {
    const r = assessOriginalChartState({
      matrix: detail.matrix,
      targetSpec: targetSpecFor(gender, relationType),
      dayStem: E.dayGanOf(detail),
      gender: gender === 'M' ? '男' : gender === 'F' ? '女' : null,
      favorableWuxing: fav,
      unfavorableWuxing: unfav,
      geju: detail.geju || null,
    });
    return STABILITIES.includes(r.overall_stability) ? r.overall_stability : 'stable';
  } catch (e) {
    return 'stable';
  }
}

/**
 * @param {object} V toView 的结果
 * @param {'friend'|'romance'} relationType
 * @param {'A'|'B'} side 证据里这个人的位置
 * @returns {{ stability, confidence, evidence: object[] }}
 */
function assessBaseline(V, relationType = 'friend', side = 'A') {
  const charts = (V.person && V.person.charts) || [{ detail: V.detail }];
  let stability;
  let confidence = 'high';
  if (V.hourKnown || charts.length === 1) {
    stability = stabilityOf(V.detail, V.gender, relationType);
  } else {
    const counts = {};
    for (const c of charts) {
      const s = stabilityOf(c.detail, V.gender, relationType);
      counts[s] = (counts[s] || 0) + 1;
    }
    stability = STABILITIES.reduce((best, s) => ((counts[s] || 0) > (counts[best] || 0) ? s : best), 'stable');
    confidence = 'mid';
  }
  if (V.borderline || V.special) confidence = 'low';
  if (relationType === 'romance' && !V.gender) confidence = 'low';

  const who = side === 'A' ? '{A}' : '{B}';
  const what = relationType === 'romance' ? (V.gender ? '配偶星与配偶宫' : '配偶宫') : '比劫与月柱';
  const evidence = [makeEvidence({
    id: 'baseline.stability', layer: 'baseline', kind: stability,
    dir: side === 'A' ? 'A<-B' : 'B<-A',
    locus: {}, chars: {},
    basis: 'derived', confidence,
    needsHour: false,
    seed: `${who}原局里的${what}：${STABILITY_LABEL[stability]}`,
  })];
  return { stability, confidence, evidence };
}

module.exports = { assessBaseline, targetSpecFor, STABILITY_LABEL };
