<template>
  <div class="about-view">
    <header class="about-header">
      <router-link class="back" to="/" :aria-label="t('feedbackPage.backHome')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3 6 8l4 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ t('common.back') }}
      </router-link>
      <div class="about-title">{{ t('about.header') }}</div>
      <AccountMenu />
    </header>

    <main class="about-scroll">
      <section class="about-section hero-section">
        <div class="section-inner hero-inner">
          <div class="copy">
            <p class="eyebrow">{{ t('about.hero.eyebrow') }}</p>
            <h1>{{ t('about.hero.title') }}</h1>
            <p class="lead">{{ t('about.hero.lead') }}</p>
          </div>
          <div class="pipeline-card" :aria-label="t('about.hero.overview')">
            <div v-for="(step, i) in content.pipeline" :key="step.title" class="pipeline-step">
              <span class="step-index">{{ String(i + 1).padStart(2, '0') }}</span>
              <div>
                <strong>{{ step.title }}</strong>
                <p>{{ step.body }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="about-section">
        <div class="section-inner release-inner">
          <div class="module-copy">
            <p class="eyebrow">{{ t('about.current.eyebrow') }}</p>
            <h2>{{ t('about.current.title') }}</h2>
            <p class="lead">{{ t('about.current.lead') }}</p>
          </div>
          <div class="release-list">
            <article v-for="item in content.currentUpdates" :key="item.title" class="release-item is-current">
              <span>{{ item.tag }}</span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.body }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="about-section">
        <div class="section-inner release-inner">
          <div class="module-copy">
            <p class="eyebrow">{{ t('about.history.eyebrow') }}</p>
            <h2>{{ t('about.history.title') }}</h2>
            <p class="lead">{{ t('about.history.lead') }}</p>
          </div>
          <div class="release-list">
            <article v-for="item in content.historyUpdates" :key="item.title" class="release-item">
              <span>{{ item.tag }}</span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.body }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section v-for="module in content.modules" :key="module.title" class="about-section">
        <div class="section-inner module-inner">
          <div class="module-copy">
            <p class="eyebrow">{{ module.kicker }}</p>
            <h2>{{ module.title }}</h2>
            <p class="lead">{{ module.lead }}</p>
          </div>
          <div class="lesson-list">
            <article v-for="item in module.items" :key="item.title" class="lesson-item">
              <span>{{ item.label }}</span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.body }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="about-section">
        <div class="section-inner closing-inner">
          <p class="eyebrow">{{ t('about.closing.eyebrow') }}</p>
          <h2>{{ t('about.closing.title') }}</h2>
          <div class="promise-grid">
            <div v-for="item in content.promises" :key="item.title" class="promise-item">
              <strong>{{ item.title }}</strong>
              <p>{{ item.body }}</p>
            </div>
          </div>
          <div class="about-actions">
            <router-link class="primary-link" to="/">{{ t('about.closing.start') }}</router-link>
            <router-link class="secondary-link" to="/feedback">{{ t('feedbackPage.title') }}</router-link>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AccountMenu from '../components/AccountMenu.vue'
import aboutEn from '../i18n/content/aboutEn.mjs'

const { t, locale } = useI18n()

// 中文长文就地保存在下面（繁体由展示层转换）；英文见 i18n/content/aboutEn.mjs。
// i18n-ignore-start

const pipeline = [
  { title: '收集问题', body: '先判断用户在问奇门、八字还是综合问题，并保留原始提问。' },
  { title: '规则排盘', body: '由后端计算时间、干支、九宫、八门、八神、格局与评分。' },
  { title: '整理字段', body: '把页面需要展示的内容整理成固定字段，防止模型随意发挥。' },
  { title: '前端呈现', body: '前端只读取约定字段，按模块稳定展示总判、定基、推演和指南。' },
]

const currentUpdates = [
  {
    tag: '评测',
    title: '用神基于古籍命例评测纠偏',
    body: '新增用神 / 目标十神评测口径，用陆致极《八字命理学进阶教程》命例对照本地规则引擎，修复从儿格、调候为急、印星救主、弃官就印等关键偏差。',
  },
  {
    tag: '面板',
    title: '八字动态展示取材逻辑',
    body: '动态展示不再只等模型给结论，而是从规则算出的原局状态、岁运变化和候选年份里提取目标十神、宫位与引动机制，让页面展示和底层计算同源。',
  },
  {
    tag: '路由',
    title: '两条线判断',
    body: '八字问事先判断用户是在问当下状态、未来年份、先天结构、人物倾向还是方向选择；再判断应该看领域十神、命局喜用神，还是只给低把握的参考。',
  },
]

