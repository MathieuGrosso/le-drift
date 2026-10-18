import * as THREE from 'three'
import { DRIFT_Y, VISTA, WORLD_HALF } from '../core/layout'
import type { GameContext, Vec3 } from '../core/types'
import { fishGeometry } from './models'
import { PALETTE, celMaterial, clampWaterY, currentAt, floorAt, heroInWater, hideInstance, patchVertex, writeBasis } from './shared'

interface Species { color: number; scale: number; speed: number; weight: number }
const SPECIES: readonly Species[] = [
  { color: 0xdfe9ec, scale: 0.8, speed: 4.2, weight: 4 },
  { color: PALETTE.corail1, scale: 1.0, speed: 3.6, weight: 2 },
  { color: PALETTE.corail2, scale: 1.15, speed: 3.4, weight: 2 },
  { color: PALETTE.clair, scale: 0.9, speed: 4.0, weight: 2 },
  { color: PALETTE.corail3, scale: 1.1, speed: 3.2, weight: 1 },
  { color: 0xc8b48a, scale: 2.4, speed: 2.4, weight: 1 },
]

type SchoolKind = 'wander' | 'drift'
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
  floor: number
  active: boolean
}

const K = 5
const ACTIVE_RANGE = 220
const RELOCATE_RANGE = 330
const TAKEN_SECONDS = 150

