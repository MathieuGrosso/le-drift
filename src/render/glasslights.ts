import * as THREE from 'three'
import type { Vec3 } from '../core/types'
import type { GlassParams } from './glass'
import { MAX_GLASS, type InternalUniforms } from './uniforms'

export interface GlassLight {
  id: string
  center: Vec3
  normal: Vec3
  width: number
  height: number
  round?: boolean
  coat: number
}

interface Pane {
  mesh: THREE.Mesh
  index: number
  round: boolean
  center: THREE.Vector3
  normal: THREE.Vector3
  halfW: number
  halfH: number
  coat: number
  key: string
  roof: boolean
}

interface RoofRect { cx: number; cy: number; cz: number; hx: number; hz: number }

interface Slot { key: string; strength: number; target: number; pane: Pane | null; clean: number; round: number; roof: number }

const SCAN_EVERY = 0.75
const RANGE = 42

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _n = new THREE.Vector3()
const _c = new THREE.Vector3()
const ROOF_MIN_AREA = 30

function roofOf(g: THREE.BufferGeometry): RoofRect | null {
  const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return null
  const idx = g.index
  const tris = idx ? idx.count / 3 : pos.count / 3
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const box = new THREE.Box3()
  let area = 0
  for (let t = 0; t < tris; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    const n = b.clone().sub(a).cross(c.clone().sub(a))
    const len = n.length()
    if (len < 1e-6 || Math.abs(n.y) / len < 0.45) continue
    area += len / 2
    box.expandByPoint(a).expandByPoint(b).expandByPoint(c)
  }
  if (area < ROOF_MIN_AREA || box.isEmpty()) return null
  return {
    cx: (box.min.x + box.max.x) / 2, cy: box.max.y, cz: (box.min.z + box.max.z) / 2,
    hx: (box.max.x - box.min.x) / 2 * 0.85, hz: (box.max.z - box.min.z) / 2 * 0.85,
  }
}

function adoptable(o: THREE.Object3D): o is THREE.Mesh {
  const mesh = o as THREE.Mesh
  if (!mesh.isMesh || Array.isArray(mesh.material)) return false
  const mat = mesh.material as THREE.ShaderMaterial
  if (!mat.isShaderMaterial || mat.userData.rdGlass) return false
  if (mesh.name.startsWith('verre:')) return true
  const g = mesh.geometry
  return !!g.getAttribute('aCoat') && !!g.getAttribute('aSize') && !!g.getAttribute('aSeed') && 'uRound' in mat.uniforms
}

function isGlassMesh(o: THREE.Object3D): o is THREE.Mesh {
  const mesh = o as THREE.Mesh
  if (!mesh.isMesh) return false
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  if (mat?.userData.rdGlass === true && mat.userData.glassUniforms) {
    const dome = (mat as THREE.ShaderMaterial).uniforms?.rgDome?.value === 1
    if (!dome) return true
  }
  const g = mesh.geometry
  return !!g?.getAttribute('aCoat') && !!g.getAttribute('aSize')
}

function roundOf(mesh: THREE.Mesh): boolean {
  const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.ShaderMaterial | undefined
  const u = mat?.uniforms
  return (u?.rgRound?.value ?? u?.uRound?.value ?? 0) > 0.5
}

export class GlassLights {
  private meshes: THREE.Mesh[] = []
  private scanIn = 0
  private readonly slots: Slot[] = Array.from({ length: MAX_GLASS }, () => ({ key: '', strength: 0, target: 0, pane: null, clean: 0, round: 0, roof: 0 }))
  private explicit: GlassLight[] | null = null
  private readonly cands: Pane[] = []
  private readonly pool: Pane[] = []
  private readonly roofs = new Map<string, RoofRect | null>()
  private roofMeshes: THREE.Mesh[] = []
  active = 0
  liveGlass = 0

  constructor(private readonly u: InternalUniforms, private readonly makeGlass: (p: GlassParams) => THREE.Material) {}

  // Drift panes and city glass come with their own flat shaders; render owns how glass looks.
  private adopt(mesh: THREE.Mesh): void {
    const old = mesh.material as THREE.ShaderMaterial
    if (mesh.name.startsWith('verre:')) {
      mesh.material = this.makeGlass({ dome: true, coat: false, vertexColors: true })
      return
    }
    mesh.material = this.makeGlass({ round: (old.uniforms.uRound?.value ?? 0) > 0.5, coat: true })
  }

  set(list: GlassLight[] | null): void {
    this.explicit = list
  }

