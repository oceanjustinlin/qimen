<template>
  <div class="fortune-view">
    <header class="page-header">
      <div class="header-title">天机日运</div>
      <div class="header-actions">
        <OpenSourceLinks />
        <AccountMenu />
      </div>
    </header>

    <div class="page-wrap">
      <div class="container">
        <div v-if="showProfileSwitcher" class="glass-card profile-switch-card">
          <div class="profile-switcher" :class="{ open: isProfileMenuOpen }">
            <!-- 命主一栏：写明这份运势算的是哪个档案，点右侧切换 -->
            <button class="profile-switch-trigger" :aria-expanded="isProfileMenuOpen" @click="toggleProfileMenu">
              <span class="profile-switch-who">
                <small>命主</small>
                <span class="profile-switch-name">{{ activeProfileName }}</span>
                <span v-if="activeProfile" class="profile-switch-meta">{{ [profileMetaText(activeProfile), formatSolarDate(activeProfile.birth_date)].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="profile-switch-action">切换<span class="profile-switch-symbol" aria-hidden="true">⇄</span></span>
            </button>
            <div v-if="isProfileMenuOpen" class="profile-flyout">
              <button
                v-for="profile in baziProfiles"
                :key="profile.id"
                class="profile-flyout-item"
                :class="{ active: profile.id === selectedProfileId }"
                @click="selectProfile(profile.id)"
              >
                <span class="profile-item-main">{{ profile.name }}</span>
                <span class="profile-item-date">{{ formatSolarDate(profile.birth_date) }}</span>
                <span class="profile-item-meta">{{ profileMetaText(profile) }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="dimension-tabs glass-card">
          <button
            v-for="tab in tabs" :key="tab.value"
            :class="['tab-btn', { active: currentTab === tab.value }]"
            @click="currentTab = tab.value"
          >{{ tab.label }}</button>
        </div>

        <div v-if="currentTab === 'day'" class="tab-content">

          <div class="date-scroll-container day-scroll-container">
            <div
              v-for="day in availableDays" :key="day.fullDate"
              :class="['date-item', { active: selectedDate === day.fullDate }]"
              @click="selectDate(day.fullDate)"
            >
              <span class="day-of-week">{{ day.weekDay }}</span>
              <span class="date-num">{{ day.dateNum }}</span>
            </div>
          </div>

          <transition name="fade" mode="out-in">
            <div v-if="isLoading" class="glass-card loading-state">
              <div class="bagua-ring-wrap">
                <svg class="bagua-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="56" stroke="rgba(212,175,55,0.15)" stroke-width="1" fill="none"/>
                  <circle cx="60" cy="60" r="36" stroke="rgba(212,175,55,0.35)" stroke-width="1.5" fill="none" stroke-dasharray="8 6"/>
                </svg>
              </div>
              <div class="loader-text-block">天机推演中...</div>
            </div>

            <div v-else-if="fortuneData" class="fortune-display">

              <!-- ═══ 1. Score Dashboard ═══ -->
              <div class="glass-card score-dashboard">
                <div class="score-main">
                  <div class="score-ring" :style="scoreRingStyle">
                    <div class="score-inner">
                      <span class="score-value">{{ fortuneData.day_score || 0 }}</span>
                      <span class="score-unit">分</span>
                    </div>
                  </div>
                  <div class="score-side">
                    <div class="score-ganzhi">{{ fortuneGanzhiText }}</div>
                    <template v-if="!hasInterpretationContent && isInterpretationLoading">
                      <div class="daily-score-skeleton" aria-live="polite">
                        <div class="skeleton-line skeleton-highlight"></div>
                        <div class="skeleton-line skeleton-highlight short"></div>
                      </div>
                    </template>
                    <p v-else :class="['score-insight', { muted: isInterpretationLoading && !hasInterpretationContent }]">
                      {{ hasInterpretationContent ? (fortuneData.day_insight || '平稳度日，顺势而为') : interpretationPlaceholder }}
                    </p>
                    <div v-if="fortuneData.day_warning" class="warning-tag inline-warning">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{{ fortuneData.day_warning }}</div>
                    <div v-else-if="interpretationError" class="hint-text error inline-hint">{{ interpretationError }}</div>
                  </div>
                </div>
              </div>

              <div v-if="isGuest" class="glass-card guest-score-note">
                访客模式仅展示今日日运得分。登录后可查看完整断语、开运指南与多日趋势。
              </div>

              <template v-if="!isGuest">
              <!-- ═══ 2. Four Fortune Grid ═══ -->
              <div class="fortune-grid">
                <div v-for="item in fortuneGridItems" :key="item.key" class="fortune-grid-card">
                  <div class="grid-card-header">
                    <span class="grid-card-icon" v-html="item.icon"></span>
                    <span class="grid-card-label">{{ item.label }}</span>
                  </div>
                  <template v-if="!hasInterpretationContent && isInterpretationLoading">
                    <div class="daily-grid-skeleton">
                      <div class="skeleton-line skeleton-highlight"></div>
                      <div class="skeleton-line skeleton-highlight short"></div>
                    </div>
                  </template>
                  <p v-else :class="['grid-card-text', { muted: !hasInterpretationContent }]">
                    {{ hasInterpretationContent ? (fortuneData[item.key] || '暂无') : '生成中...' }}
                  </p>
                </div>
              </div>

              <!-- ═══ 3. Guide + Timeline ═══ -->
              <div class="glass-card info-card">
                <h3 class="card-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg> 行事指南</h3>
                <template v-if="!hasInterpretationContent && isInterpretationLoading">
                  <div class="daily-info-skeleton">
                    <div class="daily-guide-skeleton-row">
                      <div class="daily-guide-skeleton-label skeleton-pill"></div>
                      <div class="daily-guide-skeleton-content">
                        <div class="skeleton-line skeleton-highlight"></div>
                        <div class="skeleton-line skeleton-highlight short"></div>
                      </div>
                    </div>
                    <div class="daily-guide-skeleton-row mt-2">
                      <div class="daily-guide-skeleton-label skeleton-pill"></div>
                      <div class="daily-guide-skeleton-content">
                        <div class="skeleton-line skeleton-highlight"></div>
                        <div class="skeleton-line skeleton-highlight short"></div>
                      </div>
                    </div>
                    <hr class="guide-divider" />
                    <div class="timeline-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="vertical-align:-1px;margin-right:4px"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> 今日吉时</div>
                    <div class="daily-timeline-skeleton">
                      <div class="daily-timeline-skeleton-item">
                        <div class="timeline-dot"></div>
                        <div class="daily-timeline-skeleton-copy">
                          <div class="skeleton-line skeleton-highlight short"></div>
                          <div class="skeleton-line skeleton-highlight"></div>
                        </div>
                      </div>
                      <div class="daily-timeline-skeleton-item">
                        <div class="timeline-dot"></div>
                        <div class="daily-timeline-skeleton-copy">
                          <div class="skeleton-line skeleton-highlight short"></div>
                          <div class="skeleton-line skeleton-highlight"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="guide-row">
                    <span class="guide-label good">宜</span>
                    <span :class="['guide-content', { muted: !hasInterpretationContent }]">
                      {{ hasInterpretationContent ? formatGuide(fortuneData.day_guide, '宜') : '断语生成中...' }}
                    </span>
                  </div>
                  <div class="guide-row mt-2">
                    <span class="guide-label bad">忌</span>
                    <span :class="['guide-content', { muted: !hasInterpretationContent }]">
                      {{ hasInterpretationContent ? formatGuide(fortuneData.day_guide, '忌') : '稍后呈现' }}
                    </span>
                  </div>

                  <hr class="guide-divider" />
                  <div class="timeline-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="vertical-align:-1px;margin-right:4px"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> 今日吉时</div>
                  <div class="timeline" v-if="luckyHours.length">
                    <div v-for="(h, i) in luckyHours" :key="i" class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div class="timeline-hour">{{ h.hour }}</div>
                      <div class="timeline-tip">{{ h.tip }}</div>
                    </div>
                  </div>
                  <div v-else class="timeline-tip" style="padding-left:4px;">吉时信息生成中...</div>
                </template>
              </div>

              <!-- ═══ 4. Lucky Grid ═══ -->
              <div class="glass-card info-card">
                <h3 class="card-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6M12 3a7 7 0 0 1 7 7c0 2.5-1.3 4.6-3 6a2 2 0 0 0-1 1.7V19H9v-1.3A2 2 0 0 0 8 16c-1.7-1.4-3-3.5-3-6a7 7 0 0 1 7-7Z"/></svg> 开运密码</h3>
                <template v-if="!hasInterpretationContent && isInterpretationLoading">
                  <div class="lucky-grid daily-lucky-skeleton">
                    <div v-for="cell in 4" :key="cell" class="lucky-cell">
                      <div class="skeleton-line skeleton-highlight short"></div>
                      <div class="skeleton-line skeleton-highlight"></div>
                    </div>
                  </div>
                </template>
                <div v-else class="lucky-grid">
                  <div class="lucky-cell">
                    <span class="lucky-cell-label">幸运数字</span>
                    <span class="lucky-cell-value">{{ luckyNumberText }}</span>
                  </div>
                  <div class="lucky-cell">
                    <span class="lucky-cell-label">五行喜用</span>
                    <span class="lucky-cell-value">{{ fortuneData.lucky_element || '-' }}</span>
                  </div>
                  <div class="lucky-cell">
                    <span class="lucky-cell-label">幸运色彩</span>
                    <div :class="['color-display', { muted: !hasInterpretationContent }]">
                      <span class="color-dot" :style="{ backgroundColor: fortuneData.lucky_color_hex || '#CCC' }"></span>
                      {{ hasInterpretationContent ? (fortuneData.lucky_color || '-') : '生成中' }}
                    </div>
                  </div>
                  <div class="lucky-cell">
                    <span class="lucky-cell-label">贵人方位</span>
                    <span class="lucky-cell-value">{{ luckyDirectionShort }}</span>
                  </div>
                </div>
              </div>

              <!-- ═══ 5. Resolve Tip ═══ -->
              <div v-if="hasInterpretationContent && fortuneData.resolve_tip" class="glass-card resolve-card">
                <div class="resolve-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="resolve-icon"><path d="M12 22V12M12 12C12 8 15 4 20 3c0 5-2 9-8 9ZM12 12C12 7 9 3 4 2c0 6 3 9 8 10Z"/></svg> 旺运秘诀</div>
                <p class="resolve-text">{{ fortuneData.resolve_tip }}</p>
              </div>

              <!-- ═══ 6. Hook Teaser ═══ -->
              <div v-if="hasInterpretationContent && fortuneData.hook_teaser" class="glass-card hook-card">
                <div class="hook-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="hook-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 明日预告</div>
                <p class="hook-text">{{ fortuneData.hook_teaser }}</p>
              </div>
              </template>

            </div>
          </transition>
        </div>

        <div v-else-if="currentTab === 'week'" class="tab-content">
          <div ref="weekScrollerRef" class="date-scroll-container week-scroll-container">
            <div
              v-for="weekItem in availableWeeks"
              :key="weekItem.startDate"
              :class="['date-item', 'week-item', { active: selectedWeekStart === weekItem.startDate }]"
              :title="weekItem.rangeText"
              @click="selectWeek(weekItem.startDate)"
            >
              <span v-if="weekItem.subLabel" class="day-of-week">{{ weekItem.subLabel }}</span>
              <span class="date-num week-range-num">{{ weekItem.displayText }}</span>
            </div>
          </div>

          <transition name="fade" mode="out-in">
            <div v-if="isWeekLoading" class="glass-card loading-state">
              <div class="bagua-ring-wrap">
                <svg class="bagua-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="56" stroke="rgba(212,175,55,0.15)" stroke-width="1" fill="none"/>
                  <circle cx="60" cy="60" r="36" stroke="rgba(212,175,55,0.35)" stroke-width="1.5" fill="none" stroke-dasharray="8 6"/>
                </svg>
              </div>
              <div class="loader-text-block">周运推演中...</div>
            </div>

            <div v-else-if="weeklyData" class="fortune-display weekly-display">
              <div class="glass-card score-dashboard weekly-score-dashboard">
                <div class="score-main">
                  <div class="score-ring" :style="weeklyScoreRingStyle">
                    <div class="score-inner">
                      <span class="score-value">{{ weeklyData.weekly_score || 0 }}</span>
                      <span class="score-unit">分</span>
                    </div>
                  </div>
                  <div class="score-side">
                    <div class="weekly-title-row">
                      <div class="score-ganzhi">{{ weeklyData.weekly_tag || '本周运势' }}</div>
                      <span v-if="weeklyData.metrics?.has_jieqi" class="weekly-chip">节气转折</span>
                    </div>
                    <p class="score-insight">{{ weeklySummaryText }}</p>
                    <div class="weekly-metric-strip">
                      <span>{{ weeklyData.metrics?.score_level || '-' }}</span>
                      <span>{{ weeklyData.metrics?.volatility_type || '-' }}</span>
                      <span>{{ weeklyDominantText }}</span>
                    </div>
                    <div v-if="weeklyData.metrics?.has_sanxing" class="warning-tag inline-warning">三刑引动</div>
                    <div v-else-if="weeklyData.metrics?.has_kongwang" class="warning-tag inline-warning">空亡虚耗</div>
                  </div>
                </div>
              </div>

              <div class="glass-card monthly-chart-card weekly-chart-card">
                <div class="module-title-bar">
                  <h3 class="card-title compact-title"><span>✦</span> 七日走势</h3>
                  <span class="weekly-range-text">{{ weeklyRangeText }}</span>
                </div>
                <svg class="monthly-chart weekly-chart" viewBox="0 0 320 140" role="img" aria-label="本周每日分数变化曲线">
                  <line x1="12" y1="24" x2="308" y2="24" class="monthly-chart-grid" />
                  <line x1="12" y1="70" x2="308" y2="70" class="monthly-chart-grid" />
                  <line x1="12" y1="116" x2="308" y2="116" class="monthly-chart-grid" />
                  <line
                    v-if="weeklyChartAvgLineY"
                    x1="12"
                    :y1="weeklyChartAvgLineY"
                    x2="308"
                    :y2="weeklyChartAvgLineY"
                    class="monthly-chart-average"
                  />
                  <polyline
                    v-if="weeklyChartPolyline"
                    :points="weeklyChartPolyline"
                    class="monthly-chart-line"
                  />
                  <circle
                    v-for="point in weeklyChartPoints"
                    :key="point.date"
                    :cx="point.x"
                    :cy="point.y"
                    r="3.5"
                    :class="['monthly-chart-dot', point.kind]"
                  />
                </svg>
                <div class="weekly-day-row">
                  <div
                    v-for="point in weeklyChartPoints"
                    :key="`${point.date}-label`"
                    :class="['weekly-day-cell', point.kind]"
                  >
                    <span>{{ formatWeekday(point.date) }}</span>
                    <strong>{{ point.score }}</strong>
                  </div>
                </div>
              </div>

              <div class="fortune-grid weekly-forecast-grid">
                <div class="fortune-grid-card">
                  <div class="grid-card-header">
                    <span class="grid-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></span>
                    <span class="grid-card-label">事业运</span>
                  </div>
                  <p class="grid-card-text">{{ weeklyData.event_forecast?.career || '暂无' }}</p>
                </div>
                <div class="fortune-grid-card">
                  <div class="grid-card-header">
                    <span class="grid-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5A2.5 2.5 0 0 1 12 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 0 0 5c1.38 0 2.5-1.12 2.5-2.5"/></svg></span>
                    <span class="grid-card-label">财富运</span>
                  </div>
                  <p class="grid-card-text">{{ weeklyData.event_forecast?.wealth || '暂无' }}</p>
                </div>
                <div class="fortune-grid-card weekly-forecast-wide">
                  <div class="grid-card-header">
                    <span class="grid-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-9-6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z"/></svg></span>
                    <span class="grid-card-label">关系运</span>
                  </div>
                  <p class="grid-card-text">{{ weeklyData.event_forecast?.relationship || '暂无' }}</p>
                </div>
              </div>

              <div class="glass-card info-card weekly-key-card">
                <div class="module-title-bar">
                  <h3 class="card-title compact-title"><span>✦</span> 关键节点</h3>
                </div>
                <div class="weekly-key-grid">
                  <div class="weekly-key-item best">
                    <span class="weekly-key-label">顺势日</span>
                    <strong>{{ formatMonthDay(weeklyData.key_dates?.best_day?.date) }}</strong>
                    <span>{{ weeklyData.key_dates?.best_day?.score || '-' }}分 · {{ weeklyData.key_dates?.best_day?.dominant_shishen || '-' }}</span>
                  </div>
                  <div class="weekly-key-item worst">
                    <span class="weekly-key-label">谨慎日</span>
                    <strong>{{ formatMonthDay(weeklyData.key_dates?.worst_day?.date) }}</strong>
                    <span>{{ weeklyData.key_dates?.worst_day?.score || '-' }}分 · {{ formatTriggers(weeklyData.key_dates?.worst_day?.triggers) }}</span>
                  </div>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">净值主导</span>
                  <span class="monthly-detail-value">{{ weeklyDominantText }} · 喜用 {{ weeklyData.dominant_energy?.fav_weighted_score || 0 }} / 忌仇 {{ weeklyData.dominant_energy?.unfav_weighted_score || 0 }}</span>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">波动极差</span>
                  <span class="monthly-detail-value">{{ weeklyData.metrics?.extreme_diff ?? '-' }}分{{ weeklyData.metrics?.has_trough ? ' · 已触发连续低谷' : ' · 无连续低谷' }}</span>
                </div>
              </div>
            </div>

            <div v-else class="glass-card placeholder-content">
              <div class="placeholder-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12m5-9.83V6.17a2 2 0 0 1-.59 1.41L12 12M7 22v-4.17a2 2 0 0 1 .59-1.41L12 12M7 2.17V6.17a2 2 0 0 0 .59 1.41L12 12"/></svg></div>
              <p>{{ weekError || '周运数据暂未生成' }}</p>
            </div>
          </transition>
        </div>

        <div v-else-if="currentTab === 'month'" class="tab-content">
          <div ref="monthScrollerRef" class="date-scroll-container month-scroll-container">
            <div
              v-for="monthItem in availableMonths"
              :key="monthItem.key"
              :class="['date-item', 'month-item', { active: selectedMonthKey === monthItem.key }]"
              :title="monthItem.rangeText || monthItem.label"
              @click="selectMonth(monthItem.key)"
            >
              <span class="day-of-week">{{ monthItem.label }}</span>
              <span class="date-num">{{ monthItem.monthText }}</span>
            </div>
          </div>

          <transition name="fade" mode="out-in">
            <div v-if="isMonthLoading" class="glass-card loading-state">
              <div class="bagua-ring-wrap">
                <svg class="bagua-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="56" stroke="rgba(212,175,55,0.15)" stroke-width="1" fill="none"/>
                  <circle cx="60" cy="60" r="36" stroke="rgba(212,175,55,0.35)" stroke-width="1.5" fill="none" stroke-dasharray="8 6"/>
                </svg>
              </div>
              <div class="loader-text-block">流月推演中...</div>
            </div>

            <div v-else-if="visibleMonthlyData" class="fortune-display">
              <div class="glass-card score-dashboard">
                <div class="score-main">
                  <div class="score-ring" :style="monthlyScoreRingStyle">
                    <div class="score-inner">
                      <span class="score-value">{{ visibleMonthlyData.monthly_score || 0 }}</span>
                      <span class="score-unit">分</span>
                    </div>
                  </div>
                  <div class="score-side">
                    <div class="monthly-score-title-row">
                      <div class="score-ganzhi">{{ monthlyGanzhiText }}</div>
                      <button
                        v-if="monthlyScoreHitLayers.length"
                        type="button"
                        class="monthly-score-hit-trigger"
                        @click="showMonthlyScoreHitsGuide = true"
                        aria-label="查看月运评分架构"
                      >
                        i
                      </button>
                    </div>
                    <p class="score-insight">{{ monthlyScoreSummary }}</p>
                    <div v-if="visibleMonthlyData.is_kongwang" class="warning-tag inline-warning">空亡封顶</div>
                    <div v-else-if="visibleMonthlyData.has_sanxing" class="warning-tag inline-warning">三刑触发</div>
                  </div>
                </div>
              </div>

              <div class="glass-card monthly-chart-card">
                <div class="module-title-bar">
                  <h3 class="card-title compact-title"><span>✦</span> 月度曲线</h3>
                </div>
                <svg class="monthly-chart" viewBox="0 0 320 140" role="img" aria-label="月度每日分数变化曲线">
                  <line x1="12" y1="24" x2="308" y2="24" class="monthly-chart-grid" />
                  <line x1="12" y1="70" x2="308" y2="70" class="monthly-chart-grid" />
                  <line x1="12" y1="116" x2="308" y2="116" class="monthly-chart-grid" />
                  <line
                    v-if="monthlyChartAvgLineY"
                    x1="12"
                    :y1="monthlyChartAvgLineY"
                    x2="308"
                    :y2="monthlyChartAvgLineY"
                    class="monthly-chart-average"
                  />
                  <polyline
                    v-if="monthlyChartPolyline"
                    :points="monthlyChartPolyline"
                    class="monthly-chart-line"
                  />
                  <circle
                    v-for="point in monthlyChartMarkers"
                    :key="point.date"
                    :cx="point.x"
                    :cy="point.y"
                    r="3"
                    :class="['monthly-chart-dot', point.kind]"
                  />
                </svg>
                <div class="monthly-chart-meta">
                  <span>高分日 {{ visibleMonthlyData.high_score_days }}</span>
                  <span>低分日 {{ visibleMonthlyData.low_score_days }}</span>
                  <span>最佳 {{ formatMonthDay(visibleMonthlyData.best_date) }}</span>
                </div>
              </div>

              <div class="glass-card info-card">
                <div class="module-title-bar">
                  <h3 class="card-title compact-title"><span>✦</span> 流月节律</h3>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">月令五行</span>
                  <span class="monthly-detail-value">{{ visibleMonthlyData.month_wuxing || '-' }} · {{ visibleMonthlyData.month_wuxing_relation || '闲' }}</span>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">节气</span>
                  <span class="monthly-detail-value">{{ formatList(visibleMonthlyData.jieqi_list) }}</span>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">低谷期</span>
                  <span class="monthly-detail-value">{{ visibleMonthlyData.has_trough ? visibleMonthlyData.trough_period : '无连续低谷' }}</span>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">最高/最低</span>
                  <span class="monthly-detail-value">
                    {{ formatMonthDay(visibleMonthlyData.best_date) }} {{ visibleMonthlyData.best_score }}分 /
                    {{ formatMonthDay(visibleMonthlyData.worst_date) }} {{ visibleMonthlyData.worst_score }}分
                  </span>
                </div>
              </div>

              <div class="glass-card monthly-interpretation-card">
                <div class="module-title-bar monthly-interpretation-head">
                  <h3 class="card-title compact-title">
                    <span>✦</span>
                    月度详批
                    <button type="button" class="monthly-info-btn" @click="showMonthlyFactorsGuide = true">?</button>
                  </h3>
                  <div class="monthly-head-side">
                    <span v-if="monthlyRefreshMessage" class="monthly-refresh-chip">{{ monthlyRefreshMessage }}</span>
                    <span v-if="activeMonthlyInterpretation?.interpretation_status === 'ready'" class="interpretation-ready">已生成</span>
                  </div>
                </div>
                <div class="monthly-dimension-tabs" role="tablist" aria-label="月运解读维度">
                  <button
                    v-for="item in monthlyInterpretationTabs"
                    :key="item.value"
                    type="button"
                    :class="['monthly-dimension-btn', { active: selectedMonthlyDimension === item.value }]"
                    @click="selectMonthlyDimension(item.value)"
                  >
                    {{ item.label }}
                  </button>
                </div>

                <div v-if="isMonthlyInterpretationLoading && !activeMonthlyInterpretation" class="monthly-skeleton" aria-live="polite">
                  <div class="skeleton-line skeleton-title"></div>
                  <div class="skeleton-line skeleton-highlight"></div>
                  <div class="skeleton-line skeleton-highlight short"></div>
                  <div class="skeleton-block"></div>
                  <div class="skeleton-advice">
                    <div class="skeleton-pill"></div>
                    <div class="skeleton-pill wide"></div>
                  </div>
                  <div class="skeleton-advice">
                    <div class="skeleton-pill"></div>
                    <div class="skeleton-pill wide"></div>
                  </div>
                </div>

                <div v-else-if="activeMonthlyInterpretation" class="monthly-interpretation-body">
                  <div class="monthly-interpretation-title">{{ activeMonthlyInterpretation.title }}</div>
                  <p class="monthly-interpretation-highlight">{{ activeMonthlyInterpretation.highlight }}</p>
                  <div class="monthly-interpretation-details">
                    <p v-for="(paragraph, index) in activeMonthlyDetailsParagraphs" :key="index">{{ paragraph }}</p>
                  </div>
                  <div v-if="activeMonthlyTags.length" class="monthly-tags">
                    <span v-for="tag in activeMonthlyTags" :key="tag">{{ tag }}</span>
                  </div>
                  <div v-if="activeMonthlyAdvice.length" class="monthly-advice-list">
                    <div v-for="item in activeMonthlyAdvice" :key="`${item.action}-${item.description}`" class="monthly-advice-item">
                      <span class="monthly-advice-action">{{ item.action }}</span>
                      <span class="monthly-advice-desc">{{ item.description }}</span>
                    </div>
                  </div>
                </div>

                <div v-else class="monthly-interpretation-empty">
                  {{ monthlyInterpretationError || '选择一个维度，生成本月白话断语' }}
                </div>
              </div>
            </div>

            <div v-else class="glass-card placeholder-content">
              <div class="placeholder-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12m5-9.83V6.17a2 2 0 0 1-.59 1.41L12 12M7 22v-4.17a2 2 0 0 1 .59-1.41L12 12M7 2.17V6.17a2 2 0 0 0 .59 1.41L12 12"/></svg></div>
              <p>{{ monthError || '流月数据暂未生成' }}</p>
            </div>
          </transition>
        </div>

        <div v-else-if="currentTab === 'year'" class="tab-content">
          <div ref="yearScrollerRef" class="date-scroll-container month-scroll-container">
            <div
              v-for="yearItem in availableYears"
              :key="yearItem.key"
              :class="['date-item', 'month-item', { active: selectedYear === yearItem.key }]"
              @click="selectYear(yearItem.key)"
            >
              <span class="day-of-week">{{ yearItem.label }}年</span>
              <span class="date-num">{{ getAnnualGanZhi(yearItem.yearValue) }}</span>
            </div>
          </div>

          <transition name="fade" mode="out-in">
            <div v-if="isAnnualLoading" class="glass-card loading-state">
              <div class="bagua-ring-wrap">
                <svg class="bagua-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="56" stroke="rgba(212,175,55,0.15)" stroke-width="1" fill="none"/>
                  <circle cx="60" cy="60" r="36" stroke="rgba(212,175,55,0.35)" stroke-width="1.5" fill="none" stroke-dasharray="8 6"/>
                </svg>
              </div>
              <div class="loader-text-block">流年推演中...</div>
            </div>

            <div v-else-if="visibleAnnualData" class="fortune-display">
              <div class="glass-card score-dashboard">
                <div class="score-main">
                  <div class="score-ring" :style="{ background: `conic-gradient(var(--gold) ${Math.min(100, Math.max(0, visibleAnnualData.annual_score || 0))}%, rgba(255,255,255,0.05) 0deg)` }">
                    <div class="score-inner">
                      <span class="score-value">{{ visibleAnnualData.annual_score || 0 }}</span>
                      <span class="score-unit">分</span>
                    </div>
                  </div>
                  <div class="score-side">
                    <div class="monthly-score-title-row">
                      <div class="score-ganzhi">{{ visibleAnnualData.liunian_gz }}年</div>
                      <button
                        v-if="annualScoreHitLayers.length"
                        type="button"
                        class="monthly-score-hit-trigger"
                        @click="showAnnualScoreHitsGuide = true"
                        aria-label="查看年运三层命中"
                      >
                        i
                      </button>
                    </div>
                    <p class="score-insight">{{ annualScoreSummary }}</p>
                    <div v-if="visibleAnnualData.is_kongwang" class="warning-tag inline-warning">空亡封顶</div>
                    <div v-else-if="visibleAnnualData.is_benmingnian" class="warning-tag inline-warning">本命年</div>
                    <div v-else-if="visibleAnnualData.is_zixing" class="warning-tag inline-warning">自刑</div>
                    <div v-else-if="visibleAnnualData.liunian_sanxing" class="warning-tag inline-warning">流年三刑</div>
                  </div>
                </div>
              </div>
              
              <div class="glass-card info-card">
                <div class="module-title-bar">
                  <h3 class="card-title compact-title"><span>✦</span> 岁运简批</h3>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">流年十神</span>
                  <span class="monthly-detail-value">{{ visibleAnnualData.liunian_gan_shishen }}</span>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">大运背景</span>
                  <span class="monthly-detail-value">{{ annualDayunBackgroundText }}</span>
                </div>
                <div class="monthly-detail-row">
                  <span class="monthly-detail-label">流年与原局</span>
                  <span class="monthly-detail-value">{{ visibleAnnualData.year_relations || '无特殊互动' }}</span>
                </div>
              </div>
              
            </div>

            <div v-else class="glass-card placeholder-content">
              <div class="placeholder-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12m5-9.83V6.17a2 2 0 0 1-.59 1.41L12 12M7 22v-4.17a2 2 0 0 1 .59-1.41L12 12M7 2.17V6.17a2 2 0 0 0 .59 1.41L12 12"/></svg></div>
              <p>{{ annualError || '流年数据暂未生成' }}</p>
            </div>
          </transition>
        </div>

        <div v-else class="glass-card placeholder-content">
          <div class="placeholder-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12m5-9.83V6.17a2 2 0 0 1-.59 1.41L12 12M7 22v-4.17a2 2 0 0 1 .59-1.41L12 12M7 2.17V6.17a2 2 0 0 0 .59 1.41L12 12"/></svg></div>
          <p>【{{ getTabLabel(currentTab) }}运】推演引擎升级中<br>敬请期待</p>
        </div>

        <Teleport to="body">
          <div v-if="showMonthlyScoreHitsGuide" class="fortune-modal-overlay" @click="showMonthlyScoreHitsGuide = false">
            <div class="fortune-guide-modal monthly-hit-modal" @click.stop>
              <div class="fortune-guide-head">
                <span>月运评分架构</span>
                <button type="button" class="fortune-guide-close" @click="showMonthlyScoreHitsGuide = false">×</button>
              </div>
              <div class="fortune-guide-body monthly-hit-layers">
                <section v-for="layer in monthlyScoreHitLayers" :key="layer.layer" class="monthly-hit-layer">
                  <div class="monthly-hit-layer-head">
                    <span class="monthly-hit-layer-title">{{ layer.title }}</span>
                    <span class="monthly-hit-layer-score">{{ formatSignedScore(layer.score) }}</span>
                  </div>
                  <ul class="monthly-hit-list">
                    <li v-for="hit in layer.hits" :key="`${layer.layer}-${hit.code}-${hit.display}`" :class="['monthly-hit-item', hit.type]">
                      <span class="monthly-hit-dot"></span>
                      <span class="monthly-hit-copy">{{ hit.display }}</span>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>

          <div v-if="showAnnualScoreHitsGuide" class="fortune-modal-overlay" @click="showAnnualScoreHitsGuide = false">
            <div class="fortune-guide-modal monthly-hit-modal" @click.stop>
              <div class="fortune-guide-head">
                <span>年运三层命中</span>
                <button type="button" class="fortune-guide-close" @click="showAnnualScoreHitsGuide = false">×</button>
              </div>
              <div class="fortune-guide-body monthly-hit-layers">
                <section v-for="layer in annualScoreHitLayers" :key="layer.layer" class="monthly-hit-layer">
                  <div class="monthly-hit-layer-head">
                    <span class="monthly-hit-layer-title">{{ layer.title }}</span>
                    <span class="monthly-hit-layer-score">{{ formatSignedScore(layer.score) }}</span>
                  </div>
                  <ul class="monthly-hit-list">
                    <li v-for="hit in layer.hits" :key="`${layer.layer}-${hit.code}-${hit.display}`" :class="['monthly-hit-item', hit.type]">
                      <span class="monthly-hit-dot"></span>
                      <span class="monthly-hit-copy">{{ hit.display }}</span>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>

          <div v-if="showMonthlyFactorsGuide" class="fortune-modal-overlay" @click="showMonthlyFactorsGuide = false">
            <div class="fortune-guide-modal" @click.stop>
              <div class="fortune-guide-head">
                <span>这段月运文案怎么看出来的？</span>
                <button type="button" class="fortune-guide-close" @click="showMonthlyFactorsGuide = false">×</button>
              </div>
              <div class="fortune-guide-body">
                <div v-for="item in monthlyInterpretationFactors" :key="item.title" class="fortune-guide-item">
                  <div class="fortune-guide-item-title">{{ item.title }}</div>
                  <div class="fortune-guide-item-copy">
                    {{ item.copy }}
                    <button
                      v-if="item.title === '你的现实背景'"
                      type="button"
                      class="fortune-guide-link"
                      @click="openMonthlyContextNotes"
                    >
                      去填写基调
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Teleport>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.mjs'
import { globalState, resolveSelectedBaziProfileId, setSelectedBaziProfileId } from '../store.js'
import { getGuestState, recordGuestFortuneViewed, trackGuestEvent } from '../guestMode.mjs'
import {
  clearMonthlyInterpretationRefresh,
  clearPendingInterpretation,
  getPendingInterpretation,
  loadCachedFortune as loadSharedCachedFortune,
  peekMonthlyInterpretationRefresh,
  rememberFortuneCache as rememberSharedFortuneCache,
  rememberPendingInterpretation
} from '../fortuneCache.mjs'
import { getFlowMonthInfo as getClientFlowMonthInfo, listFlowMonths as listClientFlowMonths } from '../utils/flowMonth.js'
import {
  listFortuneWeeks,
  normalizeDateString,
  toDateKey
} from '../utils/fortuneWeeks.mjs'
import {
  getAnnualScoreSummary,
  getMonthlyScoreSummary,
  normalizeAnnualScoreLayers,
  normalizeMonthlyScoreLayers
} from '../utils/monthlyScoreHits.mjs'
import guestFortuneData from '../../mock/fortune-daily.json'
import OpenSourceLinks from '../components/OpenSourceLinks.vue'
import AccountMenu from '../components/AccountMenu.vue'
import { BAZI_PROFILE_LIST_SELECT } from '../baziProfileFields.mjs'

const route = useRoute()
const router = useRouter()

const tabs = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' }
]
const currentTab = ref('day')
const availableDays = ref([])
const availableWeeks = ref([])
const availableMonths = ref([])
const availableYears = ref([])
const selectedDate = ref('')
const selectedWeekStart = ref('')
const selectedMonth = ref('')
const selectedYear = ref('')
const fortuneData = ref(null)
const weeklyData = ref(null)
const monthlyData = ref(null)
const annualDataList = ref([])
const monthlyDataKey = ref('')
const isLoading = ref(false)
const isWeekLoading = ref(false)
const isMonthLoading = ref(false)
const isAnnualLoading = ref(false)
const isInterpretationLoading = ref(false)
const interpretationError = ref('')
const weekError = ref('')
const monthError = ref('')
const annualError = ref('')
const requestSerial = ref(0)
const weekRequestSerial = ref(0)
const monthRequestSerial = ref(0)
const annualRequestSerial = ref(0)
const baziProfiles = ref([])
const selectedProfileId = ref('')
const isProfileMenuOpen = ref(false)
const weekScrollerRef = ref(null)
const monthScrollerRef = ref(null)
const yearScrollerRef = ref(null)
const isGuest = computed(() => globalState.isGuest)

const fortuneGridItems = [
  { key: 'career_insight', label: '事业运', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>' },
  { key: 'wealth_insight', label: '财富运', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5A2.5 2.5 0 0 1 12 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 0 0 5c1.38 0 2.5-1.12 2.5-2.5"/></svg>' },
  { key: 'love_insight',   label: '感情运', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-9-6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z"/></svg>' },
  { key: 'health_insight', label: '健康运', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
]

const monthlyInterpretationTabs = [
  { label: '综合', value: 'overall' },
  { label: '事业', value: 'career' },
  { label: '财运', value: 'wealth' },
  { label: '感情', value: 'love' },
]

const monthlyInterpretationFactors = [
  {
    title: '流月本身',
    copy: '看这个月的干支五行，对你是助力还是压力。',
  },
  {
    title: '和原局、岁运的关系',
    copy: '看它和你的原局、大运、流年之间，是顺势承接，还是有冲撞波动。',
  },
  {
    title: '月内节奏',
    copy: '看这个月高分日、低谷期、节气前后，哪些时间更适合推进，哪些时间更适合放缓。',
  },
  {
    title: '神煞与结构信号',
    copy: '会参考贵人、文昌、驿马、月德等辅助信号，但不会只靠单一神煞下结论。',
  },
  {
    title: '你的现实背景',
    copy: '如果你填写了长期基调和本月现状，系统会把命理信号落到更贴近你当下的处境里，比如工作、感情、财务或生活状态。',
  },
]
const monthlyRefreshMessage = computed(() => {
  if (monthlyRefreshState.value === 'refreshing') return '检测到基调有较大更新，正在刷新本月详批…'
  if (monthlyRefreshState.value === 'updated') return '本月详批已按最新基调刷新'
  if (monthlyRefreshState.value === 'pending') return '基调有明显更新，进入月运时会自动刷新详批'
  return ''
})

const selectedMonthlyDimension = ref('overall')
const monthlyInterpretations = ref({})
const isMonthlyInterpretationLoading = ref(false)
const monthlyInterpretationError = ref('')
const monthlyInterpretationSerial = ref(0)
const monthlyRefreshSignal = ref(null)
const monthlyRefreshState = ref('idle')
const showMonthlyFactorsGuide = ref(false)
const showMonthlyScoreHitsGuide = ref(false)
const showAnnualScoreHitsGuide = ref(false)

const hasInterpretationFields = (data) => {
  return Boolean(
    data?.day_insight && data?.career_insight && data?.wealth_insight
    && data?.love_insight && data?.health_insight && data?.hook_teaser
  )
}

const hasInterpretationContent = computed(() => hasInterpretationFields(fortuneData.value))
const showProfileSwitcher = computed(() => baziProfiles.value.length > 0)
const activeProfile = computed(() => baziProfiles.value.find(profile => profile.id === selectedProfileId.value) || null)
const activeProfileName = computed(() => activeProfile.value?.name || '命主未设')
const currentProfileCacheKey = computed(() => selectedProfileId.value || '')
const fortuneGanzhiText = computed(() => {
  if (!fortuneData.value) return '-'
  const month = fortuneData.value.month_gz ? `${fortuneData.value.month_gz}月` : ''
  const day = fortuneData.value.day_gz ? `${fortuneData.value.day_gz}日` : ''
  return `${month} ${day}`.trim() || '-'
})

const interpretationPlaceholder = computed(() => (
  isInterpretationLoading.value ? '断语生成中，分数已先行呈现' : '断语稍后呈现'
))

const scoreRingStyle = computed(() => {
  const score = fortuneData.value?.day_score || 0
  const pct = Math.min(100, Math.max(0, score))
  return { background: `conic-gradient(var(--gold) ${pct}%, rgba(255,255,255,0.05) 0deg)` }
})

const selectedMonthKey = computed(() => {
  if (selectedMonth.value) return selectedMonth.value
  return getClientFlowMonthInfo().key
})

const visibleMonthlyData = computed(() => (
  monthlyData.value && monthlyDataKey.value === selectedMonthKey.value ? monthlyData.value : null
))

const visibleAnnualData = computed(() => {
  if (!annualDataList.value || !annualDataList.value.length) return null
  return annualDataList.value.find(y => String(y.year) === selectedYear.value) || null
})

const annualDataByYear = computed(() => {
  const entries = Array.isArray(annualDataList.value) ? annualDataList.value : []
  return new Map(entries.map(item => [Number(item.year), item]))
})

const getAnnualGanZhi = (year) => annualDataByYear.value.get(Number(year))?.liunian_gz || ''

const annualDayunQiText = computed(() => {
  const status = visibleAnnualData.value?.dayun_qi_status
  if (status === 'same') return '干支同气'
  if (status === 'diff') return '干支异气'
  if (status === 'neutral') return '平稳'
  return ''
})

const annualDayunBackgroundText = computed(() => {
  const dayun = visibleAnnualData.value?.dayun_gz ? `${visibleAnnualData.value.dayun_gz}运` : '大运待确认'
  return [dayun, annualDayunQiText.value].filter(Boolean).join(' · ')
})

const activeMonthlyInterpretation = computed(() => (
  monthlyInterpretations.value[selectedMonthlyDimension.value] || null
))

const activeMonthlyDetailsParagraphs = computed(() => {
  const details = activeMonthlyInterpretation.value?.details || ''
  return details.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)
})

const activeMonthlyTags = computed(() => {
  const tags = activeMonthlyInterpretation.value?.tags
  return Array.isArray(tags) ? tags.slice(0, 3) : []
})

const activeMonthlyAdvice = computed(() => {
  const advice = activeMonthlyInterpretation.value?.advice
  return Array.isArray(advice) ? advice.slice(0, 3) : []
})

const monthlyScoreRingStyle = computed(() => {
  const score = visibleMonthlyData.value?.monthly_score || 0
  const pct = Math.min(100, Math.max(0, score))
  return { background: `conic-gradient(var(--gold) ${pct}%, rgba(255,255,255,0.05) 0deg)` }
})

const weeklyScoreRingStyle = computed(() => {
  const score = weeklyData.value?.weekly_score || 0
  const pct = Math.min(100, Math.max(0, score))
  return { background: `conic-gradient(var(--gold) ${pct}%, rgba(255,255,255,0.05) 0deg)` }
})

const weeklyRangeText = computed(() => {
  if (!weeklyData.value) return '-'
  return `${formatMonthDay(weeklyData.value.week_start)} - ${formatMonthDay(weeklyData.value.week_end)}`
})

const weeklyDominantText = computed(() => {
  const energy = weeklyData.value?.dominant_energy
  if (!energy) return '-'
  if (energy.alignment === '均衡') return '能量均衡'
  return `${energy.alignment}${energy.class || ''}`
})

const weeklySummaryText = computed(() => {
  if (!weeklyData.value) return ''
  const metrics = weeklyData.value.metrics || {}
  return `${weeklyRangeText.value} · ${metrics.score_level || '-'} · ${metrics.volatility_type || '-'}`
})

const monthlyGanzhiText = computed(() => {
  if (!visibleMonthlyData.value) return '-'
  const gz = visibleMonthlyData.value.flow_month_label || (visibleMonthlyData.value.month_gz ? `${visibleMonthlyData.value.month_gz}月` : '')
  const range = visibleMonthlyData.value.flow_month_range_label || ''
  return [gz, range].filter(Boolean).join(' · ') || '-'
})

const monthlyScoreSummary = computed(() => getMonthlyScoreSummary(visibleMonthlyData.value || {}))

const monthlyScoreHitLayers = computed(() => normalizeMonthlyScoreLayers(visibleMonthlyData.value || {}))

const annualScoreSummary = computed(() => getAnnualScoreSummary(visibleAnnualData.value || {}))

const annualScoreHitLayers = computed(() => normalizeAnnualScoreLayers(visibleAnnualData.value || {}))

const formatSignedScore = (score) => {
  const value = Number(score || 0)
  if (value > 0) return `+${value}`
  return String(value)
}

const mapMonthlyChartPoint = (item, index, total) => {
  const x = total <= 1 ? 160 : 12 + (index / (total - 1)) * 296
  const score = Math.min(98, Math.max(45, Number(item.score) || 45))
  const y = 116 - ((score - 45) / 53) * 92
  return {
    date: item.date,
    score,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  }
}

const monthlyChartPoints = computed(() => {
  const points = visibleMonthlyData.value?.daily_score_points
  if (!Array.isArray(points) || points.length === 0) return []
  return points.map((item, index) => mapMonthlyChartPoint(item, index, points.length))
})

const monthlyChartPolyline = computed(() => monthlyChartPoints.value.map(point => `${point.x},${point.y}`).join(' '))

const monthlyChartAvgLineY = computed(() => {
  const avg = visibleMonthlyData.value?.avg_daily_score
  if (!Number.isFinite(avg)) return 0
  return Math.round((116 - ((Math.min(98, Math.max(45, avg)) - 45) / 53) * 92) * 10) / 10
})

const monthlyChartMarkers = computed(() => {
  const points = monthlyChartPoints.value
  if (points.length === 0) return []
  const bestDate = visibleMonthlyData.value?.best_date
  const worstDate = visibleMonthlyData.value?.worst_date
  const stride = Math.max(1, Math.ceil(points.length / 8))
  return points
    .filter((point, index) => index % stride === 0 || point.date === bestDate || point.date === worstDate || index === points.length - 1)
    .map(point => ({
      ...point,
      kind: point.date === bestDate ? 'best' : point.date === worstDate ? 'worst' : 'normal',
    }))
})

const weeklyChartPoints = computed(() => {
  const points = weeklyData.value?.daily_score_points
  if (!Array.isArray(points) || points.length === 0) return []
  const bestDate = weeklyData.value?.key_dates?.best_day?.date
  const worstDate = weeklyData.value?.key_dates?.worst_day?.date
  return points.map((item, index) => {
    const point = mapMonthlyChartPoint(item, index, points.length)
    return {
      ...point,
      kind: point.date === bestDate ? 'best' : point.date === worstDate ? 'worst' : 'normal',
    }
  })
})

const weeklyChartPolyline = computed(() => weeklyChartPoints.value.map(point => `${point.x},${point.y}`).join(' '))

const weeklyChartAvgLineY = computed(() => {
  const points = weeklyData.value?.daily_score_points
  if (!Array.isArray(points) || !points.length) return 0
  const avg = points.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / points.length
  return Math.round((116 - ((Math.min(98, Math.max(45, avg)) - 45) / 53) * 92) * 10) / 10
})

const luckyHours = computed(() => {
  const hours = fortuneData.value?.lucky_hours
  return Array.isArray(hours) ? hours : []
})

const luckyNumberText = computed(() => {
  const nums = fortuneData.value?.lucky_number
  return Array.isArray(nums) && nums.length ? nums.join('、') : '-'
})

const luckyDirectionShort = computed(() => {
  const dir = fortuneData.value?.lucky_direction || ''
  return dir.split('——')[0] || '-'
})

const buildDayItem = (dateStr, label = '所选') => {
  const target = new Date(`${dateStr}T12:00:00`)
  const weekMap = ['日', '一', '二', '三', '四', '五', '六']
  return {
    fullDate: dateStr,
    dateNum: String(target.getDate()).padStart(2, '0'),
    weekDay: label || `周${weekMap[target.getDay()]}`
  }
}

const generateDays = (preferredDate = '') => {
  const days = []
  const weekMap = ['日', '一', '二', '三', '四', '五', '六']
  const today = new Date()
  const dayCount = isGuest.value ? 1 : 7
  for (let i = 0; i < dayCount; i++) {
    const target = new Date(today)
    target.setDate(today.getDate() + i)
    const year = target.getFullYear()
    const month = String(target.getMonth() + 1).padStart(2, '0')
    const date = String(target.getDate()).padStart(2, '0')
    days.push({
      fullDate: `${year}-${month}-${date}`,
      dateNum: date,
      weekDay: i === 0 ? '今日' : `周${weekMap[target.getDay()]}`
    })
  }
  const normalizedPreferred = normalizeDateString(preferredDate)
  if (normalizedPreferred && !days.some(day => day.fullDate === normalizedPreferred)) {
    days.unshift(buildDayItem(normalizedPreferred))
  }
  availableDays.value = days
  selectedDate.value = normalizedPreferred || days[0].fullDate
}

const generateWeeks = (preferredDate = '') => {
  const todayKey = toDateKey(new Date())
  const weekList = listFortuneWeeks(todayKey, preferredDate)
  availableWeeks.value = weekList.weeks
  selectedWeekStart.value = weekList.selectedWeekStart
  scrollSelectedWeekIntoView()
}

const generateMonths = () => {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const months = listClientFlowMonths(todayKey, 6, 24)
    .map((monthItem, index) => ({
      key: monthItem.key,
      label: index === 6 ? '本月' : monthItem.shortRangeLabel,
      monthText: monthItem.label,
      rangeText: monthItem.rangeLabel,
      contextMonthKey: monthItem.contextMonthKey,
    }))
  availableMonths.value = months
  selectedMonth.value = getClientFlowMonthInfo().key
  scrollSelectedMonthIntoView()
}

const generateYears = () => {
  const currentY = new Date().getFullYear()
  const years = []
  for (let y = currentY - 10; y <= currentY + 10; y++) {
    years.push({ key: String(y), label: String(y), yearValue: y })
  }
  availableYears.value = years
  selectedYear.value = String(currentY)
  scrollSelectedYearIntoView()
}

const scrollSelectedYearIntoView = () => {
  nextTick(() => {
    if (!yearScrollerRef.value) return
    const activeEl = yearScrollerRef.value.querySelector('.date-item.active')
    if (activeEl) {
      const containerWidth = yearScrollerRef.value.clientWidth
      const elLeft = activeEl.offsetLeft
      const elWidth = activeEl.clientWidth
      yearScrollerRef.value.scrollTo({ left: elLeft - containerWidth / 2 + elWidth / 2, behavior: 'smooth' })
    }
  })
}

const selectYear = (key) => {
  if (selectedYear.value === key) return
  selectedYear.value = key
  scrollSelectedYearIntoView()
}

const getTabLabel = (val) => tabs.find(t => t.value === val)?.label

const formatSolarDate = (value) => {
  if (!value) return '阳历待确认'
  const p = String(value).match(/\d+/g)
  if (!p || p.length < 3) return '阳历待确认'
  return `${p[0]}.${p[1].padStart(2, '0')}.${p[2].padStart(2, '0')}`
}

const profileMetaText = (profile) => {
  const parts = [profile.gender === 'M' ? '乾造' : '坤造']
  if (profile.is_default) parts.push('默认')
  return parts.join(' · ')
}

const formatGuide = (guideStr, type) => {
  if (!guideStr) return '无特殊忌讳'
  const parts = guideStr.split('；')
  if (type === '宜' && parts[0]) return parts[0].replace('宜', '').trim()
  if (type === '忌' && parts[1]) return parts[1].replace('忌', '').trim()
  return guideStr
}

const formatList = (items) => Array.isArray(items) && items.length ? items.join('、') : '-'

const formatMonthDay = (dateStr) => {
  const match = String(dateStr || '').match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (!match) return '-'
  return `${Number(match[1])}月${Number(match[2])}日`
}

const formatWeekday = (dateStr) => {
  const match = String(dateStr || '').match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return '-'
  const target = new Date(`${dateStr}T12:00:00`)
  return `周${'日一二三四五六'[target.getDay()]}`
}

const formatTriggers = (triggers = []) => {
  const names = {
    sanxing: '三刑',
    kongwang: '空亡',
    chong_rizhi: '冲日支',
    high_shishen: '高分十神',
  }
  return Array.isArray(triggers) && triggers.length
    ? triggers.map(item => names[item] || item).join('、')
    : '纯分数低点'
}

const getFortuneStorage = () => (typeof window === 'undefined' ? null : window.localStorage)
const syncMonthlyRefreshSignal = (profileId = currentProfileCacheKey.value, monthKey = selectedMonthKey.value) => {
  monthlyRefreshSignal.value = peekMonthlyInterpretationRefresh(getFortuneStorage(), profileId, monthKey)
  monthlyRefreshState.value = monthlyRefreshSignal.value ? 'pending' : 'idle'
}

const rememberFortuneCache = (userId, dateStr, data, profileId = '') => {
  rememberSharedFortuneCache(getFortuneStorage(), userId, dateStr, data, new Date(), profileId)
}

const loadCachedFortune = (userId, dateStr, profileId = '') => loadSharedCachedFortune(getFortuneStorage(), userId, dateStr, new Date(), profileId)

const buildGuestFortuneData = (dateStr) => ({
  ...guestFortuneData,
  solar_date: dateStr,
  profile_name: activeProfileName.value,
})

const loadGuestProfile = () => {
  const profile = getGuestState().baziProfile
  baziProfiles.value = profile ? [profile] : []
  selectedProfileId.value = profile?.id || ''
  setSelectedBaziProfileId(profile?.id || '')
}

const fetchProfiles = async () => {
  if (isGuest.value) {
    loadGuestProfile()
    return
  }

  const { data } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_LIST_SELECT).order('created_at', { ascending: false })
  baziProfiles.value = data || []
  const requestedProfileId = String(route.query.profileId || '')
  const resolvedProfileId = resolveSelectedBaziProfileId(baziProfiles.value, {
    requestedProfileId,
    currentProfileId: selectedProfileId.value
  })
  selectedProfileId.value = resolvedProfileId
  setSelectedBaziProfileId(resolvedProfileId)
}

const toggleProfileMenu = () => {
  if (!showProfileSwitcher.value) return
  isProfileMenuOpen.value = !isProfileMenuOpen.value
}

const selectProfile = (profileId) => {
  if (!profileId || profileId === selectedProfileId.value) {
    isProfileMenuOpen.value = false
    return
  }
  selectedProfileId.value = profileId
  setSelectedBaziProfileId(profileId)
  isProfileMenuOpen.value = false
  if (currentTab.value === 'month') {
    fetchMonthlyFortuneData()
  } else if (currentTab.value === 'week') {
    fetchWeeklyFortuneData()
  } else {
    fetchFortuneData(selectedDate.value)
  }
}

const handleDocumentClick = (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest('.profile-switcher')) isProfileMenuOpen.value = false
}

const fetchFortuneBaseFromApi = async (dateStr, accessToken, profileId) => {
  const response = await fetch('/api/fortune-daily', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ target_date: dateStr, profile_id: profileId || undefined })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || '推演失败')
  }
  return response.json()
}

