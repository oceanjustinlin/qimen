<template>
  <div class="account-menu-wrap">
    <button class="account-menu-btn" type="button" :title="t('account.menuTitle')" :aria-label="t('account.menu')" @click.stop="toggleMenu">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.2"/>
        <path d="M2 15c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </button>

    <div class="account-menu-panel" :class="{ open: isOpen }" @click.stop>
      <div class="account-menu-identity">{{ identityText }}</div>
      <router-link class="account-menu-link featured" to="/engineering" @click="closeMenu">
        {{ t('account.about') }}
      </router-link>
      <router-link v-if="globalState.currentUser" class="account-menu-link" to="/reset-password" @click="closeMenu">
        {{ t('account.changePassword') }}
      </router-link>
      <router-link v-if="!globalState.currentUser" class="account-menu-link" :to="{ path: '/', query: { auth: 'login' } }" @click="closeMenu">
        {{ t('account.signIn') }}
      </router-link>
      <router-link v-if="!globalState.currentUser" class="account-menu-link" :to="{ path: '/', query: { auth: 'register' } }" @click="closeMenu">
        {{ t('account.register') }}
      </router-link>

      <!-- 主题切换：单击循环 -->
      <button class="account-menu-link theme-cycle-row" type="button" @click.stop="cycleTheme">
        <span>{{ t('account.theme') }}</span>
        <span class="theme-current">{{ currentThemeLabel }}</span>
      </button>

      <!-- 语言切换：单击循环，交互与主题行相同 -->
      <button v-if="showLanguageRow" class="account-menu-link theme-cycle-row language-cycle-row" type="button" @click.stop="cycleLocale">
        <span>{{ t('account.language') }}</span>
        <span class="theme-current" data-i18n-skip>{{ currentLocaleLabel }}</span>
      </button>

      <router-link class="account-menu-link feedback" to="/feedback" @click="closeMenu">
        {{ t('account.feedback') }}
      </router-link>
      <button v-if="globalState.currentUser" class="account-menu-action" type="button" @click="handleSignOut">
        {{ t('account.signOut') }}
      </button>
      <AfdianSupportLink />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.mjs'
import { globalState } from '../store.js'
import { themePreference, setThemePreference } from '../composables/useTheme.js'
import AfdianSupportLink from './AfdianSupportLink.vue'
import { useI18n } from 'vue-i18n'
import { ENABLED_LOCALES, LOCALE_NATIVE_NAMES, nextLocale, setLocale } from '../i18n/index.mjs'
const router = useRouter()

const isOpen = ref(false)
const { t, locale } = useI18n()

const THEME_ORDER = ['light', 'dark', 'system']
const THEME_LABEL_KEYS = { light: 'account.themeLight', dark: 'account.themeDark', system: 'account.themeSystem' }

const currentThemeLabel = computed(() => t(THEME_LABEL_KEYS[themePreference.value] ?? 'account.themeSystem'))

const cycleTheme = () => {
  const idx = THEME_ORDER.indexOf(themePreference.value)
  setThemePreference(THEME_ORDER[(idx + 1) % 3])
}

const showLanguageRow = ENABLED_LOCALES.length >= 2
const currentLocaleLabel = computed(() => LOCALE_NATIVE_NAMES[locale.value] ?? LOCALE_NATIVE_NAMES['zh-CN'])
const cycleLocale = () => {
  setLocale(nextLocale(locale.value, ENABLED_LOCALES))
}

const identityText = computed(() => {
  if (globalState.currentUser?.email) return globalState.currentUser.email
  if (globalState.isGuest) return t('account.identityGuest')
  return t('account.identityAnonymous')
})

const closeMenu = () => {
  isOpen.value = false
}

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const closeOnDocumentClick = () => {
  closeMenu()
}

const handleSignOut = async () => {
  await supabase.auth.signOut()
  closeMenu()
  router.push('/')
}

onMounted(() => {
  document.addEventListener('click', closeOnDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', closeOnDocumentClick)
})
</script>

<style scoped>
.account-menu-wrap {
  position: relative;
  flex: 0 0 auto;
}

.account-menu-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gold-border);
  border-radius: 50%;
  background: rgba(212,175,55,0.08);
  color: rgba(212,175,55,0.78);
  cursor: pointer;
  transition: border-color .2s, background .2s, color .2s, transform .2s;
}

.account-menu-btn:hover {
  border-color: rgba(232,204,128,0.48);
  background: rgba(212,175,55,0.14);
  color: var(--gold-light);
  transform: translateY(-1px);
}

.account-menu-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 500;
  min-width: 200px;
  padding: 8px 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg-card);
  box-shadow: 0 14px 42px rgba(0,0,0,0.18);
  backdrop-filter: blur(24px) saturate(1.25);
  -webkit-backdrop-filter: blur(24px) saturate(1.25);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-6px) scale(0.97);
  transform-origin: top right;
  transition: opacity .22s var(--ease), transform .22s var(--ease);
}

.account-menu-panel.open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.account-menu-identity {
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  word-break: break-all;
}

.account-menu-link,
.account-menu-action {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: color .18s, background .18s;
}

.account-menu-link:hover,
.account-menu-action:hover {
  color: var(--gold-light);
  background: var(--gold-dim);
}

.account-menu-link.featured {
  color: var(--teal);
}

.account-menu-link.feedback {
  color: var(--gold);
}

.account-menu-action {
  color: var(--gold);
}

/* 主题切换行 */
.theme-cycle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.theme-current {
  font-size: 12px;
  color: var(--ink-muted);
  transition: color .18s;
}

.theme-cycle-row:hover .theme-current {
  color: var(--gold-light);
}
</style>

<style>
[data-theme="dark"] .account-menu-panel {
  background: rgba(14,14,31,0.97);
  border-color: var(--gold-border);
  box-shadow: 0 14px 42px rgba(0,0,0,0.62);
}
</style>
