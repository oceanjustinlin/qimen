import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLunarProfilePayload,
  buildBaziProfileInsertPayload,
  buildPillarsProfilePayload,
  buildSolarProfilePayload,
  canRetryLegacyBaziProfileInsert,
  getAllowedMonthBranchesByStem,
  getAllowedTimeBranchesByStem,
  getChinaDaylightSavingAdjustment,
  getEquationOfTimeMinutes,
  getSolarTimeAdjustment,
  isMissingBaziProfileSolarTimeColumnError,
  getMonthStemByYearStem,
  getTimeStemByDayStem,
  normalizeLongitude,
  normalizePillarsByDunRules,
  parseCompactSolarInput
} from './baziProfileInput.mjs'

test('parseCompactSolarInput supports yyyyMMddHHmm format', () => {
  assert.deepEqual(parseCompactSolarInput('199303270255'), {
    year: 1993,
    month: 3,
    day: 27,
    hour: 2,
    minute: 55
  })
})

test('buildSolarProfilePayload derives birth_date and bazi_str from solar datetime', () => {
  const payload = buildSolarProfilePayload({
    name: '测试',
    gender: 'M',
    year: 1999,
    month: 6,
    day: 7,
    hour: 9,
    minute: 11
  })

  assert.equal(payload.birth_date, '1999-06-07 09:11:00')
  assert.equal(payload.bazi_str, '己卯 庚午 庚寅 辛巳')
})

test('buildSolarProfilePayload can derive bazi from birthplace solar time', () => {
  const payload = buildSolarProfilePayload({
    name: '测试',
    gender: 'M',
    year: 1999,
    month: 6,
    day: 7,
    hour: 23,
    minute: 20,
    birthLocation: '成都',
    birthLatitude: 30.5728,
    birthLongitude: 104.0668,
    solarTimeMode: 'mean'
  })

  assert.equal(payload.birth_date, '1999-06-07 23:20:00')
  assert.equal(payload.adjusted_birth_date, '1999-06-07 22:16:00')
  assert.equal(payload.bazi_str, '己卯 庚午 庚寅 丁亥')
  assert.equal(payload.birth_location, '成都')
  assert.equal(payload.birth_latitude, 30.5728)
  assert.equal(payload.birth_longitude, 104.0668)
  assert.equal(payload.solar_time_adjustment_minutes, -64)
})

test('bazi profile insert payload can omit new solar-time columns for legacy schemas', () => {
  const payload = buildSolarProfilePayload({
    name: '测试',
    gender: 'M',
    year: 1998,
    month: 10,
    day: 8,
    hour: 15,
    minute: 30
  })

  assert.deepEqual(buildBaziProfileInsertPayload('user-1', payload, { includeSolarTimeColumns: false }), {
    user_id: 'user-1',
    name: '测试',
    gender: 'M',
    birth_date: '1998-10-08 15:30:00',
    bazi_str: '戊寅 辛酉 戊子 庚申'
  })
})

test('legacy profile retry is limited to profiles without solar-time correction', () => {
  const clockPayload = buildSolarProfilePayload({
    name: '测试',
    gender: 'M',
    year: 1998,
    month: 10,
    day: 8,
    hour: 15,
    minute: 30
  })
  const correctedPayload = buildSolarProfilePayload({
    name: '测试',
    gender: 'M',
    year: 1999,
    month: 6,
    day: 7,
    hour: 23,
    minute: 20,
    birthLocation: '成都',
    birthLatitude: 30.5728,
    birthLongitude: 104.0668,
    solarTimeMode: 'mean'
  })

  assert.equal(canRetryLegacyBaziProfileInsert(clockPayload), true)
  assert.equal(canRetryLegacyBaziProfileInsert(correctedPayload), false)
})

