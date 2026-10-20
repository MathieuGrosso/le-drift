import { mulberry32 } from '../../core/rng'
import type { DeckId, Vec3 } from '../../core/types'
import type { Anchor } from '../../drift/procgen-hook'
import { ARCHETYPES } from '../archetypes'
import { planShip } from '../ship'
import type {
  Box, ChartEntry, ColliderSpec, ContentKind, ContentPoint, DistrictPlan, DistrictShell,
  LandmarkPlacement, PopulateFn, Rng, Spot, XZ,
} from '../types'
import { COQUE_KIT, PHARE_KIT, districtKits, kitAnchors, kitBounds, kitColliders, kitDef, kitScale, landZips, landmarkSites, phareTier } from './landmarks'
import { deNom, shipNoms, type DistrictNoms, type Personne } from './noms'
import { quete, vignette } from './recits'
import { defiCorners, defiFits, placeDefi, type DefiPlaced } from './defis'
import { COUNTS, DEFI, MICRO_DEFIS, MOYENS, PACING, PETITS, PHARES, RESERVE, SIGHT, THIRDS_Z } from './tuning'

const FALLBACK = { lanes: 3, steps: 6, sway: 14 } as const

interface PathPt { at: Vec3; cell: string }
interface Track { pts: readonly PathPt[]; cum: readonly number[]; length: number }

let ship: ReturnType<typeof planShip> | null = null
function shipPlan() {
  ship ??= planShip()
  return ship
}

export function pharesOf(plan: DistrictPlan): string {
  const third = plan.bounds.z0 + 1 < THIRDS_Z[0] ? 0 : plan.bounds.z0 + 1 < THIRDS_Z[1] ? 1 : 2
  return `phare-${PHARES[plan.wing][third]}`
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function track(pts: PathPt[]): Track {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!.at, pts[i]!.at))
  return { pts, cum, length: cum[cum.length - 1] ?? 0 }
}

function sample(t: Track, s: number): { at: Vec3; cell: string; dir: XZ } {
  let i = 1
  while (i < t.cum.length - 1 && t.cum[i]! < s) i++
  const a = t.pts[i - 1] ?? t.pts[0]!
  const b = t.pts[i] ?? a
  const seg = t.cum[i]! - t.cum[i - 1]!
  const u = seg > 1e-6 ? Math.min(1, Math.max(0, (s - t.cum[i - 1]!) / seg)) : 0
  const dx = b.at.x - a.at.x
  const dz = b.at.z - a.at.z
  const l = Math.hypot(dx, dz) || 1
  return {
    at: { x: a.at.x + dx * u, y: a.at.y + (b.at.y - a.at.y) * u, z: a.at.z + dz * u },
    cell: u < 0.5 ? a.cell : b.cell,
    dir: { x: dx / l, z: dz / l },
  }
}

function mainTrack(plan: DistrictPlan, shell: DistrictShell, rng: Rng): Track {
  const { nodes, edges } = shell.walk
  // A stair port's node is the other district's landing: points spread toward it would hang in the stairwell.
  const stairs = new Set(plan.ports.filter((p) => p.kind === 'escalier').map((p) => `p:${p.id}`))
  const main = edges.filter((e) => e.main && !stairs.has(e.a) && !stairs.has(e.b))
  if (main.length > 0) {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const adj = new Map<string, string[]>()
    for (const e of main) {
      adj.set(e.a, [...(adj.get(e.a) ?? []), e.b])
      adj.set(e.b, [...(adj.get(e.b) ?? []), e.a])
    }
    const port = shell.ports[0]?.at ?? plan.ports[0]?.at ?? { x: 0, y: 0, z: 0 }
    const ends = [...adj.keys()].filter((id) => adj.get(id)!.length === 1)
    const pool = ends.length > 0 ? ends : [...adj.keys()]
    let cur = pool.reduce((best, id) => (dist(byId.get(id)!.at, port) < dist(byId.get(best)!.at, port) ? id : best), pool[0]!)
    const seen = new Set<string>([cur])
    const out: PathPt[] = []
    for (;;) {
      const n = byId.get(cur)!
      out.push({ at: n.at, cell: n.cell })
      const next = (adj.get(cur) ?? []).filter((id) => !seen.has(id)).sort()[0]
      if (!next) break
      seen.add(next)
      cur = next
    }
    if (out.length > 1) return track(out)
  }
  return fallbackTrack(plan, rng)
}

