<template>
  <div class="report-view">
    <header id="siteHeader">
      <div class="header-side"></div>
      <div class="site-logo">{{ t('reports.header') }}</div>
      <div class="header-side header-actions">
        <AccountMenu />
      </div>
    </header>

    <div class="page-wrap">
      <div class="container">
        <div class="report-header">
          <div class="section-kicker">{{ t('reports.kicker') }}</div>
          <div class="section-title">{{ t('reports.title') }}</div>
          <div class="section-sub">{{ t('reports.sub') }}</div>
        </div>

        <div class="report-list">
          <!-- 合盘报告 -->
          <a href="/wrapped.html" class="report-card card-friendship">
            <div class="card-glow"></div>
            <div class="report-card-content">
              <div class="card-top-row">
                <div class="report-icon">✨</div>
              </div>
              <h3 class="report-title">{{ t('reports.pair.title') }}</h3>
              <p class="report-subtitle">{{ t('reports.friends.subtitle') }}</p>
              <p class="report-desc">{{ t('reports.friends.desc') }}</p>
            </div>
            <div class="card-arrow">→</div>
          </a>

          <!-- 婚恋合盘 -->
          <a href="/wrapped.html?type=romance" class="report-card card-friendship card-romance">
            <div class="card-glow"></div>
            <div class="report-card-content">
              <div class="card-top-row">
                <div class="report-icon">❦</div>
              </div>
              <h3 class="report-title">{{ t('reports.pair.title') }}</h3>
              <p class="report-subtitle">{{ t('reports.love.subtitle') }}</p>
              <p class="report-desc">{{ t('reports.love.desc') }}</p>
            </div>
            <div class="card-arrow">→</div>
          </a>

          <!-- 占位卡 1 -->
          <div class="report-card card-locked">
            <div class="card-glow card-glow-blue"></div>
            <div class="report-card-content">
              <div class="card-top-row">
                <div class="report-icon report-icon-dim">🔮</div>
                <span class="card-tag card-tag-soon">{{ t('reports.soon') }}</span>
              </div>
              <h3 class="report-title report-title-dim">{{ t('reports.luck.title') }}</h3>
              <p class="report-subtitle report-subtitle-dim">{{ t('reports.luck.subtitle') }}</p>
              <p class="report-desc">{{ t('reports.luck.desc') }}</p>
            </div>
            <div class="locked-badge">🔒</div>
          </div>

          <!-- 占位卡 2 -->
          <div class="report-card card-locked">
            <div class="card-glow card-glow-red"></div>
            <div class="report-card-content">
              <div class="card-top-row">
                <div class="report-icon report-icon-dim">💼</div>
                <span class="card-tag card-tag-soon">{{ t('reports.soon') }}</span>
              </div>
              <h3 class="report-title report-title-dim">{{ t('reports.career.title') }}</h3>
              <p class="report-subtitle report-subtitle-dim">{{ t('reports.career.subtitle') }}</p>
              <p class="report-desc">{{ t('reports.career.desc') }}</p>
            </div>
            <div class="locked-badge">🔒</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import AccountMenu from '../components/AccountMenu.vue'

const { t } = useI18n()
</script>

<style scoped>
.report-view {
  min-height: 100vh;
  padding-bottom: 100px;
  background: var(--paper);
  color: var(--ink, #2c2a27);
}

#siteHeader {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 14px 16px;
  background: transparent;
  z-index: 100;
  position: relative;
}

.site-logo {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.15em;
  text-align: center;
  white-space: nowrap;
}

.header-side {
  display: flex;
  align-items: center;
}

.header-actions {
  justify-content: flex-end;
  gap: 12px;
}

.page-wrap {
  position: relative;
  z-index: 1;
  padding: 0 16px;
  max-width: 480px;
  margin: 0 auto;
}

.report-header {
  margin: 12px 0 24px;
}

.section-kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 6px;
}

.section-title {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.1;
  margin-bottom: 6px;
  font-synthesis: none;
}

.section-sub {
  font-size: 13px;
  color: var(--ink-muted);
  letter-spacing: 0.01em;
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Base card ── */
.report-card {
  display: block;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--line);
  box-shadow: 0 1px 4px rgba(11,11,11,0.06);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  padding: 22px 20px;
}

.report-card:not(.card-locked):active {
  transform: scale(0.97);
}

/* ── Active card hover ── */
.card-friendship {
  border-color: rgba(181, 141, 59, 0.3);
  cursor: pointer;
}
.card-friendship:hover {
  border-color: rgba(181, 141, 59, 0.55);
  box-shadow: 0 4px 20px rgba(181, 141, 59, 0.12);
}

/* ── Locked card ── */
.card-locked {
  opacity: 0.6;
  cursor: default;
}

/* ── Glow orbs ── */
.card-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(181, 141, 59, 0.1) 0%, transparent 70%);
  pointer-events: none;
  border-radius: 50%;
}
.card-glow-blue {
  background: radial-gradient(circle, rgba(107, 143, 255, 0.08) 0%, transparent 70%);
}
.card-glow-red {
  background: radial-gradient(circle, rgba(220, 38, 38, 0.07) 0%, transparent 70%);
}

/* ── Card content ── */
.report-card-content {
  position: relative;
  z-index: 1;
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.report-icon {
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  background: var(--paper-soft, #ebe6da);
  border-radius: 12px;
  border: 1px solid var(--line);
}

.report-icon-dim {
  filter: grayscale(0.4);
  opacity: 0.75;
}

.card-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(181, 141, 59, 0.12);
  color: var(--gold);
  border: 1px solid rgba(181, 141, 59, 0.3);
}

.card-tag-soon {
  background: var(--chrome, #efefef);
  color: var(--ink-dim);
  border-color: var(--line);
}

.report-title {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 4px;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.report-title-dim {
  color: var(--ink-muted);
}

.report-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.report-subtitle-dim {
  color: var(--ink-dim);
}

.report-desc {
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.6;
  margin-bottom: 14px;
  letter-spacing: 0.01em;
}

.card-arrow {
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: 18px;
  color: var(--gold);
  z-index: 1;
  transition: transform 0.2s, color 0.2s;
}

.card-friendship:hover .card-arrow {
  transform: translateX(3px);
  color: #CCFF00;
}

.locked-badge {
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: 16px;
  z-index: 1;
}
</style>
