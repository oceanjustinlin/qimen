const { GAN5, ZHI5_LIST } = require('./constants/core');
const { TIAOHOUS } = require('./constants/tiaohou');

const IMAGE_CATEGORY = Object.freeze({
  NONE: 'NONE',
  SINGLE_IMAGE: 'SINGLE_IMAGE',
  TWO_QI_IMAGE: 'TWO_QI_IMAGE',
  FOLLOW_IMAGE: 'FOLLOW_IMAGE',
  TRANSFORMATION_IMAGE: 'TRANSFORMATION_IMAGE',
});

const CONFIG_VERSION = 'image-score-v2';
const OVERRIDE_MIN_SCORE = 80;
const PURE_MIN_SCORE = 95;
const DOMINANT_MIN_RATIO = 0.4;
const STRONG_ORIGINAL_QI_ROOT_MIN_SCORE = 1;
const TWO_QI_BALANCE_MAX_DIFF = 0.25;

const WUXING = ['木', '火', '土', '金', '水'];
const GAN_WUXING = GAN5;
const ZHI_CANGGAN = ZHI5_LIST;

const CANGGAN_WEIGHTS = [0.8, 0.5, 0.3];

const WUXING_KE = Object.freeze({
  木: '土',
  火: '金',
  土: '水',
  金: '木',
  水: '火',
});

const WUXING_SHENG = Object.freeze({
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
});

const WUXING_KE_BY = invertMap(WUXING_KE);
const WUXING_SHENG_BY = invertMap(WUXING_SHENG);

const SINGLE_IMAGE_NAMES = Object.freeze({
  木: '曲直格',
  火: '炎上格',
  土: '稼穑格',
  金: '从革格',
  水: '润下格',
});

const STEM_COMBINES = Object.freeze({
  甲己: '土',
  己甲: '土',
  乙庚: '金',
  庚乙: '金',
  丙辛: '水',
  辛丙: '水',
  丁壬: '木',
  壬丁: '木',
  戊癸: '火',
  癸戊: '火',
});

const DIMENSION_META = Object.freeze({
  target_qi_score: { max: null, text: '目标气势' },
  target_qi_ratio: { max: 1, text: '目标占比' },
  dominance_points: { max: 45, text: '主导气势' },
  rootlessness_points: { max: 25, text: '日主无根' },
  month_command_points: { max: 20, text: '月令助力' },
  exposed_target_points: { max: 15, text: '透干助力' },
  complete_single_image_frame_points: { max: 15, text: '完整三合局' },
  visible_support_penalty: { max: 30, text: '扶身干扰' },
  has_visible_support: { max: null, text: '是否有明扶' },
  is_global_dominant: { max: null, text: '是否全局主导' },
  meets_dominant_ratio: { max: null, text: '是否达到主导占比' },
  follow_chain_ratio: { max: 1, text: '所从顺生链占比' },
  follow_chain_points: { max: 20, text: '所从顺生链助力' },
  weak_follow_points: { max: 25, text: '弃命从势证据' },
  anchored_support: { max: null, text: '日主是否有近身强援' },
  same_camp_dominance_points: { max: 45, text: '同党气势' },
  purity_points: { max: 35, text: '气势纯度' },
  same_camp_branch_frame_points: { max: 25, text: '同党支势' },
  counter_qi_ratio: { max: 1, text: '制衡占比' },
  counter_qi_exposed_count: { max: null, text: '制衡透干' },
  counter_qi_branch_count: { max: 4, text: '制衡根气' },
  powerful_counter_penalty: { max: 30, text: '强力制衡' },
  wealth_qi_ratio: { max: 1, text: '财气占比' },
  wealth_drain_penalty: { max: 10, text: '财星泄气' },
  mixed_qi_ratio: { max: 1, text: '杂气占比' },
  mixed_qi_penalty: { max: 15, text: '杂气干扰' },
  adjacent_stem_combine_points: { max: 25, text: '相邻天干合' },
  branch_support_count: { max: 4, text: '地支助化' },
  branch_support_points: { max: 20, text: '地支助化分' },
  no_jealous_combine_points: { max: 10, text: '无争合' },
  competing_partner_count: { max: null, text: '争合数量' },
  competing_day_stem_count: { max: null, text: '日干争合' },
  original_qi_root_count: { max: 4, text: '原气根数' },
  original_qi_primary_root_count: { max: 4, text: '原气主根' },
  original_qi_root_score: { max: null, text: '原气根分' },
  original_qi_weak_points: { max: 10, text: '原气弱化' },
  transform_qi_ratio: { max: 1, text: '化气占比' },
  transform_qi_counter_ratio: { max: 1, text: '化气受制' },
  transform_qi_intact_points: { max: 10, text: '化气完整' },
  transform_qi_damage_penalty: { max: 20, text: '化气受损' },
  two_qi_combined_ratio: { max: 1, text: '两气合计' },
  two_qi_combined_points: { max: 45, text: '两气集中' },
  two_qi_ratio_difference: { max: 1, text: '两气差值' },
  two_qi_balance_points: { max: 25, text: '两气均衡' },
  low_mixed_qi_points: { max: 20, text: '少杂气' },
  mixed_force_points: { max: 35, text: '从势基础' },
  mixed_force_combined_ratio: { max: 1, text: '从势占比' },
  mixed_force_combined_points: { max: 35, text: '从势集中' },
  no_visible_support_points: { max: 15, text: '无明扶' },
});

const PENALTY_META = Object.freeze({
  DM_HAS_SUPPORT: { score: 0, text: '日主仍有扶助，未取得无根加分' },
  POWERFUL_COUNTER_QI: { score: -30, text: '制衡气势偏强' },
  WEALTH_DRAINS_DOMINANT_QI: { score: -10, text: '财星泄耗主势' },
  MIXED_QI_BREAKS_SINGLE_IMAGE: { score: -15, text: '杂气破坏专旺' },
  JEALOUS_COMBINE_CAP_79: { score: 0, text: '争合使成象分封顶至 79' },
  DM_HAS_STRONG_ROOT_CAP_79: { score: 0, text: '日主强根使成象分封顶至 79' },
  DM_HAS_SEAL_CAP_79: { score: 0, text: '印星透干生身，日主恋印不化，成象分封顶至 79' },
  TRANSFORM_QI_DAMAGED: { score: -20, text: '化气受到损伤' },
});