  private scan(scene: THREE.Scene): void {
    const found: THREE.Mesh[] = []
    const roofs: THREE.Mesh[] = []
    let live = 0
    scene.traverseVisible((o) => {
      if (adoptable(o)) this.adopt(o)
      if ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).userData?.rdGlass) live++
      if (isGlassMesh(o)) found.push(o)
      else if ((o as THREE.Mesh).isMesh && o.name.startsWith('verre:')) roofs.push(o as THREE.Mesh)
    })
    this.meshes = found
    this.roofMeshes = roofs
    this.liveGlass = live
  }

  private pane(i: number): Pane {
    let p = this.pool[i]
    if (!p) {
      p = { mesh: null as unknown as THREE.Mesh, index: 0, round: false, center: new THREE.Vector3(), normal: new THREE.Vector3(), halfW: 0, halfH: 0, coat: 0, key: '', roof: false }
      this.pool[i] = p
    }
    return p
  }

  private collect(cam: THREE.Vector3): void {
    this.cands.length = 0
    let k = 0
    if (this.explicit) {
      for (const l of this.explicit) {
        const p = this.pane(k++)
        p.center.set(l.center.x, l.center.y, l.center.z)
        p.normal.set(-l.normal.x, -l.normal.y, -l.normal.z).normalize()
        p.halfW = l.width / 2
        p.halfH = l.height / 2
        p.round = l.round ?? false
        p.coat = l.coat
        p.key = l.id
        p.roof = false
        if (p.center.distanceTo(cam) < RANGE * 1.5) this.cands.push(p)
      }
      return
    }
    for (const mesh of this.meshes) {
      const g = mesh.geometry
      const coat = g.getAttribute('aCoat') as THREE.BufferAttribute | undefined
      const size = g.getAttribute('aSize') as THREE.BufferAttribute | undefined
      const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined
      const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh) : null
      const count = inst ? inst.count : 1
      const round = roundOf(mesh)
      if (!g.boundingBox) g.computeBoundingBox()
      const bb = g.boundingBox!
      const gw = bb.max.x - bb.min.x
      const gh = bb.max.y - bb.min.y
      for (let i = 0; i < count; i++) {
        if (inst) {
          inst.getMatrixAt(i, _m)
          _m.premultiply(mesh.matrixWorld)
        } else {
          _m.copy(mesh.matrixWorld)
        }
        _m.decompose(_p, _q, _s)
        if (_s.x < 1e-3 || _p.distanceTo(cam) > RANGE) continue
        const p = this.pane(k++)
        p.mesh = mesh
        p.index = i
        p.round = round
        p.center.copy(_p)
        if (nrm) _n.set(nrm.getX(0), nrm.getY(0), nrm.getZ(0))
        else _n.set(0, 0, 1)
        p.normal.copy(_n).applyQuaternion(_q).normalize().negate()
        const sw = size && inst ? size.getX(i) : gw * _s.x
        const sh = size && inst ? size.getY(i) : gh * _s.y
        p.halfW = Math.max(0.15, sw / 2)
        p.halfH = Math.max(0.15, sh / 2)
        p.coat = coat ? coat.getX(inst ? i : 0) : 0
        p.key = `${mesh.uuid}:${i}`
        p.roof = false
        this.cands.push(p)
      }
    }
    for (const mesh of this.roofMeshes) {
      const g = mesh.geometry
      if (!this.roofs.has(g.uuid)) this.roofs.set(g.uuid, roofOf(g))
      const r = this.roofs.get(g.uuid)
      if (!r) continue
      _p.set(r.cx, r.cy, r.cz).applyMatrix4(mesh.matrixWorld)
      const reach = Math.max(r.hx, r.hz) + 24
      if (_p.distanceTo(cam) > reach) continue
      const p = this.pane(k++)
      p.mesh = mesh
      p.index = 0
      p.round = false
      p.center.copy(_p)
      p.normal.set(0, -1, 0)
      p.halfW = r.hx
      p.halfH = r.hz
      p.coat = 0.3
      p.key = `${mesh.uuid}:roof`
      p.roof = true
      this.cands.push(p)
    }
  }

  private lastWall = 0

  update(_dt: number, scene: THREE.Scene, camera: THREE.Camera, indoor: number): void {
    const now = performance.now() / 1000
    const dt = this.lastWall > 0 ? Math.min(0.1, Math.max(0, now - this.lastWall)) : 0
    this.lastWall = now
    this.scanIn -= dt
    if (this.scanIn <= 0) {
      this.scanIn = SCAN_EVERY
      this.scan(scene)
    }
    const cam = camera.getWorldPosition(_c)
    this.collect(cam)
    const fwd = _n.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_q))
    const score = (p: Pane) => {
      const toP = _p.copy(p.center).sub(cam)
      const d = toP.length()
      const ahead = toP.dot(fwd) / Math.max(d, 1e-3)
      const inFront = toP.dot(p.normal) < 0.5 ? 1 : 0.3
      if (p.roof) return 0.5
      const big = Math.min(2.5, Math.sqrt(p.halfW * p.halfH) * 1.2)
      return ((d * d) / big) * (ahead > -0.2 ? 1 : 2.2) / inFront
    }
    this.cands.sort((a, b) => score(a) - score(b))
    const chosen = this.cands.slice(0, MAX_GLASS)
    const keys = new Set(chosen.map((p) => p.key))
    for (const s of this.slots) {
      s.target = keys.has(s.key) ? 1 : 0
      s.pane = s.target ? chosen.find((p) => p.key === s.key) ?? null : null
    }
    for (const p of chosen) {
      if (this.slots.some((s) => s.key === p.key)) continue
      const free = this.slots.find((s) => s.target === 0 && s.strength < 0.02) ?? null
      if (!free) continue
      free.key = p.key
      free.target = 1
      free.strength = 0
      free.pane = p
    }
    const k = 1 - Math.exp(-dt * 3)
    this.active = 0
    this.slots.forEach((s, i) => {
      s.strength += (s.target * indoor - s.strength) * k
      const A = this.u.rdGlassA.value[i]!
      const B = this.u.rdGlassB.value[i]!
      const C = this.u.rdGlassC.value[i]!
      const p = s.pane
      if (p) {
        A.set(p.center.x, p.center.y, p.center.z, p.halfW)
        B.set(p.normal.x, p.normal.y, p.normal.z, p.halfH)
        s.clean = THREE.MathUtils.clamp(1 - p.coat * 0.7, 0.5, 1)
        s.round = p.round ? 1 : 0
        s.roof = p.roof ? 1 : 0
      }
      if (s.strength < 0.005) {
        C.set(0, 0, 0, 0)
        return
      }
      C.set(s.clean, s.round, s.strength, s.roof)
      this.active++
    })
  }
}
