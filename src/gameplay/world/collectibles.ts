import * as THREE from 'three'
import { CAMPS, REGIONS } from '../../core/layout'
import type { RegionId, Vec3 } from '../../core/types'
import { dist3, distXZ, type Candidate, type Collectibles, type Gp } from '../context'
import { itemName } from '../inventory'
import { PROMPTS, trouvailleText } from '../text/fr'
import { celMat, disposeMesh, setInstance } from './materials'

const TROUVAILLES = 60
const PICKUPS = 140
const REACH = 2.4

const REGION_FORAGE: Record<RegionId, readonly string[]> = {
  prairie: ['algue-rouge', 'moule', 'crevette', 'algue-rouge'],
  laminaires: ['algue-doree', 'oursin', 'algue-doree'],
  pilier: ['crevette', 'moule', 'oursin'],
  cheminee: ['sel-de-cheminee', 'crevette', 'sel-de-cheminee'],
  coques: ['moule', 'oursin', 'moule'],
  blanc: ['plancton', 'plancton', 'algue-rouge'],
  bleu: ['plancton'],
}
const FORAGE_COLOR: Record<string, number> = {
  'algue-rouge': 0xd8644e, 'algue-doree': 0xc79a3b, oursin: 0x6e4a8a, moule: 0x2f3a5a, crevette: 0xf7b267,
  'sel-de-cheminee': 0xf4f1e6, plancton: 0x6ff0e0, poisson: 0x9fb8c8,
}
const WARM = [0xf08a7e, 0xf7b267, 0xffd9a0, 0xb784c9, 0xe3b95f, 0x6e8fb0] as const

interface Spot { id: string; pos: Vec3; item: string }

