'use strict';

/**
 * baziCareerPicture.js — 原局画像 extractor（框架 §1）
 * ──────────────────────────────────────────────────────────────────────────────
 * 从四柱抽出方向决策（baziCareerDirection）所需的「原局画像」：
 *   - 强弱 / 势（主导五行）
 *   - pattern_type：普通格 / 特殊格（从/专旺/化）—— 复用 baziImageAssessor
 *   - career_star_config：事业凶神（七杀/伤官/羊刃）的制化配置 —— 决定 R3 吉凶基调
 *
 * 制化判定以「透干」为准（制神须透出天干或为支中羊刃），区分：
 *   J 庚申庚辰甲戌丙寅：丙食神透 → 七杀有制（吉基调）
 *   K 甲申甲戌甲寅甲戌：火全藏不透 → 七杀无制（凶基调）
 *
 * 复用 BaziRuleEngine.calculateStrength + assessBaziImage + BaziConstants。
 * 说明：用神 / 命门字（R1'/R4 所需）依赖 baziCore 取格，留待后续集成，本模块先不产出。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const { BaziRuleEngine } = require('./BaziRuleEngine');
const { assessBaziImage } = require('./baziImageAssessor');
const { SHISHEN, ZHI5, YANG_REN } = require('./BaziConstants');

const order = ['year', 'month', 'day', 'hour'];

function splitPillars(pillars) {
  const gans = [];
  const zhis = [];
  for (const k of order) {
    const gz = pillars[k];
    if (!gz || gz.length < 2) throw new TypeError(`baziCareerPicture: 缺少有效 ${k} 柱`);
    gans.push(gz[0]);
    zhis.push(gz[1]);
  }
  return { gans, zhis };
}

/** 透干十神集合（短名）。 */
function transparentShishen(dayMaster, gans) {
  const set = new Set();
  gans.forEach((g, i) => {
    if (i === 2) return; // 日主自身不计
    const ss = SHISHEN[dayMaster] && SHISHEN[dayMaster][g];
    if (ss) set.add(ss);
  });
  return set;
}

/** 全盘十神集合（含藏干，用于"存在性"判断）。 */
function allShishen(dayMaster, gans, zhis) {
  const set = new Set();
  gans.forEach((g, i) => { if (i !== 2) { const s = SHISHEN[dayMaster]?.[g]; if (s) set.add(s); } });
  zhis.forEach((z) => {
    const hidden = ZHI5[z] || {};
    Object.keys(hidden).forEach((h) => { if (h !== dayMaster) { const s = SHISHEN[dayMaster]?.[h]; if (s) set.add(s); } });
  });
  return set;
}

/**
 * 事业凶神制化配置。
 * 七杀(杀)：有印化/食伤制/羊刃合 → controlled
 * 伤官(伤)：有印制/财化(生财) → resolved
 * 羊刃：日主阳刃在支
 */
function careerStarConfig({ dayMaster, gans, zhis, tShen, aShen }) {
  const hasYangRen = zhis.includes(YANG_REN[dayMaster]);

  // 七杀
  const has_qisha = aShen.has('杀');
  const qisha_control = {
    by_seal: tShen.has('印') || tShen.has('枭'),      // 印化杀（透）
    by_food: tShen.has('食') || tShen.has('伤'),      // 食伤制杀（透）
    by_ren: hasYangRen,                               // 羊刃合杀
  };
  const qisha_controlled = has_qisha && (qisha_control.by_seal || qisha_control.by_food || qisha_control.by_ren);

  // 伤官
  const has_shangguan = aShen.has('伤');
  const sg_resolve = {
    by_seal: tShen.has('印') || tShen.has('枭'),      // 印制伤
    by_wealth: tShen.has('财') || tShen.has('才'),    // 伤官生财（化）
  };
  const shangguan_resolved = has_shangguan && (sg_resolve.by_seal || sg_resolve.by_wealth);

  return {
    has_qisha,
    qisha_controlled,
    qisha_control,
    has_shangguan,
    shangguan_resolved,
    sg_resolve,
    has_yangren: hasYangRen,
  };
}

/**
 * 构建原局画像。
 * @param {{pillars:{year,month,day,hour}}} input
 */
function buildCareerPicture({ pillars } = {}) {
  if (!pillars) throw new TypeError('buildCareerPicture: 需要 pillars');
  const { gans, zhis } = splitPillars(pillars);
  const dayMaster = gans[2];
  const monthZhi = zhis[1];

  const strength = BaziRuleEngine.calculateStrength(dayMaster, gans, zhis);
  const image = assessBaziImage({ dayGan: dayMaster, gans, zhis, monthZhi });
  const primary = image && image.primary_candidate;
  const isSpecial = !!(primary && primary.override_normal_pattern);

  const tShen = transparentShishen(dayMaster, gans);
  const aShen = allShishen(dayMaster, gans, zhis);
  const config = careerStarConfig({ dayMaster, gans, zhis, tShen, aShen });

  return {
    day_master: dayMaster,
    strength: { strongWeak: strength.strongWeak, label: strength.strengthDetail?.band || null },
    pattern_type: isSpecial ? '特殊' : '普通',
    special_kind: isSpecial ? primary.subtype : null,
    special_category: isSpecial ? primary.category : null,
    dominant_element: strength.dominantElement,
    dominant_ratio: strength.dominantRatio,
    transparent_shishen: [...tShen],
    career_star_config: config,
  };
}

module.exports = {
  buildCareerPicture,
  transparentShishen,
  allShishen,
  careerStarConfig,
};
