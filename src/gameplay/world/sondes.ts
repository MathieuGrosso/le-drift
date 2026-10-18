import * as THREE from 'three'
import { CEILING_Y, REGIONS, SONDES, type SondeDef } from '../../core/layout'
import type { Vec3 } from '../../core/types'
import { dist3, distXZ, type Candidate, type Gp, type Sondes } from '../context'
import { PROMPTS, REGION_NAMES, TIPS, UI } from '../text/fr'
import { addCollider, celMat, disposeMesh, fixedBody, glowMat, removeBody, setInstance, type StaticBody } from './materials'

const RING_STEP = 5
const DORMANT = new THREE.Color(0x6f8f4e)
const AWAKE = new THREE.Color(0xffc98a)
const COLUMN_DORMANT = new THREE.Color(0x7cc6bf)
const COLUMN_AWAKE = new THREE.Color(0xffd9a0)

interface Site extends SondeDef { base: number; index: number }

export function createSondes(gp: Gp): Sondes {
  const ctx = gp.ctx
  const world = ctx.services.world
  const group = new THREE.Group()
  group.name = 'gameplay-sondes'
  ctx.scene.add(group)
  const bodies: StaticBody[] = []

  const sites: Site[] = SONDES.map((s, index) => {
    const ground = world?.heightAt(s.x, s.z) ?? 0
    return { ...s, base: Math.min(ground, s.topY - 8), index }
  })

  const mast = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.75, 1.35, 1, 9, 1).translate(0, 0.5, 0),
    celMat(ctx, { color: 0xd9b48f, rim: 0.6 }),
    sites.length,
  )
  const ringCount = sites.reduce((n, s) => n + Math.max(1, Math.floor((s.topY - s.base) / RING_STEP)), 0)
  const rings = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1.25, 0.16, 6, 14).rotateX(Math.PI / 2),
    celMat(ctx, { color: 0xc46a4a }),
    ringCount,
  )
  const platform = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(3.6, 2.8, 0.7, 16),
    celMat(ctx, { color: 0x4f6d7a, rim: 0.5 }),
    sites.length,
  )
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  ctx.services.render?.patchWater(eyeMat)
  const eye = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 18, 12), eyeMat, sites.length)
  const column = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0),
    glowMat(0xffffff, 0.2),
    sites.length,
  )
  column.frustumCulled = false
  eye.frustumCulled = false

  let r = 0
  for (const s of sites) {
    const height = s.topY - s.base
    setInstance(mast, s.index, { x: s.x, y: s.base, z: s.z }, { x: 1, y: height, z: 1 })
    setInstance(platform, s.index, { x: s.x, y: s.topY, z: s.z }, 1)
    setInstance(eye, s.index, { x: s.x, y: s.topY + 1.6, z: s.z }, 1)
    for (let y = s.base + RING_STEP; y < s.topY - 1 && r < ringCount; y += RING_STEP) {
      const t = (y - s.base) / height
      setInstance(rings, r++, { x: s.x, y, z: s.z }, 1.05 - 0.4 * t)
    }
    const body = fixedBody(ctx, { x: s.x, y: s.base + height / 2, z: s.z })
    const R = ctx.physics.rapier
    const c1 = addCollider(ctx, body, R.ColliderDesc.cylinder(height / 2, 1.15), 'sonde', true, s.id)
    const c2 = addCollider(ctx, body, R.ColliderDesc.cylinder(0.35, 3.6).setTranslation(0, height / 2, 0), 'sonde', false, s.id)
    bodies.push({ body, colliders: [c1, c2] })
  }
  for (; r < ringCount; r++) setInstance(rings, r, { x: 0, y: -999, z: 0 }, 0)
  for (const m of [mast, rings, platform, eye, column]) {
    m.instanceMatrix.needsUpdate = true
    group.add(m)
  }

  const isAwake = (id: string) => ctx.state.chart.sondes.includes(id)
  const top = (s: Site): Vec3 => ({ x: s.x, y: s.topY + 0.35, z: s.z })
  const eyeColor = new THREE.Color()
  let visTimer = 0
  let activating: { site: Site; t: number; start: number } | null = null

  const refreshColumns = () => {
    const hero = ctx.state.hero.position
    for (const s of sites) {
      const awake = isAwake(s.id)
      const near = distXZ(hero, s) < 260
      const h = CEILING_Y - (s.topY + 1.6)
      const width = awake ? 1.4 : near ? 0.8 : 0
      setInstance(column, s.index, { x: s.x, y: s.topY + 1.6, z: s.z }, { x: width, y: h, z: width })
      column.setColorAt(s.index, awake ? COLUMN_AWAKE : COLUMN_DORMANT)
      eyeColor.copy(awake ? AWAKE : DORMANT)
      eye.setColorAt(s.index, eyeColor)
    }
    column.instanceMatrix.needsUpdate = true
    if (column.instanceColor) column.instanceColor.needsUpdate = true
    if (eye.instanceColor) eye.instanceColor.needsUpdate = true
  }
  refreshColumns()

  const activate = async (s: Site) => {
    if (isAwake(s.id) || activating) return
    gp.lock.count++
    gp.hud.showHud(false)
    gp.heroMode('cutscene')
    gp.cue('sonde')
    gp.sfx('sonde', top(s))
    ctx.state.chart.sondes.push(s.id)
    refreshColumns()
    activating = { site: s, t: 0, start: ctx.state.hero.yaw }
    ctx.bus.emit('sonde:activated', { sondeId: s.id, region: s.region })
    await gp.cine.wait(2.4)
    const region = s.region === 'bleu' ? 'prairie' : s.region
    await gp.cine.card(UI.sondeSous, REGION_NAMES[region], 2.6)
    await gp.chart.reveal(s.id)
    activating = null
    gp.camera.set(null)
    gp.heroMode('idle')
    gp.hud.showHud(true)
    gp.lock.count--
    if (!ctx.state.flags['tip-carte']) {
      ctx.state.flags['tip-carte'] = true
      gp.hud.tip(TIPS.carte(ctx.input.keyLabel('map')))
    }
  }

  const api: Sondes = {
    candidates(out: Candidate[]) {
      const head = gp.heroPos()
      for (const s of sites) {
        if (isAwake(s.id)) continue
        const d = dist3(head, top(s))
        if (d > 5) continue
        out.push({ id: s.id, kind: 'sonde', label: PROMPTS.sonde, key: 'interact', dist: d, run: () => void activate(s) })
      }
    },
    topOf(id) {
      const s = sites.find((x) => x.id === id)
      return s ? top(s) : null
    },
    update(dt) {
      visTimer -= dt
      if (visTimer <= 0) {
        visTimer = 0.5
        refreshColumns()
      }
    },
    lateUpdate(dt) {
      if (!activating) return
      activating.t += dt
      const s = activating.site
      const t = Math.min(1, activating.t / 10)
      const e = t * t * (3 - 2 * t)
      const center = s.region === 'bleu' ? { x: s.x, z: s.z } : REGIONS[s.region]
      const out = Math.atan2(center.x - s.x, -(center.z - s.z))
      const ang = activating.start + Math.PI + e * 1.4
      const radius = 9 + 26 * e
      const p = top(s)
      const pos = { x: p.x + Math.sin(ang) * radius, y: p.y + 3 + 12 * e, z: p.z - Math.cos(ang) * radius }
      const look = {
        x: p.x + Math.sin(out) * 60 * e,
        y: p.y + 1 - 18 * e,
        z: p.z - Math.cos(out) * 60 * e,
      }
      gp.camera.set({ position: pos, target: look, fov: 55 + 6 * e })
    },
    dispose() {
      disposeMesh(group)
      for (const b of bodies) removeBody(ctx, b)
    },
  }
  return api
}
