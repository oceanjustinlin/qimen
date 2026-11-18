<template>
  <a
    class="afdian-link"
    :href="afdianUrl"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="t('links.afdian')"
    :title="t('links.supportCreator')"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.25c3.95 0 7.15 2.3 7.15 5.15 0 1.87-1.38 3.5-3.45 4.4l.64 4.7a.9.9 0 0 1-1.35.88L12 16.6l-2.99 1.78a.9.9 0 0 1-1.35-.88l.64-4.7c-2.07-.9-3.45-2.53-3.45-4.4 0-2.85 3.2-5.15 7.15-5.15Zm0 2c-2.74 0-5.15 1.47-5.15 3.15 0 1.05.96 2.04 2.46 2.62.4.15.66.54.64.96l-.43 3.14 2.02-1.2a.9.9 0 0 1 .92 0l2.02 1.2-.43-3.14c-.02-.42.24-.81.64-.96 1.5-.58 2.46-1.57 2.46-2.62 0-1.68-2.41-3.15-5.15-3.15Z"
        fill="currentColor"
      />
      <path
        d="M10.2 7.95c.55-.53 1.28-.45 1.8.11.52-.56 1.25-.64 1.8-.11.64.62.6 1.63-.09 2.33L12 12l-1.71-1.72c-.69-.7-.73-1.71-.09-2.33Z"
        fill="currentColor"
      />
    </svg>
    <span>{{ t('links.supportCreator') }}</span>
  </a>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const afdianUrl = import.meta.env.VITE_AFDIAN_URL || 'https://ifdian.net/a/oceanjustinlin'
</script>

<style scoped>
.afdian-link {
  width: 100%;
  min-height: 44px;
  padding: 11px 16px;
  border: 0;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.08), rgba(212, 175, 55, 0.02));
  color: var(--gold-light);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 9px;
  text-decoration: none;
  font-size: 13px;
  transition: background 0.25s var(--ease), color 0.25s var(--ease);
}

.afdian-link:hover,
.afdian-link:focus-visible {
  background: rgba(212, 175, 55, 0.12);
  color: var(--gold-light);
  outline: none;
}

.afdian-link svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

.afdian-link span {
  line-height: 1;
}
</style>
