// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BaziView from '../views/BaziView.vue'
import FortuneView from '../views/FortuneView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import EngineeringView from '../views/EngineeringView.vue'
import LegalView from '../views/LegalView.vue'
import AdminView from '../views/AdminView.vue'
import { globalState } from '../store.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', name: 'home', component: HomeView,
      meta: {
        title: '奇门遁甲 AI 引擎 — 免费在线排盘推演',
        titleEn: 'Qimen Dunjia AI Engine — Free Online Divination',
        description: '先让规则落盘，再让模型开口。输入时间地点，实时生成奇门遁甲局盘与 AI 解读。',
        descriptionEn: 'Rules first, then AI interprets. Enter time and location to generate a Qimen Dunjia chart with AI analysis.',
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    {
      path: '/bazi', name: 'bazi', component: BaziView,
      meta: {
        title: '八字四柱排盘 — 奇门遁甲 AI',
        titleEn: 'Bazi Four Pillars — Qimen AI',
        description: '专业四柱八字排盘，十神分析、格局判断、大运流年一键生成。',
        descriptionEn: 'Professional Bazi four-pillars chart: ten gods, patterns, major cycles and yearly luck in one click.',
        ogImage: 'https://www.qimendao.com/images/bazi_1.jpg',
      },
    },
    {
      path: '/fortune', name: 'fortune', component: FortuneView,
      meta: {
        title: '今日运势 — 奇门遁甲 AI',
        titleEn: 'Daily Fortune — Qimen AI',
        description: '基于奇门遁甲规则引擎，结合八字命局，生成每日、每周、每月运势分析。',
        descriptionEn: 'Rule-engine powered daily, weekly and monthly fortune analysis based on Qimen Dunjia and your Bazi.',
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    {
      path: '/engineering', name: 'engineering', component: EngineeringView,
      meta: {
        title: '奇门工程模式 — 奇门遁甲 AI',
        titleEn: 'Engineering Mode — Qimen AI',
        description: '可视化奇门遁甲规则引擎，开放评分审计与宫位推演细节，供技术研究与验证使用。',
        descriptionEn: 'Visual Qimen rule engine with open scoring audit and palace details for technical research.',
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    { path: '/reset-password', name: 'reset-password', component: ResetPasswordView,
      meta: { title: '重置密码 — 奇门遁甲 AI', robots: 'noindex' } },
    { path: '/terms', name: 'terms', component: LegalView,
      meta: { title: '服务条款 — 奇门遁甲 AI' } },
    { path: '/privacy', name: 'privacy', component: LegalView,
      meta: { title: '隐私政策 — 奇门遁甲 AI' } },
    {
      path: '/admin', name: 'admin', component: AdminView,
      meta: { title: '管理员总览 — 奇门遁甲 AI', robots: 'noindex' },
    },
  ]
})

router.beforeEach((to) => {
  if (to.name === 'admin') {
    if (!globalState.authReady) return true
    if (globalState.currentUser?.app_metadata?.role !== 'admin') return { name: 'home' }
  }
  return true
})

export default router