const fetchMonthlyFortuneFromApi = async (monthKey, accessToken, profileId) => {
  const response = await fetch('/api/fortune-monthly', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ target_month: monthKey, profile_id: profileId || undefined })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || '月运推演失败')
  }
  return response.json()
}

const fetchWeeklyFortuneFromApi = async (dateStr, accessToken, profileId) => {
  const response = await fetch('/api/fortune-weekly', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ target_date: dateStr, profile_id: profileId || undefined })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || '周运推演失败')
  }
  return response.json()
}

const fetchAnnualFortuneFromApi = async (targetYear, accessToken, profileId) => {
  const response = await fetch('/api/fortune-annual', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ target_year: targetYear, profile_id: profileId || undefined })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || '年运推演失败')
  }
  return response.json()
}

const tryParseMonthlyInterpretation = (text) => {
  try {
    return JSON.parse(String(text || '').replace(/```json/g, '').replace(/```/g, '').trim())
  } catch {
    return null
  }
}

const extractPartialDetails = (text) => {
  const match = String(text || '').match(/"details"\s*:\s*"((?:\\.|[^"\\])*)/)
  if (!match) return ''
  try {
    return JSON.parse(`"${match[1]}"`)
  } catch {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
}

const applyMonthlyInterpretationPatch = (dimension, patch) => {
  monthlyInterpretations.value = {
    ...monthlyInterpretations.value,
    [dimension]: {
      ...(monthlyInterpretations.value[dimension] || { dimension }),
      ...patch,
    },
  }
}

