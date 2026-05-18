function normalizeGender(gender) {
  if (gender === 'M' || gender === '男' || gender === '乾造') return '男';
  if (gender === 'F' || gender === '女' || gender === '坤造') return '女';
  return String(gender || '未知');
}

function asText(value, fallback = '未提供') {
  if (Array.isArray(value)) return value.length ? value.join('、') : fallback;
  if (value && typeof value === 'object') return JSON.stringify(value);
  const text = String(value || '').trim();
  return text || fallback;
}

function compactJson(value, fallback = '未提供') {
  if (!value) return fallback;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return fallback;
  }
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function formatNamedList(items = [], key = 'gan') {
  if (!Array.isArray(items) || !items.length) return '';
  return items.map((item) => {
    if (typeof item === 'string') return item;
    const name = item[key] || item.shen || item.wuxing || '';
    const role = item.role || item.priority ? `（${[item.role, item.priority ? `优先级${item.priority}` : ''].filter(Boolean).join('，')}）` : '';
    return `${name}${role}`;
  }).filter(Boolean).join('、');
}

function formatDecisionChain(chain = []) {
  if (!Array.isArray(chain) || !chain.length) return '';
  return chain.slice(0, 3).map((item) => {
    if (typeof item === 'string') return item;
    return [item.layer, item.reason].filter(Boolean).join('：');
  }).filter(Boolean).join('；');
}

function formatUpstreamAnalysisBlock(ctx = {}) {
  const lines = ['【上游命局分析摘要】'];
  lines.push(`旺衰判断：${ctx.strength_summary || ctx.strong_weak || '未提供'}`);
  lines.push(`格局判断：${ctx.pattern_summary || ctx.geju || '未提供'}`);
  lines.push(`调候判断：${ctx.tiaohou_summary || '未提供'}`);
  lines.push(`喜用十神：${ctx.favorable_shishen || '未提供'}；忌仇十神：${ctx.unfavorable_shishen || '未提供'}`);
  lines.push(`喜用五行：${ctx.favorable_wuxing || ctx.favorable_elements || '未提供'}；忌仇五行：${ctx.unfavorable_wuxing || ctx.unfavorable_elements || '未提供'}`);
  lines.push(`当前大运：${ctx.current_dayun}（${ctx.dayun_stem_shen}，${ctx.dayun_start_age}岁起）`);
  lines.push(`当前流年：${ctx.current_year_gz}（${ctx.current_year_shishen}）`);
  if (ctx.decision_chain_summary) lines.push(`取用链路：${ctx.decision_chain_summary}`);
  if (ctx.classic_summary) lines.push(`简短断语：${ctx.classic_summary}`);
  return lines.join('\n');
}

const { resolveTargetElement, formatTargetSpecForPrompt } = require('./baziTargetElement');
const { assessOriginalChartState, formatStateReportForPrompt } = require('./baziStateAssessor');
const { assessDynamicTriggers, formatDynamicReportForPrompt } = require('./baziDynamicAssessor');

function splitBaziStr(baziStr = '') {
  const parts = String(baziStr || '').split(/\s+/).filter(Boolean);
  return {
    year_gz: parts[0] || '未知',
    month_gz: parts[1] || '未知',
    day_gz: parts[2] || '未知',
    hour_gz: parts[3] || '未知'
  };
}

function getCurrentMonthData(matrix = {}) {
  const list = matrix.liuyue_list || [];
  if (!list.length) return {};
  const monthIndex = Math.max(0, Math.min(new Date().getMonth(), list.length - 1));
  return list[monthIndex] || list[0] || {};
}

function normalizePipelineGender(gender) {
  if (gender === 'M' || gender === '男' || gender === '乾造' || gender === 'male') return 'male';
  if (gender === 'F' || gender === '女' || gender === '坤造' || gender === 'female') return 'female';
  return 'unknown';
}

function parseBirthYear(profile = {}) {
  const candidates = [
    profile.birth_year,
    profile.birthYear,
    profile.birth_date,
    profile.birthDate,
    profile.bazi_detail?.solar_birth,
    profile.bazi_detail?.base_info?.solar_birth
  ];
  for (const value of candidates) {
    const match = String(value || '').match(/(\d{4})/);
    if (match) return Number(match[1]);
  }
  return null;
}

function parseWuxingSet(raw) {
  if (!raw) return null;
  const WX = new Set(['木', '火', '土', '金', '水']);
  const str = Array.isArray(raw) ? raw.join('') : typeof raw === 'string' ? raw : JSON.stringify(raw);
  const found = [...new Set([...str].filter((ch) => WX.has(ch)))];
  return found.length ? new Set(found) : null;
}

function normalizeBaziSemanticRoute(llmRoute = {}, hint = {}) {
  const route = {
    branch: llmRoute.branch || hint.branch_hint || hint.branch || 'bazi',
    category: llmRoute.category || hint.category_hint || hint.category || 'general',
    subcategory: llmRoute.subcategory || hint.subcategory_hint || hint.subcategory || '',
    analysis_mode: llmRoute.analysis_mode || hint.analysis_mode_hint || 'status',
    secondary_mode: llmRoute.secondary_mode ?? hint.secondary_mode_hint ?? null,
    needs_time_scan: llmRoute.needs_time_scan ?? !!hint.needs_time_scan_hint,
    time_scope: llmRoute.time_scope || hint.time_scope_hint || { type: 'unknown' },
    target_focus: llmRoute.target_focus || {},
    target_resolution: llmRoute.target_resolution || 'backend_mapped',
    llm_derived_target: llmRoute.llm_derived_target || null,
    needs_bazi_profile: llmRoute.needs_bazi_profile !== false,
    can_fallback_to_qimen_only: !!llmRoute.can_fallback_to_qimen_only,
    unsupported_reason: llmRoute.unsupported_reason || '',
    confidence: llmRoute.confidence || hint.confidence || 'medium',
    reason: llmRoute.reason || hint.rule_reason || hint.reason || '',
    followupQuestion: llmRoute.followupQuestion || hint.followupQuestion || ''
  };

  const validModes = new Set(['timing', 'status', 'pattern', 'character', 'unsupported']);
  if (!validModes.has(route.analysis_mode)) route.analysis_mode = 'status';

  if (route.subcategory === 'partner_profile' && route.analysis_mode !== 'character') {
    route.analysis_mode = 'character';
    route.needs_time_scan = false;
    route.confidence = route.confidence === 'high' ? 'medium' : route.confidence;
    route.reason = `${route.reason ? `${route.reason}；` : ''}partner_profile 默认修正为 character 模式`;
  }

  if (route.analysis_mode === 'timing') {
    route.needs_time_scan = true;
    if (!route.time_scope || route.time_scope.type === 'unknown') {
      route.time_scope = { ...(route.time_scope || {}), type: 'next_10_years' };
    }
  }

  if (route.analysis_mode === 'status' && (!route.time_scope || route.time_scope.type === 'unknown')) {
    route.time_scope = { ...(route.time_scope || {}), type: 'current_year' };
  }

  return route;
}

function inferBaziRouteFromQuestion(question, route = {}) {
  const text = String(question || '').replace(/\s+/g, '');
  let analysisMode = 'status';
  let secondaryMode = null;
  let timeScope = { type: 'current_year' };
  const ageBeforeMatch = text.match(/(\d{1,2})岁(?:以前|之前|前|前后)?/);
  const ageRangeMatch = text.match(/(\d{1,2})[岁到\-~至]+(\d{1,2})岁?/);
  let detectedTimeScope = null;

  if (/什么时候|哪年|几岁|何时|未来几年|未来五年|未来十年/.test(text)) {
    analysisMode = 'timing';
    timeScope = /未来五年/.test(text) ? { type: 'next_5_years' } : /未来几年|近期|最近/.test(text) ? { type: 'next_3_years' } : { type: 'next_10_years' };
  } else if (/什么样|画像|长相|性格|对象|老婆|老公|伴侣/.test(text) && /今年|现在|当前|这步大运|状态|怎么样/.test(text)) {
    analysisMode = 'character';
    secondaryMode = 'status';
    timeScope = { type: 'current_year' };
  } else if (/什么样|画像|长相|性格|对象|老婆|老公|伴侣/.test(text) && !/今年|现在|当前|这步大运/.test(text)) {
    analysisMode = 'character';
    timeScope = { type: 'unknown' };
  } else if (/适合|格局|命里|有没有|先天|上限|容量|创业还是打工|行业/.test(text) && !/今年|现在|当前|这步大运/.test(text)) {
    analysisMode = 'pattern';
    timeScope = { type: 'unknown' };
  } else if (/适合|格局|命里|先天|创业|打工|行业/.test(text) && /今年|现在|当前|这步大运|能不能做/.test(text)) {
    analysisMode = 'pattern';
    secondaryMode = 'status';
    timeScope = { type: 'current_year' };
  }

  if (ageRangeMatch) {
    detectedTimeScope = {
      type: 'specified_range',
      start_age: Number(ageRangeMatch[1]),
      end_age: Number(ageRangeMatch[2]),
      source: 'age_range'
    };
  } else if (ageBeforeMatch) {
    detectedTimeScope = {
      type: 'specified_range',
      end_age: Number(ageBeforeMatch[1]),
      source: 'age_before'
    };
  }

  if (detectedTimeScope) {
    analysisMode = 'timing';
    secondaryMode = null;
    timeScope = detectedTimeScope;
  }

  return {
    ...route,
    analysis_mode: detectedTimeScope ? 'timing' : (route.analysis_mode || route.analysis_mode_hint || analysisMode),
    secondary_mode: detectedTimeScope ? null : (route.secondary_mode ?? route.secondary_mode_hint ?? secondaryMode),
    needs_time_scan: detectedTimeScope ? true : (route.needs_time_scan ?? route.needs_time_scan_hint ?? analysisMode === 'timing'),
    time_scope: detectedTimeScope || route.time_scope || route.time_scope_hint || timeScope
  };
}

