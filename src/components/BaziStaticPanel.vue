<template>
  <div class="static-panel">

    <!-- ── 命盘标识行 ── -->
    <div v-if="profileInfo?.name || profileInfo?.gender || profileInfo?.birthDate" class="profile-identity">
      <span v-if="profileInfo.name" class="pid-name">{{ profileInfo.name }}</span>
      <span v-if="profileInfo.gender" class="pid-sep">·</span>
      <span v-if="profileInfo.gender" class="pid-gender">{{ profileInfo.gender === 'M' ? '男' : '女' }}</span>
      <span v-if="profileInfo.birthDate" class="pid-sep">·</span>
      <span v-if="profileInfo.birthDate" class="pid-date">{{ profileInfo.birthDate }}</span>
    </div>

    <!-- ── 四柱牌面 ── -->
    <div v-if="matrix?.pillars?.length" class="pillar-grid">
      <div
        v-for="col in matrix.pillars" :key="col.name"
        class="pillar-col"
        :class="{
          'pillar-riZhu': col.name === '日',
          'pillar-highlighted': highlightedPillar === col.name
        }"
      >
        <span class="pillar-name">{{ col.name }}柱<span v-if="col.name === '日'"> · 命主</span></span>

        <!-- 天干十神占位（保持所有列等高对齐） -->
        <span
          class="pillar-shishen"
          :style="col.name === '日' || !ganShishen(col.gan) ? 'visibility:hidden' : ''"
        >{{ col.name !== '日' && ganShishen(col.gan) ? ganShishen(col.gan) : '比' }}</span>

        <span class="pillar-gan" :class="elemClass(GAN5[col.gan])">{{ col.gan }}</span>
        <span class="pillar-zhi" :class="elemClass(ZHI_WX[col.zhi])">{{ col.zhi }}</span>

        <!-- 藏干：竖排，藏干带五行，后跟十神 -->
        <span v-if="col.hidden_stems?.length" class="pillar-hidden">
          <em v-for="hs in col.hidden_stems" :key="hs" class="hs-item">
            <b :class="elemClass(GAN5[hs])">{{ hs }}{{ GAN5[hs] }}</b><i>{{ getShishen(dayStem, hs) }}</i>
          </em>
        </span>

        <span v-if="col.is_kong" class="pillar-kong">空亡</span>
      </div>
    </div>

    <!-- ── 顶栏 ── -->
    <div class="panel-header">
      <span class="panel-eyebrow">原局底盘</span>
    </div>

    <!-- ── 格局 / 形象 / 调候 结构行 ── -->
    <div class="meta-block">
      <!-- 格局 -->
      <div v-if="stateReport.geju" class="meta-row">
        <span class="meta-label">格局</span>
        <div class="meta-body">
          <span class="meta-value">{{ stateReport.geju }}</span>
          <div v-for="c in triggeredChecks" :key="c.check" class="meta-check">
            <span class="meta-check-bullet">▸</span>
            <span>{{ c.check }}</span>
          </div>
        </div>
      </div>
      <!-- 形象（从格/专旺/化气） -->
      <div v-if="stateReport.image_context" class="meta-row image-row">
        <span class="meta-label">形象</span>
        <div class="meta-body">
          <div class="image-main">
            <span class="image-subtype">{{ stateReport.image_context.subtype }}</span>
            <span class="image-score-chip" :class="imageLevelClass(stateReport.image_context.match_level)">
              {{ stateReport.image_context.match_label }}
              <em>{{ Math.round(stateReport.image_context.match_score) }}%</em>
            </span>
            <span class="image-override-chip" :class="imageDecision.statusClass">{{ imageDecision.statusText }}</span>
          </div>
          <div v-if="imageDecision.detailText" class="image-secondary">
            <span class="image-sec-label">决策</span>
            <span class="image-sec-text">{{ imageDecision.detailText }}</span>
          </div>
          <div v-if="imageDecision.reasonText" class="image-secondary">
            <span class="image-sec-label">{{ imageDecision.reasonLabel }}</span>
            <span class="image-sec-text">{{ imageDecision.reasonText }}</span>
          </div>
          <!-- 次级候选（有 override 时显示原始候选） -->
          <div v-if="stateReport.image_display_context && stateReport.image_display_context.subtype !== stateReport.image_context.subtype" class="image-secondary">
            <span class="image-sec-label">原始候选</span>
            <span class="image-sec-text">{{ stateReport.image_display_context.subtype }}（{{ Math.round(stateReport.image_display_context.match_score) }}%）</span>
          </div>
        </div>
      </div>
      <!-- 调候 -->
      <div v-if="stateReport.tiaohou" class="meta-row">
        <span class="meta-label">调候</span>
        <span class="meta-value">{{ stateReport.tiaohou }}</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <!-- ── 目标十神 / 用神锚点 ── -->
    <section class="panel-section">
      <div class="section-label">{{ isYongshenAnchor ? '用神 / 忌神（综合运势锚点）' : '目标十神' }}</div>

      <!-- 理论说明行（结构：以XX为目标十神 / 以用神X为锚点） -->
      <p v-if="shishenTheory" class="theory-note">{{ shishenTheory }}</p>

      <!-- 取法依据（analysis_question） -->
      <p v-if="analysisRationale" class="theory-rationale">{{ analysisRationale }}</p>

      <!-- 与用神关系（yongshen 锚定时目标即用神，同义反复，隐藏） -->
      <p v-if="yongshenRelation && !isYongshenAnchor" class="yong-relation" :class="yongshenRelationClass">{{ yongshenRelation }}</p>

      <!-- 找到的十神 card（透干+地支主气优先显示；纯藏干折叠，陆致极"透出始为真"）-->
      <div
        v-for="(sa, i) in displayedShishenAssessments"
        :key="i"
        class="analysis-card"
        :class="{ 'card-weak': sa.vigor < 0.2, 'card-active': highlightedPillar === sa.pillar, 'card-avoid': sa.is_avoid, 'card-hidden': sa.position === 'hidden' }"
        @click="highlightedPillar = highlightedPillar === sa.pillar ? null : sa.pillar"
        style="cursor:pointer"
      >
        <!-- 头行：[用/忌/标] + 十神名 + 干支 + 柱位 + 空亡 -->
        <div class="card-head">
          <span class="role-chip" :class="cardRole(sa).cls">{{ cardRole(sa).text }}</span>
          <span class="shishen-name" :class="elemClass(sa.element)">{{ sa.shishen }}</span>
          <!-- 天干位置：干支是一对（如庚申）；藏干/地支主气：只显示干，地支在chip里说明 -->
          <span class="card-ganzhi" :class="elemClass(sa.element)">
            {{ sa.position === 'gan' ? sa.gan + sa.zhi : sa.gan }}
          </span>
          <span class="card-chip">
            {{ sa.pillar }}柱 · {{ posLabel(sa.position) }}{{ sa.position !== 'gan' ? '（' + sa.zhi + '中）' : '' }}
          </span>
          <span v-if="sa.is_kong" class="kong-chip">空亡</span>
        </div>

        <!-- 机制分行 -->
        <div
          v-for="(line, li) in buildMechanismLines(sa)"
          :key="li"
          class="mline"
          :class="`mline-${line.severity}`"
        >
          <div class="mline-header">
            <span class="mline-category">{{ line.category }}</span>
            <template v-if="line.isVigor">
              <span class="mline-phase" :class="vigorFillClass(line.vigor)">{{ line.phase }}</span>
              <div class="mline-bar-track">
                <div class="mline-bar-fill" :class="vigorFillClass(line.vigor)" :style="{ width: Math.round(line.vigor * 100) + '%' }"></div>
              </div>
            </template>
          </div>
          <p class="mline-text">{{ line.text }}</p>
        </div>
      </div>

      <!-- 纯藏干折叠开关（余气/墓气：未透出，静以待用） -->
      <button
        v-if="hiddenShishenAssessments.length"
        class="hidden-stem-toggle"
        @click="showHiddenStems = !showHiddenStems"
      >
        {{ showHiddenStems ? '收起' : '展开' }}藏干 · 余气/墓气（{{ hiddenShishenAssessments.length }}）
        <span class="hst-hint">未透出，岁运透干或刑冲开库时激活</span>
      </button>

      <!-- 查找范围内未见于命局的十神 -->
      <div v-for="name in missingShishen" :key="name" class="absent-row">
        <span class="absent-name">{{ name }}</span>
        <span class="absent-msg">未见于命局（{{ shishenWuxing(name) }}不在任何柱）</span>
      </div>
    </section>

    <template v-if="stateReport.gongwei_assessments?.length">
    <div class="panel-divider"></div>

    <!-- ── 目标宫位 ── -->
    <section class="panel-section">
      <div class="section-label">目标宫位</div>

      <!-- 理论说明行 -->
      <p v-if="gongweiTheory" class="theory-note">{{ gongweiTheory }}</p>

      <div
        v-for="(ga, i) in stateReport.gongwei_assessments"
        :key="i"
        class="analysis-card"
        :class="{ 'card-active': highlightedPillar === ga.pillar_name }"
        @click="highlightedPillar = highlightedPillar === ga.pillar_name ? null : ga.pillar_name"
        style="cursor:pointer"
      >
        <!-- 头行：宫位 + 地支 + 坐十神 + 空亡/星宫得正 -->
        <div class="card-head">
          <span class="gongwei-label">{{ ga.gongwei }}</span>
          <span class="card-ganzhi" :class="elemClass(ga.element)">{{ ga.zhi }}</span>
          <span class="seat-info">坐 <em class="seat-shen" :class="shenClass(ga.seat_shishen)">{{ ga.seat_shishen || '—' }}</em></span>
          <span v-if="ga.is_kong" class="kong-chip">空亡</span>
          <span v-if="ga.is_correct_star" class="correct-star-chip">星宫得正</span>
        </div>

        <!-- 机制分行 -->
        <div
          v-for="(line, li) in buildGongweiLines(ga)"
          :key="li"
          class="mline"
          :class="`mline-${line.severity}`"
        >
          <div class="mline-header">
            <span class="mline-category">{{ line.category }}</span>
            <template v-if="line.isVigor">
              <span class="mline-phase" :class="vigorFillClass(line.vigor)">{{ line.phase }}</span>
              <div class="mline-bar-track">
                <div class="mline-bar-fill" :class="vigorFillClass(line.vigor)" :style="{ width: Math.round(line.vigor * 100) + '%' }"></div>
              </div>
            </template>
          </div>
          <p class="mline-text">{{ line.text }}</p>
        </div>
      </div>
    </section>
    </template>

    <!-- ── 整体稳定性结论 ── -->
    <div class="panel-divider"></div>
    <div class="stability-footer" :class="`stab-footer-${stateReport.overall_stability}`">
      <div class="stab-footer-head">
        <span class="stab-footer-dot"></span>
        <span class="stab-footer-label">{{ stateReport.stability_label }}</span>
        <span class="stab-footer-badge">整体稳定性</span>
      </div>
      <p class="stab-footer-text">{{ stabilityConclusion }}</p>
    </div>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const highlightedPillar = ref(null)