function invertMap(mapping) {
  return Object.freeze(
    Object.fromEntries(Object.entries(mapping).map(([from, to]) => [to, from])),
  );
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 2) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function getMatchMeta(score) {
  if (score >= PURE_MIN_SCORE) return { label: '高纯度成象', level: 'PURE' };
  if (score >= OVERRIDE_MIN_SCORE) return { label: '成象', level: 'FORMED' };
  if (score >= 60) return { label: '疑似成象', level: 'SUSPECTED' };
  return { label: '未成象', level: 'NOT_FORMED' };
}

function isValidChartInput(input) {
  const { dayGan, gans, zhis, monthZhi } = input || {};

  return Boolean(
    Object.hasOwn(GAN_WUXING, dayGan)
    && Array.isArray(gans)
    && gans.length === 4
    && gans.every((gan) => Object.hasOwn(GAN_WUXING, gan))
    && Array.isArray(zhis)
    && zhis.length === 4
    && zhis.every((zhi) => Object.hasOwn(ZHI_CANGGAN, zhi))
    && Object.hasOwn(ZHI_CANGGAN, monthZhi)
    && dayGan === gans[2]
    && monthZhi === zhis[1],
  );
}

function getGanElement(gan) {
  return Object.hasOwn(GAN_WUXING, gan) ? GAN_WUXING[gan] : undefined;
}

function getHiddenStems(zhi) {
  return Object.hasOwn(ZHI_CANGGAN, zhi) ? ZHI_CANGGAN[zhi] : [];
}

function getWuxingScores({ gans = [], zhis = [] }) {
  const scores = Object.fromEntries(WUXING.map((element) => [element, 0]));

  for (const gan of gans) {
    const element = getGanElement(gan);
    if (element) scores[element] += 1;
  }

  for (const zhi of zhis) {
    for (const [index, gan] of getHiddenStems(zhi).entries()) {
      scores[getGanElement(gan)] += CANGGAN_WEIGHTS[index];
    }
  }

  return Object.fromEntries(
    Object.entries(scores).map(([element, score]) => [element, round(score)]),
  );
}

function getTotalScore(wuxingScores) {
  return Object.values(wuxingScores).reduce((sum, score) => sum + score, 0);
}

function getElementRatio(wuxingScores, element) {
  const totalScore = getTotalScore(wuxingScores);
  return totalScore ? wuxingScores[element] / totalScore : 0;
}

function getMonthElement(monthZhi) {
  return getGanElement(getHiddenStems(monthZhi)[0]);
}

function countSupportingBranches(zhis, targetElement) {
  return zhis.filter((zhi) =>
    getHiddenStems(zhi).some((gan) => getGanElement(gan) === targetElement),
  ).length;
}

function getBranchElementScore(zhis, targetElement) {
  return zhis.reduce((total, zhi) =>
    total + getHiddenStems(zhi).reduce((branchTotal, gan, index) =>
      branchTotal + (getGanElement(gan) === targetElement ? CANGGAN_WEIGHTS[index] : 0),
    0),
  0);
}

function countPrimaryBranchRoots(zhis, targetElement) {
  return zhis.filter((zhi) =>
    getGanElement(getHiddenStems(zhi)[0]) === targetElement,
  ).length;
}

function countExposedElements(gans = [], targetElement, skipDayGan = true) {
  return gans.filter((gan, index) =>
    (!skipDayGan || index !== 2) && getGanElement(gan) === targetElement,
  ).length;
}

function elementHasBranchRoot(zhis = [], targetElement) {
  return countSupportingBranches(zhis, targetElement) > 0;
}

function getTiaohouElements(dayGan, monthZhi) {
  const raw = TIAOHOUS[`${dayGan}${monthZhi}`] || '';
  return [...new Set(Array.from(raw)
    .filter((char) => Object.hasOwn(GAN_WUXING, char))
    .map((gan) => GAN_WUXING[gan]))];
}

function getDmSupport({ dayGan, gans = [], zhis = [], dayGanIndex = 2 }) {
  const dmElement = getGanElement(dayGan);
  if (!dmElement) throw new Error(`Unknown day gan: ${dayGan}`);

  const sealElement = WUXING_SHENG_BY[dmElement];
  const exposedGans = gans.filter((_, index) => index !== dayGanIndex);
  const branchElements = zhis.map((zhi) =>
    getHiddenStems(zhi).map((gan) => getGanElement(gan)),
  );

  const exposedSame = exposedGans.filter((gan) => getGanElement(gan) === dmElement).length;
  const exposedSeal = exposedGans.filter((gan) => getGanElement(gan) === sealElement).length;
  const branchSameRoots = branchElements.filter((elements) => elements.includes(dmElement)).length;
  const branchSealRoots = branchElements.filter((elements) => elements.includes(sealElement)).length;

  return {
    dm_element: dmElement,
    seal_element: sealElement,
    exposed_same: exposedSame,
    exposed_seal: exposedSeal,
    branch_same_roots: branchSameRoots,
    branch_seal_roots: branchSealRoots,
    is_rootless: branchSameRoots === 0 && branchSealRoots === 0,
  };
}

