import divinationRouter from '../../lib/divinationRouter.js';
import { createClient } from '@supabase/supabase-js';
import fortuneAnnualCore from '../../lib/fortuneAnnualCore.js';
import fortuneWeeklyCore from '../../lib/fortuneWeeklyCore.js';
import fortuneMonthlyCore from '../../lib/fortuneMonthlyCore.js';
import fortuneDailyCore from '../../lib/fortuneDailyCore.js';
import { normalizeDivinationRoute } from '../../lib/divinationCategories.js';
import baziQuestionCore from '../../lib/baziQuestionCore.js';
import contextNotesCore from '../../lib/fortuneContextNotes.js';
import monthlyInterpretationCore from '../../lib/fortuneMonthlyInterpretationCore.js';
import { Solar, Lunar } from 'lunar-javascript';
import C from '../../lib/QimenConstants.js';
import U from '../../lib/QimenUtils.js';
import Calc from '../../lib/QimenCalculations.js';
import { buildFrontendCopyProtocolSection, buildQimenInferenceRulesSection, buildQimenOutputContractSection, buildReportSchemaPromptSection, buildScoreAuditPromptSection, buildSummaryPromptSection } from '../../lib/qimenPromptSections.js';
import { buildFollowupClassifierPrompt, buildFollowupPatchPrompt, normalizeFollowupRoute, buildBaziFollowupPrompt, normalizeBaziFollowupDecision, PATCHABLE_SECTIONS } from '../../lib/wenshiFollowup.js';
import { buildDomainViewPromptSection, buildYongshenPromptSection } from '../../lib/qimenYongshenRules.js';
import { buildTimingPromptSection } from '../../lib/qimenTimingRules.js';
import { buildPolarityPromptSection } from '../../lib/qimenPolarityRules.js';
import { buildQimenEvidence } from '../../lib/qimenPipeline.js';
import { parsePanTime } from '../../lib/panTime.js';
import baziCore from '../../lib/baziCore.js';
import qimenLlmOutput from '../../lib/qimenLlmOutput.js';
import accountQuota from '../../lib/accountQuota.js';
import baziLlmSections from '../../lib/baziLlmSections.js';
import { langfuseTelemetry } from './langfuse.mjs';

const { buildCompleteBaziDetail, buildQualitativeSections, hasCompleteLlmCache, hasLatestEngineCache, hasExistingLlm, CALIBRATION_VERSION, computeEventsHash, hasValidCalibration } = baziCore;
const { normalizeQimenLlmOutput } = qimenLlmOutput;
const { assertDailyProfileActionQuota, assertDailyQimenQuota, isWhitelistedEmail, recordProfileAction } = accountQuota;
const { buildBaziProfileSectionPrompt, buildBaziSummaryFromSections, createBaziSectionStreamParser, parseBaziSectionText } = baziLlmSections;


const { buildBaziSemanticRoutePrompt, buildGeminiRoutePrompt, classifyDivinationQuestion, ruleRouteHint } = divinationRouter;
const { buildAnnualRangePayload } = fortuneAnnualCore;
const { buildFortunePeriodKey: buildWeeklyPeriodKey, buildWeeklyFortunePayload, getSecondsUntilWeeklyExpiry, getWeekRange, getWeeklyExpiry } = fortuneWeeklyCore;
const { buildFortunePeriodKey: buildMonthlyPeriodKey, buildMonthlyFortunePayload, getFlowMonthInfo } = fortuneMonthlyCore;
const { getBeijingDayInfo, buildFortunePeriodKey: buildDailyPeriodKey, buildFortuneContext, buildBaseFortunePayload, buildInterpretationPrompt, parseModelJson, pickInterpretationFields, mergeInterpretation, hasReadyInterpretation } = fortuneDailyCore;
const { buildBaziQuestionPrompt, buildBaziAuditSnapshot, normalizeBaziQuestionOutput, normalizeBaziSemanticRoute, computePanelData, parseCalendarYearScope } = baziQuestionCore;
const { createEmptyMonthlyContext, createEmptyProfileContext, normalizeMonthlyContextPayload, normalizeProfileContextPayload, buildContextVersionSeed } = contextNotesCore;
const { buildMonthlyInterpretationPeriodKey, buildMonthlyInterpretationPrompt, hasReadyMonthlyInterpretation, mergeMonthlyInterpretation, normalizeDimension, pickMonthlyInterpretationFields } = monthlyInterpretationCore;

const LLM_API_URL = 'https://yinli.one/v1/chat/completions';
const BAZI_PROFILE_BASE_FIELDS = 'id, user_id, name, gender, birth_date, bazi_str, bazi_detail, strong_weak, geju, favorable_elements, unfavorable_elements';
const BAZI_PROFILE_QUESTION_SELECT = BAZI_PROFILE_BASE_FIELDS;
const BAZI_PROFILE_PANEL_SELECT = BAZI_PROFILE_BASE_FIELDS;
const BAZI_PROFILE_GENERATE_SELECT = [
  'id',
  'user_id',
  'bazi_summary',
  'bazi_detail',
  'llm_yuanju_core',
  'llm_current_dayun',
  'llm_current_liunian'
].join(', ');
const DEFAULT_ALLOWED_ORIGINS = [
  'https://qimendao.com',
  'https://www.qimendao.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function isAllowedPreviewOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'qimen-1ff.pages.dev' || hostname.endsWith('.qimen-1ff.pages.dev');
  } catch {
    return false;
  }
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseAuditDelta(value) {
  if (typeof value === 'number') return Math.round(clampNumber(value, -20, 20));
  const match = String(value || '').match(/[+-]?\d+/);
  return Math.round(clampNumber(match ? Number(match[0]) : 0, -20, 20));
}

function deriveScoreBasisFromM3(m3Inference, formationAdjustments, finalScore) {
  const positive = [];
  const negative = [];
  const textOf = (...values) => values.find(v => typeof v === 'string' && v.trim()) || '';
  const itemText = item => textOf(
    item?.impact && item?.name ? `${item.name}：${item.impact}` : '',
    item?.impact,
    item?.name,
    item?.text
  );
  const itemsOf = state => (Array.isArray(state?.items) && state.items.length)
    ? state.items
    : (Array.isArray(state?.factors) ? state.factors : []);
  const target = m3Inference?.target_state || m3Inference?.target_yongshen_state;
  const subject = m3Inference?.subject_state || m3Inference?.subject_day_stem_state || m3Inference?.self_state;
  const support = m3Inference?.support_factors || m3Inference?.favorable_factors;
  const constraint = m3Inference?.constraint_factors || m3Inference?.constraints;
  const interaction = m3Inference?.interaction_decision || m3Inference?.interaction_verdict;

  const targetReading = textOf(target?.reading, target?.summary, target?.verdict);
  const subjectReading = textOf(subject?.reading, subject?.summary, subject?.verdict);
  const supportSummary = textOf(support?.summary, support?.primary_support, support?.verdict);
  const constraintSummary = textOf(constraint?.summary, constraint?.primary_risk, constraint?.verdict);
  const interactionDecision = textOf(interaction?.reading, interaction?.decision, interaction?.verdict);
  const interactionReason = textOf(interaction?.reason, interaction?.evidence);

  if (supportSummary) positive.push(supportSummary);
  itemsOf(support).slice(0, 3).forEach(f => {
    const text = itemText(f);
    if (text) positive.push(text);
  });
  if (target?.tone === 'positive' && targetReading) positive.push(targetReading);
  if (interaction?.tone !== 'warning' && interactionDecision) positive.push(interactionDecision);
  if (interaction?.tone !== 'warning' && interactionReason) positive.push(interactionReason);
  if (subject?.tone === 'positive' && subjectReading) positive.push(subjectReading);

  if (constraintSummary) negative.push(constraintSummary);
  itemsOf(constraint).slice(0, 3).forEach(f => {
    const text = itemText(f);
    if (text) negative.push(text);
  });
  if (subject?.tone === 'warning' && subjectReading) negative.push(subjectReading);
  if (target?.tone === 'warning' && targetReading) negative.push(targetReading);

  // Fallback to formations only when M3 yields nothing
  if (!positive.length && !negative.length) {
    (formationAdjustments || []).filter(h => h.layer === 'named_formation').forEach(h => {
      const text = `${h.signal}：${h.reason || ''}`;
      if (String(h.effect).startsWith('+')) positive.push(text);
      else negative.push(text);
    });
  }

  const fallbackLogic = `综合用神状态、主客关系、空亡与应期后，本局落在${finalScore >= 75 ? '偏有利' : finalScore >= 60 ? '中等可观察' : finalScore >= 40 ? '偏谨慎' : '明显谨慎'}区间。`;
  return {
    positive_signals: positive.slice(0, 3),
    negative_signals: negative.slice(0, 3),
    score_logic: interactionDecision || interactionReason || fallbackLogic
  };
}

function sanitizeUserText(value) {
  return String(value || '')
    .replace(/后端初分\s*\d+[^，。；,.]*[，。；,.]?/g, '')
    .replace(/后端[^，。；,.]*?(?:下调|上调|审计|初算|初分|preliminary|backend|audit)[^，。；,.]*[，。；,.]?/gi, '')
    .replace(/(?:LLM|模型)?审计修正\s*[+-]?\d+[^，。；,.]*[，。；,.]?/gi, '')
    .replace(/audit_delta|backend_pre_score|final_score_suggestion|preliminary_score_audit|qimen-score-v\d(?:\.\d+)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSignalList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(sanitizeUserText)
    .filter(Boolean);
}

function buildQimenAuditSnapshot({
  requestId = '',
  recordId = null,
  userId = null,
  question = '',
  ruleRouteHint = null,
  routeRaw = null,
  routeNormalized = null,
  roleAudit = null,
  qimenChartSnapshot = null,
  timingTargetSymbols = null,
  timingInputSnapshot = null,
  timingAnalysisBackend = null,
  timingPromptSection = '',
  yongshenRuleSnapshot = null,
  polarityOverrides = null,
  backendScoreInput = null,
  backendScoreAudit = null,
  backendScoreIntermediate = null,
  promptBlocks = [],
  llmInputSnapshot = null,
  llmPromptText = '',
  llmOutputRaw = null,
  llmOutputNormalized = null,
  timingLlmOutput = null,
  timingFinal = null,
  postprocessAudit = null,
  finalOutput = null,
  modelName = '',
  latencyMs = null,
  fallbacks = []
} = {}) {
  return {
    request_id: requestId,
    record_id: recordId,
    user_id: userId,
    question,
    rule_route_hint: ruleRouteHint,
    route_raw: routeRaw,
    route_normalized: routeNormalized,
    role_audit: roleAudit,
    qimen_chart_snapshot: qimenChartSnapshot,
    timing_target_symbols: timingTargetSymbols,
    timing_input_snapshot: timingInputSnapshot,
    timing_analysis_backend: timingAnalysisBackend,
    timing_prompt_section: timingPromptSection,
    yongshen_rule_snapshot: yongshenRuleSnapshot,
    polarity_overrides: polarityOverrides,
    backend_score_input: backendScoreInput,
    backend_score_audit: backendScoreAudit,
    backend_score_intermediate: backendScoreIntermediate,
    prompt_blocks: promptBlocks,
    llm_input_snapshot: llmInputSnapshot,
    llm_prompt_text: llmPromptText,
    llm_output_raw: llmOutputRaw,
    llm_output_normalized: llmOutputNormalized,
    timing_llm_output: timingLlmOutput,
    timing_final: timingFinal,
    postprocess_audit: postprocessAudit,
    final_output: finalOutput,
    fallbacks,
    model_name: modelName,
    latency_ms: latencyMs,
    created_at: new Date().toISOString()
  };
}

function getAllowedOrigins(env) {
  const configuredOrigins = String(env.FRONTEND_URL || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return [...new Set([...configuredOrigins, ...DEFAULT_ALLOWED_ORIGINS])];
}

function getCorsHeaders(request, env, allowedHeaders = 'Content-Type, Authorization, X-Guest-Id') {
  const requestOrigin = normalizeOrigin(request.headers.get('Origin'));
  const configuredOrigin = normalizeOrigin(env.FRONTEND_URL || '');
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = configuredOrigin === '*'
    ? '*'
    : requestOrigin && (allowedOrigins.includes(requestOrigin) || isAllowedPreviewOrigin(requestOrigin))
      ? requestOrigin
      : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': allowedHeaders,
    'Vary': 'Origin',
  };
}

function json(payload, init = {}, request, env) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');

  if (request && env) {
    for (const [key, value] of Object.entries(getCorsHeaders(request, env))) {
      headers.set(key, value);
    }
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

// Creates an SSE streaming response. Returns { emit, close, response }.
// Call emit({type, ...}) to push events, close() when done.
function createSSEResponse(request, env) {
  const corsHeaders = getCorsHeaders(request, env, 'Content-Type, Authorization, X-Guest-Id');
  let controller = null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(c) { controller = c; },
    cancel() { controller = null; },
  });
  function emit(event) {
    if (!controller) return;
    try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch {}
  }
  function close() {
    if (!controller) return;
    try { controller.close(); } catch {}
    controller = null;
  }
  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return { emit, close, response: new Response(stream, { status: 200, headers }) };
}

const QIMEN_CATEGORY_LABELS = {
  career_business: '事业运势', finance_wealth: '财运分析',
  relationship: '感情婚恋', health_action: '健康行动', general: '综合运势',
};
const QIMEN_SCORE_LABEL = s => s >= 70 ? '中上吉' : s >= 50 ? '中平' : '偏凶';

async function readJson(request) {
  if (!request.body) return {};
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) return {};
  return request.json();
}

