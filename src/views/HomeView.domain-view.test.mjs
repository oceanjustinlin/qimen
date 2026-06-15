import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./HomeView.vue', import.meta.url), 'utf8')

test('奇门结果卡片按四个模块顺序渲染且不展示 M 编号', () => {
  assert.match(source, /const getApiBase = \(\) =>/)
  assert.match(source, /\.qimen-1ff\.pages\.dev/)
  assert.match(source, /https:\/\/qimen-preview\.oceanjustinlin\.workers\.dev/)
  assert.match(source, /const domainView = data\.domain_view/)
  assert.match(source, /<button class="mag-tab mag-tab-active" onclick="\$\{tabClick\('mag-m1'\)\}">结论先行<\/button>/)
  assert.match(source, /<button class="mag-tab" onclick="\$\{tabClick\('mag-m2'\)\}">奇门定基<\/button>/)
  assert.match(source, /<button class="mag-tab" onclick="\$\{tabClick\('mag-m3'\)\}">局象推演<\/button>/)
  assert.match(source, /<button class="mag-tab" onclick="\$\{tabClick\('mag-m4'\)\}">开运指南<\/button>/)
  assert.doesNotMatch(source, />M[1-4]\s/)
  assert.doesNotMatch(source, /M3\.\$\{index \+ 1\}/)
  assert.doesNotMatch(source, /<div class="report-subtitle">分数依据<\/div>/)

  const m1Index = source.indexOf('<section class="mag-section" id="mag-m1">')
  const m2Index = source.indexOf('<section class="mag-section" id="mag-m2">')
  const m3Index = source.indexOf('<section class="mag-section" id="mag-m3">')
  const m4Index = source.indexOf('<section class="mag-section" id="mag-m4">')

  assert.ok(m1Index > -1)
  assert.ok(m2Index > m1Index)
  assert.ok(m3Index > m2Index)
  assert.ok(m4Index > m3Index)
})