const props = defineProps({
  stateReport:   { type: Object, required: true },
  targetSpec:    { type: Object, required: true },
  matrix:        { type: Object, default: null },
  shishenTheory: { type: String, default: '' },
  gongweiTheory: { type: String, default: '' },
  anchorKind:    { type: String, default: '' },    // 'yongshen' ⇒ 目标即命主用神/忌神
  category:      { type: String, default: '' },    // 问题领域，用于象义星标签（财星/夫星…）
  profileInfo:   { type: Object, default: null },  // { name, gender, birthDate }
  fiveShens:     { type: Object, default: null },  // bazi_detail.five_shens
})

// 稳健：优先看显式 prop，回退读 targetSpec.anchor_kind（数据自带，避免 prop 接线遗漏）
const isYongshenAnchor = computed(() =>
  props.anchorKind === 'yongshen' || props.targetSpec?.anchor_kind === 'yongshen'
)

// 十神 → 领域象义星名（财星/官星/印星/食伤星/比劫星；婚恋→夫/妻星，子女→子星）
const SHISHEN_STAR = {
  正财:'财星', 偏财:'财星', 财:'财星', 才:'财星',
  正官:'官星', 七杀:'官星', 官:'官星', 杀:'官星',
  正印:'印星', 偏印:'印星', 印:'印星', 枭:'印星',
  食神:'食伤星', 伤官:'食伤星', 食:'食伤星', 伤:'食伤星',
  比肩:'比劫星', 劫财:'比劫星', 比:'比劫星', 劫:'比劫星',
}
function starLabel(sa) {
  const base = SHISHEN_STAR[sa?.shishen] || '十神'
  const g = props.profileInfo?.gender
  const cat = props.category || ''
  if (cat === 'relationship') {
    if (g === 'F' && base === '官星') return '夫星'
    if (g === 'M' && base === '财星') return '妻星'
  }
  if (cat === 'children' || cat === 'health_action') {
    if (g === 'F' && base === '食伤星') return '子星'
    if (g === 'M' && base === '官星') return '子星'
  }
  return base
}

