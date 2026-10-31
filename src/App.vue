<template>
  <div id="drawer-host" class="drawer-host"></div>

  <div class="app-container" :class="{ 'drawer-open': globalState.isDrawerOpen }">
    <div class="main-viewport">
      <canvas ref="cosmosCanvas" id="cosmosCanvas"></canvas>
      <div class="bg-radial"></div>

      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
      
      <!-- Padding block to ensure content is not hidden behind the fixed bottom nav -->
      <div v-if="isBottomNavVisible" class="nav-padding"></div>
    </div>

    <nav v-if="isBottomNavVisible" id="globalBottomNav">
      <router-link to="/" class="nav-item" active-class="active">
        <div class="nav-icon">
          <!-- 问事：八射线占卜轮（指向八方，问事起卦）-->
          <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v5M14 19v5M4 14h5M19 14h5M18 10l3-3M10 10l-3-3M18 18l3 3M10 18l-3 3M9 14a5 5 0 1 0 10 0a5 5 0 1 0-10 0"/></svg>
        </div>
        <div class="nav-label">问事</div>
      </router-link>
      <router-link to="/bazi" class="nav-item" active-class="active">
        <div class="nav-icon">
          <!-- 八字：2×4连通网格（四柱×天干地支）-->
          <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h22v14H3zM8.5 7v14M14 7v14M19.5 7v14M3 14h22"/></svg>
        </div>
        <div class="nav-label">八字</div>
      </router-link>
      <router-link to="/reports" class="nav-item" active-class="active">
        <div class="nav-icon">
          <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 23V5h9l3 3v15H8Z"/><path d="M17 5v4h4M11 14h7M11 18h5"/></svg>
        </div>
        <div class="nav-label">报告</div>
      </router-link>
      <router-link to="/fortune" class="nav-item" active-class="active">
        <div class="nav-icon">
          <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 7h14v15H7zM10 4v5M18 4v5M7 12h14"/><path d="M10 16h2M16 16h2M10 20h2"/></svg>
        </div>
        <div class="nav-label">运势</div>
      </router-link>
    </nav>

    
    <div class="viewport-overlay" :class="{ open: globalState.isDrawerOpen }" @click="globalState.isDrawerOpen = false"></div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from './lib/supabase.mjs'
import { globalState, setCurrentUser } from './store.js'
import { initTheme } from './composables/useTheme.js'

const route = useRoute()
const cosmosCanvas = ref(null)
const secondaryRoutes = new Set(['reset-password', 'feedback'])
const isBottomNavVisible = computed(() => !secondaryRoutes.has(route.name) && globalState.authReady && (globalState.currentUser || globalState.isGuest))
let animationId = null
let authSubscription = null

const initVisuals = () => {
    if(!cosmosCanvas.value) return
    const canvas = cosmosCanvas.value
    const ctx = canvas.getContext('2d')
    let W, H, stars = []
    
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    const draw = () => {
        ctx.clearRect(0,0,W,H)
        stars.forEach(s => {
            s.a += s.speed*0.008; s.x += s.drift; 
            if(s.x < 0) s.x = W; if(s.x > W) s.x = 0;
            ctx.save(); ctx.globalAlpha = ((Math.sin(s.a)+1)/2)*0.3+0.03
            ctx.fillStyle = 'rgba(181,141,59,0.6)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); ctx.restore()
        })

        // Connect nearby stars with lines
        for(let i=0; i<stars.length; i++){
            for(let j=i+1; j<stars.length; j++){
                const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y, dist = Math.sqrt(dx*dx+dy*dy)
                if(dist < 90){
                    ctx.save(); ctx.globalAlpha = (1-dist/90)*0.015; ctx.strokeStyle = 'rgba(181,141,59,0.4)'; ctx.lineWidth = .5;
                    ctx.beginPath(); ctx.moveTo(stars[i].x, stars[i].y); ctx.lineTo(stars[j].x, stars[j].y); ctx.stroke(); ctx.restore()
                }
            }
        }
        animationId = requestAnimationFrame(draw)
    }
    resize()
    stars = Array.from({length: 100}, () => ({x:Math.random()*W, y:Math.random()*H, r:Math.random()*0.9+0.2, a:Math.random(), speed:(Math.random()*0.3+0.05)*(Math.random()>.5?1:-1), drift:(Math.random()-.5)*0.1}))
    draw()
    window.addEventListener('resize', resize)
}

onMounted(() => {
    initTheme()
    initVisuals()
    supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUser(session?.user || null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user || null)
    })
    authSubscription = data?.subscription
})

onUnmounted(() => {
    if (animationId) cancelAnimationFrame(animationId)
    authSubscription?.unsubscribe()
})
</script>

<style scoped>
.drawer-host {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(82vw, 310px);
  z-index: 1;
}

.app-container {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: var(--paper, #f7f4ee);
  transform: translateX(0);
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.5s ease, box-shadow 0.5s ease;
  overflow: hidden; /* Hide anything outside the translated bounds */
}

.app-container.drawer-open {
  transform: translateX(min(82vw, 310px));
  border-radius: 24px;
  box-shadow: -10px 0 40px rgba(0,0,0,0.6);
}

.main-viewport {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.nav-padding {
  height: calc(85px + env(safe-area-inset-bottom));
}

.viewport-overlay {
  position: absolute;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.3);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
}
.viewport-overlay.open {
  opacity: 1;
  pointer-events: all;
  cursor: pointer;
}

/* 这里放底部导航的 CSS */
#globalBottomNav {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
    height: calc(65px + env(safe-area-inset-bottom));
    background: var(--chrome, #efefef);
    border-top: 1px solid var(--line);
    display: flex; justify-content: space-around; align-items: center;
    padding-bottom: env(safe-area-inset-bottom);
}
.nav-item {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
    color: var(--chrome-muted, #9a9a9a); text-decoration: none; transition: color 0.3s;
}
.nav-item.active { color: var(--ink, #0b0b0b); }
.nav-icon { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }
.nav-icon svg { width: 26px; height: 26px; stroke-width: 1.6; }
.nav-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; }

/* 丝滑的页面切换动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
