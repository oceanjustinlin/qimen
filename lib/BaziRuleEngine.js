'use strict';
const C = require('./BaziConstants');

// ─── 辅助函数 ────────────────────────────────────────────────────────────────
/** 获取日干对某支/干的十神 */
function getShen(dayGan, target) {
  if (C.SHISHEN[dayGan] && C.SHISHEN[dayGan][target] !== undefined) return C.SHISHEN[dayGan][target];
  // zhi → 主气十神
  const mainGan = C.ZHI5_LIST[target]?.[0];
  return mainGan ? C.SHISHEN[dayGan][mainGan] : '?';
}
/** 十二长生 */
function getDiShi(dayGan, zhi) {
  const start = C.CHANG_SHENG_START[dayGan];
  if (start === undefined) return '-';
  const idx = C.ZHI_INDEX[zhi];
  const isYang = ['甲', '丙', '戊', '庚', '壬'].includes(dayGan);
  return C.SHI_ER[isYang ? (idx - start + 12) % 12 : (start - idx + 12) % 12];
}
/** 反查：给定日干，找十神对应的天干 */
function getStemByShen(dayGan, shenName) {
  return Object.keys(C.SHISHEN[dayGan]).find(g => C.SHISHEN[dayGan][g] === shenName);
}
/** 空亡检测 */
function isKong(dayPillar, zhi) {
  return (C.EMPTIES[dayPillar] || []).includes(zhi);
}
/** 解析调候字符串 → {favorable:[...], unfavorable:[...]} */
function parseTiaohou(str) {
  if (!str) return { favorable: [], unfavorable: [] };
  const favorable = [];
  const unfavorable = [];
  const seenFav = new Set();
  const seenUnfav = new Set();
  let priority = 1;
  let markUnfav = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (/\d/.test(c)) {
      priority = Number(c);
      markUnfav = false;
      continue;
    }
    if (c === '_') { markUnfav = true; continue; }
    if (markUnfav) {
      if (!seenUnfav.has(c)) {
        unfavorable.push({ gan: c, priority });
        seenUnfav.add(c);
      }
    } else if (!seenFav.has(c)) {
      favorable.push({ gan: c, priority });
      seenFav.add(c);
    }
    markUnfav = false;
  }
  return { favorable, unfavorable };
}

const STRONG_ROOT_PHASES = new Set(['帝旺', '临官']);
const WEAK_ROOT_PHASES = new Set(['长生', '冠带']);
const TRACE_ROOT_PHASES = new Set(['沐浴', '墓']);
const ROOTED_PHASES = new Set([...STRONG_ROOT_PHASES, ...WEAK_ROOT_PHASES, ...TRACE_ROOT_PHASES]);

function getMoonScoreByPhase(phase) {
  if (STRONG_ROOT_PHASES.has(phase)) return { score: 5, strength: '旺', deLing: true };
  if (WEAK_ROOT_PHASES.has(phase)) return { score: 3, strength: '相', deLing: true };
  return { score: 0, strength: '失令', deLing: false };
}

