import * as THREE from 'three'
import type { CameraEnv, GameContext, QualityLevel, QualitySettings } from '../../core/types'
import { createRenderSystem, type RenderServiceV2 } from '../index'

// Dev-only lookdev bench for the render folder: /src/render/lookdev/index.html?shot=refectoire&t=7.5&q=high

const params = new URLSearchParams(location.search)
const shot = params.get('shot') ?? 'refectoire'
const level = (params.get('q') ?? 'high') as QualityLevel
const Y = 55

const PRESETS: Record<QualityLevel, Omit<QualitySettings, 'level' | 'onChange'>> = {
  high: { pixelRatio: 1, chunkRadius: 3, lodRadius: 6, grassDensity: 0, fishCount: 0, shadows: true, shadowMapSize: 2048, godRayPass: true, outline: true, painterly: true },
  medium: { pixelRatio: 1, chunkRadius: 2, lodRadius: 5, grassDensity: 0, fishCount: 0, shadows: true, shadowMapSize: 1024, godRayPass: false, outline: true, painterly: false },
  low: { pixelRatio: 1, chunkRadius: 2, lodRadius: 4, grassDensity: 0, fishCount: 0, shadows: false, shadowMapSize: 0, godRayPass: false, outline: false, painterly: false },
}

interface Shot { pos: [number, number, number]; at: [number, number, number]; hour: number; air?: number; fov?: number }
const SHOTS: Record<string, Shot> = {
  refectoire: { pos: [0, Y + 1.8, 13.5], at: [0, Y + 3.1, -15], hour: 7.5 },
  hublot: { pos: [-8.6, Y + 2.2, 3.2], at: [-12, Y + 3.3, -0.6], hour: 11 },
  nef: { pos: [10.5, Y + 8, 14], at: [-4, Y + 1, -10], hour: 12, air: 1 },
  nuit: { pos: [0, Y + 1.8, 13.5], at: [0, Y + 3.1, -15], hour: 22.5 },
  vitre: { pos: [2, Y + 3.4, -24], at: [0, Y + 2.6, 0], hour: 9 },
  sortie: { pos: [95, Y + 14, 120], at: [-10, Y - 4, -20], hour: 10, fov: 55 },
  loin: { pos: [180, Y + 30, 260], at: [0, Y, 0], hour: 15, fov: 50 },
  lavage: { pos: [14.2, Y + 3.9, 5.4], at: [12, Y + 3.2, 2.6], hour: 9.5, fov: 60 },
  dome: { pos: [1.2, Y + 10.6, 1.5], at: [-2, Y + 16, -3], hour: 10, fov: 75 },
}
const S = SHOTS[shot] ?? SHOTS.refectoire!

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(1)
renderer.setSize(innerWidth, innerHeight, false)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(S.fov ?? 62, innerWidth / innerHeight, 0.1, 4000)
camera.position.set(...S.pos)
camera.lookAt(...S.at)

let seed = 7
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const quality: QualitySettings = { level, ...PRESETS[level], onChange: () => () => {} }
const camEnv: CameraEnv = { indoor: 1, glassDist: 4, airHaze: 0, district: 'ecluse', cell: 'refectoire' }
const hours = Number(params.get('t') ?? S.hour)
const state = {
  mode: 'inside',
  time: { hours, day: 1, scale: 0 },
  env: { current: { x: 0, y: 0, z: -0.3 }, visibility: Number(params.get('vis') ?? 30), bloom: 0, jellyfish: 0, rain: Number(params.get('rain') ?? 0) },
  hero: { position: { x: S.pos[0], y: S.pos[1] - 1.6, z: S.pos[2] }, medium: 'air' },
  debug: { cameraLocked: true },
}
const ctx = {
  scene, camera, renderer, canvas, uiRoot: document.body, quality, state,
  bus: { on: () => () => {}, emit: () => {} },
  clock: { elapsed: 0, frame: 0, paused: false },
  services: {
    drift: { cameraEnv: () => camEnv, glassPortalsVisible: () => 1 },
    windows: {}, settings: {}, debug: { registerPose: () => {} },
  },
  rng: () => rand,
} as unknown as GameContext

const system = createRenderSystem()
system.init(ctx)
const render = ctx.services.render as RenderServiceV2

