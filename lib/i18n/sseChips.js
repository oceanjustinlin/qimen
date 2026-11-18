'use strict';
// SSE 进度 chip / tag 的结构化 key（i18n spec T3.4 / §5.8）。
// 旧字段 main / sub / label 与改造前逐字一致；另加 mainKey / subKey / labelKey 与参数，前端按界面语言渲染。
// 参数名以 Key 结尾的（如 bandKey）由前端先翻译再代入。

// i18n-ignore-start
const QIMEN_CATEGORY_LABELS = {
  career_business: '事业运势', finance_wealth: '财运分析',
  relationship: '感情婚恋', health_action: '健康行动', general: '综合运势',
};
const SCORE_BAND_ZH = { aboveAverage: '中上吉', average: '中平', belowAverage: '偏凶' };
const BAZI_MODE_ZH = { timing: '时间推演', pattern: '格局分析', character: '性格命理', status: '当下状态' };
const BAZI_SCOPE_ZH = { current_year: '今年', next_3_years: '近三年', next_5_years: '近五年', next_10_years: '未来十年', unknown: '命局综合' };
const ZH = {
  qimen: '奇门遁甲', hybrid: '综合推演', bazi: '八字命理', soon: '近日', noWindow: '暂无明确窗口',
  chartReady: '命盘就绪', modeFallback: '分析模式', analysisFallback: '命理分析', scopeSub: '命局推演', godsMarked: '忌神已标记',
};
const PROFILE_STEP_ZH = { validate: '校验档案', compute: '排盘计算', llm: 'AI 断语生成' };
// i18n-ignore-end

const scoreBandKey = (s) => (s >= 70 ? 'aboveAverage' : s >= 50 ? 'average' : 'belowAverage');
const qimenScoreLabel = (s) => SCORE_BAND_ZH[scoreBandKey(s)];
const categoryKey = (code) => `enum.category.${QIMEN_CATEGORY_LABELS[code] ? code : 'general'}`;
const categoryZh = (code) => QIMEN_CATEGORY_LABELS[code] || QIMEN_CATEGORY_LABELS.general;

function qimenCategoryChip(category, branch) {
  const hybrid = branch === 'hybrid';
  return {
    main: categoryZh(category), sub: hybrid ? ZH.hybrid : ZH.qimen,
    mainKey: categoryKey(category), subKey: hybrid ? 'sse.chip.branchHybrid' : 'sse.chip.branchQimen',
  };
}

function qimenWindowsChip(windows = []) {
  const n = windows.length;
  const first = windows[0];
  const sub = first ? (first.date || ZH.soon) : ZH.noWindow;
  const chip = { main: `发现 ${n} 个窗口`, sub, mainKey: 'sse.chip.windowsFound', mainParams: { n } }; // i18n-ignore
  if (!first) chip.subKey = 'sse.chip.noWindow';
  else if (!first.date) chip.subKey = 'sse.chip.windowSoon';
  return chip;
}

function qimenPreScoreChip(score) {
  return {
    main: `初分 ${score}`, sub: qimenScoreLabel(score), // i18n-ignore
    mainKey: 'sse.chip.preScore', mainParams: { score }, subKey: `enum.scoreBand.${scoreBandKey(score)}`,
  };
}

function qimenEngineTags({ category, structure, score, windowCount }) {
  return [
    { label: categoryZh(category), labelKey: categoryKey(category) },
    { label: structure },
    {
      label: `初分${score} · ${qimenScoreLabel(score)}`, isScore: true, // i18n-ignore
      labelKey: 'sse.tag.preScoreBand', labelParams: { score, bandKey: `enum.scoreBand.${scoreBandKey(score)}` },
    },
    ...(windowCount ? [{ label: `${windowCount}个应期窗口`, labelKey: 'sse.tag.windowCount', labelParams: { n: windowCount } }] : []), // i18n-ignore
  ];
}

function baziCategoryChip(category) {
  return { main: categoryZh(category), sub: ZH.bazi, mainKey: categoryKey(category), subKey: 'sse.chip.branchBazi' };
}

function baziDayMasterChip(dayMaster, strengthLabel) {
  const chip = {
    main: `日主${dayMaster}`, sub: strengthLabel || ZH.chartReady, // i18n-ignore
    mainKey: 'sse.bazi.dayMaster', mainParams: { symbol: dayMaster },
  };
  if (!strengthLabel) chip.subKey = 'sse.bazi.chartReady';
  return chip;
}

function baziModeChip(mode, branch) {
  const known = !!BAZI_MODE_ZH[mode];
  const sub = known ? (branch === 'hybrid' ? ZH.hybrid : ZH.bazi) : ZH.analysisFallback;
  return {
    main: known ? BAZI_MODE_ZH[mode] : ZH.modeFallback, sub,
    mainKey: known ? `sse.bazi.mode.${mode}` : 'sse.bazi.modeFallback',
    subKey: known ? (branch === 'hybrid' ? 'sse.chip.branchHybrid' : 'sse.chip.branchBazi') : 'sse.bazi.analysisFallback',
  };
}

function baziScopeChip(scopeType, years) {
  const type = BAZI_SCOPE_ZH[scopeType] ? scopeType : 'unknown';
  const chip = { main: BAZI_SCOPE_ZH[type], sub: years || ZH.scopeSub, mainKey: `sse.bazi.scope.${type}` };
  if (!years) chip.subKey = 'sse.bazi.scopeSub';
  return chip;
}

function baziFavorableChip(favorable) {
  if (!favorable) return null;
  return {
    main: `喜${favorable}`, sub: ZH.godsMarked, // i18n-ignore
    mainKey: 'sse.bazi.favorable', mainParams: { symbol: favorable }, subKey: 'sse.bazi.godsMarked',
  };
}

function baziEngineTags({ category, dayMaster, favorable, mode }) {
  const modeChip = baziModeChip(mode);
  return [
    { label: categoryZh(category), labelKey: categoryKey(category) },
    { label: `日主${dayMaster}`, labelKey: 'sse.bazi.dayMaster', labelParams: { symbol: dayMaster } }, // i18n-ignore
    ...(favorable ? [{ label: `喜${favorable}`, labelKey: 'sse.bazi.favorable', labelParams: { symbol: favorable } }] : []), // i18n-ignore
    { label: modeChip.main, labelKey: modeChip.mainKey },
  ];
}

function profileStep(index, pct, step) {
  return { type: 'step', index, pct, label: PROFILE_STEP_ZH[step], labelKey: `sse.profile.${step}` };
}

module.exports = {
  QIMEN_CATEGORY_LABELS, scoreBandKey, qimenScoreLabel,
  qimenCategoryChip, qimenWindowsChip, qimenPreScoreChip, qimenEngineTags,
  baziCategoryChip, baziDayMasterChip, baziModeChip, baziScopeChip, baziFavorableChip, baziEngineTags,
  profileStep,
};
