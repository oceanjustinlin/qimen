<template>
  <div class="home-view">
    <header id="siteHeader">
      <button class="hamburger" :class="{ open: globalState.isDrawerOpen }" @click="toggleDrawer" aria-label="历史记录">
        <span></span><span></span><span></span>
      </button>
      <div class="site-logo" @click="resetToInput" style="cursor: pointer;" title="返回首页">奇门遁甲</div>
      <div class="header-actions">
        <OpenSourceLinks />
        <AccountMenu />
      </div>
    </header>

    <!-- 历史记录抽屉 - Teleport 到 App.vue 的 #drawer-host 中 -->
    <Teleport to="#drawer-host">
      <div id="historyDrawer" :class="{ open: globalState.isDrawerOpen }">
        <div class="drawer-head">
          <div class="drawer-label">HISTORY</div>
          <div class="drawer-title-txt">推演回溯</div>
        </div>
        <div class="drawer-filter">
          <label class="filter-select-label" for="historyCategorySelect">分类查阅</label>
          <div class="filter-select-wrap">
            <select id="historyCategorySelect" v-model="activeCategory" class="filter-select" aria-label="分类查阅">
              <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                {{ cat.label }}
              </option>
            </select>
            <span class="filter-select-arrow" aria-hidden="true">⌄</span>
          </div>
        </div>
        <div class="drawer-body" id="drawerBody">
          <div v-if="filteredHistory.length === 0" class="drawer-empty">
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
        </div>
      </div>
    </Teleport>

    <div class="page-wrap">
      <div class="container">

        <div v-if="!canUseApp" class="glass-card auth-card">
          <div class="auth-card-glow" aria-hidden="true"></div>
          <div class="auth-head">
            <div class="auth-kicker">{{ isLoginMode ? 'RETURNING SEEKER' : 'NEW SEEKER' }}</div>
            <h1>{{ isLoginMode ? '进入推演台' : '创建推演身份' }}</h1>
            <p>{{ isLoginMode ? '同步历史记录、八字档案与运势缓存。' : '保存你的提问、档案与后续应验反馈。' }}</p>
          </div>

          <div class="auth-oauth-row">
            <button class="google-submit" :disabled="googleAuthLoading || authLoading" @click="handleGoogleAuth">
              <span class="google-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z"/>
                </svg>
              </span>
              <span>{{ googleAuthLoading ? '正在跳转...' : 'Google 继续' }}</span>
            </button>
            <button class="guest-submit" @click="handleGuestEntry">访客体验</button>
          </div>

          <div class="auth-divider"><span>或使用邮箱</span></div>

          <div class="auth-fields">
            <label class="auth-field">
              <span>邮箱</span>
              <input type="email" v-model="authForm.email" placeholder="name@example.com" autocomplete="email"/>
            </label>
            <label class="auth-field">
              <span>密码</span>
              <input
                type="password"
                v-model="authForm.password"
                placeholder="至少 6 位"
                :autocomplete="isLoginMode ? 'current-password' : 'new-password'"
              />
            </label>
          </div>

          <button class="auth-submit" :disabled="authLoading" @click="handleAuth">
            <span>{{ authLoading ? '验证中...' : (isLoginMode ? '登录' : '注册') }}</span>
          </button>

          <div class="auth-inline-actions">
            <button class="forgot-password-link" :disabled="resetEmailLoading" @click="handleResetPasswordEmail">
              {{ resetEmailLoading ? '正在发送...' : '忘记密码' }}
            </button>
            <router-link class="auth-engineering-link" to="/engineering">术数工程化</router-link>
          </div>

          <div v-if="resetEmailNotice" class="auth-notice">{{ resetEmailNotice }}</div>

          <div class="auth-terms">
            继续即表示同意
            <router-link to="/terms">《用户协议》</router-link>
            与
            <router-link to="/privacy">《隐私政策》</router-link>。
          </div>

          <button class="auth-switch" type="button" @click="isLoginMode = !isLoginMode">
            {{ isLoginMode ? '没有账号？创建一个' : '已有账号？返回登录' }}
          </button>
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
                <div class="time-row">
                  <div class="time-display">
                    <span class="time-dot"></span>
                    <span>{{ clockText }}</span>
                  </div>
                  <div class="time-note">以当下时辰起局</div>
                </div>
              </div>

              <div class="cta-wrap">
                <button class="cta-btn" :disabled="isSubmitting" @click="startDivination">
                  <div class="cta-inner">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="opacity:.75;flex-shrink:0">
                      <circle cx="10" cy="10" r="8.5" stroke="#1a1000" stroke-width="1"/>
                      <path d="M10 1.5a8.5 8.5 0 0 1 0 17A4.25 4.25 0 0 1 10 10a4.25 4.25 0 0 0 0-8.5z" fill="#1a1000" opacity=".5"/>
                      <circle cx="10" cy="5.75" r="1.5" fill="#1a1000"/>
                      <circle cx="10" cy="14.25" r="1.5" fill="#1a1000" opacity=".4"/>
                    </svg>
                    <span class="cta-text">洞察天机</span>
                  </div>
                </button>
                <div class="cta-hint">奇门遁甲 · AI 深度推演</div>
              </div>

            </div>
          </transition>

          <transition name="fade">
            <div v-show="viewState === 'loading'" id="loader">
              <div class="bagua-ring-wrap">
                <svg class="bagua-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="56" stroke="rgba(212,175,55,0.15)" stroke-width="1" fill="none"/>
                  <circle cx="60" cy="60" r="50" stroke="rgba(212,175,55,0.08)" stroke-width=".5" fill="none"/>
                  <g stroke="rgba(212,175,55,0.6)" stroke-width="1.5" stroke-linecap="round">
                    <line x1="52" y1="8" x2="68" y2="8"/> <line x1="52" y1="11" x2="68" y2="11"/> <line x1="52" y1="14" x2="68" y2="14"/>
                    <line x1="52" y1="106" x2="59" y2="106"/><line x1="61" y1="106" x2="68" y2="106"/>
                    <line x1="52" y1="109" x2="59" y2="109"/><line x1="61" y1="109" x2="68" y2="109"/>
                    <line x1="52" y1="112" x2="59" y2="112"/><line x1="61" y1="112" x2="68" y2="112"/>
                    <line x1="6" y1="52" x2="14" y2="52"/> <line x1="6" y1="55" x2="14" y2="55"/> <line x1="6" y1="58" x2="14" y2="58"/>
                    <line x1="106" y1="52" x2="114" y2="52"/>
                    <line x1="106" y1="55" x2="110" y2="55"/><line x1="112" y1="55" x2="114" y2="55"/>
                    <line x1="106" y1="58" x2="114" y2="58"/>
                  </g>
                  <g class="bagua-inner-g">
                    <circle cx="60" cy="60" r="28" stroke="rgba(107,140,255,0.2)" stroke-width="1" fill="rgba(107,140,255,0.02)"/>
                    <circle cx="60" cy="60" r="18" stroke="rgba(212,175,55,0.25)" stroke-width="1" fill="none"/>
                    <circle cx="60" cy="60" r="36" stroke="rgba(212,175,55,0.35)" stroke-width="1.5" fill="none" stroke-dasharray="8 6" stroke-linecap="round"/>
                  </g>
                  <circle cx="60" cy="60" r="4" fill="rgba(212,175,55,0.6)"/>
                  <circle cx="60" cy="60" r="2" fill="rgba(212,175,55,0.9)"/>
                </svg>
              </div>
              <div class="loader-text-block">
                <div class="loader-main-text">{{ currentLoaderMessage }}</div>
                <div class="loader-dots"><span></span><span></span><span></span></div>
              </div>
            </div>
          </transition>

          <transition name="fade">
            <div v-show="viewState === 'result'" class="result-wrapper">
              <div v-html="resultHtml" class="html-container"></div>
              <Teleport v-if="showBaziBackingAnchor" to="#bazi-backing-anchor">
                <BaziBackingPanel
                  :profile="snapshotProfile"
                  :result-data="activeBaziResultData"
                  :analysis-mode="activeBaziResultData.meta?.analysis_mode"
                  :selected-year="baziCardSelectedYear"
                  @update:selected-year="baziCardSelectedYear = $event"
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
            </div>
          </transition>
        </div>
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
        <div class="route-info-note">你只需自然提问；系统会先识别问题类型，自动选择八字、奇门或综合路径，并注入对应规则。</div>
      </div>
    </div>

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
import { createClient } from '@supabase/supabase-js'
import {
  enterGuestMode,
  globalState,
  leaveGuestMode,
  resolveSelectedBaziProfileId,
  setCurrentUser,
  setSelectedBaziProfileId
} from '../store.js'
import { getGuestState, recordGuestQuestion, trackGuestEvent } from '../guestMode.mjs'
import { warmFortuneCacheFromSupabase } from '../fortuneWarmup.mjs'
import AccountMenu from '../components/AccountMenu.vue'
import BaziBackingPanel from '../components/BaziBackingPanel.vue'
import OpenSourceLinks from '../components/OpenSourceLinks.vue'
import { buildGoogleOAuthSignInArgs } from '../auth/googleOAuth.mjs'
import { buildPasswordResetEmailArgs } from '../auth/passwordReset.mjs'
import {
  QIMEN_ACCURACY_OPTIONS,
  QIMEN_DIRECTION_OPTIONS,
  buildDefaultFeedbackForm,
  mergeQimenFeedbackIntoRecords,
  normalizeQimenFeedbackForm
} from '../qimenFeedback.mjs'

const SUPABASE_URL = 'https://xkbqiiwwgfzkyfhxuoev.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_qr9YBIA6n32r-mcqKbkpgA_0XVTUSI7'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const API_URL = "/api/qimen"
const ROUTE_API_URL = "/api/divination-route"
const BAZI_QUESTION_API_URL = "/api/bazi-question"
const router = useRouter()
const route = useRoute()

const currentUser = ref(null)
const isLoginMode = ref(true)
const authLoading = ref(false)
const googleAuthLoading = ref(false)
const resetEmailLoading = ref(false)
const resetEmailNotice = ref('')
const authForm = reactive({ email: '', password: '' })

const viewState = ref('input') 
const questionInput = ref('')
const isSubmitting = ref(false)
const clockText = ref('载入时辰中…')
const showRouteInfoModal = ref(false)

