<template>
  <div class="home-view">
    <header id="siteHeader" :class="{ 'result-header': viewState === 'result' }">
      <button class="hamburger" :class="{ open: globalState.isDrawerOpen }" @click="toggleDrawer" aria-label="历史记录">
        <span></span><span></span><span></span>
      </button>
      <div v-if="viewState !== 'result'" class="site-logo" @click="resetToInput" style="cursor: pointer;" title="返回首页">奇门道</div>
      <div v-if="viewState !== 'result'" class="header-actions">
        <OpenSourceLinks />
        <AccountMenu />
      </div>
    </header>

    <!-- 历史记录抽屉 - Teleport 到 App.vue 的 #drawer-host 中 -->
    <Teleport to="#drawer-host">
      <div id="historyDrawer" :class="{ open: globalState.isDrawerOpen }">
        <div class="drawer-head">
          <div class="drawer-topbar">
            <div class="drawer-brand">奇门道</div>
            <button class="drawer-close" type="button" @click="globalState.isDrawerOpen = false" aria-label="关闭历史记录">×</button>
          </div>
          <button class="drawer-new-session" type="button" @click="startNewSession">
            <span>再起一局</span>
            <span aria-hidden="true">↗</span>
          </button>
          <div class="drawer-title-txt">推演回溯</div>
        </div>
        <div class="drawer-filter">
          <div class="filter-select-wrap">
            <select id="historyCategorySelect" v-model="activeCategory" class="filter-select" aria-label="分类查阅">
              <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                {{ cat.label }}
              </option>
            </select>
            <span class="filter-select-arrow" aria-hidden="true">⌄</span>
          </div>
        </div>
        <div class="drawer-body" id="drawerBody" @scroll.passive="handleHistoryScroll">
          <div v-if="filteredHistory.length === 0 && !historyLoading" class="drawer-empty">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" opacity="0.3">
              <circle cx="32" cy="32" r="28" stroke="rgba(212,175,55,0.5)" stroke-width="1"/>
              <circle cx="32" cy="32" r="18" stroke="rgba(212,175,55,0.3)" stroke-width="1" stroke-dasharray="3 3"/>
              <circle cx="32" cy="32" r="3" fill="rgba(212,175,55,0.5)"/>
            </svg>
            <p>尚无推演记录<br>缘起于此，万象皆空</p>
          </div>
          <div v-else class="d-hist-item" v-for="item in filteredHistory" :key="item.id" @click="loadRecord(item)">
            <span class="d-hist-dot" :class="getVerdictCls(item.score)"></span>
            <div class="d-hist-info">
              <div class="d-hist-q">{{ item.question }}</div>
              <div class="d-hist-meta">
                <span>{{ item.dateStr }}</span><span>·</span>
                <span>{{ item.catLabel }}</span><span v-if="!isBaziRecord(item)">·</span>
                <span v-if="!isBaziRecord(item)">{{ item.score }}分</span>
              </div>
            </div>
            <span v-if="!isBaziRecord(item)" class="d-hist-badge" :class="'verdict-' + getVerdictInfo(item.score).cls">{{ getVerdictInfo(item.score).label }}</span>
          </div>
          <div v-if="historyLoading" class="drawer-loading">加载中…</div>
          <button v-else-if="historyHasMore && filteredHistory.length" class="drawer-load-more" type="button" @click="loadHistoryPage()">
            加载更多
          </button>
        </div>
      </div>
    </Teleport>

    <div class="page-wrap" :class="{ 'result-page-wrap': viewState === 'result' }">
      <div class="container" :class="{ 'public-landing-container': !canUseApp && viewState === 'input' }">
        <section v-if="!canUseApp && viewState === 'input'" class="seo-landing" aria-labelledby="seoLandingTitle">
          <h1 id="seoLandingTitle">奇门遁甲在线排盘与 AI 解盘</h1>
          <p class="seo-lead">
            奇门道提供奇门遁甲在线排盘、八字四柱排盘和今日运势分析。输入时间、地点和所问之事，即可生成局盘、宫位、干支、评分与行动建议。
          </p>
          <div class="seo-proof">规则引擎先排盘，AI 负责解释。</div>
          <div class="seo-entry-grid" aria-label="核心功能入口">
            <div class="seo-entry">
              <span>奇门问事</span>
              <small>按当下时辰起局，分析感情、事业、财运与选择。</small>
            </div>
            <div class="seo-entry">
              <span>八字排盘</span>
              <small>四柱十神、喜用神、格局、大运流年一键生成。</small>
            </div>
            <div class="seo-entry">
              <span>今日运势</span>
              <small>每日、每周、月度节奏和可执行建议。</small>
            </div>
          </div>
        </section>

        <div v-if="!canUseApp && globalState.authReady" class="auth-landing-wrap mobile-auth-first">
          <template v-if="authView === 'landing'">
            <div class="auth-hero">
              <div class="hero-scatter" aria-hidden="true">
                <span class="hs e2">☷</span>
                <span class="hs e3">✦</span>
                <span class="hs e4">☲</span>
                <span class="hs e5">☵</span>
              </div>
              <div class="auth-taiji-wrap" aria-hidden="true">
                <svg class="auth-taiji-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(181,141,59,0.15)" stroke-width="1"/>
                  <circle cx="60" cy="60" r="37" fill="none" stroke="rgba(181,141,59,0.14)" stroke-width="1" stroke-dasharray="5 5" stroke-linecap="round"/>
                  <circle cx="60" cy="60" r="24" fill="rgba(181,141,59,0.055)" stroke="rgba(181,141,59,0.16)" stroke-width="1"/>
                  <path d="M60,36 A12,12 0 0,1 60,60 A12,12 0 0,0 60,84 A24,24 0 0,1 60,36" fill="rgba(181,141,59,0.18)"/>
                  <path d="M60,36 Q73,48 60,60 Q47,72 60,84" fill="none" stroke="rgba(181,141,59,0.2)" stroke-width="1"/>
                  <circle cx="60" cy="48" r="3" fill="rgba(181,141,59,0.42)"/>
                  <circle cx="60" cy="72" r="3" fill="rgba(247,244,238,0.84)"/>
                  <circle cx="60" cy="60" r="4" fill="rgba(181,141,59,0.24)"/>
                </svg>
              </div>
              <div class="hero-brand">
                <div class="hero-label">QIMEN DAO</div>
                <h1 class="hero-name">奇门道</h1>
                <p class="hero-sub">洞察天机，<em>决胜千里</em></p>
              </div>
            </div>
            <div class="auth-btns">
              <button class="abtn abtn--solid" type="button" @click="authView = 'login'">登录</button>
              <button class="abtn abtn--border" type="button" :disabled="googleAuthLoading || authLoading" @click="handleGoogleAuth">
                <span class="google-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z"/>
                  </svg>
                </span>
                {{ googleAuthLoading ? '正在跳转...' : 'Google 登录' }}
              </button>
              <div class="abtn-divider"><span>——或者——</span></div>
              <button class="abtn abtn--ghost" type="button" @click="handleGuestEntry">访客登录</button>
              <button class="abtn-text" type="button" @click="authView = 'register'">注册</button>
              <p class="auth-legal">
                继续即表示同意
                <router-link to="/terms">《用户协议》</router-link>与
                <router-link to="/privacy">《隐私政策》</router-link>
              </p>
            </div>
          </template>

          <template v-else-if="authView === 'login'">
            <div class="auth-form-pg">
              <button class="auth-back" type="button" @click="authView = 'landing'">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                返回
              </button>
              <h2 class="afm-title">登录</h2>
              <div class="afm-fields">
                <label class="afm-field">
                  <span>邮箱</span>
                  <input type="email" v-model="authForm.email" placeholder="name@example.com" autocomplete="email"/>
                </label>
                <label class="afm-field">
                  <span>密码</span>
                  <input type="password" v-model="authForm.password" placeholder="至少 6 位" autocomplete="current-password"/>
                </label>
              </div>
              <button class="abtn abtn--solid" type="button" :disabled="authLoading" @click="handleAuth">
                {{ authLoading ? '验证中...' : '登录' }}
              </button>
              <div class="afm-sub">
                <button class="forgot-password-link" type="button" :disabled="resetEmailLoading" @click="handleResetPasswordEmail">
                  {{ resetEmailLoading ? '正在发送...' : '忘记密码' }}
                </button>
              </div>
              <div v-if="resetEmailNotice" class="auth-notice">{{ resetEmailNotice }}</div>
            </div>
          </template>

          <template v-else-if="authView === 'register'">
            <div class="auth-form-pg">
              <button class="auth-back" type="button" @click="authView = 'landing'">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                返回
              </button>
              <h2 class="afm-title">注册</h2>
              <div class="afm-fields">
                <label class="afm-field">
                  <span>邮箱</span>
                  <input type="email" v-model="authForm.email" placeholder="name@example.com" autocomplete="email"/>
                </label>
                <label class="afm-field">
                  <span>密码</span>
                  <input type="password" v-model="authForm.password" placeholder="至少 6 位" autocomplete="new-password"/>
                </label>
              </div>
              <button class="abtn abtn--solid" type="button" :disabled="authLoading" @click="handleAuth">
                {{ authLoading ? '注册中...' : '注册' }}
              </button>
              <p class="auth-legal">
                继续即表示同意
                <router-link to="/terms">《用户协议》</router-link>与
                <router-link to="/privacy">《隐私政策》</router-link>
              </p>
            </div>
          </template>
        </div>

        <div v-else class="app-section">
          <transition name="fade" mode="out-in">
            <div v-show="viewState === 'input'" class="input-wrapper">
              <div class="tagline">
                <div class="tagline-main">天时 · 地利 · 人和</div>
                <div class="tagline-sub">洞察天机，决胜千里</div>
              </div>

              <div class="glass-card qimen-profile-panel">
                <div v-if="showProfileSwitcher" class="profile-switcher" :class="{ open: isProfileMenuOpen }">
                  <button class="profile-switch-trigger" type="button" @click="toggleProfileMenu">
                    <span class="profile-switch-name">{{ activeProfileName }}</span>
                    <span class="profile-switch-symbol" aria-hidden="true">⇄</span>
                  </button>
                  <div v-if="isProfileMenuOpen" class="profile-flyout">
                    <button
                      v-for="profile in baziProfiles"
                      :key="profile.id"
                      class="profile-flyout-item"
                      :class="{ active: profile.id === selectedProfileId }"
                      type="button"
                      @click="selectProfile(profile.id)"
                    >
                      <span class="profile-item-main">{{ profile.name }}</span>
                      <span class="profile-item-date">{{ formatSolarDate(profile.birth_date) }}</span>
                      <span class="profile-item-meta">{{ profileMetaText(profile) }}</span>
                    </button>
                  </div>
                </div>
                <button v-else class="add-bazi-profile-btn" type="button" @click="goToBaziProfiles">
                  添加八字档案
                </button>
              </div>

              <div class="glass-card input-card">
                <div class="input-label">
                  <span>叩问天机</span>
                  <button class="route-info-trigger" type="button" @click.stop="showRouteInfoModal = true" aria-label="查看八字与奇门分流说明">i</button>
                </div>
                <textarea v-model="questionInput" placeholder="在心中默念所求之事，写下您的羁绊与心中所惑……"></textarea>
                <div class="suggestion-slot">
                  <Transition name="sugg-row" mode="out-in">
                    <div v-if="!questionInput" :key="suggestionPairIdx" class="suggestion-row">
                      <button
                        v-for="(q, i) in visibleSuggestions"
                        :key="i"
                        class="suggestion-pill"
                        type="button"
                        @click="selectSuggestion(q)"
                      >
                        <span class="suggestion-icon" aria-hidden="true">✦</span>{{ q }}
                      </button>
                    </div>
                  </Transition>
                </div>
                <div class="time-row">
                  <div class="time-display" :class="{ 'is-custom': panTime }" role="button" tabindex="0" @click="showTimePicker = true" @keyup.enter="showTimePicker = true">
                    <span class="time-dot" :class="{ 'is-custom': panTime }"></span>
                    <span>{{ clockText }}</span>
                    <span class="time-edit-ic" aria-hidden="true">✎</span>
                  </div>
                  <div class="time-note" :class="{ 'is-reset': panTime }" @click="onTimeNoteClick">{{ panTime ? '重置为现在' : '以当下时辰起局' }}</div>
                </div>
              </div>

              <div class="cta-wrap">
                <button
                  class="cta-btn"
                  :disabled="isSubmitting && !isGuest"
                  @click="isGuest ? handleGuestLoginRedirect() : startDivination()"
                >
                  <div class="cta-inner">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="opacity:.75;flex-shrink:0">
                      <circle cx="10" cy="10" r="8.5" stroke="#1a1000" stroke-width="1"/>
                      <path d="M10 1.5a8.5 8.5 0 0 1 0 17A4.25 4.25 0 0 1 10 10a4.25 4.25 0 0 0 0-8.5z" fill="#1a1000" opacity=".5"/>
                      <circle cx="10" cy="5.75" r="1.5" fill="#1a1000"/>
                      <circle cx="10" cy="14.25" r="1.5" fill="#1a1000" opacity=".4"/>
                    </svg>
                    <span class="cta-text">{{ isGuest ? '请先登录' : '洞察天机' }}</span>
                  </div>
                </button>
                <div class="cta-hint">奇门遁甲 · AI 深度推演</div>
              </div>

            </div>
          </transition>

          <transition name="fade">
            <div v-show="viewState === 'loading'" id="loader">
              <!-- 引擎中间产物 / 标签骨架 -->
              <transition name="fade">
                <div v-if="wenShiEngineResult" class="wenshi-engine-result">
                  <div class="wenshi-tags">
                    <span
                      v-for="tag in wenShiEngineResult.tags"
                      :key="tag.label"
                      class="wenshi-tag"
                      :class="{ 'score-pending': tag.isScore && isWenShiLlmLoading }"
                    >{{ tag.label }}</span>
                  </div>
                </div>
                <div v-else class="wenshi-tags-skeleton">
                  <i style="width:88px"></i><i style="width:64px"></i><i style="width:116px"></i>
                </div>
              </transition>

              <!-- LLM 流式文字 / 文本骨架 -->
              <div
                v-if="wenShiLlm.text"
                class="wenshi-stream-prose"
                :class="{ streaming: wenShiLlm.status === 'streaming' }"
                v-html="renderStreamProse(wenShiLlm.text)"
              ></div>
              <div v-else class="wenshi-llm-skeleton">
                <i style="width:94%"></i><i style="width:80%"></i><i style="width:88%"></i>
                <i style="width:62%"></i><i style="width:90%"></i><i style="width:74%"></i>
                <i style="width:84%"></i><i style="width:58%"></i>
              </div>
            </div>
          </transition>

          <transition name="fade">
            <div v-show="viewState === 'result'" class="result-wrapper">
              <!-- 持久能量球层：覆盖 hero 区，卡片切换时不销毁，保证膨胀/变色/定格全程丝滑 -->
              <div v-show="showOrbFx" class="wenshi-orb-fx" :class="[orbSettling ? 'settling' : '', orbTone]">
                <!-- 粒子星盘：加载~定格期间渲染，定格时随 .settling 淡出，由 .wo-final 接管 -->
                <WenshiOrb ref="wenshiOrbRef" class="wenshi-orb-particles" :tone="orbTone" :active="showOrbFx" />
                <div class="wenshi-orb">
                  <!-- 终态色球：默认透明，定格时缓慢淡入并随 wrapper 放大，化成 hero 渐变 -->
                  <div class="wo-final"></div>
                </div>
                <div class="wenshi-orb-status" v-show="!orbSettling"><span class="txt">{{ wenShiStatus }}</span><span class="dots"></span></div>
              </div>
              <div v-html="resultHtml" class="html-container"></div>
              <!-- 终态覆盖层：在脚手架之上淡入，盖满后底层再无声切换为终态，全程底层不空 -->
              <Transition name="ov-fade">
                <div v-if="finalOverlayHtml" v-html="finalOverlayHtml" class="html-container result-overlay"></div>
              </Transition>
              <Teleport v-if="showBaziBackingAnchor" to="#bazi-backing-anchor">
                <BaziBackingPanel
                  :profile="snapshotProfile"
                  :result-data="activeBaziResultData"
                  :analysis-mode="activeBaziResultData.meta?.analysis_mode"
                  :selected-year="baziCardSelectedYear"
                  :collapsible="true"
                  @update:selected-year="baziCardSelectedYear = $event"
                >
                  <template #identity>
                    <div v-if="snapshotProfile && snapshotProfile.name" class="backing-identity">
                      <div class="backing-section-title">原局命盘</div>
                      <div class="backing-name-row">
                        <span class="backing-name">{{ snapshotProfile.name }}</span>
                        <span v-if="snapshotProfile.strong_weak" class="backing-badge badge-blue">{{ snapshotProfile.strong_weak }}</span>
                        <span v-if="snapshotPatternName" class="backing-badge badge-gold">{{ snapshotPatternName }}</span>
                      </div>
                      <div v-if="snapshotLunarStr" class="backing-meta">农历：{{ snapshotLunarStr }}</div>
                    </div>
                  </template>
                </BaziBackingPanel>
              </Teleport>

              <!-- 静态底盘 + 动态触发 panel（推演解读 section） -->
              <Teleport v-if="showBaziPanelAnchor" to="#bazi-panel-anchor">
                <BaziStaticPanel
                  :matrix="baziPanelMatrix"
                  :state-report="activeBaziResultData.state_report"
                  :target-spec="activeBaziResultData.target_spec || { primary_shishen: [], primary_gongwei: [] }"
                  :anchor-kind="baziPanelAnchorKind"
                  :category="activeBaziResultData.meta?.category || activeBaziResultData.category || ''"
                  :shishen-theory="baziPanelShishenTheory"
                  :profile-info="baziPanelProfileInfo"
                  :five-shens="baziPanelFiveShens"
                />
                <BaziDynamicPanel
                  v-if="activeBaziResultData.dynamic_report || baziPanelTimingWindows.length"
                  :mode="baziPanelMode"
                  :dynamic-report="activeBaziResultData.dynamic_report || null"
                  :trigger-windows="baziPanelTimingWindows"
                  :dayun-groups="baziPanelDayunGroups"
                  :best-window-year="baziPanelBestYear"
                  :avoid-window-text="baziPanelAvoidText"
                  :target-map="baziPanelTargetMap"
                  style="margin-top:16px;"
                />
              </Teleport>
              <div class="result-actions">
                <button class="reset-btn" @click="resetToInput">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 1.4-3.5L2 2v3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  再起一局
                </button>
                <button
                  class="result-save-img-btn"
                  :class="{ saving: isSavingImage }"
                  @click="saveAsImage"
                  :disabled="isSavingImage"
                  title="保存为图片分享"
                >
                  <svg v-if="!isSavingImage" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1 10v1.5A1.5 1.5 0 0 0 2.5 13h9A1.5 1.5 0 0 0 13 11.5V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                  <svg v-else class="spin-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="10 8" stroke-linecap="round"/>
                  </svg>
                  {{ isSavingImage ? '生成中' : '保存' }}
                </button>
                <button
                  v-if="activeResultRecord?.canFeedback"
                  class="result-feedback-btn"
                  :class="{ done: activeResultRecord.hasFeedback }"
                  @click="openFeedbackDrawer(activeResultRecord)"
                >
                  {{ activeResultRecord.hasFeedback ? '已反馈' : '反馈' }}
                </button>
              </div>

              <!-- 追问 dock 占位：撑出固定栏的高度，避免遮住上方内容 -->
              <div v-if="canFollowup" class="followup-dock-spacer"></div>

              <!-- 追问 dock：固定屏幕下方（导航之上），液态玻璃 -->
              <div v-if="canFollowup" class="wenshi-followup-dock">
                <Transition name="dock-pop" mode="out-in">
                  <div v-if="followupNewMatter" key="newmatter" class="followup-newmatter">
                    <span class="fn-text">这看起来是一个新问题，原局答不了。要为它重新起一局吗？</span>
                    <div class="fn-actions">
                      <button class="fn-confirm" @click="confirmRecastFromFollowup">重新起局</button>
                      <button class="fn-cancel" @click="followupNewMatter = null">取消</button>
                    </div>
                  </div>
                  <div v-else key="bar" class="followup-bar">
                    <textarea
                      ref="followupTextarea"
                      v-model="followupInput"
                      class="followup-input"
                      rows="1"
                      :placeholder="followupSubmitting ? '正在追问解读…' : '就这一局继续追问…'"
                      :disabled="followupSubmitting"
                      @input="autoGrowFollowup"
                      @keydown.enter.exact.prevent="submitFollowup"
                    ></textarea>
                    <button
                      class="followup-send"
                      :class="{ loading: followupSubmitting }"
                      :disabled="followupSubmitting || !followupInput.trim()"
                      @click="submitFollowup"
                      aria-label="发送追问"
                    >
                      <svg v-if="!followupSubmitting" viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      <svg v-else class="dock-spin" viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.4" stroke-dasharray="16 12" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </Transition>
              </div>
            </div>
          </transition>
        </div>

        <section v-if="!canUseApp && viewState === 'input'" class="seo-faq-section" aria-label="常见问题">
          <div class="seo-faq-head">
            <h2>常见问题</h2>
            <p>把搜索用户最关心的问题放在工具入口之后，先体验，再解释边界。</p>
          </div>
          <div class="seo-faq-list">
            <details>
              <summary>奇门道可以做什么？</summary>
              <p>可以在线生成奇门遁甲局盘、AI 解盘、八字四柱排盘和每日运势分析。</p>
            </details>
            <details>
              <summary>AI 解盘和传统排盘有什么区别？</summary>
              <p>奇门道先用规则引擎计算时间、干支、宫位和评分，再由 AI 把盘面转成可读解释。</p>
            </details>
            <details>
              <summary>奇门问事需要出生时间吗？</summary>
              <p>奇门问事可以按当前时间起局；八字排盘和长期运势分析需要出生日期、时间和出生地。</p>
            </details>
          </div>
        </section>
      </div>
    </div>

    <div class="feedback-overlay" :class="{ show: isFeedbackDrawerOpen }" @click="closeFeedbackDrawer">
      <aside class="feedback-drawer" @click.stop>
        <div class="feedback-head">
          <div>
            <div class="feedback-kicker">应验反馈</div>
            <h3>这一次推演后来怎么样？</h3>
          </div>
          <button class="feedback-close" @click="closeFeedbackDrawer" aria-label="关闭反馈抽屉">&times;</button>
        </div>

        <div v-if="feedbackTargetRecord" class="feedback-summary">
          <div class="feedback-question">“{{ feedbackTargetRecord.question }}”</div>
          <div class="feedback-meta">
            <span>{{ feedbackTargetRecord.dateStr }}</span>
            <span>{{ feedbackTargetRecord.catLabel }}</span>
            <span>{{ feedbackTargetRecord.score }}分</span>
          </div>
          <p v-if="feedbackConclusion" class="feedback-conclusion">{{ feedbackConclusion }}</p>
        </div>

        <div class="feedback-form">
          <div class="feedback-field">
            <div class="feedback-label">应验程度</div>
            <div class="feedback-options">
              <button
                v-for="option in feedbackAccuracyOptions"
                :key="option.value"
                class="feedback-option"
                :class="{ active: feedbackForm.accuracy_status === option.value }"
                @click="feedbackForm.accuracy_status = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="feedback-field">
            <div class="feedback-label">结果方向</div>
            <div class="feedback-options">
              <button
                v-for="option in feedbackDirectionOptions"
                :key="option.value"
                class="feedback-option"
                :class="{ active: feedbackForm.actual_direction === option.value }"
                @click="feedbackForm.actual_direction = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="feedback-field">
            <div class="feedback-label">补充说明 <span>{{ feedbackForm.note.length }}/200</span></div>
            <textarea
              v-model="feedbackForm.note"
              class="feedback-note"
              maxlength="200"
              placeholder="例如：实际第二天下午收到回复，但结果没有继续推进。"
            ></textarea>
          </div>
        </div>

        <div class="feedback-actions">
          <button class="feedback-secondary" @click="closeFeedbackDrawer">取消</button>
          <button class="feedback-primary" :disabled="feedbackSaving" @click="submitQimenFeedback">
            {{ feedbackSaving ? '保存中...' : (feedbackTargetRecord?.hasFeedback ? '更新反馈' : '提交反馈') }}
          </button>
        </div>
      </aside>
    </div>

    <div class="route-info-overlay" :class="{ show: showRouteInfoModal }" @click="showRouteInfoModal = false">
      <div class="route-info-card" @click.stop>
        <div class="route-info-title">
          <span>系统如何自动判断</span>
          <button class="route-info-close" type="button" @click="showRouteInfoModal = false" aria-label="关闭分流说明">&times;</button>
        </div>
        <div class="route-info-grid">
          <div class="route-info-row">
            <div class="route-tool">八字</div>
            <div>
              <div class="route-focus">长期格局</div>
              <p>看命局、大运流年、行业适配、财官婚健的长期趋势。</p>
            </div>
          </div>
          <div class="route-info-row">
            <div class="route-tool">奇门</div>
            <div>
              <div class="route-focus">具体事件</div>
              <p>看成败、应期、方位、A/B 选择和短期行动策略。</p>
            </div>
          </div>
          <div class="route-info-row">
            <div class="route-tool">综合</div>
            <div>
              <div class="route-focus">宏观定调，微观决策</div>
              <p>先看八字底色，再用奇门判断眼前这件事怎么动。</p>
            </div>
          </div>
        </div>
        <div class="route-quota-bar">
          <span class="rq-label">今日问事额度</span>
          <template v-if="currentUser">
            <span v-if="dailyQimenUsed === null" class="rq-loading">查询中…</span>
            <span v-else class="rq-count">
              <span
                v-for="i in DAILY_QIMEN_LIMIT"
                :key="i"
                class="rq-pip"
                :class="{ 'rq-pip--used': i <= dailyQimenUsed }"
              ></span>
              <span class="rq-text">今日剩余 {{ Math.max(0, DAILY_QIMEN_LIMIT - dailyQimenUsed) }} / {{ DAILY_QIMEN_LIMIT }}</span>
            </span>
          </template>
          <span v-else class="rq-guest">登录后可用</span>
        </div>
        <div class="route-info-note">你只需自然提问；系统会先识别问题类型，自动选择八字、奇门或综合路径，并注入对应规则。</div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="homeToast" class="screen-toast">
        <div class="screen-toast-card" :class="`is-${homeToastKind}`">{{ homeToastMsg }}</div>
      </div>
    </Teleport>

    <!-- 固定起局时间选择器 -->
    <Teleport to="body">
      <TimePickerSheet :open="showTimePicker" :initial="panTime" @confirm="onTimePickerConfirm" @cancel="showTimePicker = false" />
    </Teleport>

    <!-- 重置为现在 · 二次确认 -->
    <Teleport to="body">
      <div class="reset-time-overlay" :class="{ show: showResetTimeConfirm }" @click="showResetTimeConfirm = false">
        <div class="reset-time-box" @click.stop>
          <p>重置为现在的时辰？</p>
          <small v-if="panTime">将放弃已选 {{ panTime.month }}月{{ panTime.day }}日 {{ String(panTime.hour).padStart(2, '0') }}:{{ String(panTime.minute).padStart(2, '0') }}</small>
          <div class="reset-time-actions">
            <button type="button" class="rt-ghost" @click="showResetTimeConfirm = false">取消</button>
            <button type="button" class="rt-solid" @click="confirmResetTime">重置</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 长图预览弹窗 -->
    <div class="share-img-overlay" :class="{ show: shareImgUrl }" @click="closeShareModal">
      <div class="share-img-modal" @click.stop>
        <div class="share-img-header">
          <span class="share-img-kicker">SHARE IMAGE</span>
          <span class="share-img-title">长按图片保存</span>
          <button class="share-img-close" @click="closeShareModal" aria-label="关闭">×</button>
        </div>
        <div class="share-img-body">
          <img
            v-if="shareImgUrl"
            :src="shareImgUrl"
            class="share-img-preview"
            alt="奇门推演结果图"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.mjs'
import { Solar } from 'lunar-javascript'
import { getGuestState, trackGuestEvent } from '../guestMode.mjs'
import {
  enterGuestMode,
  getCachedBaziProfiles,
  globalState,
  leaveGuestMode,
  resolveSelectedBaziProfileId,
  setCachedBaziProfiles,
  setCurrentUser,
  setSelectedBaziProfileId
} from '../store.js'
import { warmFortuneCacheFromSupabase } from '../fortuneWarmup.mjs'
import AccountMenu from '../components/AccountMenu.vue'
import BaziBackingPanel from '../components/BaziBackingPanel.vue'
import BaziStaticPanel from '../components/BaziStaticPanel.vue'
import BaziDynamicPanel from '../components/BaziDynamicPanel.vue'
import OpenSourceLinks from '../components/OpenSourceLinks.vue'
import TimePickerSheet from '../components/TimePickerSheet.vue'
import WenshiOrb from '../components/WenshiOrb.vue'
import { buildGoogleOAuthSignInArgs } from '../auth/googleOAuth.mjs'
import { buildPasswordResetEmailArgs } from '../auth/passwordReset.mjs'
import { normalizeQimenCardData } from '../utils/qimenCardFallbacks.mjs'
import {
  QIMEN_ACCURACY_OPTIONS,
  QIMEN_DIRECTION_OPTIONS,
  buildDefaultFeedbackForm,
  mergeQimenFeedbackIntoRecords,
  normalizeQimenFeedbackForm
} from '../qimenFeedback.mjs'
import { BAZI_PROFILE_QIMEN_SELECT } from '../baziProfileFields.mjs'

const DAILY_QIMEN_LIMIT = 2
const HISTORY_PAGE_SIZE = 20
const QIMEN_HISTORY_LIST_SELECT = 'id, created_at, user_id, question, category, score:qimen_data->summary->>score, branch:qimen_data->>branch, conclusion:qimen_data->summary->>conclusion'

const buildBeijingDayRange = (now = new Date()) => {
  const OFFSET = 8 * 60 * 60 * 1000
  const DAY = 24 * 60 * 60 * 1000
  const bj = new Date(now.getTime() + OFFSET)
  const startMs = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - OFFSET
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(startMs + DAY).toISOString() }
}

const getApiBase = () => {
  const configuredBase = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
  if (configuredBase) return configuredBase
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.qimen-1ff.pages.dev')) {
    return 'https://qimen-preview.oceanjustinlin.workers.dev'
  }
  return ''
}
const API_BASE = getApiBase()
const apiPath = (path) => `${API_BASE}${path}`
const API_URL = apiPath("/api/qimen")
const FOLLOWUP_API_URL = apiPath("/api/qimen-followup")
const BAZI_FOLLOWUP_API_URL = apiPath("/api/bazi-followup")
const ROUTE_API_URL = apiPath("/api/divination-route")
const BAZI_QUESTION_API_URL = apiPath("/api/bazi-question")
const router = useRouter()
const route = useRoute()

const currentUser = ref(globalState.currentUser)
const authView = ref('landing')
const isLoginMode = computed(() => authView.value === 'login')
const authLoading = ref(false)
const googleAuthLoading = ref(false)
const resetEmailLoading = ref(false)
const resetEmailNotice = ref('')
const authForm = reactive({ email: '', password: '' })

const viewState = ref('input')
const questionInput = ref('')
const isSubmitting = ref(false)

const SUGGESTED_QUESTIONS = [
  '这次合作谈判能顺利吗？',
  '我现在换工作时机合适吗？',
  '这段感情还值得继续吗？',
  '这笔投资现在能入场吗？',
  '我近期的财运走势如何？',
  '近期有没有贵人相助？',
  '这件事情近期能有结果吗？',
  '最近身体状况需要注意什么？',
  '未来老公大概是什么长相和职业？',
  '我的正缘会在什么场景下出现？',
  '未来伴侣的经济实力和家境如何？',
  '未来的另一半比我大还是比我小？',
  '我的婚姻是强强联合还是被照顾？',
  '未来的小孩大概有什么天赋特长？',
  '有了小孩后，会带旺我的财运吗？',
  '我的子女缘深吗？何时会有宝宝？',
  '以后和孩子的相处模式是怎样的？',
  '除了主业，我适合发展什么副业？',
  '现在工作内耗，命盘有破局建议吗？',
  '我身上有什么没被挖掘的隐藏天赋？',
  '近期偏财运如何？有没有意外之财？',
]
const suggestionPairIdx = ref(0)
const visibleSuggestions = computed(() => {
  const len = SUGGESTED_QUESTIONS.length
  return [
    SUGGESTED_QUESTIONS[suggestionPairIdx.value % len],
    SUGGESTED_QUESTIONS[(suggestionPairIdx.value + 1) % len],
  ]
})
const selectSuggestion = (q) => {
  questionInput.value = q
  if (isGuest.value) handleGuestLoginRedirect()
  else startDivination()
}

const homeToast = ref(false)
const homeToastMsg = ref('')
const homeToastKind = ref('error')
let homeToastTimer = null
const showToast = (msg, kind = 'error') => {
  homeToastMsg.value = msg
  homeToastKind.value = kind
  homeToast.value = true
  if (homeToastTimer) clearTimeout(homeToastTimer)
  homeToastTimer = setTimeout(() => { homeToast.value = false }, 3500)
}

const handleGuestLoginRedirect = () => {
  leaveGuestMode()
  authView.value = 'login'
}
const clockText = ref('载入时辰中…')
// 固定起局时刻：null = 用当前时刻；否则为 { year, month, day, hour, minute }（北京民用时）
const panTime = ref(null)
const showTimePicker = ref(false)
const showResetTimeConfirm = ref(false)
const showRouteInfoModal = ref(false)
const dailyQimenUsed = ref(null)  // null = loading, number = fetched count

const baziProfiles = ref([])
const selectedProfileId = ref('')
const isProfileMenuOpen = ref(false)
const currentBaziString = ref('')
const activeBaziProfile = computed(() => baziProfiles.value.find(p => p.id === selectedProfileId.value))
const snapshotProfile = computed(() => {
  const snap = activeBaziResultData.value?.subject_snapshot
  if (snap?.birth_date && snap?.gender) return {
    name: snap.name || activeBaziProfile.value?.name || '',
    birth_date: snap.birth_date,
    gender: snap.gender,
    strong_weak: snap.strong_weak || activeBaziProfile.value?.strong_weak || '',
    geju: snap.geju || activeBaziProfile.value?.geju || ''
  }
  return activeBaziProfile.value
})
const snapshotPatternName = computed(() => {
  const profile = snapshotProfile.value
  return profile?.bazi_detail?.pattern_analysis?.extraction?.final_pattern?.name || profile?.geju || ''
})
const snapshotLunarStr = computed(() => {
  const profile = snapshotProfile.value
  const birthStr = String(profile?.birth_date || profile?.bazi_detail?.base_info?.solar_birth || '')
  const parts = birthStr.match(/\d+/g)
  if (!parts || parts.length < 3) return ''
  try {
    const solar = Solar.fromYmdHms(
      Number(parts[0]),
      Number(parts[1]),
      Number(parts[2]),
      Number(parts[3] || 12),
      Number(parts[4] || 0),
      0
    )
    const lunar = solar.getLunar()
    const ganzhi = `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getTimeZhi()}时`
    const zao = profile?.gender === 'M' ? '乾造' : '坤造'
    return `${ganzhi} ${zao}`
  } catch {
    return ''
  }
})
// ── BaziStaticPanel + BaziDynamicPanel 数据 ──────────────────────
// 判定「当前选中 profile」是否就是本条问题的命主，避免 admin 跨账号查看时
// 四柱面板跟随当前 profile 串成别人的盘。优先按 profile_id，退而按姓名+出生时间。
const subjectMatchesActiveProfile = () => {
  const snap = activeBaziResultData.value?.subject_snapshot
  const active = activeBaziProfile.value
  if (!snap) return true           // 无快照（极旧记录）→ 沿用旧行为
  if (!active) return false
  if (snap.profile_id) return snap.profile_id === active.id
  if (snap.name && snap.birth_date) {
    return snap.name === active.name &&
           String(snap.birth_date) === String(active.birth_date)
  }
  return true
}

const baziPanelMatrix = computed(() => {
  // 1) 记录自带的命主四柱快照（权威，随记录定格，不受当前选中 profile 影响）
  const snapPillars = activeBaziResultData.value?.subject_snapshot?.pillars
  if (snapPillars?.length) return { pillars: normalizeBaziPanelPillars(snapPillars) }
  // 2) fetchMissingPanelMatrix / fetchMissingPanelData 回填的已正规化 pillars
  const fromPanel = activeBaziResultData.value?._panel_matrix
  if (fromPanel?.pillars?.length) return fromPanel
  // 3) 旧记录无快照四柱：仅当当前选中 profile 确为本问题命主时才回退，杜绝跨命主错盘
  if (!subjectMatchesActiveProfile()) return null
  const pillars = activeBaziProfile.value?.bazi_detail?.matrix?.pillars
  return pillars?.length ? { pillars: normalizeBaziPanelPillars(pillars) } : null
})

const baziPanelTargetMap = computed(() => {
  const sr = activeBaziResultData.value?.state_report
  if (!sr) return {}
  const map = {}
  const fullShishen = { 财: '正财', 才: '偏财', 官: '正官', 杀: '七杀', 印: '正印', 枭: '偏印', 食: '食神', 伤: '伤官', 比: '比肩', 劫: '劫财' }
  const positionLabel = { gan: '干', zhi_main: '支主气', hidden: '支藏干' }
  for (const sa of sr.shishen_assessments ?? []) {
    if (!map[sa.pillar]) map[sa.pillar] = []
    const name = fullShishen[sa.shishen] || sa.shishen
    const source = `${sa.pillar || ''}${positionLabel[sa.position] || ''}`
    map[sa.pillar].push({ kind: 'shishen', name, label: source ? `${source}${name}` : name })
  }
  for (const ga of sr.gongwei_assessments ?? []) {
    if (!map[ga.pillar_name]) map[ga.pillar_name] = []
    map[ga.pillar_name].push({ kind: 'gongwei', name: ga.gongwei, label: ga.gongwei })
  }
  return map
})

const baziPanelMode = computed(() => {
  const mode = activeBaziResultData.value?.meta?.analysis_mode
  if (mode === 'timing') {
    // 只有拿到 timing_candidates 才用 timing 视图；旧存量记录没有则降级到 status
    return activeBaziResultData.value?.timing_candidates?.length ? 'timing' : 'status'
  }
  return 'status'
})

const baziPanelAnchorKind = computed(() => activeBaziResultData.value?.target_spec?.anchor_kind || '')

const baziPanelShishenTheory = computed(() => {
  const spec = activeBaziResultData.value?.target_spec
  if (!spec) return ''
  const shishens = (spec.primary_shishen || []).join('、')
  const gongweis = (spec.primary_gongwei || []).join('、')
  if (!shishens && !gongweis) return ''
  // yongshen 锚定：目标即命主用神/忌神，不写"目标十神"（否则与"用神关系"同义反复）
  if (spec.anchor_kind === 'yongshen') {
    const xi = shishens
    const ji = (spec.secondary_shishen || []).filter(s => s && s !== '用神' && s !== '忌神').join('、')
    const parts = []
    if (xi) parts.push(`以命主用神 ${xi}`)
    if (ji) parts.push(`忌神 ${ji}`)
    return parts.length ? `${parts.join('、')} 为综合运势锚点` : ''
  }
  const parts = []
  if (shishens) parts.push(`以 ${shishens} 为目标十神`)
  if (gongweis) parts.push(`${gongweis} 为目标宫位`)
  return parts.join('，')
})

const baziPanelProfileInfo = computed(() => {
  const p = snapshotProfile.value
  if (!p) return null
  const birthDate = formatSolarDate(p.birth_date)
  return {
    name: p.name || '',
    gender: p.gender || '',
    birthDate: birthDate !== '阳历待确认' ? birthDate : ''
  }
})

const baziPanelTimingWindows = computed(() => {
  const candidates = activeBaziResultData.value?.timing_candidates
  if (!candidates?.length) return []
  const llmWindows = activeBaziResultData.value?.readings?.trigger_windows ?? []
  const llmByYear = new Map(llmWindows.map(w => [String(w.year), w]))
  return candidates.map(c => {
    const liunian = c.dynamicReport?.liunian_impact
    return {
      year: c.year,
      ganzhi: liunian ? `${liunian.gan}${liunian.zhi}` : '',
      dynamicReport: c.dynamicReport,
      verdict: llmByYear.get(String(c.year))?.verdict ?? ''
    }
  }).sort((a, b) => a.year - b.year)  // 候选年按时间正序展示（存量按 rank 排序）
})

// 跨大运分组：把候选年按所属大运聚合，组内按年份正序，组间按起始年正序。
// 多于一组时 BaziDynamicPanel 自动启用水平轮播翻页。
const baziPanelDayunGroups = computed(() => {
  const candidates = activeBaziResultData.value?.timing_candidates
  if (!candidates?.length) return []
  const llmWindows = activeBaziResultData.value?.readings?.trigger_windows ?? []
  const llmByYear = new Map(llmWindows.map(w => [String(w.year), w]))
  const groups = new Map()
  for (const c of candidates) {
    const dr = c.dynamicReport
    const dyImpact = dr?.dayun_impact ?? {}
    const key = c.dayun_ganzhi || `${dyImpact.gan ?? ''}${dyImpact.zhi ?? ''}`
    if (!groups.has(key)) groups.set(key, { dayunImpact: dyImpact, windows: [] })
    const liunian = dr?.liunian_impact
    groups.get(key).windows.push({
      year: c.year,
      ganzhi: liunian ? `${liunian.gan}${liunian.zhi}` : (c.ganzhi || ''),
      dynamicReport: dr,
      verdict: llmByYear.get(String(c.year))?.verdict ?? ''
    })
  }
  const arr = [...groups.values()]
  for (const g of arr) {
    g.windows.sort((a, b) => a.year - b.year)
    const ys = g.windows.map(w => w.year)
    const min = Math.min(...ys), max = Math.max(...ys)
    g.label = min === max ? `${min}` : `${min}–${max}`
  }
  arr.sort((a, b) => (a.windows[0]?.year ?? 0) - (b.windows[0]?.year ?? 0))
  return arr
})

const baziPanelBestYear = computed(() => {
  const windows = activeBaziResultData.value?.readings?.trigger_windows ?? []
  const best = windows.find(w => w.quality === 'strong') || windows[0]
  return best?.year ? Number(best.year) : null
})

const baziPanelAvoidText = computed(() => activeBaziResultData.value?.readings?.avoid_window ?? '')

const _baziPanelFiveShensFetched = ref(null)
const baziPanelFiveShens = computed(() =>
  activeBaziResultData.value?.five_shens ||
  _baziPanelFiveShensFetched.value ||
  null
)

async function fetchMissingFiveShens() {
  const profileId = activeBaziProfile.value?.id
  if (!profileId) return
  if (activeBaziResultData.value?.five_shens) return
  try {
    const { data } = await supabase
      .from('bazi_profiles')
      .select('bazi_detail')
      .eq('id', profileId)
      .single()
    _baziPanelFiveShensFetched.value = data?.bazi_detail?.five_shens || null
  } catch {
    // silent — 用神关系标注降级为不显示
  }
}

const showProfileSwitcher = computed(() => baziProfiles.value.length > 0)
const activeProfileName = computed(() => activeBaziProfile.value?.name || '命主未设')
const isGuest = computed(() => globalState.isGuest)
const isAuthLanding = computed(() => ['login', 'register'].includes(route.query.auth))
const canUseApp = computed(() => Boolean(currentUser.value || (isGuest.value && globalState.guestAccessUnlocked && !isAuthLanding.value)))

const historyRecords = ref([])
const historyLoading = ref(false)
const historyLoaded = ref(false)
const historyHasMore = ref(true)
const historyPage = ref(0)
const activeCategory = ref('all')
const activeResultRecord = ref(null)

// ── 追问（同一局深挖，锚定式增补）──
const currentResultData = ref(null)       // 当前终态卡片 data，供追问回传 + 烘焙重渲染
const followupInput = ref('')
const followupSubmitting = ref(false)
const followupNewMatter = ref(null)       // 非空={reason}：判定为新事，展示"重新起局?"
const followupTextarea = ref(null)
const autoGrowFollowup = () => {
  const el = followupTextarea.value
  if (!el) return
  // 平滑增高/回缩的关键三步：
  // 1) 记下当前真实渲染高度作为动画起点（动画进行中也准）；
  // 2) 关过渡 → 用 'auto' 量纯内容高度（不被未结束过渡污染）→ 钉回起点并强制提交；
  // 3) 恢复过渡 → 设目标高度，浏览器在帧末从"起点 → target"播 .22s 动画。
  // 若直接 'auto' 后读 scrollHeight，会把 auto 当场提交成内容高，target 与之相等 → 没起点可动 → 瞬移。
  const startH = el.offsetHeight
  el.style.transition = 'none'
  el.style.height = 'auto'
  const target = Math.min(Math.max(el.scrollHeight, 40), 120)
  const overflow = el.scrollHeight > 120 ? 'auto' : 'hidden'
  el.style.height = startH + 'px'        // 钉回起点
  void el.offsetHeight                   // 强制重排，提交起点（此刻过渡仍为 none）
  el.style.transition = ''               // 恢复样式表里的 .22s 过渡
  el.style.height = target + 'px'        // 帧末从 startH 平滑动到 target
  el.style.overflowY = overflow
}
const canFollowup = computed(() =>
  viewState.value === 'result' && !wenShiStreaming.value && !isSubmitting.value
  && (sseBranch.value === 'qimen' || sseBranch.value === 'bazi') && !!currentResultData.value)
// 当前追问分支（八字结果的 currentResultData.branch==='bazi'）
const followupBranch = computed(() => (currentResultData.value?.branch === 'bazi' ? 'bazi' : 'qimen'))
const categories = [
  { label: '全部', value: 'all' },
  { label: '事业', value: 'career_business' },
  { label: '求财', value: 'finance_wealth' },
  { label: '感情', value: 'relationship' },
  { label: '健康', value: 'health_action' },
  { label: '交易', value: 'item_transaction' },
  { label: '杂事', value: 'general' }
]
const feedbackAccuracyOptions = QIMEN_ACCURACY_OPTIONS
const feedbackDirectionOptions = QIMEN_DIRECTION_OPTIONS
const isFeedbackDrawerOpen = ref(false)
const feedbackTargetRecord = ref(null)
const feedbackSaving = ref(false)
const feedbackForm = reactive(buildDefaultFeedbackForm())
const feedbackConclusion = computed(() => feedbackTargetRecord.value?.qimen_data?.summary?.conclusion || feedbackTargetRecord.value?.conclusion || '')

const resultHtml = ref('')
let magTabScrollFrame = null

const setMagTabActive = (nav, active) => {
  const tabs = [...nav.querySelectorAll('.mag-tab')]
  if (!active || active.classList.contains('mag-tab-active')) return
  tabs.forEach(tab => tab.classList.toggle('mag-tab-active', tab === active))
  const ink = nav.querySelector('.mag-tab-ink')
  if (ink) {
    ink.style.width = active.offsetWidth + 'px'
    ink.style.transform = `translateX(${active.offsetLeft}px)`
  }
  const targetLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
  nav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
}

const syncMagTabsToScroll = () => {
  document.querySelectorAll('.mag-tabs').forEach(nav => {
    const result = nav.closest('.mag-result')
    if (!result) return
    const tabs = [...nav.querySelectorAll('.mag-tab')]
    const sections = [...result.querySelectorAll('.mag-section[id]')]
    if (!tabs.length || tabs.length !== sections.length) return
    const threshold = Math.max(nav.getBoundingClientRect().bottom + 72, window.innerHeight * 0.22)
    let activeIndex = 0
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= threshold) activeIndex = index
    })
    setMagTabActive(nav, tabs[activeIndex])
  })
}

const scheduleMagTabScrollSync = () => {
  if (magTabScrollFrame !== null) return
  magTabScrollFrame = requestAnimationFrame(() => {
    magTabScrollFrame = null
    syncMagTabsToScroll()
  })
}

const initMagTabInk = () => {
  document.querySelectorAll('.mag-tabs').forEach(nav => {
    const active = nav.querySelector('.mag-tab-active')
    const ink = nav.querySelector('.mag-tab-ink')
    if (active && ink) {
      ink.style.width = active.offsetWidth + 'px'
      ink.style.transform = `translateX(${active.offsetLeft}px)`
    }
  })
  scheduleMagTabScrollSync()
}
const currentScore = ref(0)
const activeBaziResultData = ref(null)
const baziCardSelectedYear = ref(null)
const showBaziBackingAnchor = ref(false)
const showBaziPanelAnchor = ref(false)
let scoreTimer = null

// 保存长图
const isSavingImage = ref(false)
const shareImgUrl = ref('')

const closeShareModal = () => {
  shareImgUrl.value = ''
}

const loadHtml2Canvas = () => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    script.onload = () => resolve(window.html2canvas)
    script.onerror = () => reject(new Error('html2canvas 加载失败，请检查网络'))
    document.head.appendChild(script)
  })
}

const saveAsImage = async () => {
  if (isSavingImage.value) return
  isSavingImage.value = true
  try {
    const h2c = await loadHtml2Canvas()
    const captureEl = document.querySelector('.html-container')
    if (!captureEl) { alert('未找到推演结果，请重新推演'); return }

    // 截图前向真实 document 注入兼容补丁（覆盖 color-mix 属性）
    // Vite dev 模式用 adoptedStyleSheets，onclone 内替换无效，需在源 doc 提前覆盖
    const h2cPatch = document.createElement('style')
    h2cPatch.id = 'h2c-compat-patch'
    h2cPatch.textContent = `
      [data-h2c-target] .summary-score-bubble {
        background: linear-gradient(180deg, rgba(179,139,54,0.15), rgba(255,255,255,0.03)) !important;
        border: 1px solid rgba(179,139,54,0.24) !important;
        box-shadow: 0 0 24px rgba(179,139,54,0.15) !important;
      }
      [data-h2c-target] .keyword-highlight {
        background: linear-gradient(90deg, rgba(179,139,54,0.15), rgba(255,255,255,0.02)) !important;
        border: 1px solid rgba(179,139,54,0.18) !important;
        box-shadow: 0 0 18px rgba(179,139,54,0.12) !important;
      }
      [data-h2c-target] .accent-theme {
        background: linear-gradient(135deg, rgba(179,139,54,0.05), transparent) !important;
      }
      [data-h2c-target] .highlight-text {
        text-shadow: 0 0 12px rgba(179,139,54,0.5) !important;
      }
      [data-h2c-target] .conclusion {
        text-shadow: none !important;
      }
      [data-h2c-target] .score {
        text-shadow: 0 0 18px rgba(179,139,54,0.15) !important;
      }
    `
    captureEl.setAttribute('data-h2c-target', '1')
    document.head.appendChild(h2cPatch)

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    let canvas
    try {
      canvas = await h2c(captureEl, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: isDark ? '#05050a' : '#f7f4ee',
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        onclone: (clonedDoc) => {
          // 0. 同步主题模式到克隆文档
          if (isDark) {
            clonedDoc.documentElement.setAttribute('data-theme', 'dark')
          } else {
            clonedDoc.documentElement.removeAttribute('data-theme')
          }

          // 1. 确保所有 reveal 元素可见
          clonedDoc.querySelectorAll('.reveal').forEach(el => {
            el.style.opacity = '1'
            el.style.transform = 'none'
          })

          // 2. 修复 sticky tab bar 在截图时错位问题：改为 relative 让其回归文档流
          clonedDoc.querySelectorAll('.mag-tabs').forEach(el => {
            el.style.position = 'relative'
            el.style.top = 'auto'
          })

          // 3. 遍历克隆文档所有 <style> 标签，替换 color-mix()
          clonedDoc.querySelectorAll('style').forEach(styleEl => {
            if (styleEl.textContent && styleEl.textContent.includes('color-mix')) {
              styleEl.textContent = styleEl.textContent
                .replace(/color-mix\([^)]+\)/g, 'transparent')
            }
          })

          // 4. 清除内联 style 属性中残留的 color-mix()
          clonedDoc.querySelectorAll('[style]').forEach(el => {
            const s = el.getAttribute('style') || ''
            if (s.includes('color-mix')) {
              el.setAttribute('style', s.replace(/color-mix\([^)]+\)/g, 'transparent'))
            }
          })
        }
      })
    } finally {
      // 无论成功失败，都清理临时补丁
      captureEl.removeAttribute('data-h2c-target')
      document.getElementById('h2c-compat-patch')?.remove()
    }

    // 叠加水印
    const finalCanvas = addWatermark(canvas)
    const imgData = finalCanvas.toDataURL('image/png')

    // PC 端自动下载
    const isPC = !('ontouchstart' in window || navigator.maxTouchPoints > 0)
    if (isPC) {
      const link = document.createElement('a')
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
      link.download = `奇门推演_${dateStr}.png`
      link.href = imgData
      link.click()
    }
    // 移动端弹窗长按保存
    shareImgUrl.value = imgData
  } catch (err) {
    console.error('生成图片失败:', err)
    alert('图片生成失败：' + (err.message || '未知错误'))
  } finally {
    isSavingImage.value = false
  }
}

const addWatermark = (sourceCanvas) => {
  const wCanvas = document.createElement('canvas')
  const padding = 48
  wCanvas.width = sourceCanvas.width
  wCanvas.height = sourceCanvas.height + padding
  const ctx = wCanvas.getContext('2d')

  // 背景
  ctx.fillStyle = '#05050A'
  ctx.fillRect(0, 0, wCanvas.width, wCanvas.height)

  // 原图
  ctx.drawImage(sourceCanvas, 0, 0)

  // 水印条
  const wmY = sourceCanvas.height
  const wmH = padding
  const grad = ctx.createLinearGradient(0, wmY, 0, wmY + wmH)
  grad.addColorStop(0, 'rgba(5,5,10,0.9)')
  grad.addColorStop(1, 'rgba(10,8,3,1)')
  ctx.fillStyle = grad
  ctx.fillRect(0, wmY, wCanvas.width, wmH)

  // 分割线
  ctx.strokeStyle = 'rgba(212,175,55,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(24, wmY + 1)
  ctx.lineTo(wCanvas.width - 24, wmY + 1)
  ctx.stroke()

  // 品牌字
  const scale = sourceCanvas.width / 375 // 基于 375px 基准
  const fontSize = Math.round(13 * scale)
  ctx.font = `500 ${fontSize}px 'Noto Serif SC', 'Songti SC', 'STSong', serif`
  ctx.fillStyle = 'rgba(212,175,55,0.85)'
  ctx.textBaseline = 'middle'
  ctx.fillText('奇门遁甲 AI 推演', 24, wmY + wmH / 2)

  // 域名
  const domainFontSize = Math.round(12 * scale)
  ctx.font = `400 ${domainFontSize}px 'SF Mono', 'Fira Code', monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  const domainText = 'qimendao.com'
  const domainWidth = ctx.measureText(domainText).width
  ctx.fillText(domainText, wCanvas.width - 24 - domainWidth, wmY + wmH / 2)

  return wCanvas
}

const LOADER_MESSAGES = ['正在接通云端超算矩阵...','推演时空坐标与节气数据...','计算奇门九宫落盘...','分析值符、值使与神助...','生成决策指引与应期推演...']
const currentLoaderMessage = ref(LOADER_MESSAGES[0])
let loaderInterval = null

// ── SSE progress state ──
const SSE_STEPS = {
  qimen: [
    { name: '解析问题意图', tag: '路由分类',   detail: '正在识别问题类型' },
    { name: '起盘计算',     tag: '天地盘落定', detail: '推算当前时辰九宫布局' },
    { name: '定位用神',     tag: '目标星门确认', detail: '锁定用神与辅神宫位' },
    { name: '推演应期',     tag: '扫描时间窗口', detail: '扫描未来 30 日应期节点' },
    { name: '后端评分',     tag: '卦象强弱初判', detail: '量化宫象强弱与五行生克' },
    { name: 'AI 推演解盘',  tag: '深度推演中',   detail: '综合推演，生成决策指引' },
    { name: '解盘完成',     tag: '结果就绪', detail: '' },
  ],
  bazi: [
    { name: '解析问题意图', tag: '路由分类',   detail: '正在识别问题类型' },
    { name: '调取命盘',     tag: '八字加载',   detail: '读取日主与大运流年' },
    { name: '语义路由',     tag: '分析模式确认', detail: '确认分析维度与时间范围' },
    { name: '构建推演框架', tag: '命局分析',   detail: '整合命局与五行格局' },
    { name: '五行喜忌',     tag: '格局评估',   detail: '评估喜用神与忌神强弱' },
    { name: 'AI 深度解盘',  tag: '深度推演中', detail: '综合命局，生成运势解读' },
    { name: '解盘完成',     tag: '结果就绪', detail: '' },
  ],
}
const CATEGORY_LABEL_MAP = {
  career_business: '事业运势', finance_wealth: '财运分析',
  relationship: '感情婚恋', health_action: '健康行动', general: '综合运势',
}
const sseBranch = ref('qimen')
const sseActiveIndex = ref(0)
const sseChips = ref({})
const ssePct = ref(0)
const sseCurrentSteps = computed(() => SSE_STEPS[sseBranch.value] || SSE_STEPS.qimen)
const sseSpinePct = computed(() => {
  const done = Math.max(0, sseActiveIndex.value - 1)
  const total = sseCurrentSteps.value.length - 1
  return total > 0 ? (done / total) * 100 : 0
})

const wenShiEngineResult = ref(null)
const wenShiLlm = ref({ status: 'idle', text: '' })
const isWenShiLlmLoading = computed(() =>
  ['pending', 'streaming'].includes(wenShiLlm.value.status)
)
const shouldShowWenShiSkeleton = computed(() =>
  isWenShiLlmLoading.value && !wenShiLlm.value.text
)

// 奇门流式脚手架：在结果页内就地骨架→流式
const wenShiStreaming = ref(false)
const resultPhase = ref('stream') // 'stream' 流式脚手架 / 'final' 最终卡片，用于交叉淡入过渡
const wenShiStatus = ref('正在解析问题') // hero 能量球下方的最新中间产物状态
// 持久能量球覆盖层状态
const showOrbFx = ref(false)   // 是否显示能量球层（加载~定格期间）
const orbSettling = ref(false) // 是否进入定格态（膨胀+变色）
const orbTone = ref('')        // wo-tone-gold / wo-tone-teal / wo-tone-warn
const finalOverlayHtml = ref('') // 终态覆盖层 HTML（在脚手架之上淡入，避免空档）
const wenShiStreamSections = {} // {sectionKey: 累计文本}（非响应式，直接 DOM 打补丁）
const wenshiOrbRef = ref(null) // 粒子星盘组件实例（用于中间产物抖动）
// 更新 hero 能量球下方的状态行（响应式，只展示最新一条）+ 出中间产物时星盘抖一下
function patchOrbStatus(text) {
  if (text) wenShiStatus.value = text
  wenshiOrbRef.value?.pulse()
}
// 完成时：能量球缓慢膨胀填满 hero + 变分数色 + 定格（同一 DOM，不重建，丝滑无断档）
function settleOrbToResult(data) {
  return new Promise(resolve => {
    if (data?.branch !== 'bazi') {
      // 奇门：按分数取色（八字 orbTone 已在 engine_complete 设为喜用神五行色，不覆盖）
      const score = data?.summary?.score ?? data?.qimen_report?.m1_conclusion?.score ?? 0
      orbTone.value = 'wo-tone-' + (score < 55 ? 'warn' : score < 75 ? 'gold' : 'teal')
    }
    orbSettling.value = true
    setTimeout(resolve, 900) // 膨胀进行中即可切入卡片正文（hero 透明，球持续膨胀到定格）
  })
}
// 终态卡片包一层 wenshi-orb-mode：让其 hero 背景透明，露出下方定格的能量球
function withOrbHero(html) {
  return html.replace('class="mag-result ', 'class="mag-result wenshi-orb-mode ')
}

// ═══════ 开发用：奇门流式 mock（生产形态数据，走真实代码路径，不调 API）═══════
const MOCK_QIMEN = (() => {
  const palaces = [
    { name:'巽4宫', index:0, god:'九天', sky:'丙', star:'天柱', door:'惊门', earth:'戊', kong_wang:{is_kong:false}, ma_xing:{has_ma:false} },
    { name:'离9宫', index:1, god:'值符', sky:'壬', star:'天心', door:'开门', earth:'乙', kong_wang:{is_kong:false}, ma_xing:{has_ma:false} },
    { name:'坤2宫', index:2, god:'九地', sky:'辛', star:'天蓬', door:'休门', earth:'癸', kong_wang:{is_kong:true}, ma_xing:{has_ma:false} },
    { name:'震3宫', index:3, god:'玄武', sky:'乙', star:'天任', door:'生门', earth:'己', kong_wang:{is_kong:false}, ma_xing:{has_ma:false} },
    { name:'中5宫', index:4, is_center:true, earth:'庚' },
    { name:'兑7宫', index:5, god:'六合', sky:'丁', star:'天冲', door:'伤门', earth:'丁', kong_wang:{is_kong:false}, ma_xing:{has_ma:false} },
    { name:'艮8宫', index:6, god:'白虎', sky:'癸', star:'天芮', door:'死门', earth:'壬', kong_wang:{is_kong:false}, ma_xing:{has_ma:true} },
    { name:'坎1宫', index:7, god:'太阴', sky:'己', star:'天英', door:'景门', earth:'丙', kong_wang:{is_kong:false}, ma_xing:{has_ma:false} },
    { name:'乾6宫', index:8, god:'螣蛇', sky:'庚', star:'天辅', door:'杜门', earth:'辛', kong_wang:{is_kong:false}, ma_xing:{has_ma:false} },
  ]
  const formation_tags = [
    { name:'青龙耀明', type:'ji', effect:'+6', reason:'龙光耀明，事业有进，贵人相助。', text:'龙光耀明，事业有进，贵人相助。' },
    { name:'值符临开门', type:'ji', effect:'+4', reason:'主导权与资源向你倾斜。', text:'主导权与资源向你倾斜。' },
    { name:'天芮临死门', type:'xiong', effect:'-5', reason:'岗位本身或带历史遗留问题。', text:'岗位本身或带历史遗留问题。' },
    { name:'壬空亡', type:'xiong', effect:'-3', reason:'部分承诺待落实，口头利好不可全信。', text:'部分承诺待落实，口头利好不可全信。' },
  ]
  const qimen_data = {
    status:'success',
    pillars:{ year:'丙午', month:'甲午', day:'戊戌', hour:'丁巳' },
    timestamp:{ solar:'2026-06-06 10:00', lunar:'丙午年 甲午月 戊戌日 丁巳时' },
    ju_info:{ name:'阳遁6局', jieqi:'芒种', yuan:'中元', zhi_fu:'天心', zhi_shi:'开门', xun_shou:'甲辰' },
    auxiliary:{ ma_xing:{ day:'申', hour:'申' }, kong_wang:{ day:'辰巳', hour:'子丑' } },
    palaces,
  }
  const engineOutput = {
    branch:'qimen', question:'下周的3个面试中 有靠谱的吗', category:'求测事业', subcategory:'general_career',
    pre_score:71, score_label:'平', qimen_data, formation_tags, timing_window_count:3,
    tags:[ {label:'求测事业'}, {label:'阳遁6局·戊戌'}, {label:'初分71 · 平', isScore:true}, {label:'3个应期窗口'} ],
  }
  const sections = [
    ['conclusion','下周的面试中**有靠谱的机会**。你的专业表现和现场沟通将非常出色，极易得到高层或核心决策人的赏识；但岗位本身可能带有一定挑战或内部信息不透明，需要你主动争取并在沟通中仔细甄别。'],
    ['subject_reading','日干辛金落震3宫，临天任星与生门，说明你本身专业素养扎实、状态平稳，在面试这种正式场合反而能稳定发挥。唯一要注意的是辛金偏内敛，若只被动等待提问而不主动展示亮点，容易被埋没，需要你主动出击。'],
    ['target_reading','目标机会以生门为用，生门临旺相之地，代表这几个岗位中确有实质性的好机会，并非画饼。生门主生意、生机，落宫得力说明录用概率与后续发展空间都不错，是值得全力争取的方向。'],
    ['environment_reading','值符天心临开门，主整个面试流程开通顺畅，不会卡在繁琐环节；然艮8宫天芮病星临死门，又见壬水空亡，提示岗位的部分内部信息（如真实汇报线、团队稳定性）可能对外有所保留，入职前务必多方核实。'],
    ['support_summary','青龙耀明格成局，主贵人赏识、名声彰显，面试中极易给高层留下深刻印象；值符临开门，主导权与资源都在向你倾斜，大方向上是有利的。'],
    ['constraint_summary','天芮病星临死门，提示岗位本身可能存在历史遗留问题或团队活力不足；壬水空亡，部分承诺需落到书面才算数，口头利好不可全信，签约前需谨慎甄别。'],
    ['decision_reading','日干辛与生门形成相生之势，整体属于「你能接住这个机会」的格局。建议主动出击、突出专业，同时对岗位真实情况保持一份清醒甄别，先难后易，稳中求进。'],
  ]
  const result = {
    branch:'qimen', question:'下周的3个面试中 有靠谱的吗', category:'求测事业', subcategory:'general_career',
    summary:{ score:71, score_basis:{ positive_signals:['青龙耀明','值符临开门'], negative_signals:['天芮临死门','壬空亡'], score_logic:'贵人与流程有利，唯岗位本身带瑕疵与空亡，整体偏中上可争取。' } },
    qimen_report:{
      m1_conclusion:{ question:'下周的3个面试中 有靠谱的吗', score:71, verdict_label:'平', tone:'mixed',
        title:'求职面试机会评估', keyword:'表现亮眼，高层赏识',
        conclusion:sections[0][1],
        actions:[
          '**充分展示专业能力**，利用面试环节放大自身优势，大胆表达见解，不要被动等待提问。',
          '重点关注能与高管或核心决策人**直接沟通**的面试场次，你的胜算会明显更大。',
          '面试后主动跟进，**巳日或申时**信息更明朗时再做最终判断，不急于签约。',
        ],
        score_basis:{ positive_signals:['青龙耀明','值符临开门'], negative_signals:['天芮临死门','壬空亡'], score_logic:'贵人与流程有利，唯岗位本身带瑕疵与空亡。' } },
      m2_basis:{
        chart_summary:{ pillars:qimen_data.pillars, ju_name:'阳遁6局', jieqi:'芒种', yuan:'中元', zhi_fu:'天心', zhi_shi:'开门' },
        palaces, formation_tags,
        yongshen_cards:[
          { key:'subject', label:'问测人', symbol:'日干 辛', tone:'mixed', verdict:'自身专业过硬，但略缺主动', evidence:'日干辛落震3宫临生门，金气清贵主才华，唯需主动出击。' },
          { key:'target', label:'目标机会', symbol:'生门', tone:'positive', verdict:'机会成色不错，值得争取', evidence:'生门临旺，主有实质性的录用与发展空间。' },
          { key:'environment', label:'关键环境', symbol:'值使 开门', tone:'mixed', verdict:'流程顺畅但信息不透明', evidence:'值使开门主开通，然环境带空亡，内部信息或有保留。' },
        ],
      },
      m3_inference:{
        subject_state:{ symbol:'日干 辛', palace:'震3宫', tone:'mixed', reading:sections[1][1] },
        target_state:{ symbol:'生门', palace:'震3宫', tone:'positive', reading:sections[2][1] },
        environment_state:{ symbol:'值使门', palace:'离9宫', tone:'mixed', reading:sections[3][1] },
        support_factors:{ tone:'positive', summary:sections[4][1], items:[
          { name:'青龙耀明', impact:'贵人赏识、名声彰显，易给高层留下深刻印象。' },
          { name:'值符临开门', impact:'主导权与资源向你倾斜，大方向有利。' },
        ] },
        constraint_factors:{ tone:'warning', summary:sections[5][1], items:[
          { name:'天芮临死门', impact:'岗位或有历史遗留问题、团队活力不足。' },
          { name:'壬空亡', impact:'口头承诺待落实，签约前需书面确认。' },
        ] },
        interaction_decision:{ subject_symbol:'日干', target_symbol:'生门', tone:'mixed', reading:sections[6][1], relation:{ effect:1, reason:'日干辛与生门相生，你能接住这个机会。' } },
      },
      m4_guidance:{
        environment_fengshui:{ suitable_direction:'西方 / 西北', do:'面试选在光线明亮、安静的场合，着装偏冷色调显专业。', avoid:'避免在嘈杂、信息混乱的环境仓促决定。', reason:'辛金喜净、喜西方旺地，利清晰展示自我。' },
        timing_behavior:{ window:'巳日、申时', wait_until:'对方明确反馈前', do:'此时段跟进、确认细节、表达诚意。', avoid:'空亡时辰（壬水当令）轻信口头承诺。', reason:'巳申填实并冲动马星，是信息明朗、事情催动的窗口。' },
      },
    },
    backend_score_audit:{ adjustments:formation_tags.map(t=>({ ...t, layer:'named_formation', signal:t.name })), relations:[{ effect:1, reason:'日干辛与生门相生。' }] },
    qimen_data,
  }
  return { engineOutput, sections, result }
})()

function mockQimenResponse() {
  const enc = new TextEncoder()
  const send = (ctrl, obj) => ctrl.enqueue(enc.encode('data: ' + JSON.stringify(obj) + '\n\n'))
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const body = new ReadableStream({
    async start(ctrl) {
      send(ctrl, { type:'step', index:0, pct:10, chip:{ main:'求测事业', sub:'奇门遁甲' } }); await sleep(550)
      send(ctrl, { type:'step', index:1, pct:25, chip:{ main:'阳遁6局', sub:'戊戌' } }); await sleep(520)
      send(ctrl, { type:'step', index:2, pct:42, chip:{ main:'生门', sub:'求测事业' } }); await sleep(480)
      send(ctrl, { type:'step', index:3, pct:58, chip:{ main:'发现 3 个窗口', sub:'巳日/申时' } }); await sleep(480)
      send(ctrl, { type:'step', index:4, pct:72, chip:{ main:'初分 71', sub:'平' } }); await sleep(560)
      send(ctrl, { type:'engine_complete', pct:74, engineOutput:MOCK_QIMEN.engineOutput }); await sleep(700)
      send(ctrl, { type:'active', index:5, pct:78 }); await sleep(450)
      for (const [sec, text] of MOCK_QIMEN.sections) {
        for (let i = 0; i < text.length; i += 2) { send(ctrl, { type:'llm_delta', section:sec, text:text.slice(i, i+2) }); await sleep(22) }
        await sleep(180)
      }
      send(ctrl, { type:'llm_done', pct:95, text:'' }); await sleep(250)
      send(ctrl, { type:'complete', result:MOCK_QIMEN.result })
      ctrl.close()
    }
  })
  return { ok:true, body }
}

async function runQimenMock() {
  questionInput.value = MOCK_QIMEN.result.question
  isSubmitting.value = true
  resetSseState()
  sseBranch.value = 'qimen'
  wenShiStreaming.value = true
  resultPhase.value = 'stream'
  wenShiStatus.value = '正在解析问题'
  showOrbFx.value = true
  orbSettling.value = false
  orbTone.value = ''
  resultHtml.value = buildStreamingScaffoldHTML(null, wenShiStatus.value)
  viewState.value = 'result'
  await nextTick(); initMagTabInk()
  try {
    const data = await readSSEStream(mockQimenResponse())
    const fromScore = wenShiEngineResult.value?.pre_score || 0
    if (wenShiStreaming.value) await settleOrbToResult(data)
    wenShiStreaming.value = false
    activeResultRecord.value = null
    activateBaziResultPanel(data)
    const finalCard = applyCardMdBold(buildCardHTML(data))
    finalOverlayHtml.value = finalCard
    await nextTick()
    initMagTabInk()
    animateScore(data.summary?.score || 0, fromScore)
    setTimeout(() => document.querySelectorAll('.result-overlay .reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 300)
    await new Promise(r => setTimeout(r, 700))
    resultHtml.value = finalCard
    await nextTick()
    document.querySelectorAll('.html-container .reveal').forEach(el => el.classList.add('visible'))
    initMagTabInk()
    finalOverlayHtml.value = ''
    showOrbFx.value = false
    viewState.value = 'result'
  } finally {
    isSubmitting.value = false
  }
}
if (typeof window !== 'undefined') window.__mockQimen = runQimenMock

// ── 开发用：八字流式 mock（status 模式，生产形态数据，走真实代码路径，不调 API）──
// ── 5 mode mock 样本（走真实代码路径；字段结构对齐 buildReadingsSchema / normalizeBaziQuestionOutput） ──
const MOCK_BAZI_MODES = (() => {
  // 命主四柱（对象形态，与真实 worker subject_snapshot.pillars 同构，供 BaziStaticPanel 渲染）
  const PILLARS = [
    { name:'年', gan:'戊', zhi:'寅', hidden_stems:['甲','丙','戊'], is_kong:false },
    { name:'月', gan:'己', zhi:'未', hidden_stems:['己','丁','乙'], is_kong:false },
    { name:'日', gan:'甲', zhi:'戌', hidden_stems:['戊','辛','丁'], is_kong:false },
    { name:'时', gan:'癸', zhi:'酉', hidden_stems:['辛'],          is_kong:false },
  ]
  const snap = () => ({ name:'测试命主', gender:'男', birth_date:'1998-07-26', strong_weak:'身弱', geju:'正财格', profile_id:'mock', pillars:PILLARS })
  const mk = (mode, favEl, question, tags, sections, summary, readings, extra = {}) => {
    const subject_snapshot = snap()
    return {
      engineOutput: {
        branch:'bazi', analysis_mode:mode, category:extra.category||'general', subcategory:extra.subcategory||'general',
        favorable_element:favEl, question,
        tags, stateReport:extra.stateReport??null, dynamicReport:extra.dynamicReport??null, targetSpec:extra.targetSpec??null, timingCandidates:extra.timingCandidates??[],
        subject_snapshot, five_shens:extra.five_shens??null,
      },
      sections,
      result: {
        branch:'bazi',
        meta:{ analysis_mode:mode, secondary_mode:extra.secondary_mode ?? null, branch:'bazi', category:extra.category||'general', subcategory:extra.subcategory||'general', target:extra.target||{ shishen:[], gongwei:[], fallback_level:'category', llm_derived_target:null }, confidence:extra.confidence||'high', limitations:[] },
        summary,
        key_signals:extra.key_signals||[],
        readings,
        rhythm:extra.rhythm||{ segments:[] },
        action_guide:extra.action_guide||{ text:'', items:[] },
        state_report:extra.stateReport??null, target_spec:extra.targetSpec??null, dynamic_report:extra.dynamicReport??null, timing_candidates:extra.timingCandidates??[],
        favorable_element:favEl, subject_snapshot, five_shens:extra.five_shens??null, question,
      },
    }
  }
  // 复用的引擎产物（命局解读面板：BaziStaticPanel）——简化但结构合法
  const STATUS_STATE_REPORT = {
    shishen_assessments: [
      { shishen:'财', pillar:'月', position:'hidden', gan:'己', zhi:'未', element:'土', twelve_phase:'墓', phase_score:1, vigor:0.35, is_kong:false, is_in_tomb:true, gaitou_jiejiao:'neutral', relationships:[], status_tags:['财库','当令'], verdict:'正财藏未库，当令有气但入墓，财真而难现' },
      { shishen:'财', pillar:'日', position:'hidden', gan:'戊', zhi:'戌', element:'土', twelve_phase:'养', phase_score:2, vigor:0.42, is_kong:false, is_in_tomb:false, gaitou_jiejiao:'same', relationships:[], status_tags:['坐财','得地'], verdict:'日支戌藏戊土偏财，财坐妻宫，根基真实' },
    ],
    gongwei_assessments: [{ gongwei:'日支', pillar_name:'日', zhi:'戌', element:'土', twelve_phase_for_dayStem:'养', vigor:0.42, is_kong:false, seat_shishen:'财', seat_element:'土', is_correct_star:true, is_hostile_occupied:false, is_tomb_for_target:false, relationships:[], status_tags:['星宫得正'], verdict:'日支（戌）藏财得正，妻财居本位，唯日主身弱难全驭' }],
    extra_checks: [],
    overall_stability: 'stable',
    stability_label: '相对稳固',
    base_state: '正财藏未库当令、戌中偏财得地；日主甲木无强根偏弱',
    favorable_wuxing: ['水','木'],
    unfavorable_wuxing: ['火','土'],
    geju: '正财格（月令未中己土正财当令）',
    tiaohou: '未月土旺木弱，调候喜水润木，忌火土再燥',
  }
  const STATUS_TARGET_SPEC = { primary_shishen:['正财'], primary_gongwei:['日支'], analysis_mode:'status', anchor_kind:'shishen', analysis_question:'以正财为目标十神，评估财源真实度与命主驭财能力' }

  // ── status：财运（喜用神 水 → 蓝） ──
  const status = mk('status', '水', '近10年财运如何',
    [{label:'财运分析'},{label:'日主甲'},{label:'喜水木'},{label:'状态推演'}],
    [
      ['summary_conclusion', '近十年财运**先抑后扬**。身弱财旺，2032年前求财较吃力、宜稳守借印；2033年起转印星大运，得水木帮身，财运迎来实质性好转。'],
      ['summary_basis', '命局甲木日主坐财地、财星旺相而日主偏弱，喜印比帮身；后端锁定正财为目标十神，引动机制显示流年有催动但根基不稳，故方向为守中求进、固本为先。'],
      ['base_foundation', '原局甲木生于未月，财星当令而日主无强根，属**财多身弱**之局。喜用神为水、木——水生身、木比助；忌火土泄耗。静态面板显示正财坐日支得地，财源真实，唯自身承接力不足。'],
      ['dayun_field', '当前壬戌运，壬水印星透出本可帮身，然戌土耗身、伤官生财之象明显：思路活跃、财路扩张，但精力分散、根基不稳。心态上易急于求成，外部机会多而杂，须防贪多嚼不烂。'],
      ['liunian_trigger', '流年丙午，午火助财耗身，子午冲动妻财宫——财事被强推上台面，机会与压力并至。冲动亦带波折：可借势小试，但不宜在身弱时重仓压注，先稳住现金流。'],
      ['action_guide', '总体宜守不宜攻：先固本、借印星贵人帮扶，再借流年财气小步进取。切忌一次性重仓投资；2033年印运到位后再图实质性扩张。'],
    ],
    { score:null, title:'财多身弱宜守印', keyword:'守中求进', conclusion:'近十年财运**先抑后扬**。身弱财旺，2032年前求财较吃力、宜稳守借印；2033年起转印星大运，得水木帮身，财运迎来实质性好转。', basis:'命局甲木日主坐财地、财星旺相而日主偏弱，喜印比帮身；后端锁定正财为目标十神，引动机制显示流年有催动但根基不稳，故方向为守中求进、固本为先。' },
    {
      base_foundation:{ text:'原局甲木生于未月，财星当令而日主无强根，属**财多身弱**之局。喜用神为水、木——水生身、木比助；忌火土泄耗。静态面板显示正财坐日支得地，财源真实，唯自身承接力不足。', signals:[{ title:'财多身弱喜印生扶', detail:'财耗身，需印星通关泄财生身' }] },
      target_state:[{ title:'正财坐日支·有根', text:'目标财源真实存在，但需自身够力才能驾驭' }],
      dayun_field:{ text:'当前壬戌运，壬水印星透出本可帮身，然戌土耗身、伤官生财之象明显：思路活跃、财路扩张，但精力分散、根基不稳。心态上易急于求成，外部机会多而杂，须防贪多嚼不烂。' },
      liunian_trigger:{ text:'流年丙午，午火助财耗身，子午冲动妻财宫——财事被强推上台面，机会与压力并至。冲动亦带波折：可借势小试，但不宜在身弱时重仓压注，先稳住现金流。', phenomena:[{ tag:'子午冲妻宫·有效', explain:'财宫被冲动，财事被强推上台面' }] },
    },
    {
      category:'wealth', subcategory:'general_wealth', target:{ shishen:['正财'], gongwei:['日支'], fallback_level:'subcategory', llm_derived_target:null },
      stateReport:STATUS_STATE_REPORT, targetSpec:STATUS_TARGET_SPEC,
      key_signals:[{ title:'正财透月干，财旺身弱', reading:'财气旺而日主辛弱，机会多但承接力不足，需先固本再图进取。' }],
      rhythm:{ segments:[{ period:'壬戌运 2022-2031', dayun_shishen:'伤官', phenomenon:'枭神夺食、思路活跃但根基不稳', strategy:'固本培元、借印生身', key_liunians:[{ year:2026, gz:'丙午', shishen:'正财', note:'财运催动窗口' }] }] },
      action_guide:{ text:'总体宜守不宜攻：先固本、借印星贵人帮扶，再借流年财气小步进取。切忌一次性重仓投资；2033年印运到位后再图实质性扩张。', items:['规避：身弱时勿重仓投资','借势：借印星贵人帮扶','节奏：丙午年小步试探，2033年后再扩张'] },
    })

  // ── timing：婚恋应期（喜用神 木 → 绿） ──
  const timing = mk('timing', '木', '哪一年比较适合结婚',
    [{label:'婚恋应期'},{label:'日主甲'},{label:'喜水木'},{label:'应期推演'}],
    [
      ['summary_basis', '日主甲木身弱，正财为妻星藏于日支，喜印比帮身助其驭财。后端在 22–35 岁区间筛出三个引动妻宫的年份，逐年比对冲合透干强度后给出应期。'],
      ['base_foundation', '原局妻宫（日支戌）藏正财，财星真实有根但日主偏弱。婚恋成败关键在自身够力——印比到位之年最易把握，财旺无制之年反易因压力错失。'],
      ['action_guide', '把握 2028、2031 两个印比助身的窗口主动推进；2026 丙午冲宫之年虽热闹但波折多，宜稳不宜急。'],
    ],
    { score:null, title:'2028前后印星助婚', keyword:'稳中择时', conclusion:'婚恋应期集中在 2028、2031 两年——印比帮身、妻宫被吉合引动；2026 虽有冲动但根基不稳，宜作铺垫。' },
    {
      base_foundation:{ text:'原局妻宫（日支戌）藏正财，财星真实有根但日主偏弱。婚恋成败关键在自身够力——印比到位之年最易把握，财旺无制之年反易因压力错失。', signals:[{ title:'妻宫藏财·日主偏弱', detail:'财真有根，需印比助身方能驭财成婚' }] },
      target_state:[{ title:'正财·妻星藏日支', text:'妻缘真实存在，应期取决于自身得帮扶之年' }],
      trigger_windows:[
        { year:2026, ganzhi:'丙午', dayun_ganzhi:'壬戌', strength:'中等', verdict:'丙午冲动妻宫，感情议题被强推上台面，但身弱逢财旺压力大，多为铺垫而非定局。', phenomena:[{ tag:'子午冲妻宫·机制强', explain:'婚宫被冲动，关系进展加速但波动大' }] },
        { year:2028, ganzhi:'戊申', dayun_ganzhi:'壬戌', strength:'较强', verdict:'申子半合水局生身，印星得力，自身从容，最宜主动推进婚事。', phenomena:[{ tag:'申子合·印星助身', explain:'得贵人助力，关系水到渠成' }] },
        { year:2031, ganzhi:'辛亥', dayun_ganzhi:'癸亥', strength:'较强', verdict:'亥水印星当令、比劫帮身，日主转旺，成婚根基最稳。', phenomena:[{ tag:'亥水生身·根基稳', explain:'自身条件成熟，婚姻稳定度高' }] },
      ],
      best_window:{ year:2028, reason:'申子合水生身、印星得力，自身从容主动' },
      worst_window:{ year:2026, reason:'冲宫虽动但身弱财旺、压力过大，宜缓不宜定' },
    },
    {
      category:'relationship', subcategory:'marriage_timing', target:{ shishen:['正财'], gongwei:['日支'], fallback_level:'subcategory', llm_derived_target:null },
      action_guide:{ text:'把握 2028、2031 两个印比助身的窗口主动推进；2026 丙午冲宫之年虽热闹但波折多，宜稳不宜急。', items:['优先：2028 申子合身之年主动推进','次选：2031 亥水帮身、根基最稳','规避：2026 仅作铺垫，勿急于定局'] },
    })

  // ── pattern：事业格局（喜用神 火 → 红） ──
  const pattern = mk('pattern', '火', '我适合走技术还是管理路线',
    [{label:'事业格局'},{label:'日主甲'},{label:'喜火土'},{label:'格局推演'}],
    [
      ['summary_basis', '从原局先天结构容量看：食伤吐秀、利于专精钻研；官杀不透、统御调度的结构支撑偏弱。故格局更适配深耕技术专家路线，管理为辅。'],
      ['base_foundation', '甲木日主食神格成，月时食伤吐秀而官星不显。先天结构利于「以技立身」——专注、深耕、靠作品说话；调度管人所需的官杀力量薄弱，强行转管理易内耗。'],
      ['action_guide', '主线锚定技术专家路线，把食伤之秀做深做精；管理只在小团队、专业带队的范围内承接，不必追求纯行政管理岗。'],
    ],
    { score:null, title:'食伤吐秀宜技术专精', keyword:'以技立身', conclusion:'先天格局食伤吐秀、利专精；官杀不透、统御力弱。事业宜走**技术专家**主线，管理为辅。' },
    {
      base_foundation:{ text:'甲木日主食神格成，月时食伤吐秀而官星不显。先天结构利于「以技立身」——专注、深耕、靠作品说话；调度管人所需的官杀力量薄弱，强行转管理易内耗。', signals:[{ title:'食神吐秀·官星不透', detail:'利专精创造，弱于统御调度' }] },
      target_state:[{ title:'食伤·才华输出位', text:'技术与创造是命主最稳的发力点' }],
      structural_supports:['月干食神透出得地，专业深度与创造力强','日坐财库，技术可转化为实在收益','时柱伤官生财，作品化变现路径顺'],
      structural_risks:['官杀不透，带团队的权威感与调度力天然偏弱','身弱食伤旺，易过度发散、精力难聚焦'],
      structural_verdict:'先天容量偏「专家型」而非「管理型」：把食伤之秀做深、以技立身最顺；管理可作为专业带队的延伸，但不宜作为主路线强行攀爬。',
      current_status_note:'当前壬戌运伤官生财，正是把技术沉淀为作品与收益的窗口，宜深耕不宜频繁转岗。',
    },
    {
      secondary_mode:'status', category:'career', subcategory:'career_path', target:{ shishen:['食神','伤官'], gongwei:['月干'], fallback_level:'subcategory', llm_derived_target:null },
      action_guide:{ text:'主线锚定技术专家路线，把食伤之秀做深做精；管理只在小团队、专业带队的范围内承接，不必追求纯行政管理岗。', items:['深耕：把专业做到不可替代','变现：借日坐财库将技术转化为收益','克制：管理只做专业带队，勿强攀行政岗'] },
    })

  // ── character：配偶画像（喜用神 金 → 淡金 metal） ──
  const character = mk('character', '金', '我未来的另一半是什么样的人',
    [{label:'配偶画像'},{label:'日主甲'},{label:'喜金水'},{label:'人物推演'}],
    [
      ['summary_basis', '以日支妻宫与正财星的五行、十神、宫位状态推演配偶倾向：正财藏戌库、得月令土气，呈现务实、顾家、善理财的人物侧写。以下为倾向推断，非现实定论。'],
    ],
    { score:null, title:'务实顾家的理财型伴侣', keyword:'稳重持家', conclusion:'妻星正财藏库得令，配偶倾向**务实、顾家、善打理生活**；相处以稳定踏实为底色。' },
    {
      portrait_subject:'spouse',
      target_resolution:'backend_mapped',
      llm_derived_target_note:'',
      appearance_tendency:{ text:'中等偏稳的体态，气质温和不张扬，衣着偏实用得体，给人可靠踏实的第一印象。', confidence:'medium', evidence:['正财属土，主敦实','妻宫戌库藏丁，面相温润'] },
      personality_tendency:{ text:'务实、节俭、重承诺，做事有计划、不爱冒险；情感表达内敛，靠行动而非言语示爱。', confidence:'high', evidence:['正财坐库主守成','土性沉稳少浮夸'] },
      career_style:{ text:'倾向稳定务实的职业，擅长管理钱财与生活事务，财务上是家庭的稳定器。', confidence:'medium', evidence:['财星得令，理财力强'] },
      relationship_dynamic:'相处以稳定踏实为底色，对方愿为家庭付出实际行动；命主需主动表达情感，避免把对方的内敛误读为冷淡。',
      do_not_overclaim:'以上为十神五行和宫位状态呈现的人物倾向，不等于现实中对方一定如此。',
    },
    {
      category:'relationship', subcategory:'partner_profile', target:{ shishen:['正财'], gongwei:['日支'], fallback_level:'subcategory', llm_derived_target:null },
      action_guide:{ text:'重视对方以行动表达的关心，主动沟通情感需求，让稳定的关系不流于平淡。', items:['主动表达情感，避免误读对方的内敛','共同规划财务，发挥对方理财之长','在稳定中创造仪式感，维持新鲜度'] },
    })

  // ── profile_driven：泛运势/路径（喜用神 土 → 金土 earth） ──
  const profile_driven = mk('profile_driven', '土', '我这辈子大概是什么样的命',
    [{label:'整体运势'},{label:'日主甲'},{label:'喜火土'},{label:'路径推演'}],
    [
      ['summary_basis', '无具体靶子，以完整命盘自主提取最相关线索：日主身弱、食伤吐秀而财官皆需自身够力。整体是「靠才华谋生、中年后渐入佳境」的格局，下列按主业/副业两条路径对比。'],
      ['base_foundation', '甲木身弱食伤旺，才华外显但根基需培。早年靠技艺起步、积累较慢；印比大运到位后日主转旺，承接力增强，财官方能落地，属厚积薄发之命。'],
      ['dayun_field', '当前壬戌运伤官生财，思路活跃、机会多但精力分散，是打基础、试方向的阶段。心态上易急于求成，外部环境机会杂而需取舍。'],
      ['liunian_trigger', '流年丙午助财耗身，财事被推上台面，可小步试探但忌重仓。冲动带来变化窗口，适合调整方向而非孤注一掷。'],
      ['action_guide', '前期以技立身、稳扎稳打，借印比之运培根；中年后顺势把才华转化为实在事业，避免早年盲目铺摊子。'],
    ],
    { score:null, title:'厚积薄发以技立身', keyword:'先苦后甜', conclusion:'整体为**身弱食伤吐秀**之命：早年靠才华起步、积累较慢，印比运到位后渐入佳境，中年后财官落地，先苦后甜。' },
    {
      base_foundation:{ text:'甲木身弱食伤旺，才华外显但根基需培。早年靠技艺起步、积累较慢；印比大运到位后日主转旺，承接力增强，财官方能落地，属厚积薄发之命。', signals:[{ title:'身弱食伤旺·厚积薄发', detail:'才华先行，根基后成，中年转旺' }] },
      target_state:[{ title:'食伤·才华主线', text:'以技立身是最稳的发力方向', confidence:'low' }],
      dayun_field:{ text:'当前壬戌运伤官生财，思路活跃、机会多但精力分散，是打基础、试方向的阶段。心态上易急于求成，外部环境机会杂而需取舍。' },
      liunian_trigger:{ text:'流年丙午助财耗身，财事被推上台面，可小步试探但忌重仓。冲动带来变化窗口，适合调整方向而非孤注一掷。', phenomena:[] },
      path_readings:[
        { path:'主业优先（技术深耕）', structural_fit:'对应食神格，原局食伤吐秀、最得力', likely_experience:'近1-3年在专业上持续精进、逐步建立口碑，收入稳步上行但尚无爆发，需耐住积累期的平淡。', satisfaction_prediction:'高——契合先天才华，越做越顺', peak_period:'2033 起印星大运，专业沉淀转化为实质回报', risk:'过度求稳错失变现窗口', confidence:'low' },
        { path:'副业/创业优先（提前铺摊）', structural_fit:'依赖财官，但日主身弱、承接力当前不足', likely_experience:'近1-3年若提前重仓铺摊，易因精力分散、资金链紧张而疲于奔命，机会虽多却难收口。', satisfaction_prediction:'中——短期热闹但根基不稳', peak_period:'宜待 2033 身旺后再放大', risk:'身弱强行扩张致进退失据', confidence:'low' },
      ],
    },
    {
      category:'general', subcategory:'life_overview', target:{ shishen:[], gongwei:[], fallback_level:'category', llm_derived_target:null }, confidence:'low',
      action_guide:{ text:'前期以技立身、稳扎稳打，借印比之运培根；中年后顺势把才华转化为实在事业，避免早年盲目铺摊子。', items:['主线：深耕专业，建立不可替代性','节奏：2033 身旺后再放大事业版图','规避：身弱期勿盲目重仓创业'] },
    })

  return { status, timing, pattern, character, profile_driven }
})()
const MOCK_BAZI = MOCK_BAZI_MODES.status

function mockBaziResponse(mock = MOCK_BAZI) {
  const enc = new TextEncoder()
  const send = (ctrl, obj) => ctrl.enqueue(enc.encode('data: ' + JSON.stringify(obj) + '\n\n'))
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const tg = mock.engineOutput.tags || []
  const lbl = (i, fb) => tg[i]?.label || fb
  const body = new ReadableStream({
    async start(ctrl) {
      send(ctrl, { type:'step', index:0, pct:10, chip:{ main:lbl(0,'命理分析'), sub:'八字命理' } }); await sleep(380)
      send(ctrl, { type:'step', index:1, pct:22, chip:{ main:lbl(1,'日主甲'), sub:'身弱' } }); await sleep(340)
      send(ctrl, { type:'step', index:2, pct:36, chip:{ main:lbl(3,'命局推演'), sub:'目标已锁定' } }); await sleep(320)
      send(ctrl, { type:'step', index:3, pct:48, chip:{ main:'起盘完成', sub:'引擎已就位' } }); await sleep(300)
      send(ctrl, { type:'step', index:4, pct:62, chip:{ main:lbl(2,'喜用已定'), sub:'忌神已标记' } }); await sleep(360)
      send(ctrl, { type:'engine_complete', pct:70, engineOutput:mock.engineOutput }); await sleep(600)
      send(ctrl, { type:'active', index:5, pct:75 }); await sleep(380)
      for (const [sec, text] of mock.sections) {
        for (let i = 0; i < text.length; i += 3) { send(ctrl, { type:'llm_delta', section:sec, text:text.slice(i, i+3) }); await sleep(16) }
        await sleep(140)
      }
      send(ctrl, { type:'llm_done', pct:95, text:'' }); await sleep(220)
      send(ctrl, { type:'complete', result:mock.result })
      ctrl.close()
    }
  })
  return { ok:true, body }
}

async function runBaziMock(mode = 'status') {
  const mock = MOCK_BAZI_MODES[mode] || MOCK_BAZI
  questionInput.value = mock.result.question
  isSubmitting.value = true
  resetSseState()
  sseBranch.value = 'bazi'
  wenShiStreaming.value = true
  resultPhase.value = 'stream'
  wenShiStatus.value = '正在解析问题'
  showOrbFx.value = true
  orbSettling.value = false
  orbTone.value = ''
  resultHtml.value = buildStreamingScaffoldHTML({ branch: 'bazi' }, wenShiStatus.value)
  viewState.value = 'result'
  await nextTick(); initMagTabInk()
  try {
    const data = await readSSEStream(mockBaziResponse(mock))
    if (wenShiStreaming.value) await settleOrbToResult(data)
    wenShiStreaming.value = false
    activeResultRecord.value = null
    const finalCard = applyCardMdBold(buildCardHTML(data))
    finalOverlayHtml.value = finalCard
    await nextTick()
    initMagTabInk()
    setTimeout(() => document.querySelectorAll('.result-overlay .reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 300)
    await new Promise(r => setTimeout(r, 700))
    resultHtml.value = finalCard
    await nextTick()
    // 终态卡片成为底层后再用完整数据重挂面板（teleport 重解析到终态锚点）
    activateBaziResultPanel(data)
    document.querySelectorAll('.html-container .reveal').forEach(el => el.classList.add('visible'))
    initMagTabInk()
    finalOverlayHtml.value = ''
    showOrbFx.value = false
    viewState.value = 'result'
  } finally {
    isSubmitting.value = false
  }
}
if (typeof window !== 'undefined') window.__mockBazi = runBaziMock
// 把某段流式文本就地补丁进卡片对应槽位（带 ** 加粗 + 流式光标）
function patchStreamSlot(section, fullText) {
  const root = document.querySelector('.html-container .wenshi-streaming')
  if (!root) return
  const el = root.querySelector(`[data-wslot="${section}"]`)
  if (!el) return
  el.classList.add('wstream-active')
  el.innerHTML = renderStreamProse(fullText)
}

// 仅支持 **加粗**：先转义 HTML，再把成对 ** 转成 <strong>
const escapeHtmlText = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mdBold = (s) => String(s ?? '').replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
// 流式实时文字：转义后渲染加粗（换行交给 white-space: pre-wrap）
const renderStreamProse = (text) => mdBold(escapeHtmlText(text))
// 最终卡片 HTML：内容已是受控 HTML，只把残留 ** 转成加粗
const applyCardMdBold = (html) => mdBold(html)

function resetSseState() {
  sseBranch.value = 'qimen'
  sseActiveIndex.value = 0
  sseChips.value = {}
  ssePct.value = 0
  wenShiEngineResult.value = null
  wenShiLlm.value = { status: 'idle', text: '' }
  wenShiStreaming.value = false
  wenShiStatus.value = '正在解析问题'
  showOrbFx.value = false
  orbSettling.value = false
  orbTone.value = ''
  finalOverlayHtml.value = ''
  for (const k in wenShiStreamSections) delete wenShiStreamSections[k]
}

async function readSSEStream(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) throw new Error('推演流意外关闭')
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      let event
      try { event = JSON.parse(line.slice(6)) } catch { continue }
      if (event.type === 'step') {
        sseActiveIndex.value = event.index + 1
        if (event.chip) sseChips.value = { ...sseChips.value, [event.index]: event.chip }
        ssePct.value = event.pct
        if (wenShiStreaming.value) {
          // 状态行只展示最新中间产物：优先 chip（产物），否则当前步骤名
          const stepName = sseCurrentSteps.value[event.index + 1]?.name || sseCurrentSteps.value[event.index]?.name || ''
          const label = event.chip ? `${event.chip.main}${event.chip.sub ? ' · ' + event.chip.sub : ''}` : stepName
          patchOrbStatus(label)
        }
      } else if (event.type === 'engine_complete') {
        wenShiEngineResult.value = event.engineOutput
        ssePct.value = event.pct
        const eo = event.engineOutput
        if (eo?.branch === 'qimen') {
          wenShiStreaming.value = true
          for (const k in wenShiStreamSections) delete wenShiStreamSections[k]
          patchOrbStatus(`初分 ${eo.pre_score} · 深度推演`)
          const root = document.querySelector('.html-container .wenshi-streaming')
          if (root) {
            // 已在脚手架中：只就地补丁「奇门定基」(盘面/格局)，保留能量球 DOM，避免重建闪动
            const fresh = document.createElement('div')
            fresh.innerHTML = buildStreamingScaffoldHTML(eo, wenShiStatus.value)
            const a = fresh.querySelector('#mag-m2'), b = root.querySelector('#mag-m2')
            if (a && b) b.innerHTML = a.innerHTML
          } else {
            resultPhase.value = 'stream'
            resultHtml.value = buildStreamingScaffoldHTML(eo, wenShiStatus.value)
            viewState.value = 'result'
          }
        } else if (eo?.branch === 'bazi') {
          // 八字：无分数，能量球定格用喜用神五行色
          wenShiStreaming.value = true
          for (const k in wenShiStreamSections) delete wenShiStreamSections[k]
          orbTone.value = 'wo-tone-' + baziElementTone(eo.favorable_element).tone
          patchOrbStatus('深度推演中')
          // 兜底：若尚未是 bazi 脚手架，切过去
          if (!document.querySelector('.html-container #bazi-hero')) {
            resultPhase.value = 'stream'
            resultHtml.value = buildStreamingScaffoldHTML(eo, wenShiStatus.value)
            viewState.value = 'result'
          }
          // 引擎产物先行：LLM 流式之前先把命局解读面板挂到脚手架锚点
          await nextTick()
          activateBaziResultPanel(baziEngineToPanelData(eo))
        }
      } else if (event.type === 'active') {
        sseActiveIndex.value = event.index
        ssePct.value = event.pct
        if (wenShiStreaming.value) patchOrbStatus(sseCurrentSteps.value[event.index]?.name || 'AI 推演解盘')
        else wenShiLlm.value = { status: 'pending', text: '' }
      } else if (event.type === 'llm_retry') {
        // 后端结构校验未过，正在非流式重试：清空已显示的半截内容，重置回骨架
        for (const k in wenShiStreamSections) delete wenShiStreamSections[k]
        const root = document.querySelector('.html-container .wenshi-streaming')
        if (root) {
          root.querySelectorAll('[data-wslot]').forEach(el => {
            el.classList.remove('wstream-active')
            el.innerHTML = '<span class="wsk"><i></i><i></i></span>'
          })
        }
        if (wenShiStreaming.value) patchOrbStatus(event.message || 'AI 重新推演中…')
        else { wenShiLlm.value = { status: 'pending', text: '' } }
      } else if (event.type === 'llm_delta') {
        if (wenShiStreaming.value && event.section) {
          // 奇门：累加并就地补丁到对应卡片槽位
          wenShiStreamSections[event.section] = (wenShiStreamSections[event.section] || '') + event.text
          patchStreamSlot(event.section, wenShiStreamSections[event.section])
        } else {
          // 八字：旧的整段流式文字
          wenShiLlm.value.status = 'streaming'
          wenShiLlm.value.text += event.text
        }
      } else if (event.type === 'llm_done') {
        if (!wenShiStreaming.value) {
          wenShiLlm.value.status = 'done'
          wenShiLlm.value.text = event.text
        }
        ssePct.value = event.pct
      } else if (event.type === 'complete') {
        sseActiveIndex.value = sseCurrentSteps.value.length
        ssePct.value = 100
        return event.result
      } else if (event.type === 'error') {
        throw new Error(event.message || '推演失败')
      }
    }
  }
}

let clockInterval = null
let suggestionTimer = null
const getFortuneStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

const syncAuthModeFromRoute = () => {
  if (route.query.auth === 'register') authView.value = 'register'
  else if (route.query.auth === 'login') authView.value = 'login'
}

// ── 有名格断语字典 ──
const GE_DESCRIPTIONS = {
  // 吉格 — 天地盘干组合
  '飞鸟跌穴': '势如飞鸟入穴，谋事必成，利行动出击，诉讼有力。',
  '青龙返首': '龙首回顾，守成有余，防守有利，坐等天时主局自稳。',
  '日月并行': '日月同辉，诸事顺遂，感情婚姻尤佳，贵人常伴。',
  '奇仪相佐': '奇仪辅佐，利学业考试，文书有成，谋划可期。',
  '青龙转光': '青龙转光，事业财运渐旺，可图发展，贵人相助。',
  '青龙耀明': '龙光耀明，事业有进，贵人相助，名利双收。',
  '星奇入太阴': '奇星入阴，利学业谋划，暗中有助，运筹帷幄。',
  '奇仪相合·乙庚': '刚柔相济，合作顺利，诉讼可解，感情和谐。',
  '奇仪相合·丙辛': '光芒相合，婚恋顺遂，官司可和，诸事顺利。',
  '奇仪相合·丁壬': '阴阳和合，感情婚姻大利，合作有成，吉象频现。',
  '奇仪相合·戊癸': '土水合德，感情渐融，合作可期，润物无声。',
  // 凶格 — 天地盘干组合
  '青龙逃走': '青龙遁逃，奴仆背离，六畜受伤，主动出击大损，防小人背叛。',
  '白虎猖狂': '白虎横行，人亡家败，出行遇险，车船受损，尊长不利，诸事难成。',
  '朱雀投江': '朱雀沉溺，文书口舌俱消，音信全无，凡事沉滞难成，忌出行求事。',
  '螣蛇夭矫': '螣蛇作乱，是非口舌纷起，虚惊诈骗频现，感情生变，谨防欺骗。',
  '太白入荧': '兵刃相见，贼者来犯，主动出击得利，守方损财，慎防被侵夺。',
  '荧入太白': '火入金门，门户败落，守方转危为安，主动者反自陷被动困境。',
  '大格': '大格凶险，感情破裂，疾病官司皆凶，诸事难成，宜静待观变。',
  '小格': '小格碍事，事业受阻，进展迟缓，宜审慎图谋，勿急进。',
  '伏宫格': '伏宫压制，财运受困，官司不利，宜守不宜动，待时而发。',
  '飞宫格': '飞宫动荡，事业受损，官司难胜，谨防变故，稳扎稳打。',
  '刑格': '刑格逼迫，财运受损，官司缠身，刑罚之象，忌争讼。',
  '天网四张': '天网恢恢，无路可走，出行求事皆凶，万事休止，静待时机。',
  '地网遮蔽': '地网遮蔽，暗藏险机，事业受阻，谨防奸情暗算，不宜轻动。',
  // 凶格 — 结构格
  '六仪击刑': '六仪相刑，感情破损，官司疾病极凶，主动者首当其冲，大凶之局。',
  '三奇入墓·乙': '乙奇入墓，木气受困，生机停滞，诸事难成，宜静不宜动。',
  '三奇入墓·丙': '丙奇入墓，光华暗淡，事业财运受阻，百不宜为，守静待变。',
  '三奇入墓·丁': '丁奇入墓，奇星失力，谋事难成，文书受阻，宜静不宜动。',
  // 吉格 — 结构格
  '三奇得使': '三奇得使，奇门大吉，诸事顺遂，出行求事皆宜，贵人相助。',
  '三奇贵人升殿': '三奇贵人升殿，大吉之象，财运学业官事皆旺，百事大利。',
  '玉女守门': '玉女守门，感情和顺，事业顺遂，贵人暗助，柔化阻力。',
  '天显时格': '天时显现，把握机遇，事业可为，官司宜主动，顺势而为。',
  '真诈格': '三诈成局，借奇门之势，谋事有成，事业财运利，官司得胜。',
  '重诈格': '三诈成局，借奇门之势，谋事有成，事业财运利，官司得胜。',
  '休诈格': '三诈成局，借奇门之势，谋事有成，事业财运利，官司得胜。',
  '天假格': '天假借力，九天助势，谋事可成，事业财运有助，可乘势而为。',
  '地假格': '地假借力，九地庇护，谋事可成，事业财运有助，稳中求进。',
  '物假格': '物假借力，六合通融，谋事可成，事业财运有助，合作顺遂。',
  '鬼假格': '鬼假借力，化险为夷，谋事可成，事业财运有助，逢凶化吉。',
  '人假格': '人假借力，人缘得力，谋事可成，事业财运有助，贵人相携。',
  // 九遁吉格
  '天遁': '天遁大吉，感情婚姻官事皆利，贵人相助，可逢凶化吉，宜行动。',
  '地遁': '地遁吉祥，感情婚姻官事顺遂，稳中有进，可化解险厄。',
  '人遁': '人遁贵助，暗中有贵人相护，感情婚姻官事皆宜，阴助有力。',
  '神遁': '神遁天助，事业求财顺遂，官事可胜，上天暗护，大吉。',
  '云遁': '云遁潜行，感情顺遂，可化阻碍，柔化矛盾，静待成事。',
  '风遁': '风遁助力，事业求财有进，可乘势而为，时机把握得当。',
  '龙遁': '龙遁吉象，感情顺遂，助力可期，贵人暗护，顺势而行。',
  '虎遁': '虎遁化险，事业求财有利，可乘势出击，化被动为主动。',
  '鬼遁': '鬼遁暗助，事业求财有进，可谋阴利，化解暗中阻力。',
  // 凶格 — 时间结构格
  '五不遇时': '五不遇时，时干克日干，百事不宜，尤忌出行求财，健康堪忧，宜静不宜动。',
  '奇格': '庚压三奇，奇门受困，主动者大损，百事阻滞，慎防险厄，忌轻举妄动。',
  '岁格': '岁格压制，庚临年干，一年之内事业财运受阻，谨慎行事，待岁运转顺。',
  '月格': '月格制约，庚临月干，本月内事业财运受困，宜守待机，避锋芒。',
  '悖格': '悖格乱局，纲纪紊乱，倒行逆施之象，事业财运受阻，宜防内乱生变。',
  '伏干格': '伏干压制，日干受困，守方尤难脱身，事业财运极凶，慎之又慎。',
  '飞干格': '飞干冲动，日干飞越，事业财运极凶，大事不宜，宜静待时机。',
  '伏吟（凶）': '伏吟停滞，万事凝固不动，主动出行大凶，局势僵持，宜守不宜动。',
  '反吟（凶）': '反吟翻覆，局势颠倒，守方处境艰难，变化剧烈，宜化解矛盾。',
}

// ── 有名格 modal ──
let geModalEl = null
let geOverlayEl = null
let geActiveTag = null
let lastHandledSessionKey = null

const hideGeModal = () => {
  geOverlayEl?.classList.remove('visible')
  geModalEl?.classList.remove('visible')
  geActiveTag = null
}

const showGeModal = (tag, reasons) => {
  const name = tag.dataset.geName
  const entry = reasons.find(r => r.name === name)
  if (!entry) return
  geActiveTag = tag
  if (!geOverlayEl) {
    geOverlayEl = document.createElement('div')
    geOverlayEl.className = 'ge-overlay'
    geOverlayEl.addEventListener('click', hideGeModal)
    document.body.appendChild(geOverlayEl)
  }
  if (!geModalEl) {
    geModalEl = document.createElement('div')
    geModalEl.className = 'ge-modal'
    geModalEl.innerHTML = `<button class="ge-modal-close">✕</button><div class="ge-pop-kicker">格局说明</div><div class="ge-pop-name"></div><div class="ge-pop-divider"></div><div class="ge-pop-text"></div>`
    geModalEl.querySelector('.ge-modal-close').addEventListener('click', hideGeModal)
    document.body.appendChild(geModalEl)
  }
  geModalEl.querySelector('.ge-pop-name').textContent = entry.name
  geModalEl.querySelector('.ge-pop-name').className = `ge-pop-name ${entry.type}`
  geModalEl.querySelector('.ge-pop-kicker').textContent = entry.type === 'ji' ? '吉格提示' : '凶格提示'
  geModalEl.querySelector('.ge-pop-text').textContent = entry.text
  geOverlayEl.classList.add('visible')
  geModalEl.classList.add('visible')
}

const handleGeTagClick = (e) => {
  const tag = e.target.closest('.ge-tag')
  if (!tag) return
  const row = tag.closest('.formation-tag-row, .ge-tags-row')
  if (!row) return
  try {
    const reasons = JSON.parse(row.dataset.geReasons || '[]')
    if (geActiveTag === tag && geModalEl?.classList.contains('visible')) hideGeModal()
    else showGeModal(tag, reasons)
  } catch {}
}

onMounted(() => {
  syncAuthModeFromRoute()
  // 开发用：?mock=qimen 自动播放奇门流式生成（不调 API）
  if (route.query.mock === 'qimen') setTimeout(() => runQimenMock(), 600)
  // ?mock=bazi 默认 status；?mock=bazi&mode=timing|pattern|character|profile_driven 切换 mode
  if (route.query.mock === 'bazi') setTimeout(() => runBaziMock(String(route.query.mode || 'status')), 600)
  updateClock()
  clockInterval = setInterval(updateClock, 30000)
  suggestionTimer = setInterval(() => {
    suggestionPairIdx.value = (suggestionPairIdx.value + 2) % SUGGESTED_QUESTIONS.length
  }, 5000)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('click', handleGeTagClick)
  document.addEventListener('scroll', scheduleMagTabScrollSync, true)
  window.addEventListener('resize', scheduleMagTabScrollSync)

  supabase.auth.getSession().then(({ data: { session } }) => {
    handleSessionUpdate(session)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    handleSessionUpdate(session)
  })
})

watch(() => route.query.auth, syncAuthModeFromRoute)

watch(activeCategory, () => {
  if (!globalState.isDrawerOpen) {
    historyLoaded.value = false
    historyHasMore.value = true
    historyPage.value = 0
    historyRecords.value = []
    return
  }
  loadHistoryPage({ reset: true })
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('click', handleGeTagClick)
  document.removeEventListener('scroll', scheduleMagTabScrollSync, true)
  window.removeEventListener('resize', scheduleMagTabScrollSync)
  if (magTabScrollFrame !== null) cancelAnimationFrame(magTabScrollFrame)
  geModalEl?.remove()
  geOverlayEl?.remove()
  geModalEl = null
  geOverlayEl = null
  clearInterval(clockInterval)
  clearInterval(loaderInterval)
  clearInterval(scoreTimer)
  clearInterval(suggestionTimer)
})

const toggleDrawer = () => {
  globalState.isDrawerOpen = !globalState.isDrawerOpen
  if (globalState.isDrawerOpen) ensureHistoryLoaded()
}

const handleSessionUpdate = (session) => {
  const sessionKey = session?.access_token || session?.user?.id || ''
  if (sessionKey && sessionKey === lastHandledSessionKey) return
  lastHandledSessionKey = sessionKey
  setCurrentUser(session?.user || null)
  if (session) {
    currentUser.value = session.user
    resetHistoryState()
    fetchBaziProfiles()
    warmFortuneCacheFromSupabase({
      supabase,
      storage: getFortuneStorage(),
      userId: session.user.id
    })
  } else {
    lastHandledSessionKey = ''
    currentUser.value = null
    if (!isGuest.value) {
      resetHistoryState()
      resetToInput()
    }
  }
}

const handleAuth = async () => {
  if (!authForm.email || !authForm.password) return alert("请填写完整的邮箱和密码")
  authLoading.value = true
  try {
    if (isLoginMode.value) {
      const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password })
      if (error) throw error
    } else {
      const { error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password })
      if (error) throw error
      alert("注册成功！请去邮箱点击验证链接后登录。")
    }
  } catch (error) {
    alert("认证失败: " + error.message)
  } finally {
    authLoading.value = false
  }
}

const handleGoogleAuth = async () => {
  googleAuthLoading.value = true
  try {
    const href = typeof window === 'undefined' ? 'https://xkbqiiwwgfzkyfhxuoev.supabase.co' : window.location.href
    const { error } = await supabase.auth.signInWithOAuth(buildGoogleOAuthSignInArgs(href))
    if (error) throw error
  } catch (error) {
    alert("Google 登录失败: " + error.message)
    googleAuthLoading.value = false
  }
}

const handleResetPasswordEmail = async () => {
  if (!authForm.email) return alert('请先输入邮箱地址')
  resetEmailLoading.value = true
  resetEmailNotice.value = ''
  try {
    const href = typeof window === 'undefined' ? 'https://xkbqiiwwgfzkyfhxuoev.supabase.co' : window.location.href
    const { error } = await supabase.auth.resetPasswordForEmail(authForm.email, buildPasswordResetEmailArgs(href))
    if (error) throw error
    resetEmailNotice.value = '重设密码邮件已发送，请前往邮箱查收。'
  } catch (error) {
    alert('重设邮件发送失败: ' + error.message)
  } finally {
    resetEmailLoading.value = false
  }
}

const handleSignOut = async () => {
  if (isGuest.value && !currentUser.value) {
    leaveGuestMode()
    resetHistoryState()
    resetToInput()
  } else {
    await supabase.auth.signOut()
  }
}

const handleGuestEntry = async () => {
  enterGuestMode()
  currentUser.value = null
  resetHistoryState()
  await fetchBaziProfiles()
  await trackGuestEvent(supabase, 'guest_started', 'auth')
}

const updateClock = () => {
  // 自定义固定时刻：用 lunar 精确干支展示（带日期前缀），并停止跟随系统时钟
  if (panTime.value) {
    const p = panTime.value
    try {
      const l = Solar.fromYmdHms(p.year, p.month, p.day, p.hour, p.minute, 0).getLunar()
      clockText.value = `${p.month}月${p.day}日 ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} ${l.getDayInGanZhi()}日 ${l.getTimeZhi()}时`
    } catch {
      clockText.value = `${p.year}-${p.month}-${p.day} ${p.hour}:${String(p.minute).padStart(2, '0')}`
    }
    return
  }
  const TIAN_GAN = "甲乙丙丁戊己庚辛壬癸".split("")
  const DI_ZHI = "子丑寅卯辰巳午未申酉戌亥".split("")
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  // 用 lunar 精确日干与时支（替代旧的粗略近似，避免与排盘/选择器不一致）
  const _l = Solar.fromYmdHms(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), 0).getLunar()
  const stemIdx = Math.max(0, TIAN_GAN.indexOf(_l.getDayGan()))
  const shichenIdx = Math.max(0, DI_ZHI.indexOf(_l.getTimeZhi()))
  clockText.value = `${h}:${m}\u2002${TIAN_GAN[stemIdx]}日 ${DI_ZHI[shichenIdx]}时`
}

// 时间选择器：确认 / 重置
const onTimePickerConfirm = (parts) => {
  panTime.value = parts
  showTimePicker.value = false
  updateClock()
}
const onTimeNoteClick = () => {
  if (!panTime.value) return // 「以当下时辰起局」态不可点
  showResetTimeConfirm.value = true
}
const confirmResetTime = () => {
  panTime.value = null
  showResetTimeConfirm.value = false
  updateClock()
}

const formatSolarDate = (value) => {
  if (!value) return '阳历待确认'
  const p = String(value).match(/\d+/g)
  if (!p || p.length < 3) return '阳历待确认'
  const time = p.length >= 5 ? ` ${p[3].padStart(2, '0')}:${p[4].padStart(2, '0')}` : ''
  return `${p[0]}.${p[1].padStart(2, '0')}.${p[2].padStart(2, '0')}${time}`
}

const profileMetaText = (profile) => {
  const parts = [profile.gender === 'M' ? '乾造' : '坤造']
  if (profile.birth_location) parts.push(profile.birth_location)
  if (profile.is_default) parts.push('默认')
  return parts.join(' · ')
}

const fetchBaziProfiles = async () => {
  if (isGuest.value && !currentUser.value) {
    const profile = getGuestState().baziProfile
    baziProfiles.value = profile ? [profile] : []
    selectedProfileId.value = profile?.id || ''
    if (profile?.id) setSelectedBaziProfileId(profile.id)
    handleProfileSelect()
    return
  }
  if (!currentUser.value) return
  const applyProfiles = (list) => {
    baziProfiles.value = list
    const resolvedProfileId = resolveSelectedBaziProfileId(baziProfiles.value, {
      currentProfileId: selectedProfileId.value
    })
    selectedProfileId.value = resolvedProfileId
    setSelectedBaziProfileId(resolvedProfileId)
    handleProfileSelect()
  }
  const cached = getCachedBaziProfiles('qimen')
  if (cached?.length) applyProfiles(cached)
  const { data, error } = await supabase.from('bazi_profiles').select(BAZI_PROFILE_QIMEN_SELECT).order('created_at', { ascending: false })
  if (!error && data) {
    setCachedBaziProfiles('qimen', data)
    applyProfiles(data)
  }
}

const handleProfileSelect = () => {
  if (!selectedProfileId.value) {
    currentBaziString.value = ''
    return
  }
  setSelectedBaziProfileId(selectedProfileId.value)
  const profile = baziProfiles.value.find(p => p.id === selectedProfileId.value)
  if (profile?.bazi_summary) {
    const baziStr = profile.bazi_str || "未知"
    currentBaziString.value = `命主：${profile.name}\n性别：${profile.gender === 'M' ? '男' : '女'}\n八字结构：${baziStr}\n断语：${profile.bazi_summary}`
  } else {
    currentBaziString.value = ''
  }
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
  isProfileMenuOpen.value = false
  handleProfileSelect()
}

const handleDocumentClick = (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest('.profile-switcher')) isProfileMenuOpen.value = false
}

const goToBaziProfiles = () => {
  router.push({ name: 'bazi' })
}

watch(
  () => globalState.selectedBaziProfileId,
  (profileId) => {
    if (!profileId || profileId === selectedProfileId.value) return
    if (!baziProfiles.value.some(profile => profile.id === profileId)) return
    selectedProfileId.value = profileId
    handleProfileSelect()
  }
)

watch(showRouteInfoModal, async (isOpen) => {
  if (!isOpen || !currentUser.value) return
  dailyQimenUsed.value = null
  try {
    const { startIso, endIso } = buildBeijingDayRange()
    const { count } = await supabase
      .from('qimen_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.value.id)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
    dailyQimenUsed.value = count ?? 0
  } catch {
    dailyQimenUsed.value = 0
  }
})

const startLoaderCycle = () => {
  let idx = 0
  loaderInterval = setInterval(() => {
    idx = (idx + 1) % LOADER_MESSAGES.length
    currentLoaderMessage.value = LOADER_MESSAGES[idx]
  }, 3000)
}

const stopLoaderCycle = () => { clearInterval(loaderInterval) }

const resetToInput = () => {
  viewState.value = 'input'
  questionInput.value = ''
  activeResultRecord.value = null
  activeBaziResultData.value = null
  baziCardSelectedYear.value = null
  showBaziBackingAnchor.value = false
  showBaziPanelAnchor.value = false
  currentResultData.value = null
  followupInput.value = ''
  followupNewMatter.value = null
}

const startNewSession = () => {
  resetToInput()
  globalState.isDrawerOpen = false
}

const syncBaziBackingAnchor = () => {
  nextTick(() => {
    showBaziBackingAnchor.value = Boolean(
      activeBaziResultData.value &&
      activeBaziProfile.value &&
      document.getElementById('bazi-backing-anchor')
    )
  })
}

const syncBaziPanelAnchor = () => {
  nextTick(() => {
    showBaziPanelAnchor.value = Boolean(
      activeBaziResultData.value?.state_report &&
      document.getElementById('bazi-panel-anchor')
    )
  })
}

const normalizeBaziPanelPillars = (pillars = []) => pillars.map(pillar => ({
  ...pillar,
  hidden_stems: Array.isArray(pillar.hidden_stems)
    ? pillar.hidden_stems.map(stem => (typeof stem === 'string' ? stem : stem?.gan)).filter(Boolean)
    : [],
  is_kong: pillar.is_kong ?? false
}))

const fetchMissingPanelMatrix = async () => {
  if (baziPanelMatrix.value) return
  // 仅当当前选中 profile 确为本问题命主时才回填，避免 admin 跨账号查看时拉到别人的盘
  if (!subjectMatchesActiveProfile()) return
  const profileId = activeBaziProfile.value?.id
  if (!profileId) return
  const data = activeBaziResultData.value || {}
  const mode = data.meta?.analysis_mode
  if (!mode || mode === 'profile_driven') return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(apiPath('/api/bazi-panel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        profileId,
        category: data.meta?.category,
        subcategory: data.meta?.subcategory,
        analysis_mode: mode
      })
    })
    if (!res.ok) return
    const panelData = await res.json()
    const pillars = normalizeBaziPanelPillars(panelData._panel_matrix?.pillars || [])
    if (!pillars.length) return
    activeBaziResultData.value = {
      ...activeBaziResultData.value,
      _panel_matrix: { pillars }
    }
  } catch (e) {
    console.warn('[panel] fetchMissingPanelMatrix failed', e)
  }
}

// 存量记录缺少 state_report 时，按需从后端重算（纯引擎，不调 LLM）
const fetchMissingPanelData = async (data) => {
  const mode = data?.meta?.analysis_mode
  if (!mode || mode === 'profile_driven') return
  // 仅当当前选中 profile 确为本问题命主时才重算，避免 admin 跨账号查看时引擎跑在别人盘上
  if (!subjectMatchesActiveProfile()) return
  const profileId = activeBaziProfile.value?.id
  if (!profileId) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(apiPath('/api/bazi-panel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        profileId,
        category: data.meta?.category,
        subcategory: data.meta?.subcategory,
        analysis_mode: mode
      })
    })
    if (!res.ok) return
    const panelData = await res.json()
    if (!panelData.state_report) return
    // 把 profile 的 matrix pillars 一并存入（BaziStaticPanel 渲染四柱需要）
    // 将 hidden_stems 中的 object 格式正规化为 string 数组
    const normalizedPillars = normalizeBaziPanelPillars(panelData._panel_matrix?.pillars || [])
    // 合并引擎数据，重建 HTML（anchor 才会出现在 DOM 里），再触发 Teleport
    const mergedData = {
      ...activeBaziResultData.value,
      ...panelData,
      _panel_matrix: normalizedPillars.length ? { pillars: normalizedPillars } : null
    }
    activeBaziResultData.value = mergedData
    resultHtml.value = applyCardMdBold(buildCardHTML(mergedData))
    await nextTick()
    syncBaziPanelAnchor()
    initMagTabInk()
  } catch (e) {
    console.warn('[panel] fetchMissingPanelData failed', e)
  }
}

// ── v1→v2 读取时适配器（§9.11）── ────────────────────────────────────────
// 幂等：v2 记录（schema_version===2）原样返回；v1 记录映射到 v2 结构
function adaptBaziResultToV2(data) {
  if (!data || data?.meta?.schema_version === 2) return data
  const readings = data.readings || data.mode_analysis || {}
  const summary  = data.summary  || {}
  const ag       = data.action_guide || {}
  const advice   = data.advice   || {}

  // ── summary.basis：旧格式是 {logic, positive_signals, negative_signals} 对象，需提取为字符串 ──
  if (typeof summary.basis === 'object' && summary.basis !== null) {
    // 把老的 logic + positive/negative signals 拼成一段文字
    const parts = [
      summary.basis.logic || '',
      ...(Array.isArray(summary.basis.positive_signals) ? summary.basis.positive_signals.map(s => `+${s}`) : []),
      ...(Array.isArray(summary.basis.negative_signals) ? summary.basis.negative_signals.map(s => `-${s}`) : [])
    ].filter(Boolean)
    summary.basis = parts.join('；')
  } else if (!summary.basis) {
    summary.basis = summary.score_basis?.score_logic || ''
  }

  // ── readings v1→v2 ──
  const r = { ...readings }

  // base_foundation（从 base_state / key_signals 降级）
  if (!r.base_foundation) {
    r.base_foundation = {
      text: data.chart_foundation?.base_state || data.analysis?.pattern || '',
      signals: (data.key_signals || []).slice(0, 3).map(s => s.title || '').filter(Boolean)
    }
  }

  // target_state（从 target_state_reading 包成数组）
  if (!r.target_state && r.target_state_reading) {
    r.target_state = [{ title: '目标用神状态', text: r.target_state_reading }]
  }

  // dayun_field（从 dayun_reading）
  if (!r.dayun_field && r.dayun_reading) {
    r.dayun_field = { text: r.dayun_reading }
  }

  // liunian_trigger（从 liunian_reading）
  if (!r.liunian_trigger && r.liunian_reading) {
    r.liunian_trigger = { text: r.liunian_reading, phenomena: [] }
  }

  // structural_verdict（从 pattern_verdict）
  if (!r.structural_verdict && r.pattern_verdict) {
    r.structural_verdict = r.pattern_verdict
  }

  // trigger_windows: best/worst_window 字符串→对象
  if (typeof r.best_window === 'string' && r.best_window) {
    r.best_window = { year: null, reason: r.best_window }
  }
  if (!r.worst_window && r.avoid_window) {
    r.worst_window = typeof r.avoid_window === 'string'
      ? { year: null, reason: r.avoid_window }
      : r.avoid_window
  }

  // trigger_windows: mechanisms_text → phenomena 单条包装
  if (Array.isArray(r.trigger_windows)) {
    r.trigger_windows = r.trigger_windows.map(w => {
      if (!w.phenomena && w.mechanisms_text) {
        return { ...w, phenomena: [{ tag: '核心机制', explain: w.mechanisms_text }] }
      }
      return w
    })
  }

  // ── action_guide v1→v2 ──
  if (!ag.text && !Array.isArray(ag.items)) {
    const doList    = Array.isArray(ag.do)    ? ag.do    : (Array.isArray(advice.strategy) ? advice.strategy : [])
    const avoidList = Array.isArray(ag.avoid) ? ag.avoid : (Array.isArray(advice.avoid)   ? advice.avoid   : [])
    ag.text  = ag.hidden_insight || advice.risk || ''
    ag.items = [
      ...doList,
      ...avoidList.map(a => `避：${a}`)
    ].filter(Boolean)
  }

  return {
    ...data,
    summary,
    readings: r,
    action_guide: ag,
    meta: { ...(data.meta || {}), schema_version: 2 }
  }
}

// engine_complete 的 engineOutput（camelCase 引擎字段）→ activateBaziResultPanel 所需结构，
// 让命局解读面板在 LLM 流式之前就先行挂载（引擎产物先上屏）。
const baziEngineToPanelData = (eo = {}) => ({
  branch: 'bazi',
  meta: { analysis_mode: eo.analysis_mode || 'status', category: eo.category || '', subcategory: eo.subcategory || '' },
  state_report: eo.stateReport ?? null,
  target_spec: eo.targetSpec ?? null,
  dynamic_report: eo.dynamicReport ?? null,
  timing_candidates: eo.timingCandidates ?? [],
  subject_snapshot: eo.subject_snapshot ?? null,
  five_shens: eo.five_shens ?? null,
  favorable_element: eo.favorable_element || '',
  question: eo.question || '',
  summary: {}, readings: {}, action_guide: {},
})

const activateBaziResultPanel = (data) => {
  showBaziBackingAnchor.value = false
  showBaziPanelAnchor.value = false
  _baziPanelFiveShensFetched.value = null
  if (!(data?.branch === 'bazi' && data.meta?.analysis_mode)) {
    activeBaziResultData.value = null
    baziCardSelectedYear.value = null
    return
  }
  // 存量 v1 记录在进渲染前统一映射到 v2 结构（幂等）
  data = adaptBaziResultToV2(data)
  activeBaziResultData.value = data
  currentResultData.value = data   // 供八字追问回传 + 增补烘焙重渲染
  if (data.meta.analysis_mode === 'timing') {
    const windows = data.readings?.trigger_windows || data.mode_analysis?.trigger_windows || []
    const best = windows.find(window => window.quality === 'strong') || windows[0]
    baziCardSelectedYear.value = Number(best?.year) || activeBaziProfile.value?.bazi_detail?.matrix?.current_liunian?.year || null
  } else {
    baziCardSelectedYear.value = activeBaziProfile.value?.bazi_detail?.matrix?.current_liunian?.year || null
  }
  syncBaziBackingAnchor()
  syncBaziPanelAnchor()
  // 存量记录无 state_report → 按需补算并顺带补四柱；已有 state_report 但缺矩阵时再单独补全
  if (!data.state_report) fetchMissingPanelData(data)
  else if (!baziPanelMatrix.value) fetchMissingPanelMatrix()
  // 存量记录无 five_shens → 补查 profile bazi_detail
  if (!data.five_shens) fetchMissingFiveShens()
}

// ── 追问：从终态 data 抽取 flat 段（对齐后端 sentinel 段名）──
const extractQimenSections = (data) => {
  const r = data.qimen_report || {}
  const m3 = r.m3_inference || {}
  const raw = {
    conclusion: r.m1_conclusion?.conclusion || data.summary?.conclusion || '',
    subject_reading: m3.subject_state?.reading || '',
    target_reading: m3.target_state?.reading || '',
    environment_reading: m3.environment_state?.reading || '',
    support_summary: m3.support_factors?.summary || '',
    constraint_summary: m3.constraint_factors?.summary || '',
    decision_reading: m3.interaction_decision?.reading || '',
  }
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && String(v).trim()))
}

const buildFollowupOrigin = (data) => {
  const r = data.qimen_report || {}
  // 证据走自然语言叙述化（后端 buildQimenEvidenceNarrative）：盘面用 qimen_data.palaces、
  // 用神/格局用 m2_basis；m3 各 reading 已由 sections 承载，不再回传；m2_basis 里重复的
  // chart_summary.palaces 也剥掉，避免无用 payload。
  const m2 = r.m2_basis ? { ...r.m2_basis } : null
  if (m2 && m2.chart_summary) {
    const { palaces, ...restSummary } = m2.chart_summary
    m2.chart_summary = restSummary
  }
  return {
    question: data.question || '',
    record_id: activeResultRecord.value?.id || null,   // 关联 audit / 记录行
    route: data.route || data.meta || { branch: 'qimen', category: data.category, subcategory: data.subcategory },
    evidence: {
      qimen_data: data.qimen_data || null,
      m2_basis: m2,
      timing: data.timing || data.timing_final || null,
    },
    sections: extractQimenSections(data),
    score: data.summary?.score ?? null,
    seed: data.cast_seed || null,   // Phase 2 真重算用
  }
}

// 八字原各段（按 BAZI_TEXT_FIELDS 的散文字段抽取，对齐后端 buildBaziFollowupPrompt 的 section key）
const extractBaziSections = (data) => {
  const r = data.readings || data.mode_analysis || {}
  const raw = {
    summary_conclusion: data.summary?.conclusion || data.verdict || '',
    summary_basis: typeof data.summary?.basis === 'string' ? data.summary.basis : (data.summary?.basis?.logic || ''),
    base_foundation: r.base_foundation?.text || '',
    dayun_field: r.dayun_field?.text || r.dayun_reading || '',
    liunian_trigger: r.liunian_trigger?.text || r.liunian_reading || '',
    structural_verdict: r.structural_verdict || r.pattern_verdict || '',
    appearance_tendency: r.appearance_tendency?.text || '',
    personality_tendency: r.personality_tendency?.text || '',
    career_style: r.career_style?.text || '',
    relationship_dynamic: typeof r.relationship_dynamic === 'string' ? r.relationship_dynamic : (r.relationship_dynamic?.text || ''),
    action_guide: data.action_guide?.text || '',
  }
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && String(v).trim()))
}

// 八字追问 origin（seed=profileId；证据由后端用首轮同一函数复现，前端只回传 route/sections）
const buildBaziOrigin = (data) => {
  const profileId = data.subject_snapshot?.profile_id || activeBaziProfile.value?.id || ''
  return {
    question: data.question || '',
    record_id: activeResultRecord.value?.id || null,
    profileId,
    route: data.route || data.meta || { branch: 'bazi', analysis_mode: data.meta?.analysis_mode || 'status', category: data.meta?.category, subcategory: data.meta?.subcategory, time_scope: data.meta?.time_scope },
    sections: extractBaziSections(data),
    followups: Array.isArray(data.followups) ? data.followups : [],
  }
}

// 流式增补：在目标段对应卡片模块下确保有一个 live 增补块，返回其 body 元素
const ensureLiveFollowupSlot = (section, q, nature, branch = 'qimen') => {
  const moduleKey = followupModuleMap(branch)[section]
  if (!moduleKey) return null
  const root = document.querySelector('.html-container .mag-result') || document.querySelector('.html-container')
  const sectionEl = root?.querySelector(followupModuleAnchorSelector(branch, moduleKey))
  if (!sectionEl) return null
  let list = sectionEl.querySelector('.mag-followup-list.is-live')
  if (!list) {
    list = document.createElement('div')
    list.className = 'mag-followup-list is-live'
    sectionEl.appendChild(list)
  }
  let block = list.querySelector(`[data-fblock="${section}"]`)
  if (!block) {
    block = document.createElement('div')
    block.setAttribute('data-fblock', section)
    block.innerHTML = renderFollowupBlockHTML({ q, section, nature, streaming: true })
    list.appendChild(block)
    // 弹出块首次出现时滚动到视野中央
    const card = block.querySelector('.mag-followup')
    requestAnimationFrame(() => (card || block).scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  return block.querySelector(`[data-fslot="${section}"]`)
}

const readFollowupSSE = async (response, q, branch = 'qimen') => {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const accum = {}
  const supplements = {}
  let nature = 'deepen'
  let scope = 'same_casting'
  let reason = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      let ev
      try { ev = JSON.parse(line.slice(6)) } catch { continue }
      if (ev.type === 'followup_route' && ev.scope === 'new_matter') {
        scope = 'new_matter'; reason = ev.reason || ''
      } else if (ev.type === 'followup_recompute_pending') {
        // 八字 step2：需逐年/换靶补算，step4 才接入；先温和提示
        scope = 'recompute_pending'; reason = ev.reason || ''
      } else if (ev.type === 'followup_step' && (ev.stage === 'patch' || ev.stage === 'decide')) {
        nature = ev.nature || nature
      } else if (ev.type === 'patch_delta') {
        accum[ev.section] = (accum[ev.section] || '') + ev.text
        const el = ensureLiveFollowupSlot(ev.section, q, nature, branch)
        if (el) { el.classList.add('wstream-active'); el.innerHTML = renderStreamProse(accum[ev.section]) }
      } else if (ev.type === 'patch_complete') {
        Object.assign(supplements, ev.supplements || {})
        nature = ev.nature || nature
      } else if (ev.type === 'error') {
        throw new Error(ev.message || '追问失败')
      }
    }
  }
  if (!Object.keys(supplements).length) Object.assign(supplements, accum)
  return { scope, reason, nature, supplements }
}

// 追问落库：把更新过的 qimen_data（含 followups）回写该记录行。
// 追问挂在 qimen_data 内，历史读回时 buildCardHTML 自然渲染；访客/无 id 不落库。
const persistFollowupsToDb = async () => {
  const rec = activeResultRecord.value
  const data = currentResultData.value
  if (!data || !rec || !currentUser.value) return
  if (!rec.id || rec.id === 'guest_qimen_record') return
  try {
    const { error } = await supabase.from('qimen_records').update({ qimen_data: data }).eq('id', rec.id)
    if (error) console.warn('[followup] persist failed:', error.message)
  } catch (e) {
    console.warn('[followup] persist failed:', e?.message)
  }
}

const submitFollowup = async () => {
  const q = followupInput.value.trim()
  if (!q || followupSubmitting.value || !currentResultData.value) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return alert('请先登录')
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }

  followupSubmitting.value = true
  followupNewMatter.value = null
  try {
    const branch = followupBranch.value
    const isBazi = branch === 'bazi'
    const origin = isBazi ? buildBaziOrigin(currentResultData.value) : buildFollowupOrigin(currentResultData.value)
    const response = await fetch(isBazi ? BAZI_FOLLOWUP_API_URL : FOLLOWUP_API_URL, {
      method: 'POST', headers,
      body: JSON.stringify({ followup: q, branch, origin }),
    })
    if (!response.ok) {
      const e = await response.json().catch(() => ({}))
      throw new Error(e.details || e.error || '追问失败')
    }
    const outcome = await readFollowupSSE(response, q, branch)
    if (outcome.scope === 'new_matter') {
      followupNewMatter.value = { reason: outcome.reason || '', question: q }
      return
    }
    if (outcome.scope === 'recompute_pending') {
      showToast('这个追问需要逐年／换靶补算，该能力即将上线')
      return
    }
    if (outcome.supplements && Object.keys(outcome.supplements).length) {
      const d = currentResultData.value
      if (!Array.isArray(d.followups)) d.followups = []
      d.followups.push({ q, nature: outcome.nature || 'deepen', supplements: outcome.supplements, ts: Date.now() })
      resultHtml.value = applyCardMdBold(buildCardHTML(d))
      await nextTick()
      initMagTabInk()
      // 八字卡重建后，Teleport 锚点（命局四柱 panel / backing）会指向被销毁的旧节点 → 强制 remount
      if (branch === 'bazi') {
        showBaziPanelAnchor.value = false
        showBaziBackingAnchor.value = false
        await nextTick()
        syncBaziBackingAnchor()
        syncBaziPanelAnchor()
      }
      document.querySelectorAll('.html-container .reveal').forEach(el => el.classList.add('visible'))
      followupInput.value = ''
      nextTick(autoGrowFollowup)   // 清空后收回输入框高度
      persistFollowupsToDb()       // 落库（追问随 qimen_data 持久化，刷新可见）
    } else {
      showToast('追问没有返回内容，请换个问法重试')
    }
  } catch (err) {
    showToast(err.message || '追问失败，请稍后重试')
  } finally {
    followupSubmitting.value = false
  }
}

const confirmRecastFromFollowup = () => {
  const q = followupNewMatter.value?.question || followupInput.value.trim()
  followupNewMatter.value = null
  followupInput.value = ''
  if (!q) return
  questionInput.value = q
  startDivination()
}

const startDivination = async () => {
  const input = questionInput.value.trim()
  if (!input) return alert("问题不能为空！")
  activeBaziResultData.value = null
  baziCardSelectedYear.value = null
  showBaziBackingAnchor.value = false
  showBaziPanelAnchor.value = false

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return alert("请先登录")

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
  let routeData = null

  isSubmitting.value = true
  resetSseState()
  // 提交后立即进入结果页（持久能量球覆盖层 + 透明 hero 脚手架），不再经过中间的半屏加载页
  wenShiStreaming.value = true
  resultPhase.value = 'stream'
  wenShiStatus.value = '正在解析问题'
  showOrbFx.value = true
  orbSettling.value = false
  orbTone.value = ''
  resultHtml.value = buildStreamingScaffoldHTML(null, wenShiStatus.value)
  viewState.value = 'result'
  nextTick(() => initMagTabInk())

  try {
    const routeResponse = await fetch(ROUTE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: input,
        hasBaziProfile: Boolean(selectedProfileId.value || baziProfiles.value.length),
        hasPanTime: Boolean(panTime.value)
      })
    })
    routeData = await routeResponse.json()
    if (!routeResponse.ok || routeData.error) {
      const err = new Error(routeData.details || routeData.error || '分类失败')
      err.httpStatus = routeResponse.status
      throw err
    }

    if (routeData.branch === 'clarify') {
      alert(routeData.followupQuestion || '请补充你想看长期趋势，还是判断眼前某一件具体事情。')
      viewState.value = 'input'
      return
    }

    // Mark step 0 done with routing result
    sseBranch.value = routeData.branch === 'bazi' ? 'bazi' : 'qimen'
    sseChips.value = { 0: { main: CATEGORY_LABEL_MAP[routeData.category] || '综合运势', sub: routeData.branch === 'bazi' ? '八字命理' : routeData.branch === 'hybrid' ? '综合推演' : '奇门遁甲' } }
    sseActiveIndex.value = 1
    ssePct.value = 10

    if (routeData.branch === 'bazi') {
      if (!baziProfiles.value.length) await fetchBaziProfiles()
      const profileId = selectedProfileId.value || baziProfiles.value.find(p => p.is_default)?.id || baziProfiles.value[0]?.id || ''
      if (!profileId) {
        showOrbFx.value = false; wenShiStreaming.value = false; viewState.value = 'input'
        alert('这个问题需要八字档案才能分析，请先进入八字页建立命主资料。')
        router.push({ name: 'bazi', query: { question: input } })
        return
      }
      selectedProfileId.value = profileId
      // 切到八字能量球脚手架（喜用神五行色在 engine_complete 设）
      resultPhase.value = 'stream'
      resultHtml.value = buildStreamingScaffoldHTML({ branch: 'bazi' }, wenShiStatus.value)
      viewState.value = 'result'
      await nextTick(); initMagTabInk()

      const response = await fetch(BAZI_QUESTION_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: input, profileId, route: routeData })
      })
      if (!response.ok) {
        const errData = await response.json()
        if (errData.code === 'BAZI_PROFILE_INCOMPLETE') {
          showOrbFx.value = false; wenShiStreaming.value = false; viewState.value = 'input'
          alert('该档案还没有完整排盘数据，请先进入八字页完成命盘推演。')
          router.push({ name: 'bazi', query: { profileId, question: input } })
          return
        }
        const err = new Error(errData.details || errData.error || '八字问答失败')
        err.httpStatus = response.status
        throw err
      }
      const data = await readSSEStream(response)
      // 能量球收敛（五行色已设）→ 终态卡片作覆盖层无缝切换
      if (wenShiStreaming.value) await settleOrbToResult(data)
      wenShiStreaming.value = false
      const savedRecord = await saveRecordToDatabase(input, data)
      activeResultRecord.value = savedRecord
      const finalCard = applyCardMdBold(buildCardHTML(data))
      finalOverlayHtml.value = finalCard
      await nextTick()
      initMagTabInk()
      setTimeout(() => document.querySelectorAll('.result-overlay .reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 300)
      await new Promise(r => setTimeout(r, 700))
      resultHtml.value = finalCard
      await nextTick()
      // 终态卡片成为底层后再用完整数据重挂面板（teleport 重解析到终态锚点）
      activateBaziResultPanel(data)
      document.querySelectorAll('.html-container .reveal').forEach(el => el.classList.add('visible'))
      initMagTabInk()
      finalOverlayHtml.value = ''
      showOrbFx.value = false
      viewState.value = 'result'
      return
    }

    if (routeData.branch === 'hybrid' && !currentBaziString.value) {
      routeData = { ...routeData, branch: 'qimen', reason: `${routeData.reason || ''}；当前未选择完整八字档案，自动仅用奇门。` }
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: input,
        route: routeData,
        baziInfo: (routeData.branch === 'qimen') ? null : (currentBaziString.value || null),
        panTime: panTime.value || null
      })
    })
    if (!response.ok) {
      const errData = await response.json()
      const err = new Error(errData.details || errData.error || '推演失败')
      err.httpStatus = response.status
      throw err
    }
    const data = await readSSEStream(response)
    const fromScore = wenShiEngineResult.value?.pre_score || 0
    // 奇门：能量球收敛——变分数色 + 扩散成最终渐变，再切最终卡片
    if (wenShiStreaming.value) await settleOrbToResult(data)
    wenShiStreaming.value = false
    const savedRecord = await saveRecordToDatabase(input, data)
    activeResultRecord.value = savedRecord
    currentResultData.value = data   // 供追问回传 + 增补烘焙重渲染
    activateBaziResultPanel(data)
    // 终态卡片用自带渐变 hero（球已放大化开成渐变，由卡片渐变无缝接管）
    const finalCard = applyCardMdBold(buildCardHTML(data))
    finalOverlayHtml.value = finalCard
    await nextTick()
    initMagTabInk()
    animateScore(data.summary?.score || 0, fromScore)
    setTimeout(() => document.querySelectorAll('.result-overlay .reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 300)
    await new Promise(r => setTimeout(r, 700))
    // 先把底层换成终态并点亮 reveal，再撤掉覆盖层与能量球层，避免任何一帧空白
    resultHtml.value = finalCard
    await nextTick()
    document.querySelectorAll('.html-container .reveal').forEach(el => el.classList.add('visible'))
    initMagTabInk()
    finalOverlayHtml.value = ''
    showOrbFx.value = false
    viewState.value = 'result'
  } catch (err) {
    if (err.httpStatus === 403) {
      showToast(err.message || '今日额度已用尽，请明日再来')
    } else {
      showToast('推演失败，请稍后重试')
    }
    viewState.value = 'input'
  } finally {
    isSubmitting.value = false
  }
}

const animateScore = (targetScore, fromScore = 0) => {
  if(scoreTimer) clearInterval(scoreTimer)
  let current = fromScore || 0
  const step = Math.max(Math.abs(targetScore - current) / 40, 0.5)
  scoreTimer = setInterval(() => {
    if (current < targetScore) current = Math.min(current + step, targetScore)
    else if (current > targetScore) current = Math.max(current - step, targetScore)
    const el = document.getElementById('vueScoreValue')
    if (el) el.textContent = String(Math.round(current))
    if (current === targetScore) clearInterval(scoreTimer)
  }, 16)
}

const normalizeHistoryRows = (rows = []) => rows.map(r => ({
    ...r,
    dateStr: new Date(r.created_at).toLocaleDateString(),
    score: Number(r.score) || 0,
    catLabel: categories.find(c => c.value === r.category)?.label || '杂事'
  }))

const resetHistoryState = () => {
  historyRecords.value = []
  historyLoading.value = false
  historyLoaded.value = false
  historyHasMore.value = true
  historyPage.value = 0
}

const loadHistoryPage = async ({ reset = false } = {}) => {
  if (historyLoading.value) return
  if (isGuest.value && !currentUser.value) {
    historyLoaded.value = true
    historyHasMore.value = false
    return
  }
  if (!reset && (!historyHasMore.value || (!currentUser.value && !isGuest.value))) return
  historyLoading.value = true
  try {
    if (reset) {
      historyRecords.value = []
      historyPage.value = 0
      historyHasMore.value = true
      historyLoaded.value = false
    }

    const from = historyPage.value * HISTORY_PAGE_SIZE
    const to = from + HISTORY_PAGE_SIZE - 1
    let query = supabase
      .from('qimen_records')
      .select(QIMEN_HISTORY_LIST_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (activeCategory.value !== 'all') query = query.eq('category', activeCategory.value)

    const { data } = await query
    const records = normalizeHistoryRows(data || [])

    let feedbackRows = []
    if (currentUser.value && records.length) {
      const { data: feedbackData, error } = await supabase
        .from('qimen_feedback')
        .select('record_id, accuracy_status, actual_direction, note, updated_at')
        .eq('user_id', currentUser.value.id)
        .in('record_id', records.map(record => record.id))

      if (error && error.code !== '42P01') {
        console.warn('加载奇门反馈失败:', error.message)
      }
      feedbackRows = error ? [] : (feedbackData || [])
    }

    const merged = mergeQimenFeedbackIntoRecords(records, feedbackRows, currentUser.value)
    historyRecords.value = reset ? merged : [...historyRecords.value, ...merged]
    historyPage.value += 1
    historyHasMore.value = records.length === HISTORY_PAGE_SIZE
    historyLoaded.value = true
    if (activeResultRecord.value?.id) {
      activeResultRecord.value = historyRecords.value.find(record => record.id === activeResultRecord.value.id) || activeResultRecord.value
    }
  } finally {
    historyLoading.value = false
  }
}

const ensureHistoryLoaded = () => {
  if (!historyLoaded.value) loadHistoryPage({ reset: true })
}

const loadHistory = async () => {
  if (!currentUser.value) {
    historyRecords.value = []
    historyLoaded.value = true
    return
  }
  await loadHistoryPage({ reset: true })
}

const handleHistoryScroll = (event) => {
  const el = event?.target
  if (!el || historyLoading.value || !historyHasMore.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 96) loadHistoryPage()
}

const saveRecordToDatabase = async (question, data) => {
  if (isGuest.value && !currentUser.value) {
    const guestRecord = {
      id: 'guest_qimen_record',
      question,
      qimen_data: data,
      category: data.category || 'general',
      dateStr: new Date().toLocaleDateString(),
      score: data.summary?.score || 0,
      catLabel: categories.find(c => c.value === data.category)?.label || '杂事',
      canFeedback: false,
      hasFeedback: false,
      feedback: null
    }
    historyRecords.value = [guestRecord]
    return guestRecord
  }
  const { data: insertedRows, error } = await supabase
    .from('qimen_records')
    .insert([{ user_id: currentUser.value.id, question, qimen_data: data, category: data.category || 'general' }])
    .select('id, created_at, user_id, question, category')

  if (error) throw error
  const inserted = insertedRows?.[0]
  const savedRecord = inserted ? {
    ...inserted,
    qimen_data: data,
    dateStr: new Date(inserted.created_at).toLocaleDateString(),
    score: data.summary?.score || 0,
    branch: data.branch || 'qimen',
    conclusion: data.summary?.conclusion || '',
    catLabel: categories.find(c => c.value === (data.category || 'general'))?.label || '杂事',
    canFeedback: Boolean(currentUser.value?.id),
    hasFeedback: false,
    feedback: null
  } : null
  if (savedRecord && historyLoaded.value && (activeCategory.value === 'all' || activeCategory.value === savedRecord.category)) {
    historyRecords.value = [savedRecord, ...historyRecords.value]
  }
  return savedRecord
}

const filteredHistory = computed(() => activeCategory.value === 'all' ? historyRecords.value : historyRecords.value.filter(r => r.category === activeCategory.value))

const loadRecord = async (item) => {
  globalState.isDrawerOpen = false
  // 列表只带轻字段，点开时再按 id 拉完整盘，并挂回 item 以便复用。
  if (!item.qimen_data && item.id && item.id !== 'guest_qimen_record') {
    const { data } = await supabase.from('qimen_records').select('qimen_data').eq('id', item.id).single()
    if (data?.qimen_data) item.qimen_data = data.qimen_data
  }
  // 历史记录开放续问：奇门与八字均支持（续问落库 + audit 到这条历史行）。
  followupInput.value = ''
  followupNewMatter.value = null
  const isBaziRec = item.qimen_data && item.qimen_data.branch === 'bazi'
  sseBranch.value = isBaziRec ? 'bazi' : 'qimen'
  // 奇门：currentResultData 即 qimen_data；八字：由 activateBaziResultPanel 设（adaptV2 后）
  currentResultData.value = isBaziRec ? null : (item.qimen_data || null)
  activeResultRecord.value = item
  resultHtml.value = applyCardMdBold(buildCardHTML(item.qimen_data))
  activateBaziResultPanel(item.qimen_data)
  viewState.value = 'result'
  nextTick(() => {
    initMagTabInk()
    animateScore(item.qimen_data?.summary?.score || item.score || 0)
    setTimeout(() => document.querySelectorAll('.reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 200)
  })
}

const applyFeedbackForm = (feedback) => {
  const source = feedback || buildDefaultFeedbackForm()
  feedbackForm.accuracy_status = source.accuracy_status || 'pending'
  feedbackForm.actual_direction = source.actual_direction || 'pending'
  feedbackForm.note = source.note || ''
}

const openFeedbackDrawer = (item) => {
  if (!item?.canFeedback) return
  feedbackTargetRecord.value = item
  applyFeedbackForm(item.feedback)
  isFeedbackDrawerOpen.value = true
}

const closeFeedbackDrawer = () => {
  isFeedbackDrawerOpen.value = false
}

const submitQimenFeedback = async () => {
  if (!feedbackTargetRecord.value || !currentUser.value || feedbackSaving.value) return

  feedbackSaving.value = true
  try {
    const normalized = normalizeQimenFeedbackForm(feedbackForm)
    const { error } = await supabase
      .from('qimen_feedback')
      .upsert({
        record_id: feedbackTargetRecord.value.id,
        user_id: currentUser.value.id,
        accuracy_status: normalized.accuracy_status,
        actual_direction: normalized.actual_direction,
        note: normalized.note || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'record_id,user_id'
      })

    if (error) throw error
    await loadHistory()
    closeFeedbackDrawer()
    alert('反馈已保存')
  } catch (error) {
    alert('反馈保存失败: ' + error.message)
  } finally {
    feedbackSaving.value = false
  }
}

const getVerdictInfo = (score) => {
  if (score >= 90) return { label: '大吉', cls: 'da-ji' }
  if (score >= 75) return { label: '小吉', cls: 'xiao-ji' }
  if (score >= 55) return { label: '平', cls: 'ping' }
  return { label: '凶', cls: 'da-xiong' }
}

const getVerdictCls = (score) => score >= 75 ? 'ji' : score >= 55 ? 'ping' : 'xiong'

const isBaziRecord = (item) => item?.qimen_data?.branch === 'bazi' || item?.branch === 'bazi'

const baziAssessmentLabel = (type) => ({
  current_climate: '当前阶段气候',
  timing_effectiveness: '候选时间窗',
  innate_capacity: '先天结构适配',
  portrait_confidence: '人物倾向画像',
  unsupported: '边界说明'
}[type] || '八字分析')

const baziLevelLabel = (level) => ({
  strong: '强',
  medium: '中',
  weak: '弱',
  mixed: '参半',
  unknown: '未知'
}[level] || level || '未知')

const baziAnalysisModeLabel = (mode) => ({
  status: '当前状态',
  timing: '应期扫描',
  pattern: '先天结构',
  character: '人物画像',
  unsupported: '边界说明'
}[mode] || '八字分析')

const baziFallbackLevelLabel = (level) => ({
  subcategory: '精确领域',
  category: '领域规则',
  general: '通用规则',
  llm_derived: '象义推断',
  none: '无规则'
}[level] || '')

const buildTextListHTML = (items = [], cls = '') => {
  if (!Array.isArray(items) || !items.length) return ''
  return `<div class="${cls}">${items.map(item => `<span>${typeof item === 'string' ? item : (item.label || item.detail || JSON.stringify(item))}</span>`).join('')}</div>`
}

const concreteTargetLabel = (data) => {
  const target = data?.meta?.target || {}
  const toList = (value) => Array.isArray(value) ? value.filter(Boolean) : []
  const labels = [
    ...toList(target.shishen),
    ...toList(data?.chart_foundation?.core_stars),
    ...toList(target.gongwei),
    ...toList(data?.chart_foundation?.core_palaces)
  ]
  return [...new Set(labels)].slice(0, 4).join('、') || '本问题核心象'
}

const sanitizeBaziDisplayText = (value, targetLabel = '本问题核心象') => {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'string' ? value : (value.label || value.detail || JSON.stringify(value))
  ;[
    /大运定位为\s*estimated[，,、\s]*(置信度需下调)?/gi,
    /大运[^。；;]*estimated[^。；;]*(?:[。；;]|$)/gi,
    /置信度需下调/gi,
    /estimated/gi,
    /fallback_current|fallback_level/gi,
    /trigger_vigor|activation_strength|activates_target|is_major_window|vigor_check/gi
  ].forEach(pattern => { text = text.replace(pattern, '') })
  return text
    .replace(/目标十神/g, targetLabel)
    .replace(/目标元素/g, targetLabel)
    .replace(/置信边界/g, '参考说明')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[，,；;\s]+|[，,；;\s]+$/g, '')
    .trim()
}

const splitBaziFoundationSignal = (signal) => {
  // v2：{title, detail} 对象格式（与 target_state 对齐）
  if (signal && typeof signal === 'object') {
    return {
      label: String(signal.title || signal.label || '').trim(),
      detail: String(signal.detail || signal.text || '').trim()
    }
  }
  // v1 兼容：「标题：说明」冒号串，或仅标题
  const text = String(signal || '').trim()
  const separatorIndex = text.search(/[：:]/)
  if (separatorIndex < 0) return { label: text, detail: '' }
  return {
    label: text.slice(0, separatorIndex).trim(),
    detail: text.slice(separatorIndex + 1).trim()
  }
}

const buildBaziTextListHTML = (items = [], cls = '', targetLabel = '本问题核心象') => {
  if (!Array.isArray(items) || !items.length) return ''
  const labels = items.map(item => sanitizeBaziDisplayText(item, targetLabel)).filter(Boolean)
  if (!labels.length) return ''
  return `<div class="${cls}">${labels.map(item => `<span>${item}</span>`).join('')}</div>`
}

const buildBaziFoundationGroupHTML = (label, items = [], cls = '', targetLabel = '本问题核心象') => {
  const listHTML = buildBaziTextListHTML(items, cls, targetLabel)
  if (!listHTML) return ''
  return `<div class="bazi-foundation-group">
    <div class="foundation-group-label">${label}</div>
    ${listHTML}
  </div>`
}

const buildBaziAdviceRowsHTML = (rows = [], targetLabel = '本问题核心象') => {
  const normalized = rows
    .map(row => ({
      label: row.label,
      value: Array.isArray(row.value)
        ? row.value.map(item => sanitizeBaziDisplayText(item, targetLabel)).filter(Boolean).join('；')
        : sanitizeBaziDisplayText(row.value || '', targetLabel),
      tone: row.tone || 'neutral'
    }))
    .filter(row => row.value)
  if (!normalized.length) return ''
  return `<div class="bazi-advice-rows">
    ${normalized.map(row => `<div class="bazi-advice-row tone-${row.tone}">
      <span class="advice-row-label">${row.label}</span>
      <span class="advice-row-text">${row.value}</span>
    </div>`).join('')}
  </div>`
}

const buildPortraitBlockHTML = (block, label, targetLabel = '本问题核心象') => {
  if (!block?.text) return ''
  const confidence = block.confidence || 'low'
  return `<div class="bazi-portrait-block confidence-${confidence}">
    <div class="portrait-label">${label}<span class="confidence-badge">${baziLevelLabel(confidence)}</span></div>
    <p>${sanitizeBaziDisplayText(block.text, targetLabel)}</p>
    ${buildBaziTextListHTML(block.evidence || [], 'bazi-evidence-list', targetLabel)}
  </div>`
}

const buildBaziAdviceExtrasHTML = (advice = {}, targetLabel = '本问题核心象') => {
  const rowsHTML = buildBaziAdviceRowsHTML([
    { label: '风险提醒', value: advice.risk, tone: 'warning' },
    { label: '需要避开', value: advice.avoid || [], tone: 'warning' },
    { label: '建议节奏', value: advice.timing || [], tone: 'neutral' },
    { label: '借势方法', value: advice.leverage, tone: 'positive' }
  ], targetLabel)
  return rowsHTML ? `<div class="bazi-advice-extra">${rowsHTML}</div>` : ''
}

const buildBaziQuestionCardHTML = (data) => {
  const meta = data.meta || {}
  const readings = data.readings || data.mode_analysis || {}
  const verdict = data.verdict || data.summary?.conclusion || ''
  const actionGuide = data.action_guide || {}
  const rhythm = data.rhythm || {}
  const summary = data.summary || {}
  const question = data.question || ''
  const targetLabel = concreteTargetLabel(data)

  // 八字无分数：hero 定格色 = 喜用神五行色（与加载态能量球同色，溶解交接无色差）
  const _favEl = data.favorable_element || wenShiEngineResult.value?.favorable_element || ''
  const _et = baziElementTone(_favEl)
  const heroTone = _et.tone          // wood / fire / earth / metal / water
  const THEME    = _et.THEME
  const THEME_DIM= _et.DIM

  const tabClick = (id) => `var nav=this.closest('.mag-tabs');var tabs=nav.querySelectorAll('.mag-tab');tabs.forEach(function(t){t.classList.remove('mag-tab-active')});this.classList.add('mag-tab-active');var ink=nav.querySelector('.mag-tab-ink');if(ink){ink.style.transform='translateX('+this.offsetLeft+'px)';ink.style.width=this.offsetWidth+'px';}document.getElementById('${id}').scrollIntoView({behavior:'smooth',block:'start'})`

  // ── Hero：短标题 + verdict ──
  const heroTitle = summary.title || '八字推演'
  const heroKeyword = summary.keyword || ''

  // ── Section 1: 结论先行（v2: +summary.basis 底盘交代） ──
  // 防御：老记录 summary.basis 可能是对象（adaptBaziResultToV2 应已处理，这里兜底）
  const basisText = typeof summary.basis === 'string' ? summary.basis : (summary.basis?.logic || '')
  const m1HTML = `<section class="mag-section" id="bazi-m1">
    <div class="module-heading"><h2>结论先行</h2></div>
    ${question ? `<blockquote class="mag-question">"${question}"</blockquote>` : ''}
    ${basisText ? `<p class="bazi-basis-text">${sanitizeBaziDisplayText(basisText, targetLabel)}</p>` : ''}
  </section>`

  // ── Section 2: 命局解读（panel → 命局现象 → 用神状态） ──
  const bf = readings.base_foundation || {}
  const bfSignals = Array.isArray(bf.signals) ? bf.signals : []
  const bfPhenomena = bfSignals
    .map(splitBaziFoundationSignal)
    .filter(row => row.label || row.detail)
  const targetStateItems = Array.isArray(readings.target_state) ? readings.target_state : []
  const fallbackTargetState = !targetStateItems.length && readings.target_state_reading
    ? [{ title: '目标用神状态', text: readings.target_state_reading }]
    : []
  const visibleTargetStates = (targetStateItems.length ? targetStateItems : fallbackTargetState).slice(0, 3)

  const foundationPhenomenaHTML = bfPhenomena.length
    ? `<div class="bazi-foundation-block">
        <h3 class="bazi-bf-title">命局现象</h3>
        <div class="bazi-bf-signals">${bfPhenomena.map(row => `<div class="bazi-bf-signal-row">
          <span class="bazi-bf-signal-label">${sanitizeBaziDisplayText(row.label, targetLabel)}</span>
          ${row.detail ? `<span class="bazi-bf-signal-detail">${sanitizeBaziDisplayText(row.detail, targetLabel)}</span>` : ''}
        </div>`).join('')}</div>
      </div>`
    : ''
  const targetStateHTML = visibleTargetStates.length
    ? `<div class="bazi-foundation-block">
        <h3 class="bazi-bf-title">用神状态</h3>
        <div class="bazi-target-state-list">${visibleTargetStates.map(item => `<div class="bazi-target-state-row">
          <h4>${sanitizeBaziDisplayText(item.title || targetLabel, targetLabel)}</h4>
          ${item.text ? `<p>${sanitizeBaziDisplayText(item.text, targetLabel)}</p>` : ''}
        </div>`).join('')}</div>
      </div>`
    : ''
  const m2HTML = `<section class="mag-section" id="bazi-m2">
      <div class="module-heading"><h2>命局解读</h2></div>
      <div id="bazi-panel-anchor" class="bazi-panel-anchor"></div>
      ${foundationPhenomenaHTML}
      ${targetStateHTML}
    </section>`

  // ── Section 3: 深度推演（按 mode 收敛字段归属） ──
  const deepReadingRow = (label, text, tone = '', extra = '', factor = '') => {
    if (!text) return ''
    const cls = tone === 'mirror' ? ' bazi-infer-mirror' : tone === 'positive' ? ' bazi-infer-positive' : tone === 'outcome' ? ' bazi-infer-outcome' : tone === 'muted' ? ' bazi-infer-muted' : ''
    const body = sanitizeBaziDisplayText(text, targetLabel).replace(/\n/g, '<br>')
    return `<article class="inference-card${cls}">
      <div class="inference-body">
        <div class="inference-head"><span>${label}</span>${factor ? `<strong class="inference-factor">${sanitizeBaziDisplayText(factor, targetLabel)}</strong>` : ''}</div>
        <h4>${body}</h4>
        ${extra}
      </div>
    </article>`
  }

  // ── phenomena 行（liunian_trigger.phenomena / timing window phenomena） ──
  const phenomenaHTML = (phenomena) => {
    if (!Array.isArray(phenomena) || !phenomena.length) return ''
    return `<div class="bazi-phenomena-rows">${phenomena.map(ph =>
      `<div class="bazi-ph-row"><span class="bazi-ph-tag">${sanitizeBaziDisplayText(ph.tag || '', targetLabel)}</span><span class="bazi-ph-explain">${sanitizeBaziDisplayText(ph.explain || '', targetLabel)}</span></div>`
    ).join('')}</div>`
  }

  // ── strength 档 → CSS 类（供 timing window 徽章颜色） ──
  const strengthClass = (s) => {
    if (s === '最强' || s === '次强') return 'quality-strong'
    if (s === '较强' || s === '中等') return 'quality-medium'
    return 'quality-weak'
  }

  const inferItems = []

  const mode = meta.analysis_mode || ''
  if (bf.text) inferItems.push({ label: '原局底盘', text: bf.text, tone: '' })

  // ── status / profile_driven: 大运建场 + 流年触发 ──
  const dayunFieldText = readings.dayun_field?.text || readings.dayun_reading || ''
  const liunianTrigger = readings.liunian_trigger || {}
  const liunianText = liunianTrigger.text || readings.liunian_reading || ''
  const liunianPhenomena = Array.isArray(liunianTrigger.phenomena) ? liunianTrigger.phenomena : []

  if (mode !== 'pattern' && mode !== 'character' && mode !== 'timing') {
    // status / profile_driven / legacy
    if (dayunFieldText) inferItems.push({ label: '大运建场', text: dayunFieldText, tone: '', phenomena: [] })
    if (liunianText) {
      inferItems.push({ label: '流年触发', text: liunianText, tone: '', phenomena: liunianPhenomena })
    }
    // path_readings 不再混入扁平列表，改为独立「路径推演」分区（见 pathReadingsHTML）
    // v1 profile_driven
    if (readings.structural_reading) inferItems.push({ label: '结构分析', text: readings.structural_reading, tone: '' })
  }

  // ── pattern: structural_supports/risks/verdict ──
  if (mode === 'pattern') {
    const strVerdict = readings.structural_verdict || readings.pattern_verdict || ''
    if (strVerdict) inferItems.push({ label: '先天格局', text: strVerdict, tone: '' })
    const supports = Array.isArray(readings.structural_supports) ? readings.structural_supports : []
    const risks    = Array.isArray(readings.structural_risks)    ? readings.structural_risks    : []
    if (supports.length) inferItems.push({ label: '结构支撑', text: supports.join('；'), tone: 'positive' })
    if (risks.length)    inferItems.push({ label: '结构风险', text: risks.join('；'),    tone: 'outcome' })
    if (readings.real_world_expression) inferItems.push({ label: '日常表现', text: readings.real_world_expression, tone: '' })
    if (readings.how_to_leverage)       inferItems.push({ label: '发力方向', text: readings.how_to_leverage, tone: 'positive' })
    if (readings.current_status_note)   inferItems.push({ label: '当前时机', text: readings.current_status_note, tone: '' })
  }

  // ── character mode（不变） ──
  if (mode === 'character') {
    if (readings.appearance_tendency?.text)  inferItems.push({ label: '外貌气质', text: readings.appearance_tendency.text, tone: '' })
    if (readings.personality_tendency?.text) inferItems.push({ label: '性格倾向', text: readings.personality_tendency.text, tone: '' })
    if (readings.career_style?.text)         inferItems.push({ label: '行事风格', text: readings.career_style.text, tone: '' })
    if (readings.relationship_dynamic)       inferItems.push({ label: '关系动态', text: readings.relationship_dynamic, tone: '' })
    if (readings.do_not_overclaim)           inferItems.push({ label: '说明', text: readings.do_not_overclaim, tone: 'muted' })
  }

  // ── timing: best/worst_window 概览（v2 对象/v1 字符串均支持） ──
  if (mode === 'timing') {
    if (dayunFieldText) inferItems.push({ label: '大运建场', text: dayunFieldText, tone: '' })
    const bwObj = readings.best_window
    const wwObj = readings.worst_window || (readings.avoid_window ? { reason: readings.avoid_window } : null)
    const metaLine = [
      bwObj ? `最优窗口：${bwObj.year ? `${bwObj.year}年 ` : ''}${bwObj.reason || bwObj}` : '',
      wwObj ? `规避：${wwObj.year ? `${wwObj.year}年 ` : ''}${wwObj.reason || wwObj}` : ''
    ].filter(Boolean).join('　')
    if (metaLine) inferItems.push({ label: '应期概览', text: metaLine, tone: '' })
  }

  const inferFlowHTML = inferItems.length
    ? `<div class="inference-flow bazi-deep-flow">
        ${inferItems.map(item => deepReadingRow(item.label, item.text, item.tone, phenomenaHTML(item.phenomena), item.factor)).filter(Boolean).join('')}
      </div>`
    : ''

  // ── timing windows（v2: strength + phenomena；v1: mechanisms_text） ──
  const windows = Array.isArray(readings.trigger_windows) ? readings.trigger_windows : []
  const timingWindowsHTML = windows.length
    ? `<div class="bazi-timing-flow">
        ${windows.map(item => {
          const strengthLabel = item.strength || baziLevelLabel(item.quality)
          const sCls = item.strength ? strengthClass(item.strength) : `quality-${item.quality || 'weak'}`
          const ph = Array.isArray(item.phenomena) && item.phenomena.length
            ? phenomenaHTML(item.phenomena)
            : (item.mechanisms_text ? `<p class="bazi-mechanisms">${sanitizeBaziDisplayText(item.mechanisms_text, targetLabel)}</p>` : '')
          return `<article class="inference-card">
            <div class="inference-body">
              <div class="inference-head">
                <span>${item.ganzhi ? `${item.year} ${item.ganzhi}` : item.year || '-'}</span>
                <strong class="${sCls}">${strengthLabel}</strong>
              </div>
              <h4>${sanitizeBaziDisplayText(item.verdict || '', targetLabel)}</h4>
              ${ph}
            </div>
          </article>`
        }).join('')}
      </div>`
    : ''

  // ── 路径推演（open_strategy / profile_driven 多路径对比）：与上方逐项解读视觉区分 ──
  const pathReadings = Array.isArray(readings.path_readings) ? readings.path_readings : []
  const PATH_LETTERS = ['A', 'B', 'C', 'D']
  const pathRow = (k, v, cls = '') => v
    ? `<div class="bazi-path-row${cls}"><span class="bazi-path-k">${k}</span><span class="bazi-path-v">${sanitizeBaziDisplayText(v, targetLabel)}</span></div>`
    : ''
  const pathReadingsHTML = pathReadings.length
    ? `<div class="bazi-path-block">
        <h3 class="bazi-path-title">路径推演 · 多路径对比</h3>
        <div class="bazi-path-grid">
          ${pathReadings.map((p, i) => `<article class="bazi-path-card">
            <div class="bazi-path-head">
              <span class="bazi-path-badge">路径 ${PATH_LETTERS[i] || (i + 1)}</span>
              <span class="bazi-path-name">${sanitizeBaziDisplayText(p.path || '路径', targetLabel)}</span>
            </div>
            <div class="bazi-path-rows">
              ${pathRow('契合', p.structural_fit)}
              ${pathRow('近1-3年', p.likely_experience)}
              ${pathRow('满意度', p.satisfaction_prediction)}
              ${pathRow('最顺期', p.peak_period)}
              ${pathRow('风险', p.risk, ' bazi-path-risk')}
            </div>
          </article>`).join('')}
        </div>
      </div>`
    : ''

  const m3HTML = inferFlowHTML || timingWindowsHTML || pathReadingsHTML
    ? `<section class="mag-section" id="bazi-m3">
        <div class="module-heading"><h2>深度推演</h2></div>
        ${inferFlowHTML}
        ${timingWindowsHTML}
        ${pathReadingsHTML}
      </section>`
    : ''

  // ── Section 4: 时间线（guidance-grid 双栏 → 竖排大运段） ──
  const segments = rhythm.segments || []
  const normalizeRhythmText = (value) => sanitizeBaziDisplayText(value || '', targetLabel)
    .replace(/[\s，。；、：:\u201c\u201d"'（）()【】\[\]]/g, '')
  // 去重对比集合：深度推演长文本 + 应期(trigger_windows)逐年 verdict/phenomena，
  // 防止 rhythm 复述应期已给出的逐年判断（prompt 漏网时的前端兜底）
  const triggerWindowTexts = (windows || []).flatMap(w => [
    w.verdict,
    ...((Array.isArray(w.phenomena) ? w.phenomena : []).map(p => p.explain))
  ]).filter(Boolean)
  const deepReadingTexts = [bf.text, dayunFieldText, liunianText, ...triggerWindowTexts]
    .map(normalizeRhythmText)
    .filter(Boolean)
  const isDistinctRhythmText = (value) => {
    const normalized = normalizeRhythmText(value)
    if (!normalized) return false
    return !deepReadingTexts.some(text => text.includes(normalized) || normalized.includes(text))
  }
  const visibleRhythmSegments = segments
    .map(seg => ({
      ...seg,
      phenomenon: isDistinctRhythmText(seg.phenomenon) ? seg.phenomenon : '',
      strategy: isDistinctRhythmText(seg.strategy) ? seg.strategy : '',
      key_liunians: (seg.key_liunians || []).filter(item => isDistinctRhythmText(item.note))
    }))
    .filter(seg => seg.strategy || seg.key_liunians.length)

  const rhythmFlowHTML = visibleRhythmSegments.length
    ? `<div class="inference-flow">
        ${visibleRhythmSegments.map(seg => {
          const liunianLines = (seg.key_liunians || []).map(l =>
            `<div class="bazi-liunian-row"><span class="bazi-liunian-gz">${l.year || ''} ${l.gz || ''}</span>${l.shishen ? `<span class="bazi-liunian-ss">${l.shishen}</span>` : ''}<span class="bazi-liunian-note">${sanitizeBaziDisplayText(l.note || '', targetLabel)}</span></div>`
          ).join('')
          return `<article class="inference-card">
            <div class="inference-body">
              <div class="inference-head">
                <span>${sanitizeBaziDisplayText(seg.period || '', targetLabel)}</span>
                ${seg.dayun_shishen ? `<strong>${seg.dayun_shishen}</strong>` : ''}
              </div>
              ${seg.phenomenon ? `<p class="bazi-rhythm-phenomenon">${sanitizeBaziDisplayText(seg.phenomenon, targetLabel)}</p>` : ''}
              ${seg.strategy ? `<h4>${sanitizeBaziDisplayText(seg.strategy, targetLabel)}</h4>` : ''}
              ${liunianLines ? `<div class="bazi-liunian-block">${liunianLines}</div>` : ''}
            </div>
          </article>`
        }).join('')}
      </div>`
    : ''

  const m4HTML = rhythmFlowHTML
    ? `<section class="mag-section" id="bazi-m4">
        <div class="module-heading"><h2>时间节奏</h2></div>
        ${rhythmFlowHTML}
      </section>`
    : ''

  // ── Section 5: 行动建议（v2: text+items；v1 兼容: do/avoid/hidden_insight） ──
  const agText  = actionGuide.text  || ''
  const agItems = Array.isArray(actionGuide.items) && actionGuide.items.length ? actionGuide.items : []
  const doItems    = actionGuide.do    || data.advice?.strategy || []
  const avoidItems = actionGuide.avoid || data.advice?.avoid    || []
  const hiddenInsight = actionGuide.hidden_insight || ''
  const adviceItems = agItems.length
    ? agItems
    : [...doItems, ...avoidItems]

  const adviceIntroHTML = agText
    ? `<p class="bazi-action-intro">${sanitizeBaziDisplayText(agText, targetLabel)}</p>`
    : ''

  const adviceListHTML = adviceItems.length
    ? `<div class="mag-action-list bazi-action-list">
        ${adviceItems.slice(0, 6).map((item, i) => `<div class="mag-action-item">
          <div class="mag-action-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="mag-action-body">${sanitizeBaziDisplayText(item, targetLabel)}</div>
        </div>`).join('')}
      </div>`
    : ''

  const hiddenHTML = !agText && hiddenInsight
    ? `<article class="inference-card bazi-infer-mirror" style="margin-top:0">
        <div class="inference-body">
          <div class="inference-head"><span>盲点提醒</span></div>
          <h4>${sanitizeBaziDisplayText(hiddenInsight, targetLabel)}</h4>
        </div>
      </article>`
    : ''

  const m5HTML = agText || adviceListHTML || hiddenHTML
    ? `<section class="mag-section" id="bazi-m5">
        <div class="module-heading"><h2>行动建议</h2></div>
        ${adviceIntroHTML}
        ${adviceListHTML}
        ${hiddenHTML}
      </section>`
    : ''

  const tabDefs = [
    { id: 'bazi-m1', label: '结论先行', show: true },
    { id: 'bazi-m2', label: '命局解读', show: true },
    { id: 'bazi-m3', label: '深度推演', show: !!m3HTML },
    { id: 'bazi-m4', label: '时间节奏', show: !!m4HTML },
    { id: 'bazi-m5', label: '行动建议', show: !!m5HTML }
  ].filter(d => d.show)
  const tabsHTML = tabDefs.map((d, i) =>
    `<button class="mag-tab${i === 0 ? ' mag-tab-active' : ''}" onclick="${tabClick(d.id)}">${d.label}</button>`
  ).join('') + '<span class="mag-tab-ink"></span>'

  return `<div class="mag-result tone-${heroTone}" style="--theme-color:${THEME};--theme-color-dim:${THEME_DIM};">
    <section class="mag-hero" id="bazi-hero">
      <div class="mag-hero-panel">
        <div class="mag-hero-tags">
          ${heroKeyword ? `<span>${sanitizeBaziDisplayText(heroKeyword, targetLabel)}</span>` : ''}
        </div>
        <h1>${sanitizeBaziDisplayText(heroTitle, targetLabel)}</h1>
        <p>${sanitizeBaziDisplayText(verdict, targetLabel)}</p>
      </div>
    </section>

    <nav class="mag-tabs">${tabsHTML}</nav>

    ${m1HTML}
    ${m2HTML}
    ${m3HTML}
    ${m4HTML}
    ${m5HTML}
  </div>`
}

const deriveScoreBasisFromM3 = (m3, formations) => {
  const pos = []
  const neg = []
  const textOf = (...values) => values.find(v => typeof v === 'string' && v.trim()) || ''
  const itemText = item => textOf(
    item?.impact && item?.name ? `${item.name}：${item.impact}` : '',
    item?.impact,
    item?.name,
    item?.text
  )
  const itemsOf = state => (Array.isArray(state?.items) && state.items.length)
    ? state.items
    : (Array.isArray(state?.factors) ? state.factors : [])
  const target = m3?.target_state || m3?.target_yongshen_state
  const subject = m3?.subject_state || m3?.subject_day_stem_state || m3?.self_state
  const support = m3?.support_factors || m3?.favorable_factors
  const constraint = m3?.constraint_factors || m3?.constraints
  const interaction = m3?.interaction_decision || m3?.interaction_verdict
  const targetReading = textOf(target?.reading, target?.summary, target?.verdict)
  const subjectReading = textOf(subject?.reading, subject?.summary, subject?.verdict)
  const supportSummary = textOf(support?.summary, support?.primary_support, support?.verdict)
  const constraintSummary = textOf(constraint?.summary, constraint?.primary_risk, constraint?.verdict)
  const interactionDecision = textOf(interaction?.reading, interaction?.decision, interaction?.verdict)
  const interactionReason = textOf(interaction?.reason, interaction?.evidence)

  if (supportSummary) pos.push(supportSummary)
  itemsOf(support).slice(0, 3).forEach(f => {
    const text = itemText(f)
    if (text) pos.push(text)
  })
  if (target?.tone === 'positive' && targetReading) pos.push(targetReading)
  if (interaction?.tone !== 'warning' && interactionDecision) pos.push(interactionDecision)
  if (interaction?.tone !== 'warning' && interactionReason) pos.push(interactionReason)
  if (subject?.tone === 'positive' && subjectReading) pos.push(subjectReading)

  if (constraintSummary) neg.unshift(constraintSummary)
  itemsOf(constraint).slice(0, 3).forEach(f => {
    const text = itemText(f)
    if (text) neg.push(text)
  })
  if (subject?.tone === 'warning' && subjectReading) neg.push(subjectReading)
  if (target?.tone === 'warning' && targetReading) neg.push(targetReading)
  return (pos.length || neg.length) ? {
    positive_signals: pos.slice(0, 3),
    negative_signals: neg.slice(0, 3),
    score_logic: interactionDecision || interactionReason || ''
  } : null
}

// ── 流式脚手架：复用真实卡片的 CSS class，保证与最终 buildCardHTML 视觉一致。 ──
// 排盘表头：暴露完整起局校验字段（局名/节气元/旬首/值符值使及落宫/空亡·马星地支）供核对。
const buildQimenPanInfo = (ju = {}, ts = {}, aux = {}) => {
  const yuanText = [ju.jieqi, ju.yuan].filter(Boolean).join(' ')
  const xunText = ju.xun_shou ? `　旬首：<b>${ju.xun_shou}</b>` : ''
  const zhiFuPalace = ju.zhi_fu_palace ? `（${ju.zhi_fu_palace}）` : ''
  const zhiShiPalace = ju.zhi_shi_palace ? `（${ju.zhi_shi_palace}）` : ''
  const kong = aux.kong_wang || {}
  const ma = aux.ma_xing || {}
  const kongMaText = (kong.day || kong.hour || ma.day || ma.hour)
    ? `<br>空亡：<b>日 ${kong.day || '-'} / 时 ${kong.hour || '-'}</b>　马星：<b>日 ${ma.day || '-'} / 时 ${ma.hour || '-'}</b>`
    : ''
  return `<div class="pan-info">${ts.solar || ''} | ${ju.name || ''} · ${yuanText}${xunText}<br>值符：<b>${ju.zhi_fu || '-'}</b>${zhiFuPalace}&emsp;值使：<b>${ju.zhi_shi || '-'}</b>${zhiShiPalace}${kongMaText}</div>`
}

// engine 为 engine_complete 的 engineOutput（可为 null，表示尚未起盘）。
// 7 个流式散文段以 <span data-wslot="KEY"> 占位，初始为骨架，由 SSE delta 就地打补丁。
const QIMEN_STREAM_SLOTS = {
  conclusion: { lines: 3 },
  subject_reading: { lines: 2 }, target_reading: { lines: 2 }, environment_reading: { lines: 2 },
  support_summary: { lines: 2 }, constraint_summary: { lines: 2 }, decision_reading: { lines: 2 },
}
// 喜用神五行 → 能量球/卡片色档（八字无分数，定格用五行色）
const BAZI_ELEMENT_TONE = {
  '木': { tone: 'wood',  THEME: '#2f9d6e', DIM: 'rgba(47,157,110,0.16)' },
  '火': { tone: 'fire',  THEME: '#c84a45', DIM: 'rgba(200,74,69,0.16)' },
  '土': { tone: 'earth', THEME: '#b58d3b', DIM: 'rgba(181,141,59,0.17)' },
  '金': { tone: 'metal', THEME: '#bda15a', DIM: 'rgba(189,161,90,0.16)' },
  '水': { tone: 'water', THEME: '#3a6ea5', DIM: 'rgba(58,110,165,0.16)' },
}
const baziElementTone = (el) => BAZI_ELEMENT_TONE[String(el || '').charAt(0)] || BAZI_ELEMENT_TONE['土']

// 八字流式脚手架（透明 hero 露出能量球；散文段 data-wslot 对齐后端 section key）
const buildBaziStreamingScaffoldHTML = (engine = null, statusText = '') => {
  const sk = (lines = 2) => `<span class="wsk">${'<i></i>'.repeat(lines)}</span>`
  const slot = (key) => `<span class="wstream-slot" data-wslot="${key}">${sk(2)}</span>`
  const et = baziElementTone(engine?.favorable_element)
  const question = engine?.question || ''
  const tabClick = (id) => `var nav=this.closest('.mag-tabs');var tabs=nav.querySelectorAll('.mag-tab');tabs.forEach(function(t){t.classList.remove('mag-tab-active')});this.classList.add('mag-tab-active');var ink=nav.querySelector('.mag-tab-ink');if(ink){ink.style.transform='translateX('+this.offsetLeft+'px)';ink.style.width=this.offsetWidth+'px';}document.getElementById('${id}').scrollIntoView({behavior:'smooth',block:'start'})`
  return `<div class="mag-result tone-neutral wenshi-streaming" style="--theme-color:${et.THEME};--theme-color-dim:${et.DIM};">
    <section class="mag-hero wenshi-orb-spacer" id="bazi-hero"></section>
    <nav class="mag-tabs">
      <button class="mag-tab mag-tab-active" onclick="${tabClick('bazi-m1')}">结论先行</button>
      <button class="mag-tab" onclick="${tabClick('bazi-m2')}">命局解读</button>
      <button class="mag-tab" onclick="${tabClick('bazi-m3')}">深度推演</button>
      <button class="mag-tab" onclick="${tabClick('bazi-m5')}">行动建议</button>
      <span class="mag-tab-ink"></span>
    </nav>
    <section class="mag-section" id="bazi-m1">
      <div class="module-heading"><h2>结论先行</h2></div>
      ${question ? `<blockquote class="mag-question">"${question}"</blockquote>` : ''}
      <p class="bazi-basis-text">${slot('summary_basis')}</p>
    </section>
    <section class="mag-section" id="bazi-m2">
      <div class="module-heading"><h2>命局解读</h2></div>
      <div id="bazi-panel-anchor" class="bazi-panel-anchor"></div>
      <div class="bazi-foundation-block"><p>${slot('base_foundation')}</p></div>
    </section>
    <section class="mag-section" id="bazi-m3">
      <div class="module-heading"><h2>深度推演</h2></div>
      <div class="bazi-foundation-block"><h3 class="bazi-bf-title">大运</h3><p>${slot('dayun_field')}</p></div>
      <div class="bazi-foundation-block"><h3 class="bazi-bf-title">流年</h3><p>${slot('liunian_trigger')}</p></div>
    </section>
    <section class="mag-section" id="bazi-m5">
      <div class="module-heading"><h2>行动建议</h2></div>
      <p>${slot('action_guide')}</p>
    </section>
  </div>`
}

const buildStreamingScaffoldHTML = (engine = null, statusText = '') => {
  if (engine?.branch === 'bazi') return buildBaziStreamingScaffoldHTML(engine, statusText)
  const sk = (lines = 2) => `<span class="wsk">${'<i></i>'.repeat(lines)}</span>`
  // 流式槽位：初始骨架，data-wslot 供 DOM 打补丁
  const slot = (key) => `<span class="wstream-slot" data-wslot="${key}">${sk(QIMEN_STREAM_SLOTS[key]?.lines || 2)}</span>`
  const chart = engine?.qimen_data || null
  const palaces = chart?.palaces || []
  const ju = chart?.ju_info || {}
  const ts = chart?.timestamp || {}
  const aux = chart?.auxiliary || {}
  const pillars = chart?.pillars || {}
  const preScore = engine?.pre_score
  const vd = (preScore !== undefined && preScore !== null) ? getVerdictInfo(preScore) : null
  const heroTone = preScore == null ? 'neutral' : preScore < 55 ? 'caution' : preScore < 75 ? 'neutral' : 'auspicious'
  const THEME = preScore == null ? '#B58D3B' : preScore < 55 ? '#C84A45' : preScore < 75 ? '#B58D3B' : '#0D9488'
  const THEME_DIM = preScore == null ? 'rgba(181,141,59,0.17)' : preScore < 55 ? 'rgba(200,74,69,0.16)' : preScore < 75 ? 'rgba(181,141,59,0.17)' : 'rgba(13,148,136,0.15)'
  const question = engine?.question || ''

  // 九宫盘（引擎产物，秒出）
  let panInnerHTML = ''
  if (palaces.length) {
    const isZhiFu = s => s && ju.zhi_fu && s.includes(ju.zhi_fu)
    const isZhiShi = d => d && ju.zhi_shi && d.includes(ju.zhi_shi)
    const cells = palaces.map(p => {
      if (p.is_center) return `<div class="pan-cell"><div class="pan-center-earth">${p.earth || ''}</div></div>`
      let marks = ''
      if (p.ma_xing?.has_ma) marks += `<span class="pan-mark mark-ma">马</span>`
      if (p.kong_wang?.is_kong) marks += `<span class="pan-mark mark-kong">空</span>`
      return `<div class="pan-cell"><div class="pan-god">${p.god || ''}</div><div class="pan-stem stem-sky">${p.sky || ''}</div>${p.ji_sky ? `<div class="pan-stem ji-sky">${p.ji_sky}</div>` : ''}<div class="pan-star ${isZhiFu(p.star) ? 'highlight-text' : ''}">${p.star || ''}</div><div class="pan-door ${isZhiShi(p.door) ? 'highlight-text' : ''}">${p.door || ''}</div><div class="pan-stem stem-earth">${p.earth || ''}</div>${p.ji_earth ? `<div class="pan-stem ji-earth">${p.ji_earth}</div>` : ''}<div class="pan-marks">${marks}</div></div>`
    }).join('')
    panInnerHTML = `<div class="pan-wrapper"><div class="pan-header"><div class="pan-pillars">${[pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean).join('　')}</div>${buildQimenPanInfo(ju, ts, aux)}</div><div class="pan-grid">${cells}</div></div>`
  } else {
    panInnerHTML = `<div class="pan-skeleton">${sk(1)}<div class="pan-grid">${'<div class="pan-cell"><span class="wsk"><i></i></span></div>'.repeat(9)}</div></div>`
  }

  // 格局吉凶（引擎产物）
  const formationTags = engine?.formation_tags || []
  const formationHTML = formationTags.length
    ? `<div class="formation-tag-row">${formationTags.map(h => `<span class="formation-tag ${h.type === 'ji' ? 'tag-ji' : 'tag-xiong'}">${h.name}</span>`).join('')}</div>`
    : (chart ? `<div class="formation-tag-row"><span class="formation-tag tag-neutral">无显著有名格</span></div>` : `<div>${sk(1)}</div>`)

  // 用神选取（symbol/verdict/evidence 来自 data_json，complete 时到，先骨架）
  const yongshenHTML = `<div class="yongshen-card-grid">${['问测人', '目标事态', '关键环境'].map(label => `<article class="yongshen-card tone-mixed"><div class="yongshen-card-head"><span>${label}</span><strong>—</strong></div>${sk(2)}</article>`).join('')}</div>`

  // 局象推演六段：翻译层 reading 流式；提炼层 summary 流式；制约/支持/环境亦流式
  const inferCard = (label, symbol, slotKey, cls = '') => `<article class="inference-card tone-mixed ${cls}"><div class="inference-body"><div class="inference-head"><span>${label}</span><strong>${symbol}</strong></div><h4>${slot(slotKey)}</h4></div></article>`
  const inferenceHTML = `<div class="inference-flow">
    ${inferCard('求测人状态', '日干', 'subject_reading')}
    ${inferCard('目标事态', '用神', 'target_reading')}
    ${inferCard('环境制约', '值使门', 'environment_reading')}
    <article class="inference-card inference-support tone-positive"><div class="inference-body"><div class="inference-head"><span>有利因素</span></div><h4>${slot('support_summary')}</h4></div></article>
    <article class="inference-card inference-constraint tone-warning"><div class="inference-body"><div class="inference-head"><span>不利因素</span></div><h4>${slot('constraint_summary')}</h4></div></article>
    ${inferCard('生克决断', '日干 ↔ 用神', 'decision_reading')}
  </div>`

  // 开运指南（m4，data_json，complete 到，先骨架）
  const guidanceHTML = `<div class="guidance-grid">
    <article class="guidance-card"><div class="guidance-kicker">环境风水</div>${sk(3)}</article>
    <article class="guidance-card"><div class="guidance-kicker">时空行为</div>${sk(3)}</article>
  </div>`

  // 行动建议（m1.actions，data_json，complete 到，先一整块大骨架，不分 01/02/03）
  const actionsHTML = `<div class="mag-action-list"><span class="wsk-block"></span></div>`

  const tabClick = (id) => `var nav=this.closest('.mag-tabs');var tabs=nav.querySelectorAll('.mag-tab');tabs.forEach(function(t){t.classList.remove('mag-tab-active')});this.classList.add('mag-tab-active');var ink=nav.querySelector('.mag-tab-ink');if(ink){ink.style.transform='translateX('+this.offsetLeft+'px)';ink.style.width=this.offsetWidth+'px';}document.getElementById('${id}').scrollIntoView({behavior:'smooth',block:'start'})`

  return `<div class="mag-result tone-${heroTone} wenshi-streaming" style="--theme-color:${THEME};--theme-color-dim:${THEME_DIM};">
    <section class="mag-hero wenshi-orb-spacer" id="mag-hero"></section>

    <nav class="mag-tabs">
      <button class="mag-tab mag-tab-active" onclick="${tabClick('mag-m1')}">结论先行</button>
      <button class="mag-tab" onclick="${tabClick('mag-m2')}">奇门定基</button>
      <button class="mag-tab" onclick="${tabClick('mag-m3')}">局象推演</button>
      <button class="mag-tab" onclick="${tabClick('mag-m4')}">开运指南</button>
      <span class="mag-tab-ink"></span>
    </nav>

    <section class="mag-section" id="mag-m1">
      <div class="module-heading"><h2>结论先行</h2></div>
      ${question ? `<blockquote class="mag-question">"${question}"</blockquote>` : ''}
      <div class="report-subtitle">行动建议</div>
      ${actionsHTML}
    </section>

    <section class="mag-section" id="mag-m2">
      <div class="module-heading"><h2>奇门定基</h2></div>
      ${panInnerHTML ? `<div class="mag-pan-block">${panInnerHTML}</div>` : ''}
      <div class="report-subtitle">格局吉凶</div>
      ${formationHTML}
      <div class="report-subtitle">用神选取</div>
      ${yongshenHTML}
    </section>

    <section class="mag-section" id="mag-m3">
      <div class="module-heading"><h2>局象推演</h2></div>
      ${inferenceHTML}
    </section>

    <section class="mag-section" id="mag-m4">
      <div class="module-heading"><h2>开运指南</h2></div>
      ${guidanceHTML}
    </section>
  </div>`
}

// ── 追问增补：section → 卡片模块锚点映射（终态烘焙 + 流式 DOM 共用）──
const FOLLOWUP_SECTION_MODULE = {
  conclusion: 'm1',
  subject_reading: 'm2', target_reading: 'm2', environment_reading: 'm2',
  support_summary: 'm3', constraint_summary: 'm3',
  decision_reading: 'm4',
}
// 八字 section → 卡片模块 id（buildBaziQuestionCardHTML 的 section id 即 DOM 锚点）
const FOLLOWUP_SECTION_MODULE_BAZI = {
  summary_conclusion: 'bazi-m1', summary_basis: 'bazi-m1',
  base_foundation: 'bazi-m2',
  dayun_field: 'bazi-m3', liunian_trigger: 'bazi-m3', structural_verdict: 'bazi-m3',
  appearance_tendency: 'bazi-m3', personality_tendency: 'bazi-m3',
  career_style: 'bazi-m3', relationship_dynamic: 'bazi-m3',
  action_guide: 'bazi-m5',
}
const followupModuleMap = (branch) => (branch === 'bazi' ? FOLLOWUP_SECTION_MODULE_BAZI : FOLLOWUP_SECTION_MODULE)
// 流式 DOM 锚点：奇门模块 id 形如 mag-m1，八字直接是 bazi-m1
const followupModuleAnchorSelector = (branch, moduleKey) => (branch === 'bazi' ? `#${moduleKey}` : `#mag-${moduleKey}`)
// 单个增补块 HTML（流式 DOM 占位与终态烘焙复用，保证样式一致）
const renderFollowupBlockHTML = ({ q = '', section = '', text = '', nature = 'deepen', streaming = false } = {}) => {
  const badge = nature === 'revise' ? '因新情况修正' : '追问深挖'
  const body = streaming ? '<span class="wsk"><i></i><i></i></span>' : mdBold(escapeHtmlText(text))
  return `<div class="mag-followup${streaming ? ' mag-followup-pop' : ''}${nature === 'revise' ? ' is-revise' : ''}">`
    + `<div class="mag-followup-q"><span class="mag-followup-badge">${badge}</span>${escapeHtmlText(q)}</div>`
    + `<div class="mag-followup-body"${streaming ? ` data-fslot="${section}"` : ''}>${body}</div>`
    + `</div>`
}
// 某模块下所有追问增补（按 followups 顺序铺开）。map 默认奇门，八字传 FOLLOWUP_SECTION_MODULE_BAZI。
const renderFollowupsForModule = (moduleKey, followups, map = FOLLOWUP_SECTION_MODULE) => {
  if (!Array.isArray(followups) || !followups.length) return ''
  const blocks = []
  for (const f of followups) {
    const sup = f && f.supplements ? f.supplements : {}
    for (const [section, text] of Object.entries(sup)) {
      if (map[section] !== moduleKey) continue
      if (!text || !String(text).trim()) continue
      blocks.push(renderFollowupBlockHTML({ q: f.q, section, text, nature: f.nature }))
    }
  }
  return blocks.length ? `<div class="mag-followup-list">${blocks.join('')}</div>` : ''
}
// 把追问增补烘焙进八字卡：在各目标模块 section 的 </section> 前插入（mag-section 不嵌套，定位可靠）
const bakeBaziFollowups = (html, followups) => {
  if (!Array.isArray(followups) || !followups.length) return html
  for (const moduleId of ['bazi-m1', 'bazi-m2', 'bazi-m3', 'bazi-m4', 'bazi-m5']) {
    const blocks = renderFollowupsForModule(moduleId, followups, FOLLOWUP_SECTION_MODULE_BAZI)
    if (!blocks) continue
    const idIdx = html.indexOf(`id="${moduleId}"`)
    if (idIdx < 0) continue
    const closeIdx = html.indexOf('</section>', idIdx)
    if (closeIdx < 0) continue
    html = html.slice(0, closeIdx) + blocks + html.slice(closeIdx)
  }
  return html
}

const buildCardHTML = (data, opts = {}) => {
  // 八字分支：v1 存量记录在进渲染前统一适配到 v2（幂等）；追问增补烘焙进卡片
  if (data.branch === 'bazi' && data.meta?.analysis_mode) {
    return bakeBaziFollowups(
      buildBaziQuestionCardHTML(adaptBaziResultToV2(data)),
      Array.isArray(data.followups) ? data.followups : [],
    )
  }

  // 流式脚手架模式：未到的 LLM 字段渲染成骨架，而不是 fallback 占位文案
  const streaming = !!opts.streaming
  const skel = (lines = 2) => `<span class="wsk">${'<i></i>'.repeat(lines)}</span>`
  // 取值或骨架：streaming 时空值→骨架；非 streaming 时空值→fallback
  const orSkel = (val, fb = '', lines = 2) => streaming ? (val ? val : skel(lines)) : (val || fb)

  data = normalizeQimenCardData(data)
  const followups = Array.isArray(data.followups) ? data.followups : []
  const report = data.qimen_report || {}
  const hasQimenReport = Boolean(report && Object.keys(report).length)
  const reportM1 = report.m1_conclusion || {}
  const reportM2 = report.m2_basis || {}
  const reportM3 = report.m3_inference || {}
  const reportM4 = report.m4_guidance || {}
  const summary = data.summary || { title: '生成中...', conclusion: '暂无数据', score: 0 }
  const analysis = data.analysis || {}
  const advice = data.advice || { lucky_tips: {} }
  const question = data.question || ''
  const displayBlocks = data.display_blocks || null
  const chartData = data.qimen_data || data
  const palaces = chartData.palaces || []
  const pillars = chartData.pillars || {}
  const ju = chartData.ju_info || {}
  const ts = chartData.timestamp || {}
  const aux = chartData.auxiliary || {}
  const hasChart = palaces.length > 0

  const score = reportM1.score ?? summary.score ?? 0
  const vd = getVerdictInfo(score)
  const heroTone = score < 55 ? 'caution' : score < 75 ? 'neutral' : 'auspicious'
  const THEME = score < 55 ? '#C84A45' : score < 75 ? '#B58D3B' : '#0D9488'
  const THEME_DIM = score < 55 ? 'rgba(200,74,69,0.16)' : score < 75 ? 'rgba(181,141,59,0.17)' : 'rgba(13,148,136,0.15)'

  const scoreBasis = hasQimenReport && Object.keys(reportM3).length
    ? deriveScoreBasisFromM3(reportM3, data.backend_score_audit?.adjustments)
    : (data.summary?.score_basis || null)
  const strategyItems = reportM1.actions?.length ? reportM1.actions : (advice.strategy || [])
  const primaryStrategies = strategyItems.slice(0, 3)
  const domainView = data.domain_view
  const luckyTips = advice.lucky_tips || {}
  const dayStem = String(pillars.day || '').charAt(0)
  const hourStem = String(pillars.hour || '').charAt(0)
  const toneBadge = { positive: '顺', mixed: '参', warning: '慎' }
  const normalizeTone = (tone) => ['positive', 'mixed', 'warning'].includes(tone) ? tone : 'mixed'
  const formatSymbol = (label, symbol) => [label, symbol].filter(Boolean).join(' ')
  const findPalaceForSymbol = (symbol) => {
    const raw = String(symbol || '').replace(/^(日干|时干)\s*/, '').trim()
    if (!raw) return ''
    const hit = palaces.find(p => [p.sky, p.earth, p.door, p.star, p.god].some(v => v && String(v).includes(raw)))
    return hit?.name || ''
  }
  const toStr = (v, fb = '') => {
    const safe = typeof fb === 'string' ? fb : ''
    if (!v) return safe
    if (typeof v === 'string') return v || safe
    if (Array.isArray(v)) return v.filter(Boolean).join('、') || safe
    if (typeof v === 'object') return v.text || v.content || v.main || safe
    return safe
  }
  const buildReportCard = (card, fallback = {}) => {
    const tone = normalizeTone(card?.tone || fallback.tone)
    const mainText = toStr(card?.reading, '')
      || toStr(card?.decision, '')
      || toStr(card?.summary, '')
      || toStr(card?.verdict, fallback.verdict || '')
    const reasonText = toStr(card?.reason, '')
      || toStr(card?.evidence, fallback.evidence || '')
    return {
      key: card?.key || fallback.key || 'custom',
      label: toStr(card?.label, fallback.label || '关键判断'),
      symbol: toStr(card?.symbol, fallback.symbol || ''),
      palace: toStr(card?.palace, fallback.palace || findPalaceForSymbol(card?.symbol || fallback.symbol)),
      tone,
      badge: card?.badge || toneBadge[tone],
      verdict: mainText,
      evidence: reasonText
    }
  }
  const getFactorItems = state => (Array.isArray(state?.items) && state.items.length)
    ? state.items
    : (Array.isArray(state?.factors) ? state.factors : [])
  const renderFactorList = (items, toneClass) => {
    const normalized = items
      .map(item => ({
        name: toStr(item?.name || item?.label, ''),
        impact: toStr(item?.impact || item?.text || item?.reason, '')
      }))
      .filter(item => item.name || item.impact)
      .slice(0, 3)
    if (!normalized.length) return ''
    return `<div class="inference-factor-list ${toneClass}">
      ${normalized.map(item => `<div class="inference-factor-item">
        ${item.name ? `<span>${item.name}</span>` : ''}
        ${item.impact ? `<p>${item.impact}</p>` : ''}
      </div>`).join('')}
    </div>`
  }

  // ── 九宫格内部 HTML（无外层卡片盒）
  let panInnerHTML = ''
  if (hasChart) {
    const isZhiFu = s => s && ju.zhi_fu && s.includes(ju.zhi_fu)
    const isZhiShi = d => d && ju.zhi_shi && d.includes(ju.zhi_shi)
    const cells = palaces.map(p => {
      if (p.is_center) return `<div class="pan-cell"><div class="pan-center-earth">${p.earth || ''}</div></div>`
      const starCls = isZhiFu(p.star) ? 'highlight-text' : ''
      const doorCls = isZhiShi(p.door) ? 'highlight-text' : ''
      let marks = ''
      if (p.ma_xing?.has_ma) marks += `<span class="pan-mark mark-ma">马</span>`
      if (p.kong_wang?.is_kong) marks += `<span class="pan-mark mark-kong">空</span>`
      return `<div class="pan-cell"><div class="pan-god">${p.god || ''}</div><div class="pan-stem stem-sky">${p.sky || ''}</div>${p.ji_sky ? `<div class="pan-stem ji-sky">${p.ji_sky}</div>` : ''}<div class="pan-star ${starCls}">${p.star || ''}</div><div class="pan-door ${doorCls}">${p.door || ''}</div><div class="pan-stem stem-earth">${p.earth || ''}</div>${p.ji_earth ? `<div class="pan-stem ji-earth">${p.ji_earth}</div>` : ''}<div class="pan-marks">${marks}</div></div>`
    }).join('')
    panInnerHTML = `<div class="pan-wrapper"><div class="pan-header"><div class="pan-pillars">${[pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean).join('　')}</div>${buildQimenPanInfo(ju, ts, aux)}</div><div class="pan-grid">${cells}</div></div>`
  }

  // ── 格局吉凶
  const namedFormationHits = reportM2.formation_tags?.length
    ? reportM2.formation_tags.map(h => ({ signal: h.name, effect: h.effect, reason: h.reason, text: h.text, type: h.type }))
    : (data.backend_score_audit?.adjustments || []).filter(h => h.layer === 'named_formation')
  const formationTagsHTML = namedFormationHits.length
    ? `<div class="formation-tag-row" data-ge-reasons='${JSON.stringify(namedFormationHits.map(h => ({ name: h.signal || h.name, type: h.type || (String(h.effect).startsWith('+') ? 'ji' : 'xiong'), text: h.text || GE_DESCRIPTIONS[h.signal || h.name] || h.reason || '' })))}'>
        ${namedFormationHits.map(h => {
          const name = h.signal || h.name
          const isJi = (h.type || '').includes('ji') || String(h.effect).startsWith('+')
          return `<span class="ge-tag ${isJi ? 'ji' : 'xiong'}" data-ge-name="${name}"><span class="ge-dot"></span>${name}</span>`
        }).join('')}
      </div>`
    : `<p class="report-muted">未见足以改写主线的有名格。</p>`

  const domainCards = Array.isArray(domainView?.axes)
    ? domainView.axes.map((axis, index) => buildReportCard(axis, {
        key: index === 0 ? 'target' : index === 1 ? 'environment' : 'custom',
        label: axis.label,
        symbol: axis.symbol,
        tone: axis.tone,
        verdict: axis.verdict,
        evidence: axis.evidence
      }))
    : []
  const fallbackYongshenCards = [
    buildReportCard({}, {
      key: 'subject',
      label: '问测人状态',
      symbol: formatSymbol('日干', dayStem || '-'),
      tone: 'mixed',
      verdict: displayBlocks?.situation || analysis.tensor || '以日干落宫观察求测人当前承接力与行动状态。',
      evidence: analysis.yong_shen || '结合日干落宫的门、星、神、空亡与马星判断自身状态。'
    }),
    buildReportCard({}, {
      key: 'target',
      label: '目标事态',
      symbol: formatSymbol('时干', hourStem || '-'),
      tone: 'mixed',
      verdict: displayBlocks?.support || analysis.yong_shen || '以时干或领域主用神观察目标事态。',
      evidence: displayBlocks?.situation || analysis.yong_shen || '结合目标用神落宫与日时互动判断事情能否落地。'
    }),
    buildReportCard({}, {
      key: 'environment',
      label: '关键环境因素',
      symbol: ju.zhi_shi ? `值使 ${ju.zhi_shi}` : (ju.zhi_fu ? `值符 ${ju.zhi_fu}` : '值使门'),
      tone: displayBlocks?.risk ? 'warning' : 'mixed',
      verdict: displayBlocks?.risk || analysis.god_help || '观察流程、环境和现实阻力。',
      evidence: advice.risk || analysis.pattern || '结合值符、值使、格局、空亡和风险信号判断外部环境。'
    })
  ]
  const yongshenCards = (Array.isArray(reportM2.yongshen_cards) && reportM2.yongshen_cards.length)
    ? reportM2.yongshen_cards.map(card => buildReportCard(card))
    : (domainCards.length ? domainCards : fallbackYongshenCards)
  const yongshenCardsHTML = `<div class="yongshen-card-grid">
    ${yongshenCards.map(card => `<article class="yongshen-card tone-${card.tone}">
      <div class="yongshen-card-head">
        <span>${card.label}</span>
        <strong>${card.symbol || '-'}</strong>
      </div>
      <h4>${card.verdict || '暂无明确断语'}</h4>
      <p>${card.evidence || '暂无依据说明'}</p>
    </article>`).join('')}
  </div>`

  const relation = data.backend_score_audit?.relations?.[0]
  // 翻译层：subject / target / environment（新字段名，保留旧名作 fallback）
  const subjectState = reportM3.subject_state || reportM3.subject_day_stem_state || reportM3.self_state
  const targetState = reportM3.target_state || reportM3.target_yongshen_state
  const environmentState = reportM3.environment_state || null
  // 提炼层
  const supportState = reportM3.support_factors || reportM3.favorable_factors || null
  const constraintState = reportM3.constraint_factors || reportM3.constraints
  // 拍板层
  const interactionDecision = reportM3.interaction_decision || reportM3.interaction_verdict
  const interactionMainText = toStr(interactionDecision?.reading, '')
    || toStr(interactionDecision?.verdict, '')
    || toStr(interactionDecision?.decision, '')
    || toStr(interactionDecision?.reason, '')
    || toStr(interactionDecision?.evidence, '')
  const normalizedInteractionDecision = interactionDecision
    ? { ...interactionDecision, reading: interactionMainText }
    : null

  // macro 层文案用于 environment_state fallback
  const macroAdjustments = (data.backend_score_audit?.adjustments || []).filter(h => h.layer === 'macro')
  const macroReason = macroAdjustments.map(h => h.reason).filter(Boolean).join('；')

  const inferenceCards = [
    buildReportCard(subjectState, {
      key: 'self',
      label: '自身状态',
      symbol: formatSymbol('日干', dayStem || '-'),
      tone: 'mixed',
      verdict: displayBlocks?.situation || analysis.tensor || '日干落宫，判断求测人当前承接力与行动状态。',
      evidence: analysis.yong_shen || '需结合日干落宫的门、星、神、旺衰、空亡与马星综合判断。'
    }),
    buildReportCard(targetState, {
      key: 'target',
      label: '目标事态',
      symbol: formatSymbol('时干', hourStem || '-'),
      tone: 'mixed',
      verdict: displayBlocks?.support || analysis.yong_shen || '目标用神落宫，判断事情本身能量与实现可能。',
      evidence: domainView?.process?.evidence || analysis.yong_shen || '以时干或领域主用神观察目标事态的旺衰与空亡。'
    }),
    buildReportCard(normalizedInteractionDecision, {
      key: 'interaction',
      label: '生克决断',
      symbol: interactionDecision?.subject_symbol && interactionDecision?.target_symbol
        ? `${interactionDecision.subject_symbol} ↔ ${interactionDecision.target_symbol}`
        : '日干 ↔ 时干',
      tone: interactionDecision?.tone || (relation?.effect > 0 ? 'positive' : relation?.effect < 0 ? 'warning' : 'mixed'),
      verdict: relation?.reason || displayBlocks?.situation || '综合自身、目标与环境，给出五行生克的方向性结论。',
      evidence: relation?.reason || '若后端未给出明确生克关系，则以整体局势和用神强弱综合判断。'
    })
  ]

  // 环境制约：翻译层第三段，fallback 来自 macro 层和值使门
  const envTone = normalizeTone(environmentState?.tone || 'warning')
  const envVerdict = toStr(environmentState?.reading, '')
    || toStr(environmentState?.verdict, '')
    || macroReason
    || displayBlocks?.situation
    || '值使门与值符状态决定当前流程管道是否通畅。'
  const environmentCardHTML = `<article class="inference-card tone-${envTone}">
    <div class="inference-body">
      <div class="inference-head"><span>环境制约</span><strong>${toStr(environmentState?.symbol, '值使门')}</strong></div>
      <h4>${envVerdict}</h4>
    </div>
  </article>`

  // 有利因素：正向 fallback 来自正向格局命中或 scoreBasis.positive_signals
  const positiveFormationHits = namedFormationHits.filter(h => String(h.effect).startsWith('+') || (h.type || '').includes('ji'))
  const supportTone = normalizeTone(supportState?.tone || 'positive')
  const supportPrimary = toStr(supportState?.summary, '')
    || toStr(supportState?.primary_support, '')
    || toStr(supportState?.verdict, '')
    || toStr(displayBlocks?.support, '')
    || (scoreBasis?.positive_signals?.[0] || '')
    || '局面存在一定正向支撑，需结合用神旺相与格局综合判断。'
  const supportItems = getFactorItems(supportState)
  const supportFactorsHTML = renderFactorList(supportItems, 'positive')
  const rawSupportFactors = supportItems.length
    ? supportItems.map(f => f.name || f.label || '').filter(Boolean)
    : positiveFormationHits.map(h => h.signal || h.name).filter(Boolean)
  const supportTagsHTML = !supportFactorsHTML && rawSupportFactors.length
    ? `<div class="support-factors">${rawSupportFactors.map(name => `<span class="support-factor-tag">${name}</span>`).join('')}</div>`
    : ''
  const supportCardHTML = `<article class="inference-card inference-support tone-${supportTone}">
    <div class="inference-body">
      <div class="inference-head"><span>有利因素</span></div>
      <h4>${supportPrimary}</h4>
      ${supportFactorsHTML || supportTagsHTML}
    </div>
  </article>`

  // 不利因素：提炼层，支持 factors[] 多要素列表
  const constraintTone = normalizeTone(constraintState?.tone || 'warning')
  const constraintPrimaryRisk = toStr(constraintState?.summary, '') || toStr(constraintState?.primary_risk, '')
  const constraintVerdict = constraintPrimaryRisk || constraintState?.verdict || displayBlocks?.risk || advice.risk || '主要限制来自流程、空亡、凶格或现实条件。'
  const constraintItems = getFactorItems(constraintState)
  const constraintFactorsHTML = renderFactorList(constraintItems, 'warning')
  const rawFactors = constraintItems.length
    ? constraintItems.map(f => f.name || f.label || '').filter(Boolean)
    : namedFormationHits.map(h => h.signal || h.name).filter(Boolean)
  const factorsTagsHTML = !constraintFactorsHTML && rawFactors.length
    ? `<div class="constraint-factors">${rawFactors.map(name => `<span class="constraint-factor-tag">${name}</span>`).join('')}</div>`
    : ''
  const constraintCardHTML = `<article class="inference-card inference-constraint tone-${constraintTone}">
    <div class="inference-body">
      <div class="inference-head"><span>不利因素</span></div>
      <h4>${constraintVerdict}</h4>
      ${constraintFactorsHTML || factorsTagsHTML}
    </div>
  </article>`

  const inferenceHTML = `<div class="inference-flow">
    ${inferenceCards.slice(0, 2).map(card => `<article class="inference-card tone-${card.tone}">
      <div class="inference-body">
        <div class="inference-head"><span>${card.label}</span><strong>${card.symbol || '-'}</strong></div>
        <h4>${card.verdict || '暂无明确断语'}</h4>
      </div>
    </article>`).join('')}
    ${environmentCardHTML}
    ${supportCardHTML}
    ${constraintCardHTML}
    ${inferenceCards.slice(2).map(card => `<article class="inference-card tone-${card.tone}">
      <div class="inference-body">
        <div class="inference-head"><span>${card.label}</span><strong>${card.symbol || '-'}</strong></div>
        <h4>${card.verdict || '暂无明确断语'}</h4>
      </div>
    </article>`).join('')}
  </div>`

  const envGuide = reportM4.environment_fengshui || {}
  const timingGuide = reportM4.timing_behavior || {}
  const envDirection = envGuide.suitable_direction || envGuide.direction || luckyTips.direction || '暂无明确方位'
  const envDo = envGuide.do || envGuide.environment_advice || '优先选择信息更透明、沟通更顺畅的场景，不在压力和杂讯过重时强推。'
  const envAvoid = envGuide.avoid || envGuide.avoid_direction || ''
  const envReason = envGuide.reason || '依据用神宫位、值符值使与风险信号综合给出。'
  const timingWindow = timingGuide.window || timingGuide.best_window || luckyTips.time || '暂无明确窗口'
  const timingDo = timingGuide.do || timingGuide.action || luckyTips.action || '先观察再行动'
  const timingAvoid = timingGuide.avoid || timingGuide.avoid_action || ''
  const timingReason = timingGuide.reason || displayBlocks?.timing || analysis.dynamic_timing || '应期只代表启动和观察窗口，不代表结果必然落地。'
  const guidanceHTML = `<div class="guidance-grid">
    <article class="guidance-card">
      <div class="guidance-kicker">环境风水</div>
      <h4>${envDirection}</h4>
      <div class="guidance-rows">
        <div class="guidance-row"><span>宜</span><p>${envDo}</p></div>
        ${envAvoid ? `<div class="guidance-row warning"><span>避</span><p>${envAvoid}</p></div>` : ''}
        <div class="guidance-row muted"><span>据</span><p>${envReason}</p></div>
      </div>
    </article>
    <article class="guidance-card">
      <div class="guidance-kicker">时空行为</div>
      <h4>${timingWindow}</h4>
      <div class="guidance-rows">
        ${timingGuide.wait_until ? `<div class="guidance-row"><span>等</span><p>${timingGuide.wait_until}</p></div>` : ''}
        <div class="guidance-row"><span>行</span><p>${timingDo}</p></div>
        ${timingAvoid ? `<div class="guidance-row warning"><span>避</span><p>${timingAvoid}</p></div>` : ''}
        <div class="guidance-row muted"><span>据</span><p>${timingReason}</p></div>
      </div>
    </article>
  </div>`

  const magActionListHTML = primaryStrategies.length
    ? primaryStrategies.map((s, i) => `<div class="mag-action-item reveal" style="transition-delay:${i * 70}ms"><div class="mag-action-num">0${i + 1}</div><div class="mag-action-body">${s}</div></div>`).join('')
    : `<div class="mag-action-item"><div class="mag-action-num">01</div><div class="mag-action-body">${reportM1.conclusion || summary.conclusion}</div></div>`

  const tabClick = (id) => `var nav=this.closest('.mag-tabs');var tabs=nav.querySelectorAll('.mag-tab');tabs.forEach(function(t){t.classList.remove('mag-tab-active')});this.classList.add('mag-tab-active');var ink=nav.querySelector('.mag-tab-ink');if(ink){ink.style.transform='translateX('+this.offsetLeft+'px)';ink.style.width=this.offsetWidth+'px';}document.getElementById('${id}').scrollIntoView({behavior:'smooth',block:'start'})`

  return `<div class="mag-result tone-${heroTone}" style="--theme-color:${THEME};--theme-color-dim:${THEME_DIM};">
    <section class="mag-hero" id="mag-hero">
      <div class="mag-hero-panel">
        ${summary.score !== null && summary.score !== undefined ? `<div class="mag-score-inline"><strong id="vueScoreValue">${score}</strong><span>分</span></div>` : ''}
        <div class="mag-hero-tags">
          <span class="mag-verdict-badge mag-verdict-${vd.cls}">${vd.label}</span>
          <span>${orSkel(reportM1.keyword || summary.keyword, '本局总判', 1)}</span>
        </div>
        <h1>${orSkel(reportM1.title || summary.title, '本局断语', 1)}</h1>
        <p>${orSkel(reportM1.conclusion || summary.conclusion, '', 3)}</p>
      </div>
    </section>

    <nav class="mag-tabs">
      <button class="mag-tab mag-tab-active" onclick="${tabClick('mag-m1')}">结论先行</button>
      <button class="mag-tab" onclick="${tabClick('mag-m2')}">奇门定基</button>
      <button class="mag-tab" onclick="${tabClick('mag-m3')}">局象推演</button>
      <button class="mag-tab" onclick="${tabClick('mag-m4')}">开运指南</button>
      <span class="mag-tab-ink"></span>
    </nav>

    <section class="mag-section" id="mag-m1">
      <div class="module-heading"><h2>结论先行</h2></div>
      ${question ? `<blockquote class="mag-question">"${question}"</blockquote>` : ''}
      <div class="report-subtitle">行动建议</div>
      <div class="mag-action-list">${magActionListHTML}</div>
      ${renderFollowupsForModule('m1', followups)}
    </section>

    <section class="mag-section" id="mag-m2">
      <div class="module-heading"><h2>奇门定基</h2></div>
      ${panInnerHTML ? `<div class="mag-pan-block">${panInnerHTML}</div>` : ''}
      <div class="report-subtitle">格局吉凶</div>
      ${formationTagsHTML}
      <div class="report-subtitle">用神选取</div>
      ${yongshenCardsHTML}
      ${renderFollowupsForModule('m2', followups)}
    </section>

    <section class="mag-section" id="mag-m3">
      <div class="module-heading"><h2>局象推演</h2></div>
      ${inferenceHTML}
      ${renderFollowupsForModule('m3', followups)}
    </section>

    <section class="mag-section" id="mag-m4">
      <div class="module-heading"><h2>开运指南</h2></div>
      ${guidanceHTML}
      ${renderFollowupsForModule('m4', followups)}
    </section>
  </div>`
}
</script>

<style scoped>
/* 此处的样式为原 `index.html` 中的样式，
  因为使用了 scoped 属性，它们仅在当前组件生效。
  注意：全局样式（如 body, html 的重置，以及宇宙 Canvas 星空背景）
  建议放置于 src/styles/global.css 内。 
*/
.home-view {
  width: 100%;
}

/* 顶部导航 */
#siteHeader {
  position: fixed; top: 0; left: 0; right: 0; z-index: 300;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: var(--header-bg);
  border-bottom: 1px solid var(--line);
}
#siteHeader.result-header {
  position: absolute;
  justify-content: flex-start;
  padding: 18px 24px;
  background: transparent;
  border-bottom: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.hamburger { width: 38px; height: 38px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; border-radius: 10px; transition: background .2s; border: none; background: transparent; flex-shrink: 0; }
#siteHeader.result-header .hamburger { width: 34px; height: 34px; }
.hamburger span { display: block; width: 18px; height: 1.5px; background: var(--ink); border-radius: 2px; transition: all .35s var(--spring); transform-origin: center; }
.hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

.site-logo { font-family: 'Noto Serif SC', serif; font-size: 17px; letter-spacing: .15em; font-weight: 500; color: var(--gold); position: relative; }

.header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* 抽屉 */
#historyDrawer { position: absolute; inset: 0; width: 100%; z-index: 1; display: flex; flex-direction: column; background: var(--paper); border-right: 1px solid var(--line); }
.drawer-head { padding: 26px 20px 18px; }
.drawer-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.drawer-brand {
  font-family: 'Noto Serif SC', serif;
  font-size: 17px;
  letter-spacing: .15em;
  font-weight: 500;
  color: var(--gold);
}
.drawer-close {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 999px;
  background: var(--drawer-close-bg);
  color: var(--ink);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}
.drawer-new-session {
  width: 100%;
  min-height: 48px;
  margin: 0 0 22px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--drawer-btn-bg);
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 16px;
  letter-spacing: .08em;
  cursor: pointer;
}
.drawer-new-session span:last-child {
  color: var(--gold);
  font-family: var(--font-body);
  letter-spacing: 0;
}
.drawer-label { font-size: 10px; color: var(--text-muted); letter-spacing: .25em; margin-bottom: 4px; font-family: var(--font-serif); }
.drawer-title-txt { font-size: 20px; font-weight: 300; letter-spacing: .05em; color: var(--ink); }
.drawer-filter { padding: 12px 16px 14px; }
.filter-select-label { display: none; }
.filter-select-wrap { position: relative; width: 100%; }
.filter-select {
  width: 100%;
  height: 38px;
  appearance: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 38px;
  padding: 0 38px 0 13px;
  outline: none;
  cursor: pointer;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.filter-select:focus {
  border-color: var(--gold-border);
  box-shadow: 0 0 0 3px var(--gold-dim);
}
.filter-select-arrow {
  position: absolute;
  right: 13px;
  top: 50%;
  transform: translateY(-53%);
  color: var(--gold-light);
  font-size: 16px;
  pointer-events: none;
}
.drawer-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.drawer-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 14px; text-align: center; color: var(--text-muted); font-size: 12px; }
.drawer-loading { padding: 14px 20px; text-align: center; color: var(--text-muted); font-size: 12px; }
.drawer-load-more { width: calc(100% - 40px); margin: 12px 20px; padding: 10px 12px; border: 1px solid var(--line); background: var(--paper-soft); color: var(--text-muted); cursor: pointer; font-size: 12px; }
.d-hist-item { padding: 13px 20px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid var(--line); transition: background .2s; }
.d-hist-item:hover { background: var(--paper-soft); }
.d-hist-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.d-hist-dot.ji { background: var(--teal); box-shadow: 0 0 6px var(--teal); }
.d-hist-dot.xiong { background: var(--crimson); box-shadow: 0 0 6px var(--crimson); }
.d-hist-dot.ping { background: var(--gold); box-shadow: 0 0 6px var(--gold-dim); }
.d-hist-info { flex: 1; overflow: hidden; }
.d-hist-q { font-family: var(--font-serif); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.d-hist-meta { font-family: var(--font-serif); font-size: 10px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; }
.d-hist-badge { font-family: var(--font-serif); font-size: 10px; padding: 2px 7px; border-radius: 20px; flex-shrink: 0; border: 1px solid; }

/* 页面 */
.page-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 76px 24px 72px; overflow-x: visible !important; }
.result-page-wrap { padding-top: 0; padding-left: 0; padding-right: 0; }
.container { width: 100%; max-width: 520px; }
.public-landing-container {
  max-width: 1040px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
  gap: 28px 34px;
  align-items: start;
}
.seo-landing {
  min-height: 500px;
  padding: 50px 18px 42px 0;
  border-bottom: 1px solid var(--line);
}
.seo-landing h1 {
  margin: 0;
  color: var(--gold);
  font-family: var(--font-serif);
  font-size: 48px;
  font-weight: 600;
  line-height: 1.16;
  letter-spacing: 0;
  max-width: 9em;
}
.seo-lead {
  margin: 22px 0 0;
  color: var(--ink-muted);
  font-size: 16px;
  line-height: 1.8;
  max-width: 34em;
}
.seo-proof {
  margin-top: 18px;
  color: var(--gold);
  font-size: 14px;
  line-height: 1.6;
}
.seo-entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 34px;
}
.seo-entry {
  display: block;
  min-height: 118px;
  padding: 16px 15px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-card);
  text-decoration: none;
  transition: border-color .2s, background .2s, transform .2s;
}
.seo-entry:hover {
  border-color: var(--gold-border);
  background: var(--paper-soft);
  transform: translateY(-1px);
}
.seo-entry span {
  display: block;
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}
.seo-entry small {
  display: block;
  margin-top: 10px;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.6;
}
.public-landing-container .auth-landing-wrap {
  margin-top: 24px;
}
.seo-faq-section {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 28px;
  margin-top: 10px;
  padding-top: 32px;
  border-top: 1px solid var(--line);
}
.seo-faq-head h2 {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
}
.seo-faq-head p {
  margin: 10px 0 0;
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.7;
}
.seo-faq-list {
  display: grid;
  gap: 10px;
}
.seo-faq-section details {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 14px 16px;
}
.seo-faq-section summary {
  color: var(--ink);
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
  list-style-position: outside;
}
.seo-faq-section p {
  margin: 10px 0 0;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.7;
}
.tagline { text-align: center; padding: 20px 0 12px; }
.tagline-main { font-family: var(--font-serif); font-size: 13px; font-weight: 300; letter-spacing: .3em; color: var(--text-muted); margin-bottom: 6px; }
.tagline-sub { font-size: 11px; letter-spacing: .18em; color: var(--text-dim); }

@media(max-width:920px) {
  .page-wrap { padding: 76px 18px 60px; }
  .result-page-wrap { padding-top: 0; padding-left: 0; padding-right: 0; }
  .public-landing-container {
    max-width: 520px;
    display: flex;
    flex-direction: column;
  }
  .mobile-auth-first { order: 1; }
  .seo-landing { order: 2; }
  .seo-faq-section { order: 3; }
  .seo-landing {
    min-height: 0;
    margin-bottom: 18px;
    padding: 24px 22px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--bg-card);
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .seo-landing h1 {
    max-width: none;
    font-size: 30px;
    line-height: 1.28;
  }
  .seo-lead {
    margin-top: 12px;
    font-size: 14px;
  }
  .seo-proof {
    margin-top: 12px;
    font-size: 13px;
  }
  .seo-entry-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 18px;
  }
  .seo-entry {
    min-height: 0;
    padding: 13px 14px;
    border-radius: 12px;
  }
  .seo-entry small {
    margin-top: 4px;
  }
  .public-landing-container .auth-landing-wrap {
    margin-top: 0;
  }
  .seo-faq-section {
    display: block;
    margin-top: 18px;
    padding-top: 22px;
  }
  .seo-faq-head h2 {
    font-size: 20px;
  }
  .seo-faq-list {
    margin-top: 14px;
  }
}

@media(max-width:760px) {
  .seo-landing,
  .seo-faq-section {
    display: none;
  }
  .auth-landing-wrap {
    min-height: calc(100svh - 136px);
  }
  .auth-btns {
    margin-top: auto;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
  }
  .auth-taiji-wrap {
    display: block;
  }
}

.glass-card, .input-box {
  background: var(--bg-card); border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
  position: relative; overflow: hidden;
}
.input-box { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; animation: riseIn 1s .15s cubic-bezier(.22,1,.36,1) both; }
.input-card { padding: 22px; margin-bottom: 16px; }
.input-label { font-family: var(--font-serif); font-size: 11px; letter-spacing: .2em; color: var(--text-muted); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.input-label::before, .input-label::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent); }
.route-info-trigger { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(232,204,128,0.42); background: rgba(232,204,128,0.08); color: var(--gold-light); font-size: 11px; font-family: var(--font-display); font-weight: 700; line-height: 1; cursor: pointer; transition: border-color .2s, background .2s, color .2s; flex-shrink: 0; letter-spacing: 0; }
.route-info-trigger:hover { border-color: rgba(232,204,128,0.8); background: rgba(232,204,128,0.16); color: #fff; }
textarea { width: 100%; min-height: 130px; background: var(--paper-soft); border: 1px solid var(--line); border-radius: var(--radius-item); padding: 16px; color: var(--ink); font-family: 'Noto Serif SC', serif; font-size: 15px; line-height: 1.8; resize: none; outline: none; transition: all .4s; }
textarea:focus { border-color: var(--gold-border); box-shadow: 0 0 0 2px var(--gold-dim); }
.input-card textarea { min-height: 120px; background: transparent; border: none; border-radius: 0; padding: 2px 2px 0; transition: none; }
.input-card textarea:focus { border: none; box-shadow: none; }
.time-row { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.time-display { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 7px; cursor: pointer; padding: 4px 8px; margin: -4px -8px; border-radius: 8px; transition: background .2s, color .2s; }
.time-display:hover { background: rgba(127, 127, 127, .08); color: var(--text-primary); }
.time-display.is-custom { color: var(--gold-light); }
.time-edit-ic { font-size: 12px; line-height: 1; color: var(--gold); margin-left: 2px; transition: opacity .2s; }
.time-display:hover .time-edit-ic { opacity: .75; }
.time-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 6px var(--teal); animation: pulse-dot 2s infinite; }
.time-dot.is-custom { background: var(--gold); box-shadow: 0 0 6px var(--gold); animation: none; }
.time-note { font-size: 12px; color: var(--text-muted); font-family: 'Noto Serif SC', serif; }
.time-note.is-reset { color: var(--gold); cursor: pointer; }
.time-note.is-reset:hover { text-decoration: underline; }

/* 重置为现在 · 二次确认 */
.reset-time-overlay { position: fixed; inset: 0; z-index: 1300; background: rgba(0, 0, 0, .55); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s; }
.reset-time-overlay.show { opacity: 1; pointer-events: auto; }
.reset-time-box { width: 84%; max-width: 320px; background: var(--bg-card); border: 1px solid var(--line); border-radius: 16px; padding: 22px 20px 14px; text-align: center; transform: scale(.94); transition: transform .2s; }
.reset-time-overlay.show .reset-time-box { transform: scale(1); }
.reset-time-box p { font-size: 14px; color: var(--text-primary); margin: 0 0 4px; }
.reset-time-box small { font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 16px; font-variant-numeric: tabular-nums; }
.reset-time-actions { display: flex; gap: 10px; }
.reset-time-actions button { flex: 1; border-radius: 10px; padding: 10px; font-size: 14px; cursor: pointer; border: 1px solid var(--line); }
.rt-ghost { background: transparent; color: var(--text-muted); }
.rt-solid { background: var(--gold); border-color: var(--gold); color: #1a1000; font-weight: 600; }

.cta-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 16px; }
.cta-btn { width: 100%; height: 60px; border: none; outline: none; cursor: pointer; border-radius: 18px; position: relative; overflow: hidden; background: linear-gradient(135deg, #8B6914 0%, #D4AF37 35%, #E8CC80 55%, #D4AF37 75%, #8B6914 100%); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite; box-shadow: 0 4px 20px rgba(212,175,55,0.3); transition: transform .2s; }
.cta-btn:active { transform: scale(0.98); }
.cta-btn:disabled { opacity: 0.5; animation: none; cursor: not-allowed; }
.cta-inner { display: flex; align-items: center; justify-content: center; gap: 10px; height: 100%; }
.cta-text { font-family: 'Noto Serif SC', serif; font-size: 17px; font-weight: 500; color: #1a1000; letter-spacing: .15em; }
.cta-hint { font-size: 11px; color: rgba(255,255,255,0.2); }

.auth-landing-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  animation: riseIn .7s cubic-bezier(.22,1,.36,1) both;
}
.auth-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 260px;
  padding-bottom: 36px;
  overflow: hidden;
}
.hero-scatter { position: absolute; inset: 0; pointer-events: none; user-select: none; }
.hs { position: absolute; font-family: var(--font-serif); line-height: 1; }
.hs.e1 { top: 14%; left: 10%; font-size: 32px; color: rgba(181,141,59,0.22); transform: rotate(-6deg); }
.hs.e2 { top: 6%; right: 14%; font-size: 20px; color: rgba(181,141,59,0.13); transform: rotate(10deg); }
.hs.e3 { top: 46%; right: 7%; font-size: 13px; color: rgba(181,141,59,0.28); letter-spacing: 0; }
.hs.e4 { top: 28%; left: 52%; font-size: 16px; color: rgba(181,141,59,0.10); transform: rotate(4deg); }
.hs.e5 { top: 60%; left: 5%; font-size: 11px; color: rgba(181,141,59,0.16); }
.auth-taiji-wrap {
  display: none;
  position: absolute;
  top: 16px;
  right: 8px;
  width: 128px;
  height: 128px;
  opacity: .46;
  pointer-events: none;
}
.auth-taiji-svg {
  width: 100%;
  height: 100%;
  animation: auth-taiji-spin 22s linear infinite;
}
@keyframes auth-taiji-spin {
  to { transform: rotate(360deg); }
}
.hero-brand { position: relative; }
.hero-label {
  margin-bottom: 10px;
  color: var(--ink-dim);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 10px;
  letter-spacing: .32em;
}
.hero-name {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 54px;
  font-weight: 700;
  letter-spacing: .06em;
  line-height: 1.05;
}
.hero-sub {
  margin: 14px 0 0;
  color: var(--ink-muted);
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.5;
}
.hero-sub em { font-style: normal; color: var(--gold); }
.auth-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}
.abtn {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: .03em;
  cursor: pointer;
  transition: opacity .18s, transform .15s, background .18s, border-color .18s;
}
.abtn:active { transform: scale(.983); }
.abtn:disabled { opacity: .5; cursor: not-allowed; }
.abtn--solid {
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-serif);
  letter-spacing: .08em;
}
.abtn--solid:not(:disabled):hover { background: #000; }
.abtn--border {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink);
}
.abtn--border:not(:disabled):hover { border-color: var(--gold-border); background: rgba(181,141,59,0.06); }
.abtn--ghost {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink-muted);
}
.abtn--ghost:hover { border-color: var(--line); color: var(--ink); }
.abtn-divider {
  padding: 2px 0;
  color: var(--ink-dim);
  font-size: 12px;
  letter-spacing: .04em;
  text-align: center;
}
.abtn-text {
  padding: 4px;
  border: none;
  background: none;
  color: var(--ink-muted);
  font-family: var(--font-body);
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  transition: color .18s;
}
.abtn-text:hover { color: var(--ink); }
.auth-legal {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
}
.auth-legal a { color: var(--gold); text-decoration: none; }
.auth-legal a:hover { color: var(--gold-light); }
.google-mark { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 6px; background: rgba(255,255,255,.96); }
.google-mark svg { width: 15px; height: 15px; display: block; }
.auth-form-pg {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-top: 4px;
  animation: riseIn .45s cubic-bezier(.22,1,.36,1) both;
}
.auth-back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 5px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ink-muted);
  font-family: var(--font-body);
  font-size: 13px;
  cursor: pointer;
  transition: color .18s;
}
.auth-back:hover { color: var(--ink); }
.afm-title {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 36px;
  font-weight: 600;
  letter-spacing: .04em;
}
.afm-fields { display: flex; flex-direction: column; gap: 0; }
.afm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
  transition: border-color .2s;
}
.afm-field:focus-within { border-bottom-color: var(--gold-border); }
.afm-field span {
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: .18em;
}
input[type="email"], input[type="password"] {
  width: 100%;
  min-height: 48px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 13px 15px;
  color: var(--ink);
  font-size: 15px;
  outline: none;
  transition: border-color .2s, box-shadow .2s, background .2s;
}
input[type="email"]:focus, input[type="password"]:focus {
  border-color: var(--gold-border);
  box-shadow: 0 0 0 3px var(--gold-dim);
}
.afm-field input[type="email"],
.afm-field input[type="password"] {
  min-height: auto !important;
  padding: 4px 0 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--ink) !important;
  font-size: 17px !important;
}
input::placeholder { color: var(--text-muted); }
.afm-sub { display: flex; justify-content: flex-start; }
.forgot-password-link {
  border: none;
  background: transparent;
  color: var(--gold);
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  padding: 0;
  text-align: left;
  text-decoration: none;
}
.forgot-password-link:disabled { opacity: 0.6; cursor: not-allowed; }
.forgot-password-link:hover { color: var(--gold-light); }
.auth-notice { padding: 10px 12px; border-radius: 12px; background: rgba(13,148,136,0.06); border: 1px solid rgba(13,148,136,0.2); color: var(--ink-muted); font-size: 12px; line-height: 1.6; text-align: center; }

.qimen-profile-panel { position: relative; z-index: 42; padding: 14px 16px; overflow: visible; margin-bottom: 16px; }
.profile-switcher { position: relative; z-index: 60; }
.profile-switch-trigger {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper-soft);
  color: var(--ink);
  cursor: pointer;
}
.profile-switch-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-serif); font-size: 24px; letter-spacing: 1px; line-height: 1; }
.profile-switch-symbol { color: var(--gold); font-size: 24px; line-height: 1; opacity: .92; }
.profile-switcher.open .profile-switch-trigger { border-color: var(--gold-border); box-shadow: 0 0 0 3px var(--gold-dim); }
.profile-flyout { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 120; padding: 8px; border-radius: 16px; background: var(--bg-card); border: 1px solid var(--line); box-shadow: 0 12px 36px rgba(0,0,0,.12); }
.profile-flyout-item { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-radius: 12px; background: transparent; color: var(--text-primary); cursor: pointer; text-align: left; }
.profile-flyout-item + .profile-flyout-item { margin-top: 4px; }
.profile-flyout-item.active { background: rgba(212,175,55,0.1); box-shadow: inset 0 0 0 1px rgba(212,175,55,0.18); }
.profile-item-main { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.profile-item-date { color: #FF5E57; font-size: 12px; white-space: nowrap; }
.profile-item-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.add-bazi-profile-btn {
  width: 100%;
  min-height: 56px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper-soft);
  color: var(--gold);
  cursor: pointer;
  font-family: var(--font-serif);
  font-size: 22px;
  letter-spacing: 1px;
}
.add-bazi-profile-btn:hover { border-color: var(--gold-border); box-shadow: 0 0 0 3px var(--gold-dim); }

/* ── SSE Loader ── */
#loader { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 22px 4px 20px; }
.bagua-ring-wrap { position: relative; width: 96px; height: 96px; }
.bagua-ring-wrap::before { content:''; position:absolute; inset:-8px; border-radius:50%; background:radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 65%); animation: glow-pulse 4s ease-in-out infinite; pointer-events:none; }
@keyframes glow-pulse { 0%,100% { opacity:.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.18); } }
.bagua-svg { width:100%; height:100%; filter:drop-shadow(0 0 14px rgba(212,175,55,0.15)); }
.bagua-wheel { animation: wheel-spin 22s linear infinite; transform-origin: 60px 60px; }
.bagua-inner-g { animation: wheel-spin-rev 14s linear infinite; transform-origin: 60px 60px; }
@keyframes wheel-spin     { to { transform: rotate(360deg); } }
@keyframes wheel-spin-rev { to { transform: rotate(-360deg); } }

.loader-branch-badge { font-family:var(--font-serif); font-size:9.5px; letter-spacing:.18em; color:var(--gold-light); background:rgba(212,175,55,0.09); border:1px solid rgba(212,175,55,0.2); border-radius:20px; padding:2px 10px; opacity:0; transform:translateY(3px); transition:opacity .4s, transform .4s; pointer-events:none; }
.loader-branch-badge.visible { opacity:1; transform:translateY(0); }

/* Timeline */
.sse-timeline { position:relative; width:100%; padding-left:24px; }
.sse-spine { position:absolute; left:7px; top:8px; bottom:8px; width:1px; background:var(--line); border-radius:1px; overflow:hidden; }
.sse-spine-fill { position:absolute; top:0; left:0; width:100%; background:linear-gradient(to bottom, var(--gold), rgba(212,175,55,0.35)); border-radius:1px; transition:height .7s cubic-bezier(0.4,0,0.2,1); }

.sse-step { position:relative; margin-bottom:16px; animation:sse-step-in .45s cubic-bezier(0.4,0,0.2,1) both; }
.sse-step:last-child { margin-bottom:0; }
@keyframes sse-step-in { from { opacity:0; transform:translateX(-7px); } to { opacity:1; transform:translateX(0); } }
.sse-step:nth-child(1){animation-delay:.04s}.sse-step:nth-child(2){animation-delay:.10s}.sse-step:nth-child(3){animation-delay:.16s}
.sse-step:nth-child(4){animation-delay:.22s}.sse-step:nth-child(5){animation-delay:.28s}.sse-step:nth-child(6){animation-delay:.34s}
.sse-step:nth-child(7){animation-delay:.40s}

/* Dot */
.sse-dot { position:absolute; left:-20px; top:3px; width:13px; height:13px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all .35s cubic-bezier(0.4,0,0.2,1); }
.sse-step.pending .sse-dot { background:var(--paper-soft); border:1px solid var(--line); }
.sse-step.pending .sse-dot::after { content:''; width:4px; height:4px; border-radius:50%; background:var(--line); }
.sse-step.done .sse-dot { background:var(--gold-dim); border:1px solid var(--gold-border); }
.sse-step.done .sse-dot::after { content:'✓'; font-size:7px; color:var(--gold-light); line-height:1; }
.sse-step.active .sse-dot { background:rgba(212,175,55,0.18); border:1.5px solid var(--gold); box-shadow:0 0 0 3px rgba(212,175,55,0.09),0 0 11px rgba(212,175,55,0.28); animation:sse-dot-pulse 2.2s ease-in-out infinite; }
.sse-step.active .sse-dot::after { content:''; width:5px; height:5px; border-radius:50%; background:var(--gold); box-shadow:0 0 5px var(--gold); }
.sse-step.active .sse-dot::before { content:''; position:absolute; inset:-5px; border-radius:50%; border:1px solid rgba(212,175,55,0.28); animation:sse-pulse-ring 2.2s ease-out infinite; }
@keyframes sse-dot-pulse { 0%,100%{box-shadow:0 0 0 3px rgba(212,175,55,0.09),0 0 11px rgba(212,175,55,0.28);} 50%{box-shadow:0 0 0 5px rgba(212,175,55,0.14),0 0 18px rgba(212,175,55,0.44);} }
@keyframes sse-pulse-ring { 0%{opacity:.7;transform:scale(1);} 100%{opacity:0;transform:scale(2.2);} }

/* Step text */
.sse-step-name { font-family:var(--font-serif); font-size:12.5px; letter-spacing:.04em; line-height:1.4; transition:color .3s,font-size .3s; }
.sse-step-tag  { font-family:var(--font-body); font-size:10px; letter-spacing:.07em; transition:color .3s; }
.sse-step.pending .sse-step-name { color:var(--text-muted); opacity:.5; }
.sse-step.pending .sse-step-tag  { color:var(--text-muted); opacity:.35; }
.sse-step.done    .sse-step-name { color:var(--gold); }
.sse-step.done    .sse-step-tag  { color:rgba(181,141,59,.5); }
.sse-step.active  .sse-step-name { color:var(--ink); font-size:13px; }
.sse-step.active  .sse-step-tag  { color:var(--ink-muted); }

/* Detail + typing dots */
.sse-step-detail { font-size:10.5px; color:var(--text-muted); margin-top:2px; max-height:0; overflow:hidden; opacity:0; transition:max-height .35s cubic-bezier(0.4,0,0.2,1),opacity .35s; }
.sse-step.active .sse-step-detail { max-height:32px; opacity:1; }
.sse-typing-dots::after { content:'·'; animation:sse-dots3 1.5s steps(3,end) infinite; }
@keyframes sse-dots3 { 0%{content:'·';} 33%{content:'··';} 66%{content:'···';} }

/* Chip */
.sse-chip { display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:2px 8px; background:rgba(212,175,55,0.07); border:1px solid rgba(212,175,55,0.17); border-radius:20px; opacity:0; transform:translateY(3px); transition:opacity .4s .08s,transform .4s .08s; }
.sse-step.done .sse-chip { opacity:1; transform:translateY(0); }
.sse-chip-main { font-family:var(--font-serif); font-size:10px; color:var(--gold-light); letter-spacing:.05em; }
.sse-chip-sep { width:2px; height:2px; border-radius:50%; background:rgba(212,175,55,.32); flex-shrink:0; }
.sse-chip-sub  { font-family:var(--font-body); font-size:9.5px; color:var(--text-muted); opacity:.82; }

/* Progress row */
.sse-progress-row { width:100%; display:flex; align-items:center; gap:10px; }
.sse-progress-track { flex:1; height:1.5px; background:var(--line); border-radius:2px; overflow:hidden; }
.sse-progress-fill { height:100%; background:linear-gradient(90deg,var(--gold),var(--gold-light)); border-radius:2px; box-shadow:0 0 5px rgba(212,175,55,.32); transition:width .7s cubic-bezier(0.4,0,0.2,1); }
.sse-progress-pct { font-family:var(--font-serif); font-size:10.5px; color:rgba(212,175,55,.52); letter-spacing:.04em; min-width:28px; text-align:right; }

/* ── wenshi streaming area ── */
.wenshi-engine-result { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); }
.wenshi-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.wenshi-tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(201,166,107,0.35); color: var(--gold-light); background: rgba(201,166,107,0.08); letter-spacing: .04em; transition: opacity 0.3s; }
.wenshi-tag.score-pending { animation: wenShiScorePulse 1.6s ease-in-out infinite; }
@keyframes wenShiScorePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.wenshi-tags-skeleton { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.wenshi-tags-skeleton i { display: block; height: 20px; border-radius: 999px; background: linear-gradient(90deg, rgba(201,166,107,0.10), rgba(201,166,107,0.24), rgba(201,166,107,0.10)); background-size: 220% 100%; animation: wenShiSkeletonPulse 1.4s ease-in-out infinite; }
.wenshi-llm-skeleton { display: grid; gap: 7px; margin-top: 14px; }
.wenshi-llm-skeleton i { display: block; height: 10px; border-radius: 999px; background: linear-gradient(90deg, rgba(201,166,107,0.12), rgba(201,166,107,0.28), rgba(201,166,107,0.12)); background-size: 220% 100%; animation: wenShiSkeletonPulse 1.4s ease-in-out infinite; }
@keyframes wenShiSkeletonPulse { 0% { background-position: 0% 50%; } 100% { background-position: -220% 50%; } }
.wenshi-stream-prose { margin-top: 12px; font-size: 13.5px; line-height: 1.9; color: var(--text); white-space: pre-wrap; }
.wenshi-stream-prose.streaming { border-left: 2px solid rgba(201,166,107,0.38); padding-left: 10px; }

/* ── 流式脚手架：骨架 + 流式槽位 + 进场动画（浅色卡片用灰色微光骨架）── */
:deep(.wsk) { display: block; }
:deep(.wsk i) { display: block; height: 13px; margin: 9px 0; border-radius: 8px;
  background: linear-gradient(90deg, rgba(40,32,22,0.07), rgba(40,32,22,0.14), rgba(40,32,22,0.07));
  background-size: 220% 100%; animation: wenShiSkeletonPulse 1.3s ease-in-out infinite; }
:deep(.wsk i:nth-child(1)){ width: 92% } :deep(.wsk i:nth-child(2)){ width: 78% } :deep(.wsk i:nth-child(3)){ width: 60% }
/* 大骨架块（如行动建议整块） */
:deep(.wsk-block) { display: block; height: 96px; border-radius: 14px; margin: 4px 0 2px;
  background: linear-gradient(90deg, rgba(40,32,22,0.06), rgba(40,32,22,0.13), rgba(40,32,22,0.06));
  background-size: 220% 100%; animation: wenShiSkeletonPulse 1.3s ease-in-out infinite; }
:deep(.wstream-slot) { display: block; }
:deep(.wstream-slot.wstream-active::after) { content: "▍"; color: var(--theme-color, #b58d3b); margin-left: 1px; animation: wenShiCaret .9s steps(1) infinite; }
@keyframes wenShiCaret { 50% { opacity: 0 } }
:deep(.pan-skeleton .pan-grid .pan-cell) { display:flex; align-items:center; justify-content:center; }
:deep(.pan-skeleton .wsk i) { width: 60%; height: 40%; margin: 0; }
/* 进场：提交后切到结果页的卡片淡入上移 */
.html-container :deep(.wenshi-streaming) { animation: wenShiCardIn .5s cubic-bezier(.22,.61,.36,1); }
@keyframes wenShiCardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

/* ── 流式态 → 终态 的交叉淡入过渡（避免硬切突兀）── */
/* 终态覆盖层：在脚手架之上淡入，盖满后底层无声替换，全程底层不空 */
.result-wrapper{ position: relative; }
.result-overlay{ position: absolute; top: 0; left: 0; right: 0; z-index: 3; }
.ov-fade-enter-active{ transition: opacity .6s ease; }
.ov-fade-enter-from{ opacity: 0; }
/* 离场瞬时移除（此时底层已是相同终态，无感知） */
.ov-fade-leave-active{ transition: none; }
.ov-fade-leave-to{ opacity: 1; }

/* ── 持久能量球覆盖层（覆盖 hero 区，卡片切换不销毁）── */
.html-container{ position:relative; z-index:2; }
/* scaffold/终态卡片的 hero 背景透明，让下面的能量球层透出来 */
:deep(.wenshi-streaming .mag-hero), :deep(.wenshi-orb-mode .mag-hero){ background:transparent !important; }
:deep(.wenshi-orb-spacer){ background:transparent !important; }
.wenshi-orb-fx{ position:absolute; top:0; left:0; right:0; height:min(44svh,430px); z-index:1;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px;
  overflow:hidden; background:#f6f3ec; }
/* 粒子星盘：铺满 hero 区，置于色盘/状态之下；定格时淡出由 .wo-final 接管 */
.wenshi-orb-particles{ position:absolute; inset:0; z-index:0; pointer-events:none; }
.wenshi-orb-fx > .wenshi-orb{ z-index:1; }
/* 状态文字绝对贴底：与球体拉开间距，且不影响 .wenshi-orb 占位盒（定格 bloom 居中对齐） */
.wenshi-orb-fx > .wenshi-orb-status{ position:absolute; left:0; right:0; bottom:50px; z-index:2; justify-content:center; }
.wenshi-orb-fx.settling .wenshi-orb-particles{ opacity:0; transition:opacity .8s ease; }
/* .wenshi-orb：仅承载定格色盘 .wo-final，定格时放大 4.4x 化成 hero 渐变（粒子球见 WenshiOrb.vue） */
:deep(.wenshi-orb){ position:relative; width:200px; height:200px; border-radius:50%; isolation:isolate; transform:translateZ(0); transition:transform 1.7s cubic-bezier(.25,.1,.25,1); }
:deep(.wenshi-orb-status){ display:flex; align-items:center; gap:2px; font-size:14px; color:var(--muted, #8b8167); letter-spacing:.05em; }
:deep(.wenshi-orb-status .dots){ width:14px; text-align:left; }
:deep(.wenshi-orb-status .dots::after){ content:""; animation:woDots 1.4s steps(4,end) infinite; }
@keyframes woDots{ 0%{content:""} 25%{content:"·"} 50%{content:"··"} 75%{content:"···"} 100%{content:""} }
/* 终态色球：中心镂空的“光环”，膨胀时中心透出 hero 底色，与 hero 渐变（中心淡、四周有光晕）无缝对接。
   颜色取自 hero 主题色。默认透明，定格时淡入并随 wrapper 放大化开。 */
:deep(.wo-final){ position:absolute; inset:0; border-radius:50%; opacity:0; filter:blur(14px);
  -webkit-mask:radial-gradient(circle at 50% 50%, transparent 0%, transparent 14%, rgba(0,0,0,.55) 38%, #000 52%, rgba(0,0,0,.45) 70%, transparent 96%);
  mask:radial-gradient(circle at 50% 50%, transparent 0%, transparent 14%, rgba(0,0,0,.55) 38%, #000 52%, rgba(0,0,0,.45) 70%, transparent 96%);
  transition:opacity 1.4s ease, filter 1.6s ease; }
/* 日间：hero 主题光晕色（gold/teal/red）→ 透明 */
.wenshi-orb-fx.wo-tone-gold .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(212,175,55,.85), rgba(181,141,59,.5) 60%, transparent 100%); }
.wenshi-orb-fx.wo-tone-teal .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(13,148,136,.85), rgba(13,148,136,.45) 60%, transparent 100%); }
.wenshi-orb-fx.wo-tone-warn .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(200,74,69,.85), rgba(150,30,30,.5) 60%, transparent 100%); }
/* 八字喜用神五行色档 */
.wenshi-orb-fx.wo-tone-wood .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(47,157,110,.85), rgba(47,157,110,.45) 60%, transparent 100%); }
.wenshi-orb-fx.wo-tone-fire .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(200,74,69,.85), rgba(150,30,30,.5) 60%, transparent 100%); }
.wenshi-orb-fx.wo-tone-earth .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(212,175,55,.85), rgba(181,141,59,.5) 60%, transparent 100%); }
.wenshi-orb-fx.wo-tone-metal .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(220,205,160,.9), rgba(189,161,90,.5) 60%, transparent 100%); }
.wenshi-orb-fx.wo-tone-water .wo-final{ background:radial-gradient(circle at 50% 50%, rgba(90,150,210,.85), rgba(58,110,165,.5) 60%, transparent 100%); }

/* 定格过渡：球大幅放大到“球体不可见” + 模糊化开成 hero 渐变光晕（再由终态卡片自带渐变接管）*/
.wenshi-orb-fx.settling .wenshi-orb{ transform:scale(4.4) translateZ(0); }
/* 边缘溶解更深：更大模糊，化到接近 hero 渐变的柔散度 */
.wenshi-orb-fx.settling .wo-final{ opacity:1; filter:blur(78px); }
.wenshi-orb-fx.settling .wenshi-orb-status{ opacity:0; transition:opacity .4s ease; }

.result-actions { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 10px; margin-top: 16px; align-items: center; }
.reset-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 50px; background: var(--bg-card); border: 1px solid var(--line); border-radius: 14px; color: var(--text-muted); font-size: 13px; cursor: pointer; transition: border-color .2s, background .2s, color .2s; }
.reset-btn:hover { border-color: var(--gold-border); color: var(--ink); }
.result-save-img-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  min-width: 76px; height: 50px; padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(107,140,255,0.3);
  background: rgba(107,140,255,0.07);
  color: rgba(170,185,255,0.9);
  font-size: 13px; cursor: pointer;
  transition: border-color .2s, background .2s, color .2s, transform .15s;
  flex-shrink: 0;
}
.result-save-img-btn:hover { border-color: rgba(107,140,255,0.55); background: rgba(107,140,255,0.14); color: #fff; }
.result-save-img-btn:active { transform: scale(0.96); }
.result-save-img-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.result-save-img-btn.saving { color: rgba(170,185,255,0.7); }
@keyframes spin { to { transform: rotate(360deg); } }
.spin-icon { animation: spin 0.8s linear infinite; }
.result-feedback-btn { min-width: 76px; height: 50px; padding: 0 14px; border-radius: 14px; border: 1px solid rgba(232,204,128,0.28); background: rgba(212,175,55,0.07); color: var(--gold-light); font-size: 13px; cursor: pointer; transition: border-color .2s, background .2s, color .2s; flex-shrink: 0; }
.result-feedback-btn:hover { border-color: rgba(232,204,128,0.52); background: rgba(212,175,55,0.13); }
.result-feedback-btn.done { color: rgba(78,205,196,0.9); border-color: rgba(78,205,196,0.28); background: rgba(78,205,196,0.06); }

:deep(.bazi-result-stack) { --bazi-line: var(--line); --bazi-ink: var(--ink-muted); }
:deep(.bazi-summary-module) { border-color: var(--gold-border); background: var(--gold-dim); }
:deep(.bazi-mode-card) { border-color: var(--line); background: var(--paper-soft); }
:deep(.bazi-meta-row) { display:flex; flex-wrap:wrap; gap:7px; margin:8px 0 12px; }
:deep(.bazi-meta-row span) { padding:4px 8px; border-radius:8px; border:1px solid var(--line); color:var(--ink-muted); font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
:deep(.bazi-level-chip),
:deep(.bazi-score-chip) { min-width:76px; height:76px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-direction:column; border:1px solid var(--line); color:var(--gold); background:var(--gold-dim); font-family:var(--font-serif); font-size:26px; line-height:1; flex:0 0 auto; }
:deep(.bazi-score-chip span) { margin-top:5px; font-family:var(--font-body); font-size:11px; color:var(--text-muted); }
:deep(.bazi-level-chip.level-strong) { color:#0d9488; border-color:rgba(13,148,136,0.3); background:rgba(13,148,136,0.08); }
:deep(.bazi-level-chip.level-medium) { color:var(--gold); border-color:var(--gold-border); }
:deep(.bazi-level-chip.level-weak)   { color:#d97706; border-color:rgba(217,119,6,0.3); background:rgba(217,119,6,0.07); }
:deep(.bazi-level-chip.level-mixed)  { color:#7c3aed; border-color:rgba(124,58,237,0.3); background:rgba(124,58,237,0.07); }
:deep(.bazi-level-chip.level-unknown){ color:var(--text-muted); border-color:var(--line); }
:deep(.bazi-card-copy),
:deep(.bazi-logic) { margin:0; color:var(--ink-muted); font-size:14px; line-height:1.78; overflow-wrap:anywhere; }
:deep(.bazi-basis-summary) { margin:0 0 10px; color:var(--ink-muted); font-size:14px; line-height:1.75; overflow-wrap:anywhere; }
:deep(.bazi-signal-list),
/* ── bazi 新结构：复用 inference-flow/card/head 样式，仅补充差异部分 ── */
/* v2: summary.basis 底盘交代 */
:deep(.bazi-basis-text) { margin:10px 0 0; color:var(--ink-dim); font-size:13px; line-height:1.75; overflow-wrap:anywhere; padding:10px 12px; background:rgba(181,141,59,0.05); border-left:2px solid rgba(181,141,59,0.3); border-radius:0 6px 6px 0; }
:deep(.bazi-panel-anchor) { margin-bottom:28px; }
:deep(.bazi-foundation-block) { margin:0 0 26px; }
:deep(.bazi-bf-title) { margin:0 0 12px; color:var(--ink,#1a1a1a); font-size:16px; font-weight:700; line-height:1.4; }
:deep(.bazi-bf-signals) { display:grid; border-top:1px solid var(--line); }
:deep(.bazi-bf-signal-row) { display:grid; grid-template-columns:minmax(110px,0.8fr) minmax(0,1.7fr); gap:14px; padding:10px 0; border-bottom:1px solid var(--line); }
:deep(.bazi-bf-signal-label) { color:var(--gold,#B58D3B); font-size:12px; font-weight:700; line-height:1.55; }
:deep(.bazi-bf-signal-detail) { color:var(--ink-muted); font-size:12.5px; line-height:1.65; overflow-wrap:anywhere; }
:deep(.bazi-target-state-list) { display:grid; border-top:1px solid var(--line); }
:deep(.bazi-target-state-row) { display:grid; grid-template-columns:minmax(110px,0.8fr) minmax(0,1.7fr); gap:14px; padding:11px 0; border-bottom:1px solid var(--line); }
:deep(.bazi-target-state-row h4) { margin:0; color:var(--gold,#B58D3B); font-size:12px; font-weight:700; line-height:1.55; }
:deep(.bazi-target-state-row p) { margin:0; color:var(--ink-muted); font-size:12.5px; line-height:1.65; overflow-wrap:anywhere; }
@media(max-width:520px) {
  :deep(.bazi-bf-signal-row),
  :deep(.bazi-target-state-row) { grid-template-columns:1fr; gap:4px; }
}
/* v2: phenomena 行（liunian_trigger / timing window） */
:deep(.bazi-phenomena-rows) { display:flex; flex-direction:column; gap:5px; margin-top:8px; padding-top:8px; border-top:1px solid var(--line); }
:deep(.bazi-ph-row) { display:flex; align-items:baseline; gap:8px; font-size:12px; line-height:1.5; flex-wrap:wrap; }
:deep(.bazi-ph-tag) { font-weight:700; color:var(--theme-color,#B58D3B); white-space:nowrap; flex-shrink:0; font-size:11.5px; }
:deep(.bazi-ph-explain) { color:var(--ink-dim); flex:1; min-width:0; overflow-wrap:anywhere; }
/* inference-card tone variants for bazi */
:deep(.bazi-infer-mirror .inference-head span) { color:#7C6FBF; }
:deep(.bazi-infer-mirror h4) { font-style:italic; color:var(--ink,#1a1a1a) !important; }
:deep(.bazi-infer-positive .inference-head span) { color:#0d9488; }
:deep(.bazi-infer-positive h4) { color:#0d9488; }
:deep(.bazi-infer-outcome .inference-head span) { color:#0d9488; }
:deep(.bazi-infer-muted h4) { font-size:12px; color:var(--ink-dim); font-weight:400; }
/* quality color for timing window */
:deep(.quality-strong) { color:#0d9488; }
:deep(.quality-medium) { color:#B58D3B; }
:deep(.quality-weak)   { color:#d97706; }
:deep(.bazi-mechanisms) { margin:6px 0 0; color:var(--ink-dim); font-size:13px; line-height:1.6; }
/* 大运主要现象（rhythm phenomenon）：策略 h4 之上的气候定性引导句 */
:deep(.bazi-rhythm-phenomenon) { margin:0 0 6px; color:var(--ink-dim); font-size:13px; line-height:1.6; }
/* 时间线流年行 */
:deep(.bazi-liunian-block) { display:grid; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
:deep(.bazi-liunian-row) { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
:deep(.bazi-liunian-gz) { font-size:14px; font-weight:700; color:var(--theme-color); min-width:68px; font-family:var(--font-serif); }
:deep(.bazi-liunian-ss) { font-size:11px; color:var(--text-muted); padding:1px 5px; border-radius:3px; border:1px solid var(--line); white-space:nowrap; }
:deep(.bazi-liunian-note) { font-size:13px; color:var(--ink-muted); line-height:1.55; flex:1; min-width:0; overflow-wrap:anywhere; }
/* timing flow 复用 inference-flow */
:deep(.bazi-timing-flow) { display:flex; flex-direction:column; gap:0; border-top:1px solid var(--line); margin-top:16px; }
/* ── 路径推演（多路径对比）：悬浮阴影卡，与 panel 同一设计语言 ── */
:deep(.bazi-path-block) { margin-top:20px; padding-top:16px; border-top:1px dashed var(--gold-border, rgba(181,141,59,0.35)); }
:deep(.bazi-path-title) { margin:0 0 14px; font-size:13px; font-weight:700; letter-spacing:.08em; color:var(--gold, #b5893b); }
:deep(.bazi-path-grid) { display:flex; flex-direction:column; gap:14px; }
:deep(.bazi-path-card) {
  border:1px solid rgba(181,141,59,0.10);
  border-radius:16px; background:var(--bg-card); padding:16px 18px;
  box-shadow:0 4px 20px rgba(0,0,0,0.10);
}
[data-theme="dark"] :deep(.bazi-path-card) {
  background:rgba(212,175,55,0.06); border-color:rgba(212,175,55,0.14);
  box-shadow:0 6px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.06);
}
:deep(.bazi-path-head) { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
:deep(.bazi-path-badge) { font-size:11px; font-weight:700; letter-spacing:.06em; color:#fff; background:var(--gold, #b5893b); border-radius:6px; padding:3px 9px; white-space:nowrap; }
[data-theme="dark"] :deep(.bazi-path-badge) { background:#b8923f; color:#1a1a1a; }
:deep(.bazi-path-name) { font-size:15px; font-weight:700; color:var(--ink-main, inherit); }
:deep(.bazi-path-rows) { display:grid; gap:7px; }
:deep(.bazi-path-row) { display:flex; gap:8px; font-size:13px; line-height:1.6; }
:deep(.bazi-path-k) { flex-shrink:0; min-width:48px; font-weight:600; color:var(--gold, #b5893b); }
:deep(.bazi-path-v) { flex:1; min-width:0; color:var(--ink-muted); overflow-wrap:anywhere; }
:deep(.bazi-path-risk) .bazi-path-k { color:#b91c1c; }
[data-theme="dark"] :deep(.bazi-path-risk) .bazi-path-k { color:#f87171; }
:deep(.bazi-action-intro) { margin:0 0 14px; color:var(--ink-muted); font-size:14px; line-height:1.75; overflow-wrap:anywhere; }
:deep(.bazi-action-list) { border-top:1px solid var(--line); }
/* signal-list tags 保留（profile_driven structural_supports 等仍可能用到）*/
:deep(.bazi-signal-list),
:deep(.bazi-evidence-list) { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
:deep(.bazi-signal-list span),
:deep(.bazi-evidence-list span) { padding:5px 9px; border-radius:999px; border:1px solid var(--line); color:var(--ink-muted); font-size:12px; line-height:1.4; overflow-wrap:anywhere; }
:deep(.bazi-signal-list.positive span) { border-color:rgba(13,148,136,0.25); background:rgba(13,148,136,0.06); color:#0d9488; }
:deep(.bazi-signal-list.warning span) { border-color:rgba(217,119,6,0.22); background:rgba(217,119,6,0.06); color:#d97706; }
/* capacity row */
:deep(.bazi-capacity-row) { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
:deep(.capacity-label) { font-size:11px; color:var(--text-muted); }
:deep(.capacity-level) { font-size:14px; font-family:var(--font-serif); color:var(--gold); }
:deep(.capacity-level.level-strong) { color:#0d9488; }
:deep(.capacity-level.level-weak) { color:#d97706; }
:deep(.capacity-level.level-mixed) { color:#7c3aed; }
.backing-identity {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(212,175,55,0.2);
}
.backing-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.backing-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.backing-name {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--gold);
  letter-spacing: 2px;
  font-weight: bold;
}
.backing-meta {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
}
.backing-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.5px;
}
.badge-blue {
  background: rgba(59,130,246,0.08);
  color: #2563eb;
  border: 1px solid rgba(59,130,246,0.22);
}
.badge-gold {
  background: var(--gold-dim);
  color: var(--gold);
  border: 1px solid var(--gold-border);
}
:deep(.bazi-portrait-block) { padding:12px; border-radius:10px; border:1px solid var(--line); background:var(--paper-soft); margin-top:10px; }
:deep(.portrait-label) { font-size:11px; color:var(--text-muted); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
:deep(.confidence-badge) { font-size:9px; padding:2px 5px; border-radius:4px; background:var(--paper-soft); color:var(--ink-muted); border:1px solid var(--line); }
:deep(.bazi-portrait-block p) { margin:0; color:var(--ink-muted); font-size:14px; line-height:1.74; overflow-wrap:anywhere; }
:deep(.bazi-disclaimer) { font-size:11px; color:var(--text-muted); font-style:italic; margin-top:8px; line-height:1.6; }
:deep(.bazi-timing-window-card.quality-strong) { border-color:rgba(13,148,136,0.28); background:rgba(13,148,136,0.04); }
:deep(.bazi-timing-window-card.quality-medium) { border-color:var(--gold-border); }
:deep(.bazi-timing-window-card.quality-weak)   { border-color:var(--line); }
:deep(.major-window-badge) { font-size:10px; padding:2px 6px; border-radius:6px; background:var(--gold-dim); color:var(--gold); margin-left:6px; }

/* 分享图弹窗 */
.share-img-overlay {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.82);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  opacity: 0; pointer-events: none;
  transition: opacity .25s ease;
  padding: 16px;
}
.share-img-overlay.show { opacity: 1; pointer-events: auto; }
.share-img-modal {
  width: min(460px, 100%);
  max-height: 90dvh;
  display: flex; flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0,0,0,.18);
  transform: translateY(12px) scale(0.98);
  transition: transform .28s cubic-bezier(.22,1,.36,1);
}
.share-img-overlay.show .share-img-modal { transform: none; }
.share-img-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.share-img-kicker { font-size: 9px; color: var(--text-muted); letter-spacing: .2em; }
.share-img-title { flex: 1; font-family: var(--font-serif); font-size: 15px; color: var(--gold); }
.share-img-close {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--paper-soft);
  color: var(--text-muted); font-size: 20px; line-height: 1;
  cursor: pointer; transition: color .2s, background .2s;
}
.share-img-close:hover { color: var(--ink); background: var(--paper-soft); }
.share-img-body {
  flex: 1; overflow-y: auto;
  padding: 14px;
  display: flex; align-items: flex-start; justify-content: center;
}
.share-img-preview {
  width: 100%; border-radius: 10px;
  display: block;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  -webkit-user-select: none;
  user-select: none;
}


@media(max-width:380px) {
  .result-actions { grid-template-columns: 1fr 1fr; }
  .reset-btn { grid-column: 1 / -1; }
  .result-save-img-btn, .result-feedback-btn { width: 100%; }
}

.feedback-overlay { position: fixed; inset: 0; z-index: 9998; display: flex; justify-content: flex-end; background: rgba(0,0,0,0.55); opacity: 0; pointer-events: none; transition: opacity .25s ease; }
.feedback-overlay.show { opacity: 1; pointer-events: auto; }
.feedback-drawer { width: min(420px, 92vw); height: 100%; padding: 24px 22px; overflow-y: auto; background: var(--bg-card); border-left: 1px solid var(--line); box-shadow: -8px 0 24px rgba(0,0,0,.12); transform: translateX(18px); transition: transform .28s var(--ease); }
.feedback-overlay.show .feedback-drawer { transform: translateX(0); }
.feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.feedback-kicker { font-size: 10px; color: var(--text-muted); letter-spacing: .22em; margin-bottom: 7px; }
.feedback-head h3 { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 500; color: var(--gold); line-height: 1.35; }
.feedback-close { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line); background: var(--paper-soft); color: var(--text-muted); font-size: 22px; line-height: 1; cursor: pointer; }
.feedback-summary { padding: 14px 15px; border: 1px solid var(--gold-border); border-radius: 14px; background: var(--gold-dim); margin-bottom: 18px; }
.feedback-question { font-size: 14px; color: var(--ink); line-height: 1.65; overflow-wrap: anywhere; }
.feedback-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 10px; color: var(--text-muted); }
.feedback-conclusion { margin: 11px 0 0; padding-top: 11px; border-top: 1px solid var(--line); color: var(--gold); font-size: 13px; line-height: 1.65; }
.feedback-form { display: flex; flex-direction: column; gap: 18px; }
.feedback-field { display: flex; flex-direction: column; gap: 10px; }
.feedback-label { display: flex; align-items: center; justify-content: space-between; color: var(--ink); font-size: 12px; letter-spacing: .08em; }
.feedback-label span { color: var(--text-muted); font-size: 10px; letter-spacing: 0; }
.feedback-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.feedback-option { min-height: 40px; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg-card); color: var(--ink-muted); font-size: 13px; cursor: pointer; transition: border-color .2s, background .2s, color .2s; }
.feedback-option.active { border-color: var(--gold-border); background: var(--gold-dim); color: var(--gold); }
.feedback-note { min-height: 98px; padding: 12px 13px; border-radius: 12px; font-family: var(--font-body); font-size: 13px; line-height: 1.7; }
.feedback-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; margin-top: 22px; }
.feedback-secondary, .feedback-primary { min-height: 44px; border-radius: 12px; font-size: 14px; cursor: pointer; }
.feedback-secondary { border: 1px solid var(--line); background: var(--paper-soft); color: var(--text-muted); }
.feedback-primary { border: none; background: linear-gradient(135deg, #c9a44e 0%, #9d7a2f 100%); color: white; font-weight: 700; }
.feedback-primary:disabled { opacity: .55; cursor: not-allowed; }

@media(max-width:560px) {
  .page-wrap {
    width: 100%;
    max-width: 100%;
    padding: 76px 14px 54px;
    overflow-x: hidden;
    box-sizing: border-box;
  }
  .result-page-wrap { padding-top: 0; padding-left: 0; padding-right: 0; }
  .public-landing-container {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .mobile-auth-first {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .seo-landing {
    display: none;
  }
  .seo-faq-section {
    display: none;
  }
  .feedback-overlay { align-items: flex-end; justify-content: center; }
  .feedback-drawer { width: 100%; height: auto; max-height: 88vh; border-left: none; border-top: 1px solid var(--gold-border); border-radius: 20px 20px 0 0; transform: translateY(24px); }
  .feedback-overlay.show .feedback-drawer { transform: translateY(0); }
  .auth-hero { min-height: 220px; padding-bottom: 28px; }
  .auth-taiji-wrap { display: block; }
  .hero-name { font-size: 44px; }
  .afm-title { font-size: 32px; }
  .qimen-profile-panel { padding: 12px 14px; }
  .profile-switch-trigger,
  .add-bazi-profile-btn { min-height: 52px; }
  .profile-switch-name { font-size: 20px; }
  .profile-switch-symbol { font-size: 21px; }
  .profile-flyout-item { grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 11px 12px; }
  .profile-item-date,
  .profile-item-meta { font-size: 11px; }
}

.route-info-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.58); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); z-index: 9999; display: none; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity .25s; }
.route-info-overlay.show { display: flex; opacity: 1; }
.route-info-card { width: min(420px, 100%); background: var(--bg-card); border: 1px solid var(--line); border-radius: 18px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,.15); }
.route-info-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--line); color: var(--gold); font-family: var(--font-serif); font-size: 15px; }
.route-info-close { border: none; background: transparent; color: var(--text-muted); font-size: 22px; line-height: 1; cursor: pointer; padding: 0 2px; }
.route-info-close:hover { color: var(--gold); }
.route-info-grid { display: flex; flex-direction: column; gap: 10px; }
.route-info-row { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper-soft); }
.route-tool { color: var(--gold); font-weight: 700; font-size: 13px; letter-spacing: 1px; }
.route-focus { color: var(--ink); font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.route-info-row p { margin: 0; color: var(--ink-muted); font-size: 12px; line-height: 1.55; }
.route-quota-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper-soft); }
.rq-label { color: var(--ink-muted); font-size: 12px; white-space: nowrap; }
.rq-count { display: flex; align-items: center; gap: 5px; }
.rq-pip { width: 9px; height: 9px; border-radius: 50%; background: var(--gold); opacity: 0.9; flex-shrink: 0; }
.rq-pip--used { background: rgba(255,255,255,0.15); opacity: 1; }
.rq-text { color: var(--gold); font-size: 12px; font-weight: 600; letter-spacing: .02em; margin-left: 2px; }
.rq-loading { color: var(--text-muted); font-size: 12px; }
.rq-guest { color: var(--text-muted); font-size: 12px; }
.route-info-note { margin-top: 12px; padding: 11px 12px; border-left: 3px solid var(--gold); border-radius: 10px; background: var(--gold-dim); color: var(--ink-muted); font-size: 12px; line-height: 1.55; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes riseIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
@keyframes rotateBagua { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes shimmer { 0% { background-position: 100% 50%; } 50% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }

/* ══ v-html 结果区样式 — 独立模块、手机端优先 ══ */
:deep(.result-stack) { display:flex; flex-direction:column; gap:14px; margin-bottom:16px; }
:deep(.result-module) {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 6px rgba(0,0,0,.06);
}
:deep(.summary-module) { display:flex; flex-direction:column; gap:12px; }
:deep(.summary-top) { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:start; }
:deep(.summary-main) { min-width:0; display:flex; flex-direction:column; gap:10px; }
:deep(.summary-title) { font-size:12px; color:var(--text-muted); letter-spacing:2px; }
:deep(.summary-score-bubble) {
  min-width:84px;
  display:flex; align-items:flex-end; justify-content:center; gap:3px;
  padding:12px 12px 10px; line-height:1;
  background:var(--paper-soft);
  border:1px solid var(--line);
  border-radius:18px;
}
:deep(.score) {
  color:var(--theme-color,#b58d3b); font-family:var(--font-serif); font-weight:700; font-size:42px; letter-spacing:0;
}
:deep(.score-unit) { color:var(--gold); font-family:var(--font-serif); font-size:18px; line-height:1.2; }
:deep(.summary-judgement) { display:flex; flex-direction:column; align-items:flex-start; gap:10px; min-width:0; }
:deep(.verdict-badge) { display:inline-flex; font-family:var(--font-serif); font-size:14px; padding:4px 13px; border-radius:999px; letter-spacing:.08em; border:1px solid; }
:deep(.verdict-da-ji) { color:#00D26A; background:rgba(0,210,106,0.06); border-color:rgba(0,210,106,0.2); text-shadow:0 0 14px rgba(0,210,106,0.35); }
:deep(.verdict-xiao-ji) { color:var(--teal); background:rgba(78,205,196,0.06); border-color:rgba(78,205,196,0.2); }
:deep(.verdict-ping) { color:var(--gold-light); background:rgba(212,175,55,0.06); border-color:rgba(212,175,55,0.2); }
:deep(.verdict-da-xiong) { color:var(--crimson); background:rgba(255,94,87,0.06); border-color:rgba(255,94,87,0.2); }
:deep(.conclusion) { font-family:var(--font-serif); font-size:23px; color:var(--ink); line-height:1.5; letter-spacing:0; }
:deep(.keyword-highlight) {
  display:flex;
  align-items:center;
  gap:10px;
  width:fit-content;
  max-width:100%;
  padding:8px 12px;
  border-radius:12px;
  background:var(--paper-soft);
  border:1px solid var(--line);
  box-shadow:0 0 18px var(--theme-color-dim,rgba(179,139,54,0.12));
  line-height:1.55;
}
:deep(.keyword-label) {
  flex-shrink:0;
  font-size:10px;
  color:var(--gold);
  letter-spacing:1.4px;
}
:deep(.keyword-text) {
  font-size:13px;
  color:var(--ink-muted);
  overflow-wrap:anywhere;
}
:deep(.question-bubble) {
  width:100%;
  padding:12px 14px;
  background:var(--paper-soft);
  border:1px solid var(--line);
  border-radius:14px;
  box-sizing:border-box;
}
:deep(.question-text) { font-size:14px; color:var(--ink-muted); font-style:normal; line-height:1.7; overflow-wrap:anywhere; }
:deep(.ai-header-title) {
  font-family: var(--font-serif);
  color: var(--gold);
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
:deep(.ai-header-title)::before { content: '✧'; font-size: 12px; }
:deep(.action-grid) { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
:deep(.action-step) { min-width:0; padding:13px 13px 14px; border-radius:14px; background:var(--paper-soft); border:1px solid var(--line); }
:deep(.action-index) { font-family:var(--font-serif); font-size:20px; color:var(--gold); margin-bottom:8px; }
:deep(.action-copy) { font-size:13px; color:var(--ink-muted); line-height:1.65; overflow-wrap:anywhere; }
/* 领域判断 */
:deep(.domain-view-module) { border-color:var(--line); background:var(--bg-card); }
:deep(.domain-axis-grid) { display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:10px; }
:deep(.domain-axis-card) { position:relative; min-width:0; min-height:148px; padding:13px 13px 34px; border-radius:12px; background:var(--paper-soft); border:1px solid var(--line); overflow:hidden; overflow-wrap:anywhere; }
:deep(.domain-axis-card::before) { content:''; position:absolute; inset:0 auto 0 0; width:3px; background:var(--gold); opacity:.75; }
:deep(.domain-axis-card.tone-positive::before) { background:#0d9488; }
:deep(.domain-axis-card.tone-warning::before) { background:#dc2626; }
:deep(.domain-axis-top) { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
:deep(.domain-axis-label) { font-size:11px; color:var(--text-muted); letter-spacing:1.2px; }
:deep(.domain-axis-symbol) { flex-shrink:0; font-family:var(--font-serif); font-size:15px; color:var(--gold); }
:deep(.domain-axis-verdict) { font-size:13px; color:var(--ink); line-height:1.55; margin-bottom:8px; }
:deep(.domain-axis-evidence) { font-size:12px; color:var(--ink-muted); line-height:1.6; }
:deep(.domain-axis-tone) { position:absolute; right:10px; bottom:9px; width:24px; height:24px; border-radius:50%; display:grid; place-items:center; font-size:11px; color:white; background:var(--gold); font-weight:700; }
:deep(.domain-axis-card.tone-positive .domain-axis-tone) { background:#0d9488; }
:deep(.domain-axis-card.tone-warning .domain-axis-tone) { background:#dc2626; }
:deep(.domain-section-grid) { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:10px; }
:deep(.domain-mini-card) { min-width:0; padding:12px 13px; border-radius:12px; background:var(--paper-soft); border:1px solid var(--line); overflow-wrap:anywhere; }
:deep(.domain-mini-label) { display:flex; justify-content:space-between; gap:8px; margin-bottom:8px; font-size:11px; color:var(--gold); letter-spacing:1px; }
:deep(.domain-mini-label span) { color:var(--text-muted); letter-spacing:0; text-align:right; }
:deep(.domain-mini-body) { font-size:13px; color:var(--ink-muted); line-height:1.65; }
:deep(.domain-mini-evidence) { margin-top:7px; font-size:12px; color:var(--text-muted); line-height:1.55; }
:deep(.domain-decision) { display:grid; gap:8px; margin-top:10px; }
:deep(.domain-decision div) { display:flex; gap:9px; align-items:flex-start; padding:10px 12px; border-radius:10px; background:var(--paper-soft); color:var(--ink-muted); font-size:13px; line-height:1.65; overflow-wrap:anywhere; }
:deep(.domain-decision span) { flex:0 0 auto; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; background:var(--gold-dim); color:var(--gold); font-size:11px; font-weight:700; }
/* 九宫格 — 浅色古籍风格 */
:deep(.pan-wrapper) { background:transparent; border:0; border-radius:0; padding:0; position:relative; overflow:visible; }
:deep(.pan-header) { text-align:center; margin-bottom:12px; }
:deep(.pan-pillars) { font-family:var(--font-body); font-size:14px; font-weight:600; color:var(--ink); letter-spacing:.08em; margin-bottom:5px; }
:deep(.pan-info) { font-size:11px; color:var(--text-muted); line-height:1.75; }
:deep(.pan-info b) { color:var(--gold); font-weight:600; }
:deep(.pan-grid) { display:grid; grid-template-columns:repeat(3,1fr); gap:0; background:var(--line); border-radius:0; overflow:hidden; border:1px solid var(--line); }
:deep(.pan-cell) { background:var(--paper); aspect-ratio:1; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:background .2s; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
:deep(.pan-cell:nth-child(3n)) { border-right:none; }
:deep(.pan-cell:nth-child(n+7)) { border-bottom:none; }
:deep(.pan-cell:hover) { background:var(--paper-soft); }
:deep(.pan-center-earth) { font-size:30px; font-weight:900; color:rgba(11,11,11,0.1); font-family:'Noto Serif SC',serif; }
:deep(.pan-god) { position:absolute; top:5px; font-size:13px; color:var(--text-muted); font-family:'Noto Serif SC',serif; }
:deep(.pan-star) { font-size:15px; color:var(--ink-muted); margin-bottom:1px; z-index:2; font-family:'Noto Serif SC',serif; }
:deep(.pan-door) { font-size:19px; font-weight:700; color:var(--ink); z-index:2; font-family:'Noto Serif SC',serif; }
:deep(.pan-stem) { position:absolute; font-size:14px; font-weight:600; font-family:'Noto Serif SC',serif; }
:deep(.stem-sky) { top:5px; left:6px; color:var(--ink); }
:deep(.stem-earth) { bottom:5px; right:6px; color:var(--ink-muted); }
:deep(.ji-sky) { top:18px; left:6px; font-size:8px; color:var(--text-muted); }
:deep(.ji-earth) { bottom:18px; right:6px; font-size:8px; color:var(--text-muted); }
:deep(.pan-marks) { position:absolute; bottom:4px; left:4px; display:flex; gap:2px; z-index:3; }
:deep(.pan-mark) { font-size:8px; padding:1px 3px; border-radius:3px; font-weight:700; }
:deep(.mark-ma) { background:var(--gold); color:white; }
:deep(.mark-kong) { border:1px solid var(--line); color:var(--text-muted); background:var(--paper-soft); }
:deep(.highlight-text) { color:var(--gold) !important; }
/* 单列洞察条 */
:deep(.insight-flow) { display:flex; flex-direction:column; gap:10px; }
:deep(.insight-strip) { position:relative; padding:14px 16px 14px 18px; background:var(--paper-soft); border:1px solid var(--line); border-radius:12px; border-left:3px solid var(--line); transition:border-color .3s, transform .25s; }
:deep(.insight-strip:hover) { transform:translateY(-1px); box-shadow:0 2px 12px rgba(0,0,0,.06); }
:deep(.insight-strip-label) { font-size:10px; color:var(--text-muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; font-weight:500; }
:deep(.insight-strip-body) { font-size:13px; color:var(--ink-muted); line-height:1.75; }
:deep(.accent-theme) { border-left-color:var(--gold); }
:deep(.accent-theme .insight-strip-label) { color:var(--gold); }
:deep(.accent-amber) { border-left-color:#d97706; }
:deep(.accent-amber .insight-strip-label) { color:#d97706; }
:deep(.accent-indigo) { border-left-color:#4f46e5; }
:deep(.accent-indigo .insight-strip-label) { color:#4f46e5; }
:deep(.accent-gold) { border-left-color:var(--gold); }
:deep(.accent-gold .insight-strip-label) { color:var(--gold); }
:deep(.accent-violet) { border-left-color:#7c3aed; }
:deep(.accent-violet .insight-strip-label) { color:#7c3aed; }
:deep(.accent-teal) { border-left-color:var(--teal); }
:deep(.accent-teal .insight-strip-label) { color:var(--teal); }
:deep(.accent-neutral) { border-left-color:var(--line); }
/* 评分依据 */
:deep(.score-basis-body) { display:flex; flex-direction:column; gap:10px; margin-top:4px; }
:deep(.sb-row) { display:flex; flex-direction:column; gap:6px; }
:deep(.sb-row-title) { font-size:9px; color:var(--text-muted); font-weight:600; letter-spacing:1.5px; }
:deep(.sb-tags) { display:flex; flex-wrap:wrap; gap:6px; }
:deep(.sb-tag) { font-size:11px; padding:3px 10px; border-radius:20px; font-weight:500; transition:transform .2s; }
:deep(.sb-tag:hover) { transform:scale(1.05); }
:deep(.sb-tag.positive) { background:rgba(13,148,136,0.08); color:#0d9488; border:1px solid rgba(13,148,136,0.2); }
:deep(.sb-tag.negative) { background:rgba(220,38,38,0.07); color:#dc2626; border:1px solid rgba(220,38,38,0.18); }
:deep(.sb-logic) { font-size:12px; color:var(--ink-muted); line-height:1.7; padding:10px 12px; background:var(--paper-soft); border-radius:8px; border-left:2px solid var(--gold-border); }
:deep(.accent-ge) { border-left-color:var(--gold-border); }
:deep(.accent-ge .insight-strip-label) { color:var(--gold); }
:deep(.ge-tags-row) { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
:deep(.ge-tag) { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; cursor:pointer; white-space:nowrap; user-select:none; transition:transform .2s; }
:deep(.ge-tag:hover) { transform:scale(1.05); }
:deep(.ge-tag.ji) { background:var(--gold-dim); border:1px solid var(--gold-border); color:var(--gold); }
:deep(.ge-tag.xiong) { background:rgba(220,38,38,0.07); border:1px solid rgba(220,38,38,0.2); color:#dc2626; }
:deep(.ge-dot) { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
:deep(.ge-tag.ji .ge-dot) { background:var(--gold); }
:deep(.ge-tag.xiong .ge-dot) { background:#dc2626; }
/* 有名格 modal */
:global(.ge-overlay) {
  position:fixed; inset:0; z-index:9998;
  background:rgba(0,0,0,0.35);
  backdrop-filter:blur(4px);
  opacity:0; pointer-events:none;
  transition:opacity .2s ease;
}
:global(.ge-overlay.visible) { opacity:1; pointer-events:auto; }
:global(.ge-modal) {
  position:fixed; z-index:9999;
  top:50%; left:50%;
  transform:translate(-50%,-46%) scale(0.96);
  background:rgba(247,244,238,0.98);
  border:1px solid rgba(58,45,28,0.14);
  border-radius:8px;
  padding:20px 22px 22px;
  width:min(340px, calc(100vw - 48px));
  box-shadow:0 16px 42px rgba(42,31,17,.18);
  opacity:0; pointer-events:none;
  transition:opacity .2s ease, transform .25s cubic-bezier(0.34,1.56,0.64,1);
}
:global(.ge-modal.visible) { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
:global(.ge-modal-close) {
  position:absolute; top:12px; right:14px;
  width:26px; height:26px; padding:0;
  background:none; border:none;
  color:var(--text-muted, #777b80); font-size:15px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:color .15s;
}
:global(.ge-modal-close:hover) { color:var(--ink, #0b0b0b); }
:global(.ge-pop-kicker) {
  color:var(--text-muted, #777b80);
  font-size:11px;
  font-weight:700;
  letter-spacing:.12em;
  margin-bottom:8px;
}
:global(.ge-pop-name) { font-family:var(--font-display); font-size:22px; line-height:1.25; font-weight:850; letter-spacing:0; margin-bottom:9px; padding-right:24px; }
:global(.ge-pop-name.ji) { color:#0d9488; }
:global(.ge-pop-name.xiong) { color:#dc2626; }
:global(.ge-pop-divider) { height:1px; background:var(--line, rgba(11,11,11,.12)); margin:12px 0 14px; }
:global(.ge-pop-text) { font-size:14px; line-height:1.8; color:var(--ink-muted, #55595d); font-family:var(--font-body); }
/* 策略与风险 */
:deep(.strategy-list) { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
:deep(.strategy-list li) { position:relative; padding:12px 14px 12px 36px; background:var(--paper-soft); border:1px solid var(--line); border-radius:10px; color:var(--ink-muted); font-size:13px; line-height:1.7; transition:border-color .25s,background .25s; }
:deep(.strategy-list li:hover) { border-color:var(--gold-border); }
:deep(.strategy-list li)::before { content:"\2726"; position:absolute; left:14px; top:13px; color:var(--gold); font-size:10px; }
:deep(.risk-alert) { background:rgba(220,38,38,0.04); border:1px solid rgba(220,38,38,0.15); border-left:3px solid #dc2626; border-radius:10px; padding:14px 16px; }
:deep(.risk-alert-content) { color:var(--ink-muted); font-size:13px; line-height:1.7; }
/* 底部吉运 */
:deep(.footer) { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
:deep(.f-item) { min-width:0; display:flex; flex-direction:column; gap:6px; padding:12px; border-radius:12px; background:var(--paper-soft); border:1px solid var(--line); }
:deep(.f-label) { font-size:10px; color:var(--text-muted); letter-spacing:1px; }
:deep(.f-text) { font-size:12px; font-weight:600; color:var(--gold); line-height:1.5; overflow-wrap:anywhere; }
/* 渐显 */
:deep(.reveal) { opacity:0; transform:translateY(14px); transition:opacity .6s ease,transform .6s ease; }
:deep(.reveal.visible) { opacity:1; transform:none; }
@keyframes glowPulse { 0%,100% { box-shadow:0 0 16px var(--theme-color-dim,rgba(179,139,54,0.12)); } 50% { box-shadow:0 0 28px var(--theme-color-dim,rgba(179,139,54,0.25)); } }
@keyframes floatIcon { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
@media(max-width:400px) {
  :deep(.summary-top) { grid-template-columns:1fr; }
  :deep(.summary-score-bubble) { min-width:96px; justify-self:start; }
  :deep(.conclusion) { font-size:21px; }
  :deep(.footer) { grid-template-columns:1fr; }
  :deep(.score) { font-size:38px; }
}

/* ══ 奇门报告：总判 Hero + M1-M4 ══ */
:deep(.mag-result) {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  font-family: var(--font-body);
  color: var(--ink);
}

/* ── 追问增补块：圆角矩形玻璃卡片（对齐 BaziPanel），带弹出动画 ── */
:deep(.mag-followup-list) { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
:deep(.mag-followup) {
  background: var(--bg-card);
  border: 1px solid var(--gold-border, rgba(181,141,59,0.22));
  border-radius: var(--radius-card, 16px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.10);
  padding: 14px 16px;
}
:deep(.mag-followup.is-revise) { border-style: dashed; }
:deep(.mag-followup-pop) { animation: followupPop 0.42s cubic-bezier(0.22,1,0.36,1) both; }
:deep(.mag-followup-q) {
  font-size: 13.5px; font-weight: 600; color: var(--ink);
  margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
:deep(.mag-followup-badge) {
  font-size: 11px; font-weight: 700; letter-spacing: .5px; padding: 2px 9px; border-radius: 999px;
  color: var(--gold); background: var(--gold-dim, rgba(181,141,59,0.12));
  border: 1px solid var(--gold-border, rgba(181,141,59,0.22));
}
:deep(.mag-followup-body) {
  font-size: 14px; line-height: 1.8; color: var(--ink-muted, #55595d);
  white-space: pre-wrap;
}
@keyframes followupPop {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── 追问 dock：固定屏幕下方（导航之上），液态玻璃 ── */
.followup-dock-spacer { height: 84px; }
.wenshi-followup-dock {
  position: fixed; left: 0; right: 0; z-index: 9000;
  bottom: calc(65px + env(safe-area-inset-bottom));
  display: flex; justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}
.wenshi-followup-dock > * { pointer-events: auto; width: 100%; max-width: 760px; }

.followup-bar {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 7px 7px 7px 16px;
  border-radius: 24px;
  background: rgba(var(--paper-rgb, 247,244,238), 0.62);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  border: 1px solid var(--glass-border, rgba(11,11,11,0.12));
  box-shadow: 0 10px 36px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.35);
}
.followup-input {
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  resize: none; overflow: hidden; padding: 9px 0;
  font-size: 15px; line-height: 1.45; color: var(--ink); font-family: inherit;
  box-sizing: border-box;
  height: 40px;          /* 1行 = 15px × 1.45 line-height ≈ 22px + 9px×2 padding = 40px */
  min-height: 40px;      /* 必须覆盖全局 textarea{min-height:130px}，否则被强行撑高 */
  max-height: 120px;
  transition: height .22s cubic-bezier(0.22, 1, 0.36, 1);
}
.followup-input::placeholder { color: var(--ink-dim, #777b80); }
.followup-input:disabled { opacity: .65; }
.followup-send {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%;
  border: none; cursor: pointer; display: grid; place-items: center; color: #fff;
  background: linear-gradient(135deg, var(--gold), var(--gold-light));
  transition: transform .15s ease, opacity .2s ease;
}
.followup-send:not(:disabled):active { transform: scale(0.9); }
.followup-send:disabled { opacity: .4; cursor: not-allowed; }
.followup-send.loading { opacity: .85; }
.dock-spin { animation: dockSpin .8s linear infinite; }
@keyframes dockSpin { to { transform: rotate(360deg); } }

.followup-newmatter {
  display: flex; flex-direction: column; gap: 10px; padding: 14px 16px;
  border-radius: var(--radius-card, 16px);
  background: rgba(var(--paper-rgb, 247,244,238), 0.72);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  border: 1px dashed var(--gold-border, rgba(181,141,59,0.4));
  box-shadow: 0 10px 36px rgba(0,0,0,0.16);
}
.followup-newmatter .fn-text { font-size: 13.5px; line-height: 1.6; color: var(--ink); }
.followup-newmatter .fn-actions { display: flex; gap: 8px; }
.fn-confirm, .fn-cancel { padding: 9px 16px; font-size: 13px; font-weight: 600; border-radius: 10px; cursor: pointer; }
.fn-confirm { border: none; color: #fff; background: linear-gradient(135deg, var(--gold), var(--gold-light)); }
.fn-cancel { border: 1px solid var(--glass-border, rgba(11,11,11,0.15)); background: transparent; color: var(--ink-muted, #666); }

/* dock 弹出过渡（输入条 ↔ 新事确认切换）*/
.dock-pop-enter-active { transition: transform .3s cubic-bezier(0.22,1,0.36,1), opacity .3s ease; }
.dock-pop-leave-active { transition: transform .2s ease, opacity .2s ease; position: absolute; }
.dock-pop-enter-from { opacity: 0; transform: translateY(16px) scale(0.96); }
.dock-pop-leave-to { opacity: 0; transform: translateY(8px); }

:deep(.mag-hero) {
  position: relative;
  min-height: min(44svh, 430px);
  display: flex;
  align-items: flex-end;
  overflow: visible;
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, var(--theme-color-dim), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, var(--theme-color-dim), transparent),
    linear-gradient(175deg, rgba(248,245,238,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-auspicious .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(13,148,136,0.40), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(13,148,136,0.22), transparent),
    linear-gradient(175deg, rgba(206,248,244,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-neutral .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(181,141,59,0.45), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(181,141,59,0.22), transparent),
    linear-gradient(175deg, rgba(255,244,210,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-caution .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(200,74,69,0.42), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(200,74,69,0.20), transparent),
    linear-gradient(175deg, rgba(255,228,226,0.96), rgba(247,244,238,1.0));
}
/* 八字喜用神五行 hero 定格色（与能量球终态同色，溶解交接无色差） */
:deep(.tone-wood .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(47,157,110,0.40), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(47,157,110,0.20), transparent),
    linear-gradient(175deg, rgba(214,244,231,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-fire .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(200,74,69,0.42), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(200,74,69,0.20), transparent),
    linear-gradient(175deg, rgba(255,228,226,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-earth .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(181,141,59,0.45), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(181,141,59,0.22), transparent),
    linear-gradient(175deg, rgba(255,244,210,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-metal .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(189,161,90,0.42), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(189,161,90,0.20), transparent),
    linear-gradient(175deg, rgba(248,242,222,0.96), rgba(247,244,238,1.0));
}
:deep(.tone-water .mag-hero) {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(58,110,165,0.42), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(58,110,165,0.20), transparent),
    linear-gradient(175deg, rgba(220,232,246,0.96), rgba(247,244,238,1.0));
}
:deep(.mag-hero-panel) {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  width: 100%;
  min-width: 0;
  padding: clamp(34px, 6vw, 60px) clamp(22px, 6vw, 54px) clamp(24px, 5vw, 44px);
}
:deep(.mag-hero-tags) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
  color: var(--ink-dim);
  font-size: 13px;
  line-height: 1.4;
}
:deep(.mag-verdict-badge) {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 13px;
  border: 1px solid;
  border-radius: 999px;
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
:deep(.mag-verdict-ji)    { color: #0d9488; background: rgba(13,148,136,0.08); border-color: rgba(13,148,136,0.25); }
:deep(.mag-verdict-da-ji) { color: #047857; background: rgba(5,150,105,0.08); border-color: rgba(5,150,105,0.24); }
:deep(.mag-verdict-ping)  { color: #9a6f1f; background: rgba(181,141,59,0.11); border-color: rgba(181,141,59,0.28); }
:deep(.mag-verdict-warn)  { color: #b45309; background: rgba(217,119,6,0.08); border-color: rgba(217,119,6,0.22); }
:deep(.mag-verdict-xiong) { color: #b91c1c; background: rgba(220,38,38,0.07); border-color: rgba(220,38,38,0.22); }
:deep(.mag-hero-panel h1) {
  margin: 0;
  max-width: 12em;
  font-family: var(--font-display);
  font-size: clamp(30px, 5.5vw, 60px);
  line-height: 1.08;
  font-weight: 850;
  letter-spacing: 0;
  color: var(--ink);
  overflow-wrap: anywhere;
}
:deep(.mag-hero-panel p) {
  max-width: 36em;
  margin: 14px 0 0;
  color: var(--ink-muted);
  font-size: clamp(14px, 1.8vw, 17px);
  line-height: 1.68;
  overflow-wrap: anywhere;
}
:deep(.mag-score-inline) {
  position: absolute;
  top: clamp(22px, 5vw, 42px);
  right: clamp(22px, 6vw, 54px);
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  width: fit-content;
  margin-top: 0;
  color: var(--theme-color);
}
:deep(.mag-score-inline strong) {
  font-family: var(--font-display);
  font-size: clamp(36px, 7vw, 64px);
  line-height: 0.9;
  font-weight: 900;
}
:deep(.mag-score-inline span) {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-dim);
}

:deep(.mag-tabs) {
  position: sticky;
  top: 66px;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  gap: 20px;
  overflow-x: auto;
  touch-action: pan-x;
  padding: 14px 0 10px;
  border-bottom: 1px solid var(--line);
  background: rgba(247,244,238,0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 4px;
  scrollbar-width: none;
}
.result-page-wrap :deep(.mag-tabs) {
  top: 0;
  padding-left: 16px;
  padding-right: 16px;
}
:deep(.mag-tabs::-webkit-scrollbar) { display: none; }
:deep(.mag-tab) {
  border: 0;
  background: transparent;
  padding: 0 0 8px;
  color: var(--ink-dim);
  font-family: var(--font-display);
  font-size: clamp(20px, 6vw, 28px);
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
  white-space: nowrap;
}
:deep(.mag-tab-active) {
  color: var(--ink);
}
:deep(.mag-tab-ink) {
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--ink);
  border-radius: 1px;
  pointer-events: none;
  transition: transform .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1);
  will-change: transform, width;
}

:deep(.mag-section) {
  scroll-margin-top: 130px;
  padding-top: 24px;
}
.result-page-wrap :deep(.mag-section) {
  scroll-margin-top: 60px;
  padding-left: 16px;
  padding-right: 16px;
}
/* Fix 2: hero 面板水平 padding 与 tabs/sections 对齐 */
.result-page-wrap :deep(.mag-hero-panel) {
  padding-left: 16px;
  padding-right: 16px;
}
.result-page-wrap :deep(.mag-score-inline) {
  right: 16px;
}
/* result-actions 也需要和内容对齐 */
.result-page-wrap .result-actions {
  padding-left: 16px;
  padding-right: 16px;
}
:deep(.mag-section + .mag-section) {
  border-top: 1px solid var(--line);
  margin-top: 24px;
  padding-top: 28px;
}
:deep(.module-heading) {
  display: flex;
  align-items: baseline;
  margin-bottom: 20px;
}
:deep(.module-heading h2) {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(18px, 4.6vw, 22px);
  line-height: 1.2;
  font-weight: 850;
  letter-spacing: 0;
}
:deep(.mag-question) {
  margin: 0 0 16px;
  padding: 14px 16px;
  border-left: 3px solid var(--theme-color);
  border-radius: 0 8px 8px 0;
  background: var(--theme-color-dim);
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
:deep(.mag-action-list) {
  display: flex;
  flex-direction: column;
  gap: 0;
}
:deep(.mag-action-item) {
  display: grid;
  grid-template-columns: 38px minmax(0,1fr);
  gap: 14px;
  align-items: start;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
:deep(.mag-action-item:last-child) {
  border-bottom: 0;
}
:deep(.mag-action-num) {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 900;
}
:deep(.mag-action-body) {
  color: var(--ink-muted);
  font-size: 14.5px;
  line-height: 1.75;
  padding-top: 8px;
  overflow-wrap: anywhere;
}
:deep(.report-evidence-block) {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
:deep(.report-subtitle) {
  margin: 22px 0 12px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(16px, 4vw, 20px);
  line-height: 1.25;
  font-weight: 850;
  letter-spacing: 0;
}
:deep(.report-muted) {
  margin: 0;
  color: var(--ink-dim);
  font-size: 13px;
  line-height: 1.6;
}
:deep(.score-basis-body) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
:deep(.sb-row-title) {
  margin-bottom: 8px;
  color: var(--ink-dim);
  font-size: 12px;
  font-weight: 700;
}
:deep(.sb-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
:deep(.sb-tag) {
  display: inline-flex;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.25;
}
:deep(.sb-tag.positive) { color: #0d9488; background: rgba(13,148,136,0.09); }
:deep(.sb-tag.negative) { color: #b91c1c; background: rgba(220,38,38,0.07); }
:deep(.sb-logic) {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.65;
}

:deep(.chart-meta-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
  border-top: 1px solid var(--line);
}
:deep(.chart-meta-grid > div) {
  min-height: auto;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
:deep(.chart-meta-grid span) {
  display: block;
  margin-bottom: 7px;
  color: var(--ink-dim);
  font-size: 11px;
  font-weight: 700;
}
:deep(.chart-meta-grid strong) {
  display: block;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
  font-weight: 700;
  overflow-wrap: anywhere;
}
:deep(.mag-pan-block) {
  margin: 14px 0 6px;
}
:deep(.formation-tag-row) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
:deep(.ge-tag) {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255,255,255,0.52);
  color: var(--ink-muted);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: color .18s, opacity .18s;
}
:deep(.ge-tag:hover) {
  opacity: .78;
}
:deep(.ge-dot) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
:deep(.ge-tag.ji) { color: #0d9488; border-color: rgba(13,148,136,0.24); background: rgba(13,148,136,0.06); }
:deep(.ge-tag.xiong) { color: #b91c1c; border-color: rgba(220,38,38,0.22); background: rgba(220,38,38,0.055); }

:deep(.yongshen-card-grid) {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--line);
}
:deep(.yongshen-card),
:deep(.inference-card),
:deep(.guidance-card) {
  overflow-wrap: anywhere;
}
:deep(.yongshen-card) {
  position: relative;
  min-height: auto;
  padding: 14px 0 16px;
  border-bottom: 1px solid var(--line);
  overflow: hidden;
}
:deep(.yongshen-card-head) {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--ink-dim);
  font-size: 13px;
}
:deep(.yongshen-card-head strong) {
  color: var(--theme-color);
  font-size: 19px;
  white-space: nowrap;
}
:deep(.yongshen-card h4),
:deep(.inference-card h4),
:deep(.guidance-card h4) {
  margin: 14px 0 9px;
  color: var(--ink);
  font-size: 18px;
  line-height: 1.42;
  font-weight: 750;
}
:deep(.yongshen-card p),
:deep(.inference-card p),
:deep(.guidance-card p),
:deep(.guidance-card small) {
  margin: 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.7;
}
:deep(.inference-flow) {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--line);
}
:deep(.inference-card) {
  display: block;
  min-height: auto;
  border-bottom: 1px solid var(--line);
}
:deep(.inference-body) {
  padding: 18px 0;
}
:deep(.inference-card h4) {
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.7;
  font-weight: 400;
}
:deep(.inference-factor-list) {
  display: grid;
  gap: 8px;
  margin: 12px 0 10px;
}
:deep(.inference-factor-item) {
  display: grid;
  gap: 3px;
  padding-left: 10px;
  border-left: 2px solid var(--line);
}
:deep(.inference-factor-list.positive .inference-factor-item) {
  border-left-color: rgba(13,148,136,0.36);
}
:deep(.inference-factor-list.warning .inference-factor-item) {
  border-left-color: rgba(200,74,69,0.36);
}
:deep(.inference-factor-item span) {
  color: var(--ink);
  font-size: 13px;
  font-weight: 750;
}
:deep(.inference-factor-item p) {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.55;
}
:deep(.constraint-factors) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 4px;
}
:deep(.constraint-factor-tag) {
  font-size: 11px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
  color: var(--crimson, #c84a45);
  background: rgba(200,74,69,0.07);
  border: 1px solid rgba(200,74,69,0.18);
  border-radius: 4px;
  padding: 2px 8px;
  letter-spacing: .04em;
}
:deep(.support-factors) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 4px;
}
:deep(.support-factor-tag) {
  font-size: 11px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
  color: #3a7d4e;
  background: rgba(58,125,78,0.07);
  border: 1px solid rgba(58,125,78,0.22);
  border-radius: 4px;
  padding: 2px 8px;
  letter-spacing: .04em;
}
:deep(.inference-head) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: var(--ink-dim);
  font-size: 13px;
}
:deep(.inference-head span) {
  color: var(--ink);
  font-size: 18px;
  font-weight: 750;
}
:deep(.inference-head strong) {
  color: var(--theme-color);
  font-size: 19px;
  white-space: nowrap;
}

:deep(.guidance-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
  border-top: 1px solid var(--line);
}
:deep(.guidance-card) {
  min-height: auto;
  padding: 16px 0 0;
}
:deep(.guidance-kicker) {
  color: var(--theme-color);
  font-size: 12px;
  font-weight: 900;
}
:deep(.guidance-rows) {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
:deep(.guidance-row) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
:deep(.guidance-row span) {
  color: var(--theme-color);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 850;
  line-height: 1.7;
}
:deep(.guidance-row p) {
  margin: 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.72;
}
:deep(.guidance-row.warning span),
:deep(.guidance-row.warning p) {
  color: #b91c1c;
}
:deep(.guidance-row.muted span),
:deep(.guidance-row.muted p) {
  color: var(--ink-dim);
}

@media(max-width:760px) {
  :deep(.mag-result) {
    max-width: 100%;
  }
  :deep(.mag-hero) {
    min-height: 40svh;
    align-items: flex-end;
  }
  :deep(.mag-hero-panel) {
    padding: 52px 24px 24px;
  }
  :deep(.mag-hero-panel h1) {
    font-size: clamp(30px, 8vw, 40px);
    line-height: 1.12;
  }
  :deep(.mag-score-inline) {
    top: 22px;
    right: 24px;
  }
  :deep(.mag-action-list),
  :deep(.chart-meta-grid),
  :deep(.guidance-grid) {
    grid-template-columns: 1fr;
  }
}

@media(max-width:380px) {
  :deep(.mag-tab) {
    font-size: 20px;
  }
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
  background: rgba(247,244,238,0.96);
  box-shadow: 0 8px 28px rgba(0,0,0,.14);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}
.screen-toast-card.is-error {
  border-color: rgba(220,38,38,0.28);
  color: #dc2626;
}

/* ── Suggestion pills ── */
.suggestion-slot {
  min-height: 68px;
  margin-top: 12px;
}
.suggestion-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.suggestion-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px 5px 9px;
  border-radius: 100px;
  border: 1px solid rgba(212,175,55,0.22);
  background: rgba(212,175,55,0.05);
  color: var(--text-muted);
  font-size: 12px;
  font-family: 'Noto Serif SC', serif;
  cursor: pointer;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: border-color .2s, background .2s, color .2s;
}
.suggestion-pill:hover {
  border-color: rgba(212,175,55,0.5);
  background: rgba(212,175,55,0.11);
  color: var(--gold-light);
}
.suggestion-icon {
  font-size: 8px;
  color: rgba(212,175,55,0.55);
  flex-shrink: 0;
}
.sugg-row-enter-active { transition: opacity .22s ease, transform .22s ease; }
.sugg-row-leave-active { transition: opacity .18s ease, transform .18s ease; }
.sugg-row-enter-from { opacity: 0; transform: translateY(4px); }
.sugg-row-leave-to   { opacity: 0; transform: translateY(-3px); }
</style>

<!-- 深色模式：问事结果卡渐变适配 -->
<style>
[data-theme="dark"] .abtn--solid {
  background: linear-gradient(135deg, #8B6914 0%, #D4AF37 45%, #E8CC80 65%, #D4AF37 85%, #8B6914 100%);
  color: #1a1000;
}
[data-theme="dark"] .abtn--solid:not(:disabled):hover {
  background: linear-gradient(135deg, #9B7820 0%, #E4BF47 45%, #F2D898 65%, #E4BF47 85%, #9B7820 100%);
}
[data-theme="dark"] .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, var(--theme-color-dim), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, var(--theme-color-dim), transparent),
    linear-gradient(175deg, rgba(10,10,22,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-auspicious .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(13,148,136,0.65), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(13,148,136,0.30), transparent),
    linear-gradient(175deg, rgba(2,22,20,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-neutral .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(212,175,55,0.62), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(181,141,59,0.28), transparent),
    linear-gradient(175deg, rgba(24,18,2,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-caution .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(200,74,69,0.72), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(150,30,30,0.38), transparent),
    linear-gradient(175deg, rgba(40,4,4,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
/* 八字喜用神五行 hero 定格色（暗色） */
[data-theme="dark"] .tone-wood .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(47,157,110,0.62), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(47,157,110,0.28), transparent),
    linear-gradient(175deg, rgba(2,24,16,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-fire .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(200,74,69,0.72), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(150,30,30,0.38), transparent),
    linear-gradient(175deg, rgba(40,4,4,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-earth .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(212,175,55,0.62), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(181,141,59,0.28), transparent),
    linear-gradient(175deg, rgba(24,18,2,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-metal .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(220,205,160,0.60), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(189,161,90,0.28), transparent),
    linear-gradient(175deg, rgba(22,20,8,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .tone-water .mag-hero {
  background:
    radial-gradient(ellipse 90% 70% at 96% 0%, rgba(58,110,165,0.68), transparent),
    radial-gradient(ellipse 55% 48% at 0% 104%, rgba(58,110,165,0.32), transparent),
    linear-gradient(175deg, rgba(2,12,28,0.97) 0%, rgba(5,5,10,1.0) 100%);
}
[data-theme="dark"] .mag-tabs {
  background: var(--header-bg);
}
[data-theme="dark"] .ge-tag {
  background: rgba(255,255,255,0.06);
}
[data-theme="dark"] .ge-modal {
  background: var(--bg-card);
  border-color: var(--line);
}
[data-theme="dark"] .screen-toast-card {
  background: var(--bg-card);
}
[data-theme="dark"] .mag-action-num {
  background: linear-gradient(135deg, #8B6914 0%, #D4AF37 60%, #8B6914 100%);
  color: #1a1000;
}
/* ── 暗色：流式能量球 + 骨架 ── */
[data-theme="dark"] .wenshi-orb-fx { background: #06060d; }
[data-theme="dark"] .wenshi-orb-status { color: rgba(232,228,220,0.62); }
[data-theme="dark"] .wsk i,
[data-theme="dark"] .wsk-block {
  background: linear-gradient(90deg, rgba(201,166,107,0.08), rgba(201,166,107,0.22), rgba(201,166,107,0.08));
  background-size: 220% 100%;
}
/* 暗色：加载粒子球的明暗自适应在 WenshiOrb.vue 内按 data-theme 处理 */
/* 终态环：暗色沿用共享主题色（gold/teal/red 光晕，中心透出深底），无需单独配色 */
</style>