/** Instanced fish in boids schools (sampled-neighbour boids: separation, alignment, cohesion). One draw call. */
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
  private frame = 0
  private readonly tmp = new THREE.Vector3()
  private threat: Vec3 | null = null
  private threatRadius = 0

  constructor(private readonly ctx: GameContext, count: number) {
    this.rng = ctx.rng('fauna:fish')
    this.geometry = fishGeometry()
    this.material = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.5 })
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
    const ctx = this.ctx
    if (this.mesh) {
      this.mesh.removeFromParent()
      this.mesh.dispose()
    }
    const n = Math.max(60, Math.floor(count))
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
    const perSchool = n < 600 ? 90 : 160
    const schoolsN = Math.max(3, Math.round(n / perSchool))
    this.schools = []
    const hero = ctx.state.hero.position
    const totalW = SPECIES.reduce((a, s) => a + s.weight, 0)
    let start = 0
    const col = new THREE.Color()
    for (let s = 0; s < schoolsN; s++) {
      const cnt = s === schoolsN - 1 ? n - start : Math.floor(n / schoolsN)
      let pick = r() * totalW
      let sp = SPECIES[0]
      for (const candidate of SPECIES) {
        pick -= candidate.weight
        if (pick <= 0) { sp = candidate; break }
      }
      const species = s === 0 ? SPECIES[1] : s === 1 ? SPECIES[0] : sp
      const big = species.scale > 2
      const c = new THREE.Vector3()
      if (s === 0) c.copy(this.driftGoal(this.tmp))
      else if (s === 1) {
        const f = { x: Math.sin(VISTA.hero.yaw), z: -Math.cos(VISTA.hero.yaw) }
        c.set(VISTA.hero.x + f.x * 110, 0, VISTA.hero.z + f.z * 110)
        c.y = floorAt(ctx, c.x, c.z) + 12
      } else this.randomNear(hero, 30, 240, c)
      const school: School = {
        kind: s === 0 ? 'drift' : 'wander',
        start, count: big ? Math.min(cnt, 24) : cnt,
        c, v: new THREE.Vector3((r() - 0.5) * 2, 0, (r() - 0.5) * 2),
        goal: c.clone(), goalUntil: 0, attractUntil: 0,
        species, radius: (big ? 3 : 2) + Math.cbrt(cnt) * 0.7 * species.scale,
        floor: floorAt(ctx, c.x, c.z), active: false,
      }
      if (s === 1) {
        school.goal.set(c.x + 200, c.y, c.z + 40)
        school.goalUntil = 90
      }
      this.schools.push(school)
      for (let i = start; i < start + cnt; i++) {
        phase[i] = r()
        this.scale[i] = species.scale * (0.8 + r() * 0.4)
        col.setHex(species.color).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08)
        mesh.setColorAt(i, col)
        for (let k = 0; k < K; k++) this.nbr[i * K + k] = start + Math.floor(r() * school.count)
        if (i >= start + school.count) this.taken[i] = Number.POSITIVE_INFINITY
      }
      this.snapSchool(school)
      start += cnt
    }
    const arr = mesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < n; i++) hideInstance(arr, i * 16)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.group.add(mesh)
  }

  private randomNear(p: Vec3, minR: number, maxR: number, out: THREE.Vector3): THREE.Vector3 {
    const a = this.rng() * Math.PI * 2
    const d = minR + this.rng() * (maxR - minR)
    const lim = WORLD_HALF - 60
    out.x = THREE.MathUtils.clamp(p.x + Math.cos(a) * d, -lim, lim)
    out.z = THREE.MathUtils.clamp(p.z + Math.sin(a) * d, -lim, lim)
    const floor = floorAt(this.ctx, out.x, out.z)
    out.y = clampWaterY(this.ctx, out.x, Math.max(p.y, floor + 4 + this.rng() * 22), out.z, 3)
    return out
  }

  private driftGoal(out: THREE.Vector3): THREE.Vector3 {
    const drift = this.ctx.services.drift?.pose() ?? this.ctx.state.drift
    const h = drift.heading
    const t = this.ctx.clock.elapsed * 0.05
    out.set(
      drift.position.x + Math.sin(h) * 95 + Math.cos(h) * Math.sin(t) * 40,
      DRIFT_Y - 6 + Math.sin(t * 1.7) * 5,
      drift.position.z - Math.cos(h) * 95 + Math.sin(h) * Math.sin(t) * 40,
    )
    return out
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
  }

  /** A predator the fish scatter from this frame (La Chose, the whale). */
  setThreat(p: Vec3 | null, radius: number): void {
    this.threat = p
    this.threatRadius = radius
  }

  attract(p: Vec3): void {
    const now = this.ctx.clock.elapsed
    let best: School | null = null
    let bestD = 160 * 160
    for (const s of this.schools) {
      if (s.kind === 'drift') continue
      const d = s.c.distanceToSquared(this.tmp.set(p.x, p.y, p.z))
      if (d < bestD) { bestD = d; best = s }
      if (d < 50 * 50) { s.goal.set(p.x, p.y, p.z); s.attractUntil = now + 25 }
    }
    if (best) { best.goal.set(p.x, p.y, p.z); best.attractUntil = now + 25 }
  }

  /** Moves the nearest wandering school next to `p` if none is within `r`, so a scripted predator always finds prey. */
  ensureNear(p: Vec3, r: number): void {
    let best: School | null = null
    let bestD = Infinity
    for (const s of this.schools) {
      const d = s.c.distanceTo(this.tmp.set(p.x, p.y, p.z))
      if (d < r) return
      if (s.kind === 'wander' && d < bestD) { bestD = d; best = s }
    }
    if (!best) return
    best.c.set(p.x, clampWaterY(this.ctx, p.x, p.y, p.z, 3), p.z)
    best.goal.copy(best.c)
    best.goalUntil = this.ctx.clock.elapsed + 8
    this.snapSchool(best)
  }

  nearestFish(p: Vec3, maxDist: number): number {
    let best = -1
    let bestD = maxDist * maxDist
    const now = this.ctx.clock.elapsed
    for (const s of this.schools) {
      const dc = s.c.distanceTo(this.tmp.set(p.x, p.y, p.z))
      if (dc - s.radius * 2 > maxDist) continue
      for (let i = s.start; i < s.start + s.count; i++) {
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
    return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2])
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
    const hero = ctx.state.hero.position
    const heroWater = heroInWater(ctx)
    const arr = mesh.instanceMatrix.array as Float32Array
    const r = this.rng
    this.frame++
    for (const s of this.schools) {
      const dHero = Math.hypot(s.c.x - hero.x, s.c.z - hero.z)
      if (s.kind === 'wander' && dHero > RELOCATE_RANGE) {
        this.randomNear(hero, 170, 240, s.c)
        s.goal.copy(s.c)
        s.goalUntil = 0
        s.active = false
      }
      if (s.kind === 'drift') {
        this.driftGoal(s.goal)
      } else if (now > s.attractUntil && (now > s.goalUntil || s.c.distanceTo(s.goal) < 8)) {
        this.randomNear(s.c, 50, 120, s.goal)
        s.goalUntil = now + 40 + r() * 40
      }
      if (this.frame % 10 === 0) s.floor = floorAt(ctx, s.c.x, s.c.z)
      const attracted = now < s.attractUntil
      const speed = s.species.speed * (attracted ? 0.75 : 0.4)
      const desired = this.tmp.copy(s.goal).sub(s.c)
      const dl = desired.length()
      if (dl > 0.01) desired.multiplyScalar(Math.min(speed, dl * 0.5) / dl)
      s.v.lerp(desired, Math.min(1, dt * 0.6))
      const cur = currentAt(ctx, s.c)
      s.c.x += (s.v.x + cur.x * 0.5) * dt
      s.c.y += s.v.y * dt
      s.c.z += (s.v.z + cur.z * 0.5) * dt
      s.c.y = clampWaterY(ctx, s.c.x, s.c.y, s.c.z, Math.max(2.5, s.radius * 0.6), 4)

      const near = dHero < ACTIVE_RANGE || s.kind === 'drift'
      if (!near) {
        if (s.active) {
          for (let i = s.start; i < s.start + s.count; i++) hideInstance(arr, i * 16)
          s.active = false
        }
        continue
      }
      if (!s.active) {
        this.snapSchool(s)
        s.active = true
      }
      this.stepSchool(s, dt, now, hero, heroWater, arr)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  private stepSchool(s: School, dt: number, now: number, hero: Vec3, heroWater: boolean, arr: Float32Array): void {
    const pos = this.pos, vel = this.vel, nbr = this.nbr
    const sp = s.species.speed
    const sepR2 = (0.7 * s.species.scale) ** 2
    const rad = s.radius
    const floorY = s.floor + 0.8
    const threat = this.threat
    const tr = this.threatRadius
    for (let i = s.start; i < s.start + s.count; i++) {
      const o = i * 16
      if (this.taken[i] > now) {
        hideInstance(arr, o)
        continue
      }
      const k = i * 3
      if (this.taken[i] !== 0) {
        this.taken[i] = 0
        pos[k] = s.c.x; pos[k + 1] = s.c.y; pos[k + 2] = s.c.z
      }
      if ((i + this.frame) % 40 === 0) nbr[i * K + (this.frame % K)] = s.start + Math.floor(this.rng() * s.count)
      const px = pos[k], py = pos[k + 1], pz = pos[k + 2]
      let vx = vel[k], vy = vel[k + 1], vz = vel[k + 2]
      let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0
      for (let q = 0; q < K; q++) {
        const j = nbr[i * K + q]
        if (j === i) continue
        const jk = j * 3
        const dx = pos[jk] - px, dy = pos[jk + 1] - py, dz = pos[jk + 2] - pz
        const d2 = dx * dx + dy * dy + dz * dz + 1e-4
        if (d2 < sepR2) { sx -= dx / d2; sy -= dy / d2; sz -= dz / d2 }
        ax += vel[jk]; ay += vel[jk + 1]; az += vel[jk + 2]
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
      if (py < floorY) fy += (floorY - py) * 6
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
      writeBasis(arr, o, pos[k], pos[k + 1], pos[k + 2], vx, vy * 0.6, vz, this.scale[i])
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
