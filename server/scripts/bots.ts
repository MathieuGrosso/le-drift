import { randomBytes, randomUUID } from 'node:crypto'
import { Client, type Room } from '@colyseus/sdk'
import {
  AVATAR_COLORS, CLOSE_TAKEN_OVER, DEFAULT_PORT, PROTOCOL_VERSION, ROOM,
  type ChatLine, type ClientMessages, type JoinOptions, type MondeStateView, type NpcSay, type QuartierJoinOptions,
  type PlayerSave, type QuartierStateView, type ServerMessages,
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
  base: JoinOptions
  welcome: ServerMessages['welcome'] | null
  monde: Room<unknown, MondeStateView>
  quartier: Room<unknown, QuartierStateView>
  chats: ChatLine[]
  npcSays: NpcSay[]
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
  // Registered before the next await: the server flushes `welcome` right after the join handshake.
  const seen: Pick<Bot, 'welcome'> = { welcome: null }
  monde.onMessage('welcome', (m: ServerMessages['welcome']) => void (seen.welcome = m))
  const opts: QuartierJoinOptions = { ...base, district: DISTRICT }
  const quartier = await client.joinOrCreate<QuartierStateView>(ROOM.quartier, opts)
  const bot: Bot = { name, base, welcome: seen.welcome, monde, quartier, chats: [], npcSays: [], refused: [] }
  quartier.onMessage('chat', (m: ChatLine) => bot.chats.push(m))
  quartier.onMessage('npc:say', (m: NpcSay) => bot.npcSays.push(m))
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
check('chat reaches the others, markup stripped', bots.every((b) => b.chats.some((c) => c.text === 'Bonjour tout le monde !')))
check('a chat that sanitizes to nothing is refused, not kicked', bastien.refused.some((r) => r.reason === 'invalid') && bastien.quartier.connection.isOpen)
check('a taken seat is refused', bastien.refused.some((r) => r.detail.includes('prise')))
check('chat flood is rate-limited', nour.refused.some((r) => r.reason === 'rate'))
check('a scrubbed window is shared', bots.every((b) => b.monde.state.windows.has(WINDOW)))

send(mila.quartier, 'talk', { npcId: 'cuistot', text: 'Il reste du pain ?' })
for (let waited = 0; waited < 15_000 && !mila.npcSays.length; waited += 200) await sleep(200)
check('an NPC answers the player who talks to it, and only them', mila.npcSays.some((m) => m.npcId === 'cuistot' && m.to === mila.base.identity.id && m.text.length > 0)
  && !bastien.npcSays.some((m) => m.to !== null))

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

const saveWith = (quests: Record<string, string>): PlayerSave => ({
  version: 2, act: 1, quests, flags: {}, chart: { sondes: [], reperes: [], pins: [] }, inventory: { items: {}, slots: 8 },
  shallows: [], trouvailles: [], hero: { localPosition: null, yaw: 0, district: DISTRICT, room: null },
})
const rejoinMonde = async (b: Bot) => {
  await b.monde.leave()
  const monde = await new Client(URL_).joinOrCreate<MondeStateView>(ROOM.monde, b.base)
  b.welcome = null
  monde.onMessage('welcome', (m: ServerMessages['welcome']) => void (b.welcome = m))
  monde.onMessage('*', () => undefined)
  b.monde = monde
}
check('a first join gets no server save', mila.welcome !== null && mila.welcome.save === null)
send(mila.monde, 'save', { save: saveWith({ 'a1-reveil': 'faite' }) })
send(bastien.monde, 'save', { save: saveWith({ 'demande-rouille': 'proposee' }) })
await sleep(400)
await Promise.all([rejoinMonde(mila), rejoinMonde(bastien)])
await sleep(400)
const questsOf = (b: Bot) => JSON.stringify(b.welcome?.save?.quests ?? null)
check('each player gets back their own quest progress on rejoin', questsOf(mila) === '{"a1-reveil":"faite"}' && questsOf(bastien) === '{"demande-rouille":"proposee"}')
const coatAt = (b: Bot) => b.monde.state.windows.get(WINDOW)
check('every player sees the same scrubbed window', coatAt(nour) !== undefined && bots.every((b) => coatAt(b) === coatAt(nour)))

const nefOpts: QuartierJoinOptions = { ...nour.base, district: 'nef' }
const closes: number[] = []
nour.monde.onLeave((code) => void closes.push(code))
nour.quartier.onLeave((code) => void closes.push(code))
const tab = new Client(URL_)
const tabMonde = await tab.joinOrCreate<MondeStateView>(ROOM.monde, nour.base)
tabMonde.onMessage('*', () => undefined)
const tabQuartier = await tab.joinOrCreate<QuartierStateView>(ROOM.quartier, nefOpts)
await sleep(400)
const nourId = nour.base.identity.id
check('a second tab takes the player over in both rooms', closes.length === 2 && closes.every((c) => c === CLOSE_TAKEN_OVER)
  && !mila.quartier.state.avatars.has(nourId) && tabQuartier.state.avatars.has(nourId))
check('the roster follows the newer tab', mila.monde.state.players.get(nourId)?.district === 'nef')
const orphan = await rejects(new Client(URL_).joinOrCreate(ROOM.quartier, { ...intruder, district: DISTRICT }))
check('a district join without a monde session is refused', orphan)

walkers.forEach(clearInterval)
await Promise.all([...[mila, bastien].flatMap((b) => [b.quartier.leave(), b.monde.leave()]), tabQuartier.leave(), tabMonde.leave()])
const failed = checks.filter(([, ok]) => !ok).length
console.log(failed ? `${failed} échec(s)` : 'tout va bien à bord')
process.exit(failed ? 1 : 0)
