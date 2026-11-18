import test from 'node:test'
import assert from 'node:assert/strict'

import { isHantReady, loadHantConverter, toHantSync } from './hant.mjs'

test('转换器未加载时 toHantSync 原样返回，不抛错', () => {
  assert.equal(isHantReady(), false)
  assert.equal(toHantSync('时干落宫'), '时干落宫')
  assert.equal(toHantSync(undefined), undefined)
})

test('懒加载 opencc 后走保护词表 + 通用转换，且只加载一次', async () => {
  const a = loadHantConverter()
  const b = loadHantConverter()
  const [convertA, convertB] = await Promise.all([a, b])
  assert.equal(convertA, convertB)
  assert.equal(isHantReady(), true)
  assert.equal(toHantSync('时干落宫'), '時干落宮')
  assert.equal(toHantSync('丑未冲，请先登录'), '丑未沖，請先登入')
  assert.equal(toHantSync('Open Door 72'), 'Open Door 72')
  // 幂等
  assert.equal(toHantSync(toHantSync('日干克时干')), '日干剋時干')
})
