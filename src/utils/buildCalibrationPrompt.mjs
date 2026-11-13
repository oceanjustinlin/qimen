/**
 * 八字定盘纠偏：事件哈希与缓存有效性判断（前端用来决定是否需要重新校准）。
 * prompt 本身已改到 Worker 端组装，见 lib/baziCalibrationPrompt.js。
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

// 纠偏 prompt 已改为 Worker 端组装：lib/baziCalibrationPrompt.js（前端只传 profileId）。
