export interface FrameWindow {
  readonly fps: number
  readonly p90Ms: number
  readonly spanMs: number
  push(dtMs: number): void
  clear(): void
}

// Frames counted over a sliding time span: a mean of 1/dt overstates fps when 1 ms and 33 ms frames alternate.
export function createFrameWindow(spanMs: number): FrameWindow {
  const samples: number[] = []
  let total = 0
  const sorted: number[] = []
  let dirty = true
  let p90 = 0

  return {
    get fps() {
      return total > 0 ? (samples.length * 1000) / total : 0
    },
    get p90Ms() {
      if (dirty) {
        sorted.length = 0
        for (const s of samples) sorted.push(s)
        sorted.sort((a, b) => a - b)
        p90 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]! : 0
        dirty = false
      }
      return p90
    },
    get spanMs() {
      return total
    },
    push(dtMs) {
      samples.push(dtMs)
      total += dtMs
      while (samples.length > 1 && total - samples[0]! >= spanMs) total -= samples.shift()!
      dirty = true
    },
    clear() {
      samples.length = 0
      total = 0
      dirty = true
    },
  }
}
