import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ChatLine, EmoteId, NpcOrderView, PlayerCardView, PlayerId } from '../shared/protocol'

export type Vec3 = { x: number; y: number; z: number }
export type Act = 1 | 2 | 3
export type SystemId = 'render' | 'world' | 'flora' | 'drift' | 'fauna' | 'hero' | 'gameplay' | 'audio' | 'net'
export type RegionId = 'prairie' | 'laminaires' | 'pilier' | 'cheminee' | 'coques' | 'blanc' | 'bleu'
export type DayPhase = 'aube' | 'jour' | 'crepuscule' | 'nuit'
export type QualityLevel = 'low' | 'medium' | 'high'
export type HeroMode =
  | 'idle' | 'walk' | 'swim' | 'climb' | 'scrub' | 'exhausted' | 'cutscene'
  | 'fall' | 'ladder' | 'sit' | 'lean' | 'sleep' | 'airlock'
  // v1 seabed modes, never entered any more; kept so old readers still compile.
  | 'sink' | 'glide' | 'ride'
export type Medium = 'water' | 'air'
// 'inside' = walking in the ship; 'sortie' = tethered swim outside the hull. Nobody walks the seabed.
export type GameMode = 'inside' | 'sortie'
export type DistrictId = 'ecluse' | 'marche' | 'serres' | 'nef' | 'machines' | 'ateliers' | 'scellees' | 'hauts' | 'proue'
export type DeckId = 'cale' | 'machines' | 'bas' | 'principal' | 'haut' | 'toits' | 'domes'
export type CellId = string
export type DomeId =
  | 'dome-ecluse' | 'dome-marche' | 'dome-serres' | 'dome-nef' | 'dome-machines' | 'dome-ateliers' | 'dome-scellees'
export type LockId = 'sas' | 'echelle-toit' | `sas-${DistrictId}` | 'dome-proue'
export type PlaceId = string
export interface SortieState { lockId: LockId; ring: string; round: string[]; startedAt: number }
export interface CameraEnv {
  indoor: number
  glassDist: number
  seaInView?: boolean
  airHaze: number
  district: DistrictId | null
  cell: CellId | null
}
export type RoomId =
  | 'sas' | 'coursive-sud' | 'refectoire' | 'rebord' | 'cuisine' | 'marche'
  | 'passerelle-1' | 'passerelle-2' | 'passerelle-3' | 'salle-des-cartes' | 'cabine'
  | 'cabines-voisins' | 'echelle-toit'

export interface System {
  readonly id: SystemId
  init(ctx: GameContext): void | Promise<void>
  update(dt: number, ctx: GameContext): void
  lateUpdate?(dt: number, ctx: GameContext): void
  dispose(): void
}

export interface GameContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  canvas: HTMLCanvasElement
  uiRoot: HTMLElement
  physics: PhysicsWorld
  input: Input
  bus: EventBus
  state: GameState
  save: SaveStore
  quality: QualitySettings
  services: Services
  clock: { elapsed: number; frame: number; paused: boolean }
  rng(key: string): () => number
}

export interface Services {
  render?: RenderService
  world?: WorldService
  flora?: FloraService
  drift?: DriftService
  fauna?: FaunaService
  hero?: HeroService
  gameplay?: GameplayService
  audio?: AudioService
  net?: NetService
  debug: DebugRegistry
}

export type ColliderKind =
  | 'terrain' | 'rock' | 'hull' | 'window' | 'kelp' | 'coral' | 'sonde' | 'shrine' | 'prop' | 'trigger' | 'fauna'
  | 'interior' | 'stair' | 'ladder' | 'door' | 'seat'
  | 'floor' | 'wall' | 'net' | 'pipe' | 'rib' | 'shelf' | 'glass' | 'hull-outside'
export interface ColliderTag { kind: ColliderKind; climbable: boolean; ownerId?: string }
export interface RayHit { point: Vec3; normal: Vec3; distance: number; tag?: ColliderTag; handle: number }

export interface PhysicsWorld {
  rapier: typeof RAPIER
  world: RAPIER.World
  tag(collider: RAPIER.Collider, tag: ColliderTag): void
  untag(collider: RAPIER.Collider): void
  tagOf(handle: number): ColliderTag | undefined
  raycast(origin: Vec3, dir: Vec3, maxDist: number, opts?: { excludeKinds?: ColliderKind[] }): RayHit | null
  // Membership bits; Rapier collision groups are (membership << 16) | filter, see interactionGroups().
  groups: { TERRAIN: number; HERO: number; FAUNA: number; TRIGGER: number }
}

