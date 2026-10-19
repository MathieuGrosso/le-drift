import type { Identity, Profile } from '../shared/protocol'

const IDENTITY_KEY = 'le-drift:identity:v1'
const PROFILE_KEY = 'le-drift:profile:v1'

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (raw) return JSON.parse(raw) as Identity
  } catch {
    /* storage unavailable: a fresh identity per session */
  }
  const id: Identity = { id: crypto.randomUUID(), secret: randomSecret() }
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id))
  } catch {
    /* storage unavailable */
  }
  return id
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export function storeProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
}
