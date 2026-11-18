// 日期与数字格式化（i18n spec T2.3）。zh-CN / zh-TW 下与原有 toLocaleDateString('zh-CN') 输出一致。
const intlLocale = (locale) => (locale === 'en-US' ? 'en-US' : 'zh-CN')

const STYLES = {
  short: { month: 'numeric', day: 'numeric' },
  medium: undefined,
  long: { year: 'numeric', month: 'long', day: 'numeric' },
}

function toDate(value) {
  if (value === undefined || value === null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value, locale, style = 'medium') {
  const d = toDate(value)
  if (!d) return ''
  if (locale === 'en-US' && style === 'medium') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString(intlLocale(locale), STYLES[style])
}

// 列表里的短日期：英文当年省略年份（Nov 18），跨年带年份（Nov 18, 2025）；中文同「11月18日」/「2025年11月18日」。
export function formatShortDate(value, locale, now = new Date()) {
  const d = toDate(value)
  if (!d) return ''
  const sameYear = d.getFullYear() === now.getFullYear()
  if (locale === 'en-US') {
    return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
  }
  const md = `${d.getMonth() + 1}月${d.getDate()}日` // i18n-ignore
  return sameYear ? md : `${d.getFullYear()}年${md}` // i18n-ignore
}

export function formatDateTime(value, locale) {
  const d = toDate(value)
  if (!d) return ''
  return d.toLocaleString(intlLocale(locale))
}

export function formatNumber(value, locale) {
  if (value === undefined || value === null || value === '' || Number.isNaN(Number(value))) return ''
  return Number(value).toLocaleString(intlLocale(locale))
}

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'] // i18n-ignore
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

// lunarObj: { month: 3, day: 12, isLeap?, text? }；中文原样返回 text（或拼出「三月十二」）
export function formatLunarDate(lunarObj, locale) {
  if (!lunarObj) return ''
  const { month, day, isLeap, text } = lunarObj
  if (locale !== 'en-US') return text || ''
  if (!month || !day) return text || ''
  const label = `Lunar ${isLeap ? 'leap ' : ''}${ordinal(Math.abs(month))} month, day ${day}`
  return text ? `${label} (${text})` : label
}

export { LUNAR_MONTHS }
