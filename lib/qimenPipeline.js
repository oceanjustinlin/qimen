// 奇门问事「纯计算」单一真实：从起局时刻 + 已分类的 route，产出完整证据包。
//
// 这是 worker 的 handleQimen 与 skill 的 CLI 脚本共同调用的同一段计算编排，
// 任何一方都不得再自行抄写「怎么调引擎」的次序与参数——改这里，两边同步。
//
// 边界（与 README/SKILL.md 一致）：
//  - 输入：明确的起局时刻（year..minute）、问题文本、已分类的 route(intent)、可选八字。
//  - 不做：起局时刻的「now 回退」、route 的 LLM 分类、SSE、Gemini、DB、prompt 拼装。
//    这些副作用留给调用方（worker / CLI）。
//  - 输出：证据包 + worker 拼 prompt / emit 进度所需的盘面散量。
const { Solar } = require('lunar-javascript');
const U = require('./QimenUtils.js');
const { buildQimenChart } = require('./qimenChart.js');
const { maXingMap, palaceBranches } = require('./qimenCore.js');
const { getYongshenRule } = require('./qimenYongshenRules.js');
const { buildTimingAnalysis } = require('./qimenTimingRules.js');
const { detectPolarityOverrides } = require('./qimenPolarityRules.js');
const { calculateQimenScore } = require('./qimenScoringEngine.js');
const { annotateProsperity } = require('./qimenProsperity.js');
const {
  QIMEN_RULESET_VERSION,
  QIMEN_PRIMARY_SOURCE,
  SAN_QI_TOMB_PALACE,
  EXPLICIT_STEM_TOMB_PALACE,
  XUN_HEAD_PUNISHMENT_PALACE
} = require('./qimenClassicalRules.js');

