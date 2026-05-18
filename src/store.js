import { reactive } from 'vue'
import { activateGuestMode, deactivateGuestMode, getGuestState } from './guestMode.mjs'

export const SELECTED_BAZI_PROFILE_STORAGE_KEY = 'qimen.selectedBaziProfileId'

const getProfileStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

const loadSelectedBaziProfileId = () => {
  try {
    return getProfileStorage()?.getItem(SELECTED_BAZI_PROFILE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export const globalState = reactive({
  isDrawerOpen: false,
  authReady: false,
  currentUser: null,
  isGuest: getGuestState().active,
  selectedBaziProfileId: loadSelectedBaziProfileId()
})

export const setSelectedBaziProfileId = (profileId) => {
  const nextId = String(profileId || '')
  globalState.selectedBaziProfileId = nextId
  try {
    const storage = getProfileStorage()
    if (!storage) return
    if (nextId) {
      storage.setItem(SELECTED_BAZI_PROFILE_STORAGE_KEY, nextId)
    } else {
      storage.removeItem(SELECTED_BAZI_PROFILE_STORAGE_KEY)
    }
  } catch {
    // Local storage is optional; the reactive state is enough for in-app sync.
  }
}

export const resolveSelectedBaziProfileId = (profiles = [], {
  requestedProfileId = '',
  sharedProfileId = globalState.selectedBaziProfileId,
  currentProfileId = ''
} = {}) => {
  const ids = new Set((Array.isArray(profiles) ? profiles : []).map(profile => String(profile.id || '')))
  const candidates = [requestedProfileId, sharedProfileId, currentProfileId].map(value => String(value || ''))
  const matched = candidates.find(id => id && ids.has(id))
  if (matched) return matched
  const defaultProfile = profiles.find(profile => profile.is_default) || profiles[0]
  return defaultProfile?.id || ''
}

export const isAdmin = () =>
  globalState.currentUser?.app_metadata?.role === 'admin'

export const setCurrentUser = (user) => {
  globalState.currentUser = user
  globalState.authReady = true
  if (user) {
    deactivateGuestMode()
    globalState.isGuest = false
  }
}

export const enterGuestMode = () => {
  activateGuestMode()
  globalState.isGuest = true
  globalState.authReady = true
}

export const leaveGuestMode = () => {
  deactivateGuestMode()
  globalState.isGuest = false
}
