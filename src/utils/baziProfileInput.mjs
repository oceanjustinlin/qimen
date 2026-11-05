import { Lunar, Solar } from 'lunar-javascript'

export const ENTRY_MODE = {
  SOLAR: 'solar',
  LUNAR: 'lunar',
  PILLARS: 'pillars'
}

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
export const JIA_ZI = (() => {
  const list = []
  for (let i = 0; i < 60; i += 1) {
    list.push(GAN[i % GAN.length] + ZHI[i % ZHI.length])
  }
  return list
})()

const MONTH_ZHI_ORDER = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
const TIME_ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const WU_HU_DUN_START = {
  甲: '丙',
  己: '丙',
  乙: '戊',
  庚: '戊',
  丙: '庚',
  辛: '庚',
  丁: '壬',
  壬: '壬',
  戊: '甲',
  癸: '甲'
}
const WU_SHU_DUN_START = {
  甲: '甲',
  己: '甲',
  乙: '丙',
  庚: '丙',
  丙: '戊',
  辛: '戊',
  丁: '庚',
  壬: '庚',
  戊: '壬',
  癸: '壬'
}

const pad2 = (value) => String(value).padStart(2, '0')
const STANDARD_MERIDIAN = 120
const CHINA_DAYLIGHT_SAVING_PERIODS = {
  1986: { start: [5, 4], end: [9, 14] },
  1987: { start: [4, 12], end: [9, 13] },
  1988: { start: [4, 10], end: [9, 11] },
  1989: { start: [4, 16], end: [9, 17] },
  1990: { start: [4, 15], end: [9, 16] },
  1991: { start: [4, 14], end: [9, 15] }
}
const CHINA_NON_MAINLAND_ADMINS = new Set(['香港', '澳门', '澳門', '台湾', '臺灣', '港澳台'])
export const CHINA_MAINLAND_TIME_ZONE = 'Asia/Shanghai'

const getDayOfYear = (year, month, day) => {
  const start = Date.UTC(year, 0, 1)
  const current = Date.UTC(year, month - 1, day)
  return Math.floor((current - start) / 86400000) + 1
}

export const getEquationOfTimeMinutes = (year, month, day) => {
  const dayOfYear = getDayOfYear(year, month, day)
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

export const normalizeLongitude = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const longitude = Number(value)
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null
  return longitude
}

const addMinutesToLocalDatetime = ({ year, month, day, hour = 0, minute = 0 }, deltaMinutes = 0) => {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute + Math.round(deltaMinutes), 0))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  }
}

const isSameOrAfterMonthDay = (month, day, [targetMonth, targetDay]) => (
  month > targetMonth || (month === targetMonth && day >= targetDay)
)

const isSameOrBeforeMonthDay = (month, day, [targetMonth, targetDay]) => (
  month < targetMonth || (month === targetMonth && day <= targetDay)
)

const isSameMonthDay = (month, day, [targetMonth, targetDay]) => (
  month === targetMonth && day === targetDay
)

const isMainlandChinaLocation = ({ country, admin1 }) => {
  const normalizedCountry = String(country || '').trim()
  const normalizedAdmin = String(admin1 || '').trim()
  if (normalizedCountry && normalizedCountry !== '中国' && normalizedCountry.toUpperCase() !== 'CN') return false
  if (CHINA_NON_MAINLAND_ADMINS.has(normalizedAdmin)) return false
  return normalizedCountry === '中国' || normalizedCountry.toUpperCase() === 'CN'
}

export const getChinaDaylightSavingAdjustment = ({
  year,
  month,
  day,
  hour = 0,
  country = '',
  admin1 = ''
}) => {
  const period = CHINA_DAYLIGHT_SAVING_PERIODS[Number(year)]
  if (!period || !isMainlandChinaLocation({ country, admin1 })) {
    return {
      minutes: 0,
      active: false
    }
  }

  const withinDateRange = isSameOrAfterMonthDay(month, day, period.start) && isSameOrBeforeMonthDay(month, day, period.end)
  const afterStartBoundary = !isSameMonthDay(month, day, period.start) || Number(hour) >= 3
  const beforeEndBoundary = !isSameMonthDay(month, day, period.end) || Number(hour) < 2
  const active = withinDateRange && afterStartBoundary && beforeEndBoundary
  return {
    minutes: active ? -60 : 0,
    active
  }
}

