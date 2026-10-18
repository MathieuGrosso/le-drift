import type { Vec3 } from '../core/types'
import type { Gp, Travel } from './context'
import { DOME_DISTRICT } from './world/sites'

type Station = { id: string; at: Vec3; station: string }
type HeroTube = { tube?(toLocal: Vec3, yaw: number): Promise<void> }

// Drift owns the tube cars and zip lines (rides open like doors). Gameplay adds the chart's fast travel
// between stations the player has opened, and « Retour à la cabine ».
export function createTravel(gp: Gp): Travel {
  const ctx = gp.ctx
  let stations: Station[] = []
  let scanned = -1

  const scan = () => {
    if (ctx.clock.frame - scanned < 300 && stations.length > 0) return stations
    scanned = ctx.clock.frame
    const out: Station[] = []
    for (const a of gp.sites.near({ x: 0, y: 0, z: 0 }, 1000)) if (a.kind === 'tube') out.push({ id: a.id, at: a.at, station: a.station })
    stations = out
    return stations
  }

  const districtOf = (s: Station) => ctx.services.drift?.districtAt(s.at) ?? 'ecluse'
  const open = (s: Station) => {
    const d = districtOf(s)
    const st = ctx.state
    if (d === 'ecluse' || d === 'nef') return st.act >= 2 || st.quests['a1-poulie'] === 'carte' || st.quests['a1-poulie'] === 'done'
    if (d === 'proue') return st.act >= 3
    const dome = Object.entries(DOME_DISTRICT).find(([, v]) => v === d)?.[0]
    return st.act >= 2 && (!dome || gp.progress().domes.includes(dome) || gp.progress().tubes.includes(s.id))
  }

  const teleportLocal = async (p: Vec3, yaw: number) => {
    const hero = ctx.services.hero as (NonNullable<typeof ctx.services.hero> & HeroTube) | undefined
    if (hero?.tube) return hero.tube(p, yaw)
    gp.lock.count++
    try {
      await gp.cine.fade('black', 0.5)
      if (hero) hero.teleportLocal(p, yaw)
      else ctx.state.hero.localPosition = { ...p }
      await gp.cine.wait(0.3)
      await gp.cine.fade(null, 0.6)
    } finally {
      gp.lock.count--
    }
  }

  ctx.bus.on('district:entered', () => {
    for (const s of scan()) if (open(s) && !gp.progress().tubes.includes(s.id)) gp.progress().tubes.push(s.id)
  })

  return {
    stationOpen: (id) => {
      const s = scan().find((x) => x.id === id)
      return !!s && open(s)
    },
    openStations: () => scan().filter(open).map((s) => s.id),
    stations: () => scan().map((s) => ({ id: s.id, at: s.at, name: s.station, open: open(s) })),
    async goStation(id) {
      const s = scan().find((x) => x.id === id)
      if (!s || !open(s)) return
      gp.emit('tube:travel', { from: 'carte', to: id })
      gp.sfx('tube')
      await teleportLocal({ x: s.at.x, y: s.at.y, z: s.at.z + 1.2 }, 0)
    },
    async returnToCabin() {
      const spawn = ctx.services.drift?.cellSpawn('cabine') ?? { local: { x: -7, y: 0, z: 65.4 }, yaw: 0 }
      ctx.state.hero.wetness = 0
      await teleportLocal(spawn.local, spawn.yaw)
    },
  }
}