const mats = new Map<string, THREE.Material>()
const inMat = (color: number, extra: { emissive?: number; rim?: number; side?: THREE.Side } = {}) => {
  const key = `in:${color}:${extra.emissive ?? 0}:${extra.side ?? 0}`
  let m = mats.get(key)
  if (!m) mats.set(key, (m = render.cel({ color, indoor: true, rim: extra.rim ?? 0.35, ...(extra.emissive ? { emissive: extra.emissive } : {}), ...(extra.side ? { side: extra.side } : {}) })))
  return m
}
const outMat = (color: number, silhouette = false) => render.cel({ color, rim: 0.7, silhouette } as Parameters<RenderServiceV2['cel']>[0])

const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}
const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z)

const C = { creme: 0xf1e4c8, platre: 0xe6d8be, bois: 0xb07a4f, boisSombre: 0x7a5440, laiton: 0xd9b48f, lampe: 0xffc27a, tissu: [0xc8553d, 0x5b7db1, 0xe0b04f, 0x7e9f6b, 0xb06a8e] }

function glassPane(w: number, h: number, coat: number, x: number, y: number, z: number, yaw: number, round: boolean) {
  const geo = round ? new THREE.CircleGeometry(0.5, 32) : new THREE.PlaneGeometry(1, 1)
  const n = geo.getAttribute('position').count
  geo.setAttribute('aCoat', new THREE.Float32BufferAttribute(new Array(n).fill(coat), 1))
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(n).fill(rand()), 1))
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0).map((_, i) => (i % 2 ? h : w)), 2))
  const m = add(geo, render.glass({ round, coat: true, condensation: true }), x, y, z)
  m.scale.set(w, h, 1)
  m.rotation.y = yaw
  return m
}

