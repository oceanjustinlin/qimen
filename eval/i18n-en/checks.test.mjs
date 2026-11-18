import test from 'node:test'
import assert from 'node:assert/strict'
import { runChecks, summarize, checkGlossary, checkFaithfulness, checkLength, checkBanned } from './checks.mjs'

const chart = JSON.stringify({ palaces: [{ name: '震三宫', door: '开门', star: '天心' }, { name: '坎一宫', door: '生门', star: '天蓬' }], hour: '戊午' })

test('好的英文正文全部通过', () => {
  const r = runChecks({
    fields: { conclusion: 'The Open Door (开门) sits in Zhen 3 (震三宫), which favours acting this week. Keep the pace steady and confirm details in writing.' },
    chartText: chart,
  })
  for (const [k, v] of Object.entries(r)) assert.equal(v.ok, true, `${k}: ${v.failures}`)
})

test('中文正文语言不过；译名写错、编造的门不过', () => {
  assert.equal(runChecks({ fields: { a: '开门落震三宫，利于行动。' }, chartText: chart }).language.ok, false)
  assert.equal(checkGlossary({ a: 'The Opening Gate (开门) is strong.' }, chart).ok, false)
  assert.equal(checkGlossary({ a: 'A note about 某某 here.' }, chart).ok, false)
  assert.equal(checkFaithfulness({ a: 'The Death Door weighs on the matter.' }, chart).ok, false)
  assert.equal(checkFaithfulness({ a: 'The Life Door helps.' }, chart).ok, true)
})

test('长度与禁用语', () => {
  assert.equal(checkLength({ a: 'one two three' }, { a: 80 }).ok, false)
  assert.equal(checkLength({ a: Array(40).fill('word').join(' ') }, { a: 80 }).ok, true)
  assert.equal(checkBanned({ a: 'This will definitely work.' }).ok, false)
  assert.equal(checkBanned({ a: 'The backend score of 72.' }).failures.length, 2)
})

test('汇总门槛：结构语言 100%，其余 ≥ 90%', () => {
  const ok = { ok: true, failures: [] }
  const good = { checks: { structure: ok, language: ok, glossary: ok, faithfulness: ok, length: ok, banned: ok } }
  const badLen = { checks: { ...good.checks, length: { ok: false, failures: ['x'] } } }
  assert.equal(summarize(Array(10).fill(good)).pass, true)
  assert.equal(summarize([...Array(9).fill(good), badLen]).pass, true)
  assert.equal(summarize([...Array(8).fill(good), badLen, badLen]).pass, false)
  const badLang = { checks: { ...good.checks, language: { ok: false, failures: ['x'] } } }
  assert.equal(summarize([...Array(19).fill(good), badLang]).pass, false)
})
