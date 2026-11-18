// 紫微盘的显示适配器（i18n spec T2.6）。iztro 始终以 zh-CN 计算；这里只换显示。
// 盘面格子保持汉字；详情区在英文下显示 `English (汉字)`。
// 英文名用通行拼音写法（与 lib/i18n/glossary.js 的干支、星名风格一致），四化用 Lu / Quan / Ke / Ji。

// i18n-ignore-start
const STAR = {
  紫微: 'Zi Wei', 天机: 'Tian Ji', 太阳: 'Tai Yang', 武曲: 'Wu Qu', 天同: 'Tian Tong', 廉贞: 'Lian Zhen', 天府: 'Tian Fu',
  太阴: 'Tai Yin', 贪狼: 'Tan Lang', 巨门: 'Ju Men', 天相: 'Tian Xiang', 天梁: 'Tian Liang', 七杀: 'Qi Sha', 破军: 'Po Jun',
  左辅: 'Zuo Fu', 右弼: 'You Bi', 文昌: 'Wen Chang', 文曲: 'Wen Qu', 禄存: 'Lu Cun', 天马: 'Tian Ma', 擎羊: 'Qing Yang',
  陀罗: 'Tuo Luo', 火星: 'Huo Xing', 铃星: 'Ling Xing', 地空: 'Di Kong', 地劫: 'Di Jie', 天魁: 'Tian Kui', 天钺: 'Tian Yue',
}
const PALACE = {
  命宫: 'Life', 兄弟宫: 'Siblings', 夫妻宫: 'Spouse', 子女宫: 'Children', 财帛宫: 'Wealth', 疾厄宫: 'Health',
  迁移宫: 'Travel', 仆役宫: 'Friends', 交友宫: 'Friends', 官禄宫: 'Career', 田宅宫: 'Property', 福德宫: 'Fortune', 父母宫: 'Parents',
}
const MUTAGEN = { 禄: 'Lu', 权: 'Quan', 科: 'Ke', 忌: 'Ji' }
// i18n-ignore-end

export const ZIWEI_MAJOR_STARS = Object.keys(STAR).slice(0, 14)
export const ZIWEI_PALACES = Object.keys(PALACE)

const TABLES = { star: STAR, palace: PALACE, mutagen: MUTAGEN }

/** 英文：`Zi Wei (紫微)`；中文或查不到：原文。kind ∈ star | palace | mutagen */
export function ziweiLabel(zh, kind, locale) {
  if (zh === undefined || zh === null || zh === '') return ''
  const value = String(zh)
  if (locale !== 'en-US') return value
  const table = TABLES[kind] || {}
  const key = kind === 'palace' && !value.endsWith('宫') ? `${value}宫` : value // i18n-ignore
  const en = table[key]
  return en ? `${en} (${value})` : value
}
