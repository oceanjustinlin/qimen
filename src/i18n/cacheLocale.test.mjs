// T3.5：缓存、记录与追问的语言（spec §5.9）
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { buildFortunePeriodKey } = require('../../lib/fortuneDailyCore.js')
const { buildMonthlyInterpretationPeriodKey } = require('../../lib/fortuneMonthlyInterpretationCore.js')
const { appendOutputLanguage, buildOutputLanguageBlock } = require('../../lib/i18n/outputLanguage.js')
const { resolveRequestLocale } = require('../../lib/i18n/requestLocale.js')

const memoryStorage = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
}

test('验收 1：日运 / 月运 period_key，简体逐字不变、英文加 ::en-US', () => {
  assert.equal(buildFortunePeriodKey('2026-11-18', 'p1'), '2026-11-18::p1')
  assert.equal(buildFortunePeriodKey('2026-11-18', 'p1', 'zh-CN'), '2026-11-18::p1')
  assert.equal(buildFortunePeriodKey('2026-11-18', ''), '2026-11-18')
  assert.equal(buildFortunePeriodKey('2026-11-18', 'p1', 'en-US'), '2026-11-18::p1::en-US')
  const zh = buildMonthlyInterpretationPeriodKey('2026-11', 'p1', 'career', 'ctx:a')
  assert.equal(buildMonthlyInterpretationPeriodKey('2026-11', 'p1', 'career', 'ctx:a', 'zh-CN'), zh)
  assert.equal(buildMonthlyInterpretationPeriodKey('2026-11', 'p1', 'career', 'ctx:a', 'en-US'), `${zh}::en-US`)
})

test('验收 2：浏览器缓存，写中文后用英文读同一天同一档案为空', async () => {
  const cache = await import('../fortuneCache.mjs')
  cache.__resetFortuneCacheForTests()
  const storage = memoryStorage()
  const now = new Date('2099-01-01T09:00:00+08:00')
  cache.rememberFortuneCache(storage, 'u1', '2099-01-01', { lang: 'zh' }, now, 'p1')
  cache.__resetFortuneCacheForTests()
  assert.equal(cache.loadCachedFortune(storage, 'u1', '2099-01-01', now, 'p1', 'en-US'), null)
  assert.deepEqual(cache.loadCachedFortune(storage, 'u1', '2099-01-01', now, 'p1', 'zh-CN'), { lang: 'zh' })
  cache.rememberFortuneCache(storage, 'u1', '2099-01-01', { lang: 'en' }, now, 'p1', 'en-US')
  cache.__resetFortuneCacheForTests()
  assert.deepEqual(cache.loadCachedFortune(storage, 'u1', '2099-01-01', now, 'p1', 'en-US'), { lang: 'en' })
  assert.deepEqual(cache.loadCachedFortune(storage, 'u1', '2099-01-01', now, 'p1'), { lang: 'zh' })
  // 进行中的断语请求同样分开
  cache.rememberPendingInterpretation('u1', '2099-01-01', Promise.resolve(1), 'p1', 'en-US')
  assert.equal(cache.getPendingInterpretation('u1', '2099-01-01', 'p1'), null)
})

test('预热：英文读带后缀的行，写英文缓存键', async () => {
  const cache = await import('../fortuneCache.mjs')
  const warm = await import('../fortuneWarmup.mjs')
  cache.__resetFortuneCacheForTests()
  warm.__resetFortuneWarmupForTests()
  const storage = memoryStorage()
  const now = new Date('2099-01-01T09:00:00+08:00')
  let asked = []
  await warm.warmFortuneCache({
    storage, userId: 'u1', now, contentLocale: 'en-US',
    fetchFortunes: async ({ dateKeys }) => { asked = dateKeys; return [{ period_key: '2099-01-01::en-US', data_json: { lang: 'en' } }] },
  })
  assert.ok(asked.every((k) => k.endsWith('::en-US')))
  cache.__resetFortuneCacheForTests()
  assert.deepEqual(cache.loadCachedFortune(storage, 'u1', '2099-01-01', now, '', 'en-US'), { lang: 'en' })
  assert.equal(cache.loadCachedFortune(storage, 'u1', '2099-01-01', now, ''), null)
})

test('验收 3：Worker 内存缓存键英文带 -en-US 后缀', () => {
  const src = readFileSync(new URL('../../worker/src/index.js', import.meta.url), 'utf8')
  assert.match(src, /\$\{baziHash\}\$\{contentLocale === 'en-US' \? '-en-US' : ''\}/)
  assert.match(src, /buildDailyPeriodKey\(todayKey, requestedProfileId, contentLocale\)/)
  assert.match(src, /buildMonthlyInterpretationPeriodKey\(flowMonth\.period_key, profile\.id, dimension, contextSeed, contentLocale\)/)
  // 纯规则接口在 M4 前不加后缀
  assert.match(src, /const periodKey = buildDailyPeriodKey\(todayKey, requestedProfileId\);/)
  // 八字档案记断语语言
  assert.match(src, /display_source: 'llm',\n\s*output_locale: contentLocale/)
})

test('验收 4：前端追问带 originLocale，旧记录按中文', () => {
  const home = readFileSync(new URL('../views/HomeView.vue', import.meta.url), 'utf8')
  assert.match(home, /const originLocale = currentResultData\.value\?\.output_locale \|\| 'zh-CN'/)
  assert.match(home, /localeJson\(\{ followup: q, branch, origin, originLocale \}\)/)
})

test('验收 5：追问语言跟原报告，不跟界面', () => {
  const fromBody = (body) => resolveRequestLocale({ bodyLocale: body.originLocale || body.origin?.output_locale || body.locale }).contentLocale
  const zhPatch = appendOutputLanguage('PATCH', fromBody({ locale: 'en-US', originLocale: 'zh-CN' }))
  assert.equal(zhPatch, 'PATCH')
  const enPatch = appendOutputLanguage('PATCH', fromBody({ locale: 'zh-CN', originLocale: 'en-US' }))
  assert.ok(enPatch.endsWith(buildOutputLanguageBlock('en-US')))
  const src = readFileSync(new URL('../../worker/src/index.js', import.meta.url), 'utf8')
  assert.equal((src.match(/bodyLocale: body\?\.originLocale \|\| origin\.output_locale \|\| body\?\.locale/g) || []).length, 2)
})
