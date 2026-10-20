import { createFrameWindow } from './framewindow'
import { DYNAMIC_RESOLUTION as DR } from './tuning'

export interface DynamicResolution {
  readonly pixelRatio: number
  update(dt: number): boolean
  setCeiling(ceiling: number): void
}

// Frame time, not GPU timer queries: on ANGLE Metal those include the vsync wait. The 90th percentile, not a mean,
// so uneven pacing (fast frames between slow ones) still reads as slow.
// A step up that misses the budget doubles the wait before the next try.
export function createDynamicResolution(ceiling: number): DynamicResolution {
  let max = ceiling
  let ratio = ceiling
  let ms = 1000 / DR.targetFps
  const frames = createFrameWindow(DR.windowMs)
  let since = 0
  let calm = 0
  let growWait: number = DR.growAfterSeconds
  let probing = false

  const targetMs = 1000 / DR.targetFps
  const quantize = (r: number) => Math.floor(r / DR.step) * DR.step

  return {
    get pixelRatio() {
      return ratio
    },
    update(dt) {
      if (dt * 1000 > DR.hitchMs) return false
      since += dt
      if (since < DR.settleSeconds) return false
      frames.push(dt * 1000)
      if (frames.spanMs < DR.windowMs * 0.9) return false
      ms = frames.p90Ms
      if (probing && since > DR.probeSeconds) {
        probing = false
        growWait = DR.growAfterSeconds
      }
      let next = ratio
      if (ms > targetMs * DR.shrinkAbove) {
        next = Math.max(DR.minRatio, Math.min(ratio - DR.step, quantize(ratio * Math.sqrt(targetMs / ms))))
        if (probing) growWait = Math.min(growWait * 2, DR.maxGrowWaitSeconds)
        probing = false
        calm = 0
      } else if (ms < targetMs * DR.growBelow && ratio < max) {
        calm += dt
        if (calm >= (ms < targetMs * DR.headroomBelow ? DR.growAfterSeconds : growWait)) {
          next = Math.min(max, ratio + DR.step)
          probing = true
        }
      } else {
        calm = 0
      }
      if (next === ratio) return false
      ratio = next
      since = 0
      frames.clear()
      calm = 0
      return true
    },
    setCeiling(c) {
      max = c
      ratio = Math.min(c, Math.max(ratio, Math.min(c, DR.minRatio)))
    },
  }
}