function resolveConcreteTimeScope(timeScope = {}, currentYear, { analysisMode, nowYear, birthYear } = {}) {
  const year = Number(currentYear);
  const buildTenYearFallback = (source = 'range_fallback', reason = '指定时间区间无法可靠展开，降级扫描未来十年') => {
    const fallbackYear = Number.isFinite(year) && year > 0 ? year : (Number(nowYear) || new Date().getFullYear());
    return {
      ...timeScope,
      type: 'next_10_years',
      start_year: fallbackYear,
      end_year: fallbackYear + 9,
      source,
      limitations: [...(timeScope.limitations || []), reason]
    };
  };

  if (!Number.isFinite(year) || year <= 0) {
    const fallbackYear = Number(nowYear) || new Date().getFullYear();
    return {
      ...timeScope,
      type: analysisMode === 'status' ? 'current_year' : 'next_10_years',
      start_year: fallbackYear,
      end_year: analysisMode === 'status' ? fallbackYear : fallbackYear + 9,
      source: 'system_year_fallback',
      limitations: ['profile.currentLiunian.year 缺失，使用服务器当前年份作为临时基准']
    };
  }

  const type = timeScope.type || 'unknown';
  if (type === 'current_year') return { ...timeScope, start_year: year, end_year: year };
  if (type === 'next_3_years') return { ...timeScope, start_year: year, end_year: year + 2 };
  if (type === 'next_5_years') return { ...timeScope, start_year: year, end_year: year + 4 };
  if (type === 'next_10_years') return { ...timeScope, start_year: year, end_year: year + 9 };
  if (type === 'specified_range') {
    const startAge = Number(timeScope.start_age);
    const endAge = Number(timeScope.end_age);
    const parsedBirthYear = Number(birthYear);
    if (Number.isFinite(startAge) || Number.isFinite(endAge)) {
      if (!Number.isFinite(parsedBirthYear) || parsedBirthYear <= 0) {
        return buildTenYearFallback('age_range_fallback', '识别到年龄区间，但缺少出生年，降级扫描未来十年');
      }
      const hasStartAge = Number.isFinite(startAge);
      const hasEndAge = Number.isFinite(endAge);
      const rawStart = hasStartAge ? parsedBirthYear + startAge : year;
      const rawEnd = hasEndAge ? parsedBirthYear + endAge : rawStart + 9;
      const lower = hasStartAge && hasEndAge ? Math.min(rawStart, rawEnd) : rawStart;
      const upper = hasStartAge && hasEndAge ? Math.max(rawStart, rawEnd) : rawEnd;
      const start = Math.max(year, lower);
      const end = upper;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < year || end < start) {
        return buildTenYearFallback('age_range_fallback', '年龄区间早于当前流年或无法可靠展开，降级扫描未来十年');
      }
      return {
        ...timeScope,
        start_year: start,
        end_year: end,
        source: timeScope.source || 'age_range'
      };
    }
    const start = Number(timeScope.start_year) || year;
    const end = Number(timeScope.end_year) || start;
    if (Math.max(start, end) < year) {
      return buildTenYearFallback('specified_range_fallback', '指定年份区间早于当前流年，降级扫描未来十年');
    }
    return { ...timeScope, start_year: Math.min(start, end), end_year: Math.max(start, end) };
  }
  if (type === 'specified_dayun') return { ...timeScope };
  return { ...timeScope, type: analysisMode === 'status' ? 'current_year' : 'next_10_years', start_year: year, end_year: analysisMode === 'status' ? year : year + 9 };
}

function resolveDayunForYear({
  dayunList = [],
  year,
  currentDayun = {},
  birthYear
} = {}) {
  const targetYear = Number(year);
  const limitations = [];
  if (!Number.isFinite(targetYear)) {
    return { ...currentDayun, source: 'fallback_current', limitations: ['候选年份缺失，使用当前大运兜底'] };
  }

  const normalized = dayunList.map((item, index) => {
    const startFromField = Number(item.start_year);
    const nextStartFromField = Number(dayunList[index + 1]?.start_year);
    const startFromAge = Number(birthYear) && Number(item.start_age) ? Number(birthYear) + Number(item.start_age) : null;
    const startYear = Number.isFinite(startFromField) ? startFromField : startFromAge;
    const endFromField = Number(item.end_year);
    const endYear = Number.isFinite(endFromField)
      ? endFromField
      : Number.isFinite(nextStartFromField)
        ? nextStartFromField - 1
        : Number.isFinite(startYear)
          ? startYear + 9
          : null;
    return {
      ...item,
      start_year: startYear,
      end_year: endYear,
      source: Number.isFinite(startFromField) && Number.isFinite(endFromField) ? 'exact' : 'estimated'
    };
  });

  const matched = normalized.find((item) => Number.isFinite(item.start_year) && Number.isFinite(item.end_year) && targetYear >= item.start_year && targetYear <= item.end_year);
  if (matched) {
    if (matched.source === 'estimated') limitations.push('大运年份由 birthYear/start_age 或列表顺序估算');
    return { ...matched, limitations };
  }

  return {
    ...currentDayun,
    source: 'fallback_current',
    limitations: ['未能从 dayun_list 命中候选年份所属大运，使用当前大运兜底']
  };
}

function resolveCandidateYears({
  timeScope,
  currentYear,
  liunianList = [],
  dayunList = [],
  birthYear,
  maxYears = 10
} = {}) {
  const limitations = [];
  const baseYear = Number(currentYear);
  const scope = timeScope || {};
  let startYear = Number(scope.start_year);
  let endYear = Number(scope.end_year);

  if (scope.type === 'specified_dayun') {
    const targetGanzhi = scope.dayun_ganzhi || `${scope.gan || ''}${scope.zhi || ''}`;
    const matchedDayun = dayunList.find((item) => `${item.gan || ''}${item.zhi || ''}` === targetGanzhi);
    if (matchedDayun) {
      const inferredStart = Number(matchedDayun.start_year) || (Number(birthYear) && Number(matchedDayun.start_age) ? Number(birthYear) + Number(matchedDayun.start_age) : baseYear);
      const resolved = resolveDayunForYear({ dayunList: [matchedDayun], year: inferredStart, currentDayun: matchedDayun, birthYear });
      startYear = Number(resolved.start_year);
      endYear = Number(resolved.end_year);
      limitations.push(...(resolved.limitations || []));
    } else {
      startYear = baseYear;
      endYear = baseYear + 9;
      limitations.push('指定大运未找到，降级扫描未来十年');
    }
  }

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    if (!Number.isFinite(baseYear)) return { years: [], limitations: ['currentYear 缺失，无法展开 timing 候选年份'] };
    startYear = baseYear;
    endYear = baseYear + (scope.type === 'current_year' ? 0 : 9);
  }

  if (endYear < startYear) [startYear, endYear] = [endYear, startYear];
  if (endYear - startYear + 1 > maxYears) {
    endYear = startYear + maxYears - 1;
    limitations.push(`扫描范围超过 ${maxYears} 年，已截断`);
  }

  const withYears = liunianList.map((item, index) => {
    const hasYear = Number.isFinite(Number(item.year));
    const yearValue = hasYear ? Number(item.year) : (Number.isFinite(baseYear) ? baseYear + index : null);
    if (!hasYear && Number.isFinite(yearValue)) limitations.push('部分 liunian_list 缺 year，按列表顺序推导年份');
    return { ...item, year: yearValue, source: hasYear ? 'exact' : 'estimated' };
  }).filter((item) => Number.isFinite(item.year));

  const years = withYears
    .filter((item) => item.year >= startYear && item.year <= endYear)
    .sort((a, b) => a.year - b.year)
    .map((item) => {
      const dayun = resolveDayunForYear({ dayunList, year: item.year, currentDayun: {}, birthYear });
      return {
        year: item.year,
        gan: item.gan,
        zhi: item.zhi,
        shi_shen: item.shi_shen,
        source: item.source,
        dayun_hint: dayun.gan || dayun.zhi ? { gan: dayun.gan, zhi: dayun.zhi } : undefined
      };
    });

  if (!years.length) limitations.push('未来流年列表不足，未能生成 timing 候选年份');
  return { years, limitations: [...new Set(limitations)] };
}

