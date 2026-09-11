'use strict';

const C = require('./constants/core');
const { getDiShi } = require('./BaziRuleEngine');
const { getVigor, PHASE_VIGOR } = require('./constants/relationStrength');

const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const MODEL_NOTE = '数值为项目排序指标，非古籍定量、完整旺衰结论或事件概率；须结合月令、通根及全局生克。';

// 仅标记月支五行的旺相休囚死关系；辰戌丑未按土月简化，未推日数司令。
function monthElementState(element, monthZhi) {
  const monthElement = C.ZHI_WUHANGS[monthZhi];
  if (!element || !monthElement) return '未知';
  if (element === monthElement) return '旺';
  if (SHENG[monthElement] === element) return '相';
  if (SHENG[element] === monthElement) return '休';
  if (KE[element] === monthElement) return '囚';
  return '死';
}

// 《滴天髓阐微·衰旺》论四柱通根、墓库余气；根的存在不能由自坐分数替代。
// 这里只报告原始藏干根气，刑冲合化是否损根另由关系模块说明。
function findGanRoots(gan, pillars) {
  const element = C.GAN5[gan];
  if (!element) return [];
  return pillars.flatMap(pillar => (C.ZHI5_LIST[pillar.zhi] ?? []).flatMap((stem, index) =>
    C.GAN5[stem] === element ? [{
      pillar: pillar.name, zhi: pillar.zhi, gan: stem,
      qi: index === 0 ? '本气' : '藏气', is_kong: pillar.is_kong ?? false,
    }] : []));
}

function assessGanContext(gan, zhi, pillars, monthZhi, isKong = false) {
  const phase = getDiShi(gan, zhi);
  const roots = findGanRoots(gan, pillars);
  return {
    twelve_phase: phase,
    month_phase: monthZhi ? getDiShi(gan, monthZhi) : null,
    month_element_state: monthElementState(C.GAN5[gan], monthZhi),
    roots,
    has_root: roots.length > 0,
    // 保留既有十二长生权重作为自坐指标，不宣称代表全局力量。
    vigor: getVigor(phase, isKong, C.ZHI_WUHANGS[zhi]),
    vigor_basis: 'target_stem_self_seat_proxy',
    model_note: MODEL_NOTE,
  };
}

// 地支强度不能用日主临该支的十二长生冒充。这里仅作月令五行代理排序。
// 复用既有工程权重，以下映射并非古籍给出的比例。
function branchVigor(zhi, monthZhi, isKong = false) {
  const state = monthElementState(C.ZHI_WUHANGS[zhi], monthZhi);
  const proxyPhase = { 旺: '帝旺', 相: '长生', 休: '衰', 囚: '病', 死: '死' }[state];
  return proxyPhase ? getVigor(proxyPhase, isKong, C.ZHI_WUHANGS[zhi]) : PHASE_VIGOR.沐浴;
}

module.exports = { assessGanContext, findGanRoots, monthElementState, branchVigor, MODEL_NOTE };
