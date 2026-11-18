<script setup>
import { ref, reactive, watch, nextTick, computed } from 'vue'
import { Solar } from 'lunar-javascript'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  open: { type: Boolean, default: false },
  // 当前生效的自定义时刻；null 表示「现在」
  initial: { type: Object, default: null }
})
const emit = defineEmits(['confirm', 'cancel'])

const ITEM_H = 40
const UNITS = ['year', 'month', 'day', 'hour', 'minute']
const { t } = useI18n()
const SUFFIX_KEYS = { year: 'timePicker.unitYear', month: 'timePicker.unitMonth', day: 'timePicker.unitDay', hour: 'timePicker.unitHour', minute: 'timePicker.unitMinute' }
const SUFFIX = computed(() => Object.fromEntries(Object.entries(SUFFIX_KEYS).map(([k, key]) => [k, t(key)])))
const KEY = { year: 'year', month: 'month', day: 'day', hour: 'hour', minute: 'minute' }

const draft = reactive(nowParts())
const numInput = ref('')
const numHint = ref('')
const numErr = ref(false)
const wheelRefs = ref({})

function nowParts() {
  const n = new Date()
  return { year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate(), hour: n.getHours(), minute: n.getMinutes() }
}
function pad(n) { return String(n).padStart(2, '0') }
function daysInMonth(y, mo) { return new Date(y, mo, 0).getDate() }
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r }

const ranges = computed(() => {
  const baseY = nowParts().year
  return {
    year: range(baseY - 80, baseY + 20),
    month: range(1, 12),
    day: range(1, daysInMonth(draft.year, draft.month)),
    hour: range(0, 23),
    minute: range(0, 59)
  }
})

// 精确干支（用 lunar-javascript，与后端同库）
const ganzhiLabel = computed(() => {
  try {
    const l = Solar.fromYmdHms(draft.year, draft.month, draft.day, draft.hour, draft.minute, 0).getLunar()
    return `${l.getDayInGanZhi()}日 ${l.getTimeZhi()}时` // i18n-ignore 干支属于盘面符号
  } catch { return '' }
})
const previewText = computed(() =>
  `${t('timePicker.preview', { year: draft.year, month: pad(draft.month), day: pad(draft.day), hour: pad(draft.hour), minute: pad(draft.minute) })}　${ganzhiLabel.value}`
)

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  const src = props.initial || nowParts()
  Object.assign(draft, src)
  numInput.value = ''
  numHint.value = ''
  numErr.value = false
  await nextTick()
  UNITS.forEach(positionWheel)
})

function positionWheel(unit) {
  const el = wheelRefs.value[unit]
  if (!el) return
  const idx = ranges.value[unit].indexOf(draft[KEY[unit]])
  el.scrollTop = Math.max(0, idx) * ITEM_H
}

const scrollTimers = {}
function onWheelScroll(unit) {
  const el = wheelRefs.value[unit]
  if (!el) return
  clearTimeout(scrollTimers[unit])
  scrollTimers[unit] = setTimeout(() => {
    const idx = Math.round(el.scrollTop / ITEM_H)
    el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
    commit(unit, idx)
  }, 90)
}
function activeIndex(unit) {
  const el = wheelRefs.value[unit]
  return el ? Math.round(el.scrollTop / ITEM_H) : -1
}
function commit(unit, idx) {
  const val = ranges.value[unit][idx]
  if (val == null) return
  draft[KEY[unit]] = val
  if (unit === 'year' || unit === 'month') {
    const maxD = daysInMonth(draft.year, draft.month)
    if (draft.day > maxD) { draft.day = maxD; nextTick(() => positionWheel('day')) }
  }
}

function applyNumInput() {
  const raw = numInput.value.replace(/\D/g, '')
  if (raw.length !== 12) { numHint.value = t('timePicker.hintNeedDigits'); numErr.value = true; return }
  const y = +raw.slice(0, 4), mo = +raw.slice(4, 6), d = +raw.slice(6, 8), h = +raw.slice(8, 10), mi = +raw.slice(10, 12)
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59) {
    numHint.value = t('timePicker.hintOutOfRange'); numErr.value = true; return
  }
  numHint.value = t('timePicker.hintRecognized'); numErr.value = false
  Object.assign(draft, { year: y, month: mo, day: d, hour: h, minute: mi })
  nextTick(() => UNITS.forEach(positionWheel))
}

function confirm() { emit('confirm', { ...draft }) }
function cancel() { emit('cancel') }
</script>

