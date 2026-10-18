import * as THREE from 'three'
import { DRIFT_Y } from '../core/layout'
import type { GameContext, Vec3 } from '../core/types'
import { fishGeometry } from './models'
import { PALETTE, celMaterial, clampWaterY, currentAt, heroInWater, hideInstance, patchVertex, writeBasis } from './shared'
import type { DriftFrame, Stage } from './stage'

interface Species { color: number; scale: number; speed: number; weight: number; swirl: number; spread: number }
const SARDINE: Species = { color: 0xdfe9ec, scale: 0.55, speed: 4.4, weight: 4, swirl: 1.1, spread: 1.5 }
const CORAIL: Species = { color: PALETTE.corail1, scale: 0.72, speed: 3.6, weight: 2, swirl: 0.3, spread: 1.3 }
const DORE: Species = { color: PALETTE.corail2, scale: 0.8, speed: 3.4, weight: 2, swirl: 0.2, spread: 1 }
const MENTHE: Species = { color: PALETTE.clair, scale: 0.62, speed: 4.0, weight: 2, swirl: 0.5, spread: 0.9 }
const MAUVE: Species = { color: PALETTE.corail3, scale: 0.78, speed: 3.2, weight: 1, swirl: 0.1, spread: 1.1 }
const MEROU: Species = { color: 0xc8b48a, scale: 1.9, speed: 1.6, weight: 1, swirl: 0, spread: 1.6 }
const SPECIES: readonly Species[] = [SARDINE, CORAIL, DORE, MENTHE, MAUVE, MEROU]

type SchoolKind = 'stage' | 'wander' | 'drift'
interface School {
  kind: SchoolKind
  start: number
  count: number
  c: THREE.Vector3
  v: THREE.Vector3
  goal: THREE.Vector3
  goalUntil: number
  attractUntil: number
  species: Species
  radius: number
  shown: number
  /** For stage schools: preferred depth in front of the glass, lateral sway amplitude, phase. */
  depth: number
  sway: number
  phase: number
  active: boolean
}

const K = 5
const TAKEN_SECONDS = 150
const WANDER_MIN = 28
const WANDER_MAX = 150
const SORTIE_CLEAR = 7
const SORTIE_NEAR = 4
const SORTIE_FULL = 6
const SORTIE_SIZE = 0.8

/**
 * Instanced fish in boids schools (sampled-neighbour boids: separation, alignment, cohesion), one draw call.
 * Schools gather in front of whatever glass is being looked through; none ever sits behind it.
 */
export class FishSchools {
  readonly group = new THREE.Group()
  private mesh: THREE.InstancedMesh | null = null
  private material: THREE.Material
  private geometry: THREE.BufferGeometry
  private schools: School[] = []
  private pos = new Float32Array(0)
  private vel = new Float32Array(0)
  private scale = new Float32Array(0)
  private nbr = new Int32Array(0)
  private taken = new Float32Array(0)
  private n = 0
  private readonly rng: () => number
  private frameN = 0
  private epoch = -1
  private readonly tmp = new THREE.Vector3()
  private readonly look = new THREE.Vector3()
  private threat: Vec3 | null = null
  private threatRadius = 0

