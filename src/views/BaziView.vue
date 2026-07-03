<template>
  <div class="bazi-view">

    <div class="page-wrap">
        <div class="container">
            <div
                class="profile-hero-block"
                :class="{ open: isProfileMenuOpen, condensed: heroCollapseProgress > 0.98 }"
                :style="heroStickyStyle"
            >
                <!-- Circular rerun button: top-right (only) -->
                <div class="hero-top-actions">
                    <button
                        v-if="activeProfile"
                        class="hero-icon-btn"
                        :class="{ spinning: isAnalyzing }"
                        :disabled="isAnalyzing"
                        :title="rerunButtonLabel"
                        @click="requestAiSummary({ force: true })"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                        </svg>
                    </button>
                </div>

                <!-- Dates above name -->
                <div v-if="activeProfile" class="hero-dates-top">
                    <span class="hero-birth">{{ solarDateStr }}</span>
                    <span class="hero-sep">·</span>
                    <span class="hero-lunar">{{ lunarDateStr }}</span>
                </div>

                <div class="profile-strip-wrap" :class="{ open: isProfileMenuOpen }">
                    <button class="hero-name-trigger" @click="toggleProfileMenu">
                        <span class="hero-display-name">{{ activeProfileName }}</span>
                        <span v-if="activeProfile?.is_default" class="profile-strip-badge">默认</span>
                        <svg class="profile-strip-caret" :class="{ open: isProfileMenuOpen }" aria-hidden="true" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div v-if="activeProfile" class="hero-meta">
                        <div class="hero-badges">
                            <span
                                v-if="activeProfile.strong_weak"
                                class="badge badge-blue badge-action hero-pill"
                                role="button" tabindex="0"
                                @click.stop="openInsightPanel('strength')"
                            >{{ activeProfile.strong_weak }}</span>
                            <span
                                v-if="activeProfile.geju"
                                class="badge badge-gold badge-action hero-pill"
                                role="button" tabindex="0"
                                @click.stop="openInsightPanel('geju')"
                            >{{ patternFinalName }}</span>
                        </div>
                    </div>
                </div>

                <!-- Bottom Sheet (Teleported) -->
                <Teleport to="body">
                    <Transition name="sheet">
                        <div v-if="isProfileMenuOpen" class="sheet-backdrop" @click="isProfileMenuOpen = false; swipedProfileId = null"></div>
                    </Transition>
                    <Transition name="sheet-up">
                        <div v-if="isProfileMenuOpen" class="profile-bottom-sheet" @click.stop>
                            <div class="sheet-handle"></div>
                            <div class="sheet-header">
                                <span class="sheet-title">切换档案</span>
                                <div class="sheet-header-actions">
                                    <button class="sheet-add-btn" title="新增档案" @click="openAddProfile">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                                            <path d="M12 5v14M5 12h14"/>
                                        </svg>
                                    </button>
                                    <button class="sheet-close-btn" @click="isProfileMenuOpen = false; swipedProfileId = null">×</button>
                                </div>
                            </div>
                            <div class="sheet-list">
                                <div v-if="!baziProfiles.length" class="sheet-empty">暂无档案</div>
                                <div
                                    v-for="profile in baziProfiles"
                                    :key="profile.id"
                                    class="swipe-item"
                                    :class="{ swiped: swipedProfileId === profile.id }"
                                    @touchstart.passive="handleItemTouchStart"
                                    @touchend.passive="handleItemTouchEnd(profile.id, $event)"
                                >
                                    <button
                                        class="sheet-profile-btn"
                                        :class="{ active: profile.id === selectedProfileId }"
                                        @click="selectProfile(profile.id); swipedProfileId = null"
                                    >
                                        <span class="spi-indicator" :class="{ active: profile.id === selectedProfileId }"></span>
                                        <span class="spi-name">{{ profile.name || '未命名' }}</span>
                                        <span class="spi-date">{{ formatSolarDate(profile.birth_date) }}</span>
                                        <span v-if="profile.is_default" class="spi-default">默认</span>
                                    </button>
                                    <div class="swipe-actions" v-if="!isGuest">
                                        <button class="swa-btn swa-rename" @click.stop="renameProfileById(profile.id)">改昵称</button>
                                        <button class="swa-btn swa-delete" @click.stop="deleteProfileById(profile.id)">删除</button>
                                    </div>
                                </div>
                            </div>
                            <div v-if="activeProfile && !isGuest" class="sheet-footer">
                                <button class="sheet-default-btn" :disabled="activeProfile.is_default" @click="setDefaultProfile">
                                    {{ activeProfile.is_default ? '✓ 已设为默认' : '设为默认档案' }}
                                </button>
                            </div>
                        </div>
                    </Transition>
                </Teleport>

                <div v-if="isGuest" class="guest-limit-note">访客模式仅保存 1 个本地命主档案，登录后可维护多个云端档案。</div>

                <div v-show="showRename" class="profile-form rename-form">
                    <div class="form-row">
                        <input type="text" v-model="renameName" placeholder="新的昵称">
                    </div>
                    <div class="form-actions">
                        <button class="btn-ghost" style="border:none;color:var(--text-muted)" @click="showRename = false">取消</button>
                        <button class="btn-ghost" @click="renameProfile">保存昵称</button>
                    </div>
                </div>

                <div v-if="activeProfile" class="bazi-tab-bar" ref="tabBarRef">
                    <button :class="['bazi-tab', { active: currentTab === 'basic' }]" @click="currentTab = 'basic'">基础排盘</button>
                    <button :class="['bazi-tab', { active: currentTab === 'pro' }]" @click="currentTab = 'pro'">专业细盘</button>
                    <button
                        v-if="activeProfile && !needsUpgrade && !isGuest"
                        :class="['bazi-tab', { active: currentTab === 'events' }]"
                        @click="currentTab = 'events'"
                    >
                        断事笔记
                        <span v-if="lifeEvents.length" class="bazi-tab-count">{{ lifeEvents.length }}</span>
                    </button>
                    <span class="bazi-tab-ink" :style="{ transform: `translateX(${inkLeft}px)`, width: inkWidth + 'px', opacity: inkReady ? 1 : 0 }"></span>
                </div>

                <Teleport to="body">
                    <div v-if="showAdd" class="modal-overlay picker-overlay" @click="showAdd = false">
                        <div class="profile-picker-modal" @click.stop>
                            <div class="picker-sheet-handle" aria-hidden="true"></div>
                            <div class="picker-topbar">
                                <div class="picker-topcopy">
                                    <div class="picker-heading">新增排盘资料</div>
                                </div>
                                <div class="picker-mode-tabs">
                                    <button
                                        class="picker-mode-tab"
                                        :class="{ active: entryMode === ENTRY_MODE.SOLAR }"
                                        @click="entryMode = ENTRY_MODE.SOLAR"
                                    >公历</button>
                                    <button
                                        class="picker-mode-tab"
                                        :class="{ active: entryMode === ENTRY_MODE.PILLARS }"
                                        @click="entryMode = ENTRY_MODE.PILLARS"
                                    >四柱</button>
                                </div>
                                <button class="close-button picker-close dark" title="关闭" @click="showAdd = false">×</button>
                            </div>

                            <div class="picker-form-row">
                                <label class="picker-text-field">
                                    <span>姓名</span>
                                    <input type="text" v-model.trim="form.name" placeholder="请输入姓名">
                                </label>
                                <div class="picker-gender-field">
                                    <span>性别</span>
                                    <div class="gender-segment">
                                        <button :class="{ active: form.gender === 'M' }" @click="form.gender = 'M'">男</button>
                                        <button :class="{ active: form.gender === 'F' }" @click="form.gender = 'F'">女</button>
                                    </div>
                                </div>
                            </div>

                            <div v-if="entryMode === ENTRY_MODE.SOLAR" class="picker-panel">
                                <div class="date-input-panel">
                                    <div class="date-input-card">
                                        <label class="date-input-label">出生时间</label>
                                        <input
                                            type="text"
                                            inputmode="numeric"
                                            pattern="[0-9]*"
                                            maxlength="16"
                                            autocomplete="off"
                                            enterkeyhint="done"
                                            :value="solarInputMasked"
                                            @input="handleSolarInput"
                                            placeholder="输入 199303270255"
                                        >
                                        <div class="date-input-hint">仅支持数字输入，格式为 YYYYMMDDHHmm，也可只输入到日期或小时。</div>
                                    </div>
                                    <div class="location-search-card">
                                        <label class="location-search-field">
                                            <span>出生地址</span>
                                            <div class="location-search-input-wrap">
                                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle cx="11" cy="11" r="7"></circle>
                                                    <path d="m16.5 16.5 3.5 3.5"></path>
                                                </svg>
                                                <input
                                                    type="search"
                                                    v-model.trim="birthplaceQuery"
                                                    autocomplete="off"
                                                    placeholder="搜索省市区县，如 福建省厦门市思明区"
                                                    @focus="isBirthplaceSearchOpen = true"
                                                >
                                                <button
                                                    v-if="birthplaceQuery || form.birthLocation"
                                                    class="location-clear-btn"
                                                    title="清除地址"
                                                    @click="resetBirthplaceSearch"
                                                >×</button>
                                            </div>
                                        </label>
                                        <div v-if="isBirthplaceSearchOpen" class="location-result-list">
                                            <button
                                                v-for="place in birthplaceSearchResults"
                                                :key="place.id + place.label"
                                                class="location-result-item"
                                                @click="selectBirthplace(place)"
                                            >
                                                <span>{{ place.label }}</span>
                                                <small>北纬{{ place.lat }} 东经{{ place.lng }}</small>
                                            </button>
                                            <div v-if="birthplaceQuery && !birthplaceSearchResults.length" class="location-empty">未找到匹配地址</div>
                                        </div>
                                        <div class="time-toggle-row">
                                            <label class="time-check" :class="{ active: form.solarTimeMode === 'apparent', disabled: !form.birthLocation }">
                                                <input type="checkbox" :checked="form.solarTimeMode === 'apparent'" :disabled="!form.birthLocation" @change="toggleApparentSolarTime">
                                                <span>真太阳时</span>
                                            </label>
                                            <label class="time-check" :class="{ active: daylightSavingAutoActive, disabled: true }">
                                                <input type="checkbox" :checked="daylightSavingAutoActive" disabled>
                                                <span>夏令时</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div class="date-segment-row">
                                        <div class="date-segment"><span>年</span><strong>{{ solarInputDigits.slice(0, 4) || '----' }}</strong></div>
                                        <div class="date-segment"><span>月</span><strong>{{ solarInputDigits.slice(4, 6) || '--' }}</strong></div>
                                        <div class="date-segment"><span>日</span><strong>{{ solarInputDigits.slice(6, 8) || '--' }}</strong></div>
                                        <div class="date-segment"><span>时</span><strong>{{ solarInputDigits.slice(8, 10) || '--' }}</strong></div>
                                        <div class="date-segment"><span>分</span><strong>{{ solarInputDigits.slice(10, 12) || '--' }}</strong></div>
                                    </div>
                                </div>
                                <div v-if="solarPreview" class="picker-preview-card">
                                    <div>钟表阳历：{{ solarPreview.solarText }}</div>
                                    <div v-if="solarTimeAdjustmentText">排盘时间：{{ solarPreview.adjustedSolarText }}（{{ solarTimeAdjustmentText }}）</div>
                                    <div>农历：{{ solarPreview.lunarText }}</div>
                                    <div>四柱：{{ solarPreview.baziStr }}</div>
                                </div>
                                <div v-else class="picker-preview-card muted">
                                    <div>{{ solarInputError }}</div>
                                </div>
                            </div>

                            <div v-else class="picker-panel">
                                <div class="pillar-slot-grid">
                                    <button
                                        class="pillar-slot"
                                        :class="{ active: activePillarSlot === 'yearGan' }"
                                        @click="setActivePillarSlot('yearGan')"
                                    >
                                        <span class="slot-label">年干</span>
                                        <strong class="slot-value">{{ pillarInput.yearPillar.charAt(0) || '年干' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot derived"
                                        :class="{ active: activePillarSlot === 'monthGan' }"
                                        @click="setActivePillarSlot('monthGan')"
                                    >
                                        <span class="slot-label">月干</span>
                                        <strong class="slot-value">{{ pillarInput.monthPillar.charAt(0) || '月干' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot"
                                        :class="{ active: activePillarSlot === 'dayGan' }"
                                        @click="setActivePillarSlot('dayGan')"
                                    >
                                        <span class="slot-label">日干</span>
                                        <strong class="slot-value">{{ pillarInput.dayPillar.charAt(0) || '日干' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot derived"
                                        :class="{ active: activePillarSlot === 'timeGan' }"
                                        @click="setActivePillarSlot('timeGan')"
                                    >
                                        <span class="slot-label">时干</span>
                                        <strong class="slot-value">{{ pillarInput.timePillar.charAt(0) || '时干' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot"
                                        :class="{ active: activePillarSlot === 'yearZhi' }"
                                        @click="setActivePillarSlot('yearZhi')"
                                    >
                                        <span class="slot-label">年支</span>
                                        <strong class="slot-value">{{ pillarInput.yearPillar.charAt(1) || '年支' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot"
                                        :class="{ active: activePillarSlot === 'monthZhi' }"
                                        @click="setActivePillarSlot('monthZhi')"
                                    >
                                        <span class="slot-label">月支</span>
                                        <strong class="slot-value">{{ pillarInput.monthPillar.charAt(1) || '月支' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot"
                                        :class="{ active: activePillarSlot === 'dayZhi' }"
                                        @click="setActivePillarSlot('dayZhi')"
                                    >
                                        <span class="slot-label">日支</span>
                                        <strong class="slot-value">{{ pillarInput.dayPillar.charAt(1) || '日支' }}</strong>
                                    </button>
                                    <button
                                        class="pillar-slot"
                                        :class="{ active: activePillarSlot === 'timeZhi' }"
                                        @click="setActivePillarSlot('timeZhi')"
                                    >
                                        <span class="slot-label">时支</span>
                                        <strong class="slot-value">{{ pillarInput.timePillar.charAt(1) || '时支' }}</strong>
                                    </button>
                                </div>
                                <div class="pillar-choice-panel">
                                    <div class="pillar-choice-head">
                                        <div class="picker-column-label">当前选择：{{ activeSlotLabel }}</div>
                                        <div class="pillar-orb-current">{{ activeSlotValue || activeSlotLabel }}</div>
                                    </div>
                                    <div v-if="activeSlotHint" class="pillar-rule-tip">
                                        {{ activeSlotHint }}
                                    </div>
                                    <div class="orb-section">
                                        <div class="orb-title">{{ activeSlotType === 'gan' ? '天干' : '地支' }}</div>
                                        <div class="choice-chip-grid" :class="{ 'choice-chip-grid-gz': activeSlotType === 'gan', 'choice-chip-grid-zhi': activeSlotType === 'zhi' }">
                                            <button
                                                v-for="item in activeCandidateOptions"
                                                :key="'candidate'+item"
                                                class="choice-chip"
                                                :class="{ active: activeSlotValue === item, [WX_MAP[item] || 'wx-none']: true }"
                                                @click="updateActivePillar(item)"
                                            >{{ item }}</button>
                                        </div>
                                    </div>
                                </div>
                                <div v-if="pillarPreview" class="picker-preview-card">
                                    <div>匹配结果：{{ pillarPreview.solarText }}</div>
                                    <div>农历：{{ pillarPreview.lunarText }}</div>
                                    <div>候选数量：{{ pillarMatches.length }} 个，默认采用最近日期</div>
                                </div>
                                <div v-else class="picker-preview-card muted">
                                    <div>{{ pillarPreviewError }}</div>
                                </div>
                            </div>

                            <button class="picker-save-btn" @click="saveProfile">确定</button>
                        </div>
                    </div>
                </Teleport>
            </div>

            <div v-if="activeProfile" class="glass-card dashboard-panel">

                <Teleport to="body">
                    <Transition name="bsheet">
                    <div v-if="showGuestLoginGuide" class="modal-overlay" @click="showGuestLoginGuide = false">
                        <div class="guest-login-modal bsheet-inner" @click.stop>
                            <button class="close-button guest-login-close" title="关闭" @click="showGuestLoginGuide = false">×</button>
                            <div class="guest-login-kicker">访客模式</div>
                            <h3>登录后生成完整云端排盘</h3>
                            <p>
                                访客本地档案已保存。
                                <router-link :to="{ path: '/', query: { auth: 'login' } }" @click="showGuestLoginGuide = false">登录</router-link>
                                后可补全格局、喜忌、断语与岁运细解。
                            </p>
                        </div>
                    </div>
                    </Transition>
                </Teleport>

                <div v-if="isAnalyzing || analysisNotice" class="analysis-status" :class="{ done: analysisNotice && !isAnalyzing }">
                    <div class="loader-orbit" v-if="isAnalyzing">
                        <span></span><span></span><span></span>
                    </div>
                    <div class="analysis-copy">
                        <div class="analysis-title">{{ isAnalyzing ? analysisSteps[analysisStageIndex] : analysisNotice }}</div>
                        <div class="analysis-subtitle">{{ isAnalyzing ? '排盘、格局、岁运与喜忌正在同步校验' : '最新结果已写入当前档案' }}</div>
                    </div>
                    <button
                        v-if="analysisNotice && !isAnalyzing"
                        class="analysis-dismiss"
                        type="button"
                        aria-label="关闭推演状态提示"
                        title="关闭"
                        @click="analysisNotice = ''"
                    >×</button>
                    <div v-if="isAnalyzing" class="analysis-progress">
                        <i :style="{ width: analysisProgress + '%' }"></i>
                    </div>
                </div>

                <Transition name="tab-fade" mode="out-in">
                <div :key="currentTab" class="tab-pane-wrap">

                <!-- ══ 命主断事笔记 ══ -->
                <div v-if="currentTab === 'events' && activeProfile && !needsUpgrade && !isGuest" class="life-events-card">
                    <div class="ai-header-row notes-card-header">
                        <div class="ai-header-title">断事笔记</div>
                        <div class="context-card-top-actions">
                            <button class="info-button" title="功能说明" @click="openLeGuide('events')">?</button>
                            <span v-if="isCalibrated" class="calibrated-badge">
                                已深度校准 · {{ calibratedTimeStr }}
                            </span>
                        </div>
                    </div>

                    <div v-if="sortedLifeEvents.length > 0" class="le-timeline">
                        <div
                            v-for="ev in sortedLifeEvents"
                            :key="ev.id"
                            class="le-item"
                        >
                            <div class="le-dot" :class="`le-dot--${eventImpactClass(ev.impact)}`"></div>
                            <div class="le-line"></div>
                            <div class="le-card">
                                <div class="le-card-head">
                                    <span class="le-year">
                                        {{ ev.year }}年{{ ev.month ? ev.month + '月' : '' }}
                                    </span>
                                    <span v-if="ev.dayun_at_time" class="le-dayun">大运 {{ ev.dayun_at_time }}</span>
                                    <span class="le-cat">{{ eventCategoryLabel(ev.category) }}</span>
                                    <span class="le-impact" :class="`le-impact--${eventImpactClass(ev.impact)}`">
                                        {{ eventImpactLabel(ev.impact) }}
                                    </span>
                                    <button class="le-del" @click="deleteLifeEvent(ev.id)">×</button>
                                </div>
                                <p class="le-desc">{{ ev.description }}</p>
                            </div>
                        </div>
                    </div>
                    <div v-else class="le-empty">暂无记录，添加真实大事以校准盘面</div>

                    <button class="le-toggle-btn" @click="isFormOpen = !isFormOpen">
                        {{ isFormOpen ? '收起' : '+ 添加事件' }}
                    </button>

                    <div v-if="isFormOpen" class="le-form">
                        <div class="le-form-row">
                            <div class="le-field">
                                <label>发生年份 *</label>
                                <select v-model.number="eventForm.year">
                                    <option v-for="year in eventYearOptions" :key="year" :value="year">{{ year }} 年</option>
                                </select>
                            </div>
                            <div class="le-field">
                                <label>发生月份（选填）</label>
                                <select v-model.number="eventForm.month">
                                    <option :value="undefined">不填</option>
                                    <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
                                </select>
                            </div>
                        </div>

                        <div class="le-field">
                            <label>事件领域 *</label>
                            <div class="le-cats">
                                <button
                                    v-for="cat in LIFE_EVENT_CATEGORIES"
                                    :key="cat.value"
                                    class="le-cat-chip"
                                    :class="{ active: eventForm.category === cat.value }"
                                    @click="eventForm.category = cat.value"
                                >
                                    {{ cat.label }}
                                </button>
                            </div>
                        </div>

                        <div class="le-field">
                            <label>事件性质 *</label>
                            <div class="le-impacts">
                                <button
                                    v-for="opt in IMPACT_OPTIONS"
                                    :key="opt.value"
                                    class="le-impact-btn"
                                    :class="[`le-impact-btn--${opt.cls}`, { active: eventForm.impact === opt.value }]"
                                    @click="eventForm.impact = opt.value"
                                >
                                    {{ opt.label }}
                                </button>
                            </div>
                        </div>

                        <div class="le-field">
                            <label>
                                事件描述 *
                                <span
                                    class="le-charcount"
                                    :class="{ warn: eventForm.description.length > 180 }"
                                >{{ eventForm.description.length }}/200</span>
                            </label>
                            <textarea
                                v-model="eventForm.description"
                                maxlength="200"
                                rows="3"
                                placeholder="简述经过与影响，如：入职某AI公司任技术负责人，薪资翻倍..."
                            ></textarea>
                        </div>

                        <div class="le-form-actions">
                            <button class="btn-ghost" @click="resetEventForm">取消</button>
                            <button class="btn-primary" :disabled="!isEventFormValid" @click="submitLifeEvent">
                                确认添加
                            </button>
                        </div>
                    </div>
                </div>

                <div v-if="currentTab === 'events' && activeProfile && !needsUpgrade && !isGuest" class="life-events-card">
                    <div class="ai-header-row notes-card-header">
                        <div class="ai-header-title">长期基调</div>
                        <div class="context-card-top-actions">
                            <button class="info-button" title="查看长期基调说明" @click="openLeGuide('profile')">?</button>
                            <button class="btn-ghost btn-compact" :disabled="isSavingProfileContext" @click="saveProfileContextDraft">
                                {{ isSavingProfileContext ? '保存中…' : '保存基调' }}
                            </button>
                        </div>
                    </div>
                    <div class="context-card">
                        <p class="context-card-desc">这部分是较稳定的人生背景，只影响月运断语落点，不参与算分。</p>
                        <div class="context-grid">
                            <article v-for="section in PROFILE_CONTEXT_SECTIONS" :key="section.key" class="context-panel">
                                <div class="section-kicker">{{ section.title }}</div>
                                <div class="context-field" v-for="field in section.fields" :key="field.key">
                                    <label>{{ field.label }}</label>
                                    <select
                                        v-if="field.type === 'select'"
                                        v-model="profileContextDraft[section.storeKey][field.key]"
                                    >
                                        <option value="">暂不填写</option>
                                        <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                                    </select>
                                    <input
                                        v-else-if="field.type === 'text'"
                                        v-model.trim="profileContextDraft[section.storeKey][field.key]"
                                        type="text"
                                        :maxlength="field.maxlength || 80"
                                        :placeholder="field.placeholder || ''"
                                    >
                                    <textarea
                                        v-else
                                        v-model.trim="profileContextDraft[section.storeKey][field.key]"
                                        rows="3"
                                        :maxlength="field.maxlength || 80"
                                        :placeholder="field.placeholder || ''"
                                    ></textarea>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>

                <div v-if="currentTab === 'events' && activeProfile && !needsUpgrade && !isGuest" class="life-events-card">
                    <div class="ai-header-row notes-card-header">
                        <div class="ai-header-title">月度基调</div>
                        <div class="context-card-top-actions">
                            <button class="info-button" title="查看月度基调说明" @click="openLeGuide('monthly')">?</button>
                            <select v-model="notesMonthKey" class="context-month-select">
                                <option v-for="option in notesMonthOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                            <button class="mini-action mini-action--subtle" :disabled="!hasPreviousMonthlyContext || isSavingMonthlyContext" @click="copyPreviousMonthlyContext">
                                沿用上月
                            </button>
                            <button class="btn-ghost btn-compact" :disabled="isSavingMonthlyContext" @click="saveMonthlyContextDraft">
                                {{ isSavingMonthlyContext ? '保存中…' : '保存本月' }}
                            </button>
                        </div>
                    </div>
                    <div class="context-card">
                        <p class="context-card-desc">默认会把当前月作为主基调，并参考近 3 个月记录。主维度注入完整信息，其余维度只注入状态。</p>
                        <div class="context-field">
                            <label>本月总说明</label>
                            <textarea
                                v-model.trim="monthlyContextDraft.overall_note"
                                rows="3"
                                maxlength="100"
                                placeholder="例如：这个月刚换城市，工作和感情都在重建。"
                            ></textarea>
                        </div>
                        <div class="context-grid">
                            <article v-for="section in MONTHLY_CONTEXT_SECTIONS" :key="section.key" class="context-panel">
                                <div class="section-kicker">{{ section.title }}</div>
                                <div class="context-field">
                                    <label>当前状态</label>
                                    <select v-model="monthlyContextDraft[section.storeKey].status">
                                        <option value="">暂不填写</option>
                                        <option v-for="option in section.statusOptions" :key="option" :value="option">{{ option }}</option>
                                    </select>
                                </div>
                                <div class="context-field">
                                    <label>本月现状</label>
                                    <textarea
                                        v-model.trim="monthlyContextDraft[section.storeKey].summary"
                                        rows="3"
                                        maxlength="80"
                                        placeholder="用一句话写清楚这个月正在经历什么。"
                                    ></textarea>
                                </div>
                                <div class="context-field">
                                    <label>本月目标</label>
                                    <input
                                        v-model.trim="monthlyContextDraft[section.storeKey].goal"
                                        type="text"
                                        maxlength="50"
                                        placeholder="例如：拿到 offer / 稳住关系 / 控制开支"
                                    >
                                </div>
                                <div class="context-field">
                                    <label>本月最担心</label>
                                    <input
                                        v-model.trim="monthlyContextDraft[section.storeKey].worry"
                                        type="text"
                                        maxlength="50"
                                        placeholder="例如：反馈拖延 / 情绪反复 / 现金流紧"
                                    >
                                </div>
                            </article>
                        </div>
                        <div v-if="recentMonthlyContextRecords.length" class="context-recent-list">
                            <div class="context-recent-title">近 3 个月记录</div>
                            <div v-for="item in recentMonthlyContextRecords" :key="item.month_key" class="context-recent-item">
                                <div class="context-recent-month">{{ item.month_key }}</div>
                                <div class="context-recent-copy">
                                    <span v-if="item.overall_note">{{ item.overall_note }}</span>
                                    <span v-else>{{ summarizeMonthlyStatuses(item) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- ══ /命主断事笔记 ══ -->

                <BaziPillarTable
                    v-if="resolvedMatrix && currentTab !== 'events'"
                    :columns="displayColumns"
                    :show-pillar-suffix="currentTab === 'basic'"
                    @shensha-click="showShensha"
                />

                <div v-show="currentTab === 'pro' && dayunList.length" class="timeline-section">
                    <BaziBackingPanel
                        ref="baziBackingRef"
                        :profile="activeProfile"
                        :result-data="baziTimelineResultData"
                        analysis-mode="status"
                        :selected-year="selectedLiunianYear"
                        :show-chart="false"
                        @update:selected-year="selectedLiunianYear = $event"
                    />

                    <div v-if="interactions" class="ai-section" style="margin-top:20px;">
                        <div class="timeline-title">生克合化注意</div>

                        <div class="insight-card" v-if="intGroups.ganYuanju">
                            <h4 style="color:var(--gold)">天干本命</h4>
                            <p>{{ intGroups.ganYuanju }}</p>
                        </div>
                        <div class="insight-card" v-if="intGroups.zhiYuanju">
                            <h4 style="color:var(--gold)">地支本命</h4>
                            <p>{{ intGroups.zhiYuanju }}</p>
                        </div>
                        <div class="insight-card" v-if="intGroups.ganYun">
                            <h4 style="color:#FF5E57">天干运势</h4>
                            <p>{{ intGroups.ganYun }}</p>
                        </div>
                        <div class="insight-card" v-if="intGroups.zhiYun">
                            <h4 style="color:#FF5E57">地支运势</h4>
                            <p>{{ intGroups.zhiYun }}</p>
                        </div>

                        <div v-if="!intGroups.ganYuanju && !intGroups.zhiYuanju && !intGroups.ganYun && !intGroups.zhiYun" style="text-align:center;color:#666;font-size:12px;">暂无明显的合冲破害关系</div>
                    </div>
                </div>

                <!-- 神煞解释弹窗 -->
                <Teleport to="body">
                    <Transition name="bsheet">
                    <div v-if="selectedShensha" class="modal-overlay" @click="selectedShensha = null">
                        <div class="shensha-modal bsheet-inner" @click.stop>
                            <div class="shensha-modal-head">
                                <h4>{{ getShenshaInfo(selectedShensha).label || selectedShensha }}</h4>
                                <span class="shensha-nature-badge" :class="'nature-' + getShenshaInfo(selectedShensha).nature">{{ getShenshaInfo(selectedShensha).nature }}</span>
                            </div>
                            <p class="shensha-summary">{{ getShenshaInfo(selectedShensha).summary }}</p>
                            <div v-if="getShenshaInfo(selectedShensha).auspicious" class="shensha-section shensha-ji">
                                <span class="shensha-section-label">✦ 吉</span>
                                <span>{{ getShenshaInfo(selectedShensha).auspicious }}</span>
                            </div>
                            <div v-if="getShenshaInfo(selectedShensha).inauspicious" class="shensha-section shensha-xiong">
                                <span class="shensha-section-label">✦ 忌</span>
                                <span>{{ getShenshaInfo(selectedShensha).inauspicious }}</span>
                            </div>
                            <div v-if="getShenshaInfo(selectedShensha).note" class="shensha-section shensha-note">
                                <span class="shensha-section-label">古籍</span>
                                <span>{{ getShenshaInfo(selectedShensha).note }}</span>
                            </div>
                            <button class="btn-primary" style="width:100%; margin-top:14px;" @click="selectedShensha = null">知晓</button>
                        </div>
                    </div>
                    </Transition>
                </Teleport>

                <Teleport to="body">
                    <Transition name="bsheet">
                    <div v-if="activeInfoPanel === 'insight' && (strengthPanelContent || gejuPanelContent)" class="modal-overlay" @click="activeInfoPanel = null">
                        <div class="detail-drawer insight-detail-drawer bsheet-inner" @click.stop>
                            <!-- sticky header -->
                            <div class="insight-sticky-head">
                                <div class="drawer-head">
                                    <div class="drawer-head-title">命局天机</div>
                                    <button class="close-button" title="关闭" @click="activeInfoPanel = null">×</button>
                                </div>
                                <div class="insight-tab-bar" ref="insightTabBarRef">
                                    <button class="insight-bazi-tab" :class="{ active: insightTab === 'strength' }" @click="insightTab = 'strength'">身强/身弱</button>
                                    <button class="insight-bazi-tab" :class="{ active: insightTab === 'geju' }" @click="insightTab = 'geju'">格局判定</button>
                                    <button class="insight-bazi-tab" :class="{ active: insightTab === 'explain' }" @click="insightTab = 'explain'">判定说明</button>
                                    <span class="insight-tab-ink" :style="{ transform: `translateX(${insightInkLeft}px)`, width: insightInkWidth + 'px', opacity: insightInkReady ? 1 : 0 }"></span>
                                </div>
                            </div>
                            <!-- scrollable content -->
                            <div class="insight-scroll-body">
                                <template v-if="insightTab === 'strength' && strengthPanelContent">
                                    <div v-if="strengthPanelContent.meter" class="strength-meter-card">
                                        <div class="strength-meter-top">
                                            <span class="strength-meter-label">{{ strengthPanelContent.meter.verdict }}</span>
                                            <span class="strength-meter-band">{{ strengthPanelContent.meter.label }}</span>
                                        </div>
                                        <div class="strength-meter-track" aria-label="日主旺衰仪表盘">
                                            <div class="strength-meter-fill" :style="{ width: `${strengthPanelContent.meter.percent}%` }"></div>
                                            <div class="strength-meter-thumb" :style="{ left: `${strengthPanelContent.meter.percent}%` }"></div>
                                        </div>
                                        <div class="strength-meter-axis">
                                            <span>弱</span>
                                            <span>中</span>
                                            <span>强</span>
                                        </div>
                                    </div>
                                    <div v-if="strengthPanelContent.sections.length" class="insight-prose-list">
                                        <div v-for="section in strengthPanelContent.sections" :key="section.key" class="insight-prose-item">
                                            <div class="insight-prose-head">
                                                <span class="insight-prose-label">{{ section.title }}</span>
                                                <span v-if="section.scoreLabel" class="strength-score-chip">{{ section.scoreLabel }}</span>
                                            </div>
                                            <p class="insight-prose-text">{{ section.text }}</p>
                                        </div>
                                    </div>
                                </template>
                                <template v-else-if="insightTab === 'geju' && gejuPanelContent">
                                    <div class="insight-prose-kicker-row">
                                        <span class="geju-chip">{{ gejuPanelContent.baseGeju }}</span>
                                        <span v-if="gejuPanelContent.showChengGe" class="geju-chip accent is-text">{{ gejuPanelContent.chengGe }}</span>
                                        <span class="geju-chip" :class="gejuPanelContent.resultClass">{{ gejuPanelContent.chengGeStatus }}</span>
                                    </div>
                                    <div class="insight-prose-list">
                                        <div class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">立格依据</span></div>
                                            <p class="insight-prose-main">{{ gejuPanelContent.gejuBasis }}</p>
                                            <p class="insight-prose-text">{{ gejuPanelContent.judgeBase }}</p>
                                            <div v-if="gejuPanelContent.monthMergeLine" class="geju-inline-note">{{ gejuPanelContent.monthMergeLine }}</div>
                                        </div>
                                        <div v-if="gejuPanelContent.extractionSteps.length" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">取格步骤</span></div>
                                            <div class="insight-step-list">
                                                <div v-for="step in gejuPanelContent.extractionSteps" :key="step.key" class="insight-step-row">
                                                    <span class="insight-step-label">{{ step.label }}</span>
                                                    <span class="insight-step-val">{{ step.value }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="gejuPanelContent.imageCandidate" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">形象校验</span></div>
                                            <p class="insight-prose-main">{{ gejuPanelContent.imageCandidate.subtype }} · {{ gejuPanelContent.imageCandidate.match_score }}% · {{ gejuPanelContent.imageCandidate.decision.statusText }}</p>
                                            <p v-if="gejuPanelContent.imageCandidate.decision.detailText" class="insight-prose-text">{{ gejuPanelContent.imageCandidate.decision.detailText }}</p>
                                            <p v-if="gejuPanelContent.imageCandidate.decision.reasonText" class="insight-prose-text">{{ gejuPanelContent.imageCandidate.decision.reasonLabel }}：{{ gejuPanelContent.imageCandidate.decision.reasonText }}</p>
                                            <div v-if="gejuPanelContent.imageCandidate.dimensions.length" class="insight-step-list">
                                                <div v-for="item in gejuPanelContent.imageCandidate.dimensions" :key="item.key" class="insight-step-row">
                                                    <span class="insight-step-label">{{ item.text }}</span>
                                                    <span class="insight-step-val">{{ formatImageMetric(item.score, item.max) }}</span>
                                                </div>
                                            </div>
                                            <div v-if="gejuPanelContent.imageCandidate.penalties.length" class="insight-step-list">
                                                <div v-for="item in gejuPanelContent.imageCandidate.penalties" :key="item.key" class="insight-inline-row">
                                                    <span class="insight-inline-dot insight-dot-warn">—</span>
                                                    <span class="insight-step-val insight-val-warn">{{ item.text }}</span>
                                                    <strong v-if="item.score !== ''" class="insight-val-warn">{{ formatImageMetric(item.score) }}</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">顺逆与成败</span></div>
                                            <p class="insight-prose-main">{{ gejuPanelContent.chengGeStatus }}</p>
                                            <p class="insight-prose-text">{{ gejuPanelContent.chengGeReason }}</p>
                                        </div>
                                        <div v-if="gejuPanelContent.climateAdjustment" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">调候影响</span></div>
                                            <p class="insight-prose-main">{{ gejuPanelContent.climateAdjustment.title }}</p>
                                            <p class="insight-prose-text">{{ gejuPanelContent.climateAdjustment.text }}</p>
                                        </div>
                                        <div v-if="gejuPanelContent.sourceMeta" class="insight-prose-item">
                                            <div class="insight-prose-head">
                                                <span class="insight-prose-label">材料依据</span>
                                                <span v-if="gejuPanelContent.sourceMeta.title" class="insight-source-inline">{{ gejuPanelContent.sourceMeta.title }}</span>
                                            </div>
                                            <p v-if="gejuPanelContent.sourceMeta.excerpt" class="insight-quote-line">「{{ gejuPanelContent.sourceMeta.excerpt }}」</p>
                                        </div>
                                        <div v-if="gejuPanelContent.personality.length" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">格局气质</span></div>
                                            <div class="insight-step-list">
                                                <div v-for="item in gejuPanelContent.personality" :key="item" class="insight-inline-row">
                                                    <span class="insight-inline-dot">—</span>
                                                    <span class="insight-step-val">{{ item }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="gejuPanelContent.goodFor.length" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">适合方向</span></div>
                                            <div class="insight-step-list">
                                                <div v-for="item in gejuPanelContent.goodFor" :key="item" class="insight-inline-row">
                                                    <span class="insight-inline-dot">—</span>
                                                    <span class="insight-step-val">{{ item }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="gejuPanelContent.relationshipHealth.length" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">关系与身心节奏</span></div>
                                            <div class="insight-step-list">
                                                <div v-for="item in gejuPanelContent.relationshipHealth" :key="item" class="insight-inline-row">
                                                    <span class="insight-inline-dot">—</span>
                                                    <span class="insight-step-val">{{ item }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="gejuPanelContent.watchOut.length" class="insight-prose-item">
                                            <div class="insight-prose-head"><span class="insight-prose-label">注意事项</span></div>
                                            <div class="insight-step-list">
                                                <div v-for="item in gejuPanelContent.watchOut" :key="item" class="insight-inline-row">
                                                    <span class="insight-inline-dot insight-dot-warn">—</span>
                                                    <span class="insight-step-val insight-val-warn">{{ item }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                                <template v-else-if="explanationPanelContent">
                                    <p class="insight-explain-summary">{{ explanationPanelContent.summary }}</p>
                                    <div class="insight-prose-list">
                                        <div v-for="section in explanationPanelContent.sections" :key="section.key" class="insight-prose-item">
                                            <div class="insight-prose-head">
                                                <span class="insight-prose-label">{{ section.title }}</span>
                                                <span v-if="section.source" class="insight-source-inline">《{{ section.source }}》</span>
                                            </div>
                                            <p v-if="section.quote" class="insight-quote-line">「{{ section.quote }}」</p>
                                            <div class="explain-paragraphs">
                                                <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                    </Transition>
                </Teleport>

                <Teleport to="body">
                    <Transition name="bsheet">
                    <div v-if="activeInfoPanel === 'scoring' && activeProfile.bazi_detail?.scoring_details" class="modal-overlay" @click="activeInfoPanel = null">
                        <div class="detail-drawer insight-detail-drawer scoring-detail-drawer bsheet-inner" @click.stop>
                            <div class="insight-sticky-head">
                                <div class="drawer-head">
                                    <div class="drawer-head-title">天机锦囊</div>
                                    <button class="close-button" title="关闭" @click="activeInfoPanel = null">×</button>
                                </div>
                            </div>

                            <div class="insight-scroll-body">
                                <div v-if="activeProfile.bazi_detail.decision_chain?.length" class="insight-prose-list scoring-prose-list">
                                    <div class="insight-prose-item scoring-overview-head scoring-section-heading">
                                        <div class="insight-prose-head"><span class="insight-prose-label">喜用分析</span></div>
                                    </div>
                                    <div v-for="step in activeProfile.bazi_detail.decision_chain" :key="step.layer" class="insight-prose-item">
                                        <div class="insight-prose-head">
                                            <span class="insight-prose-label">{{ step.layer }}</span>
                                            <span v-if="step.override" class="insight-source-inline scoring-override">{{ step.override }}</span>
                                        </div>
                                        <p class="insight-prose-text">{{ step.reason }}</p>
                                    </div>
                                </div>

                                <div v-if="scoringInfluenceRows.length" class="insight-prose-list scoring-prose-list">
                                    <div class="insight-prose-item scoring-overview-head scoring-section-heading">
                                        <div class="insight-prose-head"><span class="insight-prose-label">五维影响概览</span></div>
                                    </div>
                                    <div v-for="row in scoringInfluenceRows" :key="row.key" class="insight-prose-item scoring-prose-item">
                                        <div class="insight-prose-head">
                                            <span class="insight-prose-label" :class="`scoring-role-${row.roleKey}`">{{ row.role }}</span>
                                            <span class="insight-source-inline">{{ row.name }}</span>
                                        </div>
                                        <div class="scoring-inline-dims">
                                            <span
                                                v-for="dim in row.dimensions"
                                                :key="dim.key"
                                                class="scoring-inline-dim"
                                                :class="dim.value > 0 ? 'dim-pos' : 'dim-neg'"
                                            >
                                                <span>{{ dim.label }}</span>
                                                <strong>{{ dim.value > 0 ? '↑' : '↓' }}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </Transition>
                </Teleport>

                <Teleport to="body">
                    <Transition name="bsheet">
                    <div v-if="showLeGuide" class="modal-overlay" @click="showLeGuide = false">
                        <div class="le-guide-card bsheet-inner" @click.stop>
                            <div class="le-guide-head">
                                <span>{{ currentLeGuideContent.title }}</span>
                                <button class="close-button" title="关闭" @click="showLeGuide = false">×</button>
                            </div>

                            <div class="le-guide-body">
                                <div v-for="block in currentLeGuideContent.blocks" :key="block.title" class="le-guide-block">
                                    <div class="le-guide-block-title">{{ block.title }}</div>
                                    <p v-html="block.copy"></p>
                                </div>

                                <div class="le-guide-example">
                                    <div class="le-guide-example-label">{{ currentLeGuideContent.exampleTitle }}</div>
                                    <p v-html="currentLeGuideContent.example"></p>
                                </div>

                                <div class="le-guide-tip">
                                    {{ currentLeGuideContent.tip }}
                                </div>
                            </div>
                        </div>
                    </div>
                    </Transition>
                </Teleport>

                <Teleport to="body">
                    <Transition name="bsheet">
                    <div v-if="activeInfoPanel === 'tiaohou' && tiaohouPanelContent" class="modal-overlay" @click="activeInfoPanel = null">
                        <div class="detail-drawer insight-detail-drawer bsheet-inner" @click.stop>
                            <div class="drawer-head">
                                <div>
                                    <div class="section-kicker">调候诊断</div>
                                    <h4>{{ tiaohouPanelContent.climateState }}</h4>
                                </div>
                                <button class="close-button" title="关闭" @click="activeInfoPanel = null">×</button>
                            </div>
                            <div class="tiaohou-modal-urgency-row">
                                <span class="tiaohou-urgency" :class="tiaohouPanelContent.urgencyClass">{{ tiaohouPanelContent.urgency }}</span>
                                <span class="tiaohou-urgency-label">调候紧迫度</span>
                            </div>
                            <div class="tiaohou-god-grid tiaohou-modal-grid">
                                <div class="tiaohou-god-cell">
                                    <span>第一调候</span>
                                    <strong>{{ tiaohouPanelContent.primary }}</strong>
                                </div>
                                <div class="tiaohou-god-cell">
                                    <span>辅助调候</span>
                                    <strong>{{ tiaohouPanelContent.secondary }}</strong>
                                </div>
                                <div class="tiaohou-god-cell">
                                    <span>慎见</span>
                                    <strong>{{ tiaohouPanelContent.avoid }}</strong>
                                </div>
                            </div>
                            <div class="geju-modal-block">
                                <div class="geju-block-title">调候说明</div>
                                <p class="geju-block-copy">{{ tiaohouPanelContent.explanation }}</p>
                            </div>
                            <div v-if="tiaohouPanelContent.warning" class="tiaohou-warning tiaohou-modal-warning">
                                {{ tiaohouPanelContent.warning }}
                            </div>
                        </div>
                    </div>
                    </Transition>
                </Teleport>

                <Teleport to="body">
                    <div v-if="showCenteredToast" class="screen-toast">
                        <div class="screen-toast-card" :class="`is-${toastKind}`">{{ toastMessage }}</div>
                    </div>
                </Teleport>

                <!-- 命局天机分析版块 -->
                <div v-if="currentTab !== 'events' && activeProfile.bazi_detail && activeProfile.bazi_detail.scoring_details" class="rpt-section">
                    <div class="rpt-head">
                        <span class="rpt-kicker">命局天机</span>
                        <button class="info-button" title="查看命局判定" @click="openInsightPanel('strength')">i</button>
                    </div>

                    <!-- 旺衰格局标题行 -->
                    <div class="rpt-sub-head" style="margin-bottom: 8px;">
                        <span class="rpt-kicker-sm">旺衰格局</span>
                        <span class="wangge-inline">
                            <span class="wangge-val">{{ activeProfile.strong_weak }}</span>
                            <span class="wangge-sep">·</span>
                            <span class="wangge-val">{{ patternFinalName }}</span>
                            <span v-if="showChengGeText" class="rpt-h2-badge" style="margin-left:6px;">小格 {{ activeProfile.bazi_detail.chengge_detail.chengGe }}</span>
                            <span v-if="gejuPanelContent?.imageHeadline" class="image-match-badge">{{ gejuPanelContent.imageHeadline }}</span>
                        </span>
                    </div>
                    <p v-if="gejuPanelContent?.headlineStatement" class="rpt-prose">{{ gejuPanelContent.headlineStatement }}</p>
                    <p v-if="gejuPanelContent?.imageCandidate" class="rpt-prose">
                        <strong class="rpt-lead-w">基础格局　</strong>{{ gejuPanelContent.basePattern }}
                    </p>

                    <!-- 调候诊断 -->
                    <div v-if="tiaohouPanelContent" class="rpt-sub">
                        <div class="rpt-sub-head">
                            <span class="rpt-kicker-sm">调候诊断</span>
                            <strong class="rpt-sub-title">{{ tiaohouPanelContent.climateState }}</strong>
                            <span class="tiaohou-urgency" :class="tiaohouPanelContent.urgencyClass">{{ tiaohouPanelContent.urgency }}</span>
                        </div>
                        <div class="rpt-stat-row">
                            <span class="rpt-stat"><span class="rpt-stat-l">第一调候</span><strong>{{ tiaohouPanelContent.primary }}</strong></span>
                            <span class="rpt-stat"><span class="rpt-stat-l">辅助调候</span><strong>{{ tiaohouPanelContent.secondary }}</strong></span>
                            <span class="rpt-stat"><span class="rpt-stat-l">慎见</span><strong>{{ tiaohouPanelContent.avoid }}</strong></span>
                        </div>
                        <p class="rpt-prose">{{ tiaohouPanelContent.explanation }}</p>
                        <p v-if="tiaohouPanelContent.warning" class="rpt-warn-line">{{ tiaohouPanelContent.warning }}</p>
                    </div>

                    <!-- 五行能量池 -->
                    <div v-if="activeProfile.bazi_detail.wuxing_ratio" class="rpt-sub">
                        <div class="rpt-sub-head">
                            <span class="rpt-kicker-sm">五行能量池</span>
                            <span v-if="Object.values(activeProfile.bazi_detail.wuxing_ratio).some(r => r > 45)" class="overload-tag">能量偏盛</span>
                        </div>
                        <div class="wuxing-bar-container">
                            <div v-for="(ratio, wx) in activeProfile.bazi_detail.wuxing_ratio" :key="wx"
                                 class="wuxing-bar-segment"
                                 :class="'bg-' + getWuxingClass(wx)"
                                 :style="{ width: ratio + '%' }"
                                 :title="wx + ' ' + Math.round(ratio) + '%'">
                                <span v-if="ratio > 10" class="wuxing-bar-label">{{ wx }} {{ Math.round(ratio) }}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 天机锦囊 -->
                <div v-if="currentTab !== 'events' && shouldShowBaziInterpretationSection" class="rpt-section">
                    <div class="rpt-head">
                        <span class="rpt-kicker">天机锦囊</span>
                        <button class="info-button" title="查看用神决策链与四维剖析" @click="activeInfoPanel = 'scoring'">i</button>
                    </div>



                    <!-- 五神横排 -->
                    <div v-if="fiveShenProfile" class="rpt-shen-line">
                        <span class="rpt-shen-tag is-yong" :title="fiveShenProfile.yongConfidence === 'LOW' ? '五行中和，用神参考' : '命局核心用神'">
                            <span class="rpt-shen-role">用神</span>
                            <span class="rpt-shen-val">{{ formatShenWithGan(fiveShenProfile.yong) }}</span>
                            <span v-if="fiveShenProfile.yongConfidence === 'LOW'" class="rpt-shen-note">(参考)</span>
                        </span>
                        <span v-if="fiveShenProfile.xi?.length" class="rpt-shen-tag is-xi">
                            <span class="rpt-shen-role">喜神</span>
                            <span class="rpt-shen-val">{{ fiveShenProfile.xi.map(formatShenWithGan).join(' · ') }}</span>
                        </span>
                        <span v-for="s in fiveShenProfile.ji" :key="'ji'+s" class="rpt-shen-tag is-ji">
                            <span class="rpt-shen-role">忌神</span>
                            <span class="rpt-shen-val">{{ formatShenWithGan(s) }}</span>
                        </span>
                        <span v-for="s in fiveShenProfile.chou" :key="'chou'+s" class="rpt-shen-tag is-chou">
                            <span class="rpt-shen-role">仇神</span>
                            <span class="rpt-shen-val">{{ formatShenWithGan(s) }}</span>
                        </span>
                    </div>
                    <div v-else class="rpt-shen-line">
                        <span class="rpt-shen-tag is-xi">
                            <span class="rpt-shen-role">喜用神</span>
                            <span class="rpt-shen-val favorable">{{ (activeProfile.favorable_elements || []).map(formatShenWithGan).join('、') || '-' }}</span>
                        </span>
                        <span class="rpt-shen-tag is-ji">
                            <span class="rpt-shen-role">忌仇神</span>
                            <span class="rpt-shen-val unfavorable">{{ (activeProfile.unfavorable_elements || []).map(formatShenWithGan).join('、') || '-' }}</span>
                        </span>
                    </div>

                    <!-- 结构化断语 as flowing prose -->
                    <template v-if="fiveShenProfile?.userBlocks">
                        <p class="rpt-prose"><strong class="rpt-lead-w">用神说明　</strong>{{ fiveShenProfile.userBlocks.yong_shen_text }}</p>
                        <p class="rpt-prose"><strong class="rpt-lead-w">喜忌方向　</strong>{{ fiveShenProfile.userBlocks.xi_ji_text }}</p>
                        <p class="rpt-prose"><strong class="rpt-lead-w">大运指引　</strong>{{ fiveShenProfile.userBlocks.dayun_guide }}</p>
                        <p class="rpt-prose rpt-prose-warn"><strong class="rpt-lead-w">注意警示　</strong>{{ fiveShenProfile.userBlocks.avoid_text }}</p>
                    </template>

                    <!-- 原局核心 -->
                    <div class="rpt-sub">
                        <span class="rpt-kicker-sm">原局核心</span>
                        <span v-if="isBaziSectionLoading('yuanju_core')" class="bazi-stream-badge">AI 生成中</span>
                        <p v-if="resolvedYuanjuCore" class="rpt-prose bazi-stream-prose" :class="{ streaming: isBaziSectionStreaming('yuanju_core') }" style="margin-top:8px;">{{ resolvedYuanjuCore }}</p>
                        <div v-if="shouldShowBaziSectionSkeleton('yuanju_core')" class="bazi-section-skeleton"><i></i><i></i><i></i></div>
                        <div v-if="feedbackCorrections.yuanju_core" class="rpt-feedback">
                            <div class="rpt-feedback-head">
                                <span>命主反馈纠偏</span>
                                <span v-if="feedbackCorrectionDate" class="rpt-feedback-date">{{ feedbackCorrectionDate }}</span>
                            </div>
                            <p class="rpt-prose">{{ feedbackCorrections.yuanju_core }}</p>
                        </div>
                    </div>

                    <!-- 岁运推演 -->
                    <div class="rpt-sub">
                        <span class="rpt-kicker-sm">岁运推演</span>
                        <span v-if="isBaziSectionLoading('current_dayun') || isBaziSectionLoading('current_liunian')" class="bazi-stream-badge">AI 生成中</span>
                        <p v-if="resolvedCurrentDayun" class="rpt-prose bazi-stream-prose" :class="{ streaming: isBaziSectionStreaming('current_dayun') }" style="margin-top:8px;"><strong class="rpt-run-label">大运</strong>{{ resolvedCurrentDayun }}</p>
                        <div v-if="shouldShowBaziSectionSkeleton('current_dayun')" class="bazi-section-skeleton"><i></i><i></i></div>
                        <p v-if="resolvedCurrentLiunian" class="rpt-prose bazi-stream-prose" :class="{ streaming: isBaziSectionStreaming('current_liunian') }"><strong class="rpt-run-label">流年</strong>{{ resolvedCurrentLiunian }}</p>
                        <div v-if="shouldShowBaziSectionSkeleton('current_liunian')" class="bazi-section-skeleton"><i></i><i></i></div>
                        <div v-if="feedbackCorrections.current_dayun || feedbackCorrections.current_liunian" class="rpt-feedback">
                            <div class="rpt-feedback-head">
                                <span>命主反馈纠偏</span>
                                <span v-if="feedbackCorrectionDate" class="rpt-feedback-date">{{ feedbackCorrectionDate }}</span>
                            </div>
                            <p v-if="feedbackCorrections.current_dayun" class="rpt-prose"><strong>大运修正　</strong>{{ feedbackCorrections.current_dayun }}</p>
                            <p v-if="feedbackCorrections.current_liunian" class="rpt-prose"><strong>流年修正　</strong>{{ feedbackCorrections.current_liunian }}</p>
                        </div>
                    </div>
                </div>

                <div v-else-if="currentTab !== 'events' && !isBaziLlmLoading && activeProfile.bazi_summary" class="legacy-summary" style="display: block;">
                    {{ activeProfile.bazi_summary }}
                </div>

                <!-- 古籍断语 -->
                <div v-if="currentTab !== 'events' && classicVerdictText" class="rpt-section">
                    <div class="rpt-head">
                        <div class="rpt-head-left">
                            <span class="rpt-kicker">古籍断语</span>
                            <span class="rpt-src-note">{{ classicVerdict.source || '三命通会' }} · {{ classicVerdict.key }}</span>
                        </div>
                    </div>
                    <div class="rpt-classic-body">
                        <p
                            v-for="(line, idx) in classicVerdictLines"
                            :key="'classic'+idx"
                            :class="['rpt-prose', { 'rpt-classic-note': line.startsWith('#') }]"
                        >{{ line }}</p>
                    </div>
                </div>

                </div>
                </Transition>

            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.mjs'
import { Solar } from 'lunar-javascript'
import { clearBaziProfilesCache, getCachedBaziProfiles, globalState, resolveSelectedBaziProfileId, setCachedBaziProfiles, setSelectedBaziProfileId } from '../store.js'
import { getGuestState, saveGuestBaziProfile, trackGuestEvent } from '../guestMode.mjs'
import {
    loadCachedFortune as loadSharedCachedFortune,
    rememberMonthlyInterpretationRefresh
} from '../fortuneCache.mjs'
import OpenSourceLinks from '../components/OpenSourceLinks.vue'
import AccountMenu from '../components/AccountMenu.vue'
import BaziBackingPanel from '../components/BaziBackingPanel.vue'
import BaziPillarTable from '../components/BaziPillarTable.vue'
import { BAZI_PROFILE_FULL_SELECT, BAZI_PROFILE_LIST_SELECT } from '../baziProfileFields.mjs'
import {
    buildBaziProfileInsertPayload,
    buildPillarsProfilePayload,
    buildSolarProfilePayload,
    canRetryLegacyBaziProfileInsert,
    ENTRY_MODE,
    GAN,
    findDatesByBazi,
    getAllowedMonthBranchesByStem,
    getAllowedTimeBranchesByStem,
    getSolarLunarSnapshot,
    isMissingBaziProfileSolarTimeColumnError,
    parseCompactSolarInput,
    ZHI
} from '../utils/baziProfileInput.mjs'
import {
    searchBirthplaces
} from '../utils/birthplaceSearch.mjs'
import {
    buildLocalBaziMatrix,
    buildTransitColumn,
    computeXunKong,
    toFullShen,
    ZHI_HIDE,
    getDayunByYear,
    getPromptDataFromProfile
} from '../utils/baziLocalMatrix.mjs'
import { getShenShaArray, getShenshaInfo, sortedShensha } from '../utils/baziShensha.mjs'
import { resolveBaziInterpretation } from '../utils/baziInterpretation.mjs'
import { buildCalibrationPrompt, hasValidCalibration } from '../utils/buildCalibrationPrompt.mjs'
import {
    buildLiuRiList,
    findTransitSelectionByDate
} from '../utils/baziTransit.mjs'

const router = useRouter()
const route = useRoute()
const getFortuneStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

// 与后端 lib/baziCore.js 的 BAZI_ENGINE_VERSION 保持同步
// 升级时同步修改两处，前端会自动检测版本旧档案并触发引擎刷新
const BAZI_ENGINE_VERSION = '1.8.19'

// 兼容 Cloudflare Pages preview 域名，相对路径在 Pages 上会 404
const _apiBase = (() => {
    const configured = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
    if (configured) return configured
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.qimen-1ff.pages.dev')) {
        return 'https://qimen-preview.oceanjustinlin.workers.dev'
    }
    return ''
})()
const apiPath = (path) => `${_apiBase}${path}`

// 核心字典
const WX_MAP = {'甲':'wx-mu','乙':'wx-mu','寅':'wx-mu','卯':'wx-mu','丙':'wx-huo','丁':'wx-huo','巳':'wx-huo','午':'wx-huo','戊':'wx-tu','己':'wx-tu','辰':'wx-tu','戌':'wx-tu','丑':'wx-tu','未':'wx-tu','庚':'wx-jin','辛':'wx-jin','申':'wx-jin','酉':'wx-jin','壬':'wx-shui','癸':'wx-shui','亥':'wx-shui','子':'wx-shui'}
const GAN_WUXING = { '甲':'甲木', '乙':'乙木', '丙':'丙火', '丁':'丁火', '戊':'戊土', '己':'己土', '庚':'庚金', '辛':'辛金', '壬':'壬水', '癸':'癸水' }

const GEJU_DESCRIPTIONS = {
    '正财格': '为人踏实守信，重现实轻虚浮，最利于实业与财务运作，宜稳扎稳打。',
    '偏财格': '性格慷慨豪爽，有敏锐的商业嗅觉和投资眼光，一生多有机遇，适合经商理财。',
    '正官格': '光明磊落，重信守诺，具备良好的管理能力与责任心，利于公职或大企业发展。',
    '七杀格': '果断坚毅，具备开创性与领导力，面对困难敢于迎难而上，宜在动荡或竞争中求胜。',
    '正印格': '仁慈宽厚，注重内涵与学识，一生多得长辈贵人相助，适宜从事文教、科研等行业。',
    '偏印格': '领悟力极强，心思细腻，对偏门学问（如宗教、玄学、艺术）有独特见解，性格较为内向孤高。',
    '食神格': '温文尔雅，懂得享受生活，有艺术才华与语言表达能力，一生衣禄丰厚。',
    '伤官格': '才华横溢，思维敏捷，好胜心强，不喜受约束，适合从事技术、演艺、创意类工作。',
    '建禄格': '独立自主，有骨气，早年多依靠自己打拼，为人讲义气。',
    '羊刃格': '个性刚强，不轻易妥协，爆发力极强，若有官杀制衡可成大业。',
    '月刃格': '同羊刃格，性格刚烈，执行力强。'
};

const getGejuDesc = (geju) => {
    return GEJU_DESCRIPTIONS[geju] || '';
};

const GEJU_BASIS_LABELS = {
    '羊刃特判': '羊刃特判',
    '建禄特判': '建禄特判',
    '月支本气': '月支本气',
    '月支合化': '月支合化',
    '月令透干': '月令透干',
    '月令本气': '月令本气',
    '特判': '特判',
    'SPECIAL_FORCE': '特殊气势优先',
    'YANGREN_SPECIAL': '羊刃特判',
    'JIANLU_SPECIAL': '建禄特判',
    'MONTH_COMBINATION_TRANSFORMED': '月支合化',
    'MONTH_COMBINATION_TIED': '合而未化',
    'MONTH_HIDDEN_STEM_REVEALED': '月令透干',
    'MONTH_MAIN_QI': '月令本气'
}

const PATTERN_STATUS_LABELS = {
    FORMED: '成格',
    BROKEN: '败格',
    PARTIAL: '半成',
    PENDING: '待定',
    DRY_COLD_IMBALANCED: '偏枯'
}

const PATTERN_GOD_TYPE_LABELS = {
    GOOD_GOD: '善神',
    EVIL_GOD: '恶神',
    NEUTRAL: '中性'
}

const PATTERN_STRATEGY_LABELS = {
    SHUN_YONG: '顺用',
    NI_YONG: '逆用'
}

const TIAOHOU_STATUS_LABELS = {
    NOT_NEEDED: '调候普通',
    NEEDED_RESOLVED: '调候已纳入',
    NEEDED_UNRESOLVED: '调候未解',
    OVERRIDES_PATTERN: '调候优先'
}

const getScoreColor = (score) => {
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
};

const formatScore = (score) => {
    if (score > 0) return '+' + score + ' 分';
    return score + ' 分';
};

const formatStrengthPanelScore = (score) => {
    if (score === null || score === undefined || Number.isNaN(Number(score))) return ''
    const num = Number(score)
    return Number.isInteger(num) ? `${num} 分` : `${num.toFixed(1).replace(/\.0$/, '')} 分`
}

const getWuxingClass = (wx) => {
    const map = { '金': 'gold', '木': 'wood', '水': 'water', '火': 'fire', '土': 'earth' };
    return map[wx] || 'gold';
};

// 状态定义
const currentUser = ref(null)
const baziProfiles = ref([])
const profileDetailCache = ref({})   // id → full bazi_detail data
const isLoadingProfileDetail = ref(false)
const selectedProfileId = ref('')
const currentTab = ref('basic')
const showAdd = ref(false)
const showRename = ref(false)
const isProfileMenuOpen = ref(false)
const swipedProfileId = ref(null)
let _swipeTouchStartX = 0
const handleItemTouchStart = (e) => { _swipeTouchStartX = e.touches[0].clientX }
const handleItemTouchEnd = (profileId, e) => {
    const dx = e.changedTouches[0].clientX - _swipeTouchStartX
    if (dx < -50) swipedProfileId.value = swipedProfileId.value === profileId ? null : profileId
    else if (dx > 20) swipedProfileId.value = null
}
const renameProfileById = (id) => {
    selectedProfileId.value = id
    setSelectedBaziProfileId(id)
    swipedProfileId.value = null
    isProfileMenuOpen.value = false
    // small tick so activeProfile computed re-evaluates
    setTimeout(() => openRenameProfile(), 50)
}
const deleteProfileById = async (id) => {
    swipedProfileId.value = null
    await deleteProfile(id)
}
const showGuestLoginGuide = ref(false)
const isAnalyzing = ref(false)
const isSavingProfileContext = ref(false)
const isSavingMonthlyContext = ref(false)
// ── 断事笔记 ──────────────────────────────────────────
const isFormOpen = ref(false)
const isCalibrating = ref(false)

const LIFE_EVENT_CATEGORIES = [
    { value: 'career', label: '事业/学业', icon: '事' },
    { value: 'wealth', label: '财富/资产', icon: '财' },
    { value: 'relationship', label: '感情/婚姻', icon: '情' },
    { value: 'health', label: '健康/灾厄', icon: '健' },
    { value: 'family_parent', label: '父母', icon: '亲' },
    { value: 'family_spouse', label: '配偶', icon: '婚' },
    { value: 'family_child', label: '子女', icon: '嗣' },
    { value: 'family_sibling', label: '兄弟姐妹', icon: '弟' },
]

const IMPACT_OPTIONS = [
    { value: 1, label: '顺遂/提升', cls: 'positive' },
    { value: 0, label: '平稳/变动', cls: 'neutral' },
    { value: -1, label: '坎坷/挫折', cls: 'negative' },
]

const PROFILE_CONTEXT_SECTIONS = [
    {
        key: 'career',
        title: '事业基调',
        storeKey: 'career_profile',
        fields: [
            { key: 'current_status', label: '当前状态', type: 'select', options: ['在职稳定', '在职观望', '找工作', '待业', '自由职业', '创业', '学生'] },
            { key: 'industry', label: '行业方向', type: 'text', maxlength: 30, placeholder: '例如：互联网产品 / 教育 / 金融' },
            { key: 'level', label: '职位层级', type: 'select', options: ['执行', '骨干', '管理', '创始人', '学生', '其他'] },
            { key: 'years', label: '工作年限', type: 'select', options: ['0-1', '1-3', '3-5', '5-10', '10+'] },
            { key: 'goal', label: '长期诉求', type: 'select', options: ['求职', '晋升', '转岗', '转行', '稳住', '创业扩张', '考试上岸'] },
            { key: 'pressure', label: '主要压力', type: 'select', options: ['上级', '同事', 'KPI', '方向不明', '收入', '无明显压力', '其他'] },
            { key: 'note', label: '补充备注', type: 'textarea', maxlength: 80, placeholder: '例如：正在评估是否离开当前团队。' },
        ],
    },
    {
        key: 'wealth',
        title: '财务基调',
        storeKey: 'wealth_profile',
        fields: [
            { key: 'income_structure', label: '收入结构', type: 'select', options: ['固定工资', '提成', '项目制', '副业', '投资', '家庭支持', '多来源'] },
            { key: 'stage', label: '财务阶段', type: 'select', options: ['刚起步', '收支平衡', '有积蓄', '现金流紧', '负债中'] },
            { key: 'style', label: '理财风格', type: 'select', options: ['保守', '稳健', '激进', '随缘'] },
            { key: 'focus', label: '当前关注', type: 'select', options: ['开源', '守财', '还债', '投资', '储蓄', '副业变现'] },
            { key: 'risk', label: '主要风险', type: 'select', options: ['冲动消费', '人情支出', '现金流不稳', '投资波动', '暂无'] },
            { key: 'note', label: '补充备注', type: 'textarea', maxlength: 80, placeholder: '例如：今年重点在清理负债和积累安全垫。' },
        ],
    },
    {
        key: 'love',
        title: '感情基调',
        storeKey: 'love_profile',
        fields: [
            { key: 'current_status', label: '当前关系状态', type: 'select', options: ['单身', '暧昧中', '稳定交往', '已婚', '分开中', '离异', '暂不填写'] },
            { key: 'orientation', label: '性取向（当前仅存档）', type: 'select', options: ['异性', '同性', '双性', '泛性恋', '暂不填写'] },
            { key: 'experience_stage', label: '经历阶段', type: 'select', options: ['母胎', '1-2段', '3段以上', '长期关系为主', '短期关系为主', '暂不填写'] },
            { key: 'goal', label: '感情诉求', type: 'select', options: ['脱单', '稳定关系', '复合', '看清关系', '暂不考虑'] },
            { key: 'pattern', label: '关系模式', type: 'select', options: ['容易上头', '慢热', '容易回避', '容易投入过多', '暂不填写'] },
            { key: 'note', label: '补充备注', type: 'textarea', maxlength: 80, placeholder: '例如：更在意能否长期稳定，而不是短期激情。' },
        ],
    },
    {
        key: 'health',
        title: '健康/生活基调',
        storeKey: 'health_profile',
        fields: [
            { key: 'rhythm', label: '生活节奏', type: 'select', options: ['规律', '熬夜', '高压', '休整', '混乱'] },
            { key: 'body_state', label: '当前状态', type: 'select', options: ['稳定', '容易疲劳', '睡眠问题', '情绪波动', '慢性问题'] },
            { key: 'focus', label: '当前重点', type: 'select', options: ['减压', '休息', '健身', '作息调整', '情绪恢复'] },
            { key: 'drain_source', label: '主要消耗源', type: 'select', options: ['工作', '感情', '家庭', '财务', '学业', '其他'] },
            { key: 'note', label: '补充备注', type: 'textarea', maxlength: 80, placeholder: '例如：最近主要在调整作息和恢复睡眠。' },
        ],
    },
]

const MONTHLY_CONTEXT_SECTIONS = [
    { key: 'career', title: '本月事业', storeKey: 'career_monthly', statusOptions: ['找工作', '面试中', '试用期', '在职想走', '在职稳定', '创业推进', '备考中', '项目攻坚'] },
    { key: 'wealth', title: '本月财务', storeKey: 'wealth_monthly', statusOptions: ['收入平稳', '花销增多', '资金紧', '副业推进', '大额支出月', '投资观察期', '回款等待中'] },
    { key: 'love', title: '本月感情', storeKey: 'love_monthly', statusOptions: ['单身想认识人', '有暧昧对象', '稳定交往', '冷战中', '刚分手', '复合拉扯', '家庭催婚', '暂不关注'] },
    { key: 'health', title: '本月健康/生活', storeKey: 'health_monthly', statusOptions: ['睡眠差', '高压', '情绪恢复期', '作息调整', '出差奔波', '身体稳定', '恢复锻炼'] },
]

const createEmptyProfileContextDraft = () => ({
    career_profile: { current_status: '', industry: '', level: '', years: '', goal: '', pressure: '', note: '' },
    wealth_profile: { income_structure: '', stage: '', style: '', focus: '', risk: '', note: '' },
    love_profile: { current_status: '', orientation: '', experience_stage: '', goal: '', pattern: '', note: '' },
    health_profile: { rhythm: '', body_state: '', focus: '', drain_source: '', note: '' },
})

const createEmptyMonthlyContextDraft = (monthKey = '') => ({
    month_key: monthKey,
    carry_from_previous: false,
    overall_note: '',
    career_monthly: { status: '', summary: '', goal: '', worry: '' },
    wealth_monthly: { status: '', summary: '', goal: '', worry: '' },
    love_monthly: { status: '', summary: '', goal: '', worry: '' },
    health_monthly: { status: '', summary: '', goal: '', worry: '' },
})

const eventForm = reactive({
    year: new Date().getFullYear(),
    month: undefined,
    category: 'career',
    impact: 1,
    description: '',
})
const profileContextDraft = ref(createEmptyProfileContextDraft())
const monthlyContextDraft = ref(createEmptyMonthlyContextDraft())
const profileContextBaseline = ref(createEmptyProfileContextDraft())
const monthlyContextBaseline = ref(createEmptyMonthlyContextDraft())
const recentMonthlyContextRecords = ref([])
const notesMonthKey = ref('')
const eventsContextLoadedKey = ref('')
const showCenteredToast = ref(false)
const toastMessage = ref('')
const toastKind = ref('success')
const activeInfoPanel = ref(null)
const insightTab = ref('strength')
const renameName = ref('')
const analysisNotice = ref('')
const analysisStageIndex = ref(0)
const analysisProgress = ref(8)
const analysisSteps = [
    '校准出生时空',
    '排布四柱格局',
    '核对喜忌用神',
    '联动大运流年',
    '整理天机断语'
]
const ANALYSIS_PROGRESS_FRAMES = [8, 12, 17, 23, 29, 36, 43, 50, 57, 64, 70, 76, 81, 85, 89, 92]
let analysisTimer = null
let analysisFrameIndex = 0
let toastTimer = null
const BAZI_STREAM_SECTION_KEYS = ['yuanju_core', 'current_dayun', 'current_liunian']

const createBaziStreamSections = (status = 'idle') => ({
    yuanju_core: { status, text: '' },
    current_dayun: { status, text: '' },
    current_liunian: { status, text: '' }
})

const llmStreamSections = ref(createBaziStreamSections())

function resetLlmStreamSections(status = 'idle') {
    llmStreamSections.value = createBaziStreamSections(status)
}

function patchLlmStreamSection(section, patch = {}) {
    if (!BAZI_STREAM_SECTION_KEYS.includes(section)) return
    llmStreamSections.value = {
        ...llmStreamSections.value,
        [section]: {
            ...llmStreamSections.value[section],
            ...patch
        }
    }
}

function isBaziSectionStreaming(section) {
    return llmStreamSections.value[section]?.status === 'streaming'
}

function isBaziSectionPending(section) {
    return llmStreamSections.value[section]?.status === 'pending'
}

function isBaziSectionLoading(section) {
    return ['pending', 'streaming'].includes(llmStreamSections.value[section]?.status)
}

function isBaziSectionFailed(section) {
    return llmStreamSections.value[section]?.status === 'failed'
}

function getBaziStreamText(section) {
    return String(llmStreamSections.value[section]?.text || '').trim()
}

function shouldShowBaziSectionSkeleton(section) {
    return isBaziSectionLoading(section) && !getBaziStreamText(section)
}

const isBaziLlmLoading = computed(() => BAZI_STREAM_SECTION_KEYS.some(section => isBaziSectionLoading(section)))

const form = reactive({
    name: '',
    gender: 'M',
    birthCountry: '',
    birthAdmin1: '',
    birthCity: '',
    birthCounty: '',
    birthLocation: '',
    birthLatitude: '',
    birthLongitude: '',
    solarTimeMode: 'clock'
})

const entryMode = ref(ENTRY_MODE.SOLAR)
const solarInput = reactive({
    text: ''
})
const birthplaceQuery = ref('')
const isBirthplaceSearchOpen = ref(false)
const pillarInput = reactive({
    yearPillar: '庚午',
    monthPillar: '戊寅',
    dayPillar: '乙丑',
    timePillar: '丙子'
})
const activePillarSlot = ref('yearGan')
const PILLAR_SLOT_FLOW = ['yearGan', 'yearZhi', 'monthGan', 'monthZhi', 'dayGan', 'dayZhi', 'timeGan', 'timeZhi']

const ganOptions = GAN
const zhiOptions = ZHI
const activeSlotType = computed(() => activePillarSlot.value.endsWith('Gan') ? 'gan' : 'zhi')
const activeSlotLabel = computed(() => ({
    yearGan: '年干',
    monthGan: '月干',
    dayGan: '日干',
    timeGan: '时干',
    yearZhi: '年支',
    monthZhi: '月支',
    dayZhi: '日支',
    timeZhi: '时支'
}[activePillarSlot.value] || '年干'))
const monthBranchOptions = computed(() => getAllowedMonthBranchesByStem(pillarInput.monthPillar.charAt(0)))
const timeBranchOptions = computed(() => getAllowedTimeBranchesByStem(pillarInput.timePillar.charAt(0)))
const activeCandidateOptions = computed(() => {
    if (activeSlotType.value === 'gan') return ganOptions
    if (activePillarSlot.value === 'monthZhi') return monthBranchOptions.value
    if (activePillarSlot.value === 'timeZhi') return timeBranchOptions.value
    return zhiOptions
})
const activeSlotValue = computed(() => {
    switch (activePillarSlot.value) {
        case 'yearGan': return pillarInput.yearPillar.charAt(0)
        case 'monthGan': return pillarInput.monthPillar.charAt(0)
        case 'dayGan': return pillarInput.dayPillar.charAt(0)
        case 'timeGan': return pillarInput.timePillar.charAt(0)
        case 'yearZhi': return pillarInput.yearPillar.charAt(1)
        case 'monthZhi': return pillarInput.monthPillar.charAt(1)
        case 'dayZhi': return pillarInput.dayPillar.charAt(1)
        case 'timeZhi': return pillarInput.timePillar.charAt(1)
        default: return ''
    }
})
const activeSlotHint = computed(() => {
    if (activePillarSlot.value === 'monthZhi') {
        return `已按月干 ${pillarInput.monthPillar.charAt(0)} 限定月支，可选六支：${monthBranchOptions.value.join('、')}`
    }
    if (activePillarSlot.value === 'timeZhi') {
        return `已按时干 ${pillarInput.timePillar.charAt(0)} 限定时支，可选六支：${timeBranchOptions.value.join('、')}`
    }
    if (activePillarSlot.value === 'monthGan') return '先定月干，再进入月支选择。'
    if (activePillarSlot.value === 'timeGan') return '先定时干，再进入时支选择。'
    return ''
})
const pillarPreviewError = computed(() => {
    if (pillarMatches.value.length) return ''
    return '当前四柱暂无匹配日期，请调整后再试。'
})

// 计算属性 (Vue 魔法：数据变化自动更新 UI)
const activeProfile = computed(() => {
    const base = baziProfiles.value.find(p => p.id === selectedProfileId.value) || null
    if (!base) return null
    const detail = profileDetailCache.value[base.id]
    return { ...base, ...(detail || {}) }
})
const currentMonthKey = computed(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})
const notesMonthOptions = computed(() => {
    const options = []
    const base = new Date()
    base.setDate(1)
    for (let offset = 2; offset >= -6; offset -= 1) {
        const cursor = new Date(base)
        cursor.setMonth(base.getMonth() + offset)
        const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
        options.push({
            value,
            label: `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`,
        })
    }
    return options
})
const isGuest = computed(() => globalState.isGuest && !currentUser.value)
const activeProfileName = computed(() => activeProfile.value?.name || (baziProfiles.value.length ? '请选择命主档案' : '暂无命主档案'))

const formatSolarDate = (value) => {
    if (!value) return '未录入阳历'
    const p = String(value).match(/\d+/g)
    if (!p || p.length < 3) return '阳历待确认'
    const time = p.length >= 5 ? ` ${p[3].padStart(2, '0')}:${p[4].padStart(2, '0')}` : ''
    return `${p[0]}.${p[1].padStart(2, '0')}.${p[2].padStart(2, '0')}${time}`
}

const formatProfileOption = (profile) => {
    return `${profile.name}（${formatSolarDate(profile.birth_date)}）`
}

const profileMetaText = (profile) => {
    const parts = [profile.gender === 'M' ? '乾造' : '坤造']
    if (profile.birth_location) parts.push(profile.birth_location)
    if (Number.isFinite(Number(profile.solar_time_adjustment_minutes)) && Number(profile.solar_time_adjustment_minutes) !== 0) {
        const minutes = Number(profile.solar_time_adjustment_minutes)
        parts.push(`太阳时${minutes > 0 ? '+' : ''}${minutes}分`)
    }
    if (profile.is_default) parts.push('默认')
    return parts.join(' · ')
}

const needsUpgrade = computed(() => {
    if (!activeProfile.value) return false
    const detail = activeProfile.value.bazi_detail
    return !detail || !detail.matrix
})

const localMatrix = computed(() => {
    if (!activeProfile.value) return null
    return buildLocalBaziMatrix(activeProfile.value)
})

const resolvedMatrix = computed(() => {
    const base = activeProfile.value?.bazi_detail?.matrix || localMatrix.value || null
    if (!base) return null
    // Re-patch shensha using local BaziEngine so updates take effect without server redeployment
    const pillarsArr = Array.isArray(base.pillars) ? base.pillars : Object.values(base.pillars || {})
    if (!pillarsArr.length) return base
    const isMale = activeProfile.value?.gender === 'M'
    const yearGan = pillarsArr[0]?.gan
    const yearZhi = pillarsArr[0]?.zhi
    const monthZhi = pillarsArr[1]?.zhi
    const dayGan = pillarsArr[2]?.gan
    const dayZhi = pillarsArr[2]?.zhi
    const allGans = pillarsArr.map(p => p.gan)
    const patchColumn = (p) => {
        if (!p || !p.zhi) return p
        const fixedStems = Array.isArray(p.hidden_stems)
            ? p.hidden_stems.map(s => {
                const stemGan = typeof s === 'string' ? s : (s?.gan || '')
                const existing = typeof s === 'object' && s?.shi_shen ? s.shi_shen : ''
                return { gan: stemGan, shi_shen: existing || toFullShen(getShiShen(dayGan, stemGan)) }
            })
            : []
        return {
            ...p,
            hidden_stems: fixedStems,
            kong: p.kong || (p.gan && p.zhi ? computeXunKong(p.gan, p.zhi) : '-'),
            shensha: getShenShaArray(p.zhi, dayGan, yearZhi, dayZhi, {
                monthZhi, pillarGan: p.gan, yearGan, isMale, allGans
            })
        }
    }
    return {
        ...base,
        pillars: pillarsArr.map(patchColumn),
        current_dayun: patchColumn(base.current_dayun),
        current_liunian: patchColumn(base.current_liunian)
    }
})

const displayColumns = computed(() => {
    const matrix = resolvedMatrix.value
    if (!matrix) return []
    if (currentTab.value === 'basic') return matrix.pillars || []

    const pillars = matrix.pillars || []
    const dayGan = pillars[2]?.gan || ''
    const yearZhi = pillars[0]?.zhi || ''
    const dayZhi = pillars[2]?.zhi || ''
    const monthZhi = pillars[1]?.zhi || ''
    const yearGan = pillars[0]?.gan || ''
    const isMale = activeProfile.value?.gender === 'M'
    const allGans = pillars.map(p => p.gan)

    const buildTransit = (name, ganZhiStr) => {
        if (!ganZhiStr || !dayGan) return null
        const col = buildTransitColumn(name, ganZhiStr, dayGan)
        if (!col) return null
        return {
            ...col,
            shensha: getShenShaArray(col.zhi, dayGan, yearZhi, dayZhi, {
                monthZhi, pillarGan: col.gan, yearGan, isMale, allGans
            })
        }
    }

    const year = selectedLiunianYear.value
    let activeLiunian = null
    let activeDayun = null

    if (Number.isFinite(year)) {
        let ln = (matrix.liunian_list || []).find(l => Number(l.year) === year)
        if (!ln) {
            for (const d of (matrix.dayun_list || [])) {
                ln = (d.liunian_list || []).find(l => Number(l.year) === year)
                if (ln) break
            }
        }
        if (ln?.gan && ln?.zhi) activeLiunian = buildTransit('流年', ln.gan + ln.zhi)

        const dy = (matrix.dayun_list || []).filter(d => !d.isXiaoyun).find(d => {
            const start = Number(d.start_year)
            const end = Number(d.end_year) || (Number.isFinite(start) ? start + 9 : null)
            return Number.isFinite(start) && Number.isFinite(end) && year >= start && year <= end
        })
        if (dy?.gan && dy?.zhi) activeDayun = buildTransit('大运', dy.gan + dy.zhi)
    }

    if (!activeLiunian && matrix.current_liunian?.gan && matrix.current_liunian?.zhi) {
        activeLiunian = buildTransit('流年', matrix.current_liunian.gan + matrix.current_liunian.zhi)
    }
    if (!activeDayun && matrix.current_dayun?.gan && matrix.current_dayun?.zhi) {
        activeDayun = buildTransit('大运', matrix.current_dayun.gan + matrix.current_dayun.zhi)
    }

    const cols = []
    if (activeLiunian) cols.push(activeLiunian)
    if (activeDayun) cols.push(activeDayun)
    cols.push(...pillars)
    return cols
})

const dayunList = computed(() => {
    return resolvedMatrix.value?.dayun_list || []
})

const ZHI_MAIN_GAN = {
    '子': '癸', '丑': '己', '寅': '甲', '卯': '乙', '辰': '戊', '巳': '丙',
    '午': '丁', '未': '己', '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬'
};

const PILLAR_NAMES = { 'year': '年柱', 'month': '月柱', 'day': '日柱', 'time': '时柱', 'dayun': '大运', 'liunian': '流年' };

const interactions = computed(() => {
    return activeProfile.value?.bazi_detail?.interactions || null;
});

// ── 动态生克合化计算工具 ─────────────────────────────────────────
const _GAN_WX = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' }
const _WX_KE  = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' }
const _GAN_HE = [
    { set: new Set(['甲','己']), label: '合化土' },
    { set: new Set(['乙','庚']), label: '合化金' },
    { set: new Set(['丙','辛']), label: '合化水' },
    { set: new Set(['丁','壬']), label: '合化木' },
    { set: new Set(['戊','癸']), label: '合化火' },
]
const _ZHI_LIU_HE = [['子','丑'],['寅','亥'],['卯','戌'],['辰','酉'],['巳','申'],['午','未']]
const _ZHI_CHONG  = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']]
const _ZHI_SAN_HE = [
    { members: new Set(['寅','午','戌']), label: '三合火局' },
    { members: new Set(['申','子','辰']), label: '三合水局' },
    { members: new Set(['巳','酉','丑']), label: '三合金局' },
    { members: new Set(['亥','卯','未']), label: '三合木局' },
]
const _ZHI_XING = [['寅','巳'],['巳','申'],['申','寅'],['丑','戌'],['戌','未'],['未','丑'],['子','卯'],['卯','子']]
const _ZHI_PO   = [['子','酉'],['午','卯'],['寅','亥'],['巳','申'],['辰','丑'],['戌','未']]
const _ZHI_HAI  = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']]

function _ganInteractions(setA, setB) {
    const results = []
    const seen = new Set()
    for (const a of setA) {
        for (const b of setB) {
            if (!a || !b) continue
            const key = [a,b].sort().join('')
            if (seen.has(key)) continue
            seen.add(key)
            const he = _GAN_HE.find(h => h.set.has(a) && h.set.has(b))
            if (he) { results.push(`${a}${b}${he.label}`); continue }
            if (_WX_KE[_GAN_WX[a]] === _GAN_WX[b]) results.push(`${a}${b}相克`)
            else if (_WX_KE[_GAN_WX[b]] === _GAN_WX[a]) results.push(`${b}${a}相克`)
        }
    }
    return results
}

function _zhiInteractions(setA, setB) {
    const results = []
    const seen = new Set()
    for (const a of setA) {
        for (const b of setB) {
            if (!a || !b) continue
            const key = [a,b].sort().join('')
            if (seen.has(key)) continue
            seen.add(key)
            if (_ZHI_LIU_HE.some(p => p.includes(a) && p.includes(b)))  { results.push(`${a}${b}六合`);   continue }
            if (_ZHI_CHONG.some(p => p.includes(a) && p.includes(b)))    { results.push(`${a}${b}相冲`);   continue }
            const sh = _ZHI_SAN_HE.find(g => g.members.has(a) && g.members.has(b))
            if (sh) { results.push(`${a}${b}半${sh.label}`); continue }
            if (_ZHI_XING.some(p => p[0]===a && p[1]===b))  { results.push(`${a}${b}相刑`); continue }
            if (_ZHI_PO.some(p => p.includes(a) && p.includes(b)))       { results.push(`${a}${b}相破`);   continue }
            if (_ZHI_HAI.some(p => p.includes(a) && p.includes(b)))      { results.push(`${a}${b}相害`);   continue }
        }
    }
    return results
}

// 当前选中大运 & 流年数据
const selectedTransitData = computed(() => {
    const matrix = resolvedMatrix.value
    if (!matrix) return { dayunGan: '', dayunZhi: '', liunianGan: '', liunianZhi: '' }
    const yr = selectedLiunianYear.value
    // 找大运
    const dy = (matrix.dayun_list || []).filter(d => !d.isXiaoyun).find(d => {
        const start = Number(d.start_year)
        const end = Number(d.end_year) || (Number.isFinite(start) ? start + 9 : null)
        return Number.isFinite(start) && Number.isFinite(end) && yr >= start && yr <= end
    })
    // 找流年
    let ln = (matrix.liunian_list || []).find(l => Number(l.year) === yr)
    if (!ln) {
        for (const d of (matrix.dayun_list || [])) {
            ln = (d.liunian_list || []).find(l => Number(l.year) === yr)
            if (ln) break
        }
    }
    return {
        dayunGan:   dy?.gan   || '',
        dayunZhi:   dy?.zhi   || '',
        liunianGan: ln?.gan   || '',
        liunianZhi: ln?.zhi   || '',
    }
})

const intGroups = computed(() => {
    const matrix = resolvedMatrix.value
    const nativeGans = (matrix?.pillars || []).map(p => p?.gan).filter(Boolean)
    const nativeZhis = (matrix?.pillars || []).map(p => p?.zhi).filter(Boolean)
    const { dayunGan, dayunZhi, liunianGan, liunianZhi } = selectedTransitData.value
    const transitGans = [dayunGan, liunianGan].filter(Boolean)
    const transitZhis = [dayunZhi, liunianZhi].filter(Boolean)

    // 本命：只用静态数据（native↔native 永不变）
    const staticInter = interactions.value
    const isYuanju = (item) => item.pillars.every(p => ['year', 'month', 'day', 'time'].includes(p))
    const ganYuanju = staticInter ? staticInter.gans.filter(isYuanju).map(i => i.name).join('；') : ''
    const zhiYuanju = staticInter ? staticInter.zhis.filter(isYuanju).map(i => i.name).join('；') : ''

    // 运势：动态计算 transit↔native
    const ganYun = transitGans.length && nativeGans.length
        ? _ganInteractions(transitGans, nativeGans).join('；')
        : ''
    const zhiYun = transitZhis.length && nativeZhis.length
        ? _zhiInteractions(transitZhis, nativeZhis).join('；')
        : ''

    return { ganYuanju, zhiYuanju, ganYun, zhiYun }
});

// 联动计算逻辑
const baziEngine = computed(() => {
    if (!activeProfile.value) return null;
    const pd = promptDataObj.value;
    if (!pd || !pd.birthStr) return null;
    const p = pd.birthStr.match(/\d+/g);
    if (!p || p.length < 3) return null;
    const s = Solar.fromYmdHms(parseInt(p[0]), parseInt(p[1]), parseInt(p[2]), parseInt(p[3]||12), parseInt(p[4]||0), 0);
    const baZi = s.getLunar().getEightChar();
    const gender = activeProfile.value.gender === 'M' ? 1 : 0;
    const yun = baZi.getYun(gender);
    return { baZi, yun, dayGan: baZi.getDayGan() };
});

const selectedDayunIdx = ref(0);
const baziBackingRef = ref(null);
const selectedLiunianYear = ref(new Date().getFullYear());
const selectedLiuyueIndex = ref(0);
const selectedLiuriDateKey = ref('');

const baziTimelineResultData = computed(() => ({
    meta: { analysis_mode: 'status' },
    mode_analysis: {
        trigger_windows: [],
        current_climate: '当前岁运'
    }
}))

const syncTransitSelection = (targetDate = new Date()) => {
    if (!baziEngine.value) return
    const selection = findTransitSelectionByDate(baziEngine.value, targetDate)
    if (!selection) return
    selectedDayunIdx.value = selection.dayunIndex
    selectedLiunianYear.value = selection.liunianYear
    selectedLiuyueIndex.value = selection.liuyueIndex
    selectedLiuriDateKey.value = selection.liuriDateKey
}

const scrollActiveTransitItemsIntoView = async () => {
    await nextTick()
    baziBackingRef.value?.centerActiveItems()
}

const jumpToCurrentTransit = async () => {
    syncTransitSelection(new Date())
    await scrollActiveTransitItemsIntoView()
}

watch(baziEngine, async (newVal) => {
    if (newVal) {
        syncTransitSelection(new Date());
        await scrollActiveTransitItemsIntoView()
    }
}, { immediate: true });


watch(
    () => activeProfile.value?.id,
    async () => {
        if (!activeProfile.value || isGuest.value) {
            profileContextDraft.value = createEmptyProfileContextDraft()
            monthlyContextDraft.value = createEmptyMonthlyContextDraft(notesMonthKey.value || currentMonthKey.value)
            recentMonthlyContextRecords.value = []
            eventsContextLoadedKey.value = ''
            return
        }
        const profileId = activeProfile.value.id
        await loadProfileDetail(profileId)
        if (profileId !== activeProfile.value?.id) return
        eventsContextLoadedKey.value = ''
        if (currentTab.value === 'events') await ensureEventsContextLoaded()

        // 引擎版本检查：若档案的 bazi_detail.engine_version 不是最新，
        // 静默触发引擎刷新（force=false 保留 LLM，只更新运算数据）
        const profileEngineVersion = activeProfile.value?.bazi_detail?.engine_version
        const hasLlm = Boolean(
            activeProfile.value?.llm_yuanju_core &&
            activeProfile.value?.llm_current_dayun &&
            activeProfile.value?.llm_current_liunian
        )
        const hasBaziStr = Boolean(activeProfile.value?.bazi_str)
        const hasDetail = Boolean(activeProfile.value?.bazi_detail?.matrix)
        if (hasBaziStr && !hasDetail && !isAnalyzing.value) {
            // 首次添加档案：尚无排盘/断语，自动生成（无需手动点击同步）
            console.log('[bazi] 新档案尚无排盘，自动生成…')
            requestAiSummary({ force: false })
        } else if (hasBaziStr && hasLlm && (!profileEngineVersion || profileEngineVersion !== BAZI_ENGINE_VERSION || (hasDetail && !activeProfile.value?.bazi_detail?.image_analysis))) {
            console.log(`[bazi] 检测到引擎版本旧或 image_analysis 缺失 (${profileEngineVersion} → ${BAZI_ENGINE_VERSION})，自动刷新运算数据…`)
            requestAiSummary({ force: false })
        }
    },
    { immediate: true }
)

watch(
    () => globalState.selectedBaziProfileId,
    (profileId) => {
        if (!profileId || profileId === selectedProfileId.value) return
        if (!baziProfiles.value.some(profile => profile.id === profileId)) return
        selectedProfileId.value = profileId
        handleProfileSelect()
    }
)

watch(notesMonthKey, async (next) => {
    if (!next) return
    monthlyContextDraft.value = createEmptyMonthlyContextDraft(next)
    eventsContextLoadedKey.value = ''
    if (activeProfile.value && !isGuest.value && currentTab.value === 'events') {
        await ensureEventsContextLoaded()
    }
})

watch(
    () => route.query.tab,
    () => {
        syncBaziRouteState()
    }
)

watch(
    () => pillarInput.monthPillar.charAt(0),
    () => {
        const allowed = monthBranchOptions.value
        if (!allowed.includes(pillarInput.monthPillar.charAt(1))) {
            pillarInput.monthPillar = `${pillarInput.monthPillar.charAt(0)}${allowed[0]}`
        }
    },
    { immediate: true }
)

watch(
    () => pillarInput.timePillar.charAt(0),
    () => {
        const allowed = timeBranchOptions.value
        if (!allowed.includes(pillarInput.timePillar.charAt(1))) {
            pillarInput.timePillar = `${pillarInput.timePillar.charAt(0)}${allowed[0]}`
        }
    },
    { immediate: true }
)

const selectDayun = (idx) => {
    selectedDayunIdx.value = idx;
    const dy = fullDayunList.value[idx]?.originalDy;
    if (dy) {
        // 默认选中该大运的第一年
        selectedLiunianYear.value = dy.getStartYear();
        selectedLiuyueIndex.value = 0;
    }
};

const selectLiunian = (year) => {
    selectedLiunianYear.value = year
    selectedLiuyueIndex.value = 0
}

const fullDayunList = computed(() => {
    if (!baziEngine.value) return [];
    const { yun, dayGan } = baziEngine.value;
    const list = [];
    yun.getDaYun().forEach((dy, idx) => {
        const ganZhi = dy.getGanZhi();
        const gan = ganZhi ? ganZhi.charAt(0) : '';
        const zhi = ganZhi ? ganZhi.charAt(1) : '';
        list.push({
            id: idx,
            start_year: dy.getStartYear(),
            start_age: dy.getStartAge(),
            gan: gan,
            zhi: zhi,
            shi_shen: gan ? getShiShen(dayGan, gan) : '小运',
            zhi_shi_shen: zhi ? getShiShen(dayGan, ZHI_MAIN_GAN[zhi]) : '',
            isXiaoyun: idx === 0 && !gan,
            originalDy: dy
        });
    });
    return list;
});

const linkedLiunianList = computed(() => {
    if (!baziEngine.value || fullDayunList.value.length === 0) return [];
    const idx = selectedDayunIdx.value;
    const targetDy = fullDayunList.value[idx]?.originalDy;
    if (!targetDy) return [];
    
    return targetDy.getLiuNian().map(ln => {
        const ganZhi = ln.getGanZhi();
        const gan = ganZhi.charAt(0);
        return {
            year: ln.getYear(),
            age: ln.getAge(),
            gan: gan,
            zhi: ganZhi.charAt(1),
            shi_shen: getShiShen(baziEngine.value.dayGan, gan),
            zhi_shi_shen: getShiShen(baziEngine.value.dayGan, ZHI_MAIN_GAN[ganZhi.charAt(1)]),
            originalLn: ln
        };
    });
});

const linkedLiuyueList = computed(() => {
    if (!baziEngine.value || linkedLiunianList.value.length === 0) return [];
    const lnYear = selectedLiunianYear.value;
    const targetLn = linkedLiunianList.value.find(ln => ln.year === lnYear)?.originalLn;
    if (!targetLn) return [];
    
    return targetLn.getLiuYue().map((ly, index) => {
        const ganZhi = ly.getGanZhi();
        const gan = ganZhi.charAt(0);
        return {
            index,
            monthName: ly.getMonthInChinese() + '月',
            gan: gan,
            zhi: ganZhi.charAt(1),
            shi_shen: getShiShen(baziEngine.value.dayGan, gan),
            zhi_shi_shen: getShiShen(baziEngine.value.dayGan, ZHI_MAIN_GAN[ganZhi.charAt(1)])
        };
    });
});

const linkedLiuriList = computed(() => {
    if (!baziEngine.value || linkedLiunianList.value.length === 0) return []
    const targetLn = linkedLiunianList.value.find(ln => ln.year === selectedLiunianYear.value)?.originalLn
    if (!targetLn) return []
    return buildLiuRiList(targetLn, selectedLiuyueIndex.value, baziEngine.value.dayGan)
})

const activeLiuri = computed(() => {
    return linkedLiuriList.value.find(item => item.dateKey === selectedLiuriDateKey.value) || linkedLiuriList.value[0] || null
})

const todayDateKey = computed(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
})

const previewFortuneCache = computed(() => {
    if (!activeLiuri.value || !currentUser.value?.id) return null
    return loadSharedCachedFortune(
        getFortuneStorage(),
        currentUser.value.id,
        activeLiuri.value.dateKey,
        new Date(),
        activeProfile.value?.id || ''
    )
})

const isFarFutureLiuri = computed(() => {
    if (!activeLiuri.value) return false
    const diffMs = new Date(`${activeLiuri.value.dateKey}T12:00:00+08:00`).getTime() - new Date(`${todayDateKey.value}T12:00:00+08:00`).getTime()
    return diffMs > 6 * 24 * 60 * 60 * 1000
})

const liuriInsightTitle = computed(() => {
    if (!activeLiuri.value) return '当日断语'
    return `当日断语 · ${activeLiuri.value.dateKey}`
})

const liuriInsightText = computed(() => {
    if (previewFortuneCache.value?.day_insight) return previewFortuneCache.value.day_insight
    if (isFarFutureLiuri.value) return '天机尚覆轻纱，远日之象只露一线端倪。待时辰临近，再观其全貌。'
    return '此日断语暂未显化，点入运势页后可查看完整日运推演。'
})

const liuriInsightMasked = computed(() => {
    return !previewFortuneCache.value?.day_insight && isFarFutureLiuri.value
})

watch(linkedLiuyueList, (list) => {
    if (!list.length) {
        selectedLiuyueIndex.value = 0
        return
    }
    if (!list.some(item => item.index === selectedLiuyueIndex.value)) {
        selectedLiuyueIndex.value = list[0].index
    }
}, { immediate: true })

watch(linkedLiuriList, (list) => {
    if (!list.length) {
        selectedLiuriDateKey.value = ''
        return
    }
    if (!list.some(item => item.dateKey === selectedLiuriDateKey.value)) {
        selectedLiuriDateKey.value = list[0].dateKey
    }
}, { immediate: true })

const openFortuneGuide = () => {
    if (!activeLiuri.value) return
    router.push({
        name: 'fortune',
        query: {
            date: activeLiuri.value.dateKey,
            profileId: activeProfile.value?.id || ''
        }
    })
}

const specialPatterns = computed(() => {
    if (!activeProfile.value || !activeProfile.value.bazi_detail?.base_info?.special_patterns) return []
    return activeProfile.value.bazi_detail.base_info.special_patterns
})

const classicVerdict = computed(() => {
    return activeProfile.value?.bazi_detail?.classic_verdict || {}
})

const classicVerdictText = computed(() => {
    return classicVerdict.value?.text || ''
})

const classicVerdictLines = computed(() => {
    return classicVerdictText.value.split('\n').map(line => line.trim()).filter(Boolean)
})

const strengthPanelContent = computed(() => {
    if (!activeProfile.value) return null
    const detail = activeProfile.value.strength_detail || activeProfile.value.bazi_detail?.strength_detail || null
    const rawBasis = activeProfile.value.strength_basis || activeProfile.value.bazi_detail?.strength_basis || ''
    const meter = detail?.meter
        ? {
            verdict: detail.meter.verdict || detail.verdict || activeProfile.value.strong_weak || '未定',
            label: detail.meter.label || detail.band || '',
            percent: Math.max(0, Math.min(100, ((Number(detail.meter.value) || 0) / (Number(detail.meter.max) || 10)) * 100)),
        }
        : null

    if (detail?.user_sections?.length) {
        return {
            meter,
            sections: detail.user_sections.map(section => ({
                key: section.key,
                title: section.title,
                text: section.text,
                scoreLabel: '',
            })),
        }
    }

    if (detail?.sections?.length) {
        return {
            meter,
            sections: detail.sections.map(section => ({
                key: section.key,
                title: section.title,
                text: section.text,
                scoreLabel: formatStrengthPanelScore(section.score),
            })),
        }
    }

    if (!rawBasis) return null

    return {
        meter,
        sections: rawBasis
            .split(/(?<=[。；])/)
            .map(part => part.trim())
            .filter(Boolean)
            .map((text, index) => ({
                key: `fallback-${index}`,
                title: `依据 ${index + 1}`,
                text,
                scoreLabel: '',
            })),
    }
})

const openStrengthPanel = () => {
    openInsightPanel('strength')
}

const patternFinalName = computed(() => {
    const pattern = activeProfile.value?.bazi_detail?.pattern_analysis
    return pattern?.extraction?.final_pattern?.name || activeProfile.value?.geju || '格局'
})

const normalizeTraitItems = (value, fallback = []) => {
    if (Array.isArray(value) && value.length) return value
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    return Array.isArray(fallback) ? fallback : []
}

const IMAGE_DIMENSION_LABELS = {
    target_qi_score: '目标气势',
    target_qi_ratio: '目标占比',
    dominance_points: '主导气势',
    rootlessness_points: '日主无根',
    month_command_points: '月令助力',
    exposed_target_points: '透干助力',
    visible_support_penalty: '扶身干扰',
    same_camp_dominance_points: '同党气势',
    purity_points: '气势纯度',
    counter_qi_ratio: '制衡占比',
    counter_qi_exposed_count: '制衡透干',
    counter_qi_branch_count: '制衡根气',
    powerful_counter_penalty: '强力制衡',
    wealth_qi_ratio: '财气占比',
    wealth_drain_penalty: '财星泄气',
    mixed_qi_ratio: '杂气占比',
    mixed_qi_penalty: '杂气干扰',
    adjacent_stem_combine_points: '相邻天干合',
    branch_support_count: '地支助化',
    branch_support_points: '地支助化分',
    no_jealous_combine_points: '无争合',
    competing_partner_count: '争合数量',
    competing_day_stem_count: '日干争合',
    original_qi_root_count: '原气根数',
    original_qi_primary_root_count: '原气主根',
    original_qi_root_score: '原气根分',
    original_qi_weak_points: '原气弱化',
    transform_qi_ratio: '化气占比',
    transform_qi_counter_ratio: '化气受制',
    transform_qi_intact_points: '化气完整',
    transform_qi_damage_penalty: '化气受损',
    two_qi_combined_ratio: '两气合计',
    two_qi_combined_points: '两气集中',
    two_qi_ratio_difference: '两气差值',
    two_qi_balance_points: '两气均衡',
    low_mixed_qi_points: '少杂气',
    mixed_force_points: '从势基础',
    mixed_force_combined_ratio: '从势占比',
    mixed_force_combined_points: '从势集中',
    no_visible_support_points: '无明扶',
}

const IMAGE_PENALTY_LABELS = {
    DM_HAS_SUPPORT: '日主仍有扶助',
    POWERFUL_COUNTER_QI: '制衡气势偏强',
    WEALTH_DRAINS_DOMINANT_QI: '财星泄耗主势',
    MIXED_QI_BREAKS_SINGLE_IMAGE: '杂气破坏专旺',
    JEALOUS_COMBINE_CAP_79: '争合使成象分封顶',
    DM_HAS_STRONG_ROOT_CAP_79: '日主强根使成象分封顶',
    TRANSFORM_QI_DAMAGED: '化气受到损伤',
}

const normalizeImageDimensions = (value) => {
    if (Array.isArray(value)) {
        return value.map((item, index) => {
            if (!item || typeof item !== 'object') {
                return { key: `dimension-${index}`, text: String(item ?? ''), score: '', max: '' }
            }
            return {
                key: item.key || `dimension-${index}`,
                text: item.text || IMAGE_DIMENSION_LABELS[item.key] || item.key || `指标 ${index + 1}`,
                score: item.score ?? '',
                max: item.max ?? '',
            }
        })
    }
    if (!value || typeof value !== 'object') return []
    return Object.entries(value).map(([key, score]) => ({
        key,
        text: IMAGE_DIMENSION_LABELS[key] || key,
        score,
        max: '',
    }))
}

const normalizeImagePenalties = (value) => {
    if (!Array.isArray(value)) return []
    return value.map((item, index) => {
        if (!item || typeof item !== 'object') {
            const key = String(item ?? `penalty-${index}`)
            return { key, text: IMAGE_PENALTY_LABELS[key] || key, score: '' }
        }
        return {
            key: item.key || `penalty-${index}`,
            text: item.text || IMAGE_PENALTY_LABELS[item.key] || item.key || `扣分项 ${index + 1}`,
            score: item.score ?? '',
        }
    })
}

const formatImageMetric = (score, max = '') => {
    const scoreText = typeof score === 'boolean' ? (score ? '是' : '否') : String(score ?? '')
    if (max === '' || max == null) return scoreText
    return `${Number(score) > 0 ? '+' : ''}${scoreText}/${max}`
}

const gejuPanelContent = computed(() => {
    const profile = activeProfile.value
    if (!profile?.bazi_detail) return null
    const detail = profile.bazi_detail
    const pattern = detail.pattern_analysis || null
    const extraction = pattern?.extraction || null
    const evaluation = pattern?.evaluation || null
    const gejuDetail = detail.geju_detail || {}
    const chenggeDetail = detail.chengge_detail || {}
    const info = detail.geju_info || {}
    const mergeInfo = gejuDetail.monthMergeInfo || null
    const finalPattern = extraction?.final_pattern || null
    const finalPatternName = finalPattern?.name || profile.geju || gejuDetail.geju || '未定格'
    const imageAnalysis = detail.image_analysis || null
    const primaryCandidate = imageAnalysis?.primary_candidate || null
    const showImageCandidate = !!primaryCandidate && Number(primaryCandidate.match_score) >= 60
    const imageCandidate = showImageCandidate
        ? {
            ...primaryCandidate,
            subtype: primaryCandidate.subtype || '特殊形象',
            dimensions: normalizeImageDimensions(primaryCandidate.dimensions),
            penalties: normalizeImagePenalties(primaryCandidate.penalties),
            decision: buildImageDecision(primaryCandidate),
        }
        : null
    const basePattern = extraction?.base_pattern || profile.geju || gejuDetail.geju || '未定格'
    const chengGeResult = evaluation?.overall_status || chenggeDetail.chengGeResult || '待定'
    const chengGeStatus = PATTERN_STATUS_LABELS[chengGeResult] || (chengGeResult === '待定' ? '未成格' : chengGeResult)
    const showChengGe = !!chenggeDetail.chengGe && chenggeDetail.chengGe !== finalPatternName && chengGeResult !== 'PENDING' && chengGeResult !== '待定'
    const yongShenTenGod = chenggeDetail.yongShenTenGod || info.yongShenTypical || ''
    const yongShenStem = chenggeDetail.yongShen || ''
    const yongShen = yongShenStem && yongShenTenGod ? `${yongShenTenGod}（${yongShenStem}）` : (yongShenStem || yongShenTenGod || info.yongShenTypical || '待定')
    const xianShen = chenggeDetail.xianShen || info.xianShenTypical || '待定'
    const fallbackReason = `未成格，当前先按${finalPatternName || '主格'}常法参考，仍需结合全局配合与岁运再定。`
    const goodEvil = evaluation?.good_evil_flow || null
    const affection = evaluation?.affection_and_power || null
    const diseaseMedicine = evaluation?.disease_medicine || null
    const climate = evaluation?.climate_adjustment || null
    const sourceLimited = pattern?.traits?.source_limited === true
    const climateAdjustment = climate && climate.status !== 'NOT_NEEDED'
        ? {
            title: TIAOHOU_STATUS_LABELS[climate.status] || climate.status,
            text: climate.explanation || climate.special_pattern_warning || '此局调候已纳入格局评估。'
        }
        : null
    return {
        title: showChengGe ? `${finalPatternName} · ${chenggeDetail.chengGe}` : finalPatternName,
        strongWeak: profile.strong_weak || '未定',
        baseGeju: finalPatternName,
        basePattern,
        imageCandidate,
        imageHeadline: imageCandidate
            ? `${imageCandidate.override_normal_pattern ? '形象匹配度' : `${imageCandidate.subtype}倾向`} ${imageCandidate.match_score}%`
            : '',
        chengGe: chenggeDetail.chengGe || finalPatternName || '待定',
        chengGeResult,
        chengGeStatus,
        showChengGe,
        resultClass: chengGeResult === 'FORMED' || chengGeResult === '成格' ? 'is-good' : (chengGeResult === 'BROKEN' || chengGeResult === '败格' ? 'is-bad' : 'is-wait'),
        gejuBasis: GEJU_BASIS_LABELS[extraction?.basis] || GEJU_BASIS_LABELS[gejuDetail.basis] || gejuDetail.basis || '月令取格',
        gejuReason: gejuDetail.note || getGejuDesc(profile.geju),
        judgeBase: finalPattern?.description || info.judgeBase || gejuDetail.note || getGejuDesc(finalPatternName),
        monthMergeLine: mergeInfo ? `${mergeInfo.originalZhi}参与${mergeInfo.mergeType}，化${mergeInfo.resultElement}，以${mergeInfo.resultGan}为月令主气。` : '',
        extractionSteps: Array.isArray(extraction?.steps) ? extraction.steps : [],
        chengGeReason: chengGeResult === 'PENDING' || chengGeResult === '待定' ? fallbackReason : (affection?.text || chenggeDetail.chengGeReason || fallbackReason),
        evaluationPairs: [
            goodEvil?.god_type ? { label: '善恶', value: PATTERN_GOD_TYPE_LABELS[goodEvil.god_type] || goodEvil.god_type } : null,
            goodEvil?.strategy ? { label: '用法', value: PATTERN_STRATEGY_LABELS[goodEvil.strategy] || goodEvil.strategy } : null,
            diseaseMedicine?.medicine ? { label: '药神', value: diseaseMedicine.medicine } : null,
            diseaseMedicine?.disease ? { label: '病处', value: diseaseMedicine.disease } : null,
        ].filter(Boolean),
        climateAdjustment,
        yongShen,
        xianShen,
        verdict: detail.favorable_verdict || '需结合全盘喜忌继续细断。',
        headlineStatement: pattern?.traits?.source_backed
            ? (pattern.traits.source_excerpt || '')
            : getGejuDesc(finalPatternName),
        sourceLimited,
        sourceMeta: pattern?.traits?.source_backed
            ? {
                title: pattern.traits.source_title || pattern.traits.statement_source || '',
                excerpt: pattern.traits.source_excerpt || '',
                ref: pattern.traits.source_ref || '',
                coveredFields: pattern.traits.covered_fields || [],
                unsupportedFields: pattern.traits.unsupported_fields || []
            }
            : null,
        personality: normalizeTraitItems(pattern?.traits?.personality, sourceLimited ? [] : info.personality),
        goodFor: normalizeTraitItems(pattern?.traits?.career_wealth, sourceLimited ? [] : info.goodFor),
        relationshipHealth: normalizeTraitItems(pattern?.traits?.relationship_health),
        watchOut: normalizeTraitItems(pattern?.traits?.failure_warning, sourceLimited ? [] : info.watchOut)
    }
})

const IMAGE_TREATMENT_LABEL = {
    LEAK_EXCESS: '泄秀',
    RESTRAIN_BALANCED_EXCESS: '制衡',
    SUPPORT_ROOTED_WEAK: '扶弱',
    REMOVE_ROOTLESS_WEAK: '去寡',
    FOLLOW_CLEAR_BODY: '顺势',
    DESCRIPTIVE_ONLY: '仅展示',
    FOLLOW_FORCE: '顺势',
    TRANSFORM_FORCE: '化气',
}

const IMAGE_DIMENSION_LABEL = {
    geju: '格局',
    yongshen: '用神',
    xiji: '喜忌',
    strength_semantic: '旺衰语义',
}

function buildImageDecision(candidate) {
    if (!candidate) return { statusText: '', detailText: '', reasonText: '', reasonLabel: '依据' }
    const hasVeto = !!candidate.override_veto_reason
    const scope = candidate.override_scope
    const isOverride = ['full', 'xiji_yongshen', 'yongshen_only'].includes(scope)
        || (scope == null && candidate.override_normal_pattern)
    const isDisplayOnly = scope === 'display_only' || scope === 'none'
    const statusText = hasVeto
        ? '候选被挡下'
        : (isOverride ? '已主导取用' : (isDisplayOnly ? '仅展示' : '未主导取用'))
    const strategy = IMAGE_TREATMENT_LABEL[candidate.treatment] || candidate.treatment || ''
    const affected = (candidate.affected_dimensions || [])
        .map(item => IMAGE_DIMENSION_LABEL[item] || item)
        .join('、')
    const parts = []
    if (strategy) parts.push(`取用策略：${strategy}`)
    if (affected) parts.push(`影响：${affected}`)
    return {
        statusText,
        detailText: parts.join('；'),
        reasonText: candidate.override_veto_reason || candidate.override_reason || '',
        reasonLabel: candidate.override_veto_reason ? '未主导原因' : '主导依据',
    }
}

const gejuSummaryLine = computed(() => {
    if (!gejuPanelContent.value) return ''
    const parts = [gejuPanelContent.value.gejuBasis, `成格：${gejuPanelContent.value.chengGeStatus}`]
    if (gejuPanelContent.value.showChengGe) parts.push(`小格：${gejuPanelContent.value.chengGe}`)
    return parts.join(' · ')
})

const formatTiaohouGods = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) return '未触发'
    return items.map(item => {
        const stem = item.gan || ''
        const shen = item.shen ? `·${item.shen}` : ''
        return `${stem}${shen}`
    }).filter(Boolean).join('、') || '未触发'
}

const _WUXING = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' }
const _YINYANG = { 甲:'阳',乙:'阴',丙:'阳',丁:'阴',戊:'阳',己:'阴',庚:'阳',辛:'阴',壬:'阳',癸:'阴' }
const _SHENG = { 木:'火',火:'土',土:'金',金:'水',水:'木' }
const _KE   = { 木:'土',土:'水',水:'火',火:'金',金:'木' }
const computeShiShen = (dayGan, targetGan) => {
    const dWx = _WUXING[dayGan], tWx = _WUXING[targetGan]
    if (!dWx || !tWx) return null
    const same = _YINYANG[dayGan] === _YINYANG[targetGan]
    if (dWx === tWx)           return same ? '比肩' : '劫财'
    if (_SHENG[tWx] === dWx)   return same ? '偏印' : '正印'
    if (_SHENG[dWx] === tWx)   return same ? '食神' : '伤官'
    if (_KE[tWx] === dWx)      return same ? '七杀' : '正官'
    if (_KE[dWx] === tWx)      return same ? '偏财' : '正财'
    return null
}

const resolveGanForShen = (dayGan, targetShen) => {
    if (!dayGan || !targetShen) return ''
    return GAN.find(gan => computeShiShen(dayGan, gan) === targetShen) || ''
}

const shenToGanMap = computed(() => {
    const detail = activeProfile.value?.bazi_detail
    const dayGan = detail.ri_zhu?.[0]
    const map = {}
    const skip = new Set(['日主', '元男', '元女'])
    const pillars = detail?.matrix?.pillars || []
    for (const p of pillars) {
        if (p.star && p.gan && !skip.has(p.star) && !map[p.star]) map[p.star] = p.gan
        if (dayGan && Array.isArray(p.hidden_stems)) {
            for (const hg of p.hidden_stems) {
                const stemGan = typeof hg === 'string' ? hg : hg?.gan
                const shen = computeShiShen(dayGan, stemGan)
                if (shen && stemGan && !map[shen]) map[shen] = stemGan
            }
        }
    }
    const shens = detail?.five_shens
    ;[shens?.yong, ...(shens?.xi || []), ...(shens?.ji || []), ...(shens?.chou || []), ...(shens?.xian || [])]
        .filter(Boolean)
        .forEach(shen => {
            if (!map[shen]) map[shen] = resolveGanForShen(dayGan, shen)
        })
    return map
})

const formatShenWithGan = (shen) => {
    if (!shen) return ''
    const gan = shenToGanMap.value[shen]
    return gan ? `${gan}·${shen}` : shen
}

const fiveShenProfile = computed(() => {
    const detail = activeProfile.value?.bazi_detail
    if (!detail?.five_shens) return null
    const fs = detail.five_shens
    return {
        summary: detail.user_blocks?.summary || '',
        yong: fs.yong,
        yongConfidence: fs.yong_confidence || 'MEDIUM',
        xi: fs.xi || [],
        ji: fs.ji || [],
        chou: fs.chou || [],
        xian: fs.xian || [],
        userBlocks: detail.user_blocks || null,
    }
})

const SCORING_DIMENSION_LABELS = [
    ['tiaohou', '调候'],
    ['geju', '格局'],
    ['fuyi', '扶抑'],
    ['bingyao', '病药'],
    ['tongguan', '通关']
]

const buildScoringInfluenceRows = (profile, breakdown = {}) => {
    if (!profile) return []
    const roleGroups = [
        { role: '用神', roleKey: 'yong', items: profile.yong ? [profile.yong] : [] },
        { role: '喜神', roleKey: 'xi', items: profile.xi || [] },
        { role: '忌神', roleKey: 'ji', items: profile.ji || [] },
        { role: '仇神', roleKey: 'chou', items: profile.chou || [] }
    ]
    return roleGroups.flatMap(group => group.items.map(shen => {
        const dims = breakdown?.[shen] || {}
        return {
            key: `${group.roleKey}-${shen}`,
            role: group.role,
            roleKey: group.roleKey,
            name: formatShenWithGan(shen),
            dimensions: SCORING_DIMENSION_LABELS
                .map(([key, label]) => ({ key, label, value: Number(dims[key] || 0) }))
                .filter(dim => dim.value !== 0)
        }
    })).filter(row => row.dimensions.length)
}

const scoringInfluenceRows = computed(() => buildScoringInfluenceRows(
    fiveShenProfile.value,
    activeProfile.value?.bazi_detail?.dimension_breakdown || {}
))

const tiaohouPanelContent = computed(() => {
    const detail = activeProfile.value?.bazi_detail?.tiaohou_detail
    if (!detail) return null
    const urgency = detail.urgency || '普通'
    return {
        climateState: detail.climate_state || '气候未定',
        urgency,
        urgencyClass: urgency === '极急' ? 'is-high' : (urgency === '偏急' ? 'is-mid' : 'is-low'),
        primary: formatTiaohouGods(detail.primary_gods),
        secondary: formatTiaohouGods(detail.secondary_gods),
        avoid: formatTiaohouGods(detail.avoid_gods),
        explanation: detail.explanation || '当前调候信息不足，需结合月令、透干与原局寒暖燥湿继续细看。',
        warning: detail.special_pattern_warning || ''
    }
})

const strengthSummaryLine = computed(() => {
    if (!activeProfile.value?.strong_weak) return ''
    const summary = activeProfile.value.bazi_detail?.strength_detail?.summary || ''
    return summary ? `强弱：${summary}` : `强弱：${activeProfile.value.strong_weak}`
})

const explanationPanelContent = computed(() => ({
    summary: '强弱，是看日主站不站得住；格局，是看命局主轴落在哪里；成格，是看这个主轴能不能真正成立。三者合起来，才比较接近传统子平论命的次序。',
    sections: [
        {
            key: 'strength',
            title: '强弱说明',
            source: '《子平真诠》《渊海子平》《滴天髓》',
            quote: '《子平真诠》评注云：以月令用神为经，诸神为纬。',
            paragraphs: [
                '子平法论命，先看日主旺衰。因为身强身弱，不只是一个标签，而是后面判断喜忌、取用、格局高低的根基。若不先辨旺衰，就很难知道命局中的财、官、印、食，到底是助力，还是压力。',
                '古人论命，重月令、重根气、重扶抑。《渊海子平》一路以时令旺衰为本，《滴天髓》又特别强调旺衰气势，不主张只看某一个五行多寡。',
                '所以这里的程序判断，不是单纯数五行，而是按古法顺序来：先看月令得不得时，再看地支有没有根，再看天干有没有印比帮扶，最后综合落出身强、身中、身弱。',
                '身强，通常表示日主自持力较足，抗压、执行、担当的力量更明显，但若失衡，也容易过刚、过满；身弱，则表示日主更需要环境扶助，感受性更强、反应更细，若配合得好，多见谨慎、细腻、知分寸，若失衡，则容易感到压力先到。这里的强弱，不是好坏之分，而是命局力量结构不同。'
            ]
        },
        {
            key: 'geju',
            title: '格局说明',
            source: '《子平真诠》',
            quote: '《真诠》以月令为主，先定格局之所从来。',
            paragraphs: [
                '格局回答的不是你厉不厉害，而是这张命盘的主轴是什么。强弱是看日主能不能承受，格局是看命局主要围绕财、官、印、食，还是别的核心在运转。',
                '关于格局，古法最重月令。徐乐吾评《子平真诠》时说，《真诠》以月令用神为经，诸神为纬，意思就是立格先抓月令，不是先看全盘哪颗星最显眼。',
                '所以程序里先看月支主气，再看月令藏干是否透出、是否有合化变化，然后定出基础格局。这个阶段解决的是此局以什么立名。'
            ]
        },
        {
            key: 'chengge',
            title: '成格说明',
            source: '《子平真诠》',
            quote: '子平论格，不独看其名，更重成败得失。',
            paragraphs: [
                '但立格不等于成格。立格，是先把命局的骨架找出来；成格，是再看这个骨架有没有真正立住。',
                '同样是财格，有的财能生官，有的财反被争夺；同样是官格，有的官印相生，有的则官杀混杂。程序因此还会继续判断：这个格有没有根气、有没有生扶、有没有破坏、有没有配合。',
                '若条件齐备，就更接近成格；若主轴虽在，但配合未足，就会显示待定或未成格。成格与否，不是把人硬分成高低，而是看这张盘的结构是否完整、力量是否顺畅。成格，多表示优势更容易稳定发挥；未成格，则表示方向已经有了，但现实表现更依赖后天选择与岁运配合。'
            ]
        }
    ]
}))

const insightPanelTitle = computed(() => {
    if (insightTab.value === 'strength') return activeProfile.value?.strong_weak || '强弱'
    if (insightTab.value === 'geju') return gejuPanelContent.value?.title || '格局判定结果'
    return '判定说明'
})

const openInsightPanel = (tab = 'strength') => {
    if (tab === 'geju' && !gejuPanelContent.value) return
    if (tab === 'strength' && !strengthPanelContent.value) return
    insightTab.value = tab
    activeInfoPanel.value = 'insight'
}

const showChengGeText = computed(() => {
    if (!activeProfile.value?.bazi_detail?.chengge_detail?.chengGe) return false
    return activeProfile.value.bazi_detail.chengge_detail.chengGe !== patternFinalName.value
        && activeProfile.value.bazi_detail.chengge_detail.chengGeResult !== '待定'
})

const resolvedInterpretation = computed(() => resolveBaziInterpretation(activeProfile.value || {}))

const streamedBaziInterpretation = computed(() => ({
    yuanju_core: ['streaming', 'done'].includes(llmStreamSections.value.yuanju_core?.status)
        ? getBaziStreamText('yuanju_core')
        : '',
    current_dayun: ['streaming', 'done'].includes(llmStreamSections.value.current_dayun?.status)
        ? getBaziStreamText('current_dayun')
        : '',
    current_liunian: ['streaming', 'done'].includes(llmStreamSections.value.current_liunian?.status)
        ? getBaziStreamText('current_liunian')
        : ''
}))

const resolvedYuanjuCore = computed(() => {
    if (isBaziSectionLoading('yuanju_core')) return streamedBaziInterpretation.value.yuanju_core
    if (isBaziSectionFailed('yuanju_core')) return resolvedInterpretation.value.yuanju_core
    return streamedBaziInterpretation.value.yuanju_core || resolvedInterpretation.value.yuanju_core
})

const resolvedCurrentDayun = computed(() => {
    if (isBaziSectionLoading('current_dayun')) return streamedBaziInterpretation.value.current_dayun
    if (isBaziSectionFailed('current_dayun')) return resolvedInterpretation.value.current_dayun
    return streamedBaziInterpretation.value.current_dayun || resolvedInterpretation.value.current_dayun
})

const resolvedCurrentLiunian = computed(() => {
    if (isBaziSectionLoading('current_liunian')) return streamedBaziInterpretation.value.current_liunian
    if (isBaziSectionFailed('current_liunian')) return resolvedInterpretation.value.current_liunian
    return streamedBaziInterpretation.value.current_liunian || resolvedInterpretation.value.current_liunian
})

const shouldShowBaziInterpretationSection = computed(() => (
    Boolean(resolvedYuanjuCore.value)
    || isBaziLlmLoading.value
))

const feedbackCorrections = computed(() => ({
    yuanju_core: String(activeProfile.value?.calibrated_yuanju_core || '').trim(),
    current_dayun: String(activeProfile.value?.calibrated_current_dayun || '').trim(),
    current_liunian: String(activeProfile.value?.calibrated_current_liunian || '').trim(),
    calibrated_at: activeProfile.value?.calibrated_at || ''
}))

const hasFeedbackCorrections = computed(() =>
    Boolean(
        feedbackCorrections.value.yuanju_core ||
        feedbackCorrections.value.current_dayun ||
        feedbackCorrections.value.current_liunian
    )
)

const feedbackCorrectionDate = computed(() => {
    const value = feedbackCorrections.value.calibrated_at
    return value ? new Date(value).toLocaleDateString('zh-CN') : ''
})

const isCalibrated = computed(() => hasFeedbackCorrections.value)
const calibratedTimeStr = computed(() => feedbackCorrectionDate.value)

const lifeEvents = computed(() => {
    const events = activeProfile.value?.life_events
    return Array.isArray(events) ? events : []
})

const sortedLifeEvents = computed(() =>
    [...lifeEvents.value].sort((a, b) =>
        b.year - a.year || (b.month || 0) - (a.month || 0)
    )
)

const birthYear = computed(() => {
    const bd = activeProfile.value?.birth_date
    return bd ? parseInt(String(bd).slice(0, 4)) : 1900
})

const currentEventYear = computed(() => new Date().getFullYear())

const eventYearOptions = computed(() => {
    const start = birthYear.value
    const end = currentEventYear.value
    const years = []
    for (let year = end; year >= start; year -= 1) {
        years.push(year)
    }
    return years
})

const isEventFormValid = computed(() =>
    eventForm.year >= birthYear.value &&
    eventForm.year <= currentEventYear.value &&
    eventForm.category &&
    eventForm.impact !== undefined &&
    eventForm.description.trim().length > 0
)

watch([birthYear, currentEventYear], ([nextBirthYear, nextCurrentYear]) => {
    if (eventForm.year < nextBirthYear) {
        eventForm.year = nextBirthYear
        return
    }
    if (eventForm.year > nextCurrentYear) {
        eventForm.year = nextCurrentYear
    }
}, { immediate: true })

const eventCategoryLabel = (val) =>
    LIFE_EVENT_CATEGORIES.find(c => c.value === val)?.label || val

const eventImpactClass = (val) =>
    val === 1 ? 'positive' : val === -1 ? 'negative' : 'neutral'

const eventImpactLabel = (val) =>
    IMPACT_OPTIONS.find(o => o.value === val)?.label || ''

// 时间解析逻辑
const promptDataObj = computed(() => {
    if (!activeProfile.value) return null
    return getPromptDataFromProfile(activeProfile.value)
})

const solarParsedInput = computed(() => parseCompactSolarInput(solarInput.text))
const solarInputDigits = computed(() => String(solarInput.text || '').replace(/\D/g, '').slice(0, 12))
const solarInputError = computed(() => {
    const digits = solarInputDigits.value
    if (!digits.length) return '请输入出生年月日时分'
    if (![8, 10, 12].includes(digits.length)) return '请输入 8 位、10 位或 12 位数字，例如 199303270255'
    const parsed = solarParsedInput.value
    if (!parsed) return '日期格式不正确'
    if (parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31 || parsed.hour > 23 || parsed.minute > 59) {
        return '日期格式不正确，请检查月份、日期、小时和分钟'
    }
    return ''
})
const birthplaceSearchResults = computed(() => (
    birthplaceQuery.value ? searchBirthplaces(birthplaceQuery.value, 12) : []
))
const solarPreview = computed(() => {
    if (solarInputError.value || !solarParsedInput.value) return null
    const { year, month, day, hour, minute } = solarParsedInput.value
    return getSolarLunarSnapshot(year, month, day, hour, minute, {
        longitude: form.birthLongitude,
        country: form.birthCountry,
        admin1: form.birthAdmin1,
        mode: form.solarTimeMode
    })
})
const daylightSavingAutoActive = computed(() => Boolean(solarPreview.value?.timeAdjustment?.daylightSavingActive))
const solarTimeAdjustmentText = computed(() => {
    const adjustment = solarPreview.value?.timeAdjustment
    if (!adjustment || !adjustment.totalMinutes) return ''
    const direction = adjustment.totalMinutes > 0 ? '快' : '慢'
    return `${direction}${Math.abs(adjustment.totalMinutes)}分钟`
})
const syncBaziRouteState = () => {
    const requestedTab = String(route.query.tab || '')
    if (requestedTab === 'events') {
        currentTab.value = 'events'
    }
}
const solarInputMasked = computed(() => {
    const digits = solarInputDigits.value
    const y = digits.slice(0, 4)
    const m = digits.slice(4, 6)
    const d = digits.slice(6, 8)
    const h = digits.slice(8, 10)
    const min = digits.slice(10, 12)
    return [y, m, d, h, min].filter(Boolean).join(' ')
})

const pillarMatches = computed(() => findDatesByBazi(
    pillarInput.yearPillar,
    pillarInput.monthPillar,
    pillarInput.dayPillar,
    pillarInput.timePillar
))

const pillarPreview = computed(() => {
    if (!pillarMatches.value.length) return null
    const latest = pillarMatches.value[pillarMatches.value.length - 1]
    return getSolarLunarSnapshot(
        latest.getYear(),
        latest.getMonth(),
        latest.getDay(),
        latest.getHour(),
        latest.getMinute()
    )
})

const solarDateStr = computed(() => {
    const data = promptDataObj.value
    if (!data || !data.birthStr) return '阳历加载中...'
    const p = data.birthStr.match(/\d+/g)
    if (!p || p.length < 3) return ''
    const s = Solar.fromYmdHms(parseInt(p[0]), parseInt(p[1]), parseInt(p[2]), parseInt(p[3]||12), parseInt(p[4]||0), 0)
    return s.toYmdHms()
})

const lunarDateStr = computed(() => {
    const data = promptDataObj.value
    if (!data || !data.birthStr) return '农历加载中...'
    const p = data.birthStr.match(/\d+/g)
    if (!p || p.length < 3) return ''
    const s = Solar.fromYmdHms(parseInt(p[0]), parseInt(p[1]), parseInt(p[2]), parseInt(p[3]||12), parseInt(p[4]||0), 0)
    const l = s.getLunar()
    return `${l.getYearInGanZhi()}年${l.getMonthInChinese()}月${l.getDayInChinese()} ${l.getTimeZhi()}时 ${activeProfile.value.gender==='M'?'乾造':'坤造'}`
})

const heroCollapseProgress = ref(0)
const heroStickyStyle = computed(() => {
    const p = heroCollapseProgress.value
    return {
        '--hero-collapse': p,
        '--hero-pad-top': `${24 - (12 * p)}px`,
        '--hero-pad-bottom': `${10 + (2 * p)}px`,
        '--hero-action-top': `${18 - (6 * p)}px`,
        '--hero-bg-alpha': 0.72 + (0.24 * p),
        '--hero-border-alpha': 0.18 + (0.82 * p),
        '--hero-blur': `${2 + (10 * p)}px`,
        '--hero-shadow-y': `${10 * p}px`,
        '--hero-shadow-blur': `${28 * p}px`,
        '--hero-shadow-alpha': 0.08 * p,
        '--hero-dates-margin': `${6 - (6 * p)}px`,
        '--hero-dates-height': `${22 * (1 - p)}px`,
        '--hero-dates-opacity': Math.max(0, 1 - (p * 1.15)),
        '--hero-dates-offset': `${-6 * p}px`,
        '--hero-name-size': `${42 - (22 * p)}px`,
        '--hero-meta-margin': `${18 - (18 * p)}px`,
        '--hero-meta-height': `${34 * (1 - p)}px`,
        '--hero-meta-opacity': Math.max(0, 1 - (p * 1.2)),
        '--hero-meta-offset': `${-5 * p}px`,
        '--hero-strip-gap': `${18 - (10 * p)}px`,
        '--hero-side-opacity': Math.max(0, 1 - (p * 1.35)),
        '--hero-badge-width': `${48 * (1 - p)}px`,
        '--hero-caret-width': `${9 * (1 - p)}px`,
        '--hero-action-opacity': Math.max(0, 1 - (p * 1.35)),
        '--hero-note-height': `${42 * (1 - p)}px`,
        '--hero-note-opacity': Math.max(0, 1 - (p * 1.2)),
    }
})
let heroScrollRaf = 0
let heroScrollElement = null
const getProfileScrollElement = () => document.querySelector('.main-viewport') || window
const updateProfileHeroCollapse = () => {
    const scrollTop = heroScrollElement && heroScrollElement !== window
        ? heroScrollElement.scrollTop
        : window.scrollY || document.documentElement.scrollTop || 0
    heroCollapseProgress.value = Math.min(1, Math.max(0, scrollTop / 128))
}
const scheduleProfileHeroCollapse = () => {
    if (heroScrollRaf) return
    heroScrollRaf = window.requestAnimationFrame(() => {
        heroScrollRaf = 0
        updateProfileHeroCollapse()
    })
}

// ── 滑动下划线指示条 ──────────────────────────────────────
const tabBarRef = ref(null)
const inkLeft = ref(0)
const inkWidth = ref(0)
const inkReady = ref(false)

const syncInk = () => {
    const bar = tabBarRef.value
    if (!bar) return
    const active = bar.querySelector('.bazi-tab.active')
    if (!active) return
    inkLeft.value = active.offsetLeft
    inkWidth.value = active.offsetWidth
    inkReady.value = true
}

watch(currentTab, async (tab) => {
    nextTick(syncInk)
    if (tab === 'pro') {
        await nextTick()
        baziBackingRef.value?.centerActiveItems()
    }
    if (tab === 'events') await ensureEventsContextLoaded()
})
watch(() => activeProfile.value, () => nextTick(syncInk))

// ── 命局天机 drawer 滑动指示条 ────────────────────────────
const insightTabBarRef = ref(null)
const insightInkLeft = ref(0)
const insightInkWidth = ref(0)
const insightInkReady = ref(false)

const syncInsightInk = () => {
    const bar = insightTabBarRef.value
    if (!bar) return
    const active = bar.querySelector('.insight-bazi-tab.active')
    if (!active) return
    // bar has padding-left: 16px; offsetLeft is relative to bar's content box
    insightInkLeft.value = active.offsetLeft
    insightInkWidth.value = active.offsetWidth
    insightInkReady.value = true
}

watch(() => insightTab.value, () => nextTick(syncInsightInk))
watch(() => activeInfoPanel.value, (v) => { if (v === 'insight') nextTick(syncInsightInk) })

// 生命周期
onMounted(async () => {
    nextTick(syncInk)
    document.addEventListener('click', handleDocumentClick)
    heroScrollElement = getProfileScrollElement()
    heroScrollElement.addEventListener('scroll', scheduleProfileHeroCollapse, { passive: true })
    updateProfileHeroCollapse()
    notesMonthKey.value = currentMonthKey.value
    syncBaziRouteState()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && globalState.isGuest) {
        loadGuestProfile()
        await trackGuestEvent(supabase, 'guest_bazi_viewed', 'bazi')
        return
    }
    if (!session) return // 可以在此触发全局路由跳转回登录页
    currentUser.value = session.user
    await fetchProfiles()
})

onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick)
    if (heroScrollElement) {
        heroScrollElement.removeEventListener('scroll', scheduleProfileHeroCollapse)
        heroScrollElement = null
    }
    if (heroScrollRaf) {
        window.cancelAnimationFrame(heroScrollRaf)
        heroScrollRaf = 0
    }
    stopAnalysisMotion()
    if (toastTimer) window.clearTimeout(toastTimer)
})

// 业务方法
const fetchProfiles = async () => {
    if (isGuest.value) {
        loadGuestProfile()
        return
    }
    const applyProfiles = (list) => {
        baziProfiles.value = list
        const requestedProfileId = String(route.query.profileId || '')
        const resolvedProfileId = resolveSelectedBaziProfileId(baziProfiles.value, {
            requestedProfileId,
            currentProfileId: selectedProfileId.value
        })
        selectedProfileId.value = resolvedProfileId
        setSelectedBaziProfileId(resolvedProfileId)
    }
    const cached = getCachedBaziProfiles('bazi')
    if (cached?.length) applyProfiles(cached)
    const { data } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_LIST_SELECT).order('created_at', {ascending: false})
    if (data) setCachedBaziProfiles('bazi', data)
    applyProfiles(data || [])
}

const loadProfileDetail = async (profileId) => {
    if (!profileId || isGuest.value) return
    if (profileDetailCache.value[profileId]) return  // 已有缓存，跳过
    isLoadingProfileDetail.value = true
    try {
        const { data } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_FULL_SELECT).eq('id', profileId).single()
        if (data) profileDetailCache.value = { ...profileDetailCache.value, [profileId]: data }
    } finally {
        isLoadingProfileDetail.value = false
    }
}

const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
}

const summarizeMonthlyStatuses = (item) => {
    const labels = []
    if (item?.career_monthly?.status) labels.push(`事业：${item.career_monthly.status}`)
    if (item?.wealth_monthly?.status) labels.push(`财务：${item.wealth_monthly.status}`)
    if (item?.love_monthly?.status) labels.push(`感情：${item.love_monthly.status}`)
    if (item?.health_monthly?.status) labels.push(`健康/生活：${item.health_monthly.status}`)
    return labels.join('；') || '本月暂无补充状态'
}

const fetchProfileContextDraft = async () => {
    if (!activeProfile.value || isGuest.value) {
        profileContextDraft.value = createEmptyProfileContextDraft()
        return
    }
    try {
        const accessToken = await getAccessToken()
        const response = await fetch(apiPath(`/api/context-notes?scope=profile&profile_id=${encodeURIComponent(activeProfile.value.id)}`), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const payload = await response.json()
        if (!response.ok || payload.error) throw new Error(payload.details || payload.error || '加载长期基调失败')
        profileContextDraft.value = payload.data || createEmptyProfileContextDraft()
        profileContextBaseline.value = cloneContextValue(profileContextDraft.value)
    } catch (error) {
        console.error(error)
        profileContextDraft.value = createEmptyProfileContextDraft()
        profileContextBaseline.value = cloneContextValue(profileContextDraft.value)
        showToast(error.message, 'error')
    }
}

const fetchMonthlyContextDraft = async () => {
    if (!activeProfile.value || isGuest.value) {
        monthlyContextDraft.value = createEmptyMonthlyContextDraft(notesMonthKey.value || currentMonthKey.value)
        recentMonthlyContextRecords.value = []
        return
    }
    try {
        const accessToken = await getAccessToken()
        const response = await fetch(apiPath(`/api/context-notes?scope=monthly&profile_id=${encodeURIComponent(activeProfile.value.id)}&month_key=${encodeURIComponent(notesMonthKey.value)}`), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const payload = await response.json()
        if (!response.ok || payload.error) throw new Error(payload.details || payload.error || '加载月度现状失败')
        monthlyContextDraft.value = payload.record || createEmptyMonthlyContextDraft(notesMonthKey.value)
        monthlyContextBaseline.value = cloneContextValue(monthlyContextDraft.value)
        recentMonthlyContextRecords.value = Array.isArray(payload.recent_records) ? payload.recent_records : []
    } catch (error) {
        console.error(error)
        monthlyContextDraft.value = createEmptyMonthlyContextDraft(notesMonthKey.value)
        monthlyContextBaseline.value = cloneContextValue(monthlyContextDraft.value)
        recentMonthlyContextRecords.value = []
        showToast(error.message, 'error')
    }
}

const ensureEventsContextLoaded = async () => {
    if (!activeProfile.value || isGuest.value) return
    const key = `${activeProfile.value.id}:${notesMonthKey.value || currentMonthKey.value}`
    if (eventsContextLoadedKey.value === key) return
    await fetchProfileContextDraft()
    await fetchMonthlyContextDraft()
    eventsContextLoadedKey.value = key
}

const saveProfileContextDraft = async () => {
    if (!activeProfile.value || isGuest.value) return
    isSavingProfileContext.value = true
    try {
        const shouldRefreshInterpretation = computeProfileContextRefreshSignal(profileContextBaseline.value, profileContextDraft.value)
        const accessToken = await getAccessToken()
        const response = await fetch(apiPath('/api/context-notes'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                scope: 'profile',
                profile_id: activeProfile.value.id,
                data: profileContextDraft.value,
            }),
        })
        const payload = await response.json()
        if (!response.ok || payload.error) throw new Error(payload.details || payload.error || '保存长期基调失败')
        profileContextDraft.value = payload.data || createEmptyProfileContextDraft()
        profileContextBaseline.value = cloneContextValue(profileContextDraft.value)
        if (shouldRefreshInterpretation) {
            queueMonthlyInterpretationRefresh({ scope: 'profile', monthKey: '*' })
        }
        showToast('长期基调已保存')
    } catch (error) {
        console.error(error)
        showToast(error.message, 'error')
    } finally {
        isSavingProfileContext.value = false
    }
}

const saveMonthlyContextDraft = async () => {
    if (!activeProfile.value || isGuest.value) return
    isSavingMonthlyContext.value = true
    try {
        const shouldRefreshInterpretation = computeMonthlyContextRefreshSignal(monthlyContextBaseline.value, monthlyContextDraft.value)
        const accessToken = await getAccessToken()
        const response = await fetch(apiPath('/api/context-notes'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                scope: 'monthly',
                profile_id: activeProfile.value.id,
                month_key: notesMonthKey.value,
                data: monthlyContextDraft.value,
            }),
        })
        const payload = await response.json()
        if (!response.ok || payload.error) throw new Error(payload.details || payload.error || '保存月度现状失败')
        monthlyContextDraft.value = payload.record || createEmptyMonthlyContextDraft(notesMonthKey.value)
        monthlyContextBaseline.value = cloneContextValue(monthlyContextDraft.value)
        recentMonthlyContextRecords.value = Array.isArray(payload.recent_records) ? payload.recent_records : []
        if (shouldRefreshInterpretation) {
            queueMonthlyInterpretationRefresh({ scope: 'monthly', monthKey: notesMonthKey.value || currentMonthKey.value })
        }
        showToast('月度基调已保存')
    } catch (error) {
        console.error(error)
        showToast(error.message, 'error')
    } finally {
        isSavingMonthlyContext.value = false
    }
}

const copyPreviousMonthlyContext = () => {
    const previous = recentMonthlyContextRecords.value.find(item => item.month_key && item.month_key !== notesMonthKey.value)
    if (!previous) {
        showToast('没有可沿用的上月记录', 'error')
        return
    }
    monthlyContextDraft.value = JSON.parse(JSON.stringify({
        ...previous,
        month_key: notesMonthKey.value,
    }))
    showToast(`已沿用 ${previous.month_key} 的月度现状`)
}

const handleProfileSelect = () => {
    currentTab.value = 'basic'
    showRename.value = false
    analysisNotice.value = ''
}

const toggleProfileMenu = () => {
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
    handleProfileSelect()
}

const handleDocumentClick = (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest('.profile-switcher') && !target.closest('.profile-strip-wrap') && !target.closest('.profile-bottom-sheet')) isProfileMenuOpen.value = false
}

const openAddProfile = () => {
    if (isGuest.value && baziProfiles.value.length >= 1) {
        alert('访客模式仅可添加 1 个本地八字档案')
        return
    }
    resetProfileEntry()
    isProfileMenuOpen.value = false
    swipedProfileId.value = null
    showAdd.value = true
    showRename.value = false
}

const openRenameProfile = () => {
    if (!activeProfile.value) return
    renameName.value = activeProfile.value.name
    showRename.value = true
    showAdd.value = false
}

const resetProfileEntry = () => {
    form.name = ''
    form.gender = 'M'
    form.birthCountry = ''
    form.birthAdmin1 = ''
    form.birthCity = ''
    form.birthCounty = ''
    form.birthLocation = ''
    form.birthLatitude = ''
    form.birthLongitude = ''
    form.solarTimeMode = 'clock'
    birthplaceQuery.value = ''
    isBirthplaceSearchOpen.value = false
    entryMode.value = ENTRY_MODE.SOLAR
    solarInput.text = ''
    pillarInput.yearPillar = '庚午'
    pillarInput.monthPillar = '戊寅'
    pillarInput.dayPillar = '乙丑'
    pillarInput.timePillar = '丙子'
    activePillarSlot.value = 'yearGan'
}

const handleSolarInput = (event) => {
    const digits = String(event?.target?.value || '').replace(/\D/g, '').slice(0, 12)
    solarInput.text = digits
}

const clearBirthplaceSelection = () => {
    form.birthCountry = ''
    form.birthAdmin1 = ''
    form.birthCity = ''
    form.birthCounty = ''
    form.birthLocation = ''
    form.birthLatitude = ''
    form.birthLongitude = ''
    form.solarTimeMode = 'clock'
}

const resetBirthplaceSearch = () => {
    birthplaceQuery.value = ''
    isBirthplaceSearchOpen.value = false
    clearBirthplaceSelection()
}

const selectBirthplace = (place) => {
    form.birthCountry = place.country || ''
    form.birthAdmin1 = place.admin1 || ''
    form.birthCity = place.city || place.name || ''
    form.birthCounty = place.county || place.name || ''
    form.birthLocation = place.label || `${place.country} ${place.admin1} ${place.name}`
    form.birthLatitude = String(place.lat)
    form.birthLongitude = String(place.lng)
    form.solarTimeMode = 'apparent'
    birthplaceQuery.value = place.label || form.birthLocation
    isBirthplaceSearchOpen.value = false
}

const toggleApparentSolarTime = (event) => {
    if (!form.birthLocation) {
        form.solarTimeMode = 'clock'
        return
    }
    form.solarTimeMode = event?.target?.checked ? 'apparent' : 'clock'
}

const setActivePillarSlot = (slot) => {
    activePillarSlot.value = slot
}

const moveToNextPillarSlot = () => {
    const currentIndex = PILLAR_SLOT_FLOW.indexOf(activePillarSlot.value)
    if (currentIndex === -1 || currentIndex >= PILLAR_SLOT_FLOW.length - 1) return
    activePillarSlot.value = PILLAR_SLOT_FLOW[currentIndex + 1]
}

const updateActivePillar = (value) => {
    if (activePillarSlot.value === 'monthZhi' && !monthBranchOptions.value.includes(value)) {
        return
    }
    if (activePillarSlot.value === 'timeZhi' && !timeBranchOptions.value.includes(value)) {
        return
    }
    switch (activePillarSlot.value) {
        case 'yearGan':
            pillarInput.yearPillar = `${value}${pillarInput.yearPillar.charAt(1) || '子'}`
            break
        case 'yearZhi':
            pillarInput.yearPillar = `${pillarInput.yearPillar.charAt(0) || '甲'}${value}`
            break
        case 'monthGan':
            pillarInput.monthPillar = `${value}${pillarInput.monthPillar.charAt(1) || getAllowedMonthBranchesByStem(value)[0]}`
            break
        case 'monthZhi':
            pillarInput.monthPillar = `${pillarInput.monthPillar.charAt(0) || '甲'}${value}`
            break
        case 'dayGan':
            pillarInput.dayPillar = `${value}${pillarInput.dayPillar.charAt(1) || '子'}`
            break
        case 'dayZhi':
            pillarInput.dayPillar = `${pillarInput.dayPillar.charAt(0) || '甲'}${value}`
            break
        case 'timeGan':
            pillarInput.timePillar = `${value}${pillarInput.timePillar.charAt(1) || getAllowedTimeBranchesByStem(value)[0]}`
            break
        case 'timeZhi':
            pillarInput.timePillar = `${pillarInput.timePillar.charAt(0) || '甲'}${value}`
            break
        default:
            break
    }
    moveToNextPillarSlot()
}

const buildProfilePayloadFromEntry = () => {
    const name = form.name.trim()
    if (!name) {
        throw new Error('请先填写命主姓名')
    }

    if (entryMode.value === ENTRY_MODE.SOLAR) {
        if (solarInputError.value || !solarParsedInput.value) {
            throw new Error(solarInputError.value || '请输入正确的出生年月日时分')
        }
        return buildSolarProfilePayload({
            name,
            gender: form.gender,
            year: solarParsedInput.value.year,
            month: solarParsedInput.value.month,
            day: solarParsedInput.value.day,
            hour: solarParsedInput.value.hour,
            minute: solarParsedInput.value.minute,
            birthLocation: form.birthLocation,
            birthCountry: form.birthCountry,
            birthAdmin1: form.birthAdmin1,
            birthLatitude: form.birthLatitude,
            birthLongitude: form.birthLongitude,
            solarTimeMode: form.solarTimeMode
        })
    }

    return buildPillarsProfilePayload({
        name,
        gender: form.gender,
        yearPillar: pillarInput.yearPillar,
        monthPillar: pillarInput.monthPillar,
        dayPillar: pillarInput.dayPillar,
        timePillar: pillarInput.timePillar
    })
}

const saveProfile = async () => {
    let payload
    try {
        payload = buildProfilePayloadFromEntry()
    } catch (error) {
        alert(error.message)
        return
    }
    showAdd.value = false
    isProfileMenuOpen.value = false
    swipedProfileId.value = null
    resetProfileEntry()
    if (isGuest.value) {
        const profile = buildGuestProfile(payload)
        saveGuestBaziProfile(undefined, profile)
        baziProfiles.value = [profile]
        selectedProfileId.value = profile.id
        setSelectedBaziProfileId(profile.id)
        await trackGuestEvent(supabase, 'guest_bazi_profile_added', 'bazi', { limit_reached: true })
        return
    }
    let { data, error } = await supabase
        .from('bazi_profiles')
        .insert([buildBaziProfileInsertPayload(currentUser.value.id, payload)])
        .select('id')
        .single()
    if (isMissingBaziProfileSolarTimeColumnError(error) && canRetryLegacyBaziProfileInsert(payload)) {
        ;({ data, error } = await supabase
            .from('bazi_profiles')
            .insert([buildBaziProfileInsertPayload(currentUser.value.id, payload, { includeSolarTimeColumns: false })])
            .select('id')
            .single())
    }
    if (error) {
        if (isMissingBaziProfileSolarTimeColumnError(error)) {
            alert('数据库缺少出生地/真太阳时字段，请先执行 docs/sql/bazi-birthplace-solar-time-migration.sql 后再保存带出生地校正的档案。')
        } else {
            alert(error.message)
        }
    }
    else { 
        if (data?.id) {
            const optimisticProfile = {
                id: data.id,
                name: payload.name,
                gender: payload.gender,
                birth_date: payload.birth_date,
                adjusted_birth_date: payload.adjusted_birth_date,
                bazi_str: payload.bazi_str,
                birth_location: payload.birth_location,
                birth_latitude: payload.birth_latitude,
                birth_longitude: payload.birth_longitude,
                solar_time_mode: payload.solar_time_mode,
                solar_time_adjustment_minutes: payload.solar_time_adjustment_minutes,
                is_default: baziProfiles.value.length === 0
            }
            baziProfiles.value = [
                optimisticProfile,
                ...baziProfiles.value.filter(profile => profile.id !== data.id)
            ]
            selectedProfileId.value = data.id
            setSelectedBaziProfileId(data.id)
        }
        clearBaziProfilesCache()
        await fetchProfiles()
    }
}

const loadGuestProfile = () => {
    const profile = getGuestState().baziProfile
    baziProfiles.value = profile ? [profile] : []
    selectedProfileId.value = profile?.id || ''
    setSelectedBaziProfileId(profile?.id || '')
}

const buildGuestProfile = (payload) => {
    return {
        id: 'guest_bazi_profile',
        name: payload.name,
        gender: payload.gender,
        birth_date: payload.birth_date,
        adjusted_birth_date: payload.adjusted_birth_date,
        bazi_str: payload.bazi_str,
        birth_location: payload.birth_location,
        birth_latitude: payload.birth_latitude,
        birth_longitude: payload.birth_longitude,
        solar_time_mode: payload.solar_time_mode,
        solar_time_adjustment_minutes: payload.solar_time_adjustment_minutes,
        bazi_summary: '访客本地档案已保存。登录后可生成完整云端命理解读与日运联动。',
        is_default: true
    }
}

const renameProfile = async () => {
    if (!activeProfile.value) return
    const nextName = renameName.value.trim()
    if (!nextName) return alert('昵称不能为空')
    const { error } = await supabase.from('bazi_profiles').update({ name: nextName }).eq('id', activeProfile.value.id)
    if (error) alert(error.message)
    else {
        showRename.value = false
        clearBaziProfilesCache()
        await fetchProfiles()
    }
}

const setDefaultProfile = async () => {
    if (!activeProfile.value || activeProfile.value.is_default) return
    const profileId = activeProfile.value.id
    const { error: clearError } = await supabase.from('bazi_profiles').update({ is_default: false }).eq('user_id', currentUser.value.id)
    if (clearError) return alert(clearError.message)
    const { error } = await supabase.from('bazi_profiles').update({ is_default: true }).eq('id', profileId)
    if (error) alert(error.message)
    else {
        selectedProfileId.value = profileId
        setSelectedBaziProfileId(profileId)
        clearBaziProfilesCache()
        await fetchProfiles()
    }
}

const deleteProfile = async (idOverride) => {
    const deletedId = idOverride || selectedProfileId.value
    if (deletedId && confirm("确认删除该档案？")) {
        const nextList = baziProfiles.value.filter(profile => profile.id !== deletedId)
        const nextProfileId = resolveSelectedBaziProfileId(nextList)
        selectedProfileId.value = nextProfileId
        setSelectedBaziProfileId(nextProfileId)
        baziProfiles.value = nextList
        await supabase.from('bazi_profiles').delete().eq('id', deletedId)
        clearBaziProfilesCache()
        await fetchProfiles()
    }
}

const startAnalysisMotion = () => {
    analysisNotice.value = ''
    analysisStageIndex.value = 0
    analysisFrameIndex = 0
    analysisProgress.value = ANALYSIS_PROGRESS_FRAMES[analysisFrameIndex]
    stopAnalysisMotion()
    analysisTimer = window.setInterval(() => {
        analysisFrameIndex = Math.min(ANALYSIS_PROGRESS_FRAMES.length - 1, analysisFrameIndex + 1)
        analysisProgress.value = ANALYSIS_PROGRESS_FRAMES[analysisFrameIndex]
        analysisStageIndex.value = Math.min(analysisSteps.length - 1, Math.floor((analysisProgress.value / 100) * analysisSteps.length))
    }, 1300)
}

const stopAnalysisMotion = () => {
    if (analysisTimer) {
        window.clearInterval(analysisTimer)
        analysisTimer = null
    }
}

async function readBaziSSEStream(response, profileId) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const applyStreamResult = (result) => {
        if (!result?.bazi_detail) return
        const current = profileDetailCache.value[profileId] || activeProfile.value || {}
        const next = {
            ...current,
            bazi_detail: result.bazi_detail,
            bazi_summary: result.result ?? current.bazi_summary,
            favorable_elements: result.favorable_elements ?? current.favorable_elements,
            unfavorable_elements: result.unfavorable_elements ?? current.unfavorable_elements,
            strong_weak: result.bazi_detail.strong_weak ?? current.strong_weak,
            geju: result.bazi_detail.geju ?? current.geju,
        }
        profileDetailCache.value = { ...profileDetailCache.value, [profileId]: next }
    }

    while (true) {
        const { done, value } = await reader.read()
        if (done) return null
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data: ')) continue
            let event
            try { event = JSON.parse(line.slice(6)) } catch { continue }

            if (event.type === 'step') {
                analysisProgress.value = event.pct ?? analysisProgress.value
                analysisStageIndex.value = Math.min(analysisSteps.length - 1, Math.max(0, Number(event.index || 0)))
            } else if (event.type === 'engine_complete') {
                analysisProgress.value = event.pct ?? 45
                applyStreamResult(event.result)
                resetLlmStreamSections('pending')
                clearBaziProfilesCache()
                await fetchProfiles()
            } else if (event.type === 'llm_section_start') {
                patchLlmStreamSection(event.section, { status: 'streaming' })
            } else if (event.type === 'llm_delta') {
                const current = llmStreamSections.value[event.section]?.text || ''
                patchLlmStreamSection(event.section, { status: 'streaming', text: current + (event.text || '') })
            } else if (event.type === 'llm_section_done') {
                patchLlmStreamSection(event.section, {
                    status: 'done',
                    text: event.text ?? llmStreamSections.value[event.section]?.text ?? ''
                })
            } else if (event.type === 'llm_error') {
                BAZI_STREAM_SECTION_KEYS.forEach(section => {
                    if (['pending', 'streaming'].includes(llmStreamSections.value[section]?.status)) {
                        patchLlmStreamSection(section, { status: 'failed' })
                    }
                })
                showToast(event.message || 'AI 深度断语暂时不可用，已保留规则引擎结果', 'error')
            } else if (event.type === 'llm_complete') {
                analysisProgress.value = 100
                applyStreamResult(event.result)
                clearBaziProfilesCache()
                await fetchProfiles()
                return event.result || null
            } else if (event.type === 'complete') {
                analysisProgress.value = event.pct ?? 100
                applyStreamResult(event.result)
                if (event.partial) {
                    clearBaziProfilesCache()
                    await fetchProfiles()
                }
                return event.result || null
            } else if (event.type === 'error') {
                const err = new Error(event.message || '八字推演失败')
                err.profileId = profileId
                throw err
            }
        }
    }
}

// force=true 时引擎 + LLM 全量重推；force=false（默认）只在版本过期时刷新引擎，保留 LLM 断语
const requestAiSummary = async ({ force = false } = {}) => {
    if (!activeProfile.value) return
    if (isGuest.value) {
        showGuestLoginGuide.value = true
        return
    }
    const profileId = activeProfile.value.id
    const shouldCalibrateFromEvents = lifeEvents.value.length > 0
    isAnalyzing.value = true
    analysisNotice.value = ''
    resetLlmStreamSections()
    startAnalysisMotion()
    try {
        const pd = promptDataObj.value
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(apiPath('/api/bazi'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ 
                promptData: { profileId, gender: pd.gender, birthStr: pd.birthStr, baziStr: pd.baziStr, daYunStr: "当前大运", force }
            })
        })

        const contentType = response.headers.get('Content-Type') || ''
        const data = contentType.includes('text/event-stream')
            ? await readBaziSSEStream(response, profileId)
            : await response.json()
        if (data?.error) {
            const err = new Error(data.error)
            err.httpStatus = response.status
            throw err
        }
        analysisProgress.value = 100
        clearBaziProfilesCache()
        await fetchProfiles() // 刷新拿到最新数据
        if (shouldCalibrateFromEvents) {
            await triggerCalibration({ profileId, force })
        }
        analysisNotice.value = '推演完成'
    } catch (err) {
        if (err.httpStatus === 403) {
            showToast(err.message || '今日额度已用尽，请明日再来', 'error')
        } else {
            showToast('推演失败：' + err.message, 'error')
        }
    } finally {
        stopAnalysisMotion()
        isAnalyzing.value = false
    }
}

