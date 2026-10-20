import type { DistrictId, HeroMode, Vec3 } from '../core/types'

export const PROTOCOL_VERSION = 1
export const DEFAULT_PORT = 8787

export const ROOM = { monde: 'monde', quartier: 'quartier' } as const
export type RoomName = (typeof ROOM)[keyof typeof ROOM]

export const LIMITS = {
  nameMin: 2,
  nameMax: 20,
  chatMax: 140,
  sayMax: 160,
  saveBytesMax: 64_000,
  windowIdMax: 64,
  npcIdMax: 32,
  messagesPerSecond: 30,
  chatPerTenSeconds: 5,
} as const

export const AVATAR_COLORS = [
  0xd8644e, 0xe3b95f, 0x6e8fb0, 0x5e8a6a, 0x9a6ab0, 0xc9a98a,
  0x3e4a6a, 0xb8664e, 0x4fa3a5, 0xe08aa0, 0x8a7a8e, 0xf1e4c8,
] as const
export type AvatarColor = number

export const EMOTES = ['salut', 'oui', 'non', 'rire', 'applaudir', 'montrer', 'assis', 'dort', 'pluie'] as const
export type EmoteId = (typeof EMOTES)[number]

export const MOODS = ['content', 'fatigue', 'inquiet', 'curieux', 'grognon', 'emu'] as const
export type Mood = (typeof MOODS)[number]

export const NPC_PLACES = [
  'cabine-grand-pere', 'salle-des-cartes', 'refectoire', 'cuisine', 'rebord', 'sas', 'tableau-meteo',
  'marche', 'serres', 'nef', 'puits', 'ateliers',
] as const
export type NpcPlace = (typeof NPC_PLACES)[number]

export const NPC_GIFTS = [
  'poisson', 'algue-rouge', 'algue-doree', 'oursin', 'moule', 'crevette', 'plancton', 'mie-du-cuistot',
  'soupe-chaude', 'galette-de-plancton', 'brochette', 'pain-du-cuistot',
] as const
export type NpcGift = (typeof NPC_GIFTS)[number]

export const SIDE_QUESTS = ['demande-cuistot', 'demande-rouille', 'demande-nour', 'demande-bastien', 'demande-enfants'] as const
export type SideQuestId = (typeof SIDE_QUESTS)[number]

export type PlayerId = string

export interface Identity {
  id: PlayerId
  secret: string
}

export interface Profile {
  name: string
  color: AvatarColor
}

/** Per-player persisted progress: the GameState keys a player owns. Shared keys (time, windows) never travel here. */
export interface PlayerSave {
  version: 2
  act: 1 | 2 | 3
  quests: Record<string, string>
  flags: Record<string, boolean>
  chart: { sondes: string[]; reperes: string[]; pins: { x: number; z: number; icon: string }[] }
  inventory: { items: Record<string, number>; slots: number }
  shallows: string[]
  trouvailles: string[]
  hero: { localPosition: Vec3 | null; yaw: number; district: DistrictId; room: string | null }
}

export interface JoinOptions {
  protocol: typeof PROTOCOL_VERSION
  identity: Identity
  profile: Profile
}

export interface QuartierJoinOptions extends JoinOptions {
  district: DistrictId
}

export type AvatarMode = Extract<HeroMode, 'idle' | 'walk' | 'swim' | 'climb' | 'scrub' | 'ladder' | 'sit' | 'lean' | 'sleep' | 'fall' | 'cutscene' | 'airlock'>

export interface ClientMessages {
  move: { p: [number, number, number]; yaw: number; mode: AvatarMode; outside: boolean }
  chat: { text: string }
  emote: { emote: EmoteId }
  sit: { seatId: string | null }
  talk: { npcId: string; text: string | null }
  away: { away: boolean }
  scrub: { windowId: string; amount: number }
  save: { save: PlayerSave }
  profile: Profile
}
export type ClientMessageType = keyof ClientMessages

export interface ChatLine {
  from: PlayerId
  name: string
  text: string
  at: number
}

export interface NpcSay {
  npcId: string
  text: string
  to: PlayerId | null
}

export interface ServerMessages {
  welcome: { you: PlayerId; save: PlayerSave | null; brains: boolean }
  chat: ChatLine
  emote: { from: PlayerId; emote: EmoteId }
  'npc:say': NpcSay
  'npc:give': { npcId: string; item: NpcGift; count: number }
  'npc:quest': { npcId: string; questId: SideQuestId }
  refused: { reason: 'protocol' | 'identity' | 'rate' | 'invalid'; detail: string }
}
export type ServerMessageType = keyof ServerMessages

export type NpcAction =
  | { kind: 'walk'; place: NpcPlace }
  | { kind: 'sit'; place: NpcPlace }
  | { kind: 'say'; text: string; to: PlayerId | null }
  | { kind: 'emote'; emote: EmoteId }
  | { kind: 'give'; item: NpcGift; to: PlayerId }
  | { kind: 'quest'; questId: SideQuestId; to: PlayerId }
  | { kind: 'idle' }

export const NPC_INTENTS = ['walk', 'sit', 'say', 'emote', 'give', 'quest', 'idle'] as const
export type NpcIntent = (typeof NPC_INTENTS)[number]

/** The JSON the model must return (output_config.format); turned into NpcAction[] by the server, never executed raw. */
export interface NpcDecision {
  intent: NpcIntent
  target: string | null
  say: string | null
  mood: Mood
}

/** Shapes of the Colyseus schema state as the client reads it. */
export interface PlayerCardView {
  id: PlayerId
  name: string
  color: number
  district: string
  status: 'actif' | 'absent' | 'dort' | 'dehors'
}

export interface NpcCardView {
  id: string
  district: string
  place: string
  mood: string
  thinking: boolean
}

export interface MondeStateView {
  epochMs: number
  realMsPerGameHour: number
  startHours: number
  windows: ReadonlyMap<string, number>
  players: ReadonlyMap<PlayerId, PlayerCardView>
  npcs: ReadonlyMap<string, NpcCardView>
}

export interface AvatarView {
  id: PlayerId
  name: string
  color: number
  x: number
  y: number
  z: number
  yaw: number
  mode: string
  outside: boolean
  seatId: string
}

export interface NpcOrderView {
  npcId: string
  kind: string
  place: string
  emote: string
  until: number
}

export interface QuartierStateView {
  district: string
  avatars: ReadonlyMap<PlayerId, AvatarView>
  orders: ReadonlyMap<string, NpcOrderView>
}

const UNSAFE_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g')

export function sanitizeText(raw: string, max: number): string {
  return raw
    .normalize('NFC')
    .replace(UNSAFE_CHARS, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function sharedGameHours(nowMs: number, epochMs: number, startHours: number, realMsPerGameHour: number): number {
  return startHours + (nowMs - epochMs) / realMsPerGameHour
}

export function windowCoat(scrubbedAtHours: number | undefined, nowHours: number, regrowHours: number, initial: number): number {
  if (scrubbedAtHours === undefined) return initial
  return Math.min(1, Math.max(0, (nowHours - scrubbedAtHours) / regrowHours))
}
