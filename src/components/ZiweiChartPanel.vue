<template>
  <section class="ziwei-panel">
    <div v-if="error" class="zw-state zw-error">{{ error }}</div>
    <div v-else-if="!astrolabe" class="zw-state">正在排紫微盘…</div>
    <template v-else>
      <div class="zw-toolbar">
        <div class="zw-seg" role="group" aria-label="看盘方式">
          <button type="button" :aria-pressed="view === 'sanhe'" @click="view = 'sanhe'">三合</button>
          <button type="button" :aria-pressed="view === 'sihua'" @click="view = 'sihua'">四化</button>
        </div>
        <div class="zw-layer-note">
          <template v-if="!layerInfo">当前：<b>本命盘</b>，可在盘下选择大限 / 流年 / 流月</template>
          <template v-else>
            当前：<b>{{ layerInfo.title }} · {{ layerInfo.ganzhi }}</b>
            <span v-for="(star, k) in layerInfo.mutagens" :key="star" class="zw-inline">{{ star }}<i :class="['mu', 'o', 'mu-' + MUTAGENS[k]]">{{ MUTAGENS[k] }}</i></span>
          </template>
        </div>
      </div>

      <div class="zw-board-scroll">
        <div ref="boardRef" class="zw-board" aria-label="紫微十二宫盘">
          <button
            v-for="cell in palaceCells"
            :key="cell.index"
            type="button"
            :class="['zw-palace', cell.state]"
            :style="{ gridRow: cell.row, gridColumn: cell.col }"
            :data-i="cell.index"
            :aria-pressed="cell.index === selected"
            :aria-label="`${cell.palace.name} ${cell.palace.heavenlyStem}${cell.palace.earthlyBranch}`"
            @click="selected = cell.index"
          >
            <div class="zw-stars">
              <span v-for="star in cell.stars" :key="star.key" :class="['st', star.cls]">
                <span class="nm"><span v-for="(ch, ci) in star.name" :key="ci">{{ ch }}</span></span>
                <span v-if="star.showBrightness" class="br">{{ star.brightness }}</span>
                <i v-if="star.mutagen" :class="['mu', 'mu-' + star.mutagen]" :title="'生年化' + star.mutagen">{{ star.mutagen }}</i>
                <i v-if="star.periodMutagen" :class="['mu', 'o', 'mu-' + star.periodMutagen]" :title="layerPrefix + '化' + star.periodMutagen">{{ star.periodMutagen }}</i>
                <i v-for="mark in star.marks" :key="mark.kind + mark.mutagen" :class="['zi', 'c-' + mark.mutagen]" :title="(mark.kind === 'self' ? '本宫自化' : '对宫化入') + mark.mutagen">{{ mark.kind === 'self' ? '↓' : '↗' }}</i>
              </span>
            </div>
            <div class="zw-ages">流年 {{ cell.flowAges }}<br><span class="xl">小限 {{ cell.smallAges }}</span></div>
            <div class="zw-foot">
              <div>
                <div class="gods">{{ cell.palace.boshi12 }} · {{ cell.palace.jiangqian12 }} · {{ cell.palace.suiqian12 }}</div>
                <div class="range">{{ cell.palace.decadal.range[0] }}–{{ cell.palace.decadal.range[1] }}</div>
                <div class="mid">
                  <span class="pname">{{ cell.palace.name }}</span>
                  <span v-if="cell.periodName" class="tag pp">{{ cell.periodName }}</span>
                  <span v-if="cell.palace.isBodyPalace" class="tag body">身</span>
                </div>
              </div>
              <div class="right">
                <span class="cs">{{ cell.palace.changsheng12 }}</span>
                <span class="gz"><span>{{ cell.palace.heavenlyStem }}</span><span>{{ cell.palace.earthlyBranch }}</span></span>
              </div>
            </div>
          </button>

          <div class="zw-center">
            <h3>{{ profile?.name || '命主' }} <small>{{ centerInfo.yinyang }}{{ astrolabe.gender }} · {{ astrolabe.fiveElementsClass }}</small></h3>
            <dl>
              <dt>{{ input.timeSource === 'profile_adjusted' ? '真太阳时' : '出生时间' }}</dt>
              <dd>{{ astrolabe.solarDate }} {{ pad(input.hour) }}:{{ pad(input.minute) }}</dd>
              <dt>农历</dt><dd>{{ astrolabe.lunarDate }} {{ astrolabe.time }}</dd>
            </dl>
            <div class="zw-pillars">
              <span class="lab">四柱</span>
              <b v-for="(ch, k) in centerInfo.pillarChars" :key="k" :class="WX_CLASS[ch]">{{ ch }}</b>
            </div>
            <div class="zw-decades">
              <span v-for="d in centerInfo.decades" :key="d.start">{{ d.stem }}<br>{{ d.branch }}<br><small>{{ d.start }}岁</small></span>
            </div>
            <dl>
              <dt>命主 / 身主</dt><dd>{{ astrolabe.soul }} / {{ astrolabe.body }}　身宫：{{ centerInfo.bodyPalace }}</dd>
              <dt>生年四化</dt>
              <dd class="zw-legend">
                <span v-for="m in MUTAGENS" :key="m" class="zw-inline">{{ centerInfo.natal[m] }}<i :class="['mu', 'mu-' + m]">{{ m }}</i></span>
              </dd>
            </dl>
            <p v-if="input.timeSource !== 'profile_adjusted'" class="zw-warn">档案没有真太阳时，按出生钟表时间起盘。</p>
          </div>

          <svg class="zw-lines" :viewBox="`0 0 ${lines.width} ${lines.height}`" aria-hidden="true">
            <template v-if="view === 'sanhe' && lines.points">
              <polygon class="tri" :points="lines.points.tri" />
              <line class="tri" v-bind="lines.points.opp" />
            </template>
            <template v-else-if="lines.fly">
              <defs>
                <marker v-for="f in lines.fly" :id="`zw-ah-${uid}-${f.k}`" :key="'m' + f.k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" :class="'f-' + f.mutagen" />
                </marker>
              </defs>
              <g v-for="f in lines.fly" :key="'l' + f.k" :class="'s-' + f.mutagen">
                <line class="fly" :x1="f.x1" :y1="f.y1" :x2="f.x2" :y2="f.y2" :marker-end="`url(#zw-ah-${uid}-${f.k})`" />
                <text :x="f.tx" :y="f.ty" text-anchor="middle">{{ f.mutagen }}</text>
              </g>
            </template>
          </svg>
        </div>
      </div>

      <div class="zw-strips">
        <div class="strip">
          <div class="lab">大限</div>
          <div class="cells">
            <button type="button" class="cell" :aria-pressed="layer === 'natal'" @click="selectNatal"><b>本命</b>原局</button>
            <button
              v-for="d in decadalCells" :key="d.index" type="button" :class="['cell', { now: d.isNow }]"
              :aria-pressed="layer === 'decadal' && d.index === horoscope.decadal.index"
              @click="selectDecadal(d.start)"
            ><b>{{ d.start }}–{{ d.end }}</b>{{ d.ganzhi }}</button>
          </div>
        </div>
        <div class="strip">
          <div class="lab">流年</div>
          <div class="cells">
            <button
              v-for="y in yearCells" :key="y.year" type="button" :class="['cell', { now: y.isNow }]"
              :aria-pressed="(layer === 'yearly' || layer === 'monthly') && y.year === target.getFullYear()"
              @click="selectYear(y.year)"
            ><b>{{ y.year }}</b>{{ y.age }}岁 {{ y.ganzhi }}</button>
          </div>
        </div>
        <div class="strip">
          <div class="lab">流月</div>
          <div class="cells">
            <button
              v-for="m in monthCells" :key="m.label" type="button" class="cell" :disabled="!m.date"
              :aria-pressed="layer === 'monthly' && m.branch === horoscope.monthly.earthlyBranch"
              @click="selectMonth(m)"
            ><b>{{ m.label }}</b>{{ target.getFullYear() }}</button>
          </div>
        </div>
      </div>

      <div class="zw-detail" aria-live="polite">
        <h4>{{ detail.title }}</h4>
        <div v-if="detail.periodName" class="row"><span>{{ layerPrefix }}限宫位</span><span>{{ detail.periodName }}</span></div>
        <div v-for="group in detail.starGroups" :key="group.label" class="row">
          <span>{{ group.label }}</span>
          <span v-if="group.stars.length">
            <span v-for="star in group.stars" :key="star.name" class="zw-inline zw-gap">{{ star.name }}<small v-if="star.brightness">{{ star.brightness }}</small><i v-if="star.mutagen" :class="['mu', 'mu-' + star.mutagen]">{{ star.mutagen }}</i></span>
          </span>
          <span v-else class="dim">无</span>
        </div>
        <div class="row"><span>杂曜</span><span>{{ detail.adjective || '无' }}</span></div>
        <div class="row">
          <span>宫干四化</span>
          <span>{{ detail.stem }}干：<span v-for="f in detail.flying" :key="f.mutagen" class="zw-inline zw-gap">{{ f.star }}<i :class="['mu', 'mu-' + f.mutagen]">{{ f.mutagen }}</i>→{{ f.where }}</span></span>
        </div>
        <div class="row"><span>十二神</span><span>{{ detail.gods }}</span></div>
        <div class="row"><span>三方四正</span><span>{{ detail.related }}</span></div>
      </div>

      <p class="zw-note">实底方块为生年四化，空心方块为所选运限四化；↓ 本宫自化，↗ 对宫化入。三合视图点宫位看三方四正，四化视图看宫干禄权科忌飞入哪一宫。晚子时按次日起盘，年界按农历正月初一。</p>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import {
  MUTAGENS,
  STEM_MUTAGENS,
  buildZiweiInput,
  createZiweiAstrolabe,
  flowYearAges,
  flyingTargets,
  lunarMonthDates,
  natalMutagens,
  relatedPalaceIndexes,
  selfMutagenMarks,
  toDateStr,
} from '../utils/ziweiChart.mjs'