const parseSsePayload = (chunk) => {
  return chunk
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s*/, '').trim())
    .filter(Boolean)
}

const requestMonthlyInterpretation = async (monthKey, accessToken, profileId, dimension, onDetailsChunk) => {
  const response = await fetch('/api/fortune-monthly-interpretation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ target_month: monthKey, profile_id: profileId || undefined, dimension })
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || '月运断语生成失败')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) return response.json()
  const reader = response.body?.getReader?.()
  if (!reader) return response.json()

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const eventText of parts) {
      for (const payload of parseSsePayload(eventText)) {
        if (payload === '[DONE]') continue
        const parsed = tryParseMonthlyInterpretation(payload)
        const delta = parsed?.choices?.[0]?.delta?.content || parsed?.delta || parsed?.content || payload
        fullText += delta
        const partialDetails = extractPartialDetails(fullText)
        if (partialDetails) onDetailsChunk(partialDetails)
      }
    }
  }

  const finalJson = tryParseMonthlyInterpretation(fullText)
  if (finalJson) return finalJson
  return {
    dimension,
    details: fullText,
    title: '月度详批生成中',
    highlight: '断语已流式返回',
    tags: [],
    advice: [],
  }
}

const requestFortuneInterpretation = async (userId, dateStr, accessToken, profileId) => {
  const existingPending = getPendingInterpretation(userId, dateStr, profileId)
  if (!existingPending) {
    const pendingRequest = fetch('/api/fortune-daily-interpretation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ target_date: dateStr, profile_id: profileId || undefined })
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || '断语生成失败')
        }
        return response.json()
      })
      .finally(() => clearPendingInterpretation(userId, dateStr, profileId))

    rememberPendingInterpretation(userId, dateStr, pendingRequest, profileId)
  }

  return getPendingInterpretation(userId, dateStr, profileId)
}

