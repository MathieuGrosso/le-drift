# Le Drift — multijoueur (« un peu comme Habbo »)

Several real players live in the same Drift: each one on their own quest line, inventory and cabin,
all of them seeing each other, chatting, emoting, sitting together at the refectory, scrubbing the
same windows. The NPCs keep their scripted routines and, when a server with Claude credentials is
running, get a brain of their own. **Solo stays the default**: no server reachable means the game
runs exactly as it does today (static Vercel build, local save, scripted NPCs).

Contract code: `src/shared/protocol.ts` (imported by both sides). Server: `server/` (Node, Colyseus
0.18). Client: `src/net/`. This file is the plan; when the code and this file disagree, fix one of them.

## 1. Shared vs per player

| Thing | Owner | Why |
|---|---|---|
| Presence, positions, seats, modes (avatars) | server, `quartier` room state | everyone in the district sees it |
| Chat, emotes | server, room broadcasts (not state) | ephemeral, rate-limited |
| Time of day | server clock (`monde.epochMs` + tuning `TIME`) | one sun for everyone |
| Window coat (`windows`) | server, `monde.windows` | a window scrubbed by one is clean for all |
| NPC moods, places, orders | server (`monde.npcs`, `quartier.orders`) | NPCs live one life |
| NPC scripted routines | each client, from the shared clock + seeded rng | deterministic, zero bandwidth |
| `act`, `quests`, `flags`, `chart`, `inventory`, `shallows`, `trouvailles`, hero spawn | per player (`PlayerSave`), persisted server-side | own progress, own pace |
| Story scenes (`playScene`, La Chose close-up, the rain) | per player, played locally | like a BotW memory: others see you in `cutscene` |
| Drift route position, `env` (visibility, current, rain) | per player, derived from that player's act | it is only a backdrop seen through glass |
| `settings`, `debug` | local only | |

Trade-offs taken on purpose:
- **Sleep online does not skip time.** « Dormir » saves, restores endurance and shows you asleep in
  your bunk (`status: 'dort'`); the menu offers « Dormir jusqu'à … » only in solo.
- **Per-player progress is client-authoritative.** The server validates the save's shape and size,
  not its legitimacy: it is a cozy shared world with nothing to win. Shared facts (windows, time,
  positions, NPCs) are server-authoritative.
- **Window regrowth online uses `WINDOWS.sharedRegrowHours`** (one rate for everyone); solo keeps the
  act/north-dependent rate.

## 2. Rooms

Server packages: `@colyseus/core` + `@colyseus/ws-transport` + `@colyseus/schema` 0.18/5.x (MIT).
Client: `@colyseus/sdk` 0.18, the renamed successor of `colyseus.js` (0.16 does not speak to a 0.18 server).

Two Colyseus rooms, both behind the same identity check (`onAuth`):

- **`monde`** (one instance): clock, windows, the roster of online players (presence list), NPC
  directory, per-player save. Every client joins it once and stays.
- **`quartier`** (one instance per `DistrictId`, `filterBy(['district'])`): avatars at 12 Hz patch
  rate (`NET.sendHz`), chat, emotes, seats, NPC talk requests and NPC orders for that district.
  On `district:entered` the client joins the new district room *before* leaving the old one (no
  pop-out at the gangway). During a sortie the player stays in the lock's district with `outside: true`.

Reconnection: `onDrop` → `allowReconnection(client, NET.reconnectSeconds)`; the card turns `absent`
meanwhile. The client uses the SDK's reconnection token; after it expires it rejoins from scratch.

## 3. Protocol

Join options (validated by zod, `server/src/validate.ts`):

```json
{ "protocol": 1, "identity": { "id": "<uuid>", "secret": "<32-64 url-safe chars>" },
  "profile": { "name": "Ilo", "color": 14181454 }, "district": "ecluse" }
```

`district` only on `quartier`. `color` must be one of `AVATAR_COLORS`. Names are sanitized
(`sanitizeText`: NFC, control/bidi chars removed, `<` `>` stripped, 2-20 chars).

Client → server (`ClientMessages`, each wrapped in `validate(zodSchema, handler)`):

| Type | Room | Payload |
|---|---|---|
| `move` | quartier | `{ "p": [x, y, z], "yaw": 0.3, "mode": "walk", "outside": false }` Drift-local, 12 Hz max |
| `chat` | quartier | `{ "text": "Bonjour !" }` ≤ 140 chars, 5 per 10 s |
| `emote` | quartier | `{ "emote": "salut" }` one of `EMOTES` |
| `sit` | quartier | `{ "seatId": "banc-refectoire-3" }` or `null` |
| `talk` | quartier | `{ "npcId": "cuistot", "text": "Il reste du pain ?" }` or `text: null` for a plain « Parler » |
| `scrub` | monde | `{ "windowId": "w-ecluse-12", "amount": 0.08 }` amount 0..1 |
| `save` | monde | `{ "save": PlayerSave }` ≤ 64 kB, debounced client-side (`NET.saveDebounceMs`) |
| `profile` | monde | `{ "name": "Ilo", "color": 7246768 }` |

