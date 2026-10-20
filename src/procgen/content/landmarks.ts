import { mulberry32 } from '../../core/rng'
import type { Vec3 } from '../../core/types'
import type { Anchor } from '../../drift/procgen-hook'
import type { Box, ColliderSpec, DistrictPlan, DistrictShell, LandmarkKitId, Spot } from '../types'
import { PHARES, SITE } from './tuning'

export type FarForm = 'tour' | 'roue' | 'dome' | 'arbre' | 'mur' | 'nef' | 'cuve' | 'ecran' | 'colonne'
export type SiteKind = 'centre' | 'flanc' | 'long'
type V = readonly [number, number, number]

export type AnchorRecipe =
  | { kind: 'ladder'; at: V; top: number; n: readonly [number, number] }
  | { kind: 'lunette' | 'seat' | 'hammock' | 'bed'; at: V; yaw: number }
  | { kind: 'zip'; from: V; to: V }
  | { kind: 'slide'; path: readonly V[] }

export interface KitDef {
  nom: string
  h: number
  r: number
  glow: number | null
  form: FarForm
  site: SiteKind
  anchors: readonly AnchorRecipe[]
}

const k = (nom: string, h: number, r: number, glow: number | null, form: FarForm, site: SiteKind, anchors: readonly AnchorRecipe[] = []): KitDef =>
  ({ nom, h, r, glow, form, site, anchors })

const L = 0xffc27a
const CHAUD = 0xff9e5e
const MER = 0x9fd6d0

export const PHARE_KIT = 'phare-de-veille'
export const COQUE_KIT = 'porte-scellee'

