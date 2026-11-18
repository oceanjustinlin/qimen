// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BaziView from '../views/BaziView.vue'
import ReportView from '../views/ReportView.vue'
import FortuneView from '../views/FortuneView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import EngineeringView from '../views/EngineeringView.vue'
import BaziStaticPanelDemo from '../views/BaziStaticPanelDemo.vue'
import BaziDynamicPanelDemo from '../views/BaziDynamicPanelDemo.vue'
import FeedbackView from '../views/FeedbackView.vue'
import LegalView from '../views/LegalView.vue'
import AdminView from '../views/AdminView.vue'
import { globalState } from '../store.js'
import enUS from '../i18n/locales/en-US.mjs'

// 路由名 → 词条 seo.* 的键
const SEO_KEYS = { home: 'home', bazi: 'bazi', reports: 'reports', fortune: 'fortune', engineering: 'engineering', feedback: 'feedback', 'reset-password': 'resetPassword', terms: 'terms', privacy: 'privacy' }

// 中文（含繁体，展示层另行转繁）沿用路由 meta 里的中文字段；英文取 en-US 词条的 seo.*。
export function resolveRouteMeta(route, locale) {
  const m = route?.meta ?? {}
  const zh = {
    title: m.seoTitle ?? m.title ?? '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道', // i18n-ignore
    description: m.seoDescription ?? m.description ?? '',
  }
  if (locale !== 'en-US') return zh
  const seo = enUS.seo[SEO_KEYS[route?.name]]
  return {
    title: seo?.title || enUS.seo.defaultTitle,
    description: seo?.description || '',
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', name: 'home', component: HomeView,
      meta: {
        seoTitle: '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道', // i18n-ignore
        seoDescription: '奇门道提供免费的奇门遁甲在线排盘、AI 解盘、八字四柱排盘与每日运势分析。输入时间、地点和所问之事，即可生成局盘、宫位、干支、评分与行动建议。', // i18n-ignore
        title: '奇门遁甲 AI 引擎 — 免费在线排盘推演', // i18n-ignore
        description: '先让规则落盘，再让模型开口。输入时间地点，实时生成奇门遁甲局盘与 AI 解读。', // i18n-ignore
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    {
      path: '/bazi', name: 'bazi', component: BaziView,
      meta: {
        seoTitle: '八字排盘_在线四柱八字、喜用神与大运流年分析 - 奇门道', // i18n-ignore
        seoDescription: '奇门道提供在线八字排盘、四柱十神、喜用神、格局判断、大运流年与月度运势分析，适合建立长期命盘档案。', // i18n-ignore
        title: '八字四柱排盘 — 奇门遁甲 AI', // i18n-ignore
        description: '专业四柱八字排盘，十神分析、格局判断、大运流年一键生成。', // i18n-ignore
        ogImage: 'https://www.qimendao.com/images/bazi_1.jpg',
      },
    },
    {
      path: '/reports', name: 'reports', component: ReportView,
      meta: {
        title: '专业报告 — 奇门遁甲 AI', // i18n-ignore
        description: '查看您的专属八字、合盘与运势报告', // i18n-ignore
      },
    },
    {
      path: '/fortune', name: 'fortune', component: FortuneView,
      meta: {
        seoTitle: '今日运势查询_每日/每周/月度八字运势分析 - 奇门道', // i18n-ignore
        seoDescription: '基于奇门遁甲规则引擎与八字命局，查询今日运势、七日走势、月度曲线和年度节奏，生成可执行的行动建议。', // i18n-ignore
        title: '今日运势 — 奇门遁甲 AI', // i18n-ignore
        description: '基于奇门遁甲规则引擎，结合八字命局，生成每日、每周、每月运势分析。', // i18n-ignore
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    {
      path: '/engineering', name: 'engineering', component: EngineeringView,
      meta: {
        seoTitle: '奇门遁甲规则引擎_排盘算法与评分审计 - 奇门道', // i18n-ignore
        seoDescription: '查看奇门遁甲排盘算法、宫位推演、评分证据和规则引擎审计细节，了解奇门道如何先排盘再解读。', // i18n-ignore
        title: '奇门工程模式 — 奇门遁甲 AI', // i18n-ignore
        description: '可视化奇门遁甲规则引擎，开放评分审计与宫位推演细节，供技术研究与验证使用。', // i18n-ignore
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    {
      path: '/bazi-static-demo', name: 'bazi-static-demo', component: BaziStaticPanelDemo,
    },
    {
      path: '/bazi-dynamic-demo', name: 'bazi-dynamic-demo', component: BaziDynamicPanelDemo,
    },
    {
      path: '/feedback', name: 'feedback', component: FeedbackView,
      meta: {
        title: '反馈与共创 — 奇门遁甲 AI', // i18n-ignore
        description: '提交产品反馈、功能建议或内容纠错，帮助奇门遁甲 AI 持续打磨。', // i18n-ignore
        ogImage: 'https://www.qimendao.com/images/home.jpg',
      },
    },
    { path: '/reset-password', name: 'reset-password', component: ResetPasswordView,
      meta: { title: '重置密码 — 奇门遁甲 AI', robots: 'noindex' } }, // i18n-ignore
    { path: '/terms', name: 'terms', component: LegalView,
      meta: { title: '服务条款 — 奇门遁甲 AI' } }, // i18n-ignore
    { path: '/privacy', name: 'privacy', component: LegalView,
      meta: { title: '隐私政策 — 奇门遁甲 AI' } }, // i18n-ignore
    {
      path: '/admin', name: 'admin', component: AdminView,
      meta: { title: '管理员总览 — 奇门遁甲 AI', robots: 'noindex' }, // i18n-ignore
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