async function classifyByGeminiFlashWithEnv(question, ruleResult, env, ctx, traceMeta = {}) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = buildGeminiRoutePrompt(question, ruleResult);
  const model = 'gemini-3-flash-preview';
  const langfuse = beginLangfuseGeneration({
    name: traceMeta.name || 'divination-route-l1', model, input: prompt, temperature: 0.1, traceMeta,
  }, env, ctx);
  try {
  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Divination router LLM request failed: HTTP ${response.status}`);
  }

  const apiData = await response.json();
  const content = apiData.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
  langfuse.end({ output: content, usage: toLangfuseUsage(apiData.usage) });
  return parsed;
  } catch (error) {
    langfuse.fail(error);
    throw error;
  }
}

async function classifyBaziSemanticRouteWithEnv(question, routeHint, env, ctx, traceMeta = {}) {
  const prompt = buildBaziSemanticRoutePrompt(question, routeHint);
  return requestLLM(prompt, env, 'gemini-3-flash-preview', 0.1, ctx, { name: 'divination-route-l2-bazi', ...traceMeta });
}

async function handleDivinationRoute(request, env, ctx) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  }

  const body = await readJson(request);
  const question = String(body.question || '').trim();
  if (!question) {
    return json({ error: '问题不能为空' }, { status: 400 }, request, env);
  }

  const route = await classifyDivinationQuestion({
    question,
    llmFallback: true,
    llmClassifier: (text, ruleResult) => classifyByGeminiFlashWithEnv(text, ruleResult, env, ctx, { name: 'divination-route-l1', scenario: 'divination-route' }),
  });

  // CP2：用户显式指定了起局时刻 → 视为「为此刻起一卦」的具体事件意图，不落 bazi/clarify。
  if (body.hasPanTime) {
    if (route.branch === 'bazi') {
      // 命局类问句钳为 hybrid：在所选时刻起奇门盘 + 保留命局背景，避免时间被静默丢弃。
      route.branch = 'hybrid';
      route.needsBaziProfile = true;
      route.canFallbackToQimenOnly = true;
      route.clampedByPanTime = true;
      route.reason = `${route.reason || ''}（含指定起局时刻，钳为综合推演，在所选时刻起盘）`;
    } else if (route.branch === 'clarify') {
      // 既已指定具体时刻，宽泛问句也按具体事件直接起盘，不再追问长期/具体。
      route.branch = 'qimen';
      route.needsBaziProfile = false;
      route.canFallbackToQimenOnly = false;
      route.followupQuestion = '';
      route.clampedByPanTime = true;
      route.reason = `${route.reason || ''}（含指定起局时刻，按具体事件直接起盘，跳过追问）`;
    }
  }

  return json(route, { status: 200 }, request, env);
}

function createSupabaseClient(env, userToken) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials are not configured');
  }
  if (userToken) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

async function getAuthedUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    const err = new Error('未登录，请先登录');
    err.status = 401;
    throw err;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createSupabaseClient(env);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    const err = new Error('登录状态已过期，请重新登录');
    err.status = 401;
    throw err;
  }

  return user;
}

function getRequestedProfileId(url, body) {
  return body?.profile_id || url.searchParams.get('profile_id') || '';
}

function getTargetYear(url, body) {
  return parseInt(body?.target_year || url.searchParams.get('target_year') || new Date().getFullYear(), 10);
}

function getTargetDate(url, body) {
  return body?.target_date || url.searchParams.get('target_date');
}

function getTargetMonth(url, body) {
  return body?.target_month || url.searchParams.get('target_month') || body?.target_date || url.searchParams.get('target_date');
}

async function getProfileForFortune(userId, profileId, env, requireSummary = false) {
  const supabase = createSupabaseClient(env);
  const scoreFields = 'id, name, gender, birth_date, bazi_str, bazi_detail, favorable_elements, unfavorable_elements, day_zhi, year_zhi, month_zhi, ri_zhu';
  const selectFields = requireSummary ? `${scoreFields}, bazi_summary` : scoreFields;
  let query = supabase
    .from('bazi_profiles')
    .select(selectFields)
    .eq('user_id', userId);

  if (profileId) {
    query = query.eq('id', profileId);
  } else {
    query = query.order('is_default', { ascending: false }).order('created_at', { ascending: false }).limit(1);
  }

  const { data: profile, error } = await query.single();

  if (error || !profile) {
    const err = new Error('未找到八字档案，请先创建命主档案');
    err.status = 404;
    throw err;
  }
  
  if (requireSummary && !profile.bazi_summary) {
    const err = new Error('八字断语尚未生成，请先完成八字排盘');
    err.status = 400;
    throw err;
  }

  return profile;
}

async function getCachedFortune(userId, dimension, periodKey, env) {
  const supabase = createSupabaseClient(env);
  const { data } = await supabase
    .from('fortune_cache')
    .select('data_json')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('period_key', periodKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  return data?.data_json || null;
}

async function upsertFortuneCache(userId, dimension, periodKey, dataJson, expiresAt, env) {
  const supabase = createSupabaseClient(env);
  const { error } = await supabase
    .from('fortune_cache')
    .upsert({
      user_id: userId,
      dimension,
      period_key: periodKey,
      data_json: dataJson,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, {
      onConflict: 'user_id, dimension, period_key',
    });

  if (error) {
    console.warn(`[qimen-api] ⚠️ ${dimension} cache write failed:`, error.message);
  }
}

async function enforceQuota(user, env) {
  const whitelist = (env.WHITELIST_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase());
  const currentUserEmail = user.email ? user.email.toLowerCase() : '';

  if (whitelist.includes(currentUserEmail)) {
    return;
  }

  const supabase = createSupabaseClient(env);
  const { count, error } = await supabase
    .from('fortune_cache')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!error && count >= 3) {
    const err = new Error('您的 3 次免费天机推演额度已用尽');
    err.status = 403;
    throw err;
  }
}

function redactForTrace(text, { maxLen = 20000 } = {}) {
  if (typeof text !== 'string') return text;
  return text.length > maxLen ? `${text.slice(0, maxLen)}…[截断:${text.length}字符]` : text;
}

// Langfuse v4 observations-first instrumentation. A root observation owns the
// overall I/O and a nested generation owns model/usage data. The SDK exporter is
// fail-open and flushed through ctx.waitUntil() for the Worker lifecycle.
function toLangfuseUsage(usage) {
  if (!usage) return undefined;
  const input = usage.prompt_tokens ?? usage.input_tokens;
  const output = usage.completion_tokens ?? usage.output_tokens;
  const total = usage.total_tokens ?? (input != null && output != null ? input + output : undefined);
  if (input == null && output == null && total == null) return undefined;
  return { input, output, total, unit: 'TOKENS' };
}

function beginLangfuseGeneration({ name, model, input, temperature, traceMeta = {} }, env, ctx) {
  const {
    name: traceMetaName,
    userId,
    sessionId,
    tags,
    version,
    traceInputOverride,
    ...metadata
  } = traceMeta;
  const handle = langfuseTelemetry.startGeneration({
    name: name || traceMetaName,
    model,
    input: redactForTrace(traceInputOverride ?? input),
    userId,
    sessionId,
    tags,
    version,
    metadata,
    modelParameters: Number.isFinite(temperature) ? { temperature } : undefined,
  }, env, ctx);
  return {
    end({ output, usage } = {}) {
      return handle.end({ output: redactForTrace(output), usage });
    },
    fail(error) {
      return handle.end({ error });
    },
  };
}

async function requestLLM(prompt, env, model = 'gemini-3.1-pro-preview', temperature = 0.5, ctx, traceMeta = {}) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const langfuse = beginLangfuseGeneration({
    name: traceMeta.name || 'requestLLM', model, input: prompt, temperature, traceMeta,
  }, env, ctx);
  try {
  const response = await fetch('https://yinli.one/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error('上游大模型接口故障');
    err.status = 502;
    err.details = `HTTP ${response.status}: ${errText.substring(0, 120)}`;
    throw err;
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

  const rawContent = data.choices?.[0]?.message?.content || '{}';
  const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  langfuse.end({ output: rawContent, usage: toLangfuseUsage(data.usage) });
  return parsed;
  } catch (error) {
    langfuse.fail(error);
    throw error;
  }
}

// Non-streaming plain-text fallback — used for empty-stream retry.
// Returns the full response text (no JSON format constraint, stream: false).
async function requestLLMText(prompt, env, model = 'gemini-3.1-pro-preview', temperature = 0.65, ctx, traceMeta = {}) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  const langfuse = beginLangfuseGeneration({
    name: traceMeta.name || 'requestLLMText', model, input: prompt, temperature, traceMeta,
  }, env, ctx);
  try {
  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      stream: false,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error('上游大模型接口故障（重试）');
    err.status = 502;
    err.details = `HTTP ${response.status}: ${errText.substring(0, 120)}`;
    throw err;
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const content = data.choices?.[0]?.message?.content || '';
  langfuse.end({ output: content, usage: toLangfuseUsage(data.usage) });
  return content;
  } catch (error) {
    langfuse.fail(error);
    throw error;
  }
}

// Streams plain text chunks from the LLM (no JSON format constraint).
// Yields raw text deltas for SSE forwarding.
async function* requestLLMSimpleStream(prompt, env, model = 'gemini-3.1-pro-preview', temperature = 0.65, ctx, traceMeta = {}) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  const langfuse = beginLangfuseGeneration({
    name: traceMeta.name || 'requestLLMSimpleStream', model, input: prompt, temperature, traceMeta,
  }, env, ctx);
  let fullOutput = '';

  try {
  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error('上游大模型接口故障');
    err.status = 502;
    err.details = `HTTP ${response.status}: ${errText.substring(0, 120)}`;
    throw err;
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (!response.body || !contentType.includes('text/event-stream')) {
    // Fallback: non-streaming response
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const content = data.choices?.[0]?.message?.content || '';
    if (content) yield content;
    langfuse.end({ output: content, usage: toLangfuseUsage(data.usage) });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamUsage;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const lines = part.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let event;
        try { event = JSON.parse(payload); } catch { continue; }
        if (event.usage) streamUsage = event.usage;
        const delta = event.choices?.[0]?.delta?.content
          ?? event.choices?.[0]?.message?.content
          ?? '';
        if (delta) {
          fullOutput += delta;
          yield delta;
        }
      }
    }
  }
  langfuse.end({ output: fullOutput, usage: toLangfuseUsage(streamUsage) });
  } catch (error) {
    langfuse.fail(error);
    throw error;
  }
}

// Replaces the JSON schema block in a bazi-question prompt with a plain-text output instruction.
// ── 八字哨兵分段：按 mode 定义“散文段(流式可见)”与 data_json 尾段(结构/数组)。
//    字段名/字数/语义严格对齐 lib/baziQuestionCore.js 的 buildReadingsSchema，不回推不编造。
// 公共散文段（所有 mode 共有）：summary_conclusion / summary_basis / action_guide
// ── 八字哨兵（模块化，对齐奇门）：每个文本字段一个散文模块(流式) + 一个 data_json 模块(结构字段)。
//    保留 main 的 JSON Schema 原文作为字段定义（零回推）；末尾仅追加“拆分输出”指令。
// ── 八字哨兵（模块化，对齐奇门）：每个文本字段一个散文模块(流式) + 一个 data_json 模块(结构字段)。
//    保留 main 的 JSON Schema 原文作为字段定义（零回推）；末尾仅追加“拆分输出”指令。
const BAZI_TEXT_FIELDS = {
  status:         [["title","summary.title"],["summary_conclusion","summary.conclusion"],["summary_basis","summary.basis"],["base_foundation","readings.base_foundation.text"],["dayun_field","readings.dayun_field.text"],["liunian_trigger","readings.liunian_trigger.text"],["action_guide","action_guide.text"]],
  timing:         [["title","summary.title"],["summary_conclusion","summary.conclusion"],["summary_basis","summary.basis"],["base_foundation","readings.base_foundation.text"],["action_guide","action_guide.text"]],
  pattern:        [["title","summary.title"],["summary_conclusion","summary.conclusion"],["summary_basis","summary.basis"],["base_foundation","readings.base_foundation.text"],["structural_verdict","readings.structural_verdict"],["action_guide","action_guide.text"]],
  character:      [["title","summary.title"],["summary_conclusion","summary.conclusion"],["summary_basis","summary.basis"],["appearance_tendency","readings.appearance_tendency.text"],["personality_tendency","readings.personality_tendency.text"],["career_style","readings.career_style.text"],["relationship_dynamic","readings.relationship_dynamic"],["action_guide","action_guide.text"]],
  profile_driven: [["title","summary.title"],["summary_conclusion","summary.conclusion"],["summary_basis","summary.basis"],["base_foundation","readings.base_foundation.text"],["dayun_field","readings.dayun_field.text"],["liunian_trigger","readings.liunian_trigger.text"],["action_guide","action_guide.text"]],
};
const baziTextFields = (mode) => BAZI_TEXT_FIELDS[mode] || BAZI_TEXT_FIELDS.status;
const baziVisibleSections = (mode) => new Set(baziTextFields(mode).map(([k]) => k));

function convertPromptToTextMode(prompt, mode = "status") {
  const fields = baziTextFields(mode);
  const proseBlocks = fields.map(([k, path]) => {
    const desc = k === 'title'
      ? `（取自上面 Schema 的 ${path}：6-14字标题，点明问题类型与核心结论；不加标点结尾，不写字段名）`
      : `（取自上面 Schema 的 ${path}：严格遵守该字段的字数与语义；面向用户，可 **加粗**，不写字段名、不写 JSON）`;
    return "<<<SEC:" + k + ">>>\n" + desc + "\n<<<END:" + k + ">>>";
  }).join("\n\n");
  const WRAP = "\n\n**【最终输出格式（覆盖前文“严格返回统一 envelope / 直接输出 JSON”的方式要求；字段名、字数、语义仍严格遵守上面的“输出 JSON Schema”）】**\n" +
    "不要直接输出完整 JSON。改为按下列哨兵分段输出。\n\n" +
    "【标记纪律（必须严格遵守，否则前端无法解析）】\n" +
    "- 标记逐字书写，含尖括号与冒号，形如 <<<SEC:summary_conclusion>>> 与 <<<END:summary_conclusion>>>。\n" +
    "- 每段开始标记 <<<SEC:key>>> 与结束标记 <<<END:key>>> 的 key 必须完全相同，绝不能开一个 key 用另一个 key 收尾。\n" +
    "- 标记独占一行、内部不加空格或变体；标记之外、各段之间不写任何多余文字。\n\n" +
    "【散文段样式纪律（直接面向用户、逐字流式显示，内容取自上面 Schema 对应字段）】\n" +
    "- 只允许 **加粗** 这一种 markdown：成对、不嵌套、不跨行，加粗内不含 *；每段最多加粗 1-2 处关键词，不要满屏加粗。\n" +
    "- 禁止其它任何 markdown 或符号：不写 #、- 、* 、1. 等列表/标题符号，不写 > 引用、` 反引号、[]() 链接、表格、字段名、JSON。\n\n" +
    proseBlocks + "\n\n" +
    "最后输出一个 data_json 段，放入上面 Schema 中【除上述散文段之外的所有字段】（meta、key_signals、readings 的结构/数组字段如 signals/target_state/phenomena/trigger_windows/structural_supports/path_readings 等、rhythm、action_guide.items）；summary 的 title/conclusion/basis 已在散文段输出，不要在 data_json 里重复。字段名与上面 Schema 完全一致。\n" +
    "**格式硬约束**：标记之间只放一个合法 JSON 对象——第一个非空字符必须是 {，最后一个非空字符必须是 }；禁止用 ``` 代码围栏包裹，禁止写 json 前缀，禁止在 JSON 前后写任何说明文字。\n" +
    "<<<SEC:data_json>>>\n{ ...上面 Schema 中除散文段外的全部字段... }\n<<<END:data_json>>>\n\n" +
    "严格要求：只输出上述各段，散文段不得为空。";
  return prompt + WRAP;
}

// 散文段 + data_json 重组成完整 envelope（字段定义来自 main Schema）→ normalizeBaziQuestionOutput。
function reconstructBaziLlmJson(sections, mode = "status") {
  let dj = {};
  try { dj = parseSentinelDataJson(sections.data_json); } catch (e) { dj = {}; }
  const out = (dj && typeof dj === "object") ? dj : {};
  if (!out.meta) out.meta = { analysis_mode: mode, branch: "bazi" };
  if (!out.summary) out.summary = {};
  if (!Array.isArray(out.key_signals)) out.key_signals = [];
  if (!out.readings) out.readings = {};
  if (!out.rhythm) out.rhythm = { segments: [] };
  if (!out.action_guide) out.action_guide = {};
  const setPath = (obj, path, val) => {
    const parts = path.split(".");
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof o[parts[i]] !== "object" || o[parts[i]] === null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = val;
  };
  for (const [k, path] of baziTextFields(mode)) {
    if (sections[k] !== undefined && sections[k] !== "") setPath(out, path, sections[k]);
  }
  if (mode === "character" && out.readings && !out.readings.do_not_overclaim) {
    out.readings.do_not_overclaim = "以上为十神五行和宫位状态呈现的人物倾向，不等于现实中对方一定如此。";
  }
  return out;
}

// Replaces the qimen JSON output contract block with a plain-text output instruction.
function convertQimenPromptToTextMode(prompt) {
  // 哨兵分段混合格式：7 个面向用户的散文段（流式可见）+ 1 个 JSON 尾段（承载结构/审计字段）。
  // 字段含义、字数、语义约束仍严格遵守前文 qimen_report 各模块说明，本段只改变承载格式。
  const SENTINEL_INSTRUCTION = `**【最终输出格式（本段覆盖前文所有关于 JSON / 输出字段契约的“格式”要求；字段含义、字数与语义约束仍严格遵守前文 qimen_report 各模块说明）】**

请严格按以下顺序输出 9 个段落，每段用哨兵标记原样包裹。

**【标记纪律（必须严格遵守，否则前端无法解析）】**
- 标记逐字书写，含尖括号与冒号，形如 <<<SEC:conclusion>>> 与 <<<END:conclusion>>>。
- 每段的开始标记 <<<SEC:key>>> 与结束标记 <<<END:key>>> 的 key 必须完全相同；绝不能开一个 key 而用另一个 key 收尾（如开 <<<SEC:target_reading>>> 却写 <<<END:subject_reading>>>）。
- 标记本身独占一行，标记内不要加空格、换行或任何变体；标记之外、各段之间不要写任何多余文字。

**【散文段样式纪律（前 8 段，直接面向用户）】**
- 只允许 **加粗** 这一种 markdown：必须成对、不嵌套、不跨行，加粗内不含 *；每段最多加粗 1-2 处关键词，不要满屏加粗。
- 禁止使用其它任何 markdown 或符号：不要写 #、- 、* 、1. 等列表/标题符号，不要写 > 引用、\` 反引号、[]() 链接、表格、字段名。
- 用自然成段的中文叙述，需要分行时直接换行即可，不要用符号模拟排版。

<<<SEC:conclusion>>>
（m1_conclusion.conclusion：35-80字总判，开门见山回答用户问题）
<<<END:conclusion>>>

<<<SEC:subject_reading>>>
（m3_inference.subject_state.reading：80-140字，日干落宫的门星神、旺衰/空亡/马星如何影响求测人行动状态）
<<<END:subject_reading>>>

<<<SEC:target_reading>>>
（m3_inference.target_state.reading：80-140字，领域核心用神落宫、临何门，旺衰与空亡如何影响目标事态）
<<<END:target_reading>>>

<<<SEC:environment_reading>>>
（m3_inference.environment_state.reading：90-150字，值使门、值符宫位、宏观资源或流程管道的现实含义）
<<<END:environment_reading>>>

<<<SEC:support_summary>>>
（m3_inference.support_factors.summary：45-90字，有利因素综述，把主要依据融合进结论，讲人话）
<<<END:support_summary>>>

<<<SEC:constraint_summary>>>
（m3_inference.constraint_factors.summary：45-90字，不利因素综述，不恐吓、不写”必败”）
<<<END:constraint_summary>>>

<<<SEC:decision_reading>>>
（m3_inference.interaction_decision.reading：80-140字，引用主客 subject↔target 生克，给方向性判断与现实动作边界）
<<<END:decision_reading>>>

<<<SEC:title>>>
（m1_conclusion.title：8-14字，点明问题类型与核心判断；不写字段名，不加标点结尾）
<<<END:title>>>

<<<SEC:data_json>>>
本段用 JSON 承载结构化字段，便于后端解析；它不会作为流式散文逐字显示，但其中所有文本字段（verdict、evidence、impact、do、avoid、reason、actions 等）都会渲染进用户最终看到的卡片，必须按前文字数与文案质量要求认真书写，不得敷衍或留空占位。
**格式硬约束**：标记之间只放一个合法 JSON 对象——第一个非空字符必须是 {，最后一个非空字符必须是 }；禁止用 \`\`\` 代码围栏包裹，禁止写 json 前缀，禁止在 JSON 前后写任何说明文字。必须包含以下结构（字段约束同前文）：
{
  "m1_conclusion": { "keyword": "4-12字核心判断词", "actions": ["3条，45-95字，动词开头，可落地，至少1条融合后端应期/时间检索；若无明确窗口说明先观察哪些触发条件", "第2条", "第3条"] },
  "m2_basis": { "yongshen_cards": [ { "key": "subject|target|environment 或后端 axis key", "label": "卡片标题", "symbol": "如 日干 戊", "tone": "positive|mixed|warning", "verdict": "一句话状态", "evidence": "引用实际落宫/门/星/神/空亡/马星/有名格" } ] },
  "m3_inference": {
    "subject_state": { "symbol": "如 日干 辛", "palace": "如 震3宫", "tone": "positive|mixed|warning" },
    "target_state": { "symbol": "", "palace": "", "tone": "" },
    "environment_state": { "symbol": "如 值使门", "palace": "", "tone": "" },
    "support_factors": { "tone": "positive", "items": [ { "name": "要素名", "impact": "45-90字影响说明" } ] },
    "constraint_factors": { "tone": "warning", "items": [ { "name": "要素名", "impact": "45-90字影响说明" } ] },
    "interaction_decision": { "subject_symbol": "如 日干", "target_symbol": "如 时干", "tone": "positive|mixed|warning" }
  },
  "m4_guidance": {
    "environment_fengshui": { "suitable_direction": "宜用方位/坐向", "do": "环境布置或沟通场景", "avoid": "应避开的方位/环境", "reason": "盘面依据" },
    "timing_behavior": { "window": "只用后端应期候选，或写“暂无明确窗口”", "wait_until": "可选触发条件", "do": "该窗口内动作", "avoid": "时机上的避坑", "reason": "为何是观察/启动窗口，不保证必然落地" }
  },
  "score_review": { "audit_delta": 0, "confidence": "low|medium|high", "role_review": "审计 role 是否合理", "layer_reviews": "逐层说明是否需修正", "audit_delta_breakdown": "audit_delta 落在哪些层", "missed_or_overweighted_factors": ["后端漏判/误判/过重/过轻的因素"], "audit_reason": "用自然语言说明修正原因" },
  "intent_audit": { "route_confidence": "high|medium|low", "is_route_acceptable": true, "is_role_acceptable": true, "suggested_category": "", "suggested_subcategory": "", "suggested_role": "", "reason": "" },
  "timing_review": { "summary": "评价后端应期候选是否可用", "usable_candidates": [], "limitations": [] }
}
其中 score_review.audit_delta 必须写整数 0；模型复核只提供文字意见，不改动后端确定性工程指标。
<<<END:data_json>>>

严格要求：只输出上述 9 段，不要在哨兵标记之外写任何文字。`;

  // 替换 JSON 输出契约段，但保留契约段之后的“问题：…”尾部（原实现会误删它）。
  const contractAnchor = '**【输出字段契约】**';
  const idx = prompt.indexOf(contractAnchor);
  if (idx === -1) return prompt + '\n\n' + SENTINEL_INSTRUCTION;
  const qIdx = prompt.indexOf('问题：', idx);
  const trailing = qIdx !== -1 ? prompt.slice(qIdx) : '';
  return prompt.slice(0, idx) + SENTINEL_INSTRUCTION + (trailing ? '\n\n' + trailing : '');
}