// ── 断事笔记：保存事件列表到数据库 ──────────────────
const saveLifeEvents = async (events) => {
    if (!activeProfile.value || isGuest.value) return
    const clearsCalibration = events.length === 0
    const payload = clearsCalibration
        ? {
            life_events: events,
            calibrated_yuanju_core: null,
            calibrated_current_dayun: null,
            calibrated_current_liunian: null,
            calibrated_at: null,
            calibrated_version: null,
        }
        : { life_events: events }
    const { error } = await supabase
        .from('bazi_profiles')
        .update(payload)
        .eq('id', activeProfile.value.id)
    if (error) {
        console.error('保存断事笔记失败:', error)
        return
    }
    const idx = baziProfiles.value.findIndex(p => p.id === activeProfile.value.id)
    if (idx !== -1) {
        baziProfiles.value[idx] = { ...baziProfiles.value[idx], ...payload }
    }
}

const resetEventForm = () => {
    eventForm.year = currentEventYear.value
    eventForm.month = undefined
    eventForm.category = 'career'
    eventForm.impact = 1
    eventForm.description = ''
    isFormOpen.value = false
}

const submitLifeEvent = async () => {
    if (!isEventFormValid.value) return
    const dayun = getDayunByYear(activeProfile.value, eventForm.year)
    const newEvent = {
        id: `le_${Date.now()}`,
        year: eventForm.year,
        month: eventForm.month || undefined,
        category: eventForm.category,
        impact: eventForm.impact,
        description: eventForm.description.trim(),
        dayun_at_time: dayun || undefined,
    }
    await saveLifeEvents([...lifeEvents.value, newEvent])
    resetEventForm()
}