const baziProfiles = ref([])
const selectedProfileId = ref('')
const isProfileMenuOpen = ref(false)
const currentBaziString = ref('')
const activeBaziProfile = computed(() => baziProfiles.value.find(p => p.id === selectedProfileId.value))
const snapshotProfile = computed(() => {
  const snap = activeBaziResultData.value?.subject_snapshot
  if (snap?.birth_date && snap?.gender) return { birth_date: snap.birth_date, gender: snap.gender }
  return activeBaziProfile.value
})
const showProfileSwitcher = computed(() => baziProfiles.value.length > 0)
const activeProfileName = computed(() => activeBaziProfile.value?.name || '命主未设')
const isGuest = computed(() => globalState.isGuest)
const isAuthLanding = computed(() => ['login', 'register'].includes(route.query.auth))
const canUseApp = computed(() => Boolean(currentUser.value || (isGuest.value && !isAuthLanding.value)))

const historyRecords = ref([])
const activeCategory = ref('all')
const activeResultRecord = ref(null)
const categories = [
  { label: '全部', value: 'all' },
  { label: '💼 事业', value: 'career_business' },
  { label: '💰 求财', value: 'finance_wealth' },
  { label: '❤️ 感情', value: 'relationship' },
  { label: '🏥 健康', value: 'health_action' },
  { label: '📦 交易', value: 'item_transaction' },
  { label: '📋 杂事', value: 'general' }
]
const feedbackAccuracyOptions = QIMEN_ACCURACY_OPTIONS
const feedbackDirectionOptions = QIMEN_DIRECTION_OPTIONS
const isFeedbackDrawerOpen = ref(false)
const feedbackTargetRecord = ref(null)
const feedbackSaving = ref(false)
const feedbackForm = reactive(buildDefaultFeedbackForm())
const feedbackConclusion = computed(() => feedbackTargetRecord.value?.qimen_data?.summary?.conclusion || '')

const resultHtml = ref('')
const currentScore = ref(0)
const activeBaziResultData = ref(null)
const baziCardSelectedYear = ref(null)
const showBaziBackingAnchor = ref(false)
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

    let canvas
    try {
      canvas = await h2c(captureEl, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#05050A',
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        onclone: (clonedDoc) => {
          // 1. 确保所有 reveal 元素可见
          clonedDoc.querySelectorAll('.reveal').forEach(el => {
            el.style.opacity = '1'
            el.style.transform = 'none'
          })

          // 2. 遍历克隆文档所有 <style> 标签，替换 color-mix()
          clonedDoc.querySelectorAll('style').forEach(styleEl => {
            if (styleEl.textContent && styleEl.textContent.includes('color-mix')) {
              styleEl.textContent = styleEl.textContent
                .replace(/color-mix\([^)]+\)/g, 'transparent')
            }
          })

          // 3. 清除内联 style 属性中残留的 color-mix()
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
  ctx.font = `500 ${fontSize}px 'PingFang SC', 'Hiragino Sans GB', sans-serif`
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

let clockInterval = null
const getFortuneStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

const syncAuthModeFromRoute = () => {
  isLoginMode.value = route.query.auth !== 'register'
}

onMounted(() => {
  syncAuthModeFromRoute()
  updateClock()
  clockInterval = setInterval(updateClock, 30000)
  document.addEventListener('click', handleDocumentClick)

  supabase.auth.getSession().then(({ data: { session } }) => {
    handleSessionUpdate(session)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    handleSessionUpdate(session)
  })
})

watch(() => route.query.auth, syncAuthModeFromRoute)

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  clearInterval(clockInterval)
  clearInterval(loaderInterval)
  clearInterval(scoreTimer)
})

const toggleDrawer = () => {
  globalState.isDrawerOpen = !globalState.isDrawerOpen
}

const handleSessionUpdate = (session) => {
  setCurrentUser(session?.user || null)
  if (session) {
    currentUser.value = session.user
    loadHistory()
    fetchBaziProfiles()
    warmFortuneCacheFromSupabase({
      supabase,
      storage: getFortuneStorage(),
      userId: session.user.id
    })
  } else {
    currentUser.value = null
    if (!isGuest.value) {
      historyRecords.value = []
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
    historyRecords.value = []
    resetToInput()
  } else {
    await supabase.auth.signOut()
  }
}

const handleGuestEntry = async () => {
  enterGuestMode()
  currentUser.value = null
  historyRecords.value = []
  await fetchBaziProfiles()
  await trackGuestEvent(supabase, 'guest_started', 'auth')
}

const updateClock = () => {
  const TIAN_GAN = "甲乙丙丁戊己庚辛壬癸".split("")
  const DI_ZHI = "子丑寅卯辰巳午未申酉戌亥".split("")
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const shichenIdx = Math.floor((now.getHours() + 1) / 2) % 12
  const stemIdx = Math.floor(now.getTime() / 86400000) % 10
  clockText.value = `${h}:${m}\u2002${TIAN_GAN[stemIdx]}日 ${DI_ZHI[shichenIdx]}时`
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
  const { data, error } = await supabase.from('bazi_profiles').select('*').order('created_at', { ascending: false })
  if (!error && data) {
    baziProfiles.value = data
    const resolvedProfileId = resolveSelectedBaziProfileId(baziProfiles.value, {
      currentProfileId: selectedProfileId.value
    })
    selectedProfileId.value = resolvedProfileId
    setSelectedBaziProfileId(resolvedProfileId)
    handleProfileSelect()
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

const activateBaziResultPanel = (data) => {
  showBaziBackingAnchor.value = false
  if (!(data?.branch === 'bazi' && data.meta?.analysis_mode)) {
    activeBaziResultData.value = null
    baziCardSelectedYear.value = null
    return
  }
  activeBaziResultData.value = data
  if (data.meta.analysis_mode === 'timing') {
    const windows = data.mode_analysis?.trigger_windows || []
    const best = windows.find(window => window.quality === 'strong') || windows[0]
    baziCardSelectedYear.value = Number(best?.year) || activeBaziProfile.value?.bazi_detail?.matrix?.current_liunian?.year || null
  } else {
    baziCardSelectedYear.value = activeBaziProfile.value?.bazi_detail?.matrix?.current_liunian?.year || null
  }
  syncBaziBackingAnchor()
}

const startDivination = async () => {
  const input = questionInput.value.trim()
  if (!input) return alert("问题不能为空！")
  activeBaziResultData.value = null
  baziCardSelectedYear.value = null
  showBaziBackingAnchor.value = false

  const { data: { session } } = await supabase.auth.getSession()
  const guestState = getGuestState()
  if (!session && !isGuest.value) return alert("请先登录")
  if (!session && isGuest.value && !guestState.canAskQuestion) return alert("访客模式仅可提问 1 次，请登录后继续推演")

  const headers = session
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
    : { 'Content-Type': 'application/json', 'X-Guest-Id': guestState.guestId }
  let routeData = null

  isSubmitting.value = true
  viewState.value = 'loading'
  startLoaderCycle()

  try {
    const routeResponse = await fetch(ROUTE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: input,
        hasBaziProfile: Boolean(selectedProfileId.value || baziProfiles.value.length)
      })
    })
    routeData = await routeResponse.json()
    if (!routeResponse.ok || routeData.error) throw new Error(routeData.details || routeData.error || '分类失败')

    if (routeData.branch === 'clarify') {
      alert(routeData.followupQuestion || '请补充你想看长期趋势，还是判断眼前某一件具体事情。')
      viewState.value = 'input'
      return
    }

    if (routeData.branch === 'bazi') {
      if (!session) {
        alert('这个问题更适合走八字命盘分析，请先登录并建立八字档案。')
        router.push({ name: 'bazi', query: { question: input } })
        return
      }

      if (!baziProfiles.value.length) await fetchBaziProfiles()
      const profileId = selectedProfileId.value || baziProfiles.value.find(p => p.is_default)?.id || baziProfiles.value[0]?.id || ''
      if (!profileId) {
        alert('这个问题需要八字档案才能分析，请先进入八字页建立命主资料。')
        router.push({ name: 'bazi', query: { question: input } })
        return
      }
      selectedProfileId.value = profileId

      const response = await fetch(BAZI_QUESTION_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: input,
          profileId,
          route: routeData
        })
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        if (data.code === 'BAZI_PROFILE_INCOMPLETE') {
          alert('该档案还没有完整排盘数据，请先进入八字页完成命盘推演。')
          router.push({ name: 'bazi', query: { profileId, question: input } })
          return
        }
        throw new Error(data.details || data.error || '八字问答失败')
      }
      const savedRecord = await saveRecordToDatabase(input, data)
      activeResultRecord.value = savedRecord
      resultHtml.value = buildCardHTML(data)
      activateBaziResultPanel(data)
      viewState.value = 'result'
      nextTick(() => {
        if (!(data.branch === 'bazi' && data.meta?.analysis_mode)) animateScore(data.summary?.score || 0)
        setTimeout(() => document.querySelectorAll('.reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 450)
      })
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
        baziInfo: (routeData.branch === 'qimen') ? null : (currentBaziString.value || null)
      })
    })
    const data = await response.json()
    if (!response.ok || data.error) throw new Error(data.details || data.error || '推演失败')
    const savedRecord = await saveRecordToDatabase(input, data)
    activeResultRecord.value = savedRecord
    activateBaziResultPanel(data)
    if (!session && isGuest.value) {
      recordGuestQuestion()
      await trackGuestEvent(supabase, 'guest_qimen_asked', 'qimen', { limit_reached: true })
    }
    resultHtml.value = buildCardHTML(data)
    viewState.value = 'result'
    nextTick(() => {
      animateScore(data.summary?.score || 0)
      setTimeout(() => document.querySelectorAll('.reveal').forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80)), 450)
    })
  } catch (err) {
    alert("推演失败")
    viewState.value = 'input'
  } finally {
    stopLoaderCycle()
    isSubmitting.value = false
  }
}

const animateScore = (targetScore) => {
  if(scoreTimer) clearInterval(scoreTimer)
  let current = 0
  scoreTimer = setInterval(() => {
    current = Math.min(current + (targetScore/60), targetScore)
    const el = document.getElementById('vueScoreValue')
    if (el) el.textContent = String(Math.round(current))
    if (current >= targetScore) clearInterval(scoreTimer)
  }, 16)
}

