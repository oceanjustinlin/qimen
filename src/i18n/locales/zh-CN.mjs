// 简体词条。值必须与原硬编码文字逐字相同（含全角标点、省略号）。繁体共用本文件，由展示层转繁。
import home from './zh-CN/home.mjs'
import bazi from './zh-CN/bazi.mjs'
import resetPassword from './zh-CN/resetPassword.mjs'
import feedbackPage from './zh-CN/feedbackPage.mjs'
import reports from './zh-CN/reports.mjs'
import fortune from './zh-CN/fortune.mjs'
import about from './zh-CN/about.mjs'
import legal from './zh-CN/legal.mjs'
import ziwei from './zh-CN/ziwei.mjs'
import error from './zh-CN/error.mjs'
import sse from './zh-CN/sse.mjs'
import result from './zh-CN/result.mjs'

export default {
  home,
  bazi,
  resetPassword,
  feedbackPage,
  reports,
  fortune,
  about,
  legal,
  ziwei,
  error,
  sse,
  result,
  common: {
    cancel: '取消',
    close: '关闭',
    confirm: '确认',
    save: '保存',
    loading: '加载中…',
    retry: '重试',
    back: '返回',
    all: '全部',
    none: '暂无',
    pending: '待定',
    generating: '生成中…',
  },
  brand: {
    name: '奇门道',
    tagline: '洞察天机，决胜千里',
  },
  nav: {
    ask: '问事',
    bazi: '八字',
    reports: '报告',
    fortune: '运势',
    // 旧键，保留兼容
    qimen: '奇门',
  },
  account: {
    menu: '账号菜单',
    menuTitle: '账号',
    identityGuest: '访客模式',
    identityAnonymous: '未登录',
    about: '关于',
    changePassword: '修改密码',
    signIn: '登录',
    register: '注册',
    signOut: '退出登录',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '系统',
    language: '语言',
    feedback: '反馈与共创',
  },
  seo: {
    defaultTitle: '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道',
    home: { title: '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道', description: '奇门道提供免费的奇门遁甲在线排盘、AI 解盘、八字四柱排盘与每日运势分析。输入时间、地点和所问之事，即可生成局盘、宫位、干支、评分与行动建议。' },
    bazi: { title: '八字排盘_在线四柱八字、喜用神与大运流年分析 - 奇门道', description: '奇门道提供在线八字排盘、四柱十神、喜用神、格局判断、大运流年与月度运势分析，适合建立长期命盘档案。' },
    reports: { title: '专业报告 — 奇门遁甲 AI', description: '查看您的专属八字、合盘与运势报告' },
    fortune: { title: '今日运势查询_每日/每周/月度八字运势分析 - 奇门道', description: '基于奇门遁甲规则引擎与八字命局，查询今日运势、七日走势、月度曲线和年度节奏，生成可执行的行动建议。' },
    engineering: { title: '奇门遁甲规则引擎_排盘算法与评分审计 - 奇门道', description: '查看奇门遁甲排盘算法、宫位推演、评分证据和规则引擎审计细节，了解奇门道如何先排盘再解读。' },
    feedback: { title: '反馈与共创 — 奇门遁甲 AI', description: '提交产品反馈、功能建议或内容纠错，帮助奇门遁甲 AI 持续打磨。' },
    resetPassword: { title: '重置密码 — 奇门遁甲 AI', description: '' },
    terms: { title: '服务条款 — 奇门遁甲 AI', description: '' },
    privacy: { title: '隐私政策 — 奇门遁甲 AI', description: '' },
  },
  timePicker: {
    unitYear: '年',
    unitMonth: '月',
    unitDay: '日',
    unitHour: '时',
    unitMinute: '分',
    preview: '{year}年{month}月{day}日 {hour}:{minute}',
    title: '选择起局时间 · 公历',
    inputPlaceholder: '格式 202606121416 或滚动选择',
    recognize: '识别',
    hintNeedDigits: '需 12 位数字：年(4) 月 日 时 分',
    hintOutOfRange: '日期/时间超出范围',
    hintRecognized: '已识别',
  },
  links: {
    openSource: '开源项目链接',
    viewGithub: '查看 GitHub 源码',
    githubSource: 'GitHub 源码',
    afdian: '爱发电支持',
    supportCreator: '支持创作者',
  },
  auth: {
    passwordTooShort: '新密码至少需要 6 位',
    passwordMismatch: '两次输入的密码不一致',
  },
  qimenFeedback: {
    accuracy: {
      fulfilled: '已应验',
      partially_fulfilled: '部分应验',
      not_fulfilled: '未应验',
      pending: '未到时间',
    },
    direction: {
      better: '比预测好',
      matched: '基本符合',
      worse: '比预测差',
      pending: '暂无结果',
    },
  },
  enum: {
    category: {
      career_business: '事业职场',
      finance_wealth: '求财投资',
      relationship: '婚恋感情',
      health_action: '健康疾病',
      item_transaction: '交易失物',
      exam_study: '考试学习',
      lawsuit_legal: '官司法务',
      fengshui_house: '风水家宅',
      pregnancy_birth: '孕产子嗣',
      general: '杂事',
    },
    scoreBand: {
      aboveAverage: '中上吉',
      average: '中平',
      belowAverage: '偏凶',
    },
    verdict: {
      great: '大吉',
      good: '小吉',
      neutral: '平',
      bad: '凶',
    },
    gender: {
      M: '男',
      F: '女',
      zaoM: '乾造',
      zaoF: '坤造',
    },
  },
};
