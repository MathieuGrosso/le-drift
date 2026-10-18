import * as THREE from 'three'
import type { Gp, ScelleeView } from '../context'
import { createAttach } from './attach'
import { SCELLEES, type ShrineFrame } from './sites'

// The moving part of each coque scellée's mechanism, so a rule reads in the room and not only on the
// gauge: what floats, rolls, hangs, lifts or bubbles. Built in the shrine's (u, d, y) frame from sites.ts.

type Kind = 'float' | 'roll' | 'hang' | 'lift' | 'bubbles' | 'steam' | 'lamp' | 'door'
const MECH: Record<string, Kind> = {
  'cs-01': 'float', 'cs-02': 'hang', 'cs-03': 'lamp', 'cs-04': 'float', 'cs-05': 'roll', 'cs-06': 'steam',
  'cs-07': 'door', 'cs-08': 'lift', 'cs-09': 'bubbles', 'cs-10': 'lift', 'cs-11': 'float', 'cs-12': 'roll',
}
const BUILD_R = 34
const PIT_FLOOR = -1.6

const PAL = { laiton: 0xd9b48f, rouille: 0xc46a4a, bois: 0xb07a4f, teal: 0x4f6d7a, creme: 0xf1e4c8, ombre: 0x4a3a4e, nacre: 0xf4f1e6, eau: 0x9fd6d0 }

interface Built {
  id: string
  frame: ShrineFrame
  root: THREE.Group
  mover: THREE.Object3D | null
  needle: THREE.Object3D
  grate: THREE.Object3D
  glow: THREE.Mesh
  bubbles: THREE.Points | null
  steam: THREE.Mesh | null
  t: number
  shown: number
}

export interface ScelleeProps { update(dt: number): void }