const deleteLifeEvent = async (id) => {
    await saveLifeEvents(lifeEvents.value.filter(e => e.id !== id))
}

// ── AI 深度校准 ──────────────────────────────────────
const triggerCalibration = async ({ profileId = activeProfile.value?.id, force = false } = {}) => {
    if (!activeProfile.value || lifeEvents.value.length === 0 || isCalibrating.value) return
    if (!force && hasValidCalibration(activeProfile.value, lifeEvents.value)) return
    isCalibrating.value = true
    try {
        const pd = promptDataObj.value
        const prompt = buildCalibrationPrompt(activeProfile.value, lifeEvents.value, pd)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('登录状态已失效，请重新登录')

        const res = await fetch(apiPath('/api/bazi-calibrate'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ profileId, prompt }),
        })

        const data = await res.json()
        if (data.error) throw new Error(data.error)

        const idx = baziProfiles.value.findIndex(p => p.id === profileId)
        if (idx !== -1) {
            const calibratedAt = new Date().toISOString()
            const { error: dbError } = await supabase
                .from('bazi_profiles')
                .update({
                    calibrated_yuanju_core: data.yuanju_core,
                    calibrated_current_dayun: data.current_dayun,
                    calibrated_current_liunian: data.current_liunian,
                    calibrated_at: calibratedAt,
                    calibrated_version: data.calibrated_version || null,
                })
                .eq('id', profileId)
            if (dbError) throw dbError
            baziProfiles.value[idx] = {
                ...baziProfiles.value[idx],
                calibrated_yuanju_core: data.yuanju_core,
                calibrated_current_dayun: data.current_dayun,
                calibrated_current_liunian: data.current_liunian,
                calibrated_at: calibratedAt,
                calibrated_version: data.calibrated_version || null,
            }
        }
    } catch (err) {
        throw err
    } finally {
        isCalibrating.value = false
    }
}

