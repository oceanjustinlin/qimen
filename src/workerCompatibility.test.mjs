import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8')
const handler = source.slice(source.indexOf('async function handleCompatibilityInit'), source.indexOf('async function routeRequest'))
const synastry = require('../lib/synastry/index.js')

test('合盘接口改由 lib/synastry 计算，不再用假时柱与小时取模', () => {
  assert.match(source, /import synastry from '\.\.\/\.\.\/lib\/synastry\/index\.js'/)
  assert.match(handler, /synastry\.buildCompatibilityResponse\(profileA, profileB/)
  assert.match(handler, /synastry\.normalizeRelationType\(body\.relationType\)/)
  assert.doesNotMatch(handler, /function parsePerson/)
  assert.doesNotMatch(handler, /: 12;/)
  assert.doesNotMatch(handler, /% 24\) \+ 24\) % 24/)
})

test('合盘接口落库写入新列，落库失败不影响返回', () => {
  for (const col of ['relation_type', 'engine_version', 'dim_scores', 'total_score']) {
    assert.match(handler, new RegExp(`${col}:`))
  }
  assert.match(handler, /^\s+report,$/m)
  assert.match(handler, /return json\(\{ ok: true, sessionId, A: compactA, B: compactB, report \}/)
  assert.match(handler, /catch \(dbErr\)/)
})

test('不带 relationType：friend，含 friendDims', () => {
  const r = synastry.buildCompatibilityResponse(
    { birth_date: '1992-02-18', hour_index: 5, gender: 'M' },
    { birth_date: '1992-01-14', hour_index: 5, gender: 'F' },
    { relationType: synastry.normalizeRelationType(undefined), currentYear: 2026 },
  )
  assert.equal(r.report.relationType, 'friend')
  assert.ok(r.report.friendDims)
  for (const k of ['dayGan', 'gans', 'zhis', 'dayZhi', 'yearZhi', 'monthZhi', 'five_shens', 'wuxing_ratio']) {
    assert.ok(k in r.A)
    assert.ok(k in r.B)
  }
})

test('romance：没有 friendDims，也没有任何名为 total 的字段', () => {
  const r = synastry.buildCompatibilityResponse(
    { birth_date: '1992-02-18', hour_index: 5, gender: 'M' },
    { birth_date: '1992-01-14', hour_index: 5, gender: 'F' },
    { relationType: synastry.normalizeRelationType('romance'), currentYear: 2026 },
  )
  assert.equal(r.report.relationType, 'romance')
  assert.equal(r.report.friendDims, undefined)
  assert.doesNotMatch(JSON.stringify(r), /"total"/)
})

test('迁移脚本：新增三列且可重复执行', () => {
  const sql = readFileSync(new URL('../docs/sql/compatibility-synastry-migration.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column if not exists relation_type\s+text not null default 'friend'/)
  assert.match(sql, /add column if not exists engine_version text/)
  assert.match(sql, /add column if not exists report\s+jsonb/)
})
