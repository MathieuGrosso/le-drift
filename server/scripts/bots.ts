import { randomBytes, randomUUID } from 'node:crypto'
import { Client, type Room } from '@colyseus/sdk'
import {
  AVATAR_COLORS, DEFAULT_PORT, PROTOCOL_VERSION, ROOM,
  type ChatLine, type ClientMessages, type JoinOptions, type MondeStateView, type QuartierJoinOptions,
  type QuartierStateView, type ServerMessages,
} from '../../src/shared/protocol'
import { DISTRICT_BY_ID } from '../../src/core/layout'
import { GUARDS } from '../src/config'

const URL_ = process.env.DRIFT_SERVER ?? `ws://localhost:${DEFAULT_PORT}`
const DISTRICT = 'ecluse'
const SEAT = 'banc-refectoire-1'
const WINDOW = 'w-bots-1'
const SEND_MS = 1000 / 12

interface Bot {
  name: string
  monde: Room<unknown, MondeStateView>
  quartier: Room<unknown, QuartierStateView>
  chats: ChatLine[]
  refused: ServerMessages['refused'][]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function send<K extends keyof ClientMessages>(room: Room, type: K, payload: ClientMessages[K]): void {
  room.send(type, payload)
}

async function join(name: string, color: number): Promise<Bot> {
  const client = new Client(URL_)
  const base: JoinOptions = {
    protocol: PROTOCOL_VERSION,
    identity: { id: randomUUID(), secret: randomBytes(24).toString('base64url') },
    profile: { name, color },
  }
  const monde = await client.joinOrCreate<MondeStateView>(ROOM.monde, base)
  const opts: QuartierJoinOptions = { ...base, district: DISTRICT }
  const quartier = await client.joinOrCreate<QuartierStateView>(ROOM.quartier, opts)
  const bot: Bot = { name, monde, quartier, chats: [], refused: [] }
  quartier.onMessage('chat', (m: ChatLine) => bot.chats.push(m))
  for (const room of [monde, quartier]) {
    room.onMessage('refused', (m: ServerMessages['refused']) => bot.refused.push(m))
    room.onMessage('*', () => undefined)
  }
  return bot
}

const checks: [string, boolean][] = []
const check = (label: string, ok: boolean) => {
  checks.push([label, ok])
  console.log(`${ok ? 'ok ' : 'KO '} ${label}`)
}

const bots = await Promise.all(['Mila', 'Bastien', 'Nour'].map((n, i) => join(n, AVATAR_COLORS[i]!)))
const box = DISTRICT_BY_ID[DISTRICT]
const cx = (box.x0 + box.x1) / 2
const cz = (box.z0 + box.z1) / 2

const walkers = bots.map((b, i) => {
  let t = 0
  return setInterval(() => {
    t += SEND_MS / 1000
    const a = t * 0.5 + (i * Math.PI * 2) / bots.length
    send(b.quartier, 'move', { p: [cx + Math.cos(a) * 3, box.y0 + 2, cz + Math.sin(a) * 3], yaw: a, mode: 'walk', outside: false })
  }, SEND_MS)
})

await sleep(600)
const [mila, bastien, nour] = bots as [Bot, Bot, Bot]
send(mila.quartier, 'chat', { text: 'Bonjour <b>tout le monde</b> !' })
send(bastien.quartier, 'chat', { text: '<<>>' })
send(mila.quartier, 'sit', { seatId: SEAT })
await sleep(300)
send(bastien.quartier, 'sit', { seatId: SEAT })
send(nour.monde, 'scrub', { windowId: WINDOW, amount: 1 })
for (let i = 0; i < 7; i++) send(nour.quartier, 'chat', { text: `pluie ${i}` })
await sleep(1200)

check('every bot sees 3 players on board', bots.every((b) => b.monde.state.players.size >= 3))
check('every bot sees 3 avatars in the district', bots.every((b) => b.quartier.state.avatars.size >= 3))
check('chat reaches the others, markup stripped', bots.every((b) => b.chats.some((c) => c.text === 'Bonjour btout le monde/b !')))
check('a chat that sanitizes to nothing is refused, not kicked', bastien.refused.some((r) => r.reason === 'invalid') && bastien.quartier.connection.isOpen)
check('a taken seat is refused', bastien.refused.some((r) => r.detail.includes('prise')))
check('chat flood is rate-limited', nour.refused.some((r) => r.reason === 'rate'))
check('a scrubbed window is shared', bots.every((b) => b.monde.state.windows.has(WINDOW)))

clearInterval(walkers[0])
await sleep(GUARDS.teleportCooldownMs)
send(mila.quartier, 'move', { p: [cx + 200, box.y0, cz], yaw: 0, mode: 'walk', outside: false })
await sleep(200)
send(mila.quartier, 'move', { p: [cx - 200, box.y0, cz], yaw: 0, mode: 'walk', outside: false })
await sleep(400)
const seen = [...bastien.quartier.state.avatars.values()].find((a) => a.name === 'Mila')
check('positions stay inside the district box', seen !== undefined && seen.x <= box.x1 + 30)
check('a second jump within the teleport cooldown is held to max speed', seen !== undefined && seen.x > cx)

send(mila.monde, 'profile', { name: 'Mila la Grande', color: AVATAR_COLORS[4]! })
await sleep(400)
check('a renamed player is renamed in the district', [...nour.quartier.state.avatars.values()].some((a) => a.name === 'Mila la Grande'))

const rejects = (p: Promise<unknown>) => p.then((r) => (r as Room).leave().then(() => false), () => true)
const intruder: JoinOptions = {
  protocol: PROTOCOL_VERSION,
  identity: { id: randomUUID(), secret: randomBytes(24).toString('base64url') },
  profile: { name: 'Intrus', color: AVATAR_COLORS[0]! },
}
const bogus = await rejects(new Client(URL_).create(ROOM.quartier, { ...intruder, district: 'nulle-part' }))
const twin = await rejects(new Client(URL_).create(ROOM.quartier, { ...intruder, district: DISTRICT }))
await sleep(200)
check('a client cannot create a room for an unknown or live district', bogus && twin && bots.every((b) => b.quartier.state.avatars.size >= 3))

walkers.forEach(clearInterval)
await Promise.all(bots.flatMap((b) => [b.quartier.leave(), b.monde.leave()]))
const failed = checks.filter(([, ok]) => !ok).length
console.log(failed ? `${failed} échec(s)` : 'tout va bien à bord')
process.exit(failed ? 1 : 0)
