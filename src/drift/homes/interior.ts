import * as THREE from 'three'
import { HOMES, PROPS } from '../../core/tuning'
import { GeoBuilder } from '../builder'
import { PAL } from '../palette'
import { C } from '../city/kit'
import { bakeGlow, LampGrid, type BakeLamp } from '../city/glow'
import { loadProps, propMeshes } from '../city/props'
import { framePoint, frameSize, type HomeDef } from './plan'
import type { Furn } from './templates'

const SEA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const SEA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDay;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  vec3 deep = vec3(0.04, 0.22, 0.3);
  vec3 high = vec3(0.32, 0.66, 0.68);
  vec3 c = mix(deep, high, smoothstep(-0.5, 0.6, p.y));
  float rays = smoothstep(0.75, 1.0, sin(p.x * 18.0 + p.y * 6.0 + uTime * 0.4)) * smoothstep(-0.3, 0.5, p.y);
  float motes = step(0.985, fract(sin(dot(floor((vUv + vec2(uTime * 0.01, uTime * 0.02)) * 40.0), vec2(12.9898, 78.233))) * 43758.5453));
  c += rays * 0.12 + motes * 0.25;
  gl_FragColor = vec4(c * (0.35 + 0.65 * uDay), 1.0);
}`

export const SEA_UNIFORMS = { uTime: { value: 0 }, uDay: { value: 1 } }
const seaMat = new THREE.ShaderMaterial({ uniforms: SEA_UNIFORMS, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG })
const DISC = new THREE.CircleGeometry(1, 20)
const RING = new THREE.TorusGeometry(1, 0.14, 6, 20)
const _p = new THREE.Vector3()
const PORTHOLE_Y = 1.45

export interface Interior { group: THREE.Group; dispose(): void }

export function buildInterior(def: HomeDef, glow: THREE.Material, emissive: THREE.Material): Interior {
  const { frame: f, room, layout } = def
  const b = new GeoBuilder()
  const e = new GeoBuilder()
  b.jitter = 0.02
  e.jitter = 0
  const box = (g: GeoBuilder, u: number, y: number, d: number, su: number, sy: number, sd: number, color: THREE.ColorRepresentation) => {
    framePoint(f, u, y, d, _p)
    const { sx, sz } = frameSize(f, su, sd)
    g.box(_p.x, _p.y, _p.z, sx, sy, sz, color)
  }
  const t = HOMES.wallT
  const H = room.height
  const y0 = room.floor
  const L = room.u1 - room.u0
  const uc = (room.u0 + room.u1) / 2
  const dc = (room.d0 + room.d1) / 2
  const D = room.d1 - room.d0
  const half = HOMES.doorW / 2

  box(b, uc, y0 - 0.05, dc, L, 0.1, D, C(layout.floor))
  for (let i = 1; i < 6; i++) box(b, room.u0 + (L * i) / 6, y0 + 0.002, dc, 0.02, 0.01, D, C(PAL.boisOmbre, 1.2))
  box(b, uc, y0 + H + 0.05, dc, L, 0.1, D, C(layout.wall, 0.92))
  for (let u = room.u0 + 0.6; u < room.u1; u += 1.2) box(b, u, y0 + H - 0.06, dc, 0.12, 0.12, D, C(PAL.bois, 0.9))
  box(b, uc, y0 + H / 2, room.d0 - t / 2, L, H, t, C(layout.wall))
  box(b, uc, y0 + 0.45, room.d0 + 0.01, L, 0.9, 0.02, C(layout.wainscot, 1.3))
  for (const side of [-1, 1]) {
    const u = side < 0 ? room.u0 - t / 2 : room.u1 + t / 2
    box(b, u, y0 + H / 2, dc, t, H, D + 2 * t, C(layout.wall, 0.96))
    box(b, side < 0 ? room.u0 + 0.01 : room.u1 - 0.01, y0 + 0.45, dc, 0.02, 0.9, D, C(layout.wainscot, 1.3))
  }
  const left = room.du - half - room.u0
  const right = room.u1 - room.du - half
  if (left > 0.02) box(b, room.u0 + left / 2, y0 + H / 2, room.d1 + t / 2, left, H, t, C(layout.wall))
  if (right > 0.02) box(b, room.u1 - right / 2, y0 + H / 2, room.d1 + t / 2, right, H, t, C(layout.wall))
  box(b, room.du, y0 + (HOMES.doorH + H) / 2, room.d1 + t / 2, HOMES.doorW, H - HOMES.doorH, t, C(layout.wall))

  for (const fu of layout.furn) furniture(b, box, fu)

  const lampU = uc
  const lampY = y0 + H - 0.45
  box(b, lampU, y0 + H - 0.2, dc, 0.02, 0.4, 0.02, C(PAL.corde))
  framePoint(f, lampU, lampY, dc, _p)
  e.sphere(_p.x, _p.y, _p.z, 0.12, 0.12, 0.12, C(layout.lamp, 1.6))
  b.add(new THREE.ConeGeometry(0.26, 0.2, 12, 1, true), new THREE.Matrix4().makeTranslation(_p.x, _p.y + 0.1, _p.z), C(PAL.laiton))

  const seaAt = framePoint(f, layout.porthole, y0 + PORTHOLE_Y, room.d0 + 0.02)
  const facing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(f.inX, 0, f.inZ))
  b.add(RING, new THREE.Matrix4().compose(seaAt, facing, new THREE.Vector3(0.36, 0.36, 0.36)), C(PAL.laiton))
  const lamps: BakeLamp[] = [
    { x: _p.x, y: _p.y, z: _p.z, color: new THREE.Color(layout.lamp), radius: Math.max(5, L), power: 0.9 },
  ]
  const grid = new LampGrid(lamps)
  const base = new THREE.Color(0x6a5866)
  const geo = b.build()
  bakeGlow(geo, grid.near, base, null)
  const group = new THREE.Group()
  group.name = `interieur:${def.id}`
  const structure = new THREE.Mesh(geo, glow)
  const lights = new THREE.Mesh(e.build(), emissive)
  group.add(structure, lights)

  const sea = new THREE.Mesh(DISC, seaMat)
  sea.position.copy(seaAt)
  sea.quaternion.copy(facing)
  sea.scale.setScalar(0.34)
  group.add(sea)

  let alive = true
  const propGroup = new THREE.Group()
  group.add(propGroup)
  void loadProps().then((geos) => {
    if (!alive) return
    const specs = layout.props.map((p) => {
      framePoint(f, p.u, p.y, p.d, _p)
      return { model: p.model, x: _p.x, y: _p.y, z: _p.z, yaw: p.yaw, height: PROPS.height[p.model] }
    })
    propGroup.add(...propMeshes(specs, geos, glow, { near: grid.near, base, sky: null }))
  })

  return {
    group,
    dispose() {
      alive = false
      geo.dispose()
      lights.geometry.dispose()
      for (const c of propGroup.children) (c as THREE.InstancedMesh).dispose()
      group.removeFromParent()
    },
  }
}

type BoxFn = (g: GeoBuilder, u: number, y: number, d: number, su: number, sy: number, sd: number, color: THREE.ColorRepresentation) => void

function furniture(b: GeoBuilder, box: BoxFn, f: Furn): void {
  const { u, d, y, su, sd, sh } = f
  const wood = C(PAL.bois)
  const dark = C(PAL.boisOmbre, 1.2)
  const cloth = C(f.color)
  switch (f.kind) {
    case 'lit':
      box(b, u, y + 0.15, d, su, 0.3, sd, wood)
      box(b, u, y + 0.38, d, su - 0.08, 0.16, sd - 0.08, C(PAL.toile))
      box(b, u + 0.15, y + 0.47, d, su - 0.5, 0.06, sd - 0.04, cloth)
      box(b, u - su / 2 + 0.25, y + 0.5, d, 0.35, 0.12, sd - 0.3, C(PAL.blanc))
      box(b, u - su / 2 - 0.03, y + 0.45, d, 0.06, 0.9, sd, wood)
      break
    case 'hamac':
      box(b, u, y + 0.85, d, su, 0.1, sd * 0.6, cloth)
      for (const s of [-1, 1]) box(b, u + (s * su) / 2, y + 1.1, d, 0.04, 0.5, 0.04, C(PAL.corde))
      break
    case 'table':
      box(b, u, y + sh - 0.03, d, su, 0.06, sd, wood)
      for (const a of [-1, 1]) for (const c of [-1, 1]) box(b, u + a * (su / 2 - 0.08), y + sh / 2, d + c * (sd / 2 - 0.08), 0.06, sh, 0.06, dark)
      box(b, u, y + sh + 0.06, d, 0.12, 0.12, 0.12, C(PAL.laiton))
      break
    case 'etagere':
      for (const a of [-1, 1]) box(b, u + (a * su) / 2, y + sh / 2, d, 0.05, sh, sd, dark)
      for (let i = 0; i < 4; i++) {
        const sy = y + 0.3 + i * 0.5
        box(b, u, sy, d, su, 0.04, sd, wood)
        for (let j = 0; j < 4; j++) box(b, u - su / 2 + 0.2 + j * 0.27, sy + 0.12, d, 0.14, 0.2, sd * 0.7, C([PAL.tissu1, PAL.teal, PAL.creme, PAL.tissu3, PAL.vertDoux][(i + j) % 5]!))
      }
      break
    case 'coffre':
      box(b, u, y + sh / 2, d, su, sh, sd, C(PAL.rouille, 1.1))
      box(b, u, y + sh - 0.02, d, su + 0.02, 0.06, sd + 0.02, C(PAL.laiton))
      break
    case 'poele':
      box(b, u, y + 0.35, d, su, 0.7, sd, C(PAL.metalSombre))
      box(b, u, y + 0.72, d, su + 0.04, 0.04, sd + 0.04, C(PAL.metal))
      box(b, u, y + 1.5, d - sd / 4, 0.12, 1.5, 0.12, C(PAL.metalSombre))
      box(b, u + 0.12, y + 0.82, d, 0.22, 0.16, 0.22, C(PAL.rouille))
      break
    case 'etabli':
      box(b, u, y + sh - 0.04, d, su, 0.08, sd, wood)
      box(b, u, y + 0.25, d, su - 0.1, 0.05, sd - 0.1, dark)
      for (const a of [-1, 1]) box(b, u + a * (su / 2 - 0.08), y + sh / 2, d, 0.08, sh, sd - 0.1, dark)
      for (let j = 0; j < 3; j++) box(b, u - 0.4 + j * 0.4, y + sh + 0.06, d, 0.18, 0.1, 0.12, C([PAL.metal, PAL.laiton, PAL.rouille][j]!))
      break
    case 'comptoir':
      box(b, u, y + sh / 2, d, su, sh, sd, C(PAL.teal, 0.95))
      box(b, u, y + sh, d, su + 0.06, 0.05, sd + 0.06, wood)
      for (let j = 0; j < 4; j++) box(b, u - su / 2 + 0.25 + j * 0.42, y + sh + 0.1, d, 0.2, 0.16, 0.2, C([PAL.poisson, PAL.pain, PAL.tissu2, PAL.vertDoux][j]!))
      break
    case 'caisses':
      box(b, u - 0.25, y + 0.25, d, 0.5, 0.5, sd, wood)
      box(b, u + 0.25, y + 0.22, d, 0.45, 0.44, sd - 0.1, C(PAL.boisClair))
      box(b, u - 0.1, y + 0.72, d, 0.42, 0.44, sd - 0.12, C(PAL.bois, 0.85))
      break
    case 'tapis':
      box(b, u, y + 0.01, d, su, 0.02, sd, cloth)
      box(b, u, y + 0.015, d, su - 0.3, 0.02, sd - 0.3, C(PAL.creme, 0.95))
      break
    case 'coussins':
      for (let j = 0; j < 3; j++) box(b, u - su / 3 + (j * su) / 3, y + 0.15, d, su / 3 - 0.06, 0.3, sd, C(j === 1 ? PAL.tissu2 : f.color))
      break
    case 'cadre':
      box(b, u, y, d, su, sh, 0.04, dark)
      box(b, u, y, d + 0.015, su - 0.1, sh - 0.1, 0.02, C(PAL.bleuDoux, 1.1))
      break
    case 'filet':
      box(b, u, y, d + 0.02, su, sh, 0.02, C(PAL.corde, 0.9))
      break
    case 'bouee':
      box(b, u, y, d + 0.04, su, 0.18, 0.08, C(PAL.tissu1))
      box(b, u, y, d + 0.04, 0.18, sh, 0.08, C(PAL.blanc))
      break
    case 'poissons':
      for (let j = 0; j < 4; j++) box(b, u - su / 2 + 0.2 + j * 0.34, y - (j % 2) * 0.12, d + 0.05, 0.26, 0.1, 0.05, C(PAL.poisson))
      break
    case 'jouets':
      box(b, u - 0.2, y + 0.1, d, 0.2, 0.2, 0.2, C(PAL.tissu1))
      box(b, u + 0.15, y + 0.08, d + 0.1, 0.16, 0.16, 0.16, C(PAL.teal))
      box(b, u + 0.05, y + 0.25, d - 0.1, 0.3, 0.06, 0.12, C(PAL.pain))
      break
    case 'theiere':
      box(b, u, y + 0.4, d, su, 0.8, sd, wood)
      box(b, u - 0.15, y + 0.9, d, 0.22, 0.2, 0.22, C(PAL.laiton))
      box(b, u + 0.2, y + 0.86, d, 0.1, 0.12, 0.1, C(PAL.creme))
      break
  }
}
