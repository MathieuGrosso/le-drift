import { NET } from '../core/tuning'
import { DEFAULT_PORT } from '../shared/protocol'

export function serverEndpoint(): string {
  const configured: unknown = import.meta.env.VITE_DRIFT_SERVER
  if (typeof configured === 'string' && configured) return configured
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.hostname || 'localhost'}:${DEFAULT_PORT}`
}

/** Any HTTP answer means a server listens; a refused or slow socket means solo. */
export async function probe(endpoint: string): Promise<boolean> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), NET.probeTimeoutMs)
  try {
    await fetch(`${endpoint.replace(/^ws/, 'http')}/`, { signal: ctl.signal, mode: 'no-cors', cache: 'no-store' })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