const props = defineProps({
  profile: { type: Object, default: null },
})

const GRID = { 巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4], 辰: [2, 1], 酉: [2, 4], 卯: [3, 1], 戌: [3, 4], 寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4] }
const SHORT = { 命宫: '命', 兄弟: '兄', 夫妻: '夫', 子女: '子', 财帛: '财', 疾厄: '疾', 迁移: '迁', 仆役: '友', 官禄: '官', 田宅: '田', 福德: '福', 父母: '父' }
const LAYER_PREFIX = { decadal: '大', yearly: '年', monthly: '月' }
const WX_CLASS = { 甲: 'wx-mu', 乙: 'wx-mu', 寅: 'wx-mu', 卯: 'wx-mu', 丙: 'wx-huo', 丁: 'wx-huo', 巳: 'wx-huo', 午: 'wx-huo', 戊: 'wx-tu', 己: 'wx-tu', 辰: 'wx-tu', 戌: 'wx-tu', 丑: 'wx-tu', 未: 'wx-tu', 庚: 'wx-jin', 辛: 'wx-jin', 申: 'wx-jin', 酉: 'wx-jin', 壬: 'wx-shui', 癸: 'wx-shui', 亥: 'wx-shui', 子: 'wx-shui' }
const uid = Math.random().toString(36).slice(2, 8)

