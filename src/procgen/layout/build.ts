import * as THREE from 'three'
import { GeoBuilder } from '../../drift/builder'
import { PAL } from '../../drift/palette'
import { ARCHETYPES } from '../archetypes'
import type { BuildLayoutFn, ColliderSpec, DistrictShell } from '../types'
import { HULL, LEVELS } from './tuning'

const VAULT = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, -Math.PI / 2, Math.PI)
const DISC = new THREE.CylinderGeometry(1, 1, 1, 12)
const ALONG_X = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))
const ALONG_Z = new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0))
const _m = new THREE.Matrix4()
const _s = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function shifted(hex: number, seed: number): THREE.Color {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  const u = ((seed >>> 8) & 0xff) / 255 - 0.5
  const w = ((seed >>> 16) & 0xff) / 255 - 0.5
  return c.setHSL((hsl.h + u * (16 / 360) + 1) % 1, hsl.s, Math.min(1, Math.max(0, hsl.l * (1 + w * 0.12))))
}

interface Tones { mur: THREE.Color; sol: THREE.Color; coque: THREE.Color; metal: THREE.Color; rampe: THREE.Color; voute: THREE.Color; plafond: THREE.Color; marche: THREE.Color }

function tones(shell: DistrictShell): Tones {
  const a = ARCHETYPES[shell.plan.archetype]
  const s = shell.plan.seed
  return {
    mur: shifted(a.palette.mur, s),
    sol: shifted(a.palette.bois, s).multiplyScalar(0.95),
    coque: shifted(a.palette.metal, s).lerp(new THREE.Color(PAL.interieurOmbre), 0.45),
    metal: shifted(a.palette.metal, s),
    rampe: new THREE.Color(PAL.laiton),
    voute: shifted(a.palette.accent, s).lerp(new THREE.Color(a.palette.mur), 0.4),
    plafond: new THREE.Color(a.light.ambiance[1]).lerp(new THREE.Color(PAL.interieurOmbre), 0.3),
    marche: new THREE.Color(PAL.boisClair),
  }
}

function drawCollider(b: GeoBuilder, c: ColliderSpec, t: Tones, top: number): void {
  if (c.q) {
    _q.set(c.q[0], c.q[1], c.q[2], c.q[3])
    const alongX = c.hx > c.hz
    const half = alongX ? c.hx : c.hz
    const width = (alongX ? c.hz : c.hx) * 2
    _v.set(alongX ? 1 : 0, 0, alongX ? 0 : 1).applyQuaternion(_q)
    const rise = _v.y * half * 2
    const run = Math.hypot(_v.x, _v.z) * half * 2
    const n = Math.max(2, Math.round(Math.abs(rise) / 0.25))
    const sx = _v.x * half * 2
    const sz = _v.z * half * 2
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n
      const x = c.x - sx / 2 + sx * f
      const z = c.z - sz / 2 + sz * f
      const y = c.y + 0.16 - rise / 2 + rise * f
      b.box(x, y - 0.05, z, alongX ? run / n + 0.03 : width, 0.1, alongX ? width : run / n + 0.03, t.marche)
    }
    return
  }
  const sx = c.hx * 2
  const sy = c.hy * 2
  const sz = c.hz * 2
  const thin = Math.min(sx, sz) < 0.2 && sy <= HULL.rail + 0.5
  const color = c.kind === 'floor' ? t.sol : c.kind === 'hull' ? t.coque : c.kind === 'ladder' ? t.metal : thin ? t.rampe : c.y + c.hy > top - 0.5 ? t.coque : t.mur
  if (thin) {
    b.box(c.x, c.y + c.hy - 0.03, c.z, sx, 0.06, sz, t.rampe)
    const along = sx > sz ? sx : sz
    const posts = Math.max(1, Math.round(along / 1.6))
    for (let i = 0; i <= posts; i++) {
      const f = i / posts - 0.5
      b.box(c.x + (sx > sz ? f * sx : 0), c.y, c.z + (sx > sz ? 0 : f * sz), 0.05, sy, 0.05, t.metal)
    }
    return
  }
  if (c.kind === 'ladder') {
    const alongZ = c.hz > c.hx
    for (const s of [-1, 1]) b.box(c.x + (alongZ ? 0 : s * c.hx), c.y, c.z + (alongZ ? s * c.hz : 0), 0.05, sy + 0.9, 0.05, t.metal)
    for (let y = c.y - c.hy + 0.3; y < c.y + c.hy + 0.1; y += 0.3) b.cyl(c.x, y, c.z, 0.022, alongZ ? sz : sx, t.rampe, alongZ ? 'z' : 'x')
    return
  }
  b.box(c.x, c.y, c.z, sx, sy, sz, color)
}

