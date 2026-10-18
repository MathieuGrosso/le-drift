import * as THREE from 'three'
import { DRIFT_ROUTE, REGIONS } from '../core/layout'
import type { GameContext } from '../core/types'
import { valueNoise } from './noise'
import { heightAt } from './terrain'
import { driftDeepShader } from './shade'

const PAINTS = [0xc46a4a, 0xd9b48f, 0x4f6d7a, 0x6e8fb0, 0xd8644e, 0x8a6e4b]
const COAT = 0x5f8a52

interface Placed { x: number; z: number; l: number; barrel: boolean; yaw: number; roll: number; pitch: number }

const RUST = new THREE.Color(0x8a4a3a)
const BRASS = new THREE.Color(0xe8c89a)
const GLASS = new THREE.Color(0x1e3440)
const MOSS = new THREE.Color(COAT)

class Parts {
  readonly pos: number[] = []
  readonly col: number[] = []
  readonly idx: number[] = []

  add(g: THREE.BufferGeometry, color: THREE.Color): void {
    const flat = g.index ? g.toNonIndexed() : g
    const p = flat.getAttribute('position') as THREE.BufferAttribute
    const base = this.pos.length / 3
    for (let v = 0; v < p.count; v++) {
      this.pos.push(p.getX(v), p.getY(v), p.getZ(v))
      this.col.push(color.r, color.g, color.b)
      this.idx.push(base + v)
    }
    if (flat !== g) flat.dispose()
    g.dispose()
  }
}

function hullGeometry(barrel: boolean): THREE.BufferGeometry {
  const segZ = barrel ? 14 : 26
  const segA = 28
  const open = barrel ? 0.3 : 0.38
  const parts = new Parts()
  const { pos, col, idx } = parts
  const c = new THREE.Color()
  const profile = (t: number) => (barrel ? Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 6)), 0.5) : Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.55))
  const tear = (t: number) => open * (0.55 + 0.45 * Math.sin(t * 5.3 + 1.3)) * (1 - 0.6 * Math.abs(t)) * Math.PI * 2
  for (let i = 0; i <= segZ; i++) {
    const t = (i / segZ) * 2 - 1
    const r = 0.5 * Math.max(0.05, profile(t))
    const gap = tear(t)
    for (let j = 0; j <= segA; j++) {
      const a = gap / 2 + (j / segA) * (Math.PI * 2 - gap)
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      pos.push(x, y, t * 0.5)
      const seam = j % 4 === 0 || i % 3 === 0 ? 0.84 : 1
      c.setRGB(seam, seam, seam)
      const up = Math.max(0, y / 0.5)
      c.lerp(RUST, Math.max(0, -y / 0.5) * 0.45 * valueNoise(t * 9, j * 1.3, 403))
      c.lerp(MOSS, Math.min(0.75, up * up * (0.3 + 0.7 * valueNoise(t * 3, j * 0.6, 401))))
      col.push(c.r, c.g, c.b)
    }
  }
  const row = segA + 1
  for (let i = 0; i < segZ; i++) {
    for (let j = 0; j < segA; j++) {
      const a = i * row + j
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  }
  const ribs = barrel ? 4 : 8
  for (let k = 0; k < ribs; k++) {
    const t = ((k + 0.5) / ribs) * 1.6 - 0.8
    const r = 0.5 * profile(t) * 0.96
    const gap = tear(t)
    const arc = new THREE.TorusGeometry(r, 0.014, 4, 10, gap * 0.8).rotateZ(-gap * 0.4).translate(0, 0, t * 0.5)
    parts.add(arc, c.setHex(0x5e4a5c).lerp(MOSS, 0.25))
  }
  const portholes = barrel ? 4 : 9
  for (let k = 0; k < portholes; k++) {
    const t = ((k + 0.5) / portholes) * 1.4 - 0.7
    const r = 0.5 * profile(t)
    const a = Math.PI + 0.25
    const n = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
    const at = n.clone().multiplyScalar(r + 0.004).setZ(t * 0.5)
    const rim = new THREE.CircleGeometry(0.034, 10)
    rim.lookAt(n)
    rim.translate(at.x, at.y, at.z)
    parts.add(rim, BRASS)
    const pane = new THREE.CircleGeometry(0.024, 10)
    pane.lookAt(n)
    pane.translate(at.x + n.x * 0.003, at.y + n.y * 0.003, at.z)
    parts.add(pane, GLASS)
  }
  if (!barrel) {
    parts.add(new THREE.BoxGeometry(0.15, 0.2, 0.22).translate(0, 0.5, -0.08), c.setHex(0xe6d8be).lerp(MOSS, 0.45))
    parts.add(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 5).translate(0.03, 0.68, -0.12), BRASS)
    parts.add(new THREE.BoxGeometry(0.02, 0.12, 0.5).translate(0, -0.52, 0.04), c.setHex(0x5e4a5c))
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.BoxGeometry(0.012, 0.14, 0.03).translate(0, 0.07, 0)
      blade.rotateZ((b / 3) * Math.PI * 2 + 0.4)
      blade.translate(0, -0.02, 0.5)
      parts.add(blade, BRASS)
    }
  } else {
    for (const z of [-0.36, 0.36]) {
      parts.add(new THREE.TorusGeometry(0.47, 0.018, 4, 18).translate(0, 0, z), c.setHex(0x8a6e4b).lerp(RUST, 0.4))
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

function placements(rng: () => number): Placed[] {
  const out: Placed[] = []
  const add = (x: number, z: number) => {
    const barrel = rng() < 0.35
    const l = barrel ? [10, 14][Math.floor(rng() * 2)]! : [18, 24, 32][Math.floor(rng() * 3)]!
    out.push({ x, z, l, barrel, yaw: rng() * Math.PI * 2, roll: (rng() - 0.5) * 2.2, pitch: (rng() - 0.5) * 0.25 })
  }
  const halte = DRIFT_ROUTE.find((w) => w.id === 'halte-coques') ?? DRIFT_ROUTE[DRIFT_ROUTE.length - 1]!
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2
    const r = 45 + Math.sqrt(rng()) * 150
    add(halte.x + Math.cos(a) * r, halte.z + Math.sin(a) * r)
  }
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * 220
    add(REGIONS.coques.x + Math.cos(a) * r, REGIONS.coques.z + Math.sin(a) * r)
  }
  for (let i = 1; i < DRIFT_ROUTE.length; i++) {
    const a = DRIFT_ROUTE[i - 1]!
    const b = DRIFT_ROUTE[i]!
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    for (let d = 60; d < len; d += 140 + rng() * 120) {
      const t = d / len
      const side = rng() < 0.5 ? -1 : 1
      const lat = side * (40 + rng() * 80)
      add(a.x + (b.x - a.x) * t - ((b.z - a.z) / len) * lat, a.z + (b.z - a.z) * t + ((b.x - a.x) / len) * lat)
    }
  }
  return out
}

