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
import { buildScoreAuditPromptSection, buildSummaryPromptSection } from '../../lib/qimenPromptSections.js';
import { buildDomainViewPromptSection, buildYongshenPromptSection, getYongshenRule } from '../../lib/qimenYongshenRules.js';
import { buildTimingAnalysis, buildTimingPromptSection } from '../../lib/qimenTimingRules.js';
import { buildPolarityPromptSection, detectPolarityOverrides } from '../../lib/qimenPolarityRules.js';
import { calculateQimenScore } from '../../lib/qimenScoringEngine.js';
import { getMaXing, maXingMap, zhiToPalace, palaceBranches, getKongIndices } from '../../lib/qimenCore.js';
import baziCore from '../../lib/baziCore.js';
import qimenLlmOutput from '../../lib/qimenLlmOutput.js';

const { buildCompleteBaziDetail, buildQualitativeSections, hasCompleteLlmCache, hasLatestEngineCache, hasExistingLlm, CALIBRATION_VERSION, computeEventsHash, hasValidCalibration } = baziCore;
const { normalizeQimenLlmOutput } = qimenLlmOutput;


const { buildBaziSemanticRoutePrompt, buildGeminiRoutePrompt, classifyDivinationQuestion, ruleRouteHint } = divinationRouter;
const { buildAnnualRangePayload } = fortuneAnnualCore;
const { buildFortunePeriodKey: buildWeeklyPeriodKey, buildWeeklyFortunePayload, getSecondsUntilWeeklyExpiry, getWeekRange, getWeeklyExpiry } = fortuneWeeklyCore;
const { buildFortunePeriodKey: buildMonthlyPeriodKey, buildMonthlyFortunePayload, getFlowMonthInfo } = fortuneMonthlyCore;
const { getBeijingDayInfo, buildFortunePeriodKey: buildDailyPeriodKey, buildFortuneContext, buildBaseFortunePayload, buildInterpretationPrompt, parseModelJson, pickInterpretationFields, mergeInterpretation, hasReadyInterpretation } = fortuneDailyCore;
const { buildBaziQuestionPrompt, buildBaziAuditSnapshot, normalizeBaziQuestionOutput, normalizeBaziSemanticRoute } = baziQuestionCore;
const { createEmptyMonthlyContext, createEmptyProfileContext, normalizeMonthlyContextPayload, normalizeProfileContextPayload, buildContextVersionSeed } = contextNotesCore;
const { buildMonthlyInterpretationPeriodKey, buildMonthlyInterpretationPrompt, hasReadyMonthlyInterpretation, mergeMonthlyInterpretation, normalizeDimension, pickMonthlyInterpretationFields } = monthlyInterpretationCore;

const LLM_API_URL = 'https://yinli.one/v1/chat/completions';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://qimendao.com',
  'https://www.qimendao.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

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