Server → client (`ServerMessages`):

| Type | Payload |
|---|---|
| `welcome` | `{ "you": "<uuid>", "save": PlayerSave \| null, "brains": true }` |
| `chat` | `{ "from": "<uuid>", "name": "Mila", "text": "…", "at": 1760000000000 }` |
| `emote` | `{ "from": "<uuid>", "emote": "rire" }` |
| `npc:say` | `{ "npcId": "cuistot", "text": "…", "to": "<uuid>" \| null }` (with `to`: sent to that player only) |
| `npc:give` | `{ "npcId": "cuistot", "item": "pain-du-cuistot", "count": 1 }` (sent to that player only) |
| `npc:quest` | `{ "npcId": "mme-rouille", "questId": "demande-rouille" }` |
| `refused` | `{ "reason": "rate", "detail": "…" }` |

Synced state (Colyseus schema, delta patches built in; shapes in `server/src/state.ts`, read on the
client through the `*View` interfaces of the protocol):

```
MondeState    { epochMs, realMsPerGameHour, startHours,
                windows: Map<windowId, scrubbedAtGameHours>,
                players: Map<playerId, { id, name, color, district, status }>,
                npcs:    Map<npcId, { id, district, place, mood, thinking }> }
QuartierState { district,
                avatars: Map<playerId, { id, name, color, x, y, z, yaw, mode, outside, seatId }>,
                orders:  Map<npcId, { npcId, kind, place, emote, until }> }
```

Game time everywhere: `sharedGameHours(now, epochMs, startHours, realMsPerGameHour)` (absolute hours
since day 1; `day = startDay + floor(h / 24)`). Window coat everywhere: `windowCoat(...)`. Both live in
the protocol so client and server cannot drift apart.

Server security rules: every message goes through a zod schema (unknown types are dropped by
Colyseus); `maxMessagesPerSecond = LIMITS.messagesPerSecond` disconnects floods; chat has its own
per-player window; `move` is clamped to the district box (`DISTRICT_BY_ID`) plus a margin and to a max
speed (server-core TODO); NPC text and player text are rendered with `textContent`, never `innerHTML`.
A `quartier` is created only for a valid `DistrictId` and never replaces the live room of its district.
Emotes, seats, saves, profile changes and new window ids have per-player windows too.

## 4. Server modules (`server/src`)

| Module | Role |
|---|---|
| `index.ts` | boot: store, brains, `defineServer` with `monde` + `quartier`, periodic flush, shutdown flush |
| `config.ts` | env: `PORT` (8787), `DRIFT_DATA_DIR` (`server/data/`), `NPC_MODEL`, `NPC_DAILY_TOKENS`, tick and rate limits |
| `state.ts` | Colyseus schemas (`schema()` + `t`) |
| `validate.ts` | zod schemas, each checked against the protocol type with `satisfies` |
| `identity.ts` | first join claims the uuid; later joins must present the same secret (sha-256, constant-time compare) |
| `persist.ts` | JSON store: `players.json` (profile, secret hash, `PlayerSave`), `world.json` (epoch, windows, NPC memories, token budget); atomic writes |
| `clock.ts` | shared clock from `TIME` |
| `rooms/monde.ts`, `rooms/quartier.ts` | handlers above |
| `npc/brain.ts` | contracts: `NpcSheet`, `NpcTrigger`, `NpcBrains`, `DecideFn` |
| `npc/decide.ts` | the one Claude call (below) |
| `npc/actions.ts` | `toActions`: model JSON → whitelisted `NpcAction[]`; anything else becomes `idle` |
| `npc/budget.ts` | daily token budget + calls per minute |
| `npc/index.ts` | `createBrains()`: Claude brains when credentials resolve, `createScriptedBrains()` otherwise or with `NPC_BRAINS=scripted`; the boot logs which |

Persistence is JSON on purpose (tens of players, a few kB each). If it grows: `node:sqlite`, same
`Store` interface. `server/data/` is gitignored.

## 5. Client modules (`src/net`)

`createNetSystem()` is a regular `System` (id `net`, registered last in `main.ts`) exposing
`ctx.services.net: NetService` (`status`, `me`, `players`, `chat`, `emote`, `talk`) and the bus events
`net:status`, `net:chat`, `net:emote`. Today it is the solo implementation.

