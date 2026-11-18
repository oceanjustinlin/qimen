<template>
  <div class="reset-password-view">
    <header id="siteHeader">
      <router-link class="back-link" to="/">{{ t('common.back') }}</router-link>
      <div class="site-logo">{{ t('resetPassword.header') }}</div>
      <div class="header-spacer"></div>
    </header>

    <main class="reset-page-wrap">
      <section class="reset-panel">
        <div class="section-kicker">PASSWORD</div>
        <h1>{{ t('resetPassword.title') }}</h1>
        <p class="reset-copy">
          {{ sessionReady ? t('resetPassword.ready') : t('resetPassword.noSession') }}
        </p>

        <div class="reset-form">
          <label>
            <span>{{ t('resetPassword.newPassword') }}</span>
            <input v-model="password" type="password" autocomplete="new-password" :placeholder="t('resetPassword.minLength')">
          </label>
          <label>
            <span>{{ t('resetPassword.confirmPassword') }}</span>
            <input v-model="confirmPassword" type="password" autocomplete="new-password" :placeholder="t('resetPassword.repeat')">
          </label>

          <button class="reset-submit" :disabled="isSubmitting || !sessionReady" @click="handlePasswordUpdate">
            {{ isSubmitting ? t('resetPassword.saving') : t('resetPassword.submit') }}
          </button>
        </div>

        <div v-if="notice" class="reset-notice" :class="{ success: isSuccess }">{{ notice }}</div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '../lib/supabase.mjs'
import { setCurrentUser } from '../store.js'
import { validatePasswordUpdate } from '../auth/passwordReset.mjs'

const router = useRouter()
const { t } = useI18n()
const password = ref('')
const confirmPassword = ref('')
const session = ref(null)
const notice = ref('')
const isSubmitting = ref(false)
const isSuccess = ref(false)
let authSubscription = null

const sessionReady = computed(() => Boolean(session.value))

onMounted(async () => {
  const { data: { session: currentSession } } = await supabase.auth.getSession()
  session.value = currentSession
  setCurrentUser(currentSession?.user || null)

  const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    session.value = nextSession
    setCurrentUser(nextSession?.user || null)
  })
  authSubscription = data?.subscription
})

onUnmounted(() => {
  authSubscription?.unsubscribe()
})

const handlePasswordUpdate = async () => {
  const validationError = validatePasswordUpdate(password.value, confirmPassword.value, t)
  if (validationError) {
    notice.value = validationError
    isSuccess.value = false
    return
  }

  isSubmitting.value = true
  notice.value = ''
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error
    isSuccess.value = true
    notice.value = t('resetPassword.done')
    window.setTimeout(() => router.push('/'), 900)
  } catch (error) {
    isSuccess.value = false
    notice.value = t('resetPassword.failed', { error: error.message })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.reset-password-view { width: 100%; min-height: 100vh; background: var(--paper); }
#siteHeader {
  position: fixed; top: 0; left: 0; right: 0; z-index: 300;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: var(--header-bg);
  border-bottom: 1px solid var(--line);
}
.site-logo { font-family: var(--font-serif); font-size: 17px; letter-spacing: .15em; font-weight: 500; color: var(--gold); }
.back-link, .header-spacer { width: 46px; }
.back-link { color: var(--text-muted); font-size: 13px; text-decoration: none; }
.back-link:hover { color: var(--ink); }
.reset-page-wrap { position: relative; z-index: 1; min-height: 100vh; display: grid; place-items: center; padding: 92px 18px 46px; }
.reset-panel { width: min(100%, 420px); padding: 28px 24px 24px; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--bg-card); box-shadow: 0 1px 6px rgba(0,0,0,0.06); animation: riseIn .75s cubic-bezier(.22,1,.36,1) both; }
.section-kicker { color: var(--text-muted); font-size: 10px; letter-spacing: .28em; margin-bottom: 10px; }
h1 { margin: 0; color: var(--ink); font-family: var(--font-serif); font-size: 28px; font-weight: 500; letter-spacing: .08em; }
.reset-copy { margin: 12px 0 24px; color: var(--ink-muted); font-size: 13px; line-height: 1.8; }
.reset-form { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 6px; color: var(--ink-muted); font-size: 12px; letter-spacing: .04em; }
input { width: 100%; min-height: 48px; background: var(--paper-soft); border: 1px solid var(--line); border-radius: var(--radius-item); padding: 13px 16px; color: var(--ink); font-size: 15px; font-family: var(--font-body); outline: none; transition: border-color .2s, box-shadow .2s; }
input:focus { border-color: var(--gold-border); box-shadow: 0 0 0 3px var(--gold-dim); }
.reset-submit { width: 100%; min-height: 50px; margin-top: 6px; border: none; border-radius: var(--radius-item); background: var(--ink); color: var(--paper); font-size: 15px; font-family: var(--font-serif); font-weight: 600; letter-spacing: .08em; cursor: pointer; transition: opacity .18s, transform .15s; }
.reset-submit:not(:disabled):hover { opacity: 0.88; }
.reset-submit:active { transform: scale(.983); }
.reset-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.reset-notice { margin-top: 14px; padding: 11px 12px; border-radius: 12px; background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.18); color: var(--crimson); font-size: 12px; line-height: 1.6; }
.reset-notice.success { background: rgba(13,148,136,0.07); border-color: rgba(13,148,136,0.2); color: var(--teal); }
@keyframes riseIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
</style>

<style>
[data-theme="dark"] .reset-submit:not(:disabled) {
  background: linear-gradient(135deg, #8B6914 0%, #D4AF37 45%, #E8CC80 65%, #D4AF37 85%, #8B6914 100%);
  color: #1a1000;
}
</style>