export function createCollectibles(gp: Gp): Collectibles {
  const ctx = gp.ctx
  const world = ctx.services.world
  const ground = (x: number, z: number) => world?.heightAt(x, z) ?? 0
  const regionAt = (x: number, z: number): RegionId => {
    if (world) return world.regionAt(x, z)
    let best: RegionId = 'prairie'
    let bd = Infinity
    for (const [id, c] of Object.entries(REGIONS) as [RegionId, { x: number; z: number }][]) {
      const d = distXZ({ x, z }, c)
      if (d < bd) {
        bd = d
        best = id
      }
    }
    return best
  }
  const group = new THREE.Group()
  group.name = 'gameplay-trouvailles'
  ctx.scene.add(group)

  const rt = ctx.rng('trouvailles')
  const finds: Spot[] = []
  for (let i = 0; i < TROUVAILLES; i++) {
    const x = i < 20 ? -600 + rt() * 1200 : -900 + rt() * 1800
    const z = i < 20 ? 300 + rt() * 600 : -930 + rt() * 1830
    const id = `tr-${String(i + 1).padStart(2, '0')}`
    finds.push({ id, pos: { x, y: ground(x, z) + 0.45, z }, item: `trouvaille:${id}` })
  }
  const rp = ctx.rng('cueillette')
  const forage: Spot[] = []
  for (let i = 0; i < PICKUPS; i++) {
    const camp = CAMPS[i % CAMPS.length]!
    const near = i < 40
    const x = near ? camp.x + (rp() - 0.5) * 120 : -900 + rp() * 1800
    const z = near ? camp.z + (rp() - 0.5) * 120 : -920 + rp() * 1820
    const list = REGION_FORAGE[regionAt(x, z)]
    const item = i % 9 === 0 ? 'poisson' : list[Math.floor(rp() * list.length)]!
    forage.push({ id: `cueillette-${i}`, pos: { x, y: ground(x, z) + 0.3, z }, item })
  }
  const marmites: Spot[] = CAMPS.map((c, i) => ({ id: `marmite-${i}`, pos: { x: c.x, y: ground(c.x, c.z), z: c.z }, item: '' }))

  const findMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.34, 0), celMat(ctx, { color: 0xffffff, emissive: 0x2a1a08, rim: 1 }), TROUVAILLES)
  finds.forEach((f, i) => findMesh.setColorAt(i, new THREE.Color(WARM[i % WARM.length]!)))
  const glintGeo = new THREE.BufferGeometry()
  const glintPos = new Float32Array(TROUVAILLES * 3)
  glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3))
  const glintMat = new THREE.PointsMaterial({ color: 0xfff1c9, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
  const glints = new THREE.Points(glintGeo, glintMat)
  glints.frustumCulled = false
  const forageMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 7).scale(1, 0.7, 1), celMat(ctx, { color: 0xffffff, rim: 0.6 }), PICKUPS)
  forage.forEach((f, i) => forageMesh.setColorAt(i, new THREE.Color(FORAGE_COLOR[f.item] ?? 0xffffff)))
  const potMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.55, 0.8, 14).translate(0, 0.4, 0), celMat(ctx, { color: 0x5e4a5c, emissive: 0x401a08, rim: 0.6 }), marmites.length)
  marmites.forEach((m, i) => setInstance(potMesh, i, m.pos, 1))
  potMesh.instanceMatrix.needsUpdate = true
  group.add(findMesh, glints, forageMesh, potMesh)

  const taken = new Set<string>()
  let takenDay = ctx.state.time.day
  let time = 0
  let refresh = true

  const found = (id: string) => ctx.state.trouvailles.includes(id)

  const pickFind = (f: Spot, index: number) => {
    if (found(f.id)) return
    ctx.state.trouvailles.push(f.id)
    gp.inv.give(f.item, 1, true)
    const t = trouvailleText(index)
    gp.toast(`Trouvaille : ${t.nom}`)
    gp.hud.tip(t.enfants, 5)
    gp.sfx('trouvaille', f.pos)
    ctx.bus.emit('collectible:found', { id: f.id })
    if (ctx.state.trouvailles.length % 5 === 0) {
      ctx.state.inventory.slots += 1
      gp.toast('Ton sac s’agrandit : une place de plus')
    }
    refresh = true
  }

  const api: Collectibles = {
    candidates(out: Candidate[]) {
      const hero = gp.heroPos()
      finds.forEach((f, i) => {
        if (found(f.id)) return
        const d = dist3(hero, f.pos)
        if (d < REACH) out.push({ id: f.id, kind: 'item', label: PROMPTS.ramasser, key: 'interact', dist: d, run: () => pickFind(f, i) })
      })
      for (const f of forage) {
        if (taken.has(f.id)) continue
        const d = dist3(hero, f.pos)
        if (d >= REACH) continue
        out.push({
          id: f.id, kind: 'item', label: `${PROMPTS.ramasser} · ${itemName(f.item)}`, key: 'interact', dist: d,
          run: () => {
            if (!gp.inv.give(f.item, 1)) return
            taken.add(f.id)
            gp.sfx('cueillette', f.pos)
            refresh = true
          },
        })
      }
      for (const m of marmites) {
        const d = dist3(hero, m.pos)
        if (d < 3) out.push({ id: m.id, kind: 'marmite', label: PROMPTS.cuisiner, key: 'interact', dist: d, run: () => void gp.menus.cook() })
      }
    },
    update(dt) {
      time += dt
      if (ctx.state.time.day !== takenDay) {
        takenDay = ctx.state.time.day
        taken.clear()
        refresh = true
      }
      if (refresh) {
        refresh = false
        forage.forEach((f, i) => setInstance(forageMesh, i, f.pos, taken.has(f.id) ? 0 : 1))
        forageMesh.instanceMatrix.needsUpdate = true
        if (forageMesh.instanceColor) forageMesh.instanceColor.needsUpdate = true
      }
      finds.forEach((f, i) => {
        const gone = found(f.id)
        const bob = Math.sin(time * 1.8 + i) * 0.08
        setInstance(findMesh, i, { x: f.pos.x, y: f.pos.y + bob, z: f.pos.z }, gone ? 0 : 1, { y: time * 0.8 + i })
        glintPos[i * 3] = f.pos.x
        glintPos[i * 3 + 1] = gone ? -999 : f.pos.y + 0.55 + bob
        glintPos[i * 3 + 2] = f.pos.z
      })
      findMesh.instanceMatrix.needsUpdate = true
      ;(glintGeo.attributes['position'] as THREE.BufferAttribute).needsUpdate = true
      glintMat.opacity = 0.45 + 0.4 * Math.abs(Math.sin(time * 2.3))
    },
    dispose() {
      disposeMesh(group)
    },
  }
  return api
}
