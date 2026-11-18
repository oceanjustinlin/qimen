import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createI18n } from './index.mjs'
import { chipLine, chipLabels, tagLabel, sseText } from './sseLabels.mjs'

const require = createRequire(import.meta.url)
const c = require('../../lib/i18n/sseChips.js')

const ctxFor = (locale) => {
  const i18n = createI18n(locale)
  return { t: i18n.global.t, te: i18n.global.te, locale }
}
const CJK = /[㐀-鿿]/

const allChips = [
  c.qimenCategoryChip('career_business', 'qimen'), c.qimenCategoryChip('x', 'hybrid'),
  c.qimenWindowsChip([]), c.qimenWindowsChip([{}]), c.qimenPreScoreChip(72), c.qimenPreScoreChip(40),
  c.baziCategoryChip('relationship'), c.baziDayMasterChip('甲', ''), c.baziModeChip('pattern', 'bazi'),
  c.baziModeChip('nope'), c.baziScopeChip('current_year', null), c.baziFavorableChip('木'),
]

test('英文：含 key 的 chip 不含汉字（符号参数除外）', () => {
  const ctx = ctxFor('en-US')
  for (const chip of allChips) {
    const symbol = chip.mainParams?.symbol || ''
    const line = chipLine(chip, ctx).replaceAll(symbol, '')
    assert.doesNotMatch(line, CJK, line)
  }
  assert.equal(chipLine(c.qimenPreScoreChip(72), ctx), 'Pre-score 72 · Above Average')
  assert.equal(chipLabels(c.baziDayMasterChip('甲', ''), ctx).main, 'Day Master 甲')
})

test('英文：tag 局名保留原文，其余翻译', () => {
  const ctx = ctxFor('en-US')
  const tags = c.qimenEngineTags({ category: 'general', structure: '阳遁6局', score: 61, windowCount: 2 }).map((t) => tagLabel(t, ctx))
  assert.deepEqual(tags, ['General', '阳遁6局', 'Pre-score 61 · Average', '2 timing windows'])
})

test('中文：一律原文，逐字等于旧字段', () => {
  const ctx = ctxFor('zh-CN')
  for (const chip of allChips) assert.equal(chipLine(chip, ctx), `${chip.main}${chip.sub ? ' · ' + chip.sub : ''}`)
  for (const tag of c.baziEngineTags({ category: 'general', dayMaster: '甲', favorable: '木', mode: 'status' })) {
    assert.equal(tagLabel(tag, ctx), tag.label)
  }
})

test('没有 key 的旧事件：英文也显示原文', () => {
  const ctx = ctxFor('en-US')
  assert.equal(chipLine({ main: '阳遁6局', sub: '戊戌' }, ctx), '阳遁6局 · 戊戌')
  assert.equal(tagLabel({ label: '初分70 · 中上吉' }, ctx), '初分70 · 中上吉')
  assert.equal(sseText('AI 重新推演中…', 'sse.llmRetry', null, ctx), 'Re-running the AI reading…')
  assert.equal(sseText('原文', 'sse.notAKey', null, ctx), '原文')
})

test('sse 词条中英文键一致；中文与 Worker 原文一致', () => {
  const zh = ctxFor('zh-CN')
  assert.equal(zh.t('sse.preScoreDeep', { score: 72 }), '初分 72 · 深度推演')
  assert.equal(zh.t('sse.chip.windowsFound', { n: 3 }), '发现 3 个窗口')
  assert.equal(zh.t('sse.tag.preScoreBand', { score: 61, band: '中平' }), '初分61 · 中平')
})