const timeZoneFormatterCache = new Map()

const getTimeZoneFormatter = (timeZone) => {
  if (!timeZoneFormatterCache.has(timeZone)) {
    timeZoneFormatterCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
      year: 'numeric'
    }))
  }
  return timeZoneFormatterCache.get(timeZone)
}

export const normalizeTimeZone = (value) => {
  const timeZone = String(value || '').trim()
  if (!timeZone) return ''
  try {
    getTimeZoneFormatter(timeZone)
    return timeZone
  } catch {
    return ''
  }
}

// 某时区在某个 UTC 时刻的总 UTC 偏移（分钟，含夏令时），如 EDT → -240。
export const getTimeZoneOffsetMinutes = (timeZone, utcMs) => {
  const part = getTimeZoneFormatter(timeZone)
    .formatToParts(new Date(utcMs))
    .find((item) => item.type === 'timeZoneName')
  const match = String(part?.value || '').match(/GMT(?:([+-])(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?)?/)
  if (!match || !match[1]) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0) + Number(match[4] || 0) / 60)
}

// 把出生地当地钟表时间解释为一个 UTC 时刻，返回当时的总偏移与标准偏移。
// 标准偏移取「当年 1 月 1 日、7 月 1 日与出生时刻」三者偏移的最小值：
// 夏令时总是把钟拨快，所以最小值即该年的标准时（南北半球通用）。
// 不存在的钟表时间（夏令时开始拨快跳过的那一小时）按切换前的偏移解释；
// 重复的钟表时间（夏令时结束）取迭代收敛到的那一个。
export const getZonedClockOffsets = ({ year, month, day, hour = 0, minute = 0, timeZone }) => {
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const firstOffset = getTimeZoneOffsetMinutes(timeZone, wallMs)
  const secondOffset = getTimeZoneOffsetMinutes(timeZone, wallMs - firstOffset * 60000)
  let totalOffset = secondOffset
  if (secondOffset !== firstOffset) {
    const thirdOffset = getTimeZoneOffsetMinutes(timeZone, wallMs - secondOffset * 60000)
    if (thirdOffset !== secondOffset) {
      totalOffset = Math.min(firstOffset, secondOffset)
    }
  }
  const standardOffset = Math.min(
    totalOffset,
    getTimeZoneOffsetMinutes(timeZone, Date.UTC(year, 0, 1, 12)),
    getTimeZoneOffsetMinutes(timeZone, Date.UTC(year, 6, 1, 12))
  )
  return {
    totalOffsetMinutes: totalOffset,
    standardOffsetMinutes: standardOffset,
    daylightSavingMinutes: standardOffset - totalOffset
  }
}


const resolveTimeBasis = ({ year, month, day, hour, minute, country, admin1, timeZone, standardMeridian }) => {
  const zone = normalizeTimeZone(timeZone)
  if (!zone || zone === CHINA_MAINLAND_TIME_ZONE) {
    // 中国大陆（及未提供时区的旧数据）：保持原行为——120° 标准经线 + 1986–1991 夏令时表。
    const daylightSaving = getChinaDaylightSavingAdjustment({
      year,
      month,
      day,
      hour,
      minute,
      country: zone === CHINA_MAINLAND_TIME_ZONE && !country ? '中国' : country,
      admin1
    })
    return {
      timeZone: zone || null,
      standardMeridian,
      daylightSavingMinutes: daylightSaving.minutes,
      daylightSavingActive: daylightSaving.active
    }
  }
  const offsets = getZonedClockOffsets({ year, month, day, hour, minute, timeZone: zone })
  return {
    timeZone: zone,
    standardMeridian: offsets.standardOffsetMinutes / 4,
    daylightSavingMinutes: offsets.daylightSavingMinutes,
    daylightSavingActive: offsets.daylightSavingMinutes !== 0
  }
}

