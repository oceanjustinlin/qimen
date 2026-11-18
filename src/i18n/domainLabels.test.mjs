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

test('ganzhiName 只给拼音名', async () => {
  const { ganzhiName } = await import('./domainLabels.mjs')
  assert.equal(ganzhiName('壬辰', 'en-US'), 'Ren Chen')
  assert.equal(ganzhiName('壬辰', 'zh-CN'), '壬辰')
})

test('symbolHint: 盘表英文小字', async () => {
  const { symbolHint } = await import('./domainLabels.mjs')
  assert.equal(symbolHint('甲', 'en-US'), 'Yang Wood')
  assert.equal(symbolHint('子', 'en-US'), 'Rat')
  assert.equal(symbolHint('七杀', 'en-US'), 'Seven Killings')
  assert.equal(symbolHint('元男', 'en-US'), 'Day Master')
  assert.equal(symbolHint('天乙', 'en-US'), 'Heavenly Nobleman')
  assert.equal(symbolHint('海中金', 'en-US'), 'Gold in the Sea')
  assert.equal(symbolHint('戌亥', 'en-US'), 'Xu Hai')
  assert.equal(symbolHint('帝旺', 'en-US'), 'Peak')
  assert.equal(symbolHint('甲', 'zh-CN'), '')
  assert.equal(symbolHint('不存在的词', 'en-US'), '')
})

test('tenGodAbbr: 单字与全称都能缩写', async () => {
  const { tenGodAbbr } = await import('./domainLabels.mjs')
  assert.equal(tenGodAbbr('枭'), 'IR')
  assert.equal(tenGodAbbr('杀'), '7K')
  assert.equal(tenGodAbbr('才'), 'IW')
  assert.equal(tenGodAbbr('正官'), 'DO')
  assert.equal(tenGodAbbr('比'), 'F')
  assert.equal(tenGodAbbr('未知'), '未知')
})

test('symbolName: 引擎拼出的格局名', async () => {
  const { symbolName } = await import('./domainLabels.mjs')
  assert.equal(symbolName('火土成象', 'en-US'), 'Fire-Earth Image')
  assert.equal(symbolName('甲己化土', 'en-US'), 'Jia-Ji Transforming to Earth')
  assert.equal(symbolName('金白水清', 'en-US'), 'Pure Metal, Clear Water')
  assert.equal(symbolName('火土成象', 'zh-CN'), '火土成象')
})

test('interactionLabel: 合冲刑害英文', async () => {
  const { interactionLabel } = await import('./domainLabels.mjs')
  assert.equal(interactionLabel('己癸相克', 'en-US'), 'Ji-Gui Control')
  assert.equal(interactionLabel('甲己合化土', 'en-US'), 'Jia-Ji Combine into Earth')
  assert.equal(interactionLabel('子午相冲', 'en-US'), 'Zi-Wu Clash')
  assert.equal(interactionLabel('巳午未三会火局', 'en-US'), 'Si-Wu-Wei Directional Fire')
  assert.equal(interactionLabel('辰辰自刑', 'en-US'), 'Chen-Chen Self Punishment')
  assert.equal(interactionLabel('子午相冲', 'zh-CN'), '子午相冲')
  assert.equal(interactionLabel('奇怪的', 'en-US'), '奇怪的')
})