// 卡片角色徽标：忌神(忌·红) / 用神(用·金，yongshen) / 目标十神(领域象义星名·紫，backend)
function cardRole(sa) {
  if (sa?.is_avoid) return { text: '忌', cls: 'role-ji' }
  if (isYongshenAnchor.value) return { text: '用', cls: 'role-yong' }
  return { text: starLabel(sa), cls: 'role-target' }
}

// 透干/主气 优先显示；纯藏干（余气/墓气）默认折叠（陆致极：透出始为真，藏干静以待用）
const showHiddenStems = ref(false)
const primaryShishenAssessments = computed(() =>
  (props.stateReport?.shishen_assessments || []).filter(sa => sa.position !== 'hidden')
)
const hiddenShishenAssessments = computed(() =>
  (props.stateReport?.shishen_assessments || []).filter(sa => sa.position === 'hidden')
)
const displayedShishenAssessments = computed(() =>
  showHiddenStems.value
    ? [...primaryShishenAssessments.value, ...hiddenShishenAssessments.value]
    : primaryShishenAssessments.value
)

const GAN5   = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' }
const ZHI_WX = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' }

const GAN_YANG = new Set(['甲','丙','戊','庚','壬'])
const WX_SHENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' }
const WX_KE    = { 木:'土', 火:'金', 土:'水', 金:'木', 水:'火' }