const fetchFortuneData = async (dateStr) => {
  const currentRequest = requestSerial.value + 1
  requestSerial.value = currentRequest
  isLoading.value = true
  isInterpretationLoading.value = false
  interpretationError.value = ''

  const optimisticUserId = globalState.currentUser?.id
  const profileId = currentProfileCacheKey.value
  if (optimisticUserId) {
    const optimisticCached = loadCachedFortune(optimisticUserId, dateStr, profileId)
    if (optimisticCached) {
      fortuneData.value = optimisticCached
      isLoading.value = false
      if (hasInterpretationFields(optimisticCached)) return
    } else {
      fortuneData.value = null
    }
  } else {
    fortuneData.value = null
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && isGuest.value) {
      isLoading.value = false
      isInterpretationLoading.value = false
      interpretationError.value = ''
      loadGuestProfile()
      fortuneData.value = buildGuestFortuneData(dateStr)
      recordGuestFortuneViewed(undefined, dateStr)
      await trackGuestEvent(supabase, 'guest_fortune_viewed', 'fortune', { date: dateStr })
      return
    }
    if (!session) { alert('请先前往首页登录'); return }

    let cachedData = loadCachedFortune(session.user.id, dateStr, profileId)
    if (currentRequest !== requestSerial.value) return

    if (cachedData) {
      fortuneData.value = cachedData
      isLoading.value = false
      if (hasInterpretationFields(cachedData)) return
      fetchFortuneInterpretation(session.user.id, dateStr, session.access_token, profileId, currentRequest)
      return
    }

    const baseData = await fetchFortuneBaseFromApi(dateStr, session.access_token, profileId)
    if (currentRequest !== requestSerial.value) return
    rememberFortuneCache(session.user.id, dateStr, baseData, profileId)
    fortuneData.value = baseData
    isLoading.value = false
    if (hasInterpretationFields(baseData)) return
    fetchFortuneInterpretation(session.user.id, dateStr, session.access_token, profileId, currentRequest)
  } catch (error) {
    if (currentRequest !== requestSerial.value) return
    console.error(error)
    alert(error.message)
  } finally {
    if (currentRequest === requestSerial.value) isLoading.value = false
  }
}