export const KITS: Readonly<Record<LandmarkKitId, KitDef>> = {
  'grande-lunette': k('La Grande Lunette', 24, 7, 0xffd9a0, 'tour', 'centre', [
    { kind: 'ladder', at: [0, 0, 2.6], top: 14, n: [0, 1] }, { kind: 'lunette', at: [0, 14.6, -1.5], yaw: 0 }, { kind: 'zip', from: [0, 14.6, 3], to: [0, 2, 34] },
  ]),
  'oeil-du-plafond': k('L’Œil du Plafond', 22, 10, MER, 'dome', 'centre', [
    { kind: 'ladder', at: [0, 0, 4.2], top: 12, n: [0, 1] }, { kind: 'lunette', at: [0, 12.6, 0], yaw: 0 }, { kind: 'seat', at: [3, 12.4, 0], yaw: Math.PI / 2 },
  ]),
  'lanterne-de-poupe': k('La Lanterne de Poupe', 26, 6, 0xffe2a8, 'tour', 'flanc', [
    { kind: 'ladder', at: [0, 0, 2.2], top: 18, n: [0, 1] }, { kind: 'lunette', at: [0, 18.6, -1.2], yaw: Math.PI }, { kind: 'zip', from: [0, 18.6, 2], to: [0, 3, 40] },
  ]),
  'corderie-cent-metres': k('La Corderie de cent mètres', 9, 50, L, 'nef', 'long', [{ kind: 'zip', from: [0, 7.5, -45], to: [0, 1.5, 45] }]),
  'rouet-geant': k('Le Rouet géant', 16, 6, L, 'roue', 'centre', [{ kind: 'ladder', at: [3.2, 0, 0], top: 8, n: [1, 0] }, { kind: 'seat', at: [3.2, 8.4, 0], yaw: Math.PI / 2 }]),
  'cascade-des-lavoirs': k('La Cascade des Lavoirs', 20, 8, L, 'colonne', 'centre', [{ kind: 'ladder', at: [6, 0, 0], top: 13, n: [1, 0] }, { kind: 'seat', at: [5, 13.4, 2], yaw: 0 }]),
  'foret-de-draps': k('La Forêt de Draps', 14, 12, L, 'mur', 'centre', [{ kind: 'zip', from: [-10, 12, 0], to: [10, 4, 0] }]),
  'rideau-d-argent': k('Le Rideau d’Argent', 18, 12, MER, 'mur', 'flanc', [{ kind: 'ladder', at: [-11, 0, 1.2], top: 15, n: [0, 1] }, { kind: 'zip', from: [-11, 15.5, 1.2], to: [11, 3, 1.2] }]),
  'tour-aux-chats': k('La Tour aux Chats', 22, 5, L, 'tour', 'centre', [{ kind: 'ladder', at: [0, 0, 2.4], top: 18, n: [0, 1] }, { kind: 'seat', at: [0, 18.4, 0], yaw: 0 }]),
  'arbre-aux-lanternes': k('L’Arbre aux Lanternes', 20, 9, CHAUD, 'arbre', 'centre', [{ kind: 'ladder', at: [0, 0, 1.4], top: 11, n: [0, 1] }, { kind: 'hammock', at: [3, 11, 0], yaw: 0 }, { kind: 'zip', from: [0, 11.5, 1.2], to: [24, 1.5, 6] }]),
  'coque-retournee': k('La Coque Retournée', 14, 14, CHAUD, 'dome', 'centre', [{ kind: 'ladder', at: [0, 0, 8], top: 12, n: [0, 1] }, { kind: 'seat', at: [0, 12.6, 0], yaw: 0 }]),
  'table-cent-couverts': k('La Table de Cent Couverts', 6, 26, CHAUD, 'nef', 'long', [{ kind: 'seat', at: [1.4, 0.5, -10], yaw: -Math.PI / 2 }, { kind: 'seat', at: [-1.4, 0.5, 6], yaw: Math.PI / 2 }]),
  'cheminee-tressee': k('La Cheminée Tressée', 28, 5, CHAUD, 'colonne', 'centre', [{ kind: 'ladder', at: [0, 0, 3.2], top: 22, n: [0, 1] }, { kind: 'lunette', at: [0, 22.4, 2], yaw: 0 }]),
  'marteau-pilon': k('Le Marteau-Pilon', 18, 7, 0xe08a4e, 'colonne', 'centre', [{ kind: 'ladder', at: [5.5, 0, 0], top: 12, n: [1, 0] }, { kind: 'seat', at: [4.5, 12.4, 2], yaw: 0 }]),
  'fontaine-d-etincelles': k('La Fontaine d’Étincelles', 10, 6, 0xffb060, 'cuve', 'centre', [{ kind: 'seat', at: [6.5, 0.5, 0], yaw: -Math.PI / 2 }]),
  'mur-mille-hublots': k('Le Mur des Mille Hublots', 24, 16, L, 'mur', 'flanc', [{ kind: 'ladder', at: [-15, 0, 1.6], top: 20, n: [0, 1] }, { kind: 'bed', at: [-12, 8.3, 1.6], yaw: 0 }, { kind: 'zip', from: [-15, 20.5, 1.6], to: [15, 4, 12] }]),
  'voute-aux-hamacs': k('La Voûte aux Hamacs', 16, 12, L, 'dome', 'centre', [{ kind: 'hammock', at: [-4, 6, 0], yaw: 0 }, { kind: 'hammock', at: [4, 9, 2], yaw: 1.2 }, { kind: 'ladder', at: [0, 0, 6], top: 9, n: [0, 1] }]),
  'clocher-englouti': k('Le Clocher Englouti', 22, 5, L, 'tour', 'centre', [{ kind: 'ladder', at: [0, 0, 3], top: 16, n: [0, 1] }, { kind: 'seat', at: [0, 16.4, 0], yaw: 0 }, { kind: 'zip', from: [0, 16.6, 3], to: [-6, 1.5, 36] }]),
  'rue-sous-l-eau': k('La Rue sous l’Eau', 3, 14, MER, 'nef', 'long'),
  'grues-a-filets': k('Les Grues à Filets', 24, 9, L, 'tour', 'flanc', [{ kind: 'ladder', at: [0, 0, 1.4], top: 20, n: [0, 1] }, { kind: 'seat', at: [0, 20.4, -1], yaw: Math.PI }, { kind: 'zip', from: [0, 20.6, -6], to: [0, 2, -36] }]),
  'phare-de-la-baie': k('Le Phare de la Baie', 28, 5, 0xffe2a8, 'tour', 'flanc', [{ kind: 'ladder', at: [0, 0, 2.6], top: 22, n: [0, 1] }, { kind: 'lunette', at: [0, 22.6, -1.5], yaw: Math.PI }]),
  'citerne-cathedrale': k('La Citerne Cathédrale', 15, 10, L, 'cuve', 'centre', [{ kind: 'ladder', at: [0, 0, 10.4], top: 13, n: [0, 1] }, { kind: 'zip', from: [0, 13.4, 10.4], to: [0, 1, -30] }]),
  'vanne-maitresse': k('La Vanne Maîtresse', 12, 6, L, 'roue', 'centre', [{ kind: 'ladder', at: [4, 0, 0], top: 6, n: [1, 0] }]),
  'vitrail-de-quille': k('Le Vitrail de Quille', 4, 12, MER, 'cuve', 'centre', [{ kind: 'seat', at: [9, 0.5, 0], yaw: -Math.PI / 2 }, { kind: 'seat', at: [-9, 0.5, 0], yaw: Math.PI / 2 }]),
  'orgue-a-vapeur': k('L’Orgue à Vapeur', 15, 8, 0xffc27a, 'mur', 'centre', [{ kind: 'seat', at: [0, 0.5, 3.5], yaw: Math.PI }]),
  'laminaire-mere': k('Le Laminaire-Mère', 28, 6, 0xb9d98a, 'colonne', 'centre', [{ kind: 'ladder', at: [0, 0, 6.2], top: 20, n: [0, 1] }, { kind: 'seat', at: [0, 20.4, 5.6], yaw: 0 }, { kind: 'zip', from: [0, 20.6, 6.4], to: [8, 1.5, 40] }]),
  'serre-effondree': k('La Serre Effondrée', 16, 13, 0xb9d98a, 'dome', 'centre', [{ kind: 'ladder', at: [8, 0, 6], top: 10, n: [1, 0] }, { kind: 'seat', at: [8, 10.4, 6], yaw: 0 }]),
  'mobile-des-berceaux': k('Le Mobile des Berceaux', 22, 9, 0xe8674a, 'arbre', 'centre', [{ kind: 'ladder', at: [0, 0, 1.2], top: 9, n: [0, 1] }, { kind: 'hammock', at: [0, 9.4, 3], yaw: 0 }]),
  'toboggan-spirale': k('Le Toboggan Spirale', 20, 6, 0xe8674a, 'tour', 'centre', [
    { kind: 'ladder', at: [0, 0, 1.4], top: 17, n: [0, 1] },
    { kind: 'slide', path: [[0, 17, 2.6], [4.4, 14, 0], [0, 11, -4.4], [-4.4, 8, 0], [0, 5, 4.4], [4.4, 2, 0], [8, 0.4, 0]] },
  ]),
  'roue-a-eau': k('La Roue à Eau', 16, 8, 0xffc27a, 'roue', 'flanc', [{ kind: 'ladder', at: [0, 0, 3.4], top: 9, n: [0, 1] }, { kind: 'seat', at: [0, 9.4, 3.4], yaw: 0 }]),
  'jardins-suspendus': k('Les Jardins Suspendus', 18, 11, 0xb9d98a, 'arbre', 'centre', [{ kind: 'ladder', at: [0, 0, 1.6], top: 12, n: [0, 1] }, { kind: 'zip', from: [0, 12.4, 1.6], to: [-26, 2, 0] }]),
  'escalier-des-journaux': k('L’Escalier des Journaux de Bord', 28, 8, 0x9fd88a, 'colonne', 'centre', [
    { kind: 'ladder', at: [0, 0, 1.4], top: 24, n: [0, 1] }, { kind: 'seat', at: [3, 12.3, 0], yaw: Math.PI / 2 }, { kind: 'lunette', at: [0, 24.6, 0], yaw: 0 },
  ]),
  'grand-ecran': k('Le Grand Écran', 16, 14, 0xffe8c0, 'ecran', 'flanc', [{ kind: 'seat', at: [-4, 0.5, 9], yaw: Math.PI }, { kind: 'seat', at: [4, 0.5, 9], yaw: Math.PI }]),
  'vivier-rond': k('Le Vivier Rond', 10, 13, MER, 'cuve', 'centre', [{ kind: 'ladder', at: [13.4, 0, 0], top: 8, n: [1, 0] }, { kind: 'seat', at: [12, 8.3, 0], yaw: Math.PI / 2 }]),
  'grand-volant': k('Le Grand Volant', 25, 4, 0xe08a4e, 'roue', 'centre', [{ kind: 'ladder', at: [4.5, 0, 0], top: 12, n: [1, 0] }, { kind: 'zip', from: [4.5, 12.4, 0], to: [32, 1, 0] }]),
  'orgues-de-pression': k('Les Orgues de Pression', 14, 9, 0xe08a4e, 'mur', 'flanc', [{ kind: 'ladder', at: [-8, 0, 1.6], top: 11, n: [0, 1] }]),
  [PHARE_KIT]: k('Le Phare de veille', 26, 4, 0xffe2a8, 'tour', 'centre', [
    { kind: 'ladder', at: [0, 0, 2], top: 22, n: [0, 1] }, { kind: 'lunette', at: [0, 22.6, 0], yaw: 0 }, { kind: 'zip', from: [0, 22.8, 2], to: [0, 2, 44] },
  ]),
  [COQUE_KIT]: k('Coque scellée', 6, 3.5, MER, 'dome', 'flanc'),
}

