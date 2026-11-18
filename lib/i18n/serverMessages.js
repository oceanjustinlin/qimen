'use strict';
// Worker 错误 code 与默认文案（i18n spec T3.1 / §5.8）。
// 响应里的 error 文本保持现有中文，前端有 code 时用词条显示，没有时显示原文。

const ERROR_CODES = [
  'AUTH_REQUIRED', 'AUTH_FAILED', 'QUOTA_EXCEEDED', 'PROFILE_NOT_FOUND', 'SUMMARY_NOT_READY',
  'LLM_UNAVAILABLE', 'FOLLOWUP_UNAVAILABLE', 'ENGINE_FAILED', 'METHOD_NOT_ALLOWED', 'BAD_REQUEST',
  'FORBIDDEN', 'NOT_FOUND', 'BAZI_PROFILE_INCOMPLETE', 'LLM_UNAVAILABLE_PARTIAL',
];

// i18n-ignore-start
const MESSAGES = {
  'zh-CN': {
    AUTH_REQUIRED: '未登录，请先登录',
    AUTH_FAILED: '认证失败',
    QUOTA_EXCEEDED: '今日额度已用尽，请明日再来',
    PROFILE_NOT_FOUND: '档案不存在',
    SUMMARY_NOT_READY: '断语暂未生成，请稍后重试',
    LLM_UNAVAILABLE: 'AI 推演暂时不可用，请稍后重试',
    FOLLOWUP_UNAVAILABLE: '追问生成暂时不可用，请稍后重试',
    ENGINE_FAILED: '推演失败',
    METHOD_NOT_ALLOWED: 'Method not allowed',
    BAD_REQUEST: '请求参数不完整',
    FORBIDDEN: '无权操作该档案',
    NOT_FOUND: 'Not Found',
    BAZI_PROFILE_INCOMPLETE: '该档案缺少完整八字排盘数据，请先在八字页完成命盘推演',
    LLM_UNAVAILABLE_PARTIAL: 'AI 深度断语暂时不可用，已保留规则引擎结果',
    SCORE_LOGIC_DEFAULT: '综合盘面与评分规则得出。',
  },
  'en-US': {
    SCORE_LOGIC_DEFAULT: 'Derived from the chart and the scoring rules.',
  },
};
// i18n-ignore-end

/** 现有响应的 code：先看显式 code，再按文案关键字，最后按 HTTP 状态兜底。 */
function inferErrorCode(errorText, status) {
  const text = String(errorText || '');
  if (/额度/.test(text)) return 'QUOTA_EXCEEDED'; // i18n-ignore
  if (/未登录|Unauthorized/i.test(text)) return 'AUTH_REQUIRED'; // i18n-ignore
  if (/认证失败/.test(text)) return 'AUTH_FAILED'; // i18n-ignore
  if (/档案不存在/.test(text)) return 'PROFILE_NOT_FOUND'; // i18n-ignore
  if (/无权/.test(text)) return 'FORBIDDEN'; // i18n-ignore
  if (/追问生成/.test(text)) return 'FOLLOWUP_UNAVAILABLE'; // i18n-ignore
  if (/AI 推演暂时不可用/.test(text)) return 'LLM_UNAVAILABLE'; // i18n-ignore
  if (/method not allowed/i.test(text)) return 'METHOD_NOT_ALLOWED';
  if (status === 405) return 'METHOD_NOT_ALLOWED';
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return /not found/i.test(text) ? 'NOT_FOUND' : 'PROFILE_NOT_FOUND';
  if (status >= 400 && status < 500) return 'BAD_REQUEST';
  return 'ENGINE_FAILED';
}

function serverMessage(code, contentLocale = 'zh-CN') {
  const table = MESSAGES[contentLocale] || MESSAGES['zh-CN'];
  return table[code] ?? MESSAGES['zh-CN'][code] ?? '';
}

/** 新代码用：{ body: { error, code, details? }, status }，error 文本取简体默认文案。 */
function apiError(code, { status = 400, details, error } = {}) {
  const body = { error: error || serverMessage(code), code };
  if (details !== undefined) body.details = details;
  return { body, status };
}

/** 抛出带 code 的额度错误（替代 message.includes('额度') 判断）。 */
function quotaError(message, status = 403) {
  const err = new Error(message);
  err.status = status;
  err.code = 'QUOTA_EXCEEDED';
  return err;
}

// i18n-ignore-start
const SCORE_BANDS = {
  'zh-CN': ['偏有利', '中等可观察', '偏谨慎', '明显谨慎'],
  'en-US': ['leaning favourable', 'moderate, worth watching', 'leaning cautious', 'clearly cautious'],
};
// i18n-ignore-end

/** 奇门 score_logic 缺省句：按分数落区间。中文与原句逐字一致。 */
function scoreLogicFallback(score, locale) {
  const n = Number(score) || 0;
  const idx = n >= 75 ? 0 : n >= 60 ? 1 : n >= 40 ? 2 : 3;
  if (locale === 'en-US') {
    return `Weighing the useful god, the host–guest relation, void branches and timing, this chart falls in the ${SCORE_BANDS['en-US'][idx]} range.`;
  }
  return `综合用神状态、主客关系、空亡与应期后，本局落在${SCORE_BANDS['zh-CN'][idx]}区间。`; // i18n-ignore
}

module.exports = { ERROR_CODES, inferErrorCode, serverMessage, apiError, quotaError, scoreLogicFallback };
