<script setup>
/**
 * 问事起局动画 —— canvas 式盘（罗盘）
 * - 外圈：周天刻度 + 十二地支，缓慢顺转
 * - 中圈：奇门为八门转盘，八字为十天干；每出一条进度逆转一格「咔」地定位，顶部指针读当前一格
 * - 内盘：奇门为洛书九宫，光点按 1→9 飞宫顺序走；八字为五行相生相克图，光点沿相生一圈走
 * - 发丝线 + 宋体字，浅色纸白墨线、深色玄夜鎏金，强调色跟随 tone（吉凶 / 喜用五行）
 * - 中间产物反馈：父级每出一条状态调 pulse()，转盘进一格并荡开一圈涟漪
 * - 定格：父级 .settling 把本 canvas 淡出，由 .wo-final 色盘 bloom 接管
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  tone: { type: String, default: '' },          // wo-tone-xxx（空=鎏金）
  active: { type: Boolean, default: true },      // 不可见时停 RAF
  variant: { type: String, default: 'qimen' },   // qimen | bazi
  shakeType: { type: String, default: '' },      // 兼容旧参数，不再使用
})

// 强调色：d 深底 / l 浅底
const GOLD = { d: '#e3c170', l: '#a8843a' }
const RED = { d: '#e07a6c', l: '#b0463c' }
const ACCENTS = {
  '': GOLD,
  'wo-tone-gold': GOLD,
  'wo-tone-earth': GOLD,
  'wo-tone-teal': { d: '#5cc0ae', l: '#1f7f72' },
  'wo-tone-warn': RED,
  'wo-tone-fire': RED,
  'wo-tone-wood': { d: '#5cc596', l: '#2c8a60' },
  'wo-tone-metal': { d: '#d8cba4', l: '#8a7c56' },
  'wo-tone-water': { d: '#74a8de', l: '#3f6fae' },
}
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const BAMEN = ['休', '生', '伤', '杜', '景', '死', '惊', '开']
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
// 洛书九宫：行列位置上的数；飞宫顺序即 1→9
const LUOSHU = [4, 9, 2, 3, 5, 7, 8, 1, 6]
const LUOSHU_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
// 五行按相生顺序顺时针排，火在上
const WUXING = ['火', '土', '金', '水', '木']
const WX_VAR = { 火: '--wx-huo', 土: '--wx-tu', 金: '--wx-jin', 水: '--wx-shui', 木: '--wx-mu' }
const SERIF = '"Noto Serif SC","Songti SC","STSong","SimSun",serif'
const TAU = Math.PI * 2
const TOP = -Math.PI / 2

const canvasEl = ref(null)
let ctx = null, raf = 0
let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, Ro = 0
let dark = true
let wxColors = {}
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeOut = p => 1 - Math.pow(1 - clamp01(p), 3)
const smooth = p => { p = clamp01(p); return p * p * (3 - 2 * p) }

// ---- 颜色 ----
let accent = hexToRgb(GOLD.d), accentTo = accent
const lineRGB = () => (dark ? '232,207,148' : '34,27,14')
const textRGB = () => (dark ? '240,229,200' : '24,19,10')
const rgba = (rgb, a) => `rgba(${rgb},${a < 0 ? 0 : a > 1 ? 1 : a})`
const acc = a => rgba(`${accent[0] | 0},${accent[1] | 0},${accent[2] | 0}`, a)
function syncAccent(jump) {
  accentTo = hexToRgb((ACCENTS[props.tone] || GOLD)[dark ? 'd' : 'l'])
  if (jump) accent = accentTo.slice()
}
function syncTheme() {
  dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const cs = getComputedStyle(document.documentElement)
  wxColors = {}
  for (const k of WUXING) wxColors[k] = cs.getPropertyValue(WX_VAR[k]).trim() || ''
  syncAccent(true)
}

// ---- 状态 ----
let t = 0, t0 = 0
let outerAng = 0
let midAng = 0, midTarget = 0, sinceStep = 0
let ripples = []
let flash = 0
const midCount = () => (props.variant === 'bazi' ? 10 : 8)

function stepDial() {
  midTarget -= TAU / midCount()
  sinceStep = 0
}
function pulse() {
  stepDial()
  ripples.push(0)
  if (ripples.length > 3) ripples.shift()
  flash = 1
}
defineExpose({ pulse })

// ---- 画件 ----
function sweepCircle(r, alpha, p, width) {
  if (p <= 0) return
  ctx.lineWidth = width || 1
  ctx.strokeStyle = rgba(lineRGB(), alpha)
  ctx.beginPath(); ctx.arc(cx, cy, r, TOP, TOP + TAU * p); ctx.stroke()
}
// 沿环排字：字头朝外
function ringText(chars, r, base, size, weight, colorAt) {
  ctx.font = `${weight} ${Math.round(size)}px ${SERIF}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const n = chars.length
  for (let i = 0; i < n; i++) {
    const a = base + i / n * TAU
    ctx.save()
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillStyle = colorAt(i, a)
    ctx.fillText(chars[i], 0, 0)
    ctx.restore()
  }
}
// 角度到顶部指针的距离（0~π）
const distTop = a => { let d = (a - TOP) % TAU; if (d < 0) d += TAU; return d > Math.PI ? TAU - d : d }

function drawOuter(intro, textA) {
  const r1 = Ro, r2 = Ro * 0.76
  sweepCircle(r1, 0.42, intro, 1)
  sweepCircle(r2, 0.3, easeOut((t - 0.12) / 0.9), 1)
  // 周天六十刻度
  ctx.lineWidth = 1
  for (let i = 0; i < 60; i++) {
    const a = outerAng + i / 60 * TAU
    const major = i % 5 === 0
    const len = major ? Ro * 0.06 : Ro * 0.032
    const c = Math.cos(a), s = Math.sin(a)
    ctx.strokeStyle = rgba(lineRGB(), (major ? 0.5 : 0.24) * textA)
    ctx.beginPath(); ctx.moveTo(cx + c * r1, cy + s * r1); ctx.lineTo(cx + c * (r1 - len), cy + s * (r1 - len)); ctx.stroke()
  }
  // 十二地支：字在两条大刻度之间
  ringText(DIZHI, Ro * 0.865, outerAng + TAU / 24, Ro * 0.092, 500, () => rgba(textRGB(), 0.62 * textA))
}

function drawMid(textA) {
  const n = midCount(), seg = TAU / n
  const r2 = Ro * 0.76, r3 = Ro * 0.53
  // 顶部读数窗：固定不转
  ctx.fillStyle = acc((dark ? 0.16 : 0.13) * textA + flash * 0.1)
  ctx.beginPath(); ctx.arc(cx, cy, r2, TOP - seg / 2, TOP + seg / 2); ctx.arc(cx, cy, r3, TOP + seg / 2, TOP - seg / 2, true); ctx.closePath(); ctx.fill()
  // 分格线
  ctx.lineWidth = 1
  for (let i = 0; i < n; i++) {
    const a = midAng + (i + 0.5) * seg + TOP
    const c = Math.cos(a), s = Math.sin(a)
    ctx.strokeStyle = rgba(lineRGB(), 0.26 * textA)
    ctx.beginPath(); ctx.moveTo(cx + c * r3, cy + s * r3); ctx.lineTo(cx + c * r2, cy + s * r2); ctx.stroke()
  }
  const chars = props.variant === 'bazi' ? TIANGAN : BAMEN
  ringText(chars, (r2 + r3) / 2, midAng + TOP, Ro * (n === 10 ? 0.105 : 0.118), 700, (i, a) => {
    const k = 1 - smooth(distTop(a) / (seg * 0.7))   // 靠近指针的一格转强调色
    return k > 0.02 ? acc((0.55 + 0.45 * k) * textA) : rgba(textRGB(), 0.78 * textA)
  })
  // 指针：顶上的小三角
  const py = cy - Ro - Ro * 0.045, pw = Ro * 0.04
  ctx.fillStyle = acc(0.95 * textA)
  ctx.beginPath(); ctx.moveTo(cx, py + pw * 1.5); ctx.lineTo(cx - pw, py); ctx.lineTo(cx + pw, py); ctx.closePath(); ctx.fill()
}

// 光点走格：第 k 个节点（共 n 个）在 phase 时刻的亮度，刚到最亮、随后拖尾衰减
function nodeGlow(k, n, phase) {
  let age = (phase - k) % n; if (age < 0) age += n
  return smooth(age / 0.3) * Math.exp(-age * 0.85)
}

function drawJiugong(textA) {
  const r3 = Ro * 0.53
  sweepCircle(r3, 0.36, easeOut((t - 0.24) / 0.9), 1)
  const side = r3 * 1.26, cell = side / 3, x0 = cx - side / 2, y0 = cy - side / 2
  const phase = t / (reduce ? 1.2 : 0.46)
  const center = n => { const i = LUOSHU.indexOf(n); return [x0 + (i % 3 + 0.5) * cell, y0 + ((i / 3 | 0) + 0.5) * cell] }
  // 格内亮度
  for (let n = 1; n <= 9; n++) {
    const g = nodeGlow(n - 1, 9, phase)
    if (g < 0.02) continue
    const i = LUOSHU.indexOf(n)
    ctx.fillStyle = acc((dark ? 0.3 : 0.24) * g * textA)
    ctx.fillRect(x0 + (i % 3) * cell + 0.5, y0 + (i / 3 | 0) * cell + 0.5, cell - 1, cell - 1)
  }
  // 九宫格线
  ctx.lineWidth = 1
  ctx.strokeStyle = rgba(lineRGB(), 0.34 * textA)
  ctx.strokeRect(x0, y0, side, side)
  ctx.beginPath()
  for (let k = 1; k < 3; k++) {
    ctx.moveTo(x0 + k * cell, y0); ctx.lineTo(x0 + k * cell, y0 + side)
    ctx.moveTo(x0, y0 + k * cell); ctx.lineTo(x0 + side, y0 + k * cell)
  }
  ctx.stroke()
  // 飞宫轨迹：最近走过的几段
  const head = Math.floor(phase), frac = phase - head
  ctx.lineWidth = 1.2; ctx.lineCap = 'round'
  for (let back = 0; back < 2; back++) {
    const from = ((head - back) % 9 + 9) % 9 + 1, to = from % 9 + 1
    if (to === 1) continue                      // 九回一不连线，另起一轮
    const [ax, ay] = center(from), [bx, by] = center(to)
    const p = back === 0 ? easeOut(frac / 0.8) : 1
    ctx.strokeStyle = acc((back === 0 ? 0.8 : 0.8 * (1 - smooth(frac / 0.9))) * textA)
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p); ctx.stroke()
  }
  // 洛书数
  ctx.font = `600 ${Math.round(cell * 0.46)}px ${SERIF}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let n = 1; n <= 9; n++) {
    const [x, y] = center(n), g = nodeGlow(n - 1, 9, phase)
    ctx.fillStyle = g > 0.25 ? acc((0.6 + 0.4 * g) * textA) : rgba(textRGB(), (0.4 + 0.5 * g) * textA)
    ctx.fillText(LUOSHU_CN[n], x, y + 0.5)
  }
}

function drawWuxing(textA) {
  const r3 = Ro * 0.53, rn = r3 * 0.62
  sweepCircle(r3, 0.36, easeOut((t - 0.24) / 0.9), 1)
  const phase = t / (reduce ? 1.6 : 0.62)
  const pt = i => { const a = TOP + i / 5 * TAU; return [cx + Math.cos(a) * rn, cy + Math.sin(a) * rn] }
  // 相克：五角星
  ctx.lineWidth = 1
  ctx.strokeStyle = rgba(lineRGB(), 0.2 * textA)
  ctx.beginPath()
  for (let i = 0; i < 5; i++) { const [ax, ay] = pt(i), [bx, by] = pt((i + 2) % 5); ctx.moveTo(ax, ay); ctx.lineTo(bx, by) }
  ctx.stroke()
  // 相生：外圆
  ctx.strokeStyle = rgba(lineRGB(), 0.3 * textA)
  ctx.beginPath(); ctx.arc(cx, cy, rn, 0, TAU); ctx.stroke()
  // 相生光弧：从刚走过的一行到下一行
  const head = Math.floor(phase), frac = phase - head
  const a0 = TOP + (head % 5) / 5 * TAU
  ctx.lineWidth = 1.6; ctx.lineCap = 'round'
  ctx.strokeStyle = acc(0.8 * textA)
  ctx.beginPath(); ctx.arc(cx, cy, rn, a0, a0 + TAU / 5 * easeOut(frac / 0.8)); ctx.stroke()
  // 五行节点
  const nr = r3 * 0.2
  ctx.font = `700 ${Math.round(nr * 1.08)}px ${SERIF}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < 5; i++) {
    const [x, y] = pt(i), g = nodeGlow(i, 5, phase)
    ctx.fillStyle = dark ? 'rgba(10,10,18,.92)' : 'rgba(247,244,238,.94)'
    ctx.beginPath(); ctx.arc(x, y, nr, 0, TAU); ctx.fill()
    if (g > 0.02) { ctx.fillStyle = acc((dark ? 0.3 : 0.22) * g * textA); ctx.fill() }
    ctx.lineWidth = 1
    ctx.strokeStyle = g > 0.2 ? acc((0.5 + 0.5 * g) * textA) : rgba(lineRGB(), 0.36 * textA)
    ctx.stroke()
    ctx.globalAlpha = (0.72 + 0.28 * g) * textA
    ctx.fillStyle = wxColors[WUXING[i]] || rgba(textRGB(), 1)
    ctx.fillText(WUXING[i], x, y + 0.5)
    ctx.globalAlpha = 1
  }
}

// ---- 主循环 ----
function frame(now) {
  if (!t0) t0 = now
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now
  t += dt

  // 强调色渐变
  const k = 1 - Math.exp(-dt * 5)
  for (let i = 0; i < 3; i++) accent[i] += (accentTo[i] - accent[i]) * k

  outerAng += dt * (reduce ? 0.02 : 0.055)
  sinceStep += dt
  if (!reduce && sinceStep > 2.6) stepDial()        // 没有新进度时也每隔一会儿自己走一格
  midAng += (midTarget - midAng) * (1 - Math.exp(-dt * 9))
  flash *= Math.exp(-dt * 3.2)

  const intro = easeOut(t / 0.9)
  const textA = smooth((t - 0.25) / 0.7)

  ctx.clearRect(0, 0, W, H)

  // 底光
  const glow = ctx.createRadialGradient(cx, cy, Ro * 0.2, cx, cy, Ro * 1.45)
  glow.addColorStop(0, acc((dark ? 0.13 : 0.07) * intro + flash * 0.06))
  glow.addColorStop(1, acc(0))
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

  // 涟漪
  ctx.lineWidth = 1.2
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i] += dt / 1.15
    const p = ripples[i]
    if (p >= 1) { ripples.splice(i, 1); continue }
    ctx.strokeStyle = acc(0.55 * (1 - p) * (1 - p))
    ctx.beginPath(); ctx.arc(cx, cy, Ro * (0.53 + 0.66 * easeOut(p)), 0, TAU); ctx.stroke()
  }

  drawOuter(intro, textA)
  drawMid(textA)
  if (props.variant === 'bazi') drawWuxing(textA); else drawJiugong(textA)

  raf = requestAnimationFrame(frame)
}

// ---- 尺寸 / 生命周期 ----
function resize() {
  const el = canvasEl.value; if (!el) return
  DPR = Math.min(window.devicePixelRatio || 1, 3)
  W = el.clientWidth; H = el.clientHeight
  if (!W || !H) return
  el.width = W * DPR; el.height = H * DPR
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  Ro = Math.min(W, H) * 0.34
  cx = W / 2; cy = H / 2 - Ro * 0.11         // 略上移，给底部状态文字让位
}
function reset() { t = 0; t0 = 0; outerAng = 0; midAng = midTarget = 0; sinceStep = 0; ripples = []; flash = 0; syncAccent(true) }
function start() { if (!raf) { reset(); raf = requestAnimationFrame(frame) } }
function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0 } }
function resume() { if (!raf) { t0 = 0; raf = requestAnimationFrame(frame) } }

let ro = null, mo = null
function onVis() { if (document.hidden) stop(); else if (props.active) resume() }

watch(() => props.tone, () => syncAccent(false))
watch(() => props.variant, () => { midAng = midTarget = 0 })
watch(() => props.active, a => { a ? start() : stop() })

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  syncTheme(); resize()
  ro = new ResizeObserver(resize); ro.observe(canvasEl.value)
  mo = new MutationObserver(syncTheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  document.addEventListener('visibilitychange', onVis)
  if (props.active) start()
})
onBeforeUnmount(() => {
  stop()
  ro && ro.disconnect(); mo && mo.disconnect()
  document.removeEventListener('visibilitychange', onVis)
})
</script>

<template>
  <canvas ref="canvasEl" class="wenshi-orb-canvas"></canvas>
</template>

<style scoped>
.wenshi-orb-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}
</style>
