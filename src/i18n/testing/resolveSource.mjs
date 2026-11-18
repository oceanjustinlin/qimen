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
    // 模板字符串 ${t('x')} / ${i18n.t('x')}
    .replace(/\$\{\s*(?:i18n\.)?t\('([\w.]+)'\)\s*\}/g, (m, key) => (typeof get(key) === 'string' ? get(key) : m))
}
