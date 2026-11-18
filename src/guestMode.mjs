const GUEST_STATE_KEY = 'qimen_guest_state_v1'
const PRIVATE_METADATA_KEYS = new Set(['question', 'question_text', 'birth', 'birth_date', 'name', 'email'])

const makeGuestId = () => {
  const randomPart = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `guest_${randomPart}`
}

const defaultGuestState = () => ({
  guestId: makeGuestId(),
  active: false,
  startedAt: new Date().toISOString(),
  questionCount: 0,
  baziProfile: null,
  fortuneViewedDates: []
})

const readState = (storage) => {
  try {
    const raw = storage.getItem(GUEST_STATE_KEY)
    return raw ? { ...defaultGuestState(), ...JSON.parse(raw) } : defaultGuestState()
  } catch {
    return defaultGuestState()
  }
}

const writeState = (storage, state) => {
  storage.setItem(GUEST_STATE_KEY, JSON.stringify(state))
  return state
}

export const createMemoryStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  }
}

export const getBrowserStorage = () => globalThis.localStorage || createMemoryStorage()

export const getGuestState = (storage = getBrowserStorage()) => {
  const state = readState(storage)
  writeState(storage, state)
  return {
    ...state,
    canAskQuestion: state.questionCount < 1,
    canAddBaziProfile: !state.baziProfile
  }
}

export const resetGuestState = (storage = getBrowserStorage()) => {
  storage.removeItem(GUEST_STATE_KEY)
}

export const activateGuestMode = (storage = getBrowserStorage()) => {
  const state = getGuestState(storage)
  state.active = true
  return writeState(storage, state)
}

export const deactivateGuestMode = (storage = getBrowserStorage()) => {
  const state = getGuestState(storage)
  state.active = false
  return writeState(storage, state)
}

export const recordGuestQuestion = (storage = getBrowserStorage()) => {
  const state = getGuestState(storage)
  state.questionCount = Math.min(1, state.questionCount + 1)
  return writeState(storage, state)
}

export const saveGuestBaziProfile = (storage = getBrowserStorage(), profile) => {
  const state = getGuestState(storage)
  state.baziProfile = {
    ...profile,
    id: profile.id || 'guest_bazi_profile',
    created_at: profile.created_at || new Date().toISOString()
  }
  return writeState(storage, state)
}

export const recordGuestFortuneViewed = (storage = getBrowserStorage(), dateStr) => {
  const state = getGuestState(storage)
  if (dateStr && !state.fortuneViewedDates.includes(dateStr)) {
    state.fortuneViewedDates = [...state.fortuneViewedDates, dateStr]
  }
  return writeState(storage, state)
}

const sanitizeMetadata = (metadata = {}) => {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => !PRIVATE_METADATA_KEYS.has(key) && value !== undefined)
  )
}

export const buildGuestEventPayload = (storage = getBrowserStorage(), eventName, feature, metadata = {}) => {
  const state = getGuestState(storage)
  return {
    guest_id: state.guestId,
    event_name: eventName,
    feature,
    metadata: sanitizeMetadata(metadata),
    created_at: new Date().toISOString()
  }
}

export const trackGuestEvent = async (supabase, eventName, feature, metadata = {}, storage = getBrowserStorage()) => {
  if (!supabase) return
  try {
    const payload = buildGuestEventPayload(storage, eventName, feature, metadata)
    await supabase.from('guest_events').insert([payload])
  } catch (error) {
    console.warn('访客埋点写入失败:', error?.message || error) // i18n-ignore 开发日志
  }
}