export type ButtonAction =
  | 'up' | 'down' | 'sprint' | 'interact' | 'scrub' | 'map' | 'inventory' | 'pause' | 'whistle' | 'recenter'
export type NavDir = 'up' | 'down' | 'left' | 'right'
export interface Input {
  move: { x: number; y: number }
  /** Directional key-downs of this frame, in order, so quick taps are not merged into one held level. */
  navPresses: readonly NavDir[]
  look: { x: number; y: number }
  down(a: ButtonAction): boolean
  pressed(a: ButtonAction): boolean
  released(a: ButtonAction): boolean
  /** Eats this frame's press and keeps the action up until it is physically released. */
  consume(...a: ButtonAction[]): void
  device: 'kbm' | 'gamepad'
  pointerLocked: boolean
  keyLabel(a: ButtonAction): string
}

export interface EnvState {
  current: Vec3
  visibility: number
  bloom: number
  jellyfish: number
  rain: number
}

export interface GameEvents {
  'game:ready': {}
  'game:paused': { paused: boolean }
  'time:hour': { hour: number; day: number }
  'time:phase': { phase: DayPhase }
  'act:changed': { act: Act }
  'quest:step': { questId: string; step: string }
  'quest:completed': { questId: string }
  'hero:mode': { from: HeroMode; to: HeroMode }
  'hero:landed': { speed: number; kind: ColliderKind }
  'hero:kick': {}
  'hero:breathEmpty': {}
  'hero:breathFull': {}
  'hero:stung': { by: 'meduse' }
  'interact:hint': { id: string; label: string } | null
  'interact': {
    targetId: string
    kind: 'npc' | 'sonde' | 'window' | 'item' | 'marmite' | 'shrine' | 'manta'
      | 'door' | 'seat' | 'bed' | 'chart-table' | 'ladder' | 'stall' | 'airlock'
  }
  'hero:medium': { medium: Medium }
  'hero:step': { surface: 'sable' | 'bois' | 'metal' | 'tapis'; wet: boolean }
  'room:entered': { roomId: RoomId }
  'room:left': { roomId: RoomId }
  'cell:entered': { cellId: CellId; district: DistrictId }
  'cell:left': { cellId: CellId }
  'district:entered': { district: DistrictId; from: DistrictId | null }
  'district:streamed': { loaded: readonly DistrictId[] }
  'mode:changed': { from: GameMode; to: GameMode; lockId: LockId | null }
  'sortie:start': { lockId: LockId; round: string[] }
  'sortie:end': { lockId: LockId; scrubbed: number }
  'tether:taut': { length: number }
  'airlock:cycle': { lockId: LockId; dir: 'in' | 'out'; phase: 'close' | 'pump' | 'open' | 'done' }
  'door:changed': { doorId: string; open: boolean }
  'sleep:done': { fromHour: number; toHour: number; day: number }
  'scrub:progress': { windowId: string; coat: number }
  'scrub:done': { windowId: string }
  'sonde:activated': { sondeId: string; region: RegionId }
  'shallow:entered': { id: string }
  'shallow:completed': { id: string }
  'collectible:found': { id: string }
  'item:gained': { itemId: string; count: number }
  'cook:done': { dishId: string }
  'dialogue:start': { npcId: string; nodeId: string }
  'dialogue:end': { npcId: string }
  'weather:changed': { env: EnvState }
  'chose:dive': { position: Vec3; phase: 'descend' | 'grab' | 'ascend' }
  'whale:pass': { position: Vec3 }
  'ceiling:ripple': { x: number; z: number; strength: number }
  'world:chunkLoaded': { cx: number; cz: number; lod: 0 | 1 | 2 }
  'world:chunkUnloaded': { cx: number; cz: number }
  'ui:menu': { open: 'carte' | 'inventaire' | 'pause' | null }
  'audio:cue': { cue: MusicCue }
  'save:written': {}
  'debug:pose': { name: string }
  'ondine:rejoindre': {}
  'net:status': { status: NetStatus }
  'net:chat': ChatLine
  'net:emote': { from: PlayerId; emote: EmoteId }
}
export interface EventBus {
  on<K extends keyof GameEvents>(k: K, fn: (p: GameEvents[K]) => void): () => void
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void
}

