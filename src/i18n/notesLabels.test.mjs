import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contextOptionLabel, missingOptionLabels, noteCategoryLabel, noteImpactLabel } from './notesLabels.mjs'

const source = readFileSync(new URL('../views/BaziView.vue', import.meta.url), 'utf8')

function optionsIn(src) {
  const out = new Set()
  for (const m of src.matchAll(/(?:options|statusOptions): \[([^\]]+)\]/g)) {
    for (const o of m[1].matchAll(/'([^']+)'/g)) out.add(o[1])
  }
  return [...out]
}

test('基调选项都有英文显示名（纯 ASCII 选项如 KPI、0-1 除外）', () => {
  const options = optionsIn(source).filter((o) => /[^\x00-\x7f]/.test(o))
  assert.ok(options.length > 80)
  assert.deepEqual(missingOptionLabels(options), [])
})

test('中文界面原样返回存储值，英文界面换显示名', () => {
  assert.equal(contextOptionLabel('找工作', 'zh-CN'), '找工作')
  assert.equal(contextOptionLabel('找工作', 'zh-TW'), '找工作')
  assert.equal(contextOptionLabel('找工作', 'en-US'), 'Job hunting')
  assert.equal(contextOptionLabel('KPI', 'en-US'), 'KPI')
  assert.equal(noteCategoryLabel('career', '事业/学业', 'zh-CN'), '事业/学业')
  assert.equal(noteCategoryLabel('career', '事业/学业', 'en-US'), 'Career / study')
  assert.equal(noteImpactLabel(-1, '坎坷/挫折', 'en-US'), 'Rough / setback')
  assert.equal(noteImpactLabel(0, '平稳/变动', 'en-US'), 'Steady / change')
})
