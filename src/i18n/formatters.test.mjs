import test from 'node:test'
import assert from 'node:assert/strict'

import { formatDate, formatDateTime, formatLunarDate, formatNumber } from './formatters.mjs'

test('formatDate', () => {
  const en = formatDate('2026-11-16T04:00:00Z', 'en-US')
  assert.match(en, /2026/)
  assert.doesNotMatch(en, /年/)
  assert.equal(formatDate('2026-11-16T04:00:00Z', 'zh-CN'), new Date('2026-11-16T04:00:00Z').toLocaleDateString('zh-CN'))
  assert.equal(formatDate('2026-11-16T04:00:00Z', 'zh-TW'), new Date('2026-11-16T04:00:00Z').toLocaleDateString('zh-CN'))
})

test('formatLunarDate / formatNumber / formatDateTime', () => {
  assert.equal(formatLunarDate({ month: 3, day: 12, text: '三月十二' }, 'zh-CN'), '三月十二')
  assert.equal(formatLunarDate({ month: 3, day: 12, text: '三月十二' }, 'en-US'), 'Lunar 3rd month, day 12 (三月十二)')
  assert.equal(formatNumber(12345, 'en-US'), '12,345')
  assert.match(formatDateTime('2026-11-16T04:00:00Z', 'en-US'), /2026/)
})

test('空值返回空串', () => {
  for (const fn of [formatDate, formatDateTime, formatNumber, formatLunarDate]) {
    for (const v of [undefined, null, '']) assert.equal(fn(v, 'en-US'), '')
  }
})