function getTopMechanisms(dynamicReport = {}) {
  return [
    ...(dynamicReport.dayun_impact?.mechanisms || []),
    ...(dynamicReport.liunian_impact?.mechanisms || [])
  ].sort((a, b) => (b.effective_strength || 0) - (a.effective_strength || 0));
}

function deriveQuality({ isMajorWindow, isActivated, topStrength, isEffective, newStability }) {
  if (isMajorWindow && isActivated && isEffective && topStrength >= 60 && newStability !== 'unstable') return 'strong';
  if ((isActivated && isEffective && topStrength >= 40) || (isMajorWindow && topStrength >= 45)) return 'medium';
  return 'weak';
}

function rankTimingCandidate({ yearItem, dayun, dynamicReport }) {
  const topMechanisms = getTopMechanisms(dynamicReport);
  const topStrength = topMechanisms[0]?.effective_strength || 0;
  const isMajorWindow = !!(dynamicReport.dayun_impact?.activates_target && dynamicReport.liunian_impact?.activates_target);
  const isEffective = topMechanisms.some((item) => item.vigor_check?.is_effective);
  const trigger = dynamicReport.target_trigger || {};
  const quality = deriveQuality({
    isMajorWindow,
    isActivated: !!trigger.is_activated,
    topStrength,
    isEffective,
    newStability: trigger.new_stability
  });
  const rankScore = (quality === 'strong' ? 70 : quality === 'medium' ? 45 : 20) + Math.min(30, Math.round(topStrength / 3));

  return {
    year: yearItem.year,
    ganzhi: `${yearItem.gan || ''}${yearItem.zhi || ''}`,
    dayun_ganzhi: `${dayun.gan || ''}${dayun.zhi || ''}`,
    quality,
    is_major_window: isMajorWindow,
    event_type: trigger.event_type || '',
    mechanisms: topMechanisms.slice(0, 3).map((item) => `${item.type}：${item.description}（引动强度 ${item.effective_strength}）`),
    supporting_evidence: [
      isMajorWindow ? '大运与流年同时触发目标元素' : '',
      trigger.is_activated ? `目标元素被引动，状态变化：${trigger.state_change || '有变化'}` : ''
    ].filter(Boolean),
    blocking_evidence: [
      !isEffective && topStrength ? '存在引动但旺衰校验不足，不能作强应期' : '',
      dayun.source !== 'exact' ? `大运定位为 ${dayun.source || 'unknown'}，置信度需下调` : ''
    ].filter(Boolean),
    _pipeline: {
      rank_score: rankScore,
      activation_strength: topStrength,
      trigger_vigor: {
        dayun: dynamicReport.dayun_impact?.trigger_vigor ?? 0,
        liunian: dynamicReport.liunian_impact?.trigger_vigor ?? 0
      },
      target_trigger: trigger
    },
    dynamicReport
  };
}

function sortTimingCandidates(candidates = []) {
  const order = { strong: 3, medium: 2, weak: 1 };
  return [...candidates].sort((a, b) => {
    const qualityDiff = (order[b.quality] || 0) - (order[a.quality] || 0);
    if (qualityDiff) return qualityDiff;
    return (b.rank_score || 0) - (a.rank_score || 0);
  });
}

function extractBaziAnalysisParams(profile = {}, semanticRoute = {}) {
  const detail = profile.bazi_detail || {};
  const matrix = detail.matrix || {};
  const pillars = matrix.pillars || [];
  const baziParts = splitBaziStr(profile.bazi_str || [
    detail?.pillars?.ganzhi?.year,
    detail?.pillars?.ganzhi?.month,
    detail?.pillars?.ganzhi?.day,
    detail?.pillars?.ganzhi?.time
  ].filter(Boolean).join(' '));
  const dayStem = baziParts.day_gz?.charAt(0) || profile.ri_zhu?.charAt(0) || '';

  if (semanticRoute.analysis_mode === 'unsupported') {
    return { ok: false, reason: 'unsupported', params: {} };
  }
  if (!pillars.length || !dayStem) {
    return { ok: false, reason: '四柱矩阵或日干缺失', params: { matrix, dayStem } };
  }

  return {
    ok: true,
    params: {
      matrix: { ...matrix, pillars },
      dayStem,
      gender: normalizePipelineGender(profile.gender),
      birthYear: parseBirthYear(profile),
      currentDayun: matrix.current_dayun || {},
      currentLiunian: matrix.current_liunian || {},
      currentLiuyue: getCurrentMonthData(matrix),
      liunianList: matrix.liunian_list || [],
      dayunList: matrix.dayun_list || [],
      favorableWuxing: parseWuxingSet(profile.favorable_elements || detail.favorable_gods),
      unfavorableWuxing: parseWuxingSet(profile.unfavorable_elements || detail.unfavorable_gods),
      rawContext: {
        strong_weak: profile.strong_weak || detail.strong_weak || detail.strength_detail?.strongWeak || '',
        geju: profile.geju || detail.base_info?.ge_ju || detail.geju || '',
        favorable_elements: profile.favorable_elements || detail.favorable_gods,
        unfavorable_elements: profile.unfavorable_elements || detail.unfavorable_gods,
        shensha: profile.shensha || detail.pillars?.shensha,
        tiaohou_detail: detail.tiaohou_detail,
        chengge_detail: detail.chengge_detail,
        classic_verdict: detail.classic_verdict
      }
    }
  };
}