// 辅助方法
const formatShen = (shenArr) => {
    return shenArr && shenArr.length > 0 ? shenArr.join('<br>') : '-'
}

const formatXiJi = (val) => {
    if (!val) return '-';
    if (Array.isArray(val)) return val.length ? val.join('、') : '-';
    return val;
}

const selectedShensha = ref(null);
const showLeGuide = ref(false)
const leGuideMode = ref('events')
const showShensha = (shensha) => {
    selectedShensha.value = shensha;
};

const LE_GUIDE_CONTENT = {
    events: {
        title: '断事笔记是什么？',
        blocks: [
            {
                title: '命理初稿 vs 真实定盘',
                copy: 'AI 根据你的出生时刻推算出的喜忌，只是一份「初稿」。<br>真正准确的定盘，需要用你亲历的人生大事来验证和修正。',
            },
            {
                title: '怎么用',
                copy: '填入几个关键年份的真实大事（升职、失业、婚恋、大病、意外之财……），AI 会分析这些事件对应的五行能量，反推出更贴近你真实命局的喜忌神，并重新校准原局、大运、流年三段解读。',
            },
        ],
        exampleTitle: '举个例子',
        example: '初判说你喜水忌火，但你在丙午年（火旺之年）反而事业大爆发。这说明初判存在偏差。断事笔记会把这个信号告诉 AI，让它重新校准。',
        tip: '填 3～5 条最佳，选吉凶最明确的年份。极端事件比平淡年份更有参考价值。',
    },
    profile: {
        title: '长期基调是做什么的？',
        blocks: [
            {
                title: '它记录的是稳定背景',
                copy: '长期基调不是拿来判断这个月吉凶的，而是告诉系统：你现在大致处在怎样的人生阶段，比如工作状态、财务阶段、关系诉求、生活节奏。',
            },
            {
                title: '它怎么影响月运断语',
                copy: '同样一股月运，对找工作的人可能落在面试流程上，对在职的人则可能落在晋升、内耗或团队关系上。长期基调用来帮助 AI 判断这股势更可能落在哪条线上。',
            },
        ],
        exampleTitle: '举个例子',
        example: '如果你长期处于「在职观望、想转岗」阶段，那么事业月运就会更偏向解释岗位变化、上级关系和内部机会，而不是泛泛地说一句“事业有波动”。',
        tip: '这部分更新频率不用高，半年到一年修一次通常就够了。它只影响断语落点，不参与算分。',
    },
    monthly: {
        title: '月度基调是做什么的？',
        blocks: [
            {
                title: '它记录的是当月应事',
                copy: '月度基调用来写清楚「这个月到底在发生什么」：比如正在找工作、刚分手、资金有压力、睡眠很差，或者这个月最重要的目标与顾虑是什么。',
            },
            {
                title: '它为什么比长期基调更优先',
                copy: '因为月运本身就是阶段性节奏。系统会先参考当前月，再看近 3 个月是否有连续状态，这样断语才会更贴近你当下，而不是只按长期标签去解释。',
            },
        ],
        exampleTitle: '举个例子',
        example: '如果你这个月写了“正在面试中，最担心流程拖延”，那月运里出现的压力与窗口，就会更自然地落到 offer、反馈、谈判这些具体场景上。',
        tip: '这部分建议每个月更新一次。它只参与断语解释，不会改变命理算分高低。',
    },
}