const astrolabe = shallowRef(null)
const horoscope = shallowRef(null)
const input = ref(null)
const error = ref('')
const view = ref('sanhe')
const layer = ref('natal')
const selected = ref(0)
const target = ref(new Date())
const monthCells = shallowRef([])
const boardRef = ref(null)
const lines = reactive({ width: 0, height: 0, points: null, fly: null })

const pad = (n) => String(n).padStart(2, '0')
const pname = (name) => (name.endsWith('宫') ? name : `${name}宫`)

let astroModule = null
async function build() {
  error.value = ''
  astrolabe.value = null
  if (!props.profile) return
  try {
    input.value = buildZiweiInput(props.profile)
    astroModule ||= (await import('iztro')).astro
    astrolabe.value = createZiweiAstrolabe(astroModule, input.value)
    layer.value = 'natal'
    monthCells.value = []
    setTarget(new Date())
    selected.value = astrolabe.value.palaces.findIndex((p) => p.name === '命宫')
  } catch (err) {
    error.value = err?.message || '紫微排盘失败，请稍后重试。'
  }
}

function setTarget(date, { keepMonths = false } = {}) {
  const yearChanged = !target.value || target.value.getFullYear() !== date.getFullYear()
  target.value = date
  horoscope.value = astrolabe.value.horoscope(toDateStr(date), 6)
  if (!keepMonths && (yearChanged || !monthCells.value.length)) monthCells.value = lunarMonthDates(astrolabe.value, date.getFullYear())
}