// Incremental parser for <<<SEC:key>>> ... <<<END:key>>> sentinel sections.
// Calls onVisibleDelta(text) only for sections whose key is in visibleKeys (for SSE streaming);
// non-visible sections (e.g. data_json) are accumulated silently. finish() returns a {key: text} map.
function createSentinelStreamParser(visibleKeys = new Set(), { onVisibleDelta } = {}) {
  let buffer = '';
  let current = null; // current section key
  const sections = {};

  const emit = (key, text) => {
    if (!text) return;
    sections[key] = (sections[key] || '') + text;
    if (visibleKeys.has(key)) onVisibleDelta?.(key, text);
  };

  const MARKER_RE = /<<<(SEC|END):([a-z_]+)>>>/;

  // t 是否可能是“尚未到齐的标记”的前缀：要么是 <<<SEC:/<<<END: 这截引导词的前缀
  // （含 <、<<、<<<、<<<S…），要么引导词已全、只差 key 或收尾 >>>（最多 >>）。
  const isMarkerPrefix = (t) =>
    '<<<SEC:'.startsWith(t) || '<<<END:'.startsWith(t) ||
    /^<<<(SEC|END):[a-z_]*>{0,2}$/.test(t);

  // 末尾若是半截标记必须留在 buffer 等下一个 chunk 补全，否则标记会被拆成碎片当正文
  // emit（如 …<、<<END、:supp、>> 跨 chunk 分片）。返回应保留的尾部长度。
  const holdBackTail = () => {
    for (let i = buffer.indexOf('<'); i !== -1; i = buffer.indexOf('<', i + 1)) {
      if (isMarkerPrefix(buffer.slice(i))) return buffer.length - i;
    }
    return 0;
  };

  // 对标记边界鲁棒：任何 <<<END:*>>> 都闭合当前段（不要求 label 同名），任何
  // <<<SEC:key>>> 都隐式闭合上一段并开新段。这样模型错配 label
  // （如 <<<SEC:target_reading>>>…<<<END:subject_reading>>>）或漏写 END 都能自愈，
  // 且任何标记本身绝不会被当作正文 emit 出去（避免标记泄漏到前端卡片）。
  const processBuffer = () => {
    while (buffer) {
      const m = buffer.match(MARKER_RE);
      if (!m) {
        const keep = holdBackTail();
        const cut = buffer.length - keep;
        if (current && cut > 0) emit(current, buffer.slice(0, cut));
        buffer = buffer.slice(cut);
        return;
      }
      // 标记之前的内容归属当前打开的段；段间空白（current 为空时）直接丢弃。
      const before = buffer.slice(0, m.index);
      if (current && before) emit(current, before);
      buffer = buffer.slice(m.index + m[0].length);
      current = m[1] === 'SEC' ? m[2] : null;
    }
  };

  return {
    push(chunk = '') {
      buffer += String(chunk);
      processBuffer();
    },
    finish() {
      if (current && buffer) { emit(current, buffer); buffer = ''; }
      // trim each section
      for (const k of Object.keys(sections)) sections[k] = sections[k].trim();
      return sections;
    },
  };
}


// 宽松解析哨兵 data_json 段：Gemini 常无视"不要 markdown 代码块"把 JSON 包进 ```json 围栏，
// 或在 JSON 前后掺杂零碎说明文字。先剥围栏，再退而抽取最外层 {...}，最后才 JSON.parse。
// 解析失败抛错（交给调用方按 bad structure 处理）；调用方需要兜底时自行 try/catch。
function parseSentinelDataJson(raw) {
  if (!raw || !String(raw).trim()) throw new Error('empty data_json');
  let s = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(s);
  } catch (_) {
    // 抽取最外层大括号区间，容忍前后多余文字
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw _;
  }
}

// 结构性硬失败判定：核心段缺失 / 大面积段缺失 / data_json 不可解析 → 触发一次非流式重试。
// 个别可选字段缺失不算硬失败（走静默兜底），避免 LLM 合理省略某段时误触发重试。
function qimenSectionsAreBad(sec) {
  const proseKeys = ['conclusion', 'subject_reading', 'target_reading', 'environment_reading',
    'support_summary', 'constraint_summary', 'decision_reading'];
  if (!sec || !sec.conclusion || !sec.conclusion.trim()) return true;
  const missing = proseKeys.filter(k => !sec[k] || !sec[k].trim()).length;
  if (missing >= 3) return true;
  if (!sec.data_json || !sec.data_json.trim()) return true;
  try { parseSentinelDataJson(sec.data_json); } catch { return true; }
  return false;
}

function baziSectionsAreBad(sec, mode) {
  const keys = baziTextFields(mode).map(([k]) => k);
  if (!sec || !sec.summary_conclusion || !sec.summary_conclusion.trim()) return true;
  const missing = keys.filter(k => !sec[k] || !sec[k].trim()).length;
  if (missing >= 3) return true;
  if (!sec.data_json || !sec.data_json.trim()) return true;
  try { parseSentinelDataJson(sec.data_json); } catch { return true; }
  return false;
}

async function requestLLMStreamSections(prompt, env, handlers = {}, model = 'gemini-3.1-pro-preview', temperature = 0.65, ctx, traceMeta = {}) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  const langfuse = beginLangfuseGeneration({
    name: traceMeta.name || 'requestLLMStreamSections', model, input: prompt, temperature, traceMeta,
  }, env, ctx);

  try {
  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error('上游大模型接口故障');
    err.status = 502;
    err.details = `HTTP ${response.status}: ${errText.substring(0, 120)}`;
    throw err;
  }

  const parser = createBaziSectionStreamParser(handlers);
  const contentType = response.headers.get('Content-Type') || '';
  if (!response.body || !contentType.includes('text/event-stream')) {
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseBaziSectionText(content.replace(/```(?:text|json)?/g, '').replace(/```/g, '').trim());
    for (const [section, text] of Object.entries(parsed.sections)) {
      handlers.onSectionStart?.(section);
      handlers.onDelta?.(section, text);
      handlers.onSectionDone?.(section, text);
    }
    langfuse.end({ output: JSON.stringify(parsed.sections), usage: toLangfuseUsage(data.usage) });
    return parsed.sections;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamUsage;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const lines = part.split('\n').map(line => line.trim()).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let event;
        try { event = JSON.parse(payload); } catch { continue; }
        if (event.usage) streamUsage = event.usage;
        const delta = event.choices?.[0]?.delta?.content
          ?? event.choices?.[0]?.message?.content
          ?? '';
        if (delta) parser.push(delta);
      }
    }
  }

  const finishedSections = parser.finish().sections;
  langfuse.end({ output: JSON.stringify(finishedSections), usage: toLangfuseUsage(streamUsage) });
  return finishedSections;
  } catch (error) {
    langfuse.fail(error);
    throw error;
  }
}

async function assertProfileOwnership(userId, profileId, env) {
  const supabase = createSupabaseClient(env);
  const { data, error } = await supabase.from('bazi_profiles').select('id').eq('id', profileId).eq('user_id', userId).single();
  if (error || !data) { const err = new Error('未找到命主档案'); err.status = 404; throw err; }
}

async function getProfileContext(profileId, env) {
  const supabase = createSupabaseClient(env);
  const { data, error } = await supabase.from('profile_contexts').select('profile_id, career_profile, wealth_profile, love_profile, health_profile, updated_at').eq('profile_id', profileId).single();
  if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error;
  return normalizeProfileContextPayload(data || createEmptyProfileContext());
}

async function upsertProfileContext(profileId, payload, env) {
  const normalized = normalizeProfileContextPayload(payload);
  const supabase = createSupabaseClient(env);
  const { error } = await supabase.from('profile_contexts').upsert({
    profile_id: profileId, ...normalized, updated_at: new Date().toISOString()
  }, { onConflict: 'profile_id' });
  if (error && error.code === '42P01') { const err = new Error('断事笔记数据表尚未初始化'); err.status = 503; throw err; }
  if (error) throw error;
  return getProfileContext(profileId, env);
}

async function getMonthlyContext(profileId, monthKey, env) {
  const supabase = createSupabaseClient(env);
  const { data, error } = await supabase.from('monthly_context_logs').select('profile_id, month_key, carry_from_previous, overall_note, career_monthly, wealth_monthly, love_monthly, health_monthly, updated_at').eq('profile_id', profileId).eq('month_key', monthKey).single();
  if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error;
  const record = normalizeMonthlyContextPayload(data || createEmptyMonthlyContext(monthKey), monthKey);
  
  const { data: recentData, error: recentError } = await supabase.from('monthly_context_logs').select('month_key, carry_from_previous, overall_note, career_monthly, wealth_monthly, love_monthly, health_monthly, updated_at').eq('profile_id', profileId).lte('month_key', monthKey).order('month_key', { ascending: false }).limit(3);
  if (recentError && recentError.code === '42P01') return { record, recent_records: [] };
  if (recentError) throw recentError;
  return { record, recent_records: Array.isArray(recentData) ? recentData.map(item => normalizeMonthlyContextPayload(item || {}, item?.month_key || '')) : [] };
}

async function upsertMonthlyContext(profileId, monthKey, payload, env) {
  const normalized = normalizeMonthlyContextPayload(payload, monthKey);
  const supabase = createSupabaseClient(env);
  const { error } = await supabase.from('monthly_context_logs').upsert({
    profile_id: profileId, ...normalized, updated_at: new Date().toISOString()
  }, { onConflict: 'profile_id,month_key' });
  if (error && error.code === '42P01') { const err = new Error('断事笔记数据表尚未初始化'); err.status = 503; throw err; }
  if (error) throw error;
  return getMonthlyContext(profileId, monthKey, env);
}

async function handleFortuneAnnual(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  }

  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') {
    body = await readJson(request);
  }

  try {
    const user = await getAuthedUser(request, env);
    const targetYear = getTargetYear(url, body);
    const requestedProfileId = getRequestedProfileId(url, body);

    const profile = await getProfileForFortune(user.id, requestedProfileId, env);
    const annualRangeJson = buildAnnualRangePayload(profile, targetYear, 10);

    const response = json(annualRangeJson, { status: 200 }, request, env);
    response.headers.set('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return response;
  } catch (error) {
    console.error('[qimen-api] fortune-annual error:', error);
    const status = error.status || 500;
    return json({
      error: '云端年运推演失败',
      details: error.message,
    }, { status }, request, env);
  }
}

async function handleFortuneWeekly(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  }

  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') body = await readJson(request);

  try {
    const user = await getAuthedUser(request, env);
    const targetDate = getTargetDate(url, body);
    const { week_start, week_end } = getWeekRange(targetDate);
    const requestedProfileId = getRequestedProfileId(url, body);
    const periodKey = buildWeeklyPeriodKey(week_start, requestedProfileId);
    const secondsUntilEnd = getSecondsUntilWeeklyExpiry(week_end);
    
    const cached = await getCachedFortune(user.id, 'week', periodKey, env);
    if (cached?.weekly_score && cached?.week_start === week_start) {
      const response = json(cached, { status: 200 }, request, env);
      response.headers.set('Cache-Control', `s-maxage=${secondsUntilEnd}, stale-while-revalidate`);
      return response;
    }

    const profile = await getProfileForFortune(user.id, requestedProfileId, env);
    const weeklyJson = buildWeeklyFortunePayload(profile, week_start);
    await upsertFortuneCache(user.id, 'week', periodKey, weeklyJson, getWeeklyExpiry(week_end), env);

    const response = json(weeklyJson, { status: 200 }, request, env);
    response.headers.set('Cache-Control', `s-maxage=${secondsUntilEnd}, stale-while-revalidate`);
    return response;
  } catch (error) {
    console.error('[qimen-api] fortune-weekly error:', error);
    return json({ error: '云端周运推演失败', details: error.message }, { status: error.status || 500 }, request, env);
  }
}

async function handleFortuneMonthly(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  }

  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') body = await readJson(request);

  try {
    const user = await getAuthedUser(request, env);
    const targetMonth = getTargetMonth(url, body);
    const flowMonth = getFlowMonthInfo(targetMonth);
    const requestedProfileId = getRequestedProfileId(url, body);
    const periodKey = buildMonthlyPeriodKey(flowMonth.period_key, requestedProfileId);
    
    const cached = await getCachedFortune(user.id, 'month', periodKey, env);
    if (cached?.monthly_score) {
      const response = json(cached, { status: 200 }, request, env);
      response.headers.set('Cache-Control', `s-maxage=${flowMonth.secondsUntilEnd}, stale-while-revalidate`);
      return response;
    }

    const profile = await getProfileForFortune(user.id, requestedProfileId, env);
    const monthlyJson = buildMonthlyFortunePayload(profile, flowMonth);
    await upsertFortuneCache(user.id, 'month', periodKey, monthlyJson, flowMonth.expiresAt, env);

    const response = json(monthlyJson, { status: 200 }, request, env);
    response.headers.set('Cache-Control', `s-maxage=${flowMonth.secondsUntilEnd}, stale-while-revalidate`);
    return response;
  } catch (error) {
    console.error('[qimen-api] fortune-monthly error:', error);
    return json({ error: '云端月运推演失败', details: error.message }, { status: error.status || 500 }, request, env);
  }
}