const loadHistory = async () => {
  const { data } = await supabase.from('qimen_records').select('*').order('created_at', { ascending: false })
  const records = (data || []).map(r => ({
    ...r,
    dateStr: new Date(r.created_at).toLocaleDateString(),
    score: r.qimen_data?.summary?.score || 0,
    catLabel: categories.find(c => c.value === r.category)?.label || '杂事'
  }))

  if (!currentUser.value) {
    historyRecords.value = mergeQimenFeedbackIntoRecords(records, [], currentUser.value)
    return
  }

  const { data: feedbackRows, error } = await supabase
    .from('qimen_feedback')
    .select('record_id, accuracy_status, actual_direction, note, updated_at')
    .eq('user_id', currentUser.value.id)

  if (error && error.code !== '42P01') {
    console.warn('加载奇门反馈失败:', error.message)
  }

  historyRecords.value = mergeQimenFeedbackIntoRecords(records, error ? [] : (feedbackRows || []), currentUser.value)
  if (activeResultRecord.value?.id) {
    activeResultRecord.value = historyRecords.value.find(record => record.id === activeResultRecord.value.id) || activeResultRecord.value
  }
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
    .select('*')

  if (error) throw error
  await loadHistory()
  const insertedRecordId = insertedRows?.[0]?.id
  return historyRecords.value.find(record => record.id === insertedRecordId) || null
}

const filteredHistory = computed(() => activeCategory.value === 'all' ? historyRecords.value : historyRecords.value.filter(r => r.category === activeCategory.value))