const birthYear = computed(() => input.value?.year || 0)
const layerPrefix = computed(() => LAYER_PREFIX[layer.value] || '')
const layerData = computed(() => (layer.value === 'natal' || !horoscope.value ? null : horoscope.value[layer.value]))
const layerMutagenMap = computed(() => {
  const map = {}
  ;(layerData.value?.mutagen || []).forEach((star, i) => { map[star] = MUTAGENS[i] })
  return map
})

const layerInfo = computed(() => {
  const L = layerData.value
  if (!L) return null
  const titles = {
    decadal: () => `大限 ${astrolabe.value.palaces[L.index].decadal.range.join('–')} 岁`,
    yearly: () => `${target.value.getFullYear()} 流年 · 虚岁 ${horoscope.value.age.nominalAge}`,
    monthly: () => `${target.value.getFullYear()} 年流月`,
  }
  return { title: titles[layer.value](), ganzhi: `${L.heavenlyStem}${L.earthlyBranch}`, mutagens: L.mutagen || [] }
})

const flyIndexes = computed(() => (astrolabe.value && view.value === 'sihua' ? flyingTargets(astrolabe.value.palaces, selected.value) : []))

const palaceCells = computed(() => {
  const a = astrolabe.value
  if (!a) return []
  const related = relatedPalaceIndexes(selected.value)
  return a.palaces.map((palace, index) => {
    const marks = selfMutagenMarks(a.palaces, index)
    const toStar = (star, cls) => ({
      key: `${cls}-${star.name}`,
      name: [...star.name],
      cls,
      brightness: star.brightness || '',
      showBrightness: cls === 'major' || cls === 'minor',
      mutagen: cls === 'major' || cls === 'minor' ? star.mutagen : '',
      periodMutagen: cls === 'major' || cls === 'minor' ? layerMutagenMap.value[star.name] : '',
      marks: marks[star.name] || [],
    })
    const flowStars = layerData.value?.stars?.[index] || []
    let state = ''
    if (index === selected.value) state = 'sel'
    else if (view.value === 'sanhe' && (related.opposite === index || related.trines.includes(index))) state = 'rel'
    else if (view.value === 'sihua' && flyIndexes.value.includes(index)) state = 'hit'
    const periodPalace = layerData.value?.palaceNames?.[index]
    const [row, col] = GRID[palace.earthlyBranch]
    return {
      index,
      palace,
      row,
      col,
      state,
      periodName: periodPalace ? `${layerPrefix.value}${SHORT[periodPalace] || periodPalace[0]}` : '',
      flowAges: flowYearAges(birthYear.value, palace.earthlyBranch).join(','),
      smallAges: palace.ages.slice(0, 6).join(','),
      stars: [
        ...palace.majorStars.map((s) => toStar(s, 'major')),
        ...palace.minorStars.map((s) => toStar(s, 'minor')),
        ...palace.adjectiveStars.map((s) => toStar(s, 'adj')),
        ...flowStars.map((s) => toStar(s, 'flow')),
      ],
    }
  })
})

