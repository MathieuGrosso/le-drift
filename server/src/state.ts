import { MapSchema, schema, t, type SchemaType } from '@colyseus/schema'
import type { PlayerCardView } from '../../src/shared/protocol'

export const PlayerCard = schema({
  id: t.string(),
  name: t.string(),
  color: t.uint32(),
  district: t.string(),
  status: t.string<PlayerCardView['status']>().default('accueil'),
}, 'PlayerCard')
export type PlayerCard = SchemaType<typeof PlayerCard>

export const NpcCard = schema({
  id: t.string(),
  district: t.string(),
  place: t.string(),
  mood: t.string(),
  thinking: t.boolean().default(false),
}, 'NpcCard')
export type NpcCard = SchemaType<typeof NpcCard>

export const MondeState = schema({
  epochMs: t.float64(),
  realMsPerGameHour: t.float64(),
  startHours: t.float64(),
  windows: t.map('float64'),
  players: t.map(PlayerCard),
  npcs: t.map(NpcCard),
}, 'MondeState')
export type MondeState = SchemaType<typeof MondeState>

export const Avatar = schema({
  id: t.string(),
  name: t.string(),
  color: t.uint32(),
  x: t.float32(),
  y: t.float32(),
  z: t.float32(),
  yaw: t.float32(),
  mode: t.string().default('idle'),
  outside: t.boolean().default(false),
  seatId: t.string().default(''),
}, 'Avatar')
export type Avatar = SchemaType<typeof Avatar>

export const NpcOrder = schema({
  npcId: t.string(),
  kind: t.string(),
  place: t.string().default(''),
  emote: t.string().default(''),
  until: t.float64(),
}, 'NpcOrder')
export type NpcOrder = SchemaType<typeof NpcOrder>

export const QuartierState = schema({
  district: t.string(),
  avatars: t.map(Avatar),
  orders: t.map(NpcOrder),
}, 'QuartierState')
export type QuartierState = SchemaType<typeof QuartierState>

export { MapSchema }
