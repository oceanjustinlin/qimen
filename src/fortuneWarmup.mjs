import { rememberFortuneCache } from './fortuneCache.mjs'

const warmedUsersByDay = new Set()
const pendingWarmups = new Map()

const toBeijingDateKey = (input = new Date()) => {
  const date = input instanceof Date ? input : new Date(input)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

export const buildUpcomingDateKeys = (start = new Date(), count = 7) => {
  const baseKey = toBeijingDateKey(start)
  const baseDate = new Date(`${baseKey}T12:00:00+08:00`)
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(baseDate)
    current.setDate(baseDate.getDate() + index)
    return toBeijingDateKey(current)
  })
}

const buildWarmupKey = (userId, todayKey, contentLocale) => `${userId}::${todayKey}${contentLocale === 'en-US' ? '::en-US' : ''}`

export const warmFortuneCache = async ({
  storage,
  userId,
  now = new Date(),
  fetchFortunes,
  contentLocale = 'zh-CN',
}) => {
  if (!userId || typeof fetchFortunes !== 'function') return

  const todayKey = toBeijingDateKey(now)
  const warmupKey = buildWarmupKey(userId, todayKey, contentLocale)
  // 英文：断语行的 period_key 带 ::en-US 后缀（i18n §5.9），预热读英文行、写英文缓存键
  const suffix = contentLocale === 'en-US' ? '::en-US' : ''

  if (warmedUsersByDay.has(warmupKey)) return
  if (pendingWarmups.has(warmupKey)) return pendingWarmups.get(warmupKey)

  const pending = (async () => {
    const dateKeys = buildUpcomingDateKeys(now, 7).map((d) => `${d}${suffix}`)
    const rows = await fetchFortunes({ userId, dateKeys })

    ;(Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row?.period_key || !row?.data_json) return
      const dateStr = suffix && row.period_key.endsWith(suffix) ? row.period_key.slice(0, -suffix.length) : row.period_key
      rememberFortuneCache(storage, userId, dateStr, row.data_json, now, '', contentLocale)
    })

    warmedUsersByDay.add(warmupKey)
  })().finally(() => {
    pendingWarmups.delete(warmupKey)
  })

  pendingWarmups.set(warmupKey, pending)
  return pending
}

export const warmFortuneCacheFromSupabase = async ({
  supabase,
  storage,
  userId,
  now = new Date(),
  contentLocale = 'zh-CN',
}) => {
  if (!supabase || !userId) return

  return warmFortuneCache({
    storage,
    userId,
    now,
    contentLocale,
    fetchFortunes: async ({ dateKeys }) => {
      const { data, error } = await supabase
        .from('fortune_cache')
        .select('period_key, data_json')
        .eq('user_id', userId)
        .eq('dimension', 'day')
        .in('period_key', dateKeys)
        .gt('expires_at', new Date().toISOString())

      if (error) {
        console.warn('日运缓存预热失败，忽略预热:', error.message)
        return []
      }

      return data || []
    }
  })
}

export const __resetFortuneWarmupForTests = () => {
  warmedUsersByDay.clear()
  pendingWarmups.clear()
}