export interface GameState {
  version: 2
  mode: GameMode
  act: Act
  quests: Record<string, string>
  flags: Record<string, boolean>
  time: { hours: number; day: number; scale: number }
  env: EnvState
  hero: {
    position: Vec3; velocity: Vec3
    // Compass bearing in radians: 0 = north (-z), PI/2 = east (+x). Forward = (sin yaw, 0, -cos yaw).
    yaw: number
    mode: HeroMode
    breath: number; breathMax: number; exhausted: boolean
    lastSafe: Vec3
    medium: Medium; room: RoomId | null; wetness: number
    // Drift-local position while inside; null during a sortie (world position is the truth outside).
    localPosition: Vec3 | null
    district: DistrictId
    sortie: SortieState | null
  }
  drift: {
    progress: number; position: Vec3; heading: number; velocity: Vec3; gate: string
    altitude: number
    doors: Record<string, boolean>
  }
  chart: { sondes: string[]; reperes: string[]; pins: { x: number; z: number; icon: string }[] }
  inventory: { items: Record<string, number>; slots: number }
  shallows: string[]
  trouvailles: string[]
  windows: Record<string, number>
  settings: { quality: QualityLevel; invertY: boolean; sensitivity: number; volume: number; minimap: boolean }
  debug: { cameraLocked: boolean }
}

export interface SaveStore {
  readonly enabled: boolean
  write(): boolean
  load(): GameState | null
  clear(): void
  /** Online, writes go to this player's own key so the solo save is left as it was; null returns to solo. */
  useSlot(slot: string | null): void
  /** While held (the title screen poses the hero elsewhere), writes wait and the last one lands on release. */
  hold(held: boolean): void
}

