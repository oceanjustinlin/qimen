import { BIRTHPLACES } from '../data/birthplaces.mjs'

const normalize = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s'’`·.-]/g, '')

const searchableText = (place) => [
  place.name,
  place.admin1,
  place.city,
  place.county,
  place.country,
  [place.admin1, place.city, place.county || place.name].filter(Boolean).join(''),
  [place.admin1, place.city, place.county || place.name].filter(Boolean).join('-'),
  [place.aliases?.[0], place.city, place.county || place.name].filter(Boolean).join(''),
  ...(place.aliases || [])
].map(normalize).filter(Boolean)

const trimChinaSuffix = (value) => String(value || '').replace(/(壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市)$/u, '')

const formatPlaceLabel = (place) => {
  if (place.country === '中国') {
    const province = place.admin1 || trimChinaSuffix(place.province)
    const city = place.city || ''
    const county = place.county || place.name || ''
    const parts = [province, city, county]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .filter((part, index, list) => list.indexOf(part) === index)
    return parts.join(' - ')
  }
  return `${place.name} · ${place.admin1} · ${place.country}`
}

const index = BIRTHPLACES.map((place) => ({
  ...place,
  label: formatPlaceLabel(place),
  searchTokens: searchableText(place)
}))

const scorePlace = (place, query) => {
  if (!query) return Math.log10((place.population || 0) + 10)
  let score = 0
  place.searchTokens.forEach((token) => {
    if (token === query) score = Math.max(score, 120)
    else if (token.startsWith(query)) score = Math.max(score, 90 - token.length / 10)
    else if (token.includes(query)) score = Math.max(score, 55 - token.indexOf(query))
  })
  if (!score) return 0
  return score + Math.log10((place.population || 0) + 10)
}

export const findBirthplaceByName = (name) => {
  const query = normalize(name)
  if (!query) return null
  return index.find((place) => place.searchTokens.some((token) => token === query)) || null
}

export const searchBirthplaces = (query, limit = 8) => {
  const normalizedQuery = normalize(query)
  return index
    .map((place) => ({ ...place, score: scorePlace(place, normalizedQuery) }))
    .filter((place) => place.score > 0)
    .sort((a, b) => b.score - a.score || (b.population || 0) - (a.population || 0))
    .slice(0, limit)
}

const sortByPopulation = (items) => [...items].sort((a, b) => (b.population || 0) - (a.population || 0) || a.name.localeCompare(b.name, 'zh-Hans-CN'))

export const getBirthplaceCountries = () => {
  const countries = [...new Set(index.map((place) => place.country).filter(Boolean))]
  return countries.sort((a, b) => {
    if (a === '中国') return -1
    if (b === '中国') return 1
    return a.localeCompare(b, 'zh-Hans-CN')
  })
}

export const getBirthplaceAdminOptions = (country) => {
  if (!country) return []
  const options = [...new Set(index
    .filter((place) => place.country === country)
    .map((place) => place.admin1)
    .filter(Boolean))]
  return options.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

export const getBirthplaceCityOptions = (country, admin1) => {
  if (!country || !admin1) return []
  return sortByPopulation(index.filter((place) => place.country === country && place.admin1 === admin1))
}

export const findBirthplaceByRegion = ({ country, admin1, city, county }) => {
  if (!country || !admin1 || !city) return null
  return index.find((place) => (
    place.country === country &&
    place.admin1 === admin1 &&
    (place.city === city || place.name === city) &&
    (!county || place.county === county || place.name === county)
  )) || null
}

// 按已保存的 birth_location 标签反查出生地（档案只存了标签和经纬度，没存时区）。
// 标签完全匹配优先；否则在经纬度完全相同的记录里取第一条。
export const findBirthplaceForProfile = ({ label, latitude, longitude } = {}) => {
  const normalizedLabel = String(label || '').trim()
  if (normalizedLabel) {
    const byLabel = index.find((place) => place.label === normalizedLabel)
    if (byLabel) return byLabel
  }
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return index.find((place) => place.lat === lat && place.lng === lng) || null
}