function extractBaziQuestionContext(profile = {}) {
  const detail = profile.bazi_detail || {};
  const matrix = detail.matrix || {};
  const tiaohouDetail = detail.tiaohou_detail || {};
  const chenggeDetail = detail.chengge_detail || {};
  const fiveShens = detail.five_shens || {};
  const coreShens = detail.core_shens || {};
  const wuxing = detail.wuxing || {};
  const classicVerdict = detail.classic_verdict || {};
  const pillars = splitBaziStr(profile.bazi_str || detail?.pillars?.ganzhi ? [
    detail?.pillars?.ganzhi?.year,
    detail?.pillars?.ganzhi?.month,
    detail?.pillars?.ganzhi?.day,
    detail?.pillars?.ganzhi?.time
  ].filter(Boolean).join(' ') : '');
  const baziParts = splitBaziStr(profile.bazi_str || `${pillars.year_gz} ${pillars.month_gz} ${pillars.day_gz} ${pillars.hour_gz}`);
  const dayStem = baziParts.day_gz?.charAt(0) || profile.ri_zhu?.charAt(0) || '未知';
  const currentDayun = matrix.current_dayun || {};
  const currentLiunian = matrix.current_liunian || {};
  const currentLiuyue = getCurrentMonthData(matrix);
  const dayunGanZhi = `${currentDayun.gan || ''}${currentDayun.zhi || ''}` || '未提供';
  const liunianGanZhi = `${currentLiunian.gan || ''}${currentLiunian.zhi || ''}` || '未提供';
  const liuyueGanZhi = `${currentLiuyue.gan || ''}${currentLiuyue.zhi || ''}` || '未提供';
  const matchedDayun = (matrix.dayun_list || []).find((item) => item.gan === currentDayun.gan && item.zhi === currentDayun.zhi) || {};
  const favorableShishen = asText(
    coreShens.favorable || fiveShens.favorable || detail.favorable_gods || profile.favorable_shishen,
    ''
  );
  const unfavorableShishen = asText(
    coreShens.unfavorable || fiveShens.unfavorable || detail.unfavorable_gods || profile.unfavorable_shishen,
    ''
  );
  const favorableWuxing = asText(wuxing.favorable || detail.favorable_wuxing || profile.favorable_wuxing || profile.favorable_elements, '');
  const unfavorableWuxing = asText(wuxing.unfavorable || detail.unfavorable_wuxing || profile.unfavorable_wuxing || profile.unfavorable_elements, '');
  const tiaohouGods = formatNamedList(tiaohouDetail.primary_gods) || formatNamedList(tiaohouDetail.secondary_gods);
  const tiaohouSummary = pickText(
    tiaohouDetail.explanation,
    tiaohouDetail.text,
    tiaohouDetail.verdict,
    [
      tiaohouDetail.climate_state ? `气候状态：${tiaohouDetail.climate_state}` : '',
      tiaohouGods ? `调候重点：${tiaohouGods}` : '',
      tiaohouDetail.urgency ? `缓急：${tiaohouDetail.urgency}` : ''
    ].filter(Boolean).join('；')
  );
  const patternSummary = pickText(
    chenggeDetail.summary,
    chenggeDetail.verdict,
    chenggeDetail.chengGe && chenggeDetail.chengGeResult ? `${chenggeDetail.chengGe}，${chenggeDetail.chengGeResult}` : '',
    detail.pattern_analysis?.summary,
    detail.base_info?.ge_ju,
    detail.geju,
    profile.geju
  );
  const strengthSummary = pickText(
    detail.strength_detail?.summary,
    detail.strength_detail?.strongWeak,
    detail.strong_weak,
    profile.strong_weak
  );
  const classicSummary = pickText(
    classicVerdict.summary,
    classicVerdict.verdict,
    detail.favorable_verdict,
    detail.user_blocks?.core_summary,
    detail.bazi_summary
  );

  return {
    name: profile.name || '命主',
    gender: normalizeGender(profile.gender),
    ...baziParts,
    day_stem: dayStem,
    strong_weak: profile.strong_weak || detail.strong_weak || detail.strength_detail?.strongWeak || '未提供',
    geju: profile.geju || detail.base_info?.ge_ju || detail.geju || '未提供',
    favorable_elements: asText(profile.favorable_elements || detail.favorable_gods),
    unfavorable_elements: asText(profile.unfavorable_elements || detail.unfavorable_gods),
    favorable_shishen: favorableShishen || '未提供',
    unfavorable_shishen: unfavorableShishen || '未提供',
    favorable_wuxing: favorableWuxing || '未提供',
    unfavorable_wuxing: unfavorableWuxing || '未提供',
    strength_summary: strengthSummary || '未提供',
    pattern_summary: patternSummary || '未提供',
    tiaohou_summary: tiaohouSummary || '未提供',
    decision_chain_summary: formatDecisionChain(detail.decision_chain),
    classic_summary: classicSummary || '',
    shensha: asText(profile.shensha || detail.pillars?.shensha),
    current_dayun: dayunGanZhi,
    dayun_start_age: matchedDayun.start_age || currentDayun.start_age || '未提供',
    dayun_stem_shen: currentDayun.shi_shen || matchedDayun.shi_shen || '未提供',
    current_year_gz: liunianGanZhi,
    current_year_shishen: currentLiunian.shi_shen || '未提供',
    current_month_gz: liuyueGanZhi,
    current_month_shishen: currentLiuyue.shi_shen || '未提供',
    tiaohou_detail: compactJson(detail.tiaohou_detail),
    sizhu_matrix: compactJson({
      pillars: matrix.pillars || [],
      current_dayun: currentDayun,
      current_liunian: currentLiunian,
      current_liuyue: currentLiuyue,
      dayun_list: matrix.dayun_list || [],
      liunian_list: matrix.liunian_list || [],
      interactions: detail.interactions || {},
      strength_detail: detail.strength_detail || {},
      tiaohou_detail: detail.tiaohou_detail || {},
      chengge_detail: detail.chengge_detail || {},
      classic_verdict: detail.classic_verdict || {}
    })
  };
}

function buildLegacyBaziQuestionPrompt({ profile, question, route = {} }) {
  const ctx = extractBaziQuestionContext(profile);
  const userQuestion = String(question || '').trim();

  return `你是一位精通子平八字推演的命理大师，擅长将客观命局数据转化为有温度、有落地价值的人生指引。

重要限制：
- 你不是排盘器，不得重新排盘。
- 格局、喜忌、旺衰、神煞、大运流年、四柱矩阵必须以系统提供字段为准。
- 如果字段缺失，直接说明资料不足，不要自行编造。
- 系统分类：${route.category || 'general'}${route.subcategory ? ` / ${route.subcategory}` : ''}

【命主信息】
姓名：${ctx.name}，性别：${ctx.gender}
八字：${ctx.year_gz} ${ctx.month_gz} ${ctx.day_gz} ${ctx.hour_gz}
日主：${ctx.day_stem}（${ctx.strong_weak}）
格局：${ctx.geju}
喜用神：${ctx.favorable_elements}
忌仇神：${ctx.unfavorable_elements}
神煞：${ctx.shensha}

【当前时间轴】
当前大运：${ctx.current_dayun}（${ctx.dayun_start_age}岁起，${ctx.dayun_stem_shen}）
当前流年：${ctx.current_year_gz}（${ctx.current_year_shishen}）
当前流月：${ctx.current_month_gz}（${ctx.current_month_shishen}）

【调候诊断】
${ctx.tiaohou_detail}

【四柱完整矩阵（供生克分析用）】
${ctx.sizhu_matrix}

【用户问题】
${userQuestion}

---

**【核心推演逻辑】**

总链路必须按：排盘口径 → 日主旺衰 → 寒暖燥湿调候 → 月令格局 → 十神组合 → 喜用忌神 → 刑冲合害 → 神煞辅助 → 大运流年应期 → 事件校验。

1. **先承接系统定盘与日主强弱**
   - 不重新排盘，只复核系统字段是否足够；字段缺失时说明不足。
   - 先说明日主强弱、强弱依据和命主能否承载问题领域的财/官/印/食伤。

2. **再看调候、格局与喜忌**
   - 若系统提供调候、病药、通关、扶抑或喜忌评分，必须优先引用。
   - 格局只作为命局主轴，不得越过旺衰、调候、喜忌直接定吉凶。
   - 若格局本身对问题领域有天然支撑（如财格问财），明确说明；若相悖（如印格弱财问发财），如实说明局限。

3. **再看十神组合、刑冲合害与神煞辅助**
   - 根据问题类型，锁定对应的核心「十神」：
     - 财运/钱财 → 财星（正财/偏财）
     - 事业/升职 → 官星（正官/七杀）
     - 感情/婚姻 → 男看财星/女看官星，兼看桃花神煞
     - 健康 → 对应五行脏腑，忌神克制方向
     - 学业/考试 → 印星状态
   - 分析该十神在命局中的强弱、在当前大运流年中的受益/受克状态。
   - 刑冲合害先看触发了喜神还是忌神；神煞只能辅助说明，不得单独定论。
   - 先列凶象（克泄耗、刑冲破害、空亡、忌神透干），再列吉象，不得只报喜不报忧。

4. **最后看大运流年，判断当前时间窗口**
   - 当前大运是否走喜用神？流年天干是否与命局形成生扶还是刑冲？
   - 大运流年如同「宏观气候」，先定基调：顺运/逆运/平运。
   - 流月是短期催化剂，判断近1-3个月是否有具体触发点。
   - 如果当前时间窗口不利，向后推演：大运何时转向？流年何时走喜用神？
   - 给出具体的「时间窗口」建议，而非模糊的「近期不利」。
   - 若用户提供已发生事件，把它作为校验点；未提供时，不得伪造事件校验。

5. **建议要有温度，有可操作性**
   - 真实关怀 = 预警风险 + 给出应对方案，不是回避风险。

---

**【Output Format (JSON Schema)】**
严格返回如下 JSON 结构：

{
  "summary": {
    "title": "本次解读主题（如：2025年事业运势分析）",
    "conclusion": "核心结论（如：✅ 当前大运走财，问题领域有支撑）",
    "score": 72,
    "score_basis": {
      "positive_signals": ["命局财星有根，大运走食伤生财", "流年与日主相合"],
      "negative_signals": ["七杀透干无制，压力较大", "财星空亡，到手有阻"],
      "score_logic": "命局底子中等偏上，当前时间轴顺运，但流年有冲，综合给72分"
    },
    "keyword": "关键信号（如：财星有根，时间窗口已开）"
  },
  "ming_ju_analysis": {
    "ge_ju": "格局定性（如：食神生财格，偏财格）",
    "capacity": "命局在此问题域的先天容量（如：财格问财，上限较高；印格弱财，先天不足）",
    "day_master": "日主状态简述（如：甲木生于子月，水多木浮，需火土引化）",
    "core_shishen": "本次问题核心十神及其在命局中的状态（如：偏财坐长生，有力但无透干）",
    "shensha_note": "本次相关神煞说明（如：天乙贵人在亥，流年入亥有贵人）"
  },
  "dayun_liunian": {
    "current_climate": "顺运|逆运|平运",
    "dayun_verdict": "当前大运对此问题的影响（如：庚运克甲日主，事业压力大）",
    "liunian_verdict": "流年对此问题的触发（如：乙亥流年，财星透天干，有进财机会）",
    "liuyue_trigger": "流月近期催化点（如：本月壬子，印星入局，利学习签约）",
    "turning_point": "若当前不利，预判何时转机（如：2027年丁运起，喜用神入位）"
  },
  "question_analysis": {
    "domain": "finance|career|relationship|health|study|other",
    "axes": [
      {
        "key": "self",
        "label": "命主状态",
        "verdict": "判断结论",
        "evidence": "命局依据（具体到干支、十神、大运流年）",
        "tone": "positive|mixed|warning"
      },
      {
        "key": "target",
        "label": "目标事物状态（财/官/感情对象）",
        "verdict": "判断结论",
        "evidence": "命局依据",
        "tone": "positive|mixed|warning"
      },
      {
        "key": "process",
        "label": "过程阻力",
        "verdict": "过程中的主要阻力或助力",
        "evidence": "命局依据",
        "tone": "positive|mixed|warning"
      }
    ],
    "timing": {
      "current_window": "当前时间窗口评估（有利/一般/不利）",
      "best_period": "最佳行动时间窗口",
      "avoid_period": "应回避的时间段"
    }
  },
  "advice": {
    "strategy": ["策略1", "策略2"],
    "risk": "核心风险提示与避坑建议",
    "leverage": "如何借力喜用神方向（五行/方位/行业/颜色等）",
    "lucky_tips": {
      "direction": "有利方位（如：南方、东南）",
      "industry": "契合行业或职业方向",
      "timing": "最近一个有利时间节点"
    }
  }
}`;
}

