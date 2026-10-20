import * as THREE from 'three'
import { NET } from '../core/tuning'
import type { GameContext, HeroMode, NetService, NetStatus, System } from '../core/types'
import type { AvatarMode, ClientMessages, EmoteId, PlayerCardView, PlayerId, Profile, ServerMessages } from '../shared/protocol'
import type { HeroServiceExt } from '../hero'
import { RemoteAvatars } from './avatars'
import { ChatBox } from './chat'
import { probe, serverEndpoint } from './connect'
import { EMOTE_GESTURE, EMOTE_SECONDS, EmoteWheel } from './emotes'
import { loadIdentity, loadProfile, storeProfile } from './identity'
import { Overlay } from './overlay'
import { Presence } from './presence'
import { adoptWelcome, place, RemoteSave, type Placement } from './save'
import type { Dispatch, Session } from './session'
import { netRoot } from './style'
import { EMOTE_BUBBLE, TEXT } from './text'
import { NpcExecutor } from './npc'
import { askProfile } from './welcome'
import { SharedWorld } from './world'

const AVATAR_MODES: ReadonlySet<HeroMode> = new Set<AvatarMode>([
  'idle', 'walk', 'swim', 'climb', 'scrub', 'ladder', 'sit', 'lean', 'sleep', 'fall', 'cutscene', 'airlock',
])
const PRESENCE_SECONDS = 1
const NPC_HEAD = 1.9
const ME = 'moi'
// A server that just shut down still answers for a moment; rejoining at once would hit it while it dies.
const REJOIN_DELAY_MS = 3000

function titleGone(): boolean {
  const el = document.getElementById('loading')
  return !el || el.classList.contains('gone')
}

function avatarMode(m: HeroMode): AvatarMode {
  return AVATAR_MODES.has(m) ? (m as AvatarMode) : 'idle'
}

