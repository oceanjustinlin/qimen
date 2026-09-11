import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8')

test('bazi question worker builds and optionally inserts audit snapshot', () => {
  assert.match(source, /buildBaziSemanticRoutePrompt/)
  assert.match(source, /classifyBaziSemanticRouteWithEnv/)
  assert.match(source, /normalizeBaziSemanticRoute/)
  assert.match(source, /ruleRouteHint/)
  assert.match(source, /buildBaziAuditSnapshot/)
  assert.match(source, /bazi_question_audit/)
  assert.match(source, /insert\(auditSnapshot\)/)
  assert.match(source, /console\.warn\('\[qimen-api\] bazi audit insert failed:/)
})

test('bazi question audit uses a service-role client without the user JWT', () => {
  assert.match(
    source,
    /const auditSupabase = createSupabaseClient\(env\);\s+const \{ error: auditError \} = await auditSupabase\.from\('bazi_question_audit'\)\.insert\(auditSnapshot\)/
  )
})

test('bazi profile generation does not reuse LLM text after an engine version change', () => {
  assert.match(source, /旧 LLM 文本可能建立在已废弃规则上，必须随新版引擎重新生成/)
  assert.doesNotMatch(source, /引擎版本升级，仅更新运算数据，保留 LLM 断语/)
  assert.doesNotMatch(source, /metadata: \{ mode: 'engine_refresh', force: false \}/)
})
