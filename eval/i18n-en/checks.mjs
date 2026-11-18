// i18n T3.7 英文输出自动检查（spec T3.7 表格）。纯函数，可离线单测。
// 输入：{ fields: { name: text }, chartText, zhLimits?: { name: 中文字数上限 }, structureOk?: boolean }
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const glossary = require('../../lib/i18n/glossary.js')
const { proseMatchesLocale } = require('../../lib/i18n/detectProseLocale.js')

export const BANNED = [/\bdefinitely\b/i, /\bguaranteed?\b/i, /100\s*%/, /\bbackend\b/i, /\bengine\b/i, /\bscore of\b/i]
const CJK_RUN = /[㐀-鿿]+/g
const BILINGUAL = /([A-Z][A-Za-z'’\- ]*?(?: \d)?)\s*\(([^()]*[㐀-鿿][^()]*)\)/g
const FAITH_GROUPS = new Set(['door', 'star', 'palace'])

const words = (t) => (String(t || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []).length

export function checkLanguage(fields) {
  const bad = Object.entries(fields).filter(([, t]) => typeof t === 'string' && t.trim() && !proseMatchesLocale(t, 'en-US'))
  return { ok: bad.length === 0, failures: bad.map(([k]) => k) }
}

/** 术语：括注汉字前的英文名与术语表一致；出现的汉字都在术语表或盘面数据里 */
export function checkGlossary(fields, chartText = '') {
  const failures = []
  for (const [name, text] of Object.entries(fields)) {
    for (const m of String(text || '').matchAll(BILINGUAL)) {
      const zh = m[2].trim()
      const entry = glossary.lookup(zh)
      if (entry && !m[1].trim().toLowerCase().endsWith(entry.en.toLowerCase())) failures.push(`${name}: "${m[1].trim()} (${zh})" 应为 "${entry.en}"`)
    }
    for (const run of String(text || '').match(CJK_RUN) || []) {
      const known = glossary.lookup(run) || chartText.includes(run) || [...run].every((ch) => glossary.lookup(ch) || chartText.includes(ch))
      if (!known) failures.push(`${name}: 未知汉字「${run}」`)
    }
  }
  return { ok: failures.length === 0, failures }
}

/** 忠实：正文提到的门、星、宫（英文名）都存在于该局盘面数据 */
export function checkFaithfulness(fields, chartText = '') {
  const failures = []
  const all = Object.values(fields).join('\n')
  for (const e of glossary.entries) {
    if (!FAITH_GROUPS.has(e.group)) continue
    const re = new RegExp(`\\b${e.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (!re.test(all)) continue
    const zhCore = e.group === 'palace' ? e.zh[0] : e.zh
    if (!chartText.includes(zhCore)) failures.push(`提到 ${e.en}（${e.zh}），盘面里没有`)
  }
  return { ok: failures.length === 0, failures }
}

/** 长度：英文词数在「中文字数上限 × 0.6」的 0.5–1.5 倍 */
export function checkLength(fields, zhLimits = {}) {
  const failures = []
  for (const [name, limit] of Object.entries(zhLimits)) {
    const text = fields[name]
    if (typeof text !== 'string' || !limit) continue
    const target = limit * 0.6
    const n = words(text)
    if (n < target * 0.5 || n > target * 1.5) failures.push(`${name}: ${n} 词，目标 ${Math.round(target * 0.5)}–${Math.round(target * 1.5)}`)
  }
  return { ok: failures.length === 0, failures }
}

export function checkBanned(fields) {
  const failures = []
  for (const [name, text] of Object.entries(fields)) {
    for (const re of BANNED) if (re.test(String(text || ''))) failures.push(`${name}: ${re}`)
  }
  return { ok: failures.length === 0, failures }
}

export function runChecks({ fields, chartText = '', zhLimits = {}, structureOk = true }) {
  return {
    structure: { ok: !!structureOk, failures: structureOk ? [] : ['结构不完整'] },
    language: checkLanguage(fields),
    glossary: checkGlossary(fields, chartText),
    faithfulness: checkFaithfulness(fields, chartText),
    length: checkLength(fields, zhLimits),
    banned: checkBanned(fields),
  }
}

/** 汇总：结构、语言须 100%；其余各项 ≥ 90% */
export function summarize(results) {
  const keys = ['structure', 'language', 'glossary', 'faithfulness', 'length', 'banned']
  const rate = Object.fromEntries(keys.map((k) => [k, results.filter((r) => r.checks[k].ok).length / (results.length || 1)]))
  const pass = rate.structure === 1 && rate.language === 1 && ['glossary', 'faithfulness', 'length', 'banned'].every((k) => rate[k] >= 0.9)
  return { rate, pass }
}
