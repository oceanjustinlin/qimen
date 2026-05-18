<template>
  <div class="bazi-view">

    <header id="siteHeader">
        <div class="site-logo">全息八字</div>
        <div class="header-actions">
            <OpenSourceLinks />
            <AccountMenu />
        </div>
    </header>

    <div class="page-wrap">
        <div class="container">
            <div class="glass-card profile-card">
                <div class="profile-card-head">
                    <div>
                        <div class="section-kicker">命主档案</div>
                        <div class="section-title">选择或维护排盘资料</div>
                    </div>
                    <span v-if="activeProfile?.is_default" class="default-chip">默认</span>
                </div>

                <div class="profile-filter-row">
                    <div class="profile-switcher" :class="{ open: isProfileMenuOpen }">
                        <button class="profile-switch-trigger" :disabled="!showProfileSwitcher" @click="toggleProfileMenu">
                            <span class="profile-switch-name">{{ activeProfileName }}</span>
                            <span class="profile-switch-symbol" aria-hidden="true">⇄</span>
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
                    <button class="icon-btn" title="新增档案" @click="openAddProfile">+</button>
                </div>

                <div v-if="isGuest" class="guest-limit-note">访客模式仅保存 1 个本地命主档案，登录后可维护多个云端档案。</div>

                <div class="profile-actions" v-if="activeProfile && !isGuest">
                    <button class="mini-action" :disabled="activeProfile.is_default" @click="setDefaultProfile">
                        {{ activeProfile.is_default ? '已设为默认' : '设为默认' }}
                    </button>
                    <button class="mini-action" @click="openRenameProfile">修改昵称</button>
                    <button class="mini-action danger" @click="deleteProfile">删除档案</button>
                </div>

                <div v-show="showRename" class="profile-form rename-form">
                    <div class="form-row">
                        <input type="text" v-model="renameName" placeholder="新的昵称">
                    </div>
                    <div class="form-actions">
                        <button class="btn-ghost" style="border:none;color:var(--text-muted)" @click="showRename = false">取消</button>
                        <button class="btn-ghost" @click="renameProfile">保存昵称</button>
                    </div>
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
                
                <div class="bazi-header">
                    <div>
                        <div class="name-row">
                            <span class="bazi-name">{{ activeProfile.name }}</span>
                            <span
                                v-if="activeProfile.strong_weak"
                                class="badge badge-blue badge-action"
                                role="button"
                                tabindex="0"
                                title="查看身强身弱依据"
                                @click="openInsightPanel('strength')"
                                @keydown.enter.prevent="openInsightPanel('strength')"
                                @keydown.space.prevent="openInsightPanel('strength')"
                            >{{ activeProfile.strong_weak }}</span>
                            <span
                                v-if="activeProfile.geju"
                                class="badge badge-gold badge-action"
                                role="button"
                                tabindex="0"
                                title="查看格局判定"
                                @click="openInsightPanel('geju')"
                                @keydown.enter.prevent="openInsightPanel('geju')"
                                @keydown.space.prevent="openInsightPanel('geju')"
                            >{{ patternFinalName }}</span>
                        </div>
                        <div class="bazi-meta">农历：{{ lunarDateStr }}</div>
                        <div class="bazi-meta">阳历：{{ solarDateStr }}</div>
                    </div>
                    <div class="bazi-header-actions">
                        <button class="btn-primary" :disabled="isAnalyzing" @click="requestAiSummary({ force: true })">
                            {{ rerunButtonLabel }}
                        </button>
                    </div>
                </div>

                <Teleport to="body">
                    <div v-if="showGuestLoginGuide" class="modal-overlay" @click="showGuestLoginGuide = false">
                        <div class="guest-login-modal" @click.stop>
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
                </Teleport>

                <div v-if="isAnalyzing || analysisNotice" class="analysis-status" :class="{ done: analysisNotice && !isAnalyzing }">
                    <div class="loader-orbit" v-if="isAnalyzing">
                        <span></span><span></span><span></span>
                    </div>
                    <div class="analysis-copy">
                        <div class="analysis-title">{{ isAnalyzing ? analysisSteps[analysisStageIndex] : analysisNotice }}</div>
                        <div class="analysis-subtitle">{{ isAnalyzing ? '排盘、格局、岁运与喜忌正在同步校验' : '最新结果已写入当前档案' }}</div>
                    </div>
                    <div v-if="isAnalyzing" class="analysis-progress">
                        <i :style="{ width: analysisProgress + '%' }"></i>
                    </div>
                </div>

                <div class="tabs">
                    <div class="tab" :class="{ active: currentTab === 'basic' }" @click="currentTab = 'basic'">基础排盘</div>
                    <div class="tab" :class="{ active: currentTab === 'pro' }" @click="currentTab = 'pro'">专业细盘</div>
                    <button
                        v-if="activeProfile && !needsUpgrade && !isGuest"
                        class="tab life-events-tab"
                        :class="{ active: currentTab === 'events' }"
                        @click="currentTab = 'events'"
                    >
                        断事笔记
                        <span v-if="lifeEvents.length" class="life-events-tab-count">{{ lifeEvents.length }}</span>
                    </button>
                </div>

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
                                    {{ cat.icon }} {{ cat.label }}
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

                <div v-if="needsUpgrade && currentTab !== 'events'" class="matrix-fallback-note">
                    基础四柱已生成，可先查看本地排盘；点击右上角 <strong style="color:var(--gold);">「生成排盘」</strong> 后可补全格局、喜忌、断语与岁运细解。
                </div>

                <div v-show="currentTab === 'pro' && dayunList.length" class="timeline-section">
                    <BaziBackingPanel
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
                    <div v-if="selectedShensha" class="modal-overlay" @click="selectedShensha = null">
                        <div class="shensha-modal" @click.stop>
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
                </Teleport>

                <Teleport to="body">
                    <div v-if="activeInfoPanel === 'insight' && (strengthPanelContent || gejuPanelContent)" class="modal-overlay" @click="activeInfoPanel = null">
                        <div class="detail-drawer insight-detail-drawer" @click.stop>
                            <div class="drawer-head">
                                <div>
                                    <div class="section-kicker">命局判定</div>
                                    <h4>{{ insightPanelTitle }}</h4>
                                </div>
                                <button class="close-button" title="关闭" @click="activeInfoPanel = null">×</button>
                            </div>
                            <div class="insight-switcher">
                                <button class="insight-tab" :class="{ active: insightTab === 'strength' }" @click="insightTab = 'strength'">身强/身弱判定</button>
                                <button class="insight-tab" :class="{ active: insightTab === 'geju' }" @click="insightTab = 'geju'">格局判定</button>
                                <button class="insight-tab" :class="{ active: insightTab === 'explain' }" @click="insightTab = 'explain'">判定说明</button>
                            </div>
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
                                <div v-if="strengthPanelContent.sections.length" class="strength-section-list">
                                    <div v-for="section in strengthPanelContent.sections" :key="section.key" class="strength-section-card">
                                        <div class="strength-section-head">
                                            <h5>{{ section.title }}</h5>
                                            <span v-if="section.scoreLabel" class="strength-score-chip">{{ section.scoreLabel }}</span>
                                        </div>
                                        <p>{{ section.text }}</p>
                                    </div>
                                </div>
                            </template>
                            <template v-else-if="insightTab === 'geju' && gejuPanelContent">
                                <div class="geju-modal-tags">
                                    <span class="geju-chip">{{ gejuPanelContent.baseGeju }}</span>
                                    <span v-if="gejuPanelContent.showChengGe" class="geju-chip accent is-text">{{ gejuPanelContent.chengGe }}</span>
                                    <span class="geju-chip" :class="gejuPanelContent.resultClass">{{ gejuPanelContent.chengGeStatus }}</span>
                                </div>
                                <div class="geju-modal-block">
                                    <div class="geju-block-title">立格依据</div>
                                    <div class="geju-block-main">{{ gejuPanelContent.gejuBasis }}</div>
                                    <p class="geju-block-copy">{{ gejuPanelContent.judgeBase }}</p>
                                    <div v-if="gejuPanelContent.monthMergeLine" class="geju-inline-note">{{ gejuPanelContent.monthMergeLine }}</div>
                                </div>
                                <div v-if="gejuPanelContent.extractionSteps.length" class="geju-modal-block">
                                    <div class="geju-block-title">取格步骤</div>
                                    <div class="pattern-step-list">
                                        <div v-for="step in gejuPanelContent.extractionSteps" :key="step.key" class="pattern-step-item">
                                            <span>{{ step.label }}</span>
                                            <p>{{ step.value }}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="geju-modal-block">
                                    <div class="geju-block-title">顺逆与成败</div>
                                    <div class="geju-block-main">{{ gejuPanelContent.chengGeStatus }}</div>
                                    <p class="geju-block-copy">{{ gejuPanelContent.chengGeReason }}</p>
                                    <div v-if="gejuPanelContent.showChengGe" class="geju-inline-pairs geju-inline-pairs-top">
                                        <span>小格：{{ gejuPanelContent.chengGe }}</span>
                                        <span>用神：{{ gejuPanelContent.yongShen }}</span>
                                        <span>相神：{{ gejuPanelContent.xianShen }}</span>
                                    </div>
                                    <div v-if="gejuPanelContent.evaluationPairs.length" class="geju-inline-pairs">
                                        <span v-for="item in gejuPanelContent.evaluationPairs" :key="item.label">{{ item.label }}：{{ item.value }}</span>
                                    </div>
                                </div>
                                <div v-if="gejuPanelContent.climateAdjustment" class="geju-modal-block">
                                    <div class="geju-block-title">调候影响</div>
                                    <div class="geju-block-main">{{ gejuPanelContent.climateAdjustment.title }}</div>
                                    <p class="geju-block-copy">{{ gejuPanelContent.climateAdjustment.text }}</p>
                                </div>
                                <div v-if="gejuPanelContent.personality.length" class="geju-modal-block">
                                    <div class="geju-block-title">格局气质</div>
                                    <div class="geju-bullet-row">
                                        <span v-for="item in gejuPanelContent.personality" :key="item" class="geju-bullet-chip">{{ item }}</span>
                                    </div>
                                </div>
                                <div v-if="gejuPanelContent.goodFor.length" class="geju-modal-block">
                                    <div class="geju-block-title">适合方向</div>
                                    <div class="geju-bullet-list">
                                        <span v-for="item in gejuPanelContent.goodFor" :key="item" class="geju-list-chip">{{ item }}</span>
                                    </div>
                                </div>
                                <div v-if="gejuPanelContent.relationshipHealth.length" class="geju-modal-block">
                                    <div class="geju-block-title">关系与身心节奏</div>
                                    <div class="geju-bullet-list">
                                        <span v-for="item in gejuPanelContent.relationshipHealth" :key="item" class="geju-list-chip">{{ item }}</span>
                                    </div>
                                </div>
                                <div v-if="gejuPanelContent.watchOut.length" class="geju-modal-block">
                                    <div class="geju-block-title">注意事项</div>
                                    <div class="geju-bullet-list warning">
                                        <span v-for="item in gejuPanelContent.watchOut" :key="item" class="geju-list-chip">{{ item }}</span>
                                    </div>
                                </div>
                            </template>
                            <template v-else-if="explanationPanelContent">
                                <div class="explain-summary-card">
                                    <div class="explain-summary-title">一句总结</div>
                                    <p>{{ explanationPanelContent.summary }}</p>
                                </div>
                                <div class="explain-section-list">
                                    <div v-for="section in explanationPanelContent.sections" :key="section.key" class="explain-section-card">
                                        <div class="explain-section-head">
                                            <h5>{{ section.title }}</h5>
                                            <span class="explain-source-chip">{{ section.source }}</span>
                                        </div>
                                        <blockquote v-if="section.quote" class="explain-quote">{{ section.quote }}</blockquote>
                                        <div class="explain-paragraphs">
                                            <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </Teleport>

                <Teleport to="body">
                    <div v-if="activeInfoPanel === 'scoring' && activeProfile.bazi_detail?.scoring_details" class="modal-overlay" @click="activeInfoPanel = null">
                        <div class="detail-drawer" @click.stop>
                            <div class="drawer-head">
                                <div>
                                    <div class="section-kicker">用神依据</div>
                                    <h4>五神剖析 · 取用依据</h4>
                                </div>
                                <button class="close-button" title="关闭" @click="activeInfoPanel = null">×</button>
                            </div>

                            <!-- 决策链 -->
                            <div v-if="activeProfile.bazi_detail.decision_chain?.length" class="decision-chain-list">
                                <div v-for="step in activeProfile.bazi_detail.decision_chain" :key="step.layer" class="decision-chain-item">
                                    <span class="decision-layer">{{ step.layer }}</span>
                                    <span class="decision-reason">{{ step.reason }}</span>
                                    <span v-if="step.override" class="decision-override">{{ step.override }}</span>
                                </div>
                            </div>

                            <div class="scoring-section-title">五维影响概览</div>
                            <div class="scoring-list">
                                <!-- 用神 -->
                                <div v-if="fiveShenProfile?.yong" class="scoring-item scoring-yong-item">
                                    <div class="scoring-item-header">
                                        <span class="shen-badge shen-yong">{{ fiveShenProfile.yong }}</span>
                                        <span class="shen-role-tag">用神</span>
                                    </div>
                                    <div class="dim-tags" v-if="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong]">
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].tiaohou !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].tiaohou > 0 ? 'dim-pos' : 'dim-neg'" title="气候冷暖平衡">调候{{ activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].tiaohou > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].geju !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].geju > 0 ? 'dim-pos' : 'dim-neg'" title="格局主轴取用">格局{{ activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].geju > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].fuyi !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].fuyi > 0 ? 'dim-pos' : 'dim-neg'" title="日主强弱生克">扶抑{{ activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].fuyi > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].bingyao !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].bingyao > 0 ? 'dim-pos' : 'dim-neg'" title="五行偏枯制衡">病药{{ activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].bingyao > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].tongguan !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].tongguan > 0 ? 'dim-pos' : 'dim-neg'" title="两行克战化解">通关{{ activeProfile.bazi_detail.dimension_breakdown[fiveShenProfile.yong].tongguan > 0 ? '↑' : '↓' }}</span>
                                    </div>
                                </div>
                                <!-- 喜神 -->
                                <div v-for="shen in fiveShenProfile?.xi" :key="'xi'+shen" class="scoring-item fav-item">
                                    <div class="scoring-item-header">
                                        <span class="shen-badge favorable">{{ shen }}</span>
                                        <span class="shen-role-tag">喜神</span>
                                    </div>
                                    <div class="dim-tags" v-if="activeProfile.bazi_detail.dimension_breakdown[shen]">
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou > 0 ? 'dim-pos' : 'dim-neg'">调候{{ activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].geju !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].geju > 0 ? 'dim-pos' : 'dim-neg'">格局{{ activeProfile.bazi_detail.dimension_breakdown[shen].geju > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].fuyi !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].fuyi > 0 ? 'dim-pos' : 'dim-neg'">扶抑{{ activeProfile.bazi_detail.dimension_breakdown[shen].fuyi > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].bingyao !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].bingyao > 0 ? 'dim-pos' : 'dim-neg'">病药{{ activeProfile.bazi_detail.dimension_breakdown[shen].bingyao > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].tongguan !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].tongguan > 0 ? 'dim-pos' : 'dim-neg'">通关{{ activeProfile.bazi_detail.dimension_breakdown[shen].tongguan > 0 ? '↑' : '↓' }}</span>
                                    </div>
                                </div>
                                <!-- 忌神 -->
                                <div v-for="shen in fiveShenProfile?.ji" :key="'ji'+shen" class="scoring-item unfav-item">
                                    <div class="scoring-item-header">
                                        <span class="shen-badge unfavorable">{{ shen }}</span>
                                        <span class="shen-role-tag">忌神</span>
                                    </div>
                                    <div class="dim-tags" v-if="activeProfile.bazi_detail.dimension_breakdown[shen]">
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou > 0 ? 'dim-pos' : 'dim-neg'">调候{{ activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].geju !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].geju > 0 ? 'dim-pos' : 'dim-neg'">格局{{ activeProfile.bazi_detail.dimension_breakdown[shen].geju > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].fuyi !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].fuyi > 0 ? 'dim-pos' : 'dim-neg'">扶抑{{ activeProfile.bazi_detail.dimension_breakdown[shen].fuyi > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].bingyao !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].bingyao > 0 ? 'dim-pos' : 'dim-neg'">病药{{ activeProfile.bazi_detail.dimension_breakdown[shen].bingyao > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].tongguan !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].tongguan > 0 ? 'dim-pos' : 'dim-neg'">通关{{ activeProfile.bazi_detail.dimension_breakdown[shen].tongguan > 0 ? '↑' : '↓' }}</span>
                                    </div>
                                </div>
                                <!-- 仇神 -->
                                <div v-for="shen in fiveShenProfile?.chou" :key="'chou'+shen" class="scoring-item chou-item">
                                    <div class="scoring-item-header">
                                        <span class="shen-badge shen-chou">{{ shen }}</span>
                                        <span class="shen-role-tag">仇神</span>
                                    </div>
                                    <div class="dim-tags" v-if="activeProfile.bazi_detail.dimension_breakdown[shen]">
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou > 0 ? 'dim-pos' : 'dim-neg'">调候{{ activeProfile.bazi_detail.dimension_breakdown[shen].tiaohou > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].geju !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].geju > 0 ? 'dim-pos' : 'dim-neg'">格局{{ activeProfile.bazi_detail.dimension_breakdown[shen].geju > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].fuyi !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].fuyi > 0 ? 'dim-pos' : 'dim-neg'">扶抑{{ activeProfile.bazi_detail.dimension_breakdown[shen].fuyi > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].bingyao !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].bingyao > 0 ? 'dim-pos' : 'dim-neg'">病药{{ activeProfile.bazi_detail.dimension_breakdown[shen].bingyao > 0 ? '↑' : '↓' }}</span>
                                        <span v-if="activeProfile.bazi_detail.dimension_breakdown[shen].tongguan !== 0" class="dim-tag" :class="activeProfile.bazi_detail.dimension_breakdown[shen].tongguan > 0 ? 'dim-pos' : 'dim-neg'">通关{{ activeProfile.bazi_detail.dimension_breakdown[shen].tongguan > 0 ? '↑' : '↓' }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Teleport>

                <Teleport to="body">
                    <div v-if="showLeGuide" class="modal-overlay" @click="showLeGuide = false">
                        <div class="le-guide-card" @click.stop>
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
                </Teleport>

                <Teleport to="body">
                    <div v-if="activeInfoPanel === 'tiaohou' && tiaohouPanelContent" class="modal-overlay" @click="activeInfoPanel = null">
                        <div class="detail-drawer insight-detail-drawer" @click.stop>
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
                </Teleport>

                <Teleport to="body">
                    <div v-if="showCenteredToast" class="screen-toast">
                        <div class="screen-toast-card" :class="`is-${toastKind}`">{{ toastMessage }}</div>
                    </div>
                </Teleport>

                <!-- 命局天机分析版块 -->
                <div v-if="currentTab !== 'events' && activeProfile.bazi_detail && activeProfile.bazi_detail.scoring_details" class="ai-section insight-summary">
                    <div class="ai-header-row">
                        <div class="ai-header-title">命局天机</div>
                        <button class="info-button" title="查看命局判定" @click="openInsightPanel('strength')">i</button>
                    </div>
                    
                    <!-- 1. 格局特性卡片 -->
                    <div class="insight-card geju-card">
                        <div class="geju-card-head">
                            <div class="tag-row">
                                <span
                                    class="tag-gold tag-action"
                                    role="button"
                                    tabindex="0"
                                    title="查看身强身弱依据"
                                    @click="openStrengthPanel"
                                    @keydown.enter.prevent="openStrengthPanel"
                                    @keydown.space.prevent="openStrengthPanel"
                                >{{ activeProfile.strong_weak }}</span>
                                <span class="tag-gold">{{ patternFinalName }}</span>
                                <span v-if="showChengGeText" class="tag-gold tag-emerald">小格 {{ activeProfile.bazi_detail.chengge_detail.chengGe }}</span>
                            </div>
                        </div>
                        <div v-if="strengthSummaryLine" class="geju-summary-line">{{ strengthSummaryLine }}</div>
                        <div v-if="gejuSummaryLine" class="geju-summary-line secondary">{{ gejuSummaryLine }}</div>
                        <p>
                            {{ getGejuDesc(patternFinalName) }}
                        </p>
                    </div>

                    <div class="insight-card tiaohou-card" v-if="tiaohouPanelContent">
                        <div class="tiaohou-card-head">
                            <div>
                                <div class="section-kicker">调候诊断</div>
                                <h4>{{ tiaohouPanelContent.climateState }}</h4>
                            </div>
                            <div class="tiaohou-card-head-right">
                                <span class="tiaohou-urgency" :class="tiaohouPanelContent.urgencyClass">{{ tiaohouPanelContent.urgency }}</span>
                                <button class="info-button" title="查看调候详情" @click="activeInfoPanel = 'tiaohou'">i</button>
                            </div>
                        </div>
                        <div class="tiaohou-god-grid">
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
                        <p>{{ tiaohouPanelContent.explanation }}</p>
                        <div v-if="tiaohouPanelContent.warning" class="tiaohou-warning">{{ tiaohouPanelContent.warning }}</div>
                    </div>

                    <!-- 2. 五行能量占比条 -->
                    <div class="insight-card wuxing-pool-card" v-if="activeProfile.bazi_detail.wuxing_ratio">
                        <h4 class="card-heading">
                            <span>五行能量池</span>
                            <span v-if="Object.values(activeProfile.bazi_detail.wuxing_ratio).some(r => r > 45)" class="overload-tag">能量偏盛</span>
                        </h4>
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

                <div v-if="currentTab !== 'events' && resolvedYuanjuCore" class="ai-section" style="display: block;">
                    <div class="ai-header-row">
                        <div class="ai-header-title">天机锦囊</div>
                        <button class="info-button" title="查看用神决策链与四维剖析" @click="activeInfoPanel = 'scoring'">i</button>
                    </div>

                    <!-- 命局定性一行 -->
                    <div v-if="fiveShenProfile?.summary" class="jinnang-summary-line">{{ fiveShenProfile.summary }}</div>

                    <!-- 五神分层行 -->
                    <div v-if="fiveShenProfile" class="five-shen-row">
                        <div class="five-shen-cell is-yong" :title="fiveShenProfile.yongConfidence === 'LOW' ? '五行中和，用神参考' : '命局核心用神'">
                            <div class="five-shen-role">用神</div>
                            <div class="five-shen-name">{{ formatShenWithGan(fiveShenProfile.yong) }}</div>
                            <div v-if="fiveShenProfile.yongConfidence === 'LOW'" class="five-shen-note">参考</div>
                        </div>
                        <div v-if="fiveShenProfile.xi?.length" class="five-shen-cell is-xi">
                            <div class="five-shen-role">喜神</div>
                            <div class="five-shen-name">{{ fiveShenProfile.xi.map(formatShenWithGan).join(' · ') }}</div>
                        </div>
                        <div v-for="s in fiveShenProfile.ji" :key="'ji'+s" class="five-shen-cell is-ji">
                            <div class="five-shen-role">忌神</div>
                            <div class="five-shen-name">{{ formatShenWithGan(s) }}</div>
                        </div>
                        <div v-for="s in fiveShenProfile.chou" :key="'chou'+s" class="five-shen-cell is-chou">
                            <div class="five-shen-role">仇神</div>
                            <div class="five-shen-name">{{ formatShenWithGan(s) }}</div>
                        </div>
                    </div>

                    <!-- 旧式喜忌行（fallback，无 five_shens 时显示） -->
                    <div v-else class="xiji-box">
                        <div class="xiji-item">
                            <div class="xiji-label">喜用神</div>
                            <div class="xiji-val favorable">{{ (activeProfile.favorable_elements || []).map(formatShenWithGan).join('、') || '-' }}</div>
                        </div>
                        <div class="xiji-item">
                            <div class="xiji-label">忌仇神</div>
                            <div class="xiji-val unfavorable">{{ (activeProfile.unfavorable_elements || []).map(formatShenWithGan).join('、') || '-' }}</div>
                        </div>
                    </div>

                    <!-- 结构化断语块 -->
                    <template v-if="fiveShenProfile?.userBlocks">
                        <div class="jinnang-block">
                            <div class="jinnang-block-label">用神说明</div>
                            <p class="jinnang-block-text">{{ fiveShenProfile.userBlocks.yong_shen_text }}</p>
                        </div>
                        <div class="jinnang-block">
                            <div class="jinnang-block-label">喜忌方向</div>
                            <p class="jinnang-block-text">{{ fiveShenProfile.userBlocks.xi_ji_text }}</p>
                        </div>
                        <div class="jinnang-block">
                            <div class="jinnang-block-label">大运指引</div>
                            <p class="jinnang-block-text">{{ fiveShenProfile.userBlocks.dayun_guide }}</p>
                        </div>
                        <div class="jinnang-block jinnang-block-warn">
                            <div class="jinnang-block-label">注意警示</div>
                            <p class="jinnang-block-text">{{ fiveShenProfile.userBlocks.avoid_text }}</p>
                        </div>
                    </template>

                    <div class="insight-card">
                        <h4>原局核心</h4>
                        <p>{{ resolvedYuanjuCore }}</p>
                        <div v-if="feedbackCorrections.yuanju_core" class="feedback-correction-block">
                            <div class="feedback-correction-head">
                                <span>命主反馈纠偏</span>
                                <span v-if="feedbackCorrectionDate" class="feedback-correction-date">{{ feedbackCorrectionDate }}</span>
                            </div>
                            <p class="feedback-correction-copy">{{ feedbackCorrections.yuanju_core }}</p>
                        </div>
                    </div>
                    <div class="insight-card">
                        <h4>岁运推演</h4>
                        <p style="margin-bottom: 8px;">
                            <strong style="color:var(--gold)">【大运】</strong> {{ resolvedCurrentDayun }}
                        </p>
                        <p>
                            <strong style="color:var(--gold)">【流年】</strong> {{ resolvedCurrentLiunian }}
                        </p>
                        <div v-if="feedbackCorrections.current_dayun || feedbackCorrections.current_liunian" class="feedback-correction-block is-transit">
                            <div class="feedback-correction-head">
                                <span>命主反馈纠偏</span>
                                <span v-if="feedbackCorrectionDate" class="feedback-correction-date">{{ feedbackCorrectionDate }}</span>
                            </div>
                            <div v-if="feedbackCorrections.current_dayun" class="feedback-correction-line">
                                <strong>【大运修正】</strong> {{ feedbackCorrections.current_dayun }}
                            </div>
                            <div v-if="feedbackCorrections.current_liunian" class="feedback-correction-line">
                                <strong>【流年修正】</strong> {{ feedbackCorrections.current_liunian }}
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else-if="currentTab !== 'events' && activeProfile.bazi_summary" class="legacy-summary" style="display: block;">
                    {{ activeProfile.bazi_summary }}
                </div>

                <div v-if="currentTab !== 'events' && classicVerdictText" class="ai-section classic-verdict-section">
                    <div class="classic-header">
                        <div>
                            <div class="ai-header-title classic-main-title">古籍断语</div>
                            <div class="classic-subtitle">{{ classicVerdict.source || '三命通会' }}</div>
                        </div>
                        <span class="classic-key">{{ classicVerdict.key }}</span>
                    </div>
                    <div class="classic-body">
                        <p
                            v-for="(line, idx) in classicVerdictLines"
                            :key="'classic'+idx"
                            :class="{ note: line.startsWith('#') }"
                        >
                            {{ line }}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createClient } from '@supabase/supabase-js'