function getShishen(day, gan) {
  if (!day || !gan) return ''
  const dw = GAN5[day], gw = GAN5[gan]
  const same = GAN_YANG.has(day) === GAN_YANG.has(gan)
  if (gw === dw)             return same ? '比' : '劫'
  if (WX_SHENG[dw] === gw)  return same ? '食' : '伤'
  if (WX_SHENG[gw] === dw)  return same ? '枭' : '印'
  if (WX_KE[dw]    === gw)  return same ? '才' : '财'
  if (WX_KE[gw]    === dw)  return same ? '杀' : '官'
  return ''
}

const dayStem = computed(() =>
  props.matrix?.pillars?.find(p => p.name === '日')?.gan ?? ''
)

function ganShishen(gan) { return getShishen(dayStem.value, gan) }

// 全称 → 短形映射（与 baziStateAssessor normalizeShishens 一致）
const FULL_TO_SHORT = {
  正官:'官', 七杀:'杀', 正财:'财', 偏财:'才',
  正印:'印', 偏印:'枭', 食神:'食', 伤官:'伤',
  比肩:'比', 劫财:'劫',
}
// 十神全称 → 五行（用于"未见于命局"说明）
const SHISHEN_TO_WX = {
  正官:'木', 七杀:'木', 正财:'水', 偏财:'水',
  正印:'火', 偏印:'火', 食神:'金', 伤官:'金',
  比肩:'土', 劫财:'土',
}

// 目标十神取法说明（来自 targetSpec.analysis_question）
const analysisRationale = computed(() => props.targetSpec?.analysis_question || '')

const yongshenRelationClass = computed(() => {
  const fs = props.fiveShens
  if (!fs?.yong) return ''
  const primary = props.targetSpec?.primary_shishen || []
  const favorable = new Set([fs.yong, ...(fs.xi || [])])
  const unfavorable = new Set([...(fs.ji || []), ...(fs.chou || [])])
  const isFav  = primary.some(s => favorable.has(s))
  const isUnfav = primary.some(s => unfavorable.has(s))
  if (isFav && !isUnfav)  return 'yong-rel-good'
  if (isUnfav && !isFav)  return 'yong-rel-bad'
  return 'yong-rel-neutral'
})

// 目标十神与命局用神的关系
const yongshenRelation = computed(() => {
  const fs = props.fiveShens
  if (!fs?.yong) return ''
  const primary = props.targetSpec?.primary_shishen || []
  if (!primary.length) return ''

  const favorable = new Set([fs.yong, ...(fs.xi || [])])
  const unfavorable = new Set([...(fs.ji || []), ...(fs.chou || [])])
  const isFav  = primary.some(s => favorable.has(s))
  const isUnfav = primary.some(s => unfavorable.has(s))
  const lowConf = fs.yong_confidence === 'LOW'

  if (isFav && !isUnfav) {
    return lowConf
      ? `目标十神与命局用神方向接近（用神参考），原局有一定支撑`
      : `目标十神与命局用神同向，原局具备内在支撑力`
  }
  if (isUnfav && !isFav) {
    return `目标十神为命局忌神，原局有内在阻力，需大运引动化解`
  }
  if (isFav && isUnfav) {
    return `目标十神中有喜有忌，命局格局复杂，须结合宫位气势细判`
  }
  return `目标十神为命局闲神，中性力量，吉凶随大运流年引动而变`
})

// 命局中未见的目标十神（全称）
const missingShishen = computed(() => {
  const found = new Set((props.stateReport.shishen_assessments || []).map(a => a.shishen))
  return (props.targetSpec.primary_shishen || []).filter(full => {
    const short = FULL_TO_SHORT[full] || full
    return !found.has(short)
  })
})

function shishenWuxing(fullName) {
  return SHISHEN_TO_WX[fullName] || ''
}

const triggeredChecks = computed(() =>
  (props.stateReport.extra_checks || []).filter(c => c.found)
)

function imageLevelClass(level) {
  return {
    'img-level-pure':      level === 'PURE',
    'img-level-formed':    level === 'FORMED',
    'img-level-suspected': level === 'SUSPECTED',
  }
}

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
  if (!candidate) {
    return { statusText: '', statusClass: '', detailText: '', reasonText: '', reasonLabel: '依据' }
  }

  const hasVeto = !!candidate.override_veto_reason
  const scope = candidate.override_scope
  const isOverride = ['full', 'xiji_yongshen', 'yongshen_only'].includes(scope)
    || (scope == null && candidate.override_normal_pattern)
  const isDisplayOnly = scope === 'display_only' || scope === 'none'
  const statusText = hasVeto
    ? '候选被挡下'
    : (isOverride ? '已主导取用' : (isDisplayOnly ? '仅展示' : '未主导取用'))
  const statusClass = hasVeto
    ? 'image-chip-veto'
    : (isOverride ? 'image-chip-override' : 'image-chip-display')
  const strategy = IMAGE_TREATMENT_LABEL[candidate.treatment] || candidate.treatment || ''
  const affected = (candidate.affected_dimensions || [])
    .map(item => IMAGE_DIMENSION_LABEL[item] || item)
    .join('、')
  const parts = []
  if (strategy) parts.push(`取用策略：${strategy}`)
  if (affected) parts.push(`影响：${affected}`)

  return {
    statusText,
    statusClass,
    detailText: parts.join('；'),
    reasonText: candidate.override_veto_reason || candidate.override_reason || '',
    reasonLabel: candidate.override_veto_reason ? '未主导原因' : '主导依据',
  }
}

