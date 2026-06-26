'use strict';

/**
 * baziCareerTransit.js — 岁运情形 builder + 事业节点端到端（框架 §3 装配）
 * ──────────────────────────────────────────────────────────────────────────────
 * 把「原局画像 + 岁运干支」装配成 baziCareerDirection 所需的情形 flags，再出方向。
 *
 * 自动计算（不依赖引擎用神，故对 gold case 稳健）：
 *   - structural_collapse：岁运 天克地冲 月柱(提纲)/日柱，或冲拔日主禄根
 *   - star_induced / star_controlled：引动扫描(baziInducement) + 画像制化配置
 *   - 引阳刃
 * 走 hint（按"用原文用神先验框架"的决定，R1'/特殊格顺逆/去病 用 fixture 提供）：
 *   - yongshen_broken（引擎用神与原文约 1/3 相反，故 R1' 暂以原文为准）
 *   - special_flow（特殊格顺逆）、disease/flow（去病/顺逆）、favorable（喜忌兜底）
 *
 * 复用 baziYunxian.isTianKeDiChong、baziInducement、baziCareerPicture、BaziConstants。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const { isTianKeDiChong } = require('./baziYunxian');
const { buildCareerAnchors, scanInducements, branchMainStem } = require('./baziInducement');
const { buildCareerPicture } = require('./baziCareerPicture');
const { decideDirection } = require('./baziCareerDirection');
const { LU_SHEN, ZHI_CHONGS, GAN5, ZHI5, SHISHEN } = require('./BaziConstants');

/**
 * 日主通根：强根=地支本气为日主同五行；弱根=仅余气/中气同五行。
 * 纯结构，不依赖引擎用神。
 */
function dayMasterRoots(pillars, dayMaster) {
  const dmWx = GAN5[dayMaster];
  const branches = ['year', 'month', 'day', 'hour'].map((k) => pillars[k][1]);
  const strong = [];
  const weak = [];
  for (const b of branches) {
    const main = branchMainStem(b);
    if (main && GAN5[main] === dmWx) { strong.push(b); continue; }
    const hidden = ZHI5[b] || {};
    if (Object.keys(hidden).some((s) => GAN5[s] === dmWx)) weak.push(b);
  }
  return { strong, weak };
}

// 五行生克
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // a 生 b
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };     // a 克 b
const ZHUANWANG_KINDS = /润下|潤下|专旺|專旺|曲直|炎上|稼穑|稼穡|从革|從革/;

/**
 * 专旺/一气类特殊格的岁运顺逆（仅限 SINGLE_IMAGE 专旺一气；从格顺逆相反，另处理）。
 * 旺神 = dominant_element。比/印(帮旺)、食伤(泄秀) → 顺；财(被旺神夺,群劫)、官杀(克旺神) → 逆。
 */
function zhuanwangFlow(dominant, transitGan) {
  const t = GAN5[transitGan];
  if (!t || !dominant) return null;
  if (t === dominant) return 'follow';          // 比劫帮旺
  if (SHENG[t] === dominant) return 'follow';   // 印生旺神
  if (SHENG[dominant] === t) return 'follow';   // 旺神泄秀（食伤）
  if (KE[dominant] === t) return 'against';      // 旺神见财（群劫争财）
  if (KE[t] === dominant) return 'against';      // 官杀克旺神（逆）
  return null;
}

// 被引动的事业星本身即为"喜性"（引动即吉，无需另制）的十神
const FAVORABLE_STARS = new Set(['正印', '偏印', '正官', '食神']);

/** 引动是否命中"事业星"（排除日主到位 / 应局_同支这类无明确星）。 */
function inducedCareerStar(inducements) {
  for (const ind of inducements) {
    if (ind.target && ind.target.role === '事业星' && ind.target.shishen) {
      return ind.target.shishen; // 返回首个被引动的事业星十神（全名）
    }
  }
  return null;
}

/** 被引动事业星是否得制化（喜性星直接吉；七杀/伤官看配置）。 */
function isInducedStarControlled(shishen, config) {
  if (!shishen) return false;
  if (FAVORABLE_STARS.has(shishen)) return true;
  if (shishen === '七杀') return !!config.qisha_controlled;
  if (shishen === '伤官') return !!config.shangguan_resolved;
  return true; // 其余事业相关星默认得用
}

/**
 * 从原局 + 岁运装配情形 flags。
 * @param {object} p
 * @param {object} p.picture          buildCareerPicture 输出
 * @param {object} p.pillars          {year,month,day,hour}
 * @param {string} p.transitGz        岁运干支
 * @param {'dayun'|'liunian'} p.layer
 * @param {string[]} [p.referenceStems]   流年扫描时并入大运干支
 * @param {string[]} [p.referenceBranches]
 * @param {object} [p.hints]          原文判断（yongshen_broken/special_flow/disease/flow/favorable/structural_collapse）
 * @returns {{flags:object, inducements:object[], evidence:string[]}}
 */
