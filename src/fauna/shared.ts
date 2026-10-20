import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CEILING_Y } from '../core/layout'
import type { CelMaterialParams, GameContext, Vec3 } from '../core/types'

export const PALETTE = {
  abysse: 0x0e3b52,
  profond: 0x1b5e73,
  milieu: 0x3a8c98,
  clair: 0x7cc6bf,
  plafond: 0xcfefe3,
  bio1: 0x6ff0e0,
  bio2: 0xb6a8ff,
  sable: 0xe9ddb8,
  corail1: 0xf08a7e,
  corail2: 0xf7b267,
  corail3: 0xb784c9,
  blanc: 0xf4f1e6,
  blancOmbre: 0xdceff0,
  laiton: 0xd9b48f,
  roche: 0x7d8a96,
  rocheOmbre: 0x45507a,
  herbe: 0x8fbf6a,
} as const

export const faunaTime = { value: 0 }

export function celMaterial(ctx: GameContext, params: CelMaterialParams): THREE.Material {
  const r = ctx.services.render
  if (r) return r.cel(params)
  return new THREE.MeshToonMaterial({
    color: params.color,
    emissive: params.emissive ?? 0x000000,
    vertexColors: params.vertexColors ?? false,
    transparent: params.transparent ?? false,
    side: params.side ?? THREE.FrontSide,
  })
}

export function setOpacity(mat: THREE.Material, opacity: number): void {
  mat.transparent = true
  mat.opacity = opacity
  mat.depthWrite = false
}

export interface ShaderPatch {
  key: string
  uniforms?: Record<string, { value: unknown }>
  header?: string
  vertex?: string
  fragmentHeader?: string
  fragment?: { after: string; code: string }
}

// three caches programs by customProgramCacheKey, which defaults to onBeforeCompile.toString():
// every patched material shares that source text, so the key must name the patch or programs collide.
export function patchVertex(mat: THREE.Material, patch: ShaderPatch): void {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    shader.uniforms.uFaunaTime = faunaTime
    if (patch.uniforms) Object.assign(shader.uniforms, patch.uniforms)
    const head = `uniform float uFaunaTime;\n${patch.header ?? ''}\n`
    if (shader.vertexShader.includes('#include <common>')) {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`)
    } else {
      shader.vertexShader = head + shader.vertexShader
    }
    if (patch.vertex && shader.vertexShader.includes('#include <begin_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${patch.vertex}`)
    }
    if (patch.fragment && shader.fragmentShader.includes(patch.fragment.after)) {
      const fh = patch.fragmentHeader ?? ''
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fh}`)
        .replace(patch.fragment.after, `${patch.fragment.after}\n${patch.fragment.code}`)
    }
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|fauna:${patch.key}`
  mat.needsUpdate = true
}

export function paint(geo: THREE.BufferGeometry, color: number | THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  g.deleteAttribute('uv')
  const c = new THREE.Color(color)
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

export function paintGradientY(geo: THREE.BufferGeometry, top: number, bottom: number, y0: number, y1: number): THREE.BufferGeometry {
  const g = paint(geo, top)
  const pos = g.getAttribute('position')
  const col = g.getAttribute('color') as THREE.BufferAttribute
  const a = new THREE.Color(bottom)
  const b = new THREE.Color(top)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i), y0, y1)
    c.copy(a).lerp(b, t)
    col.setXYZ(i, c.r, c.g, c.b)
  }
  return g
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!g) throw new Error('fauna: geometry merge failed')
  g.computeBoundingSphere()
  return g
}

export function floorAt(ctx: GameContext, x: number, z: number): number {
  return ctx.services.world?.heightAt(x, z) ?? 0
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 }
export function currentAt(ctx: GameContext, p: Vec3): Vec3 {
  return ctx.services.world?.currentAt(p) ?? ctx.state.env.current ?? ZERO
}

export function clampWaterY(ctx: GameContext, x: number, y: number, z: number, aboveFloor: number, belowCeiling = 4): number {
  const lo = floorAt(ctx, x, z) + aboveFloor
  const hi = CEILING_Y - belowCeiling
  return Math.min(Math.max(y, lo), Math.max(lo, hi))
}

export function heroInWater(ctx: GameContext): boolean {
  return ctx.state.hero.medium === 'water'
}

export function dist2(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export function isNight(ctx: GameContext): boolean {
  const h = ctx.state.time.hours
  return h >= 19.5 || h < 5
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.removeFromParent()
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}

/** Writes a model matrix whose +z points along `dir`, upright w.r.t. world +y, into `out` at `offset`. */
export function writeBasis(out: Float32Array, offset: number, px: number, py: number, pz: number,
  dx: number, dy: number, dz: number, s: number): void {
  let l = Math.hypot(dx, dy, dz)
  if (l < 1e-5) { dx = 0; dy = 0; dz = 1; l = 1 }
  const fx = dx / l, fy = dy / l, fz = dz / l
  let rx = fz, rz = -fx
  let rl = Math.hypot(rx, rz)
  if (rl < 1e-4) { rx = 1; rz = 0; rl = 1 }
  rx /= rl; rz /= rl
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx
  out[offset] = rx * s; out[offset + 1] = 0; out[offset + 2] = rz * s; out[offset + 3] = 0
  out[offset + 4] = ux * s; out[offset + 5] = uy * s; out[offset + 6] = uz * s; out[offset + 7] = 0
  out[offset + 8] = fx * s; out[offset + 9] = fy * s; out[offset + 10] = fz * s; out[offset + 11] = 0
  out[offset + 12] = px; out[offset + 13] = py; out[offset + 14] = pz; out[offset + 15] = 1
}

export function hideInstance(out: Float32Array, offset: number): void {
  out.fill(0, offset, offset + 16)
  out[offset + 15] = 1
}

/** Grows a deformed mesh's bounding sphere by the vertex shader's reach `pad`, so frustum culling stays safe. */
export function padBounds(geo: THREE.BufferGeometry, pad: number): THREE.BufferGeometry {
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  geo.boundingSphere!.radius += pad
  return geo
}

/** Fits `mesh.boundingSphere` around its shown instances so three culls it (camera and shadow); hides it when none is shown. */
export function fitInstances(mesh: THREE.InstancedMesh, pad: number): void {
  const a = mesh.instanceMatrix.array as Float32Array
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  let s2 = 0
  for (let i = 0; i < mesh.count; i++) {
    const o = i * 16
    const c0 = a[o]! * a[o]! + a[o + 1]! * a[o + 1]! + a[o + 2]! * a[o + 2]!
    const c1 = a[o + 4]! * a[o + 4]! + a[o + 5]! * a[o + 5]! + a[o + 6]! * a[o + 6]!
    const c2 = a[o + 8]! * a[o + 8]! + a[o + 9]! * a[o + 9]! + a[o + 10]! * a[o + 10]!
    const m = Math.max(c0, c1, c2)
    if (m === 0) continue
    if (m > s2) s2 = m
    const x = a[o + 12]!, y = a[o + 13]!, z = a[o + 14]!
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
    if (z < z0) z0 = z
    if (z > z1) z1 = z
  }
  mesh.visible = s2 > 0
  if (!mesh.visible) return
  const geo = mesh.geometry
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  const g = geo.boundingSphere!
  const sphere = mesh.boundingSphere ?? (mesh.boundingSphere = new THREE.Sphere())
  sphere.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  sphere.radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + (g.center.length() + g.radius + pad) * Math.sqrt(s2)
}