async function handleFortuneDaily(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  }

  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') body = await readJson(request);

  try {
    const user = await getAuthedUser(request, env);
    const targetDate = getTargetDate(url, body);
    const { bjTime, todayKey, secondsUntilMidnight, expiresAt } = getBeijingDayInfo(targetDate);
    const requestedProfileId = getRequestedProfileId(url, body);
    const periodKey = buildDailyPeriodKey(todayKey, requestedProfileId);
    
    const cached = await getCachedFortune(user.id, 'day', periodKey, env);
    if (cached?.core_shen_today && Array.isArray(cached.lucky_hour_zhis) && cached.wealth_officer_state) {
      const response = json(cached, { status: 200 }, request, env);
      response.headers.set('Cache-Control', `s-maxage=${secondsUntilMidnight}, stale-while-revalidate`);
      return response;
    }

    if (!cached) await enforceQuota(user, env);

    const profile = await getProfileForFortune(user.id, requestedProfileId, env, true);
    const context = buildFortuneContext(profile, bjTime, todayKey);
    const baseJson = buildBaseFortunePayload(context);
    
    await upsertFortuneCache(user.id, 'day', periodKey, baseJson, expiresAt, env);

    const response = json(baseJson, { status: 200 }, request, env);
    response.headers.set('Cache-Control', `s-maxage=${secondsUntilMidnight}, stale-while-revalidate`);
    return response;
  } catch (error) {
    console.error('[qimen-api] fortune-daily error:', error);
    const isQuota = error.message.includes('额度');
    return json({ error: isQuota ? error.message : '云端日运推演失败', details: error.message }, { status: error.status || (isQuota ? 403 : 500) }, request, env);
  }
}

async function handleContextNotes(request, env) {
  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') body = await readJson(request);
  
  try {
    const user = await getAuthedUser(request, env);
    const profileId = body?.profile_id || url.searchParams.get('profile_id') || '';
    if (!profileId) return json({ error: '缺少 profile_id' }, { status: 400 }, request, env);
    await assertProfileOwnership(user.id, profileId, env);

    const scope = String(body?.scope || url.searchParams.get('scope') || 'profile').trim().toLowerCase();
    if (scope !== 'profile' && scope !== 'monthly') return json({ error: '不支持的断事笔记范围' }, { status: 400 }, request, env);

    if (request.method === 'GET') {
      if (scope === 'profile') return json({ scope, data: await getProfileContext(profileId, env) }, { status: 200 }, request, env);
      const monthKey = String(body?.month_key || url.searchParams.get('month_key') || '').trim();
      if (!monthKey) return json({ error: '缺少 month_key' }, { status: 400 }, request, env);
      return json({ scope, ...(await getMonthlyContext(profileId, monthKey, env)) }, { status: 200 }, request, env);
    }
    
    if (request.method === 'POST') {
      if (scope === 'profile') return json({ scope, data: await upsertProfileContext(profileId, body?.data || {}, env) }, { status: 200 }, request, env);
      const monthKey = String(body?.month_key || url.searchParams.get('month_key') || '').trim();
      if (!monthKey) return json({ error: '缺少 month_key' }, { status: 400 }, request, env);
      return json({ scope, ...(await upsertMonthlyContext(profileId, monthKey, body?.data || {}, env)) }, { status: 200 }, request, env);
    }
    
    return json({ error: 'Method Not Allowed' }, { status: 405 }, request, env);
  } catch (error) {
    console.error('[qimen-api] context-notes error:', error);
    return json({ error: '断事笔记处理失败', details: error.message }, { status: error.status || 500 }, request, env);
  }
}

async function handleBaziQuestion(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  const startedAt = Date.now();

  // ── Pre-stream: auth + basic validation (may return JSON errors) ──
  let user;
  try {
    user = await getAuthedUser(request, env);
  } catch (authErr) {
    return json({ error: '认证失败', details: authErr.message }, { status: authErr.status || 401 }, request, env);
  }

  const userToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  const body = await readJson(request);
  const question = String(body.question || '').trim();
  const profileId = String(body.profileId || '').trim();
  if (!question) return json({ error: '问题不能为空' }, { status: 400 }, request, env);
  if (!profileId) return json({ error: '缺少八字档案 ID' }, { status: 400 }, request, env);

  // Profile fetch (pre-stream so we can return JSON errors for missing/invalid profiles)
  const supabase = createSupabaseClient(env, userToken);
  const { data: profile, error: profileErr } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_QUESTION_SELECT).eq('id', profileId).single();
  if (profileErr || !profile) return json({ error: '档案不存在' }, { status: 404 }, request, env);
  if (profile.user_id !== user.id) return json({ error: '无权操作该档案' }, { status: 403 }, request, env);
  if (!profile.bazi_detail || !profile.bazi_str) return json({ error: '该档案缺少完整八字排盘数据，请先在八字页完成命盘推演', code: 'BAZI_PROFILE_INCOMPLETE' }, { status: 400 }, request, env);

  // ── Start SSE stream ──
  const { emit, close, response: sseResponse } = createSSEResponse(request, env);

  (async () => {
  try {
    const requestRoute = body.route || {};
    const baseRoute = normalizeDivinationRoute({ branch: 'bazi', category: 'general', ...requestRoute });

    // ── SSE Step 0: 解析问题意图 (routing was done by client) ──
    const _cat0 = QIMEN_CATEGORY_LABELS[baseRoute.category] || '综合运势';
    emit({ type: 'step', index: 0, pct: 10, chip: { main: _cat0, sub: '八字命理' } });

    // ── SSE Step 1: 调取命盘完成 ──
    const dayMaster = profile.bazi_detail?.day_master || profile.bazi_str?.split(' ')?.[2]?.[0] || '日主';
    const strengthLabel = profile.bazi_detail?.strength_label || '';
    emit({ type: 'step', index: 1, pct: 22, chip: { main: `日主${dayMaster}`, sub: strengthLabel || '命盘就绪' } });

    const cheapRouteHint = ruleRouteHint(question, { forceBranch: baseRoute.branch === 'hybrid' ? 'hybrid' : 'bazi' });
    const routeHint = {
      ...cheapRouteHint,
      branch: baseRoute.branch,
      category: baseRoute.category || cheapRouteHint.category,
      subcategory: baseRoute.subcategory ?? cheapRouteHint.subcategory,
      branch_hint: baseRoute.branch,
      category_hint: baseRoute.category || cheapRouteHint.category,
      subcategory_hint: baseRoute.subcategory ?? cheapRouteHint.subcategory,
      analysis_mode_hint: requestRoute.analysis_mode || requestRoute.analysis_mode_hint || cheapRouteHint.analysis_mode_hint,
      secondary_mode_hint: requestRoute.secondary_mode ?? requestRoute.secondary_mode_hint ?? cheapRouteHint.secondary_mode_hint,
      needs_time_scan_hint: requestRoute.needs_time_scan ?? requestRoute.needs_time_scan_hint ?? cheapRouteHint.needs_time_scan_hint,
      time_scope_hint: requestRoute.time_scope || requestRoute.time_scope_hint || cheapRouteHint.time_scope_hint,
      target_resolution: requestRoute.target_resolution || cheapRouteHint.target_resolution,
      llm_derived_target: requestRoute.llm_derived_target || cheapRouteHint.llm_derived_target,
    };

    let semanticRouteRaw = null;
    const semanticFallbacks = [];
    try {
      semanticRouteRaw = requestRoute.analysis_mode
        ? { ...requestRoute, source: requestRoute.source || 'client' }
        : await classifyBaziSemanticRouteWithEnv(question, routeHint, env, ctx, { name: 'bazi-semantic-route', scenario: 'bazi-question', userId: user.id });
    } catch (routeError) {
      semanticRouteRaw = {
        ...routeHint,
        source: 'rule_hint_fallback',
        reason: routeHint.reason || `八字语义路由失败：${routeError.message}`,
      };
      semanticFallbacks.push(`bazi_semantic_route_fallback:${routeError.message}`);
    }
    const semanticRoute = normalizeBaziSemanticRoute({ ...baseRoute, ...semanticRouteRaw }, routeHint);

    // 日历年区间兜底：语义路由 LLM 常把"22-28年"识别为 specified_range 却漏抽 start/end_year，
    // 这里按问题文本确定性回填，避免下游塌缩成"未来十年"丢掉历史年份（审计快照与 SSE chip 同步受益）。
    const _calYearScope = parseCalendarYearScope(question);
    if (_calYearScope) {
      const _ts = semanticRoute.time_scope || {};
      const _hasYears = Number.isFinite(Number(_ts.start_year)) && Number.isFinite(Number(_ts.end_year));
      if (!_hasYears) {
        semanticRoute.time_scope = { ..._ts, ..._calYearScope };
        semanticRoute.analysis_mode = 'timing';
        semanticRoute.needs_time_scan = true;
      }
    }

    // ── SSE Step 2: 语义路由完成 ──
    const _BAZI_MODE_CN = { timing: '时间推演', pattern: '格局分析', character: '性格命理', status: '当下状态' };
    const _modeLabel = _BAZI_MODE_CN[semanticRoute.analysis_mode] || '分析模式';
    const _modeSub   = _BAZI_MODE_CN[semanticRoute.analysis_mode] ? (semanticRoute.branch === 'hybrid' ? '综合推演' : '八字命理') : '命理分析';
    emit({ type: 'step', index: 2, pct: 36, chip: { main: _modeLabel, sub: _modeSub } });

    const { prompt, pipelineResult } = buildBaziQuestionPrompt({ profile, question, route: semanticRoute });

    // ── SSE Step 3: 构建推演框架完成 ──
    const _SCOPE_CN = { current_year: '今年', next_3_years: '近三年', next_5_years: '近五年', next_10_years: '未来十年', unknown: '命局综合' };
    const _scopeType = semanticRoute.time_scope?.type || 'unknown';
    const _scopeYears = semanticRoute.time_scope?.start_year && semanticRoute.time_scope?.end_year
      ? `${semanticRoute.time_scope.start_year}–${semanticRoute.time_scope.end_year}`
      : null;
    const _scopeMain = _SCOPE_CN[_scopeType] || '命局综合';
    emit({ type: 'step', index: 3, pct: 48, chip: { main: _scopeMain, sub: _scopeYears || '命局推演' } });

    // ── SSE Step 4: 五行喜忌 (instant — derived from pipelineResult) ──
    const _favorable = pipelineResult?.favorable_elements?.join('') || pipelineResult?.favorable || '';
    emit({ type: 'step', index: 4, pct: 62, chip: _favorable ? { main: `喜${_favorable}`, sub: '忌神已标记' } : null });

    // ── Engine complete: emit pre-LLM structured data for immediate frontend display ──
    const subject_snapshot = {
      name: profile.name || null,
      birth_date: profile.birth_date || profile.bazi_detail?.base_info?.solar_birth || null,
      gender: profile.gender || null,
      strong_weak: profile.strong_weak || null,
      geju: profile.geju || null,
      profile_id: profile.id || null,
      pillars: profile.bazi_detail?.matrix?.pillars || null,
    };
    const five_shens = profile.bazi_detail?.five_shens || null;

    // 喜用神五行（首个）→ 前端能量球定格色
    const _favEl = (Array.isArray(pipelineResult?.favorable_elements) && pipelineResult.favorable_elements[0])
      || (Array.isArray(profile.favorable_elements) && profile.favorable_elements[0])
      || '';

    emit({
      type: 'engine_complete',
      pct: 70,
      engineOutput: {
        branch: 'bazi',
        analysis_mode: semanticRoute.analysis_mode || 'status',
        category: semanticRoute.category || '',
        subcategory: semanticRoute.subcategory || '',
        favorable_element: _favEl,
        question,
        tags: [
          { label: _cat0 },
          { label: `日主${dayMaster}` },
          ...(_favorable ? [{ label: `喜${_favorable}` }] : []),
          { label: _modeLabel },
        ],
        stateReport:      pipelineResult?.stateReport      ?? null,
        dynamicReport:    pipelineResult?.dynamicReport    ?? null,
        targetSpec:       pipelineResult?.targetSpec       ?? null,
        timingCandidates: pipelineResult?.timingCandidates ?? [],
        subject_snapshot,
        five_shens,
      }
    });

    // ── SSE Step 5: AI 推演开始（哨兵分段流式文字输出） ──
    emit({ type: 'active', index: 5, pct: 75 });

    const _baziMode = semanticRoute.analysis_mode || 'status';
    const textPrompt = convertPromptToTextMode(prompt, _baziMode);
    // 问事模型：preview 环境由 QUESTION_MODEL 覆盖为 flash，production 默认 pro
    const questionModel = env.QUESTION_MODEL || 'gemini-3.1-pro-preview';
    let llmFullText = '';
    const baziParser = createSentinelStreamParser(baziVisibleSections(_baziMode), {
      onVisibleDelta: (section, text) => emit({ type: 'llm_delta', section, text })
    });
    const _baziTraceMeta = { name: 'bazi-question-answer', scenario: 'bazi-question', category: semanticRoute.category, analysisMode: _baziMode, tags: ['bazi', `mode:${_baziMode}`], userId: user.id };
    for await (const chunk of requestLLMSimpleStream(textPrompt, env, questionModel, 0.65, ctx, _baziTraceMeta)) {
      llmFullText += chunk;
      baziParser.push(chunk);
    }
    // 结构校验：空流 / 核心段缺失 / data_json 不可解析 → 打回让 LLM 重试一次（非流式）
    let baziSec = baziParser.finish();
    if (baziSectionsAreBad(baziSec, _baziMode)) {
      console.warn('[bazi-question] bad structure, retrying non-streaming...', { mode: _baziMode, len: llmFullText.length });
      // 通知前端清空已显示的半截内容，重置回骨架
      emit({ type: 'llm_retry', message: 'AI 重新推演中…' });
      try {
        llmFullText = await requestLLMText(textPrompt, env, questionModel, 0.65, ctx, { ..._baziTraceMeta, name: 'bazi-question-answer-retry' });
      } catch (retryErr) {
        console.error('[bazi-question] retry also failed:', retryErr.message);
        emit({ type: 'error', message: 'AI 推演暂时不可用，请稍后重试' });
        return;
      }
      const retryBaziParser = createSentinelStreamParser(baziVisibleSections(_baziMode), {});
      retryBaziParser.push(llmFullText);
      baziSec = retryBaziParser.finish();
      if (baziSectionsAreBad(baziSec, _baziMode)) {
        emit({ type: 'error', message: 'AI 推演暂时不可用，请稍后重试' });
        return;
      }
      for (const [k] of baziTextFields(_baziMode)) {
        if (baziSec[k]) emit({ type: 'llm_delta', section: k, text: baziSec[k] });
      }
    }
    let _djOk = false;
    try { _djOk = !!Object.keys(parseSentinelDataJson(baziSec.data_json)).length; } catch (e) { _djOk = false; }
    const _secLens = Object.fromEntries(Object.keys(baziSec).map(k => [k, (baziSec[k] || '').length]));
    console.log(`[bazi-sse] mode=${_baziMode} dataJsonOk=${_djOk} secLens=${JSON.stringify(_secLens)}`);
    // 流式可读文本 = 各散文段顺序拼接
    const visibleProse = baziTextFields(_baziMode).map(([k]) => baziSec[k]).filter(Boolean).join('\n\n');
    emit({ type: 'llm_done', pct: 95, text: visibleProse });

    // 散文段 + data_json 重组成完整 envelope → 跑原 normalizeBaziQuestionOutput（字段 100% 对齐 main）
    const reconstructedBaziJson = reconstructBaziLlmJson(baziSec, _baziMode);
    const output = normalizeBaziQuestionOutput(reconstructedBaziJson, { question, route: semanticRoute, pipelineResult });

    const auditSnapshot = buildBaziAuditSnapshot({
      requestId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: user.id,
      question,
      profile,
      routeHint,
      semanticRouteRaw,
      semanticRouteNormalized: semanticRoute,
      timeScopeResolved: semanticRoute.time_scope || null,
      promptBlocks: [
        'buildBaziQuestionPrompt',
        output.meta?.analysis_mode ? `analysis_mode:${output.meta.analysis_mode}` : `analysis_mode:${semanticRoute.analysis_mode || 'legacy'}`,
        semanticRoute.confidence === 'low' ? 'mode:profile_driven' : '',
        semanticRoute.secondary_mode ? `secondary_mode:${semanticRoute.secondary_mode}` : '',
        semanticRoute.target_resolution ? `target_resolution:${semanticRoute.target_resolution}` : '',
      ].filter(Boolean),
      llmPromptText: textPrompt,
      llmOutputRaw: { text: llmFullText, mode: 'sentinel_stream', reconstructed: reconstructedBaziJson },
      llmOutputNormalized: output,
      pipelineResult,
      modelName: questionModel,
      latencyMs: Date.now() - startedAt,
      fallbacks: semanticFallbacks,
      llmLimitations: [],
    });

    try {
      const auditSupabase = createSupabaseClient(env);
      const { error: auditError } = await auditSupabase.from('bazi_question_audit').insert(auditSnapshot);
      if (auditError) console.warn('[qimen-api] bazi audit insert failed:', auditError.message || auditError);
    } catch (auditErr) {
      console.warn('[qimen-api] bazi audit insert failed:', auditErr.message || auditErr);
    }

    const outputWithSnapshot = {
      ...output,
      llmText: llmFullText,
      favorable_element: _favEl,
      subject_snapshot,
      five_shens,
      ...(pipelineResult ? {
        state_report: pipelineResult.stateReport || null,
        target_spec: pipelineResult.targetSpec || null,
        dynamic_report: pipelineResult.dynamicReport || null,
        timing_candidates: pipelineResult.timingCandidates || null,
      } : {})
    };
    emit({ type: 'complete', result: outputWithSnapshot });
  } catch (error) {
    console.error('[qimen-api] bazi-question error:', error);
    emit({ type: 'error', message: error.message || '八字问答生成失败' });
  } finally {
    close();
  }
  })(); // end async IIFE

  return sseResponse;
}