| Module | Role |
|---|---|
| `index.ts` | the system; never awaits the network in `init` or `update` |
| `identity.ts` | `le-drift:identity:v1` (uuid + secret) and `le-drift:profile:v1` in localStorage |
| `connect.ts` | `VITE_DRIFT_SERVER` or `ws://<host>:8787`; probe `GET /` on the http side with `NET.probeTimeoutMs`; on failure stay solo and retry only from the pause menu |
| `rooms.ts` | joins `monde`, then `quartier` on each `district:entered`; reconnection |
| `avatars.ts` | remote Ilo: `buildHero` from `src/hero/model.ts` (hero exposes a `createAvatar(color)` factory), per-player cloth tint, 150 ms interpolation buffer (`NET.interpDelayMs`), mode → clip |
| `nametags.ts` | name above head, fades past `NET.nameTagMaxDistance` |
| `chat.ts` | French chat box (`Entrée` to talk, « Écrire… »), bubbles over avatars reusing the `Chatter` bubble style |
| `emotes.ts` | emote wheel (hold `E`/LB): « Salut », « Oui », « Non », « Rire », « Bravo », « Regarde », « S'asseoir », « Dormir », « Pluie » |
| `presence.ts` | « À bord » list: name, colour dot, district name |
| `world.ts` | applies the shared clock to `state.time` (scale 0, hours from the server) and `monde.windows` into the window service |
| `npcs.ts` | `npc:say` → bubble, `orders` → drift NPC overrides, `npc:give`/`npc:quest` → gameplay |
| `save.ts` | a `SaveStore` that writes `PlayerSave` to `monde` (debounced) and still mirrors to localStorage |
| `welcome.ts` | first join: « Comment tu t'appelles ? » + colour swatches |

Frame-loop rule: all sends are fire-and-forget; `move` is sampled in `update` at `NET.sendHz`; state
callbacks only write into plain buffers that `update` reads.

## 6. Gameplay becomes per player

- `GameState` stays the single local truth. Online, `net/world.ts` overwrites `time` and `windows`
  from the server every frame; everything else is the player's own.
- `drift/windows.ts`: `coat()`/`scrub()` call `windowCoat` from the protocol (delete the local copy)
  and, online, `scrub()` also sends `scrub`; the server value wins on the next patch.
- `engine.ts` time: online the time scale is 0 and hours come from `sharedGameHours`; `setTime` and
  `sleepUntil` are solo-only.
- Save: `createSaveStore` gains a remote sink; `welcome.save` (if present) replaces the local save on
  join; `PlayerSave` is `GameState` minus shared and local keys.
- Quests stay flag-derived and idempotent (BIBLE §3); nothing in them assumes being alone except the
  scenes, which run locally.
- Interact prompts: a remote avatar is an `interact` candidate « Saluer » (sends the `salut` emote
  facing them).

## 7. NPC actions → existing game APIs

| `NpcAction` | Client effect | API |
|---|---|---|
| `walk { place }` | NPC leaves its routine, walks there, resumes after `until` | new `DriftService.npcOrder(npcId, order)` on `Npcs` (path via `drift.navmesh().path`) |
| `sit { place }` | walks, then `sit` pose at the nearest free seat of that place | same |
| `say { text, to }` | bubble over the NPC; if `to` is me and I am talking to it, a dialogue line | `Chatter.say(npcId, text)` (new), `gp.dialogue.play` |
| `emote { emote }` | pose for 3 s (`cheer`, `clap`, `hand`…) | `npcOrder` |
| `give { item, to }` | toast « Le Cuistot te donne : … » | `gameplay.giveItem` |
| `quest { questId, to }` | starts a petite demande | `gameplay` quest registry (new ids `SIDE_QUESTS`) |
| `idle` | nothing | |

Place names (`NPC_PLACES`) map to drift spots in one table owned by drift. Gifts are only
`NPC_GIFTS` (never key items). NPC ids are the named roster (`NPC_IDS` in `drift/npcs.ts`); crowd
extras never think.

## 8. NPC brains and the cost guard

Per NPC: a character sheet (`system`) built once from the BIBLE characters and `drift/text.ts`
CHATTER lines, plus a world-bible excerpt; short-term memory (last ~10 events in its district);
long-term memory per player (a 1-2 sentence summary, rewritten after each conversation).
Player text (chat, names, what one says to an NPC) is untrusted: memory stores it as typed events, the prompt
renders it as JSON lines inside one `<events>` block that the system prompt declares data, never instructions.
A player adds at most 3 chat lines per minute to a district's memory. A private talk stays private: shared
memory records only that the player came to talk, and the NPC's reply to them is not recorded there.

