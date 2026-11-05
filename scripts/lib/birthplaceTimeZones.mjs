// 出生地 → IANA 时区的确定性规则，供出生地数据生成/标注脚本共用。
// 中国大陆统一 Asia/Shanghai（法定北京时间，新疆/西藏也不例外）；
// 港澳台各用本地时区（历史夏令时与大陆不同）；海外按城市指定。

export const CHINA_MAINLAND_TIME_ZONE = 'Asia/Shanghai'

const CHINA_SAR_TW_TIME_ZONES = {
  香港: 'Asia/Hong_Kong',
  澳门: 'Asia/Macau',
  澳門: 'Asia/Macau'
}

// 手工维护的海外种子记录：name → { timeZone, countryCode }
export const OVERSEAS_SEED_ZONES = {
  纽约: { timeZone: 'America/New_York', countryCode: 'US' },
  洛杉矶: { timeZone: 'America/Los_Angeles', countryCode: 'US' },
  旧金山: { timeZone: 'America/Los_Angeles', countryCode: 'US' },
  伦敦: { timeZone: 'Europe/London', countryCode: 'GB' },
  巴黎: { timeZone: 'Europe/Paris', countryCode: 'FR' },
  东京: { timeZone: 'Asia/Tokyo', countryCode: 'JP' },
  新加坡: { timeZone: 'Asia/Singapore', countryCode: 'SG' }
}

export const resolveBirthplaceTimeZone = (place, geonamesTimeZone = '') => {
  const isChina = place.countryCode === 'CN' || place.country === '中国'
  if (isChina) {
    if (place.admin1 === '港澳台' || ['香港', '澳门', '澳門', '台湾', '臺灣'].includes(place.admin1)) {
      return CHINA_SAR_TW_TIME_ZONES[place.name] || CHINA_SAR_TW_TIME_ZONES[place.admin1] || 'Asia/Taipei'
    }
    return CHINA_MAINLAND_TIME_ZONE
  }
  if (geonamesTimeZone) return geonamesTimeZone
  const seed = OVERSEAS_SEED_ZONES[place.name]
  if (seed) return seed.timeZone
  throw new Error(`无法确定出生地时区：${place.name} · ${place.admin1 || ''} · ${place.country || ''}`)
}
