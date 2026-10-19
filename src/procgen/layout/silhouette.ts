import * as THREE from 'three'
import type { Mats } from '../../drift/materials'
import { ARCHETYPES } from '../archetypes'
import type { DistrictPlan, HullSpec } from '../types'
import { SILHOUETTE } from './tuning'

export interface Silhouette {
  mesh: THREE.InstancedMesh
  hide(i: number, hidden: boolean): void
  dispose(): void
}

const UP = new THREE.Vector3(0, 1, 0)

// Far LOD: every district's real hulls as one instanced capsule mesh, hidden per district once built.
export function buildSilhouette(plans: readonly DistrictPlan[], hullsOf: (plan: DistrictPlan) => readonly HullSpec[], mats: Mats): Silhouette {
  const lists = plans.map(hullsOf)
  const total = lists.reduce((s, l) => s + l.length, 0)
  const geo = new THREE.CapsuleGeometry(0.5, 1, SILHOUETTE.capSegments, SILHOUETTE.radial).rotateX(Math.PI / 2)
  const mesh = new THREE.InstancedMesh(geo, mats.cel({ color: 0xffffff, rim: 0.8 }), total)
  mesh.name = 'arrondissements-lointains'
  const ranges: (readonly [start: number, end: number])[] = []
  const shown: THREE.Matrix4[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const base = new THREE.Color(SILHOUETTE.color)
  const c = new THREE.Color()
  let k = 0
  lists.forEach((hulls, i) => {
    const start = k
    const tint = new THREE.Color(ARCHETYPES[plans[i]!.archetype].palette.metal)
    for (const h of hulls) {
      const top = h.center.y + h.ry
      const bottom = plans[i]!.bounds.y0
      m.compose(
        p.set(h.center.x, (top + bottom) / 2, h.center.z),
        q.setFromAxisAngle(UP, h.yaw),
        s.set(h.rx * 2 * SILHOUETTE.girth, top - bottom, h.length / 2),
      )
      shown.push(m.clone())
      mesh.setMatrixAt(k, m)
      mesh.setColorAt(k, c.copy(base).lerp(tint, SILHOUETTE.tint).offsetHSL(0, 0, ((k * 0.618) % 1 - 0.5) * SILHOUETTE.valueJitter))
      k++
    }
    ranges.push([start, k])
  })
  mesh.computeBoundingSphere()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  return {
    mesh,
    hide(i, hidden) {
      const [a, b] = ranges[i]!
      for (let j = a; j < b; j++) mesh.setMatrixAt(j, hidden ? zero : shown[j]!)
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      mesh.removeFromParent()
      mesh.dispose()
      geo.dispose()
    },
  }
}