function finalizeCandidate(candidate) {
  const {
    reviewed_override_min_score: reviewedOverrideMinScore,
    force_override: forceOverride,
    ...publicCandidate
  } = candidate;
  const matchScore = round(clamp(candidate.match_score || 0));
  const matchMeta = getMatchMeta(matchScore);
  const overrideMinScore = reviewedOverrideMinScore ?? OVERRIDE_MIN_SCORE;
  const overrideAllowed =
    candidate.allow_override !== false
    && (forceOverride === true || matchScore >= overrideMinScore);
  const overrideScope = candidate.override_scope
    ?? (overrideAllowed ? 'full' : (candidate.category === IMAGE_CATEGORY.NONE ? 'none' : 'display_only'));

  return {
    ...publicCandidate,
    match_score: matchScore,
    match_label: matchMeta.label,
    match_level: matchMeta.level,
    override_scope: overrideScope,
    override_normal_pattern:
      ['full', 'xiji_yongshen', 'yongshen_only'].includes(overrideScope)
      && overrideAllowed,
    dimensions: candidate.dimensions || {},
    penalties: candidate.penalties || [],
    reason_codes: candidate.reason_codes || [],
  };
}

function serializeDimensions(dimensions = {}) {
  return Object.entries(dimensions).map(([key, score]) => {
    const meta = DIMENSION_META[key];

    return {
      key,
      score,
      max: meta?.max ?? null,
      text: meta?.text || `未定义指标：${key}`,
    };
  });
}

function serializePenalties(penalties = []) {
  return penalties.map((key) => {
    const meta = PENALTY_META[key];

    return {
      key,
      score: meta?.score ?? 0,
      text: meta?.text || `未定义扣分项：${key}`,
    };
  });
}

function serializeCandidate(candidate) {
  if (!candidate) return null;

  const {
    match_level: matchLevel,
    dimensions,
    penalties,
    ...fields
  } = candidate;

  return {
    ...fields,
    status: matchLevel,
    dimensions: serializeDimensions(dimensions),
    penalties: serializePenalties(penalties),
  };
}

function scoreFollowCandidates(input, { followWeakV2 = true } = {}) {
  const { dayGan, gans = [], zhis = [], monthZhi } = input || {};

  const dmSupport = getDmSupport({ dayGan, gans, zhis });
  const wuxingScores = getWuxingScores({ gans, zhis });
  const totalScore = getTotalScore(wuxingScores);
  const monthElement = getMonthElement(monthZhi);
  const relations = [
    { subtype: '从财格', target: WUXING_KE[dmSupport.dm_element], reason: 'WEALTH_QI_DOMINANT' },
    { subtype: '从官杀格', target: WUXING_KE_BY[dmSupport.dm_element], reason: 'OFFICER_KILL_QI_DOMINANT' },
    { subtype: '从儿格', target: WUXING_SHENG[dmSupport.dm_element], reason: 'OUTPUT_QI_DOMINANT' },
  ];

  return relations.map(({ subtype, target, reason }) => {
    const targetScore = wuxingScores[target];
    const targetRatio = totalScore ? targetScore / totalScore : 0;
    const exposedTarget = gans.filter((gan, index) =>
      index !== 2 && getGanElement(gan) === target,
    ).length;
    const dominancePoints = Math.min(45, targetRatio * 90);
    const rootlessnessPoints = dmSupport.is_rootless ? 25 : 0;
    const monthCommandPoints = monthElement === target ? 15 : 0;
    const exposedTargetPoints = Math.min(15, exposedTarget * 7.5);
    const penalties = [];
    const reasonCodes = [];
    // 从儿格特例（《滴天髓·顺局》"从儿不管身强弱，只要吾儿又得儿"；任注举"天干三透辛金而
    // 地支临绝，格取从儿"）：从儿格中天干透出的比劫若地支无根，属虚浮泄气、顺生食伤之势，
    // 不构成有效帮身，不阻止从儿成格。但印星逆食伤之气，仍按破格论（印不豁免）。
    // 从财/从官杀/从势维持《三命通会》"四柱无一点比肩印绶方论"的严格真从底线（不豁免）。
    const effectiveExposedSame =
      subtype === '从儿格' && dmSupport.branch_same_roots === 0 ? 0 : dmSupport.exposed_same;
    const hasVisibleSupport = effectiveExposedSame > 0 || dmSupport.exposed_seal > 0;
    const visibleSupportPenalty = Math.min(
      30,
      (effectiveExposedSame + dmSupport.exposed_seal) * 20,
    );
    const isGlobalDominant = targetScore === Math.max(...Object.values(wuxingScores));
    const meetsDominantRatio = targetRatio >= DOMINANT_MIN_RATIO;
    const strictOverride =
      dmSupport.is_rootless
      && !hasVisibleSupport
      && isGlobalDominant
      && meetsDominantRatio;
    const outputElement = WUXING_SHENG[dmSupport.dm_element];
    const wealthElement = WUXING_KE[dmSupport.dm_element];
    const officerKillElement = WUXING_KE_BY[dmSupport.dm_element];
    const flowElements = subtype === '从财格'
      ? [outputElement, wealthElement, officerKillElement]
      : subtype === '从官杀格'
        ? [wealthElement, officerKillElement]
        : [outputElement, wealthElement];
    const followChainRatio = [...new Set(flowElements)]
      .reduce((sum, element) => sum + getElementRatio(wuxingScores, element), 0);
    const followChainPoints = Math.min(20, followChainRatio * 20);
    const primaryDmRoots = countPrimaryBranchRoots(zhis, dmSupport.dm_element);
    const primarySealRoots = countPrimaryBranchRoots(zhis, dmSupport.seal_element);
    const exposedOutput = countExposedElements(gans, outputElement);
    const daySeatElement = getMonthElement(zhis[2]);
    const falseSealAid = dmSupport.exposed_seal > 0
      && exposedOutput > 0
      && primarySealRoots === 0;
    const coldWetEarthCollapse = dmSupport.dm_element === '土'
      && ['亥', '子', '丑'].includes(monthZhi)
      && wuxingScores['火'] === 0;
    const substantialRemoteSupport = primaryDmRoots + primarySealRoots >= 2
      && !coldWetEarthCollapse;
    const anchoredSupport =
      dmSupport.exposed_same > 0
      || [dmSupport.dm_element, dmSupport.seal_element].includes(monthElement)
      || [dmSupport.dm_element, dmSupport.seal_element].includes(daySeatElement)
      || (dmSupport.exposed_seal > 0 && !falseSealAid)
      || substantialRemoteSupport;
    const relaxedRatioMin = subtype === '从官杀格' ? 0.35 : 0.3;
    const relaxedChainMin = subtype === '从官杀格' ? 0.55 : 0.5;
    const relaxedOverride = followWeakV2
      && !strictOverride
      && !anchoredSupport
      && isGlobalDominant
      && targetRatio >= relaxedRatioMin
      && followChainRatio >= relaxedChainMin;
    const allowOverride = strictOverride || relaxedOverride;
    const weakFollowPoints = relaxedOverride ? 25 : 0;
    const effectiveVisibleSupportPenalty = relaxedOverride ? 0 : visibleSupportPenalty;
    const resolvedSubtype = relaxedOverride && subtype === '从官杀格' && exposedTarget >= 2
      ? '从杀格'
      : subtype;

    if (dmSupport.is_rootless) reasonCodes.push('DM_ROOTLESS');
    if (meetsDominantRatio && isGlobalDominant) {
      reasonCodes.push(reason);
    }
    if (hasVisibleSupport) reasonCodes.push('DM_HAS_VISIBLE_SUPPORT');
    if (!dmSupport.is_rootless) penalties.push('DM_HAS_SUPPORT');
    if (relaxedOverride) {
      reasonCodes.push('DM_SUPPORT_INEFFECTIVE', 'FOLLOW_CHAIN_DOMINANT');
    }

    return finalizeCandidate({
      category: IMAGE_CATEGORY.FOLLOW_IMAGE,
      subtype: resolvedSubtype,
      target_element: target,
      target_elements: relaxedOverride ? [...new Set(flowElements)] : undefined,
      follow_mode: relaxedOverride ? 'RELAXED_WEAK' : 'STRICT',
      match_score:
        dominancePoints
        + rootlessnessPoints
        + monthCommandPoints
        + exposedTargetPoints
        + weakFollowPoints
        + (relaxedOverride ? followChainPoints : 0)
        - effectiveVisibleSupportPenalty,
      dimensions: {
        target_qi_score: targetScore,
        target_qi_ratio: round(targetRatio),
        dominance_points: round(dominancePoints),
        rootlessness_points: rootlessnessPoints,
        month_command_points: monthCommandPoints,
        exposed_target_points: exposedTargetPoints,
        visible_support_penalty: effectiveVisibleSupportPenalty,
        has_visible_support: hasVisibleSupport,
        is_global_dominant: isGlobalDominant,
        meets_dominant_ratio: meetsDominantRatio,
        follow_chain_ratio: round(followChainRatio),
        follow_chain_points: round(relaxedOverride ? followChainPoints : 0),
        weak_follow_points: weakFollowPoints,
        anchored_support: anchoredSupport,
        primary_dm_roots: primaryDmRoots,
        primary_seal_roots: primarySealRoots,
      },
      penalties,
      reason_codes: reasonCodes,
      yongshen_strategy: 'FOLLOW_FORCE',
      allow_override: allowOverride,
    });
  });
}