test('结果页隐藏顶部标题和右侧入口但首页输入框保留', () => {
  assert.match(source, /<header id="siteHeader" :class="\{ 'result-header': viewState === 'result' \}">/)
  assert.match(source, /v-if="viewState !== 'result'" class="site-logo"/)
  assert.match(source, /v-if="viewState !== 'result'" class="header-actions"/)
  assert.match(source, /class="page-wrap" :class="\{ 'result-page-wrap': viewState === 'result' \}"/)
  assert.match(source, /#siteHeader\.result-header/)
  assert.match(source, /#siteHeader\.result-header \{[\s\S]{0,180}position:\s*absolute/)
  assert.match(source, /\.result-page-wrap \{[^}]*padding-top:\s*0;/)
  assert.match(source, /\.result-page-wrap :deep\(\.mag-tabs\)/)
})

test('历史抽屉顶部提供再起一局入口返回首页', () => {
  assert.match(source, /class="drawer-new-session" type="button" @click="startNewSession"/)
  assert.match(source, />再起一局</)
  assert.match(source, /const startNewSession = \(\) => \{[\s\S]{0,120}resetToInput\(\)[\s\S]{0,120}globalState\.isDrawerOpen = false/)
})

test('历史抽屉延迟加载轻量分页列表并在滚动到底时续拉', () => {
  assert.match(source, /const HISTORY_PAGE_SIZE = 20/)
  assert.match(source, /@scroll\.passive="handleHistoryScroll"/)
  assert.match(source, /if \(globalState\.isDrawerOpen\) ensureHistoryLoaded\(\)/)
  assert.doesNotMatch(source, /handleSessionUpdate[\s\S]{0,260}loadHistory\(\)/)

  const loadStart = source.indexOf('const loadHistoryPage = async')
  const loadEnd = source.indexOf('const loadHistory = async', loadStart)
  const loadSource = source.slice(loadStart, loadEnd)

  assert.ok(loadStart > -1)
  assert.ok(loadEnd > loadStart)
  assert.match(loadSource, /\.select\(QIMEN_HISTORY_LIST_SELECT\)/)
  assert.match(loadSource, /\.range\(from, to\)/)
  assert.doesNotMatch(loadSource, /qimen_data[^-\n>]/)
  assert.doesNotMatch(loadSource, /select\('\*'\)/)
})

test('奇门定基和局象推演包含用神、四段推演和开运样式', () => {
  assert.match(source, /yongshen-card-grid/)
  assert.match(source, /reportM2\.yongshen_cards/)
  assert.match(source, /subject_day_stem_state/)
  assert.match(source, /target_yongshen_state/)
  assert.match(source, /constraint_factors/)
  assert.match(source, /interaction_decision/)
  assert.match(source, /const hasQimenReport = Boolean\(report && Object\.keys\(report\)\.length\)/)
  assert.match(source, /const score = reportM1\.score \?\? summary\.score \?\? 0/)
  assert.match(source, /hasQimenReport && Object\.keys\(reportM3\)\.length[\s\S]{0,120}deriveScoreBasisFromM3\(reportM3/)
  assert.match(source, /target\?\.reading/)
  assert.match(source, /support\?\.summary/)
  assert.match(source, /const interactionMainText = toStr\(interactionDecision\?\.reading/)
  assert.match(source, /normalizedInteractionDecision/)
  assert.match(source, /tone: interactionDecision\?\.tone \|\| \(relation\?\.effect > 0/)
  assert.match(source, /itemsOf\(support\)/)
  assert.match(source, /renderFactorList/)
  assert.match(source, /guidance-row/)
  assert.match(source, /min-height:\s*40svh/)
  assert.doesNotMatch(source, /inference-card[\s\S]{0,220}<p>\$\{card\.evidence \|\| '暂无依据说明'\}<\/p>/)
  assert.match(source, /card\?\.decision/)
  assert.match(source, /card\?\.reason/)
  assert.match(source, /reportM3\.self_state/)
  assert.match(source, /reportM3\.target_state/)
  assert.match(source, /reportM3\.constraints/)
  assert.match(source, /reportM3\.interaction_verdict/)
  assert.match(source, /environment_fengshui/)
  assert.match(source, /timing_behavior/)
  assert.match(source, /\.yongshen-card/)
  assert.match(source, /\.inference-card/)
  assert.match(source, /\.guidance-card/)
  assert.match(source, /overflow-wrap:\s*anywhere/)
  assert.match(source, /:deep\(\.inference-head span\)[\s\S]{0,120}font-size:\s*18px/)
  assert.match(source, /:deep\(\.inference-card h4\)[\s\S]{0,180}font-weight:\s*400/)
})

test('奇门格局标签使用新容器恢复点击说明弹窗', () => {
  assert.match(source, /data-ge-reasons/)
  assert.match(source, /formation-tag-row/)
  assert.match(source, /tag\.closest\('\.formation-tag-row, \.ge-tags-row'\)/)
  assert.match(source, /ge-pop-kicker/)
  assert.match(source, /:deep\(\.ge-tag\)[\s\S]{0,320}border-radius:\s*999px/)
})

test('奇门页使用顶部档案筛选器并移除旧八字注入开关', () => {
  assert.match(source, /qimen-profile-panel/)
  assert.match(source, /profile-switch-trigger/)
  assert.match(source, /添加八字档案/)
  assert.match(source, /goToBaziProfiles/)
  assert.doesNotMatch(source, /注入命主八字分析/)
  assert.doesNotMatch(source, /bazi-toggle/)
  assert.doesNotMatch(source, /v-model="baziEnabled"/)
})

test('奇门占卜提交不再强制要求八字档案且仅 hybrid 携带已选档案摘要', () => {
  assert.doesNotMatch(source, /baziEnabled\.value && baziState\.value !== 'ready'/)
  assert.doesNotMatch(source, /window\.confirm\('这个问题更适合结合八字命局与奇门事件盘/)
  assert.match(source, /baziInfo:\s*\(routeData\.branch === 'qimen'\) \? null : \(currentBaziString\.value \|\| null\)/)
  assert.match(source, /hasBaziProfile:\s*Boolean\(selectedProfileId\.value \|\| baziProfiles\.value\.length\)/)
})

test('登录或注册落地页显式覆盖访客应用视图', () => {
  assert.match(source, /const authView = ref\('landing'\)/)
  assert.match(source, /const isLoginMode = computed\(\(\) => authView\.value === 'login'\)/)
  assert.match(source, /authView === 'landing'/)
  assert.match(source, /authView === 'login'/)
  assert.match(source, /authView === 'register'/)
  assert.match(source, /auth-taiji-wrap/)
  assert.match(source, /@media\(max-width:760px\)[\s\S]{0,120}\.seo-landing,[\s\S]{0,160}\.seo-faq-section[\s\S]{0,80}display:\s*none/)
  assert.match(source, /@media\(max-width:760px\)[\s\S]{0,420}\.auth-taiji-wrap[\s\S]{0,80}display:\s*block/)
  assert.match(source, /const isAuthLanding = computed\(\(\) => \['login', 'register'\]\.includes\(route\.query\.auth\)\)/)
  assert.match(source, /const canUseApp = computed\(\(\) => Boolean\(currentUser\.value \|\| \(isGuest\.value && globalState\.guestAccessUnlocked && !isAuthLanding\.value\)\)\)/)
  assert.match(source, /enterGuestMode\(\)/)
  assert.match(source, /globalState\.guestAccessUnlocked/)
})

test('八字问答结果使用 mode 卡片而不是奇门分数泡泡', () => {
  assert.match(source, /const buildBaziQuestionCardHTML = \(data\) =>/)
  assert.match(source, /summary\.score !== null && summary\.score !== undefined/)
  assert.match(source, /bazi-mode-card/)
  assert.match(source, /bazi-timing-window-card/)
  assert.match(source, /if \(data\.branch === 'bazi' && data\.meta\?\.analysis_mode\)/)
})

test('奇门占卜结果分数旁不展示格局吉凶数量角标', () => {
  const summaryStart = source.indexOf('<section class="mag-hero" id="mag-hero">', source.indexOf('const buildCardHTML'))
  const summaryEnd = source.indexOf('</section>', summaryStart)
  const summarySource = source.slice(summaryStart, summaryEnd)

  assert.ok(summaryStart > -1)
  assert.ok(summaryEnd > summaryStart)
  assert.match(summarySource, /mag-verdict-badge/)
  assert.doesNotMatch(summarySource, /ge-corner-badges/)
  assert.doesNotMatch(summarySource, /geCornerHTML/)
})

test('奇门结果动态 HTML 使用标准属性引号以保留样式 class', () => {
  const cardStart = source.indexOf('const buildCardHTML = (data, opts = {}) => {')
  const cardEnd = source.indexOf('\n</script>', cardStart)
  const cardSource = source.slice(cardStart, cardEnd)

  assert.ok(cardStart > -1)
  assert.ok(cardEnd > cardStart)
  assert.match(cardSource, /<div class="mag-result tone-\$\{heroTone\}"/)
  assert.match(cardSource, /<div class="pan-cell"/)
  assert.doesNotMatch(cardSource, /[“”]/)
})

test('八字问答结果把枚举 meta 渲染为用户可读标签', () => {
  const cardStart = source.indexOf('const buildBaziQuestionCardHTML = (data) => {')
  const cardEnd = source.indexOf('const deriveScoreBasisFromM3', cardStart)
  const cardSource = source.slice(cardStart, cardEnd)

  assert.ok(cardStart > -1)
  assert.ok(cardEnd > cardStart)
  assert.match(source, /baziAnalysisModeLabel/)
  assert.match(source, /当前状态/)
  assert.match(source, /精确领域/)
  assert.match(cardSource, /<div class="mag-result tone-\$\{heroTone\}"/)
  assert.doesNotMatch(cardSource, /[“”]/)
  assert.doesNotMatch(source, /<span>\$\{meta\.analysis_mode \|\| 'bazi'\}<\/span>/)
  assert.doesNotMatch(source, /<span>\$\{meta\.target\.fallback_level\}<\/span>/)
  assert.doesNotMatch(source, /<div class="bazi-meta-row">/)
})

test('八字问答结果挂载原局排盘背书板块', () => {
  assert.match(source, /import BaziBackingPanel from/)
  assert.match(source, /activeBaziResultData/)
  assert.match(source, /<BaziBackingPanel/)
  assert.match(source, /:profile="snapshotProfile"/)
  assert.match(source, /:result-data="activeBaziResultData"/)
  assert.match(source, /<template #identity>/)
  assert.match(source, /原局命盘/)
})

test('八字命局解读先展示分析 panel，并在四柱缺失时补全 panel 数据', () => {
  const m2Start = source.indexOf('const m2HTML = `<section class="mag-section" id="bazi-m2">')
  const m2End = source.indexOf('// ── Section 3: 深度推演', m2Start)
  const m2Source = source.slice(m2Start, m2End)

  assert.ok(m2Start > -1)
  assert.ok(m2End > m2Start)
  assert.ok(m2Source.indexOf('id="bazi-panel-anchor"') < m2Source.indexOf('${foundationPhenomenaHTML}'))
  assert.match(source, /if \(!data\.state_report\) fetchMissingPanelData\(data\)/)
  assert.match(source, /else if \(!baziPanelMatrix\.value\) fetchMissingPanelMatrix\(\)/)
  assert.match(source, /const fetchMissingPanelMatrix = async \(\) =>/)
  assert.match(source, /:deep\(\.bazi-panel-anchor\)[\s\S]{0,120}margin-bottom:\s*28px/)
})

test('八字 panel 补数据不在前端重复查询完整 bazi_detail', () => {
  const start = source.indexOf('const fetchMissingPanelMatrix = async')
  const end = source.indexOf('const readFollowupSSE', start)
  const block = source.slice(start, end)

  assert.ok(start > -1)
  assert.ok(end > start)
  assert.match(block, /fetch\(apiPath\('\/api\/bazi-panel'\)/)
  assert.match(block, /else if \(!baziPanelMatrix\.value\) fetchMissingPanelMatrix\(\)/)
  assert.doesNotMatch(block, /from\('bazi_profiles'\)/)
  assert.doesNotMatch(block, /select\('bazi_detail/)
  assert.doesNotMatch(block, /profileData:/)
})

test('八字动态 panel 的长断语正常换行，不压缩状态变化文本', () => {
  const component = readFileSync(new URL('../components/BaziDynamicPanel.vue', import.meta.url), 'utf8')

  assert.match(component, /\.target-trigger-row[\s\S]{0,180}flex-direction:\s*column/)
  assert.match(component, /\.auspice-badge[\s\S]{0,220}white-space:\s*normal/)
  assert.match(component, /\.auspice-badge[\s\S]{0,260}align-self:\s*stretch/)
})

test('八字动态 panel 对旧记录中的重复机制做语义去重', () => {
  const component = readFileSync(new URL('../components/BaziDynamicPanel.vue', import.meta.url), 'utf8')

  assert.match(component, /function visibleMechanisms\(impact\)/)
  assert.match(component, /const key = `\$\{mech\?\.type/)
  assert.match(component, /v-for="\(mech, i\) in visibleMechanisms\(liunianImpact\)"/)
})

test('八字动态 panel 透干引动优先显示透出天干的十神', () => {
  const component = readFileSync(new URL('../components/BaziDynamicPanel.vue', import.meta.url), 'utf8')

  assert.match(component, /function touGanShishen\(mech\)/)
  assert.match(component, /mech\?\.type !== '透干引动'/)
  assert.match(component, /match\(\/（\(\[\^）\]\+\)）透干\/\)/)
  assert.match(component, /label: `透出天干\$\{name\}`/)
})

test('八字动态 panel 目标标签前置并用机制强度进度条替代有效潜伏文案', () => {
  const component = readFileSync(new URL('../components/BaziDynamicPanel.vue', import.meta.url), 'utf8')

  const rowStart = component.indexOf('v-for="(mech, i) in visibleMechanisms(liunianImpact)"')
  const rowEnd = component.indexOf('<div v-if="visibleMechanisms(liunianImpact).length === 0"', rowStart)
  const rowSource = component.slice(rowStart, rowEnd)

  assert.ok(rowStart > -1)
  assert.ok(rowEnd > rowStart)
  assert.ok(rowSource.indexOf('target-chip') < rowSource.indexOf('mech-type'))
  assert.ok(rowSource.indexOf('mech-detail-line') < rowSource.indexOf('mech-desc'))
  assert.match(component, /function mechanismStrength\(mech\)/)
  assert.match(component, /normalizeMechanismStrength\(mech\?\.effective_strength\)/)
  assert.match(component, /mech-vigor-meter/)
  assert.match(component, /mech-strength-label">机制强度/)
  assert.doesNotMatch(component, /mech-strength-label">引动强度/)
  assert.match(component, /\.mech-row[\s\S]{0,180}flex-direction:\s*column/)
  assert.match(component, /\.mech-detail-line[\s\S]{0,120}align-items:\s*baseline/)
  assert.doesNotMatch(component, /有效/)
  assert.doesNotMatch(component, /潜伏/)
})

test('八字动态 panel 年份头部展示命主状态而非引动强度', () => {
  const component = readFileSync(new URL('../components/BaziDynamicPanel.vue', import.meta.url), 'utf8')

  assert.match(component, /class="year-subject-vigor"/)
  assert.match(component, />命主状态</)
  assert.match(component, /subjectVigorPercent\(tw\.dynamicReport\.liunian_impact\)/)
  assert.match(component, /subjectVigorTitle\(tw\.dynamicReport\.liunian_impact\)/)
  assert.doesNotMatch(component, /触发旺度/)
})

test('八字动态 panel 目标标签展示柱位来源和十神全称', () => {
  assert.match(source, /const fullShishen = \{ 财: '正财', 才: '偏财'/)
  assert.match(source, /const positionLabel = \{ gan: '干', zhi_main: '支主气', hidden: '支藏干' \}/)
  assert.match(source, /label: source \? `\$\{source\}\$\{name\}` : name/)
})

test('八字报告只在 Hero 展示总结结论', () => {
  const component = readFileSync(new URL('../components/BaziDynamicPanel.vue', import.meta.url), 'utf8')
  const m1Start = source.indexOf('const m1HTML = `<section class="mag-section" id="bazi-m1">')
  const m1End = source.indexOf('// ── Section 2: 命局解读', m1Start)
  const m1Source = source.slice(m1Start, m1End)

  assert.ok(m1Start > -1)
  assert.ok(m1End > m1Start)
  assert.doesNotMatch(m1Source, /bazi-verdict-body/)
  assert.doesNotMatch(component, /综合结论/)
  assert.doesNotMatch(component, /conclusionText/)
  assert.doesNotMatch(source, /baziPanelConclusionText/)
})

test('八字命局底盘信号按现象和说明拆成表格行展示', () => {
  assert.match(source, /const splitBaziFoundationSignal = \(signal\) =>/)
  assert.match(source, /<h3 class="bazi-bf-title">命局现象<\/h3>/)
  assert.match(source, /<h3 class="bazi-bf-title">用神状态<\/h3>/)
  assert.match(source, /class="bazi-bf-signal-row"/)
  assert.match(source, /class="bazi-bf-signal-label"/)
  assert.match(source, /class="bazi-bf-signal-detail"/)
  assert.doesNotMatch(source, /class="bazi-bf-signal"/)
  assert.match(source, /:deep\(\.bazi-bf-signals\)[\s\S]{0,120}display:grid/)
})

test('八字命局解读按 panel、命局现象、用神状态排列，原局底盘进入深度推演', () => {
  const m2Start = source.indexOf('const m2HTML = `<section class="mag-section" id="bazi-m2">')
  const m2End = source.indexOf('// ── Section 3: 深度推演', m2Start)
  const m2Source = source.slice(m2Start, m2End)
  const m3End = source.indexOf('// ── Section 4: 时间线', m2End)
  const m3Source = source.slice(m2End, m3End)

  assert.ok(m2Source.indexOf('id="bazi-panel-anchor"') < m2Source.indexOf('${foundationPhenomenaHTML}'))
  assert.ok(m2Source.indexOf('${foundationPhenomenaHTML}') < m2Source.indexOf('${targetStateHTML}'))
  assert.doesNotMatch(m2Source, /\$\{bfHTML\}|原局底盘/)
  assert.doesNotMatch(m2Source, /signalsFlowHTML|命局信号|keySignals/)
  assert.doesNotMatch(source, /inferItems\.push\(\{ label: ts\.title/)
  assert.doesNotMatch(source, /inferItems\.push\(\{ label: `\$\{targetLabel\}状态`/)
  assert.match(m3Source, /inferItems\.push\(\{ label: '原局底盘', text: bf\.text/)
  assert.match(m3Source, /<div class="module-heading"><h2>深度推演<\/h2><\/div>/)
  assert.match(source, /\{ id: 'bazi-m3', label: '深度推演'/)
})

test('八字深度推演按 mode 收敛内容并使用统一纵向段落', () => {
  const m3Start = source.indexOf('// ── Section 3: 深度推演')
  const m3End = source.indexOf('// ── Section 4: 时间线', m3Start)
  const m3Source = source.slice(m3Start, m3End)

  assert.match(m3Source, /const deepReadingRow = \(label, text, tone = '', extra = '', factor = ''\) =>/)
  assert.match(m3Source, /class="inference-flow bazi-deep-flow"/)
  assert.match(m3Source, /class="inference-factor"/)
  assert.doesNotMatch(m3Source, /psychological_mirror|outcome_projection|当下感受|后续推演/)
  assert.match(m3Source, /label: '大运建场'/)
  assert.match(m3Source, /label: '流年触发'/)
  assert.match(m3Source, /label: '先天格局'/)
  assert.match(m3Source, /label: '外貌气质'/)
  assert.match(m3Source, /label: '应期概览'/)
})

test('八字时间节奏只展示深度推演之外的增量内容', () => {
  const m4Start = source.indexOf('// ── Section 4: 时间线')
  const m4End = source.indexOf('// ── Section 5: 行动建议', m4Start)
  const m4Source = source.slice(m4Start, m4End)

  assert.match(m4Source, /const normalizeRhythmText = \(value\) =>/)
  assert.match(m4Source, /const isDistinctRhythmText = \(value\) =>/)
  assert.match(m4Source, /const visibleRhythmSegments = segments/)
  assert.match(m4Source, /strategy: isDistinctRhythmText\(seg\.strategy\) \? seg\.strategy : ''/)
  assert.match(m4Source, /key_liunians: \(seg\.key_liunians \|\| \[\]\)\.filter/)
  assert.match(m4Source, /\.filter\(seg => seg\.strategy \|\| seg\.key_liunians\.length\)/)
  assert.match(m4Source, /const rhythmFlowHTML = visibleRhythmSegments\.length/)
})

test('八字行动建议使用总述加单列两位数编号列表', () => {
  const m5Start = source.indexOf('// ── Section 5: 行动建议')
  const m5End = source.indexOf('const tabDefs = [', m5Start)
  const m5Source = source.slice(m5Start, m5End)

  assert.match(m5Source, /const adviceItems = agItems\.length/)
  assert.match(m5Source, /const adviceIntroHTML = agText/)
  assert.match(m5Source, /class="bazi-action-intro"/)
  assert.match(m5Source, /class="mag-action-list bazi-action-list"/)
  assert.match(m5Source, /class="mag-action-item"/)
  assert.match(m5Source, /class="mag-action-num"/)
  assert.match(m5Source, /String\(i \+ 1\)\.padStart\(2, '0'\)/)
  assert.doesNotMatch(m5Source, /guidance-grid|guidance-card|guidance-kicker|guidance-row/)
})

test('问事结果页 Tab 随滚动位置通用联动', () => {
  assert.match(source, /const syncMagTabsToScroll = \(\) =>/)
  assert.match(source, /nav\.closest\('\.mag-result'\)/)
  assert.match(source, /querySelectorAll\('\.mag-section\[id\]'\)/)
  assert.match(source, /section\.getBoundingClientRect\(\)\.top <= threshold/)
  assert.match(source, /document\.addEventListener\('scroll', scheduleMagTabScrollSync, true\)/)
  assert.match(source, /document\.removeEventListener\('scroll', scheduleMagTabScrollSync, true\)/)
})

test('八字问答结果按 PRD 补齐 pattern character 和 timing 字段展示', () => {
  assert.match(source, /先天结构适配/)
  assert.match(source, /readings\.structural_supports/)
  assert.match(source, /readings\.structural_risks/)
  assert.match(source, /人物倾向画像/)
  assert.match(source, /buildPortraitBlockHTML/)
  assert.match(source, /readings\.appearance_tendency/)
  assert.match(source, /readings\.personality_tendency/)
  assert.match(source, /readings\.career_style/)
  assert.match(source, /readings\.best_window/)
  assert.match(source, /readings\.avoid_window/)
  assert.doesNotMatch(source, /readings\.why_not_now/)
})

test('八字问答行动建议展示 strategy 之外的 advice 价值字段', () => {
  assert.match(source, /advice\.risk/)
  assert.match(source, /advice\.avoid/)
  assert.match(source, /advice\.timing/)
  assert.match(source, /advice\.leverage/)
  assert.match(source, /建议节奏/)
  assert.match(source, /借势方法/)
  assert.match(source, /buildBaziAdviceRowsHTML/)
  assert.match(source, /bazi-advice-row/)
  const adviceExtraStart = source.indexOf('const buildBaziAdviceExtrasHTML')
  const adviceExtraEnd = source.indexOf('const buildBaziQuestionCardHTML')
  const adviceExtraSource = source.slice(adviceExtraStart, adviceExtraEnd)
  assert.doesNotMatch(adviceExtraSource, /bazi-reading-block/)
})

test('八字问答判断依据展示收敛后的 logic 长文', () => {
  assert.match(source, /summary\.basis\?\.logic/)
  assert.match(source, /bazi-basis-summary/)
  assert.doesNotMatch(source, /interaction_summary/)
})

test('八字问答前端展示收敛后的 schema 字段', () => {
  assert.match(source, /summary\.basis\?\.logic/)
  assert.doesNotMatch(source, /interaction_summary/)
  assert.doesNotMatch(source, /mode\.why_not_now/)
  assert.doesNotMatch(source, /mode\.domain_fit/)
  assert.doesNotMatch(source, /mode\.innate_ceiling/)
  assert.doesNotMatch(source, /mode\.domain_state/)
  assert.match(source, /支撑/)
  assert.match(source, /阻力/)
  assert.match(source, /依据/)
})

test('八字问答结果不展示兼容 analysis 摘要和 fallback 边界提示', () => {
  assert.doesNotMatch(source, /命理要点/)
  assert.doesNotMatch(source, /参考边界/)
  assert.doesNotMatch(source, /buildCompatAnalysisHTML/)
  assert.doesNotMatch(source, /const limitationsHTML/)
})

test('背书板块采用八字档案专业排盘结构而不是临时卡片', () => {
  const component = readFileSync(new URL('../components/BaziBackingPanel.vue', import.meta.url), 'utf8')
  assert.match(component, /BaziPillarTable/)
  assert.match(component, /专业四柱大运流年/)
  assert.match(component, /linkage-row/)
  assert.match(component, /<slot name="identity"><\/slot>/)
  assert.doesNotMatch(component, /backing-identity/)
  assert.match(component, /xiaoyunList/)
  assert.match(component, /current_liunian/)
  assert.match(component, /selectedDayun/)
  assert.match(component, /流<br>月/)
  assert.match(component, /流<br>日/)
  assert.doesNotMatch(component, /命盘背书/)
})

test('专业排盘联动列表只使用八字档案矩阵数据，候选时间窗只做高亮', () => {
  const component = readFileSync(new URL('../components/BaziBackingPanel.vue', import.meta.url), 'utf8')
  assert.match(component, /const liunianList = computed\(\(\) => \{/)
  assert.match(component, /const topLevel = matrix\.value\?\.liunian_list/)
  assert.match(component, /fullDayunList = computed\(\(\) => \(resolvedMatrix\.value\?\.dayun_list \|\| \[\]\)\.filter\(d => !d\.isXiaoyun\)\)/)
  assert.match(component, /windowByYear/)
  assert.match(component, /dayunHasWindow/)
  assert.doesNotMatch(component, /props\.analysisMode === 'timing' && windows\.value\.length/)
  assert.doesNotMatch(component, /source\.filter\(item => years\.has\(item\.year\)\)/)
})

test('专业排盘联动列表使用浅色高对比样式提升可读性', () => {
  const component = readFileSync(new URL('../components/BaziBackingPanel.vue', import.meta.url), 'utf8')
  assert.match(component, /\.linkage-row[\s\S]{0,260}background:\s*rgba\(var\(--paper-rgb\),\s*0\.72\)/)
  assert.match(component, /\.row-label[\s\S]{0,220}font-size:\s*13px/)
  assert.match(component, /\.item-header[\s\S]{0,220}font-weight:\s*600/)
  assert.match(component, /\.char-gan,[\s\S]{0,160}font-size:\s*19px/)
  assert.doesNotMatch(component, /background:\s*rgba\(0,0,0,0\.25\)/)
})

test('历史抽屉里的八字记录不展示分数', () => {
  assert.match(source, /isBaziRecord\(item\)/)
  assert.match(source, /v-if="!isBaziRecord\(item\)"/)
})

test('八字问答前端过滤工程化内部表达', () => {
  assert.match(source, /sanitizeBaziDisplayText/)
  assert.match(source, /concreteTargetLabel/)
  assert.match(source, /置信度需下调/)
  assert.match(source, /estimated/)
  assert.match(source, /目标十神/)
})

test('八字 path_readings 以独立「路径推演」分区渲染，不再混入逐项解读扁平列表', () => {
  // 独立分区 + 差异化卡片
  assert.match(source, /路径推演 · 多路径对比/)
  assert.match(source, /class="bazi-path-block"/)
  assert.match(source, /class="bazi-path-card"/)
  assert.match(source, /bazi-path-badge/)
  // 结构化字段行（契合/近1-3年/满意度/最顺期/风险）
  assert.match(source, /pathRow\('契合', p\.structural_fit\)/)
  assert.match(source, /pathRow\('风险', p\.risk, ' bazi-path-risk'\)/)
  // 不再把 path 作为普通 inferItems 行 push 进扁平列表
  assert.doesNotMatch(source, /inferItems\.push\(\{ label: p\.path/)
  // 差异化样式存在
  assert.match(source, /:deep\(\.bazi-path-card\)/)
})

test('八字 yongshen 锚定时面板用神标签自适应（不写"目标十神"）', () => {
  // HomeView：theory 文案按 anchor_kind 切换
  assert.match(source, /anchor_kind === 'yongshen'/)
  assert.match(source, /为综合运势锚点/)
  assert.match(source, /baziPanelAnchorKind/)
  assert.match(source, /:anchor-kind="baziPanelAnchorKind"/)
  // StaticPanel：section 标题与"用神关系"行按 anchor 切换/隐藏
  const panel = readFileSync(new URL('../components/BaziStaticPanel.vue', import.meta.url), 'utf8')
  assert.match(panel, /isYongshenAnchor/)
  assert.match(panel, /用神 \/ 忌神（综合运势锚点）/)
  assert.match(panel, /yongshenRelation && !isYongshenAnchor/)
  assert.match(panel, /anchorKind:\s*\{ type: String/)
})
