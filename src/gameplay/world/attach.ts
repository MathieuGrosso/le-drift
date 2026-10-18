import * as THREE from 'three'
import type { GameContext } from '../../core/types'

// A group in the Drift-local frame for gameplay's few props. Parented to drift's root when it exists,
// else it follows drift.pose() itself (translation + heading, never the visual sway).
export interface Attach {
  readonly group: THREE.Group
  material(color: number, opts?: { map?: THREE.Texture; transparent?: boolean; emissive?: number; side?: THREE.Side; outside?: boolean }): THREE.Material
  update(): void
  dispose(): void
}

export function createAttach(ctx: GameContext, name: string): Attach {
  const group = new THREE.Group()
  group.name = name
  let parented = false
  const mats: THREE.Material[] = []

  const tryParent = () => {
    const root = ctx.scene.getObjectByName('le-drift')
    if (root) {
      root.add(group)
      parented = true
    } else if (!group.parent) ctx.scene.add(group)
  }
  tryParent()

  return {
    group,
    material(color, opts = {}) {
      const render = ctx.services.render
      let m: THREE.Material
      if (render && !opts.emissive) {
        m = render.cel({
          color,
          indoor: !opts.outside,
          ...(opts.map ? { map: opts.map } : {}),
          ...(opts.transparent ? { transparent: true } : {}),
          ...(opts.side !== undefined ? { side: opts.side } : {}),
        })
      } else {
        m = new THREE.MeshBasicMaterial({
          color: opts.emissive ?? color,
          ...(opts.map ? { map: opts.map } : {}),
          transparent: !!opts.transparent || !!opts.emissive,
          ...(opts.side !== undefined ? { side: opts.side } : {}),
          ...(opts.emissive ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}),
        })
      }
      mats.push(m)
      return m
    },
    update() {
      if (!parented) {
        tryParent()
        if (parented) return
        const p = ctx.services.drift?.pose()
        if (!p) return
        group.position.set(p.position.x, p.position.y, p.position.z)
        group.rotation.set(0, -p.heading, 0)
      }
    },
    dispose() {
      group.removeFromParent()
      group.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
      for (const m of mats) m.dispose()
    },
  }
}