const currentLeGuideContent = computed(() => LE_GUIDE_CONTENT[leGuideMode.value] || LE_GUIDE_CONTENT.events)
const openLeGuide = (mode = 'events') => {
    leGuideMode.value = mode
    showLeGuide.value = true
}
const showToast = (message, kind = 'success') => {
    toastMessage.value = message
    toastKind.value = kind
    showCenteredToast.value = true
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
        showCenteredToast.value = false
    }, 1800)
}
const cloneContextValue = (value) => JSON.parse(JSON.stringify(value))
const normalizeDiffText = (value) => String(value || '')
    .replace(/\s+/g, '')
    .replace(/[，。！？、,.!?;；:：“”"'‘’（）()【】[\]{}<>《》\-—_]/g, '')
    .trim()
const levenshteinDistance = (source, target) => {
    const a = normalizeDiffText(source)
    const b = normalizeDiffText(target)
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length
    const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
    for (let i = 0; i <= a.length; i++) rows[i][0] = i
    for (let j = 0; j <= b.length; j++) rows[0][j] = j
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            rows[i][j] = Math.min(
                rows[i - 1][j] + 1,
                rows[i][j - 1] + 1,
                rows[i - 1][j - 1] + cost
            )
        }
    }
    return rows[a.length][b.length]
}
const computeProfileContextRefreshSignal = (previous, next) => {
    const sections = PROFILE_CONTEXT_SECTIONS
    let changedFieldCount = 0
    let shouldRefresh = false
    for (const section of sections) {
        const prevSection = previous?.[section.storeKey] || {}
        const nextSection = next?.[section.storeKey] || {}
        for (const field of section.fields) {
            const prevVal = prevSection[field.key] || ''
            const nextVal = nextSection[field.key] || ''
            if (String(prevVal) === String(nextVal)) continue
            changedFieldCount += 1
            if (field.type === 'select') shouldRefresh = true
            if ((field.type === 'text' || field.type === 'textarea') && levenshteinDistance(prevVal, nextVal) >= 12) {
                shouldRefresh = true
            }
        }
    }
    if (changedFieldCount >= 2) shouldRefresh = true
    return shouldRefresh
}
const computeMonthlyContextRefreshSignal = (previous, next) => {
    const prevOverall = previous?.overall_note || ''
    const nextOverall = next?.overall_note || ''
    const overallDelta = levenshteinDistance(prevOverall, nextOverall)
    let changedFieldCount = overallDelta > 0 ? 1 : 0
    let shouldRefresh = overallDelta >= 20 || (!normalizeDiffText(prevOverall) && normalizeDiffText(nextOverall).length >= 20)

    for (const section of MONTHLY_CONTEXT_SECTIONS) {
        const prevSection = previous?.[section.storeKey] || {}
        const nextSection = next?.[section.storeKey] || {}
        if (String(prevSection.status || '') !== String(nextSection.status || '')) {
            changedFieldCount += 1
            shouldRefresh = true
        }
        for (const key of ['summary', 'goal', 'worry']) {
            const delta = levenshteinDistance(prevSection[key] || '', nextSection[key] || '')
            if (delta > 0) changedFieldCount += 1
            if (delta >= 12) shouldRefresh = true
        }
    }
    if (changedFieldCount >= 2) shouldRefresh = true
    return shouldRefresh
}
const queueMonthlyInterpretationRefresh = ({ scope = 'monthly', monthKey = '*' } = {}) => {
    if (!activeProfile.value || isGuest.value) return
    rememberMonthlyInterpretationRefresh(getFortuneStorage(), {
        profileId: activeProfile.value.id,
        monthKey,
        scope,
        changedAt: Date.now(),
        message: scope === 'profile' ? '长期基调有明显更新' : '月度基调有明显更新',
    })
}
const hasPreviousMonthlyContext = computed(() =>
    recentMonthlyContextRecords.value.some(item => item.month_key && item.month_key !== notesMonthKey.value)
)
const rerunButtonLabel = computed(() => {
    if (isAnalyzing.value) return '正在推演'
    if (needsUpgrade.value) return '生成排盘'
    if (isGuest.value) return '生成排盘'
    return '重新推演'
})