const LAYER_TOP = { haut: 30, bas: -6 } as const
const HEADROOM = 1.5

export function phareTier(plan: DistrictPlan): number | null {
  const i = PHARES[plan.wing].indexOf(plan.id)
  return i < 0 ? null : i
}

export function districtKits(plan: DistrictPlan): LandmarkKitId[] {
  return phareTier(plan) === null ? [...plan.landmarks] : [...plan.landmarks, PHARE_KIT]
}

export function kitDef(id: LandmarkKitId): KitDef {
  const d = KITS[id]
  if (!d) throw new Error(`[procgen] unknown landmark kit ${id}`)
  return d
}

export function vaultY(plan: DistrictPlan): number {
  return LAYER_TOP[plan.layer]
}

export function kitScale(def: KitDef, plan: DistrictPlan, baseY: number): number {
  return Math.min(1, (LAYER_TOP[plan.layer] - baseY - HEADROOM) / def.h)
}

// Half extents of what blocks the walk (local x, local z): round forms block less than their reach.
function blockHalf(def: KitDef): readonly [number, number] {
  switch (def.form) {
    case 'nef': return [0.8, def.r]
    case 'mur':
    case 'ecran': return [def.r, 0.6]
    case 'tour':
    case 'colonne':
    case 'arbre': return [def.r * 0.45, def.r * 0.45]
    case 'roue': return [def.r * 0.25, def.r * 0.5]
    case 'dome':
    case 'cuve': return [def.r * 0.75, def.r * 0.75]
  }
}