export function createScelleeProps(gp: Gp, view: (id: string) => ScelleeView | null): ScelleeProps {
  const ctx = gp.ctx
  const attach = createAttach(ctx, 'gameplay-scellees')
  const built = new Map<string, Built>()
  const box = new THREE.BoxGeometry(1, 1, 1)
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14)
  const sph = new THREE.SphereGeometry(1, 16, 12)
  let mats: Record<string, THREE.Material> | null = null
  const mat = () =>
    (mats ??= {
      laiton: attach.material(PAL.laiton),
      rouille: attach.material(PAL.rouille),
      bois: attach.material(PAL.bois),
      teal: attach.material(PAL.teal),
      creme: attach.material(PAL.creme),
      ombre: attach.material(PAL.ombre),
      glow: attach.material(0, { emissive: 0xffd9a0 }),
      bulle: attach.material(0, { emissive: 0xcfefe3 }),
      vapeur: attach.material(0, { emissive: 0xf1e4c8, transparent: true }),
    })

  const place = (o: THREE.Object3D, f: ShrineFrame, u: number, d: number, y: number) => {
    const p = f.at(u, d, y)
    o.position.set(p.x, p.y, p.z)
  }
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, sx: number, sy: number, sz: number, parent: THREE.Object3D) => {
    const x = new THREE.Mesh(geo, m)
    x.scale.set(sx, sy, sz)
    parent.add(x)
    return x
  }

  const build = (id: string, f: ShrineFrame): Built => {
    const M = mat()
    const root = new THREE.Group()
    root.name = `mecanisme-${id}`
    attach.group.add(root)

    const dial = new THREE.Group()
    place(dial, f, -3.3, 4.62, 1.75)
    dial.rotation.y = Math.atan2(f.n.x, f.n.z)
    mesh(cyl, M.laiton!, 0.34, 0.05, 0.34, dial).rotation.x = Math.PI / 2
    mesh(cyl, M.creme!, 0.29, 0.06, 0.29, dial).rotation.x = Math.PI / 2
    const needle = new THREE.Group()
    needle.position.z = 0.05
    mesh(box, M.rouille!, 0.03, 0.24, 0.02, needle).position.y = 0.1
    dial.add(needle)
    root.add(dial)

    const grate = new THREE.Group()
    place(grate, f, -4.5, 12.3, 3.1)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      mesh(cyl, M.laiton!, 0.025, 1.3, 0.025, grate).position.set(Math.cos(a) * 0.36, 0.65, Math.sin(a) * 0.36)
    }
    mesh(cyl, M.laiton!, 0.4, 0.06, 0.4, grate).position.y = 1.32
    root.add(grate)
    const glow = mesh(sph, M.glow!, 0.5, 0.5, 0.5, root)
    place(glow, f, -4.5, 12.3, 4.15)

    let mover: THREE.Object3D | null = null
    let bubbles: THREE.Points | null = null
    let steam: THREE.Mesh | null = null
    const kind = MECH[id]!
    const g = new THREE.Group()
    root.add(g)
    if (kind === 'float') {
      if (id === 'cs-11') mesh(box, M.bois!, 1.1, 0.9, 1.1, g)
      else if (id === 'cs-04') {
        mesh(box, M.bois!, 2.2, 0.18, 1.3, g)
        mesh(cyl, M.ombre!, 0.05, 1.2, 0.05, g).position.y = 0.6
      } else {
        mesh(sph, M.rouille!, 0.4, 0.4, 0.4, g)
        mesh(cyl, M.creme!, 0.41, 0.12, 0.41, g)
      }
      mover = g
    } else if (kind === 'roll') {
      if (id === 'cs-05') {
        const b = mesh(cyl, M.bois!, 0.45, 1.0, 0.45, g)
        b.rotation.z = Math.PI / 2
        mesh(cyl, M.ombre!, 0.47, 0.06, 0.47, b).position.y = 0.3
        mesh(cyl, M.ombre!, 0.47, 0.06, 0.47, b).position.y = -0.3
      } else for (let i = 0; i < 3; i++) mesh(sph, i === 1 ? M.laiton! : M.rouille!, 0.28, 0.28, 0.28, g).position.set(0, 0, (i - 1) * 0.8)
      mover = g
    } else if (kind === 'hang') {
      mesh(cyl, M.ombre!, 0.02, 1, 0.02, g).name = 'corde'
      const sack = mesh(sph, M.bois!, 0.42, 0.55, 0.42, g)
      sack.name = 'sac'
      mover = g
    } else if (kind === 'lift') {
      if (id === 'cs-10') {
        mesh(sph, M.laiton!, 1.2, 1.0, 1.2, g)
        mesh(cyl, M.ombre!, 1.25, 0.12, 1.25, g)
      } else {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4
          mesh(box, M.ombre!, 0.06, 1.6, 0.06, g).position.set(Math.cos(a) * 0.7, 0.8, Math.sin(a) * 0.7)
        }
        mesh(box, M.rouille!, 1.2, 0.08, 1.2, g)
        mesh(box, M.rouille!, 1.2, 0.08, 1.2, g).position.y = 1.6
      }
      mover = g
    } else if (kind === 'lamp') {
      mesh(cyl, M.ombre!, 0.03, 2.0, 0.03, g).position.y = 1
      mesh(sph, M.glow!, 0.32, 0.32, 0.32, g).name = 'ampoule'
      mover = g
    } else if (kind === 'door') {
      mesh(box, M.teal!, 2.4, 2.6, 0.18, g)
      mesh(cyl, M.laiton!, 0.35, 0.08, 0.35, g).rotation.x = Math.PI / 2
      mover = g
    } else if (kind === 'bubbles') {
      const n = 60
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.7
        pos[i * 3 + 1] = Math.random() * 4.5
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.7
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      bubbles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfefe3, size: 0.12, transparent: true, opacity: 0.8, depthWrite: false }))
      place(bubbles, f, 0, 9, PIT_FLOOR)
      root.add(bubbles)
      mesh(cyl, M.laiton!, 0.5, 0.2, 0.5, g)
      mover = g
    } else if (kind === 'steam') {
      steam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 6, 16, 1, true), M.vapeur!)
      place(steam, f, 0, 9, 1.5)
      root.add(steam)
      mesh(cyl, M.rouille!, 0.7, 0.4, 0.7, g)
      place(g, f, 0, 9, PIT_FLOOR + 0.2)
    }
    return { id, frame: f, root, mover, needle, grate, glow, bubbles, steam, t: 0, shown: 0 }
  }

  const animate = (b: Built, v: ScelleeView, dt: number) => {
    b.t += dt
    const f = b.frame
    const k = MECH[b.id]!
    const open = v.solved ? 1 : 0
    b.shown += (open - b.shown) * Math.min(1, dt * 1.5)
    place(b.grate, f, -4.5, 12.3, 3.1 + b.shown * 1.5)
    b.glow.scale.setScalar(0.25 + b.shown * 0.35 + Math.sin(b.t * 2) * 0.03)
    let gauge = 0
    const m = b.mover
    if (k === 'float' && m) {
      const level = v.water
      gauge = level
      const bob = Math.sin(b.t * 1.6) * 0.04
      const u = b.id === 'cs-11' ? 4.2 : b.id === 'cs-04' ? 2.5 : 0
      place(m, f, u, 9, PIT_FLOOR + 0.25 + level * 1.4 + bob)
      m.rotation.z = Math.sin(b.t * 1.1) * 0.05
    } else if (k === 'roll' && m) {
      gauge = v.pos
      place(m, f, -5 + v.pos * 10, b.id === 'cs-05' ? 12.2 : 9, b.id === 'cs-05' ? 0.45 : PIT_FLOOR + 0.28)
      m.rotation.set(0, Math.atan2(f.t.x, f.t.z), 0)
      const spin = (-5 + v.pos * 10) / 0.4
      for (const c of m.children) c.rotation.x = spin
    } else if (k === 'hang' && m) {
      gauge = v.lever
      place(m, f, 3.5, 12, 5.6)
      const drop = 0.6 + v.lever * 3.2
      const rope = m.getObjectByName('corde')
      const sack = m.getObjectByName('sac')
      if (rope) {
        rope.scale.y = drop
        rope.position.y = -drop / 2
      }
      if (sack) {
        sack.position.y = -drop - 0.5
        sack.scale.set(0.3 + v.lever * 0.2, 0.4 + v.lever * 0.25, 0.3 + v.lever * 0.2)
      }
    } else if (k === 'lift' && m) {
      gauge = v.air
      place(m, f, 0, 9, PIT_FLOOR + 0.1 + v.air * 3.3 + (b.id === 'cs-10' ? -0.3 : 0))
    } else if (k === 'lamp' && m) {
      gauge = v.water
      place(m, f, -1.5, 8.5, PIT_FLOOR + 0.2 + Math.min(1, 1 - v.water) * 0.1)
      const bulb = m.getObjectByName('ampoule')
      const lit = v.lever ? (v.water > 0.25 ? 0.4 : 1) : 0.05
      if (bulb) bulb.scale.setScalar(0.12 + lit * 0.25 + (lit > 0.5 ? Math.sin(b.t * 9) * 0.01 : 0))
    } else if (k === 'door' && m) {
      gauge = v.air
      place(m, f, 0, 13.3, 1.3 + (v.open ? 2.6 : 0) - Math.sin(b.t * 30) * 0.01 * v.air)
      m.rotation.y = Math.atan2(f.n.x, f.n.z)
    } else if (k === 'bubbles') {
      gauge = v.air
      if (m) place(m, f, 0, 9, PIT_FLOOR + 0.1)
      const pts = b.bubbles
      if (pts) {
        const a = pts.geometry.getAttribute('position') as THREE.BufferAttribute
        const speed = 0.4 + v.air * 2.4
        for (let i = 0; i < a.count; i++) {
          let y = a.getY(i) + dt * speed * (0.7 + (i % 5) * 0.12)
          if (y > 4.5) y -= 4.5
          a.setY(i, y)
          a.setX(i, a.getX(i) + Math.sin(b.t * 3 + i) * dt * 0.08)
        }
        a.needsUpdate = true
        ;(pts.material as THREE.PointsMaterial).opacity = 0.15 + v.air * 0.75
      }
    } else if (k === 'steam') {
      gauge = v.timer > 0 ? 1 : v.air
      const s = b.steam
      if (s) {
        s.visible = v.timer > 0 || v.air > 0.05
        const on = v.timer > 0 ? 1 : v.air * 0.3
        s.scale.set(0.6 + on * 0.6, 0.3 + on * 0.9, 0.6 + on * 0.6)
        s.rotation.y += dt * 0.6
        ;(s.material as THREE.MeshBasicMaterial).opacity = 0.12 + on * 0.25
      }
    }
    b.needle.rotation.z = THREE.MathUtils.lerp(2.2, -2.2, THREE.MathUtils.clamp(gauge, 0, 1))
  }

  return {
    update(dt) {
      attach.update()
      const hl = gp.heroLocal()
      for (const s of gp.sites.get().scellees) {
        if (!(SCELLEES as readonly string[]).includes(s.id)) continue
        const near = Math.hypot(s.at.x - hl.x, s.at.y - hl.y, s.at.z - hl.z) < BUILD_R
        let b = built.get(s.id)
        if (!b && near && s.frame) {
          b = build(s.id, s.frame)
          built.set(s.id, b)
        }
        if (!b) continue
        b.root.visible = near
        const v = view(s.id)
        if (near && v) animate(b, v, dt)
      }
    },
  }
}