function formatBasicProfileBlock(ctx) {
  return `【命主基础信息】
姓名：${ctx.name}
性别：${ctx.gender}
八字：${ctx.year_gz} ${ctx.month_gz} ${ctx.day_gz} ${ctx.hour_gz}
日主：${ctx.day_stem}（${ctx.strong_weak}）
格局：${ctx.geju}
喜用神：${ctx.favorable_elements}
忌仇神：${ctx.unfavorable_elements}
当前大运：${ctx.current_dayun}（${ctx.dayun_stem_shen}）
当前流年：${ctx.current_year_gz}（${ctx.current_year_shishen}）

${formatUpstreamAnalysisBlock(ctx)}`;
}

function buildUnifiedOutputSchemaBlock(mode, { secondaryMode = null } = {}) {
  const secondaryValue = secondaryMode ? `"${secondaryMode}"` : 'null';
  const modeAnalysisSchema = buildModeAnalysisSchema(mode, secondaryMode);
  return `【输出 JSON Schema】
严格返回统一 envelope，不要包含 trigger_vigor、activation_strength、activates_target、is_major_window、vigor_check 等 pipeline 内部计算字段（这些由系统组装层处理）：
{
  "meta": {
    "analysis_mode": "${mode}",
    "secondary_mode": ${secondaryValue},
    "branch": "bazi",
    "category": "",
    "subcategory": "",
    "target": {
      "shishen": [],
      "gongwei": [],
      "fallback_level": "subcategory|category|general|llm_derived|none",
      "llm_derived_target": null
    },
    "confidence": "high|medium|low",
    "limitations": []
  },
  "summary": {
    "title": "",
    "conclusion": "",
    "level": "strong|medium|weak|mixed|unknown",
    "assessment_type": "timing_effectiveness|current_climate|innate_capacity|portrait_confidence|unsupported",
    "score": null,
    "score_label": "",
    "keyword": "",
    "basis": {
      "positive_signals": [],
      "negative_signals": [],
      "logic": "80-160字判断依据报告，必须综合正向与逆向标签，并贴合用户问题主题"
    }
  },
  "chart_foundation": {
    "overall_stability": "",
    "base_state": "",
    "capacity_level": "strong|medium|weak|unknown",
    "core_stars": [],
    "core_palaces": [],
    "supports": [],
    "obstacles": [],
    "evidence": []
  },
  "dynamic_context": null,
  "mode_analysis": ${modeAnalysisSchema},
  "advice": {
    "strategy": [],
    "risk": "",
    "avoid": [],
    "timing": [],
    "leverage": ""
  }
}`;
}

function buildModeAnalysisSchema(mode, secondaryMode) {
  if (mode === 'status') {
    return `{
    "dayun_reading": "80-140字，说明当前大运如何建场、承接或压制本命题，必须引用系统断语",
    "liunian_reading": "80-140字，说明当前流年如何触发、放大、缓解或反向催动本命题，必须引用系统断语",
    "target_state_reading": "80-140字，说明目标十神/宫位当前状态和变化，必须引用系统断语"
  }`;
  }
  if (mode === 'timing') {
    return `{
    "scanned_years": [],
    "trigger_windows": [
      {
        "year": 2028,
        "ganzhi": "戊申",
        "dayun_ganzhi": "",
        "verdict": "70-130字，说明该年为什么被筛选出来",
        "mechanisms_text": "40-90字，解释核心触发机制",
        "supporting_evidence": [],
        "blocking_evidence": []
      }
    ],
    "best_window": "",
    "avoid_window": ""
  }`;
  }
  if (mode === 'pattern') {
    return `{
    "capacity_level": "strong|medium|weak|unknown",
    "verdict": "120-220字，综合先天适配、容量、优势与风险",
    "structural_supports": [],
    "structural_risks": []${secondaryMode === 'status' ? `,
    "current_status_note": "secondary=status 时用60-100字说明当前大运流年是否适合推进"` : ''}
  }`;
  }
  if (mode === 'character') {
    return `{
    "portrait_subject": "spouse|partner|boss|child|other",
    "target_resolution": "backend_mapped|llm_derived",
    "llm_derived_target_note": "",
    "appearance_tendency": { "text": "", "confidence": "high|medium|low", "evidence": [] },
    "personality_tendency": { "text": "", "confidence": "high|medium|low", "evidence": [] },
    "career_style": { "text": "", "confidence": "high|medium|low", "evidence": [] },
    "relationship_dynamic": "",
    "do_not_overclaim": "以上为十神五行和宫位状态呈现的人物倾向，不等于现实中对方一定如此。"
  }`;
  }
  return '{}';
}

function resolveBackendTargetSpec(params, semanticRoute) {
  return resolveTargetElement({
    category: semanticRoute.category,
    subcategory: semanticRoute.subcategory,
    gender: params.gender
  });
}

function runStatusPipeline(params, semanticRoute) {
  const targetSpec = resolveBackendTargetSpec(params, semanticRoute);
  const stateReport = assessOriginalChartState({
    matrix: params.matrix,
    targetSpec,
    dayStem: params.dayStem,
    gender: params.gender
  });
  const dynamicReport = assessDynamicTriggers({
    matrix: params.matrix,
    targetSpec,
    stateReport,
    dayStem: params.dayStem,
    dayunGan: params.currentDayun.gan,
    dayunZhi: params.currentDayun.zhi,
    liunianGan: params.currentLiunian.gan,
    liunianZhi: params.currentLiunian.zhi,
    favorableWuxing: params.favorableWuxing,
    unfavorableWuxing: params.unfavorableWuxing
  });
  return { targetSpec, stateReport, dynamicReport };
}

function runStaticPipeline(params, semanticRoute, { includeDynamic = false } = {}) {
  const targetSpec = resolveBackendTargetSpec(params, semanticRoute);
  const stateReport = assessOriginalChartState({
    matrix: params.matrix,
    targetSpec,
    dayStem: params.dayStem,
    gender: params.gender
  });
  const result = { targetSpec, stateReport };
  if (includeDynamic) {
    result.dynamicReport = assessDynamicTriggers({
      matrix: params.matrix,
      targetSpec,
      stateReport,
      dayStem: params.dayStem,
      dayunGan: params.currentDayun.gan,
      dayunZhi: params.currentDayun.zhi,
      liunianGan: params.currentLiunian.gan,
      liunianZhi: params.currentLiunian.zhi,
      favorableWuxing: params.favorableWuxing,
      unfavorableWuxing: params.unfavorableWuxing
    });
  }
  return result;
}

