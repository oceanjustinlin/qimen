'use strict';

/**
 * 干支关系扫描器
 *
 * 职责：给定目标干或支 + 命盘中所有柱，扫描全部干支关系，
 * 返回带有强度字段的 Relationship[] 列表。
 *
 * 输出的每条 Relationship 包含：
 *   type            - 关系类型（如 '六冲'）
 *   base_weight     - 类型基础权重（0-100）
 *   target_vigor    - 目标元素旺衰系数（0-1）
 *   partner_vigor   - 对方元素旺衰系数（0-1）
 *   effective_strength - 项目关系排序指标（0-100），不是古籍定量
 *   strength_tier   - 定性级别（dominant/strong/moderate/weak/latent）
 *   clash_direction - 冲克方向（wins/loses/equal，仅冲刑类有效）
 *   is_transformed  - 合化是否成立
 *   transformed_element - 化出五行
 *   note            - 中文说明
 */

const C = require('./constants/core');
const R = require('./constants/relations');
const {
  RELATION_BASE_WEIGHT,
  calcEffectiveStrength,
  strengthTier,
  STRENGTH_TIER_LABEL,
  clashDirection,
} = require('./constants/relationStrength');
const { assessGanContext, branchVigor, MODEL_NOTE } = require('./baziElementState');

// 月令→五行（用于合化条件验证）
const MONTH_ZHI_WUXING = C.ZHI_WUHANGS;

// 天干五合月令条件（化气需生于对应旺月）
const GAN_HUA_YUEZHIS = {
  土: ['辰', '戌', '丑', '未'],  // 甲己化土
  金: ['申', '酉', '辰'],         // 乙庚化金（秋金旺）
  水: ['亥', '子', '丑'],         // 丙辛化水（冬水旺）
  木: ['寅', '卯', '辰'],         // 丁壬化木（春木旺）
  火: ['巳', '午', '未'],         // 戊癸化火（夏火旺）
};

// 五行→墓库支（用于入墓判断）
const ELEMENT_TOMB = { 木: '未', 火: '戌', 金: '丑', 水: '辰', 土: '辰' };

// ─────────────────────────────────────────────────────────────
// 内部工具
// ─────────────────────────────────────────────────────────────

/** 两支是否构成六合（返回化气五行或 null） */
function getLiuheHua(zhiA, zhiB, monthZhi, allGans) {
  const key = [zhiA, zhiB].sort().join('');
  // ZHI_6HES 的 key 格式不固定，改用逐对匹配
  const pairs = {
    子丑: '土', 丑子: '土',
    寅亥: '木', 亥寅: '木',
    卯戌: '火', 戌卯: '火',
    辰酉: '金', 酉辰: '金',
    巳申: '水', 申巳: '水',
    午未: '土', 未午: '土',
  };
  const huaWx = pairs[zhiA + zhiB] ?? pairs[zhiB + zhiA];
  if (!huaWx) return null;

  // 验证合化条件：月令得气 OR 天干透出化神
  const monthIsRight = MONTH_ZHI_WUXING[monthZhi] === huaWx;
  const ganTransposes = allGans.some(g => C.GAN5[g] === huaWx);
  const canTransform = monthIsRight || ganTransposes;

  return { huaWx, canTransform };
}

/** 两支是否构成三合/半合 */
function getSanheInfo(zhiA, zhiB, allZhis) {
  // 完整三合
  for (const [group, wx] of Object.entries(R.ZHI_3HES)) {
    const members = group.split('');
    if (members.includes(zhiA) && members.includes(zhiB)) {
      const third = members.find(m => m !== zhiA && m !== zhiB);
      const isFull = allZhis.includes(third);
      return { wx, isFull, third };
    }
  }
  return null;
}

/** 两支是否构成三会（方局），需要找到第三个支 */
function getSanhuiInfo(zhiA, zhiB, allZhis) {
  for (const [group, wx] of Object.entries(R.ZHI_HUIS)) {
    const members = group.split('');
    if (members.includes(zhiA) && members.includes(zhiB)) {
      const third = members.find(m => m !== zhiA && m !== zhiB);
      const isFull = allZhis.includes(third);
      return { wx, isFull, third };
    }
  }
  return null;
}

/** 天干五合信息 */
function getGanHeInfo(ganA, ganB, monthZhi) {
  const pairs = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
  const huaMap = { 甲: '土', 己: '土', 乙: '金', 庚: '金', 丙: '水', 辛: '水', 丁: '木', 壬: '木', 戊: '火', 癸: '火' };
  if (pairs[ganA] !== ganB) return null;
  const huaWx = huaMap[ganA];
  const canTransform = GAN_HUA_YUEZHIS[huaWx]?.includes(monthZhi) ?? false;
  return { huaWx, canTransform };
}