function drawHull(b: GeoBuilder, shell: DistrictShell, t: Tones): void {
  for (const h of shell.hulls) {
    const lx = Math.abs(Math.sin(h.yaw)) > 0.5
    const top = h.floors[h.floors.length - 1]! + LEVELS.haut.storey
    _s.makeScale(h.rx, h.length, HULL.roofRise)
    _m.copy(lx ? ALONG_X : ALONG_Z).multiply(_s).setPosition(h.center.x, top, h.center.z)
    b.add(VAULT, _m, t.voute)
    const sx = lx ? h.length : h.rx * 2
    const sz = lx ? h.rx * 2 : h.length
    const y0 = h.floors[0]!
    for (let a = -h.length / 2 + HULL.ribEvery / 2; a < h.length / 2; a += HULL.ribEvery) {
      for (const s of [-1, 1]) {
        const x = h.center.x + (lx ? a : s * (sx / 2 + 0.08))
        const z = h.center.z + (lx ? s * (sz / 2 + 0.08) : a)
        b.box(x, (y0 + top) / 2, z, lx ? 0.22 : 0.16, top - y0, lx ? 0.16 : 0.22, t.coque)
      }
    }
    for (const fy of h.floors) {
      b.box(h.center.x, fy + 0.15, h.center.z, sx + 0.3, 0.3, sz + 0.3, t.coque)
      for (let a = -h.length / 2 + 2.5; a < h.length / 2 - 2; a += 4) {
        for (const s of [-1, 1]) {
          const x = h.center.x + (lx ? a : s * (sx / 2 + 0.05))
          const z = h.center.z + (lx ? s * (sz / 2 + 0.05) : a)
          _q.setFromUnitVectors(UP, _v.set(lx ? 0 : 1, 0, lx ? 1 : 0))
          _m.compose(_v.set(x, fy + 5.6, z), _q, new THREE.Vector3(0.45, 0.12, 0.45))
          b.add(DISC, _m, t.rampe)
        }
      }
    }
  }
}