// Le Cimetière des Coques: hulls that stopped and let the coat take them, torn open on the floor.
export class Wrecks {
  readonly group = new THREE.Group()
  private readonly materials: THREE.Material[] = []

  constructor(ctx: GameContext) {
    this.group.name = 'world-epaves'
    const rng = ctx.rng('world:epaves')
    const mat = ctx.services.render
      ? ctx.services.render.cel({ color: 0xffffff, vertexColors: true, caustics: true, side: THREE.DoubleSide, rim: 0.5, onShader: driftDeepShader })
      : new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide })
    this.materials.push(mat)
    const all = placements(rng)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const tint = new THREE.Color()
    for (const barrel of [false, true]) {
      const list = all.filter((w) => w.barrel === barrel)
      if (list.length === 0) continue
      const mesh = new THREE.InstancedMesh(hullGeometry(barrel), mat, list.length)
      list.forEach((w, i) => {
        const diam = w.l * (barrel ? 0.62 : 0.34)
        s.set(diam, diam * (barrel ? 1 : 0.92), w.l)
        e.set(w.pitch, w.yaw, w.roll * 0.6, 'YXZ')
        q.setFromEuler(e)
        const floor = Math.min(heightAt(w.x, w.z), heightAt(w.x + 4, w.z), heightAt(w.x, w.z + 4))
        p.set(w.x, floor + diam * (0.18 + rng() * 0.12), w.z)
        m.compose(p, q, s)
        mesh.setMatrixAt(i, m)
        tint.setHex(PAINTS[Math.floor(rng() * PAINTS.length)]!).lerp(MOSS, 0.08 + rng() * 0.2).multiplyScalar(0.9 + rng() * 0.2)
        mesh.setColorAt(i, tint)
      })
      mesh.name = barrel ? 'world-epaves-tonneaux' : 'world-epaves-quilles'
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      this.group.add(mesh)
    }
  }

  dispose(): void {
    for (const o of this.group.children) {
      const mesh = o as THREE.InstancedMesh
      mesh.geometry.dispose()
      mesh.dispose()
    }
    for (const m of this.materials) m.dispose()
    this.group.removeFromParent()
  }
}
