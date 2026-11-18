import test from 'node:test'
import assert from 'node:assert/strict'

import { categoryLabel, ganzhiLabel, genderLabel, palaceLabel, scoreBandLabel, symbolLabel, verdictLabel, subcategoryLabel } from './domainLabels.mjs'

test('symbolLabel', () => {
  assert.equal(symbolLabel('开门', 'en-US'), 'Open Door (开门)')
  assert.equal(symbolLabel('开门', 'en-US', { compact: true }), '开门')
  assert.equal(symbolLabel('开门', 'zh-TW'), '开门')
  assert.equal(symbolLabel('开门', 'zh-CN'), '开门')
  assert.equal(symbolLabel('不存在', 'en-US'), '不存在')
})

test('categoryLabel', () => {
  assert.equal(categoryLabel('career_business', 'en-US'), 'Career')
  assert.equal(categoryLabel('career_business', 'zh-CN'), '事业职场')
  assert.equal(categoryLabel('legacy_x', 'en-US'), 'legacy_x')
})

test('ganzhiLabel / palaceLabel', () => {
  assert.equal(ganzhiLabel('丙午', 'en-US'), 'Bing Wu (丙午)')
  assert.equal(ganzhiLabel('丙午', 'zh-CN'), '丙午')
  assert.equal(palaceLabel('震3宫', 'en-US'), 'Zhen 3 (震3宫)')
  assert.equal(palaceLabel('离九宫', 'en-US'), 'Li 9 (离九宫)')
  assert.equal(palaceLabel('震3宫', 'en-US', { compact: true }), '震3宫')
})

test('scoreBandLabel / verdictLabel / genderLabel', () => {
  assert.equal(scoreBandLabel(72, 'en-US'), 'Above Average')
  assert.equal(scoreBandLabel(55, 'zh-CN'), '中平')
  assert.equal(scoreBandLabel('偏凶', 'en-US'), 'Below Average')
  assert.equal(verdictLabel('大吉', 'en-US'), 'Highly Favorable')
  assert.equal(verdictLabel('平', 'zh-CN'), '平')
  assert.equal(genderLabel('M', 'en-US'), 'Male')
  assert.equal(genderLabel('F', 'zh-CN', { zao: true }), '坤造')
  assert.equal(genderLabel('M', 'en-US', { zao: true }), 'Male chart (乾造)')
})

test('空值返回空串，不抛错；入参不被改写', () => {
  for (const fn of [symbolLabel, ganzhiLabel, palaceLabel, categoryLabel, scoreBandLabel, verdictLabel, genderLabel]) {
    for (const v of [undefined, null, '']) assert.equal(fn(v, 'en-US'), '')
  }
  assert.equal(subcategoryLabel('general', '', 'en-US'), '')
  const opts = { compact: false }
  const snapshot = JSON.stringify(opts)
  symbolLabel('开门', 'en-US', opts)
  assert.equal(JSON.stringify(opts), snapshot)
})
