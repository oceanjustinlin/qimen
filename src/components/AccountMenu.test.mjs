import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./AccountMenu.vue', import.meta.url), 'utf8')

test('访客账号菜单展示登录和注册入口而不是退出登录', () => {
  assert.match(source, /v-if="!globalState\.currentUser"/)
  assert.match(source, /\{\{ t\('account\.signIn'\) \}\}/)
  assert.match(source, /\{\{ t\('account\.register'\) \}\}/)
  assert.doesNotMatch(source, /globalState\.currentUser \|\| globalState\.isGuest[\s\S]*account\.signOut/)
})

test('语言行复用主题行样式，不新增颜色', () => {
  assert.match(source, /class="account-menu-link theme-cycle-row language-cycle-row"/)
  assert.match(source, /v-if="showLanguageRow"/)
  assert.match(source, /ENABLED_LOCALES\.length >= 2/)
  assert.match(source, /setLocale\(nextLocale\(/)
  // 新行没有自己的样式块
  assert.doesNotMatch(source, /\.language-cycle-row\s*\{/)
})

test('语言自称三个字符串不翻译，且跳过繁体转换', () => {
  assert.match(source, /<span class="theme-current" data-i18n-skip>\{\{ currentLocaleLabel \}\}<\/span>/)
})