const historyUpdates = [
  {
    tag: '运势',
    title: '日、周、月、年四层运势',
    body: '运势页从单一日运扩展到七日曲线、流月节奏和年度岁运窗口，并保留分数依据、低谷期和可执行建议。',
  },
  {
    tag: '问事',
    title: '奇门、八字、联合推演分流',
    body: '用户自然语言提问先进入术数路由，具体事件走奇门，长期结构走八字，兼具眼前事件和命局背景时再做联合推演。',
  },
  {
    tag: '档案',
    title: '八字档案与现实断事笔记',
    body: '支持阳历、农历、四柱反查、出生地与真太阳时修正；断事笔记会进入月运详批，让解释贴近当下真实处境。',
  },
  {
    tag: '反馈',
    title: '应验反馈与审计留痕',
    body: '奇门和八字问答保留路由、规则、模型输出与后处理快照，用户回填结果后可以用于后续评分权重和提示词校准。',
  },
]

const modules = [
  {
    kicker: '第一步 · 判断问题类型',
    title: '先判断问题属于哪条推演链路',
    lead: '用户只输入一句自然语言，系统先判断它应该走奇门问事、八字问答，还是需要结合八字档案的综合模式；八字问事再用两条线判断“问哪类事”和“看哪类依据”。',
    items: [
      { label: '输入', title: '问题原文', body: '保留用户原话，作为报告里的“问题”字段，也用于后续反馈比对。' },
      { label: '路由', title: '两条线识别', body: '后端根据问题意图选择推演方式和判断依据，避免所有问题都塞进同一套提示词。' },
      { label: '上下文', title: '八字档案可选注入', body: '只有当链路需要时，才把已选档案摘要传入推演，不让出生信息污染普通奇门盘。' },
    ],
  },
  {
    kicker: '第二步 · 规则计算',
    title: '能计算的部分，不交给模型猜',
    lead: '奇门排盘、八字四柱、岁运评分都由规则引擎完成。模型拿到的是结果包，而不是让它自己编出盘面。',
    items: [
      { label: '奇门', title: '九宫排盘', body: '计算阴阳遁、局数、值符值使、九宫星门神与格局吉凶。' },
      { label: '八字', title: '命盘结构', body: '生成四柱、十神、五行旺衰、格局、喜忌与大运流年。' },
      { label: '评分', title: '可审计依据', body: '分数来自规则和字段组合，模型只能解释分数，不能重写分数。' },
    ],
  },
  {
    kicker: '第三步 · 约束解读',
    title: '大模型负责表达，但必须按字段规范输出',
    lead: '提示词会要求模型输出固定模块，例如结论先行、奇门定基、局象推演、开运指南。',
    items: [
      { label: '约束', title: '字段固定', body: '前端依赖的是标题、结论、行动建议、用神卡片、局象推演等固定字段。' },
      { label: '边界', title: '旧字段兜底', body: '历史记录可能还带旧字段，前端保留兼容读取，但新记录不再要求模型输出冗余字段。' },
      { label: '审计', title: '保留过程数据', body: '需要审计的排盘和评分流程仍然保存，只是不一定都展示给用户。' },
    ],
  },
  {
    kicker: '第四步 · 页面展示',
    title: '前端只负责把结构化结果变得可读',
    lead: '报告页面不是一篇长文，而是按用户决策顺序拆成稳定组件：先看结论，再看依据，最后看行动。',
    items: [
      { label: '总判', title: '首屏决策', body: '用结论标签、分数、总结词和背景渐变建立第一判断。' },
      { label: '展示', title: '动态展示同源', body: '动态展示从规则报告里提取目标十神、宫位和岁运引动，不让页面只复述模型段落。' },
      { label: '兼容', title: '字段兜底', body: '遇到旧报告时自动从概要、分析段落和展示块中补齐展示。' },
    ],
  },
  {
    kicker: '第五步 · 反馈闭环',
    title: '反馈会变成下一轮规则和提示词的依据',
    lead: '用户的准确度反馈、实际结果和历史记录，会帮助校准评分权重、领域规则和展示字段。',
    items: [
      { label: '记录', title: '历史推演', body: '每次推演保存问题、分类、分数、报告字段和生成时间。' },
      { label: '反馈', title: '结果回填', body: '用户可以标注准确度、方向是否正确、实际发生了什么。' },
      { label: '迭代', title: '规则修正', body: '当样本足够多，先改规则和字段规范，再收紧提示词，而不是只靠话术。' },
    ],
  },
]

const promises = [
  { title: '不是黑盒', body: '关键判断能追溯到排盘、格局、用神和评分依据。' },
  { title: '不是纯聊天', body: '大模型不直接生成盘面，而是在结构化数据上做解释。' },
  { title: '不是一次性页面', body: '历史记录、反馈和字段规范会持续推动系统迭代。' },
]
// i18n-ignore-end

const aboutZh = { pipeline, currentUpdates, historyUpdates, modules, promises }
const content = computed(() => (locale.value === 'en-US' ? aboutEn : aboutZh))
</script>

