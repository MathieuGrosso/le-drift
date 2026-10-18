import * as THREE from 'three'
import { DRIFT_ROUTE } from '../core/layout'
import type { GameContext } from '../core/types'
import { makeMaterial } from './surface'
import { heightAt } from './terrain'
import { driftDeepShader } from './shade'

type Kind = 'caisse' | 'tonneau' | 'jarre'

const PAINTS = [0x9a7a55, 0x7d6448, 0xc46a4a, 0x4f6d7a, 0xd9b48f, 0x6e8fb0]
const COAT = new THREE.Color(0x5f8a52)

function geometryFor(kind: Kind): THREE.BufferGeometry {
  if (kind === 'caisse') return new THREE.BoxGeometry(1, 1, 1)
  if (kind === 'tonneau') {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 3)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const bulge = 1 + 0.12 * Math.cos(p.getY(i) * Math.PI)
      p.setX(i, p.getX(i) * bulge)
      p.setZ(i, p.getZ(i) * bulge)
    }
    g.computeVertexNormals()
    return g
  }
  const pts = [[0, 0], [0.3, 0.02], [0.48, 0.3], [0.42, 0.62], [0.16, 0.86], [0.14, 1]].map(([r, y]) => new THREE.Vector2(r!, y! - 0.5))
  return new THREE.LatheGeometry(pts, 10)
}

// What the Drift has dropped along its own groove, year after year: half-buried, furred with coat.
export class RouteDebris {
  readonly group = new THREE.Group()
  private readonly material: THREE.Material

  constructor(ctx: GameContext) {
    this.group.name = 'world-debris'
    const rng = ctx.rng('world:debris')
    this.material = makeMaterial(ctx, { color: 0xffffff, onShader: driftDeepShader })
    const items: Record<Kind, { m: THREE.Matrix4; c: THREE.Color }[]> = { caisse: [], tonneau: [], jarre: [] }
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (let i = 1; i < DRIFT_ROUTE.length; i++) {
      const a = DRIFT_ROUTE[i - 1]!
      const b = DRIFT_ROUTE[i]!
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const nx = -(b.z - a.z) / len
      const nz = (b.x - a.x) / len
      for (let d = 0; d < len; d += 7) {
        if (rng() > 0.3) continue
        const lateral = (rng() + rng() + rng() - 1.5) * 70
        const cluster = rng() < 0.3 ? 2 + Math.floor(rng() * 3) : 1
        for (let k = 0; k < cluster; k++) {
          const t = d / len
          const x = a.x + (b.x - a.x) * t + nx * lateral + (rng() - 0.5) * 6
          const z = a.z + (b.z - a.z) * t + nz * lateral + (rng() - 0.5) * 6
          const r = rng()
          const kind: Kind = r < 0.5 ? 'caisse' : r < 0.85 ? 'tonneau' : 'jarre'
          const k0 = kind === 'caisse' ? 0.8 + rng() * 0.9 : kind === 'tonneau' ? 0.9 + rng() * 0.5 : 0.6 + rng() * 0.5
          if (kind === 'caisse') s.set(k0 * (1 + rng() * 0.5), k0 * 0.8, k0)
          else s.set(k0, k0 * (kind === 'tonneau' ? 1.3 : 1.2), k0)
          const lying = kind !== 'caisse' && rng() < 0.6
          e.set(lying ? Math.PI / 2 + (rng() - 0.5) * 0.3 : (rng() - 0.5) * 0.4, rng() * Math.PI * 2, (rng() - 0.5) * 0.35)
          q.setFromEuler(e)
          p.set(x, heightAt(x, z) + s.y * (lying ? 0.15 : 0.2), z)
          const c = new THREE.Color(PAINTS[Math.floor(rng() * PAINTS.length)]!).lerp(COAT, 0.25 + rng() * 0.45)
          items[kind].push({ m: new THREE.Matrix4().compose(p, q, s), c })
        }
      }
    }
    for (const kind of Object.keys(items) as Kind[]) {
      const list = items[kind]
      if (list.length === 0) continue
      const mesh = new THREE.InstancedMesh(geometryFor(kind), this.material, list.length)
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m)
        mesh.setColorAt(i, it.c)
      })
      mesh.name = `world-debris-${kind}`
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      this.group.add(mesh)
    }
  }

  dispose(): void {
    for (const m of this.group.children) {
      const mesh = m as THREE.InstancedMesh
      mesh.geometry.dispose()
      mesh.dispose()
    }
    this.group.removeFromParent()
    this.material.dispose()
  }
}
