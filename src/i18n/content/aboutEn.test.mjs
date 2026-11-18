import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import aboutEn from './aboutEn.mjs'

const source = readFileSync(new URL('../../views/EngineeringView.vue', import.meta.url), 'utf8')
const block = (from, to) => source.slice(source.indexOf(from), to ? source.indexOf(to) : undefined)
const count = (text, re) => (text.match(re) || []).length

test('英文「关于」页与中文数据条目一一对应', () => {
  assert.equal(aboutEn.pipeline.length, count(block('const pipeline = [', 'const currentUpdates = ['), /title:/g))
  assert.equal(aboutEn.currentUpdates.length, count(block('const currentUpdates = [', 'const historyUpdates = ['), /tag:/g))
  assert.equal(aboutEn.historyUpdates.length, count(block('const historyUpdates = [', 'const modules = ['), /tag:/g))
  const modulesZh = block('const modules = [', 'const promises = [')
  assert.equal(aboutEn.modules.length, count(modulesZh, /kicker:/g))
  assert.equal(aboutEn.modules.reduce((n, m) => n + m.items.length, 0), count(modulesZh, /label:/g))
  assert.equal(aboutEn.promises.length, count(block('const promises = [', '// i18n-ignore-end'), /title:/g))
})

test('英文长文不含中文', () => {
  assert.doesNotMatch(JSON.stringify(aboutEn), /[㐀-鿿]/)
})
