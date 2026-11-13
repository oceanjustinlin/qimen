import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findBirthplaceByName,
  findBirthplaceByRegion,
  findBirthplaceForProfile,
  getBirthplaceAdminOptions,
  getBirthplaceCityOptions,
  getBirthplaceCountries,
  searchBirthplaces
} from './birthplaceSearch.mjs'

test('searchBirthplaces finds Chinese city names and aliases', () => {
  const chinese = searchBirthplaces('成都')
  assert.equal(chinese[0].name, '成都市')
  assert.equal(chinese[0].lng, 104.07)

  const english = searchBirthplaces('chengdu')
  assert.equal(english[0].name, '成都市')
})

test('searchBirthplaces supports China county-level results', () => {
  const results = searchBirthplaces('福建省厦门市思明区')
  assert.equal(results[0].name, '思明区')
  assert.equal(results[0].city, '厦门市')
  assert.equal(results[0].county, '思明区')
  assert.match(results[0].label, /福建 - 厦门市 - 思明区/)
})

test('searchBirthplaces expands city queries to province-city-county options', () => {
  const counties = searchBirthplaces('厦门', 12).map((place) => place.label)
  assert.ok(counties.includes('福建 - 厦门市 - 思明区'))
  assert.ok(counties.includes('福建 - 厦门市 - 湖里区'))
  assert.ok(counties.includes('福建 - 厦门市 - 翔安区'))
})

test('searchBirthplaces prioritizes exact and prefix matches', () => {
  const results = searchBirthplaces('西', 20)
  assert.ok(results.some((place) => place.name === '西安市'))
  assert.equal(searchBirthplaces('西宁')[0].name, '西宁市')
})

test('findBirthplaceByName resolves aliases', () => {
  assert.equal(findBirthplaceByName('NYC')?.name, '纽约')
  assert.equal(findBirthplaceByName('北京市')?.lng, 116.4)
})

test('birthplace region helpers expose country admin city hierarchy', () => {
  assert.equal(getBirthplaceCountries()[0], '中国')
  assert.ok(getBirthplaceAdminOptions('中国').includes('四川'))
  assert.ok(getBirthplaceCityOptions('中国', '四川').some((place) => place.name === '成都市'))
  assert.equal(findBirthplaceByRegion({ country: '中国', admin1: '四川', city: '成都市', county: '成都市' })?.lng, 104.07)
})

test('findBirthplaceForProfile resolves saved labels and coordinates back to a time zone', () => {
  assert.equal(findBirthplaceForProfile({ label: '纽约 · 纽约州 · 美国' }).timeZone, 'America/New_York')
  assert.equal(findBirthplaceForProfile({ label: '港澳台 - 香港' }).timeZone, 'Asia/Hong_Kong')
  assert.equal(findBirthplaceForProfile({ label: '不存在', latitude: 51.5072, longitude: -0.1276 }).timeZone, 'Europe/London')
  assert.equal(findBirthplaceForProfile({ label: '不存在' }), null)
})
