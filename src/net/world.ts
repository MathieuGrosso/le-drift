import { TIME, WINDOWS } from '../core/tuning'
import type { GameState } from '../core/types'
import { sharedGameHours, windowCoat, type ClientMessages, type MondeStateView } from '../shared/protocol'

const WINDOW_SYNC_SECONDS = 1
// A window being scrubbed here keeps its local coat until the server has caught up with it.
const LOCAL_SCRUB_HOLD_MS = 1500

/** Online, the clock and the window coat belong to the server; this mirrors them into GameState. */
export class SharedWorld {
  private savedScale: number | null = null
  private windowTimer = 0
  private readonly scrubbedAt = new Map<string, number>()
  private readonly sentCoat = new Map<string, number>()

  constructor(private readonly state: GameState, private readonly send: (m: ClientMessages['scrub']) => void) {}

  apply(dt: number, m: MondeStateView): void {
    const t = this.state.time
    if (this.savedScale === null) this.savedScale = t.scale
    const h = sharedGameHours(Date.now(), m.epochMs, m.startHours, m.realMsPerGameHour)
    t.scale = 0
    t.day = TIME.startDay + Math.floor(h / 24)
    t.hours = h - Math.floor(h / 24) * 24
    this.windowTimer -= dt
    if (this.windowTimer > 0) return
    this.windowTimer = WINDOW_SYNC_SECONDS
    const now = performance.now()
    const held = (id: string) => now - (this.scrubbedAt.get(id) ?? -Infinity) < LOCAL_SCRUB_HOLD_MS
    m.windows.forEach((scrubbedAt, id) => {
      if (held(id)) return
      this.state.windows[id] = scrubbedAt
      this.sentCoat.delete(id)
    })
    // A window the server never saw is still coated for everyone, whatever the solo save says.
    for (const id of Object.keys(this.state.windows)) if (!m.windows.has(id) && !held(id)) delete this.state.windows[id]
  }

  /** Forwards a local scrub as the coat it removed, so the server applies it on its own clock. */
  scrubbed(m: MondeStateView, windowId: string, coat: number): void {
    const h = sharedGameHours(Date.now(), m.epochMs, m.startHours, m.realMsPerGameHour)
    const before = this.sentCoat.get(windowId) ?? windowCoat(m.windows.get(windowId), h, WINDOWS.sharedRegrowHours, WINDOWS.initialCoat)
    this.sentCoat.set(windowId, coat)
    this.scrubbedAt.set(windowId, performance.now())
    const amount = before - coat
    if (amount > 0) this.send({ windowId, amount: Math.min(1, amount) })
  }

  release(): void {
    if (this.savedScale !== null) this.state.time.scale = this.savedScale
    this.savedScale = null
    this.scrubbedAt.clear()
    this.sentCoat.clear()
  }
}