export interface CelMaterialParams {
  color: number; shadowColor?: number; rim?: number; emissive?: number
  map?: THREE.Texture; vertexColors?: boolean; caustics?: boolean; transparent?: boolean
  side?: THREE.Side; onShader?: (shader: THREE.WebGLProgramParametersWithUniforms) => void
  indoor?: boolean
}
export interface RenderService {
  cel(params: CelMaterialParams): THREE.Material
  patchWater(material: THREE.Material): void
  readonly uniforms: {
    uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color }
    uCurrent: { value: THREE.Vector3 }; uHeroPos: { value: THREE.Vector3 }
    uHazeDist: { value: number }; uHazeMax: { value: number }
    uIndoor: { value: number }
    uLamps: { value: THREE.Vector4[] }
    uLampColors: { value: THREE.Color[] }
    uAirHaze: { value: number }
    uGlassDist: { value: number }
  }
  addRipple(x: number, z: number, strength: number): void
  draw(ctx: GameContext): void
  sunPhase(): DayPhase
  stats(): { drawCalls: number; triangles: number; ms: number }
}
export interface WorldService {
  heightAt(x: number, z: number): number
  normalAt(x: number, z: number): Vec3
  regionAt(x: number, z: number): RegionId
  currentAt(p: Vec3): Vec3
  isLoaded(cx: number, cz: number): boolean
}
export interface FloraService {
  climbableKelpNear(p: Vec3, r: number): { base: Vec3; height: number }[]
  flatten(p: Vec3, r: number): void
}
export interface WalkReport { from: Vec3; checked: number; unreachable: { id: string; at: Vec3 }[]; offMesh: { id: string; at: Vec3 }[] }
// Walkable surface of the ship in Drift-local coordinates.
export interface DriftNav {
  snap(p: Vec3): Vec3 | null
  path(from: Vec3, to: Vec3): Vec3[]
  audit(from: Vec3, targets: readonly { id: string; at: Vec3 }[]): WalkReport
}
export interface DriftService {
  pose(): { position: Vec3; heading: number; velocity: Vec3 }
  lockPosition(): Vec3
  lockAnchor(lockId: LockId): Vec3 | null
  districtAt(local: Vec3): DistrictId
  cellAt(local: Vec3): CellId | null
  cellSpawn(cell: CellId): { local: Vec3; yaw: number } | null
  loadedDistricts(): readonly DistrictId[]
  cameraEnv(): CameraEnv
  nearestWindow(p: Vec3, maxDist: number): { id: string; coat: number; position: Vec3; normal: Vec3 } | null
  scrub(windowId: string, amount: number): number
  npcPosition(npcId: string): Vec3 | null
  playScene(id: 'petit-dejeuner' | 'rebord' | 'grand-pere-pluie' | 'chose-vitre'): Promise<void>
  npcOrder(npcId: string, order: NpcOrderView | null): void
  mediumAt(p: Vec3): Medium
  roomAt(p: Vec3): RoomId | null
  toLocal(p: Vec3): Vec3
  toWorld(p: Vec3): Vec3
  roomSpawn(room: RoomId): { position: Vec3; yaw: number }
  ladders(room: RoomId): { id: string; bottom: Vec3; top: Vec3; normal: Vec3 }[]
  seat(id: string): { position: Vec3; yaw: number } | null
  openDoor(doorId: string, open: boolean): void
  cycleAirlock(lockId: 'sas' | 'echelle-toit', dir: 'in' | 'out'): Promise<void>
  roomCeilingAt(p: Vec3): number | null
  navmesh(): DriftNav | null
  home(id: string): HomeInfo | null
}
export interface HomeRequest { item: string; ask: string; thanks: string; reward: string }
export interface HomeInfo {
  id: string
  nom: string
  owner: string | null
  lines: readonly string[]
  note: string | null
  request: HomeRequest | null
}
export interface FaunaService {
  choseDive(target: Vec3, close: boolean): Promise<void>
  spawnScripted(id: 'tortue-premiere' | 'raie-coincee' | 'baleine'): void
  manta(): { position: Vec3; mount(): void; dismount(): void } | null
  jellyfishNear(p: Vec3, r: number): number
  attractSchool(p: Vec3): void
}
export interface HeroService {
  teleport(p: Vec3, yaw?: number): void
  teleportLocal(local: Vec3, yaw?: number): void
  setMode(m: HeroMode): void
  setCameraPose(pose: CameraPose | null): void
  headPosition(): Vec3
  sit(seatId: string): void
  lean(target: Vec3): void
  stand(): void
}
export interface GameplayService {
  breath: {
    spend(cost: number): boolean
    drain(ratePerSec: number, dt: number): boolean
    canAct(): boolean
  }
  setAct(act: Act): void
  giveItem(id: string, n?: number): void
  hasItem(id: string): boolean
  setWeather(env: Partial<EnvState>): void
  sleepUntil(hour: number): Promise<void>
  chartCanvas(): HTMLCanvasElement | null
}
export type NetStatus = 'solo' | 'connecting' | 'online' | 'reconnecting'
export interface NetService {
  status(): NetStatus
  me(): PlayerId | null
  players(): readonly PlayerCardView[]
  chat(text: string): void
  emote(emote: EmoteId): void
  talk(npcId: string, text: string | null): boolean
  seatTaken(seatId: string): boolean
}
export interface AudioService { cue(c: MusicCue): void; sfx(id: string, at?: Vec3): void; unlock(): Promise<void> }
export type MusicCue = 'explore' | 'drift' | 'sonde' | 'shallow' | 'danger' | 'night' | 'wonder' | 'rain' | 'silence'

export interface CameraPose { position: Vec3; target: Vec3; fov?: number }
export interface DebugPose { camera: CameraPose; hero?: { position: Vec3; yaw: number }; place?: PlaceId; hour?: number }
export interface DebugRegistry {
  registerPose(name: string, pose: DebugPose): void
}

export interface QualitySettings {
  level: QualityLevel
  pixelRatio: number; chunkRadius: number; lodRadius: number; grassDensity: number; fishCount: number
  shadows: boolean; shadowMapSize: number; godRayPass: boolean; outline: boolean; painterly: boolean
  onChange(fn: (q: QualitySettings) => void): () => void
}

export interface DebugApi {
  state: GameState
  ready: Promise<void>
  teleport(xOrPlace: number | PlaceId, y?: number, z?: number): void
  setAct(n: Act): void
  setTime(h: number): void
  giveItem(id: string, n?: number): void
  setWeather(env: Partial<EnvState>): void
  setQuality(q: QualityLevel): void
  pause(p: boolean): void
  step(frames: number): Promise<void>
  screenshotPose(name: string): Promise<string>
  poses(): string[]
  stats(): { fps: number; drawCalls: number; triangles: number; frameMs: number; pixelRatio: number }
  enterRoom(room: RoomId): void
  goto(place: PlaceId): boolean
  places(): PlaceId[]
  mode(): GameMode
  startSortie(lockId?: LockId): Promise<void>
  endSortie(): Promise<void>
  ctx: GameContext
}
