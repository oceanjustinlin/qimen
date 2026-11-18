<template>
  <main class="feedback-page">
    <section class="feedback-container" :aria-label="t('feedbackPage.title')">
      <router-link class="back-link" to="/" :aria-label="t('feedbackPage.backHome')">
        <span aria-hidden="true">←</span>
        <span>{{ t('common.back') }}</span>
      </router-link>

      <article class="feedback-card">
        <div class="card-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4.8 6.8c1.9-2 5-2 6.9 0l.3.3.3-.3c1.9-2 5-2 6.9 0 1.9 2 1.9 5.2 0 7.2L12 21 4.8 14c-1.9-2-1.9-5.2 0-7.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="feedback-copy">
          <h1>{{ t('feedbackPage.title') }}</h1>
          <p class="feedback-lead">{{ t('feedbackPage.lead') }}</p>
          <p>
            {{ t('feedbackPage.intro') }}
          </p>
          <p class="open-source-note">
            {{ t('feedbackPage.starBefore') }}
            <a href="https://github.com/oceanjustinlin/qimen" target="_blank" rel="noreferrer">oceanjustinlin/qimen</a>
            {{ t('feedbackPage.starAfter') }}
          </p>
        </div>

        <div class="contact-strip">
          <span>{{ t('feedbackPage.email') }}</span>
          <div class="email-line">
            <a :href="mailHref">oceanjustinlin@gmail.com</a>
            <button class="copy-email-mini" type="button" @click="copyEmail">
              {{ copied ? t('feedbackPage.copied') : t('feedbackPage.copy') }}
            </button>
          </div>
        </div>

        <div class="feedback-actions">
          <a class="primary-action" :href="formUrl" target="_blank" rel="noreferrer">
            <span>{{ t('feedbackPage.form') }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8"/>
            </svg>
          </a>
          <a class="secondary-action" :href="mailHref">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v12H4z"/>
              <path d="m4 7 8 6 8-6"/>
            </svg>
            <span>{{ t('feedbackPage.sendEmail') }}</span>
          </a>
        </div>

        <p class="privacy-note">{{ t('feedbackPage.privacy') }}</p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const email = 'oceanjustinlin@gmail.com'
const copied = ref(false)
const formUrl = 'https://my.feishu.cn/share/base/form/shrcn58XbiIxTbzl4GxHtBdX61c'
const mailHref = computed(() => {
  const subject = encodeURIComponent(t('feedbackPage.mailSubject'))
  const body = encodeURIComponent(t('feedbackPage.mailBody'))
  return `mailto:${email}?subject=${subject}&body=${body}`
})

const copyEmail = async () => {
  try {
    await navigator.clipboard.writeText(email)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    window.prompt(t('feedbackPage.copyEmail'), email)
  }
}
</script>

<style scoped>
.feedback-page {
  position: relative;
  min-height: 100vh;
  padding: 46px 18px 58px;
  overflow: hidden;
}

.feedback-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(232,204,128,0.05) 0 1px, transparent 1px) 0 0 / 86px 86px,
    linear-gradient(180deg, rgba(232,204,128,0.035) 0 1px, transparent 1px) 0 0 / 86px 86px;
  mask-image: radial-gradient(circle at 50% 34%, #000 0%, transparent 66%);
}

.feedback-container {
  position: relative;
  z-index: 1;
  width: min(620px, 100%);
  min-height: calc(100vh - 104px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.back-link {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-dim);
  text-decoration: none;
  font-size: 14px;
  transition: color .2s, transform .2s;
}

.back-link:hover {
  color: var(--gold);
  transform: translateX(-2px);
}

.feedback-card {
  position: relative;
  margin: auto 0;
  padding: 22px 0 0;
}

.card-mark {
  position: relative;
  width: 44px;
  height: 44px;
  margin-bottom: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--gold);
  border: 1px solid rgba(181,141,59,0.18);
  background: rgba(181,141,59,0.08);
}

.card-mark svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linejoin: round;
}

.feedback-copy {
  position: relative;
}

.feedback-kicker {
  margin: 0 0 10px;
  color: rgba(78,205,196,0.86);
  font-size: 11px;
  letter-spacing: .22em;
}

.feedback-copy h1 {
  margin: 0 0 14px;
  color: var(--gold);
  font-family: var(--font-serif);
  font-size: clamp(26px, 6vw, 34px);
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: .04em;
}

.feedback-copy p {
  margin: 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.9;
}

.feedback-copy .feedback-lead {
  margin-bottom: 12px;
  color: var(--ink);
}

.feedback-copy .open-source-note {
  margin-top: 14px;
  color: #6f5a2a;
}

.feedback-copy .open-source-note a {
  color: #04756f;
  text-decoration: none;
  border-bottom: 1px solid rgba(4,117,111,0.32);
}

.feedback-copy .open-source-note a:hover {
  color: #075e59;
  border-bottom-color: rgba(4,117,111,0.66);
}

.contact-strip {
  position: relative;
  margin: 24px 0 20px;
  padding: 13px 14px;
  display: grid;
  gap: 7px;
  border: 1px solid rgba(13,148,136,0.2);
  border-radius: 12px;
  background: rgba(13,148,136,0.055);
}

.contact-strip > span {
  color: var(--ink-dim);
  font-size: 11px;
}

.email-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.email-line a {
  min-width: 0;
  color: #04756f;
  font-size: 14px;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.copy-email-mini {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(13,148,136,0.26);
  background: rgba(13,148,136,0.08);
  color: #04756f;
  font-family: var(--font-body);
  font-size: 12px;
  cursor: pointer;
  transition: border-color .2s, background .2s, color .2s;
}

.copy-email-mini:hover {
  border-color: rgba(13,148,136,0.44);
  background: rgba(13,148,136,0.13);
  color: #075e59;
}

.feedback-actions {
  position: relative;
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 10px;
}

.primary-action,
.secondary-action {
  min-height: 46px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  text-decoration: none;
  transition: transform .2s, border-color .2s, background .2s, color .2s;
}

.primary-action {
  color: #120d03;
  font-weight: 700;
  background: linear-gradient(135deg, #F0D990 0%, #C4983C 100%);
  box-shadow: 0 12px 34px rgba(212,175,55,0.18);
}

.secondary-action {
  color: var(--ink-muted);
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.45);
}

.primary-action:hover,
.secondary-action:hover {
  transform: translateY(-1px);
}

.secondary-action:hover {
  border-color: rgba(232,204,128,0.36);
  color: var(--gold-light);
}

.primary-action svg,
.secondary-action svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.privacy-note {
  position: relative;
  margin: 16px 0 0;
  color: var(--ink-dim);
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 640px) {
  .feedback-page {
    padding: 28px 14px 36px;
  }

  .feedback-container {
    min-height: calc(100vh - 64px);
  }

  .feedback-card {
    margin: 26px 0 0;
    padding: 24px 20px;
  }

  .feedback-actions {
    grid-template-columns: 1fr;
  }

  .email-line {
    align-items: flex-start;
  }
}
</style>
