// 紫微斗数前端排盘：基于八字档案（birth_date / adjusted_birth_date / gender）调用 iztro 起盘。
// 输入口径与后端 lib/ziweiProfileAdapter.cjs 保持一致（优先真太阳时、13 时段含早晚子时），
// 改动时同步修改两处；src/utils/ziweiChart.test.mjs 会校验两边一致。
// iztro 由调用方注入（组件里按需动态 import），避免首屏打包排盘引擎。

export const MUTAGENS = ['禄', '权', '科', '忌']

// 《飞星紫微斗数》四化诀（PDF 第 124 页），与 iztro 默认四化表一致
export const STEM_MUTAGENS = {
  甲: ['廉贞', '破军', '武曲', '太阳'],
  乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'],
  丁: ['太阴', '天同', '天机', '巨门'],
  戊: ['贪狼', '太阴', '右弼', '天机'],
  己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'],
  辛: ['巨门', '太阳', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左辅', '武曲'],
  癸: ['破军', '巨门', '太阴', '贪狼'],
}

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
export const LUNAR_MONTH_LABELS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

const TIME_LABELS = ['早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时']

const GENDERS = { 男: 'male', 乾造: 'male', 乾: 'male', m: 'male', male: 'male', 女: 'female', 坤造: 'female', 坤: 'female', f: 'female', female: 'female' }

export class ZiweiInputError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function timeIndexOf(hour, minute) {
  const minuteOfDay = hour * 60 + minute
  if (minuteOfDay < 60) return 0
  if (minuteOfDay >= 1380) return 12
  return Math.floor((minuteOfDay - 60) / 120) + 1
}

export function buildZiweiInput(profile) {
  if (!profile || typeof profile !== 'object') throw new ZiweiInputError('PROFILE_INCOMPLETE', '缺少命主档案。')
  const gender = GENDERS[String(profile.gender ?? '').trim().toLowerCase()]
  if (!gender) throw new ZiweiInputError('PROFILE_GENDER_INVALID', '紫微排盘需要可识别的性别（男或女）。')

  const adjusted = String(profile.adjusted_birth_date ?? '').trim()
  const raw = adjusted || String(profile.birth_date ?? '').trim()
  if (!raw) throw new ZiweiInputError('PROFILE_INCOMPLETE', '缺少出生日期时间。')
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/)
  if (!match) throw new ZiweiInputError('PROFILE_BIRTH_TIME_MISSING', '紫微排盘需要精确到时辰的出生时间。')
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const index = timeIndexOf(hour, minute)
  return {
    dateStr: `${year}-${month}-${day}`,
    year,
    hour,
    minute,
    timeIndex: index,
    timeLabel: TIME_LABELS[index],
    gender,
    timeSource: adjusted ? 'profile_adjusted' : 'profile_legacy_clock',
  }
}

export function createZiweiAstrolabe(astro, input) {
  return astro.withOptions({
    type: 'solar',
    dateStr: input.dateStr,
    timeIndex: input.timeIndex,
    gender: input.gender,
    fixLeap: true,
    language: 'zh-CN',
  })
}

export const toDateStr = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

// 本宫与三方四正：iztro 的宫位 index 从寅宫起顺排
export const relatedPalaceIndexes = (index) => ({ opposite: (index + 6) % 12, trines: [(index + 4) % 12, (index + 8) % 12] })

export function findStarPalaceIndex(palaces, starName) {
  return palaces.findIndex((palace) => [...palace.majorStars, ...palace.minorStars].some((star) => star.name === starName))
}

// 宫干四化飞入的宫位，顺序为禄权科忌；盘中无此星时为 -1
export function flyingTargets(palaces, index) {
  return STEM_MUTAGENS[palaces[index].heavenlyStem].map((starName) => findStarPalaceIndex(palaces, starName))
}

// 自化标记：本宫宫干四化落本宫 → self；对宫宫干四化落本宫 → opposite
export function selfMutagenMarks(palaces, index) {
  const marks = {}
  const starNames = new Set([...palaces[index].majorStars, ...palaces[index].minorStars].map((star) => star.name))
  const add = (sourceIndex, kind) => {
    STEM_MUTAGENS[palaces[sourceIndex].heavenlyStem].forEach((starName, k) => {
      if (starNames.has(starName)) (marks[starName] ||= []).push({ mutagen: MUTAGENS[k], kind })
    })
  }
  add(index, 'self')
  add((index + 6) % 12, 'opposite')
  return marks
}

// 流年命宫落在该地支的虚岁（太岁按公历年近似，正月初一前后的出入不影响年份列表）
export function flowYearAges(birthYear, branch, count = 6) {
  const ages = []
  for (let age = 1; age <= 120 && ages.length < count; age += 1) {
    const yearBranch = BRANCHES[(((birthYear + age - 1 - 4) % 12) + 12) % 12]
    if (yearBranch === branch) ages.push(age)
  }
  return ages
}

// 指定公历年对应农历年内，每个农历月第一天附近的一个公历日期（闰月并入前一个月）
export function lunarMonthDates(astrolabe, year) {
  const yearBranch = astrolabe.horoscope(`${year}-7-1`, 6).yearly.earthlyBranch
  const found = {}
  for (let cursor = new Date(year, 0, 15); cursor < new Date(year + 1, 2, 1); cursor.setDate(cursor.getDate() + 3)) {
    const horoscope = astrolabe.horoscope(toDateStr(cursor), 6)
    if (horoscope.yearly.earthlyBranch !== yearBranch) continue
    const monthBranch = horoscope.monthly.earthlyBranch
    if (!found[monthBranch]) found[monthBranch] = new Date(cursor)
  }
  return LUNAR_MONTH_LABELS.map((label, i) => {
    const branch = BRANCHES[(i + 2) % 12]
    return { label, branch, date: found[branch] || null }
  })
}

export function natalMutagens(palaces) {
  const result = {}
  palaces.forEach((palace) => [...palace.majorStars, ...palace.minorStars].forEach((star) => {
    if (star.mutagen) result[star.mutagen] = star.name
  }))
  return result
}
