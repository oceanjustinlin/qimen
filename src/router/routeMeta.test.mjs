import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import zhCN from '../i18n/locales/zh-CN.mjs'

// router/index.js 会 import .vue，Node 里加载不了；这里抽出 resolveRouteMeta 的源码单独执行。
const source = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
const fnSrc = source.slice(source.indexOf('const SEO_KEYS'), source.indexOf('const router = createRouter'))
const routesSrc = source.slice(source.indexOf('routes: ['), source.indexOf('router.beforeEach'))

async function load() {
  const enUS = (await import('../i18n/locales/en-US.mjs')).default
  // eslint-disable-next-line no-new-func
  return new Function('enUS', `${fnSrc.replace('export function', 'function')}; return resolveRouteMeta`)(enUS)
}

const CJK = /[㐀-鿿]/

test('英文标题不含汉字；中文标题等于路由里的 seoTitle / title', async () => {
  const resolve = await load()
  const home = { name: 'home', meta: { seoTitle: '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道', title: 'x' } }
  assert.equal(resolve(home, 'zh-CN').title, '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道')
  assert.equal(resolve(home, 'zh-TW').title, '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道')
  for (const name of ['home', 'bazi', 'reports', 'fortune', 'engineering', 'feedback', 'reset-password', 'terms', 'privacy', 'unknown']) {
    const r = resolve({ name, meta: {} }, 'en-US')
    assert.ok(r.title && !CJK.test(r.title) && !CJK.test(r.description), name)
  }
})

test('zh-CN 词条 seo.* 与路由里的中文逐字一致', () => {
  for (const [key, entry] of Object.entries(zhCN.seo)) {
    if (key === 'defaultTitle') continue
    assert.ok(routesSrc.includes(`'${entry.title}'`), `${key}.title`)
    if (entry.description) assert.ok(routesSrc.includes(`'${entry.description}'`), `${key}.description`)
  }
})