test('missing bazi profile solar-time column errors are detected from Supabase schema cache messages', () => {
  assert.equal(
    isMissingBaziProfileSolarTimeColumnError({
      message: "Could not find the 'birth_latitude' column of 'bazi_profiles' in the schema cache"
    }),
    true
  )
  assert.equal(isMissingBaziProfileSolarTimeColumnError({ message: 'permission denied' }), false)
})

test('solar time adjustment supports apparent time and longitude validation', () => {
  assert.equal(normalizeLongitude('104.0668'), 104.0668)
  assert.equal(normalizeLongitude('181'), null)

  const adjustment = getSolarTimeAdjustment({
    year: 1999,
    month: 6,
    day: 7,
    hour: 23,
    minute: 20,
    longitude: 104.0668,
    mode: 'apparent'
  })

  assert.equal(adjustment.totalMinutes, -62)
  assert.deepEqual(adjustment.adjusted, {
    year: 1999,
    month: 6,
    day: 7,
    hour: 22,
    minute: 18
  })
})

test('mainland China daylight saving time subtracts one hour before solar-time correction', () => {
  const daylightSaving = getChinaDaylightSavingAdjustment({
    year: 1990,
    month: 6,
    day: 1,
    hour: 6,
    minute: 30,
    country: '中国',
    admin1: '北京'
  })

  assert.equal(daylightSaving.minutes, -60)

  const adjustment = getSolarTimeAdjustment({
    year: 1990,
    month: 6,
    day: 1,
    hour: 6,
    minute: 30,
    longitude: 116.4074,
    mode: 'mean',
    country: '中国',
    admin1: '北京'
  })

  assert.equal(adjustment.daylightSavingMinutes, -60)
  assert.ok(Math.abs(adjustment.longitudeMinutes - -14.3704) < 0.0001)
  assert.equal(adjustment.totalMinutes, -74)
  assert.deepEqual(adjustment.adjusted, {
    year: 1990,
    month: 6,
    day: 1,
    hour: 5,
    minute: 16
  })
})

test('China daylight saving auto mode excludes Hong Kong, Macau, and Taiwan', () => {
  const base = { year: 1990, month: 6, day: 1, hour: 6, minute: 30, country: '中国' }

  assert.equal(getChinaDaylightSavingAdjustment({ ...base, admin1: '香港' }).minutes, 0)
  assert.equal(getChinaDaylightSavingAdjustment({ ...base, admin1: '澳门' }).minutes, 0)
  assert.equal(getChinaDaylightSavingAdjustment({ ...base, admin1: '台湾' }).minutes, 0)
})

test('China daylight saving respects transition-day clock boundaries', () => {
  const base = { year: 1990, country: '中国', admin1: '北京' }

  assert.equal(getChinaDaylightSavingAdjustment({ ...base, month: 4, day: 15, hour: 1, minute: 30 }).minutes, 0)
  assert.equal(getChinaDaylightSavingAdjustment({ ...base, month: 4, day: 15, hour: 3, minute: 0 }).minutes, -60)
  assert.equal(getChinaDaylightSavingAdjustment({ ...base, month: 9, day: 16, hour: 1, minute: 30 }).minutes, -60)
  assert.equal(getChinaDaylightSavingAdjustment({ ...base, month: 9, day: 16, hour: 2, minute: 0 }).minutes, 0)
})

test('buildLunarProfilePayload converts lunar birth into solar birth_date', () => {
  const payload = buildLunarProfilePayload({
    name: '测试',
    gender: 'F',
    year: 1989,
    month: 12,
    day: 5,
    hour: 0,
    minute: 0
  })

  assert.equal(payload.birth_date, '1990-01-01 00:00:00')
  assert.equal(payload.bazi_str, '己巳 丙子 丙寅 戊子')
})

test('五虎遁 derives month stem from year stem and month branch', () => {
  assert.equal(getMonthStemByYearStem('己', '寅'), '丙')
  assert.equal(getMonthStemByYearStem('己', '午'), '庚')
  assert.equal(getMonthStemByYearStem('庚', '午'), '壬')
})

