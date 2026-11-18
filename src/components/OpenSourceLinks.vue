<template>
  <div class="open-source-links" :aria-label="t('links.openSource')">
    <a
      class="source-link"
      :href="githubUrl"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t('links.viewGithub')"
      :title="t('links.githubSource')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.63-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.94c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9v2.81c0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"
          fill="currentColor"
        />
      </svg>
    </a>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const githubUrl = import.meta.env.VITE_GITHUB_URL || 'https://github.com/oceanjustinlin/qimen'
</script>

<style scoped>
.open-source-links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.source-link {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--gold-border);
  background: rgba(212, 175, 55, 0.08);
  color: rgba(232, 204, 128, 0.84);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: border-color 0.25s var(--ease), background 0.25s var(--ease), color 0.25s var(--ease), transform 0.25s var(--ease);
}

.source-link:hover,
.source-link:focus-visible {
  border-color: rgba(232, 204, 128, 0.48);
  background: rgba(212, 175, 55, 0.15);
  color: var(--gold-light);
  transform: translateY(-1px);
  outline: none;
}

.source-link svg {
  width: 17px;
  height: 17px;
}

@media (max-width: 380px) {
  .open-source-links {
    gap: 6px;
  }

  .source-link {
    width: 32px;
    height: 32px;
  }
}
</style>
