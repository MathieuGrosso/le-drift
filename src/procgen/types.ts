import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ColliderKind, DeckId, DistrictId, Vec3 } from '../core/types'
import type { Anchor, ProcgenHost } from '../drift/procgen-hook'

export type Rng = () => number
export type Job<T> = Generator<void, T, void>

export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface XZ { x: number; z: number }
export interface Spot { x: number; y: number; z: number; yaw: number }

export type WingId = 'babord' | 'tribord'
export type Column = 'A' | 'B' | 'C'
export type Layer = 'haut' | 'bas'

export type ArchetypeId =
  | 'observatoires' | 'corderie' | 'lavoirs' | 'sechoirs' | 'bazar' | 'fourneaux' | 'forges'
  | 'dortoirs' | 'noye' | 'quais' | 'citernes' | 'chapelle' | 'laminaires' | 'nurserie'
  | 'potagers' | 'bibliotheque' | 'theatre' | 'viviers' | 'cathedrale'

export type PlanShape = 'rue' | 'atrium' | 'nef-longue' | 'grappe' | 'puits' | 'archipel' | 'terrasses'

export type ArrondissementId = string
export type LandmarkKitId = string
export type PropFamily = string
export type MaterialHint = 'bois' | 'laiton' | 'cuivre' | 'fer' | 'rouille' | 'toile' | 'tissu' | 'corde' | 'filet' | 'pierre' | 'brique' | 'carrelage' | 'verre' | 'papier' | 'terre' | 'eau' | 'vapeur' | 'sel' | 'velours'

export interface HourlyEvent { hours: readonly number[]; id: string; nom: string }

export interface ArchetypeDef {
  id: ArchetypeId
  nom: string
  shape: PlanShape
  palette: { mur: number; bois: number; metal: number; tissu: readonly number[]; accent: number }
  light: { lampe: number; ambiance: readonly [top: number, bottom: number]; airHaze: number; seaLight: number }
  sounds: readonly string[]
  materials: readonly MaterialHint[]
  props: readonly PropFamily[]
  jobs: readonly string[]
  landmarks: readonly LandmarkKitId[]
  events: readonly HourlyEvent[]
  rule: ChemistryRule
}

export type ChemistryRule = 'eau' | 'pression' | 'lest' | 'gite' | 'bulles' | 'vapeur' | 'lumiere' | 'revetement' | 'corde' | 'faim'

export interface Unlock { act?: number; flag?: string; item?: string; phare?: string; fromSide?: ArrondissementId }

export type LinkKind = 'passerelle' | 'porte' | 'escalier' | 'echelle' | 'filet' | 'tube' | 'tyrolienne' | 'toboggan' | 'rail' | 'ascenseur'

// A connection on a shared boundary, computed once by planShip so both neighbours agree on it.
export interface PortPlan {
  id: string
  to: ArrondissementId | DistrictId
  core: boolean
  kind: LinkKind
  at: Vec3
  facing: XZ
  width: number
  unlock?: Unlock
}

export interface DistrictPlan {
  id: ArrondissementId
  nom: string
  archetype: ArchetypeId
  shape: PlanShape
  quartier: DistrictId
  wing: WingId
  layer: Layer
  columns: readonly Column[]
  bounds: Box
  decks: readonly DeckId[]
  seed: number
  variant: number
  landmarks: readonly LandmarkKitId[]
  ports: readonly PortPlan[]
  unlock?: Unlock
}

export interface SpineLink {
  id: string
  nom: string
  kind: LinkKind
  path: readonly Vec3[]
  districts: readonly (ArrondissementId | DistrictId)[]
  unlock?: Unlock
}

export interface ShipPlan {
  seed: number
  version: number
  bounds: Box
  baie: Rect
  districts: readonly DistrictPlan[]
  spines: readonly SpineLink[]
}

export type HullShape = 'quille' | 'tonneau' | 'capsule' | 'ellipsoide'

export interface HullSpec {
  id: string
  district: ArrondissementId
  shape: HullShape
  center: Vec3
  length: number
  rx: number
  ry: number
  yaw: number
  floors: readonly number[]
  outer: boolean
}

export interface DistrictMassing { district: ArrondissementId; hulls: readonly HullSpec[] }

export type FloorStyle = 'bois' | 'metal' | 'grille' | 'pierre' | 'tapis' | 'carrelage'

export interface CellSpec {
  id: string
  district: ArrondissementId
  quartier: DistrictId
  deck: DeckId
  nom: string | null
  boxes: readonly Box[]
  roof: number
  air: number
  glass: boolean
  spawn: Spot
}

export interface FloorSpec { cell: string; box: Box; style: FloorStyle }

export interface ColliderSpec {
  kind: ColliderKind
  climbable: boolean
  ownerId?: string
  x: number; y: number; z: number
  hx: number; hy: number; hz: number
  q?: readonly [x: number, y: number, z: number, w: number]
}

export interface LinkSpec {
  id: string
  kind: LinkKind
  from: Vec3
  to: Vec3
  both: boolean
  cells: readonly [string, string]
  unlock?: Unlock
}

