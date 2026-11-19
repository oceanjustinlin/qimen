<template>
  <div class="dynamic-panel">

    <!-- ── 顶栏 ── -->
    <div class="panel-header">
      <span class="panel-eyebrow">动态触发</span>
    </div>

    <!-- ── 单大运：大运层（status 或 timing 单大运） ── -->
    <section v-if="mode === 'status' || !isMultiDayun" class="panel-section">
      <div class="section-label">大运建场</div>
      <div class="gz-card" :class="{ 'card-impaired': isImpaired(dayunImpact.gaitou_jiejiao) }">
        <div class="gz-card-head">
          <span class="gz-char" :class="elemClass(GAN5[dayunImpact.gan])">{{ dayunImpact.gan }}</span>
          <span class="gz-char" :class="elemClass(ZHI_WX[dayunImpact.zhi])">{{ dayunImpact.zhi }}</span>
          <span class="phase-chip">{{ dayunImpact.twelve_phase }}</span>
          <span v-if="dayunImpact.gaitou_jiejiao && dayunImpact.gaitou_jiejiao !== 'neutral' && dayunImpact.gaitou_jiejiao !== 'same'"
                class="gtj-chip" :class="gtjChipClass(dayunImpact.gaitou_jiejiao)">
            {{ gtjLabel(dayunImpact.gaitou_jiejiao) }}
          </span>
          <span v-if="dayunImpact.field_type" class="field-chip">{{ dayunImpact.field_type }}</span>
          <span class="year-subject-vigor" :title="subjectVigorTitle(dayunImpact)">
            <span>命主状态</span>
            <strong>{{ subjectVigorPercent(dayunImpact) }}</strong>
          </span>
        </div>

        <p v-if="dayunImpact.gaitou_jiejiao_note" class="gz-note">{{ dayunImpact.gaitou_jiejiao_note }}</p>

        <div
          v-for="(mech, i) in visibleMechanisms(dayunImpact)"
          :key="i"
          class="mech-row"
          :class="mechRowClass(mech)"
        >
          <div class="mech-mainline">
            <span
              v-for="t in mechTargets(mech)" :key="t.name"
              class="target-chip"
              :class="t.kind === 'gongwei' ? 'target-gongwei' : 'target-shishen'"
            >{{ t.label ?? t.name }}</span>
            <span class="mech-type">{{ mech.type }}</span>
            <span v-if="i === 0" class="mech-strength-label">机制强度</span>
          </div>
          <div class="mech-detail-line">
            <span class="mech-desc">{{ mech.description }}</span>
            <span class="mech-vigor-meter" :title="vigorTitle(mech)">
              <span class="mech-vigor-track">
                <span
                  class="mech-vigor-fill"
                  :class="vigorFillClass(mechanismStrength(mech))"
                  :style="{ width: mechanismStrengthPercent(mech) }"
                ></span>
              </span>
              <span class="mech-vigor-text">{{ mechanismStrengthPercent(mech) }}</span>
            </span>
          </div>
        </div>

        <div v-if="visibleMechanisms(dayunImpact).length === 0" class="mech-empty">大运未直接引动目标元素</div>
      </div>
    </section>

    <div v-if="mode === 'status' || !isMultiDayun" class="panel-divider"></div>

    <!-- ── 流年层: status 模式（当年单行） ── -->
    <section v-if="mode === 'status'" class="panel-section">
      <div class="section-label">流年触发</div>
      <div class="gz-card" :class="{ 'card-impaired': isImpaired(liunianImpact.gaitou_jiejiao) }">
        <div class="gz-card-head">
          <span class="gz-char" :class="elemClass(GAN5[liunianImpact.gan])">{{ liunianImpact.gan }}</span>
          <span class="gz-char" :class="elemClass(ZHI_WX[liunianImpact.zhi])">{{ liunianImpact.zhi }}</span>
          <span class="phase-chip">{{ liunianImpact.twelve_phase }}</span>
          <span v-if="liunianImpact.gaitou_jiejiao && liunianImpact.gaitou_jiejiao !== 'neutral' && liunianImpact.gaitou_jiejiao !== 'same'"
                class="gtj-chip" :class="gtjChipClass(liunianImpact.gaitou_jiejiao)">
            {{ gtjLabel(liunianImpact.gaitou_jiejiao) }}
          </span>
          <span v-if="dynamicReport.target_trigger?.is_activated" class="activated-chip">已引动</span>
          <span class="year-subject-vigor" :title="subjectVigorTitle(liunianImpact)">
            <span>命主状态</span>
            <strong>{{ subjectVigorPercent(liunianImpact) }}</strong>
          </span>
        </div>

        <p v-if="liunianImpact.gaitou_jiejiao_note" class="gz-note">{{ liunianImpact.gaitou_jiejiao_note }}</p>

        <div
          v-for="(mech, i) in visibleMechanisms(liunianImpact)"
          :key="i"
          class="mech-row"
          :class="mechRowClass(mech)"
        >
          <div class="mech-mainline">
            <span
              v-for="t in mechTargets(mech)" :key="t.name"
              class="target-chip"
              :class="t.kind === 'gongwei' ? 'target-gongwei' : 'target-shishen'"
            >{{ t.label ?? t.name }}</span>
            <span class="mech-type">{{ mech.type }}</span>
            <span v-if="i === 0" class="mech-strength-label">机制强度</span>
          </div>
          <div class="mech-detail-line">
            <span class="mech-desc">{{ mech.description }}</span>
            <span class="mech-vigor-meter" :title="vigorTitle(mech)">
              <span class="mech-vigor-track">
                <span
                  class="mech-vigor-fill"
                  :class="vigorFillClass(mechanismStrength(mech))"
                  :style="{ width: mechanismStrengthPercent(mech) }"
                ></span>
              </span>
              <span class="mech-vigor-text">{{ mechanismStrengthPercent(mech) }}</span>
            </span>
          </div>
        </div>

        <div v-if="visibleMechanisms(liunianImpact).length === 0" class="mech-empty">流年未直接引动目标元素</div>
      </div>
    </section>

    <!-- ── 忌神引动层（yongshen 锚定，凶侧）── -->
    <section v-if="mode === 'status' && avoidImpact" class="panel-section">
      <div class="section-label">忌神引动 · {{ avoidImpact.shishen }}</div>
      <div class="gz-card card-avoid">
        <div class="gz-card-head">
          <span class="avoid-badge">忌</span>
          <span v-if="avoidImpact.liunian_impact" class="gz-char gz-sm" :class="elemClass(GAN5[avoidImpact.liunian_impact.gan])">{{ avoidImpact.liunian_impact.gan }}</span>
          <span v-if="avoidImpact.liunian_impact" class="gz-char gz-sm" :class="elemClass(ZHI_WX[avoidImpact.liunian_impact.zhi])">{{ avoidImpact.liunian_impact.zhi }}</span>
          <span class="avoid-hint">岁运引动忌神＝病加重</span>
        </div>
        <div
          v-for="(mech, i) in visibleMechanisms(avoidImpact.liunian_impact)"
          :key="i"
          class="mech-row"
          :class="mechRowClass(mech)"
        >
          <div class="mech-mainline">
            <span class="mech-type">{{ mech.type }}</span>
            <span v-if="i === 0" class="mech-strength-label">机制强度</span>
          </div>
          <div class="mech-detail-line">
            <span class="mech-desc">{{ mech.description }}</span>
            <span class="mech-vigor-meter" :title="vigorTitle(mech)">
              <span class="mech-vigor-track">
                <span
                  class="mech-vigor-fill"
                  :class="vigorFillClass(mechanismStrength(mech))"
                  :style="{ width: mechanismStrengthPercent(mech) }"
                ></span>
              </span>
              <span class="mech-vigor-text">{{ mechanismStrengthPercent(mech) }}</span>
            </span>
          </div>
        </div>
        <div v-if="visibleMechanisms(avoidImpact.liunian_impact).length === 0" class="mech-empty">当前岁运未直接引动忌神</div>
        <p v-if="avoidImpact.target_trigger?.auspice_direction" class="avoid-trigger-note">
          {{ avoidImpact.target_trigger.state_change }}　<em>{{ avoidImpact.target_trigger.auspice_direction }}</em>
        </p>
      </div>
    </section>

    <!-- ── 流年层: timing 单大运（不轮播） ── -->
    <section v-if="mode === 'timing' && !isMultiDayun" class="panel-section">
      <div class="section-label">候选年运</div>
      <div class="year-list">
        <div
          v-for="tw in activeGroups[0].windows"
          :key="tw.year"
          class="year-entry"
          :class="{ 'year-best': tw.year === bestWindowYear }"
        >
          <div class="year-head" @click="toggleYear(tw.year)">
            <span class="year-num">{{ tw.year }}</span>
            <span class="gz-char gz-sm" :class="elemClass(GAN5[tw.dynamicReport.liunian_impact.gan])">
              {{ tw.dynamicReport.liunian_impact.gan }}
            </span>
            <span class="gz-char gz-sm" :class="elemClass(ZHI_WX[tw.dynamicReport.liunian_impact.zhi])">
              {{ tw.dynamicReport.liunian_impact.zhi }}
            </span>
            <span class="year-subject-vigor" :title="subjectVigorTitle(tw.dynamicReport.liunian_impact)">
              <span>命主状态</span>
              <strong>{{ subjectVigorPercent(tw.dynamicReport.liunian_impact) }}</strong>
            </span>
            <span v-if="tw.dynamicReport.target_trigger?.is_activated" class="activated-chip activated-sm">已引动</span>
            <span v-if="tw.year === bestWindowYear" class="best-badge">最强窗口</span>
            <span class="expand-icon">{{ expandedYears.has(tw.year) ? '▾' : '▸' }}</span>
          </div>
          <template v-if="expandedYears.has(tw.year)">
            <div
              v-for="(mech, i) in visibleMechanisms(tw.dynamicReport.liunian_impact)"
              :key="i"
              class="mech-row mech-row-indented"
              :class="mechRowClass(mech)"
            >
              <div class="mech-mainline">
                <span
                  v-for="t in mechTargets(mech)" :key="t.name"
                  class="target-chip"
                  :class="t.kind === 'gongwei' ? 'target-gongwei' : 'target-shishen'"
                >{{ t.label ?? t.name }}</span>
                <span class="mech-type">{{ mech.type }}</span>
                <span v-if="i === 0" class="mech-strength-label">机制强度</span>
              </div>
              <div class="mech-detail-line">
                <span class="mech-desc">{{ mech.description }}</span>
                <span class="mech-vigor-meter" :title="vigorTitle(mech)">
                  <span class="mech-vigor-track">
                    <span
                      class="mech-vigor-fill"
                      :class="vigorFillClass(mechanismStrength(mech))"
                      :style="{ width: mechanismStrengthPercent(mech) }"
                    ></span>
                  </span>
                  <span class="mech-vigor-text">{{ mechanismStrengthPercent(mech) }}</span>
                </span>
              </div>
            </div>
            <p v-if="tw.verdict" class="year-verdict">{{ tw.verdict }}</p>
          </template>
        </div>
      </div>
    </section>

    <!-- ── 流年层: timing 多大运（水平轮播） ── -->
    <template v-if="mode === 'timing' && isMultiDayun">
      <div class="dayun-carousel" ref="carouselRef" @scroll.passive="onCarouselScroll">
        <div
          v-for="(group, gi) in activeGroups"
          :key="gi"
          class="carousel-slide"
        >
          <!-- 每页：大运建场卡 -->
          <div class="panel-section">
            <div class="section-label">
              大运建场
              <span v-if="group.label" class="dayun-label-badge">{{ group.label }}</span>
            </div>
            <div class="gz-card" :class="{ 'card-impaired': isImpaired(group.dayunImpact.gaitou_jiejiao) }">
              <div class="gz-card-head">
                <span class="gz-char" :class="elemClass(GAN5[group.dayunImpact.gan])">{{ group.dayunImpact.gan }}</span>
                <span class="gz-char" :class="elemClass(ZHI_WX[group.dayunImpact.zhi])">{{ group.dayunImpact.zhi }}</span>
                <span class="phase-chip">{{ group.dayunImpact.twelve_phase }}</span>
                <span v-if="group.dayunImpact.field_type" class="field-chip">{{ group.dayunImpact.field_type }}</span>
                <span class="year-subject-vigor" :title="subjectVigorTitle(group.dayunImpact)">
                  <span>命主状态</span>
                  <strong>{{ subjectVigorPercent(group.dayunImpact) }}</strong>
                </span>
              </div>
              <div
                v-for="(mech, i) in visibleMechanisms(group.dayunImpact)"
                :key="i"
                class="mech-row"
                :class="mechRowClass(mech)"
              >
                <div class="mech-mainline">
                  <span
                    v-for="t in mechTargets(mech)" :key="t.name"
                    class="target-chip"
                    :class="t.kind === 'gongwei' ? 'target-gongwei' : 'target-shishen'"
                  >{{ t.label ?? t.name }}</span>
                  <span class="mech-type">{{ mech.type }}</span>
                  <span v-if="i === 0" class="mech-strength-label">机制强度</span>
                </div>
                <div class="mech-detail-line">
                  <span class="mech-desc">{{ mech.description }}</span>
                  <span class="mech-vigor-meter" :title="vigorTitle(mech)">
                    <span class="mech-vigor-track">
                      <span
                        class="mech-vigor-fill"
                        :class="vigorFillClass(mechanismStrength(mech))"
                        :style="{ width: mechanismStrengthPercent(mech) }"
                      ></span>
                    </span>
                    <span class="mech-vigor-text">{{ mechanismStrengthPercent(mech) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="panel-divider"></div>

          <!-- 每页：该大运内候选年 -->
          <div class="panel-section">
            <div class="section-label">候选年运</div>
            <div class="year-list">
              <div
                v-for="tw in group.windows"
                :key="tw.year"
                class="year-entry"
                :class="{ 'year-best': tw.year === bestWindowYear }"
              >
                <div class="year-head" @click="toggleYear(tw.year)">
                  <span class="year-num">{{ tw.year }}</span>
                  <span class="gz-char gz-sm" :class="elemClass(GAN5[tw.dynamicReport.liunian_impact.gan])">
                    {{ tw.dynamicReport.liunian_impact.gan }}
                  </span>
                  <span class="gz-char gz-sm" :class="elemClass(ZHI_WX[tw.dynamicReport.liunian_impact.zhi])">
                    {{ tw.dynamicReport.liunian_impact.zhi }}
                  </span>
                  <span class="year-subject-vigor" :title="subjectVigorTitle(tw.dynamicReport.liunian_impact)">
                    <span>命主状态</span>
                    <strong>{{ subjectVigorPercent(tw.dynamicReport.liunian_impact) }}</strong>
                  </span>
                  <span v-if="tw.dynamicReport.target_trigger?.is_activated" class="activated-chip activated-sm">已引动</span>
                  <span v-if="tw.year === bestWindowYear" class="best-badge">最强窗口</span>
                  <span class="expand-icon">{{ expandedYears.has(tw.year) ? '▾' : '▸' }}</span>
                </div>
                <template v-if="expandedYears.has(tw.year)">
                  <div
                    v-for="(mech, i) in visibleMechanisms(tw.dynamicReport.liunian_impact)"
                    :key="i"
                    class="mech-row mech-row-indented"
                    :class="mechRowClass(mech)"
                  >
                    <div class="mech-mainline">
                      <span
                        v-for="t in mechTargets(mech)" :key="t.name"
                        class="target-chip"
                        :class="t.kind === 'gongwei' ? 'target-gongwei' : 'target-shishen'"
                        >{{ t.label ?? t.name }}</span>
                      <span class="mech-type">{{ mech.type }}</span>
                      <span v-if="i === 0" class="mech-strength-label">机制强度</span>
                    </div>
                    <div class="mech-detail-line">
                      <span class="mech-desc">{{ mech.description }}</span>
                      <span class="mech-vigor-meter" :title="vigorTitle(mech)">
                        <span class="mech-vigor-track">
                          <span
                            class="mech-vigor-fill"
                            :class="vigorFillClass(mechanismStrength(mech))"
                            :style="{ width: mechanismStrengthPercent(mech) }"
                          ></span>
                        </span>
                        <span class="mech-vigor-text">{{ mechanismStrengthPercent(mech) }}</span>
                      </span>
                    </div>
                  </div>
                  <p v-if="tw.verdict" class="year-verdict">{{ tw.verdict }}</p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 点点导航 -->
      <div class="carousel-dots">
        <span
          v-for="(group, gi) in activeGroups"
          :key="gi"
          class="carousel-dot"
          :class="{ 'dot-active': currentSlide === gi }"
          @click="scrollToSlide(gi)"
        ></span>
      </div>
    </template>

    <div class="panel-divider"></div>

    <!-- ── 目标状态变化 ── -->
    <div class="target-trigger-row" :class="`tt-${targetTrigger.new_stability}`">
      <div class="tt-state-flow">
        <span class="tt-base">{{ targetTrigger.base_state }}</span>
        <span class="tt-arrow">→</span>
        <span class="tt-new">{{ targetTrigger.state_change }}</span>
      </div>
      <span v-if="targetTrigger.auspice_direction" class="auspice-badge" :class="auspiceClass(targetTrigger.auspice_direction)">
        {{ targetTrigger.auspice_direction }}
      </span>
    </div>

    <div v-if="avoidWindowText" class="avoid-note avoid-note-standalone">
      <span class="avoid-label">规避</span>
      <span class="avoid-text">{{ avoidWindowText }}</span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  mode:            { type: String, required: true },  // 'status' | 'timing'
  dynamicReport:   { type: Object, default: null },   // status 模式的完整 report
  triggerWindows:  { type: Array,  default: () => [] }, // timing 单大运：[{year, dynamicReport, verdict?}]
  bestWindowYear:  { type: Number, default: null },
  avoidWindowText: { type: String, default: '' },
  // 目标映射表，父组件预计算传入，用于 mech 行显示命中的十神/宫位名称
  // 格式：{ [柱名]: Array<{ kind: 'shishen' | 'gongwei', name: string }> }
  targetMap: { type: Object, default: () => ({}) },
  // 跨大运 timing 模式：[{ dayunImpact, label?, windows: [{year, dynamicReport, verdict?}] }]
  // 提供时自动启用水平轮播（多大运）；未提供时降级为 triggerWindows 单大运模式
  dayunGroups: { type: Array, default: () => [] },
})