function buildRoom() {
  const wall = inMat(C.creme)
  const trim = inMat(C.boisSombre)
  box(24, 0.3, 30, inMat(C.bois), 0, Y - 0.15, 0)
  box(24, 0.3, 30, inMat(0x9c7a64), 0, Y + 9.15, 0)
  for (let z = -13; z <= 13; z += 3.25) box(24, 0.35, 0.3, trim, 0, Y + 8.85, z)
  box(24, 9, 0.3, wall, 0, Y + 4.5, 15.15)
  box(24, 0.8, 0.3, wall, 0, Y + 0.4, -15.15)
  box(24, 2.2, 0.3, wall, 0, Y + 7.9, -15.15)
  box(4, 6, 0.3, wall, -10, Y + 3.8, -15.15)
  box(4, 6, 0.3, wall, 10, Y + 3.8, -15.15)
  const brass = inMat(C.laiton, { rim: 0.8 })
  for (let i = 0; i <= 4; i++) box(0.14, 6, 0.2, brass, -8 + i * 4, Y + 3.8, -15)
  for (let j = 0; j <= 2; j++) box(16, 0.14, 0.2, brass, 0, Y + 0.8 + j * 3, -15)
  glassPane(16, 6, 0.12, 0, Y + 3.8, -15.05, Math.PI, false)
  box(16, 0.5, 1.2, inMat(C.bois), 0, Y + 0.95, -14.4)

  for (const side of [-1, 1]) {
    const x = side * 12.15
    box(0.3, 2.6, 30, wall, x, Y + 1.3, 0)
    box(0.3, 5, 30, wall, x, Y + 6.5, 0)
    const holes = [-10, -3.5, 3.5, 10]
    let z0 = -15
    for (const hz of holes) {
      box(0.3, 1.4, hz - 0.8 - z0, wall, x, Y + 3.3, (z0 + hz - 0.8) / 2)
      z0 = hz + 0.8
    }
    box(0.3, 1.4, 15 - z0, wall, x, Y + 3.3, (z0 + 15) / 2)
    holes.forEach((hz, i) => {
      const ring = add(new THREE.TorusGeometry(0.72, 0.09, 8, 28), brass, x - side * 0.12, Y + 3.3, hz)
      ring.rotation.y = Math.PI / 2
      glassPane(1.4, 1.4, [0, 0.55, 0.92, 0.2][i]!, x, Y + 3.3, hz, side * Math.PI / 2, true)
    })
  }

  const tableTop = inMat(C.bois)
  for (const tx of [-6, 0, 6]) {
    box(1.8, 0.1, 20, tableTop, tx, Y + 0.85, 0)
    for (const lz of [-9, 0, 9]) box(0.12, 0.8, 0.12, trim, tx, Y + 0.4, lz)
    for (const bx of [-1.4, 1.4]) box(0.45, 0.08, 20, tableTop, tx + bx, Y + 0.48, 0)
    for (let z = -9; z <= 9; z += 1.5) {
      add(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), inMat(C.tissu[Math.round(z + 9) % 5]!), tx + (rand() - 0.5) * 0.8, Y + 0.9, z)
      if (rand() < 0.55) {
        const s = rand() < 0.5 ? 1 : -1
        const c = C.tissu[Math.floor(rand() * 5)]!
        const b = add(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), inMat(c), tx + s * 1.4, Y + 1.05, z)
        add(new THREE.SphereGeometry(0.17, 12, 8), inMat(0xc98e6b), tx + s * 1.4, Y + 1.65, z)
        b.rotation.z = s * 0.08
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const kx = -2.5 + i * 1.6
    add(new THREE.CapsuleGeometry(0.15, 0.3, 4, 8), inMat(C.tissu[i]!), kx, Y + 1.55, -14.4)
    add(new THREE.SphereGeometry(0.12, 10, 8), inMat(0xc98e6b), kx, Y + 1.98, -14.4)
  }

  const lampPos: THREE.Vector3[] = []
  for (const lx of [-6, 0, 6]) for (const lz of [-7, 4]) lampPos.push(new THREE.Vector3(lx, Y + 6.2, lz))
  lampPos.forEach((p) => {
    add(new THREE.CylinderGeometry(0.02, 0.02, 2.8, 4), trim, p.x, p.y + 1.55, p.z)
    add(new THREE.ConeGeometry(0.55, 0.45, 18, 1, true), inMat(C.laiton, { side: THREE.DoubleSide }), p.x, p.y + 0.12, p.z)
    add(new THREE.SphereGeometry(0.16, 12, 8), inMat(0xffe2b0, { emissive: C.lampe }), p.x, p.y - 0.05, p.z)
  })
  const u = render.uniforms
  lampPos.forEach((p, i) => {
    if (i >= u.uLamps.value.length) return
    u.uLamps.value[i]!.set(p.x, p.y - 0.1, p.z, 10)
    u.uLampColors.value[i]!.set(i % 3 === 1 ? 0xff9e5e : C.lampe)
  })

  for (let i = 0; i < 6; i++) {
    const z = -12 + i * 4.6
    box(1.0, 0.9, 1.0, inMat(i % 2 ? C.boisSombre : C.bois), 11.2, Y + 0.45, z)
    if (i % 2) box(0.8, 0.7, 0.8, inMat(C.bois), 11.2, Y + 1.25, z + 0.1)
  }
  box(0.5, 0.06, 6, trim, -11.6, Y + 2.1, 0)
  for (let i = 0; i < 9; i++) add(new THREE.CylinderGeometry(0.11, 0.13, 0.32, 10), inMat(C.tissu[i % 5]!), -11.6, Y + 2.3, -2.6 + i * 0.65)
  for (let i = 0; i < 7; i++) {
    const cloth = add(new THREE.PlaneGeometry(0.8, 1.0), inMat(C.tissu[(i + 2) % 5]!, { side: THREE.DoubleSide }), -4 + i * 1.3, Y + 7.3, 11.5)
    cloth.rotation.y = 0.2 * (rand() - 0.5)
  }
  for (const [px, pz] of [[-11, -13.6], [11, -13.6], [-11, 13.6]] as const) {
    add(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 12), inMat(0xc46a4a), px, Y + 0.25, pz)
    add(new THREE.IcosahedronGeometry(0.55, 0), inMat(0x7e9f6b), px, Y + 0.85, pz)
  }

  const exterior = outMat(0x4f6d7a)
  const shell = add(new THREE.CapsuleGeometry(15.5, 18, 8, 24), exterior, 0, Y + 4, 0)
  shell.rotation.x = Math.PI / 2
  shell.scale.set(1.05, 1, 0.42)
  shell.visible = shot === 'sortie' || shot === 'loin' || shot === 'vitre'
  if (shell.visible) {
    shell.position.y = Y - 5.2
    shell.scale.set(0.85, 1.1, 0.3)
  }
}

function buildDome() {
  const r = 4
  const geo = new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const dome = add(geo, render.glass({ dome: true, coat: true }), 0, Y + 9.3, 0)
  dome.name = 'lookdev-dome'
  add(new THREE.TorusGeometry(r, 0.12, 8, 40), inMat(C.laiton, { rim: 0.8 }), 0, Y + 9.35, 0).rotation.x = Math.PI / 2
  for (let i = 0; i < 6; i++) {
    const rib = add(new THREE.TorusGeometry(r, 0.06, 6, 30, Math.PI / 2), inMat(C.laiton), 0, Y + 9.3, 0)
    rib.rotation.set(0, (i / 6) * Math.PI * 2, Math.PI / 2)
  }
  box(8.4, 0.2, 8.4, inMat(C.bois), 0, Y + 9.45 - 0.2, 0).visible = shot === 'dome'
}

