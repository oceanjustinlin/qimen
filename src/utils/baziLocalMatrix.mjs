import { Solar } from 'lunar-javascript'

import { findDatesByBazi } from './baziProfileInput.mjs'

const ZHI_MAIN_GAN = {
  子: '癸',
  丑: '己',
  寅: '甲',
  卯: '乙',
  辰: '戊',
  巳: '丙',
  午: '丁',
  未: '己',
  申: '庚',
  酉: '辛',
  戌: '戊',
  亥: '壬'
}

const SHI_SHEN = {
  甲: { 甲: '比', 乙: '劫', 丙: '食', 丁: '伤', 戊: '才', 己: '财', 庚: '杀', 辛: '官', 壬: '枭', 癸: '印' },
  乙: { 甲: '劫', 乙: '比', 丙: '伤', 丁: '食', 戊: '财', 己: '才', 庚: '官', 辛: '杀', 壬: '印', 癸: '枭' },
  丙: { 甲: '枭', 乙: '印', 丙: '比', 丁: '劫', 戊: '食', 己: '伤', 庚: '才', 辛: '财', 壬: '杀', 癸: '官' },
  丁: { 甲: '印', 乙: '枭', 丙: '劫', 丁: '比', 戊: '伤', 己: '食', 庚: '财', 辛: '才', 壬: '官', 癸: '杀' },
  戊: { 甲: '杀', 乙: '官', 丙: '枭', 丁: '印', 戊: '比', 己: '劫', 庚: '食', 辛: '伤', 壬: '才', 癸: '财' },
  己: { 甲: '官', 乙: '杀', 丙: '印', 丁: '枭', 戊: '劫', 己: '比', 庚: '伤', 辛: '食', 壬: '财', 癸: '才' },
  庚: { 甲: '才', 乙: '财', 丙: '杀', 丁: '官', 戊: '枭', 己: '印', 庚: '比', 辛: '劫', 壬: '食', 癸: '伤' },
  辛: { 甲: '财', 乙: '才', 丙: '官', 丁: '杀', 戊: '印', 己: '枭', 庚: '劫', 辛: '比', 壬: '伤', 癸: '食' },
  壬: { 甲: '食', 乙: '伤', 丙: '才', 丁: '财', 戊: '杀', 己: '官', 庚: '枭', 辛: '印', 壬: '比', 癸: '劫' },
  癸: { 甲: '伤', 乙: '食', 丙: '财', 丁: '才', 戊: '官', 己: '杀', 庚: '印', 辛: '枭', 壬: '劫', 癸: '比' }
}

const pad2 = (value) => String(value).padStart(2, '0')

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (!value) return []
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

const getShiShen = (dayGan, targetGan) => {
  if (!dayGan || !targetGan || !SHI_SHEN[dayGan]) return ''
  return SHI_SHEN[dayGan][targetGan] || ''
}

const parseBirthDate = (birthDate) => {
  if (!birthDate) return null
  const parts = String(birthDate).match(/\d+/g)
  if (!parts || parts.length < 3) return null
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
    hour: Number(parts[3] || 12),
    minute: Number(parts[4] || 0)
  }
}

export const resolveSolarFromProfile = (profile) => {
  if (!profile) return null

  const parsed = parseBirthDate(profile.adjusted_birth_date || profile.birth_date)
  if (parsed) {
    return Solar.fromYmdHms(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute, 0)
  }

  const pillars = String(profile.bazi_str || '').split(' ').filter(Boolean)
  if (pillars.length !== 4) return null

  const matches = findDatesByBazi(pillars[0], pillars[1], pillars[2], pillars[3])
  return matches.length ? matches[matches.length - 1] : null
}

export const getPromptDataFromProfile = (profile) => {
  const solar = resolveSolarFromProfile(profile)
  const result = {
    gender: profile?.gender === 'M' ? '男' : '女',
    birthStr: '',
    baziStr: String(profile?.bazi_str || '').trim(),
    daYunStr: '当前大运'
  }

  if (!solar) return result

  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  result.birthStr = `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日 ${pad2(solar.getHour())}:${pad2(solar.getMinute())}`
  if (!result.baziStr) {
    result.baziStr = `${eightChar.getYear()} ${eightChar.getMonth()} ${eightChar.getDay()} ${eightChar.getTime()}`
  }

  return result
}

const buildPillarColumn = ({ name, pillar, star, hiddenStems, diShi, zhiShiShen, xunKong, nayin }) => {
  const gan = String(pillar || '').charAt(0)
  const zhi = String(pillar || '').charAt(1)
  const zhiTenGods = toArray(zhiShiShen)

  return {
    name,
    star: star || '',
    gan,
    zhi,
    hidden_stems: toArray(hiddenStems),
    shi: diShi || '',
    zizuo: zhiTenGods[0] || '',
    is_kong: !!zhi && String(xunKong || '').includes(zhi),
    nayin: nayin || '',
    shensha: []
  }
}