// 暗合：以 ZHI_ATTS.暗 为唯一数据源（传统三对：丑寅/卯申/午亥）
function isAnhe(zhiA, zhiB) {
  const aAnhe = R.ZHI_ATTS[zhiA]?.暗;
  const bAnhe = R.ZHI_ATTS[zhiB]?.暗;
  return (!!aAnhe && aAnhe === zhiB) || (!!bAnhe && bAnhe === zhiA);
}

/** 拱合：两支之间虚拱出中间支 */
function getGongheInfo(zhiA, zhiB) {
  const idxA = C.ZHI_INDEX[zhiA];
  const idxB = C.ZHI_INDEX[zhiB];
  if (idxA == null || idxB == null) return null;
  const diff = Math.abs(idxA - idxB);
  if (diff === 2) {
    // 相差2位，中间那支被拱
    const midIdx = (Math.min(idxA, idxB) + 1) % 12;
    const midZhi = C.ZHI[midIdx];
    return { midZhi };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 构造 Relationship 对象
// ─────────────────────────────────────────────────────────────
function makeRel({
  type,
  targetVigor,
  partnerVigor,
  partnerPillar,
  partnerGan = null,
  partnerZhi = null,
  isTransformed = false,
  transformedElement = null,
  note,
}) {
  const effective = calcEffectiveStrength(type, targetVigor, partnerVigor);
  const tier = strengthTier(effective);
  const direction = type.includes('冲') || type.includes('刑') || type === '天干相克'
    ? clashDirection(targetVigor, partnerVigor)
    : null;

  return {
    type,
    base_weight: RELATION_BASE_WEIGHT[type] ?? 0,
    model_note: MODEL_NOTE,
    target_vigor: Math.round(targetVigor * 100) / 100,
    partner_vigor: Math.round(partnerVigor * 100) / 100,
    effective_strength: effective,
    strength_tier: tier,
    strength_label: STRENGTH_TIER_LABEL[tier],
    clash_direction: direction,   // 'wins'|'loses'|'equal'|null
    partner_pillar: partnerPillar,
    partner_gan: partnerGan,
    partner_zhi: partnerZhi,
    is_transformed: isTransformed,
    transformed_element: transformedElement,
    note,
  };
}

// ─────────────────────────────────────────────────────────────
// 主函数：扫描某支与其余各柱的所有关系
// ─────────────────────────────────────────────────────────────

/**
 * 扫描目标地支与命盘中所有其他支的关系
 *
 * @param {object} p
 * @param {string} p.targetZhi     - 目标地支，如 '午'
 * @param {string} p.targetPillar  - 目标所在柱名，如 '日'
 * @param {boolean} p.targetIsKong - 目标是否空亡
 * @param {string} p.dayStem       - 日干（保留接口；不用于地支自身旺衰）
 * @param {Array}  p.pillars       - 命盘四柱数组，每项 {name, gan, zhi, is_kong}
 * @param {string} p.monthZhi      - 月支（用于合化条件）
 * @returns {Relationship[]}
 */
function scanZhiRelations({ targetZhi, targetPillar, targetIsKong, dayStem, pillars, monthZhi }) {
  const results = [];
  const targetVigor = branchVigor(targetZhi, monthZhi, targetIsKong);
  const allZhis = pillars.map(p => p.zhi);
  const allGans = pillars.map(p => p.gan);

  for (const pillar of pillars) {
    if (pillar.name === targetPillar) continue;
    const pZhi = pillar.zhi;
    const pGan = pillar.gan;
    const partnerVigor = branchVigor(pZhi, monthZhi, pillar.is_kong ?? false);

    // ── 六冲 ──────────────────────────────────────────────
    if (R.ZHI_CHONGS[targetZhi] === pZhi) {
      const dir = clashDirection(targetVigor, partnerVigor);
      const dirNote = dir === 'wins' ? '目标旺，冲动对方' : dir === 'loses' ? '目标衰，被对方冲拔' : '势均力敌，两败俱伤';
      results.push(makeRel({
        type: '六冲',
        targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        note: `${targetZhi}与${pZhi}六冲（${pillar.name}柱）。${dirNote}`,
      }));
    }

    // ── 三刑 ──────────────────────────────────────────────
    if (R.XINGS[targetZhi] === pZhi) {
      const isSelfXing = R.ZI_XINGS.includes(targetZhi);
      const isZiMao = (targetZhi === '子' && pZhi === '卯') || (targetZhi === '卯' && pZhi === '子');
      const type = isSelfXing ? '自刑' : isZiMao ? '三刑_两字' : '三刑_三字';
      results.push(makeRel({
        type, targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        note: `${targetZhi}刑${pZhi}（${pillar.name}柱）`,
      }));
    }

    // ── 六害 ──────────────────────────────────────────────
    if (R.ZHI_HAIS[targetZhi] === pZhi) {
      results.push(makeRel({
        type: '六害', targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        note: `${targetZhi}与${pZhi}相害（${pillar.name}柱），主阻滞`,
      }));
    }

    // ── 破 ────────────────────────────────────────────────
    if (R.ZHI_POS[targetZhi] === pZhi) {
      results.push(makeRel({
        type: '破', targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        note: `${targetZhi}与${pZhi}相破（${pillar.name}柱）`,
      }));
    }

    // ── 三会（方局）────────────────────────────────────────
    const huiInfo = getSanhuiInfo(targetZhi, pZhi, allZhis);
    if (huiInfo?.isFull) {
      results.push(makeRel({
        type: '三会', targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        isTransformed: true, transformedElement: huiInfo.wx,
        note: `${targetZhi}${pZhi}${huiInfo.third}三会${huiInfo.wx}（方局，势不可当）`,
      }));
    }

    // ── 三合 / 半合 ────────────────────────────────────────
    const sanheInfo = getSanheInfo(targetZhi, pZhi, allZhis);
    if (sanheInfo) {
      if (sanheInfo.isFull) {
        results.push(makeRel({
          type: '三合', targetVigor, partnerVigor,
          partnerPillar: pillar.name, partnerZhi: pZhi,
          isTransformed: true, transformedElement: sanheInfo.wx,
          note: `${targetZhi}${pZhi}${sanheInfo.third}三合${sanheInfo.wx}局`,
        }));
      } else {
        results.push(makeRel({
          type: '半三合', targetVigor, partnerVigor,
          partnerPillar: pillar.name, partnerZhi: pZhi,
          isTransformed: false, transformedElement: sanheInfo.wx,
          note: `${targetZhi}${pZhi}半合${sanheInfo.wx}（缺${sanheInfo.third}，合力减半）`,
        }));
      }
    }

    // ── 六合 ──────────────────────────────────────────────
    const liuheInfo = getLiuheHua(targetZhi, pZhi, monthZhi, allGans);
    if (liuheInfo) {
      const type = liuheInfo.canTransform ? '六合_化' : '六合_不化';
      results.push(makeRel({
        type, targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        isTransformed: liuheInfo.canTransform,
        transformedElement: liuheInfo.canTransform ? liuheInfo.huaWx : null,
        note: liuheInfo.canTransform
          ? `${targetZhi}与${pZhi}六合化${liuheInfo.huaWx}（${pillar.name}柱，化神成立）`
          : `${targetZhi}与${pZhi}六合（${pillar.name}柱，合而不化，相互羁绊）`,
      }));
    }

    // ── 暗合 ──────────────────────────────────────────────
    if (isAnhe(targetZhi, pZhi)) {
      // 暗合不参与合化，只标记羁绊
      results.push(makeRel({
        type: '暗合', targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerZhi: pZhi,
        isTransformed: false,
        note: `${targetZhi}与${pZhi}暗合（${pillar.name}柱），藏干互合，隐性牵绊`,
      }));
    }

    // ── 拱合 ──────────────────────────────────────────────
    const gongheInfo = getGongheInfo(targetZhi, pZhi);
    if (gongheInfo) {
      // 只有该中间支不存在于命局中，且不空亡，才算有效拱合
      const midPresent = allZhis.includes(gongheInfo.midZhi);
      if (!midPresent) {
        results.push(makeRel({
          type: '拱合', targetVigor, partnerVigor,
          partnerPillar: pillar.name, partnerZhi: pZhi,
          isTransformed: false,
          note: `${targetZhi}与${pZhi}拱合虚拱${gongheInfo.midZhi}（${pillar.name}柱），填实则失效`,
        }));
      }
    }
  }

  // 按有效强度降序，确保最重要的关系排在最前面
  return results.sort((a, b) => b.effective_strength - a.effective_strength);
}

// ─────────────────────────────────────────────────────────────
// 扫描目标天干与其余各柱天干的关系
// ─────────────────────────────────────────────────────────────

/**
 * 扫描目标天干与其他柱天干的关系（五合、相克）
 *
 * @param {object} p
 * @param {string} p.targetGan    - 目标天干
 * @param {string} p.targetPillar - 目标所在柱名
 * @param {string} p.dayStem      - 日干
 * @param {string} p.monthZhi     - 月支（合化条件）
 * @param {Array}  p.pillars      - 四柱数组
 * @returns {Relationship[]}
 */
function scanGanRelations({ targetGan, targetPillar, targetZhi: explicitTargetZhi, dayStem, monthZhi, pillars }) {
  const results = [];
  // 天干旺衰：用天干坐下的地支来计算十二长生
  const targetPillarObj = pillars.find(p => p.name === targetPillar);
  const targetZhi = explicitTargetZhi ?? targetPillarObj?.zhi ?? '';
  const targetVigor = targetZhi ? assessGanContext(targetGan, targetZhi, pillars, monthZhi, targetPillarObj?.is_kong ?? false).vigor : 0.5;

  for (const pillar of pillars) {
    if (pillar.name === targetPillar) continue;
    const pGan = pillar.gan;
    const partnerVigor = assessGanContext(pGan, pillar.zhi, pillars, monthZhi, pillar.is_kong ?? false).vigor;

    // ── 天干五合 ──────────────────────────────────────────
    const ganHeInfo = getGanHeInfo(targetGan, pGan, monthZhi);
    if (ganHeInfo) {
      const type = ganHeInfo.canTransform ? '天干五合_化' : '天干五合_不化';
      results.push(makeRel({
        type, targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerGan: pGan,
        isTransformed: ganHeInfo.canTransform,
        transformedElement: ganHeInfo.canTransform ? ganHeInfo.huaWx : null,
        note: ganHeInfo.canTransform
          ? `${targetGan}与${pGan}五合化${ganHeInfo.huaWx}（${pillar.name}柱）`
          : `${targetGan}与${pGan}五合（${pillar.name}柱，合而不化，相互羁绊）`,
      }));
    }

    // ── 天干相克 ──────────────────────────────────────────
    const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const targetWx = C.GAN5[targetGan];
    const partnerWx = C.GAN5[pGan];
    if (targetWx && partnerWx && WUXING_KE[targetWx] === partnerWx) {
      results.push(makeRel({
        type: '天干相克', targetVigor, partnerVigor,
        partnerPillar: pillar.name, partnerGan: pGan,
        note: `${targetGan}（${targetWx}）克${pGan}（${partnerWx}）（${pillar.name}柱）`,
      }));
    }
    if (targetWx && partnerWx && WUXING_KE[partnerWx] === targetWx) {
      // 始终保持 target / partner 对象一致，克制方向由文字说明。
      results.push(makeRel({
        type: '天干相克',
        targetVigor,
        partnerVigor,
        partnerPillar: pillar.name, partnerGan: pGan,
        note: `${pGan}（${partnerWx}）克${targetGan}（${targetWx}）（${pillar.name}柱）`,
      }));
    }
  }

  return results.sort((a, b) => b.effective_strength - a.effective_strength);
}

// ─────────────────────────────────────────────────────────────
// 入墓检测（独立工具）
// ─────────────────────────────────────────────────────────────

/**
 * 判断某天干是否坐在自己的墓库支上（入墓）
 * @param {string} gan  - 天干
 * @param {string} zhi  - 天干所坐地支
 * @returns {boolean}
 */
function isGanInTomb(gan, zhi) {
  return C.KU_ZHI[gan] === zhi;
}

/**
 * 判断某宫位支是否是目标五行的墓库
 * @param {string} gongweiBranch - 宫位地支（如日支 '未'）
 * @param {string} targetElement - 目标元素的五行（如 '木'）
 * @returns {boolean}
 */
function isBranchTombFor(gongweiBranch, targetElement) {
  return ELEMENT_TOMB[targetElement] === gongweiBranch;
}

// ─────────────────────────────────────────────────────────────
// 盖头截脚（提取为独立工具函数）
// ─────────────────────────────────────────────────────────────

const WUXING_KE_MAP = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/**
 * 判断某柱的盖头/截脚状态
 * @param {string} gan
 * @param {string} zhi
 * @returns {'same'|'gaitou'|'jiejiao'|'neutral'}
 *   same     - 干支同气（最协调）
 *   gaitou   - 天干克地支（盖头，须结合全局）
 *   jiejiao  - 地支克天干（截脚，须结合根气制化）
 *   neutral  - 生扶或无关（正常）
 */
function getGaitouJiejiao(gan, zhi) {
  const ganWx = C.GAN5[gan];
  const zhiWx = C.ZHI_WUHANGS[zhi];
  if (!ganWx || !zhiWx) return 'neutral';
  if (ganWx === zhiWx) return 'same';
  if (WUXING_KE_MAP[ganWx] === zhiWx) return 'gaitou';
  if (WUXING_KE_MAP[zhiWx] === ganWx) return 'jiejiao';
  return 'neutral';
}

const GAITOU_JIEJIAO_NOTE = {
  same:     '干支同气，干支协调，能量完整',
  gaitou:   '盖头（天干克地支），须结合月令与全局生克，不能固定减半',
  jiejiao:  '截脚（地支克天干），须查四柱通根及生扶制化，不能径断无根失效',
  neutral:  '干支相生或无克，关系正常',
};

module.exports = {
  scanZhiRelations,
  scanGanRelations,
  isGanInTomb,
  isBranchTombFor,
  getGaitouJiejiao,
  GAITOU_JIEJIAO_NOTE,
  ELEMENT_TOMB,
  // 暴露给测试
  getLiuheHua,
  getSanheInfo,
  getGanHeInfo,
};
