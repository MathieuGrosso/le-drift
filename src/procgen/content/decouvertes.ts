import * as THREE from 'three'
import type { Vec3 } from '../../core/types'
import { toWorld } from '../../drift/frame'
import type { ProcgenHost } from '../../drift/procgen-hook'
import type { ContentSet, DistrictPlan, ProcgenEvents } from '../types'
import { createArrivee } from './arrivee'
import { PHARE_KIT, kitDef, kitScale } from './landmarks'
import { EVENTS, SIGHT, TOUCH } from './tuning'

const MERVEILLE_RADIUS = 8
const PHARE_TOP_RADIUS = 4
const SIGHT_HEIGHT = 0.6

export type DecouverteKind = ProcgenEvents['procgen:decouverte']['kind']

export function toastFor(kind: DecouverteKind | 'phare' | 'evenement' | 'trouvaille', nom: string): { titre: string; sous: string } {
  switch (kind) {
    case 'evenement':
      return { titre: nom, sous: 'Ça commence tout près' }
    case 'trouvaille':
      return { titre: nom, sous: 'Une trouvaille' }
    case 'quartier':
      return { titre: nom, sous: 'Nouvel arrondissement' }
    case 'repere':
      return { titre: nom, sous: 'Repère aperçu au loin' }
    case 'vista':
      return { titre: nom, sous: 'Un point de vue' }
    case 'merveille':
      return { titre: nom, sous: 'Une merveille du Drift' }
    case 'phare':
      return { titre: nom, sous: 'La carte de grand-père s’éclaire' }
  }
}

export interface Decouvertes {
  update(dt: number, heroLocal: Vec3, sets: Iterable<ContentSet>): void
}

function inside(p: DistrictPlan, l: Vec3): boolean {
  const b = p.bounds
  return l.x >= b.x0 && l.x <= b.x1 && l.y >= b.y0 && l.y <= b.y1 && l.z >= b.z0 && l.z <= b.z1
}

// The streamer calls update each frame with the built districts' content; events go on the bus.
export function createDecouvertes(host: ProcgenHost, plans: readonly DistrictPlan[]): Decouvertes {
  const bus = host.ctx.bus as unknown as { emit<K extends keyof ProcgenEvents>(k: K, p: ProcgenEvents[K]): void }
  const known = new Set<string>(host.ctx.state.chart.reperes)
  const byId = new Map(plans.map((p) => [p.id, p]))
  const emitted = new Set<string>()
  const arrivee = createArrivee(host.ctx.uiRoot)
  let current: string | null = null
  let wait = 0
  let lastHour = host.ctx.state.time.hours
  const cam = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const tmp: Vec3 = { x: 0, y: 0, z: 0 }

  const discover = (id: string, nom: string, kind: DecouverteKind, district: string) => {
    if (known.has(id)) return
    known.add(id)
    bus.emit('procgen:decouverte', { id, nom, kind, district })
  }

  const visible = (target: Vec3): boolean => {
    const w = toWorld(host.pose(), target, tmp)
    const dx = w.x - cam.x
    const dy = w.y - cam.y
    const dz = w.z - cam.z
    const d = Math.hypot(dx, dy, dz)
    if (d > SIGHT.range || d < 1) return false
    if ((dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < SIGHT.cone) return false
    const hit = host.ctx.physics.raycast({ x: cam.x, y: cam.y, z: cam.z }, { x: dx / d, y: dy / d, z: dz / d }, d - 2)
    return hit === null
  }

  return {
    update(dt, hero, sets) {
      arrivee.update(dt)
      const here = plans.find((p) => inside(p, hero)) ?? null
      if ((here?.id ?? null) !== current) {
        current = here?.id ?? null
        if (here) {
          arrivee.enter(here)
          bus.emit('procgen:entered', { id: here.id, nom: here.nom, quartier: here.quartier, archetype: here.archetype })
          discover(here.id, here.nom, 'quartier', here.id)
        }
      }
      const hour = host.ctx.state.time.hours
      const step = (hour - lastHour + 24) % 24
      const crossed = (h: number) => step <= EVENTS.maxClockStep && (h - lastHour + 24) % 24 > 0 && (h - lastHour + 24) % 24 <= step
      for (const set of sets) {
        const plan = byId.get(set.district)
        if (!plan) continue
        for (const ev of set.events) {
          if (!ev.hours.some(crossed)) continue
          const site = set.points.find((p) => p.kind === 'merveille' && p.data?.evenement === ev.id)
          bus.emit('procgen:evenement', { id: `${plan.id}/${ev.id}`, nom: ev.nom, district: plan.id, quartier: plan.quartier, repere: site ? String(site.data?.repere) : null })
        }
        for (const p of set.points) {
          if (emitted.has(p.id)) continue
          const d = Math.hypot(p.at.x - hero.x, p.at.y - hero.y - TOUCH.chest, p.at.z - hero.z)
          if (p.kind === 'trouvaille' && d < TOUCH.trouvaille && !host.ctx.state.trouvailles.includes(p.id)) {
            emitted.add(p.id)
            bus.emit('procgen:trouvaille', { id: p.id, nom: p.nom ?? 'Une trouvaille', district: plan.id, defi: String(p.data?.defi ?? '') })
          } else if (p.kind === 'demande' && d < TOUCH.demande) {
            emitted.add(p.id)
            const s = (k: string) => String(p.data?.[k] ?? '')
            bus.emit('procgen:demande', { id: p.id, pnj: s('pnj'), titre: s('titre'), texte: s('texte'), objet: s('objet'), district: plan.id })
          }
        }
      }
      lastHour = hour
      wait -= dt
      if (wait > 0) return
      wait = SIGHT.pollEvery
      host.ctx.camera.getWorldPosition(cam)
      host.ctx.camera.getWorldDirection(fwd)
      for (const set of sets) {
        const plan = byId.get(set.district)
        if (!plan) continue
        for (const l of set.landmarks) {
          if (known.has(l.id)) continue
          const def = kitDef(l.kit)
          const top = { x: l.at.x, y: l.at.y + def.h * kitScale(def, plan, l.at.y) * SIGHT_HEIGHT, z: l.at.z }
          if (visible(top)) discover(l.id, l.nom, 'repere', set.district)
        }
        for (const p of set.points) {
          const d = Math.hypot(p.at.x - hero.x, p.at.y - hero.y, p.at.z - hero.z)
          if (p.kind === 'vista' && d < SIGHT.vistaRadius) discover(p.id, p.nom ?? plan.nom, 'vista', set.district)
          else if (p.kind === 'merveille' && d < MERVEILLE_RADIUS) discover(p.id, p.nom ?? plan.nom, 'merveille', set.district)
          else if (p.kind === 'phare' && !known.has(`${p.id}/allume`)) {
            const def = kitDef(PHARE_KIT)
            const topY = p.at.y + def.h * kitScale(def, plan, p.at.y) * 0.85
            if (Math.hypot(p.at.x - hero.x, topY - hero.y, p.at.z - hero.z) < PHARE_TOP_RADIUS) {
              known.add(`${p.id}/allume`)
              bus.emit('procgen:phare', { id: p.id, district: set.district })
            }
          }
        }
      }
    },
  }
}