const fetchMonthlyFortuneData = async () => {
  const currentRequest = monthRequestSerial.value + 1
  monthRequestSerial.value = currentRequest
  monthError.value = ''
  monthlyData.value = null
  monthlyDataKey.value = ''
  monthlyInterpretations.value = {}
  monthlyInterpretationError.value = ''
  isMonthlyInterpretationLoading.value = false

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && isGuest.value) {
      monthlyData.value = null
      monthError.value = '访客模式暂不展示月运'
      return
    }
    if (!session) { alert('请先前往首页登录'); return }

    isMonthLoading.value = true
    const profileId = currentProfileCacheKey.value
    syncMonthlyRefreshSignal(profileId, selectedMonthKey.value)
    if (monthlyRefreshSignal.value) monthlyRefreshState.value = 'refreshing'
    const data = await fetchMonthlyFortuneFromApi(selectedMonthKey.value, session.access_token, profileId)
    if (currentRequest !== monthRequestSerial.value) return
    monthlyData.value = data
    monthlyDataKey.value = selectedMonthKey.value
    fetchMonthlyInterpretation(selectedMonthlyDimension.value, { force: Boolean(monthlyRefreshSignal.value) })
  } catch (error) {
    if (currentRequest !== monthRequestSerial.value) return
    console.error(error)
    monthlyData.value = null
    monthError.value = error.message
  } finally {
    if (currentRequest === monthRequestSerial.value) isMonthLoading.value = false
  }
}