const PALACE_NAMES = ['巽', '离', '坤', '震', '中', '兑', '艮', '坎', '乾'];
const PALACE_NUMBERS = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const PALACE_ELEMENTS = ['木', '火', '土', '木', '土', '金', '土', '水', '金'];
const DOOR_ELEMENTS = { 休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金' };
const CONTROLS = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function normalizeDoor(value) {
  return String(value || '').replace(/門/g, '门');
}

// 盘面文本化：喂给 LLM prompt 的逐宫描述（确定性派生，CLI 不用可忽略）。
function buildPalacesText(chart) {
  const { diPan, nineStars, eightDoors, eightGods, tianPanGan, dayMa, hourMa, dayKongIndices, hourKongIndices, tianRuiIndex, centerEarthStem } = chart;
  let palacesText = '';
  for (let i = 0; i < 9; i++) {
    const pName = `${PALACE_NAMES[i]}${PALACE_NUMBERS[i]}宫`;
    if (i === 4) {
      palacesText += `${pName}信息开始：地盘天干：${diPan[i]}，${pName}信息结束。\n`;
      continue;
    }
    let extra = '';
    if (dayKongIndices.includes(i) || hourKongIndices.includes(i)) extra += '本宫占空亡；';
    if (i === maXingMap[dayMa] || i === maXingMap[hourMa]) extra += '本宫有马星；';
    let jiText = '';
    if (i === 2) jiText = `；地盘寄干：${centerEarthStem}`;
    if (i === tianRuiIndex) jiText += `；天盘寄干：${centerEarthStem}`;
    const stemRel = U.getStemRelation(tianPanGan[i], diPan[i]);
    const stemRelText = stemRel ? `；天地盘干生克：${stemRel}` : '';
    palacesText += `${pName}信息开始：九星：${nineStars[i]}；八神：${eightGods[i]}；八门：${eightDoors[i]}；天盘天干：${tianPanGan[i]}；地盘天干：${diPan[i]}${stemRelText}${jiText}；${extra}${pName}信息结束。\n`;
  }
  return palacesText;
}

/**
 * 产出奇门问事证据包。
 *
 * @param {object} args
 * @param {number} args.year/month/day/hour/minute 起局时刻（北京民用时，由调用方解析好）
 * @param {object|null} [args.panTimeParts] 指定时刻则传原始解析结果，用于标注 pan_time_source；null=now
 * @param {Date}   [args.baseTime] 应期扫描的基准时刻；缺省用 year..minute 构造（worker 传 bjTime 保证逐字一致）
 * @param {string} [args.question] 问题文本
 * @param {object} args.intent 已分类、已 normalize 的 route（category/subcategory/branch/confidence…）
 * @param {string} [args.baziInfo] 八字信息；纯奇门分支会被屏蔽
 * @returns {object} 证据包 + worker prompt/emit 所需散量
 */
function buildQimenEvidence({ year, month, day, hour, minute, panTimeParts = null, baseTime = null, question = '当前局势吉凶如何？', intent, baziInfo = '未提供八字信息' }) {
  if (!intent) throw new Error('buildQimenEvidence: intent (已分类 route) 必填');

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const ganzhiHour = lunar.getTimeInGanZhi();
  const ganzhiDay = lunar.getDayInGanZhi();

  // 起盘：与 golden-master 单测、线上同源
  const chart = buildQimenChart({ year, month, day, hour, minute });
  const {
    juResult, xunHead, zhiFuStar, nineStars, zhiShiDoor, eightDoors, tianPanGan, diPan,
    dayMa, hourMa, dayKongObj, hourKongObj, dayKongIndices, hourKongIndices,
    timestamp_solar, timestamp_lunar, qimen_structure,
    yearStem, monthStem, dayStem, hourStem, dayStemVisible, hourStemVisible,
    isFuYin, isFanYin, effectiveZhiFuPalaceIndex, qimenData
  } = chart;

  // 起局时刻来源标注，随 qimenData 流向历史/缓存
  qimenData.pan_time_source = panTimeParts ? 'custom' : 'now';
  if (panTimeParts) qimenData.pan_time = { ...panTimeParts };

  const palacesText = buildPalacesText(chart);

  // 用神：纯奇门分支屏蔽命主八字，避免命局偏倚
  const yongshenRule = getYongshenRule(intent.category, intent.subcategory);
  const effectiveBaziInfo = intent.branch === 'qimen' ? '未提供八字信息' : baziInfo;
  const hasBaziInfo = effectiveBaziInfo !== '未提供八字信息';
  const timingTargetSymbols = [
    ...(yongshenRule.yongshen?.primary || []),
    ...(yongshenRule.yongshen?.secondary || [])
  ]
    .filter((item) => hasBaziInfo || !item.requiresBazi)
    .map((item) => ({ symbol: item.symbol, role: item.role, weight: item.layer || 'core' }));

  // 每宫旺衰按月令补算（annotateProsperity），并带 stem_relation 天地盘干生克
  const monthGanZhi = chart.monthGanzhi;
  const punishmentPalace = XUN_HEAD_PUNISHMENT_PALACE[xunHead];
  const timingPalaces = annotateProsperity(Array.from({ length: 9 }, (_, i) => {
    const chartPalace = qimenData.palaces[i] || {};
    const skyStems = [tianPanGan[i], chartPalace.ji_sky].filter(Boolean);
    const door = normalizeDoor(eightDoors[i]);
    const palaceElement = PALACE_ELEMENTS[i];
    return {
      index: i,
      name: `${PALACE_NAMES[i]}${PALACE_NUMBERS[i]}宫`,
      element: palaceElement,
      branches: palaceBranches[i],
      door: eightDoors[i],
      star: nineStars[i],
      god: chart.eightGods[i],
      sky: tianPanGan[i],
      earth: diPan[i],
      ji_sky: chartPalace.ji_sky || '',
      ji_earth: chartPalace.ji_earth || '',
      sky_stems: skyStems,
      stem_relation: U.getStemRelation(tianPanGan[i], diPan[i]),
      is_center: i === 4,
      hosts_center: i === 2,
      isKong: dayKongIndices.includes(i) || hourKongIndices.includes(i),
      hasMa: i === maXingMap[dayMa] || i === maXingMap[hourMa],
      isZhiShi: eightDoors[i] === zhiShiDoor,
      isZhiFu: i === effectiveZhiFuPalaceIndex,
      isDayStem: skyStems.includes(dayStemVisible),
      isHourStem: skyStems.includes(hourStemVisible),
      isDayStemEarth: diPan[i] === dayStemVisible || (i === 2 && chartPalace.ji_earth === dayStemVisible),
      isHourStemEarth: diPan[i] === hourStemVisible || (i === 2 && chartPalace.ji_earth === hourStemVisible),
      isDoorPressured: Boolean(door && CONTROLS[DOOR_ELEMENTS[door]] === palaceElement),
      isTomb: skyStems.some((stem) => (SAN_QI_TOMB_PALACE[stem] ?? EXPLICIT_STEM_TOMB_PALACE[stem]) === i),
      isPunishment: i === effectiveZhiFuPalaceIndex && i === punishmentPalace
    };
  }), monthGanZhi);

  const scoreIntent = {
    ...intent,
    yearStem,
    monthStem,
    dayStem,
    hourStem,
    dayStemVisible,
    hourStemVisible,
    xunHead,
    isFuYin,
    isFanYin
  };

  qimenData.rule_basis = {
    ruleset_version: QIMEN_RULESET_VERSION,
    primary_source: QIMEN_PRIMARY_SOURCE
  };

  const timingInputSnapshot = {
    generatedAt: baseTime || new Date(year, month - 1, day, hour, minute, 0),
    chart: {
      dayKongBranches: String(dayKongObj || '').split(''),
      hourKongBranches: String(hourKongObj || '').split(''),
      dayMa,
      hourMa,
      palaces: timingPalaces
    },
    targetSymbols: timingTargetSymbols,
    eventMode: 'success',
    scanDays: 30,
    scanMaxHits: 12,
    recheckLimit: 5
  };
  const timingAnalysis = buildTimingAnalysis(timingInputSnapshot);

  const polarityOverrides = detectPolarityOverrides({ intent: scoreIntent, palaces: timingPalaces });
  const backendScoreInput = { intent: scoreIntent, palaces: timingPalaces, yongshenRule, polarityOverrides, timingAnalysis };
  const backendScoreAudit = calculateQimenScore(backendScoreInput);

  const backendFormationTags = (backendScoreAudit.adjustments || [])
    .filter((item) => item.layer === 'named_formation')
    .map((item) => ({
      name: item.signal,
      effect: item.effect,
      type: String(item.effect || '').startsWith('+') ? 'ji' : 'xiong',
      palace_index: item.palace_index ?? null,
      palace: (item.palace_index != null) ? `${PALACE_NAMES[item.palace_index]}${PALACE_NUMBERS[item.palace_index]}宫` : null,
      reason: item.reason || '',
      text: item.reason || ''
    }));

  return {
    // 时刻与历法
    year, month, day, hour, minute, solar, lunar, ganzhiHour, ganzhiDay,
    timestamp_solar, timestamp_lunar,
    // 盘面
    chart, qimenData, palacesText, qimen_structure,
    juResult, xunHead, zhiFuStar, zhiShiDoor, dayMa, hourMa, dayKongObj, hourKongObj,
    // 路由与用神
    intent, yongshenRule, effectiveBaziInfo, hasBaziInfo, timingTargetSymbols, question,
    // 评分链路
    timingPalaces, timingInputSnapshot, timingAnalysis, polarityOverrides,
    backendScoreInput, backendScoreAudit, backendFormationTags
  };
}

module.exports = { buildQimenEvidence, buildPalacesText, PALACE_NAMES, PALACE_NUMBERS, PALACE_ELEMENTS };
