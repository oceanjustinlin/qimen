import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./BaziView.vue', import.meta.url), 'utf8')

test('专业页不再内联维护大运流年流月流日四套交互', () => {
  const matches = source.match(/class="item-body stacked-ganzhi"/g) || []
  assert.equal(matches.length, 0)
})

test('专业页大运流年交互交给 BaziBackingPanel', () => {
  assert.match(source, /<BaziBackingPanel/)
  assert.match(source, /:show-chart="false"/)
})

test('专业联动区包含流日与日运跳转入口', () => {
  assert.match(source, /BaziBackingPanel/)
  assert.match(source, /:show-chart="false"/)
  assert.match(source, /baziTimelineResultData/)
  assert.doesNotMatch(source, />看日运</)
})

test('全息八字专业页复用背书组件展示大运流年交互', () => {
  assert.match(source, /import BaziBackingPanel from/)
  assert.match(source, /<BaziBackingPanel/)
  assert.match(source, /:profile="activeProfile"/)
  assert.match(source, /analysis-mode="status"/)
  assert.doesNotMatch(source, /<template #identity>/)
})

test('新增排盘弹窗默认不预填出生时间', () => {
  assert.match(source, /const solarInput = reactive\(\{\s*text:\s*''\s*\}\)/s)
  assert.match(source, /solarInput\.text = ''/)
  assert.doesNotMatch(source, /solarInput\.text = '199001010000'/)
})

test('新增排盘弹窗手机宽度包含内边距避免关闭按钮溢出', () => {
  assert.match(source, /\.picker-overlay\s*\{[^}]*box-sizing:\s*border-box;/s)
  assert.match(source, /\.profile-picker-modal\s*\{[^}]*box-sizing:\s*border-box;/s)
  assert.match(source, /@media \(max-width:\s*420px\)[\s\S]*?\.picker-close\.dark\s*\{[^}]*width:\s*38px;/s)
})

test('身强身弱弹窗展示仪表盘并优先使用用户说明', () => {
  assert.match(source, /strength-meter-card/)
  assert.match(source, /aria-label="日主旺衰仪表盘"/)
  assert.match(source, /detail\?\.user_sections\?\.length/)
  assert.match(source, /scoreLabel:\s*''/)
})

test('调候诊断摘要不展示独立详情小 i', () => {
  const start = source.indexOf('<!-- 调候诊断 -->')
  const end = source.indexOf('<!-- 五行能量池 -->', start)
  const block = source.slice(start, end)

  assert.ok(start > -1)
  assert.ok(end > start)
  assert.doesNotMatch(block, /activeInfoPanel = 'tiaohou'/)
  assert.doesNotMatch(block, /查看调候详情/)
})

test('天机锦囊底部弹层使用旺衰同款文本流布局', () => {
  const start = source.indexOf("activeInfoPanel === 'scoring'")
  const end = source.indexOf('<Teleport to="body">', start + 1)
  const block = source.slice(start, end)

  assert.ok(start > -1)
  assert.ok(end > start)
  assert.match(block, /scoring-detail-drawer/)
  assert.match(block, /drawer-head-title">天机锦囊/)
  assert.match(block, /scoring-section-heading[\s\S]*insight-prose-label">喜用分析/)
  assert.match(block, /scoring-section-heading[\s\S]*insight-prose-label">五维影响概览/)
  assert.match(block, /insight-prose-list scoring-prose-list/)
  assert.match(source, /const scoringInfluenceRows = computed/)
  assert.doesNotMatch(block, /以下只展示/)
  assert.doesNotMatch(block, /decision-chain-list/)
  assert.doesNotMatch(block, /scoring-item/)
})

test('格局弹窗优先展示结构化 pattern_analysis', () => {
  assert.match(source, /pattern_analysis/)
  assert.match(source, /取格步骤/)
  assert.match(source, /顺逆与成败/)
  assert.match(source, /climateAdjustment/)
  assert.match(source, /patternFinalName/)
  assert.match(source, /relationshipHealth/)
  assert.match(source, /normalizeTraitItems/)
  assert.match(source, /sourceLimited/)
  assert.match(source, /材料依据/)
  assert.match(source, /sourceMeta\.excerpt/)
  assert.match(source, /headlineStatement/)
  assert.match(source, /pattern\.traits\.source_excerpt/)
})

test('旺衰格局卡和格局洞察并入形象校验', () => {
  assert.match(source, /detail\.image_analysis/)
  assert.match(source, /primary_candidate/)
  assert.match(source, /形象匹配度/)
  assert.match(source, /基础格局/)
  assert.match(source, /形象校验/)
  assert.match(source, /imageCandidate\.dimensions/)
  assert.match(source, /imageCandidate\.penalties/)
})

test('前端八字引擎期望版本同步到 1.8.19', () => {
  assert.match(source, /const BAZI_ENGINE_VERSION = '1\.8\.19'/)
})

test('八字专业页首屏只拉摘要列表并按选中档案懒加载重字段', () => {
  assert.match(source, /import \{[\s\S]*BAZI_PROFILE_FULL_SELECT[\s\S]*BAZI_PROFILE_LIST_SELECT/)
  assert.match(source, /supabase\.from\('bazi_profiles'\)\.select\(BAZI_PROFILE_LIST_SELECT\)/)
  assert.doesNotMatch(source, /supabase\.from\('bazi_profiles'\)\.select\('\*'\)/)
  assert.match(source, /supabase\.from\('bazi_profiles'\)\.select\(BAZI_PROFILE_FULL_SELECT\)\.eq\('id', profileId\)\.single\(\)/)
  assert.match(source, /const activeProfile = computed\(\(\) => \{\s*const base = baziProfiles\.value\.find/)
  assert.match(source, /return \{ \.\.\.base, \.\.\.\(detail || \{\}\) \}/)
})

test('断事笔记上下文只在 events 标签页加载', () => {
  const activeProfileWatcher = source.slice(
    source.indexOf('watch(\n    () => activeProfile.value?.id'),
    source.indexOf('watch(\n    () => globalState.selectedBaziProfileId')
  )
  assert.ok(activeProfileWatcher.length > 0)
  assert.match(activeProfileWatcher, /await loadProfileDetail\(profileId\)/)
  assert.doesNotMatch(activeProfileWatcher, /fetchProfileContextDraft\(/)
  assert.match(source, /if \(tab === 'events'\) await ensureEventsContextLoaded\(\)/)
  assert.match(source, /const ensureEventsContextLoaded = async \(\) =>/)
})

test('访客添加档案后生成排盘按钮可点击并触发登录引导', () => {
  assert.match(source, /:disabled="isAnalyzing"/)
  assert.match(source, /showGuestLoginGuide\.value = true/)
  assert.match(source, /登录后可生成完整云端命理解读与日运联动/)
  assert.doesNotMatch(source, /:disabled="isAnalyzing \|\| isGuest"/)
})

test('访客或空档案状态也能展开命主菜单', () => {
  assert.match(source, /const toggleProfileMenu = \(\) => \{\s*isProfileMenuOpen\.value = !isProfileMenuOpen\.value\s*\}/)
  assert.doesNotMatch(source, /if \(!showProfileSwitcher\.value\) return/)
  assert.match(source, /class="sheet-empty"/)
})

test('访客档案限制说明不再使用圆角提示框', () => {
  assert.match(source, /\.guest-limit-note\s*\{[^}]*border:\s*0;/s)
  assert.match(source, /\.guest-limit-note\s*\{[^}]*background:\s*transparent;/s)
  assert.doesNotMatch(source, /\.guest-limit-note\s*\{[^}]*border-radius:/s)
})

test('八字排盘生成使用 SSE 接收引擎先出和 LLM 分区流式内容', () => {
  assert.match(source, /const llmStreamSections = ref/)
  assert.match(source, /function resetLlmStreamSections/)
  assert.match(source, /async function readBaziSSEStream/)
  assert.match(source, /event\.type === 'engine_complete'/)
  assert.match(source, /event\.type === 'llm_delta'/)
  assert.match(source, /event\.type === 'llm_section_done'/)
  assert.match(source, /event\.type === 'llm_error'/)
  assert.match(source, /streamedBaziInterpretation/)
  assert.match(source, /isBaziSectionStreaming/)
  assert.match(source, /isBaziSectionLoading/)
  assert.match(source, /shouldShowBaziSectionSkeleton/)
})

test('八字 LLM 流式文本优先于持久化断语展示', () => {
  assert.match(source, /if \(isBaziSectionLoading\('yuanju_core'\)\) return streamedBaziInterpretation\.value\.yuanju_core/)
  assert.match(source, /if \(isBaziSectionFailed\('yuanju_core'\)\) return resolvedInterpretation\.value\.yuanju_core/)
  assert.match(source, /if \(isBaziSectionLoading\('current_dayun'\)\) return streamedBaziInterpretation\.value\.current_dayun/)
  assert.match(source, /if \(isBaziSectionFailed\('current_dayun'\)\) return resolvedInterpretation\.value\.current_dayun/)
  assert.match(source, /if \(isBaziSectionLoading\('current_liunian'\)\) return streamedBaziInterpretation\.value\.current_liunian/)
  assert.match(source, /if \(isBaziSectionFailed\('current_liunian'\)\) return resolvedInterpretation\.value\.current_liunian/)
})

test('推演中隐藏生成排盘引导', () => {
  assert.match(source, /:disabled="isAnalyzing"/)
  assert.match(source, /if \(isAnalyzing\.value\) return '正在推演'/)
})

test('LLM 等待态只显示骨架不混用兜底文案', () => {
  const start = source.indexOf('<!-- 原局核心 -->')
  const end = source.indexOf('<!-- 岁运推演 -->', start)
  const yuanjuBlock = source.slice(start, end)

  assert.ok(start > -1)
  assert.ok(end > start)
  assert.match(yuanjuBlock, /<p v-if="resolvedYuanjuCore"/)
  assert.match(yuanjuBlock, /v-if="shouldShowBaziSectionSkeleton\('yuanju_core'\)"/)
  assert.doesNotMatch(yuanjuBlock, /isBaziSectionPending\('yuanju_core'\)/)
})

test('LLM 等待态不回落到 legacy summary 兜底卡片', () => {
  assert.match(source, /const isBaziLlmLoading = computed/)
  assert.match(source, /const shouldShowBaziInterpretationSection = computed/)
  assert.match(source, /v-if="currentTab !== 'events' && shouldShowBaziInterpretationSection"/)
  assert.match(source, /v-else-if="currentTab !== 'events' && !isBaziLlmLoading && activeProfile\.bazi_summary"/)
})

test('推演完成提示提供关闭按钮', () => {
  const start = source.indexOf('class="analysis-status"')
  const end = source.indexOf('</div>', source.indexOf('class="analysis-progress"', start))
  const block = source.slice(start, end)

  assert.ok(start > -1)
  assert.match(block, /analysis-dismiss/)
  assert.match(block, /analysisNotice = ''/)
  assert.match(block, /aria-label="关闭推演状态提示"/)
})

test('新增档案校验通过后立即收起 bottom sheet', () => {
  const start = source.indexOf('const saveProfile = async')
  const guestStart = source.indexOf('if (isGuest.value)', start)
  const block = source.slice(start, guestStart)

  assert.ok(start > -1)
  assert.ok(guestStart > start)
  assert.match(block, /payload = buildProfilePayloadFromEntry\(\)/)
  assert.match(block, /showAdd\.value = false/)
  assert.match(block, /isProfileMenuOpen\.value = false/)
  assert.match(block, /swipedProfileId\.value = null/)
  assert.match(block, /resetProfileEntry\(\)/)
})

test('从档案切换层新增档案时先收起切换层', () => {
  const start = source.indexOf('const openAddProfile = () => {')
  const end = source.indexOf('const openRenameProfile', start)
  const block = source.slice(start, end)

  assert.ok(start > -1)
  assert.ok(end > start)
  assert.match(block, /resetProfileEntry\(\)/)
  assert.match(block, /isProfileMenuOpen\.value = false/)
  assert.match(block, /swipedProfileId\.value = null/)
  assert.match(block, /showAdd\.value = true/)
})
