<script setup>
/**
 * 问事能量球 —— canvas 3D 粒子星盘
 * - Fibonacci 球面分布 + 透视投影 + 加色辉光（深底）/ 正常混合（浅底）
 * - 命理/学术层：赤道环 + 周天刻度 + 十二地支标注 + 黄道斜环 + 经纬网
 * - 中间产物反馈：父级每出一条状态调 pulse() 抖一下
 * - 定格：父级 .settling 把本 canvas 淡出，由 .wo-final 色盘 bloom 接管
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  tone: { type: String, default: '' },        // wo-tone-xxx（空=默认 teal）
  active: { type: Boolean, default: true },    // 不可见时停 RAF
  shakeType: { type: String, default: 'tremor' },// pulse | tremor | shock | lurch
})

// tone → 两套 ramp（深→中→浅三段，竖向渐变用；已降饱和、亮尖端收回柔色不白爆）
// d 深底（夜·加色辉光） / l 浅底（日·正常混合，更深以在奶白上成形）
const TONES = {
  // 青金双调：底深青 → 中青玉 → 顶暖金（冷暖过渡极光，顶部金色呼应页面金调）
  '':              { d:['#1a6a62','#5cb8a6','#e8cf94'], l:['#175049','#3f9a86','#b89244'] },
  'wo-tone-teal':  { d:['#1a6a62','#5cb8a6','#e8cf94'], l:['#175049','#3f9a86','#b89244'] },
  'wo-tone-gold':  { d:['#7a5e20','#c9a64e','#f1e0ad'], l:['#6b521a','#9c7c30','#c2a256'] },
  'wo-tone-warn':  { d:['#7a2a26','#cf6358','#f0cdc4'], l:['#6e2420','#a3433a','#c25e52'] },
  'wo-tone-wood':  { d:['#1e6446','#4cbf8c','#cdeeda'], l:['#155138','#2c8a60','#5cae84'] },
  'wo-tone-fire':  { d:['#7a2a26','#cf6358','#f0cdc4'], l:['#6e2420','#a3433a','#c25e52'] },
  'wo-tone-earth': { d:['#7a5e20','#c9a64e','#f1e0ad'], l:['#6b521a','#9c7c30','#c2a256'] },
  'wo-tone-metal': { d:['#7c7150','#c2b184','#ede4cd'], l:['#6a5f3e','#928460','#bcae84'] },
  'wo-tone-water': { d:['#234e7e','#5b92cf','#cfe2f4'], l:['#1e4368','#3f6fae','#6f9cc8'] },
}
const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const RAMP_N = 24, SPRITE = 64

const canvasEl = ref(null)
let ctx = null, raf = 0
let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0
let dark = true
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---- 粒子 ----
let px, py, pz, pShade, pTwPhase, pJx, pJy, N = 0
function buildParticles() {
  N = window.innerWidth < 480 ? 1500 : 2200
  px = new Float32Array(N); py = new Float32Array(N); pz = new Float32Array(N)
  pShade = new Float32Array(N); pTwPhase = new Float32Array(N)
  pJx = new Float32Array(N); pJy = new Float32Array(N)
  const GA = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const t = GA * i
    const rr = 1 - Math.random() * 0.1
    px[i] = Math.cos(t) * r * rr; py[i] = y * rr; pz[i] = Math.sin(t) * r * rr
    pShade[i] = Math.pow(Math.random(), 1.4)
    pTwPhase[i] = Math.random() * Math.PI * 2
    const ja = Math.random() * Math.PI * 2
    pJx[i] = Math.cos(ja); pJy[i] = Math.sin(ja)
  }
}

// ---- 辉光贴图 ----
let sprites = []
const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const lerp = (a, b, t) => a + (b - a) * t
function rampColor(t) {
  const [c0, c1, c2] = (TONES[props.tone] || TONES[''])[dark ? 'd' : 'l'].map(hexToRgb)
  if (t < .5) { const k = t / .5; return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)] }
  const k = (t - .5) / .5; return [lerp(c1[0], c2[0], k), lerp(c1[1], c2[1], k), lerp(c1[2], c2[2], k)]
}
function buildSprites() {
  sprites = []
  for (let i = 0; i < RAMP_N; i++) {
    const [r, g, b] = rampColor(i / (RAMP_N - 1))
    const c = document.createElement('canvas'); c.width = c.height = SPRITE
    const g2 = c.getContext('2d')
    const grd = g2.createRadialGradient(SPRITE/2, SPRITE/2, 0, SPRITE/2, SPRITE/2, SPRITE/2)
    grd.addColorStop(0.00, `rgba(${r},${g},${b},1)`)
    grd.addColorStop(0.16, `rgba(${r},${g},${b},.85)`)
    grd.addColorStop(0.42, `rgba(${r},${g},${b},.30)`)
    grd.addColorStop(0.75, `rgba(${r},${g},${b},.06)`)
    grd.addColorStop(1.00, `rgba(${r},${g},${b},0)`)
    g2.fillStyle = grd; g2.fillRect(0, 0, SPRITE, SPRITE)
    sprites.push(c)
  }
}

// ---- 投影 + 星盘 ----
let _cosY = 1, _sinY = 0, _cosX = 1, _sinX = 0, _D = 1, _Rr = 1
function project(x, y, z) {
  x *= _Rr; y *= _Rr; z *= _Rr
  const x1 = x * _cosY - z * _sinY, z1 = x * _sinY + z * _cosY
  const y1 = y * _cosX - z1 * _sinX, z2 = y * _sinX + z1 * _cosX
  const persp = _D / (_D - z2)
  return { sx: cx + x1 * persp, sy: cy + y1 * persp, depth: (z2 + _Rr) / (2 * _Rr) }
}
const ringPt = (theta, tilt, rr) => {
  const x = Math.cos(theta) * rr, z0 = Math.sin(theta) * rr
  return [x, -z0 * Math.sin(tilt), z0 * Math.cos(tilt)]
}
const ringRGB = () => (dark ? '205,255,252' : '44,84,80')
function drawRing(tilt, rr, alphaMul) {
  const seg = 120, rgb = ringRGB(); ctx.lineWidth = 1.1
  for (let i = 0; i < seg; i++) {
    const p0 = project(...ringPt(i / seg * Math.PI * 2, tilt, rr))
    const p1 = project(...ringPt((i + 1) / seg * Math.PI * 2, tilt, rr))
    const d = (p0.depth + p1.depth) / 2
    ctx.strokeStyle = `rgba(${rgb},${Math.max(0, (0.05 + 0.32 * d)) * alphaMul})`
    ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
  }
}
function drawDial(tilt, rr) {
  const rgb = ringRGB()
  ctx.lineWidth = 1
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2
    const p0 = project(...ringPt(a, tilt, rr)), p1 = project(...ringPt(a, tilt, rr * 1.03))
    const d = (p0.depth + p1.depth) / 2
    ctx.strokeStyle = `rgba(${rgb},${Math.max(0, (0.03 + 0.18 * d))})`
    ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
  }
  ctx.font = `500 ${Math.round(R * 0.085)}px "Songti SC","STSong","SimSun",serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + i / 12 * Math.PI * 2
    const p0 = project(...ringPt(a, tilt, rr)), p1 = project(...ringPt(a, tilt, rr * 1.07))
    const d = (p0.depth + p1.depth) / 2
    ctx.lineWidth = 1.4
    ctx.strokeStyle = `rgba(${rgb},${Math.max(0, (0.08 + 0.4 * d))})`
    ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke()
    const lp = project(...ringPt(a, tilt, rr * 1.18))
    const la = Math.max(0, Math.min(0.9, 0.04 + 0.86 * lp.depth))
    if (la < 0.05) continue
    ctx.fillStyle = `rgba(${rgb},${la})`
    ctx.fillText(DIZHI[i], lp.sx, lp.sy)
  }
}
function drawGraticule() {
  const rgb = ringRGB(); ctx.lineWidth = 1
  const poly = pts => {
    for (let i = 0; i < pts.length - 1; i++) {
      const d = (pts[i].depth + pts[i + 1].depth) / 2
      ctx.strokeStyle = `rgba(${rgb},${Math.max(0, (0.02 + 0.1 * d))})`
      ctx.beginPath(); ctx.moveTo(pts[i].sx, pts[i].sy); ctx.lineTo(pts[i + 1].sx, pts[i + 1].sy); ctx.stroke()
    }
  }
  for (const phi of [-0.62, -0.32, 0, 0.32, 0.62]) {
    const y = Math.sin(phi), rr = Math.cos(phi), pts = []
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(project(Math.cos(a) * rr, y, Math.sin(a) * rr)) }
    poly(pts)
  }
  for (let m = 0; m < 6; m++) {
    const lon = m / 6 * Math.PI * 2, pts = []
    for (let i = 0; i <= 40; i++) { const b = -Math.PI / 2 + i / 40 * Math.PI, c = Math.cos(b); pts.push(project(Math.cos(lon) * c, Math.sin(b), Math.sin(lon) * c)) }
    poly(pts)
  }
}

// ---- 抖动状态机 ----
let shake = null, autoKick = 0
const SHAKE_DUR = { pulse: 0.7, tremor: 0.62, shock: 0.85, lurch: 0.9 }
function pulse(type) {
  type = type || props.shakeType
  shake = { type, t: 0, dur: SHAKE_DUR[type] || 0.7 }
  if (type === 'lurch') autoKick += 0.45
}
defineExpose({ pulse })

// ---- 主循环 ----
let angX = 0.42, autoY = 0, t0 = 0
function frame(now) {
  if (!t0) t0 = now
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now

  let pScale = 1, flash = 0, tremorA = 0, shockD = -1
  if (shake) {
    shake.t += dt / shake.dur
    if (shake.t >= 1) shake = null
    else {
      const p = shake.t
      if (shake.type === 'pulse') { const e = Math.sin(p * Math.PI); pScale = 1 + 0.11 * e; flash = 0.55 * e }
      else if (shake.type === 'tremor') { tremorA = R * 0.05 * Math.exp(-4.2 * p); flash = 0.12 * Math.exp(-4 * p) }
      else if (shake.type === 'shock') { shockD = p; flash = 0.08 }
      else if (shake.type === 'lurch') { pScale = 1 + 0.03 * Math.sin(p * Math.PI) }
    }
  }

  const spin = reduce ? 0.12 : 0.32
  autoY += dt * spin * 1.0 + autoKick; autoKick *= 0.86
  const tilt = angX + Math.sin(now * 0.0004) * 0.05
  const cosY = Math.cos(autoY), sinY = Math.sin(autoY)
  const cosX = Math.cos(tilt), sinX = Math.sin(tilt)
  const D = R * 3.2, Rr = R * pScale
  const glowBase = R * 0.08
  _cosY = cosY; _sinY = sinY; _cosX = cosX; _sinX = sinX; _D = D; _Rr = Rr

  ctx.clearRect(0, 0, W, H)
  const light = !dark
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'

  for (let i = 0; i < N; i++) {
    const x = px[i] * Rr, y = py[i] * Rr, z = pz[i] * Rr
    const x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY
    const y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX
    const persp = D / (D - z2)
    let sx = cx + x1 * persp, sy = cy + y1 * persp
    const depth = (z2 + Rr) / (2 * Rr)
    if (tremorA) { const j = tremorA * Math.sin(now * 0.05 + pTwPhase[i] * 3); sx += pJx[i] * j; sy += pJy[i] * j }
    let boost = flash
    if (shockD >= 0) { const dd = 1 - Math.min(1, Math.abs(depth - shockD) / 0.16); if (dd > 0) boost += dd * 0.9 }
    const tw = 0.82 + 0.18 * Math.sin(now * 0.003 + pTwPhase[i])
    // 颜色走竖向渐变：顶浅底深（像自上而下受光）；叠少量随机散色 + 抖动提亮
    let gpos = 0.5 - (sy - cy) / (2.0 * R)
    if (gpos < 0) gpos = 0; else if (gpos > 1) gpos = 1
    let ri = (gpos * 0.82 + pShade[i] * 0.18 + boost * 0.4) * (RAMP_N - 1) | 0
    if (ri < 0) ri = 0; else if (ri >= RAMP_N) ri = RAMP_N - 1
    const size = glowBase * (0.45 + 0.95 * persp) * (light ? 0.82 : 1) * (1 + boost * 0.4)
    ctx.globalAlpha = (light ? (0.28 + 0.54 * depth) : (0.12 + 0.66 * depth)) * tw * (1 + boost * 0.5)
    ctx.drawImage(sprites[ri], sx - size / 2, sy - size / 2, size, size)
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  drawGraticule()
  drawRing(0, 1.16, 1)
  drawDial(0, 1.16)
  drawRing(0.41, 1.16, 0.7)

  raf = requestAnimationFrame(frame)
}

// ---- 尺寸 / 生命周期 ----
function resize() {
  const el = canvasEl.value; if (!el) return
  DPR = Math.min(window.devicePixelRatio || 1, 2)
  W = el.clientWidth; H = el.clientHeight
  if (!W || !H) return
  el.width = W * DPR; el.height = H * DPR
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  cx = W / 2; cy = H / 2
  R = Math.min(W, H) * 0.28
}
function start() { if (!raf) { t0 = 0; raf = requestAnimationFrame(frame) } }
function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0 } }

let ro = null, mo = null
function syncDark() {
  const d = document.documentElement.getAttribute('data-theme') === 'dark'
  if (d !== dark) { dark = d; buildSprites() }
}
function onVis() { if (document.hidden) stop(); else if (props.active) start() }

watch(() => props.tone, buildSprites)
watch(() => props.active, a => { a ? start() : stop() })

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  dark = document.documentElement.getAttribute('data-theme') === 'dark'
  buildParticles(); buildSprites(); resize()
  ro = new ResizeObserver(resize); ro.observe(canvasEl.value)
  mo = new MutationObserver(syncDark); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
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