async function handleBaziPanel(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  try {
    const user = await getAuthedUser(request, env);
    const userToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const { profileId, category, subcategory, analysis_mode } = await readJson(request);
    if (!profileId) return json({ error: '缺少 profileId' }, { status: 400 }, request, env);

    const supabase = createSupabaseClient(env, userToken);
    const { data: profile, error } = await supabase
      .from('bazi_profiles')
      .select(BAZI_PROFILE_PANEL_SELECT)
      .eq('id', profileId)
      .eq('user_id', user.id)
      .single();
    if (error || !profile) return json({ error: '档案不存在' }, { status: 404 }, request, env);
    if (!profile.bazi_detail?.matrix?.pillars?.length) {
      return json({ error: '档案缺少排盘数据' }, { status: 400 }, request, env);
    }

    const result = computePanelData(profile, { category, subcategory, analysis_mode });
    if (!result) return json({ error: '该模式不支持 panel 计算' }, { status: 422 }, request, env);

    return json({
      ...result,
      _panel_matrix: { pillars: profile.bazi_detail.matrix.pillars }
    }, { status: 200 }, request, env);
  } catch (err) {
    if (err.status === 401) return json({ error: 'Unauthorized' }, { status: 401 }, request, env);
    console.error('[bazi-panel]', err);
    return json({ error: err.message || 'panel 计算失败' }, { status: 500 }, request, env);
  }
}

async function handleBaziCalibrate(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  try {
    const user = await getAuthedUser(request, env);
    const body = await readJson(request);
    const { profileId, prompt } = body;
    if (!profileId || !prompt) return json({ error: '缺少 profileId 或 prompt' }, { status: 400 }, request, env);
    // 该 prompt 在前端拼好（见 src/utils/buildCalibrationPrompt.mjs），内含用户填写的人生大事
    // 自由描述（可能涉及婚姻/疾病/官司等隐私内容），上报 Langfuse 时不传原文，只传统计摘要。
    const _calibrateTraceInput = JSON.stringify({ profileId, promptLength: prompt.length });

    const supabase = createSupabaseClient(env);
    const { data: profile, error: profileError } = await supabase
      .from('bazi_profiles')
      .select('id, user_id, life_events, calibrated_yuanju_core, calibrated_current_dayun, calibrated_current_liunian, calibrated_version')
      .eq('id', profileId)
      .single();
    if (profileError) {
      if (profileError.code === 'PGRST116') return json({ error: '档案不存在' }, { status: 404 }, request, env);
      console.error('[qimen-api] bazi-calibrate profile fetch failed:', profileError);
      return json({ error: '读取档案失败', details: profileError.message }, { status: 500 }, request, env);
    }
    if (!profile) return json({ error: '档案不存在' }, { status: 404 }, request, env);
    if (profile.user_id !== user.id) return json({ error: '无权操作该档案' }, { status: 403 }, request, env);

    if (hasValidCalibration(profile, profile.life_events)) {
      return json({
        yuanju_core: profile.calibrated_yuanju_core,
        current_dayun: profile.calibrated_current_dayun,
        current_liunian: profile.calibrated_current_liunian,
        calibrated_version: profile.calibrated_version,
        cached: true,
      }, { status: 200 }, request, env);
    }

    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.2, ctx, {
      name: 'bazi-calibrate', scenario: 'bazi-calibrate', traceInputOverride: _calibrateTraceInput, userId: user.id,
    });
    if (!llmJson.yuanju_core || !llmJson.current_dayun || !llmJson.current_liunian) {
      return json({ error: 'LLM 返回格式不符预期' }, { status: 500 }, request, env);
    }

    const calibratedVersion = `${CALIBRATION_VERSION}:${computeEventsHash(profile.life_events)}`;
    const { error: dbError } = await supabase.from('bazi_profiles').update({
      calibrated_yuanju_core: llmJson.yuanju_core,
      calibrated_current_dayun: llmJson.current_dayun,
      calibrated_current_liunian: llmJson.current_liunian,
      calibrated_at: new Date().toISOString(),
      calibrated_version: calibratedVersion,
    }).eq('id', profileId);

    if (dbError) throw dbError;

    return json({
      yuanju_core: llmJson.yuanju_core,
      current_dayun: llmJson.current_dayun,
      current_liunian: llmJson.current_liunian,
      calibrated_version: calibratedVersion,
    }, { status: 200 }, request, env);
  } catch (error) {
    console.error('[qimen-api] bazi-calibrate error:', error);
    return json({ error: error.message || '深度校准失败' }, { status: error.status || 500 }, request, env);
  }
}

async function handleFortuneDailyInterpretation(request, env, ctx) {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') body = await readJson(request);

  try {
    const user = await getAuthedUser(request, env);
    const targetDate = getTargetDate(url, body);
    const { bjTime, todayKey, expiresAt } = getBeijingDayInfo(targetDate);
    const requestedProfileId = getRequestedProfileId(url, body);
    const periodKey = buildDailyPeriodKey(todayKey, requestedProfileId);

    const cached = await getCachedFortune(user.id, 'day', periodKey, env);
    if (hasReadyInterpretation(cached)) return json(pickInterpretationFields(cached), { status: 200 }, request, env);

    if (!cached) await enforceQuota(user, env);

    const profile = await getProfileForFortune(user.id, requestedProfileId, env, true);
    const context = buildFortuneContext(profile, bjTime, todayKey);
    const latestBaseJson = buildBaseFortunePayload(context);
    const baseJson = cached ? { ...cached, ...latestBaseJson } : latestBaseJson;
    
    const prompt = buildInterpretationPrompt(context);
    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.5, ctx, { name: 'fortune-daily-interpretation', scenario: 'fortune-daily', userId: user.id });
    const mergedJson = mergeInterpretation(baseJson, llmJson);

    await upsertFortuneCache(user.id, 'day', periodKey, mergedJson, expiresAt, env);
    return json(pickInterpretationFields(mergedJson), { status: 200 }, request, env);
  } catch (error) {
    console.error('[qimen-api] fortune-daily-interpretation error:', error);
    const isQuota = error.message.includes('额度');
    return json({ error: isQuota ? error.message : '云端日运断语生成失败', details: error.message }, { status: error.status || (isQuota ? 403 : 500) }, request, env);
  }
}

async function handleFortuneMonthlyInterpretation(request, env, ctx) {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') body = await readJson(request);

  try {
    const user = await getAuthedUser(request, env);
    const targetMonth = getTargetMonth(url, body);
    const dimension = normalizeDimension(body?.dimension || url.searchParams.get('dimension') || 'overall');
    const flowMonth = getFlowMonthInfo(targetMonth);
    const requestedProfileId = getRequestedProfileId(url, body);
    const profile = await getProfileForFortune(user.id, requestedProfileId, env);
    
    const profileContext = await getProfileContext(profile.id, env);
    const { record: currentMonthlyContext, recent_records: recentMonthlyContexts } = await getMonthlyContext(profile.id, flowMonth.context_month_key, env);
    const contextSeed = buildContextVersionSeed(profileContext, recentMonthlyContexts);
    const periodKey = buildMonthlyInterpretationPeriodKey(flowMonth.period_key, profile.id, dimension, contextSeed);

    const cached = await getCachedFortune(user.id, 'month_interpretation', periodKey, env);
    if (hasReadyMonthlyInterpretation(cached)) return json(pickMonthlyInterpretationFields(cached), { status: 200 }, request, env);

    const baseJson = buildMonthlyFortunePayload(profile, flowMonth);
    const prompt = buildMonthlyInterpretationPrompt(profile, baseJson, dimension, {
      profile_context: profileContext,
      current_monthly_context: currentMonthlyContext,
      recent_monthly_contexts: recentMonthlyContexts,
    });
    
    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.5, ctx, { name: 'fortune-monthly-interpretation', scenario: 'fortune-monthly', dimension, userId: user.id });
    const mergedJson = mergeMonthlyInterpretation(baseJson, llmJson, dimension);

    await upsertFortuneCache(user.id, 'month_interpretation', periodKey, mergedJson, flowMonth.expiresAt, env);
    return json(pickMonthlyInterpretationFields(mergedJson), { status: 200 }, request, env);
  } catch (error) {
    console.error('[qimen-api] fortune-monthly-interpretation error:', error);
    return json({ error: '云端月运断语生成失败', details: error.message }, { status: error.status || 500 }, request, env);
  }
}


// ==========================================
// ⚡️ 云端内存缓存 (基于 时辰 + 问题)
// ==========================================
let qimenMemoryCache = {};
let baziMemoryCache = {};

// ── 追问按需补算：注册表 dispatch（确定性、无 LLM）──
// 返回 { capability: 结果 } 或 null。MVP 骨架：先从回传 evidence 取已有数据；
// 需复现原盘的全量重算（如奇门 yingqi 重新起局、八字流年扫描）在 Phase 2 接入。
async function runFollowupCapability(capability, params, { branch, origin }) {
  if (branch === 'qimen') {
    if (capability === 'yingqi') {
      // TODO(Phase 2): 用 origin.seed 复现原局后跑 qimenScoringEngine.timingCandidates。
      // MVP：若原局已带应期/timing 证据，直接复用（多数问事已扫过应期）。
      const ev = origin.evidence || {};
      return ev.timing || ev.timing_candidates || ev.timing_final || ev.timing_analysis_backend || null;
    }
  }
  // 八字能力（liunian_scan 等）Phase 2 接入对应 lib 计算函数。
  return null;
}

// 追问 audit：service-role 写入 followup_audit（跨 branch，非致命，失败仅告警）。
async function writeFollowupAudit(env, snapshot) {
  try {
    const supabase = createSupabaseClient(env);
    const { error } = await supabase.from('followup_audit').insert(snapshot);
    if (error) console.warn('[followup] audit insert failed:', error.message || error);
  } catch (e) {
    console.warn('[followup] audit insert failed:', e.message || e);
  }
}

async function runFollowupCapabilities(needs, ctx) {
  const out = {};
  for (const { capability, params } of needs) {
    try {
      const r = await runFollowupCapability(capability, params, ctx);
      if (r != null) out[capability] = r;
    } catch (e) {
      console.warn(`[followup] capability ${capability} failed:`, e.message);
    }
  }
  return Object.keys(out).length ? out : null;
}

