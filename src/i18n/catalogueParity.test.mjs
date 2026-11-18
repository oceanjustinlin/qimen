import test from 'node:test'
import assert from 'node:assert/strict'

import zhCN from './locales/zh-CN.mjs'
import enUS from './locales/en-US.mjs'

const CJK = /[㐀-鿿]/
// en-US 里允许出现汉字的键（盘面符号等）
const EN_CJK_ALLOW = new Set([])

function leaves(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, key, out)
    else out.set(key, v)
  }
  return out
}

const params = (s) => new Set((String(s).match(/\{(\w+)\}/g) || []).sort())

const zh = leaves(zhCN)
const en = leaves(enUS)

test('两份词条的根结构与叶子键集合完全相同', () => {
  assert.deepEqual(Object.keys(enUS).sort(), Object.keys(zhCN).sort())
  assert.deepEqual([...en.keys()].sort(), [...zh.keys()].sort())
})

test('同一个键的插值参数名相同', () => {
  for (const [key, value] of zh) {
    assert.deepEqual([...params(en.get(key))], [...params(value)], key)
  }
})

test('en-US 不含汉字（白名单除外）；zh-CN 不为空', () => {
  for (const [key, value] of en) {
    if (EN_CJK_ALLOW.has(key)) continue
    const text = Array.isArray(value) ? value.join('\n') : String(value)
    assert.ok(!CJK.test(text), `${key}: ${text}`)
  }
  for (const [key, value] of zh) {
    if (/^seo\.\w+\.description$/.test(key)) continue
    assert.ok(Array.isArray(value) ? value.length > 0 : String(value).length > 0, key)
  }
})
