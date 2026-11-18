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
const SCORE_BAND_KEY = { 中上吉: 'aboveAverage', 中平: 'average', 偏凶: 'belowAverage' } // i18n-ignore
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

const VERDICT_KEY = { 大吉: 'great', 小吉: 'good', 平: 'neutral', 凶: 'bad' } // i18n-ignore
export function verdictLabel(zhOrScore, locale) {
  if (empty(zhOrScore)) return ''
  const key = VERDICT_KEY[zhOrScore]
  if (!key) return String(zhOrScore)
  return catalogueFor(locale).enum.verdict[key]
}

export function genderLabel(code, locale, { zao = false } = {}) {
  if (empty(code)) return ''
  const g = code === 'M' || code === '男' ? 'M' : code === 'F' || code === '女' ? 'F' : null // i18n-ignore
  if (!g) return String(code)
  const cat = catalogueFor(locale).enum.gender
  if (!zao) return cat[g]
  const zaoKey = g === 'M' ? 'zaoM' : 'zaoF'
  if (!isEnglish(locale)) return cat[zaoKey]
  return `${cat[zaoKey]} (${zhCN.enum.gender[zaoKey]})`
}

// 应验反馈选项：kind 为 'accuracy' | 'direction'，value 为写库的 code
const FEEDBACK_KINDS = new Set(['accuracy', 'direction'])
export function feedbackOptionLabel(kind, value, locale) {
  if (!FEEDBACK_KINDS.has(kind) || empty(value)) return ''
  return catalogueFor(locale).qimenFeedback[kind][value] ?? String(value)
}

// 历史抽屉的分类筛选用短名
const SHORT_CATEGORY_CODES = new Set(['all', 'career_business', 'finance_wealth', 'relationship', 'health_action', 'item_transaction', 'general'])
export function shortCategoryLabel(code, locale) {
  if (empty(code)) return ''
  if (!SHORT_CATEGORY_CODES.has(code)) return categoryLabel(code, locale)
  return catalogueFor(locale).home.category[code]
}

// 只要英文名、不带汉字括注（如时钟里的「Jia day」）；查不到或非英文时原样返回。
export function symbolName(zh, locale) {
  if (empty(zh)) return ''
  const value = String(zh)
  if (!isEnglish(locale)) return value
  return glossary.toEnglish(value) || composedPatternName(value) || value
}

// 引擎拼出来的格局名：「火土成象」→ Fire-Earth Image；「甲己化土」→ Jia-Ji Transforming to Earth
const EL = '[木火土金水]' // i18n-ignore
const TWO_QI_IMAGE = new RegExp(`^(${EL})(${EL})成象$`) // i18n-ignore
const STEM_TRANSFORM = new RegExp(`^(.)(.)化(${EL})格?$`) // i18n-ignore
function composedPatternName(value) {
  let m = value.match(TWO_QI_IMAGE)
  if (m) return `${glossary.toEnglish(m[1])}-${glossary.toEnglish(m[2])} Image`
  m = value.match(STEM_TRANSFORM)
  if (m && glossary.lookup(m[1])?.group === 'stem' && glossary.lookup(m[2])?.group === 'stem') {
    return `${glossary.toEnglish(m[1])}-${glossary.toEnglish(m[2])} Transforming to ${glossary.toEnglish(m[3])}`
  }
  return ''
}

// 干支只要拼音名：'壬辰' → 'Ren Chen'（英文）；中文原样。
export function ganzhiName(gz, locale) {
  if (empty(gz)) return ''
  const value = String(gz)
  if (!isEnglish(locale)) return value
  return [...value].map((ch) => symbolName(ch, locale)).join(' ')
}

// 盘表「汉字大字＋英文小字」的那行小字（Justin 2026-11-18 拍板）：
//   天干 → 阴阳五行（甲 → Yang Wood），地支 → 生肖（子 → Rat），
//   其他符号 → 术语表英文名（七杀 → Seven Killings）；多字干支（空亡 '戌亥'）→ 逐字拼音。
// 非英文或查不到时返回 ''，调用方据此不渲染小字。
export function symbolHint(zh, locale) {
  if (empty(zh) || !isEnglish(locale)) return ''
  const value = String(zh)
  const entry = glossary.lookup(value)
  if (entry) return entry.desc || entry.en
  const chars = [...value]
  if (chars.length > 1 && chars.every((ch) => glossary.lookup(ch))) {
    return chars.map((ch) => glossary.toEnglish(ch)).join(' ')
  }
  return ''
}

// 十神英文缩写（英文八字软件常用写法），用于大运流年等小标签；查不到原样返回
const TEN_GOD_ABBR = {
  'Friend': 'F', 'Rob Wealth': 'RW', 'Eating God': 'EG', 'Hurting Officer': 'HO',
  'Indirect Wealth': 'IW', 'Direct Wealth': 'DW', 'Seven Killings': '7K',
  'Direct Officer': 'DO', 'Indirect Resource': 'IR', 'Direct Resource': 'DR',
}
export function tenGodAbbr(zh) {
  if (empty(zh)) return ''
  const entry = glossary.lookup(String(zh))
  return (entry && TEN_GOD_ABBR[entry.en]) || String(zh)
}

// 干支合冲刑害：「己癸相克」→ Ji-Gui Control；「甲己合化土」→ Jia-Ji Combine into Earth；
// 「巳午未三会火局」→ Si-Wu-Wei Directional Fire；「子午半三合水局」→ Zi-Wu Half Three Harmony Water。
// 关系译名按英文八字书通行叫法（Clash / Punishment / Harm / Destruction / Six Harmony / Three Harmony）。
const RELATIONS = [ // i18n-ignore-start
  [/^相克$/, () => 'Control'],
  [/^相冲$/, () => 'Clash'],
  [/^相刑$/, () => 'Punishment'],
  [/^自刑$/, () => 'Self Punishment'],
  [/^相害$/, () => 'Harm'],
  [/^相破$/, () => 'Destruction'],
  [/^六合$/, () => 'Six Harmony'],
  [/^合化(.)$/, (m) => `Combine into ${glossary.toEnglish(m[1]) || m[1]}`],
  [/^半三合(.)局$/, (m) => `Half Three Harmony ${glossary.toEnglish(m[1]) || m[1]}`],
  [/^半合(.)局$/, (m) => `Half Three Harmony ${glossary.toEnglish(m[1]) || m[1]}`],
  [/^三合(.)局$/, (m) => `Three Harmony ${glossary.toEnglish(m[1]) || m[1]}`],
  [/^三会(.)局$/, (m) => `Directional ${glossary.toEnglish(m[1]) || m[1]}`],
] // i18n-ignore-end
export function interactionLabel(name, locale) {
  if (empty(name)) return ''
  const value = String(name)
  if (!isEnglish(locale)) return value
  const chars = []
  for (const ch of value) {
    const g = glossary.lookup(ch)?.group
    if (g !== 'stem' && g !== 'branch') break
    chars.push(ch)
  }
  if (chars.length < 2) return value
  const rest = value.slice(chars.join('').length)
  for (const [re, fn] of RELATIONS) {
    const m = rest.match(re)
    if (m) return `${chars.map((c) => glossary.toEnglish(c)).join('-')} ${fn(m)}`
  }
  return value
}