const imageDecision = computed(() => buildImageDecision(props.stateReport.image_context))

const stabilityConclusion = computed(() => {
  const s = props.stateReport
  const maxVigor = (s.shishen_assessments || []).reduce((m, a) => Math.max(m, a.vigor), 0)
  const hasGongwei = (s.gongwei_assessments || []).length > 0
  const hasCorrectStar = (s.gongwei_assessments || []).some(g => g.is_correct_star)

  switch (s.overall_stability) {
    case 'strong':
      return hasCorrectStar
        ? '目标十神旺盛且星宫得正，先天结构极佳，命局对此事有较强承载力'
        : '目标十神旺盛，宫位稳固，先天结构有力，命局底盘扎实'

    case 'stable':
      return hasGongwei && hasCorrectStar
        ? '目标宫位星宫得正，整体平稳，先天基础尚可，发展依赖大运流年进一步引动'
        : '先天结构平稳，无重大冲刑，目标十神处于可用状态，需大运流年配合触发'

    case 'dynamic':
      return '命局存在有效冲刑结构，先天带动荡属性，相关领域易有变动，变化机会与不稳定性并存'

    case 'buried':
      return maxVigor < 0.15
        ? '目标十神几乎不现于命局，先天缺位，须靠大运流年引入外部能量方可激活'
        : '目标十神封藏较深，难以自然显现，须大运流年冲动开库或合引出干方可调用'

    case 'damaged':
      return '目标十神核心结构受损或变质，先天承载力不足，此领域先天短板明显'

    default: return ''
  }
})

// ── 机制分行 builder（十神） ─────────────────────────────────────
function buildMechanismLines(sa) {
  const lines = []
  const v = sa.vigor

  // 1. 旺衰底盘（永远显示）
  const vigorSev = v >= 0.75 ? 'ok' : v >= 0.4 ? 'neutral' : v >= 0.15 ? 'warn' : 'bad'
  const vigorTxt = v >= 0.75 ? `${sa.shishen}处${sa.twelve_phase}，气势充盈`
    : v >= 0.4  ? `${sa.shishen}处${sa.twelve_phase}，气势尚可`
    : v >= 0.15 ? `${sa.shishen}处${sa.twelve_phase}，气势偏弱`
    : `${sa.shishen}处${sa.twelve_phase}，力量极弱`
  lines.push({ category: '旺衰底盘', severity: vigorSev, text: vigorTxt, vigor: v, phase: sa.twelve_phase, isVigor: true })

  // 2. 空亡折扣
  if (sa.is_kong) {
    const zhiEl = ZHI_WX[sa.zhi] || ''
    const isLight = zhiEl === '金' || zhiEl === '火'
    lines.push({
      category: '空亡折扣',
      severity: isLight ? 'warn' : 'bad',
      text: isLight
        ? `${sa.zhi}逢空（${zhiEl}空则响），气力激发，折损较轻`
        : `${sa.zhi}逢空亡（${zhiEl}空则折），力量大减`,
    })
  }

  // 3. 盖头截脚
  if (sa.gaitou_jiejiao === 'jiejiao') {
    lines.push({ category: '截脚', severity: 'bad', text: `地支${sa.zhi}克天干${sa.gan}，天干无根，效力几乎归零` })
  } else if (sa.gaitou_jiejiao === 'gaitou') {
    lines.push({ category: '盖头', severity: 'warn', text: `天干${sa.gan}克地支${sa.zhi}，吉凶减半` })
  }

  // 4. 入墓封藏
  if (sa.is_in_tomb) {
    lines.push({ category: '入墓封藏', severity: 'buried', text: `${sa.shishen}入${sa.zhi}墓，藏而不显，须冲开方可用` })
  }

  // 5. 刑冲干扰
  const sig = (sa.relationships || []).filter(r => r.effective_strength >= 25)
  const clashes = sig.filter(r => r.type === '六冲' || r.type.includes('刑'))
  if (clashes.length) {
    lines.push({
      category: clashes.some(r => r.type === '六冲') ? '六冲干扰' : '刑局干扰',
      severity: 'warn',
      text: clashes.map(r => r.note).join('；'),
    })
  }

  // 6. 合化变质
  const huaRels = sig.filter(r => r.type.includes('合_化'))
  if (huaRels.length) {
    lines.push({ category: '合化变质', severity: 'buried', text: huaRels.map(r => r.note).join('；') })
  }

  // 7. 合而不化（羁绊）
  const noHua = sig.filter(r => r.type.includes('合_不化') || r.type === '天干五合_不化')
  if (noHua.length) {
    lines.push({ category: '合而不化', severity: 'warn', text: noHua.map(r => r.note).join('；') })
  }

  return lines
}

