# Le Drift — Bible

Single source of truth for every builder. You work in parallel with other builders and only see
this file plus the code. If the code and this file disagree, this file wins; if this file is
silent, choose the option that keeps the other folders working without you.

Pitch, in the owner's words: **"Zelda Breath of the Wild, mais sous l'eau."**
We reverse-engineer BotW's systems and art direction and transpose them under the sea.
Soft, luminous, painterly, Ghibli-warm. **Never dark murky water.**

Stack: Vite + TypeScript strict + three.js + `@dimforge/rapier3d-compat`. Scripts: `dev`, `build`,
`preview`, `typecheck`. No other runtime dependency. Assets are generated in code; a download is
allowed only if CC0, recorded in `assets/CREDITS.md` (source URL + license).

Player-facing text: **French only**. Code, identifiers, comments: English. Comments rare (traps only).

---

## 0. What BotW does, and what we keep

Sources: GDC 2017 "Breaking Conventions with The Legend of Zelda: Breath of the Wild"
(Fujibayashi, Dohta, Takizawa: multiplicative gameplay, chemistry engine), CEDEC/GDC 2017 level
design talk (Hirano, Yonezu: triangle rule, "gravity", density map), the art direction (Ghibli and
impressionist painting references), and the shipped game.

| BotW principle | What it means | Our rule |
|---|---|---|
| Multiplicative gameplay | A few rules that combine, not many scripted solutions | 10 chemistry rules (§0.1), every puzzle solvable more than one way |
| Chemistry engine | Elements change states of materials; materials react | Current, heat, light, bubbles, coat, sand (§0.1) |
| Climb anything | Every surface is a route, gated by stamina only | Rock, hulls, kelp stalks, coral: all climbable, cost = souffle |
| Great Plateau | Closed tutorial teaching every core verb, exit needs the paraglider | Act 1 on and around the Drift; you leave with the **voile** |
| Towers | Visible from everywhere, a climbing puzzle, reveal the map, give a vista | **Sondes** on ridges, draw grandfather's chart |
| Triangle rule | Triangular landforms hide what lies behind; small ones create curiosity at walking scale, big ones are landmarks; you crest one and something new appears | Ridges, dunes and kelp walls as occluders; landmarks always peek over |
| Gravity | Strong silhouettes pull the player: towers, shrine glow, stables | Sonde light columns, haut-fond glow, the Drift's lit windows, the vent plume |
| Density map | Something to notice every ~30 s of travel | One point of interest every 80-120 m (trouvaille, fish, wreck, haut-fond, NPC) |
| Shrines | Short, contained puzzle rooms, one rule each, reward → stamina/heart | **Hauts-fonds**: shallow seamounts with a puzzle, reward a **Nacre** |
| Korok seeds | Hundreds of tiny surprises on every rock | **Trouvailles**: lost things from the surface |
| Cooking | Free combination of 1-5 ingredients, deterministic result, buffs | **Le Cuistot** on the Drift, plus a marmite at the camps |
| Weather | Rain makes climbing slippery, lightning targets metal, cold/heat | Currents, plankton bloom, jellyfish swarms, the final rain from below |
| Day/night | Time changes light, creatures, music | Surface light cycle, bioluminescent nights |
| Minimal HUD | Everything appears only when it matters; stamina wheel beside Link | Souffle wheel beside the hero, nothing else by default |
| Music | Sparse piano phrases, lots of silence, context stingers | Generative WebAudio, mostly silence, stingers at discoveries |
| No fail states that block | You die, you reload a few seconds back | No death at all; exhaustion and gentle returns only |

### 0.1 Chemistry rules (the "elements" of the sea)

All systems honour these; puzzles are built only from them.

1. **Le Revêtement** (coat): anything static grows algae fur (`coat` 0→1) over time. Faster in the north (×2 in Le Blanc), faster in light.
2. Coat **blocks light**: a coated window is opaque, a coated lens or mirror shell does not pass a beam.
3. **Frotter** (F) removes coat. Scrubbing a lens/window/mirror restores it.
4. **Courant** pushes the hero, light objects, fish, bubbles, sand clouds, kelp and grass. Lanes are fast; the global current is gentle.
5. **Chaleur** (vents, the plume): makes rising water = updraft; the hero with open voile rises in it (BotW campfire updraft).
6. **Bulles**: a bubble column lifts the hero and light objects; a trapped bubble (bell) lifts heavy objects; breathing a bubble refills souffle.
7. **Lumière**: sun shafts and bioluminescence. Light attracts jellyfish and plankton; mirror shells redirect a shaft; a lit anemone gate opens.
8. **Sable**: kicking or landing hard stirs sand → local visibility drop for 4 s; fish hide in it.
9. **Lest** (weights): the hero sinks. Heavy objects sink, light ones (shells, trouvailles, floats) drift up toward the ceiling.
10. **Faim**: fish follow food; dropping food (inventory) leads a school; a school can push a light object or reveal a trouvaille.

---

## 1. Transposition table BotW → Le Drift