const SHI_SHEN = {
    "甲": { "甲": "比", "乙": "劫", "丙": "食", "丁": "伤", "戊": "才", "己": "财", "庚": "杀", "辛": "官", "壬": "枭", "癸": "印" },
    "乙": { "甲": "劫", "乙": "比", "丙": "伤", "丁": "食", "戊": "财", "己": "才", "庚": "官", "辛": "杀", "壬": "印", "癸": "枭" },
    "丙": { "甲": "枭", "乙": "印", "丙": "比", "丁": "劫", "戊": "食", "己": "伤", "庚": "才", "辛": "财", "壬": "杀", "癸": "官" },
    "丁": { "甲": "印", "乙": "枭", "丙": "劫", "丁": "比", "戊": "伤", "己": "食", "庚": "财", "辛": "才", "壬": "官", "癸": "杀" },
    "戊": { "甲": "杀", "乙": "官", "丙": "枭", "丁": "印", "戊": "比", "己": "劫", "庚": "食", "辛": "伤", "壬": "才", "癸": "财" },
    "己": { "甲": "官", "乙": "杀", "丙": "印", "丁": "枭", "戊": "劫", "己": "比", "庚": "伤", "辛": "食", "壬": "财", "癸": "才" },
    "庚": { "甲": "才", "乙": "财", "丙": "杀", "丁": "官", "戊": "枭", "己": "印", "庚": "比", "辛": "劫", "壬": "食", "癸": "伤" },
    "辛": { "甲": "财", "乙": "才", "丙": "官", "丁": "杀", "戊": "印", "己": "枭", "庚": "劫", "辛": "比", "壬": "伤", "癸": "食" },
    "壬": { "甲": "食", "乙": "伤", "丙": "才", "丁": "财", "戊": "杀", "己": "官", "庚": "枭", "辛": "印", "壬": "比", "癸": "劫" },
    "癸": { "甲": "伤", "乙": "食", "丙": "财", "丁": "才", "戊": "官", "己": "杀", "庚": "印", "辛": "枭", "壬": "劫", "癸": "比" }
};

const getShiShen = (dayGan, targetGan) => {
    if(!dayGan || !targetGan || !SHI_SHEN[dayGan]) return "";
    return SHI_SHEN[dayGan][targetGan] || "";
}

const getShenColor = (shen) => {
    if (['杀', '枭', '伤', '劫'].includes(shen)) return 'shen-red'; 
    if (['官', '印', '食', '财', '才', '比'].includes(shen)) return 'shen-green'; 
    return 'shen-gray';
}

</script>

<style scoped>
/* 此处的 CSS 已滤除你全局在 App.vue / global.css 里的样式，完全对应 Bazi 的局部卡片样式 */
.bazi-view { width: 100%; min-height: 100vh; position: relative; }

#siteHeader { position: fixed; top: 0; left: 0; right: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 14px 20px; height: 60px; background: var(--header-bg); border-bottom: 1px solid var(--line); }
.site-logo { font-family: 'Noto Serif SC', serif; font-size: 17px; letter-spacing: .15em; font-weight: 500; color: var(--gold); }
.header-actions { position: absolute; right: 20px; top: 50%; display: flex; align-items: center; gap: 8px; transform: translateY(-50%); }

.page-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 0 0 60px; }
.container { width: 100%; max-width: 520px; }

.glass-card { background: var(--bg-card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 14px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,.06); animation: riseIn 0.5s ease both; }
@keyframes riseIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(105%); } }

/* ── bottom-sheet Transition (bsheet) ── */
.bsheet-enter-active { transition: opacity .22s ease; }
.bsheet-leave-active { transition: opacity .18s ease; }
.bsheet-enter-from, .bsheet-leave-to { opacity: 0; }
.bsheet-enter-active .bsheet-inner { animation: slideUp .3s cubic-bezier(.32,.72,0,1) both; }
.bsheet-leave-active .bsheet-inner { animation: slideDown .2s ease-in both; }

