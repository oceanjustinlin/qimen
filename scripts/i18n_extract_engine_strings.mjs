// i18n T4.2：从引擎常量里抽取固定句子（含汉字、长度 ≥ 4 的叶子字符串），输出来源清单。
// 用法：node scripts/i18n_extract_engine_strings.mjs [--out lib/i18n/catalog/engine-sources.json]
// 未导出的常量（如 EVENT_FORECAST）按源码编译时追加导出读取，不改原文件。
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const Module = require('node:module')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// [源文件, 常量名, 是否已导出]
export const SOURCES = [
  ['lib/baziPatternStatements.js', 'PATTERN_STATEMENT_LIBRARY', true],
  ['lib/fortuneWeeklyCore.js', 'EVENT_FORECAST', false],
  ['lib/constants/shensha.js', 'SHENS_INFOS', true],
  ['lib/constants/shensha.js', 'JIANCHU_DESC', true],
  ['lib/constants/shensha.js', 'MINGGONGS', true],
]

const CJK = /[㐀-鿿]/

function loadConstant(file, name, exported) {
  const abs = path.join(ROOT, file)
  if (exported) return require(abs)[name]
  const m = new Module(abs, null)
  m.filename = abs
  m.paths = Module._nodeModulePaths(path.dirname(abs))
  m._compile(`${readFileSync(abs, 'utf8')}\nmodule.exports.__extracted = ${name};`, abs)
  return m.exports.__extracted
}

export function leaves(value, out = []) {
  if (typeof value === 'string') {
    if (CJK.test(value) && value.length >= 4) out.push(value)
  } else if (Array.isArray(value)) value.forEach((v) => leaves(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => leaves(v, out))
  return out
}

export function extractAll() {
  const bySource = {}
  for (const [file, name, exported] of SOURCES) {
    bySource[`${file}#${name}`] = [...new Set(leaves(loadConstant(file, name, exported)))]
  }
  return bySource
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const outArg = process.argv.indexOf('--out')
  const out = outArg > 0 ? process.argv[outArg + 1] : 'lib/i18n/catalog/engine-sources.json'
  const data = extractAll()
  mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true })
  writeFileSync(path.join(ROOT, out), `${JSON.stringify(data, null, 2)}\n`)
  for (const [k, v] of Object.entries(data)) console.log(`${k}: ${v.length}`)
}