const GAN5   = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' }
const ZHI_WX = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' }

const ELEM_CLASS = { 木:'el-mu', 火:'el-huo', 土:'el-tu', 金:'el-jin', 水:'el-shui' }
function elemClass(wx) { return ELEM_CLASS[wx] ?? '' }

function vigorFillClass(v) {
  if (!v || v < 0.2) return 'vf-weak'
  if (v < 0.5)       return 'vf-mid'
  return 'vf-strong'
}

function normalizeVigor(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  const normalized = n > 1 ? n / 100 : n
  return Math.min(1, Math.max(0, normalized))
}

function normalizeMechanismStrength(v) {
  return normalizeVigor(v)
}

function mechanismStrength(mech) {
  return normalizeMechanismStrength(mech?.effective_strength)
}

function mechanismStrengthPercent(mech) {
  return `${Math.round(mechanismStrength(mech) * 100)}%`
}

function subjectVigor(impact) {
  return normalizeVigor(impact?.trigger_vigor)
}

function subjectVigorPercent(impact) {
  return `${Math.round(subjectVigor(impact) * 100)}%`
}

function subjectVigorTitle(impact) {
  const phase = impact?.twelve_phase ? `，十二长生：${impact.twelve_phase}` : ''
  return `命主状态 ${subjectVigorPercent(impact)}${phase}，表示命主在该岁运中的承接状态`
}

