import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { NEF_VOID } from '../core/layout'
import type { CellId, ColliderKind, GameContext, Vec3 } from '../core/types'
import { GeoBuilder } from './builder'
import type { Mats } from './materials'
import { PAL } from './palette'

const V = NEF_VOID
const LEVELS = [8, 16] as const
const MAT_R = 2.2
const PLATFORM_R = 5
const GAL = 4
const STAIR = { x0: -27.6, x1: -24.4, z0: -12, z1: 4 }

interface Box { c: Vec3; h: Vec3; kind: ColliderKind; rotX?: number }

// La Grande Nef: the open atrium every deck looks onto. Walkable galleries, bridges to the Mât, nets under them.
export class Nef {
  readonly group = new THREE.Group()
  private body: RAPIER.RigidBody | null = null
  private readonly lamps: { local: THREE.Vector3; world: THREE.Vector3; color: THREE.Color; radius: number }[] = []
  private readonly boxes: Box[] = []

  constructor(private readonly ctx: GameContext, mats: Mats, parent: THREE.Object3D, pose: { position: Vec3; heading: number }) {
    this.group.name = 'nef'
    parent.add(this.group)
    const b = new GeoBuilder()
    b.jitter = 0.04
    const wood = new THREE.Color(PAL.bois)
    const woodDark = new THREE.Color(PAL.boisOmbre)
    const brass = new THREE.Color(PAL.laiton)
    const rope = new THREE.Color(PAL.corde)

    const floor = (x0: number, x1: number, z0: number, z1: number, y: number) => {
      b.box((x0 + x1) / 2, y - 0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, wood)
      b.box((x0 + x1) / 2, y - 0.45, (z0 + z1) / 2, x1 - x0 - 0.2, 0.3, z1 - z0 - 0.2, woodDark)
      this.boxes.push({ c: { x: (x0 + x1) / 2, y: y - 0.15, z: (z0 + z1) / 2 }, h: { x: (x1 - x0) / 2, y: 0.15, z: (z1 - z0) / 2 }, kind: 'interior' })
    }
    const rail = (x0: number, z0: number, x1: number, z1: number, y: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const rot = Math.atan2(x1 - x0, z1 - z0)
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      b.box(cx, y + 1.0, cz, 0.08, 0.08, len, brass, rot)
      b.box(cx, y + 0.5, cz, 0.04, 0.04, len, brass, rot)
      const posts = Math.max(2, Math.round(len / 2))
      for (let i = 0; i <= posts; i++) {
        const t = i / posts
        b.box(x0 + (x1 - x0) * t, y + 0.5, z0 + (z1 - z0) * t, 0.07, 1.0, 0.07, brass)
      }
      const horizontal = Math.abs(z1 - z0) < 0.01
      this.boxes.push({
        c: { x: cx, y: y + 0.55, z: cz },
        h: { x: horizontal ? len / 2 : 0.06, y: 0.55, z: horizontal ? 0.06 : len / 2 },
        kind: 'interior',
      })
    }

    for (const y of LEVELS) {
      const top = y === 16
      const sx0 = V.x0 + GAL
      const sx1 = V.x1 - GAL
      if (top) {
        floor(V.x0, V.x0 + GAL, V.z0, STAIR.z0, y)
        floor(V.x0, V.x0 + GAL, STAIR.z1, V.z1, y)
      } else floor(V.x0, V.x0 + GAL, V.z0, V.z1, y)
      floor(V.x1 - GAL, V.x1, V.z0, V.z1, y)
      floor(sx0, sx1, V.z0, V.z0 + GAL, y)
      floor(sx0, sx1, V.z1 - GAL, V.z1, y)
      const bridgeW = 1.2
      if (y === 8) {
        floor(-bridgeW, bridgeW, V.z0 + GAL, -PLATFORM_R + 0.5, y)
        floor(-bridgeW, bridgeW, PLATFORM_R - 0.5, V.z1 - GAL, y)
        rail(-bridgeW, V.z0 + GAL, -bridgeW, -PLATFORM_R + 0.6, y)
        rail(bridgeW, V.z0 + GAL, bridgeW, -PLATFORM_R + 0.6, y)
        rail(-bridgeW, PLATFORM_R - 0.6, -bridgeW, V.z1 - GAL, y)
        rail(bridgeW, PLATFORM_R - 0.6, bridgeW, V.z1 - GAL, y)
        rail(sx0, V.z0 + GAL, -bridgeW, V.z0 + GAL, y)
        rail(bridgeW, V.z0 + GAL, sx1, V.z0 + GAL, y)
        rail(sx0, V.z1 - GAL, -bridgeW, V.z1 - GAL, y)
        rail(bridgeW, V.z1 - GAL, sx1, V.z1 - GAL, y)
        rail(sx0, V.z0 + GAL, sx0, V.z1 - GAL, y)
        rail(sx1, V.z0 + GAL, sx1, V.z1 - GAL, y)
      } else {
        floor(sx0, -PLATFORM_R + 0.5, -bridgeW, bridgeW, y)
        floor(PLATFORM_R - 0.5, sx1, -bridgeW, bridgeW, y)
        rail(sx0, -bridgeW, -PLATFORM_R + 0.6, -bridgeW, y)
        rail(sx0, bridgeW, -PLATFORM_R + 0.6, bridgeW, y)
        rail(PLATFORM_R - 0.6, -bridgeW, sx1, -bridgeW, y)
        rail(PLATFORM_R - 0.6, bridgeW, sx1, bridgeW, y)
        rail(sx0, V.z0 + GAL, sx1, V.z0 + GAL, y)
        rail(sx0, V.z1 - GAL, sx1, V.z1 - GAL, y)
        rail(sx0, V.z0 + GAL, sx0, -bridgeW, y)
        rail(sx0, bridgeW, sx0, V.z1 - GAL, y)
        rail(sx1, V.z0 + GAL, sx1, -bridgeW, y)
        rail(sx1, bridgeW, sx1, V.z1 - GAL, y)
      }
      const plat = new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R, 0.3, 24)
      b.add(plat, new THREE.Matrix4().makeTranslation(0, y - 0.15, 0), wood)
      this.boxes.push({ c: { x: 0, y: y - 0.15, z: 0 }, h: { x: PLATFORM_R * 0.92, y: 0.15, z: PLATFORM_R * 0.92 }, kind: 'interior' })
      const ring = new THREE.TorusGeometry(PLATFORM_R, 0.06, 4, 32)
      ring.rotateX(Math.PI / 2)
      b.add(ring, new THREE.Matrix4().makeTranslation(0, y + 1.0, 0), brass)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        this.lamps.push(this.lamp(Math.cos(a) * (MAT_R + 0.5), y + 2.6, Math.sin(a) * (MAT_R + 0.5), PAL.lampe, 10))
      }
      for (let z = V.z0 + 6; z <= V.z1 - 6; z += 12) {
        this.lamps.push(this.lamp(V.x0 + 1.2, y + 2.4, z, PAL.lampe, 8))
        this.lamps.push(this.lamp(V.x1 - 1.2, y + 2.4, z, PAL.lampeChaude, 8))
      }
    }

    const steps = 16
    const rise = LEVELS[1] - LEVELS[0]
    const run = STAIR.z1 - STAIR.z0
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps
      b.box((STAIR.x0 + STAIR.x1) / 2, LEVELS[0] + rise * (t0 + 0.5 / steps) - 0.12, STAIR.z0 + run * (t0 + 0.5 / steps), STAIR.x1 - STAIR.x0, 0.24, run / steps + 0.05, wood)
    }
    const slope = Math.atan2(rise, run)
    const half = Math.hypot(rise, run) / 2
    this.boxes.push({
      c: { x: (STAIR.x0 + STAIR.x1) / 2, y: (LEVELS[0] + LEVELS[1]) / 2 - 0.2, z: (STAIR.z0 + STAIR.z1) / 2 },
      h: { x: (STAIR.x1 - STAIR.x0) / 2, y: 0.12, z: half },
      kind: 'stair', rotX: -slope,
    })

    b.cyl(0, (-22 + 30) / 2, 0, MAT_R, 52, brass)
    for (let y = -20; y <= 28; y += 2.4) b.cyl(0, y, 0, MAT_R + 0.08, 0.12, new THREE.Color(PAL.rouille))
    for (const ry of [-6, 0, 24]) {
      const ring = new THREE.TorusGeometry(MAT_R + 0.6, 0.18, 6, 24)
      ring.rotateX(Math.PI / 2)
      b.add(ring, new THREE.Matrix4().makeTranslation(0, ry, 0), brass)
      this.lamps.push(this.lamp(MAT_R + 0.9, ry - 0.4, 0, PAL.lampe, 9))
    }
    this.boxes.push({ c: { x: 0, y: 4, z: 0 }, h: { x: MAT_R * 0.8, y: 26, z: MAT_R * 0.8 }, kind: 'pipe' })

    for (const ny of [5, 13]) {
      const inner = { x0: V.x0 + GAL, x1: V.x1 - GAL, z0: V.z0 + GAL, z1: V.z1 - GAL }
      this.boxes.push({ c: { x: (inner.x0 + inner.x1) / 2, y: ny, z: (inner.z0 + inner.z1) / 2 }, h: { x: (inner.x1 - inner.x0) / 2, y: 0.05, z: (inner.z1 - inner.z0) / 2 }, kind: 'net' })
    }

    const mat = mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, rim: 0.4 })
    const mesh = new THREE.Mesh(b.build(), mat)
    mesh.name = 'nef-structure'
    this.group.add(mesh)

    this.buildNets(rope)
    this.buildLights(mats)
    this.buildCanopy()
    this.buildColliders(pose)
  }

  private lamp(x: number, y: number, z: number, color: number, radius: number) {
    return { local: new THREE.Vector3(x, y, z), world: new THREE.Vector3(), color: new THREE.Color(color), radius }
  }

  private buildNets(rope: THREE.Color): void {
    const pts: number[] = []
    for (const ny of [5, 13]) {
      const x0 = V.x0 + GAL
      const x1 = V.x1 - GAL
      const z0 = V.z0 + GAL
      const z1 = V.z1 - GAL
      for (let x = x0; x <= x1 + 0.01; x += 1.6) pts.push(x, ny, z0, x, ny, z1)
      for (let z = z0; z <= z1 + 0.01; z += 1.6) pts.push(x0, ny, z, x1, ny, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: rope, transparent: true, opacity: 0.55 }))
    lines.name = 'nef-filets'
    this.group.add(lines)
  }

  private buildLights(mats: Mats): void {
    const lines: number[] = []
    const bulbs: THREE.Vector3[] = []
    const laundry: { p: THREE.Vector3; c: number }[] = []
    const cloth = [PAL.tissu1, PAL.tissu2, PAL.tissu3, PAL.blanc]
    const strings: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i < 6; i++) {
      const z = V.z0 + 6 + i * ((V.z1 - V.z0 - 12) / 5)
      strings.push([new THREE.Vector3(V.x0 + 1, 18.6 - (i % 2) * 6, z), new THREE.Vector3(V.x1 - 1, 18.2 - (i % 2) * 6, z + (i % 3 - 1) * 4)])
    }
    strings.push([new THREE.Vector3(V.x0 + 2, 18.2, V.z0 + 2), new THREE.Vector3(-0.5, 9.6, -PLATFORM_R)])
    strings.push([new THREE.Vector3(V.x1 - 2, 18.2, V.z1 - 2), new THREE.Vector3(0.5, 9.6, PLATFORM_R)])
    strings.forEach(([a, c], si) => {
      const n = 20
      const sag = a.distanceTo(c) * 0.05
      let prev = a.clone()
      for (let k = 1; k <= n; k++) {
        const t = k / n
        const p = a.clone().lerp(c, t)
        p.y -= Math.sin(t * Math.PI) * sag
        lines.push(prev.x, prev.y, prev.z, p.x, p.y, p.z)
        if (si < 6 && k % 2 === 0) bulbs.push(p.clone().setY(p.y - 0.15))
        if (si % 2 === 1 && si < 6 && k % 3 === 1) laundry.push({ p: p.clone().setY(p.y - 0.6), c: cloth[(k + si) % cloth.length]! })
        prev = p
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    this.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: PAL.boisOmbre })))

    const all = [...bulbs, ...this.lamps.map((l) => l.local)]
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), all.length)
    const c = new THREE.Color()
    all.forEach((p, i) => {
      const s = i < bulbs.length ? 1 : 1.8
      bm.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(s, s, s)))
      bm.setColorAt(i, c.set(i < bulbs.length ? PAL.lampe : this.lamps[i - bulbs.length]!.color.getHex()).multiplyScalar(1.4))
    })
    bm.name = 'nef-ampoules'
    this.group.add(bm)

    const lm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 1.0), mats.cel({ color: 0xffffff, indoor: true, side: THREE.DoubleSide }), laundry.length)
    laundry.forEach((l, i) => {
      lm.setMatrixAt(i, new THREE.Matrix4().compose(l.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 5) * 0.3), new THREE.Vector3(1, 0.8 + (i % 3) * 0.2, 1)))
      lm.setColorAt(i, c.set(l.c))
    })
    lm.name = 'nef-linge'
    this.group.add(lm)

    const glow = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: PAL.lampeChaude }))
    glow.rotation.x = -Math.PI / 2
    glow.position.set(0, -21.9, 0)
    glow.name = 'puits-lueur'
    this.group.add(glow)
  }

  private buildCanopy(): void {
    const pts: number[] = []
    const y = V.y1
    for (let x = V.x0; x <= V.x1 + 0.01; x += 4) pts.push(x, y, V.z0, x, y + 2.5 * Math.cos((x / (V.x1 - V.x0)) * Math.PI), V.z1)
    for (let z = V.z0; z <= V.z1 + 0.01; z += 6) pts.push(V.x0, y, z, V.x1, y, z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    this.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: PAL.laiton })))
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(V.x1 - V.x0, V.z1 - V.z0),
      new THREE.MeshBasicMaterial({ color: 0x9fd6d0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    )
    glass.rotation.x = -Math.PI / 2
    glass.position.set(0, y + 0.5, 0)
    glass.name = 'nef-verriere'
    this.group.add(glass)
  }

  private buildColliders(pose: { position: Vec3; heading: number }): void {
    const R = this.ctx.physics.rapier
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.heading)
    this.body = this.ctx.physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pose.position.x, pose.position.y, pose.position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    )
    const g = this.ctx.physics.groups
    const groups = ((g.TERRAIN & 0xffff) << 16) | 0xffff
    for (const bx of this.boxes) {
      const desc = R.ColliderDesc.cuboid(bx.h.x, bx.h.y, bx.h.z).setTranslation(bx.c.x, bx.c.y, bx.c.z).setCollisionGroups(groups)
      if (bx.rotX) {
        const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bx.rotX)
        desc.setRotation({ x: rq.x, y: rq.y, z: rq.z, w: rq.w })
      }
      const c = this.ctx.physics.world.createCollider(desc, this.body)
      this.ctx.physics.tag(c, { kind: bx.kind, climbable: bx.kind === 'pipe' || bx.kind === 'net', ownerId: 'nef' })
    }
  }

  contains(l: Vec3): boolean {
    return l.x > V.x0 && l.x < V.x1 && l.z > V.z0 && l.z < V.z1 && l.y > -22 && l.y < V.y1
  }

  cellAt(l: Vec3): CellId | null {
    if (!this.contains(l)) return null
    return l.y < 4 ? 'nef-principal' : l.y < 12 ? 'nef-haut' : 'nef-toits'
  }

  ceilingAt(l: Vec3): number | null {
    if (!this.contains(l)) return null
    return l.y < 5 ? 4.6 : l.y < 13 ? 12.6 : V.y1
  }

  update(pose: { position: Vec3; heading: number }, jumped: boolean): void {
    if (!this.body) return
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.heading)
    if (jumped) {
      this.body.setTranslation(pose.position, true)
      this.body.setRotation(q, true)
    } else {
      this.body.setNextKinematicTranslation(pose.position)
      this.body.setNextKinematicRotation(q)
    }
  }

  writeLamps(refWorld: Vec3): void {
    const render = this.ctx.services.render
    if (!render) return
    this.group.updateMatrixWorld()
    for (const l of this.lamps) l.world.copy(l.local).applyMatrix4(this.group.matrixWorld)
    const level = this.ctx.quality.level
    const slots = render.uniforms.uLamps.value
    const colors = render.uniforms.uLampColors.value
    const max = Math.min(slots.length, level === 'high' ? 8 : level === 'medium' ? 6 : 4)
    const d2 = (v: THREE.Vector3) => (v.x - refWorld.x) ** 2 + (v.y - refWorld.y) ** 2 + (v.z - refWorld.z) ** 2
    const order = [...this.lamps].sort((a, b) => d2(a.world) - d2(b.world))
    for (let i = 0; i < slots.length; i++) {
      const l = i < max ? order[i] : undefined
      if (!l) {
        slots[i]!.set(0, 0, 0, 0)
        continue
      }
      slots[i]!.set(l.world.x, l.world.y, l.world.z, l.radius)
      colors[i]?.copy(l.color)
    }
  }

  dispose(): void {
    if (this.body) {
      try {
        for (let i = 0; i < this.body.numColliders(); i++) this.ctx.physics.untag(this.body.collider(i))
        this.ctx.physics.world.removeRigidBody(this.body)
      } catch {
        /* world may be gone */
      }
    }
    this.group.removeFromParent()
  }
}
