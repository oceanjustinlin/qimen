import { currentLocale } from './index.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { apiErrorText, localeJson, withLocale, withLocaleQuery } from './requestLocale.mjs'

test('withLocale / localeJson 带上界面语言', () => {
  assert.deepEqual(withLocale({ a: 1 }, 'en-US'), { a: 1, locale: 'en-US' })
  assert.equal(localeJson({ a: 1 }, 'zh-TW'), '{"a":1,"locale":"zh-TW"}')
  // 默认取当前界面语言（Node 的 navigator.language 是 en-US，英文开放后初始即英文）
  assert.equal(withLocale({}).locale, currentLocale())
})

test('withLocaleQuery 追加或覆盖 locale', () => {
  assert.equal(withLocaleQuery('/api/x', 'en-US'), '/api/x?locale=en-US')
  assert.equal(withLocaleQuery('/api/x?a=1&locale=zh-CN', 'en-US'), '/api/x?a=1&locale=en-US')
  assert.equal(withLocaleQuery('/api/x?a=1#h', 'zh-TW'), '/api/x?a=1&locale=zh-TW#h')
})

test('apiErrorText：有 code 用词条，否则原文', () => {
  const dict = { 'error.QUOTA_EXCEEDED': 'Quota used' }
  const ctx = { t: (k) => dict[k], te: (k) => k in dict }
  assert.equal(apiErrorText({ error: '额度已用尽', code: 'QUOTA_EXCEEDED' }, ctx), 'Quota used')
  assert.equal(apiErrorText({ error: '原文', code: 'UNKNOWN' }, ctx), '原文')
  assert.equal(apiErrorText({ message: 'msg' }, ctx), 'msg')
  assert.equal(apiErrorText(null, ctx, 'fb'), 'fb')
})

test('前端发往 Worker 的每个 fetch 都带语言', () => {
  for (const view of ['HomeView', 'BaziView', 'FortuneView']) {
    const src = readFileSync(new URL(`../views/${view}.vue`, import.meta.url), 'utf8')
    assert.doesNotMatch(src, /body: JSON\.stringify\(/, view)
    for (const m of src.matchAll(/fetch\(([^\n]*)/g)) {
      const call = m[1]
      if (/apiPath\(`\/api\/[^`]*\?/.test(call)) assert.match(call, /withLocaleQuery/, `${view}: ${call}`)
    }
  }
})

test('localizeApiError：中文界面原样，英文界面用词条', async () => {
  const { localizeApiError } = await import('./requestLocale.mjs')
  const dict = { 'error.QUOTA_EXCEEDED': 'Quota used' }
  const base = { t: (k) => dict[k], te: (k) => k in dict }
  const payload = { error: '额度已用尽', code: 'QUOTA_EXCEEDED' }
  assert.equal(localizeApiError(payload, { ...base, locale: 'zh-CN' }, '额度已用尽'), '额度已用尽')
  assert.equal(localizeApiError(payload, { ...base, locale: 'zh-TW' }, '额度已用尽'), '额度已用尽')
  assert.equal(localizeApiError(payload, { ...base, locale: 'en-US' }, '额度已用尽'), 'Quota used')
  assert.equal(localizeApiError({ error: 'x' }, { ...base, locale: 'en-US' }, 'x'), 'x')
})
