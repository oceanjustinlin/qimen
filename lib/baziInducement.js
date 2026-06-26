'use strict';

/**
 * baziInducement.js — 广义应局 + 原身/禄引动扫描（缺失项 G2 / G3）
 * ──────────────────────────────────────────────────────────────────────────────
 * 理论依据：陆致极《八字命理动态分析教程》第八章
 *   「应局」：岁运出现原局已有的整柱 / 单干 / 单支（同字重现）→ 激活该成分。
 *   「引动」：通过「原身与禄」的干支互通，把岁运成分跨干支联系到原局成分。
 *     - 禄引动：岁运地支 = 原局某关注天干之禄（天干在地支上的延伸）。
 *     - 原身引动：岁运天干 = 原局某关注地支之本气透出（地支在天干上的延伸）。
 *
 * 命例锚点（docs/bazi-career-golden-cases.md / fixtures）：
 *   A 壬寅辛亥戊辰癸丑：丁巳运 巳=戊(日主)禄→禄引动「自身到位」；丁=正印→透干；
 *                       丁酉年 丁重现大运丁→应局_同干（激活正印）。
 *   B 甲午癸酉戊寅丁巳：戊寅运 戊=比(日主到位)；寅=甲(年干七杀)之禄→禄引动事业星；
 *                       寅亦在原局日支→应局_同支。
 *
 * 纯函数，复用 lib/BaziConstants 的 LU_SHEN / ZHI5 / SHISHEN / GAN5 / YANG_REN。
 * 事业线默认事业星 = 官杀印枭食伤；比劫单列为「日主到位 / 竞争」。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const {
  GAN5, ZHI5, SHISHEN, LU_SHEN, YANG_REN,
} = require('./BaziConstants');

// 十神短名 → 全名（SHISHEN 表用短名）
const SHISHEN_FULL = {
  比: '比肩', 劫: '劫财', 食: '食神', 伤: '伤官', 才: '偏财',
  财: '正财', 杀: '七杀', 官: '正官', 枭: '偏印', 印: '正印',
};
// 事业星（短名）
const CAREER_STARS_DEFAULT = ['官', '杀', '印', '枭', '食', '伤'];
const SELF_STARS = ['比', '劫']; // 日主同类：自身到位 / 竞争夺权

/** 十神短名：他干相对日主。 */
function shishenOf(dayMaster, otherStem) {
  const row = SHISHEN[dayMaster];
  return row ? row[otherStem] || null : null;
}

/** 地支本气天干（藏干中权重最高者）= 该支「原身」。 */
function branchMainStem(branch) {
  const hidden = ZHI5[branch];
  if (!hidden) return null;
  let best = null;
  let bestW = -1;
  for (const [stem, w] of Object.entries(hidden)) {
    if (w > bestW) { bestW = w; best = stem; }
  }
  return best;
}

function fullName(shortShishen) {
  return SHISHEN_FULL[shortShishen] || shortShishen;
}

/**
 * 构建原局「锚点」：日主 + 原局中作为事业星 / 日主同类出现的天干（含地支本气）。
 * 锚点用于禄引动（找谁的禄被岁运地支命中）。
 *
 * @returns {{
 *   dayMaster:string,
 *   anchors: Array<{stem:string, shishen:string|null, role:'日主'|'事业星'|'比劫', source:string}>,
 *   natalStems:Set<string>, natalBranches:Set<string>,
 *   careerStars:string[]
 * }}
 */
function buildCareerAnchors({ pillars, dayMaster, careerStars = CAREER_STARS_DEFAULT } = {}) {
  if (!pillars || !dayMaster) throw new TypeError('buildCareerAnchors: 需要 pillars 与 dayMaster');
  const order = ['year', 'month', 'day', 'hour'];
  const natalStems = new Set();
  const natalBranches = new Set();
  const anchorMap = new Map(); // stem -> anchor

  const addAnchor = (stem, source) => {
    if (!stem || stem === dayMaster && source !== '日主') {
      // 日主单独加；其余天干按十神归类
    }
    const ss = stem === dayMaster ? '比' : shishenOf(dayMaster, stem);
    let role = null;
    if (stem === dayMaster) role = '日主';
    else if (careerStars.includes(ss)) role = '事业星';
    else if (SELF_STARS.includes(ss)) role = '比劫';
    if (!role) return; // 非事业相关天干（财官以外）不作锚点
    if (!anchorMap.has(stem)) {
      anchorMap.set(stem, { stem, shishen: ss, role, source });
    }
  };

  for (const key of order) {
    const gz = pillars[key];
    if (!gz || gz.length < 2) continue;
    const stem = gz[0];
    const branch = gz[1];
    natalStems.add(stem);
    natalBranches.add(branch);
    addAnchor(stem, `${key}干`);
    const main = branchMainStem(branch); // 地支本气也可作事业星锚点
    if (main) addAnchor(main, `${key}支本气`);
  }
  // 日主必为锚点
  if (!anchorMap.has(dayMaster)) {
    anchorMap.set(dayMaster, { stem: dayMaster, shishen: '比', role: '日主', source: '日主' });
  }

  return {
    dayMaster,
    anchors: [...anchorMap.values()],
    natalStems,
    natalBranches,
    careerStars,
  };
}