// ── 机制分行 builder（宫位） ─────────────────────────────────────
function buildGongweiLines(ga) {
  const lines = []
  const v = ga.vigor
  const vigorSev = v >= 0.75 ? 'ok' : v >= 0.4 ? 'neutral' : 'warn'
  const phaseTxt = `日干临${ga.zhi}处${ga.twelve_phase_for_dayStem}`
  const vigorTxt = v >= 0.75 ? `${phaseTxt}，宫位气势极旺`
    : v >= 0.4  ? `${phaseTxt}，宫位气势平稳`
    : `${phaseTxt}，宫位气势偏弱`
  lines.push({ category: '宫位气势', severity: vigorSev, text: vigorTxt, vigor: v, phase: ga.twelve_phase_for_dayStem, isVigor: true })

  // 星宫得正 / 鸠占鹊巢
  if (ga.is_correct_star) {
    lines.push({ category: '星宫得正', severity: 'ok', text: `${ga.gongwei}坐${ga.seat_shishen}，目标十神居本位，力量加倍` })
  } else if (ga.is_hostile_occupied) {
    lines.push({ category: '鸠占鹊巢', severity: 'bad', text: `${ga.gongwei}坐${ga.seat_shishen}（比劫），占据目标宫位，对目标六亲不利` })
  }

  // 宫位入墓
  if (ga.is_tomb_for_target) {
    lines.push({ category: '宫位入墓', severity: 'buried', text: `${ga.zhi}是目标五行墓库，宫位封藏` })
  }

  // 空亡
  if (ga.is_kong) {
    lines.push({ category: '空亡折扣', severity: 'bad', text: '宫位逢空亡，承载力大减' })
  }

  // 刑冲 / 六害
  const sig = (ga.relationships || []).filter(r => r.effective_strength >= 25)
  const clashes = sig.filter(r => r.type === '六冲' || r.type.includes('刑'))
  const harms   = sig.filter(r => r.type === '六害')
  if (clashes.length) {
    lines.push({ category: '宫位受冲', severity: 'warn', text: clashes.map(r => r.note).join('；') })
  }
  if (harms.length) {
    lines.push({ category: '六害阻滞', severity: 'warn', text: harms.map(r => r.note).join('；') })
  }

  return lines
}

const ELEM_CLASS = { 木:'el-mu', 火:'el-huo', 土:'el-tu', 金:'el-jin', 水:'el-shui' }
function elemClass(el) { return ELEM_CLASS[el] || '' }

function shenClass(shen = '') {
  if (!shen) return ''
  if (/杀|官|印/.test(shen)) return 'shen-green'
  if (/财|食|伤/.test(shen)) return 'shen-gold'
  return 'shen-red'
}

function posLabel(pos) {
  if (pos === 'gan')      return '天干'
  if (pos === 'zhi')      return '地支'
  if (pos === 'zhi_main') return '地支主气'
  if (pos === 'zhi_mid')  return '中气'
  if (pos === 'hidden')   return '余气'
  return pos || ''
}

function vigorFillClass(vigor) {
  if (vigor < 0.2) return 'vf-weak'
  if (vigor < 0.5) return 'vf-mid'
  return 'vf-strong'
}

function vigorLabel(vigor) {
  if (vigor >= 0.75) return '力旺'
  if (vigor >= 0.5)  return '力中'
  if (vigor >= 0.35) return '力弱'
  if (vigor >= 0.2)  return '偏弱'
  return '极弱'
}

const TAG_AUSPICIOUS = new Set(['帝旺','长生','有根','星宫得正','宫位稳固','宫位入局','合局'])
const TAG_BAD        = new Set(['死绝','无根','空亡','入墓','被合化','鸠占鹊巢','宫位入墓'])
const TAG_DYNAMIC    = new Set(['被冲','被刑','合而不化','宫位受冲','宫位受刑','宫位受害'])

function tagClass(tag) {
  if (TAG_AUSPICIOUS.has(tag)) return 'tag-ji'
  if (TAG_BAD.has(tag))        return 'tag-xiong'
  if (TAG_DYNAMIC.has(tag))    return 'tag-dong'
  return 'tag-neutral'
}
</script>

<style scoped>
/* 原局底盘：发丝线账页。颜色全部走全局 token，浅色纸白墨线、深色玄夜鎏金，不再单写深色覆盖 */
.static-panel {
  border: 1px solid var(--line-strong);
  border-radius: 0;
  background: transparent;
  font-family: var(--font-serif);
  color: var(--ink);
}

/* ── 命盘标识行 ── */
.profile-identity {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  padding: 11px 16px 10px;
  border-bottom: 1px solid var(--line);
}
.pid-name { font-size: 16px; font-weight: 700; letter-spacing: .04em; color: var(--ink); }
.pid-sep { display: none; }
.pid-gender, .pid-date { font-size: 12.5px; color: var(--ink-dim); letter-spacing: .02em; }