function runTimingPipeline(params, semanticRoute, options = {}) {
  const targetSpec = resolveBackendTargetSpec(params, semanticRoute);
  const stateReport = assessOriginalChartState({
    matrix: params.matrix,
    targetSpec,
    dayStem: params.dayStem,
    gender: params.gender
  });
  const concreteTimeScope = resolveConcreteTimeScope(semanticRoute.time_scope, params.currentLiunian.year, {
    analysisMode: semanticRoute.analysis_mode,
    birthYear: params.birthYear
  });
  const candidateYearResult = resolveCandidateYears({
    timeScope: concreteTimeScope,
    currentYear: params.currentLiunian.year,
    liunianList: params.liunianList,
    dayunList: params.dayunList,
    birthYear: params.birthYear,
    maxYears: options.maxYears || 10
  });

  const candidates = candidateYearResult.years.map((yearItem) => {
    const dayun = resolveDayunForYear({
      dayunList: params.dayunList,
      year: yearItem.year,
      currentDayun: params.currentDayun,
      birthYear: params.birthYear
    });
    const dynamicReport = assessDynamicTriggers({
      matrix: params.matrix,
      targetSpec,
      stateReport,
      dayStem: params.dayStem,
      dayunGan: dayun.gan,
      dayunZhi: dayun.zhi,
      liunianGan: yearItem.gan,
      liunianZhi: yearItem.zhi,
      favorableWuxing: params.favorableWuxing,
      unfavorableWuxing: params.unfavorableWuxing
    });
    return rankTimingCandidate({ yearItem, dayun, stateReport, dynamicReport, targetSpec });
  });

  return {
    targetSpec,
    stateReport,
    timingCandidates: sortTimingCandidates(candidates).slice(0, options.limit || 5),
    scanned_years: candidateYearResult.years.map((item) => item.year),
    time_scope: concreteTimeScope,
    limitations: candidateYearResult.limitations
  };
}

function formatTimingCandidatesForPrompt(candidates = []) {
  if (!candidates.length) return '未生成有效候选年份；需要降级为当前状态判断或提示未来流年列表不足。';
  return candidates.map((item, index) => {
    const evidence = [
      item.supporting_evidence.length ? `助力：${item.supporting_evidence.join('；')}` : '',
      item.blocking_evidence.length ? `限制：${item.blocking_evidence.join('；')}` : '',
      item.mechanisms.length ? `机制：${item.mechanisms.join('；')}` : ''
    ].filter(Boolean).join('\n  ');
    return `${index + 1}. ${item.year}年 ${item.ganzhi}（大运 ${item.dayun_ganzhi || '未定位'}）：候选强度 ${item.quality}，排序分 ${item.rank_score}，事件类型 ${item.event_type || '未定'}\n  ${evidence || '暂无可用机制摘要。'}`;
  }).join('\n');
}

function formatOptionalDynamicBlock(dynamicReport) {
  if (!dynamicReport) return '';
  return `\n【当前大运流年动态评估 Step 3（secondary=status）】\n${formatDynamicReportForPrompt(dynamicReport, {
    includeStrengthTags: true,
    maxMechanismsPerPillar: 2,
    includeMajorWindowFlag: true
  })}\n`;
}

function formatLlmDerivedTargetForPrompt(route = {}) {
  const target = route.llm_derived_target || {};
  const focus = route.target_focus || {};
  const observationScope = target.observation_scope || focus.observation_scope || focus.allowed_observations || [];
  const limitations = target.limitations || focus.limitations || [];
  const evidencePolicy = target.evidence_policy || focus.evidence_policy || '';
  const lines = [
    '【LLM 自拟目标元素框架】',
    '后端没有找到可用 targetSpec。本次不调用 Step 2/3 的后端目标元素分析。',
    `目标说明：${target.label || target.description || focus.description || '由语义路由模型按问题自行限定观察范围'}`,
    `置信度：${route.confidence || 'low'}`,
    `证据策略：${evidencePolicy || '只能引用基础命局、十神/宫位的一般象义与问题边界，不得伪装成后端规则结论。'}`
  ];
  if (observationScope.length) {
    lines.push('允许观察的象义范围：');
    observationScope.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }
  lines.push('边界限制：');
  const finalLimitations = limitations.length ? limitations : [
    '该问题没有稳定的后端目标元素映射。',
    '不得输出确定身份、确定事实或概率化结论。',
    '只能给低置信的可替代分析框架。'
  ];
  finalLimitations.forEach((item) => lines.push(`- ${item}`));
  return lines.join('\n');
}

function buildPipelineContextBlock() {
  return `【分析框架说明】
本次分析由三步后端 Pipeline 预计算完成，你只需在这些结构化结论之上进行叙述和解释：
- Step 1（目标元素定位）：根据问题类别和命主性别，从规则库中锁定本次分析的核心十神（如正官、七杀）、宫位（如日支）及辅助神煞，确定观察框架。
- Step 2（原局状态评估）：对命局四柱中目标十神/宫位的强弱、稳定性、刑冲合害进行静态评分，输出命局"底盘"状态。
- Step 3（动态引动评估）：将大运/流年干支与命局目标元素进行生克冲合计算，判断是否能引动目标元素、引动方向（喜/忌）与强度；timing 模式下对候选年份逐年遍历并排序。
以上结论已格式化为自然语言断语包注入本 Prompt。你的任务是：基于这些断语包，用有温度的语言解释命主面临的具体情境，给出有依据的判断和可操作建议。`;
}

function buildGroundingConstraintBlock() {
  return `【数据依据约束】
- 所有干支关系、旺衰、刑冲合害、引动机制的判断，只能来自下方【目标元素】【原局状态】【动态评估】中系统已提供的内容。
- 如果某字段或机制系统未提供，请在 meta.limitations 中说明"资料未提供"，不得自行推导或编造。
- summary.basis.logic 必须输出80-160字判断依据报告，综合 positive_signals 与 negative_signals，并贴合用户问题主题。
- chart_foundation.base_state 必须输出80-160字原局底盘断语，说明先天支撑与限制。
- 每条 evidence、basis.signals、mode_analysis 中的结论，必须对应系统已给出的具体干支、十神或机制标签，不能凭空引用。`;
}

function buildPatternPrompt({ profile, question, route, pipelineResult }) {
  const ctx = extractBaziQuestionContext(profile);
  const stateBlock = formatStateReportForPrompt(pipelineResult.stateReport, {
    includeQuantTags: true,
    maxShishenItems: 4,
    maxGongweiItems: 2
  });
  const secondaryBlock = formatOptionalDynamicBlock(pipelineResult.dynamicReport);

  return `你是子平八字结构分析专家。
重要约束：
- 你不排盘，不重新推导干支关系。
- pattern 分支判断的是先天结构、容量、适配度，不是眼前具体成败。
- 如果 secondary_mode=status，才允许结合当前大运流年说明”现在适不适合推进”。
- 不要输出成功率；summary.score 可以为 null。
- 输出必须是严格 JSON，不要 Markdown。

${buildPipelineContextBlock()}

${buildGroundingConstraintBlock()}

【用户问题】
${String(question || '').trim()}

【语义路由】
branch: bazi
category/subcategory: ${route.category || 'general'} / ${route.subcategory || ''}
analysis_mode: pattern
secondary_mode: ${route.secondary_mode || 'null'}

${formatBasicProfileBlock(ctx)}

【目标元素定位 Step 1】
${formatTargetSpecForPrompt(pipelineResult.targetSpec)}

${stateBlock}
${secondaryBlock}
【推演任务】
请输出 pattern 分支结果：
1. 先判断命局在该领域的先天容量、结构优势与结构风险；
2. 解释 targetSpec.fallback_level 对置信度的影响，非 subcategory 级匹配不得给 high confidence；
3. mode_analysis 使用 pattern 结构，verdict 必须用120-220字整合先天适配、容量、优势与风险；
4. 若 secondary_mode=status，只在 current_status_note 中说明当前大运流年是否适合推进，不要把它写成应期预测；
5. 不要写“必然成功/必然失败”。

${buildUnifiedOutputSchemaBlock('pattern', { secondaryMode: route.secondary_mode })}`;
}

function buildCharacterPrompt({ profile, question, route, pipelineResult }) {
  const ctx = extractBaziQuestionContext(profile);
  const stateBlock = formatStateReportForPrompt(pipelineResult.stateReport, {
    includeQuantTags: true,
    maxShishenItems: 4,
    maxGongweiItems: 3
  });
  const secondaryBlock = formatOptionalDynamicBlock(pipelineResult.dynamicReport);

  return `你是子平八字人物画像分析专家。
重要约束：
- 你不排盘，不重新推导干支关系。
- character 分支只能输出”倾向画像”，不能输出确定事实。
- 画像必须绑定 evidence，说明来自目标十神、宫位、旺衰、位置或关系。
- 如果 secondary_mode=status，才允许追加当前大运流年的状态评估。
- 不要输出成功率；summary.score 可以为 null。
- 输出必须是严格 JSON，不要 Markdown。

${buildPipelineContextBlock()}

${buildGroundingConstraintBlock()}

【用户问题】
${String(question || '').trim()}

【语义路由】
branch: bazi
category/subcategory: ${route.category || 'general'} / ${route.subcategory || ''}
analysis_mode: character
secondary_mode: ${route.secondary_mode || 'null'}

${formatBasicProfileBlock(ctx)}

【目标元素定位 Step 1】
${formatTargetSpecForPrompt(pipelineResult.targetSpec)}

${stateBlock}
${secondaryBlock}
【推演任务】
请输出 character 分支结果：
1. 输出目标人物或目标关系的倾向画像，而不是确定身份或确定经历；
2. mode_analysis 至少包含 character_portrait、relationship_dynamic、confidence_notes；
3. 每个画像点必须给 evidence，且标注 confidence；
4. 如果 secondary_mode=status，在相关画像或 relationship_dynamic 中补充当前阶段状态与变化，但不要扩展成未来应期；
5. 不要写 appearance/career 等与问题无关的具体断语。

${buildUnifiedOutputSchemaBlock('character', { secondaryMode: route.secondary_mode })}`;
}