const centerInfo = computed(() => {
  const a = astrolabe.value
  const pillars = a.chineseDate.split(' ')
  const body = a.palaces.find((p) => p.isBodyPalace)
  return {
    yinyang: '甲丙戊庚壬'.includes(pillars[0][0]) ? '阳' : '阴',
    pillarChars: [...pillars.map((p) => p[0]), ...pillars.map((p) => p[1])],
    decades: [...a.palaces].sort((x, y) => x.decadal.range[0] - y.decadal.range[0]).slice(0, 8)
      .map((p) => ({ stem: p.heavenlyStem, branch: p.earthlyBranch, start: p.decadal.range[0] })),
    bodyPalace: body ? body.name : '—',
    natal: natalMutagens(a.palaces),
  }
})

const nowAge = computed(() => new Date().getFullYear() - birthYear.value + 1)
const decadalCells = computed(() => [...astrolabe.value.palaces]
  .map((p, index) => ({ p, index }))
  .sort((x, y) => x.p.decadal.range[0] - y.p.decadal.range[0])
  .map(({ p, index }) => ({
    index,
    start: p.decadal.range[0],
    end: p.decadal.range[1],
    ganzhi: `${p.heavenlyStem}${p.earthlyBranch}`,
    isNow: nowAge.value >= p.decadal.range[0] && nowAge.value <= p.decadal.range[1],
  })))

const yearCells = computed(() => {
  const a = astrolabe.value
  const [start, end] = a.palaces[horoscope.value.decadal.index].decadal.range
  const thisYear = new Date().getFullYear()
  const cells = []
  for (let age = start; age <= end; age += 1) {
    const year = birthYear.value + age - 1
    const yearly = a.horoscope(`${year}-7-1`, 6).yearly
    cells.push({ year, age, ganzhi: `${yearly.heavenlyStem}${yearly.earthlyBranch}`, isNow: year === thisYear })
  }
  return cells
})

const detail = computed(() => {
  const a = astrolabe.value
  const palace = a.palaces[selected.value]
  const related = relatedPalaceIndexes(selected.value)
  const nameOf = (i) => `${pname(a.palaces[i].name)}（${a.palaces[i].earthlyBranch}）`
  const targets = flyingTargets(a.palaces, selected.value)
  const star = (s) => ({ name: s.name, brightness: s.brightness || '', mutagen: s.mutagen || '' })
  return {
    title: `${pname(palace.name)} · ${palace.heavenlyStem}${palace.earthlyBranch}${palace.isBodyPalace ? '（身宫）' : ''}`,
    periodName: layerData.value?.palaceNames?.[selected.value] || '',
    starGroups: [
      { label: '主星', stars: palace.majorStars.map(star) },
      { label: '辅星', stars: palace.minorStars.map(star) },
    ],
    adjective: palace.adjectiveStars.map((s) => s.name).join('、'),
    stem: palace.heavenlyStem,
    flying: STEM_MUTAGENS[palace.heavenlyStem].map((s, k) => ({
      star: s,
      mutagen: MUTAGENS[k],
      where: targets[k] < 0 ? '盘中无此星' : targets[k] === selected.value ? '本宫（自化）' : pname(a.palaces[targets[k]].name),
    })),
    gods: `长生：${palace.changsheng12} · 博士：${palace.boshi12} · 将前：${palace.jiangqian12} · 岁前：${palace.suiqian12}`,
    related: `对宫 ${nameOf(related.opposite)}；三合 ${nameOf(related.trines[0])}、${nameOf(related.trines[1])}`,
  }
})

function focusLayer() {
  selected.value = layer.value === 'natal'
    ? astrolabe.value.palaces.findIndex((p) => p.name === '命宫')
    : horoscope.value[layer.value].index
}
function selectNatal() { layer.value = 'natal'; focusLayer() }
function selectDecadal(startAge) { setTarget(new Date(birthYear.value + startAge - 1, 6, 1)); layer.value = 'decadal'; focusLayer() }
function selectYear(year) { setTarget(new Date(year, 6, 1)); layer.value = 'yearly'; focusLayer() }
function selectMonth(month) { setTarget(new Date(month.date), { keepMonths: true }); layer.value = 'monthly'; focusLayer() }