test('五鼠遁 derives time stem from day stem and time branch', () => {
  assert.equal(getTimeStemByDayStem('甲', '子'), '甲')
  assert.equal(getTimeStemByDayStem('甲', '巳'), '己')
  assert.equal(getTimeStemByDayStem('庚', '巳'), '辛')
})

test('month stem and time stem each map to six legal branches', () => {
  assert.deepEqual(getAllowedMonthBranchesByStem('丁'), ['卯', '巳', '未', '酉', '亥', '丑'])
  assert.deepEqual(getAllowedTimeBranchesByStem('丙'), ['子', '寅', '辰', '午', '申', '戌'])
})

test('normalizePillarsByDunRules adjusts month and time pillars to valid stems', () => {
  assert.deepEqual(
    normalizePillarsByDunRules({
      yearPillar: '己卯',
      monthPillar: '甲午',
      dayPillar: '庚寅',
      timePillar: '甲巳'
    }),
    {
      yearPillar: '己卯',
      monthPillar: '庚午',
      dayPillar: '庚寅',
      timePillar: '辛巳'
    }
  )
})

test('buildPillarsProfilePayload reverse-matches four pillars to a solar date', () => {
  const payload = buildPillarsProfilePayload({
    name: '测试',
    gender: 'M',
    yearPillar: '己卯',
    monthPillar: '庚午',
    dayPillar: '庚寅',
    timePillar: '辛巳'
  })

  assert.equal(payload.birth_date, '1999-06-07 10:30:00')
  assert.equal(payload.bazi_str, '己卯 庚午 庚寅 辛巳')
  assert.ok(payload.matches.length >= 1)
})

// ---- 海外 / 港澳台出生地：按出生地 IANA 时区计算标准经线与夏令时 ----
// 独立推导：真太阳时(平) = UTC + 经度×4 分钟，而 UTC = 当地钟表 − 当时总 UTC 偏移，
// 所以修正量 = 经度×4 − 总偏移(分钟)（apparent 模式再加时差方程）。

test('overseas: New York 1990-05-01 14:00 uses EST meridian (-75°) plus US daylight saving', () => {
  const adjustment = getSolarTimeAdjustment({
    year: 1990, month: 5, day: 1, hour: 14, minute: 0,
    longitude: -74.006, country: '美国', admin1: '纽约州',
    timeZone: 'America/New_York', mode: 'mean'
  })
  // EDT = UTC-4 → -74.006×4 − (−240) = −56.024
  assert.equal(adjustment.standardMeridian, -75)
  assert.equal(adjustment.daylightSavingMinutes, -60)
  assert.equal(adjustment.daylightSavingActive, true)
  assert.ok(Math.abs(adjustment.longitudeMinutes - 3.976) < 0.0001)
  assert.equal(adjustment.totalMinutes, Math.round(-74.006 * 4 + 240))
  assert.equal(adjustment.totalMinutes, -56)
  assert.deepEqual(adjustment.adjusted, { year: 1990, month: 5, day: 1, hour: 13, minute: 4 })

  const apparent = getSolarTimeAdjustment({
    year: 1990, month: 5, day: 1, hour: 14, minute: 0,
    longitude: -74.006, timeZone: 'America/New_York', mode: 'apparent'
  })
  assert.equal(apparent.totalMinutes, Math.round(-74.006 * 4 + 240 + getEquationOfTimeMinutes(1990, 5, 1)))
  assert.equal(apparent.adjusted.hour, 13)
})