interface Site extends Spot { half: readonly [number, number] }

function localXZ(s: Spot, x: number, z: number): readonly [number, number] {
  const dx = x - s.x
  const dz = z - s.z
  const c = Math.cos(s.yaw)
  const n = Math.sin(s.yaw)
  return [dx * c - dz * n, dx * n + dz * c]
}

function insideRect(s: Spot, half: readonly [number, number], x: number, z: number, pad: number): boolean {
  const [lx, lz] = localXZ(s, x, z)
  return Math.abs(lx) < half[0] + pad && Math.abs(lz) < half[1] + pad
}

// Sited on the built floor, in the open: the first kit prefers a void and a clear line from the spawn,
// so every arrondissement pulls the eye from its entrance (bible §2.5 triangle rule).
export function landmarkSites(shell: DistrictShell, kits: readonly LandmarkKitId[]): Spot[] {
  const plan = shell.plan
  const rng = mulberry32(plan.seed ^ 0x6c616e64)
  const street = shell.cells.find((c) => c.id === plan.id)
  const spawn = street?.spawn ?? { x: (plan.bounds.x0 + plan.bounds.x1) / 2, y: 0, z: plan.bounds.z0, yaw: 0 }
  const lots = shell.cells.filter((c) => c.id !== plan.id).flatMap((c) => c.boxes.map((b) => ({ ...b, y1: Math.max(b.y1, c.roof) })))
  const byId = new Map(shell.walk.nodes.map((n) => [n.id, n.at]))
  const path: Vec3[] = []
  for (const e of shell.walk.edges) {
    if (!e.main) continue
    const a = byId.get(e.a)
    const b = byId.get(e.b)
    if (!a || !b) continue
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / SITE.pathStep))
    for (let i = 0; i <= n; i++) path.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y, z: a.z + ((b.z - a.z) * i) / n })
  }
  const inVoid = (x: number, z: number) => shell.voids.find((v) => x > v.box.x0 && x < v.box.x1 && z > v.box.z0 && z < v.box.z1) ?? null
  const ground: Vec3[] = [
    ...shell.voids.map((v) => ({ x: (v.box.x0 + v.box.x1) / 2, y: v.box.y0, z: (v.box.z0 + v.box.z1) / 2 })),
    ...shell.slots.filter((s) => s.kind === 'sol').map((s) => s.at),
  ]
  const stride = Math.max(1, Math.ceil(ground.length / SITE.maxCandidates))
  const candidates = ground.filter((_, i) => i < shell.voids.length || i % stride === 0)
  const eye = { x: spawn.x, y: spawn.y + SITE.eye, z: spawn.z }
  const seen = (x: number, y: number, z: number, skip: number) => {
    const len = Math.hypot(x - eye.x, z - eye.z)
    const n = Math.ceil(len / SITE.sightStep)
    for (let i = 1; i < n; i++) {
      const t = i / n
      if (len * (1 - t) < skip) break
      const px = eye.x + (x - eye.x) * t
      const py = eye.y + (y - eye.y) * t
      const pz = eye.z + (z - eye.z) * t
      if (lots.some((b) => px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1 && py < b.y1 && py > b.y0 - 0.5)) return false
    }
    return true
  }
  const b = plan.bounds
  const sites: Site[] = []
  for (const id of kits) {
    const def = kitDef(id)
    const thin = def.form === 'nef' || def.form === 'mur' || def.form === 'ecran'
    let best: { site: Site; score: number } | null = null
    for (const c of candidates) {
      const scale = kitScale(def, plan, c.y)
      const toSpawn = Math.atan2(spawn.x - c.x, spawn.z - c.z)
      const v = inVoid(c.x, c.z)
      const along = v && v.box.x1 - v.box.x0 > v.box.z1 - v.box.z0 ? Math.PI / 2 : 0
      const yaws = def.form === 'nef' ? [along, along + Math.PI / 2] : thin ? [toSpawn, toSpawn + Math.PI / 2] : [toSpawn]
      for (const yaw of yaws) {
        const half = [blockHalf(def)[0] * scale, blockHalf(def)[1] * scale] as const
        const s: Site = { x: c.x, y: c.y, z: c.z, yaw, half }
        const reach = Math.max(half[0], half[1])
        if (c.x - reach < b.x0 || c.x + reach > b.x1 || c.z - reach < b.z0 || c.z + reach > b.z1) continue
        if (path.some((p) => Math.abs(p.y - c.y) < 2 && insideRect(s, half, p.x, p.z, SITE.pathGap))) continue
        if (sites.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < Math.max(...o.half) + reach + SITE.between)) continue
        if (insideRect(s, half, spawn.x, spawn.z, SITE.pathGap * 2)) continue
        const d = Math.hypot(c.x - spawn.x, c.z - spawn.z)
        let score = rng() * SITE.jitter
        if (v) score += SITE.voidBonus
        if (seen(c.x, c.y + def.h * scale * SITE.sightAt, c.z, reach)) score += SITE.sightBonus
        if (d < SITE.near) score -= ((SITE.near - d) / SITE.near) * SITE.distWeight
        if (d > SITE.far) score -= ((d - SITE.far) / SITE.far) * SITE.distWeight
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]] as const
        for (const [u, w] of corners) {
          const cs = Math.cos(yaw)
          const sn = Math.sin(yaw)
          const lx = u * half[0]
          const lz = w * half[1]
          const x = c.x + lx * cs + lz * sn
          const z = c.z - lx * sn + lz * cs
          if (lots.some((l) => x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1 && c.y + 1 > l.y0 && c.y + 1 < l.y1)) score -= SITE.lotPenalty
        }
        if (!best || score > best.score) best = { site: s, score }
      }
    }
    sites.push(best?.site ?? { x: (b.x0 + b.x1) / 2, y: spawn.y, z: (b.z0 + b.z1) / 2, yaw: 0, half: [0, 0] })
  }
  return sites.map(({ x, y, z, yaw }) => ({ x, y, z, yaw }))
}

