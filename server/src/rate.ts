/** Sliding-window rate limit per key. */
export function createRateLimit(max: number, windowMs: number) {
  const hits = new Map<string, number[]>()
  return {
    allow(key: string): boolean {
      const now = Date.now()
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      const ok = recent.length < max
      if (ok) recent.push(now)
      hits.set(key, recent)
      return ok
    },
    forget(key: string): void {
      hits.delete(key)
    },
  }
}
