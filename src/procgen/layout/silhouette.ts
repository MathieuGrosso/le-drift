import * as THREE from 'three'
import type { Mats } from '../../drift/materials'
import { PAL } from '../../drift/palette'
import { ARCHETYPES } from '../archetypes'
import type { DistrictPlan, HullSpec } from '../types'
import { LEVELS, SILHOUETTE } from './tuning'

export interface Silhouette {
  group: THREE.Group
  hide(i: number, hidden: boolean): void
  dispose(): void
}

const UP = new THREE.Vector3(0, 1, 0)

interface Ranged { mesh: THREE.InstancedMesh; ranges: (readonly [start: number, end: number])[]; shown: THREE.Matrix4[] }

function ranged(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, name: string): Ranged {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count))
  mesh.count = count
  mesh.name = name
  return { mesh, ranges: [], shown: [] }
}

// Far LOD: every district's real hulls as instanced capsules with rows of lit window cards, hidden per district once built.
export function buildSilhouette(plans: readonly DistrictPlan[], hullsOf: (plan: DistrictPlan) => readonly HullSpec[], mats: Mats): Silhouette {
  const lists = plans.map(hullsOf)
  const total = lists.reduce((s, l) => s + l.length, 0)
  const W = SILHOUETTE.windows
  const cardsOf = (h: HullSpec) => h.floors.length * 2 * Math.max(1, Math.floor((h.length * W.span) / W.every))
  const cardTotal = lists.reduce((s, l) => s + l.reduce((t, h) => t + cardsOf(h), 0), 0)
  const geo = new THREE.CapsuleGeometry(0.5, 1, SILHOUETTE.capSegments, SILHOUETTE.radial).rotateX(Math.PI / 2)
  const card = new THREE.PlaneGeometry(W.w, W.h)
  const hulls = ranged(geo, mats.cel({ color: 0xffffff, rim: 0.8 }), total, 'arrondissements-lointains')
  const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  const lit = ranged(card, glass, cardTotal, 'arrondissements-hublots')
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const qn = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const o = new THREE.Vector3()
  const base = new THREE.Color(SILHOUETTE.color)
  const warm = new THREE.Color(PAL.lampe)
  const dim = new THREE.Color(PAL.lampeChaude).multiplyScalar(W.dim)
  const c = new THREE.Color()
  let k = 0
  let w = 0
  lists.forEach((list, i) => {
    const plan = plans[i]!
    const h0 = k
    const w0 = w
    const tint = new THREE.Color(ARCHETYPES[plan.archetype].palette.metal)
    const bottom = plan.bounds.y0
    for (const h of list) {
      const top = h.center.y + h.ry
      const cy = (top + bottom) / 2
      const ry = (top - bottom) / 2
      const rx = h.rx * SILHOUETTE.girth
      q.setFromAxisAngle(UP, h.yaw)
      m.compose(p.set(h.center.x, cy, h.center.z), q, s.set(rx * 2, top - bottom, h.length / 2))
      hulls.shown.push(m.clone())
      hulls.mesh.setMatrixAt(k, m)
      hulls.mesh.setColorAt(k, c.copy(base).lerp(tint, SILHOUETTE.tint).offsetHSL(0, 0, ((k * 0.618) % 1 - 0.5) * SILHOUETTE.valueJitter))
      k++
      const n = Math.max(1, Math.floor((h.length * W.span) / W.every))
      for (const fy of h.floors) {
        const y = fy + LEVELS.haut.storey * W.sill
        const dy = (y - cy) / ry
        const off = rx * Math.sqrt(Math.max(0, 1 - dy * dy)) + W.lift
        for (const side of [-1, 1]) {
          qn.setFromAxisAngle(UP, h.yaw + (side * Math.PI) / 2)
          for (let a = 0; a < n; a++) {
            const along = ((a + 0.5) / n - 0.5) * h.length * W.span
            p.set(side * off, y - cy, along).applyQuaternion(q).add(o.set(h.center.x, cy, h.center.z))
            m.compose(p, qn, s.set(1, 1, 1))
            lit.shown.push(m.clone())
            lit.mesh.setMatrixAt(w, m)
            const r = (w * 0.754877) % 1
            lit.mesh.setColorAt(w, r < W.off ? c.copy(dim) : c.copy(warm).offsetHSL(0, 0, (r - 0.5) * W.jitter))
            w++
          }
        }
      }
    }
    hulls.ranges.push([h0, k])
    lit.ranges.push([w0, w])
  })
  const group = new THREE.Group()
  group.name = 'arrondissements-silhouettes'
  for (const r of [hulls, lit]) {
    r.mesh.computeBoundingSphere()
    group.add(r.mesh)
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  return {
    group,
    hide(i, hidden) {
      for (const r of [hulls, lit]) {
        const [a, b] = r.ranges[i]!
        for (let j = a; j < b; j++) r.mesh.setMatrixAt(j, hidden ? zero : r.shown[j]!)
        r.mesh.instanceMatrix.needsUpdate = true
      }
    },
    dispose() {
      group.removeFromParent()
      for (const r of [hulls, lit]) r.mesh.dispose()
      geo.dispose()
      card.dispose()
      glass.dispose()
    },
  }
}