function scoreSingleImage(input) {
  const { dayGan, gans, zhis, monthZhi } = input;
  const wuxingScores = getWuxingScores(input);
  const dmElement = getGanElement(dayGan);
  const targetRatio = getElementRatio(wuxingScores, dmElement);
  const counterElement = WUXING_KE_BY[dmElement];
  const wealthElement = WUXING_KE[dmElement];
  const counterRatio = getElementRatio(wuxingScores, counterElement);
  const wealthRatio = getElementRatio(wuxingScores, wealthElement);
  const counterExposed = gans.filter((gan) => getGanElement(gan) === counterElement).length;
  const counterBranches = countSupportingBranches(zhis, counterElement);
  const wealthBranches = countSupportingBranches(zhis, wealthElement);
  const monthCommandPoints = getMonthElement(monthZhi) === dmElement ? 20 : 0;
  const sameCampDominancePoints = Math.min(45, targetRatio * 70);
  const purityPoints = Math.min(35, targetRatio * 35);
  const sealElement = WUXING_SHENG_BY[dmElement];
  const allBranchesSupportSameCamp = zhis.every((zhi) => {
    const elements = getHiddenStems(zhi).map(getGanElement);
    return elements.includes(dmElement) || elements.includes(sealElement);
  });
  const sameCampBranchFramePoints =
    targetRatio >= 0.45
    && allBranchesSupportSameCamp
    && counterBranches === 0
    && wealthBranches === 0
      ? 25
      : 0;
  const powerfulCounterPenalty =
    counterRatio >= 0.18 && (counterExposed > 0 || counterBranches > 0) ? 30 : 0;
  const wealthDrainPenalty = wealthRatio >= 0.18 && sameCampBranchFramePoints === 0 ? 10 : 0;
  const mixedQiRatio = counterRatio + wealthRatio;
  const mixedQiPenalty = mixedQiRatio >= DOMINANT_MIN_RATIO ? 15 : 0;
  const completeWoodFramePoints = dmElement === '木' && ['亥', '卯', '未'].every(branch => zhis.includes(branch)) ? 15 : 0;
  const penalties = [];
  const reasonCodes = [];

  if (targetRatio >= 0.55) reasonCodes.push('TARGET_QI_DOMINANT');
  if (powerfulCounterPenalty) {
    penalties.push('POWERFUL_COUNTER_QI');
    reasonCodes.push('SINGLE_IMAGE_COUNTERED');
  }
  if (wealthDrainPenalty) {
    penalties.push('WEALTH_DRAINS_DOMINANT_QI');
    reasonCodes.push('SINGLE_IMAGE_WEALTH_DRAIN');
  }
  if (mixedQiPenalty) {
    penalties.push('MIXED_QI_BREAKS_SINGLE_IMAGE');
    reasonCodes.push('SINGLE_IMAGE_MIXED_QI');
  }
  if (completeWoodFramePoints) reasonCodes.push('SINGLE_IMAGE_COMPLETE_WOOD_FRAME');
  if (sameCampBranchFramePoints) reasonCodes.push('SINGLE_IMAGE_ALL_BRANCHES_SUPPORT_FORCE');

  return finalizeCandidate({
    category: IMAGE_CATEGORY.SINGLE_IMAGE,
    subtype: SINGLE_IMAGE_NAMES[dmElement],
    target_element: dmElement,
    match_score:
      sameCampDominancePoints
      + monthCommandPoints
      + purityPoints
      + completeWoodFramePoints
      + sameCampBranchFramePoints
      - powerfulCounterPenalty
      - wealthDrainPenalty
      - mixedQiPenalty,
    dimensions: {
      target_qi_score: wuxingScores[dmElement],
      target_qi_ratio: round(targetRatio),
      same_camp_dominance_points: round(sameCampDominancePoints),
      month_command_points: monthCommandPoints,
      purity_points: round(purityPoints),
      complete_single_image_frame_points: completeWoodFramePoints,
      same_camp_branch_frame_points: sameCampBranchFramePoints,
      counter_qi_ratio: round(counterRatio),
      counter_qi_exposed_count: counterExposed,
      counter_qi_branch_count: counterBranches,
      powerful_counter_penalty: powerfulCounterPenalty,
      wealth_qi_ratio: round(wealthRatio),
      wealth_drain_penalty: wealthDrainPenalty,
      mixed_qi_ratio: round(mixedQiRatio),
      mixed_qi_penalty: mixedQiPenalty,
    },
    penalties,
    reason_codes: reasonCodes,
    yongshen_strategy: 'FOLLOW_FORCE',
    // 专旺（曲直/炎上/稼穑/从革/润下/从强）：日主同党极旺成势，比从弱更易辨；评分已扣破局，
    // 将覆盖阈值由 80 降至 73 收割贴边真专旺（曲直74/从革76），破局案分数本就更低（稼穑66/68）不受影响。
    reviewed_override_min_score: 73,
  });
}

