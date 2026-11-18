// i18n T3.6：英文提问路由评测（真实模型，手工运行）。
// 用法：GEMINI_API_KEY=... node eval/i18n-en/run-route.mjs
//       或 LLM_API_URL=https://api.deepseek.com/v1/chat/completions EVAL_MODEL=deepseek-chat GEMINI_API_KEY=<key> ...
// 走生产同一条路径：classifyDivinationQuestion（纯英文问题必调一次快模型）+ buildLlmRoutePrompt。
import { createRequire } from 'node:module'
import { callLLM, parseJsonLoose, LLM_AVAILABLE, EVAL_MODEL } from '../bazi-skill/llm.mjs'

const require = createRequire(import.meta.url)
const { classifyDivinationQuestion, buildLlmRoutePrompt } = require('../../lib/divinationRouter.js')
const { CASES } = require('./route-cases.js')

if (!LLM_AVAILABLE) {
  console.error('缺少 GEMINI_API_KEY（OpenAI 兼容 key），无法跑真实模型评测。')
  process.exit(1)
}

let llmCalls = 0
const rows = []
for (const c of CASES) {
  const route = await classifyDivinationQuestion({
    question: c.question,
    llmClassifier: async (q, rule) => { llmCalls += 1; return parseJsonLoose(await callLLM(buildLlmRoutePrompt(q, rule))) },
  })
  const branchOk = route.branch === c.expected.branch
  const categoryOk = route.category === c.expected.category
  rows.push({ id: c.id, question: c.question, expected: c.expected, got: { branch: route.branch, category: route.category, source: route.source }, branchOk, categoryOk })
  console.log(`${branchOk && categoryOk ? '✓' : '✗'} ${c.id} ${route.branch}/${route.category}  (期望 ${c.expected.branch}/${c.expected.category})`)
}

const pct = (n) => `${((n / rows.length) * 100).toFixed(1)}%`
const branchAcc = rows.filter((r) => r.branchOk).length
const catAcc = rows.filter((r) => r.categoryOk).length
console.log(`\n模型 ${EVAL_MODEL}｜branch ${pct(branchAcc)}（门槛 85%）｜category ${pct(catAcc)}（门槛 80%）｜分类调用 ${llmCalls}/${rows.length}`)
console.log('\n失败样例：')
for (const r of rows.filter((x) => !x.branchOk || !x.categoryOk)) console.log(JSON.stringify(r))
process.exitCode = branchAcc / rows.length >= 0.85 && catAcc / rows.length >= 0.8 ? 0 : 1