// POST /api/qimen-followup —— 同一局追问，锚定式增补（不覆盖原报告）。
async function handleQimenFollowup(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);

  // 鉴权：与 handleQimen 一致，允许访客。
  const authHeader = request.headers.get('Authorization');
  const guestId = request.headers.get('x-guest-id');
  let user = null;
  const isGuestRequest = !authHeader && typeof guestId === 'string' && guestId.startsWith('guest_');
  try {
    if (authHeader) user = await getAuthedUser(request, env);
    else if (!isGuestRequest) return json({ error: '未登录，请先登录' }, { status: 401 }, request, env);
  } catch (authErr) {
    return json({ error: '认证失败', details: authErr.message }, { status: authErr.status || 401 }, request, env);
  }

  const body = await readJson(request);
  const followup = String(body.followup || '').trim();
  const branch = body.branch === 'bazi' ? 'bazi' : 'qimen';
  const origin = body.origin && typeof body.origin === 'object' ? body.origin : {};
  if (!followup) return json({ error: '追问不能为空' }, { status: 400 }, request, env);
  if (!origin.evidence) return json({ error: '缺少原局上下文（evidence）' }, { status: 400 }, request, env);

  // audit 公共字段
  const startedAt = Date.now();
  const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userId = user?.id || null;
  const rawRecordId = origin.record_id || origin.recordId || null;
  const recordId = (rawRecordId && rawRecordId !== 'guest_qimen_record') ? rawRecordId : null;

  const { emit, close, response: sseResponse } = createSSEResponse(request, env);

  (async () => {
  try {
    // ── Step A: 判断器（cheap 模型，严格 JSON）──
    emit({ type: 'followup_step', stage: 'classify' });
    const sections = origin.sections || {};
    const classifierPrompt = buildFollowupClassifierPrompt({
      branch,
      followup,
      originQuestion: origin.question || '',
      originConclusion: sections.conclusion || sections.summary_conclusion || '',
    });
    if (env.FOLLOWUP_DEBUG === '1') console.log('[followup][prompt:classifier]\n' + classifierPrompt);
    let routeRaw;
    try {
      routeRaw = await requestLLM(classifierPrompt, env, 'gemini-3-flash-preview', 0.1, ctx, { name: 'qimen-followup-classify', scenario: 'qimen-followup', branch, userId: userId || guestId, sessionId: recordId || requestId });
    } catch (e) {
      console.warn('[followup] classifier failed, defaulting to same_casting:', e.message);
      routeRaw = { scope: 'same_casting' };
    }
    const fr = normalizeFollowupRoute(routeRaw, { branch });
    if (env.FOLLOWUP_DEBUG === '1') console.log('[followup][route]', JSON.stringify(fr));

    // 新事 → 不花大模型，让前端弹"重新起局?"
    if (fr.scope === 'new_matter') {
      emit({ type: 'followup_route', scope: 'new_matter', reason: fr.reason });
      await writeFollowupAudit(env, {
        request_id: requestId, record_id: recordId, user_id: userId, branch,
        origin_question: origin.question || '', followup,
        classifier_model: 'gemini-3-flash-preview', classifier_prompt: classifierPrompt,
        route_raw: routeRaw, route_normalized: fr, scope: fr.scope,
        needs_data: fr.needs_data, nature: fr.nature, target_sections: fr.target_sections,
        evidence_snapshot: origin.evidence || null, origin_sections: sections,
        latency_ms: Date.now() - startedAt,
      });
      return;
    }

    // ── Step A2: 按需补算（注册表 dispatch，确定性无 LLM）──
    let extraEvidence = null;
    if (fr.needs_data.length) {
      emit({ type: 'followup_step', stage: 'compute', capabilities: fr.needs_data.map((n) => n.capability) });
      extraEvidence = await runFollowupCapabilities(fr.needs_data, { branch, origin, env });
    }

    // ── Step B: 增补 patch（与问事同档模型，哨兵分段流式）──
    emit({ type: 'followup_step', stage: 'patch', target_sections: fr.target_sections, nature: fr.nature });
    const patchModel = env.QUESTION_MODEL || 'gemini-3.1-pro-preview';
    const patchPrompt = buildFollowupPatchPrompt({
      branch,
      followup,
      evidence: origin.evidence,
      extraEvidence,
      sections,
      targetSections: fr.target_sections,
      nature: fr.nature,
    });
    if (env.FOLLOWUP_DEBUG === '1') console.log('[followup][prompt:patch]\n' + patchPrompt);

    const visible = new Set(fr.target_sections);
    const parser = createSentinelStreamParser(visible, {
      onVisibleDelta: (section, text) => emit({ type: 'patch_delta', section, text }),
    });
    const _followupTraceMeta = { name: 'qimen-followup-patch', scenario: 'qimen-followup', branch, nature: fr.nature, tags: ['qimen-followup'], userId: userId || guestId, sessionId: recordId || requestId };
    let full = '';
    for await (const chunk of requestLLMSimpleStream(patchPrompt, env, patchModel, 0.6, ctx, _followupTraceMeta)) {
      full += chunk;
      parser.push(chunk);
    }
    let sec = parser.finish();

    // 兜底：目标段全空 → 非流式重试一次
    const hasAny = fr.target_sections.some((k) => sec[k] && sec[k].trim());
    if (!hasAny) {
      console.warn('[followup] empty patch, retrying non-streaming...');
      emit({ type: 'patch_retry' });
      try {
        full = await requestLLMText(patchPrompt, env, patchModel, 0.6, ctx, { ..._followupTraceMeta, name: 'qimen-followup-patch-retry' });
        const retry = createSentinelStreamParser(visible, {});
        retry.push(full);
        sec = retry.finish();
        for (const k of fr.target_sections) if (sec[k]) emit({ type: 'patch_delta', section: k, text: sec[k] });
      } catch (e) {
        emit({ type: 'error', message: '追问生成暂时不可用，请稍后重试' });
        return;
      }
    }

    const supplements = {};
    for (const k of fr.target_sections) if (sec[k] && sec[k].trim()) supplements[k] = sec[k].trim();

    emit({
      type: 'patch_complete',
      supplements,
      nature: fr.nature,
      needs_data: fr.needs_data.map((n) => n.capability),
    });

    await writeFollowupAudit(env, {
      request_id: requestId, record_id: recordId, user_id: userId, branch,
      origin_question: origin.question || '', followup,
      classifier_model: 'gemini-3-flash-preview', classifier_prompt: classifierPrompt,
      route_raw: routeRaw, route_normalized: fr, scope: fr.scope,
      needs_data: fr.needs_data, extra_evidence: extraEvidence,
      patch_model: patchModel, patch_prompt: patchPrompt, patch_output_raw: full,
      supplements, nature: fr.nature, target_sections: fr.target_sections,
      evidence_snapshot: origin.evidence || null, origin_sections: sections,
      latency_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('[qimen-api] followup error:', error);
    emit({ type: 'error', message: error.message || '追问生成失败' });
  } finally {
    close();
  }
  })();

  return sseResponse;
}

// 容错解析决策段 JSON（去 ```fence、截取首尾大括号）。
function parseFollowupDecisionJson(raw) {
  if (!raw || typeof raw !== 'string') return {};
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch { return {}; }
}

// POST /api/bazi-followup —— 八字同一命盘追问（统一单主-LLM 架构）。
// 本步（step 2）落地 answer / new_matter；recompute 暂出 pending 事件（step 4 接补算）。
async function handleBaziFollowup(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);

  // 八字本就强制登录（无访客）。
  let user;
  try {
    user = await getAuthedUser(request, env);
  } catch (authErr) {
    return json({ error: '认证失败', details: authErr.message }, { status: authErr.status || 401 }, request, env);
  }

  const body = await readJson(request);
  const followup = String(body.followup || '').trim();
  const origin = body.origin && typeof body.origin === 'object' ? body.origin : {};
  const profileId = String(origin.profileId || origin.profile_id || '').trim();
  if (!followup) return json({ error: '追问不能为空' }, { status: 400 }, request, env);
  if (!profileId) return json({ error: '缺少八字档案 ID（origin.profileId）' }, { status: 400 }, request, env);

  // ── Pre-stream：fetch 命盘（可返回 JSON 错误）──
  const userToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  const supabase = createSupabaseClient(env, userToken);
  const { data: profile, error: profileErr } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_QUESTION_SELECT).eq('id', profileId).single();
  if (profileErr || !profile) return json({ error: '档案不存在' }, { status: 404 }, request, env);
  if (profile.user_id !== user.id) return json({ error: '无权操作该档案' }, { status: 403 }, request, env);
  if (!profile.bazi_detail || !profile.bazi_str) return json({ error: '该档案缺少完整八字排盘数据', code: 'BAZI_PROFILE_INCOMPLETE' }, { status: 400 }, request, env);

  // audit 公共字段
  const startedAt = Date.now();
  const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const originRoute = origin.route && typeof origin.route === 'object' ? origin.route : { branch: 'bazi', analysis_mode: 'status' };
  const originQuestion = String(origin.question || '').trim();
  const sections = origin.sections && typeof origin.sections === 'object' ? origin.sections : {};
  const followups = Array.isArray(origin.followups) ? origin.followups.slice(-3) : [];

  const { emit, close, response: sseResponse } = createSSEResponse(request, env);

  (async () => {
  try {
    // ── 复现首轮 pipelineResult（同一入口，丢弃 prompt）→ 用首轮同一 format 拼证据块 ──
    emit({ type: 'followup_step', stage: 'evidence' });
    let pipelineResult = null;
    try {
      ({ pipelineResult } = baziQuestionCore.buildBaziQuestionPrompt({ profile, question: originQuestion, route: originRoute }));
    } catch (e) {
      console.warn('[bazi-followup] reproduce pipeline failed:', e.message);
    }
    const evidenceText = baziQuestionCore.buildBaziEvidenceBlock({ profile, pipelineResult });

    // ── 主 LLM 第一跳：决策 prompt（answer / recompute / new_matter）──
    emit({ type: 'followup_step', stage: 'decide' });
    const model = env.QUESTION_MODEL || 'gemini-3.1-pro-preview';
    const prompt = buildBaziFollowupPrompt({
      followup, originQuestion, evidenceText, sections, followups, route: originRoute,
    });
    if (env.FOLLOWUP_DEBUG === '1') console.log('[followup][bazi][prompt]\n' + prompt);

    const patchable = PATCHABLE_SECTIONS.bazi;
    const visible = new Set(['decision', ...patchable]);
    let decisionBuf = '';
    let decision = null;
    let answering = false;
    let streamed = false;
    const parser = createSentinelStreamParser(visible, {
      onVisibleDelta: (section, text) => {
        if (section === 'decision') { decisionBuf += text; return; }
        // 首个非 decision 段到来 → decision 已闭合，解析一次定分支
        if (!decision) {
          decision = normalizeBaziFollowupDecision(parseFollowupDecisionJson(decisionBuf));
          answering = decision.action === 'answer';
        }
        if (answering) { streamed = true; emit({ type: 'patch_delta', section, text }); }
      },
    });

    const _baziFollowupTraceMeta = { name: 'bazi-followup-decide', scenario: 'bazi-followup', analysisMode: originRoute.analysis_mode, tags: ['bazi-followup'], userId: user.id, sessionId: profileId };
    let full = '';
    for await (const chunk of requestLLMSimpleStream(prompt, env, model, 0.6, ctx, _baziFollowupTraceMeta)) {
      full += chunk;
      parser.push(chunk);
    }
    const sec = parser.finish();
    if (!decision) decision = normalizeBaziFollowupDecision(parseFollowupDecisionJson(sec.decision || decisionBuf));
    if (env.FOLLOWUP_DEBUG === '1') console.log('[followup][bazi][decision]', JSON.stringify(decision));

    const auditBase = {
      request_id: requestId, record_id: null, user_id: user.id, branch: 'bazi',
      origin_question: originQuestion, followup,
      patch_model: model, patch_prompt: prompt, patch_output_raw: full,
      route_raw: decision, route_normalized: decision, scope: decision.action,
      nature: decision.nature, target_sections: decision.target_sections,
      evidence_snapshot: { profileId, route: originRoute }, origin_sections: sections,
      latency_ms: Date.now() - startedAt,
    };

    // ── new_matter：提示重新起盘 ──
    if (decision.action === 'new_matter') {
      emit({ type: 'followup_route', scope: 'new_matter', reason: decision.reason });
      await writeFollowupAudit(env, auditBase);
      return;
    }

    // ── recompute：step 4 才接补算；本步出 pending，让前端温和提示 ──
    if (decision.action === 'recompute') {
      emit({ type: 'followup_recompute_pending', route_delta: decision.route_delta, reason: decision.reason });
      await writeFollowupAudit(env, { ...auditBase, needs_data: decision.route_delta });
      return;
    }

    // ── answer ──
    const supplements = {};
    for (const k of decision.target_sections) if (sec[k] && sec[k].trim()) supplements[k] = sec[k].trim();

    // 流式期间未发出任何增补（少见：解析晚于段输出）→ 用 finish 结果补发
    if (!streamed) {
      for (const k of decision.target_sections) if (supplements[k]) emit({ type: 'patch_delta', section: k, text: supplements[k] });
    }
    // 仍为空 → 非流式重试一次
    if (!Object.keys(supplements).length) {
      console.warn('[bazi-followup] empty answer, retrying non-streaming...');
      emit({ type: 'patch_retry' });
      try {
        const retryFull = await requestLLMText(prompt, env, model, 0.6, ctx, { ..._baziFollowupTraceMeta, name: 'bazi-followup-decide-retry' });
        const rp = createSentinelStreamParser(visible, {});
        rp.push(retryFull); const rsec = rp.finish();
        for (const k of patchable) if (rsec[k] && rsec[k].trim()) { supplements[k] = rsec[k].trim(); emit({ type: 'patch_delta', section: k, text: supplements[k] }); }
      } catch (e) {
        emit({ type: 'error', message: '追问生成暂时不可用，请稍后重试' });
        return;
      }
    }

    emit({ type: 'patch_complete', supplements, nature: decision.nature });
    await writeFollowupAudit(env, { ...auditBase, supplements });
  } catch (error) {
    console.error('[bazi-followup] error:', error);
    emit({ type: 'error', message: error.message || '追问生成失败' });
  } finally {
    close();
  }
  })();

  return sseResponse;
}