function scoreTransformationCandidates(input) {
  const { dayGan, gans, zhis, monthZhi } = input;
  const wuxingScores = getWuxingScores(input);
  const monthElement = getMonthElement(monthZhi);
  const dmSupport = getDmSupport(input);
  const originalQiRootScore = getBranchElementScore(zhis, dmSupport.dm_element);
  const originalQiPrimaryRootCount = countPrimaryBranchRoots(zhis, dmSupport.dm_element);
  const hasStrongOriginalQiRoot =
    originalQiPrimaryRootCount > 0
    || originalQiRootScore >= STRONG_ORIGINAL_QI_ROOT_MIN_SCORE;
  const candidates = new Map();

  for (const partnerIndex of [1, 3]) {
    const partner = gans[partnerIndex];
    const targetElement = STEM_COMBINES[`${dayGan}${partner}`];
    if (!targetElement) continue;

    const subtype = `${dayGan}${partner}化${targetElement}`;
    if (candidates.has(subtype)) continue;

    const counterElement = WUXING_KE_BY[targetElement];
    const targetRatio = getElementRatio(wuxingScores, targetElement);
    const counterRatio = getElementRatio(wuxingScores, counterElement);
    const transformQiDamaged = counterRatio >= DOMINANT_MIN_RATIO;
    const branchSupportCount = countSupportingBranches(zhis, targetElement);
    const branchSupportPoints = Math.min(20, branchSupportCount * 5);
    const monthCommandPoints = monthElement === targetElement ? 20 : 0;
    const competingPartnerCount = gans.filter((gan, index) =>
      index !== 2 && gan === partner,
    ).length;
    const competingDayStemCount = gans.filter((gan) => gan === dayGan).length;
    const jealousCombine = competingPartnerCount > 1 || competingDayStemCount > 1;
    const noJealousCombinePoints = jealousCombine ? 0 : 10;
    // 印星透干生身 → 日主恋印不化（《滴天髓·化象》"化得真者只论化"，真化须日主无依；
    // 印透干则日主有所恃，贪生忘合，至多假化，不取真化 override）。
    // 仅看透干之印（exposed_seal）：藏支微印力弱难夺化，不封顶，与既有"日主强根"封顶逻辑对称。
    const hasTransparentSeal = dmSupport.exposed_seal > 0;
    const originalQiWeakPoints = hasStrongOriginalQiRoot ? 0 : 10;
    const intactPoints = transformQiDamaged ? 0 : targetRatio >= 0.3 ? 10 : targetRatio > 0 ? 5 : 0;
    const transformQiDamagePenalty = transformQiDamaged ? 20 : 0;
    const rawScore =
      25
      + monthCommandPoints
      + branchSupportPoints
      + noJealousCombinePoints
      + originalQiWeakPoints
      + intactPoints
      - transformQiDamagePenalty;
    const capScore = jealousCombine || hasStrongOriginalQiRoot || hasTransparentSeal ? 79 : 100;
    const penalties = [];
    const reasonCodes = ['ADJACENT_STEM_COMBINE'];

    if (jealousCombine) {
      penalties.push('JEALOUS_COMBINE_CAP_79');
      reasonCodes.push('JEALOUS_COMBINE');
    }
    if (hasStrongOriginalQiRoot) {
      penalties.push('DM_HAS_STRONG_ROOT_CAP_79');
      reasonCodes.push('DM_HAS_STRONG_ROOT');
    }
    if (hasTransparentSeal) {
      penalties.push('DM_HAS_SEAL_CAP_79');
      reasonCodes.push('DM_HAS_SEAL');
    }
    if (transformQiDamaged) {
      penalties.push('TRANSFORM_QI_DAMAGED');
      reasonCodes.push('TRANSFORM_QI_DAMAGED');
    }

    candidates.set(subtype, finalizeCandidate({
      category: IMAGE_CATEGORY.TRANSFORMATION_IMAGE,
      subtype,
      target_element: targetElement,
      match_score: Math.min(capScore, rawScore),
      dimensions: {
        adjacent_stem_combine_points: 25,
        month_command_points: monthCommandPoints,
        branch_support_count: branchSupportCount,
        branch_support_points: branchSupportPoints,
        no_jealous_combine_points: noJealousCombinePoints,
        competing_partner_count: competingPartnerCount,
        competing_day_stem_count: competingDayStemCount,
        original_qi_root_count: dmSupport.branch_same_roots,
        original_qi_primary_root_count: originalQiPrimaryRootCount,
        original_qi_root_score: round(originalQiRootScore),
        original_qi_weak_points: originalQiWeakPoints,
        transform_qi_ratio: round(targetRatio),
        transform_qi_counter_ratio: round(counterRatio),
        transform_qi_intact_points: intactPoints,
        transform_qi_damage_penalty: transformQiDamagePenalty,
      },
      penalties,
      reason_codes: reasonCodes,
      yongshen_strategy: 'TRANSFORM_FORCE',
    }));
  }

  return [...candidates.values()];
}