export const buildLayout: BuildLayoutFn = function* (shell, host) {
  const t0 = performance.now()
  const t = tones(shell)
  const lv = LEVELS[shell.plan.layer]
  const b = new GeoBuilder()
  b.jitter = 0.04
  const glass = new GeoBuilder()
  glass.jitter = 0
  const water = new GeoBuilder()
  water.jitter = 0
  let n = 0
  for (const c of shell.colliders) {
    drawCollider(b, c, t, lv.top)
    if (++n % 200 === 0) yield
  }
  drawHull(b, shell, t)
  yield
  const pb = shell.plan.bounds
  b.box((pb.x0 + pb.x1) / 2, lv.top + 0.2, (pb.z0 + pb.z1) / 2, pb.x1 - pb.x0, 0.4, pb.z1 - pb.z0, t.plafond)
  for (let x = pb.x0 + 6; x < pb.x1; x += 12) b.box(x, lv.top - 0.4, (pb.z0 + pb.z1) / 2, 0.5, 0.8, pb.z1 - pb.z0, t.coque)
  for (const w of shell.windows) {
    const nx = w.normal.x
    const nz = w.normal.z
    if (w.kind === 'hublot') {
      _q.setFromUnitVectors(UP, _v.set(nx, 0, nz))
      _m.compose(_v.set(w.at.x, w.at.y, w.at.z), _q, new THREE.Vector3(w.w / 2, 0.08, w.w / 2))
      glass.add(DISC, _m, new THREE.Color(PAL.clair))
      _m.compose(_v.set(w.at.x - nx * 0.04, w.at.y, w.at.z - nz * 0.04), _q, new THREE.Vector3(w.w / 2 + 0.14, 0.05, w.w / 2 + 0.14))
      b.add(DISC, _m, t.rampe)
    } else {
      const sx = Math.abs(nx) > 0.5 ? 0.1 : w.w
      const sz = Math.abs(nx) > 0.5 ? w.w : 0.1
      glass.box(w.at.x, w.at.y, w.at.z, sx, w.h, sz, new THREE.Color(PAL.milieu))
      for (let k = -2; k <= 2; k++) {
        b.box(w.at.x - nx * 0.06 + (sz > 1 ? 0 : (k * w.w) / 4), w.at.y, w.at.z - nz * 0.06 + (sz > 1 ? (k * w.w) / 4 : 0), sx > 1 ? 0.12 : 0.16, w.h, sz > 1 ? 0.12 : 0.16, t.rampe)
      }
    }
  }
  for (const l of shell.lamps) {
    glass.sphere(l.at.x, l.at.y, l.at.z, 0.28, 0.28, 0.28, new THREE.Color(l.color).multiplyScalar(1.3))
    if (l.cell === shell.plan.id && !l.live) b.box(l.at.x, (lv.ground + l.at.y) / 2, l.at.z, 0.1, l.at.y - lv.ground, 0.1, t.metal)
  }
  for (const w of shell.waters) water.box((w.rect.x0 + w.rect.x1) / 2, w.y - 0.05, (w.rect.z0 + w.rect.z1) / 2, w.rect.x1 - w.rect.x0, 0.1, w.rect.z1 - w.rect.z0, new THREE.Color(PAL.milieu))
  yield

  const group = new THREE.Group()
  group.name = `structure:${shell.plan.id}`
  const geos: THREE.BufferGeometry[] = []
  const add = (gb: GeoBuilder, mat: THREE.Material) => {
    if (gb.vertexCount === 0) return
    const geo = gb.build()
    geos.push(geo)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.matrixAutoUpdate = false
    group.add(mesh)
  }
  add(b, host.mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, side: THREE.DoubleSide }))
  add(glass, host.mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, emissive: 0x6a8a80 }))
  add(water, host.mats.water(host.mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, caustics: true })))
  yield

  const physics = host.ctx.physics
  const R = physics.rapier
  const pose = host.pose()
  _q.setFromAxisAngle(UP, -pose.heading)
  const body = physics.world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }),
  )
  n = 0
  for (const c of shell.colliders) {
    const desc = R.ColliderDesc.cuboid(Math.max(0.02, c.hx), Math.max(0.02, c.hy), Math.max(0.02, c.hz)).setTranslation(c.x, c.y, c.z).setCollisionGroups(host.terrainGroups)
    if (c.q) desc.setRotation({ x: c.q[0], y: c.q[1], z: c.q[2], w: c.q[3] })
    const col = physics.world.createCollider(desc, body)
    physics.tag(col, { kind: c.kind, climbable: c.climbable, ...(c.ownerId ? { ownerId: c.ownerId } : {}) })
    if (++n % 400 === 0) yield
  }
  const triangles = geos.reduce((s, g) => s + (g.index ? g.index.count / 3 : 0), 0)
  return {
    group,
    body,
    stats: { draws: group.children.length, triangles, geometries: geos.length, buildMs: performance.now() - t0 },
    dispose() {
      group.removeFromParent()
      for (const g of geos) g.dispose()
      try {
        for (let i = 0; i < body.numColliders(); i++) physics.untag(body.collider(i))
        physics.world.removeRigidBody(body)
      } catch {
        /* world already torn down */
      }
    },
  }
}
