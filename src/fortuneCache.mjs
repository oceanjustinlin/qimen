const STORAGE_KEY = 'qimen:fortune-cache:v1'
const MONTHLY_INTERPRETATION_REFRESH_KEY = 'qimen:monthly-interpretation-refresh:v1'

const fortuneCacheByKey = new Map()
const pendingInterpretationByKey = new Map()

const normalizeProfileKey = (profileId) => profileId || 'default'

// 英文断语与中文分开缓存（i18n §5.9）；简体键不变
const localeSuffix = (contentLocale) => (contentLocale === 'en-US' ? '::en-US' : '')
const buildCacheKey = (userId, dateStr, profileId, contentLocale) => `${userId}::${dateStr}::${normalizeProfileKey(profileId)}${localeSuffix(contentLocale)}`

const getBeijingExpiry = (dateStr) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0
  return new Date(`${dateStr}T23:59:59.999+08:00`).getTime()
}

const readStorageState = (storage) => {
  if (!storage) return {}
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    console.warn('日运本地缓存读取失败，忽略缓存:', error) // i18n-ignore 开发日志
    return {}
  }
}

const writeStorageState = (storage, state) => {
  if (!storage) return
  try {
    if (Object.keys(state).length === 0) {
      storage.removeItem(STORAGE_KEY)
      return
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('日运本地缓存写入失败，忽略缓存:', error) // i18n-ignore 开发日志
  }
}

const readJsonState = (storage, key, fallback) => {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (error) {
    console.warn('本地状态读取失败，忽略缓存:', error) // i18n-ignore 开发日志
    return fallback
  }
}

const writeJsonState = (storage, key, value) => {
  if (!storage) return
  try {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      storage.removeItem(key)
      return
    }
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('本地状态写入失败，忽略缓存:', error) // i18n-ignore 开发日志
  }
}

const pruneExpiredEntries = (state, nowMs) => {
  const nextState = {}
  Object.entries(state).forEach(([key, entry]) => {
    if (entry?.expiresAt > nowMs && entry?.data) nextState[key] = entry
  })
  return nextState
}

export const loadCachedFortune = (storage, userId, dateStr, now = new Date(), profileId = '', contentLocale = 'zh-CN') => {
  if (!userId || !dateStr) return null

  const key = buildCacheKey(userId, dateStr, profileId, contentLocale)
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const memoryCached = fortuneCacheByKey.get(key)
  if (memoryCached) return memoryCached

  const storageState = pruneExpiredEntries(readStorageState(storage), nowMs)
  const entry = storageState[key]
  if (!entry) {
    writeStorageState(storage, storageState)
    return null
  }

  fortuneCacheByKey.set(key, entry.data)
  writeStorageState(storage, storageState)
  return entry.data
}

export const rememberFortuneCache = (storage, userId, dateStr, data, now = new Date(), profileId = '', contentLocale = 'zh-CN') => {
  if (!userId || !dateStr || !data) return

  const key = buildCacheKey(userId, dateStr, profileId, contentLocale)
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const expiresAt = getBeijingExpiry(dateStr)
  if (expiresAt <= nowMs) return

  fortuneCacheByKey.set(key, data)

  const storageState = pruneExpiredEntries(readStorageState(storage), nowMs)
  storageState[key] = { data, expiresAt }
  writeStorageState(storage, storageState)
}

export const getPendingInterpretation = (userId, dateStr, profileId = '', contentLocale = 'zh-CN') => {
  if (!userId || !dateStr) return null
  return pendingInterpretationByKey.get(buildCacheKey(userId, dateStr, profileId, contentLocale)) || null
}

export const rememberPendingInterpretation = (userId, dateStr, promise, profileId = '', contentLocale = 'zh-CN') => {
  if (!userId || !dateStr || !promise) return
  pendingInterpretationByKey.set(buildCacheKey(userId, dateStr, profileId, contentLocale), promise)
}

export const clearPendingInterpretation = (userId, dateStr, profileId = '', contentLocale = 'zh-CN') => {
  if (!userId || !dateStr) return
  pendingInterpretationByKey.delete(buildCacheKey(userId, dateStr, profileId, contentLocale))
}

export const rememberMonthlyInterpretationRefresh = (storage, signal) => {
  if (!storage || !signal?.profileId) return
  const current = readJsonState(storage, MONTHLY_INTERPRETATION_REFRESH_KEY, [])
  const deduped = current.filter(item => !(
    item?.profileId === signal.profileId
    && item?.monthKey === signal.monthKey
    && item?.scope === signal.scope
  ))
  deduped.push({
    profileId: signal.profileId,
    monthKey: signal.monthKey || '*',
    scope: signal.scope || 'monthly',
    changedAt: signal.changedAt || Date.now(),
    message: signal.message || '',
  })
  writeJsonState(storage, MONTHLY_INTERPRETATION_REFRESH_KEY, deduped)
}

export const peekMonthlyInterpretationRefresh = (storage, profileId, monthKey) => {
  if (!storage || !profileId) return null
  const current = readJsonState(storage, MONTHLY_INTERPRETATION_REFRESH_KEY, [])
  const matchesMonthKey = (signalKey) => (
    signalKey === '*'
    || signalKey === monthKey
    || (signalKey && monthKey && monthKey.startsWith(`${signalKey}-`))
  )
  const matched = current
    .filter(item => item?.profileId === profileId && matchesMonthKey(item?.monthKey))
    .sort((a, b) => {
      if (a.monthKey === b.monthKey) return (b.changedAt || 0) - (a.changedAt || 0)
      return a.monthKey === monthKey ? -1 : 1
    })
  return matched[0] || null
}

export const clearMonthlyInterpretationRefresh = (storage, profileId, monthKey) => {
  if (!storage || !profileId) return
  const current = readJsonState(storage, MONTHLY_INTERPRETATION_REFRESH_KEY, [])
  const matchesMonthKey = (signalKey) => (
    signalKey === '*'
    || signalKey === monthKey
    || (signalKey && monthKey && monthKey.startsWith(`${signalKey}-`))
  )
  const next = current.filter(item => !(
    item?.profileId === profileId
    && matchesMonthKey(item?.monthKey)
  ))
  writeJsonState(storage, MONTHLY_INTERPRETATION_REFRESH_KEY, next)
}

export const __resetFortuneCacheForTests = () => {
  fortuneCacheByKey.clear()
  pendingInterpretationByKey.clear()
}