function buildSea() {
  const g = new THREE.PlaneGeometry(1400, 1400, 140, 140)
  g.rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, 8 + Math.sin(x * 0.021) * 4 + Math.cos(z * 0.017 + x * 0.006) * 6 + Math.sin(x * 0.11 + z * 0.09) * 0.8)
  }
  g.computeVertexNormals()
  add(g, outMat(0xe9ddb8), 0, 0, 0)
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2
    const r = 25 + rand() * 300
    const rock = add(new THREE.DodecahedronGeometry(2 + rand() * 7, 0), outMat(0x8a8fa8), Math.cos(a) * r, 9, Math.sin(a) * r - 40)
    rock.scale.y = 0.6
  }
  const kelp = outMat(0x6f8f4e)
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2
    const r = 20 + rand() * 120
    const h = 18 + rand() * 30
    add(new THREE.ConeGeometry(0.6, h, 5), kelp, Math.cos(a) * r, 8 + h / 2, Math.sin(a) * r - 30)
  }
}

function buildCity() {
  const accents = [0xd8644e, 0x8fbf6a, 0xd9b48f, 0xc46a4a, 0x6e8fb0, 0x4f6d7a, 0xefe3c4]
  const lit = render.cel({ color: 0xffd9a0, emissive: 0xffc27a, rim: 0 })
  for (let row = 0; row < 7; row++) {
    for (let k = 0; k < 6; k++) {
      const len = [18, 24, 32][(row + k) % 3]!
      const r = [5, 7][(row * 3 + k) % 2]!
      const x = -120 + row * 40
      const z = -100 + k * 42
      const y = Y - 20 + ((row + k) % 3) * 12
      const hull = add(new THREE.CapsuleGeometry(r, len, 6, 18), outMat(accents[row]!, true), x, y, z)
      hull.rotation.x = Math.PI / 2
      for (let w = 0; w < 6; w++) add(new THREE.BoxGeometry(0.2, 0.9, 1.0), lit, x + r * 0.98, y + 1, z - len / 2 + 2 + w * (len - 4) / 5)
    }
  }
}

buildRoom()
buildDome()
buildSea()
if (shot === 'sortie' || shot === 'loin') buildCity()

const ROOM = { x0: -12, x1: 12, y0: Y, y1: Y + 9, z0: -15, z1: 15 }
const panes = [{ x: 0, y: Y + 3.8, z: -15 }, ...[-10, -3.5, 3.5, 10].flatMap((z) => [{ x: -12, y: Y + 3.3, z }, { x: 12, y: Y + 3.3, z }])]
function updateEnv() {
  const p = camera.position
  const inDome = Math.hypot(p.x, p.y - (Y + 9.3), p.z) < 4
  const inside = inDome || p.x > ROOM.x0 && p.x < ROOM.x1 && p.y > ROOM.y0 && p.y < ROOM.y1 && p.z > ROOM.z0 && p.z < ROOM.z1
  camEnv.indoor = inside ? 1 : 0
  camEnv.airHaze = inside ? S.air ?? 0.2 : 0
  camEnv.glassDist = inDome ? 4 - Math.hypot(p.x, p.y - (Y + 9.3), p.z) : inside ? Math.min(...panes.map((g) => p.distanceTo(new THREE.Vector3(g.x, g.y, g.z)))) : 0
  state.mode = inside ? 'inside' : 'sortie'
  state.hero.medium = inside ? 'air' : 'water'
}

const hud = document.getElementById('hud')!
const t0 = performance.now()
let last = t0
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  ctx.clock.elapsed = (now - t0) / 1000
  ctx.clock.frame++
  updateEnv()
  system.update(dt, ctx)
  render.draw(ctx)
  if (ctx.clock.frame % 30 === 0) {
    const s = render.stats()
    hud.textContent = `${shot} · ${hours}h · ${level} · ${s.drawCalls} draws · ${s.ms.toFixed(1)} ms`
  }
  ;(window as unknown as { __frames: number }).__frames = ctx.clock.frame
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
})