| BotW | Le Drift | Notes |
|---|---|---|
| Link | **Ilo**, laveur de vitres du Drift | 16 y.o., coral scarf trailing like Link's tunic, scrubber on the back |
| Stamina wheel | **Souffle** | Wheel next to the hero, segments, turns orange when exhausted |
| Hearts | none | No combat, no death; jellyfish sting = stun + souffle loss |
| Gravity / falling | **Le lest** (weight belt): the hero sinks at 1.4 m/s | Makes verticality matter like BotW |
| Jump | **Coup de palme** (kick up, Espace) | Costs souffle |
| Climbing | Climb rock, hulls, kelp stalks, coral | Strong current = slippery (BotW rain) |
| Paraglider | **La voile** (grandfather's old sail), opens with Espace while sinking | Slow sink, fast forward; rides currents and vent updrafts |
| Horse | **La raie manta** (act 2) | Called with a whistle, rides current lanes |
| Towers | **Sondes** (6) on ridges | Climbing puzzle; activation draws the region on grandfather's chart |
| Hyrule Castle | **Le Drift**, the moving city of 400 hulls | Visible from the whole map, lit windows |
| Death Mountain | **La Cheminée**, a hydrothermal vent whose plume reaches the ceiling | Warm glow, updrafts |
| Shrines | **Hauts-fonds** (12): white zones on the chart, floor rises toward the ceiling | Puzzle with currents/bubbles/light/coat |
| Spirit orbs | **Nacres** | 4 nacres → +0.2 souffle wheel (from grandfather) |
| Korok seeds | **Trouvailles** (60): lost things from the surface | The kids name them wrong; 5 → +1 bag slot |
| Hestu | **Les enfants du rebord** (Mila, Tao, Pépin) | Keep a "musée du rebord" on the window sill |
| Cooking pot | **Le Cuistot** (galley) and **marmites** at camps | Combination rules, buffs |
| Sky / sun | **Le plafond** (surface seen from below) + sun cycle | Snell's window, shafts, ripples |
| Weather | Courant, visibilité, bloom de plancton, essaim de méduses | Posted on the forecast board by the lock |
| Thunderstorm | **Essaim de méduses** | Attracted by light (lantern) |
| Blood moon | **Nuit de plancton** | Every 5th night, the whole sea glows, music changes |
| Map | **La carte du grand-père** | Hand-drawn; unrevealed regions are blank paper |
| Fast travel | **Revenir à l'écluse** (always) + to any activated sonde | The anti-soft-lock exit |
| Shiekah Slate | **Le stylo du grand-père** (act 3) | Draws your own measures on the white |
| Calamity Ganon | none; the mystery is **La Chose** | The bird that dives through the ceiling twice a day |
| Rain | **La pluie**, seen from below as rings on the ceiling | Only in the finale and post-game |

---

## 2. The world

### 2.1 Units and coordinates

- 1 unit = 1 m. Three.js axes: **+x = east, −z = north, +y = up**.
- World square: `x, z ∈ [−1024, 1024]` (2048 m × 2048 m).
- **Ceiling (`CEILING_Y`) = 120.** The hero cannot go above `y = 118` (soft push down, except the ending).
- Floor: general 0-30, ridges up to 60-100, Le Blanc rises from 30 at `z = −650` to ~112 at `z = −1000`.
- Chunks: **128 m** (16 × 16 = 256 chunks). Chunk `(cx, cz)` covers `x ∈ [cx·128 − 1024, +128)`. Streaming radius by quality (§4.10).
- `SEED = 0x0D21F7` (world gen is deterministic from it).

All coordinates below live in `src/core/layout.ts` (owned by core, values copied from this table).
Everybody reads layout from there; nobody hardcodes their own copy.

### 2.2 Regions

| Id | Nom | Centre (x, z) | Character |
|---|---|---|---|
| `prairie` | La Prairie de l'Écluse | (0, 600) | Rolling sea-grass plains, gentle dunes (small triangles), the Drift's route. Start. |
| `laminaires` | La Forêt de Laminaires | (−620, 0) | Golden kelp 30-70 m tall, cathedral light, climbable stalks |
| `pilier` | Le Pilier et les Arches | (0, 0) | Central rock spire to y=95, natural arches, the trench Le Sillon |
| `cheminee` | La Cheminée | (820, 380) | Vent field, black smokers, warm orange glow, the plume to the ceiling |
| `coques` | Le Cimetière des Coques | (560, −520) | Wrecked hulls of older Drifts, coated, ruins (BotW ruins) |
| `blanc` | Le Blanc (les hauts-fonds) | (0, −850) | Pale ridged sand rising to the ceiling, white coral, bright and luminous |
| `bleu` | Le Bleu | south and west edges | Drop-off into the abyss beyond |x| or |z| > 980 (S, W). Gentle current returns the hero |

Boundaries: south and west = Le Bleu drop-off; east = vent cliffs beyond x = 980; north = Le Blanc
meeting the ceiling. No invisible walls: the terrain or a current does the job.

### 2.3 Landmarks (triangle rule)

Visible from nearly everywhere (never fully hazed, see `uHazeMax`):

| Landmark | Position | Size | Why it pulls |
|---|---|---|---|
| **Le Drift** | moving (§2.5) | ~260 × 160 m, 400 hulls, y 40-75 | Warm lit windows, the home |
| **Le panache de la Cheminée** | (820, 380) | Plume Ø 30 → 120 m, floor to ceiling | Glowing base, Death Mountain |
| **Le Pilier** | (0, 0) | Spire to y=95 | Center, first big climb, sonde on top |
| **La Canopée** | (−620, 0) | Kelp walls to y=90 | Golden forest edge |
| **La lueur du Blanc** | north horizon | — | Ceiling brighter where the floor is shallow |
| Sonde light columns | each sonde | bubble + light column to ceiling | Visible once nearby or activated |

Mid-scale triangles: dunes 6-15 m high every 60-120 m in the prairie, ridges 20-40 m between regions,
so that cresting one reveals the next point of interest. The player should almost never see the full
route to a goal from the start.

### 2.4 Points of interest (layout data)

Sondes (activation reveals that region of the chart):

| Id | Nom | (x, z) | Top y | Puzzle |
|---|---|---|---|---|
| `sonde-promontoire` | Sonde du Promontoire | (−40, 660) | 60 | Tutorial climb (act 1) |
| `sonde-pilier` | Sonde du Pilier | (0, 0) | 100 | Long climb, rest ledges, souffle management |
| `sonde-laminaires` | Sonde des Laminaires | (−640, 60) | 85 | Climb kelp stalks, current shakes them |
| `sonde-cheminee` | Sonde de la Cheminée | (760, 300) | 90 | Ride the vent updraft with the voile |
| `sonde-coques` | Sonde des Coques | (560, −520) | 80 | Stacked wrecks; scrub a coated hatch |
| `sonde-blanc` | Sonde du Seuil Blanc | (−100, −700) | 95 | Reveals only the edge; the Blanc stays white |

Hauts-fonds (shrines, `hf-01`…`hf-12`), each a seamount whose top is 8-15 m below the ceiling:

| Id | (x, z) | Rule taught |
|---|---|---|
| hf-01 | (−320, 520) | Bubble column lift |
| hf-02 | (260, 700) | Scrub a lens, light opens a gate |
| hf-03 | (−520, −240) | Current lane carries a float |
| hf-04 | (−760, 360) | Kelp sway as a timing platform |
| hf-05 | (180, −160) | Mirror shells redirect a shaft |
| hf-06 | (620, 620) | Heat updraft + voile |
| hf-07 | (880, −140) | Trapped bubble bell lifts a weight |
| hf-08 | (380, −360) | Fish follow food, push a float |
| hf-09 | (−380, −780) | Le Blanc: coat regrows in seconds, race it |
| hf-10 | (300, −820) | Le Blanc: light + lens + current |
| hf-11 | (−160, −900) | Le Blanc: bubbles + weights |
| hf-12 | (120, −960) | **Le Seuil**: the finale ridge (no puzzle, the ending) |

Other: lock (`ecluse`) on the Drift's southern hull, camps with marmites at (−300, 420), (−560, −160),
(640, 220), (420, −320), (−80, −560). Current lanes (polyline + width + speed m/s):

- `lane-sud`: (−900, 800) → (−300, 700) → (300, 640) → (900, 520), width 30, 8 m/s (eastward)
- `lane-ouest`: (−880, −600) → (−700, −100) → (−640, 500), width 25, 10 m/s (southward)
- `lane-nord`: (500, 300) → (420, −100) → (200, −500) → (−100, −720), width 30, 9 m/s (northward)
- `lane-cheminee`: vertical updraft at the vent, radius 40, 7 m/s up

### 2.5 The Drift moves

The Drift follows `DRIFT_ROUTE` at **0.5 m/s** (a slow walk), heading = route tangent.

| Waypoint | (x, z) | Gate |
|---|---|---|
| `start` | (80, 520) | Act 1 start |
| `halte-prairie` | (300, 450) | Act 1 holds here (fishing) until act 2 |
| `virage-nord` | (450, 250) | Act 2 turn north |
| `halte-coques` | (300, −450) | Waits here until ≥ 3 sondes activated |
| `bord-du-blanc` | (100, −640) | Act 3: too shallow to go on. Final stop |

`state.drift.progress` is meters along the route, advanced by game time, **clamped to the current
gate**. The Drift never leaves the hero behind in an unrecoverable way: "Revenir à l'écluse" always
works. Anything standing on a hull moves with it (hero controller adds `drift.velocity` when grounded
on a collider tagged `hull`).

### 2.6 The ending

Act 3 ends at `hf-12` Le Seuil (120, −960, top y ≈ 112): the floor nearly touches the ceiling.
Rain rings cover the ceiling. The hero takes off the lest, rises, places a hand flat on the ceiling
(mirror of grandfather's hand on his window). Rings spread from the hand; fade to white; the chart
appears with the first line in the white drawn in the hero's hand. Credits. Then post-game free roam,
with occasional rain.

---

## 3. Story and quests

Characters: **Ilo** (hero, unnamed in dialogue: people say "toi" / "petit·e"), **Grand-père**
(keeps the chart), **le Cuistot**, **Mme Rouille** (gardienne de l'écluse, forecast board),
**les enfants du rebord** (Mila, Tao, Pépin), **La Chose** (the bird; nobody has the word "oiseau").

### Act 1 — La Vitre (the Great Plateau)

Game day 1, starts 06:00. Teaches every core verb in a bounded space around the Drift.

1. `a1-reveil` Wake in the bunk, walk to the lock. Forecast board: « Visibilité 30 m. Courant du sud. Risque de méduses. »
2. `a1-corde` Lock → rope guide line → hull. Teaches walk, kick, sink, climb (hull), souffle.
3. `a1-grande-vitre` Scrub the big window (scrub minigame). The whole Drift eats breakfast in front of it. A turtle swims by: « Une tortue ! Une première ! »
4. `a1-petit-dejeuner` Breakfast with the Cuistot (cooking tutorial: « poisson, poisson, et quelque chose que le Cuistot appelle du pain »). You get yours last, still dripping.
5. `a1-rebord` The kids' clapping game on the sill (rhythm minigame): « Pluie, pluie, va-t'en… » « C'est quoi, une pluie ? » « Un poisson. »
6. `a1-chose` 07:00 scripted: La Chose falls through the ceiling near the Drift, grabs a fish, goes back up. First sighting from outside.
7. `a1-grand-pere` Scrub grandfather's window last. He shows the chart, the groove of the route, the white. « Cette année, la nourriture est partie au nord. Vers le blanc. »
8. `a1-sonde` Reactivate the Sonde du Promontoire (tutorial tower). Vista. Chart draws the Prairie.
9. `a1-voile` Grandfather gives his old **voile**. Leaving the Prairie's ridge requires it (the Great Plateau exit). → act 2.

### Act 2 — Le Nord (open world)

The Drift turns north. The world opens. Visibility forecasts climb: 60 m, 90 m, « beaucoup ».
Coat regrows faster: windows need a round each time you come back.

- `a2-sondes` Activate **any 3** of the 5 remaining sondes (any order). Each one: chart region + vista + grandfather's remark.
- `a2-raie` Feed a manta caught in a current eddy → it follows your whistle (ride unlock). Optional but signposted.
- `a2-chose` Each La Chose dive happens closer to the hero (scripted dive positions approach the Drift's front).
- `a2-halte` At `halte-coques` the Drift waits until 3 sondes are done, then proceeds to `bord-du-blanc`.
- Exit condition: Drift at `bord-du-blanc` → act 3 starts the next morning (third morning near the Blanc).

### Act 3 — Le Blanc

1. `a3-matin` Third morning. At the big window, La Chose comes close: arms too wide, layered like a book, an eye turned toward you, holding the fish like grandfather holds a pen. It goes up, leaving rings.
2. `a3-pluie` Hundreds of rings with no fish under them; a soft sound through the glass. Grandfather, hand flat on his window, mouths « pluie ». He looks at you, at the pen, at the white. He gives you **le stylo**.
3. `a3-mesures` Enter Le Blanc (chart blank). Place your **repères** (pen) at 3 of hf-09/10/11 or their summits (puzzle optional: the summit is reachable by climbing). Each draws your line on the chart.
4. `a3-seuil` Reach hf-12 Le Seuil. Ending (§2.6).

### No soft-locks (hard rules)

- Every required objective is reachable with base souffle (1.0 wheel) and base items; nacres only make things easier.
- The voile is given before the Prairie exit; the manta is never required.
- « Revenir à l'écluse » is always in the pause menu and on the chart.
- Quest state is derived from flags and is idempotent: re-entering a step never removes a key item.
- Key items (voile, stylo, frottoir, lest) cannot be dropped, eaten or sold.
- Out of souffle never kills: you let go, sink, and recover on the floor.
- Le Bleu: a current carries you back to the last safe position (fade 1 s).
- `setAct(n)` must produce a consistent state (grant all prerequisites of earlier acts).

### Side activities

- **La tournée** : daily window round (20 windows near the lock), coat regrows; reward: ingredients, and gossip lines from residents.
- **Hauts-fonds** : 11 puzzles + Le Seuil. Nacres → souffle (+0.2 per 4 nacres, max 3.0 wheels in total with later upgrades if added).
- **Trouvailles** : 60 lost surface objects, each with a micro-challenge (under a stone, in a closed clam, on a kelp tip, in a coated porthole, carried by a school of fish). Kids rename them: « Un parapluie. Mila dit que c'est un poisson qui a mal tourné. »
- **Cuisine** : free combinations; deterministic.
- **Courses de raie** : ride lanes against the clock (act 2+).
- **Recensement** : count fish species for grandfather's chart margins (bestiary).
- **Petites demandes** : 8 Drift residents' errands (deliver, find, scrub a special window).
- **Le jeu de mains** : the clapping game, harder verses unlocked by trouvailles.

### Items (`ItemId`)

Tools (key): `frottoir`, `lest`, `voile`, `sifflet-raie`, `stylo`, `lanterne`.
Ingredients: `poisson`, `algue-rouge`, `algue-doree`, `oursin`, `moule`, `crevette`, `sel-de-cheminee`, `plancton`, `mie-du-cuistot`.
Dishes: `soupe-chaude` (vent heat, +regen 50 % 3 min), `galette-de-plancton` (refill souffle), `brochette` (sprint −30 % cost 3 min), `pain-du-cuistot` (refill + temporary +0.2 wheel), `rate` (« Plat raté »: tiny refill).
Other: `nacre`, `trouvaille:<id>` (60 ids `tr-01`…`tr-60`).

Cooking rule: bag of 1-5 ingredients → dish by priority table in `gameplay/cooking.ts`; any unknown combo → `rate`. Deterministic.

---

## 4. Architecture

### 4.1 Folders and ownership

Exactly one owner per folder. **Never edit another folder.** Cross-folder access is only:
(a) `import type` from `src/core/types.ts`, (b) runtime calls through `ctx.services.*`,
(c) data from `src/core/layout.ts` and `src/core/tuning.ts`, (d) events on `ctx.bus`.
No runtime import from another non-core folder.

```
index.html                 core
package.json, vite/ts cfg  core (no new dependencies without the owner's agreement)
src/main.ts                core
src/core/                  engine, loop, input, physics, event bus, state, save, quality, debug, layout, tuning, types
src/render/                renderer setup, cel materials, post, haze, god rays, caustics, ceiling, sun cycle
src/world/                 terrain heightfield chunks, rocks, ridges, arches, shallows, colliders, current field
src/flora/                 kelp, sea grass, coral, anemones (instanced, sway, LOD)
src/hero/                  model, skeleton, animations, scarf, controller, camera
src/drift/                 hulls, windows + coat, interiors seen through glass, NPCs, lock, rope
src/fauna/                 fish schools, jellyfish, whale, manta, turtle, La Chose
src/gameplay/              souffle, climbing costs, glide rules, sondes, hauts-fonds, trouvailles, cooking,
                           inventory, quests, dialogue, weather, chart UI, HUD, menus
src/audio/                 adaptive music, ambience, sfx
assets/                    CREDITS.md (anyone appends, one line per asset)
docs/                      BIBLE.md
```

Each folder exposes `src/<folder>/index.ts` exporting a factory `create<Folder>System(): System`.

### 4.2 Core types (`src/core/types.ts`)

```ts
import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'

export type Vec3 = { x: number; y: number; z: number }
export type Act = 1 | 2 | 3
export type SystemId = 'render' | 'world' | 'flora' | 'drift' | 'fauna' | 'hero' | 'gameplay' | 'audio'
export type RegionId = 'prairie' | 'laminaires' | 'pilier' | 'cheminee' | 'coques' | 'blanc' | 'bleu'
export type DayPhase = 'aube' | 'jour' | 'crepuscule' | 'nuit'
export type QualityLevel = 'low' | 'medium' | 'high'
export type HeroMode =
  | 'idle' | 'walk' | 'swim' | 'sink' | 'climb' | 'glide' | 'scrub' | 'ride' | 'exhausted' | 'cutscene'

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
  debug: DebugRegistry
}
```

**Every consumer must tolerate a missing service** (`ctx.services.world?.heightAt(x, z) ?? 0`):
folders are built in parallel and may be stubs.

### 4.3 Physics (`ctx.physics`)

```ts
export type ColliderKind =
  | 'terrain' | 'rock' | 'hull' | 'window' | 'kelp' | 'coral' | 'sonde' | 'shrine' | 'prop' | 'trigger' | 'fauna'
export interface ColliderTag { kind: ColliderKind; climbable: boolean; ownerId?: string }
export interface RayHit { point: Vec3; normal: Vec3; distance: number; tag?: ColliderTag; handle: number }

export interface PhysicsWorld {
  rapier: typeof RAPIER
  world: RAPIER.World
  tag(collider: RAPIER.Collider, tag: ColliderTag): void
  untag(collider: RAPIER.Collider): void
  tagOf(handle: number): ColliderTag | undefined
  raycast(origin: Vec3, dir: Vec3, maxDist: number, opts?: { excludeKinds?: ColliderKind[] }): RayHit | null
  groups: { TERRAIN: number; HERO: number; FAUNA: number; TRIGGER: number }
}
```

Fixed step 1/60 s with accumulator (max 4 substeps). Water is not simulated by Rapier: gravity is
zero in the Rapier world; each controller applies its own buoyancy/drag. The hero uses Rapier's
`KinematicCharacterController`. Rapier colliders have no user data: tags live in core's map, so
**call `untag` when removing a collider** or the map leaks and handles get reused with a stale tag.

### 4.4 Input (`ctx.input`)

```ts
export type ButtonAction =
  | 'up' | 'down' | 'sprint' | 'interact' | 'scrub' | 'map' | 'inventory' | 'pause' | 'whistle' | 'recenter'
export interface Input {
  move: { x: number; y: number }         // -1..1, y = forward
  look: { x: number; y: number }         // radians this frame, already scaled by sensitivity
  down(a: ButtonAction): boolean
  pressed(a: ButtonAction): boolean      // went down this frame
  released(a: ButtonAction): boolean
  device: 'kbm' | 'gamepad'
  pointerLocked: boolean
  keyLabel(a: ButtonAction): string      // "Z" on AZERTY, "W" on QWERTY
}
```

Keyboard bindings use `KeyboardEvent.code` (physical position), never `.key`: `KeyW` is Z on AZERTY,
so ZQSD and WASD both work with one binding. Labels come from `navigator.keyboard.getLayoutMap()`
when available.

### 4.5 Events (`ctx.bus`)

```ts
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
  'interact': { targetId: string; kind: 'npc' | 'sonde' | 'window' | 'item' | 'marmite' | 'shrine' | 'manta' }
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
}
export interface EventBus {
  on<K extends keyof GameEvents>(k: K, fn: (p: GameEvents[K]) => void): () => void
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void
}
```

### 4.6 State (`ctx.state`, saved)

```ts
export interface EnvState {
  current: Vec3             // global current m/s
  visibility: number        // diegetic meters shown on the board: 30, 60, 90, 999 ("beaucoup")
  bloom: number             // plankton 0..1
  jellyfish: number         // swarm chance/intensity 0..1
  rain: number              // 0..1, finale and post-game only
}
export interface GameState {
  version: 1
  act: Act
  quests: Record<string, string>          // questId -> current step id or 'done'
  flags: Record<string, boolean>
  time: { hours: number; day: number; scale: number }   // scale = game hours per real second (default 1/60)
  env: EnvState
  hero: {
    position: Vec3; velocity: Vec3; yaw: number; mode: HeroMode
    breath: number; breathMax: number; exhausted: boolean
    lestOn: boolean; lastSafe: Vec3
  }
  drift: { progress: number; position: Vec3; heading: number; velocity: Vec3; gate: string }
  chart: { sondes: string[]; reperes: string[]; pins: { x: number; z: number; icon: string }[] }
  inventory: { items: Record<string, number>; slots: number }
  shallows: string[]
  trouvailles: string[]
  windows: Record<string, number>         // windowId -> game-hours timestamp of last scrub
  settings: { quality: QualityLevel; invertY: boolean; sensitivity: number; volume: number; minimap: boolean }
  debug: { cameraLocked: boolean }
}
```

Writers: `time`, `debug`, `settings.quality` → core. `env`, `act`, `quests`, `flags`, `chart`,
`inventory`, `shallows`, `trouvailles`, `hero.breath*`/`exhausted` → gameplay. `hero` (rest) → hero.
`drift` → drift. `windows` → drift. Everybody may read everything.

Save: `localStorage` key `le-drift:save:v1`, every read/write in try/catch (private windows throw).
Autosave every 60 s real time and on `sonde:activated`, `shallow:completed`, `act:changed`,
`quest:step`. Migration by `version`.

### 4.7 Services

```ts
export interface CelMaterialParams {
  color: number; shadowColor?: number; rim?: number; emissive?: number
  map?: THREE.Texture; vertexColors?: boolean; caustics?: boolean; transparent?: boolean
  side?: THREE.Side; onShader?: (shader: THREE.WebGLProgramParametersWithUniforms) => void
}
export interface RenderService {
  cel(params: CelMaterialParams): THREE.Material   // every visible object uses this or patchWater
  patchWater(material: THREE.Material): void       // inject haze + caustics into a custom material
  readonly uniforms: {                              // shared, update by reference
    uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color }
    uCurrent: { value: THREE.Vector3 }; uHeroPos: { value: THREE.Vector3 }
    uHazeDist: { value: number }; uHazeMax: { value: number }
  }
  addRipple(x: number, z: number, strength: number): void
  draw(ctx: GameContext): void                      // called by core once per frame
  sunPhase(): DayPhase
  stats(): { drawCalls: number; triangles: number; ms: number }
}
export interface WorldService {
  heightAt(x: number, z: number): number            // pure, works for unloaded chunks
  normalAt(x: number, z: number): Vec3
  regionAt(x: number, z: number): RegionId
  currentAt(p: Vec3): Vec3                          // global env.current + lanes + vent updraft
  isLoaded(cx: number, cz: number): boolean
  safeSpawnNear(p: Vec3): Vec3
}
export interface FloraService {
  climbableKelpNear(p: Vec3, r: number): { base: Vec3; height: number }[]
  flatten(p: Vec3, r: number): void                 // hero/creatures bend grass
}
export interface DriftService {
  pose(): { position: Vec3; heading: number; velocity: Vec3 }
  lockPosition(): Vec3                              // respawn point for "Revenir à l'écluse"
  nearestWindow(p: Vec3, maxDist: number): { id: string; coat: number; position: Vec3; normal: Vec3 } | null
  scrub(windowId: string, amount: number): number   // returns remaining coat
  npcPosition(npcId: string): Vec3 | null
  playScene(id: 'petit-dejeuner' | 'rebord' | 'grand-pere-pluie'): Promise<void>
}
export interface FaunaService {
  choseDive(target: Vec3, close: boolean): Promise<void>
  spawnScripted(id: 'tortue-premiere' | 'raie-coincee' | 'baleine'): void
  manta(): { position: Vec3; mount(): void; dismount(): void } | null
  jellyfishNear(p: Vec3, r: number): number
  attractSchool(p: Vec3): void                      // food dropped
}
export interface HeroService {
  teleport(p: Vec3, yaw?: number): void
  setMode(m: HeroMode): void
  setCameraPose(pose: CameraPose | null): void      // null = return to gameplay camera
  headPosition(): Vec3
}
export interface GameplayService {
  breath: {
    spend(cost: number): boolean                    // one-shot (kick, climb-jump)
    drain(ratePerSec: number, dt: number): boolean  // continuous; false when exhausted
    canAct(): boolean
  }
  setAct(act: Act): void
  giveItem(id: string, n?: number): void
  hasItem(id: string): boolean
  setWeather(env: Partial<EnvState>): void
}
export interface AudioService { cue(c: MusicCue): void; sfx(id: string, at?: Vec3): void; unlock(): Promise<void> }
export type MusicCue = 'explore' | 'drift' | 'sonde' | 'shallow' | 'danger' | 'night' | 'wonder' | 'rain' | 'silence'

export interface CameraPose { position: Vec3; target: Vec3; fov?: number }
export interface DebugRegistry {
  registerPose(name: string, pose: { camera: CameraPose; hero?: { position: Vec3; yaw: number }; hour?: number }): void
}
```

If the hero runs without gameplay, `breath` is infinite. If gameplay runs without the hero, it reads
`state.hero` only.

### 4.8 Loop and registration (`src/main.ts`, core)

```ts
const systems: System[] = [
  createRenderSystem(), createWorldSystem(), createFloraSystem(), createDriftSystem(),
  createFaunaSystem(), createHeroSystem(), createGameplaySystem(), createAudioSystem(),
]
for (const s of systems) await s.init(ctx)   // in this order: render first (materials), world before flora
```

Per frame: `input.poll` → advance `state.time` → `system.update(dt)` in order → physics fixed steps
→ `system.lateUpdate(dt)` (camera here) → `services.render?.draw(ctx) ?? renderer.render(scene, camera)`.
`dt` clamped to 0.1 s. Paused: only render and gameplay (menus) update. Systems create materials
during `init`, never at import time (render may not be ready).

### 4.9 Performance budgets

Targets: **60 fps on a MacBook (M1/M2) at `high`**, **30 fps on a mid laptop at `low`**.

| | high | medium | low |
|---|---|---|---|
| Draw calls (total) | ≤ 250 | ≤ 180 | ≤ 120 |
| Triangles | ≤ 1.5 M | ≤ 900 k | ≤ 500 k |
| Pixel ratio cap | 2 | 1.5 | 1 |
| Chunk radius (full / LOD) | 3 / 6 | 2 / 5 | 2 / 4 |
| Grass blades near hero | 120 k | 60 k | 25 k |
| Fish | 2500 | 1200 | 500 |
| Sun shadow map | 2048, 120 m around hero | 1024 | none (blob) |
| God rays | world shafts + radial pass | world shafts | world shafts (fewer) |
| Outline / painterly pass | yes | outline only | none |

Per-folder draw-call budget at high: render post 8, world 50, flora 40, drift 60, fauna 30, hero 10,
gameplay (in-world markers) 15, spare 37. Instancing is mandatory for grass, kelp, coral, hulls,
windows, fish, jellyfish. No per-frame allocations in hot loops. Auto-quality: if the average frame
is > 24 ms over 5 s, drop one level once and toast « Qualité réduite ».

```ts
export interface QualitySettings {
  level: QualityLevel
  pixelRatio: number; chunkRadius: number; lodRadius: number; grassDensity: number; fishCount: number
  shadows: boolean; shadowMapSize: number; godRayPass: boolean; outline: boolean; painterly: boolean
  onChange(fn: (q: QualitySettings) => void): () => void
}
```

### 4.10 Per-folder definition of done

- **core**: boots a blank scene with a test cube when no other folder exists; `npm run typecheck` and `build` pass; `window.__game` works; FPS/draw-call overlay with `?debug`.
- **render**: cel material + haze + caustics + shafts + ceiling with Snell's window; sun cycle; vista pose looks like §5.4.
- **world**: 256 chunks streamed; heightfield colliders tagged; regions and landmarks in place; `heightAt` pure.
- **flora**: kelp forests and grass fields swaying with `uCurrent` and gust waves; grass bends around the hero.
- **hero**: Ilo modeled and animated, controller per §6/§3 tuning, BotW camera.
- **drift**: 400 hulls moving on the route, scrubbable windows with coat, NPCs, lock and rope.
- **fauna**: schools, jellyfish, whale, manta, turtle, La Chose dives twice a day.
- **gameplay**: the whole quest line playable start to end, HUD, chart, inventory, cooking, weather.
- **audio**: music cues, ambience, sfx, unlocks on first user gesture.

---

## 5. Art bible

### 5.1 Palette

| Token | Hex | Use |
|---|---|---|
| `abysse` | `#0E3B52` | Deepest haze, looking down |
| `profond` | `#1B5E73` | Lower haze |
| `milieu` | `#3A8C98` | Mid haze (horizontal view) |
| `clair` | `#7CC6BF` | Upper haze, shallows |
| `plafond` | `#CFEFE3` | Ceiling glow, Snell's window |
| `soleil-aube` | `#FFC98A` | Dawn sun, rim light |
| `soleil-jour` | `#FFF1C9` | Noon sun |
| `soleil-soir` | `#FF9A6B` | Dusk sun |
| `nuit` | `#12305A` | Night haze |
| `bio-1` / `bio-2` | `#6FF0E0` / `#B6A8FF` | Bioluminescence |
| `sable` / `sable-ombre` | `#E9DDB8` / `#B8A77E` | Floor |
| `roche` / `roche-ombre` | `#7D8A96` / `#45507A` | Rock lit / shadow (shadows go cool violet, never grey) |
| `laminaire` / `laminaire-ombre` | `#C79A3B` / `#7A6A2A` | Golden kelp |
| `herbe` / `herbe-ombre` | `#8FBF6A` / `#4F8A5A` | Sea grass |
| `corail-1/2/3` | `#F08A7E` / `#F7B267` / `#B784C9` | Coral accents |
| `coque-rouille` / `coque-laiton` / `coque-teal` | `#C46A4A` / `#D9B48F` / `#4F6D7A` | Drift hulls |
| `vitre-lumiere` | `#FFD9A0` | Lit windows |
| `revetement` | `#6F8F4E` | Coat on windows |
| `echarpe` | `#E8674A` | Hero scarf (complementary to the water) |
| `tunique` / `peau` / `lest` | `#2F4E7A` / `#C98E6B` / `#C9A54B` | Hero |
| `cheminee-coeur` / `cheminee-fumee` | `#FF8A4C` / `#5A4B5E` | Vent |
| `blanc` / `blanc-ombre` | `#F4F1E6` / `#DCEFF0` | Le Blanc |
| UI `texte` / `accent` / `souffle` / `souffle-bas` | `#F6F2E8` / `#E8674A` / `#9EE6C9` / `#F2C14E` | HUD |

### 5.2 Lighting and shading

- **Cel ramp**: 3 bands with soft steps (`smoothstep` width 0.08) on `N·L`, where L = `uSunDir`.
  Shadow band = albedo × `shadowColor` (default cool violet `#45507A` mixed 55 %), never black/grey.
- **Ambient**: hemisphere `plafond` (top) → `profond` (bottom), intensity 0.55; bounce from sand 0.15.
- **Rim light** (BotW signature): `pow(1 − N·V, 3) × sunColor × 0.6`, stronger on the side facing the sun.
- **Caustics**: animated cellular pattern projected along `uSunDir` on surfaces with `N.y > 0.3`,
  strength `0.35 × (1 − depth/120)`, drifting with `uCurrent`. Off at night.
- **God rays**: instanced additive quads from the ceiling, tilted by `uSunDir`, soft gradient, faded by
  distance, sway slowly; high quality adds a screen-space radial pass from the sun's projected point.
- **Outline**: thin depth/normal edge pass, tinted `profond` at 40 %, fades with distance (high/medium).
- **Painterly** (high): light Kuwahara (radius 2) on the far field only, plus a subtle paper grain.
- **Bloom**: soft, threshold high; lit windows, vent core, bioluminescence, Snell's window.
- **Sun cycle**: azimuth east→west across the day, elevation peak 70°, **clamped to ≥ 25°** for
  underwater light (refraction). Dawn 05-07, jour 07-17, crépuscule 17-19:30, nuit 19:30-05.
  Night: sun replaced by a cool moon `#9FB8E8` at 25 %, bioluminescence on.

### 5.3 Haze (atmospheric perspective)

In every material (via `cel`/`patchWater`):

```glsl
float d = length(vWorldPos - cameraPosition);
float hz = 1.0 - exp(-pow(d / uHazeDist, 1.35));
hz = min(hz, uHazeMax);                       // 0.93: far silhouettes never vanish (triangle rule)
vec3 v = normalize(vWorldPos - cameraPosition);
float up = clamp(v.y * 0.5 + 0.5, 0.0, 1.0);
float depth01 = clamp(vWorldPos.y / 120.0, 0.0, 1.0);
vec3 hazeCol = mix(uAbysse, uMilieu, smoothstep(0.0, 0.55, up));
hazeCol = mix(hazeCol, uClair, smoothstep(0.45, 1.0, 0.6 * up + 0.4 * depth01));
hazeCol += uSunColor * pow(max(dot(v, uSunDir), 0.0), 6.0) * 0.35;
color.rgb *= mix(vec3(1.0), vec3(0.88, 0.97, 1.0), hz);   // mild red absorption, NOT murk
color.rgb = mix(color.rgb, hazeCol, hz);
```

`uHazeDist` from diegetic visibility: 30 m → 170, 60 m → 280, 90 m → 400, « beaucoup » → 620.
Plankton bloom multiplies it by 0.6 and adds green-gold. Layering: near = full colour, mid = slightly
desaturated toward `milieu`, far = flat silhouettes in `clair`. That staircase is the money shot.

### 5.4 The reference vista (pose `vista`)

The first thing the player sees after the Sonde du Promontoire, and the title screen.

- Time **06:30**, day 1, act 1, visibility forecast « beaucoup » for this shot (`uHazeDist` 620).
- Hero at **(−260, heightAt, 760)**, on the Crête de l'Aube (ridge top y ≈ 38), facing yaw toward NE (~45°).
- Camera: 5 m behind and 1.2 m above the hero, slightly to the right, looking NE, FOV 55, slight downward tilt
  to the valley. Hero ≈ 1/8 of frame height, lower-left third, scarf trailing to the left in the current.
- Foreground: grass on the ridge swaying, a few coral tufts, caustics on sand.
- Midground: grass valley with gust waves, kelp clumps, a school of fish crossing.
- Background, left to right: **Le Pilier** (bearing ~20°, 800 m), **Le Drift** (bearing ~55°, ~420 m,
  warm lit windows, right-centre), **le panache** (bearing ~70°, ~1150 m, right edge, glowing base, to the ceiling).
- North horizon: the pale glow of Le Blanc.
- Sun from the east, low: warm shafts slant from upper right; warm rim on the hero's right edge.
- Ceiling visible at the top of the frame with Snell's window.

Other poses: `drift-vitre` (outside the big window at breakfast), `laminaires` (inside the forest at
noon), `cheminee` (at the vent base looking up the plume), `blanc` (Le Blanc at noon, ceiling close),
`plafond` (looking straight up at the ceiling), `heros` (close-up of Ilo, idle).

### 5.5 The hero: Ilo

- Young (~16), 1.65 m, stylised proportions (head 1/6 of height), dark hair in a knot, diving goggles on
  the forehead, sleeveless indigo tunic over a wetsuit, brass weight belt (the lest), soft boots.
- **Scarf**: coral, 1.6 m, verlet chain of 12 points, driven by velocity + `currentAt`; trails like Link's tunic.
- **Scrubber** on the back: long handle, round brass head with bristles; in hand when scrubbing.
- Built in code from primitives on a skinned skeleton (no downloaded model needed).
- Animations (procedural or keyframed in code), blended with a state machine:
  `idle` (breathing, scarf float), `walk`, `run`, `swim`, `swim-sprint`, `kick`, `sink`, `land`,
  `climb` (hand over hand), `climb-idle`, `climb-jump`, `glide` (arms up holding the voile),
  `scrub` (circular arm), `ride`, `exhausted` (slumped, slow), `talk`, `hand-on-ceiling` (ending).

### 5.6 Other models

- Drift hulls: rounded keel boats and barrel hulls, rusted plating, brass portholes, ropes between hulls,
  lanterns. Windows glow warm; you see people eating behind the big window.
- La Chose (a bird, never named): wings far too wide seen from below, layered feathers "like a book",
  one eye, comes through the ceiling with a burst of rings and bubbles.
- Kelp: golden ribbons with float bladders; grass: thick soft blades with lighter tips.

---

## 6. Controls

| Action | Clavier + souris | Manette |
|---|---|---|
| Se déplacer | ZQSD / WASD (same physical keys) | Stick gauche |
| Caméra | Souris (pointer lock on click) | Stick droit |
| Monter / sauter / s'agripper / ouvrir la voile | Espace | A (bas) |
| Descendre / lâcher | Ctrl | B (droite) |
| Sprint | Maj | LT |
| Interagir / parler | E | X (gauche) |
| Frotter | F | Y (haut) |
| Siffler la raie | R | Croix bas |
| Carte | M | Select |
| Inventaire | Tab | RB |
| Recentrer la caméra | clic milieu | R3 |
| Pause | Échap | Start |

Movement and tuning (`src/core/tuning.ts`, owned by core, numbers from here):

| | Value |
|---|---|
| Walk / run on the floor | 2.2 / 4.5 m/s |
| Swim / sprint swim | 3.0 / 6.0 m/s |
| Sink (lest on) terminal | 1.4 m/s |
| Kick impulse (Espace in water) | +4.5 m/s up, cost 0.06 |
| Descend (Ctrl) | 3.0 m/s |
| Climb speed | 1.4 m/s, cost 0.08/s moving, 0.02/s hanging |
| Climb jump | 2.5 m, cost 0.18 |
| Voile | 7 m/s forward, sink 0.5 m/s, cost 0.04/s; rides updrafts and lanes |
| Sprint | cost 0.12/s swim, 0.10/s floor |
| Souffle regen | 0.35/s after 0.8 s without spending; inside a bubble column 1.0/s |
| Exhausted | regen to full before acting again; speeds ×0.5; letting go of walls |
| Strong current | climbing cost ×1.5 and slow slip down (BotW rain) |
| Base souffle | 1.0 wheel; +0.2 per 4 nacres |

Auto-grab: moving into a climbable surface while not grounded grabs it; Espace also grabs.
Espace while sinking with the voile owned opens it; Espace again or Ctrl closes it.

Camera (BotW): orbit around a pivot 1.5 m above the hero; distance 6 m (4 when close to walls, 9 when
gliding or riding); pitch −70°…+80°; FOV 55 (62 when sprinting/gliding); collision by raycast with
1.5 m/s ease-out; no auto-recenter while the player moves the camera within 2 s; `recenter` puts it
behind the hero. Free look when climbing.

---

## 7. HUD and UI (French)

BotW minimal: by default the screen shows **nothing** but the world.

- **Roue de souffle** next to the hero's head (screen-projected), only while not full (fades 1 s after full).
  Segments per wheel, `souffle` colour, `souffle-bas` under 25 %, `accent` and pulsing when exhausted.
- **Bas droite** (toggle in settings, default on): small round mini-chart, time-of-day glyph,
  « Vis. 30 m », current arrow.
- **Invite** bottom centre when something is interactable: « [E] Parler », « [F] Frotter », « [E] Activer la sonde ».
- **Toast** top-left on quest step, fades after 4 s: « Nouvelle tâche : Frotter la grande vitre ».
- **Carte (M)**: grandfather's chart on paper, hand-drawn contour lines, the worn groove of the route,
  white where unmeasured; sondes animate line drawing; the Drift icon moves; « Revenir à l'écluse ».
- **Inventaire (Tab)**: tabs « Outils », « Ingrédients », « Plats », « Trouvailles ».
- **Dialogue**: bottom box, name above, text types in, « E » to continue.
- **Tableau des prévisions** (lock): « Visibilité 30 m · Courant du sud · Risque de méduses ».
- Pause: « Reprendre », « Revenir à l'écluse », « Réglages », « Commandes ».
- Font: system stack `ui-rounded, "SF Pro Rounded", system-ui, sans-serif` (no web font download).

All strings live in `src/gameplay/text/fr.ts` (except audio-free, scene-specific lines owned by drift
for ambient NPC chatter in `src/drift/text.ts`). No English in the UI.

---

## 8. Day, weather, wonders

- Time: 1 game hour = 60 real seconds (day = 24 min). Start: day 1, 06:00.
- **La Chose** dives at **07:00 and 17:30** each day (act 1: day 1 07:00 is scripted near the Drift).
  Rings on the ceiling (`ceiling:ripple`), a fish taken, music cue `wonder`.
- Forecast changes every morning at 06:00 (gameplay): visibility by act (act 1: 30; act 2: 60 → 90 →
  « beaucoup » as the Drift goes north; act 3: « beaucoup »), current direction, jellyfish risk, bloom.
- Jellyfish swarms: 20 % of days in act 2, mostly at night, attracted by the lantern.
- Nuit de plancton every 5th night.
- Whale passes every ~2 game days in the south and centre; song heard far away.
- Rain: act 3 from `a3-pluie`, then post-game 15 % of days.

## 9. Music and sound

Generative WebAudio, no samples needed. Mostly silence; short piano-like FM phrases (pentatonic,
D major / B minor), soft pads under water, whale song. `AudioContext` can only start after a user
gesture: unlock on the first click/key.

| Cue | When |
|---|---|
| `explore` | Sparse phrases every 20-60 s, silence in between |
| `drift` | Near the Drift: warm tune, muffled clapping game melody |
| `sonde` | Stinger on activation, then vista swell |
| `shallow` | Inside a haut-fond: minimal, rhythmic, curious |
| `danger` | Jellyfish nearby |
| `night` / plankton | Celesta and glass |
| `wonder` | La Chose |
| `rain` | Finale: the clapping game melody, slow, full |

SFX: bubbles, kick, scrub (squeak on glass), lock, rope creak, hull groan, fish flutter, vent rumble,
ceiling rings (soft drip), rain on the surface heard from below, footsteps on sand.

## 10. Debug hooks (core, `window.__game`)

```ts
interface DebugApi {
  state: GameState
  ready: Promise<void>
  teleport(x: number, y: number, z: number): void
  setAct(n: Act): void                      // consistent state, see §3
  setTime(h: number): void
  giveItem(id: string, n?: number): void
  setWeather(env: Partial<EnvState>): void
  setQuality(q: QualityLevel): void
  pause(p: boolean): void
  step(frames: number): Promise<void>       // advance N frames while paused
  screenshotPose(name: string): Promise<string>   // PNG data URL
  poses(): string[]
  stats(): { fps: number; drawCalls: number; triangles: number }
}
```

`screenshotPose` sets hour, hero and camera from the registry (`state.debug.cameraLocked = true`, the
hero's camera must respect it), waits 2 frames for streaming/shaders, renders and reads the canvas in the
same tick as the render (the default drawing buffer is cleared after compositing). Poses predefined in
core: `vista`, `drift-vitre`, `laminaires`, `cheminee`, `blanc`, `plafond`, `heros`; other folders may
`registerPose` more. URL params: `?debug` (overlay), `?pose=vista`, `?act=2`, `?t=17.5`, `?q=low`,
`?nosave`.

## 11. Working rules for builders

- Only your folder. `npm run typecheck` must pass before you commit.
- Commits: Conventional Commits with the folder as scope (`feat(flora): …`), no AI attribution trailer.
  Stage only your own paths. If `.git/index.lock` exists, wait a few seconds and retry.
- Never leave a dev server, vite or a browser running when you finish.
- Downloaded assets: CC0 only, one line in `assets/CREDITS.md`.
- When this bible needs a change, say so in your final report; do not silently diverge.