import { Solar } from 'lunar-javascript'
import { globalState, resolveSelectedBaziProfileId, setSelectedBaziProfileId } from '../store.js'
import { getGuestState, saveGuestBaziProfile, trackGuestEvent } from '../guestMode.mjs'
import {
    loadCachedFortune as loadSharedCachedFortune,
    rememberMonthlyInterpretationRefresh
} from '../fortuneCache.mjs'
import OpenSourceLinks from '../components/OpenSourceLinks.vue'
import AccountMenu from '../components/AccountMenu.vue'
import BaziBackingPanel from '../components/BaziBackingPanel.vue'
import BaziPillarTable from '../components/BaziPillarTable.vue'
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

const SUPABASE_URL = 'https://xkbqiiwwgfzkyfhxuoev.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_qr9YBIA6n32r-mcqKbkpgA_0XVTUSI7'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const router = useRouter()
const route = useRoute()
const getFortuneStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

// 与后端 lib/baziCore.js 的 BAZI_ENGINE_VERSION 保持同步
// 升级时同步修改两处，前端会自动检测版本旧档案并触发引擎刷新
const BAZI_ENGINE_VERSION = '1.6.2'

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
    return GEJU_DESCRIPTIONS[geju] || '此格局具有独特的五行气势，需结合大运流年综合分析。';
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
const selectedProfileId = ref('')
const currentTab = ref('basic')
const showAdd = ref(false)
const showRename = ref(false)
const isProfileMenuOpen = ref(false)
const showGuestLoginGuide = ref(false)
const isAnalyzing = ref(false)
const isSavingProfileContext = ref(false)
const isSavingMonthlyContext = ref(false)
// ── 断事笔记 ──────────────────────────────────────────
const isFormOpen = ref(false)
const isCalibrating = ref(false)

