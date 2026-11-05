// 为 src/data/birthplaces.mjs 的每条记录补 IANA 时区（timeZone），并为海外种子补 countryCode。
// 现有数据由 sfyc23 县级经纬度 + 本地维护的海外种子组成，不是 GeoNames 产物，
// 所以这里对现有文件做原地、幂等的确定性标注；GeoNames 生成脚本也已同步输出 timeZone。
// 用法：node scripts/annotate_birthplace_timezones.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { OVERSEAS_SEED_ZONES, resolveBirthplaceTimeZone } from './lib/birthplaceTimeZones.mjs'

const file = resolve('src/data/birthplaces.mjs')
const checkOnly = process.argv.includes('--check')
const source = readFileSync(file, 'utf8')
const marker = 'export const BIRTHPLACES = '
const headerEnd = source.indexOf(marker)
if (headerEnd < 0) throw new Error(`${file} 中找不到 ${marker}`)
const header = source.slice(0, headerEnd)

const { BIRTHPLACES } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)

const annotated = BIRTHPLACES.map((place) => {
  const next = { ...place }
  if (!next.countryCode && OVERSEAS_SEED_ZONES[next.name]) {
    next.countryCode = OVERSEAS_SEED_ZONES[next.name].countryCode
  }
  next.timeZone = resolveBirthplaceTimeZone(next)
  new Intl.DateTimeFormat('en', { timeZone: next.timeZone })
  // 保持字段顺序稳定：countryCode 紧跟 country，timeZone 紧跟经纬度
  const ordered = {}
  for (const [key, value] of Object.entries(next)) {
    if (key === 'countryCode' || key === 'timeZone') continue
    ordered[key] = value
    if (key === 'country') ordered.countryCode = next.countryCode
    if (key === 'lng') ordered.timeZone = next.timeZone
  }
  return ordered
})

const output = `${header}${marker}${JSON.stringify(annotated, null, 2)}\n`
if (checkOnly) {
  if (output !== source) {
    console.error('birthplaces.mjs 的时区标注不是最新，请运行 node scripts/annotate_birthplace_timezones.mjs')
    process.exit(1)
  }
  console.log('birthplaces.mjs 时区标注已是最新')
} else {
  writeFileSync(file, output, 'utf8')
  const counts = annotated.reduce((acc, place) => ({ ...acc, [place.timeZone]: (acc[place.timeZone] || 0) + 1 }), {})
  console.log(`Annotated ${annotated.length} birthplaces`, counts)
}