// Until the layout lands walk graphs: a serpentine of lanes along the long axis, swaying.
function fallbackTrack(plan: DistrictPlan, rng: Rng): Track {
  const b = plan.bounds
  const y = plan.layer === 'haut' ? 0 : -14
  const cell = `${plan.id}/rue`
  const alongZ = b.z1 - b.z0 >= b.x1 - b.x0
  const [u0, u1] = alongZ ? [b.x0 + 8, b.x1 - 8] : [b.z0 + 8, b.z1 - 8]
  const [v0, v1] = alongZ ? [b.z0 + 6, b.z1 - 6] : [b.x0 + 6, b.x1 - 6]
  const pts: PathPt[] = []
  for (let lane = 0; lane < FALLBACK.lanes; lane++) {
    const u = u0 + ((u1 - u0) * (lane + 0.5)) / FALLBACK.lanes
    const forward = lane % 2 === 0
    for (let i = 0; i <= FALLBACK.steps; i++) {
      const t = forward ? i / FALLBACK.steps : 1 - i / FALLBACK.steps
      const v = v0 + (v1 - v0) * t
      const sway = (rng() - 0.5) * FALLBACK.sway
      const uu = Math.min(u1, Math.max(u0, u + sway))
      pts.push({ at: alongZ ? { x: uu, y, z: v } : { x: v, y, z: uu }, cell })
    }
  }
  return track(pts)
}

function loopTracks(shell: DistrictShell): Track[] {
  const byId = new Map(shell.walk.nodes.map((n) => [n.id, n]))
  return shell.walk.edges
    .filter((e) => !e.main && e.kind === 'sol')
    .map((e) => [byId.get(e.a), byId.get(e.b)] as const)
    .filter((p): p is readonly [NonNullable<(typeof p)[0]>, NonNullable<(typeof p)[1]>] => !!p[0] && !!p[1])
    .map(([a, b]) => track([{ at: a.at, cell: a.cell }, { at: b.at, cell: b.cell }]))
    .filter((t) => t.length > 6)
}

function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function weightedRoundRobin<K extends string>(weights: Readonly<Record<K, number>>) {
  const keys = Object.keys(weights) as K[]
  const credit = new Map<K, number>(keys.map((k) => [k, 0]))
  let last: K | null = null
  return (allowed: (k: K) => boolean = () => true): K => {
    for (const k of keys) credit.set(k, credit.get(k)! + weights[k])
    let best: K | null = null
    for (const k of keys) {
      if (k === last || !allowed(k)) continue
      if (best === null || credit.get(k)! > credit.get(best)!) best = k
    }
    const pick = best ?? keys[0]!
    credit.set(pick, credit.get(pick)! - keys.reduce((s, k) => s + weights[k], 0))
    last = pick
    return pick
  }
}

function side(at: Vec3, dir: XZ, d: number): Vec3 {
  return { x: at.x - dir.z * d, y: at.y, z: at.z + dir.x * d }
}

function deckOf(y: number): DeckId {
  if (y < -18) return 'cale'
  if (y < -10) return 'machines'
  if (y < -3) return 'bas'
  if (y < 4) return 'principal'
  if (y < 12) return 'haut'
  if (y < 20) return 'toits'
  return 'domes'
}