const buildTransitColumn = (name, ganZhi, dayGan) => {
  if (!ganZhi) return null
  const gan = ganZhi.charAt(0)
  const zhi = ganZhi.charAt(1)
  const mainGan = ZHI_MAIN_GAN[zhi]

  return {
    name,
    star: getShiShen(dayGan, gan),
    gan,
    zhi,
    hidden_stems: mainGan ? [mainGan] : [],
    shi: '',
    zizuo: getShiShen(dayGan, mainGan),
    is_kong: false,
    nayin: '',
    shensha: []
  }
}

export const buildLocalBaziMatrix = (profile, referenceDate = new Date()) => {
  const solar = resolveSolarFromProfile(profile)
  if (!solar) return null

  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()
  const dayGan = eightChar.getDay().charAt(0)

  const pillars = [
    buildPillarColumn({
      name: '年',
      pillar: eightChar.getYear(),
      star: eightChar.getYearShiShenGan(),
      hiddenStems: eightChar.getYearHideGan(),
      diShi: eightChar.getYearDiShi(),
      zhiShiShen: eightChar.getYearShiShenZhi(),
      xunKong: eightChar.getYearXunKong(),
      nayin: eightChar.getYearNaYin()
    }),
    buildPillarColumn({
      name: '月',
      pillar: eightChar.getMonth(),
      star: eightChar.getMonthShiShenGan(),
      hiddenStems: eightChar.getMonthHideGan(),
      diShi: eightChar.getMonthDiShi(),
      zhiShiShen: eightChar.getMonthShiShenZhi(),
      xunKong: eightChar.getMonthXunKong(),
      nayin: eightChar.getMonthNaYin()
    }),
    buildPillarColumn({
      name: '日',
      pillar: eightChar.getDay(),
      star: eightChar.getDayShiShenGan(),
      hiddenStems: eightChar.getDayHideGan(),
      diShi: eightChar.getDayDiShi(),
      zhiShiShen: eightChar.getDayShiShenZhi(),
      xunKong: eightChar.getDayXunKong(),
      nayin: eightChar.getDayNaYin()
    }),
    buildPillarColumn({
      name: '时',
      pillar: eightChar.getTime(),
      star: eightChar.getTimeShiShenGan(),
      hiddenStems: eightChar.getTimeHideGan(),
      diShi: eightChar.getTimeDiShi(),
      zhiShiShen: eightChar.getTimeShiShenZhi(),
      xunKong: eightChar.getTimeXunKong(),
      nayin: eightChar.getTimeNaYin()
    })
  ]

  const currentYear = referenceDate.getFullYear()
  const yun = eightChar.getYun(profile?.gender === 'M' ? 1 : 0)
  const dayunList = yun.getDaYun()
  let currentDayun = dayunList.find(item => currentYear >= item.getStartYear() && currentYear <= item.getEndYear())

  if (!currentDayun && dayunList.length) {
    currentDayun = dayunList.find(item => currentYear <= item.getStartYear()) || dayunList[0]
  }

  const currentLiunian = currentDayun?.getLiuNian().find(item => item.getYear() === currentYear) || currentDayun?.getLiuNian()[0] || null

  return {
    pillars,
    current_dayun: currentDayun?.getGanZhi() ? buildTransitColumn('大运', currentDayun.getGanZhi(), dayGan) : null,
    current_liunian: currentLiunian?.getGanZhi() ? buildTransitColumn('流年', currentLiunian.getGanZhi(), dayGan) : null,
    dayun_list: dayunList.map(item => {
      const gz = item.getGanZhi?.() || ''
      const gan = gz.charAt(0)
      const zhi = gz.charAt(1)
      return {
        gan,
        zhi,
        start_year: item.getStartYear?.() ?? null,
        end_year: item.getEndYear?.() ?? null,
        start_age: item.getStartAge?.() ?? null,
        end_age: item.getEndAge?.() ?? null,
        shi_shen: getShiShen(dayGan, gan),
        zhi_shi_shen: getShiShen(dayGan, ZHI_MAIN_GAN[zhi] || ''),
        liunian_list: (item.getLiuNian?.() || []).map(ln => {
          const lnGz = ln.getGanZhi?.() || ''
          const lnGan = lnGz.charAt(0)
          const lnZhi = lnGz.charAt(1)
          return {
            year: ln.getYear?.() ?? null,
            gan: lnGan,
            zhi: lnZhi,
            shi_shen: getShiShen(dayGan, lnGan),
            zhi_shi_shen: getShiShen(dayGan, ZHI_MAIN_GAN[lnZhi] || '')
          }
        })
      }
    })
  }
}

/**
 * 根据年份查找命主当时所在的大运干支
 * @param {Object} profile - bazi_profiles 记录
 * @param {number} year    - 查询年份
 * @returns {string}       - 如 "庚戌"；找不到时返回 ""
 */
export const getDayunByYear = (profile, year) => {
  const solar = resolveSolarFromProfile(profile)
  if (!solar) return ''
  const eightChar = solar.getLunar().getEightChar()
  const yun = eightChar.getYun(profile?.gender === 'M' ? 1 : 0)
  const dayun = yun.getDaYun().find(
    dy => year >= dy.getStartYear() && year <= dy.getEndYear()
  )
  return dayun?.getGanZhi() || ''
}
