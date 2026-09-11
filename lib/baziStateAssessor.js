'use strict';

/**
 * 原局状态评估器
 *
 * 给定四柱矩阵 + TargetSpec，输出目标元素在原局中的完整状态报告。
 *
 * 理论依据（陆致极"星宫同参"）：
 * - 星（十神）独立评估：位置、旺衰、所受关系
 * - 宫（宫位）独立评估：宫内坐什么、宫位本身受什么关系——宫被冲克独立有效
 * - 宫内十神如果是比劫，即"鸠占鹊巢"，额外标记为不利
 * - 最终 base_state = 星状态 + 宫状态综合，用于 Step3 动态分析的起点
 */

const C = require('./constants/core');
const { getDiShi } = require('./BaziRuleEngine');
const { assessGanContext, branchVigor, monthElementState, MODEL_NOTE } = require('./baziElementState');
const {
  scanZhiRelations,
  scanGanRelations,
  isGanInTomb,
  isBranchTombFor,
  getGaitouJiejiao,
  GAITOU_JIEJIAO_NOTE,
  ELEMENT_TOMB,
} = require('./baziRelationScanner');
const { strengthTier, STRENGTH_TIER_LABEL } = require('./constants/relationStrength');

// ─────────────────────────────────────────────────────────────
// 十神名称标准化（长→短）
// core.js SHISHEN 表用单字短形；targetElement.js 用全称
// ─────────────────────────────────────────────────────────────

const SHISHEN_LONG_TO_SHORT = {
  '比肩': '比', '劫财': '劫', '食神': '食', '伤官': '伤',
  '正财': '财', '偏财': '才', '正官': '官', '七杀': '杀',
  '正印': '印', '偏印': '枭',
};

/** 将一组十神名称统一转换为 core.js SHISHEN 短形 */
function normalizeShishens(arr) {
  return arr.map(s => SHISHEN_LONG_TO_SHORT[s] ?? s);
}

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────

/** 十二长生阶段工程评分；不是古籍定量或全局旺衰。 */
const PHASE_SCORE = {
  帝旺: 4, 临官: 4, 长生: 3, 冠带: 3,
  沐浴: 2, 养: 2, 胎: 2,
  衰: 2, 病: 1, 死: 1, 墓: 1, 绝: 1,
};

function phaseScore(phase) { return PHASE_SCORE[phase] ?? 2; }

/** 从 hidden_stems 元素（可能是 { gan, shi_shen } 对象，也可能是字符串）提取天干字符串 */
function toGanStr(stemOrObj) {
  return typeof stemOrObj === 'string' ? stemOrObj : (stemOrObj?.gan ?? '');
}

/** 根据日干和目标干计算十神（从矩阵 pillars 拿，兜底用五行推） */
function getShishenLabel(dayStem, targetStem) {
  // 直接用 core.js 的 SHISHEN 矩阵
  return C.SHISHEN?.[dayStem]?.[targetStem] ?? '';
}

/** 找出某个宫位名对应的 pillar 对象 */
function findPillarByName(pillars, name) {
  // name 如 '日支' → pillar.name === '日'
  const pillarName = name.replace('支', '').replace('柱', '');
  return pillars.find(p => p.name === pillarName);
}

/** 从宫位字符串提取柱名（'日支' → '日'，'月柱' → '月'） */
function gongweiToPillarName(gongwei) {
  return gongwei.replace(/[支柱]/g, '');
}

// ─────────────────────────────────────────────────────────────
// 十神在命盘中的定位
// ─────────────────────────────────────────────────────────────

/**
 * 在四柱中找到所有匹配 primary_shishen 的位置
 * 检查天干、地支主气十神、藏干十神
 *
 * @returns {ShishenLocation[]}
 */