// 输入时间语义：出生地当地钟表时间（含当地当时的夏令时）。
// timeZone 为出生地 IANA 时区；缺省或为 Asia/Shanghai 时按中国大陆规则处理。
export const getSolarTimeAdjustment = ({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  longitude,
  country = '',
  admin1 = '',
  timeZone = '',
  mode = 'apparent',
  standardMeridian = STANDARD_MERIDIAN
}) => {
  const normalizedLongitude = normalizeLongitude(longitude)
  const clock = { year, month, day, hour, minute }
  const basis = resolveTimeBasis({ year, month, day, hour, minute, country, admin1, timeZone, standardMeridian })
  if (normalizedLongitude === null || mode === 'clock') {
    return {
      longitude: normalizedLongitude,
      mode: 'clock',
      timeZone: basis.timeZone,
      standardMeridian: basis.standardMeridian,
      daylightSavingMinutes: basis.daylightSavingMinutes,
      daylightSavingActive: basis.daylightSavingActive,
      longitudeMinutes: 0,
      equationMinutes: 0,
      totalMinutes: basis.daylightSavingMinutes,
      adjusted: addMinutesToLocalDatetime(clock, basis.daylightSavingMinutes)
    }
  }

  const longitudeMinutes = (normalizedLongitude - basis.standardMeridian) * 4
  const equationMinutes = mode === 'mean' ? 0 : getEquationOfTimeMinutes(year, month, day)
  const totalMinutes = Math.round(basis.daylightSavingMinutes + longitudeMinutes + equationMinutes)
  return {
    longitude: normalizedLongitude,
    mode: mode === 'mean' ? 'mean' : 'apparent',
    timeZone: basis.timeZone,
    standardMeridian: basis.standardMeridian,
    daylightSavingMinutes: basis.daylightSavingMinutes,
    daylightSavingActive: basis.daylightSavingActive,
    longitudeMinutes,
    equationMinutes,
    totalMinutes,
    adjusted: addMinutesToLocalDatetime(clock, totalMinutes)
  }
}

export const formatBirthDate = (year, month, day, hour = 0, minute = 0) => (
  `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:00`
)

export const getEightCharString = (year, month, day, hour = 0, minute = 0, options = {}) => {
  const adjustment = getSolarTimeAdjustment({ year, month, day, hour, minute, ...options })
  const adjusted = adjustment.adjusted
  const bazi = Solar.fromYmdHms(adjusted.year, adjusted.month, adjusted.day, adjusted.hour, adjusted.minute, 0).getLunar().getEightChar()
  return `${bazi.getYear()} ${bazi.getMonth()} ${bazi.getDay()} ${bazi.getTime()}`
}

export const parseCompactSolarInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length !== 8 && digits.length !== 10 && digits.length !== 12) return null
  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  const hour = digits.length >= 10 ? Number(digits.slice(8, 10)) : 0
  const minute = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0
  return { year, month, day, hour, minute }
}

export const getSolarLunarSnapshot = (year, month, day, hour = 0, minute = 0, options = {}) => {
  const timeAdjustment = getSolarTimeAdjustment({ year, month, day, hour, minute, ...options })
  const adjusted = timeAdjustment.adjusted
  const solar = Solar.fromYmdHms(adjusted.year, adjusted.month, adjusted.day, adjusted.hour, adjusted.minute, 0)
  const lunar = solar.getLunar()
  return {
    solar,
    lunar,
    solarText: Solar.fromYmdHms(year, month, day, hour, minute, 0).toYmdHms(),
    adjustedSolarText: solar.toYmdHms(),
    timeAdjustment,
    lunarText: `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getTimeZhi()}时`,
    baziStr: `${lunar.getEightChar().getYear()} ${lunar.getEightChar().getMonth()} ${lunar.getEightChar().getDay()} ${lunar.getEightChar().getTime()}`
  }
}