function drawLines() {
  const board = boardRef.value
  if (!board || !astrolabe.value) return
  const box = board.getBoundingClientRect()
  lines.width = box.width
  lines.height = box.height
  const center = (i) => {
    const r = board.querySelector(`.zw-palace[data-i="${i}"]`)?.getBoundingClientRect()
    return r ? [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2] : [0, 0]
  }
  const s = center(selected.value)
  if (view.value === 'sanhe') {
    const { opposite, trines } = relatedPalaceIndexes(selected.value)
    const t1 = center(trines[0]); const t2 = center(trines[1]); const o = center(opposite)
    lines.points = { tri: `${s} ${t1} ${t2}`, opp: { x1: s[0], y1: s[1], x2: o[0], y2: o[1] } }
    lines.fly = null
    return
  }
  lines.points = null
  lines.fly = flyIndexes.value.map((t, k) => {
    if (t < 0 || t === selected.value) return null // 落本宫：用 ↓ 自化标记表示
    const e = center(t)
    const off = (k - 1.5) * 6 // 四条线错开
    const dx = e[0] - s[0]; const dy = e[1] - s[1]; const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * off; const ny = (dx / len) * off
    const x2 = e[0] + nx - (dx / len) * 22; const y2 = e[1] + ny - (dy / len) * 22
    return { k, mutagen: MUTAGENS[k], x1: s[0] + nx, y1: s[1] + ny, x2, y2, tx: x2 + nx * 0.6, ty: y2 + ny * 0.6 - 4 }
  }).filter(Boolean)
}

watch([palaceCells, view], () => nextTick(drawLines))
watch(() => [props.profile?.id, props.profile?.birth_date, props.profile?.adjusted_birth_date, props.profile?.gender], build)

let resizeTimer = null
const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawLines, 100) }
onMounted(() => { build(); window.addEventListener('resize', onResize) })
onUnmounted(() => { window.removeEventListener('resize', onResize); clearTimeout(resizeTimer) })
</script>

<style scoped>
.ziwei-panel {
  --zw-major: #8a3b12; --zw-minor: #2f4f7a; --zw-period: #b0602a;
  --zw-lu: #2e7d49; --zw-quan: #7c5cbf; --zw-ke: #1565c0; --zw-ji: #c0392b;
  --zw-card: var(--bg-card, #fff);
  display: grid; gap: 14px; margin-top: 12px; font-family: var(--font-serif);
}
[data-theme="dark"] .ziwei-panel {
  --zw-major: #f0a070; --zw-minor: #8fb4e8; --zw-period: #f0a060;
  --zw-lu: #5fc78a; --zw-quan: #b39cf0; --zw-ke: #6aa8f0; --zw-ji: #ff6b61;
}
.zw-state { padding: 32px 12px; text-align: center; color: var(--ink-muted); font-size: 14px; }
.zw-error { color: var(--zw-ji); }

.zw-toolbar { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; }
.zw-seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--paper-soft); border: 1px solid var(--line); }
.zw-seg button { border: 0; background: none; padding: 5px 16px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 14px; color: var(--ink-muted); }
.zw-seg button[aria-pressed="true"] { background: var(--gold); color: var(--paper); font-weight: 600; }
.zw-layer-note { font-size: 13px; color: var(--ink-muted); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.zw-layer-note b { color: var(--zw-period); font-weight: 600; }
.zw-inline { display: inline-flex; align-items: center; gap: 1px; white-space: nowrap; }
.zw-gap { margin-right: 10px; }
.zw-inline small { font-size: 11px; color: var(--ink-dim); }

.zw-board-scroll { overflow-x: auto; }
.zw-board { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(178px, auto)); border: 1px solid var(--gold-border); background: var(--zw-card); min-width: 352px; }
.zw-palace { position: relative; border: 1px solid var(--line); padding: 4px 4px 3px; display: flex; flex-direction: column; gap: 3px; cursor: pointer; min-width: 0; text-align: left; background: transparent; font: inherit; color: inherit; transition: background .15s; }
.zw-palace:hover { background: var(--gold-dim); }
.zw-palace.sel { background: var(--gold-dim); box-shadow: inset 0 0 0 2px var(--gold); }
.zw-palace.rel { box-shadow: inset 0 0 0 1px var(--gold-border); background: color-mix(in srgb, var(--gold-dim) 45%, transparent); }
.zw-palace.hit { box-shadow: inset 0 0 0 1px var(--gold-border); }