function buildLlmDerivedTargetPrompt({ profile, question, route }) {
  const ctx = extractBaziQuestionContext(profile);
  return `你是子平八字边界型问题分析专家。
重要约束：
- 后端没有可用 targetSpec，本次不调用后端目标元素分析。
- 你可以提出低置信的观察框架，但必须说明这是 llm_derived，不是规则结论。
- 不得强行把问题套入财官印食伤的固定规则。
- 不得输出确定身份、确定标签、确定事实或成功率。
- 输出必须是严格 JSON，不要 Markdown。

【用户问题】
${String(question || '').trim()}

【语义路由】
branch: bazi
category/subcategory: ${route.category || 'general'} / ${route.subcategory || ''}
analysis_mode: ${route.analysis_mode}
target_resolution: llm_derived

${formatBasicProfileBlock(ctx)}

${formatLlmDerivedTargetForPrompt(route)}

【推演任务】
请输出 ${route.analysis_mode} 分支结果，但重点放在边界说明和可替代分析：
1. 先说明后端没有该问题的稳定目标元素规则，不能作强断；
2. 再按 LLM 自拟框架给低置信的可观察倾向；
3. mode_analysis 中不要补写无关领域断语；
4. meta.target.fallback_level 必须为 llm_derived；
5. meta.limitations 必须明确这是模型自拟观察框架，不是后端规则结论。

${buildUnifiedOutputSchemaBlock(route.analysis_mode, { secondaryMode: route.secondary_mode })}`;
}

function buildStatusPrompt({ profile, question, route, params, pipelineResult }) {
  const ctx = extractBaziQuestionContext(profile);
  const stateBlock = formatStateReportForPrompt(pipelineResult.stateReport, {
    includeQuantTags: true,
    maxShishenItems: 3,
    maxGongweiItems: 2
  });
  const dynamicBlock = formatDynamicReportForPrompt(pipelineResult.dynamicReport, {
    includeStrengthTags: true,
    maxMechanismsPerPillar: 2,
    includeMajorWindowFlag: true
  });

  return `你是子平八字推演专家。
重要约束：
- 你不排盘，不重新推导干支关系。
- 所有干支关系、旺衰、刑冲合害、引动机制，以系统提供的【目标元素】【原局状态】【动态评估】为依据。
- 八字问答不是奇门即时占事；不要把等级或分数写成具体事件成功概率。
- 输出必须是严格 JSON，不要 Markdown。

${buildPipelineContextBlock()}

${buildGroundingConstraintBlock()}

【用户问题】
${String(question || '').trim()}

【语义路由】
branch: bazi
category/subcategory: ${route.category || 'general'} / ${route.subcategory || ''}
analysis_mode: status
assessment_type: current_climate
time_scope: ${route.time_scope?.type || 'current_year'}, ${params.currentLiunian.year || '年份未提供'}

${formatBasicProfileBlock(ctx)}

【目标元素定位 Step 1】
${formatTargetSpecForPrompt(pipelineResult.targetSpec)}

${stateBlock}

【当前大运流年动态评估 Step 3】
${dynamicBlock}

【推演任务】
请判断当前或指定阶段的问题领域气候。
必须区分：
1. 原局底盘是否支持；
2. 当前大运是否建场；
3. 当前流年是否触发；
4. 系统断语中大运/流年的引动质量是否支持强结论（引用"引动有效/无效"、"双重引动/单一引动"等断语，不要回显数值字段）；
5. 当前阶段适合推进到什么程度。
请把当前阶段判断集中写入 dayun_reading、liunian_reading、target_state_reading 三个字段，不要新增机会、压力、趋势、事件类型等字段。
不要输出“成功率”。如不输出分数，summary.score 使用 null。

${buildUnifiedOutputSchemaBlock('status')}`;
}

function buildTimingPrompt({ profile, question, route, params, pipelineResult }) {
  const ctx = extractBaziQuestionContext(profile);
  const stateBlock = formatStateReportForPrompt(pipelineResult.stateReport, {
    includeQuantTags: true,
    maxShishenItems: 3,
    maxGongweiItems: 2
  });

  return `你是子平八字应期推演专家。
重要约束：
- 你不排盘，不重新推导干支关系。
- 候选年份来自系统逐年遍历，不是让你自由猜年份。
- 你只能基于【原局状态】与【候选年份断语包】解释强弱、排序和边界。
- 不要输出成功率；如不需要分数，summary.score 使用 null。
- 输出必须是严格 JSON，不要 Markdown。

${buildPipelineContextBlock()}

${buildGroundingConstraintBlock()}

【用户问题】
${String(question || '').trim()}

【语义路由】
branch: bazi
category/subcategory: ${route.category || 'general'} / ${route.subcategory || ''}
analysis_mode: timing
time_scope: ${pipelineResult.time_scope?.type || route.time_scope?.type || 'unknown'}，${pipelineResult.time_scope?.start_year || '未知'}-${pipelineResult.time_scope?.end_year || '未知'}
scanned_years: ${pipelineResult.scanned_years.join('、') || '无'}
limitations: ${pipelineResult.limitations.join('；') || '无'}

${formatBasicProfileBlock(ctx)}

【目标元素定位 Step 1】
${formatTargetSpecForPrompt(pipelineResult.targetSpec)}

${stateBlock}

【候选年份动态断语包 Step 3】
${formatTimingCandidatesForPrompt(pipelineResult.timingCandidates)}

【推演任务】
请输出 timing 分支结果：
1. 先说明原局是否具备该问题领域的底盘；
2. 再按候选年份解释为什么强、中、弱；
3. trigger_windows 只能来自候选年份断语包，并且由你负责筛选；未选中的候选年份不会展示给用户；
4. best_window、avoid_window 只能引用已筛选窗口或候选年份断语包，不要新增未经扫描的年份；每个窗口的 verdict 和 mechanisms_text 用自然语言叙述，不回显数值字段；
5. 对 estimated/fallback_current 的大运定位要降低置信；
6. 若候选年份为空，降级说明当前资料不足以做长程应期遍历。

${buildUnifiedOutputSchemaBlock('timing')}`;
}

function buildBaziQuestionPrompt({ profile, question, route = {} }) {
  if (!route.analysis_mode && route.branch !== 'bazi') {
    return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };
  }

  const semanticRoute = normalizeBaziSemanticRoute(inferBaziRouteFromQuestion(question, route));
  const extracted = extractBaziAnalysisParams(profile, semanticRoute);
  if (!extracted.ok) return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };

  if (semanticRoute.target_resolution === 'llm_derived') {
    return { prompt: buildLlmDerivedTargetPrompt({
      profile,
      question,
      route: semanticRoute,
      params: extracted.params
    }), pipelineResult: null };
  }

  if (semanticRoute.analysis_mode === 'status') {
    try {
      const pipelineResult = runStatusPipeline(extracted.params, semanticRoute);
      return { prompt: buildStatusPrompt({
        profile,
        question,
        route: semanticRoute,
        params: extracted.params,
        pipelineResult
      }), pipelineResult };
    } catch (_) {
      return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };
    }
  }

  if (semanticRoute.analysis_mode === 'timing') {
    try {
      const pipelineResult = runTimingPipeline(extracted.params, semanticRoute);
      return { prompt: buildTimingPrompt({
        profile,
        question,
        route: semanticRoute,
        params: extracted.params,
        pipelineResult
      }), pipelineResult };
    } catch (_) {
      return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };
    }
  }

  if (semanticRoute.analysis_mode === 'pattern') {
    try {
      const pipelineResult = runStaticPipeline(extracted.params, semanticRoute, {
        includeDynamic: semanticRoute.secondary_mode === 'status'
      });
      return { prompt: buildPatternPrompt({
        profile,
        question,
        route: semanticRoute,
        params: extracted.params,
        pipelineResult
      }), pipelineResult };
    } catch (_) {
      return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };
    }
  }

  if (semanticRoute.analysis_mode === 'character') {
    try {
      const pipelineResult = runStaticPipeline(extracted.params, semanticRoute, {
        includeDynamic: semanticRoute.secondary_mode === 'status'
      });
      return { prompt: buildCharacterPrompt({
        profile,
        question,
        route: semanticRoute,
        params: extracted.params,
        pipelineResult
      }), pipelineResult };
    } catch (_) {
      return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };
    }
  }

  return { prompt: buildLegacyBaziQuestionPrompt({ profile, question, route }), pipelineResult: null };
}

