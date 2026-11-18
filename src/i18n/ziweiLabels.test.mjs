import test from 'node:test'
import assert from 'node:assert/strict'
import { ZIWEI_MAJOR_STARS, ZIWEI_PALACES, ziweiLabel } from './ziweiLabels.mjs'

test('ziweiLabel：英文为 English (汉字)，中文原样', () => {
  assert.equal(ziweiLabel('紫微', 'star', 'en-US'), 'Zi Wei (紫微)')
  assert.equal(ziweiLabel('紫微', 'star', 'zh-CN'), '紫微')
  assert.equal(ziweiLabel('紫微', 'star', 'zh-TW'), '紫微')
  assert.equal(ziweiLabel('财帛', 'palace', 'en-US'), 'Wealth (财帛)')
  assert.equal(ziweiLabel('命宫', 'palace', 'en-US'), 'Life (命宫)')
  assert.equal(ziweiLabel('忌', 'mutagen', 'en-US'), 'Ji (忌)')
  assert.equal(ziweiLabel('天喜', 'star', 'en-US'), '天喜')
})

test('十四主星与十二宫都有英文名', () => {
  assert.equal(ZIWEI_MAJOR_STARS.length, 14)
  for (const s of ZIWEI_MAJOR_STARS) assert.match(ziweiLabel(s, 'star', 'en-US'), /^[A-Z][a-z]+ [A-Z][a-z]+ \(/)
  for (const p of ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母']) {
    assert.notEqual(ziweiLabel(p, 'palace', 'en-US'), p.endsWith('宫') ? p : `${p}宫`, p)
  }
  assert.ok(ZIWEI_PALACES.length >= 12)
})
