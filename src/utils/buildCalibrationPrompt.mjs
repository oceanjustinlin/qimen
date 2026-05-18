/**
 * 组装八字定盘纠偏 Prompt
 *
 * @param {Object} profile    - bazi_profiles 完整记录
 * @param {Array}  events     - LifeEvent[]
 * @param {Object} promptData - getPromptDataFromProfile(profile) 的返回值
 * @returns {string}
 */

// 与 lib/baziCore.js 的 CALIBRATION_VERSION 保持同步
export const CALIBRATION_VERSION = '1.0.0'

export function computeEventsHash(events) {
  if (!Array.isArray(events) || events.length === 0) return 'empty'
  const stable = events
    .map(e => [e.year, e.month ?? '', e.category, e.impact, (e.description || '').trim()].join('|'))
    .sort()
    .join('\n')
  let h = 0
  for (let i = 0; i < stable.length; i++) {
    h = (Math.imul(h, 31) + stable.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

export function hasValidCalibration(profile, events) {
  if (!profile?.calibrated_yuanju_core) return false
  return profile.calibrated_version === `${CALIBRATION_VERSION}:${computeEventsHash(events)}`
}

const CATEGORY_LABEL = {
  career: '事业/学业',
  wealth: '财富/资产',
  relationship: '感情/婚姻',
  health: '健康/灾厄',
  family_parent: '父母',
  family_spouse: '配偶',
  family_child: '子女',
  family_sibling: '兄弟姐妹',
}

const IMPACT_LABEL = {
  '1': '顺遂提升',
  '0': '平稳变动',
  '-1': '坎坷挫折',
}

export function buildCalibrationPrompt(profile, events, promptData = {}) {
  if (!profile || !events?.length) return ''

  const { baziStr, gender } = promptData
  const geju = profile.geju || '待定'
  const strongWeak = profile.strong_weak || '待定'

  const favorable = Array.isArray(profile.favorable_elements)
    ? profile.favorable_elements.join('、')
    : (profile.favorable_elements || '待定')

  const unfavorable = Array.isArray(profile.unfavorable_elements)
    ? profile.unfavorable_elements.join('、')
    : (profile.unfavorable_elements || '待定')

  // 按年份倒序，带大运锚点
  const sorted = [...events].sort((a, b) => b.year - a.year)

  const eventsText = sorted.map((e, i) => {
    const monthStr = e.month ? `${e.month}月` : '（月份不详）'
    const dayunStr = e.dayun_at_time ? `，当时大运：${e.dayun_at_time}` : ''
    const catLabel = CATEGORY_LABEL[e.category] || e.category
    const impLabel = IMPACT_LABEL[String(e.impact)] || '未知'
    return (
      `${i + 1}. 流年 ${e.year}年${monthStr}${dayunStr}\n` +
      `   领域：${catLabel}\n` +
      `   性质：${impLabel}\n` +
      `   描述：${e.description}`
    )
  }).join('\n\n')

  return `你是一个精通传统子平八字命理的大师级定盘师。现在需要为命主进行【定盘与纠偏】。

【命主基础信息】
性别：${gender}
八字原局：${baziStr}
初判格局：${geju}
初判强弱：${strongWeak}
初判喜用神：${favorable}
初判忌仇神：${unfavorable}

【命主真实反馈事件】
以下是命主亲历的核心大事，请将其作为最高优先级的客观依据，反推原局真实用忌神与格局高下。
若反馈事件与初判结论冲突，请优先相信事件，修正五行喜忌（注意：可能存在化气格、从格等特殊情况）。

${eventsText}

【纠偏规则】
1. 顺遂事件集中在某五行当令的流年/大运 → 该五行很可能是真正的喜用神
2. 坎坷事件集中在某五行当令的流年/大运 → 该五行很可能是真正的忌仇神
3. 综合所有事件，识别是否存在初判未覆盖的特殊格局（从格、化气格等）

请严格输出以下 JSON，不含任何 markdown 标记或额外文字：
{
  "yuanju_core":     "仅输出基于命主反馈的原局纠偏补充，说明反馈如何修正格局与用忌神判断...",
  "current_dayun":   "仅输出基于命主反馈的当前大运纠偏补充，结合修正后的用忌神评价吉凶...",
  "current_liunian": "仅输出基于命主反馈的当前流年纠偏补充，预判今明两年运势趋势..."
}`
}