function vigorTitle(mech) {
  return `机制强度 ${mechanismStrengthPercent(mech)}，表示这条动态关系本身的触发力度`
}

function isImpaired(gtj) { return gtj === 'gaitou' || gtj === 'jiejiao' }

function gtjLabel(gtj) {
  if (gtj === 'gaitou')  return '盖头'
  if (gtj === 'jiejiao') return '截脚'
  return gtj ?? ''
}

function gtjChipClass(gtj) {
  return isImpaired(gtj) ? 'gtj-bad' : ''
}

function mechRowClass(mech) {
  if (!mech.vigor_check?.is_effective) return 'mech-latent'
  const type = mech.type ?? ''
  if (type === '冲动' || type === '反吟' || type === '填实三刑') return 'mech-bad'
  if (type === '合化' || type === '合动' || type === '填实三合') return 'mech-good'
  return ''
}

function visibleMechanisms(impact) {
  const seen = new Set()
  return (impact?.mechanisms ?? []).filter(mech => {
    const key = `${mech?.type ?? ''}|${mech?.description ?? ''}|${mech?.vigor_check?.is_effective ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 返回该 mech 命中的目标列表（从 targetMap 查找）
// 结果：Array<{ kind: 'shishen'|'gongwei', name: string }>
function mechTargets(mech) {
  const mapped = (props.targetMap[mech.target_pillar] ?? []).map(t => ({
    ...t,
    label: t.label ?? t.name,
  }))
  const touGan = touGanShishen(mech)
  if (!touGan) return mapped
  return [
    touGan,
    ...mapped.filter(t => t.name !== touGan.name && t.label !== touGan.label),
  ]
}

function touGanShishen(mech) {
  if (mech?.type !== '透干引动') return null
  const match = String(mech?.description ?? '').match(/（([^）]+)）透干/)
  if (!match) return null
  const name = expandShishen(match[1])
  if (!name) return null
  return { kind: 'shishen', name, label: `透出天干${name}` }
}

function expandShishen(token) {
  const full = { 财: '正财', 才: '偏财', 官: '正官', 杀: '七杀', 印: '正印', 枭: '偏印', 食: '食神', 伤: '伤官', 比: '比肩', 劫: '劫财' }
  return full[token] ?? token
}

function auspiceClass(dir) {
  if (!dir) return ''
  if (dir.includes('不利') || dir.includes('凶')) return 'auspice-xiong'
  if (dir.includes('利') || dir.includes('吉')) return 'auspice-ji'
  return 'auspice-neutral'
}

function topMechVigor(dr) {
  const mechs = dr?.liunian_impact?.mechanisms ?? []
  if (!mechs.length) return 0
  return Math.max(...mechs.map(m => mechanismStrength(m)))
}

// ── 展开/折叠状态（timing 模式） ──
const expandedYears = ref(new Set(props.bestWindowYear != null ? [props.bestWindowYear] : []))

watch(() => props.bestWindowYear, (y) => {
  if (y != null) expandedYears.value = new Set([y])
})

function toggleYear(year) {
  const s = new Set(expandedYears.value)
  if (s.has(year)) s.delete(year)
  else s.add(year)
  expandedYears.value = s
}

// ── 多大运轮播 ──
// activeGroups：统一数据源，无论单大运还是多大运
const activeGroups = computed(() => {
  if (props.dayunGroups?.length) return props.dayunGroups
  // 降级：把 triggerWindows 包成单组
  return [{
    dayunImpact: props.triggerWindows[0]?.dynamicReport?.dayun_impact ?? {},
    label: null,
    windows: props.triggerWindows,
  }]
})

const isMultiDayun = computed(() => activeGroups.value.length > 1)

const carouselRef = ref(null)
const currentSlide = ref(0)

function onCarouselScroll(e) {
  const el = e.target
  if (!el.clientWidth) return
  currentSlide.value = Math.round(el.scrollLeft / el.clientWidth)
}

function scrollToSlide(i) {
  if (!carouselRef.value) return
  carouselRef.value.scrollTo({ left: i * carouselRef.value.clientWidth, behavior: 'smooth' })
}

// ── 数据衍生 ──
const dayunImpact = computed(() => {
  if (props.mode === 'status') return props.dynamicReport?.dayun_impact ?? {}
  // timing 单大运：从 activeGroups[0] 取
  return activeGroups.value[0]?.dayunImpact ?? {}
})

const liunianImpact = computed(() => props.dynamicReport?.liunian_impact ?? {})
const avoidImpact = computed(() => props.dynamicReport?.avoid_impact ?? null)

// 所有候选年（跨多大运展平，用于查找 bestWindowYear）
const allWindows = computed(() =>
  activeGroups.value.flatMap(g => g.windows ?? [])
)

const targetTrigger = computed(() => {
  if (props.mode === 'timing' && props.bestWindowYear != null) {
    const best = allWindows.value.find(tw => tw.year === props.bestWindowYear)
    return best?.dynamicReport?.target_trigger || {}
  }
  return props.dynamicReport?.target_trigger || {}
})

</script>

<style scoped>
/* 动态触发：与原局底盘同一套发丝线账页，颜色全部走全局 token */
.dynamic-panel {
  border: 1px solid var(--line-strong);
  border-radius: 0;
  background: transparent;
  font-family: var(--font-serif);
  color: var(--ink);
  overflow: hidden;
}

/* ── 小节 ── */
.panel-header { padding: 12px 16px 11px; border-bottom: 1px solid var(--line-strong); }
.panel-eyebrow { display: block; font-size: 12px; font-weight: 700; letter-spacing: .2em; color: var(--ink); }
.panel-section { padding: 14px 16px 16px; }
.section-label { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; font-size: 12px; letter-spacing: .16em; color: var(--ink-dim); }
.panel-divider { height: 1px; background: var(--line-strong); }

/* ── 大运 / 流年条目 ── */
.gz-card { display: flex; flex-direction: column; gap: 10px; }
.gz-card.card-impaired, .gz-card.card-avoid { padding-left: 10px; border-left: 2px solid var(--tone-xiong); }
.gz-card.card-impaired { border-left-color: var(--tone-ping); }
.gz-card-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
.gz-char { font-family: var(--font-ganzhi); font-size: 30px; font-weight: 700; line-height: 1; }
.gz-char + .gz-char { margin-left: -4px; }
.gz-sm { font-size: 20px; }
.el-mu { color: var(--wx-mu); }
.el-huo { color: var(--wx-huo); }
.el-tu { color: var(--wx-tu); }
.el-jin { color: var(--wx-jin); }
.el-shui { color: var(--wx-shui); }

/* ── 小标签：一律方角发丝线，不铺底色 ── */
.phase-chip, .field-chip, .gtj-chip, .activated-chip, .best-badge, .dayun-label-badge, .target-chip, .avoid-badge, .avoid-label {
  flex-shrink: 0; padding: 0 6px; font-size: 11.5px; line-height: 1.65; letter-spacing: .04em; white-space: nowrap;
  border: 1px solid var(--line-strong); color: var(--ink-muted); background: transparent; border-radius: 0;
}
.field-chip { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.gtj-bad { color: var(--tone-xiong); border-color: currentColor; }
.activated-chip { color: var(--tone-ji); border-color: currentColor; }
.best-badge { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 700; }
.dayun-label-badge { font-weight: 400; letter-spacing: .04em; }
.target-chip { font-weight: 700; }
.target-shishen { color: var(--gold); border-color: currentColor; }
.target-gongwei { color: var(--ink); border-color: var(--line-strong); }
.avoid-badge, .avoid-label { color: var(--tone-xiong); border-color: currentColor; font-weight: 700; }
.avoid-hint { font-size: 12px; color: var(--tone-xiong); }

.year-subject-vigor { margin-left: auto; display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--ink-dim); white-space: nowrap; }
.year-subject-vigor strong { font-size: 15px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

.gz-note, .avoid-trigger-note { margin: 0; padding-left: 10px; border-left: 2px solid var(--line-strong); font-size: 13px; line-height: 1.65; color: var(--ink-muted); }
.avoid-trigger-note { border-left-color: var(--tone-xiong); }
.avoid-trigger-note em { font-style: normal; font-weight: 700; color: var(--tone-xiong); }

/* ── 机制行 ── */
.mech-row { display: flex; flex-direction: column; gap: 4px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13.5px; line-height: 1.6; }
.mech-row-indented { margin: 0 14px; }
.mech-mainline { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; width: 100%; min-width: 0; }
.mech-detail-line { display: flex; align-items: baseline; gap: 12px; width: 100%; min-width: 0; }
.mech-type { flex-shrink: 0; font-size: 14px; font-weight: 700; white-space: nowrap; color: var(--ink); }
.mech-bad .mech-type { color: var(--tone-xiong); }
.mech-good .mech-type { color: var(--tone-ji); }
.mech-latent { opacity: .6; }
.mech-desc { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--ink-muted); }
.mech-strength-label { margin-left: auto; font-size: 11.5px; color: var(--ink-dim); white-space: nowrap; }
.mech-vigor-meter { display: inline-flex; align-items: center; justify-content: flex-end; gap: 7px; flex-shrink: 0; min-width: 96px; color: var(--ink-dim); }
.mech-vigor-track { width: 52px; height: 2px; background: var(--line); overflow: hidden; }
.mech-vigor-fill { display: block; height: 100%; transition: width .3s ease; }
.mech-vigor-text { width: 34px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--ink-muted); }
.vf-weak { background: var(--ink-dim); }
.vf-mid { background: var(--tone-ping); }
.vf-strong { background: var(--gold); }
.mech-empty { padding: 4px 0; font-size: 12.5px; color: var(--ink-dim); }

/* ── 多大运横向翻页 ── */
.dayun-carousel { display: flex; overflow-x: scroll; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.dayun-carousel::-webkit-scrollbar { display: none; }
.carousel-slide { flex: 0 0 100%; scroll-snap-align: start; min-width: 0; }
.carousel-dots { display: flex; justify-content: center; gap: 6px; padding: 10px 0; border-top: 1px solid var(--line); }
.carousel-dot { width: 14px; height: 2px; flex-shrink: 0; background: var(--line-strong); cursor: pointer; transition: all .2s ease; padding: 0; box-sizing: content-box; border: 6px solid transparent; border-left-width: 0; border-right-width: 0; background-clip: padding-box; }
.carousel-dot.dot-active { width: 26px; background-color: var(--gold); }

/* ── 候选年列表 ── */
.year-list { display: flex; flex-direction: column; border-top: 1px solid var(--line); }
.year-entry { border-bottom: 1px solid var(--line); }
.year-entry:last-child { border-bottom: 0; }
.year-entry.year-best { box-shadow: inset 2px 0 0 var(--gold); background: var(--gold-dim); }
.year-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; padding: 11px 0; cursor: pointer; user-select: none; }
.year-entry.year-best .year-head { padding-left: 10px; padding-right: 8px; }
.year-num { min-width: 40px; font-size: 15px; font-weight: 700; letter-spacing: .02em; color: var(--ink); font-variant-numeric: tabular-nums; }
.year-head .gz-sm + .gz-sm { margin-left: -6px; }
.expand-icon { margin-left: 2px; font-size: 12px; color: var(--ink-dim); }
.year-head .year-subject-vigor + .expand-icon,
.year-head .expand-icon { margin-left: auto; }
.year-head .year-subject-vigor { margin-left: 4px; }
.year-verdict { margin: 0; padding: 10px 14px 12px; border-top: 1px solid var(--line); font-size: 13.5px; line-height: 1.7; color: var(--ink-muted); }

/* ── 目标状态变化 ── */
.target-trigger-row { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 16px; }
.tt-state-flow { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 8px; font-size: 13.5px; line-height: 1.6; min-width: 0; }
.tt-base { color: var(--ink-dim); overflow-wrap: anywhere; }
.tt-arrow { flex-shrink: 0; color: var(--gold); }
.tt-new { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.tt-strong .tt-new { color: var(--tone-ji); }
.tt-stable .tt-new { color: var(--ink); }
.tt-dynamic .tt-new { color: var(--tone-ping); }
.tt-buried .tt-new { color: var(--ink-muted); }
.tt-damaged .tt-new { color: var(--tone-xiong); }
.auspice-badge { white-space: normal; align-self: stretch; padding-left: 10px; border-left: 2px solid var(--line-strong); font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; color: var(--ink-muted); }
.auspice-ji { border-left-color: var(--tone-ji); color: var(--tone-ji); }
.auspice-xiong { border-left-color: var(--tone-xiong); color: var(--tone-xiong); }
.auspice-neutral { border-left-color: var(--gold); }

.avoid-note { display: flex; align-items: baseline; gap: 8px; }
.avoid-note-standalone { margin: 0 16px 16px; }
.avoid-text { font-size: 13px; line-height: 1.6; color: var(--ink-muted); }
</style>
