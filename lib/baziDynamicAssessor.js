'use strict';

/**
 * 大运流年引动评估器（Step 3）
 *
 * 职责：判断当前大运 + 流年的干支是否改变了 Step 2 输出的 base_state，以及如何改变。
 * 理论依据：陆致极"大运建场，流年触发"；《滴天髓》"大运重地支，太岁重天干"
 *
 * 上游：assessOriginalChartState (Step 2) → OriginalStateReport
 * 下游：buildBaziQuestionPrompt → LLM prompt 注入
 */

const C = require('./constants/core');
const R = require('./constants/relations');
const { getDiShi } = require('./BaziRuleEngine');
const { assessGanContext, MODEL_NOTE } = require('./baziElementState');
const {
  scanZhiRelations,
  scanGanRelations,
  getGaitouJiejiao,
  GAITOU_JIEJIAO_NOTE,
  ELEMENT_TOMB,
} = require('./baziRelationScanner');
const {
  getVigor,
  clashDirection,
  STRENGTH_TIER_LABEL,
} = require('./constants/relationStrength');

// ─────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────

const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };

// 触发机制类型
const MECH = {
  CHONG_DONG:    '冲动',
  HE_DONG:       '合动',
  HE_HUA:        '合化',
  HE_BU_HUA:     '合而不化',
  FU_YIN:        '伏吟',
  FAN_YIN:       '反吟',
  KAI_MU:        '开墓库',
  TOU_GAN:       '透干引动',
  TIAN_SHI:      '填实三合',
  TIAN_SHI_XING: '填实三刑',  // Step 5: 流年地支完成原局三刑网络
};

// 三刑组合（不含自刑、子卯相刑——后者只有2支无需"填实"）
const SAN_XING_GROUPS = [
  ['寅', '申', '巳'],  // 三势相刑
  ['丑', '戌', '未'],  // 无恩之刑
];

// 事件类型
const EVENT = {
  MARRIAGE:    '婚姻落定',
  SEPARATION:  '感情分离',
  WEALTH_IN:   '进财',
  WEALTH_LOSS: '破财',
  PROMOTION:   '升迁',
  KAI_MU:      '开墓',
  SEALED:      '封藏',
  TURMOIL:     '动荡',
  STATIC:      '静止',
};

// 十神短形映射（与 baziStateAssessor 保持一致）
const SHISHEN_LONG_TO_SHORT = {
  '比肩': '比', '劫财': '劫', '食神': '食', '伤官': '伤',
  '正财': '财', '偏财': '才', '正官': '官', '七杀': '杀',
  '正印': '印', '偏印': '枭',
};
function normalizeShishens(arr) {
  return (arr ?? []).map(s => SHISHEN_LONG_TO_SHORT[s] ?? s);
}

// ─────────────────────────────────────────────────────────────
// Phase 1：基础检测函数
// ─────────────────────────────────────────────────────────────

/**
 * 构建扩展柱数组（原局4柱 + 大运 + 流年）
 * 用于让流年扫描时也能"看到"大运作为潜在关系方
 */
function buildExtendedPillars(pillars, dayunGan, dayunZhi, liunianGan, liunianZhi) {
  return [
    ...pillars,
    {
      name: '大运',
      gan: dayunGan,
      zhi: dayunZhi,
      hidden_stems: C.ZHI5_LIST[dayunZhi] ?? [],
      is_kong: false,
    },
    {
      name: '流年',
      gan: liunianGan,
      zhi: liunianZhi,
      hidden_stems: C.ZHI5_LIST[liunianZhi] ?? [],
      is_kong: false,
    },
  ];
}

/** 伏吟：干支完全相同 */
function isFuyin(ganA, zhiA, ganB, zhiB) {
  return ganA === ganB && zhiA === zhiB;
}

/** 反吟：天干相克（任一方向） + 地支相冲 */
function isFantin(incomingGan, incomingZhi, pillarGan, pillarZhi) {
  const inWx = C.GAN5[incomingGan];
  const piWx = C.GAN5[pillarGan];
  const ganKe = !!(inWx && piWx && (WUXING_KE[inWx] === piWx || WUXING_KE[piWx] === inWx));
  const zhiChong = R.ZHI_CHONGS[incomingZhi] === pillarZhi;
  return ganKe && zhiChong;
}

/** 开墓库：incoming 的冲，打在目标元素当前藏身的墓支上 */
function isOpenTomb(incomingZhi, overallStability, targetElement) {
  if (overallStability !== 'buried' || !targetElement) return false;
  const tombBranch = ELEMENT_TOMB[targetElement];
  return !!tombBranch && R.ZHI_CHONGS[incomingZhi] === tombBranch;
}

function findSourceElement(cycle, targetElement) {
  return Object.keys(cycle).find(element => cycle[element] === targetElement);
}

/**
 * 评估岁运五行对原局特殊形象的增损。
 * 仅累计岁运影响，不修改原局 match_score。
 */