function buildTransitSituation({ picture, pillars, transitGz, layer = 'dayun', referenceStems = [], referenceBranches = [], hints = {} } = {}) {
  if (!picture || !pillars || !transitGz) throw new TypeError('buildTransitSituation: 需要 picture/pillars/transitGz');
  const dayMaster = picture.day_master;
  const monthGz = pillars.month;
  const dayGz = pillars.day;
  const Tz = transitGz[1];
  const evidence = [];

  // 1. 结构坍塌：自动判 拔根坍塌 + 枭神夺食（纯结构，不依赖引擎用神）；连环刑冲/破用神仍走 hint。
  //    · 拔根坍塌：岁运地支(运+流年)冲净日主【全部强根】(本气同五行)，且为普通格 → 坍塌。
  //      多根则不算(C 己土丑巳午多根，冲午非坍塌)；需冲净(E 寅卯双冲、Y 申冲唯一寅根)。
  //    · 枭神夺食：身强用食泄秀，岁运透枭(偏印)克原局透出之食神 → 断枢纽(Y 壬克丙)。
  //    · 冲提运(反吟提纲)本身【不】自动凶(A 丁巳/J 丙戌反吟提纲却吉)，仅作转折信号。
  const chongTi = isTianKeDiChong(monthGz, transitGz);
  const chongRi = isTianKeDiChong(dayGz, transitGz);
  const Tg = transitGz[0];

  // 拔根坍塌
  const chongSet = new Set([Tz, ...referenceBranches]);
  const roots = dayMasterRoots(pillars, dayMaster);
  const strongChong = roots.strong.filter((r) => chongSet.has(ZHI_CHONGS[r]));
  const baGen = picture.pattern_type === '普通'
    && roots.strong.length > 0
    && strongChong.length === roots.strong.length; // 强根被冲净

  // 枭神夺食（身强用食，岁运枭克食）
  const tgShen = SHISHEN[dayMaster] && SHISHEN[dayMaster][Tg];
  const shiTransparent = ['year', 'month', 'day', 'hour']
    .some((k, i) => i !== 2 && SHISHEN[dayMaster] && SHISHEN[dayMaster][pillars[k][0]] === '食');
  const xiaoDuoShi = tgShen === '枭'
    && shiTransparent
    && (picture.strength && picture.strength.strongWeak === '身强');

  const structural_collapse = !!hints.structural_collapse || baGen || xiaoDuoShi;
  if (hints.structural_collapse) evidence.push('结构坍塌（原文判定：连环刑冲 / 破用神 / 破局）');
  if (baGen) evidence.push(`拔根坍塌：岁运冲净日主 ${dayMaster} 全部强根（${roots.strong.join('')}），普通格失依`);
  if (xiaoDuoShi) evidence.push(`枭神夺食：岁运 ${Tg}(偏印)克原局食神，身强泄秀之枢纽被断`);
  if (chongTi) evidence.push(`转折信号·冲提运：岁运 ${transitGz} 反吟月柱 ${monthGz}（吉凶随所引动成分定）`);
  if (chongRi) evidence.push(`转折信号·反吟日柱：岁运 ${transitGz} 反吟日柱 ${dayGz}`);

  // 2. 引动 + 制化（自动）
  const ctx = buildCareerAnchors({ pillars, dayMaster });
  const inducements = scanInducements({ context: ctx, transitGz, layer, referenceStems, referenceBranches });
  const inducedStar = inducedCareerStar(inducements);
  const star_induced = !!inducedStar;
  const star_controlled = star_induced ? isInducedStarControlled(inducedStar, picture.career_star_config) : false;
  if (star_induced) {
    evidence.push(`引动事业星 ${inducedStar}（${star_controlled ? '得制化/喜性' : '无制/攻身'}）`);
  }

  // 特殊格顺逆：专旺/一气类自动判定；hint 可覆盖；从格类暂仅走 hint
  let special_flow = null;
  if (picture.pattern_type === '特殊') {
    const isZhuanwang = picture.special_category === 'SINGLE_IMAGE'
      || ZHUANWANG_KINDS.test(picture.special_kind || '');
    if (hints.special_flow) {
      special_flow = hints.special_flow;
    } else if (isZhuanwang) {
      special_flow = zhuanwangFlow(picture.dominant_element, transitGz[0]);
      if (special_flow) {
        evidence.push(`特殊格(${picture.special_kind})顺逆：岁运 ${transitGz[0]}(${GAN5[transitGz[0]]}) ${special_flow === 'follow' ? '顺旺神' : '逆/夺旺神'}`);
      }
    }
  }

  const flags = {
    structural_collapse,
    yongshen_broken: !!hints.yongshen_broken,
    special_flow,
    star_induced,
    star_controlled,
    disease: hints.disease || null,
    flow: hints.flow || null,
    favorable: hints.favorable || null,
  };

  return { flags, inducements, evidence };
}

/**
 * 端到端：四柱 + 岁运 → 方向。
 * @returns {{picture, transit, direction}}
 */
function assessCareerNode({ pillars, transitGz, layer = 'dayun', referenceStems = [], referenceBranches = [], hints = {} } = {}) {
  const picture = buildCareerPicture({ pillars });
  const transit = buildTransitSituation({ picture, pillars, transitGz, layer, referenceStems, referenceBranches, hints });
  const direction = decideDirection(picture, transit.flags);
  return { picture, transit, direction };
}

module.exports = {
  buildTransitSituation,
  assessCareerNode,
  inducedCareerStar,
  isInducedStarControlled,
};
