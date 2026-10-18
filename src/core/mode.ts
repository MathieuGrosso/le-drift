import { PLACES } from './layout'
import type { CellId, GameContext, GameMode, LockId, PlaceId } from './types'

export interface ModeController {
  set(to: GameMode, lockId: LockId | null): void
  startSortie(lockId?: LockId): Promise<void>
  endSortie(): Promise<void>
  goto(place: PlaceId): boolean
  dispose(): void
}

type Lockable = 'sas' | 'echelle-toit'
const isV1Lock = (id: LockId): id is Lockable => id === 'sas' || id === 'echelle-toit'

export function createModeController(ctx: GameContext): ModeController {
  const offs: (() => void)[] = []
  let cycling = 0
  let scrubbed = 0

  const set = (to: GameMode, lockId: LockId | null) => {
    const st = ctx.state
    const from = st.mode
    if (from === to) return
    st.mode = to
    if (to === 'sortie') {
      const lock = lockId ?? 'sas'
      scrubbed = 0
      st.hero.sortie = { lockId: lock, ring: lock, round: [], startedAt: st.time.hours + (st.time.day - 1) * 24 }
      ctx.bus.emit('mode:changed', { from, to, lockId: lock })
      ctx.bus.emit('sortie:start', { lockId: lock, round: [] })
    } else {
      const lock = st.hero.sortie?.lockId ?? lockId ?? 'sas'
      st.hero.sortie = null
      ctx.bus.emit('mode:changed', { from, to, lockId: lock })
      ctx.bus.emit('sortie:end', { lockId: lock, scrubbed })
    }
  }

  offs.push(ctx.bus.on('airlock:cycle', ({ lockId, dir, phase }) => {
    if (phase === 'close') cycling++
    if (phase !== 'done') return
    cycling = Math.max(0, cycling - 1)
    set(dir === 'out' ? 'sortie' : 'inside', lockId)
  }))
  offs.push(ctx.bus.on('hero:medium', ({ medium }) => {
    if (cycling > 0) return
    if (medium === 'water' && ctx.state.mode === 'inside' && ctx.state.hero.room === null) set('sortie', 'sas')
    if (medium === 'air' && ctx.state.mode === 'sortie') set('inside', null)
  }))
  offs.push(ctx.bus.on('scrub:done', () => {
    if (ctx.state.mode === 'sortie') scrubbed++
  }))
  offs.push(ctx.bus.on('room:entered', ({ roomId }) => {
    const drift = ctx.services.drift
    const local = ctx.state.hero.localPosition
    const district = drift && local ? drift.districtAt(local) : ctx.state.hero.district
    ctx.bus.emit('cell:entered', { cellId: roomId as CellId, district })
  }))
  offs.push(ctx.bus.on('room:left', ({ roomId }) => ctx.bus.emit('cell:left', { cellId: roomId })))

  const cycle = async (lockId: LockId, dir: 'in' | 'out') => {
    const drift = ctx.services.drift
    if (!drift || !isV1Lock(lockId)) {
      set(dir === 'out' ? 'sortie' : 'inside', lockId)
      return
    }
    await drift.cycleAirlock(lockId, dir)
  }

  return {
    set,
    async startSortie(lockId = 'sas') {
      if (ctx.state.mode === 'sortie') return
      if (ctx.state.hero.room !== 'sas' && isV1Lock(lockId) && lockId === 'sas') {
        const s = ctx.services.drift?.cellSpawn('sas')
        if (s) ctx.services.hero?.teleportLocal(s.local, s.yaw)
      }
      await cycle(lockId, 'out')
    },
    async endSortie() {
      if (ctx.state.mode === 'inside') return
      await cycle(ctx.state.hero.sortie?.lockId ?? 'sas', 'in')
    },
    goto(place) {
      const p = PLACES[place]
      const hero = ctx.services.hero
      const drift = ctx.services.drift
      if (!p) return false
      const st = ctx.state
      st.debug.cameraLocked = false
      if (p.mode === 'inside') {
        st.hero.medium = 'air'
        st.hero.room = p.room
        st.hero.wetness = 0
        st.hero.localPosition = { ...p.local }
        if (hero) hero.teleportLocal(p.local, p.yaw)
        else if (drift) st.hero.position = drift.toWorld(p.local)
        set('inside', null)
      } else {
        st.hero.room = null
        st.hero.localPosition = null
        if (hero) hero.teleportLocal(p.local, p.yaw)
        else if (drift) st.hero.position = drift.toWorld(p.local)
        set('sortie', 'sas')
      }
      st.hero.district = p.district
      return true
    },
    dispose() {
      for (const o of offs.splice(0)) o()
    },
  }
}