export const getMonthStemByYearStem = (yearStem, monthBranch) => {
  const startStem = WU_HU_DUN_START[yearStem]
  const branchIndex = MONTH_ZHI_ORDER.indexOf(monthBranch)
  if (!startStem || branchIndex < 0) return ''
  const startIndex = GAN.indexOf(startStem)
  return GAN[(startIndex + branchIndex) % GAN.length]
}

export const getTimeStemByDayStem = (dayStem, timeBranch) => {
  const startStem = WU_SHU_DUN_START[dayStem]
  const branchIndex = TIME_ZHI_ORDER.indexOf(timeBranch)
  if (!startStem || branchIndex < 0) return ''
  const startIndex = GAN.indexOf(startStem)
  return GAN[(startIndex + branchIndex) % GAN.length]
}

export const getAllowedMonthBranchesByStem = (monthStem) => {
  const set = new Set()
  GAN.forEach((yearStem) => {
    MONTH_ZHI_ORDER.forEach((branch) => {
      if (getMonthStemByYearStem(yearStem, branch) === monthStem) {
        set.add(branch)
      }
    })
  })
  return MONTH_ZHI_ORDER.filter((branch) => set.has(branch))
}

export const getAllowedTimeBranchesByStem = (timeStem) => {
  const set = new Set()
  GAN.forEach((dayStem) => {
    TIME_ZHI_ORDER.forEach((branch) => {
      if (getTimeStemByDayStem(dayStem, branch) === timeStem) {
        set.add(branch)
      }
    })
  })
  return TIME_ZHI_ORDER.filter((branch) => set.has(branch))
}

export const normalizePillarsByDunRules = ({ yearPillar, monthPillar, dayPillar, timePillar }) => {
  const yearStem = String(yearPillar || '').charAt(0)
  const monthBranch = String(monthPillar || '').charAt(1)
  const dayStem = String(dayPillar || '').charAt(0)
  const timeBranch = String(timePillar || '').charAt(1)

  const monthStem = getMonthStemByYearStem(yearStem, monthBranch) || String(monthPillar || '').charAt(0)
  const timeStem = getTimeStemByDayStem(dayStem, timeBranch) || String(timePillar || '').charAt(0)

  return {
    yearPillar,
    monthPillar: `${monthStem}${monthBranch}`,
    dayPillar,
    timePillar: `${timeStem}${timeBranch}`
  }
}

export const buildSolarProfilePayload = ({
  name,
  gender,
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  birthLocation = '',
  birthCountry = '',
  birthAdmin1 = '',
  birthLatitude = null,
  birthLongitude = null,
  birthTimeZone = '',
  solarTimeMode = 'apparent'
}) => {
  const timeAdjustment = getSolarTimeAdjustment({
    year,
    month,
    day,
    hour,
    minute,
    longitude: birthLongitude,
    country: birthCountry,
    admin1: birthAdmin1,
    timeZone: birthTimeZone,
    mode: solarTimeMode
  })
  const adjusted = timeAdjustment.adjusted
  return {
    name,
    gender,
    birth_date: formatBirthDate(year, month, day, hour, minute),
    adjusted_birth_date: formatBirthDate(adjusted.year, adjusted.month, adjusted.day, adjusted.hour, adjusted.minute),
    bazi_str: getEightCharString(year, month, day, hour, minute, {
      longitude: birthLongitude,
      country: birthCountry,
      admin1: birthAdmin1,
      timeZone: birthTimeZone,
      mode: solarTimeMode
    }),
    birth_location: String(birthLocation || '').trim(),
    birth_latitude: birthLatitude === '' || birthLatitude === null || birthLatitude === undefined ? null : Number(birthLatitude),
    birth_longitude: timeAdjustment.longitude,
    solar_time_mode: timeAdjustment.mode,
    solar_time_adjustment_minutes: timeAdjustment.totalMinutes
  }
}

export const BAZI_PROFILE_SOLAR_TIME_COLUMNS = [
  'adjusted_birth_date',
  'birth_location',
  'birth_latitude',
  'birth_longitude',
  'solar_time_mode',
  'solar_time_adjustment_minutes'
]