.profile-card { position: relative; z-index: 40; padding: 16px; overflow: visible; }
.profile-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-kicker { color: var(--gold); font-size: 10px; letter-spacing: 2px; margin-bottom: 4px; }
.section-title { color: var(--text-primary); font-size: 14px; font-weight: 600; }
.default-chip { color: #101018; background: linear-gradient(135deg, var(--gold-light), var(--gold)); border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 700; }

.profile-filter-row { display: grid; grid-template-columns: minmax(0, 1fr) 48px; gap: 8px; align-items: stretch; margin-bottom: 10px; }
.profile-switcher { position: relative; z-index: 60; min-width: 0; }
.profile-switch-trigger { width: 100%; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 12px; border: none; border-radius: 14px; background: var(--paper-soft); color: var(--ink); cursor: pointer; box-shadow: inset 0 0 0 1px var(--line); padding: 8px 12px; }
.profile-switch-trigger:disabled { opacity: .68; cursor: default; }
.profile-switch-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-serif); font-size: 20px; letter-spacing: 1px; line-height: 1.15; }
.profile-switch-symbol { color: var(--gold); font-size: 21px; line-height: 1; opacity: .92; }
.profile-switcher.open .profile-switch-trigger { box-shadow: inset 0 0 0 1px var(--gold-border); }
.profile-flyout { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 120; padding: 8px; border-radius: 16px; background: var(--bg-card); border: 1px solid var(--line); box-shadow: 0 12px 36px rgba(0,0,0,.12); }
.profile-flyout-item { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-radius: 12px; background: transparent; color: var(--text-primary); cursor: pointer; text-align: left; }
.profile-flyout-item + .profile-flyout-item { margin-top: 4px; }
.profile-flyout-item.active { background: var(--gold-dim); box-shadow: inset 0 0 0 1px var(--gold-border); }
.profile-item-main { font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-item-date { color: #FF5E57; font-size: 12px; white-space: nowrap; }
.profile-item-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.icon-btn { width: 48px; min-height: 48px; height: 100%; border-radius: 14px; border: 1px solid var(--gold-border); background: var(--gold-dim); color: var(--gold); font-size: 22px; line-height: 1; cursor: pointer; }
.guest-limit-note {
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.65;
    margin: 10px 0 2px;
    padding: 0;
    border: 0;
    background: transparent;
}
.profile-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.mini-action { min-height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--paper-soft); color: var(--ink-muted); font-size: 12px; cursor: pointer; white-space: nowrap; }
.mini-action:disabled { cursor: default; color: var(--gold); border-color: var(--gold-border); background: var(--gold-dim); }
.mini-action.danger { color: var(--crimson); }
.mini-action--subtle { color: var(--ink-dim); border-color: var(--line); background: var(--paper-soft); }
.btn-ghost { min-height: 36px; background: rgba(212,175,55,0.12); color: var(--gold-light); border: 1px solid rgba(232,204,128,0.35); padding: 0 14px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all .2s; white-space: nowrap; }
.btn-ghost:hover { background: var(--gold); color: #000; }
.btn-ghost:disabled { opacity: .7; cursor: default; }
.btn-compact { min-height: 34px; padding: 0 12px; font-size: 12px; }
.btn-danger { background: rgba(255,94,87,0.1); color: #FF5E57; border: 1px solid rgba(255,94,87,0.3); border-radius: 8px; padding: 0 10px; cursor: pointer; }
.btn-primary { background: linear-gradient(135deg, var(--gold-light), var(--gold)); color: #08080E; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-weight: 700; font-family: var(--font-body); box-shadow: 0 2px 10px rgba(212,175,55,0.26); transition: transform 0.2s; white-space: nowrap; }
.btn-primary:active { transform: scale(0.95); }
.btn-primary:disabled { opacity: .7; cursor: wait; }

.profile-form { background: var(--paper-soft); padding: 14px; border-radius: 12px; border: 1px dashed var(--gold-border); margin-top: 10px; }
.rename-form { margin-bottom: 2px; }
.form-row { display: flex; gap: 12px; margin-bottom: 12px; }
.form-row input, .form-row select { flex: 1; padding: 10px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--line); color: var(--ink); outline: none; font-family: var(--font-body); }
.form-actions { display:flex; justify-content:flex-end; gap:8px; }

.picker-overlay {
    box-sizing: border-box;
    padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
    align-items: flex-end;
    justify-content: center;
}
.profile-picker-modal {
    box-sizing: border-box;
    position: relative;
    width: min(100%, 620px);
    max-height: min(92dvh, 760px);
    overflow: auto;
    overscroll-behavior: contain;
    border-radius: 24px;
    border: 1px solid var(--line);
    background: var(--bg-card);
    box-shadow: 0 24px 72px rgba(0,0,0,0.15);
    padding: 18px;
    color: var(--text-primary);
    animation: pickerSheetIn .24s ease both;
}
.picker-sheet-handle {
    width: 42px;
    height: 4px;
    border-radius: 999px;
    background: var(--line);
    margin: 0 auto 14px;
}
.picker-topbar {
    display: grid;
    grid-template-columns: minmax(118px, .8fr) minmax(190px, 1.2fr) 40px;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}
.picker-topcopy { min-width: 0; }
.picker-heading { color: var(--ink); font-size: 16px; font-weight: 700; }
.picker-mode-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
}
.picker-mode-tab {
    min-height: 40px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-dim);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background .2s ease, color .15s ease, box-shadow .2s ease;
}
.picker-mode-tab.active {
    background: linear-gradient(135deg, rgba(232,204,128,0.94), rgba(212,175,55,0.94));
    color: #111114;
    box-shadow: 0 4px 12px rgba(212,175,55,0.18);
}
.picker-close.dark {
    position: relative;
    z-index: 2;
    justify-self: end;
    background: var(--paper-soft);
    color: var(--ink-muted);
    border-color: var(--line);
}
.picker-form-row {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(150px, .7fr);
    gap: 14px;
    margin-bottom: 14px;
}
.picker-text-field,
.picker-gender-field {
    min-width: 0;
}
.picker-text-field span,
.picker-gender-field > span {
    display: block;
    margin-bottom: 8px;
    color: var(--ink-muted);
    font-size: 12px;
    font-weight: 700;
}
.picker-text-field input {
    width: 100%;
    min-height: 44px;
    border: none;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    padding: 0 2px;
    font-size: 14px;
    outline: none;
}
.picker-text-field input:focus {
    border-color: var(--gold);
}
.gender-segment {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    min-height: 44px;
    border-bottom: 1px solid var(--line);
}
.gender-segment button {
    border: none;
    background: transparent;
    color: var(--ink-dim);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
}
.gender-segment button.active {
    color: var(--ink);
    box-shadow: inset 0 -2px 0 var(--gold);
}
.picker-panel {
    border-top: 1px solid var(--line);
    padding-top: 14px;
}
.picker-column { display: flex; flex-direction: column; gap: 8px; }
.picker-column-label {
    text-align: left;
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 700;
}
.picker-preview-card {
    border-radius: 16px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
    padding: 12px 14px;
    color: var(--ink-muted);
    line-height: 1.7;
    font-size: 13px;
}
.picker-preview-card.muted { color: var(--ink-dim); }
.date-input-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 14px;
}
.date-input-card {
    border-radius: 18px;
    border: 1px solid var(--line);
    background: var(--paper-soft);
    padding: 14px;
}
.location-search-card {
    min-width: 0;
    position: relative;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 13px 0 12px;
}
.location-search-field span {
    display: block;
    margin-bottom: 8px;
    color: var(--ink-muted);
    font-size: 12px;
    font-weight: 700;
}
.location-search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 48px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg-card);
    padding: 0 12px;
}
.location-search-input-wrap svg {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    color: var(--ink-dim);
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.location-search-input-wrap input {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--ink);
    font-size: 14px;
    outline: none;
}
.location-search-input-wrap:focus-within {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold-border);
}
.location-clear-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: var(--line);
    color: var(--ink-muted);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
}
.location-result-list {
    margin-top: 10px;
    max-height: 252px;
    overflow: auto;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
}
.location-result-item {
    width: 100%;
    display: grid;
    gap: 3px;
    padding: 13px 2px;
    border: none;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
}
.location-result-item:last-child { border-bottom: none; }
.location-result-item span {
    font-size: 15px;
    font-weight: 700;
}
.location-result-item small {
    color: var(--ink-dim);
    font-size: 11px;
}
.location-result-item:hover {
    color: var(--gold);
}
.location-empty {
    padding: 16px 2px;
    color: var(--ink-dim);
    font-size: 13px;
}
.time-toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 13px;
}
.time-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    color: var(--ink-dim);
    font-size: 13px;
    font-weight: 700;
}
.time-check input {
    width: 18px;
    height: 18px;
    accent-color: var(--gold);
}
.time-check.active {
    color: var(--ink);
}
.time-check.disabled {
    opacity: .62;
}
.date-input-label {
    display: block;
    margin-bottom: 10px;
    color: var(--ink);
    font-size: 15px;
    font-weight: 700;
}
.date-input-card input {
    width: 100%;
    min-height: 54px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--bg-card);
    color: var(--ink);
    padding: 0 16px;
    font-size: 21px;
    letter-spacing: 0.14em;
    outline: none;
}
.date-input-card input::placeholder {
    color: var(--ink-dim);
    letter-spacing: normal;
    font-size: 15px;
}
.date-input-card input:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold-border);
}
.date-input-hint {
    margin-top: 10px;
    color: var(--ink-dim);
    font-size: 12px;
    line-height: 1.6;
}
.date-segment-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
}
.date-segment {
    min-width: 0;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--paper-soft);
    padding: 12px 6px;
    text-align: center;
}
.date-segment span {
    display: block;
    margin-bottom: 6px;
    color: var(--ink-dim);
    font-size: 11px;
    letter-spacing: 1px;
}
.date-segment strong {
    display: block;
    color: var(--ink);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.06em;
}
.pillar-slot-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
}
.pillar-slot {
    min-height: 104px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: var(--paper-soft);
    color: var(--ink-muted);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
.pillar-slot.derived {
    background: var(--bg-card);
}
.pillar-slot.active {
    border-color: var(--gold-border);
    background: var(--gold-dim);
    box-shadow: inset 0 0 0 1px var(--gold-border);
}
.slot-label {
    font-size: 14px;
    color: var(--ink-dim);
    font-weight: 700;
}
.slot-value {
    font-size: 26px;
    color: var(--ink);
    font-family: var(--font-ganzhi);
    font-weight: 600;
}
.pillar-choice-panel {
    border-radius: 24px;
    border: 1px solid var(--line);
    background: var(--paper-soft);
    padding: 14px;
    margin-bottom: 14px;
}
.pillar-choice-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}
.pillar-orb-current {
    color: var(--gold-light);
    font-size: 20px;
    font-family: var(--font-ganzhi);
    letter-spacing: 2px;
}
.pillar-rule-tip {
    margin-bottom: 12px;
    color: var(--ink-dim);
    font-size: 12px;
    line-height: 1.6;
}
.orb-title {
    color: var(--ink-muted);
    font-size: 12px;
    letter-spacing: 1px;
    margin-bottom: 10px;
}
.choice-chip-grid {
    display: grid;
    gap: 12px;
}
.choice-chip-grid-gz { grid-template-columns: repeat(5, 1fr); }
.choice-chip-grid-zhi { grid-template-columns: repeat(6, 1fr); }
.choice-chip {
    min-height: 58px;
    border-radius: 18px;
    border: 1px solid var(--line);
    background: var(--bg-card);
    font-size: 24px;
    font-weight: 700;
    font-family: var(--font-ganzhi);
    color: var(--ink);
    cursor: pointer;
}
.choice-chip.active {
    border-color: var(--gold-border);
    background: var(--gold-dim);
    box-shadow: inset 0 0 0 1px var(--gold-border);
}
.choice-chip.disabled {
    opacity: .36;
}
.picker-save-btn {
    width: 100%;
    min-height: 64px;
    margin-top: 18px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(232,204,128,0.95), rgba(212,175,55,0.95));
    color: #111114;
    font-size: 18px;
    font-weight: 800;
    cursor: pointer;
    position: sticky;
    bottom: 0;
    z-index: 3;
}
@keyframes pickerSheetIn {
    from { transform: translateY(18px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

@media (min-width: 780px) {
    .picker-overlay {
        align-items: stretch;
        justify-content: flex-end;
        padding: 0;
    }
    .profile-picker-modal {
        width: min(520px, 44vw);
        max-height: 100dvh;
        min-height: 100dvh;
        border-radius: 24px 0 0 24px;
        border-top: none;
        border-right: none;
        border-bottom: none;
        padding: 22px 22px 24px;
        animation: pickerDrawerIn .24s ease both;
    }
    .picker-sheet-handle {
        display: none;
    }
}
@keyframes pickerDrawerIn {
    from { transform: translateX(22px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

.bazi-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 14px; }
.bazi-header-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.bazi-name { font-family: var(--font-serif); font-size: 20px; color: var(--gold); letter-spacing: 2px; font-weight: bold; }
.bazi-meta { font-size: 11px; color: var(--text-muted); line-height: 1.6; margin-top: 2px; }

.badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: var(--font-body); letter-spacing: 1px; font-weight: 500; }
.badge-gold { background: rgba(212,175,55,0.15); color: var(--gold-light); border: 1px solid rgba(212,175,55,0.3); }
.badge-blue { background: rgba(78, 205, 196, 0.15); color: #4ECDC4; border: 1px solid rgba(78, 205, 196, 0.3); }
.badge-action { cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
.badge-action:hover, .badge-action:focus-visible { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(78,205,196,0.12); outline: none; }
.pattern-tag { font-size: 10px; color: #E8CC80; background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.2); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-right: 4px; margin-top: 4px; }

.analysis-status { position: relative; display: flex; align-items: center; gap: 12px; overflow: hidden; margin: -2px 0 14px; padding: 12px; border: 1px solid var(--gold-border); border-radius: 12px; background: var(--gold-dim); }
.analysis-status.done { border-color: rgba(13,148,136,0.22); background: rgba(13,148,136,0.07); }
.loader-orbit { position: relative; width: 30px; height: 30px; flex: 0 0 30px; border: 1px solid rgba(232,204,128,0.25); border-radius: 50%; animation: spin 1.6s linear infinite; }
.loader-orbit span { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--gold-light); box-shadow: 0 0 10px rgba(232,204,128,.65); }
.loader-orbit span:nth-child(1) { top: -3px; left: 12px; }
.loader-orbit span:nth-child(2) { right: 0; bottom: 4px; opacity: .7; }
.loader-orbit span:nth-child(3) { left: 1px; bottom: 5px; opacity: .45; }
.analysis-copy { min-width: 0; flex: 1; }
.analysis-title { color: var(--ink); font-size: 13px; font-weight: 700; margin-bottom: 3px; }
.analysis-subtitle { color: var(--text-muted); font-size: 11px; }
.analysis-dismiss {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 50%;
    background: rgba(13,148,136,0.10);
    color: var(--ink-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}
.analysis-dismiss:hover {
    color: var(--ink);
    background: rgba(13,148,136,0.16);
}
.analysis-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--line); }
.analysis-progress i { display: block; height: 100%; background: linear-gradient(90deg, var(--gold), var(--teal)); transition: width .55s ease; }
@keyframes spin { to { transform: rotate(360deg); } }

.tabs { display: flex; align-items: center; gap: 20px; margin-bottom: 12px; }
.tab { font-size: 13px; color: var(--text-muted); cursor: pointer; padding: 0 0 6px; border: 0; border-bottom: 2px solid transparent; background: transparent; transition: all 0.3s; }
.tab.active { color: var(--gold); border-bottom-color: var(--gold); font-weight: 500; }
.life-events-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-body);
}
.life-events-tab-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold) 28%, transparent);
    color: var(--gold-light);
    font-size: 10px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.bazi-table-wrap { width: 100%; overflow: hidden; }
.bazi-table {
    --bz-cell-py: 8px;
    --bz-label-size: 12px;
    --bz-meta-size: 12px;
    --bz-char-size: 18px;
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
    text-align: center;
}
.bazi-table th, .bazi-table td { padding: var(--bz-cell-py) 0; border-bottom: 1px solid var(--line); vertical-align: middle; word-wrap: break-word; }
.bazi-table th { color: var(--gold); font-family: var(--font-serif); font-size: 13px; font-weight: normal; letter-spacing: 1px; }
.bazi-table th:first-child, .bazi-table td:first-child { width: 48px; }

.bz-label { color: var(--ink-muted); font-weight: 500; font-size: var(--bz-label-size); }
.bz-star { font-size: var(--bz-meta-size); color: var(--ink); }
.bz-char { font-size: var(--bz-char-size); font-weight: 600; font-family: var(--font-ganzhi); margin: 2px 0; }
.bz-sub { font-size: var(--bz-meta-size); color: var(--ink-muted); line-height: 1.4; }
.bz-shensha { font-size: 11px; color: #7c5cbf; line-height: 1.4; }
.wx-jin { color: #E8CC80; } .wx-mu { color: #81C784; } .wx-shui { color: #64B5F6; } .wx-huo { color: #E57373; } .wx-tu { color: #DCE775; } .wx-none { color: #666; }

.timeline-section { margin-top: 16px; border-top: 1px dashed var(--line); padding-top: 16px; }
.timeline-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.timeline-title { font-size: 14px; color: var(--gold); margin-bottom: 0; font-family: var(--font-serif); text-align: center; font-weight: 500; }
.timeline-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.timeline-icon-btn { width: 30px; height: 30px; border-radius: 999px; border: 1px solid var(--line); background: var(--paper-soft); color: var(--gold); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.timeline-icon-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.timeline-icon-btn.accent { background: var(--gold-dim); border-color: var(--gold-border); }

.linkage-row { display: flex; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-card); overflow: hidden; }
.row-label { width: 36px; display: flex; align-items: center; justify-content: center; background: var(--gold-dim); color: var(--gold); font-size: 12px; text-align: center; font-weight: 500; border-right: 1px solid var(--line); flex-shrink: 0; line-height: 1.3; }
.row-content { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; padding: 4px; flex: 1; scroll-snap-type: x proximity; }
.row-content::-webkit-scrollbar { display: none; }

.link-item { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 58px; padding: 6px 4px; border-radius: 8px; cursor: pointer; transition: all 0.2s; flex-shrink: 0; border: 1px solid transparent; scroll-snap-align: center; }
.link-item.active { background: var(--gold-dim); border-color: var(--gold-border); }
.lr-item { min-width: 52px; }

.item-header { font-size: 10px; color: var(--ink-dim); margin-bottom: 5px; text-align: center; line-height: 1.35; min-height: 28px; display: flex; align-items: center; justify-content: center; }
.item-body { display: flex; flex-direction: row; gap: 4px; align-items: center; justify-content: center; flex-wrap: nowrap; min-height: 22px; }
.stacked-ganzhi { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.xiaoyun-body { font-size: 14px; color: var(--ink-dim); margin-top: 8px; }

.char-wrap { position: relative; display: flex; align-items: center; justify-content: center; width: 18px; min-width: 18px; height: 20px; padding-right: 8px; flex: 0 0 auto; }
.stacked-ganzhi .char-wrap { width: 100%; min-width: 0; height: 19px; padding-right: 10px; }
.char-gan, .char-zhi { font-size: 16px; font-family: var(--font-ganzhi); font-weight: 600; line-height: 1;}
.fortune-guide-card { margin-top: 12px; padding: 14px; border-radius: 14px; border: 1px solid var(--gold-border); background: var(--gold-dim); display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative; overflow: hidden; }
.fortune-guide-card.masked::after { content: ''; position: absolute; inset: 0; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); background: rgba(var(--paper-rgb), 0.72); pointer-events: none; }
.fortune-guide-title { color: var(--gold); font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.fortune-guide-copy { color: var(--ink-muted); font-size: 12px; line-height: 1.6; }
.fortune-guide-btn { flex-shrink: 0; min-height: 34px; padding: 0 12px; border: 1px solid var(--gold-border); border-radius: 999px; background: var(--bg-card); color: var(--gold); font-size: 12px; font-weight: 700; cursor: pointer; }

.shi-shen { position: absolute; right: -14px; top: -1px; font-size: 9px; padding: 1px 3px; border-radius: 3px; font-weight: 500; }
.shen-red { color: #FF5E57; background: rgba(255,94,87,0.15); }
.shen-green { color: #81C784; background: rgba(129,199,132,0.15); }
.shen-gold { color: #E8CC80; background: rgba(232,204,128,0.15); }

/* 神煞与弹窗 */
.clickable-shensha { display: block; cursor: pointer; padding: 1px 4px; border-radius: 4px; transition: background 0.2s; margin: 1px 0; white-space: nowrap; }
.clickable-shensha:hover { background: rgba(212,175,55,0.2); color: var(--gold-light) !important; }
.ss-吉 { color: #68D391; }
.ss-中性 { color: #B39DDB; }
.ss-凶 { color: #FC8181; }
/* ── Bottom Sheet overlay（所有小 i 弹出均从底部滑出）──────── */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
.modal-overlay.picker-overlay {
    align-items: flex-end;
    justify-content: center;
}
@media (min-width: 780px) {
    .modal-overlay.picker-overlay {
        align-items: stretch;
        justify-content: flex-end;
        padding: 0;
    }
}
.shensha-modal { background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 20px 20px 0 0; padding: 24px 20px 32px; width: 100%; max-width: 560px; box-shadow: 0 -4px 40px rgba(0,0,0,0.25); }
.shensha-modal h4 { color: var(--gold); font-size: 16px; margin: 0; font-family: var(--font-serif); }
.shensha-modal p { font-size: 13px; color: var(--ink-muted); line-height: 1.6; }
.shensha-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px dashed rgba(212,175,55,0.3); padding-bottom: 10px; margin-bottom: 10px; }
.shensha-nature-badge { font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
.nature-吉 { background: rgba(72,187,120,0.18); color: #68D391; border: 1px solid rgba(72,187,120,0.4); }
.nature-凶 { background: rgba(245,101,101,0.18); color: #FC8181; border: 1px solid rgba(245,101,101,0.4); }
.nature-中性 { background: rgba(160,160,180,0.15); color: #CBD5E0; border: 1px solid rgba(160,160,180,0.3); }
.shensha-summary { font-size: 13px; color: var(--ink-muted); line-height: 1.7; margin: 0 0 10px; }
.shensha-section { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.65; padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; }
.shensha-section-label { font-weight: 700; letter-spacing: 1px; flex-shrink: 0; font-size: 11px; padding-top: 1px; }
.shensha-ji { background: rgba(72,187,120,0.1); color: #276749; }
.shensha-ji .shensha-section-label { color: #276749; }
.shensha-xiong { background: rgba(245,101,101,0.08); color: #9b2c2c; }
.shensha-xiong .shensha-section-label { color: #c53030; }
.shensha-note { background: rgba(212,175,55,0.08); color: #7b5e0a; }
.shensha-note .shensha-section-label { color: #b7791f; }
.guest-login-modal { position: relative; width: 100%; max-width: 560px; padding: 24px 22px 36px; border-radius: 20px 20px 0 0; border: 1px solid var(--line); background: var(--bg-card); box-shadow: 0 -4px 40px rgba(0,0,0,.15); }
.guest-login-kicker { color: var(--text-muted); font-size: 11px; letter-spacing: 2px; margin-bottom: 8px; }
.guest-login-modal h3 { margin: 0 0 10px; color: var(--gold); font-family: var(--font-serif); font-size: 18px; line-height: 1.45; }
.guest-login-modal p { margin: 0; color: var(--ink-muted); font-size: 13px; line-height: 1.8; }
.guest-login-modal a { color: #2563eb; text-decoration: none; border-bottom: 1px solid rgba(37,99,235,0.3); }
.guest-login-modal a:hover { color: #1d4ed8; border-bottom-color: rgba(29,78,216,0.6); }
.guest-login-close { position: absolute; right: 12px; top: 12px; }

/* 关系可视化面板已经移除旧版CSS */

.ai-section { margin-top: 16px; animation: riseIn 0.5s ease both; }
.insight-summary { margin-bottom: 16px; }
.ai-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.ai-header-title { font-family: var(--font-serif); color: var(--gold); font-size: 15px; display: flex; align-items: center; gap: 6px; }
.ai-section > .ai-header-title { margin-bottom: 12px; }
.ai-header-title::before { content: '✧'; font-size: 12px; }
.info-button, .close-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(232,204,128,0.28); background: rgba(232,204,128,0.08); color: var(--gold-light); cursor: pointer; }
.info-button { width: 26px; height: 26px; border-radius: 50%; font-family: var(--font-display); font-style: italic; font-weight: 700; }
.close-button { width: 32px; height: 32px; border-radius: 8px; font-size: 22px; line-height: 1; }

/* ── 天机锦囊 五神行 ─────────────────────────────── */
.jinnang-summary-line { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; letter-spacing: 0.4px; }
.five-shen-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.five-shen-cell { border-radius: 8px; padding: 7px 10px; text-align: center; min-width: 54px; border: 1px solid transparent; flex-shrink: 0; }
.five-shen-cell.is-yong { background: rgba(232,204,128,0.12); border-color: rgba(232,204,128,0.3); }
.five-shen-cell.is-xi   { background: rgba(129,199,132,0.08); border-color: rgba(129,199,132,0.2); }
.five-shen-cell.is-ji   { background: rgba(229,115,115,0.08); border-color: rgba(229,115,115,0.25); }
.five-shen-cell.is-chou { background: rgba(200,70,70,0.07);   border-color: rgba(200,70,70,0.2); }
.five-shen-cell.is-xian { background: var(--paper-soft); border-color: var(--line); }
.five-shen-role { font-size: 9px; color: var(--text-muted); margin-bottom: 3px; }
.five-shen-name { font-size: 12px; font-weight: 500; }
.five-shen-cell.is-yong .five-shen-name { color: var(--gold); }
.five-shen-cell.is-xi   .five-shen-name { color: #81C784; }
.five-shen-cell.is-ji   .five-shen-name { color: #E57373; }
.five-shen-cell.is-chou .five-shen-name { color: #ef9a9a; }
.five-shen-cell.is-xian .five-shen-name { color: var(--text-muted); }
.five-shen-note { font-size: 9px; color: var(--text-muted); margin-top: 2px; }
/* ── 锦囊断语块 ─────────────────────────────────── */
.jinnang-block { padding: 10px 0; border-bottom: 1px solid var(--line); }
.jinnang-block:last-of-type { border-bottom: none; margin-bottom: 8px; }
.jinnang-block-warn .jinnang-block-label { color: #E57373; opacity: 0.85; }
.jinnang-block-label { font-size: 10px; color: var(--gold); opacity: 0.75; margin-bottom: 4px; letter-spacing: 0.5px; }
.jinnang-block-text { font-size: 14px; color: var(--ink); line-height: 1.65; margin: 0; }
/* ── Scoring modal 决策链 + 新角色标签 ──────────── */
.tag-action {
    cursor: pointer;
    transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
}
.tag-action:hover, .tag-action:focus-visible {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(212,175,55,0.12);
    outline: none;
}
/* 旺衰格局 label 覆盖色 */
.wangshui-label {
    color: var(--gold);
    background: rgba(232,204,128,0.13);
    border-color: rgba(232,204,128,0.32);
}
.geju-label {
    color: #9fd3c7;
    background: rgba(111,188,186,0.1);
    border-color: rgba(111,188,186,0.25);
}
.decision-chain-list { margin-bottom: 16px; padding: 10px 12px; background: var(--paper-soft); border-radius: 10px; border: 1px solid var(--line); }
.decision-chain-item { padding: 6px 0; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 2px; }
.decision-chain-item:last-child { border-bottom: none; }
.decision-layer { font-size: 10px; color: var(--gold); opacity: 0.8; }
.decision-reason { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
.decision-override { font-size: 10px; color: #E57373; }
.scoring-section-title { font-size: 11px; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 10px; }
.shen-role-tag { font-size: 10px; color: var(--text-muted); margin-left: 4px; }
.scoring-item.scoring-yong-item { border-left-color: var(--gold); }
.scoring-item.chou-item { border-left-color: #ef9a9a; }
.shen-badge.shen-yong { background: rgba(232,204,128,0.12); color: var(--gold); }
.shen-badge.shen-chou { background: rgba(200,70,70,0.1); color: #ef9a9a; }
.scoring-detail-drawer .insight-scroll-body {
    padding-top: 10px;
}
.scoring-prose-list + .scoring-prose-list {
    border-top: 1px solid var(--line);
    margin-top: 2px;
}
.scoring-overview-head {
    padding-top: 12px;
}
.scoring-section-heading .insight-prose-label {
    font-size: 17px;
    line-height: 1.45;
}
.scoring-prose-item .insight-prose-head {
    margin-bottom: 8px;
}
.scoring-override {
    color: var(--crimson);
}
.scoring-role-yong { color: var(--gold); }
.scoring-role-xi { color: #2e7d32; }
.scoring-role-ji,
.scoring-role-chou { color: #c62828; }
.scoring-inline-dims {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
}
.scoring-inline-dim {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    min-height: 22px;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 13px;
    line-height: 1.5;
}
.scoring-inline-dim span {
    color: var(--ink-muted);
}
.scoring-inline-dim strong {
    font-weight: 800;
}
.scoring-inline-dim.dim-pos strong {
    color: #2e7d32;
}
.scoring-inline-dim.dim-neg strong {
    color: #c62828;
}

.xiji-box { display: flex; gap: 8px; margin-bottom: 14px; }
.xiji-item { flex: 1; background: var(--paper-soft); border: 1px solid var(--line); border-radius: 10px; padding: 10px; text-align: center; }
.xiji-label { font-size: 10px; color: var(--text-muted); margin-bottom: 4px; }
.xiji-val { font-weight: 500; font-size: 13px; }
.xiji-val.favorable { color: #81C784; }
.xiji-val.unfavorable { color: #E57373; }

.insight-card { background: var(--bg-card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.insight-card h4 { color: var(--gold); font-size: 12px; margin-bottom: 8px; font-family: var(--font-body); border-bottom: 1px dashed var(--gold-border); padding-bottom: 6px; }
.insight-card p { line-height: 1.65; font-size: 14px; color: var(--ink); }
.tiaohou-card {
    border-color: rgba(111, 188, 186, 0.22);
    background: linear-gradient(180deg, rgba(111, 188, 186, 0.08) 0%, rgba(232,204,128,0.035) 100%);
}
.tiaohou-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}
.tiaohou-card-head h4 {
    margin: 0;
}
.tiaohou-urgency {
    flex: 0 0 auto;
    min-width: 44px;
    text-align: center;
    border-radius: 999px;
    padding: 4px 9px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid rgba(255,255,255,0.12);
}
.tiaohou-urgency.is-high {
    color: #ffb5a6;
    background: rgba(229, 115, 115, 0.12);
    border-color: rgba(229, 115, 115, 0.28);
}
.tiaohou-urgency.is-mid {
    color: #f1dfae;
    background: rgba(232, 204, 128, 0.12);
    border-color: rgba(232, 204, 128, 0.25);
}
.tiaohou-urgency.is-low {
    color: #9fd3c7;
    background: rgba(111, 188, 186, 0.12);
    border-color: rgba(111, 188, 186, 0.24);
}
.tiaohou-god-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
}
.tiaohou-god-cell {
    min-width: 0;
    padding: 9px 10px;
    border-radius: 10px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
}
.tiaohou-god-cell span {
    display: block;
    margin-bottom: 4px;
    color: var(--text-muted);
    font-size: 10px;
}
.tiaohou-god-cell strong {
    display: block;
    color: var(--ink);
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
}
.tiaohou-warning {
    margin-top: 10px;
    padding: 9px 10px;
    border-radius: 10px;
    border: 1px solid rgba(229, 115, 115, 0.2);
    background: rgba(229, 115, 115, 0.08);
    color: #f0c0b8;
    font-size: 12px;
    line-height: 1.6;
}
.tiaohou-card-head-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.tiaohou-modal-urgency-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.tiaohou-urgency-label {
    font-size: 11px;
    color: var(--text-muted);
}
.tiaohou-modal-grid {
    margin-bottom: 16px;
}
.tiaohou-modal-warning {
    margin-top: 12px;
}
.feedback-correction-block {
    margin-top: 12px;
    padding: 11px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--teal) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--teal) 18%, var(--glass-border));
}
.feedback-correction-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
    color: var(--teal);
    font-size: 11px;
    font-weight: 700;
}
.feedback-correction-date {
    color: var(--text-muted);
    font-weight: 500;
}
.feedback-correction-copy,
.feedback-correction-line {
    white-space: pre-line;
    line-height: 1.8;
    color: var(--text-primary);
    font-size: 12px;
}
.feedback-correction-line + .feedback-correction-line {
    margin-top: 8px;
}
.feedback-correction-line strong {
    color: var(--teal);
    font-weight: 700;
}
.calibrated-badge {
    margin-left: auto;
    font-size: 11px;
    color: var(--gold-light);
    background: color-mix(in srgb, var(--gold) 10%, transparent);
    border: 1px solid var(--gold-border);
    border-radius: 999px;
    padding: 2px 10px;
}
.tag-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.verdict-line { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--gold-border); min-width: 0; }
.verdict-line span { display: block; flex: 0 0 auto; color: var(--gold); font-size: 11px; margin-bottom: 0; white-space: nowrap; }
.verdict-line p { flex: 1; min-width: 0; color: var(--ink); font-size: 14px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.overload-tag { color: #FF8F88; font-size: 12px; animation: pulse 1.5s infinite; }

.legacy-summary { background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: 12px; padding: 14px; font-size: 12px; color: var(--ink-muted); line-height: 1.8; white-space: pre-wrap; margin-top: 16px; }

.classic-verdict-section {
    border: 1px solid var(--gold-border);
    border-radius: 12px;
    padding: 14px;
    background: var(--gold-dim);
}
.classic-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 10px;
    margin-bottom: 12px;
    border-bottom: 1px dashed var(--gold-border);
}
.classic-main-title {
    margin-bottom: 6px;
}
.classic-subtitle {
    color: var(--gold-light);
    font-size: 13px;
    font-family: 'Noto Serif SC', var(--font-serif);
    font-weight: 400;
    letter-spacing: 1px;
    opacity: .86;
}
.classic-key {
    flex-shrink: 0;
    color: #0B0B12;
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 600;
}
.classic-body {
    display: flex;
    flex-direction: column;
    gap: 9px;
}
.classic-body p {
    margin: 0;
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.75;
    font-family: var(--font-body);
}
.classic-body p.note {
    color: var(--text-muted);
    font-size: 12px;
    font-family: var(--font-body);
    padding-left: 10px;
    border-left: 2px solid var(--gold-border);
}

/* ── Article-style report sections ─────────────────────── */
.rpt-section {
    padding-top: 28px;
    margin-top: 24px;
    border-top: 1px solid var(--line);
}
.rpt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}
.rpt-head-left {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.rpt-kicker {
    font-family: var(--font-serif);
    font-size: 20px;
    line-height: 1.25;
    letter-spacing: 1px;
    text-transform: none;
    font-weight: 700;
    color: var(--gold);
}
.rpt-h2 {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 6px;
    line-height: 1.25;
    letter-spacing: -0.3px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}
.rpt-h2-tag {
    cursor: pointer;
    color: var(--gold);
    transition: opacity .15s;
}
.rpt-h2-tag:hover { opacity: .75; }
.rpt-h2-sep { color: var(--line); font-weight: 300; }
.rpt-h2-badge {
    font-size: 13px;
    color: #2e7d4a;
    font-weight: 500;
    background: rgba(46,125,74,0.08);
    border: 1px solid rgba(46,125,74,0.18);
    padding: 1px 8px;
    border-radius: 4px;
    font-family: var(--font-body);
}
.rpt-byline {
    font-size: 12px;
    color: var(--ink-muted);
    margin: 0 0 12px;
    line-height: 1.6;
}
.rpt-prose {
    font-size: 14px;
    color: var(--ink);
    line-height: 1.72;
    margin: 0 0 10px;
}
.rpt-prose-warn { color: var(--crimson, #c62828); opacity: 0.85; }
.bazi-stream-badge {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    font-size: 11px;
    color: var(--gold);
    opacity: 0.84;
}
.bazi-stream-prose.streaming {
    border-left: 2px solid rgba(201, 166, 107, 0.38);
    padding-left: 10px;
}
.bazi-section-skeleton {
    display: grid;
    gap: 7px;
    margin-top: 10px;
    max-width: 680px;
}
.bazi-section-skeleton i {
    display: block;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(201,166,107,0.12), rgba(201,166,107,0.28), rgba(201,166,107,0.12));
    background-size: 220% 100%;
    animation: baziSkeletonPulse 1.4s ease-in-out infinite;
}
.bazi-section-skeleton i:nth-child(2) { width: 82%; }
.bazi-section-skeleton i:nth-child(3) { width: 62%; }
@keyframes baziSkeletonPulse {
    0% { background-position: 0% 50%; }
    100% { background-position: -220% 50%; }
}
/* Sub-section within article */
.rpt-sub {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
}
.rpt-sub-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
}
.rpt-kicker-sm {
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.3;
    letter-spacing: 0.8px;
    text-transform: none;
    font-weight: 700;
    color: var(--gold);
}
.rpt-sub-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
}
/* Inline stat row (replaces god-grid boxes) */
.rpt-stat-row {
    display: flex;
    gap: 0;
    margin: 8px 0 14px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
}
.rpt-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    padding: 0 10px;
}
.rpt-stat:first-child { padding-left: 0; }
.rpt-stat:not(:last-child) { border-right: 1px solid var(--line); }
.rpt-stat-l {
    font-size: 10px;
    color: var(--ink-muted);
    letter-spacing: 0.5px;
}
.rpt-stat strong {
    font-size: 13px;
    color: var(--ink);
    font-weight: 600;
    word-break: keep-all;
    overflow-wrap: anywhere;
}
/* Warning line */
.rpt-warn-line {
    font-size: 12px;
    color: var(--crimson, #c62828);
    opacity: 0.82;
    border-left: 2px solid rgba(220,38,38,0.3);
    padding: 3px 0 3px 10px;
    margin: 6px 0 0;
}
/* Five-shen horizontal strip */
.rpt-shen-line {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    margin: 8px 0 16px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
}
.rpt-shen-tag {
    display: flex;
    align-items: baseline;
    gap: 5px;
}
.rpt-shen-role {
    font-size: 10px;
    color: var(--ink-muted);
    letter-spacing: 0.5px;
}
.rpt-shen-val {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
}
.rpt-shen-val.favorable { color: #2e7d32; }
.rpt-shen-val.unfavorable { color: #c62828; }
.rpt-shen-tag.is-yong .rpt-shen-role { color: var(--gold); }
.rpt-shen-tag.is-ji .rpt-shen-val { color: rgba(192,57,43,0.8); }
.rpt-shen-tag.is-chou .rpt-shen-val { color: rgba(192,57,43,0.55); }
.rpt-shen-note { font-size: 10px; color: var(--ink-dim); }
/* Lead word before prose */
.rpt-lead-w {
    color: var(--ink);
    font-weight: 700;
    margin-right: 2px;
}
.rpt-run-label {
    color: var(--gold);
    font-weight: 700;
    margin-right: 6px;
}
/* Feedback block */
.rpt-feedback {
    margin-top: 10px;
    border-left: 2px solid var(--line);
    padding: 4px 0 2px 12px;
}
.rpt-feedback-head {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11px;
    color: var(--ink-muted);
    margin-bottom: 4px;
}
.rpt-feedback-date { color: var(--ink-dim); font-size: 10px; }
/* 古籍断语 */
.rpt-src-note { font-size: 11px; color: var(--ink-dim); }
.rpt-classic-body { margin-top: 4px; }
.rpt-classic-note { color: var(--ink-dim) !important; font-style: italic; }

/* 命局天机 UI */
.tag-gold {
    background: rgba(212, 175, 55, 0.15);
    color: #d4af37;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid rgba(212, 175, 55, 0.3);
}
.geju-inline-text {
    color: #8ee0bb;
    font-size: 14px;
    font-weight: 700;
}
.tag-emerald {
    color: #8ee0bb;
    border-color: rgba(142,224,187,0.26);
    background: rgba(142,224,187,0.1);
}

.wuxing-bar-container {
    display: flex;
    height: 28px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--paper-soft);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
}
.wuxing-bar-segment {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 0.5s ease;
}
.wuxing-bar-label {
    font-size: 10px;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    white-space: nowrap;
    overflow: hidden;
}

.bg-gold { background: linear-gradient(135deg, #FFDF73, #D4AF37); }
.bg-wood { background: linear-gradient(135deg, #81C784, #388E3C); }
.bg-water { background: linear-gradient(135deg, #4FC3F7, #0288D1); }
.bg-fire { background: linear-gradient(135deg, #E57373, #D32F2F); }
.bg-earth { background: linear-gradient(135deg, #DCE775, #AFB42B); }

.scoring-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.scoring-item {
    background: var(--paper-soft);
    border-radius: 8px;
    padding: 12px;
    border-left: 3px solid transparent;
}
.scoring-item.fav-item { border-left-color: #81C784; }
.scoring-item.unfav-item { border-left-color: #E57373; }

.scoring-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: nowrap;
    gap: 12px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
}
.shen-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
}
.shen-badge.favorable { background: rgba(129,199,132,0.1); color: #81C784; }
.shen-badge.unfavorable { background: rgba(229,115,115,0.1); color: #E57373; }
.dim-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
}
.dim-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    letter-spacing: 0.02em;
}
.dim-tag.dim-pos {
    background: rgba(129,199,132,0.12);
    color: #81C784;
    border: 1px solid rgba(129,199,132,0.3);
}
.dim-tag.dim-neg {
    background: rgba(229,115,115,0.12);
    color: #E57373;
    border: 1px solid rgba(229,115,115,0.3);
}

.detail-drawer {
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: 20px 20px 0 0;
    padding: 20px 16px 36px;
    box-shadow: 0 -4px 40px rgba(0,0,0,.18);
}
.strength-drawer {
    width: 100%;
    max-width: 560px;
}
.insight-detail-drawer {
    width: 100%;
    max-width: 560px;
    height: 80vh;
    max-height: 80vh;
    overflow-y: hidden;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom, 20px);
}
.geju-detail-drawer {
    width: 100%;
    max-width: 560px;
}
.insight-switcher {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: nowrap;
}
.insight-tab {
    flex: 1 1 0;
    min-width: 0;
    min-height: 38px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--paper-soft);
    color: var(--ink-muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
}
.insight-tab.active {
    color: #17130c;
    background: linear-gradient(135deg, rgba(232,204,128,0.95), rgba(212,175,55,0.95));
    border-color: transparent;
}
.drawer-head {
    display: grid;
    grid-template-columns: 32px 1fr 32px;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 0;
}
.drawer-head .drawer-head-title {
    text-align: center;
    grid-column: 2;
}
.drawer-head .close-button {
    grid-column: 3;
    justify-self: end;
}

.drawer-head h4 {
    color: var(--gold);
    font-size: 17px;
    font-family: var(--font-serif);
    font-weight: 500;
}
/* Bottom sheet 命局天机 标题 */
.drawer-head-title {
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: 0.5px;
    align-self: center;
}
/* 旺衰格局行内展示 */
.wangge-inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
    font-family: var(--font-display);
}
.wangge-val {
    color: var(--ink);
}
.wangge-sep {
    color: var(--ink-muted);
    font-weight: 300;
    margin: 0 1px;
}
.image-match-badge {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    padding: 2px 6px;
    border: 1px solid rgba(212, 175, 55, 0.28);
    color: #e8cc80;
    font-size: 11px;
    line-height: 1.4;
}
/* insight bottom sheet tab bar 对齐主页 bazi-tab */
.insight-tab-bar {
    position: relative;
    display: flex;
    gap: 0;
    justify-content: center;
    border-bottom: 1px solid var(--line);
    margin: 0 -16px 0;
    padding: 0 16px;
}
.insight-tab-ink {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--ink);
    transition: transform .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1), opacity .15s;
    pointer-events: none;
    will-change: transform, width;
}
.insight-bazi-tab {
    flex: none;
    min-height: 40px;
    padding: 8px 20px;
    border: none;
    border-bottom: none;
    margin-bottom: 0;
    background: transparent;
    color: var(--ink-dim);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font-body);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: color .2s, border-color .2s;
    border-radius: 0;
    white-space: nowrap;
}
/* insight drawer 结构：sticky头 + 可滚动内容 */
.insight-sticky-head {
    position: sticky;
    top: 0;
    background: var(--bg-card);
    z-index: 2;
    padding-top: 4px;
    margin: 0 -16px;
    padding-left: 16px;
    padding-right: 16px;
}
.insight-bazi-tab.active {
    color: var(--ink);
    font-weight: 800;
    background: transparent;
    box-shadow: none;
}

.insight-scroll-body {
    padding-top: 16px;
    flex: 1;
    overflow-y: auto;
}
/* 杂志/信纸风格 prose 列表 */
.insight-prose-list {
    display: flex;
    flex-direction: column;
}
.insight-prose-item {
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
}
.insight-prose-item:last-child {
    border-bottom: none;
}
.insight-prose-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.insight-prose-label {
    font-size: 10px;
    color: var(--gold);
    letter-spacing: 1.5px;
    font-weight: 700;
    text-transform: none;
}
.insight-prose-main {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    font-family: var(--font-display);
    margin: 0 0 6px;
    line-height: 1.3;
}
.insight-prose-text {
    font-size: 14px;
    color: var(--ink-muted);
    line-height: 1.72;
    margin: 0;
}
.insight-prose-kicker-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 4px;
}
/* 判定说明 summary */
.insight-explain-summary {
    font-size: 14px;
    color: var(--ink-muted);
    line-height: 1.7;
    margin: 0 0 8px;
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
}
/* 取格步骤行内 */
.insight-step-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
}
.insight-step-row {
    display: flex;
    gap: 10px;
    align-items: baseline;
}
.insight-step-label {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--gold);
    min-width: 52px;
}
.insight-step-val {
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.6;
}
/* 行内列表（—符号 + 内容）*/
.insight-inline-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
}
.insight-inline-dot {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--ink-dim);
    line-height: 1.6;
}
.insight-dot-warn { color: #c53030; }
.insight-val-warn { color: #9b2c2c; }
/* 判定说明：书名行内 + 楷体引用 */
.insight-source-inline {
    font-size: 11px;
    color: var(--ink-dim);
    font-style: normal;
    letter-spacing: 0.2px;
}
.insight-quote-line {
    margin: 6px 0 8px;
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.75;
    font-style: italic;
    padding-left: 12px;
    border-left: 2px solid var(--gold-border);
}

.strength-meter-card {
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 8px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
}
.strength-meter-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
}
.strength-meter-label {
    color: var(--gold-light);
    font-size: 16px;
    font-weight: 700;
}
.strength-meter-band {
    color: var(--ink-muted);
    font-size: 12px;
}
.strength-meter-track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(91,141,239,0.42), rgba(232,204,128,0.28), rgba(218,87,72,0.44));
    border: 1px solid var(--line);
}
.strength-meter-fill {
    height: 100%;
    min-width: 4px;
    border-radius: 999px;
    background: var(--gold);
}
.strength-meter-thumb {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--gold);
    border: 2px solid white;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 3px var(--gold-border);
}
.strength-meter-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    color: var(--ink-dim);
    font-size: 11px;
}
.strength-section-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.strength-section-card {
    padding: 13px 14px;
    border-radius: 8px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
}
.strength-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
}
.strength-section-head h5 {
    color: var(--gold-light);
    font-size: 13px;
    font-weight: 700;
}
.strength-score-chip {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--gold-dim);
    border: 1px solid var(--gold-border);
    color: var(--gold);
    font-size: 11px;
    font-weight: 600;
}
.strength-section-card p {
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.7;
}
.explain-summary-card,
.explain-section-card {
    padding: 14px;
    border-radius: 12px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
}
.explain-summary-card {
    margin-bottom: 12px;
    background: var(--gold-dim);
}
.explain-summary-title {
    margin-bottom: 8px;
    color: var(--gold);
    font-size: 13px;
    font-weight: 700;
}
.explain-summary-card p {
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.75;
}
.explain-section-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.explain-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}
.explain-section-head h5 {
    color: var(--gold-light);
    font-size: 14px;
    font-weight: 700;
}
.explain-source-chip {
    flex-shrink: 0;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--gold-border);
    background: var(--gold-dim);
    color: var(--gold);
    font-size: 10px;
    letter-spacing: 0.4px;
}
.explain-quote {
    margin: 0 0 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border-left: 3px solid var(--gold);
    background: var(--gold-dim);
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.7;
}
.explain-paragraphs {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.explain-paragraphs p {
    margin: 0;
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.75;
}
.geju-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
}
.geju-summary-line {
    margin-bottom: 10px;
    padding: 9px 10px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--paper-soft);
    color: var(--ink);
    font-size: 13px;
    line-height: 1.6;
}
.geju-summary-line.secondary {
    background: var(--bg-card);
    color: var(--ink-dim);
}
.geju-modal-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
}
.geju-chip {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--gold-border);
    background: var(--gold-dim);
    color: var(--gold);
    font-size: 12px;
    font-weight: 600;
}
.geju-chip.accent {
    border-color: rgba(142,224,187,0.26);
    background: rgba(142,224,187,0.1);
    color: #8ee0bb;
}

.context-notes-layout {
    display: grid;
    gap: 24px;
    margin-top: 22px;
}
.context-card {
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
}
.context-card-top-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
}
.notes-card-header {
    align-items: center;
}
.notes-card-header .ai-header-title {
    white-space: nowrap;
    flex-shrink: 0;
}
.context-card + .context-card {
    padding-top: 22px;
    border-top: 1px dashed var(--gold-border);
}
.context-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
}
.context-card-title {
    color: var(--gold);
    font-size: 17px;
    font-family: var(--font-serif);
}
.context-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
}
.context-month-select {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--bg-card);
    color: var(--ink);
}
.context-card-desc {
    margin: 0 0 16px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.7;
    max-width: 44em;
}
.context-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}
.context-panel {
    padding: 0 0 14px;
    border-radius: 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line);
}
.context-panel:last-child {
    padding-bottom: 0;
    border-bottom: none;
}
.context-panel-title {
    margin-bottom: 10px;
    color: var(--gold);
    font-size: 14px;
    font-weight: 700;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
}
.context-field {
    display: grid;
    gap: 6px;
    margin-bottom: 10px;
}
.context-field:last-child {
    margin-bottom: 0;
}
.context-field label {
    color: var(--ink-muted);
    font-size: 12px;
}
.context-field input,
.context-field select,
.context-field textarea {
    width: 100%;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--bg-card);
    color: var(--ink);
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.5;
}
.context-field textarea {
    resize: vertical;
    min-height: 68px;
}
.context-recent-list {
    margin-top: 14px;
    display: grid;
    gap: 8px;
}
.context-recent-title {
    color: var(--ink-muted);
    font-size: 12px;
}
.context-recent-item {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 10px;
    padding: 8px 0;
    border-radius: 0;
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--line);
}
.context-recent-item:last-child {
    border-bottom: none;
}
.context-recent-month {
    color: var(--gold);
    font-size: 12px;
    font-weight: 700;
}
.context-recent-copy {
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.6;
}
.context-notes-message {
    margin-top: 12px;
    color: var(--gold);
    font-size: 12px;
}
.screen-toast {
    position: fixed;
    inset: 0;
    z-index: 1400;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}
.screen-toast-card {
    max-width: min(78vw, 320px);
    padding: 14px 18px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--header-bg);
    box-shadow: 0 8px 28px rgba(0,0,0,.14);
    color: var(--ink);
    font-size: 14px;
    line-height: 1.6;
    text-align: center;
}
.screen-toast-card.is-error {
    border-color: rgba(220,38,38,0.28);
    color: var(--crimson);
}

@media (max-width: 760px) {
    .notes-card-header {
        align-items: flex-start;
        flex-direction: column;
    }
    .notes-card-header .context-card-top-actions {
        width: 100%;
        justify-content: flex-start;
    }
    .context-card-top-actions {
        width: 100%;
        justify-content: flex-start;
    }
    .context-card-head {
        flex-direction: column;
    }
    .context-head-actions {
        width: 100%;
        justify-content: flex-start;
    }
    .context-recent-item {
        grid-template-columns: 1fr;
        gap: 6px;
    }
}

@media (min-width: 920px) {
    .context-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
.geju-chip.is-good {
    color: #8fe39a;
    border-color: rgba(143,227,154,0.24);
    background: rgba(143,227,154,0.1);
}
.geju-chip.is-bad {
    color: #ff9f97;
    border-color: rgba(255,159,151,0.24);
    background: rgba(255,159,151,0.1);
}
.geju-chip.is-wait {
    color: #f3d68b;
}
.geju-modal-block {
    padding: 13px 14px;
    border-radius: 12px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
    margin-bottom: 12px;
}
.geju-block-title {
    margin-bottom: 8px;
    color: var(--gold);
    font-size: 11px;
    letter-spacing: 1px;
}
.geju-block-main {
    color: var(--ink);
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 7px;
}
.geju-block-copy {
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.7;
}
.geju-verdict-copy {
    color: var(--ink);
    font-weight: 600;
}
.geju-inline-note {
    margin-top: 9px;
    color: #2563eb;
    font-size: 12px;
    line-height: 1.6;
}
.pattern-step-list {
    display: grid;
    gap: 9px;
}
.pattern-step-item {
    padding: 9px 10px;
    border-radius: 8px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
}
.pattern-step-item span {
    display: block;
    margin-bottom: 4px;
    color: var(--gold);
    font-size: 12px;
    font-weight: 700;
}
.pattern-step-item p {
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.6;
}
.geju-inline-pairs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 10px;
    color: var(--ink-muted);
    font-size: 12px;
}
.geju-inline-pairs-top {
    margin-top: 12px;
}
.geju-subcopy {
    margin-top: 10px;
    color: var(--ink-dim);
}
.geju-bullet-row, .geju-bullet-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.geju-bullet-chip, .geju-list-chip {
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--paper-soft);
    border: 1px solid var(--line);
    color: var(--ink-muted);
    font-size: 12px;
}
.geju-bullet-list.warning .geju-list-chip {
    color: var(--crimson);
    border-color: rgba(220,38,38,0.2);
    background: rgba(220,38,38,0.06);
}

@media (max-width: 420px) {
    .picker-overlay {
        padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
    }
    .profile-picker-modal {
        width: 100%;
        max-height: calc(100dvh - max(48px, env(safe-area-inset-top)) - max(18px, env(safe-area-inset-bottom)));
        border-radius: 22px;
        padding: 14px 14px max(18px, env(safe-area-inset-bottom));
    }
    .profile-actions { grid-template-columns: 1fr 1fr; }
    .profile-filter-row { grid-template-columns: minmax(0, 1fr) 46px; gap: 6px; }
    .profile-switch-trigger { min-height: 46px; padding: 7px 10px; }
    .profile-switch-name { font-size: 18px; }
    .profile-switch-symbol { font-size: 19px; }
    .profile-flyout-item { grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 11px 12px; }
    .profile-item-date { font-size: 11px; }
    .profile-item-meta { font-size: 11px; line-height: 1; }
    .icon-btn { width: 46px; min-height: 46px; }
    .mini-action.danger { grid-column: span 2; }
    .form-row { flex-direction: column; gap: 10px; }
    .bazi-header { flex-direction: column; }
    .bazi-header-actions { width: 100%; align-items: stretch; }
    .btn-primary { width: 100%; }
    .dashboard-panel { padding: 16px 10px; }
    .tabs { gap: 16px; }
    .tab { font-size: 12px; }
    .bazi-table {
        --bz-cell-py: 7px;
        --bz-label-size: 11px;
        --bz-meta-size: 11px;
        --bz-char-size: 18px;
    }
    .bazi-table th { font-size: 12px; letter-spacing: .5px; }
    .bazi-table th:first-child, .bazi-table td:first-child { width: 44px; }
    .bz-sub { line-height: 1.35; }
    .bz-shensha { font-size: 10px; line-height: 1.35; }
    .tiaohou-card-head { align-items: stretch; flex-direction: column; }
    .tiaohou-urgency { align-self: flex-start; }
    .tiaohou-god-grid { grid-template-columns: 1fr; }
    .picker-topbar {
        grid-template-columns: minmax(0, 1fr) 38px;
        gap: 10px;
        align-items: start;
        margin-bottom: 12px;
    }
    .picker-mode-tabs { grid-column: 1 / -1; grid-row: 2; }
    .picker-close.dark {
        grid-column: 2;
        grid-row: 1;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        font-size: 24px;
    }
    .picker-form-row { grid-template-columns: 1fr 1fr; gap: 12px; }
    .picker-save-btn { min-height: 56px; }
    .location-result-list { max-height: 214px; }
    .date-segment-row { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .date-input-card input { min-height: 50px; font-size: 18px; padding: 0 14px; }
    .date-segment { padding: 10px 4px; border-radius: 14px; }
    .date-segment strong { font-size: 14px; }
    .pillar-slot-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .insight-switcher { gap: 6px; }
    .insight-tab { flex: 1 1 0; min-width: 0; font-size: 11px; padding: 0 6px; }
    .explain-section-head { align-items: flex-start; flex-direction: column; }
    .explain-source-chip { align-self: flex-start; }
    .pillar-slot { min-height: 88px; border-radius: 18px; padding: 10px 4px; }
    .slot-label { font-size: 12px; }
    .slot-value { font-size: 20px; }
    .choice-chip-grid-gz { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    .choice-chip-grid-zhi { grid-template-columns: repeat(4, 1fr); }
    .choice-chip { min-height: 52px; border-radius: 16px; font-size: 21px; }
    .pillar-choice-panel { padding: 12px; border-radius: 20px; }
    .pillar-choice-head { align-items: flex-start; }
    .pillar-orb-current { font-size: 18px; }
    .timeline-head { align-items: flex-start; }
    .timeline-actions { gap: 6px; }
    .timeline-icon-btn { width: 28px; height: 28px; }
    .row-content { gap: 3px; padding: 4px; }
    .link-item { min-width: 58px; padding: 6px 4px; }
    .item-body { gap: 4px; }
    .stacked-ganzhi { gap: 2px; }
    .char-wrap { width: 18px; min-width: 18px; height: 20px; padding-right: 8px; }
    .stacked-ganzhi .char-wrap { height: 19px; padding-right: 10px; }
    .fortune-guide-card { flex-direction: column; align-items: stretch; }
    .fortune-guide-btn { width: 100%; }
    .verdict-line { gap: 8px; }
    .verdict-line p { font-size: 13px; }
    .geju-card-head { flex-direction: column; align-items: stretch; }
    .geju-detail-drawer {
        width: 100%;
        max-height: min(84vh, 760px);
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;
        padding-bottom: 22px;
        align-self: flex-end;
    }
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

/* ══ 断事笔记 ══ */
.life-events-card {
    padding: 14px;
    margin: 0 0 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg-card) 82%, transparent);
    border: 1px solid var(--glass-border);
}

.le-timeline { display: flex; flex-direction: column; margin-bottom: 14px; }
.le-item {
    position: relative;
    display: flex; align-items: flex-start;
    padding-left: 22px; padding-bottom: 12px;
}
.le-dot {
    position: absolute; left: 2px; top: 6px;
    width: 9px; height: 9px; border-radius: 50%;
}
.le-dot--positive { background: var(--teal); box-shadow: 0 0 7px color-mix(in srgb, var(--teal) 50%, transparent); }
.le-dot--neutral { background: var(--gold); box-shadow: 0 0 7px color-mix(in srgb, var(--gold) 40%, transparent); }
.le-dot--negative { background: var(--crimson); box-shadow: 0 0 7px color-mix(in srgb, var(--crimson) 50%, transparent); }
.le-line {
    position: absolute; left: 6px; top: 18px; bottom: 0;
    width: 1px;
    background: linear-gradient(to bottom, var(--glass-border), transparent);
}
.le-item:last-child .le-line { display: none; }

.le-card {
    flex: 1; min-width: 0;
    background: var(--bg-card);
    border: 1px solid var(--glass-border);
    border-radius: 10px; padding: 10px 12px;
}
.le-item:has(.le-dot--positive) .le-card { border-color: color-mix(in srgb, var(--teal) 14%, transparent); }
.le-item:has(.le-dot--negative) .le-card { border-color: color-mix(in srgb, var(--crimson) 14%, transparent); }

.le-card-head {
    display: flex; flex-wrap: wrap; align-items: center;
    gap: 6px; margin-bottom: 6px;
}
.le-year { font-size: 13px; color: var(--gold-light); font-weight: 600; }
.le-dayun { font-size: 11px; color: var(--text-muted); }
.le-cat { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--text-primary) 5%, transparent); border: 1px solid var(--glass-border); color: var(--text-primary); }
.le-impact { font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
.le-impact--positive { background: color-mix(in srgb, var(--teal) 10%, transparent); color: var(--teal); }
.le-impact--neutral { background: color-mix(in srgb, var(--gold) 10%, transparent); color: var(--gold-light); }
.le-impact--negative { background: color-mix(in srgb, var(--crimson) 10%, transparent); color: var(--crimson); }
.le-del {
    margin-left: auto; width: 20px; height: 20px;
    border-radius: 50%; border: 1px solid var(--glass-border);
    background: transparent; color: var(--text-muted);
    font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
}
.le-del:hover { background: color-mix(in srgb, var(--crimson) 15%, transparent); color: var(--crimson); }
.le-desc { font-size: 12px; color: var(--text-primary); line-height: 1.65; margin: 0; }
.le-empty { font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px 0 12px; }

.le-toggle-btn {
    padding: 7px 16px; border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: transparent;
    color: var(--text-muted); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: border-color 0.2s, color 0.2s;
    margin-bottom: 4px;
}
.le-toggle-btn:hover {
    border-color: var(--gold-border);
    color: var(--gold-light);
}

.le-form {
    margin-top: 12px; display: flex; flex-direction: column; gap: 14px;
    padding: 16px; border-radius: 14px;
    background: color-mix(in srgb, var(--bg-card) 72%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold-light) 10%, transparent);
}
.le-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.le-field { display: flex; flex-direction: column; gap: 6px; }
.le-field label {
    font-size: 11px; color: var(--text-muted); letter-spacing: 0.5px;
    display: flex; align-items: center; justify-content: space-between;
}
.le-charcount { font-size: 10px; }
.le-charcount.warn { color: var(--crimson); }
.le-field input,
.le-field select,
.le-field textarea {
    background: color-mix(in srgb, var(--bg-card) 70%, transparent);
    border: 1px solid var(--glass-border);
    border-radius: 8px; padding: 9px 12px;
    color: var(--text-primary); font-size: 13px; outline: none;
    font-family: var(--font-body);
}
.le-field input:focus,
.le-field select:focus,
.le-field textarea:focus { border-color: color-mix(in srgb, var(--gold) 35%, transparent); }
.le-field textarea { resize: vertical; line-height: 1.65; }

.le-cats { display: flex; flex-wrap: wrap; gap: 7px; }
.le-cat-chip {
    padding: 5px 11px; border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: color-mix(in srgb, var(--bg-card) 78%, transparent);
    color: var(--text-muted); font-size: 12px; cursor: pointer;
    transition: all 0.2s;
}
.le-cat-chip.active {
    background: color-mix(in srgb, var(--gold) 15%, transparent);
    border-color: color-mix(in srgb, var(--gold) 40%, transparent);
    color: var(--gold-light);
}

.le-impacts { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
.le-impact-btn {
    min-height: 40px; border-radius: 10px;
    border: 1px solid var(--glass-border);
    background: color-mix(in srgb, var(--bg-card) 78%, transparent);
    color: var(--text-muted); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
}
.le-impact-btn--positive.active { background: color-mix(in srgb, var(--teal) 12%, transparent); border-color: color-mix(in srgb, var(--teal) 35%, transparent); color: var(--teal); }
.le-impact-btn--neutral.active { background: color-mix(in srgb, var(--gold) 12%, transparent); border-color: color-mix(in srgb, var(--gold) 35%, transparent); color: var(--gold-light); }
.le-impact-btn--negative.active { background: color-mix(in srgb, var(--crimson) 12%, transparent); border-color: color-mix(in srgb, var(--crimson) 35%, transparent); color: var(--crimson); }

.le-form-actions {
    display: flex; justify-content: flex-end; gap: 10px; margin-top: 2px;
}

/* ══ 断事笔记使用说明浮层 ══ */
.le-guide-card {
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    overflow-y: auto;
    background: color-mix(in srgb, var(--bg-card) 96%, black 55%);
    border: 1px solid var(--gold-border);
    border-radius: 20px 20px 0 0;
    padding: 20px 18px 36px;
    box-shadow: 0 -4px 40px color-mix(in srgb, black 40%, transparent);
}

.le-guide-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-serif);
    font-size: 16px;
    color: var(--gold-light);
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--gold) 14%, transparent);
}

.le-guide-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.le-guide-block {
    padding: 13px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg-card) 82%, transparent);
    border: 1px solid var(--glass-border);
}

.le-guide-block-title {
    font-size: 11px;
    color: var(--gold);
    letter-spacing: 1px;
    margin-bottom: 8px;
}

.le-guide-block p {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.75;
    margin: 0;
}

.le-guide-example {
    padding: 13px 14px;
    border-radius: 12px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 6%, transparent), color-mix(in srgb, var(--bg-card) 88%, transparent));
    border: 1px solid color-mix(in srgb, var(--gold) 18%, transparent);
    border-left: 3px solid var(--gold);
}

