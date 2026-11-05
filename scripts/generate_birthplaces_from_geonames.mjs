import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { resolveBirthplaceTimeZone } from './lib/birthplaceTimeZones.mjs'

const DEFAULT_SOURCE_DIR = resolve('.cache/geonames')
const DEFAULT_OUTPUT = resolve('src/data/birthplaces.mjs')

const CN_ADMIN1 = {
  '01': '安徽',
  '02': '浙江',
  '03': '江西',
  '04': '江苏',
  '05': '吉林',
  '06': '青海',
  '07': '福建',
  '08': '黑龙江',
  '09': '河南',
  10: '河北',
  11: '湖南',
  12: '湖北',
  13: '新疆',
  14: '西藏',
  15: '甘肃',
  16: '广西',
  18: '贵州',
  19: '辽宁',
  20: '内蒙古',
  21: '宁夏',
  22: '北京',
  23: '上海',
  24: '山西',
  25: '山东',
  26: '陕西',
  28: '天津',
  29: '云南',
  30: '广东',
  31: '海南',
  32: '四川',
  33: '重庆',
  34: '香港',
  35: '澳门'
}

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inlineValue] = arg.slice(2).split('=')
  const value = inlineValue ?? process.argv[i + 1]
  args.set(key, value)
  if (inlineValue === undefined) i += 1
}

const sourceDir = resolve(args.get('source-dir') || DEFAULT_SOURCE_DIR)
const output = resolve(args.get('output') || DEFAULT_OUTPUT)
const dataset = args.get('dataset') || 'cities1000'
const minPopulation = Number(args.get('min-population') || 1000)

const countryDisplay = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['zh-Hans-CN'], { type: 'region' })
  : null

const unzipText = (zipName, innerName) => {
  const zipPath = resolve(sourceDir, zipName)
  if (!existsSync(zipPath)) {
    throw new Error(`Missing ${zipPath}. Download GeoNames dump files into ${sourceDir}.`)
  }
  return execFileSync('unzip', ['-p', zipPath, innerName], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512
  })
}

const readCountryNames = () => {
  const text = unzipText('countryInfo.zip', 'countryInfo.txt')
  const map = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    const code = cols[0]
    const englishName = cols[4] || code
    const localizedName = countryDisplay?.of(code) || englishName
    map.set(code, localizedName)
  }
  return map
}

const readAdmin1Names = () => {
  const text = unzipText('admin1CodesASCII.zip', 'admin1CodesASCII.txt')
  const map = new Map()
  for (const line of text.split('\n')) {
    if (!line) continue
    const cols = line.split('\t')
    const key = cols[0]
    const name = cols[1] || cols[2] || key
    if (key) map.set(key, name)
  }
  return map
}

const hasCjk = (value) => /[\u3400-\u9fff]/.test(value)

const cleanAliases = (values, primaryName, asciiName) => {
  const seen = new Set([primaryName, asciiName].filter(Boolean))
  const aliases = []
  for (const raw of values) {
    const alias = raw.trim()
    if (!alias || seen.has(alias) || alias.length > 48) continue
    seen.add(alias)
    aliases.push(alias)
    if (aliases.length >= 8) break
  }
  return aliases
}

const pickDisplayName = ({ countryCode, name, asciiName, alternateNames }) => {
  if (countryCode === 'CN') {
    const cjkName = alternateNames.find((alias) => hasCjk(alias) && alias.length <= 12)
    if (cjkName) return cjkName
  }
  return name || asciiName
}

const buildBirthplaces = () => {
  const countryNames = readCountryNames()
  const admin1Names = readAdmin1Names()
  const text = unzipText(`${dataset}.zip`, `${dataset}.txt`)
  const places = []
  const seen = new Set()

  for (const line of text.split('\n')) {
    if (!line) continue
    const cols = line.split('\t')
    const geonameId = cols[0]
    const name = cols[1]
    const asciiName = cols[2]
    const alternateNames = (cols[3] || '').split(',').filter(Boolean)
    const lat = Number(cols[4])
    const lng = Number(cols[5])
    const featureClass = cols[6]
    const countryCode = cols[8]
    const admin1Code = cols[10]
    const population = Number(cols[14] || 0)
    const geonamesTimeZone = cols[17] || ''

    if (featureClass !== 'P') continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (population < minPopulation) continue

    const country = countryNames.get(countryCode) || countryCode
    const adminKey = `${countryCode}.${admin1Code}`
    const admin1 = countryCode === 'CN'
      ? (CN_ADMIN1[admin1Code] || admin1Names.get(adminKey) || admin1Code || country)
      : (admin1Names.get(adminKey) || admin1Code || country)
    const displayName = pickDisplayName({ countryCode, name, asciiName, alternateNames })
    const dedupeKey = `${countryCode}:${admin1Code}:${displayName}:${lat.toFixed(4)}:${lng.toFixed(4)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    places.push({
      id: Number(geonameId),
      name: displayName,
      admin1,
      country,
      countryCode,
      admin1Code,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      // GeoNames 第 18 列即 IANA 时区；中国大陆统一改为 Asia/Shanghai（新疆等地 GeoNames 给的是 Asia/Urumqi）
      timeZone: resolveBirthplaceTimeZone({ name: displayName, admin1, country, countryCode }, geonamesTimeZone),
      population,
      aliases: cleanAliases([name, asciiName, ...alternateNames], displayName, asciiName)
    })
  }

  places.sort((a, b) => {
    if (a.country === '中国' && b.country !== '中国') return -1
    if (b.country === '中国' && a.country !== '中国') return 1
    return a.country.localeCompare(b.country, 'zh-Hans-CN') ||
      a.admin1.localeCompare(b.admin1, 'zh-Hans-CN') ||
      (b.population || 0) - (a.population || 0) ||
      a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  return places
}

const places = buildBirthplaces()
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `// Generated from GeoNames ${dataset}. Do not edit by hand.\n// GeoNames data is licensed under CC BY 4.0: https://www.geonames.org/\nexport const BIRTHPLACES = ${JSON.stringify(places)}\n`, 'utf8')
console.log(`Wrote ${places.length} birthplaces to ${output}`)