export const buildBaziProfileInsertPayload = (userId, payload, options = {}) => {
  const includeSolarTimeColumns = options.includeSolarTimeColumns !== false
  const insertPayload = {
    user_id: userId,
    name: payload.name,
    gender: payload.gender,
    birth_date: payload.birth_date,
    bazi_str: payload.bazi_str
  }

  if (includeSolarTimeColumns) {
    insertPayload.adjusted_birth_date = payload.adjusted_birth_date
    insertPayload.birth_location = payload.birth_location
    insertPayload.birth_latitude = payload.birth_latitude
    insertPayload.birth_longitude = payload.birth_longitude
    insertPayload.solar_time_mode = payload.solar_time_mode
    insertPayload.solar_time_adjustment_minutes = payload.solar_time_adjustment_minutes
  }

  return insertPayload
}

export const isMissingBaziProfileSolarTimeColumnError = (error) => {
  const message = String(error?.message || '')
  return BAZI_PROFILE_SOLAR_TIME_COLUMNS.some((column) => (
    message.includes(`'${column}'`) &&
    message.includes("'bazi_profiles'") &&
    message.includes('schema cache')
  ))
}

export const canRetryLegacyBaziProfileInsert = (payload) => (
  !String(payload.birth_location || '').trim() &&
  (payload.birth_latitude === null || payload.birth_latitude === undefined || payload.birth_latitude === '') &&
  (payload.birth_longitude === null || payload.birth_longitude === undefined || payload.birth_longitude === '') &&
  (!Number.isFinite(Number(payload.solar_time_adjustment_minutes)) || Number(payload.solar_time_adjustment_minutes) === 0)
)

export const buildLunarProfilePayload = ({ name, gender, year, month, day, hour = 0, minute = 0 }) => {
  const lunar = Lunar.fromYmdHms(year, month, day, hour, minute, 0)
  const solar = lunar.getSolar()
  return {
    name,
    gender,
    birth_date: formatBirthDate(solar.getYear(), solar.getMonth(), solar.getDay(), solar.getHour(), solar.getMinute()),
    bazi_str: `${lunar.getEightChar().getYear()} ${lunar.getEightChar().getMonth()} ${lunar.getEightChar().getDay()} ${lunar.getEightChar().getTime()}`
  }
}

export const findDatesByBazi = (yearPillar, monthPillar, dayPillar, timePillar) => {
  const results = []
  const today = Solar.fromDate(new Date())
  const zhiHours = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }

  for (let year = 1900; year <= today.getYear(); year += 1) {
    const midYear = Solar.fromYmd(year, 7, 1)
    if (midYear.getLunar().getYearInGanZhi() !== yearPillar) continue

    let current = Solar.fromYmd(year - 1, 11, 1)
    const end = Solar.fromYmd(year + 1, 3, 1)
    while (current.toYmd() <= end.toYmd()) {
      const bazi = current.getLunar().getEightChar()
      if (bazi.getYear() === yearPillar && bazi.getMonth() === monthPillar && bazi.getDay() === dayPillar) {
        const hour = zhiHours[timePillar.charAt(1)] ?? 12
        const test = Solar.fromYmdHms(current.getYear(), current.getMonth(), current.getDay(), hour, 30, 0)
        if (test.getLunar().getEightChar().getTime() === timePillar) {
          results.push(test)
        }
      }
      current = current.next(1)
    }
  }

  return results
}

export const buildPillarsProfilePayload = ({
  name,
  gender,
  yearPillar,
  monthPillar,
  dayPillar,
  timePillar
}) => {
  const matches = findDatesByBazi(yearPillar, monthPillar, dayPillar, timePillar)
  if (!matches.length) {
    throw new Error('未找到匹配该四柱的公历日期，请调整四柱后重试。')
  }
  const selected = matches[matches.length - 1]
  return {
    name,
    gender,
    birth_date: formatBirthDate(
      selected.getYear(),
      selected.getMonth(),
      selected.getDay(),
      selected.getHour(),
      selected.getMinute()
    ),
    bazi_str: `${yearPillar} ${monthPillar} ${dayPillar} ${timePillar}`,
    matches
  }
}