/**
 * 扫描一个岁运干支对原局的引动。
 * @param {object} p
 * @param {ReturnType<typeof buildCareerAnchors>} p.context  buildCareerAnchors 的输出
 * @param {string} p.transitGz  岁运干支（大运或流年）
 * @param {'dayun'|'liunian'} p.layer
 * @param {string[]} [p.referenceStems]   额外「已存在字」用于应局_同干（流年扫描时传大运干支）
 * @param {string[]} [p.referenceBranches]
 * @returns {Array<object>} 引动列表
 */
function scanInducements({ context, transitGz, layer = 'dayun', referenceStems = [], referenceBranches = [] } = {}) {
  if (!context || !transitGz || transitGz.length < 2) return [];
  const { dayMaster, anchors, natalStems, natalBranches, careerStars } = context;
  const Tg = transitGz[0];
  const Tz = transitGz[1];
  const out = [];

  const refStems = new Set([...natalStems, ...referenceStems]);
  const refBranches = new Set([...natalBranches, ...referenceBranches]);
  const ss = shishenOf(dayMaster, Tg);

  // 1. 透干 / 日主到位
  if (Tg === dayMaster || SELF_STARS.includes(ss)) {
    out.push(mk('日主到位', '干', Tg, { role: '日主', stem: dayMaster, shishen: fullName(ss || '比') }, layer,
      '岁运透比劫＝日主自身到位 / 竞争'));
  } else if (careerStars.includes(ss)) {
    out.push(mk('透干引动', '干', Tg, { role: '事业星', stem: Tg, shishen: fullName(ss) }, layer,
      `岁运天干 ${Tg} 即事业星（${fullName(ss)}）透出`));
  }

  // 2. 应局_同干（重现已存在之字）—— 仅对事业相关之字
  if (refStems.has(Tg)) {
    const ss2 = Tg === dayMaster ? '比' : shishenOf(dayMaster, Tg);
    if (ss2 && (careerStars.includes(ss2) || SELF_STARS.includes(ss2) || Tg === dayMaster)) {
      out.push(mk('应局_同干', '干', Tg, { role: Tg === dayMaster ? '日主' : '事业星', stem: Tg, shishen: fullName(ss2) }, layer,
        `天干 ${Tg} 重现（${fullName(ss2)}）→ 激活`));
    }
  }

  // 3. 应局_同支（重现已存在之支）
  if (refBranches.has(Tz)) {
    out.push(mk('应局_同支', '支', Tz, { role: '原局支重现', stem: null, shishen: null }, layer,
      `地支 ${Tz} 重现 → 激活原局该支成分`));
  }

  // 4. 禄引动：岁运地支 = 某锚点天干之禄
  for (const a of anchors) {
    if (LU_SHEN[a.stem] === Tz) {
      out.push(mk('禄引动', '支', Tz, { role: a.role, stem: a.stem, shishen: fullName(a.shishen || '比') }, layer,
        `地支 ${Tz} 为 ${a.stem}（${a.role}${a.role === '日主' ? '' : '·' + fullName(a.shishen)}）之禄 → 引动`));
    }
  }

  // 5. 原身引动：岁运天干 = 某原局地支之本气透出（且该本气为事业星 / 日主）
  //    即岁运干「显化」了原局藏于地支的成分。
  for (const b of natalBranches) {
    const main = branchMainStem(b);
    if (main && main === Tg) {
      const mss = main === dayMaster ? '比' : shishenOf(dayMaster, main);
      if (mss && (careerStars.includes(mss) || main === dayMaster)) {
        out.push(mk('原身引动', '干', Tg, { role: main === dayMaster ? '日主' : '事业星', stem: main, shishen: fullName(mss) }, layer,
          `岁运天干 ${Tg} 为原局 ${b} 之本气透出 → 显化（${fullName(mss)}）`));
      }
    }
  }

  // 阳刃标记（特殊格 / R2 用）：岁运地支为日主阳刃
  if (YANG_REN[dayMaster] === Tz) {
    out.push(mk('引阳刃', '支', Tz, { role: '日主', stem: dayMaster, shishen: '阳刃' }, layer,
      `地支 ${Tz} 为日主 ${dayMaster} 之阳刃`));
  }

  return out;
}

function mk(channel, part, value, target, layer, desc) {
  return { channel, transit_part: part, value, target, layer, desc };
}

module.exports = {
  CAREER_STARS_DEFAULT,
  SELF_STARS,
  SHISHEN_FULL,
  shishenOf,
  branchMainStem,
  buildCareerAnchors,
  scanInducements,
};
