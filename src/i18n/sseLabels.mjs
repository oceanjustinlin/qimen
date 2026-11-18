// SSE 进度 chip / tag 的显示（i18n spec T3.4）。
// 中文界面：一律显示 Worker 给的原文（与改造前逐字一致，繁体交给展示层）。
// 英文界面：有 key 且词条存在时用词条；参数名以 Key 结尾的先翻译再代入（如 bandKey → band）。
// 没有 key 的旧事件（含缓存里的旧结果）显示原文。

function resolveParams(params = {}, t, te) {
  const out = {}
  for (const [name, value] of Object.entries(params || {})) {
    if (name.endsWith('Key') && typeof value === 'string') {
      out[name.slice(0, -3)] = te(value) ? t(value) : value
    } else {
      out[name] = value
    }
  }
  return out
}

export function sseText(fallback, key, params, ctx) {
  const { t, te, locale } = ctx || {}
  const fb = fallback ?? ''
  if (locale !== 'en-US' || !key || typeof t !== 'function' || typeof te !== 'function' || !te(key)) return fb
  return t(key, resolveParams(params, t, te))
}

export function chipLabels(chip, ctx) {
  if (!chip) return { main: '', sub: '' }
  return {
    main: sseText(chip.main, chip.mainKey, chip.mainParams, ctx),
    sub: sseText(chip.sub, chip.subKey, chip.subParams, ctx),
  }
}

export function chipLine(chip, ctx) {
  const { main, sub } = chipLabels(chip, ctx)
  return `${main}${sub ? ' · ' + sub : ''}`
}

export function tagLabel(tag, ctx) {
  if (!tag) return ''
  return sseText(tag.label, tag.labelKey, tag.labelParams, ctx)
}