function normalizeBaziQuestionOutput(raw = {}, { question = '', route = {}, pipelineResult = null } = {}) {
  const advice = raw.advice || {};
  const tips = advice.lucky_tips || {};
  const meta = raw.meta || {};
  const foundation = raw.chart_foundation || {};
  const modeAnalysis = raw.mode_analysis || {};

  // Assemble pipeline-computed fields into the result (not from LLM output)
  let assembledModeAnalysis = { ...modeAnalysis };
  let assembledMeta = { ...meta };

  if (pipelineResult && raw.meta?.analysis_mode === 'status' && pipelineResult.dynamicReport) {
    const dr = pipelineResult.dynamicReport;
    const topMechs = getTopMechanisms(dr);
    const topStrength = topMechs[0]?.effective_strength || 0;
    const isMajorWindow = !!(dr.dayun_impact?.activates_target && dr.liunian_impact?.activates_target);
    const isEffective = topMechs.some((m) => m.vigor_check?.is_effective);
    const trigger = dr.target_trigger || {};
    const quality = deriveQuality({
      isMajorWindow,
      isActivated: !!trigger.is_activated,
      topStrength,
      isEffective,
      newStability: trigger.new_stability
    });
    assembledModeAnalysis = {
      ...assembledModeAnalysis,
      _pipeline: {
        quality,
        is_major_window: isMajorWindow,
        dayun_ganzhi: `${dr.dayun_gan || dr.dayun_impact?.ganzhi || ''}`,
        liunian_ganzhi: `${dr.liunian_gan || dr.liunian_impact?.ganzhi || ''}`,
        activation_strength: topStrength,
        trigger_vigor: {
          dayun: dr.dayun_impact?.trigger_vigor ?? 0,
          liunian: dr.liunian_impact?.trigger_vigor ?? 0
        },
        target_trigger: trigger
      }
    };
    // Also inject quality/is_major_window at top level for frontend friendly access
    if (!assembledModeAnalysis.quality) assembledModeAnalysis.quality = quality;
    if (assembledModeAnalysis.is_major_window === undefined) assembledModeAnalysis.is_major_window = isMajorWindow;
  }

  if (pipelineResult && raw.meta?.analysis_mode === 'timing' && pipelineResult.timingCandidates?.length) {
    const llmWindows = modeAnalysis.trigger_windows || [];
    const candidateByYear = new Map(pipelineResult.timingCandidates.map((candidate) => [String(candidate.year), candidate]));
    const unmatchedYears = [];
    const assembledWindows = llmWindows.map((llmWindow) => {
      const candidate = candidateByYear.get(String(llmWindow.year));
      if (!candidate) {
        unmatchedYears.push(llmWindow.year);
        return null;
      }
      return {
        year: candidate.year,
        ganzhi: llmWindow.ganzhi || candidate.ganzhi,
        dayun_ganzhi: llmWindow.dayun_ganzhi || candidate.dayun_ganzhi,
        quality: candidate.quality,
        is_major_window: candidate.is_major_window || false,
        verdict: llmWindow.verdict || '',
        mechanisms_text: llmWindow.mechanisms_text || '',
        supporting_evidence: llmWindow.supporting_evidence || candidate.supporting_evidence || [],
        blocking_evidence: llmWindow.blocking_evidence || candidate.blocking_evidence || [],
        _pipeline: candidate._pipeline || {}
      };
    }).filter(Boolean);
    if (unmatchedYears.length) {
      assembledMeta = {
        ...assembledMeta,
        limitations: [
          ...(Array.isArray(assembledMeta.limitations) ? assembledMeta.limitations : []),
          `LLM 输出了未在后端候选中的年份：${unmatchedYears.filter(Boolean).join('、')}`
        ]
      };
    }
    assembledModeAnalysis = {
      ...assembledModeAnalysis,
      trigger_windows: assembledWindows
    };
    // Ensure scanned_years is populated
    if (!assembledModeAnalysis.scanned_years?.length) {
      assembledModeAnalysis.scanned_years = pipelineResult.scanned_years || [];
    }
  }

  return {
    ...raw,
    meta: assembledMeta,
    mode_analysis: assembledModeAnalysis,
    question,
    branch: 'bazi',
    category: route.category || assembledMeta.category || 'general',
    subcategory: route.subcategory || assembledMeta.subcategory || '',
    route,
    analysis: {
      tensor: raw.dayun_liunian?.current_climate || '',
      yong_shen: Array.isArray(foundation.core_stars) ? foundation.core_stars.join('、') : raw.ming_ju_analysis?.core_shishen || '',
      bazi_insight: foundation.capacity_level || raw.ming_ju_analysis?.capacity || '',
      pattern: assembledModeAnalysis.verdict || foundation.base_state || raw.ming_ju_analysis?.ge_ju || '',
      god_help: Array.isArray(foundation.supports) ? foundation.supports.join('；') : raw.ming_ju_analysis?.shensha_note || '',
      dynamic_timing: assembledModeAnalysis.best_window || raw.dayun_liunian?.turning_point || raw.dayun_liunian?.liuyue_trigger || ''
    },
    advice: {
      ...advice,
      strategy: Array.isArray(advice.strategy) ? advice.strategy : [],
      risk: advice.risk || '',
      lucky_tips: {
        direction: tips.direction || '',
        industry: tips.industry || '',
        timing: tips.timing || '',
        time: tips.timing || '',
        action: advice.leverage || ''
      }
    }
  };
}

function buildAnalysisParamsSnapshot(profile = {}, extractedParams = null) {
  const detail = profile.bazi_detail || {};
  const matrix = detail.matrix || {};
  const params = extractedParams?.params || {};
  return {
    profile_id: profile.id || null,
    birth_date: profile.birth_date || detail.base_info?.solar_birth || null,
    bazi_str: profile.bazi_str || '',
    gender: normalizePipelineGender(profile.gender),
    birthYear: params.birthYear ?? parseBirthYear(profile),
    dayStem: params.dayStem || splitBaziStr(profile.bazi_str || '').day_gz?.charAt(0) || '',
    currentDayun: params.currentDayun || matrix.current_dayun || null,
    currentLiunian: params.currentLiunian || matrix.current_liunian || null,
    hasMatrix: Array.isArray(matrix.pillars) && matrix.pillars.length > 0,
    liunianCount: Array.isArray(matrix.liunian_list) ? matrix.liunian_list.length : 0,
    dayunCount: Array.isArray(matrix.dayun_list) ? matrix.dayun_list.length : 0
  };
}

function buildBaziAuditSnapshot({
  requestId = '',
  userId = null,
  question = '',
  profile = {},
  routeHint = null,
  semanticRouteRaw = null,
  semanticRouteNormalized = null,
  timeScopeResolved = null,
  analysisParams = null,
  pipelineResult = {},
  promptBlocks = [],
  llmOutputRaw = null,
  llmOutputNormalized = null,
  modelName = '',
  latencyMs = null,
  fallbacks = []
} = {}) {
  return {
    request_id: requestId,
    user_id: userId,
    question,
    rule_route_hint: routeHint,
    semantic_route_raw: semanticRouteRaw,
    semantic_route_normalized: semanticRouteNormalized,
    time_scope_resolved: timeScopeResolved,
    analysis_params_snapshot: buildAnalysisParamsSnapshot(profile, analysisParams),
    target_spec: pipelineResult.targetSpec || null,
    state_report: pipelineResult.stateReport || null,
    dynamic_report: pipelineResult.dynamicReport || null,
    timing_candidates: pipelineResult.timingCandidates || null,
    prompt_blocks: promptBlocks,
    llm_output_raw: llmOutputRaw,
    llm_output_normalized: llmOutputNormalized,
    fallbacks,
    model_name: modelName,
    latency_ms: latencyMs,
    created_at: new Date().toISOString()
  };
}

module.exports = {
  buildBaziQuestionPrompt,
  buildBaziAuditSnapshot,
  extractBaziAnalysisParams,
  extractBaziQuestionContext,
  normalizeBaziSemanticRoute,
  resolveConcreteTimeScope,
  resolveCandidateYears,
  resolveDayunForYear,
  deriveQuality,
  rankTimingCandidate,
  normalizeBaziQuestionOutput
};