Loop (`npc/` on the server):
1. **Slow tick**: each named NPC thinks every `NPC_TICK_MIN_MS`..`NPC_TICK_MAX_MS` (2-5 min, jittered),
   only if at least one player is in its district. Effort `low` (barks, moves).
2. **Talk**: a `talk` message thinks immediately with effort `medium`; the player's memory summary is
   in the user turn. While thinking, `npcs[id].thinking = true` (client shows « … »).
3. Before any call: `budget.allow()`. If false, or no credentials, or the call fails or refuses,
   the NPC falls back to a scripted CHATTER line (talk) or nothing (tick).
4. The call (`npc/decide.ts`): `client.beta.messages.create` with `model: NPC_MODEL` (default
   `claude-opus-5-5`), `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`,
   `system: [{ text: sheet.system, cache_control: { type: 'ephemeral' } }]` (byte-stable → cached),
   `output_config: { effort, format: { type: 'json_schema', schema } }` for
   `{ intent, target, say, mood }`; `stop_reason === 'refusal'` → null before reading content.
5. `toActions` validates the JSON again (zod) and maps it to the whitelist; the room applies orders
   to `quartier.orders`, broadcasts a public `npc:say`, and sends a reply `npc:say`, `npc:give`/`npc:quest` to the one player.
6. Usage (input + output + cache writes) goes to `budget.spend`; `world.json` keeps the day's total.

Credentials only from the environment (`ANTHROPIC_API_KEY`, or an `ant auth login` profile, which the
SDK reads by itself). Never in the repo, never sent to the client. Global limits: `NPC_DAILY_TOKENS`
(200 000), `NPC_CALLS_PER_MINUTE` (6).

## 9. Run it locally with 2+ players

```bash
npm install && (cd server && npm install)
npm run server                    # ws://localhost:8787, prints « PNJ scriptés » or « PNJ Claude »
npm run dev                       # http://localhost:5173
```

Open two tabs: the second one needs another identity, so use a private window (or
`?identity=2`, which client-net maps to a second localStorage key). LAN: `npm run dev -- --host` and
`VITE_DRIFT_SERVER=ws://<lan-ip>:8787 npm run dev -- --host`; other machines open
`http://<lan-ip>:5173`. Claude NPCs: `ANTHROPIC_API_KEY=… npm run server` (or after `ant auth login`).
`npm run typecheck && npm run typecheck:server` before any commit. Kill the server and vite when done.

## 10. Ownership split (4 parallel builders)

Each builder owns only its paths; `src/shared/protocol.ts` is shared: additive changes only, announced
in the commit body, `PROTOCOL_VERSION` bumped on any breaking change.

| Builder | Owns | Delivers |
|---|---|---|
| **server-core** | `server/src/{index,config,state,validate,identity,persist,clock}.ts`, `server/src/rooms/*` | move clamping (district box + max speed), `refused` replies, save debounce/flush, `profile` sync to quartier avatars, district hand-over, roster `district`/`status` updates, `world.json` windows flush, a `server/README` line; a smoke script `server/scripts/bots.ts` that joins 3 fake players |
| **client-net** | `src/net/*`, adding `createNetSystem()` to `src/main.ts`, `@colyseus/sdk` in root `package.json` | connect/probe/solo fallback, rooms, avatars + interpolation (asks hero for `createAvatar(color)`), name tags, chat, emote wheel, presence list, welcome form, `world.ts` and `save.ts` sinks; all text French |
| **npc-brains** | `server/src/npc/*` | character sheets from BIBLE + CHATTER, memories (short-term, per-player summaries in `world.json`), tick scheduler, `createClaudeBrains()` with the budget, scripted fallback lines, applying actions to rooms through a small `RoomRegistry` passed in `RoomDeps` |
| **gameplay-adapt** | `src/drift/windows.ts`, `src/drift/npcs.ts` (+ `chatter.ts`), `src/gameplay/*`, `src/core/{engine,save,state}.ts` hooks, `src/hero` avatar factory | `windowCoat` reuse, shared clock in the engine, remote save sink, `npcOrder` on drift NPCs, `Chatter.say`, side quests `SIDE_QUESTS`, « Saluer » interaction, sleep online, `createAvatar(color)` from the hero model with the physics scarf |

Order: server-core and gameplay-adapt start at once; client-net starts at once against the solo
stub and the protocol; npc-brains needs only `npc/brain.ts` and `RoomDeps`.

Note for the bible (§4.1): `src/net/` and `src/shared/` are new folders; `server/` is a separate
package with its own `node_modules`. The server's tsconfig needs the DOM lib only because
`src/core/types.ts` mixes domain ids with render types; splitting `core/ids.ts` out would remove it.