.le-guide-example-label {
    font-size: 11px;
    color: var(--gold-light);
    letter-spacing: 1px;
    margin-bottom: 8px;
}

.le-guide-example p {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.75;
    margin: 0;
}

.le-guide-tip {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.7;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--bg-card) 80%, transparent);
    border: 1px dashed var(--glass-border);
}

@media (max-width: 420px) {
    .le-form-row { grid-template-columns: 1fr; }
    .le-impacts { grid-template-columns: 1fr; }
}

/* ══════════════════════════════════════════════════
   杂志信纸风 — Magazine / Stationery Style Overrides
   去圆角矩形化 + Editorial Typography
   ══════════════════════════════════════════════════ */

/* ─── 1. 去圆角：所有容器清零 ─────────────────────────── */
.glass-card,
.insight-card, .tiaohou-card, .geju-card,
.life-events-card, .le-card, .le-form,
.strength-meter-card, .strength-section-card,
.explain-summary-card, .explain-section-card,
.geju-modal-block, .pattern-step-item, .geju-summary-line,
.detail-drawer, .insight-detail-drawer, .geju-detail-drawer,
.shensha-modal, .guest-login-modal,
.le-guide-card, .le-guide-block, .le-guide-example, .le-guide-tip,
.analysis-status,
.tiaohou-god-cell, .tiaohou-warning, .decision-chain-list, .scoring-item,
.profile-form, .profile-flyout, .profile-flyout-item,
.xiji-item, .five-shen-cell, .link-item, .linkage-row,
.classic-verdict-section, .feedback-correction-block,
.fortune-guide-card, .screen-toast-card,
.date-input-card, .date-segment,
.pillar-slot, .pillar-choice-panel, .choice-chip,
.picker-preview-card, .picker-mode-tabs,
.profile-picker-modal { border-radius: 0; }

.context-field input, .context-field select, .context-field textarea,
.le-field input, .le-field select, .le-field textarea,
.context-month-select, .form-row input, .form-row select { border-radius: 0; }

.btn-ghost, .btn-primary, .mini-action, .icon-btn,
.le-toggle-btn, .fortune-guide-btn, .le-impact-btn,
.picker-mode-tab, .picker-save-btn, .timeline-icon-btn,
.profile-switch-trigger, .location-search-input-wrap,
.insight-tab { border-radius: 0; }

/* ─── 2. Glass-card → 纸页横截面（去阴影，仅留上下边线）─── */
.glass-card {
    border-radius: 0;
    box-shadow: none;
    border-left: none;
    border-right: none;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
}
.dashboard-panel {
    border-top: none;
    background: transparent;
    margin-top: 0;
}

/* ─── 3. Modal / Drawer 扁平化 ──────────────────────────── */
.profile-picker-modal {
    border-radius: 0;
    box-shadow: 0 0 0 1px var(--line), 0 20px 60px rgba(0,0,0,0.12);
}
.picker-mode-tab.active { border-radius: 0; }

.detail-drawer, .insight-detail-drawer, .geju-detail-drawer {
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -2px 0 1px var(--line), 0 -8px 40px rgba(0,0,0,0.12);
}
.shensha-modal {
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.14);
    border: 1px solid var(--gold-border);
}
.guest-login-modal {
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.1);
    border: 1px solid var(--line);
}
.screen-toast-card {
    border-radius: 0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.le-guide-card {
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.14);
}

/* ─── 4. 段落标题编辑风 Section headers ──────────────────── */
.section-kicker {
    text-transform: uppercase;
    letter-spacing: 3px;
    font-size: 9px;
    font-family: var(--font-body);
}

/* ai-section: horizontal rule before each section */
.ai-section {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
    animation: none;
}
.insight-summary { border-top: none; margin-top: 8px; padding-top: 0; }

/* ai-header: section label row */
.ai-header-row {
    padding-bottom: 0;
    border-bottom: none;
    margin-bottom: 14px;
}
.ai-header-title { font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; font-family: var(--font-body); font-weight: 600; color: var(--ink-muted); }
.ai-header-title::before { display: none; }

/* ─── 5. 报告区域 → 杂志编辑风（无矩形套矩形）────────────── */

/* 格局卡 → gold left-bar callout */
.insight-card {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
    padding: 0 0 0 14px;
    border-left: 3px solid var(--gold-border);
    margin-bottom: 22px;
}
.insight-card h4 {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--gold);
    font-family: var(--font-body);
    font-weight: 600;
    margin-bottom: 8px;
    border-bottom: none;
    padding-bottom: 0;
    opacity: 0.8;
}
.insight-card p { font-size: 14px; color: var(--ink); line-height: 1.72; }

/* 格局首行卡 */
.geju-card {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
    padding: 0 0 0 14px;
    border-left: 3px solid var(--gold-border);
    margin-bottom: 20px;
}

/* 调候卡 → teal left-bar callout */
.tiaohou-card {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
    padding: 0 0 0 14px;
    border-left: 3px solid rgba(13,148,136,0.5);
    margin-bottom: 20px;
}
.tiaohou-card-head h4 { color: var(--teal); border: none; padding-bottom: 0; margin-bottom: 0; font-size: 14px; font-weight: 600; font-family: var(--font-body); }
.tiaohou-god-grid { gap: 0; grid-template-columns: repeat(3,1fr); margin-bottom: 10px; }
.tiaohou-god-cell {
    background: transparent;
    border: none;
    border-radius: 0;
    border-right: 1px solid var(--line);
    padding: 8px 10px 8px 0;
}
.tiaohou-god-cell:last-child { border-right: none; }
.tiaohou-warning {
    background: transparent;
    border: none;
    border-radius: 0;
    border-left: 2px solid rgba(220,38,38,0.35);
    padding: 4px 0 4px 10px;
    color: var(--crimson);
    opacity: 0.82;
    font-size: 12px;
}

/* 格局摘要行 → subtle left callout */
.geju-summary-line {
    background: transparent;
    border: none;
    border-radius: 0;
    border-left: 2px solid var(--gold-border);
    padding: 2px 0 2px 12px;
    margin-bottom: 10px;
    color: var(--ink-muted);
    font-size: 13px;
}
.geju-summary-line.secondary { border-left-color: var(--line); color: var(--ink-dim); }

/* 五行池 → no box */
.wuxing-pool-card {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    margin-bottom: 20px;
}
.wuxing-pool-card h4 { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-muted); font-weight: 600; margin-bottom: 10px; }

/* 古籍断语 → editorial left-border */
.classic-verdict-section {
    border: none;
    background: transparent;
    border-radius: 0;
    border-top: 1px solid var(--line);
    padding: 20px 0 0 14px;
    border-left: 3px solid var(--gold-border);
    margin-top: 4px;
}
.classic-header { border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-bottom: 10px; }
.classic-body p { color: var(--ink); font-size: 14px; line-height: 1.72; }
.classic-subtitle { color: var(--ink-dim); font-size: 12px; }
.classic-key { background: transparent; color: var(--gold); border: 1px solid var(--gold-border); border-radius: 0; font-size: 11px; padding: 2px 8px; }

/* 反馈纠偏块 */
.feedback-correction-block {
    background: transparent;
    border: none;
    border-radius: 0;
    border-left: 2px solid var(--line);
    padding: 8px 0 4px 12px;
    margin-top: 12px;
}

/* 其他 callout accents */
.analysis-status      { border-left: 2px solid var(--gold-border); }
.analysis-status.done { border-left: 2px solid rgba(13,148,136,0.4); }
.life-events-card     { border-left: 2px solid var(--line); }
.insight-tab.active   { box-shadow: none; }

/* ─── 6. 紧凑档案条 Compact profile strip ───────────────── */
/* ── Bloomberg-style Profile Hero ─────────────────────────── */
.profile-hero-block {
    --hero-collapse: 0;
    position: sticky;
    top: 0;
    z-index: 40;
    overflow: visible;
    padding: var(--hero-pad-top, 24px) 16px var(--hero-pad-bottom, 10px);
    background: rgba(var(--paper-rgb), var(--hero-bg-alpha, .72));
    border-bottom: 1px solid rgba(214, 209, 198, var(--hero-border-alpha, .18));
    backdrop-filter: blur(var(--hero-blur, 2px));
    box-shadow: 0 var(--hero-shadow-y, 0) var(--hero-shadow-blur, 0) rgba(38, 31, 20, var(--hero-shadow-alpha, 0));
    transition: padding .12s linear, background-color .12s linear, border-color .12s linear, box-shadow .12s linear;
}

/* Top-right action button group */
.hero-top-actions {
    position: absolute;
    top: var(--hero-action-top, 18px);
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 2;
    opacity: var(--hero-action-opacity, 1);
    transform: translateY(calc(-6px * var(--hero-collapse)));
    transition: opacity .12s linear, transform .12s linear;
}
.profile-hero-block.condensed .hero-top-actions {
    opacity: 0 !important;
    visibility: hidden;
    pointer-events: none;
}
.hero-icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--ink-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: color .18s, border-color .18s;
    flex-shrink: 0;
}
.hero-icon-btn svg { width: 15px; height: 15px; }
.hero-icon-btn:hover { color: var(--gold); border-color: var(--gold-border); }
.hero-icon-btn:disabled { opacity: 0.4; cursor: default; }
.hero-icon-btn.spinning svg { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Dates above name */
.hero-dates-top {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: var(--hero-dates-margin, 6px);
    padding-right: 50px; /* clear 1 button */
    max-height: var(--hero-dates-height, 22px);
    opacity: var(--hero-dates-opacity, 1);
    transform: translateY(var(--hero-dates-offset, 0));
    overflow: hidden;
    pointer-events: none;
    transition: opacity .12s linear, max-height .12s linear, margin-bottom .12s linear, transform .12s linear;
}
.hero-birth, .hero-lunar {
    font-size: 11px;
    color: var(--ink-muted);
    font-family: var(--font-body);
    letter-spacing: 0.3px;
    white-space: nowrap;
}
.hero-sep { font-size: 11px; color: var(--ink-dim); }

/* Name trigger — wraps name + caret tightly */
.hero-name-trigger {
    display: inline-flex;
    align-items: center;
    gap: calc(10px * (1 - var(--hero-collapse)));
    max-width: calc(100% - (54px * (1 - var(--hero-collapse)))); /* clear rerun button */
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
}
.hero-display-name {
    font-family: var(--font-display);
    font-size: var(--hero-name-size, 42px);
    font-weight: 800;
    color: var(--ink);
    letter-spacing: 0;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: font-size .12s linear;
}
.profile-strip-badge {
    font-size: 10px;
    padding: 1px 7px;
    color: var(--gold);
    border: 1px solid var(--gold-border);
    background: var(--gold-dim);
    border-radius: 2px;
    flex-shrink: 0;
    letter-spacing: 1px;
    max-width: var(--hero-badge-width, 48px);
    opacity: var(--hero-side-opacity, 1);
    overflow: hidden;
    white-space: nowrap;
    transition: opacity .12s linear, max-width .12s linear, padding .12s linear;
}
/* SVG chevron caret */
.profile-strip-caret {
    display: inline-block;
    width: var(--hero-caret-width, 10px);
    height: 6px;
    max-width: var(--hero-caret-width, 10px);
    color: var(--ink-muted);
    flex-shrink: 0;
    opacity: var(--hero-side-opacity, 1);
    overflow: hidden;
    transition: transform .22s var(--ease), opacity .12s linear, width .12s linear, max-width .12s linear;
}
.profile-strip-caret.open {
    transform: rotate(180deg);
}

/* Badges row — pills, left-aligned */
.hero-meta {
    margin-top: var(--hero-meta-margin, 18px);
    max-height: var(--hero-meta-height, 34px);
    opacity: var(--hero-meta-opacity, 1);
    transform: translateY(var(--hero-meta-offset, 0));
    overflow: hidden;
    transition: opacity .12s linear, max-height .12s linear, margin-top .12s linear, transform .12s linear;
}
.profile-hero-block.condensed .hero-meta {
    max-height: 0;
    opacity: 0 !important;
    pointer-events: none;
}
.profile-hero-block.condensed .profile-strip-badge,
.profile-hero-block.condensed .profile-strip-caret {
    width: 0;
    max-width: 0;
    opacity: 0 !important;
    pointer-events: none;
}
.profile-hero-block.condensed .profile-strip-badge {
    padding-left: 0;
    padding-right: 0;
    height: 0;
    line-height: 0;
    border: 0;
}
.profile-hero-block.condensed .profile-strip-caret {
    height: 0;
    opacity: 0 !important;
}
.profile-hero-block.condensed .hero-dates-top {
    max-height: 0;
    opacity: 0 !important;
}
.profile-hero-block .guest-limit-note {
    max-height: var(--hero-note-height, 42px);
    opacity: var(--hero-note-opacity, 1);
    overflow: hidden;
    transform: translateY(calc(-6px * var(--hero-collapse)));
    transition: opacity .12s linear, max-height .12s linear, margin .12s linear, transform .12s linear;
}
.profile-hero-block.condensed .guest-limit-note {
    max-height: 0;
    opacity: 0 !important;
    margin: 0;
    pointer-events: none;
}
.hero-badges {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    flex-wrap: wrap;
}
/* Override magazine border-radius:0 for hero pills */
.hero-pill {
    border-radius: 999px !important;
    padding: 4px 14px !important;
    font-size: 12px !important;
    letter-spacing: 0.5px;
}

/* Profile strip wrap (still used for flyout positioning) */
.profile-strip-wrap {
    position: relative;
    z-index: 60;
    overflow: visible;
    margin-bottom: var(--hero-strip-gap, 18px);
    transition: margin-bottom .12s linear;
}
.profile-strip-wrap.open .hero-name-trigger {
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 0;
}

/* (flyout replaced by bottom sheet) */

.flyout-mgmt-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 8px 10px;
    border-top: 1px solid var(--line);
    margin-top: 4px;
    position: sticky;
    bottom: 0;
    background: var(--bg-card);
    z-index: 1;
}
.flyout-mgmt-btn {
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--line);
    background: var(--paper-soft);
    color: var(--ink-muted);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    border-radius: 0;
}
.flyout-mgmt-btn:disabled { color: var(--gold); border-color: var(--gold-border); background: var(--gold-dim); cursor: default; }
.flyout-mgmt-btn.is-danger { color: var(--crimson); }

/* ─── 7. 奇门风格标签导航 Qimen-style tab bar ───────────── */
.bazi-tab-bar {
    position: relative;
    display: flex;
    gap: 0;
    padding: 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line);
    margin-bottom: 0;
    border-radius: 0;
    overflow-x: auto;
    scrollbar-width: none;
}
.bazi-tab-bar::-webkit-scrollbar { display: none; }
.bazi-tab {
    flex: none;
    min-height: 40px;
    padding: 8px 20px;
    border: none;
    background: transparent;
    color: var(--ink-dim);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font-body);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: color .2s;
    border-radius: 0;
    white-space: nowrap;
}
.bazi-tab.active {
    color: var(--ink);
    font-weight: 800;
    background: transparent;
    box-shadow: none;
}
.bazi-tab-ink {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--ink);
    transition: transform .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1), opacity .15s;
    pointer-events: none;
    will-change: transform, width;
}
.bazi-tab-count {
    min-width: 16px; height: 16px; padding: 0 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold) 28%, transparent);
    color: var(--gold-light); font-size: 9px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
}
/* ─── Tab content transition ───────────────────────────── */
.tab-pane-wrap { }
.tab-fade-enter-active { transition: opacity .18s ease, transform .18s ease; }
.tab-fade-leave-active { transition: opacity .08s ease; }
.tab-fade-enter-from { opacity: 0; transform: translateY(6px); }
.tab-fade-enter-to { opacity: 1; transform: translateY(0); }
.tab-fade-leave-from { opacity: 1; }
.tab-fade-leave-to { opacity: 0; }

/* ─── 8. Bottom Sheet ──────────────────────────────────── */
.sheet-backdrop {
    position: fixed; inset: 0; z-index: 199;
    background: rgba(0,0,0,.38);
}
.profile-bottom-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
    background: var(--bg-card);
    border-radius: 20px 20px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    max-height: 80vh;
    display: flex; flex-direction: column;
}
.sheet-handle {
    width: 36px; height: 4px;
    background: var(--chrome-muted);
    border-radius: 2px;
    margin: 10px auto 0;
    flex-shrink: 0;
    opacity: 0.4;
}
.sheet-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px 10px;
    flex-shrink: 0;
}
.sheet-title {
    font-size: 17px; font-weight: 700; color: var(--ink);
    font-family: var(--font-body);
}
.sheet-header-actions {
    display: flex; align-items: center; gap: 8px;
}
.sheet-add-btn {
    width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid var(--line); background: transparent; color: var(--ink-muted);
    cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
}
.sheet-add-btn svg { width: 14px; height: 14px; }
.sheet-add-btn:hover { color: var(--gold); border-color: var(--gold-border); }
.sheet-close-btn {
    width: 28px; height: 28px; border-radius: 50%;
    border: none; background: var(--chrome); color: var(--ink-muted);
    font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.sheet-list {
    flex: 1; overflow-y: auto;
    padding: 4px 0 8px;
}
.sheet-empty {
    padding: 20px;
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.6;
    text-align: center;
}

/* Swipe-to-reveal item */
.swipe-item {
    position: relative;
    overflow: hidden;
}
.sheet-profile-btn {
    width: 100%;
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px;
    border: none; background: var(--bg-card);
    cursor: pointer; text-align: left;
    transition: transform .28s cubic-bezier(0.25,1,0.5,1);
    position: relative; z-index: 1;
}
.swipe-item.swiped .sheet-profile-btn {
    transform: translateX(-140px);
}
.sheet-profile-btn.active { background: #fefaf3; }
.spi-indicator {
    width: 8px; height: 8px; border-radius: 50%;
    border: 1.5px solid var(--chrome-muted);
    flex-shrink: 0;
    transition: background .18s, border-color .18s;
}
.spi-indicator.active { background: var(--gold); border-color: var(--gold); }
.spi-name {
    font-size: 16px; font-weight: 600; color: var(--ink); font-family: var(--font-body);
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sheet-profile-btn.active .spi-name { color: var(--gold); }
.spi-date { font-size: 12px; color: var(--ink-muted); flex-shrink: 0; }
.spi-default {
    font-size: 10px; color: var(--gold);
    border: 1px solid var(--gold-border); background: var(--gold-dim);
    border-radius: 999px; padding: 1px 8px; flex-shrink: 0; letter-spacing: .5px;
}

/* Swipe actions (revealed from right) */
.swipe-actions {
    position: absolute; top: 0; right: 0; bottom: 0;
    width: 140px;
    display: flex; align-items: stretch;
    z-index: 0;
}
.swa-btn {
    flex: 1; border: none; cursor: pointer; font-size: 13px;
    font-family: var(--font-body); font-weight: 600;
    display: flex; align-items: center; justify-content: center;
}
.swa-rename { background: #636e7b; color: #fff; }
.swa-delete { background: #e53e3e; color: #fff; }

/* Sheet footer */
.sheet-footer {
    padding: 10px 20px 16px;
    border-top: 1px solid var(--line);
    flex-shrink: 0;
}
.sheet-default-btn {
    width: 100%; min-height: 46px;
    border: 1px solid var(--line); background: var(--paper-soft);
    color: var(--ink-muted); font-size: 13px; font-family: var(--font-body);
    cursor: pointer; border-radius: 0;
    transition: background .18s;
}
.sheet-default-btn:disabled {
    color: var(--gold); border-color: var(--gold-border);
    background: var(--gold-dim); cursor: default;
}

/* Sheet slide-up transition */
.sheet-enter-active, .sheet-leave-active { transition: opacity .22s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-up-enter-active, .sheet-up-leave-active { transition: transform .3s cubic-bezier(0.25,1,0.5,1); }
.sheet-up-enter-from, .sheet-up-leave-to { transform: translateY(100%); }

/* ─── 9. 响应式清零遗留圆角 ─────────────────────────────── */
@media (min-width: 780px) {
    .profile-picker-modal { border-radius: 0; }
}
@media (max-width: 420px) {
    .profile-picker-modal, .pillar-slot, .choice-chip,
    .date-segment, .pillar-choice-panel,
    .le-guide-card, .picker-close.dark { border-radius: 0; }
    .geju-detail-drawer {
        border-radius: 0;
        border-bottom: 1px solid var(--line);
    }
}
</style>

<!-- 深色模式覆盖：只改颜色，不动结构 -->
<style>
[data-theme="dark"] .shensha-ji          { background: rgba(72,187,120,0.12); color: #68D391; }
[data-theme="dark"] .shensha-ji .shensha-section-label { color: #68D391; }
[data-theme="dark"] .shensha-xiong       { background: rgba(245,101,101,0.1); color: #FC8181; }
[data-theme="dark"] .shensha-xiong .shensha-section-label { color: #FC8181; }
[data-theme="dark"] .shensha-note        { background: rgba(212,175,55,0.1); color: #E8CC80; }
[data-theme="dark"] .shensha-note .shensha-section-label { color: #E8CC80; }
[data-theme="dark"] .scoring-role-xi     { color: #68D391; }
[data-theme="dark"] .scoring-role-chou   { color: #FC8181; }
[data-theme="dark"] .default-chip        { color: #0a0a14; }
</style>
