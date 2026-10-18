import type { GameContext, GameEvents, MusicCue, Vec3 } from '../core/types'

export type InteractKind = GameEvents['interact']['kind']
export type Line = readonly [speaker: string | null, text: string]

export interface Candidate {
  id: string
  kind: InteractKind
  label: string
  key: 'interact' | 'scrub'
  dist: number
  run(): void
}

export interface Hud {
  update(dt: number): void
  prompt(c: { key: string; label: string } | null): void
  progress(v: number | null): void
  toast(text: string): void
  tip(text: string, seconds?: number): void
  placeName(title: string, sub?: string): void
  showHud(v: boolean): void
  flashNacre(): void
}

export interface Dialogue {
  play(lines: readonly Line[], npcId?: string): Promise<void>
  active(): boolean
  update(dt: number): void
}

export interface Menus {
  pause(): void
  inventory(): void
  sleep(): void
  board(): void
  market(): void
  cook(opts?: { tutorial?: boolean }): Promise<string | null>
  active(): boolean
  close(): void
  update(dt: number): void
}

export interface Chart {
  readonly canvas: HTMLCanvasElement
  reveal(sondeId: string): Promise<void>
  drawLine(): Promise<void>
  redraw(): void
  open(): void
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

export interface Breath {
  spend(cost: number): boolean
  drain(ratePerSec: number, dt: number): boolean
  canAct(): boolean
  refill(amount?: number): void
  addBuff(id: 'regen' | 'sprint' | 'bonus', seconds: number): void
  buffs(): { id: string; left: number }[]
  update(dt: number): void
}

export interface Weather {
  morning(): void
  set(env: Partial<GameContext['state']['env']>): void
  forecastText(): string
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
  repere(shallowId: string): void
  candidates(out: Candidate[]): void
  update(dt: number): void
}

export interface Sondes {
  candidates(out: Candidate[]): void
  topOf(id: string): Vec3 | null
  update(dt: number): void
  lateUpdate(dt: number): void
  dispose(): void
}

export interface Shallows {
  candidates(out: Candidate[]): void
  scrubTargets(out: ScrubTarget[]): void
  heroInBubble(): boolean
  update(dt: number): void
  dispose(): void
}

export interface Collectibles {
  candidates(out: Candidate[]): void
  update(dt: number): void
  dispose(): void
}

export interface Indoor {
  candidates(out: Candidate[]): void
  airlock(dir: 'in' | 'out'): Promise<void>
  returnToLock(): Promise<void>
  update(dt: number): void
}

export interface ScrubTarget {
  id: string
  dist: number
  coat: number
  scrub(amount: number): number
}

export interface Scrub {
  update(dt: number): void
  active(): boolean
  best(): ScrubTarget | null
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
  hud: Hud
  dialogue: Dialogue
  menus: Menus
  chart: Chart
  cine: Cine
  inv: Inventory
  breath: Breath
  weather: Weather
  quests: Quests
  sondes: Sondes
  shallows: Shallows
  collect: Collectibles
  indoor: Indoor
  scrub: Scrub
  ending: Ending
  camera: CameraDriver
  lock: { count: number }
  busy(): boolean
  toast(text: string): void
  cue(c: MusicCue): void
  sfx(id: string, at?: Vec3): void
  heroPos(): Vec3
  headPos(): Vec3
  heroForward(): Vec3
  heroMode(m: GameContext['state']['hero']['mode']): void
  driftLock(): Vec3
  sleepUntil(hour: number): Promise<void>
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function distXZ(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}
