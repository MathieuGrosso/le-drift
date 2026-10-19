const MAX_KEYS = 10_000

/** Sliding-window rate limit per key; keys idle for a full window are evicted, and the oldest past `maxKeys`. */
export function createRateLimit(max: number, windowMs: number, maxKeys = MAX_KEYS) {
  const hits = new Map<string, number[]>()
  let sweptAt = 0
  const sweep = (now: number) => {
    sweptAt = now
    for (const [key, times] of hits) if (now - times[times.length - 1]! >= windowMs) hits.delete(key)
  }
  return {
    allow(key: string): boolean {
      const now = Date.now()
      if (now - sweptAt >= windowMs) sweep(now)
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      const ok = recent.length < max
      if (ok) recent.push(now)
      hits.delete(key)
      if (recent.length) hits.set(key, recent)
      while (hits.size > maxKeys) hits.delete(hits.keys().next().value!)
      return ok
    },
    forget(key: string): void {
      hits.delete(key)
    },
    get size(): number {
      return hits.size
    },
  }
}

export type RateLimit = ReturnType<typeof createRateLimit>
