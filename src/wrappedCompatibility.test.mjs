import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const wrappedHtml = readFileSync(new URL('../public/wrapped.html', import.meta.url), 'utf8')

test('合盘页不再在前端计算分数，分数与称号取自接口的 report.friendDims', () => {
  for (const fn of ['computeScores', 'computeMockBazi', 'l1Score', 'l3Score', 'l4Score', 'l5NobleScore',
    'dayZhiMoneyScore', 'compScore', 'zhiRel', 'computeRealDIMs', 'weightedDimPart']) {
    assert.doesNotMatch(wrappedHtml, new RegExp(`function ${fn}\\b`), fn)
  }
  assert.match(wrappedHtml, /relationType: 'friend'/)
  assert.match(wrappedHtml, /data\.report\?\.friendDims/)
  assert.match(wrappedHtml, /function applyReport\(report\)/)
  assert.match(wrappedHtml, /S\.total=f\.total;S\.tier=f\.tier;S\.tierClass=f\.tierClass/)
})

test('分析页与扫盘页按证据渲染：高亮由 locus 与 chars 决定，小标题写明方向', () => {
  assert.match(wrappedHtml, /function marksFor\(key,list\)/)
  assert.match(wrappedHtml, /loc==='chart'/)
  assert.match(wrappedHtml, /e\.dir==='A<-B'/)
  assert.match(wrappedHtml, /e\.dir==='B<-A'/)
  assert.match(wrappedHtml, /e\.basis!=='folk'/)
})

test('文案以「对盘」为核心，五个维度用短问，不再出现充电漏电', () => {
  assert.match(wrappedHtml, /你们俩，<br><span class="hi">对盘<\/span>吗？/)
  assert.match(wrappedHtml, /两个人的八字，摆在一起看。/)
  assert.match(wrappedHtml, /开始对盘/)
  for (const ask of ['聊得来吗', '靠得住吗', '处着累吗', '有长进吗', '谈钱伤吗']) assert.match(wrappedHtml, new RegExp(ask))
  assert.doesNotMatch(wrappedHtml, /充电|漏电|柠檬精|敌蜜/)
  assert.doesNotMatch(wrappedHtml, /th-src">《/)
  assert.match(wrappedHtml, /没有硬伤。/)
})

test('深浅两套主题：读主站的主题偏好，深色覆盖 token', () => {
  assert.match(wrappedHtml, /qimen-theme-preference/)
  assert.match(wrappedHtml, /:root\[data-theme="dark"\]\{/)
})

test('wrapped birthplace dropdown shows enough county-level matches', () => {
  assert.match(wrappedHtml, /const CITY_RESULT_LIMIT=32/)
  assert.match(wrappedHtml, /const matches = searchCities\(input\.value, CITY_RESULT_LIMIT\)/)
  assert.doesNotMatch(wrappedHtml, /searchCities\(input\.value, 8\)/)
  assert.doesNotMatch(wrappedHtml, /CITY_DISTRICT_FALLBACKS/)
  assert.doesNotMatch(wrappedHtml, /fallbackDistrictPlace/)
  assert.match(wrappedHtml, /api\.searchBirthplaces\(query, limit\)/)
})