const fetchWeeklyFortuneData = async () => {
  const currentRequest = weekRequestSerial.value + 1
  weekRequestSerial.value = currentRequest
  weekError.value = ''
  weeklyData.value = null

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && isGuest.value) {
      weeklyData.value = null
      weekError.value = '访客模式暂不展示周运'
      return
    }
    if (!session) { alert('请先前往首页登录'); return }

    isWeekLoading.value = true
    const profileId = currentProfileCacheKey.value
    const data = await fetchWeeklyFortuneFromApi(selectedWeekStart.value || selectedDate.value, session.access_token, profileId)
    if (currentRequest !== weekRequestSerial.value) return
    weeklyData.value = data
  } catch (error) {
    if (currentRequest !== weekRequestSerial.value) return
    console.error(error)
    weeklyData.value = null
    weekError.value = error.message
  } finally {
    if (currentRequest === weekRequestSerial.value) isWeekLoading.value = false
  }
}

const fetchAnnualFortuneData = async () => {
  if (!activeProfile.value) return
  const currentRequest = annualRequestSerial.value + 1
  annualRequestSerial.value = currentRequest
  annualError.value = ''
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && isGuest.value) {
      annualDataList.value = []
      annualError.value = '访客模式暂不展示年运'
      return
    }
    if (!session) { alert('请先前往首页登录'); return }

    isAnnualLoading.value = true
    const profileId = currentProfileCacheKey.value
    const data = await fetchAnnualFortuneFromApi(new Date().getFullYear(), session.access_token, profileId)
    if (currentRequest !== annualRequestSerial.value) return
    annualDataList.value = data || []
  } catch (error) {
    if (currentRequest !== annualRequestSerial.value) return
    console.error(error)
    annualDataList.value = []
    annualError.value = error.message
  } finally {
    if (currentRequest === annualRequestSerial.value) isAnnualLoading.value = false
  }
}

