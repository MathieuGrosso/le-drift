import { AVATAR_COLORS, LIMITS, sanitizeText, type Identity, type Profile } from '../shared/protocol'

// `?identity=2` gives a second player in another tab of the same browser.
const slot = new URLSearchParams(location.search).get('identity')
const suffix = slot && /^\w{1,8}$/.test(slot) ? `:${slot}` : ''
const IDENTITY_KEY = `le-drift:identity:v1${suffix}`
const PROFILE_KEY = `le-drift:profile:v1${suffix}`

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: kept for this session only */
  }
}

function isIdentity(v: unknown): v is Identity {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.secret === 'string'
}

export function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.name === 'string' && o.name.length >= LIMITS.nameMin && typeof o.color === 'number'
    && (AVATAR_COLORS as readonly number[]).includes(o.color)
}

export function loadIdentity(): Identity {
  const stored = readJson(IDENTITY_KEY)
  if (isIdentity(stored)) return stored
  const id: Identity = { id: crypto.randomUUID(), secret: randomSecret() }
  writeJson(IDENTITY_KEY, id)
  return id
}

export function loadProfile(): Profile | null {
  const stored = readJson(PROFILE_KEY)
  return isProfile(stored) ? stored : null
}

export function storeProfile(p: Profile): Profile {
  const clean: Profile = { name: sanitizeText(p.name, LIMITS.nameMax), color: p.color }
  writeJson(PROFILE_KEY, clean)
  return clean
}
