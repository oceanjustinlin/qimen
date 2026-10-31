import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import {
  buildZiweiInput,
  createZiweiAstrolabe,
  flowYearAges,
  flyingTargets,
  lunarMonthDates,
  natalMutagens,
  selfMutagenMarks,
  STEM_MUTAGENS,
  ZiweiInputError,
} from './ziweiChart.mjs'

const require = createRequire(import.meta.url)
const { astro } = require('iztro')
const adapter = require('../../lib/ziweiProfileAdapter.cjs')

// 第三方排盘 App 核对过的命例：1998-07-26 18:20（真太阳时）男
const goldenProfile = { gender: '男', birth_date: '1998-07-26 18:35:00', adjusted_birth_date: '1998-07-26 18:20:00' }
const golden = createZiweiAstrolabe(astro, buildZiweiInput(goldenProfile))
const palaceOf = (name) => golden.palaces.find((palace) => palace.name === name)
const starsOf = (name) => palaceOf(name).majorStars.map((star) => `${star.name}${star.brightness}`)

test('输入口径与后端 ziweiProfileAdapter 一致', () => {
  const cases = [
    { gender: '男', birth_date: '1990-05-17 23:20:00' },
    { gender: '女', birth_date: '1990-05-17 00:30:00' },
    { gender: 'female', birth_date: '1995-08-08 10:30:00', adjusted_birth_date: '1995-08-08 09:58:00' },
    { gender: '坤造', birth_date: '1984-02-03T06:15:00' },
    { gender: '乾', birth_date: '2000-01-01 12:59:00', adjusted_birth_date: '' },
  ]
  for (const profile of cases) {
    const ours = buildZiweiInput(profile)
    const theirs = adapter.buildZiweiInput(profile)
    assert.equal(ours.dateStr, theirs.birth.date_str)
    assert.equal(ours.timeIndex, theirs.birth.time_index)
    assert.equal(ours.timeLabel, theirs.birth.time_label)
    assert.equal(ours.gender, theirs.birth.gender)
    assert.equal(ours.timeSource, theirs.source.time_source)
  }
})

test('缺少时辰或性别时给出可读错误', () => {
  assert.throws(() => buildZiweiInput({ gender: '男', birth_date: '1990-05-17' }), ZiweiInputError)
  assert.throws(() => buildZiweiInput({ gender: '', birth_date: '1990-05-17 10:00:00' }), /性别/)
})

test('金标准命例：命宫、五行局、命主身主', () => {
  assert.equal(golden.fiveElementsClass, '水二局')
  assert.equal(golden.soul, '禄存')
  assert.equal(golden.body, '天梁')
  const ming = palaceOf('命宫')
  assert.equal(`${ming.heavenlyStem}${ming.earthlyBranch}`, '壬戌')
  assert.deepEqual(starsOf('命宫'), ['天同平'])
  assert.equal(palaceOf('迁移').isBodyPalace, true)
})

test('金标准命例：主星亮度、生年四化、大限', () => {
  assert.deepEqual(starsOf('仆役'), ['紫微旺', '贪狼利'])
  assert.deepEqual(starsOf('官禄'), ['天机得', '太阴旺'])
  assert.deepEqual(starsOf('子女'), ['廉贞利', '七杀庙'])
  assert.deepEqual(starsOf('父母'), ['武曲平', '破军平'])
  assert.deepEqual(natalMutagens(golden.palaces), { 禄: '贪狼', 权: '太阴', 科: '右弼', 忌: '天机' })
  assert.deepEqual(palaceOf('疾厄').decadal.range, [72, 81])
  assert.equal(palaceOf('疾厄').boshi12, '博士')
})

test('自化与宫干飞化', () => {
  const index = golden.palaces.indexOf(palaceOf('仆役'))
  // 乙卯宫：乙干紫微化科落本宫 → 本宫自化
  assert.deepEqual(selfMutagenMarks(golden.palaces, index)['紫微'], [{ mutagen: '科', kind: 'self' }])
  const ming = golden.palaces.indexOf(palaceOf('命宫'))
  const names = flyingTargets(golden.palaces, ming).map((i) => golden.palaces[i].name)
  assert.deepEqual(STEM_MUTAGENS['壬'], ['天梁', '紫微', '左辅', '武曲'])
  assert.deepEqual(names, ['财帛', '仆役', '兄弟', '父母'])
})

test('流年岁数与流月日期', () => {
  // 1998 戊寅年生，戌年在虚岁 9（2006 丙戌）
  assert.deepEqual(flowYearAges(1998, '戌', 3), [9, 21, 33])
  const months = lunarMonthDates(golden, 2026)
  assert.equal(months.length, 12)
  assert.ok(months.every((month) => month.date instanceof Date))
  assert.equal(golden.horoscope('2026-7-1', 6).yearly.earthlyBranch, '午')
})