test('overseas: London uses GMT meridian and BST only in summer', () => {
  const summer = getSolarTimeAdjustment({
    year: 1990, month: 7, day: 1, hour: 12, minute: 0,
    longitude: -0.1276, timeZone: 'Europe/London', mode: 'mean'
  })
  // BST = UTC+1 → −0.1276×4 − 60 = −60.5104
  assert.equal(summer.standardMeridian, 0)
  assert.equal(summer.daylightSavingMinutes, -60)
  assert.equal(summer.totalMinutes, Math.round(-0.1276 * 4 - 60))
  assert.deepEqual(summer.adjusted, { year: 1990, month: 7, day: 1, hour: 10, minute: 59 })

  const winter = getSolarTimeAdjustment({
    year: 1990, month: 1, day: 15, hour: 12, minute: 0,
    longitude: -0.1276, timeZone: 'Europe/London', mode: 'mean'
  })
  assert.equal(winter.daylightSavingMinutes, 0)
  assert.equal(winter.daylightSavingActive, false)
  assert.equal(winter.totalMinutes, Math.round(-0.1276 * 4))
})

test('overseas: Tokyo uses JST meridian 135° without daylight saving', () => {
  const adjustment = getSolarTimeAdjustment({
    year: 1990, month: 5, day: 1, hour: 12, minute: 0,
    longitude: 139.6503, timeZone: 'Asia/Tokyo', mode: 'mean'
  })
  // JST = UTC+9 → 139.6503×4 − 540 = 18.6012
  assert.equal(adjustment.standardMeridian, 135)
  assert.equal(adjustment.daylightSavingMinutes, 0)
  assert.equal(adjustment.totalMinutes, Math.round(139.6503 * 4 - 540))
  assert.equal(adjustment.totalMinutes, 19)
  assert.deepEqual(adjustment.adjusted, { year: 1990, month: 5, day: 1, hour: 12, minute: 19 })
})

test('overseas: Sydney applies southern-hemisphere daylight saving in January only', () => {
  const january = getSolarTimeAdjustment({
    year: 1990, month: 1, day: 15, hour: 12, minute: 0,
    longitude: 151.2093, timeZone: 'Australia/Sydney', mode: 'mean'
  })
  // AEDT = UTC+11 → 151.2093×4 − 660 = −55.1628
  assert.equal(january.standardMeridian, 150)
  assert.equal(january.daylightSavingMinutes, -60)
  assert.equal(january.daylightSavingActive, true)
  assert.equal(january.totalMinutes, Math.round(151.2093 * 4 - 660))
  assert.equal(january.totalMinutes, -55)
  assert.deepEqual(january.adjusted, { year: 1990, month: 1, day: 15, hour: 11, minute: 5 })

  const july = getSolarTimeAdjustment({
    year: 1990, month: 7, day: 15, hour: 12, minute: 0,
    longitude: 151.2093, timeZone: 'Australia/Sydney', mode: 'mean'
  })
  // AEST = UTC+10 → 151.2093×4 − 600 = 4.8372
  assert.equal(july.daylightSavingMinutes, 0)
  assert.equal(july.totalMinutes, Math.round(151.2093 * 4 - 600))
})

test('Hong Kong uses its own zone: no mainland 1986–1991 DST, but historical HK summer time applies', () => {
  const in1990 = getSolarTimeAdjustment({
    year: 1990, month: 6, day: 1, hour: 12, minute: 0,
    longitude: 114.1694, country: '中国', admin1: '港澳台',
    timeZone: 'Asia/Hong_Kong', mode: 'mean'
  })
  // HKT = UTC+8 → 114.1694×4 − 480 = −23.3224
  assert.equal(in1990.standardMeridian, 120)
  assert.equal(in1990.daylightSavingMinutes, 0)
  assert.equal(in1990.totalMinutes, Math.round(114.1694 * 4 - 480))
  assert.equal(in1990.totalMinutes, -23)

  const in1975 = getSolarTimeAdjustment({
    year: 1975, month: 6, day: 1, hour: 12, minute: 0,
    longitude: 114.1694, country: '中国', admin1: '港澳台',
    timeZone: 'Asia/Hong_Kong', mode: 'mean'
  })
  // 1975 年香港夏令时 HKST = UTC+9 → −83.3224
  assert.equal(in1975.daylightSavingMinutes, -60)
  assert.equal(in1975.totalMinutes, Math.round(114.1694 * 4 - 540))
})