<template>
  <Transition name="sheet-fade">
    <div v-if="open" class="sheet-mask" @click.self="cancel">
      <div class="sheet">
        <div class="sheet-head">
          <button class="sheet-cancel" type="button" @click="cancel">{{ t('common.cancel') }}</button>
          <span class="sheet-title">{{ t('timePicker.title') }}</span>
          <button class="sheet-confirm" type="button" @click="confirm">{{ t('common.confirm') }}</button>
        </div>

        <div class="sel-preview">{{ previewText }}</div>

        <div class="num-input-row">
          <input v-model="numInput" inputmode="numeric" :placeholder="t('timePicker.inputPlaceholder')" @keyup.enter="applyNumInput" />
          <button type="button" @click="applyNumInput">{{ t('timePicker.recognize') }}</button>
        </div>
        <p v-if="numHint" class="num-hint" :class="{ err: numErr }">{{ numHint }}</p>

        <div class="wheels">
          <div class="wheel-center"></div>
          <div
            v-for="unit in UNITS"
            :key="unit"
            class="wheel"
            :ref="el => { if (el) wheelRefs[unit] = el }"
            @scroll="onWheelScroll(unit)"
          >
            <div class="wheel-pad"></div>
            <div
              v-for="(v, i) in ranges[unit]"
              :key="v"
              class="wheel-item"
              :class="{ active: i === activeIndex(unit) }"
            >{{ unit === 'year' ? v : pad(v) }}{{ SUFFIX[unit] }}</div>
            <div class="wheel-pad"></div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-mask {
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(0, 0, 0, .5); backdrop-filter: blur(2px);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  width: 100%; max-width: 480px;
  background: var(--bg-card); border: 1px solid var(--line); border-bottom: none;
  border-radius: 20px 20px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
}
.sheet-fade-enter-active, .sheet-fade-leave-active { transition: opacity .25s; }
.sheet-fade-enter-active .sheet, .sheet-fade-leave-active .sheet { transition: transform .28s cubic-bezier(.22, 1, .36, 1); }
.sheet-fade-enter-from, .sheet-fade-leave-to { opacity: 0; }
.sheet-fade-enter-from .sheet, .sheet-fade-leave-to .sheet { transform: translateY(100%); }

.sheet-head { display: flex; align-items: center; justify-content: space-between; }
.sheet-head button { background: none; border: none; font-size: 14px; cursor: pointer; padding: 6px 4px; }
.sheet-cancel { color: var(--text-muted); }
.sheet-confirm { color: var(--gold); font-weight: 600; }
.sheet-title { font-size: 14px; color: var(--text-main, var(--text-primary)); font-family: 'Noto Serif SC', serif; letter-spacing: 1px; }

.sel-preview { text-align: center; font-size: 13px; color: var(--gold-light); margin: 8px 0 12px; font-variant-numeric: tabular-nums; }

.num-input-row { display: flex; gap: 8px; align-items: center; }
.num-input-row input {
  flex: 1; background: rgba(127, 127, 127, .08); border: 1px solid var(--line); border-radius: 10px;
  color: var(--text-main, var(--text-primary)); font-size: 14px; padding: 10px 12px; outline: none;
  font-variant-numeric: tabular-nums; letter-spacing: 1px;
}
.num-input-row input:focus { border-color: var(--gold-border); }
.num-input-row button { background: var(--gold-dim); border: 1px solid var(--gold-border); color: var(--gold); border-radius: 10px; padding: 10px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.num-hint { font-size: 11px; color: var(--text-muted); margin: 6px 0 12px; }
.num-hint.err { color: var(--crimson, #e07a7a); }

.wheels {
  position: relative; height: 200px; display: flex; gap: 2px;
  /* 透明度渐隐，与主题色无关——亮/暗皆不脏边 */
  -webkit-mask-image: linear-gradient(transparent, #000 38%, #000 62%, transparent);
  mask-image: linear-gradient(transparent, #000 38%, #000 62%, transparent);
}
.wheel-center {
  position: absolute; left: 0; right: 0; top: 80px; height: 40px;
  border-top: 1px solid var(--gold-border); border-bottom: 1px solid var(--gold-border);
  z-index: 1; pointer-events: none;
}
.wheel { flex: 1; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; -ms-overflow-style: none; position: relative; z-index: 2; }
.wheel::-webkit-scrollbar { display: none; }
.wheel-pad { height: 80px; }
.wheel-item { height: 40px; line-height: 40px; text-align: center; font-size: 15px; color: var(--text-muted); scroll-snap-align: center; transition: color .15s, font-size .15s; font-variant-numeric: tabular-nums; }
.wheel-item.active { color: var(--gold-light); font-size: 17px; font-weight: 600; }
</style>