function hullOutline(shell: DistrictShell, deckY: number): XZ[] | null {
  const pts: XZ[] = []
  for (const h of shell.hulls) {
    if (Math.abs(h.center.y - deckY) > h.ry + 1) continue
    const c = Math.cos(h.yaw)
    const s = Math.sin(h.yaw)
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const lx = (u * h.length) / 2
      const lz = v * h.rx
      pts.push({ x: h.center.x + lx * c + lz * s, z: h.center.z - lx * s + lz * c })
    }
  }
  if (pts.length < 3) return null
  pts.sort((a, b) => a.x - b.x || a.z - b.z)
  const cross = (o: XZ, a: XZ, b: XZ) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const lower: XZ[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: XZ[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

const DECK_Y: Readonly<Record<DeckId, number>> = { cale: -22, machines: -14, bas: -6, principal: 0, haut: 8, toits: 16, domes: 22 }

function chartFor(plan: DistrictPlan, shell: DistrictShell, landmarks: readonly LandmarkPlacement[], points: readonly ContentPoint[]): ChartEntry[] {
  const phare = pharesOf(plan)
  const b = plan.bounds
  const rect: XZ[] = [{ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }, { x: b.x0, z: b.z1 }]
  const out: ChartEntry[] = plan.decks.map((deck) => ({
    id: `${plan.id}/contour-${deck}`, kind: 'contour', nom: plan.nom, district: plan.id, deck,
    outline: hullOutline(shell, DECK_Y[deck]) ?? rect, reveal: 'phare', phare,
  }))
  for (const l of landmarks) {
    const isP = l.kit === PHARE_KIT
    out.push({
      id: `${l.id}/carte`, kind: isP ? 'phare' : 'repere', nom: l.nom, district: plan.id, deck: deckOf(l.at.y + 1),
      at: { x: l.at.x, z: l.at.z }, reveal: isP ? 'toujours' : 'phare', phare,
    })
  }
  for (const p of points) {
    if (p.kind !== 'merveille' && p.kind !== 'coque') continue
    out.push({ id: `${p.id}/carte`, kind: 'merveille', nom: p.nom ?? plan.nom, district: plan.id, deck: deckOf(p.at.y + 1), at: { x: p.at.x, z: p.at.z }, reveal: 'visite' })
  }
  return out
}

function pointBox(at: Vec3, r: number, h = 2.4): Box {
  return { x0: at.x - r, x1: at.x + r, y0: at.y, y1: at.y + h, z0: at.z - r, z1: at.z + r }
}

class Pools {
  private i = { lieux: 0, pnj: 0, trouvailles: 0 }
  constructor(private readonly n: DistrictNoms, private readonly district: string) {}
  lieu(): string {
    return this.n.lieux[this.i.lieux++ % Math.max(1, this.n.lieux.length)] ?? this.district
  }
  pnj(): Personne {
    return this.n.pnj[this.i.pnj++ % Math.max(1, this.n.pnj.length)] ?? { nom: 'Quelqu’un', genre: 'f' }
  }
  trouvaille(): string {
    return this.n.trouvailles[this.i.trouvailles++ % Math.max(1, this.n.trouvailles.length)] ?? 'Une trouvaille'
  }
}

export const populate: PopulateFn = (plan, shell) => {
  const rng = mulberry32(plan.seed ^ 0x636f6e74)
  const arch = ARCHETYPES[plan.archetype]
  const noms = shipNoms(shipPlan().districts).get(plan.id)
  const pools = new Pools(noms ?? { lieux: [], pnj: [], trouvailles: [] }, plan.nom)
  const anchors: Anchor[] = []
  const colliders: ColliderSpec[] = []
  const reserved: Box[] = []

  const phareIdx = phareTier(plan)
  const kits = districtKits(plan)
  const sites = landmarkSites(shell, kits)
  const landmarks: LandmarkPlacement[] = kits.map((kit, i) => {
    const def = kitDef(kit)
    const at = sites[i]!
    const scale = kitScale(def, plan, at.y)
    const id = `${plan.id}/repere-${kit}`
    anchors.push(...landZips(kitAnchors(id, def, at, scale), shell))
    colliders.push(...kitColliders(id, def, at, scale))
    reserved.push(kitBounds(def, at, scale, RESERVE.margin))
    const nom = kit === PHARE_KIT ? `Le Phare de veille ${deNom(plan.nom)}` : def.nom
    const seenFrom = shell.windows.filter((w) => dist(w.at, at) < SIGHT.range).length + shell.voids.length
    return { id, kit, nom, district: plan.id, at, glow: def.glow, seenFrom }
  })

  const points: ContentPoint[] = []
  const push = (kind: ContentKind, tier: ContentPoint['tier'], cell: string, at: Spot, nom: string | null, data?: ContentPoint['data'], id?: string) => {
    const n = points.filter((p) => p.kind === kind).length + 1
    points.push({ id: id ?? `${plan.id}/${kind}-${n}`, kind, tier, district: plan.id, cell, at, nom, ...(data ? { data } : {}) })
    reserved.push(pointBox(at, kind === 'trouvaille' ? RESERVE.trouvaille : RESERVE.point))
  }
  const near = (at: Vec3, r: number) => points.some((p) => dist(p.at, at) < r) || reserved.some((b) => at.x > b.x0 && at.x < b.x1 && at.z > b.z0 && at.z < b.z1 && at.y >= b.y0 - 1 && at.y < b.y1)

  for (const l of landmarks) {
    if (l.kit === PHARE_KIT) {
      push('phare', 'grand', `${plan.id}/rue`, l.at, l.nom, { aile: plan.wing, tiers: phareIdx ?? 0, repere: l.id }, `phare-${plan.id}`)
      continue
    }
    const ev = arch.events[0]
    const front: Spot = { ...l.at, x: l.at.x + Math.sin(l.at.yaw) * (kitDef(l.kit).r + 3), z: l.at.z + Math.cos(l.at.yaw) * (kitDef(l.kit).r + 3) }
    push('merveille', 'grand', `${plan.id}/rue`, front, l.nom, ev ? { repere: l.id, evenement: ev.id, heures: ev.hours.join(','), titre: ev.nom } : { repere: l.id })
  }

  const main = mainTrack(plan, shell, rng)
  const loops = loopTracks(shell)
  const all = [main, ...loops].filter((t) => t.length > 0)
  const total = all.reduce((s, t) => s + t.length, 0)
  const at = (s: number) => {
    let r = s
    for (const t of all) {
      if (r <= t.length) return sample(t, r)
      r -= t.length
    }
    return sample(main, main.length)
  }

  const cellById = new Map(shell.cells.map((c) => [c.id, c]))
  const inCell = (cell: string, p: Vec3) => {
    const c = cellById.get(cell)
    return !c || c.boxes.some((b) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1 && p.y >= b.y0 - 0.5 && p.y <= b.y1)
  }
  const headroom = (cell: string, y: number) => (cellById.get(cell)?.roof ?? y + DEFI.defaultHeadroom) - y - DEFI.clearance
  const overlaps = (b: Box, r: Box) => b.x0 < r.x1 && b.x1 > r.x0 && b.z0 < r.z1 && b.z1 > r.z0 && b.y0 < r.y1 && b.y1 > r.y0
  const solids: Box[] = shell.colliders
    .filter((c) => c.kind !== 'floor')
    .map((c) => {
      const h = c.q ? Math.max(c.hx, c.hz) : 0
      return { x0: c.x - (h || c.hx), x1: c.x + (h || c.hx), y0: c.y - c.hy, y1: c.y + c.hy, z0: c.z - (h || c.hz), z1: c.z + (h || c.hz) }
    })
  const blocked = (b: Box) => {
    const lifted = { ...b, y0: b.y0 + DEFI.clearance }
    return reserved.some((r) => overlaps(lifted, r)) || solids.some((r) => overlaps(lifted, r))
  }

  let lastDefi: string | null = null
  const nTr = COUNTS.trouvailles[0] + Math.floor(rng() * (COUNTS.trouvailles[1] - COUNTS.trouvailles[0] + 1))
  for (let i = 0; i < nTr; i++) {
    const id = `tr-${plan.id}-${i + 1}`
    const s0 = total * ((i + 0.5 + (rng() - 0.5) * 0.6) / nTr)
    const order = shuffled(MICRO_DEFIS, rng).sort((a, b) => Number(a === lastDefi) - Number(b === lastDefi))
    let placed: DefiPlaced | null = null
    let cell = ''
    search: for (const ds of DEFI.shifts) {
      const p = at(Math.min(total, Math.max(0, s0 + ds)))
      for (const sgn of [i % 2 === 0 ? 1 : -1, i % 2 === 0 ? -1 : 1]) {
        for (const off of DEFI.offsets) {
          const base = side(p.at, p.dir, sgn * off)
          const yaw = Math.atan2(p.at.x - base.x, p.at.z - base.z)
          const room = headroom(p.cell, base.y)
          for (const defi of order) {
            if (!defiFits(defi, room)) continue
            if (!defiCorners({ ...base, yaw }).every((c) => inCell(p.cell, c))) continue
            const d = placeDefi(id, defi, { ...base, yaw }, room)
            if (blocked(d.bounds)) continue
            placed = d
            cell = p.cell
            break search
          }
        }
      }
    }
    if (placed) {
      lastDefi = placed.defi
      colliders.push(...placed.colliders)
      anchors.push(...placed.anchors)
      reserved.push(placed.bounds)
      const b = placed.at
      push('trouvaille', 'petit', cell, placed.prize, pools.trouvaille(), { defi: placed.defi, bx: b.x, by: b.y, bz: b.z, byaw: b.yaw, hauteur: headroom(cell, b.y) }, id)
    } else {
      const p = at(s0)
      const spot = side(p.at, p.dir, PACING.sideStep * 0.5)
      push('trouvaille', 'petit', p.cell, { ...spot, y: spot.y + DEFI.bareLift, yaw: 0 }, pools.trouvaille(), { defi: 'a-decouvert' }, id)
    }
  }

  const petit = weightedRoundRobin(PETITS)
  const moyen = weightedRoundRobin(MOYENS)
  let demandes = 0
  let coques = 0
  const twin = shipPlan().districts.filter((d) => d.archetype === plan.archetype).findIndex((d) => d.id === plan.id)
  const addDemande = (cell: string, here: Spot) => {
    demandes++
    const who = pools.pnj()
    push('demande', 'moyen', cell, here, who.nom, { pnj: who.nom, metier: arch.jobs[demandes % arch.jobs.length]!, ...quete(plan.archetype, twin * COUNTS.demandesMax + demandes - 1, who.nom) }, `quete-${plan.id}-${demandes}`)
  }
  let nextMoyen = PACING.moyenEvery * (0.5 + rng() * 0.5)
  let flip = 1
  for (let s = PACING.startOffset; s < total; s += PACING.petit[0] + rng() * (PACING.petit[1] - PACING.petit[0])) {
    const p = at(s)
    flip = -flip
    const spot = side(p.at, p.dir, flip * PACING.sideStep)
    const yaw = Math.atan2(-flip * p.dir.z, flip * p.dir.x)
    const here: Spot = { ...spot, yaw }
    if (near(here, 6)) continue
    if (s >= nextMoyen) {
      nextMoyen += PACING.moyenEvery
      const kind = moyen((k) => (k !== 'demande' || demandes < COUNTS.demandesMax) && (k !== 'coque' || coques < COUNTS.coques))
      if (kind === 'demande') addDemande(p.cell, here)
      else if (kind === 'coque') {
        coques++
        push('coque', 'moyen', p.cell, here, `La Coque scellée ${deNom(plan.nom)}`, { regle: arch.rule, kit: COQUE_KIT }, `coque-${plan.id}`)
      } else if (kind === 'raccourci') {
        push('raccourci', 'moyen', p.cell, here, null, { type: ['echelle', 'corde', 'porte', 'contrepoids'][Math.floor(rng() * 4)]!, sens: 'depuis-l-autre-cote' })
      } else {
        push('hamac', 'moyen', p.cell, here, null)
        anchors.push({ kind: 'hammock', id: `${plan.id}/hamac-${points.length}`, at: { x: here.x, y: here.y + 0.9, z: here.z }, yaw })
      }
      continue
    }
    const kind = petit((k) => k !== 'trouvaille')
    switch (kind) {
      case 'pnj': {
        const who = pools.pnj()
        push('pnj', 'petit', p.cell, here, who.nom, { metier: arch.jobs[Math.floor(rng() * arch.jobs.length)]!, genre: who.genre, pose: ['work', 'lean', 'sit', 'talk'][Math.floor(rng() * 4)]! })
        break
      }
      case 'vignette': {
        const a = pools.pnj()
        const b = pools.pnj()
        push('vignette', 'petit', p.cell, here, null, { a: a.nom, b: b.nom, scene: vignette(rng, a.nom, b.nom) })
        break
      }
      case 'vista': {
        const target = landmarks[Math.floor(rng() * Math.max(1, landmarks.length))]
        push('vista', 'petit', p.cell, here, pools.lieu(), { regard: target?.id ?? 'mer', vue: target?.nom ?? 'la mer' })
        break
      }
      case 'banc':
        push('banc', 'petit', p.cell, here, null)
        anchors.push({ kind: 'seat', id: `${plan.id}/banc-${points.length}`, at: { x: here.x, y: here.y + 0.45, z: here.z }, yaw })
        break
      case 'panneau':
        push('panneau', 'petit', p.cell, here, pools.lieu())
        break
      default:
        push(kind, 'petit', p.cell, here, null)
    }
  }

  for (let i = 0; demandes < COUNTS.demandesMin && i < 8; i++) {
    const p = at(total * (0.3 + 0.1 * i))
    const spot = side(p.at, p.dir, -PACING.sideStep)
    if (!near(spot, 4)) addDemande(p.cell, { ...spot, yaw: Math.atan2(p.dir.z, -p.dir.x) })
  }

  if (coques < COUNTS.coques) {
    const p = at(main.length * 0.5)
    const spot = side(p.at, p.dir, PACING.sideStep * 2)
    push('coque', 'moyen', p.cell, { ...spot, yaw: Math.atan2(p.dir.z, -p.dir.x) }, `La Coque scellée ${deNom(plan.nom)}`, { regle: arch.rule, kit: COQUE_KIT }, `coque-${plan.id}`)
  }

  for (const w of shell.windows.filter((w) => w.kind === 'baie').slice(0, 2)) {
    const spot: Spot = { x: w.at.x - w.normal.x * 1.5, y: w.at.y - w.h / 2, z: w.at.z - w.normal.z * 1.5, yaw: Math.atan2(w.normal.x, w.normal.z) }
    if (!near(spot, 4)) push('vista', 'petit', w.cell, spot, 'La Baie sur la mer', { regard: 'mer', fenetre: w.id })
  }

  const pnjCount = points.filter((p) => p.kind === 'pnj').length
  for (let i = pnjCount; i < COUNTS.pnjMin; i++) {
    const p = at(total * rng())
    const who = pools.pnj()
    push('pnj', 'petit', p.cell, { ...side(p.at, p.dir, PACING.sideStep), yaw: 0 }, who.nom, { metier: arch.jobs[i % arch.jobs.length]!, genre: who.genre, pose: 'work' })
  }

  return {
    district: plan.id, landmarks, points, chart: chartFor(plan, shell, landmarks, points), events: arch.events,
    reserved, anchors, colliders,
  }
}
