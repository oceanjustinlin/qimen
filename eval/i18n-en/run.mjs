// i18n T3.7：英文输出质量评测（真实模型，手工运行）。
// 前提：本地 Worker 已带 LLM key 运行（cd worker && npx wrangler dev），英文请求走 locale=en-US。
// 用法：
//   EVAL_WORKER=http://127.0.0.1:8787 EVAL_AUTH_TOKEN=<supabase access token> EVAL_PROFILE_ID=<测试档案 id> \
//     node eval/i18n-en/run.mjs [--only q01,b02]
// 奇门用例可不带 token（走访客头）；八字 / 运势用例需要 token 与档案。结果打印并写 eval/i18n-en/last-run.json，
// 汇总写进 RESULTS.md（手工粘贴，附人工对读结论）。
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { runChecks, summarize } from './checks.mjs'

const require = createRequire(import.meta.url)
const { CASES } = require('./cases.js')

const BASE = process.env.EVAL_WORKER || 'http://127.0.0.1:8787'
const TOKEN = process.env.EVAL_AUTH_TOKEN || ''
const PROFILE = process.env.EVAL_PROFILE_ID || ''
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)

const headers = () => ({
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : { 'x-guest-id': 'guest_i18n_eval' }),
})

async function readSse(res) {
  const text = await res.text()
  const events = []
  for (const part of text.split('\n\n')) {
    const line = part.trim()
    if (line.startsWith('data: ')) { try { events.push(JSON.parse(line.slice(6))) } catch {} }
  }
  return events
}

// 取最后一次 llm_retry 之后的可见段
function sectionsFromDeltas(events) {
  const start = events.map((e) => e.type).lastIndexOf('llm_retry') + 1
  const out = {}
  for (const e of events.slice(start)) if (e.type === 'llm_delta') out[e.section] = (out[e.section] || '') + e.text
  return out
}

async function runCase(c) {
  if (c.kind === 'qimen') {
    const res = await fetch(`${BASE}/api/qimen`, { method: 'POST', headers: headers(), body: JSON.stringify({ question: c.question, panTime: c.panTime, locale: 'en-US' }) })
    const events = await readSse(res)
    const done = events.find((e) => e.type === 'complete')
    const fields = sectionsFromDeltas(events)
    delete fields.title
    return { fields, chartText: JSON.stringify(done?.result?.qimen_data || {}), structureOk: !!done && Object.keys(fields).length >= 5, result: done?.result }
  }
  if (c.kind === 'bazi_question') {
    const res = await fetch(`${BASE}/api/bazi-question`, { method: 'POST', headers: headers(), body: JSON.stringify({ question: c.question, profileId: PROFILE, locale: 'en-US' }) })
    const events = await readSse(res)
    const done = events.find((e) => e.type === 'complete')
    const fields = sectionsFromDeltas(events)
    return { fields, chartText: JSON.stringify(done?.result?.subject_snapshot || {}) + JSON.stringify(done?.result?.five_shens || {}), structureOk: !!done && Object.keys(fields).length >= 2, result: done?.result }
  }
  if (c.kind === 'bazi_profile') {
    const res = await fetch(`${BASE}/api/bazi`, { method: 'POST', headers: headers(), body: JSON.stringify({ promptData: { profileId: PROFILE }, force: true, locale: 'en-US' }) })
    const events = await readSse(res)
    const fields = {}
    for (const e of events) if (e.type === 'llm_section_done') fields[e.section] = e.text
    const engine = events.find((e) => e.type === 'engine_complete')
    return { fields, chartText: JSON.stringify(engine || {}), structureOk: Object.keys(fields).length >= 3 && !events.some((e) => e.type === 'llm_error') }
  }
  const path = c.kind === 'fortune_daily' ? '/api/fortune-daily-interpretation' : '/api/fortune-monthly-interpretation'
  const body = c.kind === 'fortune_daily'
    ? { target_date: c.target_date, profile_id: PROFILE, locale: 'en-US' }
    : { dimension: c.dimension, profile_id: PROFILE, locale: 'en-US' }
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  const fields = {}
  const walk = (v, k) => {
    if (typeof v === 'string' && v.trim().length >= 20) fields[k] = v
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${k}[${i}]`))
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, k ? `${k}.${kk}` : kk)
  }
  walk(json, '')
  return { fields, chartText: JSON.stringify(json), structureOk: res.ok && Object.keys(fields).length > 0, result: json }
}

const results = []
for (const c of CASES.filter((x) => !only.length || only.includes(x.id))) {
  try {
    const r = await runCase(c)
    const checks = runChecks({ fields: r.fields, chartText: r.chartText, zhLimits: c.zhLimits, structureOk: r.structureOk })
    results.push({ id: c.id, kind: c.kind, checks, fields: r.fields, mixed: r.result?.output_locale_actual === 'mixed' })
    const bad = Object.entries(checks).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.failures.join('; ')}`)
    console.log(`${bad.length ? '✗' : '✓'} ${c.id} ${c.kind}${bad.length ? '\n    ' + bad.join('\n    ') : ''}`)
  } catch (e) {
    console.log(`✗ ${c.id} ${c.kind} 请求失败：${e.message}`)
    const fail = { ok: false, failures: [e.message] }
    results.push({ id: c.id, kind: c.kind, checks: { structure: fail, language: fail, glossary: fail, faithfulness: fail, length: fail, banned: fail } })
  }
}

const { rate, pass } = summarize(results)
console.log('\n通过率：', Object.fromEntries(Object.entries(rate).map(([k, v]) => [k, `${(v * 100).toFixed(0)}%`])))
console.log(pass ? '自动检查达到 M3 上线门槛（还需人工对读）。' : '自动检查未达到 M3 上线门槛。')
writeFileSync(new URL('./last-run.json', import.meta.url), JSON.stringify(results, null, 2))
process.exitCode = pass ? 0 : 1