// A zip ends on the nearest street node, never in a lot or under the floor.
export function landZips(anchors: readonly Anchor[], shell: DistrictShell): Anchor[] {
  const nodes = shell.walk.nodes.filter((n) => !n.id.startsWith('p:'))
  return anchors.flatMap((a): Anchor[] => {
    if (a.kind !== 'zip' || nodes.length === 0) return [a]
    const end = nodes.reduce((m, n) => (Math.hypot(n.at.x - a.to.x, n.at.z - a.to.z) < Math.hypot(m.at.x - a.to.x, m.at.z - a.to.z) ? n : m), nodes[0]!)
    const to = { x: end.at.x, y: end.at.y + SITE.zipLand, z: end.at.z }
    const run = Math.hypot(to.x - a.from.x, to.z - a.from.z)
    return run < SITE.zipMinRun || a.from.y - to.y < run * SITE.zipMinSlope ? [] : [{ ...a, to }]
  })
}

function rot(s: Spot, x: number, y: number, z: number, scale: number): Vec3 {
  const c = Math.cos(s.yaw)
  const n = Math.sin(s.yaw)
  return { x: s.x + (x * c + z * n) * scale, y: s.y + y * scale, z: s.z + (-x * n + z * c) * scale }
}

export function kitAnchors(id: string, def: KitDef, s: Spot, scale: number): Anchor[] {
  return def.anchors.map((a, i): Anchor => {
    const aid = `${id}/${a.kind}-${i}`
    switch (a.kind) {
      case 'ladder': {
        const bottom = rot(s, a.at[0], a.at[1], a.at[2], scale)
        const n = rot({ ...s, x: 0, y: 0, z: 0 }, a.n[0], 0, a.n[1], 1)
        return { kind: 'ladder', id: aid, bottom, top: { ...bottom, y: s.y + a.top * scale }, normal: n }
      }
      case 'zip':
        return { kind: 'zip', id: aid, from: rot(s, ...a.from, scale), to: rot(s, ...a.to, scale) }
      case 'slide':
        return { kind: 'slide', id: aid, path: a.path.map((p) => rot(s, ...p, scale)) }
      default:
        return { kind: a.kind, id: aid, at: rot(s, ...a.at, scale), yaw: s.yaw + a.yaw }
    }
  })
}