.zw-stars { display: flex; flex-wrap: wrap; gap: 4px 3px; align-items: flex-start; }
.st { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 14px; }
.st .nm, .gz { display: flex; flex-direction: column; align-items: center; line-height: 1.08; }
.st.major .nm { font-size: 15px; font-weight: 700; color: var(--zw-major); }
.st.minor .nm { font-size: 14px; font-weight: 600; color: var(--zw-minor); }
.st.adj .nm { font-size: 11px; color: var(--ink-muted); }
.st.flow .nm { font-size: 11px; color: var(--zw-period); }
.st .br { font-size: 10px; color: var(--ink-dim); line-height: 1.2; min-height: 12px; }
.mu { display: inline-block; font-size: 10px; line-height: 14px; width: 14px; text-align: center; border-radius: 3px; color: var(--paper); font-weight: 700; font-style: normal; }
.mu.o { background: transparent; border: 1px solid currentColor; line-height: 12px; }
.mu-禄 { background: var(--zw-lu); } .mu-权 { background: var(--zw-quan); } .mu-科 { background: var(--zw-ke); } .mu-忌 { background: var(--zw-ji); }
.mu.o.mu-禄 { color: var(--zw-lu); background: transparent; } .mu.o.mu-权 { color: var(--zw-quan); background: transparent; }
.mu.o.mu-科 { color: var(--zw-ke); background: transparent; } .mu.o.mu-忌 { color: var(--zw-ji); background: transparent; }
.zi { font-size: 11px; line-height: 12px; font-weight: 700; font-style: normal; }
.c-禄 { color: var(--zw-lu); } .c-权 { color: var(--zw-quan); } .c-科 { color: var(--zw-ke); } .c-忌 { color: var(--zw-ji); }