function assessImageLuckEffect({
  imageContext,
  dayStem,
  dayunGan,
  dayunZhi,
  liunianGan,
  liunianZhi,
}) {
  const natalMatchScore = imageContext?.match_score ?? 0;
  if (!imageContext?.category || imageContext?.match_score == null) {
    return {
      status: 'NEUTRAL',
      score_delta: 0,
      reason_codes: [],
      natal_match_score: natalMatchScore,
      description: '原局未形成需追踪特殊形象',
    };
  }
  if (
    imageContext.override_veto_reason
    || imageContext.override_scope === 'display_only'
    || imageContext.override_scope === 'none'
  ) {
    return {
      status: 'NEUTRAL',
      score_delta: 0,
      reason_codes: [],
      natal_match_score: natalMatchScore,
      description: '原局形象候选未主导取用，不作为特殊形象追踪',
    };
  }

  const incomingElements = [
    C.GAN5[dayunGan],
    C.GAN5[liunianGan],
    C.GAN5[C.ZHI5_LIST[dayunZhi]?.[0]],
    C.GAN5[C.ZHI5_LIST[liunianZhi]?.[0]],
  ].filter(Boolean);
  const targetElements = new Set([
    ...(imageContext.target_elements ?? []),
    imageContext.target_element,
  ].filter(Boolean));
  const reasonCodes = new Set();
  let scoreDelta = 0;

  function addScore(delta, reasonCode) {
    scoreDelta += delta;
    reasonCodes.add(reasonCode);
  }

  for (const element of incomingElements) {
    if (imageContext.category === 'FOLLOW_IMAGE') {
      if (targetElements.has(element)) {
        addScore(8, 'LUCK_SUPPORTS_IMAGE_FORCE');
      }
      const dayElement = C.GAN5[dayStem];
      const resourceElement = findSourceElement(WUXING_SHENG, dayElement);
      if (element === dayElement || element === resourceElement) {
        addScore(-12, 'RESOURCE_LUCK_SUPPORTS_DM');
      }
    }

    if (imageContext.category === 'SINGLE_IMAGE') {
      if (targetElements.has(element)) {
        addScore(8, 'LUCK_SUPPORTS_IMAGE_FORCE');
      }
      if (targetElements.has(WUXING_KE[element])) {
        addScore(-12, 'OFFICIAL_LUCK_BREAKS_SINGLE_IMAGE');
      }
    }

    if (imageContext.category === 'TRANSFORMATION_IMAGE') {
      const supportsTransformQi = [...targetElements].some(
        target => element === target || WUXING_SHENG[element] === target
      );
      if (supportsTransformQi) {
        addScore(8, 'LUCK_SUPPORTS_IMAGE_FORCE');
      }
      if (targetElements.has(WUXING_KE[element])) {
        addScore(-12, 'LUCK_DAMAGES_TRANSFORM_QI');
      }
    }
  }

  let status = 'NEUTRAL';
  if (scoreDelta <= -20) {
    status = 'BROKEN_BY_LUCK';
  } else if (scoreDelta < 0) {
    status = 'WEAKENED_BY_LUCK';
  } else if (natalMatchScore < 80 && natalMatchScore + scoreDelta >= 80) {
    status = 'FAKE_TO_TRUE';
  } else if (scoreDelta > 0) {
    status = 'SUPPORTED_BY_LUCK';
  }

  const descriptions = {
    BROKEN_BY_LUCK: '岁运破坏原局特殊形象',
    WEAKENED_BY_LUCK: '岁运削弱原局特殊形象',
    FAKE_TO_TRUE: '原局特殊形象由假转真',
    SUPPORTED_BY_LUCK: '岁运顺势扶助原局特殊形象',
    NEUTRAL: '岁运未对原局特殊形象形成明显增损',
  };
  return {
    status,
    score_delta: scoreDelta,
    reason_codes: [...reasonCodes],
    natal_match_score: natalMatchScore,
    description: descriptions[status],
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2：旺衰校验
// ─────────────────────────────────────────────────────────────

function buildVigorCheck(triggerVigor, targetVigor) {
  return {
    trigger_vigor: Math.round(triggerVigor * 100) / 100,
    target_vigor:  Math.round(targetVigor * 100) / 100,
    is_effective:  triggerVigor >= 0.35,          // 衰相以上才能有效引动
    direction:     clashDirection(triggerVigor, targetVigor),
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2：机制识别
// ─────────────────────────────────────────────────────────────

/**
 * 将扫描得到的关系列表映射为触发机制列表
 *
 * @param {object} p
 * @param {Relationship[]} p.zhiRels   - 地支关系列表（已按强度排序）
 * @param {Relationship[]} p.ganRels   - 天干关系列表
 * @param {string} p.incomingGan
 * @param {string} p.incomingZhi
 * @param {object[]} p.pillars         - 原局4柱（不含大运/流年）
 * @param {object} p.stateReport       - Step 2 输出
 * @param {string|null} p.targetElement - 目标五行
 * @param {Set<string>} p.targetPillarNames - 含目标元素的柱名集合
 * @param {number} p.triggerVigor      - 命主在岁运中的十二长生承接状态
 * @param {string[]} p.targetShishenShort - 目标十神短形数组
 * @param {string} p.dayStem
 */
function identifyMechanisms({
  zhiRels, ganRels,
  incomingGan, incomingZhi,
  pillars, stateReport,
  targetElement, targetPillarNames,
  triggerVigor, targetShishenShort, dayStem,
}) {
  const mechanisms = [];
  const globalMechanismKeys = new Set();
  const allOriginalTags = new Set([
    ...stateReport.shishen_assessments.flatMap(a => a.status_tags),
    ...stateReport.gongwei_assessments.flatMap(a => a.status_tags),
  ]);

  // ── 地支关系 → 机制 ──────────────────────────────────────────

  for (const rel of zhiRels) {
    const isTargetPillar = targetPillarNames.has(rel.partner_pillar);
    const str = rel.effective_strength;
    const partnerVigor = rel.partner_vigor ?? 0.5;

    if (rel.type === '六冲') {
      // 开墓库优先（只要冲中了目标的墓支）
      if (isOpenTomb(incomingZhi, stateReport.overall_stability, targetElement)) {
        mechanisms.push({
          type: MECH.KAI_MU,
          target_pillar: rel.partner_pillar,
          target_element: rel.partner_zhi,
          description: `${incomingZhi}冲开${rel.partner_zhi}（${targetElement ?? ''}目标之墓），封藏元素透出`,
          effective_strength: str,
          vigor_check: buildVigorCheck(triggerVigor, partnerVigor),
        });
        continue;
      }
      // 普通冲动
      if (isTargetPillar) {
        mechanisms.push({
          type: MECH.CHONG_DONG,
          target_pillar: rel.partner_pillar,
          target_element: rel.partner_zhi,
          description: `${incomingZhi}冲${rel.partner_pillar}柱${rel.partner_zhi}，静→动`,
          effective_strength: str,
          vigor_check: buildVigorCheck(triggerVigor, partnerVigor),
        });
      }
    }

    if (['六合_化', '六合_不化', '三合', '三会', '半三合'].includes(rel.type)) {
      const wasChonged = allOriginalTags.has('宫位受冲') || allOriginalTags.has('被冲');
      const isFullHe = rel.type.endsWith('_化') || rel.type === '三合' || rel.type === '三会';

      // 填实三合：流年地支补完原局半三合 → 不限定目标柱，三合成局是全局结构事件
      // is_effective 恒为 true：三合成局自带能量，不受单柱旺衰约束
      const isTianshi = rel.type === '三合' &&
        stateReport.shishen_assessments.concat(stateReport.gongwei_assessments).some(
          a => a.relationships?.some(r => r.type === '半三合')
        );

      if (isTianshi) {
        const description = `${incomingZhi}填实原局半合，补成三合${rel.transformed_element ?? ''}局`;
        const globalKey = `${MECH.TIAN_SHI}|${description}`;
        if (globalMechanismKeys.has(globalKey)) continue;
        globalMechanismKeys.add(globalKey);
        mechanisms.push({
          type: MECH.TIAN_SHI,
          target_pillar: rel.partner_pillar,
          target_element: rel.partner_zhi,
          description,
          effective_strength: str,
          vigor_check: {
            trigger_vigor: Math.round(triggerVigor * 100) / 100,
            target_vigor: Math.round(partnerVigor * 100) / 100,
            is_effective: true,
            direction: clashDirection(triggerVigor, partnerVigor),
          },
        });
      } else if (isTargetPillar) {
        if (wasChonged && isFullHe) {
          // 原局有冲，来合解冲 → 合动（最重要的应期机制）
          mechanisms.push({
            type: MECH.HE_DONG,
            target_pillar: rel.partner_pillar,
            target_element: rel.partner_zhi,
            description: `${incomingZhi}与${rel.partner_pillar}柱${rel.partner_zhi}合解原冲，宫位趋于稳固`,
            effective_strength: str,
            vigor_check: buildVigorCheck(triggerVigor, partnerVigor),
          });
        } else if (isFullHe) {
          // 无原冲，合住目标元素 → 合化或合而不化
          const mechType = rel.is_transformed ? MECH.HE_HUA : MECH.HE_BU_HUA;
          mechanisms.push({
            type: mechType,
            target_pillar: rel.partner_pillar,
            target_element: rel.partner_zhi,
            description: `${incomingZhi}与${rel.partner_pillar}柱${rel.partner_zhi}${rel.type}${rel.transformed_element ? '化' + rel.transformed_element : '（不化）'}`,
            effective_strength: str,
            vigor_check: buildVigorCheck(triggerVigor, partnerVigor),
          });
        } else {
          // 半三合，轻度合合
          mechanisms.push({
            type: MECH.HE_BU_HUA,
            target_pillar: rel.partner_pillar,
            target_element: rel.partner_zhi,
            description: `${incomingZhi}与${rel.partner_pillar}柱${rel.partner_zhi}半三合（合力未满）`,
            effective_strength: str,
            vigor_check: buildVigorCheck(triggerVigor, partnerVigor),
          });
        }
      }
    }
  }

  // ── 天干关系 → 机制 ──────────────────────────────────────────

  for (const rel of ganRels) {
    const isTargetPillar = targetPillarNames.has(rel.partner_pillar);
    const str = rel.effective_strength;
    const partnerVigor = rel.partner_vigor ?? 0.5;

    if ((rel.type === '天干五合_化' || rel.type === '天干五合_不化') && isTargetPillar) {
      const wasChonged = allOriginalTags.has('宫位受冲') || allOriginalTags.has('被冲');
      mechanisms.push({
        type: wasChonged ? MECH.HE_DONG : (rel.is_transformed ? MECH.HE_HUA : MECH.HE_BU_HUA),
        target_pillar: rel.partner_pillar,
        target_element: rel.partner_gan,
        description: `${incomingGan}与${rel.partner_pillar}柱${rel.partner_gan}天干五合${rel.is_transformed ? '化' + rel.transformed_element : '（不化）'}`,
        effective_strength: str,
        vigor_check: buildVigorCheck(triggerVigor, partnerVigor),
      });
    }
  }

  // ── 透干引动：incoming_gan 本身就是目标十神 ──────────────────
  // 透干是"新干出现"而非对抗竞争：is_effective 恒为 true，不受流年旺衰约束

  const incomingGanSS = C.SHISHEN[dayStem]?.[incomingGan] ?? '';
  if (targetShishenShort.includes(incomingGanSS)) {
    // 透干引动对日支宫位同样有效（五行流通）
    for (const pillarName of targetPillarNames) {
      mechanisms.push({
        type: MECH.TOU_GAN,
        target_pillar: pillarName,
        target_element: incomingGan,
        description: `${incomingGan}（${incomingGanSS}）透干，目标十神在天干层面显现，引动最直接`,
        effective_strength: 65,
        vigor_check: {
          trigger_vigor: Math.round(triggerVigor * 100) / 100,
          target_vigor: 0.5,
          is_effective: true,
          direction: clashDirection(triggerVigor, 0.5),
        },
      });
    }
  }

  // ── 伏吟检测 ─────────────────────────────────────────────────

  for (const pillar of pillars) {
    if (isFuyin(incomingGan, incomingZhi, pillar.gan, pillar.zhi)) {
      mechanisms.push({
        type: MECH.FU_YIN,
        target_pillar: pillar.name,
        target_element: pillar.zhi,
        description: `${incomingGan}${incomingZhi}与${pillar.name}柱伏吟，该柱主题事件聚焦放大`,
        effective_strength: 60,
        vigor_check: buildVigorCheck(triggerVigor, triggerVigor),
      });
    }
  }

  // ── 反吟检测 ─────────────────────────────────────────────────

  for (const pillar of pillars) {
    if (isFantin(incomingGan, incomingZhi, pillar.gan, pillar.zhi)) {
      mechanisms.push({
        type: MECH.FAN_YIN,
        target_pillar: pillar.name,
        target_element: pillar.zhi,
        description: `${incomingGan}${incomingZhi}与${pillar.name}柱${pillar.gan}${pillar.zhi}反吟（天克地冲），结构剧烈震荡`,
        effective_strength: 75,
        vigor_check: buildVigorCheck(triggerVigor, triggerVigor),
      });
    }
  }

  // ── 填实三刑检测（Step 5）────────────────────────────────────
  // 检查 incomingZhi 是否完成了原局中已存在两个成员的三刑组
  {
    const originalZhiSet = new Set(pillars.map(p => p.zhi));
    for (const group of SAN_XING_GROUPS) {
      if (!group.includes(incomingZhi)) continue;
      const others = group.filter(z => z !== incomingZhi);
      if (!others.every(z => originalZhiSet.has(z))) continue;
      // 找原局中属于该三刑组的第一个柱作为 target_pillar
      const anchorPillar = pillars.find(p => others.includes(p.zhi));
      if (!anchorPillar) continue;
      mechanisms.push({
        type: MECH.TIAN_SHI_XING,
        target_pillar: anchorPillar.name,
        target_element: incomingZhi,
        description: `${incomingZhi}填实原局三刑${group.join('/')}，刑冲网络完整激活，主剧烈动荡`,
        effective_strength: 70,
        vigor_check: buildVigorCheck(triggerVigor, 0.5),
      });
      break;
    }
  }

  return mechanisms.sort((a, b) => b.effective_strength - a.effective_strength);
}

// ─────────────────────────────────────────────────────────────
// Phase 2：单个干支（大运或流年）的冲击评估
// ─────────────────────────────────────────────────────────────

/**
 * 评估一个外来干支（大运/流年）对原局的全部影响
 *
 * @param {object} p
 * @param {string} p.incomingName  '大运' | '流年'
 * @param {string} p.incomingGan
 * @param {string} p.incomingZhi
 * @param {object[]} p.pillars     扫描对象（原局4柱，或原局+大运）
 * @param {string} p.dayStem
 * @param {string} p.monthZhi
 * @param {object} p.stateReport
 * @param {string|null} p.targetElement
 * @param {Set<string>} p.targetPillarNames
 * @param {string[]} p.targetShishenShort
 */
function assessPillarImpact({
  incomingName, incomingGan, incomingZhi,
  pillars, dayStem, monthZhi,
  stateReport, targetElement,
  targetPillarNames, targetShishenShort,
}) {
  // 命主状态（岁运地支对日主的十二长生承接状态）
  const phase = getDiShi(dayStem, incomingZhi);
  const triggerVigor = getVigor(phase, false);

  // 盖头截脚修正
  const gtj = getGaitouJiejiao(incomingGan, incomingZhi);

  // 地支关系：incoming 支 vs 原局各柱支
  const zhiRels = scanZhiRelations({
    targetZhi: incomingZhi,
    targetPillar: incomingName,
    targetIsKong: false,
    dayStem,
    pillars,
    monthZhi,
  });

  // 天干关系：incoming 干 vs 原局各柱干
  const ganRels = scanGanRelations({
    targetGan: incomingGan,
    targetZhi: incomingZhi,
    targetPillar: incomingName,
    dayStem,
    monthZhi,
    pillars,
  });

  // trigger_vigor 明确只代表日主临岁运支的工程状态，不能被岁运干支相克扣减。
  const effectiveTriggerVigor = triggerVigor;
  const incomingStemState = assessGanContext(incomingGan, incomingZhi,
    [...pillars, { name: incomingName, gan: incomingGan, zhi: incomingZhi }], monthZhi);

  // 机制识别
  const mechanisms = identifyMechanisms({
    zhiRels, ganRels,
    incomingGan, incomingZhi,
    pillars, stateReport,
    targetElement, targetPillarNames,
    triggerVigor: effectiveTriggerVigor,
    targetShishenShort,
    dayStem,
  });

  // 是否真正激活目标元素
  // TIAN_SHI（三合成局）：全局结构事件，不受 targetPillarNames 限制
  // TOU_GAN（透干引动）：is_effective 已恒为 true，此处含在通用判断里
  const activatesTarget = mechanisms.some(
    m => m.type === MECH.TIAN_SHI
      ? m.effective_strength >= 25
      : (targetPillarNames.has(m.target_pillar) &&
         m.effective_strength >= 25 &&
         m.vigor_check.is_effective)
  );

  return {
    gan: incomingGan,
    zhi: incomingZhi,
    twelve_phase: phase,
    twelve_phase_for_dayStem: phase,
    incoming_stem_state: incomingStemState,
    model_note: MODEL_NOTE,
    trigger_vigor: Math.round(effectiveTriggerVigor * 100) / 100,
    gaitou_jiejiao: gtj,
    gaitou_jiejiao_note: GAITOU_JIEJIAO_NOTE[gtj],
    zhi_relations: zhiRels,
    gan_relations: ganRels,
    mechanisms,
    activates_target: activatesTarget,
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2：状态变化与事件类型推断
// ─────────────────────────────────────────────────────────────

/** 根据 subcategory + 机制方向 推断事件类型 */
function deriveEventTypeFromSubcat(subcategory, mechCategory) {
  const rel = ['marriage_pattern', 'relationship_timing', 'partner_profile', 'single_romance'];
  const fin = ['general_wealth', 'wealth_capacity', 'income_model', 'entrepreneurship_vs_job'];
  const car = ['career_direction', 'industry_fit'];

  if (rel.includes(subcategory)) {
    return mechCategory === 'he_dong' ? EVENT.MARRIAGE : EVENT.SEPARATION;
  }
  if (fin.includes(subcategory)) {
    return mechCategory === 'he_dong' ? EVENT.WEALTH_IN : EVENT.WEALTH_LOSS;
  }
  if (car.includes(subcategory)) {
    return mechCategory === 'he_dong' ? EVENT.PROMOTION : EVENT.TURMOIL;
  }
  return EVENT.TURMOIL;
}

/**
 * 根据 base_state + 最强机制 → state_change + event_type
 */
/**
 * 根据目标五行的喜忌属性 + 冲击方向，推导四象吉凶断语
 * 理论依据：旺神冲弱忌→去凶则利；弱神冲旺忌→激凶则祸；
 *          旺神冲弱喜→去吉则害；弱神冲旺喜→激吉有动象
 * @param {string} dir           - 'wins' | 'loses' | 'equal'
 * @param {boolean|null} isXi    - 目标元素是否为喜神（null = 未知）
 */
function deriveFourDirectionAuspice(dir, isXi) {
  if (isXi === null) {
    // 喜忌未知，只用旺衰描述
    if (dir === 'wins')  return '旺神冲（引动有力，事件爆发）';
    if (dir === 'loses') return '弱神冲旺，反激被冲者（效果反转）';
    return '势均力敌（两败俱伤）';
  }
  if (!isXi) {
    // 被冲者是忌神
    if (dir === 'wins')  return '去凶则利（旺神冲弱忌，大吉）';
    if (dir === 'loses') return '激凶则祸（弱神冲旺忌，大凶，反激）';
    return '忌神受压但未去（势均力敌，小凶）';
  } else {
    // 被冲者是喜神
    if (dir === 'wins')  return '去吉则害（旺神冲弱喜，大凶，根被拔）';
    if (dir === 'loses') return '激吉有动象（弱神冲旺喜，有利但不大吉）';
    return '喜神受压（势均力敌，小害）';
  }
}

function deriveStateChange({ stateReport, targetSpec, dayunImpact, liunianImpact, targetPillarNames, favorableWuxing, unfavorableWuxing }) {
  const base = stateReport.overall_stability;
  const subcat = targetSpec.subcategory ?? '';

  // 宫位柱名（星宫同参：宫位机制优先于十神机制）
  const gongweiPillarNames = new Set(stateReport.gongwei_assessments.map(g => g.pillar_name));

  const rawMechs = [
    ...dayunImpact.mechanisms,
    ...liunianImpact.mechanisms,
  ].sort((a, b) => b.effective_strength - a.effective_strength);

  // 开墓库是全局事件，不受 targetPillarNames 限制
  const kaiMuMechs = rawMechs.filter(m => m.type === MECH.KAI_MU);
  const otherMechs = rawMechs.filter(
    m => m.type !== MECH.KAI_MU && targetPillarNames.has(m.target_pillar)
  );
  const allMechs = [...kaiMuMechs, ...otherMechs];

  // 宫位相关机制（如妻宫、财宫）优先于十神所在柱的机制
  const gongweiMechs = allMechs.filter(
    m => m.type === MECH.KAI_MU || gongweiPillarNames.has(m.target_pillar)
  );
  const priorityMechs = gongweiMechs.length > 0 ? gongweiMechs : allMechs;

  if (allMechs.length === 0) {
    return {
      state_change: '当前大运流年未直接引动目标元素，原局状态维持不变',
      new_stability: base,
      is_activated: false,
      event_type: EVENT.STATIC,
      auspice_direction: null,
    };
  }

  const top = priorityMechs[0];
  const vigorOk = top.vigor_check.is_effective;
  const dir = top.vigor_check.direction;

  // ── Step 7：推断目标元素的喜忌属性（用于四象断语）────────────
  // targetSpec 中记录了目标五行；favorableWuxing/unfavorableWuxing 来自 profile
  const targetWx = stateReport.target_element_wuxing ?? null;
  let isXi = null;  // null = 未知，true = 喜神，false = 忌神
  if (targetWx) {
    if (favorableWuxing?.has?.(targetWx))   isXi = true;
    if (unfavorableWuxing?.has?.(targetWx)) isXi = false;
  }

  // ── 开墓库 ────────────────────────────────────────────────
  if (top.type === MECH.KAI_MU) {
    return {
      state_change: top.description,
      new_stability: 'dynamic',
      is_activated: vigorOk,
      event_type: EVENT.KAI_MU,
      auspice_direction: vigorOk ? '开墓库（封藏→透出）' : '冲力不足，墓未全开',
    };
  }

  // ── 合动（解冲稳固）── 婚姻落定/进财/升迁的核心应期 ──────
  if (top.type === MECH.HE_DONG) {
    const evType = deriveEventTypeFromSubcat(subcat, 'he_dong');
    return {
      state_change: `原局${base === 'dynamic' ? '冲动状态被合解' : '目标元素被合住'}：${top.description}`,
      new_stability: 'stable',
      is_activated: vigorOk,
      event_type: evType,
      auspice_direction: vigorOk ? null : '合力不足，事成概率偏低',
    };
  }

  // ── 冲动 ──────────────────────────────────────────────────
  if (top.type === MECH.CHONG_DONG) {
    const evType = deriveEventTypeFromSubcat(subcat, 'chong_dong');
    return {
      state_change: `${base === 'stable' ? '安静状态被冲动' : '冲动加剧'}：${top.description}`,
      new_stability: 'dynamic',
      is_activated: vigorOk,
      event_type: evType,
      auspice_direction: deriveFourDirectionAuspice(dir, isXi),
      auspice_xi: isXi,
    };
  }

  // ── 透干引动 ─────────────────────────────────────────────
  if (top.type === MECH.TOU_GAN) {
    return {
      state_change: top.description,
      new_stability: base === 'buried' ? 'dynamic' : base,
      is_activated: vigorOk,
      event_type: deriveEventTypeFromSubcat(subcat, 'he_dong'),
      auspice_direction: '透干为最直接引动，应期明确',
    };
  }

  // ── 伏吟 ─────────────────────────────────────────────────
  if (top.type === MECH.FU_YIN) {
    return {
      state_change: top.description,
      new_stability: 'dynamic',
      is_activated: true,
      event_type: EVENT.TURMOIL,
      auspice_direction: '伏吟叠压，积压爆发，需看柱主五行喜忌判吉凶',
    };
  }

  // ── 反吟 ─────────────────────────────────────────────────
  if (top.type === MECH.FAN_YIN) {
    // 反吟是最极端的冲，direction 固定为 equal（双向撕裂）
    const fanYinAuspice = isXi === false
      ? '去凶则利（反吟撕裂忌神，反为大吉）'
      : isXi === true
        ? '去吉则害（反吟撕裂喜神，结构崩裂，大凶）'
        : '反吟天克地冲，结构撕裂，为大凶象';
    return {
      state_change: top.description,
      new_stability: 'dynamic',
      is_activated: true,
      event_type: EVENT.TURMOIL,
      auspice_direction: fanYinAuspice,
      auspice_xi: isXi,
    };
  }

  // ── 填实三刑 ─────────────────────────────────────────────
  if (top.type === MECH.TIAN_SHI_XING) {
    return {
      state_change: top.description,
      new_stability: 'dynamic',
      is_activated: vigorOk,
      event_type: EVENT.TURMOIL,
      auspice_direction: deriveFourDirectionAuspice(dir, isXi),
      auspice_xi: isXi,
    };
  }

  // ── 合化变质 ─────────────────────────────────────────────
  if (top.type === MECH.HE_HUA) {
    return {
      state_change: `目标元素被合化变质（五行改变）：${top.description}`,
      new_stability: 'damaged',
      is_activated: true,
      event_type: EVENT.TURMOIL,
      auspice_direction: '合化脱胎换骨，目标元素失去本性，需看化出五行是喜是忌',
    };
  }

  // ── 合而不化 / 填实三合 ──────────────────────────────────
  if (top.type === MECH.HE_BU_HUA) {
    return {
      state_change: `目标元素被合住羁绊（合而不化）：${top.description}`,
      new_stability: 'stable',
      is_activated: false,
      event_type: null,
      auspice_direction: '羁绊停滞，事情难以推进',
    };
  }

  if (top.type === MECH.TIAN_SHI) {
    return {
      state_change: `填实三合，合力大增：${top.description}`,
      new_stability: 'dynamic',
      is_activated: true,
      event_type: EVENT.TURMOIL,
      auspice_direction: '三合局完整，结构性大变动，需看化出五行喜忌判断吉凶方向',
    };
  }

  // 兜底
  return {
    state_change: `${top.type}作用于${top.target_pillar}柱`,
    new_stability: 'dynamic',
    is_activated: vigorOk,
    event_type: EVENT.TURMOIL,
    auspice_direction: null,
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 3：大运场域分类（Step 3）
// ─────────────────────────────────────────────────────────────

const FIELD_TYPE_LABEL = {
  [MECH.HE_DONG]:       '吉场（合解稳固）',
  [MECH.TIAN_SHI]:      '吉场（三合聚力）',
  [MECH.TOU_GAN]:       '引动场（透干显现）',
  [MECH.KAI_MU]:        '开墓场（封藏透出）',
  [MECH.CHONG_DONG]:    '凶场（冲动激荡）',
  [MECH.FAN_YIN]:       '凶场（反吟撕裂）',
  [MECH.TIAN_SHI_XING]: '凶场（三刑网络激活）',
  [MECH.HE_HUA]:        '变局场（合化变质）',
  [MECH.FU_YIN]:        '羁绊场（伏吟叠压）',
  [MECH.HE_BU_HUA]:     '羁绊场（合而不化）',
};

/**
 * 根据大运机制列表，分类大运建立的"场"
 * @param {object[]} mechanisms
 * @param {Set<string>} targetPillarNames
 * @returns {string}
 */
function classifyDayunField(mechanisms, targetPillarNames) {
  const relevant = mechanisms.filter(
    m => m.type === MECH.KAI_MU || targetPillarNames.has(m.target_pillar)
  );
  if (relevant.length === 0) return '旁观场（大运未直接引动目标元素）';
  const top = relevant[0];
  return FIELD_TYPE_LABEL[top.type] ?? '旁观场（大运未直接引动目标元素）';
}

// ─────────────────────────────────────────────────────────────
// Phase 3：综合断语生成
// ─────────────────────────────────────────────────────────────

const STABILITY_LABEL = {
  strong:  '强旺稳固',
  stable:  '平稳安静',
  dynamic: '动荡不稳',
  buried:  '封藏入墓',
  damaged: '受损变质',
};

function buildDynamicVerdict({ dayunImpact, liunianImpact, targetTrigger, targetSpec }) {
  const lines = [];

  lines.push(`【大运分析】${dayunImpact.gan}${dayunImpact.zhi}（${dayunImpact.twelve_phase}，命主状态 ${dayunImpact.trigger_vigor}）`);
  lines.push(`  场域性质：${dayunImpact.field_type}`);
  if (dayunImpact.gaitou_jiejiao !== 'neutral' && dayunImpact.gaitou_jiejiao !== 'same') {
    lines.push(`  ${dayunImpact.gaitou_jiejiao_note}`);
  }
  const dayunTopMechs = dayunImpact.mechanisms.slice(0, 2);
  dayunTopMechs.forEach(m => lines.push(`  ▸ [${m.type}] ${m.description}（机制强度 ${m.effective_strength}）`));
  if (dayunTopMechs.length === 0) lines.push('  ▸ 大运未直接引动目标元素，以建立场域为主');

  lines.push('');
  lines.push(`【流年分析】${liunianImpact.gan}${liunianImpact.zhi}（${liunianImpact.twelve_phase}，命主状态 ${liunianImpact.trigger_vigor}）`);
  if (liunianImpact.gaitou_jiejiao !== 'neutral' && liunianImpact.gaitou_jiejiao !== 'same') {
    lines.push(`  ${liunianImpact.gaitou_jiejiao_note}`);
  }
  const liunianTopMechs = liunianImpact.mechanisms.slice(0, 2);
  liunianTopMechs.forEach(m => lines.push(`  ▸ [${m.type}] ${m.description}（机制强度 ${m.effective_strength}）`));
  if (liunianTopMechs.length === 0) lines.push('  ▸ 流年无直接引动');

  lines.push('');
  lines.push(`【目标元素引动结论】`);
  lines.push(`  基准状态：${targetTrigger.base_state}`);
  lines.push(`  状态变化：${targetTrigger.state_change}`);
  lines.push(`  新稳定性：${STABILITY_LABEL[targetTrigger.new_stability] ?? targetTrigger.new_stability}`);
  lines.push(`  目标是否被引动：${targetTrigger.is_activated ? '是' : '否（机制存在但强度不足）'}`);
  if (targetTrigger.event_type) {
    lines.push(`  推断事件类型：${targetTrigger.event_type}`);
  }
  if (targetTrigger.auspice_direction) {
    lines.push(`  吉凶方向参考：${targetTrigger.auspice_direction}`);
  }

  const isMajor = dayunImpact.activates_target && liunianImpact.activates_target;
  if (isMajor) {
    lines.push('');
    lines.push('  ⚠ 大运流年双重引动目标元素，为重大事件窗口。');
  }

  return lines.join('\n');
}

/**
 * 格式化为 LLM prompt 注入片段
 *
 * @param {object} report assessDynamicTriggers 输出
 * @param {object} [options]
 * @param {number} [options.maxMechanisms=6] 结构化机制清单注入条数上限（供 phenomena/应期选取，原 dynamic_verdict 只含 top-2/柱）
 */
function formatDynamicReportForPrompt(report, options = {}) {
  const { maxMechanisms = 6 } = options;
  const lines = [
    '【大运流年动态分析】',
    MODEL_NOTE,
    report.dynamic_verdict,
  ];

  // 结构化机制清单：dynamic_verdict 仅含每柱 top-2，这里补全（按机制强度排序，带目标柱 + 命主承接状态）
  // 供 v2 流年触发 phenomena[≤4] 选取，并与前端动态面板 mech 行同源
  const mechs = [
    ...((report.dayun_impact?.mechanisms) || []).map(m => ({ ...m, src: '大运' })),
    ...((report.liunian_impact?.mechanisms) || []).map(m => ({ ...m, src: '流年' })),
  ]
    .sort((a, b) => (b.effective_strength || 0) - (a.effective_strength || 0))
    .slice(0, maxMechanisms);

  if (mechs.length) {
    lines.push('【引动机制清单（按机制强度排序，含目标柱与命主承接状态，供现象/应期选取）】');
    for (const m of mechs) {
      const subjectVigor = Math.round(((m.vigor_check?.trigger_vigor ?? 0) > 1 ? m.vigor_check.trigger_vigor / 100 : (m.vigor_check?.trigger_vigor ?? 0)) * 100);
      const carry = subjectVigor >= 50 ? '承接较强' : subjectVigor >= 35 ? '承接中等' : '承接偏弱';
      lines.push(`  · [${m.src}·${m.type}] 目标${m.target_pillar || '—'}柱｜机制强度${m.effective_strength}｜命主状态${subjectVigor}%（${carry}）｜${m.description}`);
    }
  }

  if (report.image_luck_effect) {
    const effect = report.image_luck_effect;
    const reasonCodes = effect.reason_codes?.length
      ? `；reason_codes: ${effect.reason_codes.join(', ')}`
      : '';
    lines.push(
      `【形象岁运诊断】status: ${effect.status}；score_delta: ${effect.score_delta}；text: ${effect.text ?? effect.description ?? ''}${reasonCodes}`
    );
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// 主入口：assessDynamicTriggers
// ─────────────────────────────────────────────────────────────

/**
 * 评估大运流年对目标元素的引动
 *
 * @param {object} p
 * @param {object} p.matrix              - 原局矩阵（含 pillars[4]）
 * @param {object} p.targetSpec          - Step 1 输出（resolveTargetElement）
 * @param {object} p.stateReport         - Step 2 输出（assessOriginalChartState）
 * @param {string} p.dayStem             - 日干
 * @param {string} p.dayunGan            - 大运天干
 * @param {string} p.dayunZhi            - 大运地支
 * @param {string} p.liunianGan          - 流年天干
 * @param {string} p.liunianZhi          - 流年地支
 * @param {Set<string>} [p.favorableWuxing]   - 喜用神五行集合（如 new Set(['火','土'])）
 * @param {Set<string>} [p.unfavorableWuxing] - 忌仇神五行集合
 * @returns {DynamicTriggerReport}
 */
function assessDynamicTriggers({
  matrix, targetSpec, stateReport,
  dayStem, dayunGan, dayunZhi, liunianGan, liunianZhi,
  favorableWuxing, unfavorableWuxing,
}) {
  const pillars = matrix.pillars;
  const monthPillar = pillars.find(p => p.name === '月');
  const monthZhi = monthPillar?.zhi ?? '';

  // 目标十神短形（用于透干检测）
  const targetShishenShort = normalizeShishens(targetSpec.primary_shishen);

  // 目标元素五行（用于开墓库检测 + Step 7 喜忌方向判断）
  const targetElement = deriveTargetElement(dayStem, targetSpec.primary_shishen);
  // 注入到 stateReport，供 deriveStateChange 读取
  stateReport.target_element_wuxing = targetElement ?? null;

  // 含目标元素的柱名集合（Step 2 已定位）
  // 排除 hidden 藏干位置：藏干权重低，不应主导机制选择
  const targetPillarNames = new Set([
    ...stateReport.shishen_assessments
      .filter(a => a.position !== 'hidden')
      .map(a => a.pillar),
    ...stateReport.gongwei_assessments.map(g => g.pillar_name),
  ]);

  // ── 大运评估：扫描大运 vs 原局4柱 ───────────────────────────
  const dayunImpact = assessPillarImpact({
    incomingName: '大运',
    incomingGan: dayunGan,
    incomingZhi: dayunZhi,
    pillars,       // 只扫描原局
    dayStem,
    monthZhi,
    stateReport,
    targetElement,
    targetPillarNames,
    targetShishenShort,
  });

  // ── 流年评估：扫描流年 vs 原局4柱 + 大运 ────────────────────
  // 大运已建场，流年"见到"大运的加持
  const extendedPillars = [
    ...pillars,
    { name: '大运', gan: dayunGan, zhi: dayunZhi, hidden_stems: C.ZHI5_LIST[dayunZhi] ?? [], is_kong: false },
  ];

  const liunianImpact = assessPillarImpact({
    incomingName: '流年',
    incomingGan: liunianGan,
    incomingZhi: liunianZhi,
    pillars: extendedPillars,
    dayStem,
    monthZhi,
    stateReport,
    targetElement,
    targetPillarNames,
    targetShishenShort,
  });

  // ── 状态变化推断 ─────────────────────────────────────────────
  const targetTrigger = deriveStateChange({
    stateReport,
    targetSpec,
    dayunImpact,
    liunianImpact,
    targetPillarNames,
    favorableWuxing:   favorableWuxing   instanceof Set ? favorableWuxing   : null,
    unfavorableWuxing: unfavorableWuxing instanceof Set ? unfavorableWuxing : null,
  });
  targetTrigger.base_state = stateReport.base_state;

  // ── Step 3：大运场域分类 ─────────────────────────────────────
  dayunImpact.field_type = classifyDayunField(dayunImpact.mechanisms, targetPillarNames);

  // ── 综合断语 ─────────────────────────────────────────────────
  const dynamic_verdict = buildDynamicVerdict({
    dayunImpact, liunianImpact, targetTrigger, targetSpec,
  });
  const image_luck_effect = assessImageLuckEffect({
    imageContext: stateReport.image_context,
    dayStem,
    dayunGan,
    dayunZhi,
    liunianGan,
    liunianZhi,
  });

  return {
    dayun_impact: dayunImpact,
    liunian_impact: liunianImpact,
    target_trigger: targetTrigger,
    dayun_gtj: dayunImpact.gaitou_jiejiao,
    liunian_gtj: liunianImpact.gaitou_jiejiao,
    image_luck_effect,
    dynamic_verdict,
  };
}

// ─────────────────────────────────────────────────────────────
// 工具：从 primary_shishen 推导目标五行（与 assessor 一致）
// ─────────────────────────────────────────────────────────────

const WUXING_KE_BY     = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const WUXING_KE_TARGET = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };

function deriveTargetElement(dayStem, primaryShishens) {
  if (!dayStem || !primaryShishens?.length) return null;
  const dayWx = C.GAN5[dayStem];
  if (!dayWx) return null;
  const first = normalizeShishens([primaryShishens[0]])[0];
  if (first === '财' || first === '才') return WUXING_KE_BY[dayWx];
  if (first === '官' || first === '杀') return WUXING_KE_TARGET[dayWx];
  if (first === '印' || first === '枭') {
    const keTarget = WUXING_KE_TARGET[dayWx];
    return WUXING_KE_BY[keTarget];
  }
  if (first === '食' || first === '伤') {
    const keBy = WUXING_KE_BY[dayWx];
    return WUXING_KE_TARGET[keBy];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────

module.exports = {
  assessDynamicTriggers,
  assessImageLuckEffect,
  classifyDayunField,
  FIELD_TYPE_LABEL,
  SAN_XING_GROUPS,
  formatDynamicReportForPrompt,
  // 暴露给测试
  isFuyin,
  isFantin,
  isOpenTomb,
  buildExtendedPillars,
  MECH,
  EVENT,
};
