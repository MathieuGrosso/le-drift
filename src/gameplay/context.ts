import type { GameContext, GameEvents, GameState, MusicCue, Vec3 } from '../core/types'
import type { Gather } from './world/gather'
import type { Proue } from './world/proue'
import type { Sites } from './world/sites'
import type { Scrub } from './scrub'

export type InteractKind = GameEvents['interact']['kind'] | 'zip' | 'tube' | 'valve' | 'pump' | 'lever' | 'ring' | 'lunette' | 'hammock'
export type Line = readonly [speaker: string | null, text: string]

export interface Candidate {
  id: string
  kind: InteractKind
  label: string
  key: 'interact' | 'scrub'
  dist: number
  hold?: boolean
  run(): void
}

export interface Hud {
  update(dt: number): void
  prompt(c: { key: string; label: string; hold?: boolean } | null): void
  progress(v: number | null): void
  toast(text: string): void
  tip(text: string, seconds?: number): void
  placeName(title: string, sub?: string): void
  holdPlace(on: boolean): void
  showHud(v: boolean): void
  flashNacre(): void
  counter(owner: string, text: string | null): void
  waypoint(target: { at: Vec3; label: string } | null): void
  card(title: string, sub: string, seconds?: number): void
}

export interface Dialogue {
  play(lines: readonly Line[], npcId?: string): Promise<void>
  /** Shown while the player keeps control: no cutscene, no prompt lock, fades out on its own. */
  aside(lines: readonly Line[]): Promise<void>
  active(): boolean
  update(dt: number): void
}

export interface Menus {
  pause(): void
  inventory(): void
  sleep(): void
  board(): void
  market(stallId?: string): void
  cook(opts?: { tutorial?: boolean; title?: string }): Promise<string | null>
  choose(title: string, options: { label: string; run: () => void }[], sub?: string): void
  active(): boolean
  close(): void
  update(dt: number): void
}

export interface Chart {
  readonly canvas: HTMLCanvasElement
  readonly plan: HTMLCanvasElement
  reveal(domeId: string): Promise<void>
  drawLine(): Promise<void>
  redraw(): void
  open(side?: 'mer' | 'plan'): void
  close(): void
  isOpen(): boolean
  update(dt: number): void
}

export interface Cine {
  fade(to: 'black' | 'white' | null, seconds: number): Promise<void>
  card(title: string, sub?: string, seconds?: number): Promise<void>
  narrate(lines: readonly string[]): Promise<void>
  credits(): Promise<void>
  clapping(): Promise<number>
  wait(seconds: number): Promise<void>
  active(): boolean
  update(dt: number): void
}

export interface Inventory {
  give(id: string, n?: number, quiet?: boolean): boolean
  take(id: string, n?: number): boolean
  has(id: string): boolean
  count(id: string): number
  canHold(id: string): boolean
  nacreUpgrades(): number
  addNacreUpgrade(): void
}

export interface Endurance {
  spend(cost: number): boolean
  drain(ratePerSec: number, dt: number): boolean
  canAct(): boolean
  refill(amount?: number): void
  addBuff(id: 'regen' | 'sprint' | 'bonus', seconds: number): void
  buffs(): { id: string; left: number }[]
  recentlyUsed(): boolean
  update(dt: number): void
}

export interface Weather {
  morning(): void
  set(env: Partial<GameContext['state']['env']>): void
  forecastText(): string
  gite(): { roll: number; pitch: number }
  condensation(): boolean
  update(dt: number): void
}

export interface Quests {
  start(): void
  set(questId: string, step: string): void
  step(questId: string): string | undefined
  objective(): string | null
  talk(npcId: string): void
  chartTable(): void
  setAct(act: 1 | 2 | 3, announce?: boolean): void
  candidates(out: Candidate[]): void
  update(dt: number): void
}

export interface Domes {
  activated(id: string): boolean
  count(excludeTutorial?: boolean): number
}

export interface ScelleeView { water: number; air: number; valve: boolean; lever: number; pos: number; timer: number; open: boolean; solved: boolean }

export interface Scellees {
  done(id: string): boolean
  view(id: string): ScelleeView | null
  count(): number
  update(dt: number): void
}

export interface Collectibles {
  candidates(out: Candidate[]): void
}

export interface Travel {
  stationOpen(id: string): boolean
  openStations(): string[]
  stations(): { id: string; at: Vec3; name: string; open: boolean }[]
  goStation(id: string): Promise<void>
  returnToCabin(): Promise<void>
}

export interface Tours {
  boardLines(): string[]
  target(): number
  scrubbed(): number
  update(dt: number): void
}

export interface Indoor {
  candidates(out: Candidate[]): void
  airlock(dir: 'in' | 'out'): Promise<void>
  returnToLock(): Promise<void>
  update(dt: number): void
}

export interface Ending {
  play(): Promise<void>
  playing(): boolean
  update(dt: number): void
}

export interface CameraDriver {
  set(pose: { position: Vec3; target: Vec3; fov?: number } | null): void
  lateUpdate(): void
}

export interface Gp {
  ctx: GameContext
  sites: Sites
  toWorld(local: Vec3): Vec3
  hud: Hud
  dialogue: Dialogue
  menus: Menus
  chart: Chart
  cine: Cine
  inv: Inventory
  endurance: Endurance
  weather: Weather
  quests: Quests
  domes: Domes
  scellees: Scellees
  collect: Collectibles
  travel: Travel
  tours: Tours
  indoor: Indoor
  ending: Ending
  scrub: Scrub
  proue: Proue
  gather: Gather
  camera: CameraDriver
  lock: { count: number }
  busy(): boolean
  toast(text: string): void
  cue(c: MusicCue): void
  sfx(id: string, at?: Vec3): void
  heroPos(): Vec3
  headPos(): Vec3
  heroForward(): Vec3
  heroLocal(): Vec3
  heroMode(m: GameContext['state']['hero']['mode']): void
  driftLock(): Vec3
  sleepUntil(hour: number | null): Promise<void>
  online(): boolean
  say(lines: readonly Line[], npc?: string): Promise<void>
  emit(name: string, payload: unknown): void
  progress(): Progress
}

// v2 save fields the bible names (chart.domes, scellees, tubes); core state does not declare them yet.
export interface Progress {
  domes: string[]
  scellees: string[]
  tubes: string[]
  requests: Record<string, string>
}

export function progressOf(state: GameState): Progress {
  const s = state as unknown as { chart: { domes?: string[] }; scellees?: string[]; tubes?: string[]; requests?: Record<string, string> }
  s.chart.domes ??= []
  s.scellees ??= []
  s.tubes ??= []
  s.requests ??= {}
  return { domes: s.chart.domes, scellees: s.scellees, tubes: s.tubes, requests: s.requests }
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function distXZ(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}