// Coarse cuboids matching the far form: enough to climb and stand on, never a trimesh.
export function kitColliders(id: string, def: KitDef, s: Spot, scale: number): ColliderSpec[] {
  const h = def.h * scale
  const r = def.r * scale
  const c = Math.cos(s.yaw / 2)
  const n = Math.sin(s.yaw / 2)
  const q = [0, n, 0, c] as const
  const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, climbable = true): ColliderSpec => {
    const p = rot(s, x, y, z, 1)
    return { kind: 'prop', climbable, ownerId: id, x: p.x, y: p.y, z: p.z, hx, hy, hz, q }
  }
  switch (def.form) {
    case 'tour':
    case 'colonne':
      return [box(0, h * 0.4, 0, r * 0.3, h * 0.4, r * 0.3), box(0, h * 0.8 + 0.15, 0, r * 0.45, 0.15, r * 0.45)]
    case 'roue':
      return [box(0, h * 0.25, 0, r * 0.25, h * 0.25, r * 0.5)]
    case 'dome':
      return [box(0, h * 0.35, 0, r * 0.75, h * 0.35, r * 0.75), box(0, h * 0.75, 0, r * 0.45, 0.2, r * 0.45)]
    case 'arbre':
      return [box(0, h * 0.3, 0, r * 0.12, h * 0.3, r * 0.12), box(0, h * 0.55, 0, r * 0.4, 0.15, r * 0.4)]
    case 'mur':
      return [box(0, h / 2, 0, r, h / 2, 0.6)]
    case 'nef':
      return [box(r * 0.04, 0.45, 0, 0.8, 0.45, r * 0.95)]
    case 'cuve':
      return [box(0, h * 0.3, 0, r * 0.7, h * 0.3, r * 0.7)]
    case 'ecran':
      return [box(0, h / 2, -2, r, h / 2, 0.3, false)]
  }
}

function formHalf(def: KitDef): readonly [number, number] {
  if (def.form === 'nef') return [3, def.r]
  if (def.form === 'mur' || def.form === 'ecran') return [def.r, 2.5]
  return [def.r, def.r]
}

export function kitBounds(def: KitDef, s: Spot, scale: number, margin: number): Box {
  const [ax, az] = formHalf(def)
  const c = Math.abs(Math.cos(s.yaw))
  const n = Math.abs(Math.sin(s.yaw))
  const hx = (ax * c + az * n) * scale + margin
  const hz = (ax * n + az * c) * scale + margin
  return { x0: s.x - hx, x1: s.x + hx, y0: s.y, y1: s.y + def.h * scale + margin, z0: s.z - hz, z1: s.z + hz }
}
