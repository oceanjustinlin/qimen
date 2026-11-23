'use strict';
// 请求语言解析（i18n spec T3.1 / §5.8）。只认请求体或查询串里显式的 locale，不读 Accept-Language，
// 避免老客户端因浏览器语言是英文而突然收到英文内容。纯函数，前后端共用。

const HANS = new Set(['zh', 'zh-cn', 'zh-hans', 'zh-sg', 'zh-hans-cn', 'zh-hans-sg', 'zh-my']);
const HANT = new Set(['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant', 'zh-hant-tw', 'zh-hant-hk', 'zh-hant-mo']);

function normalizeUiLocale(input) {
  if (!input || typeof input !== 'string') return 'zh-CN';
  const tag = input.trim().replace(/_/g, '-').toLowerCase();
  if (HANS.has(tag) || tag.startsWith('zh-hans')) return 'zh-CN';
  if (HANT.has(tag) || tag.startsWith('zh-hant')) return 'zh-TW';
  if (tag === 'en' || tag.startsWith('en-')) return 'en-US';
  return 'zh-CN';
}

function contentLocaleOf(uiLocale) {
  return normalizeUiLocale(uiLocale) === 'en-US' ? 'en-US' : 'zh-CN';
}

/** 请求体优先，其次查询串；缺失或不认识的值归为 zh-CN。 */
function resolveRequestLocale({ bodyLocale, queryLocale } = {}) {
  const uiLocale = normalizeUiLocale(bodyLocale || queryLocale);
  return { uiLocale, contentLocale: contentLocaleOf(uiLocale) };
}

/** 缓存键后缀：简体为空串（键不变，不需要迁移），英文为 '::en-US'。 */
function localeCacheSuffix(contentLocale) {
  return contentLocale === 'en-US' ? '::en-US' : '';
}

// ── 按提问文字判定回答语种 ─────────────────────────────────────────────
// 用户反馈：英文界面里用中文提问，结果却是英文。回答语种应跟随提问语种，界面语言只管界面文字。
// 规则（纯函数，不调模型）：
//   - 有汉字且汉字数 ≥ 拉丁单词数 → zh-CN（「AI 工作 offer 要不要接」算中文）
//   - 否则拉丁单词 ≥ 2 → en-US（「Should I take the offer from 腾讯?」算英文）
//   - 其他（空、只有数字/表情/单个英文词、泰文日文韩文等暂不支持的文字）→ null，交给回落语言
// 简繁：内容语言只有 zh-CN；繁体界面照旧由展示层整页转繁。
const HAN_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;
const LATIN_WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const URL_RE = /\bhttps?:\/\/\S+|\b[\w.+-]+@[\w-]+\.[\w.]+/g;

function detectQueryLocale(text) {
  if (typeof text !== 'string') return null;
  const body = text.replace(URL_RE, ' ');
  const han = (body.match(HAN_RE) || []).length;
  const latinWords = (body.match(LATIN_WORD_RE) || []).length;
  if (han > 0 && han >= latinWords) return 'zh-CN';
  if (latinWords >= 2) return 'en-US';
  return null;
}

/**
 * 问事/追问的内容语言：先看提问文字，判不出再回落。
 * fallbackLocale 缺省时回落到界面语言（bodyLocale/queryLocale）；追问传原报告语言。
 * 返回 { uiLocale, contentLocale, source }，source 为 'query' | 'fallback'。
 */
function resolveAnswerLocale({ text, bodyLocale, queryLocale, fallbackLocale } = {}) {
  const uiLocale = normalizeUiLocale(bodyLocale || queryLocale);
  const detected = detectQueryLocale(text);
  if (detected) return { uiLocale, contentLocale: detected, source: 'query' };
  const contentLocale = fallbackLocale ? contentLocaleOf(fallbackLocale) : contentLocaleOf(uiLocale);
  return { uiLocale, contentLocale, source: 'fallback' };
}

module.exports = {
  normalizeUiLocale,
  contentLocaleOf,
  resolveRequestLocale,
  localeCacheSuffix,
  detectQueryLocale,
  resolveAnswerLocale,
};
