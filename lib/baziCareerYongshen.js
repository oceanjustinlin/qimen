'use strict';

/**
 * baziCareerYongshen.js — 事业层"制化取用"校正器（用神 Gap1 修正）
 * ──────────────────────────────────────────────────────────────────────────────
 * 背景：引擎 BaziRuleEngine.getFavorableUnfavorable 走"月令取格+扶抑"，对七杀格/伤官格
 *   常把【病神(七杀)本身】或【生病神之财】误放进喜五行（约 1/3 gold case 与原文相反，
 *   见 docs/bazi-career-golden-cases.md 用神比对）。
 *
 * 本模块【不改生产引擎】，只在事业层做校正（契合"独立新层"）：
 *   当七杀透干 → 去掉喜中的「官杀五行(病神)」「财五行(生杀)」，补「食伤(制)」「印(化)」；忌财官。
 *   当伤官透干 → 去掉喜中的「官五行(伤官见官)」，补「印(制)」「财(化)」；忌官。
 *   其余（正官/正印/财格、象法专旺）保留引擎喜忌不动（避免误伤）。
 *
 * 校验：J/SS/Z2/F 的喜五行由"与原文相反"修正为"含制神五行"，9 全对案不被破坏。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const { GAN5 } = require('./BaziConstants');

// 五行生克
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // a 生 b
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };     // a 克 b
const SHENG_REV = Object.fromEntries(Object.entries(SHENG).map(([a, b]) => [b, a])); // 生我者(印)
const KE_REV = Object.fromEntries(Object.entries(KE).map(([a, b]) => [b, a]));       // 克我者(官杀)

/**
 * @param {object} p
 * @param {string} p.dayMaster        日主天干
 * @param {string[]} p.transparentShishen  透干十神短名（picture.transparent_shishen）
 * @param {{favorable:string[], unfavorable:string[]}} p.engine  引擎喜忌五行
 * @param {boolean} [p.hasYangRen]  日主带阳刃
 * @param {string} [p.strongWeak]   日主强弱（'身强'/'身中'/'身弱'）；仅身强+阳刃才算羊刃驾杀
 * @returns {{favorable:string[], unfavorable:string[], corrected:boolean, basis:string|null}}
 */
function correctCareerYongshen({ dayMaster, transparentShishen = [], engine = {}, hasYangRen = false, strongWeak = null } = {}) {
  const dmWx = GAN5[dayMaster];
  if (!dmWx) return { favorable: engine.favorable || [], unfavorable: engine.unfavorable || [], corrected: false, basis: null };

  const shiShang = SHENG[dmWx];   // 食伤
  const yin = SHENG_REV[dmWx];    // 印
  const cai = KE[dmWx];           // 财
  const guanSha = KE_REV[dmWx];   // 官杀

  const fav = new Set(engine.favorable || []);
  const unfav = new Set(engine.unfavorable || []);
  let corrected = false;
  let basis = null;

  // 羊刃驾杀：仅【身强】+阳刃时七杀为用(制刃)，不去杀（I 任铁樵火旺阳刃用杀）。
  // 身弱+阳刃+七杀透(如 D 庚金弱)时七杀仍是攻身之病，照常去杀补制化。
  const yangRenGuard = hasYangRen && strongWeak === '身强';
  const hasQiSha = transparentShishen.includes('杀') && !yangRenGuard;
  const hasShangGuan = transparentShishen.includes('伤');

  if (hasQiSha) {
    // 七杀透：制化取用。去病神(杀)与生病神(财)，补制(食伤)化(印)。
    fav.delete(guanSha);
    fav.delete(cai);
    fav.add(shiShang);
    fav.add(yin);
    unfav.add(guanSha);
    unfav.add(cai);
    corrected = true;
    basis = '七杀透→制化取用：喜食伤(制)/印(化)，忌财(生杀)/官杀';
  } else if (hasShangGuan) {
    // 伤官透：用印制 或 财化(伤官生财)；忌官(伤官见官)。
    fav.delete(guanSha);
    fav.add(yin);
    fav.add(cai);
    unfav.add(guanSha);
    corrected = true;
    basis = '伤官透→用印(制)/财(化)，忌官(伤官见官)';
  }

  // 喜忌不重叠（喜优先）
  for (const w of fav) unfav.delete(w);

  return {
    favorable: [...fav],
    unfavorable: [...unfav],
    corrected,
    basis,
  };
}

module.exports = { correctCareerYongshen, SHENG, KE, SHENG_REV, KE_REV };