test('Taiwan records grouped under 港澳台 no longer receive mainland 1986–1991 DST', () => {
  assert.equal(getChinaDaylightSavingAdjustment({
    year: 1990, month: 6, day: 1, hour: 6, country: '中国', admin1: '港澳台'
  }).minutes, 0)
})

test('Asia/Shanghai keeps the legacy mainland behaviour (120° meridian, 1986–1991 DST table)', () => {
  const base = { year: 1990, month: 6, day: 1, hour: 6, minute: 30, longitude: 116.4074, mode: 'mean', country: '中国', admin1: '北京' }
  const legacy = getSolarTimeAdjustment(base)
  const zoned = getSolarTimeAdjustment({ ...base, timeZone: 'Asia/Shanghai' })
  assert.deepEqual(zoned, { ...legacy, timeZone: 'Asia/Shanghai' })
  assert.equal(zoned.totalMinutes, -74)

  const urumqi = getSolarTimeAdjustment({
    year: 1990, month: 6, day: 1, hour: 12, minute: 0, longitude: 87.6168,
    mode: 'mean', country: '中国', admin1: '新疆', timeZone: 'Asia/Shanghai'
  })
  assert.equal(urumqi.standardMeridian, 120)
  assert.equal(urumqi.totalMinutes, Math.round((87.6168 - 120) * 4 - 60))
})

test('clock mode overseas only removes daylight saving, without longitude correction', () => {
  const adjustment = getSolarTimeAdjustment({
    year: 1990, month: 5, day: 1, hour: 14, minute: 0,
    longitude: -74.006, timeZone: 'America/New_York', mode: 'clock'
  })
  assert.equal(adjustment.mode, 'clock')
  assert.equal(adjustment.totalMinutes, -60)
  assert.deepEqual(adjustment.adjusted, { year: 1990, month: 5, day: 1, hour: 13, minute: 0 })
})

test('buildSolarProfilePayload honours birthTimeZone for overseas births', () => {
  const payload = buildSolarProfilePayload({
    name: '纽约测试', gender: 'M',
    year: 1990, month: 5, day: 1, hour: 14, minute: 0,
    birthLocation: '纽约 · 纽约州 · 美国', birthCountry: '美国', birthAdmin1: '纽约州',
    birthLatitude: 40.7128, birthLongitude: -74.006,
    birthTimeZone: 'America/New_York', solarTimeMode: 'mean'
  })
  assert.equal(payload.adjusted_birth_date, '1990-05-01 13:04:00')
  assert.equal(payload.solar_time_adjustment_minutes, -56)
  assert.equal(payload.bazi_str, '庚午 庚辰 丙寅 乙未')
  // 旧逻辑按北京时间换算成 01:07，时柱错为己丑
})

test('every birthplace record carries a valid IANA time zone', async () => {
  const { BIRTHPLACES } = await import('../data/birthplaces.mjs')
  for (const place of BIRTHPLACES) {
    assert.ok(place.timeZone, `${place.name} 缺少 timeZone`)
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: place.timeZone }))
  }
  const byName = (name) => BIRTHPLACES.find((place) => place.name === name)
  assert.equal(byName('北京市').timeZone, 'Asia/Shanghai')
  assert.equal(byName('乌鲁木齐市').timeZone, 'Asia/Shanghai')
  assert.equal(byName('香港').timeZone, 'Asia/Hong_Kong')
  assert.equal(byName('澳门').timeZone, 'Asia/Macau')
  assert.equal(byName('台北市').timeZone, 'Asia/Taipei')
  assert.equal(byName('纽约').timeZone, 'America/New_York')
  assert.equal(byName('伦敦').timeZone, 'Europe/London')
  assert.equal(byName('东京').timeZone, 'Asia/Tokyo')
})