const LIFE_EVENT_CATEGORIES = [
    { value: 'career', label: '事业/学业', icon: '💼' },
    { value: 'wealth', label: '财富/资产', icon: '💰' },
    { value: 'relationship', label: '感情/婚姻', icon: '💕' },
    { value: 'health', label: '健康/灾厄', icon: '🏥' },
    { value: 'family_parent', label: '父母', icon: '👨‍👩‍👧' },
    { value: 'family_spouse', label: '配偶', icon: '💍' },
    { value: 'family_child', label: '子女', icon: '👶' },
    { value: 'family_sibling', label: '兄弟姐妹', icon: '🤝' },
]

const IMPACT_OPTIONS = [
    { value: 1, label: '🟢 顺遂/提升', cls: 'positive' },
    { value: 0, label: '🟡 平稳/变动', cls: 'neutral' },
    { value: -1, label: '🔴 坎坷/挫折', cls: 'negative' },
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
    return baziProfiles.value.find(p => p.id === selectedProfileId.value) || null
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
const showProfileSwitcher = computed(() => baziProfiles.value.length > 0)
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
    const patchShensha = (p) => {
        if (!p || !p.zhi) return p
        return {
            ...p,
            shensha: getShenShaArray(p.zhi, dayGan, yearZhi, dayZhi, {
                monthZhi, pillarGan: p.gan, yearGan, isMale, allGans
            })
        }
    }
    return {
        ...base,
        pillars: pillarsArr.map(patchShensha),
        current_dayun: patchShensha(base.current_dayun),
        current_liunian: patchShensha(base.current_liunian)
    }
})