/** Multiplayer. Solo is the default and the fallback: nothing here ever awaits the network in the frame loop. */
export function createNetSystem(): System {
  let ctx: GameContext | null = null
  let session: Session | null = null
  let ui: { root: HTMLDivElement; chat: ChatBox; wheel: EmoteWheel; presence: Presence; overlay: Overlay } | null = null
  let avatars: RemoteAvatars | null = null
  let world: SharedWorld | null = null
  let save: RemoteSave | null = null
  let me: PlayerId | null = null
  let npcs: NpcExecutor | null = null
  let brains = false
  let canRejoin = false
  let takenOverHere = false
  let placement: Placement | null = null
  let starting = false
  let rejoinTimer: ReturnType<typeof setTimeout> | null = null
  let sendTimer = 0
  let presenceTimer = 0
  let lastMove = ''
  const unsubs: (() => void)[] = []
  const v = new THREE.Vector3()
  const eye = new THREE.Vector3()

  const status = (): NetStatus => session?.status ?? 'solo'
  const players = (): PlayerCardView[] => {
    const out: PlayerCardView[] = []
    session?.mondeState?.players.forEach((p) => out.push(p))
    return out
  }

  const service: NetService = {
    status,
    me: () => me,
    players,
    chat: (text) => session?.send('chat', { text }),
    emote: (emote) => session?.send('emote', { emote }),
    talk(npcId, text) {
      if (status() !== 'online' || !session?.mondeState?.npcs.has(npcId)) return false
      session.send('talk', { npcId, text })
      return brains
    },
    seatTaken(seatId) {
      for (const a of session?.quartierState?.avatars.values() ?? []) if (a.id !== me && a.seatId === seatId) return true
      return false
    },
  }

  const sayOver = (id: PlayerId, text: string) => {
    if (!ctx || !ui) return
    const head = id === me ? ctx.services.hero?.headPosition() : avatars?.head(id, v)
    if (head) ui.overlay.say(id === me ? ME : id, v.set(head.x, head.y, head.z), text, ctx.clock.elapsed)
  }

  const onMessage: Dispatch = (type, payload) => {
    if (!ctx || !ui) return
    switch (type) {
      case 'welcome': {
        const w = payload as ServerMessages['welcome']
        me = w.you
        brains = w.brains
        // The title screen restores its own copy of the hero when it closes, so the hero moves after it.
        placement = adoptWelcome(ctx, w, save, titleGone())
        break
      }
      case 'chat': {
        const c = payload as ServerMessages['chat']
        const card = session?.mondeState?.players.get(c.from)
        ui.chat.line(c.name, c.text, card?.color ?? 0)
        sayOver(c.from, c.text)
        ctx.bus.emit('net:chat', c)
        break
      }
      case 'emote': {
        const e = payload as ServerMessages['emote']
        const clip = EMOTE_GESTURE[e.emote]
        if (e.from !== me) avatars?.emote(e.from, e.emote)
        else if (clip) (ctx.services.hero as HeroServiceExt | undefined)?.gesture(clip, EMOTE_SECONDS)
        sayOver(e.from, EMOTE_BUBBLE[e.emote])
        ctx.bus.emit('net:emote', e)
        break
      }
      case 'npc:say': {
        const say = payload as ServerMessages['npc:say']
        // Scripted servers answer with a written line the local dialogue box already played.
        if (brains || say.to !== me) npcs?.say(say, me)
        break
      }
      case 'npc:give':
        npcs?.give(payload as ServerMessages['npc:give'])
        break
      case 'npc:quest':
        npcs?.quest(payload as ServerMessages['npc:quest'])
        break
      case 'refused': {
        const r = payload as ServerMessages['refused']
        console.warn('[net] refusé :', r.detail)
        ui.chat.line(null, TEXT.refused[r.reason])
        break
      }
    }
  }

  const goSolo = () => {
    npcs?.reset()
    brains = false
    avatars?.clear()
    ui?.overlay.clear()
    world?.release()
    save?.cancel()
    me = null
  }

  const connect = async () => {
    if (!ctx || !ui || starting || session) return
    starting = true
    takenOverHere = false
    try {
      const endpoint = serverEndpoint()
      if (!(await probe(endpoint))) {
        canRejoin = true
        return
      }
      let profile: Profile | null = loadProfile()
      if (!profile) {
        const picked = await askProfile(loadProfile())
        if (!picked) {
          canRejoin = true
          return
        }
        profile = storeProfile(picked)
      }
      // Loaded only once a server answered: the SDK's module-level offline listener would otherwise warn in solo.
      const loaded = await import('./session').catch((err: unknown) => {
        console.warn('[net] module réseau introuvable, on reste en solo', err)
        return null
      })
      if (!loaded) {
        canRejoin = true
        return
      }
      if (!ctx || !ui) return
      const { Session } = loaded
      const c = ctx
      const s: Session = new Session(endpoint, loadIdentity(), profile, {
        status: (st) => {
          c.bus.emit('net:status', { status: st })
          if (st === 'solo') goSolo()
          else if (st === 'online' && document.hidden) onVisibility()
        },
        message: onMessage,
        lost: (takenOver) => {
          if (session !== s) return
          session = null
          if (takenOver) {
            takenOverHere = true
            canRejoin = true
            void s.stop()
            return
          }
          void s.stop().then(() => {
            rejoinTimer = setTimeout(() => {
              rejoinTimer = null
              void connect()
            }, REJOIN_DELAY_MS)
          })
        },
      })
      session = s
      if (!(await s.start(c.state.hero.district))) {
        session = null
        canRejoin = true
      } else canRejoin = false
    } finally {
      starting = false
    }
  }

  const sendMove = (c: GameContext) => {
    const h = c.state.hero
    const drift = c.services.drift
    if (!drift || !session) return
    const local = h.localPosition ?? drift.toLocal(h.position)
    const move: ClientMessages['move'] = {
      p: [local.x, local.y, local.z], yaw: h.yaw - drift.pose().heading, mode: avatarMode(h.mode), outside: c.state.mode === 'sortie',
    }
    const key = `${move.p.map((x) => x.toFixed(2)).join()}|${move.yaw.toFixed(2)}|${move.mode}|${move.outside}`
    if (key === lastMove) return
    lastMove = key
    session.send('move', move)
  }

  // A hidden tab stops the frame loop but keeps its socket: tell the others instead of freezing mid-stride.
  const onVisibility = () => {
    if (status() !== 'online') return
    lastMove = ''
    session?.send('away', { away: document.hidden })
  }

  const markTags = (c: GameContext) => {
    if (!ui || !avatars) return
    const views = session?.quartierState?.avatars
    for (const id of avatars.ids()) {
      const view = views?.get(id)
      const head = avatars.head(id, v)
      if (view && head) ui.overlay.mark(id, head, view.name, view.color)
    }
    const mine = c.services.hero?.headPosition()
    if (mine) ui.overlay.mark(ME, v.set(mine.x, mine.y, mine.z), null)
  }

  return {
    id: 'net',
    init(c) {
      ctx = c
      c.services.net = service
      const root = netRoot(c.uiRoot)
      const online = () => status() === 'online'
      ui = {
        root,
        overlay: new Overlay(root, c.camera),
        chat: new ChatBox(root, (text) => service.chat(text), online),
        wheel: new EmoteWheel(root, (emote: EmoteId) => service.emote(emote), online),
        presence: new Presence(root, () => void connect()),
      }
      avatars = new RemoteAvatars(c)
      npcs = new NpcExecutor(c, {
        line: (name, text) => ui?.chat.line(name, text),
        bubble: (npcId, text) => {
          const p = c.services.drift?.npcPosition(npcId)
          if (p) ui?.overlay.say(`npc:${npcId}`, v.set(p.x, p.y + NPC_HEAD, p.z), text, c.clock.elapsed)
        },
      })
      world = new SharedWorld(c.state, (m) => session?.send('scrub', m))
      save = new RemoteSave(c.state, (m) => session?.send('save', m))
      unsubs.push(
        c.bus.on('district:entered', ({ district }) => {
          session?.enter(district).catch(() => undefined)
        }),
        c.bus.on('hero:seat', ({ seatId }) => {
          if (status() === 'online') session?.send('sit', { seatId })
        }),
        c.bus.on('hero:mode', ({ from, to }) => {
          if (status() === 'online' && from === 'sit' && to !== 'sit') session?.send('sit', { seatId: null })
        }),
        c.bus.on('quest:step', () => {
          if (status() !== 'online') return
          save?.hold(false)
          save?.schedule()
        }),
        c.bus.on('save:written', () => {
          if (status() === 'online') save?.schedule()
        }),
        c.bus.on('scrub:progress', ({ windowId, coat }) => {
          const m = session?.mondeState
          if (m && status() === 'online') world?.scrubbed(m, windowId, coat)
        }),
      )
      document.addEventListener('visibilitychange', onVisibility)
      c.bus.emit('net:status', { status: 'solo' })
      if (new URLSearchParams(location.search).has('debug')) {
        Object.assign(window as unknown as Record<string, unknown>, { __net: { service, connect: () => connect() } })
      }
      void connect()
    },

    update(dt, c) {
      if (!ui || !avatars) return
      if (placement && titleGone()) {
        place(c, placement)
        placement = null
        session?.enter(c.state.hero.district).catch(() => undefined)
      }
      const online = status() === 'online'
      ui.chat.show(online)
      presenceTimer -= dt
      if (presenceTimer <= 0) {
        presenceTimer = PRESENCE_SECONDS
        ui.presence.render(status(), players(), me, canRejoin, takenOverHere ? TEXT.takenOver : null)
      }
      if (online && session) {
        const m = session.mondeState
        if (m && world) world.apply(dt, m)
        npcs?.sync(session.quartierState, m)
        sendTimer -= dt
        if (sendTimer <= 0) {
          sendTimer = 1 / NET.sendHz
          sendMove(c)
        }
      }
      avatars.update(dt, online ? session?.quartierState?.avatars ?? null : null, me)
      markTags(c)
      c.camera.getWorldPosition(eye)
      ui.overlay.flush(c.clock.elapsed, eye)
    },

    dispose() {
      unsubs.splice(0).forEach((u) => u())
      document.removeEventListener('visibilitychange', onVisibility)
      if (rejoinTimer) clearTimeout(rejoinTimer)
      // The engine's unload save only schedules the debounced send; it must leave before the socket closes.
      if (status() === 'online') save?.flush()
      void session?.stop()
      session = null
      avatars?.clear()
      if (ui) {
        ui.chat.dispose()
        ui.wheel.dispose()
        ui.presence.dispose()
        ui.overlay.dispose()
        ui.root.remove()
      }
      ui = null
      ctx = null
    },
  }
}