export type WindowKind = 'hublot' | 'baie' | 'verriere' | 'dome'
export interface WindowSpec { id: string; cell: string; kind: WindowKind; at: Vec3; normal: Vec3; w: number; h: number; outer: boolean }

export type VoidKind = 'atrium' | 'puits' | 'nef' | 'bassin'
export interface VoidSpec { id: string; cell: string; kind: VoidKind; box: Box }

export interface WaterSpec { cell: string; rect: Rect; y: number }

export type SlotKind = 'mur' | 'sol' | 'plafond' | 'coin' | 'rambarde' | 'seuil' | 'fenetre' | 'etal' | 'couchage' | 'atelier'

// A place dressing may fill: w along the yaw direction's right, d into the room, h up.
export interface DressSlot { kind: SlotKind; cell: string; at: Vec3; yaw: number; w: number; d: number; h: number; weight: number; onPath: boolean }

export interface LampSpec { cell: string; at: Vec3; color: number; radius: number; live: boolean }

export interface WalkNode { id: string; cell: string; at: Vec3 }
export interface WalkEdge { a: string; b: string; length: number; kind: LinkKind | 'sol'; main: boolean }
export interface WalkGraph { nodes: readonly WalkNode[]; edges: readonly WalkEdge[] }

export interface PortSpec { port: string; cell: string; at: Vec3 }

export interface DistrictShell {
  plan: DistrictPlan
  hulls: readonly HullSpec[]
  cells: readonly CellSpec[]
  floors: readonly FloorSpec[]
  colliders: readonly ColliderSpec[]
  links: readonly LinkSpec[]
  windows: readonly WindowSpec[]
  voids: readonly VoidSpec[]
  waters: readonly WaterSpec[]
  slots: readonly DressSlot[]
  lamps: readonly LampSpec[]
  walk: WalkGraph
  ports: readonly PortSpec[]
  anchors: readonly Anchor[]
}

export interface LandmarkPlacement {
  id: string
  kit: LandmarkKitId
  nom: string
  district: ArrondissementId
  at: Spot
  glow: number | null
  seenFrom: number
}

export type ContentKind =
  | 'trouvaille' | 'pnj' | 'vignette' | 'demande' | 'coque' | 'phare' | 'vista' | 'merveille'
  | 'rechaud' | 'hamac' | 'banc' | 'raccourci' | 'panneau' | 'chat'
export type BeatTier = 'petit' | 'moyen' | 'grand'

export interface ContentPoint {
  id: string
  kind: ContentKind
  tier: BeatTier
  district: ArrondissementId
  cell: string
  at: Spot
  nom: string | null
  data?: Readonly<Record<string, string | number | boolean>>
}

export type ChartKind = 'contour' | 'repere' | 'station' | 'phare' | 'merveille'
export interface ChartEntry {
  id: string
  kind: ChartKind
  nom: string
  district: ArrondissementId
  deck: DeckId
  outline?: readonly XZ[]
  at?: XZ
  reveal: 'phare' | 'visite' | 'toujours'
  phare?: string
}

export interface ContentSet {
  district: ArrondissementId
  landmarks: readonly LandmarkPlacement[]
  points: readonly ContentPoint[]
  chart: readonly ChartEntry[]
  events: readonly HourlyEvent[]
  reserved: readonly Box[]
  // Landmark ladders, zips, seats; the streamer adds them to the district's anchors.
  anchors: readonly Anchor[]
  // Landmark cuboids; the streamer appends them to shell.colliders before buildLayout.
  colliders: readonly ColliderSpec[]
}

export interface PartStats { draws: number; triangles: number; geometries: number; buildMs: number }

export interface BuiltPart {
  group: THREE.Object3D
  stats: PartStats
  update?(dt: number, hours: number): void
  dispose(): void
  // Dressing: lamps for uLamps (live) and the bake, and solid clutter cuboids for the district body.
  lamps?: readonly LampSpec[]
  colliders?: readonly ColliderSpec[]
}

export interface BuiltLayout extends BuiltPart { body: RAPIER.RigidBody }

export interface DressInput { shell: DistrictShell; keepOut: readonly Box[] }

export type PlanShipFn = () => ShipPlan
export type MassingFn = (plan: DistrictPlan) => DistrictMassing
export type LayoutFn = (plan: DistrictPlan) => Job<DistrictShell>
export type BuildLayoutFn = (shell: DistrictShell, host: ProcgenHost) => Job<BuiltLayout>
export type DressFn = (input: DressInput, host: ProcgenHost) => Job<BuiltPart>
export type PopulateFn = (plan: DistrictPlan, shell: DistrictShell) => ContentSet
export type BuildContentFn = (content: ContentSet, shell: DistrictShell, host: ProcgenHost) => Job<BuiltPart>

export type StreamState = 'plan' | 'silhouette' | 'built' | 'active'

export interface ProcgenEvents {
  'procgen:entered': { id: ArrondissementId; nom: string; quartier: DistrictId; archetype: ArchetypeId }
  'procgen:decouverte': { id: string; nom: string; kind: 'quartier' | 'repere' | 'merveille' | 'vista'; district: ArrondissementId }
  'procgen:phare': { id: string; district: ArrondissementId }
}