  constructor(private readonly ctx: GameContext, private readonly stage: Stage, private readonly frame: DriftFrame, count: number) {
    this.rng = ctx.rng('fauna:fish')
    this.geometry = fishGeometry()
    this.material = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.55 })
    patchVertex(this.material, {
      key: 'fish',
      header: 'attribute float aPhase;',
      vertex: `float fishTail = clamp(-position.z / 0.3, 0.0, 1.0);
transformed.x += sin(uFaunaTime * (8.0 + aPhase * 3.0) + aPhase * 6.2831 + position.z * 9.0) * 0.045 * (0.2 + fishTail * 1.4);`,
    })
    this.resize(count)
  }

  get count(): number {
    return this.n
  }

  resize(count: number): void {
    if (this.mesh) {
      this.mesh.removeFromParent()
      this.mesh.dispose()
    }
    const n = Math.max(90, Math.floor(count))
    this.n = n
    this.pos = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.scale = new Float32Array(n)
    this.nbr = new Int32Array(n * K)
    this.taken = new Float32Array(n)
    const phase = new Float32Array(n)
    const geo = this.geometry.clone()
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const mesh = new THREE.InstancedMesh(geo, this.material, n)
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.name = 'fauna-fish'
    this.mesh = mesh

    const r = this.rng
    const perSchool = n < 400 ? 60 : n < 900 ? 100 : 150
    const schoolsN = Math.max(4, Math.round(n / perSchool))
    const plan: { kind: SchoolKind; species: Species; depth: number; share: number }[] = [
      { kind: 'stage', species: SARDINE, depth: 9, share: 1.8 },
      { kind: 'stage', species: CORAIL, depth: 5, share: 0.8 },
      { kind: 'drift', species: DORE, depth: 0, share: 1 },
      { kind: 'stage', species: MEROU, depth: 14, share: 0.15 },
      { kind: 'stage', species: MENTHE, depth: 22, share: 1 },
    ]
    while (plan.length < schoolsN) {
      plan.push({ kind: 'wander', species: this.pickSpecies(), depth: 0, share: 1 })
    }
    plan.length = schoolsN
    const total = plan.reduce((a, p) => a + p.share, 0)
    this.schools = []
    let start = 0
    const col = new THREE.Color()
    plan.forEach((p, s) => {
      const cnt = s === plan.length - 1 ? n - start : Math.max(6, Math.floor(n * p.share / total))
      const sp = p.species
      const big = sp.scale > 1.5
      const used = big ? Math.min(cnt, 9) : cnt
      const school: School = {
        kind: p.kind, start, count: used,
        c: new THREE.Vector3(), v: new THREE.Vector3((r() - 0.5) * 2, 0, (r() - 0.5) * 2),
        goal: new THREE.Vector3(), goalUntil: 0, attractUntil: 0,
        species: sp, shown: used, radius: ((big ? 3.5 : 1.6) + Math.cbrt(used) * 0.55 * sp.scale) * sp.spread,
        depth: p.depth, sway: 6 + r() * 10, phase: r() * Math.PI * 2, active: false,
      }
      this.schools.push(school)
      for (let i = start; i < start + cnt; i++) {
        phase[i] = r()
        this.scale[i] = sp.scale * (0.8 + r() * 0.4)
        col.setHex(sp.color).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08)
        mesh.setColorAt(i, col)
        for (let k = 0; k < K; k++) this.nbr[i * K + k] = start + Math.floor(r() * used)
        if (i >= start + used) this.taken[i] = Number.POSITIVE_INFINITY
      }
      start += cnt
    })
    const arr = mesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < n; i++) hideInstance(arr, i * 16)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.group.add(mesh)
    this.epoch = -1
  }

  private pickSpecies(): Species {
    const totalW = SPECIES.reduce((a, s) => a + s.weight, 0)
    let pick = this.rng() * totalW
    for (const s of SPECIES) {
      pick -= s.weight
      if (pick <= 0) return s
    }
    return SARDINE
  }

  private stageGoal(s: School, now: number, out: THREE.Vector3): THREE.Vector3 {
    const st = this.stage
    if (st.kind === 'sortie') {
      const cam = this.ctx.camera.position
      const f = this.ctx.camera.getWorldDirection(this.look)
      const off = 2.5 + s.radius + s.depth * 0.15 + Math.sin(now * 0.05 + s.phase * 2) * 1.2
      const toward = -f.dot(st.normal)
      const t = toward > 0.12 ? THREE.MathUtils.clamp((st.depth(cam) - off) / toward, 10, 24) : 11 + s.depth * 0.5
      const lat = (s.phase - Math.PI) * 0.8 + Math.sin(now * 0.06 + s.phase) * 1.5
      out.copy(cam).addScaledVector(f, t)
      out.addScaledVector(st.tangent, lat)
      out.y += Math.sin(now * 0.08 + s.phase) * 1.2 + (s.phase % 1.7) * 0.6
      const under = st.depth(out) - (2.5 + s.radius)
      if (under < 0) out.addScaledVector(st.normal, -under)
      out.y = clampWaterY(this.ctx, out.x, out.y, out.z, 2 + s.radius * 0.6, 4)
      return out
    }
    const night = st.night
    const d = s.depth * (night ? 0.55 : 1) + Math.sin(now * 0.05 + s.phase) * s.depth * 0.25
    const lat = Math.sin(now * 0.07 + s.phase * 1.7) * s.sway
    const h = Math.sin(now * 0.09 + s.phase) * 2.2 + (s.species === SARDINE ? 1.2 : -0.6)
    st.point(Math.max(2 + s.radius, d), lat, h, out)
    out.y = clampWaterY(this.ctx, out.x, out.y, out.z, 2 + s.radius * 0.6, 4)
    return out
  }

  private wanderGoal(out: THREE.Vector3): THREE.Vector3 {
    const r = this.rng
    const d = WANDER_MIN + r() * (WANDER_MAX - WANDER_MIN)
    this.stage.point(d, (r() - 0.5) * d * 1.4, (r() - 0.5) * Math.min(30, d * 0.5), out)
    out.y = clampWaterY(this.ctx, out.x, out.y, out.z, 4, 5)
    return out
  }

  private driftGoal(out: THREE.Vector3): THREE.Vector3 {
    const f = this.frame
    const t = this.ctx.clock.elapsed * 0.05
    const lx = 150 * Math.sin(t * 0.6), lz = 105 * Math.cos(t * 0.6)
    f.toWorld({ x: lx, y: DRIFT_Y - f.origin.y + Math.sin(t * 1.7) * 6, z: lz }, out)
    out.y = clampWaterY(this.ctx, out.x, out.y, out.z, 4, 5)
    return out
  }

  private place(s: School, now: number): void {
    if (s.kind === 'stage') this.stageGoal(s, now, s.c)
    else if (s.kind === 'wander') this.wanderGoal(s.c)
    else this.driftGoal(s.c)
    s.goal.copy(s.c)
    s.goalUntil = 0
    this.snapSchool(s)
  }

  private snapSchool(s: School): void {
    const r = this.rng
    for (let i = s.start; i < s.start + s.count; i++) {
      const k = i * 3
      const u = r() * Math.PI * 2, w = Math.acos(2 * r() - 1), d = Math.cbrt(r()) * s.radius
      this.pos[k] = s.c.x + Math.sin(w) * Math.cos(u) * d
      this.pos[k + 1] = s.c.y + Math.cos(w) * d * 0.5
      this.pos[k + 2] = s.c.z + Math.sin(w) * Math.sin(u) * d
      this.vel[k] = s.v.x + (r() - 0.5)
      this.vel[k + 1] = (r() - 0.5) * 0.3
      this.vel[k + 2] = s.v.z + (r() - 0.5)
    }
    s.active = true
  }

  /** A predator the fish scatter from this frame (La Chose). */
  setThreat(p: Vec3 | null, radius: number): void {
    this.threat = p
    this.threatRadius = radius
  }

  /** Crumbs through a feeding hatch: the nearest schools come to `p` for a while. */
  attract(p: Vec3): void {
    const now = this.ctx.clock.elapsed
    const at = this.tmp.set(p.x, p.y, p.z)
    if (this.stage.kind !== 'sortie' && this.stage.depth(at) < 2) this.stage.point(3, 0, 0, at)
    let best: School | null = null
    let bestD = Infinity
    for (const s of this.schools) {
      if (s.kind === 'drift') continue
      const d = s.c.distanceToSquared(at)
      if (d < bestD) { bestD = d; best = s }
      if (d < 60 * 60) { s.goal.copy(at); s.attractUntil = now + 25 }
    }
    if (best) { best.goal.copy(at); best.attractUntil = now + 25 }
  }

  /** Moves a school next to `p` if none is within `r`, so a scripted predator always finds prey. */
  ensureNear(p: Vec3, r: number): void {
    let best: School | null = null
    let bestD = Infinity
    const at = this.tmp.set(p.x, p.y, p.z)
    for (const s of this.schools) {
      const d = s.c.distanceTo(at)
      if (d < r && s.active) return
      if (s.kind !== 'drift' && s.species !== MEROU && d < bestD) { bestD = d; best = s }
    }
    if (!best) return
    best.c.set(p.x, clampWaterY(this.ctx, p.x, p.y, p.z, 3), p.z)
    best.goal.copy(best.c)
    best.goalUntil = this.ctx.clock.elapsed + 10
    best.attractUntil = this.ctx.clock.elapsed + 10
    this.snapSchool(best)
  }

  nearestFish(p: Vec3, maxDist: number): number {
    let best = -1
    let bestD = maxDist * maxDist
    const now = this.ctx.clock.elapsed
    const at = this.tmp.set(p.x, p.y, p.z)
    for (const s of this.schools) {
      if (s.species === MEROU) continue
      if (s.c.distanceTo(at) - s.radius * 2 > maxDist) continue
      for (let i = s.start; i < s.start + s.shown; i++) {
        if (this.taken[i] > now) continue
        const k = i * 3
        const dx = this.pos[k] - p.x, dy = this.pos[k + 1] - p.y, dz = this.pos[k + 2] - p.z
        const d = dx * dx + dy * dy + dz * dz
        if (d < bestD) { bestD = d; best = i }
      }
    }
    return best
  }

  fishPosition(i: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pos[i * 3]!, this.pos[i * 3 + 1]!, this.pos[i * 3 + 2]!)
  }

  fishColor(i: number, out: THREE.Color): THREE.Color {
    if (this.mesh) this.mesh.getColorAt(i, out)
    return out
  }

  take(i: number): void {
    this.taken[i] = this.ctx.clock.elapsed + TAKEN_SECONDS
  }

  update(dt: number): void {
    const mesh = this.mesh
    if (!mesh) return
    const ctx = this.ctx
    const now = ctx.clock.elapsed
    const st = this.stage
    const sortie = st.kind === 'sortie'
    const hero = ctx.state.hero.position
    const heroWater = heroInWater(ctx)
    const arr = mesh.instanceMatrix.array as Float32Array
    const r = this.rng
    this.frameN++
    const jumped = st.epoch !== this.epoch
    this.epoch = st.epoch
    for (const s of this.schools) {
      if (jumped || !s.active) {
        this.place(s, now)
      } else if (s.kind === 'wander' && (st.depth(s.c) < 8 || s.c.distanceTo(st.pos) > WANDER_MAX * 1.6)) {
        this.wanderGoal(s.goal)
        if (st.depth(s.c) < -4) this.place(s, now)
      }
      const attracted = now < s.attractUntil
      if (!attracted) {
        if (s.kind === 'stage') this.stageGoal(s, now, s.goal)
        else if (s.kind === 'drift') this.driftGoal(s.goal)
        else if (now > s.goalUntil || s.c.distanceTo(s.goal) < 8) {
          this.wanderGoal(s.goal)
          s.goalUntil = now + 30 + r() * 40
        }
      }
      const speed = s.species.speed * (attracted ? 0.8 : s.kind === 'stage' ? 0.5 : 0.4)
      const desired = this.tmp.copy(s.goal).sub(s.c)
      const dl = desired.length()
      if (dl > 0.01) desired.multiplyScalar(Math.min(speed, dl * 0.5) / dl)
      s.v.lerp(desired, Math.min(1, dt * 0.6))
      const cur = currentAt(ctx, s.c)
      s.c.x += (s.v.x + cur.x * 0.4) * dt
      s.c.y += s.v.y * dt
      s.c.z += (s.v.z + cur.z * 0.4) * dt
      s.c.y = clampWaterY(ctx, s.c.x, s.c.y, s.c.z, Math.max(2.5, s.radius * 0.6), 4)
      if (!sortie) {
        const dc = st.depth(s.c) - (1.5 + s.radius)
        if (dc < 0) s.c.addScaledVector(st.normal, -dc)
      } else {
        const cam = ctx.camera.position
        const clear = SORTIE_CLEAR + s.radius
        const away = this.tmp.copy(s.c).sub(cam)
        const dl = away.length()
        if (dl < clear) s.c.addScaledVector(dl > 1e-3 ? away.divideScalar(dl) : st.normal, clear - dl)
      }
      s.shown = sortie ? sortieShown(s) : s.count
      this.stepSchool(s, dt, now, hero, heroWater, sortie, arr)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  private stepSchool(s: School, dt: number, now: number, hero: Vec3, heroWater: boolean, sortie: boolean, arr: Float32Array): void {
    const pos = this.pos, vel = this.vel, nbr = this.nbr
    const sp = s.species.speed
    const sepR2 = (0.7 * s.species.scale) ** 2
    const rad = s.radius
    const swirl = s.species.swirl
    const threat = this.threat
    const tr = this.threatRadius
    const st = this.stage
    const nx = st.normal.x, ny = st.normal.y, nz = st.normal.z
    const gx = st.pos.x, gy = st.pos.y, gz = st.pos.z
    const cam = this.ctx.camera.position
    const camX = cam.x, camY = cam.y, camZ = cam.z
    for (let i = s.start; i < s.start + s.count; i++) {
      const o = i * 16
      if (this.taken[i]! > now || i >= s.start + s.shown) {
        hideInstance(arr, o)
        continue
      }
      const k = i * 3
      if (this.taken[i] !== 0) {
        this.taken[i] = 0
        pos[k] = s.c.x; pos[k + 1] = s.c.y; pos[k + 2] = s.c.z
      }
      if ((i + this.frameN) % 40 === 0) nbr[i * K + (this.frameN % K)] = s.start + Math.floor(this.rng() * s.shown)
      const px = pos[k]!, py = pos[k + 1]!, pz = pos[k + 2]!
      let vx = vel[k]!, vy = vel[k + 1]!, vz = vel[k + 2]!
      let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0
      for (let q = 0; q < K; q++) {
        const j = nbr[i * K + q]!
        if (j === i) continue
        const jk = j * 3
        const dx = pos[jk]! - px, dy = pos[jk + 1]! - py, dz = pos[jk + 2]! - pz
        const d2 = dx * dx + dy * dy + dz * dz + 1e-4
        if (d2 < sepR2) { sx -= dx / d2; sy -= dy / d2; sz -= dz / d2 }
        ax += vel[jk]!; ay += vel[jk + 1]!; az += vel[jk + 2]!
        cx += dx; cy += dy; cz += dz
      }
      const inv = 1 / K
      let fx = sx * 0.9 + (ax * inv - vx) * 0.9 + cx * inv * 0.35
      let fy = sy * 0.9 + (ay * inv - vy) * 0.9 + cy * inv * 0.35
      let fz = sz * 0.9 + (az * inv - vz) * 0.9 + cz * inv * 0.35
      const ox = s.c.x - px, oy = s.c.y - py, oz = s.c.z - pz
      const od = Math.hypot(ox, oy * 2, oz)
      const pull = od > rad ? 1.6 * (od - rad) / od + 0.15 : 0.15
      fx += ox * pull + (s.v.x - vx) * 0.4
      fy += oy * pull * 1.4
      fz += oz * pull + (s.v.z - vz) * 0.4
      if (swirl > 0) {
        fx += -oz * swirl * 0.9
        fz += ox * swirl * 0.9
      }
      let flee = false
      if (heroWater) {
        const hx = px - hero.x, hy = py - (hero.y + 0.9), hz = pz - hero.z
        const hd2 = hx * hx + hy * hy + hz * hz
        if (hd2 < 25) {
          const hd = Math.sqrt(hd2) + 1e-3
          const f = (5 - hd) * 7 / hd
          fx += hx * f; fy += hy * f; fz += hz * f
          flee = true
        }
      }
      if (threat) {
        const tx = px - threat.x, ty = py - threat.y, tz = pz - threat.z
        const td2 = tx * tx + ty * ty + tz * tz
        if (td2 < tr * tr) {
          const td = Math.sqrt(td2) + 1e-3
          const f = (tr - td) * 4 / td
          fx += tx * f; fy += ty * f; fz += tz * f
          flee = true
        }
      }
      let depth = Infinity
      if (!sortie) {
        depth = (px - gx) * nx + (py - gy) * ny + (pz - gz) * nz
        if (depth < 1.2) { const f = (1.2 - depth) * 8; fx += nx * f; fy += ny * f; fz += nz * f }
      }
      if (py > 116) fy -= (py - 116) * 6
      vx += fx * dt; vy += fy * dt; vz += fz * dt
      const vmax = sp * (flee ? 2.4 : 1)
      const vmin = sp * 0.3
      const vl = Math.hypot(vx, vy, vz)
      if (vl > vmax) { const m = vmax / vl; vx *= m; vy *= m; vz *= m }
      else if (vl < vmin && vl > 1e-4) { const m = vmin / vl; vx *= m; vy *= m; vz *= m }
      vy *= 0.97
      vel[k] = vx; vel[k + 1] = vy; vel[k + 2] = vz
      pos[k] = px + vx * dt
      pos[k + 1] = py + vy * dt
      pos[k + 2] = pz + vz * dt
      let size = this.scale[i]!
      if (sortie) {
        const cx2 = pos[k]! - camX, cy2 = pos[k + 1]! - camY, cz2 = pos[k + 2]! - camZ
        const cd2 = cx2 * cx2 + cy2 * cy2 + cz2 * cz2
        if (cd2 < SORTIE_FULL * SORTIE_FULL) {
          const cd = Math.sqrt(cd2) + 1e-3
          const f = (SORTIE_FULL - cd) * 3 / cd
          vel[k] = vx + cx2 * f * dt; vel[k + 2] = vz + cz2 * f * dt
          if (cd < SORTIE_NEAR) { hideInstance(arr, o); continue }
          size *= (cd - SORTIE_NEAR) / (SORTIE_FULL - SORTIE_NEAR)
        }
        size *= SORTIE_SIZE
      }
      if (depth < 0.25) hideInstance(arr, o)
      else writeBasis(arr, o, pos[k]!, pos[k + 1]!, pos[k + 2]!, vx, vy * 0.6, vz, size)
    }
  }

  dispose(): void {
    this.group.removeFromParent()
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.mesh.dispose()
    }
    this.geometry.dispose()
    this.material.dispose()
  }
}

// Outside, the sea is three small schools at a distance: silver sardines, a teal school and a few coral fish.
function sortieShown(s: School): number {
  if (s.kind !== 'stage') return 0
  if (s.species === SARDINE) return Math.min(s.count, 36)
  if (s.species === MENTHE) return Math.min(s.count, 26)
  if (s.species === CORAIL) return Math.min(s.count, 14)
  return 0
}
