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

module.exports = { normalizeUiLocale, contentLocaleOf, resolveRequestLocale, localeCacheSuffix };