const fetchMonthlyInterpretation = async (dimension = selectedMonthlyDimension.value, options = {}) => {
  const force = Boolean(options.force)
  if (!visibleMonthlyData.value || (!force && monthlyInterpretations.value[dimension])) return
  const currentRequest = monthlyInterpretationSerial.value + 1
  monthlyInterpretationSerial.value = currentRequest
  isMonthlyInterpretationLoading.value = true
  monthlyInterpretationError.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const profileId = currentProfileCacheKey.value
    const result = await requestMonthlyInterpretation(
      selectedMonthKey.value,
      session.access_token,
      profileId,
      dimension,
      (details) => {
        if (currentRequest !== monthlyInterpretationSerial.value) return
        applyMonthlyInterpretationPatch(dimension, { details, interpretation_status: 'streaming' })
      }
    )
    if (currentRequest !== monthlyInterpretationSerial.value) return
    applyMonthlyInterpretationPatch(dimension, result)
    if (monthlyRefreshSignal.value) {
      clearMonthlyInterpretationRefresh(getFortuneStorage(), currentProfileCacheKey.value, selectedMonthKey.value)
      monthlyRefreshSignal.value = null
      monthlyRefreshState.value = 'updated'
    }
  } catch (error) {
    if (currentRequest !== monthlyInterpretationSerial.value) return
    console.error(error)
    monthlyInterpretationError.value = '月度断语暂未生成，请稍后重试'
  } finally {
    if (currentRequest === monthlyInterpretationSerial.value) isMonthlyInterpretationLoading.value = false
  }
}