function scoreTwoQiImage(input) {
  const { dayGan, gans = [], zhis = [], monthZhi } = input;
  const wuxingScores = getWuxingScores(input);
  const totalScore = getTotalScore(wuxingScores);
  const topElements = Object.entries(wuxingScores)
    .map(([element, score]) => ({
      element,
      score,
      ratio: totalScore ? score / totalScore : 0,
    }))
    .sort((left, right) => right.ratio - left.ratio)
    .slice(0, 2);
  const combinedRatio = topElements.reduce((sum, item) => sum + item.ratio, 0);
  const ratioDifference = Math.abs(topElements[0].ratio - topElements[1].ratio);
  const combinedPoints = Math.min(45, combinedRatio * 60);
  const balancePoints = Math.max(0, 25 - ratioDifference * 100);
  const lowMixedQiPoints = Math.max(0, 20 - (1 - combinedRatio) * 25);
  const named = resolveNamedTwoQiImage({
    dayGan,
    gans,
    zhis,
    monthZhi,
    topElements,
    wuxingScores,
    combinedRatio,
    ratioDifference,
  });
  let overrideScope = named.override_scope
    ?? (named.allow_override === false ? 'display_only' : 'xiji_yongshen');

  // 日主恋印不化：若两气之一即为印星，且印有根/透、日主亦有根，则属身强印旺之正格
  // （如壬日金水＝印＋比），非吐秀成象，降为 display_only，不覆盖正格成法。
  const dmSupport = getDmSupport(input);
  const twoQiElements = topElements.map((item) => item.element);
  const sealInTwoQi = dmSupport.seal_element && twoQiElements.includes(dmSupport.seal_element);
  const sealStrong = dmSupport.branch_seal_roots >= 2 || dmSupport.exposed_seal >= 1;
  let lianYinDowngrade = false;
  // 仅对清流类两气（如金白水清）做恋印降级；强众敌寡（HUNT_WEAK_ENEMY）等成势成象不在此列。
  if (named.yongshen_strategy === 'TWO_QI_CLEAR_FLOW'
      && sealInTwoQi && sealStrong && !dmSupport.is_rootless && overrideScope !== 'display_only') {
    overrideScope = 'display_only';
    lianYinDowngrade = true;
  }

  return finalizeCandidate({
    category: IMAGE_CATEGORY.TWO_QI_IMAGE,
    subtype: named.subtype,
    target_elements: topElements.map((item) => item.element),
    match_score: combinedPoints + balancePoints + lowMixedQiPoints,
    allow_override: lianYinDowngrade ? false : named.allow_override,
    dimensions: {
      two_qi_combined_ratio: round(combinedRatio),
      two_qi_combined_points: round(combinedPoints),
      two_qi_ratio_difference: round(ratioDifference),
      two_qi_balance_points: round(balancePoints),
      low_mixed_qi_points: round(lowMixedQiPoints),
    },
    reason_codes: named.reason_codes,
    yongshen_strategy: named.yongshen_strategy,
    reviewed_override_min_score: named.reviewed_override_min_score,
    override_scope: overrideScope,
    formation_level: named.formation_level,
    formation_relation: named.formation_relation,
    balance_state: named.balance_state,
    center_of_gravity: named.center_of_gravity,
    purity_level: named.purity_level,
    treatment: named.treatment,
    affected_dimensions: named.affected_dimensions,
    override_reason: named.override_reason,
    override_veto_reason: named.override_veto_reason,
    veto_basis: named.veto_basis,
    effective_counter_element: named.effective_counter_element,
    effective_counter_basis: named.effective_counter_basis,
    weak_enemy_elements: named.weak_enemy_elements,
  });
}