function getGroundScoreByPhase(phase) {
  if (phase === '帝旺') return 3;
  if (phase === '临官') return 2;
  if (phase === '长生' || phase === '冠带') return 1;
  if (phase === '沐浴' || phase === '墓') return 0.5;
  return 0;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function formatScore(num) {
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
}

function getHiddenStemType(index) {
  if (index === 0) return '本气';
  if (index === 1) return '中气';
  return '余气';
}

function getHiddenStemWeight(index) {
  if (index === 0) return 1;
  if (index === 1) return 0.65;
  return 0.4;
}

function getPillarRootWeight(index) {
  if (index === 1) return 1.35; // 月令根气最重
  if (index === 2) return 1.05; // 日支为坐下根
  return 0.75;
}

function getStrengthBand(score) {
  if (score < 2.5) return { label: '极弱', strongWeak: '身弱' };
  if (score < 4.3) return { label: '偏弱', strongWeak: '身弱' };
  if (score <= 5.55) return { label: '中和', strongWeak: '身中' };
  if (score <= 7.5) return { label: '偏强', strongWeak: '身强' };
  return { label: '极强', strongWeak: '身强' };
}

function getRootStatsForElement(element, zhis) {
  const pillarNames = ['年支', '月支', '日支', '时支'];
  const roots = [];
  let score = 0;
  zhis.forEach((zhi, pillarIndex) => {
    const hides = C.ZHI5_LIST[zhi] || [];
    hides.forEach((stem, hiddenIndex) => {
      if (C.GAN5[stem] !== element) return;
      const hiddenType = getHiddenStemType(hiddenIndex);
      const base = getHiddenStemWeight(hiddenIndex);
      const pillarWeight = getPillarRootWeight(pillarIndex);
      const raw = base * pillarWeight;
      score += raw;
      roots.push({
        pillar: pillarNames[pillarIndex],
        branch: zhi,
        hiddenStem: stem,
        hiddenType,
        raw_score: Number(raw.toFixed(2)),
      });
    });
  });
  return { roots, score };
}

function getSeasonDetail(dayGan, monthZhi, monthPhase) {
  const mainGan = C.ZHI5_LIST[monthZhi]?.[0];
  const shen = mainGan ? C.SHISHEN[dayGan][mainGan] : '?';
  let relationScore = 0.8;
  if (shen === '比' || shen === '劫') relationScore = 2;
  else if (shen === '印' || shen === '枭') relationScore = 1.6;
  else if (shen === '食' || shen === '伤') relationScore = 1.1;
  else if (shen === '财' || shen === '才') relationScore = 0.6;
  else if (shen === '官' || shen === '杀') relationScore = 0.3;

  let phaseScore = 0;
  if (STRONG_ROOT_PHASES.has(monthPhase)) phaseScore = 1.2;
  else if (WEAK_ROOT_PHASES.has(monthPhase)) phaseScore = 0.9;
  else if (TRACE_ROOT_PHASES.has(monthPhase)) phaseScore = 0.35;

  const dayElement = C.GAN5[dayGan];
  const monthRoot = getRootStatsForElement(dayElement, [monthZhi]);
  const hiddenSupportScore = clamp(monthRoot.score * 0.5, 0, 0.8);
  const score = clamp(relationScore + phaseScore + hiddenSupportScore, 0, 4);
  const verdict = score >= 3.4 ? '得令' : (score >= 2.2 ? '半得令' : (score >= 1.1 ? '令中有气' : '失令'));
  const mainText = mainGan ? `月令${monthZhi}以${mainGan}为主气，对日主为${SHORT_TO_FULL_SHEN[shen] || shen}。` : `月令${monthZhi}主气未定。`;
  const phaseText = monthPhase && monthPhase !== '-' ? `十二长生落在${monthPhase}。` : '';
  return {
    score,
    max_score: 4,
    month_branch: monthZhi,
    month_main_stem: mainGan,
    relation: SHORT_TO_FULL_SHEN[shen] || shen,
    changsheng_phase: monthPhase,
    verdict,
    text: `${mainText}${phaseText}${verdict === '失令' ? '月令不直接扶身，先按失令看。' : '月令对日主仍有扶持或承载。'}`
  };
}

function getRootDetail(dayGan, zhis) {
  const stats = getRootStatsForElement(C.GAN5[dayGan], zhis);
  // 旺衰相位加成：得地不应只看藏干本气/中气权重，还须计入日主在该支的禄刃旺地（临官/帝旺）。
  // 如戊坐午、辛坐酉为禄刃，是强根核心来源，原模型仅按藏干权重计分会系统性低估。
  // 保守口径：仅计临官/帝旺，权重偏小，且不抬高 3 分上限——已强根者不再叠加，避免反向过判强。
  let phaseBonus = 0;
  zhis.forEach((zhi, pillarIndex) => {
    if (STRONG_ROOT_PHASES.has(getDiShi(dayGan, zhi))) phaseBonus += 0.35 * getPillarRootWeight(pillarIndex);
  });
  const score = clamp(stats.score + phaseBonus, 0, 3);
  const heavyRootCount = stats.roots.filter(root => root.hiddenType === '本气').length;
  const mediumRootCount = stats.roots.filter(root => root.hiddenType === '中气').length;
  const lightRootCount = stats.roots.filter(root => root.hiddenType === '余气').length;
  const rootLevel = heavyRootCount ? '重根' : (mediumRootCount ? '中根' : (lightRootCount ? '轻根' : '无根'));
  const rootCopy = stats.roots.length
    ? `地支见${stats.roots.map(root => `${root.pillar}${root.branch}藏${root.hiddenStem}（${root.hiddenType}）`).join('、')}，日主有${rootLevel}可依。`
    : '四支未见日主同类根气，日主在地支缺少承载。';
  return {
    score,
    max_score: 3,
    has_root: stats.roots.length > 0,
    root_level: rootLevel,
    roots: stats.roots,
    heavy_root_count: heavyRootCount,
    medium_root_count: mediumRootCount,
    light_root_count: lightRootCount,
    text: rootCopy,
  };
}

function getSupportDetail(dayGan, gans, zhis) {
  const stemHelpShens = new Set(['比', '劫', '印', '枭']);
  const pillarNames = ['年干', '月干', '日干', '时干'];
  const branchNames = ['年支', '月支', '日支', '时支'];
  const supportStems = [];
  let score = 0;
  gans.forEach((gan, index) => {
    if (index === 2) return;
    const shen = C.SHISHEN[dayGan][gan];
    if (!stemHelpShens.has(shen)) return;
    const rootStats = getRootStatsForElement(C.GAN5[gan], zhis);
    const rooted = rootStats.score >= 0.9;
    const weakRooted = rootStats.score > 0 && rootStats.score < 0.9;
    const itemScore = rooted ? 1.15 : (weakRooted ? 0.75 : 0.35);
    score += itemScore;
    supportStems.push({
      pillar: pillarNames[index],
      stem: gan,
      relation: SHORT_TO_FULL_SHEN[shen] || shen,
      rooted,
      root_level: rooted ? '有根' : (weakRooted ? '弱根' : '虚浮'),
      raw_score: Number(itemScore.toFixed(2)),
    });
  });
  const hiddenSupports = [];
  let hiddenSupportRawScore = 0;
  const hasVisibleSeal = supportStems.some(item => item.relation === '正印' || item.relation === '偏印');
  if (!hasVisibleSeal) {
    zhis.forEach((zhi, pillarIndex) => {
      (C.ZHI5_LIST[zhi] || []).forEach((stem, hiddenIndex) => {
        if (hiddenIndex > 1) return;
        const shen = C.SHISHEN[dayGan][stem];
        if (shen !== '印' && shen !== '枭') return;
        const raw = getHiddenStemWeight(hiddenIndex) * getPillarRootWeight(pillarIndex) * 0.15;
        hiddenSupportRawScore += raw;
        hiddenSupports.push({
          pillar: branchNames[pillarIndex],
          branch: zhi,
          hidden_stem: stem,
          hidden_type: getHiddenStemType(hiddenIndex),
          relation: SHORT_TO_FULL_SHEN[shen] || shen,
          raw_score: Number(raw.toFixed(2)),
        });
      });
    });
  }
  const visibleSupportScore = clamp(score, 0, 2);
  const hiddenSupportScore = Math.min(hiddenSupportRawScore, 0.45, 2 - visibleSupportScore);
  score = clamp(visibleSupportScore + hiddenSupportScore, 0, 2);
  const visibleText = supportStems.length
    ? `天干见${supportStems.map(item => `${item.pillar}${item.stem}为${item.relation}，${item.root_level}`).join('；')}`
    : '年、月、时干未见印比透出';
  const hiddenText = hiddenSupports.length
    ? `；地支另见${hiddenSupports.map(item => `${item.pillar}${item.branch}藏${item.hidden_stem}${item.relation}`).join('、')}，仅作有限暗助`
    : '';
  const text = `${visibleText}${hiddenText}，对日主形成${score >= 1.5 ? '实助' : (score > 0 ? '有限帮扶' : '明面帮扶不足')}。`;
  return {
    score,
    max_score: 2,
    support_stems: supportStems,
    hidden_supports: hiddenSupports,
    hidden_support_score: Number(hiddenSupportScore.toFixed(2)),
    effective_support_count: supportStems.filter(item => item.rooted).length,
    floating_support_count: supportStems.filter(item => item.root_level === '虚浮').length,
    text,
  };
}


const SHORT_TO_FULL_SHEN = {
  "比": "比肩", "劫": "劫财",
  "食": "食神", "伤": "伤官",
  "财": "正财", "才": "偏财",
  "官": "正官", "杀": "七杀",
  "印": "正印", "枭": "偏印"
};
const FULL_TO_SHORT_SHEN = Object.fromEntries(Object.entries(SHORT_TO_FULL_SHEN).map(([k, v]) => [v, k]));
const SHEN_PAIRS = [
  ['正印', '偏印'],
  ['正官', '七杀'],
  ['食神', '伤官'],
  ['正财', '偏财'],
  ['比肩', '劫财'],
];
const SHENG_CYCLE = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const RESTRAINING_CYCLE = { '木': '金', '土': '木', '水': '土', '火': '水', '金': '火' };

// 格局辅神文本 → 十神全名映射（用于 L2 格局维度）
const SHEN_TEXT_TO_FULL = {
  '比': ['比肩'], '劫': ['劫财'],
  '食': ['食神'], '伤': ['伤官'],
  '财': ['正财'], '才': ['偏财'],
  '官': ['正官'], '杀': ['七杀'],
  '印': ['正印'], '枭': ['偏印'],
  '官星': ['正官'], '七杀': ['七杀'],
  '正财': ['正财'], '偏财': ['偏财'], '财星': ['正财', '偏财'],
  '食神': ['食神'], '伤官': ['伤官'], '食伤': ['食神', '伤官'],
  '正印': ['正印'], '偏印': ['偏印'], '印绶': ['正印', '偏印'],
  '比肩': ['比肩'], '劫财': ['劫财'], '比劫': ['比肩', '劫财'],
};
function parseShenText(text) {
  if (!text) return [];
  const seen = new Set();
  return text.split(/[、,，\s]+/)
    .flatMap(p => SHEN_TEXT_TO_FULL[p.trim()] || [])
    .filter(v => !seen.has(v) && seen.add(v));
}

function getFullShenByStem(dayGan, stem) {
  return SHORT_TO_FULL_SHEN[C.SHISHEN[dayGan]?.[stem]];
}

function getWuxingByShenFull(dayGan, fullShen) {
  const shortShen = FULL_TO_SHORT_SHEN[fullShen];
  const stem = getStemByShen(dayGan, shortShen);
  return C.GAN5[stem];
}

function getTiaohouWeight(priority) {
  if (priority === 1) return 50;
  if (priority === 2) return 35;
  return 20;
}

function getTiaohouUnfavorablePenalty(ratio, hasRestrainingGan) {
  if (ratio > 30) return hasRestrainingGan ? -35 : -50;
  if (ratio > 20) return -35;
  if (ratio >= 10) return -20;
  return 0;
}

const TIAOHOU_MONTH_CLIMATE = {
  寅: { state: '初春余寒', axis: '寒暖', purpose: '温暖生发', urgency: '偏急' },
  卯: { state: '春木舒展', axis: '寒暖', purpose: '疏泄成秀', urgency: '普通' },
  辰: { state: '春末湿滞', axis: '燥湿', purpose: '疏湿培根', urgency: '普通' },
  巳: { state: '初夏燥热', axis: '寒暖燥湿', purpose: '润燥降炎', urgency: '偏急' },
  午: { state: '火炎燥烈', axis: '寒暖燥湿', purpose: '润燥济火', urgency: '极急' },
  未: { state: '暑土燥湿相杂', axis: '寒暖燥湿', purpose: '润燥通滞', urgency: '偏急' },
  申: { state: '初秋肃燥', axis: '燥湿', purpose: '清润修成', urgency: '普通' },
  酉: { state: '秋金肃杀', axis: '燥湿', purpose: '润燥成器', urgency: '普通' },
  戌: { state: '晚秋燥土', axis: '燥湿', purpose: '润燥疏土', urgency: '偏急' },
  亥: { state: '初冬寒湿', axis: '寒暖', purpose: '暖局通阳', urgency: '偏急' },
  子: { state: '寒湿偏重', axis: '寒暖', purpose: '解冻暖局', urgency: '偏急' },
  丑: { state: '寒湿冻土', axis: '寒暖燥湿', purpose: '解冻去湿', urgency: '极急' },
};

function buildTiaohouStemItem(dayGan, item, role) {
  const shen = getFullShenByStem(dayGan, item.gan) || '';
  return {
    gan: item.gan,
    shen,
    wuxing: C.GAN5[item.gan] || '',
    priority: item.priority,
    role,
  };
}

function buildTiaohouDetail(dayGan, monthZhi, parsedTiaohou, specialPattern = null) {
  const key = dayGan + monthZhi;
  const climate = TIAOHOU_MONTH_CLIMATE[monthZhi] || {
    state: '气候未定',
    axis: '寒暖燥湿',
    purpose: '调和偏枯',
    urgency: '普通',
  };
  const minPriority = parsedTiaohou.favorable.reduce((min, item) => Math.min(min, item.priority), Infinity);
  const primary = parsedTiaohou.favorable
    .filter(item => item.priority === minPriority)
    .map(item => buildTiaohouStemItem(dayGan, item, '第一调候'));
  const secondary = parsedTiaohou.favorable
    .filter(item => item.priority !== minPriority)
    .map(item => buildTiaohouStemItem(dayGan, item, '辅助调候'));
  const avoid = parsedTiaohou.unfavorable.map(item => buildTiaohouStemItem(dayGan, item, '慎用'));
  const primaryText = primary.map(item => `${item.gan}${item.wuxing ? item.wuxing : ''}${item.shen ? `（${item.shen}）` : ''}`).join('、') || '未列明';
  const secondaryText = secondary.length
    ? `；辅取${secondary.map(item => `${item.gan}${item.wuxing ? item.wuxing : ''}`).join('、')}`
    : '';
  const avoidText = avoid.length
    ? `；慎见${avoid.map(item => `${item.gan}${item.wuxing ? item.wuxing : ''}`).join('、')}偏重`
    : '';

  return {
    key,
    climate_state: climate.state,
    axis: climate.axis,
    purpose: climate.purpose,
    urgency: climate.urgency,
    primary_gods: primary,
    secondary_gods: secondary,
    avoid_gods: avoid,
    explanation: `${key}生于${monthZhi}月，气候呈${climate.state}，调候目的在于${climate.purpose}；首取${primaryText}${secondaryText}${avoidText}。`,
    special_pattern_warning: specialPattern
      ? '已识别特殊格局，喜忌先顺其成势；调候仍作为气候风险提示，不直接覆盖从格取用。'
      : '',
  };
}

function pruneDivergentPairs(list, scores) {
  const pruned = [...list];
  for (const [a, b] of SHEN_PAIRS) {
    if (!pruned.includes(a) || !pruned.includes(b)) continue;
    const diff = Math.abs(scores[a] - scores[b]);
    if (diff <= 15) continue;
    const loser = scores[a] >= scores[b] ? b : a;
    const idx = pruned.indexOf(loser);
    if (idx >= 0) pruned.splice(idx, 1);
  }
  return pruned;
}

function aggregateShens(shenNames, scores, conflictShens = []) {
  const sortedShens = [...shenNames].sort((a, b) => scores[b] - scores[a]);
  const positiveShens = sortedShens.filter(s => scores[s] > 0);
  const topScore = positiveShens.length ? scores[positiveShens[0]] : 0;
  let favorable = positiveShens.filter(s => scores[s] >= topScore - 5);
  favorable = pruneDivergentPairs(favorable, scores).slice(0, 2);
  if (favorable.length === 0 && positiveShens.length) favorable.push(positiveShens[0]);

  for (const shen of conflictShens) {
    if (scores[shen] >= 0 && !favorable.includes(shen)) {
      if (favorable.length >= 2) favorable[favorable.length - 1] = shen;
      else favorable.push(shen);
      break;
    }
  }

  const negativeShens = [...shenNames].filter(s => scores[s] < 0).sort((a, b) => scores[a] - scores[b]);
  const bottomScore = negativeShens.length ? scores[negativeShens[0]] : 0;
  let unfavorable = negativeShens.filter(s => scores[s] <= bottomScore + 5);
  unfavorable = pruneDivergentPairs(unfavorable, scores).slice(0, 2);
  if (unfavorable.length === 0 && negativeShens.length) unfavorable.push(negativeShens[0]);
  if (conflictShens.length) unfavorable = unfavorable.filter(shen => !conflictShens.includes(shen));

  return { favorable, unfavorable };
}

/**
 * 五神分层：相对阈值分级，用神强制存在
 * 返回 { yong, yong_confidence, xi[], ji[], chou[], xian[], favorable[], unfavorable[] }
 */
function classifyFiveShens(shenNames, scores, conflictShens = []) {
  const sorted = [...shenNames].sort((a, b) => scores[b] - scores[a]);
  const topScore = scores[sorted[0]];
  const botScore = scores[sorted[sorted.length - 1]];
  const spread = topScore - botScore || 1;

  // 用神：强制取最高分
  const yongShen = sorted[0];
  const confidence = topScore > 40 ? 'HIGH' : topScore > 15 ? 'MEDIUM' : 'LOW';

  // 动态阈值：分值区间的 25%，最低 20 分
  const tierSpread = Math.max(20, spread * 0.25);

  const xi = [], ji = [], chou = [], xian = [];
  const assigned = new Set([yongShen]);

  // 喜神：正分 & 与用神分差 ≤ tierSpread
  for (const s of sorted) {
    if (assigned.has(s)) continue;
    if (scores[s] > 0 && (topScore - scores[s]) <= tierSpread) {
      xi.push(s); assigned.add(s);
      if (xi.length >= 2) break;
    }
  }

  // 忌神/仇神：从最负开始，距底部在 tierSpread 内的为同级仇神
  const negSorted = [...sorted].reverse().filter(s => scores[s] < 0);
  for (const s of negSorted) {
    if (assigned.has(s)) continue;
    if (ji.length === 0) {
      ji.push(s); assigned.add(s);
    } else if (chou.length === 0 && (scores[s] - botScore) <= tierSpread) {
      chou.push(s); assigned.add(s);
      break;
    } else {
      break;
    }
  }

  // 闲神：其余全部
  for (const s of sorted) { if (!assigned.has(s)) xian.push(s); }

  // conflict shens 调整：冲突神从忌/闲升格至喜（前插保证进 favorable）
  const activeConflicts = [];
  for (const s of conflictShens) {
    const jiIdx = ji.indexOf(s); if (jiIdx >= 0) ji.splice(jiIdx, 1);
    const chouIdx = chou.indexOf(s); if (chouIdx >= 0) chou.splice(chouIdx, 1);
    if (scores[s] >= 0 && !xi.includes(s) && s !== yongShen) {
      const idx = xian.indexOf(s);
      if (idx >= 0) xian.splice(idx, 1);
      xi.unshift(s); // 前插，确保出现在 favorable 中
      activeConflicts.push(s);
    }
  }

  // 向后兼容：conflict shen 优先替换 favorable[1]
  let backFav;
  if (activeConflicts.length > 0) {
    backFav = [yongShen, activeConflicts[0]];
  } else {
    backFav = [yongShen, ...xi].slice(0, 2);
  }

  return {
    yong: yongShen,
    yong_confidence: confidence,
    xi,
    ji,
    chou,
    xian,
    // 向后兼容
    favorable: backFav,
    unfavorable: [...ji, ...chou].slice(0, 2),
  };
}

// ─── 核心模块 ────────────────────────────────────────────────────────────────
const BaziRuleEngine = {

  /**
   * 计算日主强弱
   * @param {string} dayGan 日干
   * @param {string[]} gans [年干,月干,日干,时干]
   * @param {string[]} zhis [年支,月支,日支,时支]
   * @returns {{ strongWeak, strongScore, scores, ganScores, weak, meStatus }}
   */
  calculateStrength(dayGan, gans, zhis) {
    const scores = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
    const ganScores = {};
    C.GAN.forEach(g => { ganScores[g] = 0; });

    // 天干每个 +5
    for (const g of gans) {
      scores[C.GAN5[g]] += 5;
      ganScores[g] += 5;
    }
    // 地支藏干（月支双倍）
    const zhisWithDouble = [...zhis, zhis[1]];
    for (const z of zhisWithDouble) {
      for (const [g, w] of Object.entries(C.ZHI5[z] || {})) {
        scores[C.GAN5[g]] += w;
        ganScores[g] = (ganScores[g] || 0) + w;
      }
    }

    // 日主十二长生状态
    const meStatus = zhis.map(z => getDiShi(dayGan, z));
    const [yearPhase, monthPhase, dayPhase, hourPhase] = meStatus;
    const monthZhi = zhis[1];

    // 天干十神
    const allShens = [];
    for (const g of gans) {
      if (g !== dayGan) allShens.push(C.SHISHEN[dayGan][g]);
    }
    for (const z of zhis) {
      const mg = C.ZHI5_LIST[z]?.[0];
      if (mg) allShens.push(C.SHISHEN[dayGan][mg]);
    }

    // 数值强度（比+劫+印+枭的干分合计）
    const biStem = getStemByShen(dayGan, '比');
    const jieStem = getStemByShen(dayGan, '劫');
    const yinStem = getStemByShen(dayGan, '印');
    const xiaoStem = getStemByShen(dayGan, '枭');
    const strongScore = (ganScores[biStem] || 0) + (ganScores[jieStem] || 0)
      + (ganScores[yinStem] || 0) + (ganScores[xiaoStem] || 0);

    const seasonDetail = getSeasonDetail(dayGan, monthZhi, monthPhase);
    const rootDetail = getRootDetail(dayGan, zhis);
    const supportDetail = getSupportDetail(dayGan, gans, zhis);

    // 兼容旧字段：仍输出三段分数，但改为 10 分仪表盘口径。
    const moonRule = getMoonScoreByPhase(monthPhase);
    const moonScore = seasonDetail.score;
    const branchScores = rootDetail.roots.map(root => ({
      pillar: root.pillar,
      zhi: root.branch,
      hiddenStem: root.hiddenStem,
      hiddenType: root.hiddenType,
      score: root.raw_score,
    }));
    const groundScore = rootDetail.score;
    const stemHelpScore = supportDetail.score;
    const stemHelpBreakdown = supportDetail.support_stems.map(item => ({
      pillar: item.pillar,
      gan: item.stem,
      shen: item.relation,
      score: item.raw_score,
      hasRoot: item.rooted,
    }));

    const stemHelpShens = new Set(['比', '劫', '印', '枭']);
    const stemDetails = [
      { pillar: '年干', gan: gans[0], zhi: zhis[0], phase: yearPhase },
      { pillar: '月干', gan: gans[1], zhi: zhis[1], phase: monthPhase },
      { pillar: '时干', gan: gans[3], zhi: zhis[3], phase: hourPhase },
    ];
    const dayMasterHasRoot = rootDetail.heavy_root_count > 0 || rootDetail.score >= 0.8;
    const stemHasHelp = supportDetail.support_stems.length > 0;
    const totalWuxingScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
    const [dominantElement, dominantScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const dominantRatio = totalWuxingScore > 0 ? dominantScore / totalWuxingScore : 0;
    const isDominant = dominantRatio > 0.55;
    const dayMasterElement = C.GAN5[dayGan];

    let structureAdjustment = 0;
    if (dominantElement === dayMasterElement || ['比', '劫', '印', '枭'].some(shen => {
      const stem = getStemByShen(dayGan, shen);
      return C.GAN5[stem] === dominantElement;
    })) {
      if (dominantRatio > 0.48) structureAdjustment = 1;
      else if (dominantRatio > 0.4) structureAdjustment = 0.5;
    } else if (dominantRatio > 0.5) structureAdjustment = -1;
    else if (dominantRatio > 0.42) structureAdjustment = -0.5;

    const preliminaryStrengthScore = clamp(seasonDetail.score + rootDetail.score + supportDetail.score + structureAdjustment, 0, 10);
    const winterWaterRootNetwork =
      dayMasterElement === '水'
      && ['亥', '子', '丑'].includes(monthZhi)
      && zhis.filter(zhi => ['亥', '子', '丑'].includes(zhi)).length >= 3;
    let winterWaterNetworkAdjustment = 0;
    if (winterWaterRootNetwork && preliminaryStrengthScore >= 4.7 && preliminaryStrengthScore < 5.5) {
      winterWaterNetworkAdjustment = 0.9;
      structureAdjustment += winterWaterNetworkAdjustment;
    }

    let totalStrengthScore = clamp(seasonDetail.score + rootDetail.score + supportDetail.score + structureAdjustment, 0, 10);
    let band = getStrengthBand(totalStrengthScore);
    let strongWeak = band.strongWeak;
    let weak = strongWeak === '身弱';
    let congCheckText = '';
    let structureLabel = structureAdjustment > 0 ? '扶身气势偏旺' : (structureAdjustment < 0 ? '克泄耗气势偏旺' : '全局气势未明显改判');
    if (winterWaterNetworkAdjustment) structureLabel += '，冬水子亥丑根网成势';
    if (!dayMasterHasRoot && !stemHasHelp && isDominant) {
      strongWeak = dominantElement !== dayMasterElement ? `疑似从格（从${dominantElement}）` : '专旺格';
      band = { label: strongWeak.includes('从格') ? '极弱' : '极强', strongWeak };
      weak = false;
      congCheckText = `四支无根，天干亦无实助，而${dominantElement}占比约${Math.round(dominantRatio * 100)}%，触发${strongWeak}提示。`;
    } else {
      congCheckText = `${dayMasterHasRoot ? '日主有根' : '日主无根'}，${stemHasHelp ? '天干有印比帮身' : '天干无印比帮身'}，${dominantElement}占比约${Math.round(dominantRatio * 100)}%，不作真从或专旺覆盖。`;
    }

    const structureException = {
      adjustment: structureAdjustment,
      max_adjustment: Math.max(1, Math.abs(structureAdjustment)),
      dominant_element: dominantElement,
      dominant_ratio: dominantRatio,
      winter_water_network_adjustment: winterWaterNetworkAdjustment,
      possible_cong: !dayMasterHasRoot && dominantElement !== dayMasterElement && dominantRatio > 0.45,
      possible_zhuan_wang: dominantElement === dayMasterElement && dominantRatio > 0.5,
      final_type: strongWeak.includes('从格') || strongWeak.includes('专旺') ? strongWeak : '常规旺衰',
      text: `${structureLabel}，${congCheckText}`,
    };

    const moonText = seasonDetail.text;
    const groundText = rootDetail.text;
    const stemText = supportDetail.text;
    const finalText = `综合强度为${formatScore(totalStrengthScore)}/10，基础落在${band.label}，对外归类为${strongWeak.includes('从格') || strongWeak.includes('专旺') ? strongWeak : band.strongWeak}。`;
    const basisLines = [moonText, groundText, stemText, finalText, congCheckText];

    const strengthDetail = {
      verdict: strongWeak,
      total_score: totalStrengthScore,
      band: band.label,
      summary: `日主${strongWeak}，综合强度${formatScore(totalStrengthScore)}/10，内部细分为${band.label}。`,
      meter: {
        min: 0,
        max: 10,
        value: Number(totalStrengthScore.toFixed(1)),
        label: band.label,
        verdict: strongWeak,
      },
      season_detail: seasonDetail,
      root_detail: rootDetail,
      support_detail: supportDetail,
      structure_exception: structureException,
      user_sections: [
        { key: 'season', title: '得令', text: seasonDetail.text },
        { key: 'root', title: '得地', text: rootDetail.text },
        { key: 'support', title: '得助', text: supportDetail.text },
        { key: 'structure', title: '格局校验', text: structureException.text },
      ],
      sections: [
        { key: 'season', title: '得令', score: seasonDetail.score, text: moonText },
        { key: 'root', title: '得地', score: rootDetail.score, text: groundText },
        { key: 'support', title: '得助', score: supportDetail.score, text: stemText },
        { key: 'final', title: '综合结论', score: totalStrengthScore, text: finalText },
        { key: 'structure', title: '特殊格局校验', score: structureAdjustment, text: structureException.text },
      ],
      metrics: {
        moon_score: moonScore,
        ground_score: groundScore,
        stem_help_score: stemHelpScore,
        structure_adjustment: structureAdjustment,
        dominant_element: dominantElement,
        dominant_ratio: dominantRatio,
        day_master_has_root: dayMasterHasRoot,
        stem_has_help: stemHasHelp,
      },
    };

    return {
      strongWeak,
      strongScore,
      scores,
      ganScores,
      weak,
      meStatus,
      allShens,
      moonScore,
      moonPhase: monthPhase,
      moonPhaseStrength: moonRule.strength,
      groundScore,
      branchScores,
      stemHelpScore,
      stemHelpBreakdown,
      totalStrengthScore,
      dayMasterHasRoot,
      stemHasHelp,
      dominantElement,
      dominantRatio,
      strengthBasis: basisLines.join(' '),
      strengthDetail,
    };
  },

  /**
   * 推断喜忌神 (4-Dimension Scoring System)
   * 维度 1: 调候 (Tiaohou)
   * 维度 2: 病药 (Bingyao)
   * 维度 3: 通关 (Tongguan)
   * 维度 4: 扶抑 (Fuyi)
   */
  getFavorableUnfavorable(dayGan, monthZhi, geJu, strengthResult, zhis, gans, geJuInfoRecord = null, imageAnalysis = null, chengGeDetail = null) {
    const SHISHEN_NAMES = [
      "比肩", "劫财",   // 比劫类
      "食神", "伤官",   // 食伤类
      "正财", "偏财",   // 财类
      "正官", "七杀",   // 官杀类
      "正印", "偏印"    // 印枭类
    ];

    const GE_JU_PROTECTED_MAP = {
      "正印格": ["正印"], "偏印格": ["偏印"],
      "食神格": ["食神"], "伤官格": ["伤官"],
      "正财格": ["正财"], "偏财格": ["偏财"],
      "正官格": ["正官"], "七杀格": ["七杀", "食神"],
      "建禄格": [], "月刃格": ["七杀"], "羊刃格": ["七杀"]
    };
    const geJuProtectedShens = GE_JU_PROTECTED_MAP[geJu] || [];

    // Pre-processing A: WuXing Power
    const wuxingScores = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    gans.forEach(g => { wuxingScores[C.GAN5[g]] += 1.0; });
    zhis.forEach(z => {
      const hides = C.ZHI5_LIST[z] || [];
      if (hides[0]) wuxingScores[C.GAN5[hides[0]]] += 0.8 * (gans.includes(hides[0]) ? 1.5 : 1);
      if (hides[1]) wuxingScores[C.GAN5[hides[1]]] += 0.5 * (gans.includes(hides[1]) ? 1.5 : 1);
      if (hides[2]) wuxingScores[C.GAN5[hides[2]]] += 0.3 * (gans.includes(hides[2]) ? 1.5 : 1);
    });
    
    let totalScore = 0;
    Object.values(wuxingScores).forEach(s => totalScore += s);
    const wuxingRatio = {};
    Object.keys(wuxingScores).forEach(wx => {
      wuxingRatio[wx] = totalScore > 0 ? (wuxingScores[wx] / totalScore) * 100 : 0;
    });

    const scores = {};
    const breakdown = {};
    SHISHEN_NAMES.forEach(shen => {
      scores[shen] = 0;
      breakdown[shen] = { tiaohou: 0, bingyao: 0, tongguan: 0, fuyi: 0, geju: 0, chengge: 0, cong: 0, rescue: 0, conflict: 0 };
    });
    const favorableConflicts = [];

    const getShenWuxing = shen => getWuxingByShenFull(dayGan, shen);
    const getShensByWuxing = wx => SHISHEN_NAMES.filter(shen => getShenWuxing(shen) === wx);
    const sortShensByTransparency = shens => [...shens].sort((left, right) => {
      const leftStem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[left]);
      const rightStem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[right]);
      const leftVisible = leftStem && gans.includes(leftStem) ? 1 : 0;
      const rightVisible = rightStem && gans.includes(rightStem) ? 1 : 0;
      return rightVisible - leftVisible;
    });
    const makeWuxingResult = (favShens, unfavShens) => {
      const favorable = [...new Set(favShens.map(getShenWuxing))];
      const unfavorable = [...new Set(unfavShens.map(getShenWuxing))]
        .filter(wx => !favorable.includes(wx));
      return { favorable, unfavorable };
    };

    const getSpecialPattern = () => {
      if (chengGeDetail?.patternEffects?.qiongTongPriority === true) return null;
      const chengGePromotesWealth =
        chengGeDetail?.chengGe === '伤官生财格'
        && (chengGeDetail?.patternEffects?.promotedShens || []).some(shen => ['财', '才'].includes(shen));
      if (chengGePromotesWealth) return null;
      const candidate = imageAnalysis?.override_candidate
        || imageAnalysis?.primary_candidate;
      const overrideScope = candidate?.override_scope;
      const scopeAllowsOverride = ['full', 'xiji_yongshen', 'yongshen_only'].includes(overrideScope);
      const legacyAllowsOverride = overrideScope == null && candidate?.override_normal_pattern === true;
      if (!candidate || (!scopeAllowsOverride && !legacyAllowsOverride)) return null;
      const overrideMeta = {
        override_scope: overrideScope || (legacyAllowsOverride ? 'full' : undefined)
      };

      if (candidate.category === 'SINGLE_IMAGE') {
        const targetElement = candidate.target_element || C.GAN5[dayGan];
        const outputElement = SHENG_CYCLE[targetElement];
        const hiddenStemRootScore = stem => zhis.reduce((sum, zhi, pillarIndex) => {
          const hides = C.ZHI5_LIST[zhi] || [];
          const hiddenIndex = hides.indexOf(stem);
          if (hiddenIndex < 0) return sum;
          return sum + getHiddenStemWeight(hiddenIndex) * getPillarRootWeight(pillarIndex);
        }, 0);
        const outputShens = sortShensByTransparency(getShensByWuxing(outputElement))
          .sort((left, right) => {
            const leftStem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[left]);
            const rightStem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[right]);
            const leftRootScore = hiddenStemRootScore(leftStem);
            const rightRootScore = hiddenStemRootScore(rightStem);
            return rightRootScore - leftRootScore;
          });
        const outputHasEvidence = outputShens.some(shen => {
          const stem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[shen]);
          return (stem && gans.includes(stem)) || hiddenStemRootScore(stem) > 0;
        });
        const wealthElement = SHENG_CYCLE[outputElement];
        const wealthShens = getShensByWuxing(wealthElement);
        const wealthExposed = wealthShens.some(shen => {
          const stem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[shen]);
          return stem && gans.includes(stem);
        });
        const completeWoodFrame = candidate.reason_codes?.includes('SINGLE_IMAGE_COMPLETE_WOOD_FRAME') === true;
        const sameCampBranchFrame = candidate.reason_codes?.includes('SINGLE_IMAGE_ALL_BRANCHES_SUPPORT_FORCE') === true;
        const flowingWealthShens = outputHasEvidence && wealthExposed && !completeWoodFrame && !sameCampBranchFrame ? wealthShens : [];
        const frameSealShens = completeWoodFrame || sameCampBranchFrame ? ['正印', '偏印'] : [];
        if (sameCampBranchFrame) {
          const yongPriority = sortShensByTransparency([...frameSealShens, '比肩', '劫财']);
          return {
            ...overrideMeta,
            type: '专旺',
            yongPriority,
            favorable: [...new Set(['比肩', '劫财', ...frameSealShens])],
            unfavorable: ['正官', '七杀', '正财', '偏财'],
            scoreMode: 'single_image_ranked'
          };
        }
        return {
          ...overrideMeta,
          type: '专旺',
          yongPriority: outputShens,
          favorable: [...new Set(['比肩', '劫财', '食神', '伤官', ...flowingWealthShens, ...frameSealShens])],
          unfavorable: [
            '正官', '七杀',
            ...(flowingWealthShens.length ? [] : ['正财', '偏财']),
            ...(completeWoodFrame ? [] : ['正印', '偏印'])
          ],
          scoreMode: 'single_image_ranked'
        };
      }

      if (candidate.category === 'TRANSFORMATION_IMAGE') {
        const targetElement = candidate.target_element;
        return {
          ...overrideMeta,
          type: candidate.subtype,
          favorable: getShensByWuxing(targetElement),
          unfavorable: getShensByWuxing(RESTRAINING_CYCLE[targetElement])
        };
      }

      if (candidate.category === 'TWO_QI_IMAGE') {
        if (candidate.yongshen_strategy === 'DESCRIPTIVE_ONLY') return null;

        const targetElements = candidate.target_elements || [];
        const targetShens = [...new Set(targetElements.flatMap(getShensByWuxing))];
        const dayElement = C.GAN5[dayGan];
        const outputElement = SHENG_CYCLE[dayElement];

        if (candidate.yongshen_strategy === 'TWO_QI_CLEAR_FLOW') {
          const yongElements = targetElements.includes(outputElement)
            ? [outputElement]
            : targetElements;
          return {
            ...overrideMeta,
            type: candidate.subtype,
            yongPriority: sortShensByTransparency(yongElements.flatMap(getShensByWuxing)),
            favorable: targetShens,
            unfavorable: [...new Set(['火', '土'].flatMap(getShensByWuxing))],
            scoreMode: 'ranked'
          };
        }

        if (candidate.yongshen_strategy === 'TWO_QI_FOLLOW_FORCE') {
          const yongElements = targetElements.filter(element => element !== dayElement);
          const priorityElements = yongElements.length ? yongElements : targetElements;
          return {
            ...overrideMeta,
            type: candidate.subtype,
            yongPriority: sortShensByTransparency(priorityElements.flatMap(getShensByWuxing)),
            favorable: targetShens,
            unfavorable: Object.keys(SHENG_CYCLE)
              .filter(element => !targetElements.includes(element))
              .flatMap(getShensByWuxing),
            scoreMode: 'ranked'
          };
        }

        if (candidate.yongshen_strategy === 'TWO_QI_HUNT_WEAK_ENEMY') {
          const weakEnemyElements = candidate.weak_enemy_elements || [];
          const weakEnemyShens = sortShensByTransparency(weakEnemyElements.flatMap(getShensByWuxing));
          return {
            ...overrideMeta,
            type: candidate.subtype,
            yongPriority: weakEnemyShens.length ? weakEnemyShens : targetShens,
            favorable: [...new Set([...weakEnemyShens, ...targetShens])],
            unfavorable: [],
            scoreMode: 'ranked'
          };
        }

        return null;
      }

      if (candidate.category !== 'FOLLOW_IMAGE') return null;

      if (candidate.subtype === '从财格') {
        const targetElements = candidate.target_elements || [];
        const officerKillElement = RESTRAINING_CYCLE[C.GAN5[dayGan]];
        const officerKillBranchRootCount = zhis.filter(zhi =>
          (C.ZHI5_LIST[zhi] || []).some(stem => C.GAN5[stem] === officerKillElement)
        ).length;
        const officerKillHasStrongEvidence =
          gans.some((gan, index) => index !== 2 && C.GAN5[gan] === officerKillElement)
          || zhis.some(zhi => C.GAN5[(C.ZHI5_LIST[zhi] || [])[0]] === officerKillElement)
          || officerKillBranchRootCount >= 3;
        const effectiveTargetElements = targetElements.filter(element =>
          element !== officerKillElement || officerKillHasStrongEvidence
        );
        const filteredOfficerKillShens =
          targetElements.includes(officerKillElement) && !officerKillHasStrongEvidence
            ? getShensByWuxing(officerKillElement)
            : [];
        const favorable = targetElements.length
          ? [...new Set(effectiveTargetElements.flatMap(getShensByWuxing))]
          : ['食神', '伤官', '正财', '偏财', '正官', '七杀'];
        const unfavorable = [...new Set(['正印', '偏印', '比肩', '劫财', ...filteredOfficerKillShens])];
        return {
          ...overrideMeta,
          type: '从财',
          favorable,
          unfavorable,
          yongPriority: sortShensByTransparency(favorable),
          scoreMode: 'ranked'
        };
      }
      if (candidate.subtype === '从官杀格' || candidate.subtype === '从杀格') {
        return {
          ...overrideMeta,
          type: candidate.subtype === '从杀格' ? '从杀' : '从官杀',
          favorable: ['正官', '七杀', '正财', '偏财'],
          unfavorable: ['正印', '偏印', '比肩', '劫财', '食神', '伤官']
        };
      }
      if (candidate.subtype === '从儿格') {
        return {
          ...overrideMeta,
          type: '从食伤',
          favorable: ['食神', '伤官', '正财', '偏财'],
          unfavorable: ['正印', '偏印', '比肩', '劫财', '正官', '七杀']
        };
      }
      if (candidate.subtype === '从势格') {
        return {
          ...overrideMeta,
          type: '从势',
          favorable: [...new Set((candidate.target_elements || []).flatMap(getShensByWuxing))],
          unfavorable: ['比肩', '劫财', '正印', '偏印']
        };
      }
      return null;
    };

    const tiaohouStr = C.TIAOHOUS[dayGan + monthZhi] || '';
    const parsedTiaohou = parseTiaohou(tiaohouStr);
    const tiaohouNeededWuxing = [...new Set(parsedTiaohou.favorable.map(item => C.GAN5[item.gan]))];
    const tiaohouHarmfulWuxing = [...new Set(parsedTiaohou.unfavorable.map(item => C.GAN5[item.gan]))];

    const specialPattern = getSpecialPattern();
    if (specialPattern) {
      const tiaohouDetail = buildTiaohouDetail(dayGan, monthZhi, parsedTiaohou, specialPattern);
      for (const shen of specialPattern.favorable) {
        let score = 80;
        if (specialPattern.scoreMode === 'ranked') {
          const priorityIndex = (specialPattern.yongPriority || []).indexOf(shen);
          score = priorityIndex >= 0 ? 90 - (priorityIndex * 5) : 70;
        } else if (specialPattern.scoreMode === 'single_image_ranked') {
          const priorityIndex = (specialPattern.yongPriority || []).indexOf(shen);
          score = priorityIndex >= 0 ? 90 - (priorityIndex * 5) : 75;
        }
        scores[shen] = score;
        breakdown[shen].cong = score;
      }
      for (const shen of specialPattern.unfavorable) {
        scores[shen] = -80;
        breakdown[shen].cong = -80;
      }
      const wuxing = makeWuxingResult(specialPattern.favorable, specialPattern.unfavorable);
      const spFiveShens = classifyFiveShens(SHISHEN_NAMES, scores);
      const isFullOverride = specialPattern.override_scope === 'full' || specialPattern.override_scope == null;
      const spDecisionChain = [{
        layer: 'L0 特殊气势',
        reason: isFullOverride
          ? `识别为${specialPattern.type}，顺其成势，跳过常规四维。`
          : `识别为${specialPattern.type}，主导用神喜忌，常规格局与旺衰仍保留为背景。`,
        override: isFullOverride ? '覆盖全部下层' : '主导用神喜忌'
      }];
      return {
        wuxing,
        core_shens: { favorable: specialPattern.favorable, unfavorable: specialPattern.unfavorable },
        five_shens: spFiveShens,
        scoring_details: scores,
        dimension_breakdown: breakdown,
        wuxing_ratio: wuxingRatio,
        tiaohou_detail: tiaohouDetail,
        special_pattern: specialPattern,
        favorable_conflicts: favorableConflicts,
        decision_chain: spDecisionChain,
        verdict: `此局识别为${specialPattern.type}，先顺其成势，喜${specialPattern.favorable.join('、')}，忌${specialPattern.unfavorable.join('、')}。 此局从势，顺其气势为佳。`
      };
    }

    // Dimension 1: Tiaohou
    const tiaohouDetail = buildTiaohouDetail(dayGan, monthZhi, parsedTiaohou);

    let vetoTriggered = false;
    const scoreTiaohou = () => {
      for (const item of parsedTiaohou.favorable) {
        const shen = getFullShenByStem(dayGan, item.gan);
        if (!shen) continue;
        const score = getTiaohouWeight(item.priority);
        scores[shen] += score;
        breakdown[shen].tiaohou += score;
      }
      for (const item of parsedTiaohou.unfavorable) {
        const wx = C.GAN5[item.gan];
        const shen = getFullShenByStem(dayGan, item.gan);
        if (!shen) continue;
        const restrainingWx = RESTRAINING_CYCLE[wx];
        const hasRestrainingGan = gans.some(g => C.GAN5[g] === restrainingWx);
        const penalty = getTiaohouUnfavorablePenalty(wuxingRatio[wx] || 0, hasRestrainingGan);
        if (penalty) {
          scores[shen] += penalty;
          breakdown[shen].tiaohou += penalty;
          if (penalty <= -35) vetoTriggered = true;
        }
      }
    };
    scoreTiaohou();

    // Dimension 2: Bingyao
    let hasBing = false;
    const bingElements = [];
    const scoreBingyao = () => {
      for (let wx of Object.keys(wuxingRatio)) {
        const ratio = wuxingRatio[wx];
        if (ratio > 35) {
          hasBing = true;
          const heavy = ratio > 45;
          const bingWx = wx;
          const zhengYaoWx = RESTRAINING_CYCLE[bingWx];
          const fuYaoWx = SHENG_CYCLE[bingWx];
          const bingScore = heavy ? -40 : -20;
          const zhengYaoScore = heavy ? 40 : 20;
          const fuYaoScore = heavy ? 20 : 10;
          bingElements.push({ element: bingWx, heavy, ratio });
          
          for (let shen of SHISHEN_NAMES) {
            const sWx = getShenWuxing(shen);
            if (sWx === bingWx) { scores[shen] += bingScore; breakdown[shen].bingyao += bingScore; }
            if (sWx === zhengYaoWx) { scores[shen] += zhengYaoScore; breakdown[shen].bingyao += zhengYaoScore; }
            if (sWx === fuYaoWx) { scores[shen] += fuYaoScore; breakdown[shen].bingyao += fuYaoScore; }
          }
        }
      }
    };
    scoreBingyao();

    // Dimension 3: Tongguan
    const scoreTongguan = () => {
      const tongguanMap = [
        { c1: '金', c2: '木', bridge: '水' },
        { c1: '水', c2: '火', bridge: '木' },
        { c1: '火', c2: '金', bridge: '土' },
        { c1: '木', c2: '土', bridge: '火' },
        { c1: '土', c2: '水', bridge: '金' }
      ];
      for (let rule of tongguanMap) {
        if (wuxingRatio[rule.c1] > 25 && wuxingRatio[rule.c2] > 25) {
          if (wuxingRatio[rule.bridge] < 15) {
            // 通关神「有根」闸（《滴天髓·通关》"能胜能补、通根得地"）：通关神若在地支
            // 全无根，则为虚浮幻影，无力承载交战两气、自顾不暇，不予通关分。否则会把
            // 无根之神（如冼冠生庚金亥月之比劫，金10%且地支无金根）误捧为用神。
            const bridgeRooted = zhis.some(z => (C.ZHI5_LIST[z] || []).some(h => C.GAN5[h] === rule.bridge));
            if (!bridgeRooted) continue;
            for (let shen of SHISHEN_NAMES) {
              const sWx = getWuxingByShenFull(dayGan, shen);
              if (sWx === rule.bridge) {
                scores[shen] += 30;
                breakdown[shen].tongguan = 30;
              }
            }
          }
        }
      }
    };
    scoreTongguan();

    // 调候为急——"冬木不受水"型（《滴天髓·寒暖》"冬木不受水者，喜火之解冻也"；《穷通宝鉴》
    // "冬月之木…火重见温暖有功"）：仅当 ①生于寒月(亥子丑) 且 ②日主印星恰为"水"——即印星正被
    // 气候冻结、水冻不能生木、印星失效；此时调候之神（火）虽泄身，实为解冻、恢复生机，故其在
    // 扶抑维度的负分豁免为 0，使调候优先于扶抑。
    // 文献边界：③调候之神须在地支有根（无根虚浮则当从其寒势，交由 L0 从格逻辑处理，不在此列）。
    // 反例守护：若日主印星非受困之水（如庚金之印为土、壬水之印为金，土金不冻仍能生身），则印星
    // 有效、当以扶抑取印，不触发本豁免（保证冼冠生庚金亥月仍走扶抑，不被误判为调候优先）。
    const tiaohouUrgentRootedShens = new Set();
    const sealWx = getShenWuxing('正印');
    const isColdMonth = ['亥', '子', '丑'].includes(monthZhi);
    if (isColdMonth && sealWx === '水') {
      for (const item of parsedTiaohou.favorable) {
        const wx = C.GAN5[item.gan];
        const rooted = zhis.some(z => (C.ZHI5_LIST[z] || []).some(h => C.GAN5[h] === wx));
        const shen = getFullShenByStem(dayGan, item.gan);
        if (rooted && shen) tiaohouUrgentRootedShens.add(shen);
      }
    }

    // Dimension 4: Fuyi
    const scoreFuyi = () => {
      const isWeak = strengthResult.strongWeak === "身弱";
      const isStrong = strengthResult.strongWeak === "身强";
      const isMiddle = strengthResult.strongWeak === "身中";
      // 「身中」内部偏弱/偏强的分界取 中和带 [4.3, 5.7] 的中点 5.0，而非旧值 5.5。
      // 旧值把中和带 86% 的区间都判为偏弱（仅 [5.5,5.7] 算偏强），对坐禄/有印的中和盘
      // 偏保守，会把本该泄秀生财（身能任财）的盘压成「需扶」，致财被判忌、印比被判喜，
      // 与「食神生财、用火喜土忌水木」类盘相反。以带中点为界后，恰在中点（如甲木子月
      // 坐寅禄+水印，综合 5.0）归偏强侧，喜泄耗（食伤财官）、忌帮身（印比），方向归位。
      const middleLeansWeak = Number(strengthResult.totalStrengthScore || 0) < 5.0;

      for (let shen of SHISHEN_NAMES) {
        let fuyiScore = 0;
        const isShengFu = ['正印', '偏印', '比肩', '劫财'].includes(shen);
        const isKeXieHao = ['正官', '七杀', '食神', '伤官', '正财', '偏财'].includes(shen);

        if (isWeak) {
          if (isShengFu) fuyiScore = 20;
          if (isKeXieHao) fuyiScore = -20;
        } else if (isStrong) {
          if (isKeXieHao) fuyiScore = 20;
          if (isShengFu) fuyiScore = -20;
        } else if (isMiddle) {
          if (middleLeansWeak) {
            if (isShengFu) fuyiScore = 10;
            if (isKeXieHao) fuyiScore = -10;
          } else {
            if (isKeXieHao) fuyiScore = 10;
            if (isShengFu) fuyiScore = -10;
          }
        }

        if (fuyiScore < 0 && (geJuProtectedShens.includes(shen) || tiaohouUrgentRootedShens.has(shen))) {
          fuyiScore = 0;
        }

        scores[shen] += fuyiScore;
        breakdown[shen].fuyi = fuyiScore;
      }
    };
    scoreFuyi();

    // Dimension 5 (新增): 格局 — 格局辅神/制化神加分
    const SHUN_YONG_SET = new Set(['顺用']);
    const scoreGeJu = () => {
      if (!geJuInfoRecord) return;
      const shunNi = geJuInfoRecord.shunNi || '';
      const xianShens = parseShenText(geJuInfoRecord.xianShenTypical || '');
      for (const shen of xianShens) {
        if (scores[shen] !== undefined) {
          scores[shen] += 20;
          breakdown[shen].geju += 20;
        }
      }
      // 顺用格：格局主体善神也直接受益
      if (SHUN_YONG_SET.has(shunNi)) {
        const coreShens = parseShenText(geJuInfoRecord.yongShenTypical || '');
        for (const shen of coreShens) {
          if (scores[shen] !== undefined && !xianShens.includes(shen)) {
            scores[shen] += 15;
            breakdown[shen].geju += 15;
          }
        }
      }
    };
    scoreGeJu();

    const chengGeEffects = { yongShens: [], xianShens: [], invalidatedShens: [], assistantShens: [] };
    const scoreChengGe = () => {
      if (!chengGeDetail) return;
      const status = chengGeDetail.chengGeResult || '';
      const yongShens = parseShenText(chengGeDetail.yongShenTenGod || '');
      const xianShens = parseShenText(chengGeDetail.xianShen || '');

      if (status === '成格') {
        for (const shen of yongShens) {
          if (scores[shen] === undefined) continue;
          const bonus = 70;
          scores[shen] += bonus;
          breakdown[shen].chengge += bonus;
          chengGeEffects.yongShens.push(shen);
        }
        for (const shen of xianShens) {
          if (scores[shen] === undefined || chengGeEffects.yongShens.includes(shen)) continue;
          const bonus = 25;
          scores[shen] += bonus;
          breakdown[shen].chengge += bonus;
          chengGeEffects.xianShens.push(shen);
        }
        if (chengGeEffects.xianShens.length) {
          favorableConflicts.push({
            type: 'formed_pattern_assistant_shen',
            shens: [...chengGeEffects.xianShens],
            message: `${chengGeDetail.chengGe || geJu}已成格，相神${chengGeEffects.xianShens.join('、')}保留为喜，不按普通分层落闲忌。`
          });
        }
      } else if (status === '败格') {
        const invalidatedShens = [...new Set([...yongShens, ...xianShens])];
        for (const shen of invalidatedShens) {
          if (scores[shen] === undefined) continue;
          const penalty = -70;
          scores[shen] += penalty;
          breakdown[shen].chengge += penalty;
          chengGeEffects.invalidatedShens.push(shen);
        }
      }
    };
    scoreChengGe();

    const applyPatternEffects = () => {
      const effects = chengGeDetail?.patternEffects || {};
      const promotedShens = parseShenText((effects.promotedShens || []).join('、'));
      const protectedShens = parseShenText((effects.protectedShens || []).join('、'));
      const invalidatedShens = parseShenText((effects.invalidatedShens || []).join('、'));
      const demotedShens = parseShenText((effects.demotedShens || []).join('、'));
      const assistantShens = parseShenText((effects.assistantShens || []).join('、'));

      for (const shen of invalidatedShens) {
        if (scores[shen] === undefined) continue;
        const target = -70;
        const delta = Math.min(0, target - scores[shen]);
        scores[shen] += delta;
        breakdown[shen].conflict += delta;
        if (!chengGeEffects.invalidatedShens.includes(shen)) chengGeEffects.invalidatedShens.push(shen);
      }

      for (const shen of demotedShens) {
        if (scores[shen] === undefined) continue;
        const target = -35;
        const delta = Math.min(0, target - scores[shen]);
        scores[shen] += delta;
        breakdown[shen].conflict += delta;
        if (!chengGeEffects.invalidatedShens.includes(shen)) chengGeEffects.invalidatedShens.push(shen);
      }

      for (const shen of promotedShens) {
        if (scores[shen] === undefined) continue;
        const topScore = Math.max(...Object.values(scores));
        if (scores[shen] <= topScore) {
          const delta = topScore - scores[shen] + 1;
          scores[shen] += delta;
          breakdown[shen].conflict += delta;
        }
        if (!chengGeEffects.yongShens.includes(shen)) chengGeEffects.yongShens.push(shen);
      }

      // ASSISTANT_XI：记录相神/喜（封顶逻辑在所有层之后统一执行，见 applyAssistantCap）。
      if (assistantShens.length) {
        chengGeEffects.assistantShens = assistantShens;
        favorableConflicts.push({
          type: 'pattern_effect_assistant_shen',
          shens: [...assistantShens],
          message: `${chengGeDetail?.chengGe || geJu}以${assistantShens.join('、')}为相神/喜，保留为喜但不得越用神上位。`
        });
      }

      const protectedFullShens = [...new Set([...protectedShens, ...promotedShens])];
      for (const shen of protectedFullShens) {
        if (scores[shen] === undefined) continue;
        if (scores[shen] < 0) {
          const delta = -scores[shen];
          scores[shen] += delta;
          breakdown[shen].conflict += delta;
        }
      }

      if (protectedFullShens.length) {
        favorableConflicts.push({
          type: 'pattern_effect_protected_shen',
          shens: protectedFullShens,
          message: `${chengGeDetail?.chengGe || geJu}结构保留${protectedFullShens.join('、')}，不按普通扶抑或同五行折叠落忌。`
        });
      }
    };
    applyPatternEffects();

    const resolveWeakResourceConflict = () => {
      if (strengthResult.strongWeak !== '身弱') return;
      const resourceShens = ['正印', '偏印'];
      const resourceElement = getShenWuxing('正印');
      const resourceBing = bingElements.find(item => item.element === resourceElement);
      if (!resourceBing) return;

      const damagedResources = resourceShens.filter(shen => breakdown[shen].bingyao < 0);
      if (!damagedResources.length) return;

      const bestResource = damagedResources.sort((a, b) => scores[b] - scores[a])[0];
      if (scores[bestResource] <= 0) {
        const adjustment = 5 - scores[bestResource];
        scores[bestResource] += adjustment;
        breakdown[bestResource].conflict += adjustment;
      }
      for (const shen of resourceShens) {
        if (shen !== bestResource && scores[shen] < 0) {
          const adjustment = -scores[shen];
          scores[shen] = 0;
          breakdown[shen].conflict += adjustment;
        }
      }
      favorableConflicts.push({
        type: 'weak_daymaster_excess_resource',
        element: resourceElement,
        shens: damagedResources,
        message: `${resourceElement}为印星，能生扶身弱日主，但原局${resourceElement}过旺成病；印仍保留弱喜，需火/土等药神平衡。`
      });
    };
    resolveWeakResourceConflict();

    // 印星救主格（弃官就印 / 无根佩印 / 伤官佩印）
    // 《滴天髓·衰旺》"干多不如根重""天干得一比肩不如地支得一余气墓库"；《滴天髓·体用》
    // "日主弱官杀旺则以印绶为用""日主弱食伤多亦以印绶为用"；《三命通会·论印绶》印为母象
    // 生根气。→ 身弱且日主无根、又遭旺神(官杀/食伤)泄克时，唯有根之印能化杀/制食、生身救主，
    // 当弃顺逆机械取法、就印为用。
    // 条件：①身弱 ②日主无根（地支全无日主五行余气）③旺神压身（官杀+食伤合占>28%）
    //       ④印星五行在地支有根、且至少一枚印透出天干（虚浮无根/不透之印难以担当救主）。
    // 效果：透出之有根印 +救主结构分，确立为用神；并清除旺官（官杀）因调候/顺逆所得的高分
    //       （弃官就印），使病神不致越于救主印之上。
    const applyYinRescue = () => {
      if (strengthResult.strongWeak !== '身弱') return null;
      const dmWx = C.GAN5[dayGan];
      const dmRooted = zhis.some(z => (C.ZHI5_LIST[z] || []).some(h => C.GAN5[h] === dmWx));
      if (dmRooted) return null; // 日主有根，不属"无根需印"
      const guanShaWx = RESTRAINING_CYCLE[dmWx]; // 克我者（官杀）
      const shiShangWx = SHENG_CYCLE[dmWx];      // 我泄者（食伤）
      const besiegeRatio = (wuxingRatio[guanShaWx] || 0) + (wuxingRatio[shiShangWx] || 0);
      if (besiegeRatio <= 28) return null;       // 官杀/食伤未成压身之势
      const sealWx = getShenWuxing('正印');
      const sealRooted = zhis.some(z => (C.ZHI5_LIST[z] || []).some(h => C.GAN5[h] === sealWx));
      if (!sealRooted) return null;              // 印无根，难担救主
      const rescueSeals = ['正印', '偏印'].filter(shen => {
        const stem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[shen]);
        return stem && gans.includes(stem);      // 印须透出天干方可取用救主
      });
      if (!rescueSeals.length) return null;

      const RESCUE_BONUS = 40;
      for (const shen of rescueSeals) {
        scores[shen] += RESCUE_BONUS;
        breakdown[shen].rescue += RESCUE_BONUS;
      }
      // 弃官就印：剥夺旺官（官杀）凭调候/顺逆获得的高分，令病神不越救主印
      for (const shen of ['正官', '七杀', '食神', '伤官']) {
        if (breakdown[shen].tiaohou > 0) {
          scores[shen] -= breakdown[shen].tiaohou;
          breakdown[shen].tiaohou = 0;
        }
      }
      return { seals: rescueSeals, sealWx, guanShaWx, shiShangWx };
    };
    const yinRescue = applyYinRescue();

    // 羊刃驾杀格（杀刃相济 / 拔刃敌杀）
    // 《三命通会·论羊刃》"煞无刃不显，刃无煞不威，煞刃俱全…膺职掌于兵权"——羊刃驾杀主武贵刚猛；
    // 《滴天髓·刚柔》"天战犹自可，地战急如火"——身弱七杀格、日主自坐羊刃且官杀旺紧贴交战时，
    // 文和之印化杀来不及，须以羊刃（劫财）敌杀保命为用神；调候之印此刻降为喜神（暖局/生刃化杀），
    // 不得凭调候首取的 +50 高分僭越解决生死攻身的用神。此即与 C04「调候为急」对偶的另一侧——
    // 修复②让"调候火该上位时上位"（调候神即病药神，作用神）；此处防"调候木上位过头"（调候神非
    // 病药神，仅作喜神）。统一语义：调候神唯有兼为去病/救主之神方可作用神，否则只作喜神。
    // 条件：①身弱 ②七杀格 ③日主自坐羊刃（阳干帝旺支：甲卯/丙戊午/庚酉/壬子）④官杀（克我五行）旺
    //       >25%（成攻身之势）。效果：羊刃（劫财）+结构分确立为用神；剥夺印星凭调候所得高分（调候
    //       让位），并给印星+喜神结构分（印生刃化杀），使羊刃用神不被调候神僭越、印星归位为顶级喜神。
    const applyYangRenDriveSha = () => {
      if (strengthResult.strongWeak !== '身弱') return null;
      if (geJu !== '七杀格') return null;
      const yangRen = C.YANG_REN[dayGan];        // 仅阳干有羊刃
      if (!yangRen) return null;
      if (zhis[2] !== yangRen) return null;       // 须日主自坐羊刃（日支为羊刃）
      const guanShaWx = RESTRAINING_CYCLE[C.GAN5[dayGan]]; // 克我者（官杀）
      if ((wuxingRatio[guanShaWx] || 0) <= 25) return null; // 官杀未成攻身之势
      const REN_BONUS = 40;   // 羊刃敌杀，确立用神
      const SEAL_BONUS = 20;  // 印生刃化杀，归位为顶级喜神
      scores['劫财'] += REN_BONUS;
      breakdown['劫财'].rescue += REN_BONUS;
      // 调候让位：剥夺印星凭调候所得高分（调候作喜不作用神），再补喜神结构分。
      // 喜神结构分只给「实印」——兼调候之印（调候首取神）或透干之印；虚浮无根不透之印
      // （如丙午造之乙木正印，既不透干、地支亦无乙根）不滥充喜神，使顶级喜神归于真正生
      // 刃化杀的偏印（甲木，调候首取且根在寅亥），与教材「寅木偏印为喜神」对齐。
      for (const shen of ['正印', '偏印']) {
        const carriesTiaohou = breakdown[shen].tiaohou > 0;
        if (carriesTiaohou) {
          scores[shen] -= breakdown[shen].tiaohou;
          breakdown[shen].tiaohou = 0;
        }
        const stem = getStemByShen(dayGan, FULL_TO_SHORT_SHEN[shen]);
        const transparent = stem && gans.includes(stem);
        if (carriesTiaohou || transparent) {
          scores[shen] += SEAL_BONUS;
          breakdown[shen].rescue += SEAL_BONUS;
        }
      }
      return { yangRen, guanShaWx };
    };
    const yangRenDriveSha = applyYangRenDriveSha();

    const protectPrimaryTiaohouUse = () => {
      if (chengGeDetail?.patternEffects?.qiongTongPriority === true) return;
      const primary = parsedTiaohou.favorable.find(item => item.priority === 1);
      if (!primary) return;
      const primaryShen = getFullShenByStem(dayGan, primary.gan);
      if (!primaryShen) return;
      const topScore = Math.max(...Object.values(scores));
      if (scores[primaryShen] > 0 && topScore - scores[primaryShen] <= 10) {
        const bonus = topScore - scores[primaryShen] + 1;
        scores[primaryShen] += bonus;
        breakdown[primaryShen].conflict += bonus;
      }
    };
    protectPrimaryTiaohouUse();

    if (geJu === '正官格' && scores['正印'] > 0 && scores['正官'] > 0) {
      favorableConflicts.push({
        type: 'official_seal_chain',
        shens: ['正官'],
        message: '正官格用印时，正官与正印构成官印相生，正官保留为喜神，不因同五行七杀受忌而整体折叠为忌。',
      });
    }

    // 高置信结构用神窄保护（§16.4）：仅对「逆用/制化」类高置信成法，护其用神不被身弱扶抑/病药反向打入忌。
    // 不做全局调候降权（P1-e 教训：会误伤真调候用神）；白名单刻意排除食神制杀格（章士钊灵枭得用，gold=偏印）
    // 与一切「用X喜Y」低置信成法（P1-e 曾因此打坏伍朝枢/王少师等）。让位于印星救主/羊刃驾杀。
    const STRUCTURAL_CHENGGE = new Set(['印格用杀格', '金水食神用杀格', '化伤为财生官格', '去杀留官格', '去官留杀格', '合杀留官格', '化官为印格', '七杀用财格', '财格佩印格', '财旺身弱用印格', '制杀生财格']);
    if (chengGeDetail && chengGeDetail.chengGeResult === '成格'
        && STRUCTURAL_CHENGGE.has(chengGeDetail.chengGe)
        && chengGeEffects.yongShens.length && !yinRescue && !yangRenDriveSha) {
      for (const shen of chengGeEffects.yongShens) {
        for (const dim of ['fuyi', 'bingyao']) {
          if (breakdown[shen][dim] < 0) { scores[shen] -= breakdown[shen][dim]; breakdown[shen][dim] = 0; }
        }
      }
    }

    // ASSISTANT_XI 封顶（所有层之后统一执行）：相神/喜保留为正分，但封顶在用神之下，永不上位为用。
    // 放最后，确保不被病药/扶抑/资源救济等后续层重新抬高（如食制杀身弱，印帮身为喜却夺制神之用）。
    if (chengGeEffects.assistantShens.length && chengGeEffects.yongShens.length && !yinRescue && !yangRenDriveSha) {
      const yongTop = Math.max(...chengGeEffects.yongShens.map(s => scores[s] ?? 0));
      const cap = Math.max(5, yongTop - 10);
      for (const shen of chengGeEffects.assistantShens) {
        if (scores[shen] === undefined || chengGeEffects.yongShens.includes(shen)) continue;
        const target = scores[shen] < 5 ? 5 : Math.min(scores[shen], cap);
        if (target !== scores[shen]) {
          breakdown[shen].conflict += target - scores[shen];
          scores[shen] = target;
        }
      }
    }

    // 聚合 — 五神分层
    const conflictShens = favorableConflicts.flatMap(item => item.shens);
    const fiveShens = classifyFiveShens(SHISHEN_NAMES, scores, conflictShens);
    const favShens = fiveShens.favorable;
    const unfavShens = fiveShens.unfavorable;

    const { favorable: favorableWuxing, unfavorable: unfavorableWuxing } = makeWuxingResult(favShens, unfavShens);

    // 决策链
    const decisionChain = [];
    if (vetoTriggered) {
      decisionChain.push({ layer: 'L1 调候（一票否决）', reason: `${monthZhi}月调候极急，${tiaohouNeededWuxing.join('、')}为首用，覆盖常规格局取法。` });
    } else {
      decisionChain.push({ layer: 'L1 调候', reason: tiaohouDetail.explanation });
    }
    if (geJuInfoRecord) {
      decisionChain.push({ layer: 'L2 格局', reason: `${geJu}（${geJuInfoRecord.shunNi}），辅神加分：${geJuInfoRecord.xianShenTypical}。` });
    }
    if (chengGeEffects.yongShens.length || chengGeEffects.xianShens.length || chengGeEffects.invalidatedShens.length) {
      const status = chengGeDetail?.chengGeResult || '待定';
      const reasonParts = [];
      if (chengGeEffects.yongShens.length) reasonParts.push(`用神先验：${chengGeEffects.yongShens.join('、')}`);
      if (chengGeEffects.xianShens.length) reasonParts.push(`相神入喜：${chengGeEffects.xianShens.join('、')}`);
      if (chengGeEffects.invalidatedShens.length) reasonParts.push(`败格失用：${chengGeEffects.invalidatedShens.join('、')}`);
      const methodTags = chengGeDetail?.patternEffects?.methodTags || [];
      if (methodTags.length) reasonParts.push(`methodTags：${methodTags.join('、')}`);
      decisionChain.push({
        layer: 'L2 成格取用',
        reason: `${chengGeDetail?.chengGe || geJu}（${status}）：${reasonParts.join('；')}。`,
        override: status === '成格' ? '成格用神强先验' : '败格失用降权'
      });
    }
    decisionChain.push({ layer: 'L3 扶抑', reason: `日主${strengthResult.strongWeak}，${strengthResult.strongWeak === '身弱' ? '印比升分，食伤财官杀降分' : strengthResult.strongWeak === '身强' ? '食伤财官杀升分，印比降分' : '身中，各维权重减半'}。` });
    if (hasBing) {
      decisionChain.push({ layer: 'L4 病药', reason: bingElements.map(b => `${b.element}占${Math.round(b.ratio)}%为${b.heavy ? '重' : '轻'}病，取正药+${b.heavy ? 40 : 20}`).join('；') });
    }
    if (yinRescue) {
      decisionChain.push({ layer: 'L5 印星救主', reason: `日主无根身弱，${yinRescue.guanShaWx}（官杀）、${yinRescue.shiShangWx}（食伤）合力压身，弃官就印，取有根透干之${yinRescue.seals.join('、')}（${yinRescue.sealWx}）化杀生身为救主用神。`, override: '压制旺官调候/顺逆高分' });
    }
    if (yangRenDriveSha) {
      decisionChain.push({ layer: 'L5 羊刃驾杀', reason: `身弱七杀格、日主自坐羊刃（${yangRenDriveSha.yangRen}），${yangRenDriveSha.guanShaWx}（官杀）旺而紧贴攻身，地战急如火、印化杀不及，取日支羊刃（劫财）敌杀保命为用神；偏印兼调候与化杀生刃，降为顶级喜神。`, override: '调候让位：剥夺印星调候首取高分' });
    }

    // Verdict
    let mainVerdict = '';
    if (vetoTriggered) {
      mainVerdict = `此局生于${monthZhi}月，调候为急。原局${tiaohouHarmfulWuxing.join('、')}过旺，首取${tiaohouNeededWuxing.length ? tiaohouNeededWuxing.join('、') : '相应五行'}暖局或除寒为真用神。`;
    } else if (hasBing) {
      const bingWx = Object.keys(wuxingRatio).sort((a, b) => wuxingRatio[b] - wuxingRatio[a])[0];
      mainVerdict = `原局五行偏枯，${bingWx}势偏旺为病（占比${Math.round(wuxingRatio[bingWx])}%），急需克制或顺泄。`;
    } else {
      mainVerdict = `此局格局为${geJu}，首取格局核心用神。`;
    }
    const fuyiStr = strengthResult.strongWeak === '身弱'
      ? '日主身弱，需印比生扶，但须注意五行平衡。'
      : (strengthResult.strongWeak === '身强'
        ? '日主身强，喜食伤生财或官杀克制。'
        : (strengthResult.strongWeak === '身中'
          ? '日主介于中和之间，宜结合格局、调候与岁运再细分偏强偏弱。'
          : '此局从势，顺其气势为佳。'));

    return {
      wuxing: { favorable: favorableWuxing, unfavorable: unfavorableWuxing },
      core_shens: { favorable: favShens, unfavorable: unfavShens },
      five_shens: fiveShens,
      scoring_details: scores,
      dimension_breakdown: breakdown,
      wuxing_ratio: wuxingRatio,
      tiaohou_detail: tiaohouDetail,
      special_pattern: null,
      favorable_conflicts: favorableConflicts,
      decision_chain: decisionChain,
      verdict: mainVerdict + ' ' + fuyiStr
    };
  },

  /**
   * 地支四柱及天干生克合化检测（全局，不限相邻，支持大运流年）
   */
  calculateInteractions(zhis, gans, keys = ['year', 'month', 'day', 'time', 'dayun', 'liunian']) {
    const ganKeCycle = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
    const zArr = Array.isArray(zhis) ? zhis : Object.values(zhis);
    const gArr = Array.isArray(gans) ? gans : Object.values(gans);

    const ganPairs = [];
    // 天干合、克
    for (let i = 0; i < gArr.length; i++) {
      for (let j = i + 1; j < gArr.length; j++) {
        const a = gArr[i], b = gArr[j];
        if (!a || !b) continue;
        const key1 = a + b, key2 = b + a;
        if (C.GAN_HES[key1]) {
          ganPairs.push({ type: '合', name: `${key1}合化${C.GAN_HES[key1]}`, elements: [a, b], pillars: [keys[i], keys[j]] });
        } else if (C.GAN_HES[key2]) {
          ganPairs.push({ type: '合', name: `${key2}合化${C.GAN_HES[key2]}`, elements: [a, b], pillars: [keys[i], keys[j]] });
        } else if (ganKeCycle[C.GAN5[a]] === C.GAN5[b] || ganKeCycle[C.GAN5[b]] === C.GAN5[a]) {
          ganPairs.push({ type: '克', name: `${a}${b}相克`, elements: [a, b], pillars: [keys[i], keys[j]] });
        }
      }
    }

    const zhiPairs = [];
    // 地支冲、合、刑、害、破、暗合
    for (let i = 0; i < zArr.length; i++) {
      for (let j = i + 1; j < zArr.length; j++) {
        const a = zArr[i], b = zArr[j];
        if (!a || !b) continue;
        if (C.ZHI_CHONGS[a] === b) zhiPairs.push({ type: '冲', name: `${a}${b}相冲`, elements: [a, b], pillars: [keys[i], keys[j]] });
        if (C.ZHI_ATTS[a]?.['六'] === b || C.ZHI_ATTS[b]?.['六'] === a) {
          const hx = C.ZHI_6HES[a + b] || C.ZHI_6HES[b + a] || '';
          zhiPairs.push({ type: '合', name: `${a}${b}合化${hx}`, elements: [a, b], pillars: [keys[i], keys[j]] });
        }
        if (C.XINGS[a] === b || C.XINGS[b] === a) zhiPairs.push({ type: '刑', name: `${a}${b}相刑`, elements: [a, b], pillars: [keys[i], keys[j]] });
        if (a === b && C.ZI_XINGS.includes(a)) zhiPairs.push({ type: '自刑', name: `${a}${a}自刑`, elements: [a, b], pillars: [keys[i], keys[j]] });
        if (C.ZHI_HAIS[a] === b) zhiPairs.push({ type: '害', name: `${a}${b}相害`, elements: [a, b], pillars: [keys[i], keys[j]] });
        if (C.ZHI_POS[a] === b) zhiPairs.push({ type: '破', name: `${a}${b}相破`, elements: [a, b], pillars: [keys[i], keys[j]] });
        if (C.ZHI_ATTS[a]?.['暗'] === b) zhiPairs.push({ type: '暗合', name: `${a}${b}暗合`, elements: [a, b], pillars: [keys[i], keys[j]] });
        if (C.ZHI_ATTS[b]?.['暗'] === a) zhiPairs.push({ type: '暗合', name: `${b}${a}暗合`, elements: [a, b], pillars: [keys[i], keys[j]] });
      }
    }

    // 三合、三会寻找函数
    const findTriplets = (arr, set) => {
      const results = [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          for (let k = j + 1; k < arr.length; k++) {
            const triplet = [arr[i], arr[j], arr[k]];
            if (set.every(z => triplet.includes(z))) {
              results.push([i, j, k]);
            }
          }
        }
      }
      return results;
    };

    // 三合
    for (const [combo, wuxing] of Object.entries(C.ZHI_3HES)) {
      const triplets = findTriplets(zArr, combo.split(''));
      triplets.forEach(indices => {
        zhiPairs.push({ type: '三合', name: `${combo}三合${wuxing}局`, elements: [zArr[indices[0]], zArr[indices[1]], zArr[indices[2]]], pillars: indices.map(i => keys[i]) });
      });
    }
    // 三会
    for (const [combo, wuxing] of Object.entries(C.ZHI_HUIS)) {
      const triplets = findTriplets(zArr, combo.split(''));
      triplets.forEach(indices => {
        zhiPairs.push({ type: '三会', name: `${combo}三会${wuxing}局`, elements: [zArr[indices[0]], zArr[indices[1]], zArr[indices[2]]], pillars: indices.map(i => keys[i]) });
      });
    }

    return { gans: ganPairs, zhis: zhiPairs };
  },

  /**
   * 高频命理格局断语触发器
   * @returns {string[]} 触发的断语数组
   */
  extractAdvancedPatterns(dayGan, gans, zhis, allShens, geJu, strengthResult) {
    const patterns = [];
    const zArr = Array.isArray(zhis) ? zhis : [zhis.year, zhis.month, zhis.day, zhis.time];
    const gArr = Array.isArray(gans) ? gans : [gans.year, gans.month, gans.day, gans.time];
    const dayZhi = zArr[2], monthZhi = zArr[1], timeZhi = zArr[3];
    const dayPillar = gArr[2] + zArr[2];
    const timePillar = gArr[3] + timeZhi;
    const isYang = ['甲', '丙', '戊', '庚', '壬'].includes(dayGan);
    const meStatus = zArr.map(z => getDiShi(dayGan, z));
    const luZhi = C.LU_SHEN[dayGan];
    const kuZhi = C.KU_ZHI[dayGan];
    const jueZhi = C.JUE_ZHI[dayGan];

    // ── 建禄格
    if (getShen(dayGan, monthZhi) === '比' || monthZhi === luZhi) {
      patterns.push('【建禄格】月支为日主禄位，最喜天干有财官，忌见比劫过多；一生自立，难聚祖财。');
      if (allShens.filter(s => s === '官' || s === '才' || s === '财').length >= 2)
        patterns.push('\t建禄财官双透，格局佳。');
      if (allShens.filter(s => s === '比' || s === '劫').length > 2)
        patterns.push('\t建禄比劫过多，克妻争财，一生多波折。');
    }

    // ── 阳刃格
    if (isYang && zArr[1] === C.YANG_REN[dayGan]) {
      patterns.push('【阳刃格】月支阳刃，喜七杀驾刃或正官制刃。甲庚壬逢冲多祸，忌财星透出。');
    }

    // ── 偏印格
    if (['枭'].filter(s => allShens.includes(s)).length && getShen(dayGan, monthZhi) === '枭') {
      patterns.push('【偏印格】月令偏印，喜偏财相配，忌食神见之（倒食）；性格孤高，艺术宗教倾向。');
    }

    // ── 自坐劫库 + 时杀/官
    if (dayZhi === kuZhi) {
      const timeShen = getShen(dayGan, gArr[3]);
      if (timeShen === '杀') patterns.push('【自坐劫库·时杀格】贵！有权威。');
      if (timeShen === '官') patterns.push('【自坐劫库·时官格】孤贵！');
    }

    // ── 胎绝过多
    const jueCount = zArr.filter(z => z === jueZhi || z === C.TAI_ZHI[dayGan]).length;
    if (jueCount > 2) patterns.push('胎绝超过三个，身体偏弱，早年多磨难。');

    // ── 缺四生/四正/四库
    const sheng = zArr.filter(z => ['寅', '申', '巳', '亥'].includes(z));
    const zheng = zArr.filter(z => ['子', '午', '卯', '酉'].includes(z));
    const ku = zArr.filter(z => ['辰', '戌', '丑', '未'].includes(z));
    if (sheng.length === 0) patterns.push('地支缺四生（寅申巳亥），一生不敢大作为。');
    if (zheng.length === 0) patterns.push('地支缺四正（子午卯酉），一生避是非。');
    if (ku.length === 0) patterns.push('地支缺四库（辰戌丑未），潜伏性凶灾少。');

    // ── 四生/四败/四库局（需四字全齐方成局）
    if (sheng.length === 4) patterns.push('【四生局】寅申巳亥四全，命运多变，奔波中成就大业，古云位至三公。');
    if (zheng.length === 4) patterns.push('【四败局】子午卯酉四全，异性缘极盛，命运起伏极端；格局高者极贵，失格者沉沦。');
    if (ku.length === 4) patterns.push('【四库局】辰戌丑未四全，蕴藏深厚，格局最贵，有帝王造化之命。');

    // ── 十神过多过少
    const biCount = allShens.filter(s => s === '比').length;
    const jiCount = allShens.filter(s => s === '劫').length;
    const shaCount = allShens.filter(s => s === '杀').length;
    const shangCount = allShens.filter(s => s === '伤').length;
    const xiaoCount = allShens.filter(s => s === '枭').length;

    if (biCount > 2) patterns.push('比肩过多：自我意识强，兄弟竞争激烈，男有双妻倾向，女轻视夫。宜有官杀制。');
    if (jiCount > 2) patterns.push('劫财过多：合伙多散，婚姻不稳，精明反被精明误。');
    if (shaCount > 2) patterns.push('七杀过多无制：性格刚强偏激，是非多；宜食神制杀或印化杀。');
    if (shangCount > 2) patterns.push('伤官过多：才华横溢但叛逆，女命婚姻不顺，男命口舌是非多。');
    if (xiaoCount > 2) patterns.push('偏印过多：性格孤僻，做事有始无终，女命子息不旺。');

    // ── 四柱全阳/全阴
    const yinyangArr = [...gArr, ...zArr].map(x => {
      const gi = C.GAN.indexOf(x); const zi = C.ZHI.indexOf(x === undefined ? '' : x);
      if (gi >= 0) return gi % 2 === 0 ? '+' : '-';
      if (zi >= 0) return zi % 2 === 0 ? '+' : '-';
      return null;
    }).filter(Boolean);
    if (yinyangArr.every(y => y === '+')) patterns.push('四柱全阳：行事果断，阳刚进取，但缺柔和变通。');
    if (yinyangArr.every(y => y === '-')) patterns.push('四柱全阴：性格内敛，心思细腻，女命声誉需注意。');

    return patterns;
  },

  /**
   * 扩展神煞计算（结合 Python year/month/day/g_shens）
   */
  calculateShenShaFull(baziObj, opts = {}) {
    const { year, month, day, time } = baziObj;
    const yearGan = year[0], yearZhi = year[1];
    const monthGan = month[0], monthZhi = month[1];
    const dayGan = day[0], dayZhi = day[1];
    const timeGan = time[0], timeZhi = time[1];
    const result = { year: [], month: [], day: [], time: [] };
    const pillars = { year: [yearGan, yearZhi], month: [monthGan, monthZhi], day: [dayGan, dayZhi], time: [timeGan, timeZhi] };
    const allGans = [yearGan, monthGan, dayGan, timeGan];
    const isMale = opts.isMale;

    for (const [key, [gan, zhi]] of Object.entries(pillars)) {
      // 年支起神煞（天喜/血刃 不排除年柱自身）
      for (const [shen, map] of Object.entries(C.YEAR_SHENS)) {
        const target = map[yearZhi] || '';
        const excludeSelf = !['天喜','血刃'].includes(shen);
        if (target.includes(zhi) && (!excludeSelf || key !== 'year')) result[key].push(shen);
      }
      // 年干起神煞（天官贵人等）
      for (const [shen, map] of Object.entries(C.YEAR_GAN_SHENS)) {
        if (map[yearGan] === zhi) result[key].push(shen);
      }
      // 月支起神煞（含天医）
      for (const [shen, map] of Object.entries(C.MONTH_SHENS)) {
        const target = map[monthZhi];
        if (target === gan || target === zhi) result[key].push(shen);
      }
      // 日支起神煞（年支和日支双起，不含日柱）
      for (const [shen, map] of Object.entries(C.DAY_SHENS)) {
        if ((map[yearZhi] === zhi || map[dayZhi] === zhi) && key !== 'day') result[key].push(shen);
      }
      // 日干起神煞（太极贵人改为四柱多干校验）
      for (const [shen, map] of Object.entries(C.G_SHENS)) {
        if (shen === '太极贵人') {
          if (allGans.some(g => (map[g]||'').includes(zhi))) result[key].push(shen);
        } else {
          const targets = map[dayGan] || '';
          if (targets.includes(zhi)) result[key].push(shen);
        }
      }
      // 金舆：各柱自干冠带位
      if (C.JINYU[gan] === zhi) result[key].push('金舆');
      // 德秀贵人：月支组 + 柱干
      if ((C.DESHU_MAP[monthZhi]||[]).includes(gan)) result[key].push('德秀贵人');
      // 元辰：年支+性别（仅当传入isMale时计算）
      if (isMale !== undefined) {
        const yangStem = ['甲','丙','戊','庚','壬'].includes(yearGan);
        const useYang = (isMale && yangStem) || (!isMale && !yangStem);
        const ymap = useYang ? C.YUANCHEN.yang : C.YUANCHEN.yin;
        if (ymap[yearZhi] === zhi) result[key].push('元辰');
      }
    }

    // 特殊日柱组合神煞（魁罡、日德、日贵）—— 固定挂在日柱
    const dayPillar = dayGan + dayZhi;
    for (const [shen, days] of Object.entries(C.SPECIAL_DAYS)) {
      if (days.includes(dayPillar)) result.day.push(shen);
    }

    // 三奇：四柱天干顺序连续三位匹配（年月日 或 月日时）
    const pillarKeys = ['year', 'month', 'day', 'time'];
    for (const set of C.SANQI_SETS) {
      for (let i = 0; i <= 1; i++) {
        if (allGans[i] === set[0] && allGans[i+1] === set[1] && allGans[i+2] === set[2]) {
          result[pillarKeys[i+1]].push('三奇');
        }
      }
    }

    // 金神：甲日 + 时支丑/巳/酉
    if (dayGan === '甲' && ['丑', '巳', '酉'].includes(timeZhi)) {
      result.time.push('金神');
    }
    // 天罗：四柱同时含戌AND亥
    if ([yearZhi, monthZhi, dayZhi, timeZhi].includes('戌') && [yearZhi, monthZhi, dayZhi, timeZhi].includes('亥')) {
      for (const [key, [, zhi]] of Object.entries(pillars)) {
        if (zhi === '戌' || zhi === '亥') result[key].push('天罗');
      }
    }
    // 地网：四柱同时含辰AND巳
    if ([yearZhi, monthZhi, dayZhi, timeZhi].includes('辰') && [yearZhi, monthZhi, dayZhi, timeZhi].includes('巳')) {
      for (const [key, [, zhi]] of Object.entries(pillars)) {
        if (zhi === '辰' || zhi === '巳') result[key].push('地网');
      }
    }

    const fmt = arr => arr.length ? arr.join(' ') : '-';
    return { year: fmt(result.year), month: fmt(result.month), day: fmt(result.day), time: fmt(result.time) };
  },

  // ── 文案组装 ──────────────────────────────────────────────────────────────

  /**
   * 组装原局核心断语
   */
  buildYuanjuCore(dayGan, monthZhi, gans, zhis, geJu, strengthResult, favorableResult, patterns) {
    const { strongWeak, strongScore, scores, totalStrengthScore, strengthBasis } = strengthResult;
    const { wuxing, core_shens, verdict } = favorableResult;
    const dayPillar = (Array.isArray(gans) ? gans[2] : gans.day) + (Array.isArray(zhis) ? zhis[2] : zhis.day);
    const nayin = C.NAYINS[dayPillar] || '';

    const wuxingStr = Object.entries(scores).map(([k, v]) => `${k}${v}`).join(' ');
    const lines = [
      `【格局】${geJu}`,
      `【强弱】${strongWeak}（综合分${formatScore(totalStrengthScore)}，助身力${strongScore}，五行：${wuxingStr}）`,
      `【依据】${strengthBasis}`,
      `【喜忌】喜 ${wuxing.favorable.join('、') || '无'} (${core_shens.favorable.join('、') || '无'}) | 忌 ${wuxing.unfavorable.join('、') || '无'} (${core_shens.unfavorable.join('、') || '无'})`,
      `【天机】${verdict}`,
      nayin ? `【日柱】${dayPillar}·${nayin}` : '',
      '',
      patterns.length ? '【命局特征】\n' + patterns.join('\n') : '',
      '',
      `${C.JINS[dayGan] ? '【注意】' + C.JINS[dayGan] : ''}`
    ];
    return lines.filter(Boolean).join('\n').trim();
  },

  /**
   * 组装当前大运断语
   */
  buildCurrentDayun(dayunGan, dayunZhi, dayGan, zhis, gans) {
    if (!dayunGan || !dayunZhi) return '暂无大运数据。';
    const zArr = Array.isArray(zhis) ? zhis : [zhis.year, zhis.month, zhis.day, zhis.time];
    const dayunShen = C.SHISHEN[dayGan][dayunGan] || '';
    const dayunZhiShen = getShen(dayGan, dayunZhi);
    const dayunPhase = getDiShi(dayGan, dayunZhi);

    const rels = [];
    const chong = C.ZHI_CHONGS[dayunZhi];
    if (chong && zArr.includes(chong)) rels.push(`与原局${chong}相冲`);
    const liuhe = C.ZHI_ATTS[dayunZhi]?.['六'];
    if (liuhe && zArr.includes(liuhe)) rels.push(`与原局${liuhe}六合`);
    const xing = C.XINGS[dayunZhi];
    if (xing && zArr.includes(xing) && xing !== dayunZhi) rels.push(`与原局${xing}相刑`);
    const hai = C.ZHI_HAIS[dayunZhi];
    if (hai && zArr.includes(hai)) rels.push(`与原局${hai}相害`);

    const favorableSigns = ['印', '枭', '比', '劫'];
    const isGood = favorableSigns.includes(dayunShen) || favorableSigns.includes(dayunZhiShen);
    const verdict = isGood ? '整体偏吉，宜稳健进取' : '压力较大，宜守成待时';

    const lines = [
      `当前大运：${dayunGan}${dayunZhi}（天干${dayunShen}，地支${dayunZhiShen}·${dayunPhase}）`,
      rels.length ? `大运与原局：${rels.join('；')}` : '大运与原局无明显刑冲合害',
      verdict + '。',
      C.JINS[dayGan] ? `金不换提示：${C.JINS[dayGan]}` : ''
    ];
    return lines.filter(Boolean).join('\n');
  },

  /**
   * 组装当前流年简评
   */
  buildCurrentLiunian(lnGan, lnZhi, dayunGan, dayunZhi, dayGan, zhis) {
    if (!lnGan || !lnZhi) return '暂无流年数据。';
    const zArr = Array.isArray(zhis) ? zhis : [zhis.year, zhis.month, zhis.day, zhis.time];
    const lnShen = C.SHISHEN[dayGan][lnGan] || '';
    const lnZhiShen = getShen(dayGan, lnZhi);

    const rels = [];
    const chong = C.ZHI_CHONGS[lnZhi];
    if (chong && zArr.includes(chong)) rels.push(`冲原局${chong}`);
    if (chong === dayunZhi) rels.push(`冲大运地支${dayunZhi}`);
    const liuhe = C.ZHI_ATTS[lnZhi]?.['六'];
    if (liuhe && zArr.includes(liuhe)) rels.push(`合原局${liuhe}`);
    const xing = C.XINGS[lnZhi];
    if (xing && xing !== lnZhi && zArr.includes(xing)) rels.push(`刑原局${xing}`);

    const goodShens = ['印', '枭', '比', '劫'];
    const lnGood = goodShens.includes(lnShen);
    const verdict = lnGood ? '流年助力，宜主动出击' : '流年压身，宜谨慎稳健';

    const lines = [
      `流年${lnGan}${lnZhi}（天干${lnShen}，地支${lnZhiShen}）`,
      rels.length ? `流年动态：${rels.join('；')}` : '流年与原局无明显刑冲',
      verdict + '。'
    ];
    return lines.filter(Boolean).join('\n');
  }
};

BaziRuleEngine._test = { parseTiaohou, aggregateShens, classifyFiveShens, parseShenText, getTiaohouUnfavorablePenalty, buildTiaohouDetail };

module.exports = { BaziRuleEngine, getDiShi, getShen, isKong };