const displayColumns = computed(() => {
    const matrix = resolvedMatrix.value
    if (!matrix) return []
    let cols = []
    if (currentTab.value === 'basic') {
        cols = matrix.pillars || []
    } else {
        if (matrix.current_liunian) cols.push(matrix.current_liunian)
        if (matrix.current_dayun) cols.push(matrix.current_dayun)
        cols.push(...(matrix.pillars || []))
    }
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

const intGroups = computed(() => {
    if (!interactions.value) return {};
    const isYuanju = (item) => item.pillars.every(p => ['year', 'month', 'day', 'time'].includes(p));
    const isYun = (item) => !isYuanju(item);

    return {
        ganYuanju: interactions.value.gans.filter(isYuanju).map(i => i.name).join('；'),
        zhiYuanju: interactions.value.zhis.filter(isYuanju).map(i => i.name).join('；'),
        ganYun: interactions.value.gans.filter(isYun).map(i => i.name).join('；'),
        zhiYun: interactions.value.zhis.filter(isYun).map(i => i.name).join('；')
    }
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
    if (typeof document === 'undefined') return
    document.querySelectorAll('.timeline-section .link-item.active').forEach((el) => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    })
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

watch(currentTab, async (tab) => {
    if (tab === 'pro') {
        await scrollActiveTransitItemsIntoView()
    }
})

watch(
    () => activeProfile.value?.id,
    async () => {
        if (!activeProfile.value || isGuest.value) {
            profileContextDraft.value = createEmptyProfileContextDraft()
            monthlyContextDraft.value = createEmptyMonthlyContextDraft(notesMonthKey.value || currentMonthKey.value)
            recentMonthlyContextRecords.value = []
            return
        }
        await fetchProfileContextDraft()
        await fetchMonthlyContextDraft()

        // 引擎版本检查：若档案的 bazi_detail.engine_version 不是最新，
        // 静默触发引擎刷新（force=false 保留 LLM，只更新运算数据）
        const profileEngineVersion = activeProfile.value?.bazi_detail?.engine_version
        const hasLlm = Boolean(
            activeProfile.value?.llm_yuanju_core &&
            activeProfile.value?.llm_current_dayun &&
            activeProfile.value?.llm_current_liunian
        )
        const hasBaziStr = Boolean(activeProfile.value?.bazi_str)
        if (hasBaziStr && hasLlm && profileEngineVersion && profileEngineVersion !== BAZI_ENGINE_VERSION) {
            console.log(`[bazi] 检测到引擎版本旧 (${profileEngineVersion} → ${BAZI_ENGINE_VERSION})，自动刷新运算数据…`)
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
    if (activeProfile.value && !isGuest.value) {
        await fetchMonthlyContextDraft()
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
        personality: normalizeTraitItems(pattern?.traits?.personality, info.personality),
        goodFor: normalizeTraitItems(pattern?.traits?.career_wealth, info.goodFor),
        relationshipHealth: normalizeTraitItems(pattern?.traits?.relationship_health),
        watchOut: normalizeTraitItems(pattern?.traits?.failure_warning, info.watchOut)
    }
})

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

const shenToGanMap = computed(() => {
    const detail = activeProfile.value?.bazi_detail
    const pillars = detail?.matrix?.pillars
    if (!pillars) return {}
    const dayGan = detail.ri_zhu?.[0]
    const map = {}
    const skip = new Set(['日主', '元男', '元女'])
    for (const p of pillars) {
        if (p.star && !skip.has(p.star) && !map[p.star]) map[p.star] = p.gan
        if (dayGan && p.hidden_stems) {
            for (const hg of p.hidden_stems) {
                const shen = computeShiShen(dayGan, hg)
                if (shen && !map[shen]) map[shen] = hg
            }
        }
    }
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

const resolvedYuanjuCore = computed(() => {
    return resolvedInterpretation.value.yuanju_core
})

const resolvedCurrentDayun = computed(() => {
    return resolvedInterpretation.value.current_dayun
})

const resolvedCurrentLiunian = computed(() => {
    return resolvedInterpretation.value.current_liunian
})

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

// 生命周期
onMounted(async () => {
    document.addEventListener('click', handleDocumentClick)
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
    stopAnalysisMotion()
    if (toastTimer) window.clearTimeout(toastTimer)
})

// 业务方法
const fetchProfiles = async () => {
    if (isGuest.value) {
        loadGuestProfile()
        return
    }
    const { data } = await supabase.from('bazi_profiles').select('*').order('created_at', {ascending: false})
    baziProfiles.value = data || []
    const requestedProfileId = String(route.query.profileId || '')
    const resolvedProfileId = resolveSelectedBaziProfileId(baziProfiles.value, {
        requestedProfileId,
        currentProfileId: selectedProfileId.value
    })
    selectedProfileId.value = resolvedProfileId
    setSelectedBaziProfileId(resolvedProfileId)
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
        const response = await fetch(`/api/context-notes?scope=profile&profile_id=${encodeURIComponent(activeProfile.value.id)}`, {
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
        const response = await fetch(`/api/context-notes?scope=monthly&profile_id=${encodeURIComponent(activeProfile.value.id)}&month_key=${encodeURIComponent(notesMonthKey.value)}`, {
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

const saveProfileContextDraft = async () => {
    if (!activeProfile.value || isGuest.value) return
    isSavingProfileContext.value = true
    try {
        const shouldRefreshInterpretation = computeProfileContextRefreshSignal(profileContextBaseline.value, profileContextDraft.value)
        const accessToken = await getAccessToken()
        const response = await fetch('/api/context-notes', {
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
        const response = await fetch('/api/context-notes', {
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
    handleProfileSelect()
}

const handleDocumentClick = (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest('.profile-switcher')) isProfileMenuOpen.value = false
}

const openAddProfile = () => {
    if (isGuest.value && baziProfiles.value.length >= 1) {
        alert('访客模式仅可添加 1 个本地八字档案')
        return
    }
    resetProfileEntry()
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
    if (isGuest.value) {
        const profile = buildGuestProfile(payload)
        saveGuestBaziProfile(undefined, profile)
        baziProfiles.value = [profile]
        selectedProfileId.value = profile.id
        setSelectedBaziProfileId(profile.id)
        showAdd.value = false
        resetProfileEntry()
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
        showAdd.value = false
        resetProfileEntry()
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
        await fetchProfiles()
    }
}

const deleteProfile = async () => {
    if (selectedProfileId.value && confirm("确认删除该档案？")) { 
        const deletedId = selectedProfileId.value
        await supabase.from('bazi_profiles').delete().eq('id', deletedId)
        baziProfiles.value = baziProfiles.value.filter(profile => profile.id !== deletedId)
        const nextProfileId = resolveSelectedBaziProfileId(baziProfiles.value)
        selectedProfileId.value = nextProfileId
        setSelectedBaziProfileId(nextProfileId)
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
    startAnalysisMotion()
    try {
        const pd = promptDataObj.value
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch('/api/bazi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ 
                promptData: { profileId, gender: pd.gender, birthStr: pd.birthStr, baziStr: pd.baziStr, daYunStr: "当前大运", force }
            })
        })

        const data = await response.json()
        if (data.error) throw new Error(data.error)
        analysisProgress.value = 100
        await fetchProfiles() // 刷新拿到最新数据
        if (shouldCalibrateFromEvents) {
            await triggerCalibration({ profileId, force })
        }
        analysisNotice.value = '推演完成'
    } catch (err) {
        alert("推演失败: " + err.message)
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

        const res = await fetch('/api/bazi-calibrate', {
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
                })
                .eq('id', profileId)
            if (dbError) throw dbError
            baziProfiles.value[idx] = {
                ...baziProfiles.value[idx],
                calibrated_yuanju_core: data.yuanju_core,
                calibrated_current_dayun: data.current_dayun,
                calibrated_current_liunian: data.current_liunian,
                calibrated_at: calibratedAt,
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
.bazi-view { width: 100%; min-height: 100vh; position: relative;}

#siteHeader { position: fixed; top: 0; left: 0; right: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 14px 20px; height: 60px; backdrop-filter: blur(24px) saturate(1.5); -webkit-backdrop-filter: blur(24px) saturate(1.5); background: rgba(5,5,10,0.65); border-bottom: 1px solid rgba(255,255,255,0.04); }
.site-logo { font-family: 'Noto Serif SC', serif; font-size: 17px; letter-spacing: .15em; font-weight: 500; background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 12px rgba(212,175,55,0.45)); }
.header-actions { position: absolute; right: 20px; top: 50%; display: flex; align-items: center; gap: 8px; transform: translateY(-50%); }

.page-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 76px 14px 60px; }
.container { width: 100%; max-width: 520px; }

.glass-card { background: rgba(14,14,24,0.72); border: 1px solid rgba(232,204,128,0.12); border-radius: 16px; padding: 18px 14px; margin-bottom: 16px; backdrop-filter: blur(20px) saturate(1.2); box-shadow: 0 4px 32px rgba(0,0,0,0.35); animation: riseIn 0.5s ease both; }
@keyframes riseIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }

.profile-card { position: relative; z-index: 40; padding: 16px; overflow: visible; }
.profile-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-kicker { color: rgba(232,204,128,0.72); font-size: 10px; letter-spacing: 2px; margin-bottom: 4px; }
.section-title { color: var(--text-primary); font-size: 14px; font-weight: 600; }
.default-chip { color: #101018; background: linear-gradient(135deg, var(--gold-light), var(--gold)); border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 700; }

.profile-filter-row { display: grid; grid-template-columns: minmax(0, 1fr) 48px; gap: 8px; align-items: stretch; margin-bottom: 10px; }
.profile-switcher { position: relative; z-index: 60; min-width: 0; }
.profile-switch-trigger { width: 100%; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 12px; border: none; border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(212,175,55,0.06)); color: var(--gold-light); cursor: pointer; box-shadow: inset 0 0 0 1px rgba(212,175,55,0.14); padding: 8px 12px; }
.profile-switch-trigger:disabled { opacity: .68; cursor: default; }
.profile-switch-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-serif); font-size: 20px; letter-spacing: 1px; line-height: 1.15; }
.profile-switch-symbol { color: var(--gold-light); font-size: 21px; line-height: 1; opacity: .92; }
.profile-switcher.open .profile-switch-trigger { box-shadow: inset 0 0 0 1px rgba(212,175,55,0.24), 0 0 20px rgba(212,175,55,0.08); }
.profile-flyout { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 120; padding: 8px; border-radius: 16px; background: rgba(12,12,22,0.98); border: 1px solid rgba(212,175,55,0.2); box-shadow: 0 16px 40px rgba(0,0,0,0.45); backdrop-filter: blur(24px); }
.profile-flyout-item { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-radius: 12px; background: transparent; color: var(--text-primary); cursor: pointer; text-align: left; }
.profile-flyout-item + .profile-flyout-item { margin-top: 4px; }
.profile-flyout-item.active { background: rgba(212,175,55,0.1); box-shadow: inset 0 0 0 1px rgba(212,175,55,0.18); }
.profile-item-main { font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-item-date { color: #FF5E57; font-size: 12px; white-space: nowrap; }
.profile-item-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.icon-btn { width: 48px; min-height: 48px; height: 100%; border-radius: 14px; border: 1px solid rgba(232,204,128,0.32); background: rgba(212,175,55,0.1); color: var(--gold-light); font-size: 22px; line-height: 1; cursor: pointer; }
.guest-limit-note { color: var(--text-muted); font-size: 11px; line-height: 1.6; margin-bottom: 12px; padding: 9px 11px; border-radius: 10px; border: 1px solid rgba(232,204,128,0.12); background: rgba(212,175,55,0.05); }
.profile-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.mini-action { min-height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.035); color: #D8D2BF; font-size: 12px; cursor: pointer; white-space: nowrap; }
.mini-action:disabled { cursor: default; color: var(--gold-light); border-color: rgba(232,204,128,0.25); background: rgba(232,204,128,0.08); }
.mini-action.danger { color: #FF8F88; }
.mini-action--subtle { color: rgba(216,210,191,0.88); border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
.btn-ghost { min-height: 36px; background: rgba(212,175,55,0.12); color: var(--gold-light); border: 1px solid rgba(232,204,128,0.35); padding: 0 14px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all .2s; white-space: nowrap; }
.btn-ghost:hover { background: var(--gold); color: #000; }
.btn-ghost:disabled { opacity: .7; cursor: default; }
.btn-compact { min-height: 34px; padding: 0 12px; font-size: 12px; }
.btn-danger { background: rgba(255,94,87,0.1); color: #FF5E57; border: 1px solid rgba(255,94,87,0.3); border-radius: 8px; padding: 0 10px; cursor: pointer; }
.btn-primary { background: linear-gradient(135deg, var(--gold-light), var(--gold)); color: #08080E; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-weight: 700; font-family: var(--font-body); box-shadow: 0 2px 10px rgba(212,175,55,0.26); transition: transform 0.2s; white-space: nowrap; }
.btn-primary:active { transform: scale(0.95); }
.btn-primary:disabled { opacity: .7; cursor: wait; }

.profile-form { background: rgba(255,255,255,0.025); padding: 14px; border-radius: 12px; border: 1px dashed rgba(232,204,128,0.16); margin-top: 10px; }
.rename-form { margin-bottom: 2px; }
.form-row { display: flex; gap: 12px; margin-bottom: 12px; }
.form-row input, .form-row select { flex: 1; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); color: white; outline: none; font-family: var(--font-body); }
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
    border: 1px solid rgba(232,204,128,0.16);
    background:
        radial-gradient(circle at top left, rgba(232,204,128,0.06), transparent 28%),
        linear-gradient(180deg, rgba(18,18,30,0.98), rgba(10,10,18,0.98));
    box-shadow: 0 24px 72px rgba(0,0,0,0.45);
    padding: 18px;
    color: var(--text-primary);
    animation: pickerSheetIn .24s ease both;
}
.picker-sheet-handle {
    width: 42px;
    height: 4px;
    border-radius: 999px;
    background: rgba(255,255,255,0.2);
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
.picker-heading { color: #F4EBDD; font-size: 16px; font-weight: 700; }
.picker-mode-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(232,204,128,0.16);
}
.picker-mode-tab {
    min-height: 40px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #AFA79A;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
}
.picker-mode-tab.active {
    background: linear-gradient(135deg, rgba(232,204,128,0.94), rgba(212,175,55,0.94));
    color: #111114;
    box-shadow: 0 6px 18px rgba(212,175,55,0.18);
}
.picker-close.dark {
    position: relative;
    z-index: 2;
    justify-self: end;
    background: rgba(255,255,255,0.04);
    color: #B8AF9B;
    border-color: rgba(232,204,128,0.16);
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
    color: #D8D2BF;
    font-size: 12px;
    font-weight: 700;
}
.picker-text-field input {
    width: 100%;
    min-height: 44px;
    border: none;
    border-bottom: 1px solid rgba(232,204,128,0.18);
    border-radius: 0;
    background: transparent;
    color: #F4EBDD;
    padding: 0 2px;
    font-size: 14px;
    outline: none;
}
.picker-text-field input:focus {
    border-color: rgba(232,204,128,0.5);
}
.gender-segment {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    min-height: 44px;
    border-bottom: 1px solid rgba(232,204,128,0.18);
}
.gender-segment button {
    border: none;
    background: transparent;
    color: #AFA79A;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
}
.gender-segment button.active {
    color: #F4EBDD;
    box-shadow: inset 0 -2px 0 var(--gold-light);
}
.picker-panel {
    border-top: 1px solid rgba(232,204,128,0.1);
    padding-top: 14px;
}
.picker-column { display: flex; flex-direction: column; gap: 8px; }
.picker-column-label {
    text-align: left;
    color: #E5D5AF;
    font-size: 14px;
    font-weight: 700;
}
.picker-preview-card {
    border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(232,204,128,0.1);
    padding: 12px 14px;
    color: #D8D2BF;
    line-height: 1.7;
    font-size: 13px;
}
.picker-preview-card.muted { color: #8D9098; }
.date-input-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 14px;
}
.date-input-card {
    border-radius: 18px;
    border: 1px solid rgba(232,204,128,0.14);
    background:
        linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)),
        rgba(0,0,0,0.16);
    padding: 14px;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
}
.location-search-card {
    min-width: 0;
    position: relative;
    border-top: 1px solid rgba(232,204,128,0.1);
    border-bottom: 1px solid rgba(232,204,128,0.1);
    padding: 13px 0 12px;
}
.location-search-field span {
    display: block;
    margin-bottom: 8px;
    color: #D8D2BF;
    font-size: 12px;
    font-weight: 700;
}
.location-search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 48px;
    border: 1px solid rgba(232,204,128,0.14);
    border-radius: 999px;
    background: rgba(6,6,14,0.62);
    padding: 0 12px;
}
.location-search-input-wrap svg {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    color: #AFA79A;
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
    color: #F7F0E2;
    font-size: 14px;
    outline: none;
}
.location-search-input-wrap:focus-within {
    border-color: rgba(232,204,128,0.34);
    box-shadow: 0 0 0 1px rgba(232,204,128,0.12);
}
.location-clear-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    color: #D8D2BF;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
}
.location-result-list {
    margin-top: 10px;
    max-height: 252px;
    overflow: auto;
    border-top: 1px solid rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.location-result-item {
    width: 100%;
    display: grid;
    gap: 3px;
    padding: 13px 2px;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.055);
    background: transparent;
    color: #F4EBDD;
    text-align: left;
    cursor: pointer;
}
.location-result-item:last-child { border-bottom: none; }
.location-result-item span {
    font-size: 15px;
    font-weight: 700;
}
.location-result-item small {
    color: #928A7C;
    font-size: 11px;
}
.location-result-item:hover {
    color: var(--gold-light);
}
.location-empty {
    padding: 16px 2px;
    color: #8D9098;
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
    color: #AFA79A;
    font-size: 13px;
    font-weight: 700;
}
.time-check input {
    width: 18px;
    height: 18px;
    accent-color: var(--gold);
}
.time-check.active {
    color: #F4EBDD;
}
.time-check.disabled {
    opacity: .62;
}
.date-input-label {
    display: block;
    margin-bottom: 10px;
    color: #F4EBDD;
    font-size: 15px;
    font-weight: 700;
}
.date-input-card input {
    width: 100%;
    min-height: 54px;
    border-radius: 16px;
    border: 1px solid rgba(232,204,128,0.18);
    background: rgba(6,6,14,0.72);
    color: #F7F0E2;
    padding: 0 16px;
    font-size: 21px;
    letter-spacing: 0.14em;
    outline: none;
    box-shadow: inset 0 0 18px rgba(0,0,0,0.24);
}
.date-input-card input::placeholder {
    color: rgba(212,204,190,0.34);
    letter-spacing: normal;
    font-size: 15px;
}
.date-input-card input:focus {
    border-color: rgba(232,204,128,0.38);
    box-shadow: 0 0 0 1px rgba(232,204,128,0.16), inset 0 0 18px rgba(0,0,0,0.24);
}
.date-input-hint {
    margin-top: 10px;
    color: #9E988B;
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
    border: 1px solid rgba(232,204,128,0.1);
    background: rgba(255,255,255,0.03);
    padding: 12px 6px;
    text-align: center;
}
.date-segment span {
    display: block;
    margin-bottom: 6px;
    color: #928A7C;
    font-size: 11px;
    letter-spacing: 1px;
}
.date-segment strong {
    display: block;
    color: #F4EBDD;
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
    border: 1px solid rgba(232,204,128,0.14);
    border-radius: 24px;
    background:
        linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)),
        rgba(7,7,16,0.72);
    color: #D8D2BF;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
}
.pillar-slot.derived {
    background: rgba(255,255,255,0.018);
}
.pillar-slot.active {
    border-color: rgba(232,204,128,0.46);
    background:
        linear-gradient(180deg, rgba(232,204,128,0.12), rgba(232,204,128,0.04)),
        rgba(18,12,6,0.64);
    box-shadow: inset 0 0 18px rgba(212,175,55,0.08);
}
.slot-label {
    font-size: 14px;
    color: #AFA79A;
    font-weight: 700;
}
.slot-value {
    font-size: 26px;
    color: #F4EBDD;
    font-family: var(--font-ganzhi);
    font-weight: 600;
}
.pillar-choice-panel {
    border-radius: 24px;
    border: 1px solid rgba(232,204,128,0.12);
    background:
        radial-gradient(circle at top right, rgba(232,204,128,0.05), transparent 28%),
        rgba(5,5,14,0.68);
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
    color: #AFA79A;
    font-size: 12px;
    line-height: 1.6;
}
.orb-title {
    color: #BBAF94;
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
    border: 1px solid rgba(232,204,128,0.14);
    background:
        linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012)),
        rgba(10,10,20,0.78);
    font-size: 24px;
    font-weight: 700;
    font-family: var(--font-ganzhi);
    cursor: pointer;
}
.choice-chip.active {
    border-color: rgba(232,204,128,0.46);
    background: rgba(212,175,55,0.12);
    box-shadow: inset 0 0 16px rgba(212,175,55,0.08);
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

.bazi-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid rgba(232,204,128,0.12); padding-bottom: 14px; margin-bottom: 14px; }
.bazi-header-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.bazi-name { font-family: var(--font-serif); font-size: 20px; color: var(--gold-light); letter-spacing: 2px; font-weight: bold; }
.bazi-meta { font-size: 11px; color: var(--text-muted); line-height: 1.6; margin-top: 2px; }

.badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: var(--font-body); letter-spacing: 1px; font-weight: 500; }
.badge-gold { background: rgba(212,175,55,0.15); color: var(--gold-light); border: 1px solid rgba(212,175,55,0.3); }
.badge-blue { background: rgba(78, 205, 196, 0.15); color: #4ECDC4; border: 1px solid rgba(78, 205, 196, 0.3); }
.badge-action { cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
.badge-action:hover, .badge-action:focus-visible { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(78,205,196,0.12); outline: none; }
.pattern-tag { font-size: 10px; color: #E8CC80; background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.2); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-right: 4px; margin-top: 4px; }

.analysis-status { position: relative; display: flex; align-items: center; gap: 12px; overflow: hidden; margin: -2px 0 14px; padding: 12px; border: 1px solid rgba(232,204,128,0.16); border-radius: 12px; background: rgba(232,204,128,0.055); }
.analysis-status.done { border-color: rgba(129,199,132,0.22); background: rgba(129,199,132,0.07); }
.loader-orbit { position: relative; width: 30px; height: 30px; flex: 0 0 30px; border: 1px solid rgba(232,204,128,0.25); border-radius: 50%; animation: spin 1.6s linear infinite; }
.loader-orbit span { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--gold-light); box-shadow: 0 0 10px rgba(232,204,128,.65); }
.loader-orbit span:nth-child(1) { top: -3px; left: 12px; }
.loader-orbit span:nth-child(2) { right: 0; bottom: 4px; opacity: .7; }
.loader-orbit span:nth-child(3) { left: 1px; bottom: 5px; opacity: .45; }
.analysis-copy { min-width: 0; flex: 1; }
.analysis-title { color: #F5E9CE; font-size: 13px; font-weight: 700; margin-bottom: 3px; }
.analysis-subtitle { color: var(--text-muted); font-size: 11px; }
.analysis-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(255,255,255,0.06); }
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
    --bz-label-size: 10px;
    --bz-meta-size: 10px;
    --bz-char-size: 16px;
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
    text-align: center;
}
.bazi-table th, .bazi-table td { padding: var(--bz-cell-py) 0; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; word-wrap: break-word; }
.bazi-table th { color: var(--gold-light); font-family: var(--font-serif); font-size: 12px; font-weight: normal; letter-spacing: 1px; }
.bazi-table th:first-child, .bazi-table td:first-child { width: 44px; }

.bz-label { color: var(--text-muted); font-weight: 500; font-size: var(--bz-label-size); }
.bz-star { font-size: var(--bz-meta-size); color: var(--text-primary); }
.bz-char { font-size: var(--bz-char-size); font-weight: 600; font-family: var(--font-ganzhi); margin: 2px 0; }
.bz-sub { font-size: var(--bz-meta-size); color: #aaa; line-height: 1.4; }
.bz-shensha { font-size: 9px; color: #B39DDB; line-height: 1.4; }
.matrix-fallback-note {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(232,204,128,0.14);
    background: rgba(232,204,128,0.05);
    color: var(--gold-light);
    font-size: 12px;
    line-height: 1.7;
}

.wx-jin { color: #E8CC80; } .wx-mu { color: #81C784; } .wx-shui { color: #64B5F6; } .wx-huo { color: #E57373; } .wx-tu { color: #DCE775; } .wx-none { color: #666; }

.timeline-section { margin-top: 16px; border-top: 1px dashed var(--glass-border); padding-top: 16px; }
.timeline-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.timeline-title { font-size: 14px; color: var(--gold); margin-bottom: 0; font-family: var(--font-serif); text-align: center; font-weight: 500; }
.timeline-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.timeline-icon-btn { width: 30px; height: 30px; border-radius: 999px; border: 1px solid rgba(232,204,128,0.16); background: rgba(255,255,255,0.04); color: var(--gold-light); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.timeline-icon-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.timeline-icon-btn.accent { background: rgba(212,175,55,0.14); border-color: rgba(232,204,128,0.26); }

.linkage-row { display: flex; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(0,0,0,0.25); overflow: hidden; }
.row-label { width: 36px; display: flex; align-items: center; justify-content: center; background: rgba(212,175,55,0.06); color: var(--gold-light); font-size: 12px; text-align: center; font-weight: 500; border-right: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; line-height: 1.3; }
.row-content { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; padding: 4px; flex: 1; scroll-snap-type: x proximity; }
.row-content::-webkit-scrollbar { display: none; }

.link-item { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 58px; padding: 6px 4px; border-radius: 8px; cursor: pointer; transition: all 0.2s; flex-shrink: 0; border: 1px solid transparent; scroll-snap-align: center; }
.link-item.active { background: rgba(255,255,255,0.05); border-color: rgba(212,175,55,0.4); box-shadow: inset 0 0 15px rgba(212,175,55,0.08); }
.lr-item { min-width: 52px; }

.item-header { font-size: 10px; color: #aaa; margin-bottom: 5px; text-align: center; line-height: 1.35; min-height: 28px; display: flex; align-items: center; justify-content: center; }
.item-body { display: flex; flex-direction: row; gap: 4px; align-items: center; justify-content: center; flex-wrap: nowrap; min-height: 22px; }
.stacked-ganzhi { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.xiaoyun-body { font-size: 14px; color: #777; margin-top: 8px; }

.char-wrap { position: relative; display: flex; align-items: center; justify-content: center; width: 18px; min-width: 18px; height: 20px; padding-right: 8px; flex: 0 0 auto; }
.stacked-ganzhi .char-wrap { width: 100%; min-width: 0; height: 19px; padding-right: 10px; }
.char-gan, .char-zhi { font-size: 16px; font-family: var(--font-ganzhi); font-weight: 600; line-height: 1;}
.fortune-guide-card { margin-top: 12px; padding: 14px; border-radius: 14px; border: 1px solid rgba(232,204,128,0.14); background: linear-gradient(180deg, rgba(232,204,128,0.08), rgba(255,255,255,0.02)); display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative; overflow: hidden; }
.fortune-guide-card.masked::after { content: ''; position: absolute; inset: 0; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); background: linear-gradient(180deg, rgba(8,8,16,0.12), rgba(8,8,16,0.28)); pointer-events: none; }
.fortune-guide-title { color: var(--gold-light); font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.fortune-guide-copy { color: #D8D2BF; font-size: 12px; line-height: 1.6; }
.fortune-guide-btn { flex-shrink: 0; min-height: 34px; padding: 0 12px; border: 1px solid rgba(232,204,128,0.3); border-radius: 999px; background: rgba(212,175,55,0.16); color: var(--gold-light); font-size: 12px; font-weight: 700; cursor: pointer; }

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
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
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
.shensha-modal { background: var(--bg-card); border: 1px solid var(--gold); border-radius: 12px; padding: 20px; width: 80%; max-width: 340px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); animation: riseIn 0.3s ease; }
.shensha-modal h4 { color: var(--gold-light); font-size: 16px; margin: 0; font-family: var(--font-serif); }
.shensha-modal p { font-size: 13px; color: #D0D0D8; line-height: 1.6; }
.shensha-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px dashed rgba(212,175,55,0.3); padding-bottom: 10px; margin-bottom: 10px; }
.shensha-nature-badge { font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
.nature-吉 { background: rgba(72,187,120,0.18); color: #68D391; border: 1px solid rgba(72,187,120,0.4); }
.nature-凶 { background: rgba(245,101,101,0.18); color: #FC8181; border: 1px solid rgba(245,101,101,0.4); }
.nature-中性 { background: rgba(160,160,180,0.15); color: #CBD5E0; border: 1px solid rgba(160,160,180,0.3); }
.shensha-summary { font-size: 13px; color: #D0D0D8; line-height: 1.7; margin: 0 0 10px; }
.shensha-section { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.65; padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; }
.shensha-section-label { font-weight: 700; letter-spacing: 1px; flex-shrink: 0; font-size: 11px; padding-top: 1px; }
.shensha-ji { background: rgba(72,187,120,0.08); color: #9AE6B4; }
.shensha-ji .shensha-section-label { color: #68D391; }
.shensha-xiong { background: rgba(245,101,101,0.08); color: #FEB2B2; }
.shensha-xiong .shensha-section-label { color: #FC8181; }
.shensha-note { background: rgba(212,175,55,0.07); color: #C8B87A; }
.shensha-note .shensha-section-label { color: var(--gold); }
.guest-login-modal { position: relative; width: min(86vw, 360px); padding: 24px 22px 22px; border-radius: 14px; border: 1px solid rgba(232,204,128,0.24); background: linear-gradient(135deg, rgba(18,18,34,0.98), rgba(11,11,24,0.98)); box-shadow: 0 18px 48px rgba(0,0,0,0.58); animation: riseIn 0.3s ease; }
.guest-login-kicker { color: var(--text-muted); font-size: 11px; letter-spacing: 2px; margin-bottom: 8px; }
.guest-login-modal h3 { margin: 0 0 10px; color: var(--gold-light); font-family: var(--font-serif); font-size: 18px; line-height: 1.45; }
.guest-login-modal p { margin: 0; color: rgba(240,237,230,0.84); font-size: 13px; line-height: 1.8; }
.guest-login-modal a { color: #9DB7FF; text-decoration: none; border-bottom: 1px solid rgba(157,183,255,0.46); }
.guest-login-modal a:hover { color: #C8D5FF; border-bottom-color: rgba(200,213,255,0.82); }
.guest-login-close { position: absolute; right: 12px; top: 12px; }

/* 关系可视化面板已经移除旧版CSS */

.ai-section { margin-top: 16px; animation: riseIn 0.5s ease both; }
.insight-summary { margin-bottom: 16px; }
.ai-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.ai-header-title { font-family: var(--font-serif); color: var(--gold); font-size: 15px; display: flex; align-items: center; gap: 6px; }
.ai-section > .ai-header-title { margin-bottom: 12px; }
.ai-header-title::before { content: '✧'; font-size: 12px; }
.info-button, .close-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(232,204,128,0.28); background: rgba(232,204,128,0.08); color: var(--gold-light); cursor: pointer; }
.info-button { width: 26px; height: 26px; border-radius: 50%; font-family: Georgia, serif; font-style: italic; font-weight: 700; }
.close-button { width: 32px; height: 32px; border-radius: 8px; font-size: 22px; line-height: 1; }

/* ── 天机锦囊 五神行 ─────────────────────────────── */
.jinnang-summary-line { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; letter-spacing: 0.4px; }
.five-shen-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.five-shen-cell { border-radius: 8px; padding: 7px 10px; text-align: center; min-width: 54px; border: 1px solid transparent; flex-shrink: 0; }
.five-shen-cell.is-yong { background: rgba(232,204,128,0.12); border-color: rgba(232,204,128,0.3); }
.five-shen-cell.is-xi   { background: rgba(129,199,132,0.08); border-color: rgba(129,199,132,0.2); }
.five-shen-cell.is-ji   { background: rgba(229,115,115,0.08); border-color: rgba(229,115,115,0.25); }
.five-shen-cell.is-chou { background: rgba(200,70,70,0.07);   border-color: rgba(200,70,70,0.2); }
.five-shen-cell.is-xian { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06); }
.five-shen-role { font-size: 9px; color: var(--text-muted); margin-bottom: 3px; }
.five-shen-name { font-size: 12px; font-weight: 500; }
.five-shen-cell.is-yong .five-shen-name { color: var(--gold); }
.five-shen-cell.is-xi   .five-shen-name { color: #81C784; }
.five-shen-cell.is-ji   .five-shen-name { color: #E57373; }
.five-shen-cell.is-chou .five-shen-name { color: #ef9a9a; }
.five-shen-cell.is-xian .five-shen-name { color: var(--text-muted); }
.five-shen-note { font-size: 9px; color: var(--text-muted); margin-top: 2px; }
/* ── 锦囊断语块 ─────────────────────────────────── */
.jinnang-block { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.jinnang-block:last-of-type { border-bottom: none; margin-bottom: 8px; }
.jinnang-block-warn .jinnang-block-label { color: #E57373; opacity: 0.85; }
.jinnang-block-label { font-size: 10px; color: var(--gold); opacity: 0.75; margin-bottom: 4px; letter-spacing: 0.5px; }
.jinnang-block-text { font-size: 13px; color: var(--text-secondary); line-height: 1.65; margin: 0; }
/* ── Scoring modal 决策链 + 新角色标签 ──────────── */
.decision-chain-list { margin-bottom: 16px; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
.decision-chain-item { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 2px; }
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

.xiji-box { display: flex; gap: 8px; margin-bottom: 14px; }
.xiji-item { flex: 1; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 10px; padding: 10px; text-align: center; }
.xiji-label { font-size: 10px; color: var(--text-muted); margin-bottom: 4px; }
.xiji-val { font-weight: 500; font-size: 13px; }
.xiji-val.favorable { color: #81C784; }
.xiji-val.unfavorable { color: #E57373; }

.insight-card { background: linear-gradient(180deg, rgba(232,204,128,0.06) 0%, rgba(255,255,255,0.015) 100%); border: 1px solid rgba(232,204,128,0.12); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.insight-card h4 { color: var(--gold-light); font-size: 12px; margin-bottom: 8px; font-family: var(--font-body); border-bottom: 1px dashed rgba(212,175,55,0.2); padding-bottom: 6px; }
.insight-card p { line-height: 1.65; font-size: 13px; color: #D8D2BF; }
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
    background: rgba(0,0,0,0.16);
    border: 1px solid rgba(255,255,255,0.07);
}
.tiaohou-god-cell span {
    display: block;
    margin-bottom: 4px;
    color: var(--text-muted);
    font-size: 10px;
}
.tiaohou-god-cell strong {
    display: block;
    color: #eef1df;
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
.verdict-line { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(232,204,128,0.14); min-width: 0; }
.verdict-line span { display: block; flex: 0 0 auto; color: rgba(232,204,128,0.72); font-size: 11px; margin-bottom: 0; white-space: nowrap; }
.verdict-line p { flex: 1; min-width: 0; color: #F3EBDD; font-size: 14px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.overload-tag { color: #FF8F88; font-size: 12px; animation: pulse 1.5s infinite; }

.legacy-summary { background: rgba(212,175,55,0.05); border: 1px solid var(--gold-border); border-radius: 12px; padding: 14px; font-size: 12px; color: #D0D0D8; line-height: 1.8; white-space: pre-wrap; margin-top: 16px; }

.classic-verdict-section {
    border: 1px solid rgba(212,175,55,0.24);
    border-radius: 12px;
    padding: 14px;
    background:
        linear-gradient(180deg, rgba(232,204,128,0.08), rgba(0,0,0,0.08)),
        rgba(255,255,255,0.02);
}
.classic-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 10px;
    margin-bottom: 12px;
    border-bottom: 1px dashed rgba(212,175,55,0.24);
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
    color: #D8D2BF;
    font-size: 13px;
    line-height: 1.75;
    font-family: var(--font-body);
}
.classic-body p.note {
    color: var(--text-muted);
    font-size: 12px;
    font-family: var(--font-body);
    padding-left: 10px;
    border-left: 2px solid rgba(212,175,55,0.2);
}

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
.tag-action {
    cursor: pointer;
    transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
}
.tag-action:hover, .tag-action:focus-visible {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(212,175,55,0.12);
    outline: none;
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
    background: #2a2a2a;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
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
    background: rgba(0,0,0,0.2);
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
    border-bottom: 1px solid rgba(255,255,255,0.05);
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
    width: min(92vw, 460px);
    max-height: 78vh;
    overflow-y: auto;
    background: rgba(13,13,22,0.96);
    border: 1px solid rgba(232,204,128,0.24);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 18px 60px rgba(0,0,0,0.58);
    animation: riseIn 0.25s ease;
}
.strength-drawer {
    width: min(92vw, 520px);
}
.insight-detail-drawer {
    width: min(92vw, 560px);
}
.geju-detail-drawer {
    width: min(92vw, 560px);
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
    border: 1px solid rgba(232,204,128,0.16);
    background: rgba(255,255,255,0.03);
    color: #cdbf96;
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
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px dashed rgba(232,204,128,0.18);
}
.drawer-head h4 {
    color: var(--gold-light);
    font-size: 17px;
    font-family: var(--font-serif);
    font-weight: 500;
}
.strength-meter-card {
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(232,204,128,0.12);
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
    color: #BDB39A;
    font-size: 12px;
}
.strength-meter-track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(91,141,239,0.42), rgba(232,204,128,0.28), rgba(218,87,72,0.44));
    border: 1px solid rgba(255,255,255,0.08);
}
.strength-meter-fill {
    height: 100%;
    min-width: 4px;
    border-radius: 999px;
    background: rgba(232,204,128,0.72);
    box-shadow: 0 0 14px rgba(232,204,128,0.22);
}
.strength-meter-thumb {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #F2D889;
    border: 2px solid #201A10;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 3px rgba(242,216,137,0.18);
}
.strength-meter-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    color: #8F846D;
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
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(232,204,128,0.1);
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
    background: rgba(232,204,128,0.08);
    border: 1px solid rgba(232,204,128,0.16);
    color: #EBD08E;
    font-size: 11px;
    font-weight: 600;
}
.strength-section-card p {
    color: #D8D2BF;
    font-size: 13px;
    line-height: 1.7;
}
.explain-summary-card,
.explain-section-card {
    padding: 14px;
    border-radius: 12px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(232,204,128,0.1);
}
.explain-summary-card {
    margin-bottom: 12px;
    background: linear-gradient(180deg, rgba(232,204,128,0.08), rgba(255,255,255,0.025));
}
.explain-summary-title {
    margin-bottom: 8px;
    color: var(--gold-light);
    font-size: 13px;
    font-weight: 700;
}
.explain-summary-card p {
    color: #f2ead5;
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
    border: 1px solid rgba(232,204,128,0.16);
    background: rgba(232,204,128,0.08);
    color: #e7d5a3;
    font-size: 10px;
    letter-spacing: 0.4px;
}
.explain-quote {
    margin: 0 0 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border-left: 3px solid rgba(232,204,128,0.44);
    background: rgba(232,204,128,0.06);
    color: #f2dfaf;
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
    color: #d8d2bf;
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
    border: 1px solid rgba(232,204,128,0.12);
    background: rgba(255,255,255,0.025);
    color: #cfc6b0;
    font-size: 12px;
    line-height: 1.6;
}
.geju-summary-line.secondary {
    background: rgba(255,255,255,0.02);
    color: #bfb6a2;
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
    border: 1px solid rgba(232,204,128,0.18);
    background: rgba(255,255,255,0.03);
    color: #f1dfae;
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
    border-top: 1px dashed rgba(232,204,128,0.14);
}
.context-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
}
.context-card-title {
    color: var(--gold-light);
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
    border: 1px solid rgba(232,204,128,0.14);
    background: rgba(14,14,24,0.86);
    color: #F4E6C0;
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
    border-bottom: 1px solid rgba(232,204,128,0.08);
}
.context-panel:last-child {
    padding-bottom: 0;
    border-bottom: none;
}
.context-panel-title {
    margin-bottom: 10px;
    color: var(--gold-light);
    font-size: 14px;
    font-weight: 700;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
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
    color: #D9CCA8;
    font-size: 12px;
}
.context-field input,
.context-field select,
.context-field textarea {
    width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(232,204,128,0.12);
    background: rgba(10,10,18,0.84);
    color: #F2E8D0;
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
    color: #D9CCA8;
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
    border-bottom: 1px dashed rgba(232,204,128,0.08);
}
.context-recent-item:last-child {
    border-bottom: none;
}
.context-recent-month {
    color: var(--gold-light);
    font-size: 12px;
    font-weight: 700;
}
.context-recent-copy {
    color: #D8D2BF;
    font-size: 12px;
    line-height: 1.6;
}
.context-notes-message {
    margin-top: 12px;
    color: #d5c495;
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
    border: 1px solid rgba(232,204,128,0.24);
    background: rgba(10,10,18,0.9);
    box-shadow: 0 14px 40px rgba(0,0,0,0.34);
    color: #f4e6c0;
    font-size: 14px;
    line-height: 1.6;
    text-align: center;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}
.screen-toast-card.is-error {
    border-color: rgba(255,143,136,0.26);
    color: #ffd1cc;
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
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(232,204,128,0.1);
    margin-bottom: 12px;
}
.geju-block-title {
    margin-bottom: 8px;
    color: rgba(232,204,128,0.72);
    font-size: 11px;
    letter-spacing: 1px;
}
.geju-block-main {
    color: #f5ebce;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 7px;
}
.geju-block-copy {
    color: #d8d2bf;
    font-size: 13px;
    line-height: 1.7;
}
.geju-verdict-copy {
    color: #f3ebdd;
    font-weight: 600;
}
.geju-inline-note {
    margin-top: 9px;
    color: #9ec7ff;
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
    background: rgba(0,0,0,0.16);
    border: 1px solid rgba(255,255,255,0.055);
}
.pattern-step-item span {
    display: block;
    margin-bottom: 4px;
    color: #f0d58f;
    font-size: 12px;
    font-weight: 700;
}
.pattern-step-item p {
    color: #d8d2bf;
    font-size: 12px;
    line-height: 1.6;
}
.geju-inline-pairs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 10px;
    color: #d7c89b;
    font-size: 12px;
}
.geju-inline-pairs-top {
    margin-top: 12px;
}
.geju-subcopy {
    margin-top: 10px;
    color: #cfc6b0;
}
.geju-bullet-row, .geju-bullet-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.geju-bullet-chip, .geju-list-chip {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.06);
    color: #e7ddc6;
    font-size: 12px;
}
.geju-bullet-list.warning .geju-list-chip {
    color: #ffb3aa;
    border-color: rgba(255,159,151,0.2);
    background: rgba(255,159,151,0.08);
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
        --bz-cell-py: 6px;
        --bz-label-size: 9px;
        --bz-meta-size: 9px;
        --bz-char-size: 17px;
    }
    .bazi-table th { font-size: 11px; letter-spacing: .5px; }
    .bazi-table th:first-child, .bazi-table td:first-child { width: 40px; }
    .bz-sub { line-height: 1.3; }
    .bz-shensha { font-size: 8px; line-height: 1.3; }
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
    width: min(92vw, 400px);
    max-height: 78vh;
    overflow-y: auto;
    background: color-mix(in srgb, var(--bg-card) 96%, black 55%);
    border: 1px solid var(--gold-border);
    border-radius: 20px;
    padding: 20px 18px;
    box-shadow: 0 20px 60px color-mix(in srgb, black 55%, transparent);
    animation: riseIn 0.25s ease;
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
</style>