function resolveNamedTwoQiImage({
  dayGan,
  gans = [],
  zhis = [],
  monthZhi,
  topElements,
  wuxingScores,
  combinedRatio,
  ratioDifference,
}) {
  const elements = topElements.map((item) => item.element).join('');
  const elementSet = new Set(topElements.map((item) => item.element));
  const formation = assessTwoQiFormation({ topElements, ratioDifference });
  const genericReasonCodes = ratioDifference <= TWO_QI_BALANCE_MAX_DIFF
    ? ['TWO_QI_BALANCED']
    : ['TARGET_QI_MIXED'];

  if (
    elementSet.has('金')
    && elementSet.has('水')
    && ['申', '酉'].includes(monthZhi)
    && combinedRatio >= 0.6
  ) {
    return {
      subtype: '金白水清',
      yongshen_strategy: 'TWO_QI_CLEAR_FLOW',
      allow_override: true,
      reviewed_override_min_score: 60,
      override_scope: 'xiji_yongshen',
      ...formation,
      purity_level: 'CLEAR',
      treatment: 'LEAK_EXCESS',
      affected_dimensions: ['yongshen', 'xiji'],
      override_reason: '金水相生，秋令子母和会，取水泄秀。',
      reason_codes: ['TWO_QI_NAMED_JINBAI_SHUIQING', ...genericReasonCodes],
    };
  }

  const dayElement = dayGan ? GAN_WUXING[dayGan] : null;
  if (
    dayElement === '土'
    && elementSet.has('火')
    && elementSet.has('土')
    && combinedRatio >= 0.62
  ) {
    const weakEnemy = Object.entries(wuxingScores)
      .filter(([element, score]) => !elementSet.has(element) && score > 0)
      .sort((left, right) => right[1] - left[1])[0];
    if (weakEnemy) {
      const decision = assessTwoQiOverrideDecision({
        subtype: '强众敌寡',
        strategy: 'TWO_QI_HUNT_WEAK_ENEMY',
        dayGan,
        monthZhi,
        gans,
        zhis,
        targetElements: topElements.map((item) => item.element),
        weakEnemyElements: [weakEnemy[0]],
      });

      return {
        subtype: '强众敌寡',
        weak_enemy_elements: [weakEnemy[0]],
        yongshen_strategy: 'TWO_QI_HUNT_WEAK_ENEMY',
        allow_override: decision.allow_override,
        reviewed_override_min_score: 60,
        override_scope: decision.override_scope,
        ...formation,
        purity_level: decision.purity_level,
        treatment: decision.treatment,
        affected_dimensions: decision.affected_dimensions,
        override_reason: decision.override_reason,
        override_veto_reason: decision.override_veto_reason,
        veto_basis: decision.veto_basis,
        effective_counter_element: decision.effective_counter_element,
        effective_counter_basis: decision.effective_counter_basis,
        reason_codes: ['TWO_QI_NAMED_STRONG_MANY_WEAK_ENEMY', ...genericReasonCodes],
      };
    }
  }

  if (elementSet.has('火') && elementSet.has('土') && combinedRatio >= 0.62) {
    const decision = assessTwoQiOverrideDecision({
      subtype: '火土成势',
      strategy: 'TWO_QI_FOLLOW_FORCE',
      dayGan,
      monthZhi,
      gans,
      zhis,
      targetElements: topElements.map((item) => item.element),
    });

    return {
      subtype: '火土成势',
      yongshen_strategy: 'TWO_QI_FOLLOW_FORCE',
      allow_override: decision.allow_override,
      reviewed_override_min_score: 60,
      override_scope: decision.override_scope,
      ...formation,
      purity_level: decision.purity_level,
      treatment: decision.treatment,
      affected_dimensions: decision.affected_dimensions,
      override_reason: decision.override_reason,
      override_veto_reason: decision.override_veto_reason,
      veto_basis: decision.veto_basis,
      effective_counter_element: decision.effective_counter_element,
      effective_counter_basis: decision.effective_counter_basis,
      reason_codes: ['TWO_QI_NAMED_FIRE_EARTH_FORCE', ...genericReasonCodes],
    };
  }

  return {
    subtype: `${elements}成象`,
    yongshen_strategy: 'DESCRIPTIVE_ONLY',
    allow_override: false,
    override_scope: 'display_only',
    ...formation,
    purity_level: 'MIXED_BUT_PLACED',
    treatment: 'DESCRIPTIVE_ONLY',
    affected_dimensions: [],
    reason_codes: genericReasonCodes,
  };
}

function assessTwoQiFormation({ topElements, ratioDifference }) {
  const [left, right] = topElements.map((item) => item.element);
  const relation = WUXING_SHENG[left] === right || WUXING_SHENG[right] === left
    ? 'GENERATING'
    : (WUXING_KE[left] === right || WUXING_KE[right] === left ? 'CONTROLLING' : 'SAME_CAMP');
  const balanceState = ratioDifference <= TWO_QI_BALANCE_MAX_DIFF
    ? 'EVEN'
    : (ratioDifference <= 0.35 ? 'SLIGHTLY_BIASED' : 'HEAVILY_BIASED');

  return {
    formation_level: balanceState === 'HEAVILY_BIASED' && relation === 'CONTROLLING'
      ? 'PARTIAL'
      : 'FORMED',
    formation_relation: relation,
    balance_state: balanceState,
    center_of_gravity: balanceState === 'EVEN' ? null : topElements[0]?.element,
  };
}

function assessTwoQiOverrideDecision({
  subtype,
  strategy,
  dayGan,
  monthZhi,
  gans = [],
  zhis = [],
  targetElements = [],
  weakEnemyElements = [],
}) {
  const tiaohouElements = getTiaohouElements(dayGan, monthZhi);
  const dayElement = dayGan ? GAN_WUXING[dayGan] : null;
  const officerKillElement = dayElement ? WUXING_KE_BY[dayElement] : null;
  const protectedElements = strategy === 'TWO_QI_HUNT_WEAK_ENEMY'
    ? weakEnemyElements.filter((element) => element === officerKillElement)
    : WUXING.filter((element) => !targetElements.includes(element));
  const rootedCounter = protectedElements.find((element) =>
    countExposedElements(gans, element) > 0
    && elementHasBranchRoot(zhis, element)
    && tiaohouElements.includes(element),
  );

  if (rootedCounter) {
    const exposedStem = gans.find((gan, index) =>
      index !== 2 && getGanElement(gan) === rootedCounter,
    );
    const basis = ['ROOTED_COUNTER_USE', 'TIAOHOU_TRUE_USE'];
    const text = subtype === '火土成势'
      ? `${exposedStem || rootedCounter}透干有根，承担制刃与调候，不按火土顺势覆盖。`
      : `${exposedStem || rootedCounter}透干有根，调候取用明确，不按强众敌寡覆盖。`;

    return {
      allow_override: false,
      override_scope: 'display_only',
      purity_level: 'MIXED_BUT_PLACED',
      treatment: strategy === 'TWO_QI_HUNT_WEAK_ENEMY' ? 'SUPPORT_ROOTED_WEAK' : 'RESTRAIN_BALANCED_EXCESS',
      affected_dimensions: [],
      override_veto_reason: text,
      veto_basis: basis,
      effective_counter_element: rootedCounter,
      effective_counter_basis: ['EXPOSED', 'ROOTED', 'TIAOHOU'],
    };
  }

  if (strategy === 'TWO_QI_HUNT_WEAK_ENEMY') {
    return {
      allow_override: true,
      override_scope: 'xiji_yongshen',
      purity_level: 'CLEAR',
      treatment: 'REMOVE_ROOTLESS_WEAK',
      affected_dimensions: ['yongshen', 'xiji'],
      override_reason: '强党成势，弱敌未成有效制化，按去其寡取用。',
      veto_basis: [],
      effective_counter_element: null,
      effective_counter_basis: [],
    };
  }

  return {
    allow_override: true,
    override_scope: 'xiji_yongshen',
    purity_level: 'CLEAR',
    treatment: 'FOLLOW_CLEAR_BODY',
    affected_dimensions: ['yongshen', 'xiji'],
    override_reason: '火土同势成体，未见有效制化真神，按顺势取用。',
    veto_basis: [],
    effective_counter_element: null,
    effective_counter_basis: [],
  };
}