/* ── 四柱牌面 ── */
.pillar-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--line-strong); }
.pillar-col {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 12px 4px 12px; min-width: 0;
  border-right: 1px solid var(--line);
  transition: background .2s;
}
.pillar-col:last-child { border-right: none; }
.pillar-riZhu { background: var(--gold-dim); }
.pillar-highlighted { box-shadow: inset 0 -2px 0 var(--gold); background: var(--gold-dim); }
.pillar-name { font-size: 11.5px; letter-spacing: .08em; color: var(--ink-dim); white-space: nowrap; }
.pillar-riZhu .pillar-name { color: var(--gold); }
.pillar-shishen { font-size: 12px; line-height: 1.2; color: var(--ink-muted); margin-top: 3px; }
.pillar-gan, .pillar-zhi { font-family: var(--font-ganzhi); font-size: 30px; font-weight: 700; line-height: 1.15; }
.pillar-hidden {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  margin-top: 7px; padding-top: 7px; width: 78%;
  border-top: 1px solid var(--line);
}
.hs-item { display: inline-flex; align-items: baseline; gap: 4px; font-style: normal; font-size: 12.5px; line-height: 1.35; white-space: nowrap; }
.hs-item b { font-weight: 600; }
.hs-item i { font-style: normal; font-size: 11px; color: var(--ink-dim); }
.pillar-kong { margin-top: 5px; padding: 0 5px; font-size: 11px; line-height: 1.5; color: var(--ink-dim); border: 1px dashed var(--line-strong); }

/* ── 小节标题 ── */
.panel-header { padding: 14px 16px 0; }
.panel-eyebrow, .section-label {
  display: block; font-size: 12px; font-weight: 700; letter-spacing: .2em; color: var(--ink);
}
.section-label { margin-bottom: 10px; }
.panel-divider { height: 1px; background: var(--line-strong); }
.panel-section { padding: 14px 16px 16px; }

