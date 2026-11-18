// 测试辅助：把组件源码里不带参数的 t('a.b') 调用替换成简体词条原文，
// 让「源码里应出现某段中文」这类旧断言在抽取词条后仍然有效（期望文字不变）。
import zhCN from '../locales/zh-CN.mjs'

function get(key) {
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), zhCN)
}

export function resolveSource(source) {
  return source
    // 模板插值 {{ t('x') }}
    .replace(/\{\{\s*t\('([\w.]+)'\)\s*\}\}/g, (m, key) => (typeof get(key) === 'string' ? get(key) : m))
    // 属性绑定 :title="t('x')" → title="原文"
    .replace(/:([\w-]+)="t\('([\w.]+)'\)"/g, (m, attr, key) => (typeof get(key) === 'string' ? `${attr}="${get(key)}"` : m))
    // 模板字符串 ${t('x')} / ${i18n.t('x')}
    .replace(/\$\{\s*(?:i18n\.)?t\('([\w.]+)'\)\s*\}/g, (m, key) => (typeof get(key) === 'string' ? get(key) : m))
    // 带参数的 t('x', {...})：原样保留调用，前面插一段注释写出原文（含 {占位符}）
    .replace(/(?<![\w.$])t\('([\w.]+)',/g, (m, key) => (typeof get(key) === 'string' ? `t(/* ${get(key)} */ '${key}',` : m))
    // 其余脚本表达式里的 t('x') → 'x 的原文'（如 return t('x')）
    .replace(/(?<![\w.$])t\('([\w.]+)'\)/g, (m, key) => (typeof get(key) === 'string' ? `'${get(key)}'` : m))
}
