import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import { jellyBellGeometry, jellyTentacleGeometry } from './models'
import { PALETTE, celMaterial, clampWaterY, currentAt, heroInWater, hideInstance, isNight, patchVertex, setOpacity } from './shared'

const MAX = 140
const RANGE = 75
const STING_COOLDOWN = 2.5

/** Jellyfish around the hero: density from env.jellyfish, night and the lantern. Touching one stings. */
export class Jellyfish {
  readonly group = new THREE.Group()
  private readonly bell: THREE.InstancedMesh
  private readonly tentacles: THREE.InstancedMesh
  private readonly pos = new Float32Array(MAX * 3)
  private readonly drift = new Float32Array(MAX * 3)
  private readonly size = new Float32Array(MAX)
  private readonly alive = new Uint8Array(MAX)
  private readonly fade = new Float32Array(MAX)
  private readonly rng: () => number
  private stingCooldown = 0
  private target = 0
  private readonly probe: Vec3 = { x: 0, y: 0, z: 0 }

  constructor(private readonly ctx: GameContext) {
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
    const night = isNight(ctx)
    const lantern = night && (ctx.services.gameplay?.hasItem('lanterne') ?? false)
    let n = 4 + env.jellyfish * (night ? 110 : 35)
    if (lantern) n *= 1.3
    if (ctx.state.act === 1) n = Math.min(n, 14)
    return Math.min(MAX, Math.round(n))
  }

  private spawn(i: number, hero: Vec3, near: boolean): void {
    const r = this.rng
    const a = r() * Math.PI * 2
    const d = near ? 8 + r() * 50 : 45 + r() * 25
    const x = hero.x + Math.cos(a) * d
    const z = hero.z + Math.sin(a) * d
    const y = clampWaterY(this.ctx, x, hero.y + (r() - 0.3) * 18, z, 3, 3)
    this.pos.set([x, y, z], i * 3)
    this.drift.set([(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3], i * 3)
    this.size[i] = 0.7 + r() * 0.9
    this.alive[i] = 1
    this.fade[i] = near ? 1 : 0
  }

  near(p: Vec3, r: number): number {
    let n = 0
    const r2 = r * r
    for (let i = 0; i < MAX; i++) {
      if (!this.alive[i]) continue
      const dx = this.pos[i * 3] - p.x, dy = this.pos[i * 3 + 1] - p.y, dz = this.pos[i * 3 + 2] - p.z
      if (dx * dx + dy * dy + dz * dz < r2) n++
    }
    return n
  }

  update(dt: number): void {
    const ctx = this.ctx
    const hero = ctx.state.hero.position
    const inWater = heroInWater(ctx)
    const t = ctx.clock.elapsed
    const night = isNight(ctx)
    const lantern = night && (ctx.services.gameplay?.hasItem('lanterne') ?? false)
    this.target = this.desired()
    this.stingCooldown = Math.max(0, this.stingCooldown - dt)
    let alive = 0
    for (let i = 0; i < MAX; i++) alive += this.alive[i]
    const firstFill = alive === 0
    for (let i = 0; i < MAX && alive < this.target; i++) {
      if (this.alive[i]) continue
      this.spawn(i, hero, firstFill)
      alive++
    }
    const bArr = this.bell.instanceMatrix.array as Float32Array
    const tArr = this.tentacles.instanceMatrix.array as Float32Array
    let surplus = alive - this.target
    for (let i = 0; i < MAX; i++) {
      const o = i * 16
      if (!this.alive[i]) continue
      const k = i * 3
      let x = this.pos[k], y = this.pos[k + 1], z = this.pos[k + 2]
      const dx = x - hero.x, dy = y - hero.y, dz = z - hero.z
      const d = Math.hypot(dx, dy, dz)
      if (d > RANGE || (surplus > 0 && d > 40)) {
        if (surplus > 0) {
          this.alive[i] = 0
          surplus--
          hideInstance(bArr, o)
          hideInstance(tArr, o)
          continue
        }
        this.spawn(i, hero, false)
        x = this.pos[k]; y = this.pos[k + 1]; z = this.pos[k + 2]
      }
      this.probe.x = x; this.probe.y = y; this.probe.z = z
      const cur = currentAt(ctx, this.probe)
      const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 1.9 + i * 0.37 * 6.2831), 3)
      let vx = this.drift[k] + cur.x * 0.7
      let vy = 0.05 + pulse * 0.35 - 0.12
      let vz = this.drift[k + 2] + cur.z * 0.7
      if (lantern && inWater && d < 40) {
        const pull = 0.45 / Math.max(d, 1)
        vx -= dx * pull; vy -= dy * pull; vz -= dz * pull
      }
      x += vx * dt; y += vy * dt; z += vz * dt
      y = clampWaterY(ctx, x, y, z, 2.5, 2)
      this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z
      this.fade[i] = Math.min(1, this.fade[i] + dt * 0.4)
      const s = this.size[i] * this.fade[i]
      const tilt = Math.sin(t * 0.5 + i) * 0.15
      const c = Math.cos(tilt), sn = Math.sin(tilt)
      bArr.fill(0, o, o + 16)
      bArr[o] = s * c; bArr[o + 1] = s * sn; bArr[o + 4] = -s * sn; bArr[o + 5] = s * c; bArr[o + 10] = s
      bArr[o + 12] = x; bArr[o + 13] = y; bArr[o + 14] = z; bArr[o + 15] = 1
      tArr.set(bArr.subarray(o, o + 16), o)

      if (inWater && this.stingCooldown === 0) {
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
