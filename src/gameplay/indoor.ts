import type { DistrictId, HeroService, RoomId } from '../core/types'
import { dist3, type Candidate, type Gp, type Indoor } from './context'
import { DISTRICT_NAMES, DOME_NAMES, NPC_IDS, PLACE_NAMES, PROMPTS, TIPS, UI } from './text/fr'
import type { Uses } from './world/uses'

const RAY_REACH = 2.4
const LOCK_REACH = 7
const NPC_REACH = 2.8
const REEL_HOLD = 1

const BED = /^(lit|couchette|bunk|bed|hamac)/
const SEAT = /^(banc|siege|chaise|tabouret|seat)/
const CHART = /^(table-carte|chart-table)/
const STALL = /^(etal|stall)/
const BOARD = /^(tableau|forecast)/
const POT = /^(marmite|comptoir|rechaud)/
const SAS = /^(sas|airlock)$/
const ROOF = /^echelle-toit$/
const ZIP = /^tyrolienne-/
const TUBE = /^tube-([a-z]+)-([a-z]+)$/

type HeroExt = HeroService & { zip?(id: string): boolean; activity?(): string }

// Everything Ilo can use indoors: drift's furniture, rides and doors, the people, and the lock out.
export function createIndoor(gp: Gp, uses: Uses): Indoor {
  const ctx = gp.ctx
  const seenRooms = new Set<string>()
  let reelHold = 0

  const hero = () => ctx.services.hero as HeroExt | undefined

  ctx.bus.on('cell:entered', ({ cellId }) => {
    const key = `${ctx.state.time.day}:${cellId}`
    if (seenRooms.has(key) || ctx.state.mode !== 'inside') return
    seenRooms.add(key)
    const name = PLACE_NAMES[cellId] ?? DOME_NAMES[cellId]
    if (name && !gp.busy()) gp.hud.placeName(name)
    if (cellId === 'sas' && !ctx.state.flags['tip-sas']) {
      ctx.state.flags['tip-sas'] = true
      gp.hud.tip(TIPS.sas(ctx.input.keyLabel('interact')))
    }
  })

  const airlock = async (dir: 'in' | 'out', lockId: 'sas' | 'echelle-toit' = 'sas') => {
    gp.lock.count++
    try {
      const drift = ctx.services.drift
      if (drift) {
        gp.heroMode('airlock')
        await drift.cycleAirlock(lockId, dir)
        gp.heroMode(ctx.state.hero.medium === 'air' ? 'idle' : 'swim')
      } else {
        await gp.cine.fade('black', 0.5)
        const lock = gp.driftLock()
        const p = dir === 'out' ? lock : { x: lock.x, y: lock.y + 6, z: lock.z - 6 }
        if (ctx.services.hero) ctx.services.hero.teleport(p)
        else ctx.state.hero.position = p
        await gp.cine.fade(null, 0.6)
      }
    } finally {
      gp.lock.count--
    }
  }

  const reelIn = async () => {
    const lockId = ctx.state.hero.sortie?.lockId === 'echelle-toit' ? 'echelle-toit' : 'sas'
    const h = ctx.services.hero as (HeroExt & { reelIn?(): Promise<void> }) | undefined
    gp.lock.count++
    try {
      gp.sfx('rope-taut')
      if (h?.reelIn) {
        await Promise.race([h.reelIn(), gp.cine.wait(14)])
      } else {
        await gp.cine.fade('black', 0.5)
        const anchor = ctx.services.drift?.lockAnchor(lockId)
        if (anchor) ctx.services.hero?.teleport(anchor)
        await gp.cine.fade(null, 0.4)
      }
    } finally {
      gp.lock.count--
    }
    await airlock('in', lockId)
  }

  const rideZip = (id: string) => {
    const h = hero()
    if (h?.activity?.().includes('zip')) return
    ctx.services.drift?.openDoor(id, true)
  }

  uses.on(ZIP, (id) =>
    gp.inv.has('poulie')
      ? { label: PROMPTS.tyrolienne, kind: 'zip', reach: 2.6, run: () => rideZip(id) }
      : { label: PROMPTS.tyrolienne, kind: 'item', reach: 2.6, run: () => gp.hud.tip(UI.pasDePoulie, 4) },
  )
  uses.on(TUBE, (id) => {
    const m = TUBE.exec(id)!
    const dest = DISTRICT_NAMES[m[2] as DistrictId] ?? m[2]!
    return { label: PROMPTS.tube(dest), kind: 'tube', reach: 2.4, run: () => ctx.services.drift?.openDoor(id, true) }
  })
  uses.on(BED, () => ({ label: PROMPTS.dormir, kind: 'bed', run: () => gp.menus.sleep() }))
  uses.on(SEAT, (id) => ({ label: PROMPTS.asseoir, kind: 'seat', reach: 1.5, run: () => ctx.services.hero?.sit(id) }))
  uses.on(CHART, () => ({ label: PROMPTS.carte, kind: 'chart-table', reach: 2.4, run: () => gp.quests.chartTable() }))
  uses.on(STALL, (id) => ({ label: PROMPTS.etal, kind: 'stall', reach: 2.2, run: () => gp.menus.market(id) }))
  uses.on(BOARD, () => ({ label: PROMPTS.tableau, kind: 'npc', run: () => gp.quests.talk('mme-rouille') }))
  uses.on(POT, () => ({ label: PROMPTS.cuisiner, kind: 'marmite', reach: 2.2, run: () => gp.quests.talk('cuistot') }))
  uses.on(ROOF, () => ({ label: PROMPTS.sortir, kind: 'airlock', run: () => void airlock('out', 'echelle-toit') }))
  uses.on(SAS, () => ({ label: PROMPTS.sortir, kind: 'airlock', run: () => void airlock('out') }))

  const rayDoor = (out: Candidate[]) => {
    const head = gp.headPos()
    const f = gp.heroForward()
    const hit = ctx.physics.raycast(head, f, RAY_REACH) ?? ctx.physics.raycast(head, { x: f.x, y: -0.35, z: f.z }, RAY_REACH + 0.4)
    const tag = hit?.tag
    if (!hit || !tag) return
    const owner = tag.ownerId ?? ''
    const outer = owner === 'sas-exterieure' ? 'sas' : owner === 'toit-exterieure' ? 'echelle-toit' : null
    if (outer && ctx.state.hero.medium === 'air') {
      out.push({ id: owner, kind: 'airlock', label: PROMPTS.sortir, key: 'interact', dist: hit.distance, run: () => void airlock('out', outer) })
    } else if (tag.kind === 'door' && owner && !ZIP.test(owner) && !TUBE.test(owner)) {
      const open = !!ctx.state.drift.doors[owner]
      out.push({ id: owner, kind: 'door', label: open ? PROMPTS.fermer : PROMPTS.ouvrir, key: 'interact', dist: hit.distance, run: () => ctx.services.drift?.openDoor(owner, !open) })
    } else if (tag.kind === 'ladder') {
      out.push({ id: owner || 'echelle', kind: 'ladder', label: PROMPTS.monter, key: 'interact', dist: hit.distance + 0.3, run: () => undefined })
    }
  }

  const roomFallbacks = (out: Candidate[]) => {
    const room = ctx.state.hero.room
    if (!room) return
    const add = (id: string, kind: Candidate['kind'], label: string, dist: number, run: () => void) => {
      if (!out.some((c) => c.kind === kind)) out.push({ id, kind, label, key: 'interact', dist, run })
    }
    const drift = ctx.services.drift
    const spawnDist = () => (drift ? dist3(gp.heroPos(), drift.roomSpawn(room).position) : 0)
    switch (room as RoomId) {
      case 'sas':
        add('sas', 'airlock', PROMPTS.sortir, 2.5, () => void airlock('out'))
        if (gp.quests.step('a1-reveil') === 'tableau') add('tableau', 'npc', PROMPTS.tableau, 2.2, () => gp.quests.talk('mme-rouille'))
        break
      case 'cabine':
        if (spawnDist() < 2.5) add('lit', 'bed', PROMPTS.dormir, 2.4, () => gp.menus.sleep())
        break
      case 'salle-des-cartes':
        add('table-carte', 'chart-table', PROMPTS.carte, 2.6, () => gp.quests.chartTable())
        break
      case 'marche':
        add('etal', 'stall', PROMPTS.etal, 2.6, () => gp.menus.market('etal'))
        break
      case 'cuisine':
        add('marmite-cuisine', 'marmite', PROMPTS.cuisiner, 2.7, () => gp.quests.talk('cuistot'))
        break
      case 'echelle-toit':
        add('trappe', 'airlock', PROMPTS.sortir, 2.5, () => void airlock('out', 'echelle-toit'))
        break
      default:
        break
    }
  }

  const api: Indoor = {
    airlock: (dir) => airlock(dir),
    async returnToLock() {
      await gp.travel.returnToCabin()
    },
    candidates(out) {
      const h = ctx.state.hero
      const drift = ctx.services.drift
      if (h.medium === 'water') {
        if (h.sortie?.lockId === 'dome-proue' || !h.sortie && ctx.state.mode !== 'sortie') return
        const lock = gp.driftLock()
        const d = dist3(gp.heroPos(), lock)
        if (d < LOCK_REACH) out.push({ id: 'sas', kind: 'airlock', label: PROMPTS.entrerSas, key: 'interact', dist: d, run: () => void airlock('in') })
        else out.push({ id: 'longe', kind: 'airlock', label: PROMPTS.rentrer, key: 'interact', dist: 9, hold: true, run: () => void reelIn() })
        return
      }
      rayDoor(out)
      roomFallbacks(out)
      if (drift) {
        const p = gp.heroPos()
        for (const id of NPC_IDS) {
          const np = drift.npcPosition(id)
          if (!np) continue
          const d = dist3(p, np)
          if (d < NPC_REACH) out.push({ id, kind: 'npc', label: PROMPTS.parler, key: 'interact', dist: d - 0.6, run: () => gp.quests.talk(id) })
        }
      } else if (h.room) {
        const byRoom: Partial<Record<RoomId, string>> = { sas: 'mme-rouille', cuisine: 'cuistot', rebord: 'mila', 'salle-des-cartes': 'grand-pere' }
        const npc = byRoom[h.room]
        if (npc) out.push({ id: npc, kind: 'npc', label: PROMPTS.parler, key: 'interact', dist: 1.5, run: () => gp.quests.talk(npc) })
      }
    },
    update(dt) {
      const h = ctx.state.hero
      if (h.medium === 'water' && h.sortie && h.sortie.lockId !== 'dome-proue' && ctx.input.down('interact') && !gp.busy()) {
        reelHold += dt
        gp.hud.progress(Math.min(1, reelHold / REEL_HOLD))
        if (reelHold >= REEL_HOLD) {
          reelHold = 0
          const lock = gp.driftLock()
          if (dist3(gp.heroPos(), lock) >= LOCK_REACH) void reelIn()
        }
      } else reelHold = 0
    },
  }
  return api
}