function locateShishen(pillars, targetShishens, dayStem) {
  const results = [];

  for (const pillar of pillars) {
    // 天干
    const ganSS = getShishenLabel(dayStem, pillar.gan);
    if (targetShishens.includes(ganSS)) {
      results.push({
        pillar: pillar.name,
        position: 'gan',
        gan: pillar.gan,
        zhi: pillar.zhi,
        is_kong: pillar.is_kong ?? false,
        shishen: ganSS,
        element: C.GAN5[pillar.gan],
      });
    }

    // 地支主气十神（通过 zizuo / hidden_stems 中主气）
    const mainGan = toGanStr(pillar.hidden_stems?.[0]);
    if (mainGan) {
      const zhiSS = getShishenLabel(dayStem, mainGan);
      if (targetShishens.includes(zhiSS)) {
        results.push({
          pillar: pillar.name,
          position: 'zhi_main',
          gan: mainGan,
          zhi: pillar.zhi,
          is_kong: pillar.is_kong ?? false,
          shishen: zhiSS,
          element: C.GAN5[mainGan],
        });
      }
    }

    // 藏干（余气/中气）
    for (const hgRaw of (pillar.hidden_stems ?? []).slice(1)) {
      const hg = toGanStr(hgRaw);
      if (!hg) continue;
      const hSS = getShishenLabel(dayStem, hg);
      if (targetShishens.includes(hSS)) {
        results.push({
          pillar: pillar.name,
          position: 'hidden',
          gan: hg,
          zhi: pillar.zhi,
          is_kong: pillar.is_kong ?? false,
          shishen: hSS,
          element: C.GAN5[hg],
        });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// 单个十神位置的完整评估
// ─────────────────────────────────────────────────────────────

function assessOneShishen({ loc, pillars, dayStem, monthZhi }) {
  const { pillar, position, gan, zhi, is_kong, shishen, element } = loc;

  const context = assessGanContext(gan, zhi, pillars, monthZhi, is_kong);
  const phase = context.twelve_phase;
  const dayStemPhase = getDiShi(dayStem, zhi);
  // 盖头截脚描述实际透干与坐支，不把藏干虚拟成另一根柱。
  const gtj = position === 'gan' ? getGaitouJiejiao(gan, zhi) : 'neutral';
  const vigor = context.vigor;

  const score = phaseScore(phase);
  const inTomb = isGanInTomb(gan, zhi);

  // 关系扫描（天干和地支两个维度）
  const zhiRels = scanZhiRelations({
    targetZhi: zhi, targetPillar: pillar, targetIsKong: is_kong,
    dayStem, pillars, monthZhi,
  });
  const ganRels = scanGanRelations({
    targetGan: gan, targetPillar: pillar,
    dayStem, monthZhi, pillars,
  });
  const relationships = [...ganRels, ...zhiRels];

  // 状态标签
  const tags = new Set();

  tags.add(phase);
  if (is_kong) tags.add('空亡');
  if (inTomb) tags.add('入墓');
  tags.add(context.has_root ? '有根' : '无根');

  if (gtj === 'jiejiao') tags.add('截脚');
  else if (gtj === 'gaitou') tags.add('盖头');

  for (const r of relationships) {
    if (r.strength_tier === 'latent') continue; // 潜伏级不影响标签
    if (r.type === '六冲') tags.add(r.clash_direction === 'loses' ? '被冲' : '冲他支');
    if (r.type.includes('刑')) tags.add('被刑');
    if (r.type === '六害') tags.add('被害');
    if (r.type === '破') tags.add('被破');
    if (r.type.includes('合_化')) tags.add('被合化');
    if (r.type.includes('合_不化') || r.type === '天干五合_不化') tags.add('合而不化');
    if (r.type === '三合' || r.type === '三会') tags.add('合局');
    if (r.type === '暗合') tags.add('暗合');
  }

  // 断语
  const verdict = buildShishenVerdict({ shishen, phase, tags, relationships, gtj, inTomb, context });

  return {
    shishen,
    pillar,
    position,
    gan,
    zhi,
    element,
    ...context,
    twelve_phase: phase,
    twelve_phase_for_dayStem: dayStemPhase,
    phase_score: score,
    vigor: Math.round(vigor * 100) / 100,
    is_kong,
    is_in_tomb: inTomb,
    gaitou_jiejiao: gtj,
    gaitou_jiejiao_note: GAITOU_JIEJIAO_NOTE[gtj],
    relationships,
    status_tags: [...tags],
    verdict,
  };
}

function buildShishenVerdict({ shishen, phase, tags, relationships, gtj, inTomb, context }) {
  const parts = [`${shishen}自坐十二长生为${phase}，月令五行状态为${context.month_element_state}`];
  parts.push(context.has_root
    ? `四柱藏干见根（${context.roots.map(r => `${r.pillar}支${r.zhi}藏${r.gan}`).join('、')}），根气是否受损须合看刑冲合化`
    : '四柱藏干未见同五行根气，仍须查生扶制化');
  if (tags.has('空亡')) parts.push('所在支逢空亡，不能据此抹去藏干根气');
  if (gtj === 'jiejiao' || gtj === 'gaitou') parts.push(GAITOU_JIEJIAO_NOTE[gtj]);

  const strongRels = relationships.filter(r => r.effective_strength >= 25);
  for (const r of strongRels.slice(0, 3)) {
    parts.push(r.note);
  }

  return parts.join('；');
}

// ─────────────────────────────────────────────────────────────
// 宫位独立评估（核心：与十神是否在宫无关）
// ─────────────────────────────────────────────────────────────

function assessGongwei({ gongwei, pillar, targetShishens, targetElement, pillars, dayStem, monthZhi }) {
  const zhi = pillar.zhi;
  const is_kong = pillar.is_kong ?? false;
  const phase = getDiShi(dayStem, zhi);
  const vigor = branchVigor(zhi, monthZhi, is_kong);

  // 宫内坐的十神（pillar.zizuo 或从隐藏天干推算）
  const seatGan = toGanStr(pillar.hidden_stems?.[0]);
  const seatShishen = seatGan ? getShishenLabel(dayStem, seatGan) : '';
  const seatElement = seatGan ? C.GAN5[seatGan] : '';

  // 宫内是否是目标十神自己（得正）
  const isCorrectStar = targetShishens.includes(seatShishen);

  // 宫内是否是"鸠占鹊巢"：比肩/劫财占据妻宫/财宫（短形）
  const HOSTILE_IN_PALACE = ['比', '劫'];
  const isHostileOccupied = HOSTILE_IN_PALACE.includes(seatShishen);

  // 宫位是否是目标五行的墓库
  const isTombForTarget = targetElement ? isBranchTombFor(zhi, targetElement) : false;

  // 宫位与其他支的关系扫描
  const relationships = scanZhiRelations({
    targetZhi: zhi, targetPillar: pillar.name, targetIsKong: is_kong,
    dayStem, pillars, monthZhi,
  });

  // 状态标签
  const tags = new Set();
  if (isTombForTarget) tags.add('宫位入墓');
  if (is_kong) tags.add('空亡');
  if (isHostileOccupied) tags.add('鸠占鹊巢');
  if (isCorrectStar) tags.add('星宫得正');

  let hasSignificantClash = false;
  for (const r of relationships) {
    if (r.strength_tier === 'latent') continue;
    if (r.type === '六冲') { tags.add('宫位受冲'); hasSignificantClash = true; }
    if (r.type.includes('刑')) { tags.add('宫位受刑'); hasSignificantClash = true; }
    if (r.type === '六害') { tags.add('宫位受害'); hasSignificantClash = true; }
    if (r.type.includes('合_化')) tags.add('宫位被合化');
    if (r.type.includes('合_不化')) tags.add('宫位被合');
    if (r.type === '三合' || r.type === '三会') tags.add('宫位入局');
    if (r.type === '半三合') tags.add('宫位半合');
  }

  if (!hasSignificantClash && !tags.has('宫位入墓') && !is_kong) tags.add('宫位稳固');

  const verdict = buildGongweiVerdict({ gongwei, zhi, phase, tags, seatShishen, relationships, isTombForTarget });

  return {
    gongwei,
    pillar_name: pillar.name,
    zhi,
    element: C.ZHI_WUHANGS[zhi],
    twelve_phase_for_dayStem: phase,
    month_element_state: monthElementState(C.ZHI_WUHANGS[zhi], monthZhi),
    vigor_basis: 'branch_month_element_proxy',
    model_note: MODEL_NOTE,
    vigor: Math.round(vigor * 100) / 100,
    is_kong,
    seat_shishen: seatShishen,       // 宫内实际坐的十神
    seat_element: seatElement,
    is_correct_star: isCorrectStar,  // 星宫得正（目标十神刚好在目标宫位）
    is_hostile_occupied: isHostileOccupied,  // 鸠占鹊巢
    is_tomb_for_target: isTombForTarget,
    relationships,
    status_tags: [...tags],
    verdict,
  };
}

function buildGongweiVerdict({ gongwei, zhi, phase, tags, seatShishen, relationships, isTombForTarget }) {
  const parts = [];

  if (tags.has('星宫得正')) parts.push(`${gongwei}（${zhi}）星宫得正，目标十神居于本位，力量加倍`);
  else if (tags.has('鸠占鹊巢')) parts.push(`${gongwei}（${zhi}）坐${seatShishen}，鸠占鹊巢，对目标六亲不利`);
  else parts.push(`${gongwei}（${zhi}）坐${seatShishen || '—'}`);

  if (isTombForTarget) parts.push('宫位本身是目标五行的墓库（藏而不显）');
  if (tags.has('空亡')) parts.push('空亡，宫位力量大减');
  if (tags.has('宫位稳固')) parts.push('宫位安静稳固');

  const strongRels = relationships.filter(r => r.effective_strength >= 25);
  for (const r of strongRels.slice(0, 3)) parts.push(r.note);

  return parts.join('；');
}

// ─────────────────────────────────────────────────────────────
// 格局层静态特征检查
// ─────────────────────────────────────────────────────────────

/** 静态检查规则表：key = extra_static_checks 中的字符串 */
const STATIC_CHECK_RULES = {
  '妻宫双现（日支与月/时支相同）→ 多婚象': ({ pillars }) => {
    const riZhi = pillars.find(p => p.name === '日')?.zhi;
    return !!riZhi && pillars.some(p => p.name !== '日' && p.name !== '年' && p.zhi === riZhi);
  },
  '妻星入墓（财星藏于丑/戌/未/辰且无刑冲开墓）→ 晚婚/难婚': ({ pillars, dayStem, targetShishens }) => {
    const tombs = new Set(['丑', '戌', '未', '辰']);
    return pillars.some(p => {
      const ss = getShishenLabel(dayStem, p.gan);
      return targetShishens.includes(ss) && tombs.has(p.zhi);
    });
  },
  '正偏财杂见 + 桃花 → 多次婚姻': ({ pillars, dayStem }) => {
    const hasZheng = pillars.some(p => getShishenLabel(dayStem, p.gan) === '财');
    const hasPian = pillars.some(p => getShishenLabel(dayStem, p.gan) === '才');
    return hasZheng && hasPian;
  },
  '官杀混杂 → 多次婚姻或感情复杂': ({ pillars, dayStem }) => {
    const hasGuan = pillars.some(p => getShishenLabel(dayStem, p.gan) === '官');
    const hasSha = pillars.some(p => getShishenLabel(dayStem, p.gan) === '杀');
    return hasGuan && hasSha;
  },
  '伤官太重（无印制）→ 妨夫': ({ pillars, dayStem }) => {
    const shangCount = pillars.filter(p => getShishenLabel(dayStem, p.gan) === '伤').length;
    const hasYin = pillars.some(p => {
      const ss = getShishenLabel(dayStem, p.gan);
      return ss === '印' || ss === '枭';
    });
    return shangCount >= 2 && !hasYin;
  },
  '满盘食伤（克官）→ 婚姻受挫或不婚': ({ pillars, dayStem }) => {
    const fsCount = pillars.filter(p => {
      const ss = getShishenLabel(dayStem, p.gan);
      return ss === '食' || ss === '伤';
    }).length;
    return fsCount >= 3;
  },
  '比劫重（男）→ 劫财伤妻，婚姻不稳': ({ pillars, dayStem }) => {
    const bjCount = pillars.filter(p => {
      const ss = getShishenLabel(dayStem, p.gan);
      return ss === '比' || ss === '劫';
    }).length;
    return bjCount >= 2;
  },
  '日支坐比劫 → 配偶宫被争夺，婚姻危机': ({ pillars, dayStem }) => {
    const riPillar = pillars.find(p => p.name === '日');
    if (!riPillar) return false;
    const mainGan = toGanStr(riPillar.hidden_stems?.[0]);
    const ss = mainGan ? getShishenLabel(dayStem, mainGan) : '';
    return ss === '比' || ss === '劫';
  },
  '夫星入墓（官/杀藏于墓库无刑冲）→ 晚婚/难婚': ({ pillars, dayStem, targetShishens }) => {
    const tombs = new Set(['丑', '戌', '未', '辰']);
    return pillars.some(p => {
      const ss = getShishenLabel(dayStem, p.gan);
      return targetShishens.includes(ss) && tombs.has(p.zhi);
    });
  },
};

function runExtraChecks({ extraChecks = [], pillars, dayStem, targetShishens }) {
  return extraChecks.map(checkStr => {
    const rule = STATIC_CHECK_RULES[checkStr];
    const found = rule ? rule({ pillars, dayStem, targetShishens }) : null;
    return {
      check: checkStr,
      found: found ?? false,
      applicable: rule != null,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// 综合稳定性与 base_state
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// vigor 加权稳定性评分
// ─────────────────────────────────────────────────────────────

/**
 * 单个十神的条件分（0-1）
 *
 * vigor 已包含：12长生旺衰、空亡折减、盖头截脚折减。
 * 此处只叠加关系层的影响（刑冲合化），再做微调。
 */
function shishenCondScore(sa) {
  const tags = new Set(sa.status_tags);
  let score = sa.vigor;
  // 结构性损害
  if (tags.has('被合化')) score *= 0.15;
  if (tags.has('入墓'))   score *= 0.35;
  // 关系冲克
  if (tags.has('被冲'))   score *= 0.50;
  if (tags.has('被刑'))   score *= 0.65;
  if (tags.has('被害'))   score *= 0.80;
  // 主动冲出（是强者，略加分）
  if (tags.has('冲他支')) score = Math.min(score * 1.10, 1.0);
  return score;
}

/**
 * 单个宫位的条件分（0-1）
 */
function gongweiCondScore(ga) {
  const tags = new Set(ga.status_tags);
  let score = ga.vigor;
  if (tags.has('星宫得正'))  score = Math.min(score + 0.30, 1.0);
  if (tags.has('宫位稳固'))  score = Math.max(score, 0.45);
  if (tags.has('宫位受冲'))  score *= 0.35;
  if (tags.has('宫位受刑'))  score *= 0.45;
  if (tags.has('鸠占鹊巢'))  score *= 0.25;
  if (tags.has('宫位入墓'))  score *= 0.20;
  if (tags.has('宫位受害'))  score *= 0.70;
  if (tags.has('被合化') || tags.has('宫位被合化')) score *= 0.20;
  return Math.min(Math.max(score, 0), 1.0);
}

/**
 * 综合稳定性判断
 *
 * 算法：
 * 1. 十神 vigor 加权均分 → starScore（高 vigor 的星权重更大）
 * 2. 宫位均分 → gongweiScore（有宫位时占 40% 权重）
 * 3. 动荡检测：vigor≥0.25 的十神被冲/刑，或宫位受冲/刑 → isVolatile
 * 4. combined + isVolatile → 五档标签
 *
 * 五档阈值：
 *   >= 0.65              → strong
 *   >= 0.45 + volatile   → dynamic
 *   >= 0.45              → stable
 *   >= 0.20 + volatile   → dynamic
 *   >= 0.20              → buried
 *   < 0.20               → damaged
 */
function deriveOverallStability(shishenAssessments, gongweiAssessments) {
  const hasGongwei = gongweiAssessments.length > 0;

  // ── 1. 十神 vigor 加权评分 ──────────────────────────────────
  const totalVigor = shishenAssessments.reduce((s, a) => s + a.vigor, 0);
  const starScore = totalVigor < 0.01 ? 0.05
    : shishenAssessments.reduce((s, a) => s + a.vigor * shishenCondScore(a), 0) / totalVigor;

  // ── 2. 宫位评分 ─────────────────────────────────────────────
  const gongweiScore = hasGongwei
    ? gongweiAssessments.reduce((s, g) => s + gongweiCondScore(g), 0) / gongweiAssessments.length
    : null;

  // ── 3. 综合（有宫位时宫位占 40%） ────────────────────────────
  const palaceWeight = hasGongwei ? 0.40 : 0;
  const combined = palaceWeight === 0
    ? starScore
    : (1 - palaceWeight) * starScore + palaceWeight * gongweiScore;

  // ── 4. 动荡检测（只有 vigor≥0.25 的星参与才算有效冲刑） ─────
  const VOLATILE_THRESHOLD = 0.25;
  const isVolatile =
    shishenAssessments.some(sa =>
      sa.vigor >= VOLATILE_THRESHOLD &&
      (sa.status_tags.includes('被冲') || sa.status_tags.includes('被刑'))
    ) ||
    gongweiAssessments.some(ga =>
      ga.status_tags.includes('宫位受冲') || ga.status_tags.includes('宫位受刑')
    );
  const hasTombStorage =
    shishenAssessments.some(sa => sa.status_tags.includes('入墓')) ||
    gongweiAssessments.some(ga => ga.status_tags.includes('宫位入墓'));

  // ── 5. 映射到等级 ────────────────────────────────────────────
  // 注：strong 优先于 volatile（帝旺被冲 = 强且动，定为 strong）
  // volatile 优先于 buried/damaged（宫位受冲是结构性事件，不管综合分多低都应为 dynamic）
  if (combined >= 0.65) return 'strong';
  if (isVolatile)        return 'dynamic';
  if (combined >= 0.45)  return 'stable';
  // 墓库是"封藏待开"而非普通受损；即使量化分被入墓/截脚压到 0.20 以下，
  // 只要未被冲刑转为动荡，仍保留 buried，供后续岁运冲墓触发 KAI_MU。
  if (hasTombStorage)    return 'buried';
  if (combined >= 0.20)  return 'buried';
  return 'damaged';
}

const STABILITY_LABEL = {
  strong:  '强旺稳固',
  stable:  '平稳安静',
  dynamic: '动荡不稳',
  buried:  '封藏入墓',
  damaged: '受损变质',
};

function buildBaseState(shishenAssessments, gongweiAssessments, extraCheckResults) {
  const parts = [];

  for (const a of shishenAssessments) {
    const key = a.status_tags.filter(t => ['帝旺', '长生', '死绝', '入墓', '被冲', '被合化', '合而不化', '有根', '无根', '空亡'].includes(t));
    if (key.length) parts.push(`${a.shishen}（${a.pillar}柱）：${key.join('/')}`);
  }

  for (const g of gongweiAssessments) {
    const key = g.status_tags.filter(t => ['宫位稳固', '宫位受冲', '宫位受刑', '宫位入墓', '鸠占鹊巢', '星宫得正', '宫位受害'].includes(t));
    if (key.length) parts.push(`${g.gongwei}：${key.join('/')}`);
  }

  const triggered = extraCheckResults.filter(c => c.found).map(c => c.check.split('→')[0].trim());
  if (triggered.length) parts.push(`命局特征：${triggered.join('；')}`);

  return parts.join('。') || '原局状态平稳，无显著关系触发';
}

// ─────────────────────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────────────────────

/**
 * 评估原局中目标元素的状态
 *
 * @param {object} p
 * @param {object} p.matrix      - baziLocalMatrix 输出，含 pillars[4]
 * @param {object} p.targetSpec  - resolveTargetElement 输出
 * @param {string} p.dayStem     - 日干
 * @param {string} p.gender      - 'male' | 'female'
 * @returns {OriginalStateReport}
 */
function assessOriginalChartState({
  matrix, targetSpec, dayStem, gender,
  favorableWuxing,    // Set<string> | null — 喜用神五行
  unfavorableWuxing,  // Set<string> | null — 忌仇神五行
  geju,               // string | null — 格局（如"伤官格"）
  tiaohou,            // string | null — 调候（如"调候用神：丙火"）
  imageAnalysis = null,
} = {}) {
  const pillars = matrix.pillars;
  const monthPillar = pillars.find(p => p.name === '月');
  const monthZhi = monthPillar?.zhi ?? '';

  const { primary_shishen: primaryShishenRaw, primary_gongwei, extra_static_checks } = targetSpec;
  // 统一转为 core.js SHISHEN 短形，以便与 getShishenLabel 返回值匹配
  const primary_shishen = normalizeShishens(primaryShishenRaw);

  // 确定目标五行（用于宫位的"是否为目标之墓"判断）
  const targetElement = deriveTargetElement(dayStem, primaryShishenRaw);

  // ── Step A：定位并评估所有目标十神 ────────────────────────
  const shishenLocations = primary_shishen.length > 0
    ? locateShishen(pillars, primary_shishen, dayStem)
    : [];

  const shishenAssessments = shishenLocations.map(loc =>
    assessOneShishen({ loc, pillars, dayStem, monthZhi })
  );

  // ── Step A2：yongshen 锚定时，忌神（secondary_shishen）同样做状态评估，标 is_avoid ──
  // 仅 yongshen 分支启用，避免污染 backend 模式；动态吉凶仍只认 primary（用神）。
  if (targetSpec.anchor_kind === 'yongshen') {
    const avoidShishen = normalizeShishens(targetSpec.secondary_shishen)
      .filter(s => !primary_shishen.includes(s));
    if (avoidShishen.length) {
      const avoidLocations = locateShishen(pillars, avoidShishen, dayStem);
      for (const loc of avoidLocations) {
        shishenAssessments.push({ ...assessOneShishen({ loc, pillars, dayStem, monthZhi }), is_avoid: true });
      }
    }
  }

  // ── Step B：评估目标宫位（独立，不依赖十神是否在宫） ─────
  const gongweiAssessments = primary_gongwei.map(gw => {
    const pillarName = gongweiToPillarName(gw);
    const pillar = pillars.find(p => p.name === pillarName);
    if (!pillar) return null;
    return assessGongwei({
      gongwei: gw,
      pillar,
      targetShishens: primary_shishen,
      targetElement,
      pillars,
      dayStem,
      monthZhi,
    });
  }).filter(Boolean);

  // ── Step C：格局层静态特征检查 ────────────────────────────
  const extraCheckResults = runExtraChecks({
    extraChecks: extra_static_checks ?? [],
    pillars,
    dayStem,
    targetShishens: primary_shishen,
  });

  // ── Step D：综合输出 ─────────────────────────────────────
  const overall_stability = deriveOverallStability(shishenAssessments, gongweiAssessments);
  const base_state = buildBaseState(shishenAssessments, gongweiAssessments, extraCheckResults);

  const summary_verdict = buildSummaryVerdict({
    shishenAssessments,
    gongweiAssessments,
    extraCheckResults,
    overall_stability,
    targetSpec,
  });

  return {
    shishen_assessments: shishenAssessments,
    gongwei_assessments: gongweiAssessments,
    extra_checks: extraCheckResults,
    overall_stability,
    stability_label: STABILITY_LABEL[overall_stability],
    base_state,
    summary_verdict,
    // 上游透传字段（engine 不自算，由调用方注入）
    favorable_wuxing: favorableWuxing instanceof Set ? [...favorableWuxing] : (favorableWuxing ?? null),
    unfavorable_wuxing: unfavorableWuxing instanceof Set ? [...unfavorableWuxing] : (unfavorableWuxing ?? null),
    geju: geju ?? null,
    tiaohou: tiaohou ?? null,
    image_context: imageAnalysis?.override_candidate || imageAnalysis?.primary_candidate || null,
    image_display_context: imageAnalysis?.primary_candidate || null,
  };
}

// ─────────────────────────────────────────────────────────────
// 从 primary_shishen 推导目标五行
// ─────────────────────────────────────────────────────────────

const WUXING_KE_BY = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }; // A克B
const WUXING_KE_TARGET = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' }; // 谁克A（官杀）

function deriveTargetElement(dayStem, primaryShishens) {
  if (!dayStem || !primaryShishens.length) return null;
  const dayWx = C.GAN5[dayStem];
  if (!dayWx) return null;

  const first = primaryShishens[0];
  if (first.includes('财')) return WUXING_KE_BY[dayWx]; // 财星 = 日主所克
  if (first.includes('官') || first.includes('杀')) return WUXING_KE_TARGET[dayWx]; // 官杀 = 克日主
  if (first.includes('印')) return WUXING_KE_TARGET[WUXING_KE_BY[dayWx]]; // 印 = 生日主
  if (first.includes('食') || first.includes('伤')) return WUXING_KE_BY[WUXING_KE_TARGET[dayWx]]; // 食伤 = 日主所生
  return null;
}

// ─────────────────────────────────────────────────────────────
// 综合断语
// ─────────────────────────────────────────────────────────────

function buildSummaryVerdict({ shishenAssessments, gongweiAssessments, extraCheckResults, overall_stability, targetSpec }) {
  const lines = [];
  const mode = targetSpec.analysis_mode;
  const question = targetSpec.analysis_question ?? '';

  lines.push(`【原局整体状态】${STABILITY_LABEL[overall_stability]}`);

  if (shishenAssessments.length === 0) {
    lines.push('命局中未找到对应目标十神，以宫位和格局为主要判断依据。');
  }

  for (const a of shishenAssessments) {
    lines.push(`▸ ${a.verdict}`);
  }

  for (const g of gongweiAssessments) {
    lines.push(`▸ ${g.verdict}`);
  }

  const triggered = extraCheckResults.filter(c => c.found);
  if (triggered.length) {
    lines.push(`【命局特征触发】`);
    triggered.forEach(c => lines.push(`  · ${c.check}`));
  }

  if (mode === 'dynamic' || mode === 'both') {
    lines.push(`【动态分析起点】${question}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// prompt 格式化
// ─────────────────────────────────────────────────────────────

const IMAGE_CATEGORY_LABEL = {
  FOLLOW_IMAGE: '从格（顺从旺神）',
  SINGLE_IMAGE: '专旺/一行得气',
  TRANSFORMATION_IMAGE: '化气格',
  TWO_QI_IMAGE: '两气成象',
};

const IMAGE_TREATMENT_LABEL = {
  LEAK_EXCESS: '泄秀',
  RESTRAIN_BALANCED_EXCESS: '制衡',
  SUPPORT_ROOTED_WEAK: '扶弱',
  REMOVE_ROOTLESS_WEAK: '去寡',
  FOLLOW_CLEAR_BODY: '顺势',
  DESCRIPTIVE_ONLY: '仅展示',
  FOLLOW_FORCE: '顺势',
  TRANSFORM_FORCE: '化气',
};

function describeImageDecision(candidate) {
  if (!candidate) return '暂不覆盖常规喜忌';
  if (candidate.override_veto_reason) return '候选被挡下';

  const scope = candidate.override_scope;
  if (['full', 'xiji_yongshen', 'yongshen_only'].includes(scope)) return '已主导取用';
  if (scope === 'display_only' || scope === 'none') return '仅作形象展示';
  return candidate.override_normal_pattern ? '已主导取用' : '暂未主导取用';
}

/**
 * 将 OriginalStateReport 格式化为可注入 LLM prompt 的文本段落
 *
 * @param {object} report  assessOriginalChartState 输出
 * @param {object} [options]
 * @param {number} [options.maxShishenItems=Infinity] 目标十神注入条数上限（按 mode 裁剪）
 * @param {number} [options.maxGongweiItems=Infinity] 目标宫位注入条数上限
 * @param {boolean} [options.includeQuantTags=false]  是否附短量化标签（status_tags，如 死绝·空亡·被冲；非裸数值）
 */
function formatStateReportForPrompt(report, options = {}) {
  const {
    maxShishenItems = Infinity,
    maxGongweiItems = Infinity,
    includeQuantTags = false,
  } = options;

  const lines = [
    `【原局状态评估】`,
    MODEL_NOTE,
    `整体稳定性：${report.stability_label}（${report.overall_stability}）`,
  ];

  // ── 形象 / 从化（专旺·从格·化气）──────────────────────────────
  const ic = report.image_context;
  if (ic?.subtype) {
    lines.push(`形象判断：${ic.subtype}，匹配度${ic.match_score}%（${ic.match_label || '待判'}），${describeImageDecision(ic)}。`);
    const detail = [];
    if (ic.category) detail.push(`类别：${IMAGE_CATEGORY_LABEL[ic.category] || ic.category}`);
    const targets = [...new Set([...(ic.target_elements || []), ic.target_element].filter(Boolean))];
    if (targets.length) detail.push(`顺从/化神方向：${targets.join('、')}`);
    if (ic.treatment) detail.push(`取用策略：${IMAGE_TREATMENT_LABEL[ic.treatment] || ic.treatment}`);
    if (ic.yongshen_strategy) detail.push(`用神取法：${ic.yongshen_strategy}`);
    if (Array.isArray(ic.affected_dimensions) && ic.affected_dimensions.length) {
      detail.push(`影响范围：${ic.affected_dimensions.join('、')}`);
    }
    if (detail.length) lines.push(`  ${detail.join('；')}`);
    if (ic.override_reason) lines.push(`  主导依据：${ic.override_reason}`);
    if (ic.override_veto_reason) lines.push(`  未主导原因：${ic.override_veto_reason}`);
    if (ic.effective_counter_element) lines.push(`  保护真神：${ic.effective_counter_element}`);
    // override 时附原始候选（与静态面板"原始候选"行同源）
    const disp = report.image_display_context;
    if (disp?.subtype && disp.subtype !== ic.subtype) {
      lines.push(`  原始候选：${disp.subtype}（匹配度${disp.match_score}%，${disp.match_label || '待判'}）`);
    }
  }

  lines.push(`基准状态：${report.base_state}`);

  // ── 目标十神 / 宫位（按 mode 裁剪条数 + 可选量化标签）──────────
  const shishen = (report.shishen_assessments || []).slice(0, maxShishenItems);
  const gongwei = (report.gongwei_assessments || []).slice(0, maxGongweiItems);

  if (shishen.length || gongwei.length) {
    if (shishen.length) {
      lines.push('', '【目标十神状态】');
      for (const a of shishen) {
        const tag = includeQuantTags && a.status_tags?.length ? `［${a.status_tags.join('·')}］` : '';
        lines.push(`  ▸ ${a.shishen}（${a.pillar}柱·${a.gan}${a.zhi}）${tag}：${a.verdict}`);
      }
    }
    if (gongwei.length) {
      lines.push('', '【目标宫位状态】');
      for (const g of gongwei) {
        const tag = includeQuantTags && g.status_tags?.length ? `［${g.status_tags.join('·')}］` : '';
        lines.push(`  ▸ ${g.gongwei}（${g.pillar_name}柱·${g.zhi}）${tag}：${g.verdict}`);
      }
    }
    const triggered = (report.extra_checks || []).filter(c => c.found);
    if (triggered.length) {
      lines.push('', '【命局特征触发】');
      triggered.forEach(c => lines.push(`  · ${c.check}`));
    }
  } else {
    // general 兜底：无目标十神/宫位定位时回退到全量 summary_verdict
    lines.push('', report.summary_verdict);
  }

  return lines.join('\n');
}

module.exports = {
  assessOriginalChartState,
  formatStateReportForPrompt,
};
