import { BLEU_EDGE } from '../core/layout'
import type { RoomId } from '../core/types'
import { dist3, type Candidate, type Gp, type Indoor } from './context'
import { NPC_IDS, PROMPTS, ROOM_NAMES, TIPS, UI } from './text/fr'

const RAY_REACH = 2.4
const LOCK_REACH = 7
const NPC_REACH = 2.8

const BED = /^(lit|couchette|bunk|bed)/
const CHART = /^(table-carte|chart-table|carte)/
const STALL = /^(etal|stall|marche)/
const BOARD = /^(tableau|forecast)/
const SAS = /^(sas|airlock)/
const ROOF = /^(trappe|echelle-toit)/

export function createIndoor(gp: Gp): Indoor {
  const ctx = gp.ctx
  const seenRooms = new Set<string>()
  let bleuBusy = false

  ctx.bus.on('room:entered', ({ roomId }) => {
    const key = `${ctx.state.time.day}:${roomId}`
    if (seenRooms.has(key)) return
    seenRooms.add(key)
    gp.hud.placeName(ROOM_NAMES[roomId])
    if (roomId === 'sas' && !ctx.state.flags['tip-sas']) {
      ctx.state.flags['tip-sas'] = true
      gp.hud.tip(TIPS.sas(ctx.input.keyLabel('interact')))
    }
  })

  const fallbackMedium = (medium: 'air' | 'water', room: RoomId | null) => {
    const h = ctx.state.hero
    if (h.medium === medium) return
    h.medium = medium
    h.room = room
    if (medium === 'water') h.wetness = 1
    ctx.bus.emit('hero:medium', { medium })
    if (room) ctx.bus.emit('room:entered', { roomId: room })
  }

  const airlock = async (dir: 'in' | 'out', lockId: 'sas' | 'echelle-toit' = 'sas') => {
    gp.lock.count++
    try {
      const drift = ctx.services.drift
      if (drift) {
        gp.heroMode('airlock')
        if (ctx.input.down('interact')) gp.hud.tip(`[${ctx.input.keyLabel('interact')}] ×3`, 2)
        await drift.cycleAirlock(lockId, dir)
        gp.heroMode('idle')
      } else {
        await gp.cine.fade('black', 0.5)
        const lock = gp.driftLock()
        const p = dir === 'out' ? lock : { x: lock.x, y: lock.y + 6, z: lock.z - 6 }
        if (ctx.services.hero) ctx.services.hero.teleport(p)
        else ctx.state.hero.position = p
        await gp.cine.wait(0.3)
        await gp.cine.fade(null, 0.6)
      }
      if (!ctx.services.hero || !drift) fallbackMedium(dir === 'out' ? 'water' : 'air', dir === 'out' ? null : 'sas')
    } finally {
      gp.lock.count--
    }
  }

  const rayCandidate = (out: Candidate[]) => {
    const head = gp.headPos()
    const f = gp.heroForward()
    const down = { x: f.x, y: -0.35, z: f.z }
    const hit = ctx.physics.raycast(head, f, RAY_REACH) ?? ctx.physics.raycast(head, down, RAY_REACH + 0.4)
    const tag = hit?.tag
    if (!hit || !tag) return
    const owner = tag.ownerId ?? ''
    const drift = ctx.services.drift
    const d = hit.distance
    if (tag.kind === 'door' && owner) {
      const open = !!ctx.state.drift.doors[owner]
      out.push({ id: owner, kind: 'door', label: open ? PROMPTS.fermer : PROMPTS.ouvrir, key: 'interact', dist: d, run: () => drift?.openDoor(owner, !open) })
      return
    }
    if (tag.kind === 'ladder') {
      out.push({ id: owner || 'echelle', kind: 'ladder', label: PROMPTS.monter, key: 'interact', dist: d, run: () => gp.heroMode('ladder') })
      return
    }
    if (BED.test(owner)) {
      out.push({ id: owner, kind: 'bed', label: PROMPTS.dormir, key: 'interact', dist: d, run: () => gp.menus.sleep() })
      return
    }
    if (tag.kind === 'seat' && owner) {
      out.push({ id: owner, kind: 'seat', label: PROMPTS.asseoir, key: 'interact', dist: d, run: () => ctx.services.hero?.sit(owner) })
      return
    }
    if (CHART.test(owner)) {
      out.push({ id: owner, kind: 'chart-table', label: PROMPTS.carte, key: 'interact', dist: d, run: () => gp.quests.chartTable() })
      return
    }
    if (STALL.test(owner)) {
      out.push({ id: owner, kind: 'stall', label: PROMPTS.etal, key: 'interact', dist: d, run: () => gp.menus.market() })
      return
    }
    if (BOARD.test(owner)) {
      out.push({ id: owner, kind: 'npc', label: PROMPTS.tableau, key: 'interact', dist: d, run: () => gp.quests.talk('mme-rouille') })
      return
    }
    if (ROOF.test(owner)) {
      out.push({ id: owner, kind: 'airlock', label: PROMPTS.sortir, key: 'interact', dist: d, run: () => void airlock('out', 'echelle-toit') })
      return
    }
    if (SAS.test(owner)) out.push({ id: owner, kind: 'airlock', label: PROMPTS.sortir, key: 'interact', dist: d, run: () => void airlock('out') })
  }

  const roomFallbacks = (out: Candidate[]) => {
    const room = ctx.state.hero.room
    if (!room) return
    const add = (id: string, kind: Candidate['kind'], label: string, dist: number, run: () => void) => {
      if (!out.some((c) => c.kind === kind)) out.push({ id, kind, label, key: 'interact', dist, run })
    }
    const drift = ctx.services.drift
    const spawnDist = () => (drift ? dist3(gp.heroPos(), drift.roomSpawn(room).position) : 0)
    switch (room) {
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
        add('etal', 'stall', PROMPTS.etal, 2.6, () => gp.menus.market())
        break
      case 'cuisine':
        add('marmite-cuisine', 'marmite', PROMPTS.cuisiner, 2.7, () => gp.quests.talk('cuistot'))
        break
      case 'echelle-toit':
        add('trappe', 'airlock', PROMPTS.sortir, 2.5, () => void airlock('out', 'echelle-toit'))
        break
    }
  }

  const api: Indoor = {
    airlock: (dir) => airlock(dir),
    async returnToLock() {
      gp.lock.count++
      try {
        await gp.cine.fade('black', 0.6)
        const drift = ctx.services.drift
        const hero = ctx.services.hero
        const h = ctx.state.hero
        if (h.medium === 'air' && drift) {
          const spawn = drift.roomSpawn('sas')
          h.medium = 'air'
          h.room = 'sas'
          h.wetness = 0
          h.localPosition = drift.toLocal(spawn.position)
          if (hero) hero.teleport(spawn.position, spawn.yaw)
          else h.position = { ...spawn.position }
        } else {
          const p = gp.driftLock()
          if (hero) hero.teleport(p)
          else h.position = p
        }
        await gp.cine.wait(0.4)
        await gp.cine.fade(null, 0.8)
      } finally {
        gp.lock.count--
      }
    },
    candidates(out) {
      const h = ctx.state.hero
      const drift = ctx.services.drift
      if (h.medium === 'water') {
        const lock = gp.driftLock()
        const d = dist3(gp.heroPos(), lock)
        if (d < LOCK_REACH) out.push({ id: 'sas', kind: 'airlock', label: PROMPTS.entrerSas, key: 'interact', dist: d, run: () => void airlock('in') })
      } else {
        rayCandidate(out)
        roomFallbacks(out)
      }
      if (drift) {
        const p = gp.heroPos()
        for (const id of NPC_IDS) {
          const np = drift.npcPosition(id)
          if (!np) continue
          const d = dist3(p, np)
          if (d < NPC_REACH) out.push({ id, kind: 'npc', label: PROMPTS.parler, key: 'interact', dist: d - 0.5, run: () => gp.quests.talk(id) })
        }
      } else if (h.medium === 'air' && h.room) {
        const byRoom: Partial<Record<RoomId, string>> = {
          sas: 'mme-rouille', cuisine: 'cuistot', rebord: 'mila', 'salle-des-cartes': 'grand-pere',
        }
        const npc = byRoom[h.room]
        if (npc) out.push({ id: npc, kind: 'npc', label: PROMPTS.parler, key: 'interact', dist: 1.5, run: () => gp.quests.talk(npc) })
      }
    },
    update() {
      const h = ctx.state.hero
      if (bleuBusy || h.medium !== 'water' || ctx.state.flags['ending']) return
      if (h.position.z > BLEU_EDGE || h.position.x < -BLEU_EDGE) {
        bleuBusy = true
        void (async () => {
          gp.lock.count++
          try {
            await gp.cine.fade('black', 0.5)
            const safe = h.lastSafe
            const p = ctx.services.world?.safeSpawnNear(safe) ?? safe
            if (ctx.services.hero) ctx.services.hero.teleport(p)
            else h.position = { ...p }
            gp.hud.tip(UI.bleuRetour, 3)
            await gp.cine.fade(null, 0.5)
          } finally {
            gp.lock.count--
            bleuBusy = false
          }
        })()
      }
    },
  }
  return api
}
