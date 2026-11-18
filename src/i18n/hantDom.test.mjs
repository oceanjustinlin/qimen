import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { decideWrite, isSkippedElement, startHantDom, CONVERTED_ATTRIBUTES } from './hantDom.mjs'

const convert = (s) => s.replace(/时/g, '時').replace(/宫/g, '宮')

test('decideWrite：需要转换时返回新值；与上次写入值相同或无变化时返回 null', () => {
  assert.equal(decideWrite('时干落宫', undefined, convert), '時干落宮')
  assert.equal(decideWrite('時干落宮', '時干落宮', convert), null) // 自己写的，不再处理
  assert.equal(decideWrite('English', undefined, convert), null)
  assert.equal(decideWrite('', undefined, convert), null)
  assert.equal(decideWrite(null, undefined, convert), null)
})

test('isSkippedElement：跳过用户内容与输入控件', () => {
  const el = (tagName, skip = false) => ({ tagName, closest: (sel) => (skip && sel.includes('data-i18n-skip') ? {} : null) })
  assert.equal(isSkippedElement(el('DIV')), false)
  assert.equal(isSkippedElement(el('SPAN', true)), true)
  for (const tag of ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']) assert.equal(isSkippedElement(el(tag)), true, tag)
  assert.equal(isSkippedElement(null), false)
})

test('转换的属性：placeholder / title / aria-label / alt', () => {
  assert.deepEqual(CONVERTED_ATTRIBUTES, ['placeholder', 'title', 'aria-label', 'alt'])
})

test('参数不全时 startHantDom 返回空的 stop()', () => {
  const stop = startHantDom(null, convert)
  assert.equal(typeof stop, 'function')
  stop()
})

test('源码约定：观察 childList / subtree / characterData / 属性，stop 时断开并恢复原文', () => {
  const src = readFileSync(new URL('./hantDom.mjs', import.meta.url), 'utf8')
  for (const key of ['childList: true', 'subtree: true', 'characterData: true', 'attributeFilter: CONVERTED_ATTRIBUTES']) {
    assert.ok(src.includes(key), key)
  }
  assert.match(src, /observer\.disconnect\(\);\s*restore\(\);/)
})
