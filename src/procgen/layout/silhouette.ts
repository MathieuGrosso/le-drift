import * as THREE from 'three'
import type { Mats } from '../../drift/materials'
import type { DistrictPlan } from '../types'
import { SILHOUETTE } from './tuning'

// Far massing: one capsule per district inscribed in its box, hidden once the district is built.
export function buildSilhouette(plans: readonly DistrictPlan[], mats: Mats): { mesh: THREE.InstancedMesh; hide(i: number, hidden: boolean): void; dispose(): void } {
  const geo = new THREE.CapsuleGeometry(0.5, 1, 6, 16).rotateX(Math.PI / 2)
  const mesh = new THREE.InstancedMesh(geo, mats.cel({ color: SILHOUETTE.color, rim: 0.8 }), plans.length)
  mesh.name = 'arrondissements-lointains'
  const shown: THREE.Matrix4[] = []
  const m = new THREE.Matrix4()
  plans.forEach((p, i) => {
    const b = p.bounds
    const w = b.x1 - b.x0 - SILHOUETTE.bulge
    const h = b.y1 - b.y0 - 2
    const d = b.z1 - b.z0 - SILHOUETTE.bulge
    m.compose(new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(w, h, d / 2))
    shown.push(m.clone())
    mesh.setMatrixAt(i, m)
  })
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  return {
    mesh,
    hide(i, hidden) {
      mesh.setMatrixAt(i, hidden ? zero : shown[i]!)
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      mesh.removeFromParent()
      geo.dispose()
    },
  }
}
