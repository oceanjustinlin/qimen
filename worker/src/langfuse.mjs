import { LangfuseSpanProcessor } from '@langfuse/otel'
import { propagateAttributes, startObservation } from '@langfuse/tracing'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

const NOOP_HANDLE = Object.freeze({
  recording: false,
  end: async () => {},
})

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
    ? value
    : undefined
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined
  const entries = Object.entries(metadata).flatMap(([key, value]) => {
    if (!/^[A-Za-z0-9]+$/.test(key) || value == null) return []
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    if (!stringValue || stringValue.length > 200) return []
    return [[key, stringValue]]
  })
  return entries.length ? Object.fromEntries(entries) : undefined
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return undefined
  const entries = Object.entries(usage).filter(([key, value]) => (
    key !== 'unit' && Number.isFinite(value)
  ))
  return entries.length ? Object.fromEntries(entries) : undefined
}

export function createLangfuseTelemetry({
  tracing = { propagateAttributes, startObservation },
  createProcessor = options => new LangfuseSpanProcessor(options),
  createProvider = options => new NodeTracerProvider(options),
  warn = message => console.warn(`[langfuse] ${message}`),
} = {}) {
  let processor

  function ensureProcessor(env) {
    if (processor) return processor
    const options = {
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL,
      ...(optionalString(env.LANGFUSE_TRACING_ENVIRONMENT)
        ? { environment: env.LANGFUSE_TRACING_ENVIRONMENT }
        : {}),
      ...(optionalString(env.LANGFUSE_RELEASE) ? { release: env.LANGFUSE_RELEASE } : {}),
      exportMode: 'immediate',
    }
    const nextProcessor = createProcessor(options)
    const provider = createProvider({ spanProcessors: [nextProcessor] })
    provider.register()
    processor = nextProcessor
    return processor
  }

  function startGeneration({
    name,
    model,
    input,
    userId,
    sessionId,
    tags,
    version,
    metadata,
    modelParameters,
  }, env = {}, ctx) {
    if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_BASE_URL) {
      return NOOP_HANDLE
    }

    try {
      const activeProcessor = ensureProcessor(env)
      const safeMetadata = sanitizeMetadata(metadata)
      const attributes = {
        traceName: optionalString(name) || 'llm-request',
        ...(optionalString(userId) ? { userId } : {}),
        ...(optionalString(sessionId) ? { sessionId } : {}),
        ...(Array.isArray(tags) && tags.length ? { tags: tags.filter(optionalString) } : {}),
        ...(optionalString(version) ? { version } : {}),
        ...(safeMetadata ? { metadata: safeMetadata } : {}),
      }

      const observations = tracing.propagateAttributes(attributes, () => {
        const root = tracing.startObservation(
          attributes.traceName,
          { input },
          { asType: 'span' },
        )
        const generation = root.startObservation(
          `${attributes.traceName}-generation`,
          {
            model,
            input,
            ...(modelParameters ? { modelParameters } : {}),
          },
          { asType: 'generation' },
        )
        return { generation, root }
      })

      let flushPromise
      return {
        recording: true,
        end({ output, usage, error } = {}) {
          if (flushPromise) return flushPromise
          try {
            const errorMessage = error
              ? optionalString(error?.message || String(error)) || 'Unknown error'
              : undefined
            const safeOutput = output ?? (errorMessage ? { error: errorMessage } : undefined)
            const usageDetails = normalizeUsage(usage)
            const completion = {
              output: safeOutput,
              ...(usageDetails ? { usageDetails } : {}),
              ...(errorMessage ? { level: 'ERROR', statusMessage: errorMessage } : {}),
            }
            observations.generation.update({
              ...completion,
            }).end()
            observations.root.update({
              output: safeOutput,
              ...(errorMessage ? { level: 'ERROR', statusMessage: errorMessage } : {}),
            }).end()
            flushPromise = activeProcessor.forceFlush().catch(error => {
              warn(`flush failed: ${error?.message || error}`)
            })
          } catch (error) {
            warn(`recording failed: ${error?.message || error}`)
            flushPromise = Promise.resolve()
          }
          if (ctx?.waitUntil) ctx.waitUntil(flushPromise)
          return flushPromise
        },
      }
    } catch (error) {
      warn(`initialization failed: ${error?.message || error}`)
      return NOOP_HANDLE
    }
  }

  return { startGeneration }
}

export const langfuseTelemetry = createLangfuseTelemetry()