<style>
.about-view, .about-view * { box-sizing: border-box; }

.about-view {
  min-height: 100vh;
  background:
    radial-gradient(circle at 82% 14%, rgba(181,141,59,0.10), transparent 34%),
    radial-gradient(circle at 18% 88%, rgba(181,141,59,0.055), transparent 38%),
    var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
}

.about-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 220;
  height: 64px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.about-view .back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--ink-muted);
  font-size: 13px;
  text-decoration: none;
}
.about-view .back:hover { color: var(--ink); }

.about-title {
  color: var(--gold);
  font-family: 'Noto Serif SC', serif;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: .15em;
}
.about-header .account-menu-wrap { justify-self: end; }

.about-scroll {
  height: calc(100vh - 64px);
  margin-top: 64px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
}
.about-scroll::-webkit-scrollbar { display: none; }

.about-section {
  min-height: calc(100vh - 64px);
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34px 0;
}

.section-inner {
  width: min(980px, calc(100vw - 40px));
  margin: 0 auto;
}

.hero-inner,
.module-inner,
.release-inner {
  display: grid;
  grid-template-columns: minmax(0, .9fr) minmax(320px, .82fr);
  gap: 34px;
  align-items: center;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--gold);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .22em;
}

.about-view h1,
.about-view h2,
.about-view h3,
.about-view p { overflow-wrap: anywhere; }
.about-view h1 {
  margin: 0;
  max-width: 9em;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 850;
  line-height: 1.04;
}
.about-view h2 {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 800;
  line-height: 1.12;
}
.lead {
  margin: 18px 0 0;
  color: var(--ink-muted);
  font-size: 16px;
  line-height: 1.78;
}

.pipeline-card,
.lesson-list,
.release-list,
.promise-grid {
  border-top: 1px solid var(--line);
}

.pipeline-step {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 14px;
  padding: 17px 0;
  border-bottom: 1px solid var(--line);
}
.step-index {
  color: var(--gold);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
}
.pipeline-step strong,
.release-item h3,
.lesson-item h3,
.promise-item strong {
  display: block;
  margin: 0 0 6px;
  color: var(--ink);
  font-size: 16px;
  font-weight: 760;
}
.pipeline-step p,
.release-item p,
.lesson-item p,
.promise-item p {
  margin: 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.68;
}

.lesson-item {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.release-item {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.lesson-item > span {
  color: var(--gold);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
}
.release-item > span {
  width: 46px;
  height: 26px;
  display: inline-grid;
  place-items: center;
  border: 1px solid rgba(181,141,59,0.24);
  border-radius: 4px;
  color: var(--gold);
  font-size: 11px;
  font-weight: 800;
}
.release-item.is-current > span {
  border-color: rgba(4,117,111,0.28);
  color: #04756f;
  background: rgba(13,148,136,0.06);
}

.closing-inner {
  max-width: 860px;
}
.promise-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 26px;
}
.promise-item {
  padding: 18px 18px 18px 0;
  border-bottom: 1px solid var(--line);
}

.about-actions {
  display: flex;
  gap: 12px;
  margin-top: 28px;
}
.primary-link,
.secondary-link {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border-radius: 4px;
  font-size: 14px;
  text-decoration: none;
}
.primary-link {
  background: var(--ink);
  color: var(--paper);
}
.secondary-link {
  border: 1px solid var(--line);
  color: var(--ink-muted);
}

@media(max-width: 820px) {
  .about-header {
    position: fixed;
    height: 60px;
    padding: 0 16px;
  }
  .about-view .back {
    font-size: 0;
    gap: 0;
  }
  .about-title {
    font-size: 16px;
  }
  .about-scroll {
    height: calc(100svh - 60px);
    margin-top: 60px;
    scroll-snap-type: y mandatory;
  }
  .about-section {
    min-height: calc(100svh - 60px);
    scroll-snap-align: start;
    scroll-snap-stop: always;
    padding: 24px 0;
  }
  .section-inner {
    width: min(100vw - 32px, 520px);
  }
  .hero-inner,
  .module-inner,
  .release-inner {
    min-height: calc(100svh - 108px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
  }
  .about-view h1 {
    font-size: clamp(40px, 12vw, 56px);
  }
  .about-view h2 {
    font-size: clamp(30px, 9vw, 42px);
  }
  .lead {
    font-size: 15px;
    line-height: 1.72;
  }
  .pipeline-card,
  .lesson-list,
  .release-list {
    width: 100%;
  }
  .release-item {
    grid-template-columns: 52px minmax(0, 1fr);
    padding: 13px 0;
  }
  .release-item > span {
    width: 40px;
  }
  .lesson-item {
    grid-template-columns: 58px minmax(0, 1fr);
    padding: 14px 0;
  }
  .promise-grid {
    grid-template-columns: 1fr;
  }
  .about-actions {
    flex-direction: column;
  }
}
</style>