const loadRecord = (item) => {
  globalState.isDrawerOpen = false
  activeResultRecord.value = item
  resultHtml.value = buildCardHTML(item.qimen_data)
  activateBaziResultPanel(item.qimen_data)
  viewState.value = 'result'
  nextTick(() => {
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
  const summary = data.summary || { title: '八字分析', conclusion: '暂无数据', score: null, level: 'unknown' }
  const meta = data.meta || {}
  const foundation = data.chart_foundation || {}
  const mode = data.mode_analysis || {}
  const advice = data.advice || {}
  const question = data.question || ''
  const assessmentType = summary.assessment_type || 'current_climate'
  const hasScore = summary.score !== null && summary.score !== undefined
  const levelLabel = baziLevelLabel(summary.level)
  const targetLabel = concreteTargetLabel(data)
  const metaHTML = ''
  const scoreBadge = hasScore
    ? `<div class="bazi-score-chip">${summary.score}<span>分</span></div>`
    : `<div class="bazi-level-chip level-${summary.level || 'unknown'}">${levelLabel}</div>`

  const positive = summary.basis?.positive_signals || []
  const negative = summary.basis?.negative_signals || []
  const basisLogic = summary.basis?.logic || ''
  const basisHTML = positive.length || negative.length || basisLogic
    ? `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">判断依据</div>
        ${basisLogic ? `<p class="bazi-basis-summary">${sanitizeBaziDisplayText(basisLogic, targetLabel)}</p>` : ''}
        ${buildBaziTextListHTML(positive, 'bazi-signal-list positive', targetLabel)}
        ${buildBaziTextListHTML(negative, 'bazi-signal-list warning', targetLabel)}
      </section>`
    : ''

  const foundationEvidence = foundation.evidence || []
  const foundationSupports = foundation.supports || []
  const foundationObstacles = foundation.obstacles || []
  const foundationHTML = foundation.base_state || foundationSupports.length || foundationObstacles.length || foundationEvidence.length
    ? `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">原局底盘</div>
        ${foundation.base_state ? `<p class="bazi-card-copy">${sanitizeBaziDisplayText(foundation.base_state, targetLabel)}</p>` : ''}
        ${buildBaziFoundationGroupHTML('支撑', foundationSupports, 'bazi-signal-list positive', targetLabel)}
        ${buildBaziFoundationGroupHTML('阻力', foundationObstacles, 'bazi-signal-list warning', targetLabel)}
        ${buildBaziFoundationGroupHTML('依据', foundationEvidence, 'bazi-evidence-list', targetLabel)}
      </section>`
    : ''

  const windows = Array.isArray(mode.trigger_windows) ? mode.trigger_windows : []
  const timingHTML = windows.length
    ? `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">候选时间窗</div>
        ${meta.analysis_mode === 'timing' ? `<div class="bazi-timing-meta">
          ${mode.best_window ? `<div class="timing-best">最优窗口：${sanitizeBaziDisplayText(mode.best_window, targetLabel)}</div>` : ''}
          ${mode.avoid_window ? `<div class="timing-avoid">回避：${sanitizeBaziDisplayText(mode.avoid_window, targetLabel)}</div>` : ''}
          <div class="timing-disclaimer">候选强度代表应期信号强弱，不是事件必然发生概率。</div>
        </div>` : ''}
        <div class="bazi-timing-window-list">
          ${windows.map(item => `<div class="bazi-timing-window-card quality-${item.quality || 'weak'}">
            <div class="bazi-window-top">
              <strong>${item.ganzhi ? `${item.year} ${item.ganzhi}` : item.year || '-'}</strong>
              <span class="quality-badge quality-${item.quality}">${baziLevelLabel(item.quality)}</span>
              ${item.is_major_window ? '<span class="major-window-badge">双引动</span>' : ''}
            </div>
            <div class="bazi-window-meta"><span>大运 ${item.dayun_ganzhi || '-'}</span></div>
            ${item.verdict ? `<p class="bazi-card-copy">${sanitizeBaziDisplayText(item.verdict, targetLabel)}</p>` : ''}
            ${item.mechanisms_text ? `<div class="bazi-logic">${sanitizeBaziDisplayText(item.mechanisms_text, targetLabel)}</div>` : ''}
            ${buildBaziTextListHTML(item.supporting_evidence || [], 'bazi-signal-list positive', targetLabel)}
            ${buildBaziTextListHTML(item.blocking_evidence || [], 'bazi-signal-list warning', targetLabel)}
          </div>`).join('')}
        </div>
      </section>`
    : ''

  const patternHTML = meta.analysis_mode === 'pattern' && (mode.capacity_level || mode.structural_supports?.length || mode.structural_risks?.length || mode.verdict || mode.current_status_note)
    ? `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">先天结构适配</div>
        ${mode.capacity_level ? `<div class="bazi-capacity-row"><span class="capacity-label">容量</span><span class="capacity-level level-${mode.capacity_level}">${baziLevelLabel(mode.capacity_level)}</span></div>` : ''}
        ${mode.verdict ? `<p class="bazi-card-copy">${sanitizeBaziDisplayText(mode.verdict, targetLabel)}</p>` : ''}
        ${buildBaziTextListHTML(mode.structural_supports || [], 'bazi-signal-list positive', targetLabel)}
        ${buildBaziTextListHTML(mode.structural_risks || [], 'bazi-signal-list warning', targetLabel)}
        ${mode.current_status_note ? `<p class="bazi-logic">${sanitizeBaziDisplayText(mode.current_status_note, targetLabel)}</p>` : ''}
      </section>`
    : ''

  const characterHTML = meta.analysis_mode === 'character' && (mode.character_portrait || mode.appearance_tendency?.text || mode.personality_tendency?.text || mode.career_style?.text || mode.relationship_dynamic || mode.do_not_overclaim)
    ? `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">人物倾向画像</div>
        ${mode.character_portrait ? `<p class="bazi-card-copy">${sanitizeBaziDisplayText(mode.character_portrait, targetLabel)}</p>` : ''}
        ${buildPortraitBlockHTML(mode.appearance_tendency, '外貌气质', targetLabel)}
        ${buildPortraitBlockHTML(mode.personality_tendency, '性格倾向', targetLabel)}
        ${buildPortraitBlockHTML(mode.career_style, '行事风格', targetLabel)}
        ${mode.relationship_dynamic ? `<div class="bazi-logic">${sanitizeBaziDisplayText(mode.relationship_dynamic, targetLabel)}</div>` : ''}
        ${mode.do_not_overclaim ? `<div class="bazi-disclaimer">${sanitizeBaziDisplayText(mode.do_not_overclaim, targetLabel)}</div>` : ''}
      </section>`
    : ''

  let dynamicHTML = ''
  if (meta.analysis_mode === 'status') {
    const dayunReading = mode.dayun_reading || ''
    const liunianReading = mode.liunian_reading || ''
    const targetReading = mode.target_state_reading || ''
    if (dayunReading || liunianReading || targetReading) {
      dynamicHTML = `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">当前运势气候</div>
        ${dayunReading ? `<div class="bazi-reading-block"><div class="reading-label">大运影响</div><p>${sanitizeBaziDisplayText(dayunReading, targetLabel)}</p></div>` : ''}
        ${liunianReading ? `<div class="bazi-reading-block"><div class="reading-label">流年触发</div><p>${sanitizeBaziDisplayText(liunianReading, targetLabel)}</p></div>` : ''}
        ${targetReading ? `<div class="bazi-reading-block"><div class="reading-label">${targetLabel}状态</div><p>${sanitizeBaziDisplayText(targetReading, targetLabel)}</p></div>` : ''}
      </section>`
    }
  }

  const adviceExtrasHTML = buildBaziAdviceExtrasHTML(advice, targetLabel)
  const adviceHTML = (Array.isArray(advice.strategy) && advice.strategy.length) || adviceExtrasHTML
    ? `<section class="result-module bazi-mode-card reveal">
        <div class="ai-header-title">行动建议</div>
        ${Array.isArray(advice.strategy) && advice.strategy.length ? `<div class="action-grid">${advice.strategy.slice(0, 3).map((s, i) => `<div class="action-step reveal" style="transition-delay:${i * 70}ms"><div class="action-index">0${i + 1}</div><div class="action-copy">${sanitizeBaziDisplayText(s, targetLabel)}</div></div>`).join('')}</div>` : ''}
        ${adviceExtrasHTML}
      </section>`
    : ''

  return `<div class="result-stack bazi-result-stack">
    <section class="result-module summary-module bazi-summary-module reveal">
      <div class="summary-top">
        <div class="summary-main">
          <div class="summary-title">${summary.title || baziAssessmentLabel(assessmentType)}</div>
          ${metaHTML}
          <div class="summary-judgement">
            <span class="verdict-badge verdict-ping">${levelLabel}</span>
            <span class="conclusion">${sanitizeBaziDisplayText(summary.conclusion || '', targetLabel)}</span>
          </div>
        </div>
        ${scoreBadge}
      </div>
      ${summary.keyword ? `<div class="keyword-highlight"><span class="keyword-label">关键判断</span><span class="keyword-text">${sanitizeBaziDisplayText(summary.keyword, targetLabel)}</span></div>` : ''}
      ${question ? `<div class="question-bubble"><div class="question-text">“${question}”</div></div>` : ''}
    </section>
    ${adviceHTML}
    ${basisHTML}
    <div id="bazi-backing-anchor" class="bazi-backing-anchor"></div>
    ${foundationHTML}
    ${patternHTML}
    ${characterHTML}
    ${dynamicHTML}
    ${timingHTML}
  </div>`
}

const buildCardHTML = (data) => {
  if (data.branch === 'bazi' && data.meta?.analysis_mode) return buildBaziQuestionCardHTML(data)

  const summary = data.summary || { title: '生成中...', conclusion: '暂无数据', score: 0 }
  const analysis = data.analysis || {}
  const advice = data.advice || { lucky_tips: {} }
  const question = data.question || ''
  const scoreBasis = data.summary?.score_basis || null
  const displayBlocks = data.display_blocks || null
  const chartData = data.qimen_data || data
  const palaces = chartData.palaces || []
  const pillars = chartData.pillars || {}
  const ju = chartData.ju_info || {}
  const ts = chartData.timestamp || {}
  const hasChart = palaces.length > 0

  const score = summary.score || 0
  const vd = getVerdictInfo(score)
  const THEME = score < 55 ? '#FF5E57' : score < 75 ? '#F5C518' : '#00D26A'
  const THEME_DIM = score < 55 ? 'rgba(255,94,87,0.15)' : score < 75 ? 'rgba(245,197,24,0.15)' : 'rgba(0,210,106,0.15)'

  const strategyItems = advice.strategy || []
  const primaryStrategies = strategyItems.slice(0, 3)
  const domainView = data.domain_view
  const detailInsights = displayBlocks
    ? [
        { label: '局势判断', value: displayBlocks.situation, cls: 'accent-indigo' },
        { label: '有利条件', value: displayBlocks.support, cls: 'accent-gold' },
        { label: '阻力风险', value: displayBlocks.risk, cls: 'accent-violet' },
        { label: '时间窗口', value: displayBlocks.timing, cls: 'accent-amber' }
      ].filter(item => item.value?.trim())
    : [
        { label: '时空能量', value: analysis.tensor, cls: 'accent-indigo' },
        { label: '用神分析', value: analysis.yong_shen, cls: 'accent-gold' },
        { label: '特殊格局', value: analysis.pattern, cls: 'accent-violet' },
        { label: '神助指引', value: analysis.god_help, cls: 'accent-teal' },
        { label: '动态应期', value: analysis.dynamic_timing, cls: 'accent-amber' }
      ].filter(item => item.value?.trim())

  const actionHTML = primaryStrategies.length
    ? primaryStrategies.map((s, i) => `<div class="action-step reveal" style="transition-delay:${i * 70}ms"><div class="action-index">0${i + 1}</div><div class="action-copy">${s}</div></div>`).join('')
    : `<div class="action-step reveal"><div class="action-index">01</div><div class="action-copy">${summary.conclusion}</div></div>`

  // 领域判断：职业、婚姻、财运等问题域的专属结构化展示
  let domainViewHTML = ''
  if (domainView && Array.isArray(domainView.axes) && domainView.axes.length) {
    const toneLabel = { positive: '顺', mixed: '参', warning: '慎' }
    const axisHTML = domainView.axes.map(axis => `
      <div class="domain-axis-card tone-${axis.tone || 'mixed'}">
        <div class="domain-axis-top">
          <span class="domain-axis-label">${axis.label || '-'}</span>
          <span class="domain-axis-symbol">${axis.symbol || '-'}</span>
        </div>
        <div class="domain-axis-verdict">${axis.verdict || '-'}</div>
        <div class="domain-axis-evidence">${axis.evidence || '-'}</div>
        <span class="domain-axis-tone">${toneLabel[axis.tone] || toneLabel.mixed}</span>
      </div>
    `).join('')
    const processSymbols = Array.isArray(domainView.process?.symbols) ? domainView.process.symbols.join('、') : ''
    const processHTML = domainView.process ? `
      <div class="domain-mini-card">
        <div class="domain-mini-label">${domainView.process.label || '过程判断'}${processSymbols ? `<span>${processSymbols}</span>` : ''}</div>
        <div class="domain-mini-body">${domainView.process.verdict || '-'}</div>
        ${domainView.process.evidence ? `<div class="domain-mini-evidence">${domainView.process.evidence}</div>` : ''}
      </div>
    ` : ''
    const timingHTML = domainView.timing ? `
      <div class="domain-mini-card">
        <div class="domain-mini-label">${domainView.timing.label || '应期'}${domainView.timing.trigger ? `<span>${domainView.timing.trigger}</span>` : ''}</div>
        <div class="domain-mini-body">${domainView.timing.verdict || '-'}</div>
        ${domainView.timing.favorable_window ? `<div class="domain-mini-evidence">${domainView.timing.favorable_window}</div>` : ''}
      </div>
    ` : ''
    const decisionHTML = domainView.decision ? `
      <div class="domain-decision">
        <div><span>宜</span>${domainView.decision.recommended_action || '-'}</div>
        <div><span>避</span>${domainView.decision.avoid || '-'}</div>
      </div>
    ` : ''
    domainViewHTML = `<section class="result-module domain-view-module reveal">
      <div class="ai-header-title">${domainView.title || '领域判断'}</div>
      <div class="domain-axis-grid">${axisHTML}</div>
      <div class="domain-section-grid">${processHTML}${timingHTML}</div>
      ${decisionHTML}
    </section>`
  }

  // 风险预警
  let riskHTML = ''
  if (advice.risk?.trim()) riskHTML = `<div class="risk-alert reveal"><div class="risk-alert-content">${advice.risk}</div></div>`

  // 八字命理
  let baziHTML = ''
  if (data.branch !== 'qimen' && analysis.bazi_insight?.trim() && !analysis.bazi_insight.includes('未提供八字信息')) baziHTML = `<div class="insight-strip accent-theme reveal"><div class="insight-strip-label">命理参考</div><div class="insight-strip-body">${analysis.bazi_insight}</div></div>`

  // 评分依据
  let scoreBasisHTML = ''
  if (scoreBasis) {
    const pos = (scoreBasis.positive_signals || []).length ? `<div class="sb-row"><div class="sb-row-title">有利依据</div><div class="sb-tags">${scoreBasis.positive_signals.map(s => `<span class="sb-tag positive">${s}</span>`).join('')}</div></div>` : ''
    const neg = (scoreBasis.negative_signals || []).length ? `<div class="sb-row"><div class="sb-row-title">谨慎因素</div><div class="sb-tags">${scoreBasis.negative_signals.map(s => `<span class="sb-tag negative">${s}</span>`).join('')}</div></div>` : ''
    const logic = scoreBasis.score_logic ? `<div class="sb-logic">${scoreBasis.score_logic}</div>` : ''
    if (pos || neg || logic) scoreBasisHTML = `<div class="insight-strip accent-neutral reveal"><div class="insight-strip-label">分数依据</div><div class="score-basis-body">${pos}${neg}${logic}</div></div>`
  }

  // 九宫格排盘
  let chartHTML = ''
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
    chartHTML = `<section class="result-module reveal"><div class="ai-header-title">时局排盘</div><div class="pan-wrapper"><div class="pan-header"><div class="pan-pillars">${[pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean).join('　')}</div><div class="pan-info">${ts.solar || ''} | ${ju.name || ''} · ${ju.jieqi || ''}<br>值符：<b>${ju.zhi_fu || '-'}</b>&emsp;值使：<b>${ju.zhi_shi || '-'}</b></div></div><div class="pan-grid">${cells}</div></div></section>`
  }

  const detailInsightHTML = detailInsights.map(item => (
    `<div class="insight-strip ${item.cls} reveal"><div class="insight-strip-label">${item.label}</div><div class="insight-strip-body">${item.value}</div></div>`
  )).join('')

  return `<div class="result-stack" style="--theme-color:${THEME};--theme-color-dim:${THEME_DIM};">
    <section class="result-module summary-module reveal">
      <div class="summary-top">
        <div class="summary-main">
          <div class="summary-title">${summary.title || '本局断语'}</div>
          <div class="summary-judgement">
            <span class="verdict-badge verdict-${vd.cls}">${vd.label}</span>
            <span class="conclusion">${summary.conclusion}</span>
          </div>
        </div>
        <div class="summary-score-bubble"><span class="score" id="vueScoreValue">${score}</span><span class="score-unit">分</span></div>
      </div>
      ${summary.keyword ? `<div class="keyword-highlight"><span class="keyword-label">关键判断</span><span class="keyword-text">${summary.keyword}</span></div>` : ''}
      ${question ? `<div class="question-bubble"><div class="question-text">“${question}”</div></div>` : ''}
    </section>

    <section class="result-module reveal">
      <div class="ai-header-title">行动建议</div>
      <div class="action-grid">${actionHTML}</div>
    </section>

    ${domainViewHTML}

    ${chartHTML}

    <section class="result-module reveal">
      <div class="ai-header-title">局势拆解</div>
      <div class="insight-flow">
        ${baziHTML}
        ${scoreBasisHTML}
        ${detailInsightHTML}
      </div>
    </section>

    ${riskHTML ? `<section class="result-module reveal"><div class="ai-header-title">风险提醒</div>${riskHTML}</section>` : ''}

    <section class="result-module reveal">
      <div class="ai-header-title">时位助力</div>
      <div class="footer">
        <div class="f-item"><span class="f-label">方位</span><span class="f-text">${advice.lucky_tips.direction || '-'}</span></div>
        <div class="f-item"><span class="f-label">时机</span><span class="f-text">${advice.lucky_tips.time || '-'}</span></div>
        <div class="f-item"><span class="f-label">动作</span><span class="f-text">${advice.lucky_tips.action || '-'}</span></div>
      </div>
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
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  background: rgba(5, 5, 10, 0.65);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.hamburger { width: 38px; height: 38px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; border-radius: 10px; transition: background .2s; border: none; background: transparent; flex-shrink: 0; }
.hamburger span { display: block; width: 18px; height: 1.5px; background: var(--text-primary); border-radius: 2px; transition: all .35s var(--spring); transform-origin: center; }
.hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

.site-logo { font-family: 'Noto Serif SC', serif; font-size: 17px; letter-spacing: .15em; font-weight: 500; background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 12px rgba(212,175,55,0.45)); position: relative; }

.header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* 抽屉 */
#historyDrawer { position: absolute; inset: 0; width: 100%; z-index: 1; display: flex; flex-direction: column; background: rgba(14,14,31,0.88); border-right: 1px solid var(--gold-border); }
.drawer-head { padding: 64px 22px 18px; border-bottom: 1px solid var(--glass-border); }
.drawer-label { font-size: 10px; color: var(--text-muted); letter-spacing: .25em; margin-bottom: 4px; font-family: var(--font-serif); }
.drawer-title-txt { font-size: 20px; font-weight: 300; letter-spacing: .05em; }
.drawer-filter { padding: 12px 16px 14px; border-bottom: 1px solid var(--glass-border); }
.filter-select-label { display: block; font-size: 10px; color: var(--text-muted); letter-spacing: .2em; margin-bottom: 8px; }
.filter-select-wrap { position: relative; width: 100%; }
.filter-select {
  width: 100%;
  height: 38px;
  appearance: none;
  border: 1px solid rgba(212,175,55,0.22);
  border-radius: 10px;
  background: rgba(255,255,255,0.045);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 38px;
  padding: 0 38px 0 13px;
  outline: none;
  cursor: pointer;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.filter-select:focus {
  border-color: rgba(212,175,55,0.62);
  background: rgba(255,255,255,0.065);
  box-shadow: 0 0 0 3px rgba(212,175,55,0.1);
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
.d-hist-item { padding: 13px 20px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background .2s; }
.d-hist-item:hover { background: rgba(255,255,255,0.04); }
.d-hist-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.d-hist-dot.ji { background: var(--teal); box-shadow: 0 0 6px var(--teal); }
.d-hist-dot.xiong { background: var(--crimson); box-shadow: 0 0 6px var(--crimson); }
.d-hist-dot.ping { background: var(--gold); box-shadow: 0 0 6px var(--gold-dim); }
.d-hist-info { flex: 1; overflow: hidden; }
.d-hist-q { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.d-hist-meta { font-size: 10px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; }
.d-hist-badge { font-size: 10px; padding: 2px 7px; border-radius: 20px; flex-shrink: 0; border: 1px solid; }

/* 页面 */
.page-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 76px 18px 60px; }
.container { width: 100%; max-width: 520px; }
.tagline { text-align: center; padding: 20px 0 12px; }
.tagline-main { font-family: var(--font-serif); font-size: 13px; font-weight: 300; letter-spacing: .3em; color: var(--text-muted); margin-bottom: 6px; }
.tagline-sub { font-size: 11px; letter-spacing: .18em; color: rgba(255,255,255,0.18); }

.glass-card, .input-box {
  background: var(--bg-card); border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  backdrop-filter: blur(20px) saturate(1.2);
  box-shadow: 0 4px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
  position: relative; overflow: hidden;
}
.input-box { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; animation: riseIn 1s .15s cubic-bezier(.22,1,.36,1) both; }
.input-card { padding: 22px; margin-bottom: 16px; }
.input-label { font-family: var(--font-serif); font-size: 11px; letter-spacing: .2em; color: var(--text-muted); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.input-label::before, .input-label::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent); }
.route-info-trigger { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(232,204,128,0.42); background: rgba(232,204,128,0.08); color: var(--gold-light); font-size: 11px; font-family: ui-serif, Georgia, serif; font-weight: 700; line-height: 1; cursor: pointer; transition: border-color .2s, background .2s, color .2s; flex-shrink: 0; letter-spacing: 0; }
.route-info-trigger:hover { border-color: rgba(232,204,128,0.8); background: rgba(232,204,128,0.16); color: #fff; }
textarea { width: 100%; min-height: 130px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: var(--radius-item); padding: 16px; color: var(--text-primary); font-family: 'Noto Serif SC', serif; font-size: 15px; line-height: 1.8; resize: none; outline: none; transition: all .4s; }
textarea:focus { border-color: var(--gold-border); box-shadow: 0 0 0 1px rgba(212,175,55,0.12), 0 0 24px rgba(212,175,55,0.07); }
.time-row { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.time-display { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 7px; }
.time-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 6px var(--teal); animation: pulse-dot 2s infinite; }
.time-note { font-size: 11px; color: rgba(255,255,255,0.18); font-family: 'Noto Serif SC', serif; }

.cta-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 16px; }
.cta-btn { width: 100%; height: 60px; border: none; outline: none; cursor: pointer; border-radius: 18px; position: relative; overflow: hidden; background: linear-gradient(135deg, #8B6914 0%, #D4AF37 35%, #E8CC80 55%, #D4AF37 75%, #8B6914 100%); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite; box-shadow: 0 4px 20px rgba(212,175,55,0.3); transition: transform .2s; }
.cta-btn:active { transform: scale(0.98); }
.cta-btn:disabled { opacity: 0.5; animation: none; cursor: not-allowed; }
.cta-inner { display: flex; align-items: center; justify-content: center; gap: 10px; height: 100%; }
.cta-text { font-family: 'Noto Serif SC', serif; font-size: 17px; font-weight: 500; color: #1a1000; letter-spacing: .15em; }
.cta-hint { font-size: 11px; color: rgba(255,255,255,0.2); }

.auth-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px;
  margin-bottom: 16px;
  animation: riseIn 1s cubic-bezier(.22,1,.36,1) both;
}
.auth-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(232,204,128,0.08);
  pointer-events: none;
}
.auth-card-glow {
  position: absolute;
  top: -140px;
  right: -120px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(232,204,128,0.14), transparent 66%);
  pointer-events: none;
}
.auth-head { position: relative; display: flex; flex-direction: column; gap: 8px; padding-bottom: 4px; }
.auth-kicker { font-size: 10px; color: rgba(78,205,196,0.78); letter-spacing: .2em; font-weight: 700; }
.auth-head h1 { margin: 0; font-family: var(--font-serif); font-size: 26px; font-weight: 500; letter-spacing: .08em; color: var(--gold-light); }
.auth-head p { margin: 0; color: rgba(240,237,230,0.56); font-size: 13px; line-height: 1.7; }
.auth-oauth-row { display: grid; grid-template-columns: minmax(0,1.45fr) minmax(118px,.75fr); gap: 10px; }
.google-submit,
.guest-submit,
.auth-submit {
  min-height: 48px;
  border-radius: 14px;
  cursor: pointer;
  transition: transform .2s, border-color .2s, background .2s, box-shadow .2s, opacity .2s;
}
.google-submit {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.055);
  color: rgba(240,237,230,0.92);
  font-size: 14px;
  font-family: var(--font-body);
  font-weight: 650;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.16);
}
.google-submit:hover { border-color: rgba(232,204,128,0.36); background: rgba(255,255,255,0.082); }
.google-submit:active, .guest-submit:active, .auth-submit:active, .auth-switch:active { transform: scale(0.985); }
.google-submit:disabled, .auth-submit:disabled { opacity: 0.58; cursor: not-allowed; box-shadow: none; }
.google-mark { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: 0 0 24px; border-radius: 8px; background: rgba(255,255,255,0.96); box-shadow: 0 1px 0 rgba(255,255,255,0.35), 0 6px 14px rgba(0,0,0,0.2); }
.google-mark svg { width: 16px; height: 16px; display: block; }
.guest-submit {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(78,205,196,0.32);
  background: rgba(78,205,196,0.07);
  color: rgba(207,255,250,0.94);
  font-size: 13px;
  font-family: var(--font-body);
  font-weight: 650;
}
.guest-submit:hover { border-color: rgba(78,205,196,0.52); background: rgba(78,205,196,0.11); }
.auth-divider { display: flex; align-items: center; gap: 12px; color: rgba(255,255,255,0.26); font-size: 11px; }
.auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
.auth-fields { display: flex; flex-direction: column; gap: 12px; }
.auth-field { display: flex; flex-direction: column; gap: 7px; }
.auth-field span { color: rgba(240,237,230,0.5); font-size: 11px; letter-spacing: .12em; }
input[type="email"], input[type="password"] {
  width: 100%;
  min-height: 48px;
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 13px 15px;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  transition: border-color .2s, box-shadow .2s, background .2s;
}
input[type="email"]:focus, input[type="password"]:focus {
  background: rgba(0,0,0,0.3);
  border-color: rgba(232,204,128,0.45);
  box-shadow: 0 0 0 3px rgba(212,175,55,0.08);
}
input::placeholder { color: rgba(255,255,255,0.25); }
.auth-submit {
  width: 100%;
  padding: 14px 16px;
  border: none;
  background: linear-gradient(135deg, #F0D98F 0%, #C69A42 46%, #E3C36B 100%);
  color: #0a0800;
  font-size: 15px;
  font-family: var(--font-serif);
  font-weight: 700;
  letter-spacing: .16em;
  box-shadow: 0 14px 28px rgba(179,139,54,0.2), inset 0 1px 0 rgba(255,255,255,0.38);
}
.auth-inline-actions { display: flex; align-items: center; justify-content: center; gap: 16px; min-height: 20px; }
.forgot-password-link,
.auth-engineering-link {
  border: none;
  background: transparent;
  color: rgba(232,204,128,0.72);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}
.forgot-password-link:disabled { opacity: 0.6; cursor: not-allowed; }
.forgot-password-link:hover, .auth-engineering-link:hover { color: var(--gold-light); }
.auth-notice { padding: 10px 12px; border-radius: 12px; background: rgba(78,205,196,0.08); border: 1px solid rgba(78,205,196,0.18); color: rgba(240,237,230,0.86); font-size: 12px; line-height: 1.6; text-align: center; }
.auth-terms { color: rgba(240,237,230,0.38); font-size: 11px; line-height: 1.7; text-align: center; }
.auth-terms a { color: rgba(232,204,128,0.78); text-decoration: none; }
.auth-terms a:hover { color: var(--gold-light); text-decoration: underline; text-underline-offset: 3px; }
.auth-switch {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  background: rgba(255,255,255,0.025);
  color: rgba(240,237,230,0.72);
  font-size: 13px;
  cursor: pointer;
  transition: border-color .2s, background .2s, color .2s, transform .2s;
}
.auth-switch:hover { border-color: rgba(232,204,128,0.28); background: rgba(212,175,55,0.055); color: var(--gold-light); }

.qimen-profile-panel { position: relative; z-index: 42; padding: 14px 16px; overflow: visible; margin-bottom: 16px; }
.profile-switcher { position: relative; z-index: 60; }
.profile-switch-trigger {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(212,175,55,0.06));
  color: var(--gold-light);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,0.14);
}
.profile-switch-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-serif); font-size: 24px; letter-spacing: 1px; line-height: 1; }
.profile-switch-symbol { color: var(--gold-light); font-size: 24px; line-height: 1; opacity: .92; }
.profile-switcher.open .profile-switch-trigger { box-shadow: inset 0 0 0 1px rgba(212,175,55,0.24), 0 0 20px rgba(212,175,55,0.08); }
.profile-flyout { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 120; padding: 8px; border-radius: 16px; background: rgba(12,12,22,0.98); border: 1px solid rgba(212,175,55,0.2); box-shadow: 0 16px 40px rgba(0,0,0,0.45); backdrop-filter: blur(24px); }
.profile-flyout-item { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-radius: 12px; background: transparent; color: var(--text-primary); cursor: pointer; text-align: left; }
.profile-flyout-item + .profile-flyout-item { margin-top: 4px; }
.profile-flyout-item.active { background: rgba(212,175,55,0.1); box-shadow: inset 0 0 0 1px rgba(212,175,55,0.18); }
.profile-item-main { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.profile-item-date { color: #FF5E57; font-size: 12px; white-space: nowrap; }
.profile-item-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.add-bazi-profile-btn {
  width: 100%;
  min-height: 56px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(212,175,55,0.06));
  color: var(--gold-light);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,0.14);
  font-family: var(--font-serif);
  font-size: 22px;
  letter-spacing: 1px;
}
.add-bazi-profile-btn:hover { box-shadow: inset 0 0 0 1px rgba(212,175,55,0.26), 0 0 20px rgba(212,175,55,0.08); }

/* 动画和结果页 */
#loader { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 32px 0; }
.bagua-ring-wrap { position: relative; width: 120px; height: 120px; }
.bagua-svg { width: 100%; height: 100%; animation: rotateBagua 8s linear infinite; }
.loader-main-text { font-family: var(--font-serif); font-size: 13px; color: var(--gold); text-align: center; }

.result-actions { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 10px; margin-top: 16px; align-items: center; }
.reset-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 50px; background: transparent; border: 1px solid var(--glass-border); border-radius: 14px; color: var(--text-muted); font-size: 13px; cursor: pointer; transition: border-color .2s, background .2s, color .2s; }
.reset-btn:hover { border-color: rgba(255,255,255,0.14); color: rgba(240,237,230,0.75); }
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

:deep(.bazi-result-stack) { --bazi-line: rgba(177,158,109,0.18); --bazi-ink: rgba(244,237,220,0.92); }
:deep(.bazi-summary-module) { border-color: rgba(177,158,109,0.24); background: linear-gradient(180deg, rgba(177,158,109,0.08), rgba(255,255,255,0.025)); }
:deep(.bazi-mode-card) { border-color: var(--bazi-line); background: rgba(255,255,255,0.032); }
:deep(.bazi-meta-row) { display:flex; flex-wrap:wrap; gap:7px; margin:8px 0 12px; }
:deep(.bazi-meta-row span) { padding:4px 8px; border-radius:8px; border:1px solid rgba(177,158,109,0.18); color:rgba(230,218,190,0.74); font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
:deep(.bazi-level-chip),
:deep(.bazi-score-chip) { min-width:76px; height:76px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-direction:column; border:1px solid rgba(177,158,109,0.3); color:#F0D98F; background:rgba(177,158,109,0.08); font-family:var(--font-serif); font-size:26px; line-height:1; flex:0 0 auto; }
:deep(.bazi-score-chip span) { margin-top:5px; font-family:var(--font-body); font-size:11px; color:var(--text-muted); }
:deep(.bazi-level-chip.level-strong) { color:#4ECDC4; border-color:rgba(78,205,196,0.35); }
:deep(.bazi-level-chip.level-medium) { color:#D4AF37; border-color:rgba(212,175,55,0.35); }
:deep(.bazi-level-chip.level-weak)   { color:#FF9A56; border-color:rgba(255,154,86,0.35); }
:deep(.bazi-level-chip.level-mixed)  { color:#A78BFA; border-color:rgba(167,139,250,0.35); }
:deep(.bazi-level-chip.level-unknown){ color:var(--text-muted); border-color:rgba(255,255,255,0.12); }
:deep(.bazi-card-copy),
:deep(.bazi-logic) { margin:0; color:var(--bazi-ink); font-size:14px; line-height:1.78; overflow-wrap:anywhere; }
:deep(.bazi-basis-summary) { margin:0 0 10px; color:var(--bazi-ink); font-size:14px; line-height:1.75; overflow-wrap:anywhere; }
:deep(.bazi-signal-list),
:deep(.bazi-evidence-list) { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
:deep(.bazi-signal-list span),
:deep(.bazi-evidence-list span) { padding:7px 9px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.035); color:rgba(244,237,220,0.82); font-size:12px; line-height:1.45; overflow-wrap:anywhere; }
:deep(.bazi-signal-list.positive span) { border-color:rgba(78,205,196,0.2); background:rgba(78,205,196,0.06); }
:deep(.bazi-signal-list.warning span) { border-color:rgba(255,154,86,0.2); background:rgba(255,154,86,0.06); }
:deep(.bazi-foundation-group) { margin-top:10px; }
:deep(.foundation-group-label) { color:var(--text-muted); font-size:11px; letter-spacing:1px; margin-bottom:6px; }
:deep(.bazi-foundation-group .bazi-signal-list),
:deep(.bazi-foundation-group .bazi-evidence-list) { margin-top:0; }
:deep(.bazi-dynamic-grid) { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
:deep(.bazi-dynamic-grid div) { min-width:0; padding:12px; border-radius:10px; background:rgba(0,0,0,0.14); border:1px solid rgba(255,255,255,0.07); }
:deep(.bazi-dynamic-grid span) { display:block; color:var(--text-muted); font-size:10px; margin-bottom:5px; }
:deep(.bazi-dynamic-grid strong) { color:#F0D98F; font-size:15px; }
:deep(.bazi-dynamic-grid p) { margin:7px 0 0; color:rgba(244,237,220,0.74); font-size:12px; line-height:1.55; overflow-wrap:anywhere; }
:deep(.bazi-timing-window-list) { display:grid; gap:10px; }
:deep(.bazi-timing-window-card) { padding:12px; border-radius:10px; border:1px solid rgba(177,158,109,0.16); background:rgba(0,0,0,0.12); }
:deep(.bazi-window-top) { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:8px; }
:deep(.bazi-window-top strong) { color:#F0D98F; font-size:15px; }
:deep(.bazi-window-top span) { color:rgba(244,237,220,0.72); font-size:11px; }
:deep(.bazi-timing-window-card p) { margin:0; color:rgba(244,237,220,0.82); font-size:13px; line-height:1.62; }
:deep(.bazi-window-meta) { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
:deep(.bazi-window-meta span) { color:var(--text-muted); font-size:11px; }
:deep(.bazi-reading-block) { margin:8px 0; padding:8px 12px; background:rgba(255,255,255,0.03); border-left:2px solid rgba(212,175,55,0.3); border-radius:0 6px 6px 0; }
:deep(.bazi-reading-block.warning) { border-left-color:rgba(255,154,86,0.38); background:rgba(255,154,86,0.045); }
:deep(.bazi-reading-block .reading-label) { font-size:11px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; }
:deep(.bazi-reading-block p) { margin:0; color:var(--bazi-ink); font-size:14px; line-height:1.78; overflow-wrap:anywhere; }
:deep(.bazi-advice-extra) { display:grid; gap:8px; margin-top:10px; }
:deep(.bazi-advice-rows) { display:grid; gap:6px; margin-top:8px; }
:deep(.bazi-advice-row) { display:grid; grid-template-columns:72px minmax(0,1fr); gap:10px; align-items:start; padding:7px 0; border-top:1px solid rgba(255,255,255,0.055); }
:deep(.bazi-advice-row:first-child) { border-top:0; }
:deep(.advice-row-label) { color:var(--text-muted); font-size:12px; line-height:1.7; white-space:nowrap; }
:deep(.advice-row-text) { color:var(--bazi-ink); font-size:14px; line-height:1.7; overflow-wrap:anywhere; }
:deep(.bazi-advice-row.tone-warning .advice-row-label) { color:#F4B06A; }
:deep(.bazi-advice-row.tone-positive .advice-row-label) { color:#7CD5C8; }
:deep(.bazi-timing-meta) { display:grid; gap:8px; margin-bottom:12px; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.12); border:1px solid rgba(255,255,255,0.06); }
:deep(.timing-best) { color:#4ECDC4; font-size:13px; line-height:1.6; }
:deep(.timing-avoid) { color:#FFB36E; font-size:13px; line-height:1.6; }
:deep(.timing-disclaimer) { color:var(--text-muted); font-size:11px; line-height:1.5; opacity:.78; }
:deep(.bazi-capacity-row) { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
:deep(.capacity-label) { font-size:11px; color:var(--text-muted); }
:deep(.capacity-level) { font-size:14px; font-family:var(--font-serif); color:#D4AF37; }
:deep(.capacity-level.level-strong) { color:#4ECDC4; }
:deep(.capacity-level.level-weak) { color:#FF9A56; }
:deep(.capacity-level.level-mixed) { color:#A78BFA; }
:deep(.bazi-portrait-block) { padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.07); background:rgba(0,0,0,0.1); margin-top:10px; }
:deep(.portrait-label) { font-size:11px; color:var(--text-muted); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
:deep(.confidence-badge) { font-size:9px; padding:2px 5px; border-radius:4px; background:rgba(255,255,255,0.06); color:rgba(244,237,220,0.78); }
:deep(.bazi-portrait-block p) { margin:0; color:var(--bazi-ink); font-size:14px; line-height:1.74; overflow-wrap:anywhere; }
:deep(.bazi-disclaimer) { font-size:11px; color:var(--text-muted); font-style:italic; margin-top:8px; line-height:1.6; }
:deep(.bazi-timing-window-card.quality-strong) { border-color:rgba(78,205,196,0.3); background:rgba(78,205,196,0.04); }
:deep(.bazi-timing-window-card.quality-medium) { border-color:rgba(212,175,55,0.25); }
:deep(.bazi-timing-window-card.quality-weak)   { border-color:rgba(255,255,255,0.07); }
:deep(.major-window-badge) { font-size:10px; padding:2px 6px; border-radius:6px; background:rgba(212,175,55,0.15); color:#D4AF37; margin-left:6px; }

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
  background: rgba(12,12,22,0.98);
  border: 1px solid rgba(212,175,55,0.22);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.72);
  transform: translateY(12px) scale(0.98);
  transition: transform .28s cubic-bezier(.22,1,.36,1);
}
.share-img-overlay.show .share-img-modal { transform: none; }
.share-img-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(212,175,55,0.1);
  flex-shrink: 0;
}
.share-img-kicker { font-size: 9px; color: var(--text-muted); letter-spacing: .2em; }
.share-img-title { flex: 1; font-family: var(--font-serif); font-size: 15px; color: var(--gold-light); }
.share-img-close {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: var(--text-muted); font-size: 20px; line-height: 1;
  cursor: pointer; transition: color .2s, background .2s;
}
.share-img-close:hover { color: #fff; background: rgba(255,255,255,0.07); }
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
.feedback-drawer { width: min(420px, 92vw); height: 100%; padding: 24px 22px; overflow-y: auto; background: rgba(14,14,31,0.96); border-left: 1px solid var(--gold-border); box-shadow: -18px 0 48px rgba(0,0,0,0.48); transform: translateX(18px); transition: transform .28s var(--ease); }
.feedback-overlay.show .feedback-drawer { transform: translateX(0); }
.feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.feedback-kicker { font-size: 10px; color: var(--text-muted); letter-spacing: .22em; margin-bottom: 7px; }
.feedback-head h3 { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 500; color: var(--gold-light); line-height: 1.35; }
.feedback-close { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: var(--text-muted); font-size: 22px; line-height: 1; cursor: pointer; }
.feedback-summary { padding: 14px 15px; border: 1px solid rgba(232,204,128,0.12); border-radius: 14px; background: rgba(212,175,55,0.045); margin-bottom: 18px; }
.feedback-question { font-size: 14px; color: rgba(240,237,230,0.9); line-height: 1.65; overflow-wrap: anywhere; }
.feedback-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 10px; color: var(--text-muted); }
.feedback-conclusion { margin: 11px 0 0; padding-top: 11px; border-top: 1px solid rgba(255,255,255,0.06); color: var(--gold-light); font-size: 13px; line-height: 1.65; }
.feedback-form { display: flex; flex-direction: column; gap: 18px; }
.feedback-field { display: flex; flex-direction: column; gap: 10px; }
.feedback-label { display: flex; align-items: center; justify-content: space-between; color: rgba(240,237,230,0.82); font-size: 12px; letter-spacing: .08em; }
.feedback-label span { color: var(--text-muted); font-size: 10px; letter-spacing: 0; }
.feedback-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.feedback-option { min-height: 40px; padding: 9px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: rgba(240,237,230,0.78); font-size: 13px; cursor: pointer; transition: border-color .2s, background .2s, color .2s; }
.feedback-option.active { border-color: rgba(232,204,128,0.52); background: rgba(212,175,55,0.13); color: var(--gold-light); }
.feedback-note { min-height: 98px; padding: 12px 13px; border-radius: 12px; font-family: var(--font-body); font-size: 13px; line-height: 1.7; }
.feedback-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; margin-top: 22px; }
.feedback-secondary, .feedback-primary { min-height: 44px; border-radius: 12px; font-size: 14px; cursor: pointer; }
.feedback-secondary { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: var(--text-muted); }
.feedback-primary { border: none; background: linear-gradient(135deg, #E8CC80 0%, #B38B36 100%); color: #130d00; font-weight: 700; }
.feedback-primary:disabled { opacity: .55; cursor: not-allowed; }

@media(max-width:560px) {
  .feedback-overlay { align-items: flex-end; justify-content: center; }
  .feedback-drawer { width: 100%; height: auto; max-height: 88vh; border-left: none; border-top: 1px solid var(--gold-border); border-radius: 20px 20px 0 0; transform: translateY(24px); }
  .feedback-overlay.show .feedback-drawer { transform: translateY(0); }
  .auth-card { padding: 22px; gap: 16px; }
  .auth-head h1 { font-size: 23px; }
  .auth-oauth-row { grid-template-columns: 1fr; }
  .auth-inline-actions { justify-content: space-between; gap: 12px; }
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
.route-info-card { width: min(420px, 100%); background: rgba(14,14,31,0.96); border: 1px solid rgba(232,204,128,0.22); border-radius: 18px; padding: 20px; box-shadow: 0 24px 64px rgba(0,0,0,0.72); }
.route-info-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(232,204,128,0.14); color: var(--gold-light); font-family: var(--font-serif); font-size: 15px; }
.route-info-close { border: none; background: transparent; color: var(--text-muted); font-size: 22px; line-height: 1; cursor: pointer; padding: 0 2px; }
.route-info-close:hover { color: var(--gold); }
.route-info-grid { display: flex; flex-direction: column; gap: 10px; }
.route-info-row { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 12px; padding: 12px; border: 1px solid var(--glass-border); border-radius: 12px; background: rgba(0,0,0,0.18); }
.route-tool { color: var(--gold); font-weight: 700; font-size: 13px; letter-spacing: 1px; }
.route-focus { color: #F2E8C8; font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.route-info-row p { margin: 0; color: #CFCAD8; font-size: 12px; line-height: 1.55; }
.route-info-note { margin-top: 12px; padding: 11px 12px; border-left: 3px solid var(--gold); border-radius: 10px; background: rgba(212,175,55,0.08); color: #E8DDC0; font-size: 12px; line-height: 1.55; }

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
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.28);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
}
:deep(.summary-module) { display:flex; flex-direction:column; gap:12px; }
:deep(.summary-top) { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:start; }
:deep(.summary-main) { min-width:0; display:flex; flex-direction:column; gap:10px; }
:deep(.summary-title) { font-size:12px; color:var(--text-muted); letter-spacing:2px; }
:deep(.summary-score-bubble) {
  min-width:84px;
  display:flex; align-items:flex-end; justify-content:center; gap:3px;
  padding:12px 12px 10px; line-height:1;
  background:linear-gradient(180deg,var(--theme-color-dim,rgba(179,139,54,0.15)),rgba(255,255,255,0.03));
  border:1px solid color-mix(in srgb,var(--theme-color,#B38B36) 24%,transparent);
  border-radius:18px;
  box-shadow:0 0 24px var(--theme-color-dim,rgba(179,139,54,0.15));
}
:deep(.score) {
  color:var(--theme-color,#B38B36); font-family:var(--font-serif); font-weight:700; font-size:42px; letter-spacing:0;
  text-shadow:0 0 18px var(--theme-color-dim,rgba(179,139,54,0.15));
}
:deep(.score-unit) { color:var(--gold-light); font-family:var(--font-serif); font-size:18px; line-height:1.2; }
:deep(.summary-judgement) { display:flex; flex-direction:column; align-items:flex-start; gap:10px; min-width:0; }
:deep(.verdict-badge) { display:inline-flex; font-family:var(--font-serif); font-size:14px; padding:4px 13px; border-radius:999px; letter-spacing:.08em; border:1px solid; }
:deep(.verdict-da-ji) { color:#00D26A; background:rgba(0,210,106,0.06); border-color:rgba(0,210,106,0.2); text-shadow:0 0 14px rgba(0,210,106,0.35); }
:deep(.verdict-xiao-ji) { color:var(--teal); background:rgba(78,205,196,0.06); border-color:rgba(78,205,196,0.2); }
:deep(.verdict-ping) { color:var(--gold-light); background:rgba(212,175,55,0.06); border-color:rgba(212,175,55,0.2); }
:deep(.verdict-da-xiong) { color:var(--crimson); background:rgba(255,94,87,0.06); border-color:rgba(255,94,87,0.2); }
:deep(.conclusion) { font-family:var(--font-serif); font-size:23px; color:var(--theme-color,#E8CC80); line-height:1.5; letter-spacing:0; text-shadow:0 0 24px color-mix(in srgb,var(--theme-color,#B38B36) 26%,transparent); }
:deep(.keyword-highlight) {
  display:flex;
  align-items:center;
  gap:10px;
  width:fit-content;
  max-width:100%;
  padding:8px 12px;
  border-radius:12px;
  background:linear-gradient(90deg,var(--theme-color-dim,rgba(179,139,54,0.15)),rgba(255,255,255,0.02));
  border:1px solid color-mix(in srgb,var(--theme-color,#B38B36) 18%,rgba(255,255,255,0.06));
  box-shadow:0 0 18px var(--theme-color-dim,rgba(179,139,54,0.12));
  line-height:1.55;
}
:deep(.keyword-label) {
  flex-shrink:0;
  font-size:10px;
  color:var(--gold-light);
  letter-spacing:1.4px;
}
:deep(.keyword-text) {
  font-size:13px;
  color:#F1E6C4;
  overflow-wrap:anywhere;
}
:deep(.question-bubble) {
  width:100%;
  padding:12px 14px;
  background:rgba(255,255,255,0.025);
  border:1px solid rgba(255,255,255,0.06);
  border-radius:14px;
  box-sizing:border-box;
}
:deep(.question-text) { font-size:14px; color:rgba(240,237,230,0.76); font-style:normal; line-height:1.7; overflow-wrap:anywhere; }
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
:deep(.action-step) { min-width:0; padding:13px 13px 14px; border-radius:14px; background:linear-gradient(180deg,rgba(232,204,128,0.055),rgba(255,255,255,0.018)); border:1px solid rgba(232,204,128,0.12); }
:deep(.action-index) { font-family:var(--font-serif); font-size:20px; color:var(--theme-color,#B38B36); margin-bottom:8px; }
:deep(.action-copy) { font-size:13px; color:#D7D1C4; line-height:1.65; overflow-wrap:anywhere; }
/* 领域判断 */
:deep(.domain-view-module) { border-color:rgba(232,204,128,0.14); background:linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)); }
:deep(.domain-axis-grid) { display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:10px; }
:deep(.domain-axis-card) { position:relative; min-width:0; min-height:148px; padding:13px 13px 34px; border-radius:12px; background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.065); overflow:hidden; overflow-wrap:anywhere; }
:deep(.domain-axis-card::before) { content:''; position:absolute; inset:0 auto 0 0; width:3px; background:var(--theme-color,#B38B36); opacity:.75; }
:deep(.domain-axis-card.tone-positive::before) { background:#00D26A; }
:deep(.domain-axis-card.tone-warning::before) { background:#FF5E57; }
:deep(.domain-axis-top) { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
:deep(.domain-axis-label) { font-size:11px; color:var(--text-muted); letter-spacing:1.2px; }
:deep(.domain-axis-symbol) { flex-shrink:0; font-family:var(--font-serif); font-size:15px; color:var(--gold-light); }
:deep(.domain-axis-verdict) { font-size:13px; color:#F0EDE6; line-height:1.55; margin-bottom:8px; }
:deep(.domain-axis-evidence) { font-size:12px; color:#8F8FA3; line-height:1.6; }
:deep(.domain-axis-tone) { position:absolute; right:10px; bottom:9px; width:24px; height:24px; border-radius:50%; display:grid; place-items:center; font-size:11px; color:#05050A; background:var(--theme-color,#B38B36); font-weight:700; }
:deep(.domain-axis-card.tone-positive .domain-axis-tone) { background:#00D26A; }
:deep(.domain-axis-card.tone-warning .domain-axis-tone) { background:#FF5E57; color:#fff; }
:deep(.domain-section-grid) { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:10px; }
:deep(.domain-mini-card) { min-width:0; padding:12px 13px; border-radius:12px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.055); overflow-wrap:anywhere; }
:deep(.domain-mini-label) { display:flex; justify-content:space-between; gap:8px; margin-bottom:8px; font-size:11px; color:var(--gold-light); letter-spacing:1px; }
:deep(.domain-mini-label span) { color:var(--text-muted); letter-spacing:0; text-align:right; }
:deep(.domain-mini-body) { font-size:13px; color:#D7D1C4; line-height:1.65; }
:deep(.domain-mini-evidence) { margin-top:7px; font-size:12px; color:#8F8FA3; line-height:1.55; }
:deep(.domain-decision) { display:grid; gap:8px; margin-top:10px; }
:deep(.domain-decision div) { display:flex; gap:9px; align-items:flex-start; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.16); color:#D7D1C4; font-size:13px; line-height:1.65; overflow-wrap:anywhere; }
:deep(.domain-decision span) { flex:0 0 auto; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; background:rgba(232,204,128,0.12); color:var(--gold-light); font-size:11px; font-weight:700; }
/* 九宫格 */
:deep(.pan-wrapper) { background:rgba(0,0,0,0.25); border:1px solid var(--gold-border); border-radius:16px; padding:14px; position:relative; overflow:hidden; }
:deep(.pan-wrapper)::before { content:''; position:absolute; inset:0; background:radial-gradient(circle at 50% 50%,rgba(212,175,55,0.03) 0%,transparent 70%); pointer-events:none; }
:deep(.pan-header) { text-align:center; margin-bottom:12px; }
:deep(.pan-pillars) { font-family:var(--font-serif); font-size:16px; color:#FFF; letter-spacing:3px; margin-bottom:5px; }
:deep(.pan-info) { font-size:11px; color:#777; line-height:1.75; }
:deep(.pan-info b) { color:var(--theme-color,#B38B36); font-weight:600; }
:deep(.pan-grid) { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(255,255,255,0.04); border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.04); }
:deep(.pan-cell) { background:rgba(10,10,22,0.92); aspect-ratio:1; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:background .2s; }
:deep(.pan-cell:hover) { background:rgba(255,255,255,0.03); }
:deep(.pan-center-earth) { font-size:30px; font-weight:900; color:var(--text-dim); font-family:'Noto Serif SC',serif; }
:deep(.pan-god) { position:absolute; top:5px; font-size:8px; color:#555; font-family:'Noto Serif SC',serif; }
:deep(.pan-star) { font-size:11px; color:#CCC; margin-bottom:1px; z-index:2; font-family:'Noto Serif SC',serif; }
:deep(.pan-door) { font-size:14px; font-weight:700; color:#FFF; z-index:2; font-family:'Noto Serif SC',serif; }
:deep(.pan-stem) { position:absolute; font-size:10px; font-weight:600; font-family:'Noto Serif SC',serif; }
:deep(.stem-sky) { top:5px; left:6px; color:#DDDDE8; }
:deep(.stem-earth) { bottom:5px; right:6px; color:#666; }
:deep(.ji-sky) { top:18px; left:6px; font-size:8px; color:#444; }
:deep(.ji-earth) { bottom:18px; right:6px; font-size:8px; color:#444; }
:deep(.pan-marks) { position:absolute; bottom:4px; left:4px; display:flex; gap:2px; z-index:3; }
:deep(.pan-mark) { font-size:8px; padding:1px 3px; border-radius:3px; font-weight:700; }
:deep(.mark-ma) { background:var(--theme-color,#B38B36); color:#000; }
:deep(.mark-kong) { border:1px solid #444; color:#666; background:rgba(0,0,0,0.4); }
:deep(.highlight-text) { color:var(--theme-color,#E8CC80) !important; text-shadow:0 0 12px color-mix(in srgb,var(--theme-color,#B38B36) 50%,transparent); }
/* 单列洞察条 */
:deep(.insight-flow) { display:flex; flex-direction:column; gap:10px; }
:deep(.insight-strip) { position:relative; padding:14px 16px 14px 18px; background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.05); border-radius:12px; border-left:3px solid rgba(255,255,255,0.1); transition:border-color .3s, transform .25s, box-shadow .25s; }
:deep(.insight-strip:hover) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,0.25); }
:deep(.insight-strip-label) { font-size:10px; color:var(--text-muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; font-weight:500; }
:deep(.insight-strip-body) { font-size:13px; color:#D0D0D8; line-height:1.75; }
:deep(.accent-theme) { border-left-color:var(--theme-color,#B38B36); background:linear-gradient(135deg,color-mix(in srgb,var(--theme-color,#B38B36) 5%,transparent),transparent); }
:deep(.accent-theme .insight-strip-label) { color:var(--theme-color,#B38B36); }
:deep(.accent-amber) { border-left-color:#F5C518; background:linear-gradient(135deg,rgba(245,197,24,0.03),transparent); }
:deep(.accent-amber .insight-strip-label) { color:#F5C518; }
:deep(.accent-indigo) { border-left-color:#7B8CFF; background:linear-gradient(135deg,rgba(107,140,255,0.03),transparent); }
:deep(.accent-indigo .insight-strip-label) { color:#8B9AFF; }
:deep(.accent-gold) { border-left-color:var(--gold); background:linear-gradient(135deg,rgba(212,175,55,0.03),transparent); }
:deep(.accent-gold .insight-strip-label) { color:var(--gold-light); }
:deep(.accent-violet) { border-left-color:#B39DDB; background:linear-gradient(135deg,rgba(179,157,219,0.03),transparent); }
:deep(.accent-violet .insight-strip-label) { color:#B39DDB; }
:deep(.accent-teal) { border-left-color:var(--teal); background:linear-gradient(135deg,rgba(78,205,196,0.03),transparent); }
:deep(.accent-teal .insight-strip-label) { color:var(--teal); }
:deep(.accent-neutral) { border-left-color:rgba(255,255,255,0.15); }
/* 评分依据 */
:deep(.score-basis-body) { display:flex; flex-direction:column; gap:10px; margin-top:4px; }
:deep(.sb-row) { display:flex; flex-direction:column; gap:6px; }
:deep(.sb-row-title) { font-size:9px; color:var(--text-muted); font-weight:600; letter-spacing:1.5px; }
:deep(.sb-tags) { display:flex; flex-wrap:wrap; gap:6px; }
:deep(.sb-tag) { font-size:11px; padding:3px 10px; border-radius:20px; font-weight:500; transition:transform .2s; }
:deep(.sb-tag:hover) { transform:scale(1.05); }
:deep(.sb-tag.positive) { background:rgba(0,210,106,0.08); color:#00D26A; border:1px solid rgba(0,210,106,0.18); }
:deep(.sb-tag.negative) { background:rgba(255,94,87,0.08); color:#FF5E57; border:1px solid rgba(255,94,87,0.18); }
:deep(.sb-logic) { font-size:12px; color:#8888A0; line-height:1.7; padding:10px 12px; background:rgba(255,255,255,0.015); border-radius:8px; border-left:2px solid var(--theme-color,#B38B36); }
/* 策略与风险 */
:deep(.strategy-list) { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
:deep(.strategy-list li) { position:relative; padding:12px 14px 12px 36px; background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.05); border-radius:10px; color:#C8C8D4; font-size:13px; line-height:1.7; transition:border-color .25s,background .25s; }
:deep(.strategy-list li:hover) { border-color:rgba(212,175,55,0.18); background:rgba(212,175,55,0.02); }
:deep(.strategy-list li)::before { content:"\2726"; position:absolute; left:14px; top:13px; color:var(--theme-color,#B38B36); font-size:10px; }
:deep(.risk-alert) { background:rgba(255,94,87,0.04); border:1px solid rgba(255,94,87,0.12); border-left:3px solid #FF5E57; border-radius:10px; padding:14px 16px; }
:deep(.risk-alert-content) { color:#D0D0D8; font-size:13px; line-height:1.7; }
/* 底部吉运 */
:deep(.footer) { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
:deep(.f-item) { min-width:0; display:flex; flex-direction:column; gap:6px; padding:12px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(212,175,55,0.08); }
:deep(.f-label) { font-size:10px; color:var(--text-muted); letter-spacing:1px; }
:deep(.f-text) { font-size:12px; font-weight:600; color:var(--theme-color,#E8CC80); line-height:1.5; overflow-wrap:anywhere; }
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


</style>
