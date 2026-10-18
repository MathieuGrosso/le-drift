import * as THREE from 'three'
import type { HeroService, Vec3 } from '../../core/types'
import type { Candidate, Gp } from '../context'
import type { Scrub } from '../scrub'
import { PROMPTS, UI } from '../text/fr'
import { createAttach } from './attach'

export const PROUE_PANES = 4
const DOME = { x: 0, y: 24.9, z: -61, r: 7.5 }
const LEASH = 17
const PANE_SIZE = 2.6
const AZIMUTHS = [-0.55, 0.55, -1.75, 1.75]
const ELEVATION = 0.62

type HeroExt = HeroService & { gesture?(clip: string, seconds?: number): void }

// The last sortie (BIBLE §3, a3-dome-proue): out through the dome's top hatch, no lock, no ring,
// four furred panes to scrub in the rain while Grand-père waits under the glass.
export interface Proue {
  scrubbed(): number
  candidates(out: Candidate[]): void
  update(dt: number): void
}

function furTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 62)
  grad.addColorStop(0, 'rgba(111,143,78,0.95)')
  grad.addColorStop(0.7, 'rgba(96,128,70,0.8)')
  grad.addColorStop(1, 'rgba(80,110,60,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  let s = 7
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 56
    const x = 64 + Math.cos(a) * d
    const y = 64 + Math.sin(a) * d
    const l = 3 + r() * 6
    const t = a + (r() - 0.5) * 1.4
    g.strokeStyle = `rgba(${130 + r() * 60 | 0},${160 + r() * 50 | 0},${80 + r() * 40 | 0},${0.35 + r() * 0.5})`
    g.lineWidth = 1 + r()
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(t) * l, y + Math.sin(t) * l)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createProue(gp: Gp, scrub: Scrub): Proue {
  const ctx = gp.ctx
  const attach = createAttach(ctx, 'gameplay-proue')
  const coats = [1, 1, 1, 1]
  let meshes: THREE.Mesh[] = []
  let built = false
  let leashT = 0
  let outAt = -99

  const step = () => gp.quests.step('a3-dome-proue')
  const centre = (): Vec3 => {
    const s = ctx.services.drift?.cellSpawn('dome-proue')
    return s ? { x: s.local.x + DOME.r * 0.4, y: s.local.y + 0.9, z: s.local.z - DOME.r * 0.3 } : { x: DOME.x, y: DOME.y, z: DOME.z }
  }
  const panes = (): { at: Vec3; n: Vec3 }[] => {
    const c = centre()
    return AZIMUTHS.map((az) => {
      const n = { x: Math.sin(az) * Math.cos(ELEVATION), y: Math.sin(ELEVATION), z: -Math.cos(az) * Math.cos(ELEVATION) }
      return { n, at: { x: c.x + n.x * (DOME.r + 0.06), y: c.y + n.y * (DOME.r + 0.06), z: c.z + n.z * (DOME.r + 0.06) } }
    })
  }
  const done = () => coats.filter((c) => c <= 0.02).length

  const build = () => {
    built = true
    const tex = furTexture()
    const geo = new THREE.CircleGeometry(PANE_SIZE / 2, 24)
    const mat = attach.material(0xffffff, { map: tex, transparent: true, side: THREE.DoubleSide, outside: true })
    meshes = panes().map((p) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(p.at.x, p.at.y, p.at.z)
      m.lookAt(p.at.x + p.n.x, p.at.y + p.n.y, p.at.z + p.n.z)
      m.renderOrder = 3
      attach.group.add(m)
      return m
    })
    if (ctx.state.flags['proue-propre']) coats.fill(0)
  }

  const heroLocal = () => gp.heroLocal()
  const outside = () => ctx.state.flags['proue-dehors'] === true

  const goOut = async () => {
    gp.lock.count++
    try {
      gp.sfx('hatch-wheel')
      await gp.cine.fade('black', 0.7)
      const c = centre()
      ctx.state.flags['proue-dehors'] = true
      outAt = ctx.clock.elapsed
      ctx.services.hero?.teleportLocal({ x: c.x, y: c.y + DOME.r + 1.3, z: c.z + 0.4 }, Math.PI)
      gp.sfx('splash')
      await gp.cine.wait(0.3)
      await gp.cine.fade(null, 0.9)
      gp.hud.tip(UI.proueDehors, 5)
    } finally {
      gp.lock.count--
    }
  }

  const goIn = async () => {
    gp.lock.count++
    try {
      await gp.cine.fade('black', 0.7)
      ctx.state.flags['proue-dehors'] = false
      const s = ctx.services.drift?.cellSpawn('dome-proue')
      const c = centre()
      ctx.services.hero?.teleportLocal(s?.local ?? { x: c.x - 3, y: c.y - 0.9, z: c.z + 2.2 }, 0)
      ctx.state.hero.wetness = 1
      await gp.cine.fade(null, 0.9)
      ;(ctx.services.hero as HeroExt | undefined)?.gesture?.('hand-on-glass', 4)
    } finally {
      gp.lock.count--
    }
  }

  ctx.bus.on('sortie:start', () => {
    const h = ctx.state.hero
    if (outside() && h.sortie) {
      h.sortie.lockId = 'dome-proue'
      h.sortie.ring = 'dome-proue'
    }
  })

  scrub.addSource(() => {
    if (step() !== 'sortie' || !built) return null
    const hl = heroLocal()
    const list = panes()
    let best = -1
    let bd = 2.8
    list.forEach((p, i) => {
      const d = Math.hypot(p.at.x - hl.x, p.at.y - (hl.y + 1), p.at.z - hl.z)
      if (coats[i]! > 0.02 && d < bd) {
        bd = d
        best = i
      }
    })
    if (best < 0) return null
    const i = best
    return {
      id: `dome-proue-${i}`,
      coat: coats[i]!,
      scrub(a) {
        coats[i] = Math.max(0, coats[i]! - a)
        if (coats[i]! <= 0.02) {
          coats[i] = 0
          gp.sfx('glass-tap')
          ctx.bus.emit('scrub:done', { windowId: `dome-proue-${i}` })
          if (done() >= PROUE_PANES) ctx.state.flags['proue-propre'] = true
        }
        return coats[i]!
      },
    }
  })

  return {
    scrubbed: done,
    candidates(out) {
      const s = step()
      const h = ctx.state.hero
      if (s === 'sortie' && h.medium === 'air' && !outside()) {
        const cell = gp.sites.cellOf(heroLocal())
        const c = centre()
        const hl = heroLocal()
        const inDome = cell === 'dome-proue' || Math.hypot(hl.x - c.x, hl.z - c.z) < DOME.r && hl.y > c.y - 2
        if (inDome) out.push({ id: 'trappe-dome-proue', kind: 'airlock', label: PROMPTS.trappe, key: 'interact', dist: 3, run: () => void goOut() })
      }
      if (outside() && h.medium === 'water') {
        const label = done() >= PROUE_PANES ? PROMPTS.rentrerTrappe : PROMPTS.rentrerTrappeTot
        out.push({ id: 'trappe-dome-proue', kind: 'airlock', label, key: 'interact', dist: 8, run: () => void goIn() })
      }
    },
    update(dt) {
      attach.update()
      const want = ctx.state.act >= 3 && !ctx.state.flags['proue-propre']
      if (want && !built) build()
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i]!
        const k = coats[i]!
        m.visible = k > 0.02
        m.scale.setScalar(0.55 + 0.45 * k)
      }
      if (outside() && ctx.state.hero.medium === 'water' && !gp.busy()) {
        const c = centre()
        const hl = heroLocal()
        const d = Math.hypot(hl.x - c.x, hl.y - c.y, hl.z - c.z)
        leashT = d > LEASH ? leashT + dt : 0
        if (leashT > 1.2) {
          leashT = 0
          gp.hud.tip(UI.proueLongeCourte, 3)
          void goOut()
        }
      }
      if (outside() && ctx.state.hero.medium === 'air' && !gp.busy() && ctx.clock.elapsed - outAt > 4) ctx.state.flags['proue-dehors'] = false
    },
  }
}