const selectMonthlyDimension = (dimension) => {
  if (selectedMonthlyDimension.value === dimension) return
  selectedMonthlyDimension.value = dimension
  fetchMonthlyInterpretation(dimension, { force: Boolean(monthlyRefreshSignal.value) })
}

const openMonthlyContextNotes = () => {
  showMonthlyFactorsGuide.value = false
  showMonthlyScoreHitsGuide.value = false
  showAnnualScoreHitsGuide.value = false
  router.push({
    name: 'bazi',
    query: {
      tab: 'events',
      profileId: selectedProfileId.value || undefined,
    }
  })
}

const fetchFortuneInterpretation = async (userId, dateStr, accessToken, profileId, requestId) => {
  isInterpretationLoading.value = true
  interpretationError.value = ''
  try {
    const interpretationData = await requestFortuneInterpretation(userId, dateStr, accessToken, profileId)
    if (requestId !== requestSerial.value || !fortuneData.value) return
    const mergedData = { ...fortuneData.value, ...interpretationData }
    rememberFortuneCache(userId, dateStr, mergedData, profileId)
    fortuneData.value = mergedData
  } catch (error) {
    if (requestId !== requestSerial.value) return
    console.error(error)
    interpretationError.value = '断语暂未生成，请稍后重试'
  } finally {
    if (requestId === requestSerial.value) isInterpretationLoading.value = false
  }
}

const selectDate = (dateStr) => {
  if (selectedDate.value === dateStr) return
  selectedDate.value = dateStr
  if (currentTab.value !== 'month') {
    fetchFortuneData(dateStr)
  }
}

const selectMonth = (monthKey) => {
  if (!monthKey || selectedMonth.value === monthKey) return
  selectedMonth.value = monthKey
  scrollSelectedMonthIntoView()
  syncMonthlyRefreshSignal(currentProfileCacheKey.value, monthKey)
  fetchMonthlyFortuneData()
}

const selectWeek = (weekStart) => {
  if (!weekStart || selectedWeekStart.value === weekStart) return
  selectedWeekStart.value = weekStart
  scrollSelectedWeekIntoView()
  fetchWeeklyFortuneData()
}

const scrollSelectedWeekIntoView = () => {
  nextTick(() => {
    const activeItem = weekScrollerRef.value?.querySelector('.week-item.active')
    activeItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

const scrollSelectedMonthIntoView = () => {
  nextTick(() => {
    const activeItem = monthScrollerRef.value?.querySelector('.month-item.active')
    activeItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  await fetchProfiles()
  syncMonthlyRefreshSignal()
  generateDays(String(route.query.date || ''))
  generateWeeks(String(route.query.date || ''))
  generateMonths()
  generateYears()
  fetchFortuneData(selectedDate.value)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})

watch(
  () => globalState.selectedBaziProfileId,
  (profileId) => {
    if (!profileId || profileId === selectedProfileId.value) return
    if (!baziProfiles.value.some(profile => profile.id === profileId)) return
    selectedProfileId.value = profileId
    syncMonthlyRefreshSignal(profileId, selectedMonthKey.value)
    if (currentTab.value === 'month') {
      fetchMonthlyFortuneData()
    } else if (currentTab.value === 'week') {
      fetchWeeklyFortuneData()
    } else if (currentTab.value === 'year') {
      fetchAnnualFortuneData()
    } else {
      fetchFortuneData(selectedDate.value)
    }
  }
)

watch(
  () => [route.query.date, route.query.profileId],
  ([nextDate, nextProfileId]) => {
    const normalizedDate = normalizeDateString(nextDate)
    if (normalizedDate && normalizedDate !== selectedDate.value) {
      generateDays(normalizedDate)
      generateWeeks(normalizedDate)
      if (currentTab.value === 'month') {
        fetchMonthlyFortuneData()
      } else if (currentTab.value === 'week') {
        fetchWeeklyFortuneData()
      } else if (currentTab.value === 'year') {
        fetchAnnualFortuneData()
      } else {
        fetchFortuneData(normalizedDate)
      }
    }

    const profileId = String(nextProfileId || '')
    if (profileId && profileId !== selectedProfileId.value && baziProfiles.value.some(profile => profile.id === profileId)) {
      selectedProfileId.value = profileId
      setSelectedBaziProfileId(profileId)
      syncMonthlyRefreshSignal(profileId, selectedMonthKey.value)
      if (currentTab.value === 'month') {
        fetchMonthlyFortuneData()
      } else if (currentTab.value === 'week') {
        fetchWeeklyFortuneData()
      } else if (currentTab.value === 'year') {
        fetchAnnualFortuneData()
      } else {
        fetchFortuneData(selectedDate.value || normalizedDate)
      }
    }
  }
)

watch(currentTab, (nextTab) => {
  if (nextTab === 'week' && !isWeekLoading.value) {
    scrollSelectedWeekIntoView()
    fetchWeeklyFortuneData()
  }

  if (nextTab === 'month' && !visibleMonthlyData.value && !isMonthLoading.value) {
    scrollSelectedMonthIntoView()
    syncMonthlyRefreshSignal()
    fetchMonthlyFortuneData()
  }
  if (nextTab === 'month') scrollSelectedMonthIntoView()

  if (nextTab === 'year' && !annualDataList.value.length && !isAnnualLoading.value) {
    scrollSelectedYearIntoView()
    fetchAnnualFortuneData()
  }
  if (nextTab === 'year') scrollSelectedYearIntoView()
})
</script>

<style scoped>
@import '../styles/fortune-view.css';
</style>
