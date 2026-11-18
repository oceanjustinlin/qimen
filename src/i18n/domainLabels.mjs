// 符号与枚举的显示适配器（i18n spec T2.3）。只负责显示，永不改写入参。
// 显示规则：
//   zh-CN / zh-TW：原值（繁体交给展示层转换）
//   en-US 紧凑位（盘面格子、方印、四柱、chip）：原值汉字
//   en-US 展开位：`English (汉字)`，例如 `Open Door (开门)`
// 动态拼词条键只允许出现在本文件，且一律走下面的显式映射表。
import glossaryModule from '../../lib/i18n/glossary.js'
import enUS from './locales/en-US.mjs'
import zhCN from './locales/zh-CN.mjs'

const glossary = glossaryModule.default || glossaryModule

const isEnglish = (locale) => locale === 'en-US'
const empty = (v) => v === undefined || v === null || v === ''
const catalogueFor = (locale) => (isEnglish(locale) ? enUS : zhCN)

export function symbolLabel(zh, locale, { compact = false } = {}) {
  if (empty(zh)) return ''
  const value = String(zh)
  if (!isEnglish(locale) || compact) return value
  return glossary.formatBilingual(value)
}

// '丙午' → 'Bing Wu (丙午)'；查不到的字原样保留
export function ganzhiLabel(gz, locale, { compact = false } = {}) {
  if (empty(gz)) return ''
  const value = String(gz)
  if (!isEnglish(locale) || compact) return value
  const parts = [...value].map((ch) => glossary.toEnglish(ch))
  if (parts.some((p) => !p)) return glossary.formatBilingual(value)
  return `${parts.join(' ')} (${value})`
}

// '震3宫' / '震三宫' / '震' → 'Zhen 3 (震3宫)'
export function palaceLabel(name, locale, { compact = false } = {}) {
  if (empty(name)) return ''
  const value = String(name)
  if (!isEnglish(locale) || compact) return value
  const direct = glossary.lookup(value)
  if (direct && direct.group === 'palace') return `${direct.en} (${value})`
  const trigram = glossary.lookup(value[0])
  if (trigram && trigram.group === 'palace') return `${trigram.en} (${value})`
  return value
}

// 一级分类 code → 显示名；未知 code 原样返回
const CATEGORY_CODES = new Set(Object.keys(zhCN.enum.category))
export function categoryLabel(code, locale) {
  if (empty(code)) return ''
  if (!CATEGORY_CODES.has(code)) return String(code)
  return catalogueFor(locale).enum.category[code]
}

// 二级分类：中文取 lib/divinationCategories 的 label（由调用方传入映射），英文取术语表的一级分类名兜底
export function subcategoryLabel(category, code, locale, labels = {}) {
  if (empty(code)) return ''
  const zh = labels?.[category]?.[code] ?? labels?.[code]
  if (!isEnglish(locale)) return zh ?? String(code)
  return categoryLabel(category, locale) || String(code)
}

// 与 Worker 的 QIMEN_SCORE_LABEL 三档一致
const SCORE_BAND_KEY = { 中上吉: 'aboveAverage', 中平: 'average', 偏凶: 'belowAverage' }
export function scoreBandLabel(score, locale) {
  if (empty(score)) return ''
  let key
  if (typeof score === 'number' || /^\d+(\.\d+)?$/.test(String(score))) {
    const s = Number(score)
    key = s >= 70 ? 'aboveAverage' : s >= 50 ? 'average' : 'belowAverage'
  } else {
    key = SCORE_BAND_KEY[score]
    if (!key) return String(score)
  }
  return catalogueFor(locale).enum.scoreBand[key]
}

const VERDICT_KEY = { 大吉: 'great', 小吉: 'good', 平: 'neutral', 凶: 'bad' }
export function verdictLabel(zhOrScore, locale) {
  if (empty(zhOrScore)) return ''
  const key = VERDICT_KEY[zhOrScore]
  if (!key) return String(zhOrScore)
  return catalogueFor(locale).enum.verdict[key]
}

export function genderLabel(code, locale, { zao = false } = {}) {
  if (empty(code)) return ''
  const g = code === 'M' || code === '男' ? 'M' : code === 'F' || code === '女' ? 'F' : null
  if (!g) return String(code)
  const cat = catalogueFor(locale).enum.gender
  if (!zao) return cat[g]
  const zaoKey = g === 'M' ? 'zaoM' : 'zaoF'
  if (!isEnglish(locale)) return cat[zaoKey]
  return `${cat[zaoKey]} (${zhCN.enum.gender[zaoKey]})`
}
