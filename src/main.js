// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router, { resolveRouteMeta } from './router'
import i18n from './i18n/index.mjs'
import { displayText, installLocaleDisplay, prepareLocale } from './i18n/localeDisplay.mjs'
import { supabase } from './lib/supabase.mjs'
import { installSessionSync, restoreSession } from './auth/cookieSession.mjs'
import { setCurrentUser } from './store.js'

// 引入全局 CSS（稍后创建）
import './styles/global.css'

// Update <title>, <meta name="description">, robots, and OG tags on every navigation.
// Keeps tab titles correct for humans and social-share previews accurate per route.
router.afterEach((to) => applyRouteHead(to))

function applyRouteHead(to) {
  const m = to.meta ?? {}

  // 中文：const title = m.seoTitle ?? m.title（取值规则见 resolveRouteMeta）；英文取 en-US 词条
  const resolved = resolveRouteMeta(to, i18n.global.locale.value)
  const shownTitle = displayText(resolved.title)
  const description = displayText(resolved.description)
  document.title = shownTitle

  setMeta('name', 'description', description)
  setMeta('name', 'robots', m.robots ?? 'index, follow')
  setMeta('property', 'og:title', shownTitle)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', `https://www.qimendao.com${to.path === '/' ? '' : to.path}`)
  if (m.ogImage) setMeta('property', 'og:image', m.ogImage)

  const canonical = `https://www.qimendao.com${to.path === '/' ? '' : to.path}`
  let link = document.querySelector('link[rel="canonical"]')
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link) }
  link.href = canonical
}

function setMeta(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.setAttribute('content', value)
}

// 语言写 <html lang>，主题写 <html data-theme>，两者互不读取。
document.documentElement.lang = i18n.global.locale.value

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Cookie-session durability: keep the HttpOnly refresh-token cookie in sync, and
// if localStorage has no session (e.g. iOS/Safari ITP wiped it, or a fresh PWA
// jar), restore it from the cookie before mounting so the user stays logged in.
installSessionSync()
;(async () => {
  let user = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    user = session?.user || (await restoreSession())
  } catch {
    /* fail-soft: never block app boot on session restore */
  }
  // Seed auth state before the first paint so a logged-in user (incl. one restored
  // from the cookie) doesn't flash the login screen while the async check resolves.
  setCurrentUser(user)
  // 繁体：先把转换器载好再挂载，避免首屏闪一下简体（最多等 4 秒，超时就先挂载，载好后再转）
  try {
    await Promise.race([
      prepareLocale(i18n.global.locale.value),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])
  } catch {
    /* fail-soft */
  }
  installLocaleDisplay(i18n, { onChange: () => applyRouteHead(router.currentRoute.value) })
  app.mount('#app')
})()