function scoreMixedFollowCandidate(input) {
  const { dayGan, gans, zhis } = input;
  const dmSupport = getDmSupport({ dayGan, gans, zhis });
  const wuxingScores = getWuxingScores(input);
  const targetCamps = [
    WUXING_SHENG[dmSupport.dm_element],
    WUXING_KE[dmSupport.dm_element],
    WUXING_KE_BY[dmSupport.dm_element],
  ].map((element) => ({
    element,
    ratio: getElementRatio(wuxingScores, element),
  })).filter((item) => item.ratio >= 0.18);
  const hasVisibleSupport = dmSupport.exposed_same > 0 || dmSupport.exposed_seal > 0;

  if (
    !dmSupport.is_rootless
    || hasVisibleSupport
    || targetCamps.length < 2
    || targetCamps.some((item) => item.ratio >= DOMINANT_MIN_RATIO)
  ) {
    return null;
  }

  const combinedRatio = targetCamps.reduce((sum, item) => sum + item.ratio, 0);
  const combinedPoints = Math.min(35, combinedRatio * 40);

  return finalizeCandidate({
    category: IMAGE_CATEGORY.FOLLOW_IMAGE,
    subtype: '从势格',
    target_elements: targetCamps.map((item) => item.element),
    match_score: 35 + combinedPoints + 20 + 15,
    dimensions: {
      mixed_force_points: 35,
      mixed_force_combined_ratio: round(combinedRatio),
      mixed_force_combined_points: round(combinedPoints),
      rootlessness_points: 20,
      no_visible_support_points: 15,
    },
    reason_codes: ['TARGET_QI_MIXED', 'DM_ROOTLESS'],
    yongshen_strategy: 'FOLLOW_FORCE',
  });
}

function createInvalidCandidate() {
  return finalizeCandidate({
    category: IMAGE_CATEGORY.NONE,
    subtype: null,
    target_element: null,
    match_score: 0,
    allow_override: false,
    dimensions: {},
    penalties: [],
    reason_codes: ['INVALID_CHART_INPUT'],
    yongshen_strategy: null,
  });
}

function assessBaziImage(input, { followWeakV2 = true } = {}) {
  const isValidInput = isValidChartInput(input);
  const mixedFollow = isValidInput
    ? scoreMixedFollowCandidate(input)
    : null;
  const candidates = (isValidInput
    ? [
      ...scoreFollowCandidates(input, { followWeakV2 }),
      scoreSingleImage(input),
      ...scoreTransformationCandidates(input),
      scoreTwoQiImage(input),
      ...(mixedFollow ? [mixedFollow] : []),
    ]
    : [createInvalidCandidate()]).sort((left, right) => {
    // 真化已成时先论化；P3-c2 的假从候选只参与 FOLLOW 与描述型 TWO_QI 的竞争。
    if (left.override_normal_pattern && right.override_normal_pattern) {
      if (left.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE && right.follow_mode === 'RELAXED_WEAK') return -1;
      if (right.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE && left.follow_mode === 'RELAXED_WEAK') return 1;
    }
    return right.match_score - left.match_score;
  });
  const primaryCandidate = serializeCandidate(candidates[0] || null);
  const overrideCandidate = serializeCandidate(candidates.find(
    (candidate) => candidate.override_normal_pattern === true,
  ) || null);

  return {
    primary_candidate: primaryCandidate,
    override_candidate: overrideCandidate,
    alternatives: candidates.slice(1).map(serializeCandidate),
    status: primaryCandidate ? primaryCandidate.status : 'NOT_FORMED',
    dimensions: primaryCandidate ? primaryCandidate.dimensions : [],
    penalties: primaryCandidate ? primaryCandidate.penalties : [],
    reason_codes: primaryCandidate ? primaryCandidate.reason_codes : [],
    config_version: CONFIG_VERSION,
  };
}

function resolvePatternOverride({ basePattern, imageAnalysis }) {
  const candidate = imageAnalysis?.override_candidate
    || imageAnalysis?.primary_candidate;
  const scope = candidate?.override_scope;
  const overridden = scope === 'full'
    || (scope == null && candidate?.override_normal_pattern === true);

  return {
    basis: overridden ? 'SPECIAL_IMAGE_OVERRIDE' : 'MONTH_PATTERN',
    base_pattern: basePattern,
    final_pattern: overridden ? candidate.subtype : basePattern,
    overridden,
    yongshen_strategy: overridden ? candidate.yongshen_strategy : 'NORMAL',
  };
}

module.exports = {
  IMAGE_CATEGORY,
  CONFIG_VERSION,
  OVERRIDE_MIN_SCORE,
  PURE_MIN_SCORE,
  DOMINANT_MIN_RATIO,
  GAN_WUXING,
  ZHI_CANGGAN,
  WUXING_KE,
  WUXING_SHENG,
  WUXING_KE_BY,
  WUXING_SHENG_BY,
  getMatchMeta,
  getWuxingScores,
  getDmSupport,
  finalizeCandidate,
  serializeCandidate,
  assessBaziImage,
  resolvePatternOverride,
};