async function handleQimen(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  const startedAt = Date.now();

  // ── Pre-stream: auth + quota (may return JSON errors before SSE starts) ──
  const authHeader = request.headers.get('Authorization');
  const guestId = request.headers.get('x-guest-id');
  let user = null;
  let userId = null;
  const isGuestRequest = !authHeader && typeof guestId === 'string' && guestId.startsWith('guest_');

  try {
    if (authHeader) {
      user = await getAuthedUser(request, env);
      userId = user.id;
    } else if (!isGuestRequest) {
      return json({ error: '未登录，请先登录' }, { status: 401 }, request, env);
    }
  } catch (authErr) {
    return json({ error: '认证失败', details: authErr.message }, { status: authErr.status || 401 }, request, env);
  }

  // Body must be read before SSE starts (Request.body can only be consumed once)
  const body = await readJson(request);

  // Quota enforcement
  const currentUserEmail = user?.email ? user.email.toLowerCase() : "";
  const isVIP = isWhitelistedEmail(currentUserEmail, env.WHITELIST_EMAILS || '');

  if (isGuestRequest) {
    console.log(`👤 访客账户 [${guestId}] 发起一次推演`);
  } else if (isVIP) {
    console.log(`👑 白名单特权账户 [${currentUserEmail}] 发起推演，免除额度限制`);
  } else {
    try {
      const supabase = createSupabaseClient(env);
      await assertDailyQimenQuota({ supabase, userId });
    } catch (quotaErr) {
      console.warn('[qimen-api] quota check failed:', quotaErr);
      return json({ error: quotaErr.message || '额度检查失败' }, { status: quotaErr.status || 500 }, request, env);
    }
  }

  // ── Start SSE stream ──
  const { emit, close, response: sseResponse } = createSSEResponse(request, env);

  (async () => {
  try {

    const userQuestion = body.question || "当前局势吉凶如何？";

    // 起局时刻：优先用用户指定的固定时刻（北京民用时，不做时区偏移）；
    // 缺省/非法则回退到当前北京时刻，与历史行为逐字一致。
    const panTimeParts = parsePanTime(body.panTime);
    let year, month, day, hour, minute, bjTime;
    if (panTimeParts) {
      ({ year, month, day, hour, minute } = panTimeParts);
      // bjTime 作为「起局时刻」基准（应期扫描等下游引用），用所选时刻构造
      bjTime = new Date(year, month - 1, day, hour, minute, 0);
    } else {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      bjTime = new Date(utc + (3600000 * 8));
      year = bjTime.getFullYear();
      month = bjTime.getMonth() + 1;
      day = bjTime.getDate();
      hour = bjTime.getHours();
      minute = bjTime.getMinutes();
    }

    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();
    const ganzhiHour = lunar.getTimeInGanZhi();
    const ganzhiDay = lunar.getDayInGanZhi();
    
    const baziInfo = body.baziInfo || "未提供八字信息";
    const baziHash = baziInfo === "未提供八字信息" ? "NoBazi" : baziInfo.substring(0, 15);
    const cacheKey = `${year}-${month}-${day}-${ganzhiHour}-${userQuestion}-${baziHash}`;
    
    if (qimenMemoryCache[cacheKey]) {
      console.log("⚡️ 命中云端时辰缓存！直接返回。");
      const cached = qimenMemoryCache[cacheKey];
      const cachedCat = QIMEN_CATEGORY_LABELS[cached.category] || '综合运势';
      const cachedScore = cached.backend_score_audit?.final_score ?? cached.summary?.score ?? 72;
      emit({ type: 'step', index: 0, pct: 10, chip: { main: cachedCat, sub: cached.branch === 'hybrid' ? '综合推演' : '奇门遁甲' } });
      emit({ type: 'step', index: 1, pct: 25, chip: { main: cached.qimen_data?.ju_info?.name || '已起盘', sub: cached.qimen_data?.pillars?.hour || '' } });
      emit({ type: 'step', index: 2, pct: 42, chip: null });
      emit({ type: 'step', index: 3, pct: 58, chip: null });
      emit({ type: 'step', index: 4, pct: 72, chip: { main: `初分 ${cachedScore}`, sub: QIMEN_SCORE_LABEL(cachedScore) } });
      emit({ type: 'step', index: 5, pct: 90, chip: null });
      emit({ type: 'complete', result: cached });
      return;
    }

    // 起盘 + 用神 + 应期 + 评分：统一走 lib/qimenPipeline.buildQimenEvidence（单一真实，
    // 与 skill CLI 共用同一段计算编排；worker 只负责 SSE / LLM / 缓存 / DB，不再自抄编排）。

    // 路由分类（规则优先 + LLM 兜底）先于 pipeline，route 作为 pipeline 的输入。
    const qimenRouteHint = ruleRouteHint(userQuestion, { forceBranch: 'qimen' });
    const routeRaw = body.route
        ? { ...body.route, source: body.route.source || 'client' }
        : await classifyDivinationQuestion({ question: userQuestion, forceBranch: 'qimen', llmFallback: true, llmClassifier: (text, ruleResult) => classifyByGeminiFlashWithEnv(text, ruleResult, env, ctx, { name: 'qimen-route-l1', scenario: 'qimen', userId: userId || guestId }) });
    const detectedIntent = normalizeDivinationRoute(routeRaw);

    const ev = buildQimenEvidence({
        year, month, day, hour, minute,
        panTimeParts,
        baseTime: bjTime,
        question: userQuestion,
        intent: detectedIntent,
        baziInfo
    });
    const {
        qimenData, palacesText, qimen_structure,
        juResult, xunHead, zhiFuStar, zhiShiDoor, dayMa, hourMa, dayKongObj, hourKongObj,
        timestamp_solar, timestamp_lunar,
        yongshenRule, effectiveBaziInfo, hasBaziInfo, timingTargetSymbols,
        timingPalaces, timingInputSnapshot, timingAnalysis, polarityOverrides,
        backendScoreInput, backendScoreAudit, backendFormationTags
    } = ev;

    // ── SSE 进度：pipeline 已一次算完，按 index 顺序回报（chip 内容与旧版逐字一致）──
    const _cat0 = QIMEN_CATEGORY_LABELS[detectedIntent.category] || '综合运势';
    const _sub0 = detectedIntent.branch === 'hybrid' ? '综合推演' : '奇门遁甲';
    emit({ type: 'step', index: 0, pct: 10, chip: { main: _cat0, sub: _sub0 } });
    emit({ type: 'step', index: 1, pct: 25, chip: { main: qimen_structure, sub: ganzhiHour } });
    const _primarySymbol = yongshenRule?.yongshen?.primary?.[0]?.symbol || '用神';
    emit({ type: 'step', index: 2, pct: 42, chip: { main: _primarySymbol, sub: detectedIntent.subcategory || detectedIntent.category || '' } });
    const _windows = timingAnalysis?.p2_scan?.candidates || [];
    const _firstWin = _windows[0];
    const _winSub = _firstWin ? (_firstWin.date || '近日') : '暂无明确窗口';
    emit({ type: 'step', index: 3, pct: 58, chip: { main: `发现 ${_windows.length} 个窗口`, sub: _winSub } });
    emit({ type: 'step', index: 4, pct: 72, chip: { main: `初分 ${backendScoreAudit.final_score}`, sub: QIMEN_SCORE_LABEL(backendScoreAudit.final_score) } });

    // ── Engine complete: emit pre-LLM data for immediate frontend display ──
    emit({
      type: 'engine_complete',
      pct: 74,
      engineOutput: {
        branch: 'qimen',
        question: userQuestion,
        category: detectedIntent.category,
        subcategory: detectedIntent.subcategory,
        pre_score: backendScoreAudit.final_score,
        score_label: QIMEN_SCORE_LABEL(backendScoreAudit.final_score),
        qimen_data: qimenData,
        formation_tags: backendFormationTags,
        timing_window_count: _windows.length,
        tags: [
          { label: _cat0 },
          { label: qimen_structure },
          { label: `初分${backendScoreAudit.final_score} · ${QIMEN_SCORE_LABEL(backendScoreAudit.final_score)}`, isScore: true },
          ...(_windows.length ? [{ label: `${_windows.length}个应期窗口` }] : []),
        ],
      }
    });

    // 排盘校验模式：只出引擎盘面，跳过 LLM（零 API 花费）。供 CP1 固定时间起局核对。
    if (body.engineOnly === true) {
      const _chartLog = {
        panTime: panTimeParts ? `${year}-${month}-${day} ${hour}:${minute}` : `now(${year}-${month}-${day} ${hour}:${minute})`,
        pillars: qimenData.pillars,
        ju_info: qimenData.ju_info,
        auxiliary: qimenData.auxiliary,
        timing_window_count: _windows.length
      };
      console.log('🔍 [engineOnly 排盘校验]', JSON.stringify(_chartLog));
      emit({ type: 'complete', result: { status: 'engine_only', branch: 'qimen', question: userQuestion, pre_score: backendScoreAudit.final_score, qimen_data: qimenData, timing_window_count: _windows.length } });
      return;
    }

    const yongshenPromptSection = buildYongshenPromptSection({
        intent: detectedIntent,
        rule: yongshenRule,
        hasBaziInfo
    });
    const domainViewPromptSection = buildDomainViewPromptSection(yongshenRule);
    const timingPromptSection = buildTimingPromptSection(timingAnalysis);
    const polarityPromptSection = buildPolarityPromptSection(polarityOverrides);
    const summaryPromptSection = buildSummaryPromptSection();
    const reportSchemaSection = buildReportSchemaPromptSection();
    const inferenceRulesSection = buildQimenInferenceRulesSection();
    const scoreAuditPromptSection = buildScoreAuditPromptSection({
        scoreAudit: backendScoreAudit,
        scoreInput: backendScoreInput,
        yongshenRule
    });
    const frontendCopyProtocolSection = buildFrontendCopyProtocolSection();
    const outputContractSection = buildQimenOutputContractSection({
        routeConfidence: detectedIntent.confidence,
        backendScore: backendScoreAudit.final_score
    });

    const finalPrompt = `你是一位精通“时家奇门拆补转盘法”的奇门遁甲预测大师。
起局时间：${timestamp_solar}(${timestamp_lunar})。
干支四柱：${qimenData.pillars.year} ${qimenData.pillars.month} ${qimenData.pillars.day} ${qimenData.pillars.hour}。${qimen_structure}。${juResult.jieQiName} ${juResult.yuanName} ；
旬首:${xunHead}。值符:${zhiFuStar}。值使:${zhiShiDoor}。空亡：日空${dayKongObj} 时空${hourKongObj}。驿马星：日马${dayMa} 时马${hourMa}。
${palacesText}

求测人命理信息(可选，若为空表示未提供)
${effectiveBaziInfo}

**【核心推演逻辑】**
1. ${yongshenPromptSection}
   - **补充限制**：如果上文提供了“求测人八字/命理信息”，请务必提取其出生年的天干作为“年命”落宫，结合日干落宫综合判断；若未提供，直接以“日干”代表求测人。
   - **审计要求**：你必须把当前 category/subcategory 对应的取用神规则作为审计依据。若你认为上游分类或子分类不贴合用户问题，必须在 intent_audit 中说明，并评估这是否导致后端工程指标偏差。

${inferenceRulesSection}

2. **断吉凶（注重静态盘面）**：
   - 分析五行生克、吉凶格、空亡（能量减半/待填实）、马星（变动/加速），对比核心用神宫位的生克关系。
   - ① 先列出所有"凶象/警示信号"（空亡、伏吟、死门、凶星、击刑等），如实呈现，不得美化。
   - ② 再分析吉象与支撑力。
   - ③ **禁止：**不得因求测者问题为正向就盲目倾向高分。
   - ④ 若下方出现“格局极性翻转表命中”，必须按覆盖后的问题域语义判分；若未出现该段，则按常规吉凶规则判断。

3. **抓应期与动态破局（核心！必须执行）**：
   - **绝不能死守静态凶象！** 如果盘面出现“杜门(堵塞)”、“九地(慢)”、“空亡”等阻碍，必须向后推演当天的**十二时辰**。
   - 寻找破局点：是否有某个时辰的五行**克制了忌神**（如金克木劈开杜门）？是否有**驿马星**被特定时辰引动（冲动/传送）？是否空亡宫位到了某个时辰被**填实或冲动**？
   - 如果时辰动态能冲破静态阻碍，说明事情“先难后易”或“即将发生”，必须在综合评分和结论中体现这一转机。

4. **给建议（心理关怀的边界）**：
   - 在 advice 中给予有温度的行动建议。真实的关怀 = 提前预警风险 + 给出应对方案（包含如何利用破局时辰），而非回避风险。

${scoreAuditPromptSection}

${summaryPromptSection}

${reportSchemaSection}

${domainViewPromptSection}

${polarityPromptSection}

${timingPromptSection}

${frontendCopyProtocolSection}

${outputContractSection}

务必做到有根据、有理论支持，分析的详细还要体会我问问题的心理潜在因素，照顾我的心理感受。你先分析，我下面要问你问题了。
问题：${userQuestion}`;

    // ── SSE Step 5: AI 推演开始（流式文字输出） ──
    emit({ type: 'active', index: 5, pct: 78 });

    const textPrompt = convertQimenPromptToTextMode(finalPrompt);
    // 问事模型：preview 环境由 QUESTION_MODEL 覆盖为 flash，production 默认 pro
    const questionModel = env.QUESTION_MODEL || 'gemini-3.1-pro-preview';
    // 7 个面向用户的散文段流式可见；data_json 段静默累积。
    const QIMEN_VISIBLE_SECTIONS = new Set([
      'conclusion', 'subject_reading', 'target_reading', 'environment_reading',
      'support_summary', 'constraint_summary', 'decision_reading', 'title'
    ]);
    let llmFullText = '';
    const sentinelParser = createSentinelStreamParser(QIMEN_VISIBLE_SECTIONS, {
      onVisibleDelta: (section, text) => emit({ type: 'llm_delta', section, text })
    });
    const _qimenTraceMeta = { name: 'qimen-answer', scenario: 'qimen', category: detectedIntent.category, tags: ['qimen', `category:${detectedIntent.category}`], userId: userId || guestId };
    for await (const chunk of requestLLMSimpleStream(textPrompt, env, questionModel, 0.7, ctx, _qimenTraceMeta)) {
      llmFullText += chunk;
      sentinelParser.push(chunk);
    }
    // 结构校验：空流 / 核心段缺失 / data_json 不可解析 → 打回让 LLM 重试一次（非流式）
    let sec = sentinelParser.finish();
    if (qimenSectionsAreBad(sec)) {
      console.warn('[qimen-api] bad structure, retrying non-streaming...', { len: llmFullText.length });
      // 通知前端清空已显示的半截内容，重置回骨架
      emit({ type: 'llm_retry', message: 'AI 重新推演中…' });
      try {
        llmFullText = await requestLLMText(textPrompt, env, questionModel, 0.7, ctx, { ..._qimenTraceMeta, name: 'qimen-answer-retry' });
      } catch (retryErr) {
        console.error('[qimen-api] retry also failed:', retryErr.message);
        emit({ type: 'error', message: 'AI 推演暂时不可用，请稍后重试' });
        return;
      }
      const retryParser = createSentinelStreamParser(QIMEN_VISIBLE_SECTIONS, {});
      retryParser.push(llmFullText);
      sec = retryParser.finish();
      if (qimenSectionsAreBad(sec)) {
        emit({ type: 'error', message: 'AI 推演暂时不可用，请稍后重试' });
        return;
      }
      // 用重试内容重新 emit 可见段（含 title）
      const VISIBLE_ORDER = ['conclusion', 'subject_reading', 'target_reading',
        'environment_reading', 'support_summary', 'constraint_summary', 'decision_reading', 'title'];
      for (const section of VISIBLE_ORDER) {
        if (sec[section]) emit({ type: 'llm_delta', section, text: sec[section] });
      }
    }
    // 拼出已展示的可读文字（兜底用完整可见段顺序拼接）
    const visibleProse = ['conclusion', 'subject_reading', 'target_reading', 'environment_reading',
      'support_summary', 'constraint_summary', 'decision_reading']
      .map(k => sec[k]).filter(Boolean).join('\n\n');
    emit({ type: 'llm_done', pct: 95, text: visibleProse });

    // 把哨兵段（7 散文 + 1 JSON）重组成与原 JSON 输出同形的 LLM 产物，再走原后处理。
    let dataJson = {};
    try { dataJson = parseSentinelDataJson(sec.data_json); } catch (e) { dataJson = {}; }
    const _dj = dataJson || {};
    const _djM3 = _dj.m3_inference || {};
    const rawQimenLlmOutput = {
      intent_audit: _dj.intent_audit || {},
      score_review: _dj.score_review || {},
      timing_review: _dj.timing_review || null,
      qimen_report: {
        m1_conclusion: { ...(_dj.m1_conclusion || {}), title: sec.title || _dj.m1_conclusion?.title || '', conclusion: sec.conclusion || _dj.m1_conclusion?.conclusion || '' },
        m2_basis: { ...(_dj.m2_basis || {}) },
        m3_inference: {
          subject_state:        { ...(_djM3.subject_state || {}),        reading: sec.subject_reading || '' },
          target_state:         { ...(_djM3.target_state || {}),         reading: sec.target_reading || '' },
          environment_state:    { ...(_djM3.environment_state || {}),    reading: sec.environment_reading || '' },
          support_factors:      { ...(_djM3.support_factors || {}),      summary: sec.support_summary || '' },
          constraint_factors:   { ...(_djM3.constraint_factors || {}),   summary: sec.constraint_summary || '' },
          interaction_decision: { ...(_djM3.interaction_decision || {}), reading: sec.decision_reading || '' },
        },
        m4_guidance: { ...(_dj.m4_guidance || {}) },
      },
    };

    // ── 以下后处理逻辑与原 JSON 链路一致（保证字段 100% 对齐） ──
    const aiJsonData = normalizeQimenLlmOutput(rawQimenLlmOutput);
    const rawLlmScoreAudit = aiJsonData.score_review || aiJsonData.score_audit || {};
    const rawLlmTimingReview = aiJsonData.timing_review || aiJsonData.timing_analysis || null;
    const parsedAuditDelta = parseAuditDelta(rawLlmScoreAudit.audit_delta);
    const auditDelta = 0;
    const finalScore = Math.round(clampNumber(backendScoreAudit.final_score, 0, 100));
    const postprocessAudit = {
        raw_score_review: rawLlmScoreAudit,
        raw_timing_review: rawLlmTimingReview,
        raw_parsed_audit_delta: parsedAuditDelta,
        parsed_audit_delta: auditDelta,
        advisory_only: true,
        model_suggested_delta_ignored: parsedAuditDelta,
        model_suggested_delta_reason: 'LLM 只复核文字，不得改动后端确定性工程指标。',
        backend_pre_score: backendScoreAudit.final_score,
        final_score: finalScore
    };
    aiJsonData.score_review = rawLlmScoreAudit;
    aiJsonData.timing_review = rawLlmTimingReview;
    aiJsonData.score_audit = {
        backend_pre_score: backendScoreAudit.final_score,
        audit_delta: auditDelta,
        raw_audit_delta: parsedAuditDelta,
        advisory_only: true,
        model_suggested_delta_ignored: parsedAuditDelta,
        final_score_suggestion: finalScore,
        confidence: ['low', 'medium', 'high'].includes(rawLlmScoreAudit.confidence) ? rawLlmScoreAudit.confidence : backendScoreAudit.confidence,
        role_review: rawLlmScoreAudit.role_review || null,
        layer_reviews: rawLlmScoreAudit.layer_reviews || [],
        timing_review: rawLlmScoreAudit.timing_review || rawLlmTimingReview || null,
        audit_delta_breakdown: rawLlmScoreAudit.audit_delta_breakdown || [],
        missed_or_overweighted_factors: Array.isArray(rawLlmScoreAudit.missed_or_overweighted_factors)
            ? rawLlmScoreAudit.missed_or_overweighted_factors
            : [],
        audit_reason: rawLlmScoreAudit.audit_reason || '模型未给出额外复核意见；工程指标沿用后端确定性结果。'
    };

    const m3Inference = (aiJsonData.qimen_report || {}).m3_inference;
    const rawScoreBasisFallback = (aiJsonData.summary || {}).score_basis || {};
    const derivedBasis = m3Inference
        ? deriveScoreBasisFromM3(m3Inference, backendScoreAudit.adjustments, finalScore)
        : {
            positive_signals: rawScoreBasisFallback.positive_signals,
            negative_signals: rawScoreBasisFallback.negative_signals,
            score_logic: rawScoreBasisFallback.score_logic
          };
    const sanitizedPositiveSignals = sanitizeSignalList(derivedBasis.positive_signals);
    const sanitizedNegativeSignals = sanitizeSignalList(derivedBasis.negative_signals);
    const sanitizedScoreLogic = sanitizeUserText(derivedBasis.score_logic)
        || `综合用神状态、主客关系、空亡与应期后，本局落在${finalScore >= 75 ? '偏有利' : finalScore >= 60 ? '中等可观察' : finalScore >= 40 ? '偏谨慎' : '明显谨慎'}区间。`;
    postprocessAudit.sanitized_summary_basis = {
        positive_signals: sanitizedPositiveSignals,
        negative_signals: sanitizedNegativeSignals,
        score_logic: sanitizedScoreLogic
    };

    aiJsonData.summary = {
        ...(aiJsonData.summary || {}),
        score: finalScore,
        score_basis: {
            positive_signals: sanitizedPositiveSignals,
            negative_signals: sanitizedNegativeSignals,
            score_logic: sanitizedScoreLogic
        }
    };

    const scoreVerdictLabel = finalScore >= 90 ? '大吉'
        : finalScore >= 75 ? '小吉'
            : finalScore >= 55 ? '平'
                : '凶';
    const reportTone = finalScore < 55 ? 'warning' : finalScore < 75 ? 'mixed' : 'positive';
    const qimenReport = aiJsonData.qimen_report || {};
    const qimenReportM3 = qimenReport.m3_inference || {};
    const interactionDecision = qimenReportM3.interaction_decision || qimenReportM3.interaction_verdict || {};
    const enrichedQimenReport = {
        ...qimenReport,
        m1_conclusion: {
            ...(qimenReport.m1_conclusion || {}),
            question: userQuestion,
            score: finalScore,
            verdict_label: scoreVerdictLabel,
            tone: reportTone,
            score_basis: {
                positive_signals: sanitizedPositiveSignals,
                negative_signals: sanitizedNegativeSignals,
                score_logic: sanitizedScoreLogic
            }
        },
        m2_basis: {
            ...(qimenReport.m2_basis || {}),
            chart_summary: {
                pillars: { hour: ganzhiHour, month: lunar.getMonthInGanZhi(), day: ganzhiDay, year: lunar.getYearInGanZhi() },
                ju_name: qimen_structure,
                jieqi: juResult.jieQiName,
                yuan: juResult.yuanName,
                zhi_fu: zhiFuStar,
                zhi_shi: zhiShiDoor
            },
            palaces: qimenData.palaces,
            formation_tags: (qimenReport.m2_basis?.formation_tags?.length)
                ? qimenReport.m2_basis.formation_tags
                : backendFormationTags
        },
        m3_inference: {
            ...qimenReportM3,
            interaction_decision: {
                ...interactionDecision,
                relation: backendScoreAudit.relations?.[0] || null
            }
        },
        m4_guidance: {
            ...(qimenReport.m4_guidance || {})
        }
    };

    const finalOutput = {
        ...aiJsonData,
        qimen_report: enrichedQimenReport,
        question: userQuestion,
        branch: detectedIntent.branch,
        category: detectedIntent.category,
        subcategory: detectedIntent.subcategory,
        route: detectedIntent,
        yongshen_ruleset: yongshenRule.ruleset,
        backend_score_audit: backendScoreAudit,
        preliminary_score_audit: backendScoreAudit,
        polarity_overrides: polarityOverrides,
        timing_analysis: {
            ...timingAnalysis,
            llm_summary: rawLlmTimingReview
        },
        qimen_data: qimenData
    };

        const qimenAuditSnapshot = buildQimenAuditSnapshot({
            requestId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            userId,
            question: userQuestion,
            ruleRouteHint: qimenRouteHint,
            routeRaw,
            routeNormalized: detectedIntent,
            roleAudit: {
                rule_role_hint: qimenRouteHint.role,
                llm_role: routeRaw.role,
                normalized_role: detectedIntent.role,
                role_reason: routeRaw.reason || detectedIntent.reason || '',
                role_confidence: routeRaw.confidence || detectedIntent.confidence || ''
            },
            qimenChartSnapshot: {
                pillars: finalOutput.qimen_data.pillars,
                timestamp: finalOutput.qimen_data.timestamp,
                ju_info: finalOutput.qimen_data.ju_info,
                auxiliary: finalOutput.qimen_data.auxiliary,
                palaces: finalOutput.qimen_data.palaces
            },
            timingTargetSymbols,
            timingInputSnapshot,
            timingAnalysisBackend: timingAnalysis,
            timingPromptSection,
            yongshenRuleSnapshot: yongshenRule,
            polarityOverrides,
            backendScoreInput,
            backendScoreAudit,
            backendScoreIntermediate: {
                deltas: backendScoreAudit.deltas,
                adjustments: backendScoreAudit.adjustments,
                yongshen_nodes: backendScoreAudit.yongshen_nodes,
                relations: backendScoreAudit.relations,
                timing: backendScoreAudit.timing
            },
            promptBlocks: [
                'buildYongshenPromptSection',
                'buildQimenInferenceRulesSection',
                'buildScoreAuditPromptSection',
                'buildSummaryPromptSection',
                'buildDomainViewPromptSection',
                'buildPolarityPromptSection',
                'buildTimingPromptSection',
                'buildFrontendCopyProtocolSection',
                'buildQimenOutputContractSection',
                detectedIntent.role ? `role:${detectedIntent.role}` : '',
                detectedIntent.category ? `category:${detectedIntent.category}` : '',
                detectedIntent.subcategory ? `subcategory:${detectedIntent.subcategory}` : ''
            ].filter(Boolean),
            llmInputSnapshot: {
                intent: detectedIntent,
                hasBaziInfo,
                effective_bazi_info: effectiveBaziInfo,
                backend_score_audit: backendScoreAudit,
                timing_analysis: timingAnalysis,
                polarity_overrides: polarityOverrides
            },
            llmPromptText: textPrompt,
            llmOutputRaw: { text: llmFullText, mode: 'sentinel_stream', parsed: rawQimenLlmOutput },
            llmOutputNormalized: aiJsonData,
            timingLlmOutput: rawLlmTimingReview,
            timingFinal: finalOutput.timing_analysis,
            postprocessAudit,
            finalOutput,
            modelName: questionModel,
            latencyMs: Date.now() - startedAt,
            fallbacks: []
        });

        try {
            const supabase = createSupabaseClient(env);
            const { error: auditError } = await supabase.from('qimen_question_audit').insert(qimenAuditSnapshot);
            if (auditError) console.warn('[qimen-api] qimen audit insert failed:', auditError.message || auditError);
        } catch (auditErr) {
            console.warn('[qimen-api] qimen audit insert failed:', auditErr.message || auditErr);
        }
	
    qimenMemoryCache[cacheKey] = finalOutput;
    emit({ type: 'complete', result: finalOutput });

  } catch (error) {
    console.error('[qimen-api] qimen error:', error);
    emit({ type: 'error', message: error.message || '奇门引擎推演失败' });
  } finally {
    close();
  }
  })(); // end async IIFE

  return sseResponse;
}