.zw-ages { font-size: 9.5px; color: var(--ink-dim); line-height: 1.35; font-variant-numeric: tabular-nums; margin-top: auto; overflow-wrap: anywhere; }
.zw-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 4px; align-items: end; font-size: 10px; color: var(--ink-muted); }
.gods { line-height: 1.3; }
.mid { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.range { font-variant-numeric: tabular-nums; color: var(--ink); font-size: 11px; }
.pname { font-size: 14px; color: var(--gold); font-weight: 700; white-space: nowrap; }
.right { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.cs { font-size: 10px; color: var(--ink-muted); }
.gz { font-size: 14px; font-weight: 700; color: var(--ink); }
.tag { font-size: 10px; padding: 0 3px; border-radius: 3px; line-height: 15px; white-space: nowrap; }
.tag.body { background: var(--gold); color: var(--paper); }
.tag.pp { border: 1px solid var(--zw-period); color: var(--zw-period); }

.zw-center { grid-column: 2 / 4; grid-row: 2 / 4; border: 1px solid var(--line); padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: var(--ink-muted); min-width: 0; }
.zw-center h3 { margin: 0; font-size: 18px; color: var(--ink); font-weight: 600; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.zw-center h3 small { font-size: 13px; color: var(--ink-muted); font-weight: 500; }
.zw-center dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0; }
.zw-center dt { color: var(--ink-dim); }
.zw-center dd { margin: 0; color: var(--ink); min-width: 0; }
.zw-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.zw-pillars { display: grid; grid-template-columns: auto repeat(4, minmax(0, 1fr)); gap: 0 6px; align-items: center; }
.zw-pillars .lab { color: var(--ink-dim); grid-row: span 2; }
.zw-pillars b { font-size: 19px; text-align: center; font-weight: 700; line-height: 1.25; font-family: var(--font-ganzhi, var(--font-serif)); }
.zw-decades { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 0 2px; text-align: center; font-size: 12px; color: var(--ink); line-height: 1.35; font-variant-numeric: tabular-nums; }
.zw-decades small { font-size: 9.5px; color: var(--ink-dim); }
.zw-warn { margin: 0; font-size: 11px; color: var(--zw-period); }
.wx-jin { color: #9a7a1a; } .wx-mu { color: #2e7d32; } .wx-shui { color: #1565c0; } .wx-huo { color: #c62828; } .wx-tu { color: #7b5e00; }
[data-theme="dark"] .wx-jin { color: #e8cc80; } [data-theme="dark"] .wx-mu { color: #6fcf7a; } [data-theme="dark"] .wx-shui { color: #6aa8f0; }
[data-theme="dark"] .wx-huo { color: #ff7b6b; } [data-theme="dark"] .wx-tu { color: #d9b45a; }

.zw-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.zw-lines .tri { stroke: var(--gold); stroke-width: 1.2; stroke-dasharray: 4 3; opacity: .45; fill: none; }
.zw-lines .fly { stroke-width: 1.6; fill: none; }
.zw-lines text { font-size: 12px; font-weight: 700; font-family: var(--font-serif); }
.s-禄 { stroke: var(--zw-lu); fill: var(--zw-lu); } .s-权 { stroke: var(--zw-quan); fill: var(--zw-quan); }
.s-科 { stroke: var(--zw-ke); fill: var(--zw-ke); } .s-忌 { stroke: var(--zw-ji); fill: var(--zw-ji); }
.s-禄 text, .s-权 text, .s-科 text, .s-忌 text { stroke: none; }
.f-禄 { fill: var(--zw-lu); } .f-权 { fill: var(--zw-quan); } .f-科 { fill: var(--zw-ke); } .f-忌 { fill: var(--zw-ji); }

.zw-strips { display: grid; border: 1px solid var(--line); border-radius: 12px; background: var(--zw-card); overflow: hidden; }
.strip { display: grid; grid-template-columns: 52px minmax(0, 1fr); border-top: 1px solid var(--line); }
.strip:first-child { border-top: 0; }
.strip .lab { display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; background: var(--paper-soft); color: var(--ink); }
.strip .cells { display: flex; overflow-x: auto; scrollbar-width: thin; }
.cell { flex: 0 0 auto; min-width: 62px; padding: 7px 6px; border: 0; border-right: 1px solid var(--line); background: none; cursor: pointer; text-align: center; font: inherit; font-size: 12px; line-height: 1.45; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
.cell b { display: block; font-size: 14px; color: var(--ink); font-weight: 600; }
.cell[aria-pressed="true"] { background: var(--gold); color: var(--paper); }
.cell[aria-pressed="true"] b { color: var(--paper); }
.cell.now:not([aria-pressed="true"]) { box-shadow: inset 0 -2px 0 var(--gold); }
.cell:disabled { opacity: .4; cursor: default; }

.zw-detail { border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: grid; gap: 9px; background: var(--zw-card); }
.zw-detail h4 { margin: 0; font-size: 18px; color: var(--gold); font-weight: 600; }
.zw-detail .row { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 10px; font-size: 14px; line-height: 1.65; color: var(--ink); }
.zw-detail .row > span:first-child { color: var(--ink-dim); font-size: 13px; }
.zw-detail .dim { color: var(--ink-dim); }
.zw-note { margin: 0; font-size: 12px; color: var(--ink-dim); line-height: 1.7; }

@media (max-width: 560px) {
  .zw-board { grid-template-rows: repeat(4, minmax(168px, auto)); }
  .st.major .nm { font-size: 13px; }
  .st.minor .nm { font-size: 12px; }
  .st.adj, .zw-ages .xl, .gods { display: none; }
  .pname, .gz { font-size: 12px; }
  .zw-center { padding: 8px; font-size: 11px; gap: 5px; }
  .zw-center h3 { font-size: 15px; }
  .zw-pillars b { font-size: 15px; }
  .zw-decades { font-size: 10.5px; }
  .strip { grid-template-columns: 40px minmax(0, 1fr); }
  .strip .lab { font-size: 13px; }
  .cell { min-width: 54px; }
}
@media (prefers-reduced-motion: reduce) { .zw-palace { transition: none; } }
</style>