function sanitizeUserText(value) {
  return String(value || '')
    .replace(/后端初分\s*\d+[^，。；,.]*[，。；,.]?/g, '')
    .replace(/后端[^，。；,.]*?(?:下调|上调|审计|初算|初分|preliminary|backend|audit)[^，。；,.]*[，。；,.]?/gi, '')
    .replace(/(?:LLM|模型)?审计修正\s*[+-]?\d+[^，。；,.]*[，。；,.]?/gi, '')
    .replace(/audit_delta|backend_pre_score|final_score_suggestion|preliminary_score_audit|qimen-score-v1/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSignalList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(sanitizeUserText)
    .filter(Boolean);
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
    : requestOrigin && allowedOrigins.includes(requestOrigin)
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

async function classifyByGeminiFlashWithEnv(question, ruleResult, env) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3-flash-preview',
      messages: [{ role: 'user', content: buildGeminiRoutePrompt(question, ruleResult) }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Divination router LLM request failed: HTTP ${response.status}`);
  }

  const apiData = await response.json();
  const content = apiData.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
}

async function classifyBaziSemanticRouteWithEnv(question, routeHint, env) {
  const prompt = buildBaziSemanticRoutePrompt(question, routeHint);
  return requestLLM(prompt, env, 'gemini-3-flash-preview', 0.1);
}

async function handleDivinationRoute(request, env) {
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
    llmClassifier: (text, ruleResult) => classifyByGeminiFlashWithEnv(text, ruleResult, env),
  });

  return json(route, { status: 200 }, request, env);
}

function createSupabaseClient(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials are not configured');
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
  let query = supabase
    .from('bazi_profiles')
    .select('id, name, gender, birth_date, bazi_summary, bazi_str, bazi_detail, favorable_elements, unfavorable_elements, day_zhi, year_zhi, month_zhi, ri_zhu')
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

async function requestLLM(prompt, env, model = 'gemini-3.1-pro-preview', temperature = 0.5) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  
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
  return JSON.parse(cleaned);
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

async function handleBaziQuestion(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  const startedAt = Date.now();

  // ── Pre-stream: auth + basic validation (may return JSON errors) ──
  let user;
  try {
    user = await getAuthedUser(request, env);
  } catch (authErr) {
    return json({ error: '认证失败', details: authErr.message }, { status: authErr.status || 401 }, request, env);
  }

  const body = await readJson(request);
  const question = String(body.question || '').trim();
  const profileId = String(body.profileId || '').trim();
  if (!question) return json({ error: '问题不能为空' }, { status: 400 }, request, env);
  if (!profileId) return json({ error: '缺少八字档案 ID' }, { status: 400 }, request, env);

  // Profile fetch (pre-stream so we can return JSON errors for missing/invalid profiles)
  const supabase = createSupabaseClient(env);
  const { data: profile, error: profileErr } = await supabase.from('bazi_profiles').select('*').eq('id', profileId).single();
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
        : await classifyBaziSemanticRouteWithEnv(question, routeHint, env);
    } catch (routeError) {
      semanticRouteRaw = {
        ...routeHint,
        source: 'rule_hint_fallback',
        reason: routeHint.reason || `八字语义路由失败：${routeError.message}`,
      };
      semanticFallbacks.push(`bazi_semantic_route_fallback:${routeError.message}`);
    }
    const semanticRoute = normalizeBaziSemanticRoute({ ...baseRoute, ...semanticRouteRaw }, routeHint);

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

    // ── SSE Step 5: AI 推演开始 ──
    emit({ type: 'active', index: 5, pct: 75 });

    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.65);
    const output = normalizeBaziQuestionOutput(llmJson, { question, route: semanticRoute, pipelineResult });

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
        semanticRoute.secondary_mode ? `secondary_mode:${semanticRoute.secondary_mode}` : '',
        semanticRoute.target_resolution ? `target_resolution:${semanticRoute.target_resolution}` : '',
      ].filter(Boolean),
      llmOutputRaw: llmJson,
      llmOutputNormalized: output,
      pipelineResult,
      modelName: 'gemini-3.1-pro-preview',
      latencyMs: Date.now() - startedAt,
      fallbacks: [...semanticFallbacks, ...(output.meta?.limitations || [])],
    });

    try {
      const { error: auditError } = await supabase.from('bazi_question_audit').insert(auditSnapshot);
      if (auditError) console.warn('[qimen-api] bazi audit insert failed:', auditError.message || auditError);
    } catch (auditErr) {
      console.warn('[qimen-api] bazi audit insert failed:', auditErr.message || auditErr);
    }

    const outputWithSnapshot = {
      ...output,
      subject_snapshot: {
        birth_date: profile.birth_date || profile.bazi_detail?.base_info?.solar_birth || null,
        gender: profile.gender || null
      }
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

async function handleBaziCalibrate(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  try {
    const user = await getAuthedUser(request, env);
    const body = await readJson(request);
    const { profileId, prompt } = body;
    if (!profileId || !prompt) return json({ error: '缺少 profileId 或 prompt' }, { status: 400 }, request, env);

    const supabase = createSupabaseClient(env);
    const { data: profile } = await supabase
      .from('bazi_profiles')
      .select('id, user_id, life_events, calibrated_yuanju_core, calibrated_current_dayun, calibrated_current_liunian, calibrated_version')
      .eq('id', profileId)
      .single();
    if (!profile || profile.user_id !== user.id) return json({ error: '无权操作该档案' }, { status: 403 }, request, env);

    if (hasValidCalibration(profile, profile.life_events)) {
      return json({
        yuanju_core: profile.calibrated_yuanju_core,
        current_dayun: profile.calibrated_current_dayun,
        current_liunian: profile.calibrated_current_liunian,
        cached: true,
      }, { status: 200 }, request, env);
    }

    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.2);
    if (!llmJson.yuanju_core || !llmJson.current_dayun || !llmJson.current_liunian) {
      return json({ error: 'LLM 返回格式不符预期' }, { status: 500 }, request, env);
    }

    const { error: dbError } = await supabase.from('bazi_profiles').update({
      calibrated_yuanju_core: llmJson.yuanju_core,
      calibrated_current_dayun: llmJson.current_dayun,
      calibrated_current_liunian: llmJson.current_liunian,
      calibrated_at: new Date().toISOString(),
      calibrated_version: `${CALIBRATION_VERSION}:${computeEventsHash(profile.life_events)}`,
    }).eq('id', profileId);

    if (dbError) throw dbError;

    return json({
      yuanju_core: llmJson.yuanju_core,
      current_dayun: llmJson.current_dayun,
      current_liunian: llmJson.current_liunian,
    }, { status: 200 }, request, env);
  } catch (error) {
    console.error('[qimen-api] bazi-calibrate error:', error);
    return json({ error: error.message || '深度校准失败' }, { status: error.status || 500 }, request, env);
  }
}

async function handleFortuneDailyInterpretation(request, env) {
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
    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.5);
    const mergedJson = mergeInterpretation(baseJson, llmJson);

    await upsertFortuneCache(user.id, 'day', periodKey, mergedJson, expiresAt, env);
    return json(pickInterpretationFields(mergedJson), { status: 200 }, request, env);
  } catch (error) {
    console.error('[qimen-api] fortune-daily-interpretation error:', error);
    const isQuota = error.message.includes('额度');
    return json({ error: isQuota ? error.message : '云端日运断语生成失败', details: error.message }, { status: error.status || (isQuota ? 403 : 500) }, request, env);
  }
}

async function handleFortuneMonthlyInterpretation(request, env) {
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
    
    const llmJson = await requestLLM(prompt, env, 'gemini-3.1-pro-preview', 0.5);
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

async function handleQimen(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);

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
  const whitelist = (env.WHITELIST_EMAILS || "").split(',').map(email => email.trim().toLowerCase());
  const currentUserEmail = user?.email ? user.email.toLowerCase() : "";
  const isVIP = whitelist.includes(currentUserEmail);

  if (isGuestRequest) {
    console.log(`👤 访客账户 [${guestId}] 发起一次推演`);
  } else if (isVIP) {
    console.log(`👑 白名单特权账户 [${currentUserEmail}] 发起推演，免除额度限制`);
  } else {
    try {
      const supabase = createSupabaseClient(env);
      const { count, error } = await supabase.from('qimen_records').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if (!error && count >= 3) {
        return json({ error: "您的 3 次免费天机推演额度已用尽" }, { status: 403 }, request, env);
      }
    } catch (quotaErr) {
      console.warn('[qimen-api] quota check failed:', quotaErr);
    }
  }

  // ── Start SSE stream ──
  const { emit, close, response: sseResponse } = createSSEResponse(request, env);

  (async () => {
  try {

    const userQuestion = body.question || "当前局势吉凶如何？";
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bjTime = new Date(utc + (3600000 * 8));

    const year = bjTime.getFullYear();
    const month = bjTime.getMonth() + 1; 
    const day = bjTime.getDate();
    const hour = bjTime.getHours();
    const minute = bjTime.getMinutes();

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

    const juResult = Calc.calculateJuByChaiBu(solar, C.JIEQI_JUSHU, C.YUAN_NAMES);
    const xunHead = U.getXunHead(ganzhiHour);
    const fuShou = U.getFuShou(xunHead);
    const flyStep = U.calculateFlyStep(xunHead, ganzhiHour);
    const rawTianGan = U.extractTianGan(ganzhiHour);
    const tianGan = U.resolveJiaHiding(rawTianGan, fuShou);

    const diPan = Calc.getDiPan(juResult.isYang, juResult.gameNumber);
    const zhiFuStar = Calc.getZhiFuStar(fuShou, diPan);
    const nineStars = Calc.calculateNineStars(zhiFuStar, tianGan, diPan);
    const zhiShiDoor = Calc.getZhiShiDoor(fuShou, diPan);
    const eightDoors = Calc.calculateEightDoors(juResult.isYang, zhiShiDoor, flyStep, fuShou, diPan);
    const eightGods = Calc.calculateEightGods(juResult.isYang, tianGan, diPan);
    const tianPanGan = Calc.calculateTianPan(juResult.isYang, tianGan, fuShou, diPan);

    const dayZhi = U.extractDiZhi(ganzhiDay);
    const hourZhi = U.extractDiZhi(ganzhiHour);
    const dayMa = getMaXing(dayZhi);
    const hourMa = getMaXing(hourZhi);
    const dayKongObj = lunar.getDayXunKong(); 
    const hourKongObj = lunar.getTimeXunKong();
    const dayKongIndices = getKongIndices(dayKongObj);
    const hourKongIndices = getKongIndices(hourKongObj);
    const tianRuiIndex = nineStars.indexOf("天芮");
    const centerEarthStem = diPan[4]; 

    const palaceNames = ["巽", "离", "坤", "震", "中", "兑", "艮", "坎", "乾"];
    const palaceNumbers = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    let palacesText = "";

    for (let i = 0; i < 9; i++) {
        let pName = `${palaceNames[i]}${palaceNumbers[i]}宫`;
        if (i === 4) {
            palacesText += `${pName}信息开始：地盘天干：${diPan[i]}，${pName}信息结束。\n`;
            continue;
        }
        let extra = "";
        if (dayKongIndices.includes(i) || hourKongIndices.includes(i)) extra += "本宫占空亡；";
        if (i === maXingMap[dayMa] || i === maXingMap[hourMa]) extra += "本宫有马星；";
        
        let jiText = "";
        if (i === 2) jiText = `；地盘寄干：${centerEarthStem}`;
        if (i === tianRuiIndex) jiText += `；天盘寄干：${centerEarthStem}`;

        palacesText += `${pName}信息开始：九星：${nineStars[i]}；八神：${eightGods[i]}；八门：${eightDoors[i]}；天盘天干：${tianPanGan[i]}；地盘天干：${diPan[i]}${jiText}；${extra}${pName}信息结束。\n`;
    }

    const timestamp_solar = `${year}年${month}月${day}日 ${hour}:${minute}`;
    const timestamp_lunar = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    const qimen_structure = `${juResult.yinYang}遁${juResult.gameNumber}局`;
    const dayStem = U.extractTianGan(ganzhiDay);
    const hourStem = U.extractTianGan(ganzhiHour);

    // ── SSE Step 1: 起盘计算完成 ──
    emit({ type: 'step', index: 1, pct: 25, chip: { main: qimen_structure, sub: ganzhiHour } });

    const detectedIntent = body.route
        ? normalizeDivinationRoute(body.route)
        : await classifyDivinationQuestion({ question: userQuestion, forceBranch: 'qimen', llmFallback: true, llmClassifier: (text, ruleResult) => classifyByGeminiFlashWithEnv(text, ruleResult, env) });

    // ── SSE Step 0: 解析问题意图完成 (routing was done by client) ──
    const _cat0 = QIMEN_CATEGORY_LABELS[detectedIntent.category] || '综合运势';
    const _sub0 = detectedIntent.branch === 'hybrid' ? '综合推演' : '奇门遁甲';
    emit({ type: 'step', index: 0, pct: 10, chip: { main: _cat0, sub: _sub0 } });

    // 纯奇门分支：屏蔽命主八字信息，只用盘面推演，不引入命局偏倚
    const effectiveBaziInfo = detectedIntent.branch === 'qimen' ? "未提供八字信息" : baziInfo;

    const yongshenRule = getYongshenRule(detectedIntent.category, detectedIntent.subcategory);
    const hasBaziInfo = effectiveBaziInfo !== "未提供八字信息";
    const timingTargetSymbols = [
        ...(yongshenRule.yongshen?.primary || []),
        ...(yongshenRule.yongshen?.secondary || [])
    ]
        .filter(item => hasBaziInfo || !item.requiresBazi)
        .map(item => ({ symbol: item.symbol, role: item.role, weight: item.layer || 'core' }));
        
    // ── SSE Step 2: 定位用神完成 ──
    const _primarySymbol = yongshenRule?.yongshen?.primary?.[0]?.symbol || '用神';
    emit({ type: 'step', index: 2, pct: 42, chip: { main: _primarySymbol, sub: detectedIntent.subcategory || detectedIntent.category || '' } });

    const timingPalaces = Array.from({ length: 9 }, (_, i) => ({
        index: i,
        name: `${palaceNames[i]}${palaceNumbers[i]}宫`,
        element: ["木", "火", "土", "木", "土", "金", "土", "水", "金"][i],
        branches: palaceBranches[i],
        door: eightDoors[i],
        star: nineStars[i],
        god: eightGods[i],
        sky: tianPanGan[i],
        earth: diPan[i],
        isKong: dayKongIndices.includes(i) || hourKongIndices.includes(i),
        hasMa: i === maXingMap[dayMa] || i === maXingMap[hourMa],
        isZhiShi: eightDoors[i] === zhiShiDoor,
        isDayStem: tianPanGan[i] === dayStem || diPan[i] === dayStem,
        isHourStem: tianPanGan[i] === hourStem || diPan[i] === hourStem
    }));
    
    const timingAnalysis = buildTimingAnalysis({
        generatedAt: bjTime,
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
    });
    
    // ── SSE Step 3: 推演应期完成 ──
    const _windows = timingAnalysis?.p2_scan?.candidates || [];
    const _firstWin = _windows[0];
    const _winSub = _firstWin ? (_firstWin.date || '近日') : '暂无明确窗口';
    emit({ type: 'step', index: 3, pct: 58, chip: { main: `发现 ${_windows.length} 个窗口`, sub: _winSub } });

    const polarityOverrides = detectPolarityOverrides({
        intent: detectedIntent,
        palaces: timingPalaces
    });
    const backendScoreAudit = calculateQimenScore({
        intent: detectedIntent,
        palaces: timingPalaces,
        yongshenRule,
        polarityOverrides
    });
    // ── SSE Step 4: 后端评分完成 ──
    emit({ type: 'step', index: 4, pct: 72, chip: { main: `初分 ${backendScoreAudit.final_score}`, sub: QIMEN_SCORE_LABEL(backendScoreAudit.final_score) } });

    const yongshenPromptSection = buildYongshenPromptSection({
        intent: detectedIntent,
        rule: yongshenRule,
        hasBaziInfo
    });
    const domainViewPromptSection = buildDomainViewPromptSection(yongshenRule);
    const timingPromptSection = buildTimingPromptSection(timingAnalysis);
    const polarityPromptSection = buildPolarityPromptSection(polarityOverrides);
    const summaryPromptSection = buildSummaryPromptSection();
    const scoreAuditPromptSection = buildScoreAuditPromptSection(backendScoreAudit);

    const finalPrompt = `你是一位精通“时家奇门拆补转盘法”的奇门遁甲预测大师。
起局时间：${timestamp_solar}(${timestamp_lunar})。
干支四柱：${lunar.getYearInGanZhi()} ${lunar.getMonthInGanZhi()} ${ganzhiDay} ${ganzhiHour}。${qimen_structure}。${juResult.jieQiName} ${juResult.yuanName} ；
旬首:${xunHead}。值符:${zhiFuStar}。值使:${zhiShiDoor}。空亡：日空${dayKongObj} 时空${hourKongObj}。驿马星：日马${dayMa} 时马${hourMa}。
${palacesText}

求测人命理信息(可选，若为空表示未提供)
${effectiveBaziInfo}

**【核心推演逻辑】**
1. ${yongshenPromptSection}
   - **补充限制**：如果上文提供了“求测人八字/命理信息”，请务必提取其出生年的天干作为“年命”落宫，结合日干落宫综合判断；若未提供，直接以“日干”代表求测人。
   - **审计要求**：你必须把当前 category/subcategory 对应的取用神规则作为审计依据。若你认为上游分类或子分类不贴合用户问题，必须在 intent_audit 中说明，并评估这是否导致后端初分偏差。

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

${domainViewPromptSection}

${polarityPromptSection}

${timingPromptSection}

**【Output Format (JSON Schema)】**
请严格按照以下 JSON 结构返回数据：
{
  "summary": {
    "title": "短标题 (如: 大客户谈判预测)",
    "conclusion": "核心结论，克制表达，不要绝对化",
    "score": 85,
    "score_basis": {
      "positive_signals": ["用户能听懂的有利因素，不要直接写后端技术标签"],
      "negative_signals": ["用户能听懂的风险因素，不要直接写后端技术标签"],
      "score_logic": "说明后端初分经过你审计后为什么落在这个区间"
    },
    "keyword": "关键信号 (如: 财气通门户，马星催动)"
  },
  "intent_audit": {
    "route_confidence": "${detectedIntent.confidence}",
    "is_route_acceptable": true,
    "suggested_category": "",
    "suggested_subcategory": "",
    "reason": "审计上游分类、subcategory 与取用神规则是否贴合用户问题；若 route_confidence 为 low，必须重点说明"
  },
  "score_audit": {
    "backend_pre_score": ${backendScoreAudit.final_score},
    "audit_delta": 0,
    "final_score_suggestion": ${backendScoreAudit.final_score},
    "confidence": "low|medium|high",
    "missed_or_overweighted_factors": [
      {
        "factor": "后端漏判/误判/过重/过轻的因素",
        "type": "missed|overweighted|underweighted|misread",
        "impact": "+0",
        "reason": "说明教材依据、现实映射和为什么影响 audit_delta"
      }
    ],
    "audit_reason": "用自然语言说明你为什么保留或修正后端初分"
  },
  "analysis": {
    "tensor": "时空能量 (如: 阳遁三局，金水相生)",
    "yong_shen": "用神分析 (详细说明你提取了哪些用神及其生克状态)",
    "bazi_insight": "年命/八字参考 (如提供了八字，请简述年命落宫吉凶及其对大局的影响；若未提供八字，返回空即可)",
    "pattern": "特殊格局 (如: 癸+己华盖地户，需防文书错漏)",
    "god_help": "神助 (如: 临九地，宜长线发展)",
    "dynamic_timing": "动态应期推演 (极其重要！详细说明当天的哪个时辰/未来的哪个日子能冲破阻碍或填实空亡，促成事情发展)"
  },
  "advice": {
    "strategy": [
      "策略1", "策略2"
    ],
    "risk": "避坑指南",
    "lucky_tips": {
      "direction": "有利方位",
      "time": "有利时间",
      "action": "助运行行为"
    }
  },
  "domain_view": {
    "type": "career_business|relationship|finance_wealth|health_action|item_transaction|exam_study|lawsuit_legal|fengshui_house|pregnancy_birth",
    "title": "领域判断标题",
    "axes": [
      {
        "key": "self",
        "label": "本人状态",
        "symbol": "日干",
        "verdict": "该轴的判断结论",
        "evidence": "对应具体宫位/门星神干/空亡马星的依据",
        "tone": "positive|mixed|warning"
      }
    ],
    "process": {
      "label": "流程/阻力/风险",
      "symbols": ["值使门", "时干"],
      "verdict": "过程判断",
      "evidence": "过程依据"
    },
    "timing": {
      "label": "应期",
      "verdict": "应期判断",
      "favorable_window": "有利窗口",
      "trigger": "触发条件"
    },
    "decision": {
      "recommended_action": "建议做法",
      "avoid": "应避免事项"
    }
  },
  "timing_analysis": {
    "method": "qimen-timing-v1",
    "summary": "用一句话概括应期判断，必须基于系统提供的 timing_analysis 候选",
    "primary_window": "最值得观察的时间窗口",
    "primary_trigger": "触发规则，如空亡填实/冲空/马星动/冲墓/逢合逢冲",
    "confidence": "low|medium|high"
  },
  "display_blocks": {
    "situation": "给用户看的局势拆解，隐藏后端技术标签",
    "support": "有利条件，用人话表达",
    "risk": "阻力与不确定性，用人话表达",
    "timing": "时间窗口，只说明可能启动/观察，不保证结果"
  }
}

务必做到有根据、有理论支持，分析的详细还要体会我问问题的心理潜在因素，照顾我的心理感受。你先分析，我下面要问你问题了。
问题：${userQuestion}`;

    // ── SSE Step 5: AI 推演开始 (awaiting LLM) ──
    emit({ type: 'active', index: 5, pct: 78 });

    const aiJsonData = normalizeQimenLlmOutput(await requestLLM(finalPrompt, env, 'gemini-3.1-pro-preview', 0.7));
    const rawLlmScoreAudit = aiJsonData.score_audit || {};
    const auditDelta = parseAuditDelta(rawLlmScoreAudit.audit_delta);
    const finalScore = Math.round(clampNumber(backendScoreAudit.final_score + auditDelta, 0, 100));
    aiJsonData.score_audit = {
        backend_pre_score: backendScoreAudit.final_score,
        audit_delta: auditDelta,
        final_score_suggestion: finalScore,
        confidence: ['low', 'medium', 'high'].includes(rawLlmScoreAudit.confidence) ? rawLlmScoreAudit.confidence : backendScoreAudit.confidence,
        missed_or_overweighted_factors: Array.isArray(rawLlmScoreAudit.missed_or_overweighted_factors)
            ? rawLlmScoreAudit.missed_or_overweighted_factors
            : [],
        audit_reason: rawLlmScoreAudit.audit_reason || '模型未给出额外修正理由，本次沿用后端初算。'
    };
    const rawScoreBasis = (aiJsonData.summary || {}).score_basis || {};
    const sanitizedPositiveSignals = sanitizeSignalList(rawScoreBasis.positive_signals);
    const sanitizedNegativeSignals = sanitizeSignalList(rawScoreBasis.negative_signals);
    const sanitizedScoreLogic = sanitizeUserText(rawScoreBasis.score_logic)
        || `综合用神状态、主客关系、空亡与应期后，本局落在${finalScore >= 75 ? '偏有利' : finalScore >= 60 ? '中等可观察' : finalScore >= 40 ? '偏谨慎' : '明显谨慎'}区间。`;

    aiJsonData.summary = {
        ...(aiJsonData.summary || {}),
        score: finalScore,
        score_basis: {
            positive_signals: sanitizedPositiveSignals,
            negative_signals: sanitizedNegativeSignals,
            score_logic: sanitizedScoreLogic
        }
    };

    let qimenPalaces = [];
    for (let i = 0; i < 9; i++) {
        if (i === 4) {
            qimenPalaces.push({ name: `${palaceNames[i]}${palaceNumbers[i]}宫`, is_center: true, earth: diPan[i], index: i });
        } else {
            qimenPalaces.push({
                star: nineStars[i], sky: tianPanGan[i], ji_sky: (i === tianRuiIndex) ? centerEarthStem : "",
                door: eightDoors[i], god: eightGods[i], earth: diPan[i], ji_earth: (i === 2) ? centerEarthStem : "",
                kong_wang: { day: dayKongIndices.includes(i), is_kong: dayKongIndices.includes(i) || hourKongIndices.includes(i), hour: hourKongIndices.includes(i) },
                ma_xing: { day: i === maXingMap[dayMa], has_ma: i === maXingMap[dayMa] || i === maXingMap[hourMa], hour: i === maXingMap[hourMa] },
                name: `${palaceNames[i]}${palaceNumbers[i]}宫`, index: i
            });
        }
    }

    const finalOutput = {
        ...aiJsonData,
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
            llm_summary: aiJsonData.timing_analysis || null
        },
        qimen_data: {
            status: "success",
            pillars: { hour: ganzhiHour, month: lunar.getMonthInGanZhi(), day: ganzhiDay, year: lunar.getYearInGanZhi() },
            timestamp: { solar: timestamp_solar, lunar: timestamp_lunar },
            ju_info: { zhi_fu: zhiFuStar, zhi_fu_palace: `落${palaceNames[nineStars.indexOf(zhiFuStar)]}${palaceNumbers[nineStars.indexOf(zhiFuStar)]}宫`, zhi_shi_palace: `落${palaceNames[eightDoors.indexOf(zhiShiDoor)]}${palaceNumbers[eightDoors.indexOf(zhiShiDoor)]}宫`, jieqi: juResult.jieQiName, yuan: juResult.yuanName, zhi_shi: zhiShiDoor, name: qimen_structure, xun_shou: xunHead },
            auxiliary: { ma_xing: { day: dayMa, hour: hourMa }, kong_wang: { day: dayKongObj, hour: hourKongObj } },
            palaces: qimenPalaces
        }
    };

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

async function handleBazi(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, request, env);
  try {
    const user = await getAuthedUser(request, env);
    const body = await readJson(request);
    const promptData = body.promptData;
    if (!promptData || !promptData.profileId) return json({ error: "缺少档案 ID" }, { status: 400 }, request, env);

    const whitelist = (env.WHITELIST_EMAILS || "").split(',').map(e => e.trim().toLowerCase());
    const isVIP = whitelist.includes(user.email?.toLowerCase() || "");

    const supabase = createSupabaseClient(env);
    const { data: existingProfile, error: profileError } = await supabase.from('bazi_profiles').select('*').eq('id', promptData.profileId).single();
    if (profileError || !existingProfile) return json({ error: "档案不存在" }, { status: 404 }, request, env);
    if (existingProfile.user_id !== user.id) return json({ error: "无权操作该档案" }, { status: 403 }, request, env);

    if (!isVIP) {
        const { count } = await supabase.from('bazi_profiles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('bazi_summary', 'is', null);
        if (count >= 3 && (!existingProfile || !existingProfile.bazi_summary)) {
            return json({ error: "免费额度已用尽" }, { status: 403 }, request, env);
        }
    }

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

    // ── 模式 2：版本过期但 LLM 已有 → 仅更新引擎数据，保留旧 LLM 断语 ────────
    if (!forceRegenerate && !engineUpToDate && llmExists) {
        console.log('[bazi] 引擎版本升级，仅更新运算数据，保留 LLM 断语');
        const existingLlmData = {
            yuanju_core: existingProfile.llm_yuanju_core,
            current_dayun: existingProfile.llm_current_dayun,
            current_liunian: existingProfile.llm_current_liunian,
        };
        const qualitative = buildQualitativeSections({
            llmSucceeded: true,
            llmQualitativeData: existingLlmData,
            engineQualitativeData
        });
        const finalBaziDetail = {
            ...baziDetail,
            llm_yuanju_core: existingLlmData.yuanju_core,
            llm_current_dayun: existingLlmData.current_dayun,
            llm_current_liunian: existingLlmData.current_liunian,
            engine_yuanju_core: qualitative.engine.yuanju_core,
            engine_current_dayun: qualitative.engine.current_dayun,
            engine_current_liunian: qualitative.engine.current_liunian,
            qualitative
        };
        const combinedResultText = existingProfile.bazi_summary || '';
        const dbUpdatePayload = {
            bazi_detail: finalBaziDetail,
            strong_weak: finalBaziDetail.strong_weak,
            geju: finalBaziDetail.geju,
            shensha: JSON.stringify(finalBaziDetail.shensha),
            engine_yuanju_core: qualitative.engine.yuanju_core,
            engine_current_dayun: qualitative.engine.current_dayun,
            engine_current_liunian: qualitative.engine.current_liunian,
            favorable_elements: finalBaziDetail.favorable_gods,
            unfavorable_elements: finalBaziDetail.unfavorable_gods,
            day_zhi: finalBaziDetail.day_zhi,
            year_zhi: finalBaziDetail.year_zhi,
            month_zhi: finalBaziDetail.month_zhi,
            ri_zhu: finalBaziDetail.ri_zhu
        };
        const { error: dbError } = await supabase.from('bazi_profiles').update(dbUpdatePayload).eq('id', promptData.profileId);
        if (dbError) console.error('[bazi] 引擎刷新写入失败:', dbError);
        return json({
            result: combinedResultText,
            bazi_detail: finalBaziDetail,
            favorable_elements: dbUpdatePayload.favorable_elements,
            unfavorable_elements: dbUpdatePayload.unfavorable_elements,
            engine_refreshed: true,
        }, { status: 200 }, request, env);
    }

    // ── 模式 3：全量重推（force=true 或首次无 LLM）→ 引擎 + LLM 全跑 ─────────
    const promptText = `你是最顶尖的八字命理大师... 

` +
        `命主信息：${promptData.gender}，出生于${promptData.birthStr}。

` +
        `【四柱八字】
${promptData.baziStr}
` +
        `【大运】
${promptData.daYunStr}
` +
        `【格局推断】${geJu}
【日主强弱】${baziDetail.strong_weak}
【喜用神】${(baziDetail.favorable_gods || []).join('、')}
【忌仇神】${(baziDetail.unfavorable_gods || []).join('、')}
【当前大运】${currentDaYunText}
【当前流年】${currentLiuNianText}

` +
        `请返回如下结构的JSON：{"summary":"整体评语", "yuanju_core": "原局核心", "current_dayun": "当前大运", "current_liunian": "当前流年", "favorable_elements": "喜用神", "unfavorable_elements": "忌神"}`;

    const llmJson = await requestLLM(promptText, env, 'gemini-3.1-pro-preview', 0.65);
    const qualitative = buildQualitativeSections({
        llmSucceeded: true,
        llmQualitativeData: llmJson,
        engineQualitativeData
    });
    const finalBaziDetail = {
        ...baziDetail,
        llm_yuanju_core: qualitative.llm.yuanju_core,
        llm_current_dayun: qualitative.llm.current_dayun,
        llm_current_liunian: qualitative.llm.current_liunian,
        engine_yuanju_core: qualitative.engine.yuanju_core,
        engine_current_dayun: qualitative.engine.current_dayun,
        engine_current_liunian: qualitative.engine.current_liunian,
        qualitative
    };
    const combinedResultText = `【命造格局】：${geJu}\n\n原局核心：\n${qualitative.display.yuanju_core}\n\n当前大运：\n${qualitative.display.current_dayun}\n\n当前流年：\n${qualitative.display.current_liunian}`;

    const dbUpdatePayload = {
        bazi_str: promptData.baziStr,
        bazi_detail: finalBaziDetail,
        bazi_summary: combinedResultText,
        strong_weak: finalBaziDetail.strong_weak,
        geju: finalBaziDetail.geju,
        shensha: JSON.stringify(finalBaziDetail.shensha),
        display_yuanju_core: qualitative.display.yuanju_core,
        display_current_dayun: qualitative.display.current_dayun,
        display_current_liunian: qualitative.display.current_liunian,
        llm_yuanju_core: qualitative.llm.yuanju_core,
        llm_current_dayun: qualitative.llm.current_dayun,
        llm_current_liunian: qualitative.llm.current_liunian,
        engine_yuanju_core: qualitative.engine.yuanju_core,
        engine_current_dayun: qualitative.engine.current_dayun,
        engine_current_liunian: qualitative.engine.current_liunian,
        favorable_elements: finalBaziDetail.favorable_gods,
        unfavorable_elements: finalBaziDetail.unfavorable_gods,
        day_zhi: finalBaziDetail.day_zhi,
        year_zhi: finalBaziDetail.year_zhi,
        month_zhi: finalBaziDetail.month_zhi,
        ri_zhu: finalBaziDetail.ri_zhu
    };

    const { error: dbError } = await supabase.from('bazi_profiles').update(dbUpdatePayload).eq('id', promptData.profileId);
    if (dbError) throw dbError;

    const outputPayload = {
        result: combinedResultText,
        bazi_detail: finalBaziDetail,
        favorable_elements: dbUpdatePayload.favorable_elements,
        unfavorable_elements: dbUpdatePayload.unfavorable_elements
    };

    return json(outputPayload, { status: 200 }, request, env);

  } catch (error) {
    console.error('[qimen-api] bazi error:', error);
    const isQuota = error.message && error.message.includes("额度");
    return json({ error: "八字引擎推演失败", details: error.message }, { status: isQuota ? 403 : 500 }, request, env);
  }
}

async function routeRequest(request, env) {
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
    return handleDivinationRoute(request, env);
  }

  if (url.pathname === '/api/fortune-annual') {
    return handleFortuneAnnual(request, env);
  }

  if (url.pathname === '/api/fortune-weekly') return handleFortuneWeekly(request, env);
  if (url.pathname === '/api/fortune-monthly') return handleFortuneMonthly(request, env);
  if (url.pathname === '/api/fortune-daily') return handleFortuneDaily(request, env);

  if (url.pathname === '/api/context-notes') return handleContextNotes(request, env);
  if (url.pathname === '/api/bazi-question') return handleBaziQuestion(request, env);
  if (url.pathname === '/api/bazi-calibrate') return handleBaziCalibrate(request, env);
  if (url.pathname === '/api/fortune-daily-interpretation') return handleFortuneDailyInterpretation(request, env);
  if (url.pathname === '/api/fortune-monthly-interpretation') return handleFortuneMonthlyInterpretation(request, env);
  if (url.pathname === '/api/qimen') return handleQimen(request, env);
  if (url.pathname === '/api/bazi') return handleBazi(request, env);

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
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      console.error('[qimen-api]', error);
      return json({
        error: 'Worker request failed',
        details: error.message,
      }, { status: 500 }, request, env);
    }
  },
};