async function handleBazi(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  try {
    const user = await getAuthedUser(request, env);
    const body = await readJson(request);
    const promptData = body.promptData;
    if (!promptData || !promptData.profileId) return json({ error: "缺少档案 ID" }, { status: 400 }, request, env);

    const isVIP = isWhitelistedEmail(user.email || '', env.WHITELIST_EMAILS || '');

    const supabase = createSupabaseClient(env);
    const { data: existingProfile, error: profileError } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_GENERATE_SELECT).eq('id', promptData.profileId).single();
    if (profileError || !existingProfile) return json({ error: "档案不存在" }, { status: 404 }, request, env);
    if (existingProfile.user_id !== user.id) return json({ error: "无权操作该档案" }, { status: 403 }, request, env);

    const forceRegenerate = promptData.force === true;
    const engineUpToDate = hasLatestEngineCache(existingProfile);
    const llmExists = hasExistingLlm(existingProfile);

    // ── 模式 1：完全命中缓存 ──────────────────────────────────────────────────
    // 引擎版本匹配 + LLM 已有 → 直接返回，不做任何计算
    if (!forceRegenerate && engineUpToDate && llmExists) {
        return json({
            result: existingProfile.bazi_summary || '',
            bazi_detail: existingProfile.bazi_detail || {},
            cached: true,
        }, { status: 200 }, request, env);
    }

    if (!isVIP) {
        await assertDailyProfileActionQuota({ supabase, userId: user.id });
    }

    // ── 公共：解析出生信息、运行引擎 ──────────────────────────────────────────
    const dateParts = promptData.birthStr ? promptData.birthStr.match(/\d+/g) : null;
    if (!dateParts || dateParts.length < 3) return json({ error: "缺少确切的出生时间" }, { status: 400 }, request, env);

    const y = parseInt(dateParts[0]), m = parseInt(dateParts[1]), d = parseInt(dateParts[2]);
    const h = dateParts[3] ? parseInt(dateParts[3]) : 12, min = dateParts[4] ? parseInt(dateParts[4]) : 0;

    const solarObj = Solar.fromYmdHms(y, m, d, h, min, 0);
    const baZi = solarObj.getLunar().getEightChar();
    const isMale = (promptData.gender === '男' || promptData.gender === 'M' || promptData.gender === '乾造');
    const yun = baZi.getYun(isMale ? 1 : 0);
    const currentYear = new Date().getFullYear();
    const baziDetail = buildCompleteBaziDetail({ baZi, yun, isMale, currentYear });
    const geJu = baziDetail.geju;
    const currentDaYunText = `${baziDetail.matrix.current_dayun?.gan || ''}${baziDetail.matrix.current_dayun?.zhi || ''}`;
    const currentLiuNianText = `${baziDetail.matrix.current_liunian?.gan || ''}${baziDetail.matrix.current_liunian?.zhi || ''}`;
    const engineQualitativeData = {
        yuanju_core: baziDetail.engine_yuanju_core,
        current_dayun: baziDetail.engine_current_dayun,
        current_liunian: baziDetail.engine_current_liunian
    };

    // 引擎版本变化时，旧 LLM 文本可能建立在已废弃规则上，必须随新版引擎重新生成。
    // ── 全量重推（force=true、首次无 LLM 或引擎版本变化）→ SSE ─────────
    const { emit, close, response: sseResponse } = createSSEResponse(request, env);

    (async () => {
      try {
        emit({ type: 'step', index: 0, pct: 10, label: '校验档案' });
        emit({ type: 'step', index: 1, pct: 25, label: '排盘计算' });

        const engineQualitative = {
          ...buildQualitativeSections({
            llmSucceeded: false,
            llmQualitativeData: null,
            engineQualitativeData
          }),
          status: 'engine_ready',
          display_source: 'engine'
        };
        const engineBaziDetail = {
          ...baziDetail,
          llm_yuanju_core: null,
          llm_current_dayun: null,
          llm_current_liunian: null,
          engine_yuanju_core: engineQualitative.engine.yuanju_core,
          engine_current_dayun: engineQualitative.engine.current_dayun,
          engine_current_liunian: engineQualitative.engine.current_liunian,
          qualitative: engineQualitative
        };
        const engineSummaryText = buildBaziSummaryFromSections({
          geJu,
          sections: engineQualitative.display
        });
        const engineUpdatePayload = {
          bazi_str: promptData.baziStr,
          bazi_detail: engineBaziDetail,
          bazi_summary: engineSummaryText,
          strong_weak: engineBaziDetail.strong_weak,
          geju: engineBaziDetail.geju,
          shensha: JSON.stringify(engineBaziDetail.shensha),
          display_yuanju_core: engineQualitative.display.yuanju_core,
          display_current_dayun: engineQualitative.display.current_dayun,
          display_current_liunian: engineQualitative.display.current_liunian,
          llm_yuanju_core: null,
          llm_current_dayun: null,
          llm_current_liunian: null,
          engine_yuanju_core: engineQualitative.engine.yuanju_core,
          engine_current_dayun: engineQualitative.engine.current_dayun,
          engine_current_liunian: engineQualitative.engine.current_liunian,
          favorable_elements: engineBaziDetail.favorable_gods,
          unfavorable_elements: engineBaziDetail.unfavorable_gods,
          day_zhi: engineBaziDetail.day_zhi,
          year_zhi: engineBaziDetail.year_zhi,
          month_zhi: engineBaziDetail.month_zhi,
          ri_zhu: engineBaziDetail.ri_zhu
        };

        const { error: engineDbError } = await supabase.from('bazi_profiles').update(engineUpdatePayload).eq('id', promptData.profileId);
        if (engineDbError) throw engineDbError;
        await recordProfileAction({
          supabase,
          userId: user.id,
          profileId: promptData.profileId,
          metadata: {
            mode: existingProfile.bazi_summary ? 'profile_refresh' : 'profile_add',
            force: forceRegenerate,
            stream: true
          }
        });

        emit({
          type: 'engine_complete',
          pct: 45,
          profileId: promptData.profileId,
          result: {
            result: engineSummaryText,
            bazi_detail: engineBaziDetail,
            favorable_elements: engineUpdatePayload.favorable_elements,
            unfavorable_elements: engineUpdatePayload.unfavorable_elements
          }
        });
        emit({ type: 'step', index: 2, pct: 50, label: 'AI 断语生成' });

        const promptText = buildBaziProfileSectionPrompt({
          gender: promptData.gender,
          birthStr: promptData.birthStr,
          baziStr: promptData.baziStr,
          geJu,
          strongWeak: baziDetail.strong_weak,
          favorableGods: baziDetail.favorable_gods || [],
          unfavorableGods: baziDetail.unfavorable_gods || [],
          patternAnalysis: baziDetail.pattern_analysis,
          imageAnalysis: baziDetail.image_analysis,
          currentDaYunText,
          currentLiuNianText
        });

        let llmSections;
        try {
          llmSections = await requestLLMStreamSections(promptText, env, {
            onSectionStart: (section) => emit({ type: 'llm_section_start', section }),
            onDelta: (section, text) => emit({ type: 'llm_delta', section, text }),
            onSectionDone: (section, text) => emit({ type: 'llm_section_done', section, text }),
          }, 'gemini-3.1-pro-preview', 0.65, ctx, { name: 'bazi-profile-sections', scenario: 'bazi-profile-init', userId: user.id });
        } catch (llmError) {
          console.warn('[qimen-api] bazi llm stream failed:', llmError.message || llmError);
          emit({ type: 'llm_error', message: 'AI 深度断语暂时不可用，已保留规则引擎结果' });
          emit({ type: 'complete', pct: 100, profileId: promptData.profileId, partial: true });
          return;
        }

        const llmQualitative = {
          ...buildQualitativeSections({
            llmSucceeded: true,
            llmQualitativeData: llmSections,
            engineQualitativeData
          }),
          status: 'llm_complete',
          display_source: 'llm'
        };
        const finalBaziDetail = {
          ...baziDetail,
          llm_yuanju_core: llmQualitative.llm.yuanju_core,
          llm_current_dayun: llmQualitative.llm.current_dayun,
          llm_current_liunian: llmQualitative.llm.current_liunian,
          engine_yuanju_core: llmQualitative.engine.yuanju_core,
          engine_current_dayun: llmQualitative.engine.current_dayun,
          engine_current_liunian: llmQualitative.engine.current_liunian,
          qualitative: llmQualitative
        };
        const combinedResultText = buildBaziSummaryFromSections({ geJu, sections: llmQualitative.display });
        const finalUpdatePayload = {
          bazi_detail: finalBaziDetail,
          bazi_summary: combinedResultText,
          display_yuanju_core: llmQualitative.display.yuanju_core,
          display_current_dayun: llmQualitative.display.current_dayun,
          display_current_liunian: llmQualitative.display.current_liunian,
          llm_yuanju_core: llmQualitative.llm.yuanju_core,
          llm_current_dayun: llmQualitative.llm.current_dayun,
          llm_current_liunian: llmQualitative.llm.current_liunian
        };
        const { error: finalDbError } = await supabase.from('bazi_profiles').update(finalUpdatePayload).eq('id', promptData.profileId);
        if (finalDbError) throw finalDbError;

        emit({
          type: 'llm_complete',
          pct: 100,
          profileId: promptData.profileId,
          result: {
            sections: llmSections,
            result: combinedResultText,
            bazi_detail: finalBaziDetail
          }
        });
        emit({ type: 'complete', pct: 100, profileId: promptData.profileId });
      } catch (streamError) {
        console.error('[qimen-api] bazi stream error:', streamError);
        emit({ type: 'error', message: streamError.message || '八字引擎推演失败' });
      } finally {
        close();
      }
    })();

    return sseResponse;

  } catch (error) {
    console.error('[qimen-api] bazi error:', error);
    const isQuota = error.message && error.message.includes("额度");
    return json({ error: "八字引擎推演失败", details: error.message }, { status: isQuota ? 403 : 500 }, request, env);
  }
}

/* ─────────────────────────────────────────────────────────
   Compatibility Init – compute real bazi for both persons
   and persist an anonymous compatibility_sessions row.
───────────────────────────────────────────────────────── */
async function handleCompatibilityInit(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  }
  try {
    const body = await request.json();
    const { profileA, profileB } = body || {};
    if (!profileA || !profileB) {
      return json({ error: 'profileA and profileB required' }, { status: 400 }, request, env);
    }

    // Zhi index 0-11 (子丑…亥) → representative solar hour (mid of 2-hr block)
    const ZHI_MID_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

    function parsePerson(p) {
      const dateParts = String(p.birth_date || '').split('-').map(Number);
      const y = dateParts[0] || 2000, m = dateParts[1] || 1, d = dateParts[2] || 1;
      const hi = parseInt(p.hour_index ?? -1);
      let baseH = hi >= 0 ? ZHI_MID_HOURS[hi] : 12;
      let baseMin = 0;

      // Apply true solar time correction (in minutes, already computed on frontend)
      const tstMin = parseInt(p.tst_correction_min || 0);
      baseMin += tstMin;
      if (baseMin < 0) { baseH -= 1; baseMin += 60; }
      if (baseMin >= 60) { baseH += 1; baseMin -= 60; }
      baseH = ((baseH % 24) + 24) % 24;

      const solar = Solar.fromYmdHms(y, m, d, baseH, baseMin, 0);
      const baZi = solar.getLunar().getEightChar();
      const isMale = p.gender === 'M' || p.gender === '男';
      const detail = buildCompleteBaziDetail({
        baZi,
        yun: baZi.getYun(isMale ? 1 : 0),
        isMale,
        currentYear: new Date().getFullYear(),
      });

      const gz = detail.pillars?.ganzhi || {};
      return {
        dayGan: (gz.day || '')[0] || '',
        gans: [
          (gz.year  || '')[0] || '',
          (gz.month || '')[0] || '',
          (gz.day   || '')[0] || '',
          hi >= 0 ? (gz.time || '')[0] || '' : '',
        ],
        zhis: [
          (gz.year  || '')[1] || '',
          (gz.month || '')[1] || '',
          detail.day_zhi   || (gz.day   || '')[1] || '',
          hi >= 0 ? (gz.time || '')[1] || '' : '',
        ],
        dayZhi:   detail.day_zhi   || '',
        yearZhi:  detail.year_zhi  || '',
        monthZhi: detail.month_zhi || '',
        five_shens:   detail.five_shens   || {},
        wuxing_ratio: detail.wuxing_ratio || {},
      };
    }

    const compactA = parsePerson(profileA);
    const compactB = parsePerson(profileB);

    // Persist session (best-effort – don't fail the response if DB is unavailable)
    let sessionId = null;
    try {
      const supabase = createSupabaseClient(env);
      const { data: session } = await supabase
        .from('compatibility_sessions')
        .insert({
          name_a: profileA.name || null,
          name_b: profileB.name || null,
          gender_a: profileA.gender || null,
          gender_b: profileB.gender || null,
          birth_date_a: profileA.birth_date || null,
          birth_date_b: profileB.birth_date || null,
          birth_location_a: profileA.birth_location || profileA.city || null,
          birth_location_b: profileB.birth_location || profileB.city || null,
          birth_lat_a: profileA.lat  != null ? Number(profileA.lat)  : null,
          birth_lng_a: profileA.lng  != null ? Number(profileA.lng)  : null,
          birth_lat_b: profileB.lat  != null ? Number(profileB.lat)  : null,
          birth_lng_b: profileB.lng  != null ? Number(profileB.lng)  : null,
          hour_index_a: profileA.hour_index != null ? Number(profileA.hour_index) : -1,
          hour_index_b: profileB.hour_index != null ? Number(profileB.hour_index) : -1,
          bazi_compact_a: compactA,
          bazi_compact_b: compactB,
        })
        .select('id')
        .single();
      sessionId = session?.id || null;
    } catch (dbErr) {
      console.error('[compatibility/init] db insert failed:', dbErr.message);
    }

    return json({ ok: true, sessionId, A: compactA, B: compactB }, { status: 200 }, request, env);
  } catch (e) {
    console.error('[compatibility/init] error:', e);
    return json({ error: e.message }, { status: 500 }, request, env);
  }
}

async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request, env),
    });
  }

  if (url.pathname === '/api/health') {
    return json({ ok: true, service: 'qimen-api' }, { status: 200 }, request, env);
  }

  if (url.pathname === '/api/divination-route') {
    return handleDivinationRoute(request, env, ctx);
  }

  if (url.pathname === '/api/fortune-annual') {
    return handleFortuneAnnual(request, env);
  }

  if (url.pathname === '/api/fortune-weekly') return handleFortuneWeekly(request, env);
  if (url.pathname === '/api/fortune-monthly') return handleFortuneMonthly(request, env);
  if (url.pathname === '/api/fortune-daily') return handleFortuneDaily(request, env);

  if (url.pathname === '/api/context-notes') return handleContextNotes(request, env);
  if (url.pathname === '/api/bazi-question') return handleBaziQuestion(request, env, ctx);
  if (url.pathname === '/api/bazi-panel') return handleBaziPanel(request, env);
  if (url.pathname === '/api/bazi-calibrate') return handleBaziCalibrate(request, env, ctx);
  if (url.pathname === '/api/fortune-daily-interpretation') return handleFortuneDailyInterpretation(request, env, ctx);
  if (url.pathname === '/api/fortune-monthly-interpretation') return handleFortuneMonthlyInterpretation(request, env, ctx);
  if (url.pathname === '/api/qimen') return handleQimen(request, env, ctx);
  if (url.pathname === '/api/qimen-followup') return handleQimenFollowup(request, env, ctx);
  if (url.pathname === '/api/bazi-followup') return handleBaziFollowup(request, env, ctx);
  if (url.pathname === '/api/bazi') return handleBazi(request, env, ctx);
  if (url.pathname === '/api/compatibility/init') return handleCompatibilityInit(request, env);

  return json({
    error: 'Not Found',
    path: url.pathname,
    migrated: [
      '/api/health', '/api/divination-route', '/api/fortune-annual',
      '/api/fortune-weekly', '/api/fortune-monthly', '/api/fortune-daily',
      '/api/context-notes', '/api/bazi-question', '/api/bazi-calibrate',
      '/api/fortune-daily-interpretation', '/api/fortune-monthly-interpretation'
    ],
  }, { status: 404 }, request, env);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await routeRequest(request, env, ctx);
    } catch (error) {
      console.error('[qimen-api]', error);
      return json({
        error: 'Worker request failed',
        details: error.message,
      }, { status: 500 }, request, env);
    }
  },
};
