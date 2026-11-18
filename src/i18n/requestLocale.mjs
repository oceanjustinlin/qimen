// 前端请求带界面语言（i18n spec T3.1 / §5.8）。发往 Worker 的 /api/* 请求统一经过这里；
// 发往 functions/auth/* 的不加。
import i18n from './index.mjs'

const currentUiLocale = () => i18n.global.locale.value

/** { ...body, locale } */
export function withLocale(body = {}, locale = currentUiLocale()) {
  return { ...body, locale }
}

/** 等同 JSON.stringify(withLocale(body))，方便替换 fetch 里的 body。 */
export function localeJson(body = {}, locale = currentUiLocale()) {
  return JSON.stringify(withLocale(body, locale))
}

/** 追加或覆盖查询串里的 locale=（保留 hash）。 */
export function withLocaleQuery(url, locale = currentUiLocale()) {
  const text = String(url)
  const hashAt = text.indexOf('#')
  const hash = hashAt >= 0 ? text.slice(hashAt) : ''
  const beforeHash = hashAt >= 0 ? text.slice(0, hashAt) : text
  const [path, query = ''] = beforeHash.split('?')
  const params = query.split('&').filter((p) => p && !p.startsWith('locale='))
  params.push(`locale=${encodeURIComponent(locale)}`)
  return `${path}?${params.join('&')}${hash}`
}

/**
 * 错误显示：有 code 且词条存在就用词条，否则用服务端原文。
 * 这是允许动态拼键的第二处，仅限 `error.` 前缀，存在性用 te 检查。
 */
export function apiErrorText(payload, { t, te }, fallback = '') {
  const code = payload?.code
  if (code && te(`error.${code}`)) return t(`error.${code}`)
  return payload?.error || payload?.message || fallback
}

/**
 * 保持中文界面行为不变的版本：只有英文界面且 code 有词条时才换成词条，否则返回调用方原来的文字。
 * ctx.locale 是当前界面语言（字符串）。
 */
export function localizeApiError(payload, ctx, raw) {
  const code = payload?.code
  if (ctx?.locale === 'en-US' && code && ctx.te(`error.${code}`)) return ctx.t(`error.${code}`)
  return raw
}
