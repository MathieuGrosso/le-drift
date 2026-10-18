import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import { jellyBellGeometry, jellyTentacleGeometry } from './models'
import { PALETTE, celMaterial, clampWaterY, currentAt, heroInWater, hideInstance, patchVertex, setOpacity } from './shared'
import type { DriftFrame, Stage } from './stage'

const MAX = 120
const RANGE = 70
const STING_COOLDOWN = 2.5

/**
 * Jellyfish in front of the watched glass; density from env.jellyfish. At night they come to the lit
 * glass and press against it, riding along with the Drift. They only sting during a sortie.
 */
export class Jellyfish {
  readonly group = new THREE.Group()
  private readonly bell: THREE.InstancedMesh
  private readonly tentacles: THREE.InstancedMesh
  private readonly pos = new Float32Array(MAX * 3)
  private readonly drift = new Float32Array(MAX * 3)
  private readonly size = new Float32Array(MAX)
  private readonly alive = new Uint8Array(MAX)
  private readonly pressed = new Uint8Array(MAX)
  private readonly fade = new Float32Array(MAX)
  private readonly rng: () => number
  private stingCooldown = 0
  private epoch = -1
  private readonly probe: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly tmp = new THREE.Vector3()

  constructor(private readonly ctx: GameContext, private readonly stage: Stage, private readonly frame: DriftFrame) {
    this.rng = ctx.rng('fauna:jelly')
    const phase = new Float32Array(MAX)
    for (let i = 0; i < MAX; i++) phase[i] = this.rng()

    const bellGeo = jellyBellGeometry()
    bellGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const bellMat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, emissive: PALETTE.bio2, transparent: true, side: THREE.DoubleSide })
    setOpacity(bellMat, 0.72)
    patchVertex(bellMat, {
      key: 'jelly-bell',
      header: 'attribute float aPhase;',
      vertex: `float jp = uFaunaTime * 1.9 + aPhase * 6.2831;
float jpulse = pow(0.5 + 0.5 * sin(jp), 3.0);
float jrim = 1.0 - clamp(position.y / 0.42, 0.0, 1.0);
transformed.xz *= 1.0 - 0.22 * jpulse * jrim;
transformed.y *= 1.0 + 0.12 * jpulse;`,
    })
    this.bell = new THREE.InstancedMesh(bellGeo, bellMat, MAX)

    const tGeo = jellyTentacleGeometry()
    tGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const tMat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, emissive: PALETTE.bio1, transparent: true, side: THREE.DoubleSide })
    setOpacity(tMat, 0.6)
    patchVertex(tMat, {
      key: 'jelly-tentacle',
      header: 'attribute float aPhase;',
      vertex: `float jd = -position.y;
transformed.x += sin(uFaunaTime * 1.4 + aPhase * 6.2831 + jd * 2.6) * 0.14 * jd;
transformed.z += cos(uFaunaTime * 1.1 + aPhase * 4.0 + jd * 2.1) * 0.1 * jd;`,
    })
    this.tentacles = new THREE.InstancedMesh(tGeo, tMat, MAX)
    for (const m of [this.bell, this.tentacles]) {
      m.frustumCulled = false
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      const arr = m.instanceMatrix.array as Float32Array
      for (let i = 0; i < MAX; i++) hideInstance(arr, i * 16)
      m.renderOrder = 2
    }
    this.group.add(this.tentacles, this.bell)
  }

  private desired(): number {
    const ctx = this.ctx
    const env = ctx.state.env
    const night = this.stage.night
    let n = night ? 3 + env.jellyfish * 70 : 0
    if (night && this.stage.kind !== 'sortie') n += 6
    if (ctx.state.act === 1) n = Math.min(n, 16)
    return Math.min(MAX, Math.round(n))
  }

  private spawn(i: number, near: boolean): void {
    const r = this.rng
    const st = this.stage
    const out = this.tmp
    if (st.kind === 'sortie') {
      const a = r() * Math.PI * 2
      const d = near ? 8 + r() * 45 : 40 + r() * 25
      out.set(st.pos.x + Math.cos(a) * d, st.pos.y + (r() - 0.3) * 18, st.pos.z + Math.sin(a) * d)
      this.pressed[i] = 0
    } else if (st.night && r() < 0.5) {
      st.point(0.45 + r() * 0.9, (r() - 0.5) * 9, (r() - 0.45) * 5, out)
      this.pressed[i] = 1
    } else {
      const d = st.night ? (near ? 3 + r() * 40 : 30 + r() * 30) : 16 + r() * 34
      st.point(d, (r() - 0.5) * (12 + d), (r() - 0.4) * (6 + d * 0.4), out)
      this.pressed[i] = 0
    }
    const y = clampWaterY(this.ctx, out.x, out.y, out.z, 3, 3)
    this.pos[i * 3] = out.x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = out.z
    this.drift[i * 3] = (r() - 0.5) * 0.3; this.drift[i * 3 + 1] = 0; this.drift[i * 3 + 2] = (r() - 0.5) * 0.3
    this.size[i] = this.pressed[i] ? 0.55 + r() * 0.5 : 0.7 + r() * 0.9
    this.alive[i] = 1
    this.fade[i] = near && !this.pressed[i] ? 1 : 0
  }

  near(p: Vec3, r: number): number {
    let n = 0
    const r2 = r * r
    for (let i = 0; i < MAX; i++) {
      if (!this.alive[i]) continue
      const dx = this.pos[i * 3]! - p.x, dy = this.pos[i * 3 + 1]! - p.y, dz = this.pos[i * 3 + 2]! - p.z
      if (dx * dx + dy * dy + dz * dz < r2) n++
    }
    return n
  }

  update(dt: number): void {
    const ctx = this.ctx
    const st = this.stage
    const hero = ctx.state.hero.position
    const inWater = heroInWater(ctx)
    const t = ctx.clock.elapsed
    const target = this.desired()
    const dv = this.frame.velocity
    this.stingCooldown = Math.max(0, this.stingCooldown - dt)
    const jumped = st.epoch !== this.epoch
    this.epoch = st.epoch
    let alive = 0
    for (let i = 0; i < MAX; i++) {
      if (jumped && this.alive[i]) this.spawn(i, true)
      alive += this.alive[i]!
    }
    const firstFill = alive === 0
    for (let i = 0; i < MAX && alive < target; i++) {
      if (this.alive[i]) continue
      this.spawn(i, firstFill)
      alive++
    }
    const bArr = this.bell.instanceMatrix.array as Float32Array
    const tArr = this.tentacles.instanceMatrix.array as Float32Array
    let surplus = alive - target
    for (let i = 0; i < MAX; i++) {
      const o = i * 16
      if (!this.alive[i]) continue
      const k = i * 3
      let x = this.pos[k]!, y = this.pos[k + 1]!, z = this.pos[k + 2]!
      this.tmp.set(x, y, z)
      const depth = st.kind === 'sortie' ? 10 : st.depth(this.tmp)
      const d = this.tmp.distanceTo(st.pos)
      const unpress = this.pressed[i] && !st.night
      if (d > RANGE || depth < -1 || unpress || (surplus > 0 && (d > 30 || target === 0))) {
        if (surplus > 0) {
          this.alive[i] = 0
          surplus--
          hideInstance(bArr, o)
          hideInstance(tArr, o)
          continue
        }
        this.spawn(i, false)
        x = this.pos[k]!; y = this.pos[k + 1]!; z = this.pos[k + 2]!
      }
      this.probe.x = x; this.probe.y = y; this.probe.z = z
      const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 1.9 + i * 0.37 * 6.2831), 3)
      let vx: number, vy: number, vz: number
      if (this.pressed[i]) {
        const wob = Math.sin(t * 0.3 + i) * 0.08
        vx = dv.x + this.drift[k]! * 0.3 + st.tangent.x * wob
        vy = (pulse - 0.35) * 0.25
        vz = dv.z + this.drift[k + 2]! * 0.3 + st.tangent.z * wob
      } else {
        const cur = currentAt(ctx, this.probe)
        vx = this.drift[k]! + cur.x * 0.7
        vy = 0.05 + pulse * 0.35 - 0.12
        vz = this.drift[k + 2]! + cur.z * 0.7
        if (st.night && st.kind !== 'sortie' && d < 25) {
          const pull = 0.18 / Math.max(d, 1)
          vx -= (x - st.pos.x) * pull; vy -= (y - st.pos.y) * pull; vz -= (z - st.pos.z) * pull
        }
      }
      x += vx * dt; y += vy * dt; z += vz * dt
      if (st.kind !== 'sortie') {
        this.tmp.set(x, y, z)
        const dd = st.depth(this.tmp)
        const lo = this.pressed[i] ? 0.4 * this.size[i]! + 0.25 : 1.2
        const hi = this.pressed[i] ? lo + 0.6 : Infinity
        const fix = dd < lo ? lo - dd : dd > hi ? hi - dd : 0
        if (fix !== 0) { x += st.normal.x * fix; y += st.normal.y * fix; z += st.normal.z * fix }
      }
      y = clampWaterY(ctx, x, y, z, 2.5, 2)
      this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z
      this.fade[i] = Math.min(1, this.fade[i]! + dt * 0.4)
      const s = this.size[i]! * this.fade[i]!
      bArr.fill(0, o, o + 16)
      if (this.pressed[i]) {
        const a = 0.95 + Math.sin(t * 0.7 + i) * 0.12
        const ca = Math.cos(a), sa = Math.sin(a)
        const T = st.tangent, U = st.up, N = st.normal
        const yx = U.x * ca - N.x * sa, yy = U.y * ca - N.y * sa, yz = U.z * ca - N.z * sa
        bArr[o] = T.x * s; bArr[o + 1] = T.y * s; bArr[o + 2] = T.z * s
        bArr[o + 4] = yx * s; bArr[o + 5] = yy * s; bArr[o + 6] = yz * s
        bArr[o + 8] = (T.y * yz - T.z * yy) * s; bArr[o + 9] = (T.z * yx - T.x * yz) * s; bArr[o + 10] = (T.x * yy - T.y * yx) * s
      } else {
        const tilt = Math.sin(t * 0.5 + i) * 0.15
        const c = Math.cos(tilt), sn = Math.sin(tilt)
        bArr[o] = s * c; bArr[o + 1] = s * sn; bArr[o + 4] = -s * sn; bArr[o + 5] = s * c; bArr[o + 10] = s
      }
      bArr[o + 12] = x; bArr[o + 13] = y; bArr[o + 14] = z; bArr[o + 15] = 1
      tArr.set(bArr.subarray(o, o + 16), o)

      if (inWater && st.kind === 'sortie' && this.stingCooldown === 0) {
        const reach = 0.55 * s + 0.45
        const hx = hero.x - x, hz = hero.z - z
        const hy = hero.y + 0.9 - y
        if (hx * hx + hz * hz < reach * reach && hy > -1.9 * s - 0.8 && hy < 0.6 * s + 0.8) {
          this.stingCooldown = STING_COOLDOWN
          ctx.bus.emit('hero:stung', { by: 'meduse' })
        }
      }
    }
    this.bell.instanceMatrix.needsUpdate = true
    this.tentacles.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.group.removeFromParent()
    for (const m of [this.bell, this.tentacles]) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
      m.dispose()
    }
  }
}
