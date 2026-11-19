import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { onRequest } from '../functions/_middleware.js'
import enUS from './i18n/locales/en-US.mjs'

const routerSource = readFileSync(new URL('./router/index.js', import.meta.url), 'utf8')

async function crawl(path, headers = {}) {
  const req = new Request(`https://www.qimendao.com${path}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', ...headers },
  })
  const res = await onRequest({ request: req, next: () => new Response('SPA') })
  return res.text()
}

const title = (html) => html.match(/<title>(.*?)<\/title>/)[1]
const desc = (html) => html.match(/<meta name="description" content="(.*?)">/)[1]

test('爬虫页中文标题/描述与路由 seoTitle/seoDescription 一致（避免与首页静态 head 分叉）', async () => {
  const routes = [['/', 'home'], ['/bazi', 'bazi'], ['/fortune', 'fortune'], ['/engineering', 'engineering']]
  for (const [path] of routes) {
    const html = await crawl(path)
    const block = routerSource.slice(routerSource.indexOf(`path: '${path}'`))
    const seoTitle = block.match(/seoTitle:\s*'(.*?)'/)[1]
    const seoDesc = block.match(/seoDescription:\s*'(.*?)'/)[1]
    assert.equal(title(html), seoTitle, `${path} title`)
    assert.equal(desc(html), seoDesc, `${path} description`)
  }
})

test('爬虫页英文标题/描述与 en-US 词条 seo.* 一致', async () => {
  const map = { '/': 'home', '/bazi': 'bazi', '/fortune': 'fortune', '/engineering': 'engineering', '/terms': 'terms', '/privacy': 'privacy' }
  for (const [path, key] of Object.entries(map)) {
    const html = await crawl(path, { 'accept-language': 'en-US,en;q=0.9' })
    assert.equal(title(html), enUS.seo[key].title.replace(/&/g, '&amp;'), `${path} title`)
    if (enUS.seo[key].description) assert.equal(desc(html), enUS.seo[key].description, `${path} description`)
  }
})

test('首页爬虫页带 FAQ 与结构化数据，且品牌为奇门道', async () => {
  const zh = await crawl('/')
  assert.match(zh, /<h1>奇门遁甲在线排盘与 AI 解盘<\/h1>/)
  assert.match(zh, /"@type":"FAQPage"/)
  assert.match(zh, /"@type":\["WebApplication","SoftwareApplication"\]/)
  assert.match(zh, /<meta property="og:site_name" content="奇门道">/)
  assert.match(zh, /<h2>常见问题<\/h2>/)
  const en = await crawl('/', { 'accept-language': 'en' })
  assert.match(en, /<html lang="en">/)
  assert.match(en, /"name":"Qimendao"/)
  assert.match(en, /<h2>FAQ<\/h2>/)
})

test('非首页不输出 FAQ，普通用户直通 SPA', async () => {
  assert.doesNotMatch(await crawl('/bazi'), /FAQPage/)
  const res = await onRequest({
    request: new Request('https://www.qimendao.com/', { headers: { 'user-agent': 'Mozilla/5.0 Safari' } }),
    next: () => new Response('SPA'),
  })
  assert.equal(await res.text(), 'SPA')
})
