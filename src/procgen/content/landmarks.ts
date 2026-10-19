import { mulberry32 } from '../../core/rng'
import type { Vec3 } from '../../core/types'
import type { Anchor } from '../../drift/procgen-hook'
import type { Box, ColliderSpec, DistrictPlan, LandmarkKitId, Spot } from '../types'
import { PHARES } from './tuning'

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
const LAYER_FLOOR = { haut: { centre: -6, flanc: 0, long: 0 }, bas: { centre: -22, flanc: -22, long: -22 } } as const
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

export function kitScale(def: KitDef, plan: DistrictPlan, baseY: number): number {
  return Math.min(1, (LAYER_TOP[plan.layer] - baseY - HEADROOM) / def.h)
}

// Plan-only, so the far silhouette and the built district agree before any layout exists.
export function landmarkSites(plan: DistrictPlan, kits: readonly LandmarkKitId[]): Spot[] {
  const rng = mulberry32(plan.seed ^ 0x6c616e64)
  const b = plan.bounds
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const hx = (b.x1 - b.x0) / 2
  const hz = (b.z1 - b.z0) / 2
  const outer = Math.abs(b.x0) > Math.abs(b.x1) ? b.x0 : b.x1
  const inward = -Math.sign(outer)
  const sites: Spot[] = []
  kits.forEach((id, i) => {
    const def = kitDef(id)
    const side = i % 2 === 0 ? 1 : -1
    const along = cz + side * hz * (0.18 + 0.22 * rng()) * (i === 0 ? 0.6 : 1)
    let x = cx + (rng() - 0.5) * hx * 0.4
    let yaw = Math.atan2(inward, 0)
    if (def.site === 'flanc') x = outer + inward * (def.r + 6)
    if (def.site === 'long') {
      x = cx + (rng() - 0.5) * hx * 0.3
      yaw = 0
    }
    const margin = def.r + 4
    const z = Math.min(b.z1 - margin, Math.max(b.z0 + margin, def.site === 'long' ? cz : along))
    x = Math.min(b.x1 - margin, Math.max(b.x0 + margin, x))
    sites.push({ x, y: LAYER_FLOOR[plan.layer][def.site], z, yaw })
  })
  return sites
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
