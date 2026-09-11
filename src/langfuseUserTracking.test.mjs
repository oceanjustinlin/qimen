import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8')
const langfuseSource = readFileSync(new URL('../worker/src/langfuse.mjs', import.meta.url), 'utf8')
const wranglerConfig = readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8')

test('Langfuse uses the v5 observations-first SDK and no legacy ingestion events', () => {
  assert.match(source, /import \{ langfuseTelemetry \} from '\.\/langfuse\.mjs'/)
  assert.match(source, /langfuseTelemetry\.startGeneration\(/)
  assert.doesNotMatch(source, /\/api\/public\/ingestion/)
  assert.doesNotMatch(source, /trace-create|generation-create/)
})

test('authenticated and guest AI flows pass their stable user ID to Langfuse', () => {
  assert.match(source, /bazi-question-answer'[\s\S]{0,320}userId: user\.id/)
  assert.match(source, /fortune-daily-interpretation'[\s\S]{0,180}userId: user\.id/)
  assert.match(source, /bazi-profile-sections'[\s\S]{0,180}userId: user\.id/)
  assert.match(source, /qimen-answer'[\s\S]{0,360}userId: userId \|\| guestId/)
  assert.match(source, /qimen-followup-patch'[\s\S]{0,240}userId: userId \|\| guestId/)
})

test('follow-up generation calls propagate a stable Langfuse session ID', () => {
  assert.match(source, /qimen-followup-classify'[\s\S]{0,240}sessionId: recordId \|\| requestId/)
  assert.match(source, /qimen-followup-patch'[\s\S]{0,280}sessionId: recordId \|\| requestId/)
  assert.match(source, /bazi-followup-decide'[\s\S]{0,280}sessionId: profileId/)
})

test('Langfuse v5 distinguishes production from preview', () => {
  assert.match(langfuseSource, /LANGFUSE_TRACING_ENVIRONMENT/)
  assert.match(wranglerConfig, /\[vars\][\s\S]*LANGFUSE_TRACING_ENVIRONMENT = "production"/)
  assert.match(wranglerConfig, /\[env\.preview\.vars\][\s\S]*LANGFUSE_TRACING_ENVIRONMENT = "preview"/)
})

test('all instrumented LLM wrappers close failed observations', () => {
  assert.equal(source.match(/langfuse\.fail\(error\)/g)?.length, 5)
})
