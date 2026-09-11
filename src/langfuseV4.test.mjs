import test from 'node:test'
import assert from 'node:assert/strict'

import { createLangfuseTelemetry } from '../worker/src/langfuse.mjs'

function createHarness() {
  const calls = {
    attributes: [],
    processorOptions: [],
    providerOptions: [],
    roots: [],
    children: [],
    flushes: 0,
    registrations: 0,
    warnings: [],
  }

  const child = {
    update(value) {
      calls.children.at(-1).updates.push(value)
      return this
    },
    end() {
      calls.children.at(-1).ended = true
      return this
    },
  }
  const root = {
    startObservation(name, input, options) {
      calls.children.push({ name, input, options, updates: [], ended: false })
      return child
    },
    update(value) {
      calls.roots.at(-1).updates.push(value)
      return this
    },
    end() {
      calls.roots.at(-1).ended = true
      return this
    },
  }

  const telemetry = createLangfuseTelemetry({
    tracing: {
      propagateAttributes(attributes, callback) {
        calls.attributes.push(attributes)
        return callback()
      },
      startObservation(name, input, options) {
        calls.roots.push({ name, input, options, updates: [], ended: false })
        return root
      },
    },
    createProcessor(options) {
      calls.processorOptions.push(options)
      return {
        forceFlush: async () => { calls.flushes += 1 },
      }
    },
    createProvider(options) {
      calls.providerOptions.push(options)
      return {
        register() { calls.registrations += 1 },
      }
    },
    warn(message) {
      calls.warnings.push(message)
    },
  })

  return { calls, telemetry }
}

test('Langfuse v4 telemetry is disabled without project credentials', async () => {
  const { calls, telemetry } = createHarness()
  const handle = telemetry.startGeneration({ name: 'disabled', input: 'hello' }, {})

  await handle.end({ output: 'world' })

  assert.equal(handle.recording, false)
  assert.equal(calls.processorOptions.length, 0)
  assert.equal(calls.roots.length, 0)
  assert.equal(calls.flushes, 0)
})

test('Langfuse v4 telemetry records a root observation and nested generation', async () => {
  const { calls, telemetry } = createHarness()
  const pending = []
  const ctx = { waitUntil(promise) { pending.push(promise) } }
  const env = {
    LANGFUSE_PUBLIC_KEY: 'pk-test',
    LANGFUSE_SECRET_KEY: 'sk-test',
    LANGFUSE_BASE_URL: 'https://example.langfuse.test',
    LANGFUSE_TRACING_ENVIRONMENT: 'preview',
    LANGFUSE_RELEASE: 'release-123',
  }

  const handle = telemetry.startGeneration({
    name: 'qimen-answer',
    model: 'gemini-test',
    input: 'prompt',
    userId: 'user-1',
    sessionId: 'session-1',
    tags: ['qimen'],
    version: 'prompt-v2',
    metadata: { scenario: 'qimen', nested: { safe: true } },
  }, env, ctx)

  handle.end({
    output: 'answer',
    usage: { input: 11, output: 7, total: 18, unit: 'TOKENS' },
  })
  await Promise.all(pending)

  assert.equal(handle.recording, true)
  assert.deepEqual(calls.processorOptions, [{
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    baseUrl: 'https://example.langfuse.test',
    environment: 'preview',
    release: 'release-123',
    exportMode: 'immediate',
  }])
  assert.equal(calls.registrations, 1)
  assert.deepEqual(calls.attributes, [{
    traceName: 'qimen-answer',
    userId: 'user-1',
    sessionId: 'session-1',
    tags: ['qimen'],
    version: 'prompt-v2',
    metadata: { scenario: 'qimen', nested: '{"safe":true}' },
  }])
  assert.deepEqual(calls.roots, [{
    name: 'qimen-answer',
    input: { input: 'prompt' },
    options: { asType: 'span' },
    updates: [{ output: 'answer' }],
    ended: true,
  }])
  assert.deepEqual(calls.children, [{
    name: 'qimen-answer-generation',
    input: { model: 'gemini-test', input: 'prompt' },
    options: { asType: 'generation' },
    updates: [{
      output: 'answer',
      usageDetails: { input: 11, output: 7, total: 18 },
    }],
    ended: true,
  }])
  assert.equal(calls.flushes, 1)
})

test('Langfuse v4 telemetry ends and flushes only once', async () => {
  const { calls, telemetry } = createHarness()
  const env = {
    LANGFUSE_PUBLIC_KEY: 'pk-test',
    LANGFUSE_SECRET_KEY: 'sk-test',
    LANGFUSE_BASE_URL: 'https://example.langfuse.test',
  }
  const handle = telemetry.startGeneration({ name: 'once', input: 'prompt' }, env)

  await handle.end({ output: 'first' })
  await handle.end({ output: 'second' })

  assert.equal(calls.children[0].updates.length, 1)
  assert.equal(calls.roots[0].updates.length, 1)
  assert.equal(calls.flushes, 1)
})

test('Langfuse v4 telemetry closes failed observations with error status', async () => {
  const { calls, telemetry } = createHarness()
  const env = {
    LANGFUSE_PUBLIC_KEY: 'pk-test',
    LANGFUSE_SECRET_KEY: 'sk-test',
    LANGFUSE_BASE_URL: 'https://example.langfuse.test',
  }
  const handle = telemetry.startGeneration({ name: 'failed', input: 'prompt' }, env)

  await handle.end({ error: new Error('upstream unavailable') })

  const expected = {
    output: { error: 'upstream unavailable' },
    level: 'ERROR',
    statusMessage: 'upstream unavailable',
  }
  assert.deepEqual(calls.children[0].updates, [expected])
  assert.deepEqual(calls.roots[0].updates, [expected])
  assert.equal(calls.children[0].ended, true)
  assert.equal(calls.roots[0].ended, true)
  assert.equal(calls.flushes, 1)
})

test('Langfuse v4 telemetry stays disabled and retries after provider registration fails', () => {
  let processorCreates = 0
  let providerCreates = 0
  const warnings = []
  const telemetry = createLangfuseTelemetry({
    createProcessor() {
      processorCreates += 1
      return { forceFlush: async () => {} }
    },
    createProvider() {
      providerCreates += 1
      return { register() { throw new Error('provider unavailable') } }
    },
    warn(message) { warnings.push(message) },
  })
  const env = {
    LANGFUSE_PUBLIC_KEY: 'pk-test',
    LANGFUSE_SECRET_KEY: 'sk-test',
    LANGFUSE_BASE_URL: 'https://example.langfuse.test',
  }

  const first = telemetry.startGeneration({ name: 'first' }, env)
  const second = telemetry.startGeneration({ name: 'second' }, env)

  assert.equal(first.recording, false)
  assert.equal(second.recording, false)
  assert.equal(processorCreates, 2)
  assert.equal(providerCreates, 2)
  assert.deepEqual(warnings, [
    'initialization failed: provider unavailable',
    'initialization failed: provider unavailable',
  ])
})