/* ── 格局 / 形象 / 调候 ── */
.meta-block { padding: 6px 16px 10px; }
.meta-row { display: grid; grid-template-columns: 3.2em minmax(0, 1fr); gap: 12px; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--line); }
.meta-row:last-child { border-bottom: 0; }
.meta-label { font-size: 12px; letter-spacing: .12em; color: var(--ink-dim); white-space: nowrap; }
.meta-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.meta-value { font-size: 14px; line-height: 1.7; color: var(--ink); }
.meta-check { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; line-height: 1.6; color: var(--tone-xiong); }
.meta-check-bullet { font-size: 10px; flex-shrink: 0; }
.image-main { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.image-subtype { font-size: 16px; font-weight: 700; letter-spacing: .04em; color: var(--ink); }
.image-score-chip { display: inline-flex; align-items: baseline; gap: 4px; padding: 0 6px; font-size: 11.5px; line-height: 1.7; border: 1px solid currentColor; }
.image-score-chip em { font-style: normal; font-weight: 700; }
.img-level-pure { color: var(--tone-ji); }
.img-level-formed { color: var(--gold); }
.img-level-suspected { color: var(--ink-muted); }
.image-override-chip { font-size: 11.5px; color: var(--ink-dim); }
.image-secondary { display: flex; align-items: baseline; gap: 8px; }
.image-sec-label { flex: none; font-size: 11.5px; letter-spacing: .06em; color: var(--ink-dim); }
.image-sec-text { font-size: 12.5px; line-height: 1.6; color: var(--ink-muted); }

/* ── 说明行 ── */
.theory-note { margin: 0 0 8px; padding-left: 10px; border-left: 2px solid var(--gold); font-size: 14px; line-height: 1.65; color: var(--ink); }
.theory-rationale { margin: 0 0 8px; font-size: 13px; line-height: 1.7; color: var(--ink-muted); }
.yong-relation { margin: 0 0 8px; font-size: 13px; line-height: 1.65; }
.yong-rel-good { color: var(--tone-ji); }
.yong-rel-bad { color: var(--tone-xiong); }
.yong-rel-neutral { color: var(--ink-dim); }

/* ── 分析条目（十神 / 宫位通用）：不套卡片，条目之间一条发丝线 ── */
.analysis-card { position: relative; padding: 14px 0 12px; border-top: 1px solid var(--line); transition: background .2s; }
.analysis-card.card-active { background: var(--gold-dim); box-shadow: -16px 0 0 var(--gold-dim), 16px 0 0 var(--gold-dim), inset 2px 0 0 transparent; }
.analysis-card.card-active::before { content: ""; position: absolute; left: -16px; top: 0; bottom: 0; width: 2px; background: var(--gold); }
.analysis-card.card-hidden { opacity: .66; }
.card-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.role-chip { flex: none; padding: 0 6px; font-size: 12px; font-weight: 700; line-height: 1.6; letter-spacing: .04em; border: 1px solid currentColor; }
.role-yong { color: var(--gold); }
.role-ji { color: var(--tone-xiong); }
.role-target { color: var(--ink); }
.shishen-name { font-family: var(--font-ganzhi); font-size: 24px; font-weight: 700; line-height: 1; }
.card-ganzhi { font-family: var(--font-ganzhi); font-size: 18px; font-weight: 600; line-height: 1; }
.card-chip { font-size: 12px; color: var(--ink-dim); }
.gongwei-label { font-size: 14px; font-weight: 700; letter-spacing: .08em; color: var(--ink); }
.seat-info { font-size: 13px; color: var(--ink-muted); }
.seat-shen { font-style: normal; font-weight: 700; color: var(--ink); }
.kong-chip, .correct-star-chip { padding: 0 5px; font-size: 11.5px; line-height: 1.6; }
.kong-chip { color: var(--ink-dim); border: 1px dashed var(--line-strong); }
.correct-star-chip { color: var(--tone-ji); border: 1px solid currentColor; }

/* ── 机制分行：左侧一条色线表示利害 ── */
.mline { display: flex; flex-direction: column; gap: 3px; padding: 1px 0 1px 10px; margin-bottom: 9px; border-left: 2px solid var(--line-strong); }
.mline:last-child { margin-bottom: 0; }
.mline-ok { border-left-color: var(--tone-ji); }
.mline-neutral { border-left-color: var(--line-strong); }
.mline-warn { border-left-color: var(--tone-ping); }
.mline-bad { border-left-color: var(--tone-xiong); }
.mline-buried { border-left-color: var(--ink-dim); border-left-style: dashed; }
.mline-header { display: flex; align-items: center; gap: 8px; }
.mline-category { flex: none; font-size: 11.5px; letter-spacing: .1em; color: var(--ink-dim); }
.mline-phase { font-size: 13px; font-weight: 700; }
.mline-phase.vf-weak { color: var(--tone-xiong); }
.mline-phase.vf-mid { color: var(--tone-ping); }
.mline-phase.vf-strong { color: var(--tone-ji); }
.mline-bar-track { flex: 1; max-width: 96px; height: 2px; background: var(--line); overflow: hidden; }
.mline-bar-fill { height: 100%; transition: width .3s; }
.mline-bar-fill.vf-weak { background: var(--tone-xiong); }
.mline-bar-fill.vf-mid { background: var(--tone-ping); }
.mline-bar-fill.vf-strong { background: var(--tone-ji); }
.mline-text { margin: 0; font-size: 13.5px; line-height: 1.7; color: var(--ink-muted); }

/* ── 藏干折叠 / 未见十神 ── */
.hidden-stem-toggle {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  width: 100%; padding: 11px 0 0; border: 0; border-top: 1px solid var(--line);
  background: transparent; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--gold);
  cursor: pointer; text-align: left;
}
.hst-hint { font-size: 12px; font-weight: 400; color: var(--ink-dim); }
.absent-row { display: flex; align-items: baseline; gap: 8px; padding: 10px 0 0; margin-top: 10px; border-top: 1px dashed var(--line-strong); }
.absent-name { flex: none; font-family: var(--font-ganzhi); font-size: 14px; font-weight: 700; color: var(--ink-muted); }
.absent-msg { font-size: 12.5px; line-height: 1.6; color: var(--ink-dim); }

/* ── 五行 / 十神色 ── */
.el-mu { color: var(--wx-mu); }
.el-huo { color: var(--wx-huo); }
.el-tu { color: var(--wx-tu); }
.el-jin { color: var(--wx-jin); }
.el-shui { color: var(--wx-shui); }
.shen-green { color: var(--tone-ji); }
.shen-gold { color: var(--gold); }
.shen-red { color: var(--tone-xiong); }

/* ── 整体稳定性结论 ── */
.stability-footer { padding: 14px 16px 16px; }
.stab-footer-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.stab-footer-dot { align-self: center; width: 7px; height: 7px; flex-shrink: 0; background: var(--ink-dim); }
.stab-footer-label { font-size: 16px; font-weight: 700; letter-spacing: .04em; color: var(--ink); }
.stab-footer-badge { font-size: 12px; letter-spacing: .12em; color: var(--ink-dim); }
.stab-footer-text { margin: 0; font-size: 13.5px; line-height: 1.75; color: var(--ink-muted); }
.stab-footer-strong .stab-footer-dot { background: var(--tone-ji); }
.stab-footer-strong .stab-footer-label { color: var(--tone-ji); }
.stab-footer-stable .stab-footer-dot { background: var(--gold); }
.stab-footer-stable .stab-footer-label { color: var(--gold); }
.stab-footer-dynamic .stab-footer-dot { background: var(--tone-ping); }
.stab-footer-dynamic .stab-footer-label { color: var(--tone-ping); }
.stab-footer-buried .stab-footer-dot { background: var(--ink-dim); }
.stab-footer-buried .stab-footer-label { color: var(--ink-muted); }
.stab-footer-damaged .stab-footer-dot { background: var(--tone-xiong); }
.stab-footer-damaged .stab-footer-label { color: var(--tone-xiong); }
</style>
