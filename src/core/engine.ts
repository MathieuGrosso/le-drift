import * as THREE from 'three'
import { createEventBus } from './bus'
import { createInput } from './input'
import { createPhysics } from './physics'
import { createPoseRegistry, registerCorePoses } from './poses'
import { createQuality, isQualityLevel, QUALITY_ORDER } from './quality'
import { seededRng } from './rng'
import { createSaveStore } from './save'
import { createInitialState, phaseAt } from './state'
import { AUTOSAVE_SECONDS, AUTO_QUALITY, PHYSICS } from './tuning'
import { PLACES, ROOMS } from './layout'
import { createModeController } from './mode'
import type {
  Act, CameraPose, DebugApi, DebugPose, EnvState, GameContext, GameState, PlaceId, QualityLevel, RoomId, System,
} from './types'

const LOADING_LABELS: Record<System['id'], string> = {
  render: 'La lumière descend…',
  world: 'Le fond se dessine…',
  flora: 'Les herbes poussent…',
  drift: 'Le Drift avance…',
  fauna: 'Les poissons arrivent…',
  hero: 'Ilo se réveille…',
  gameplay: 'Grand-père sort la carte…',
  audio: 'La mer se met à chanter…',
}

export interface BootOptions {
  systems: System[]
}

interface BootUi {
  progress(done: number, total: number, label: string): void
  ready(onStart: () => void): void
  error(err: unknown): void
}

function bootUi(): BootUi {
  const root = document.getElementById('loading')
  const bar = document.getElementById('loading-bar')
  const label = document.getElementById('loading-label')
  const start = document.getElementById('loading-start')
  return {
    progress(done, total, text) {
      if (bar) bar.style.width = `${Math.round((done / total) * 100)}%`
      if (label) label.textContent = text
    },
    ready(onStart) {
      if (label) label.textContent = ''
      root?.classList.add('ready')
      if (!root || !start) {
        onStart()
        return
      }
      const go = () => {
        root.removeEventListener('click', go)
        window.removeEventListener('keydown', go)
        root.classList.add('gone')
        onStart()
      }
      root.addEventListener('click', go)
      window.addEventListener('keydown', go)
    },
    error(err) {
      console.error(err)
      if (label) label.textContent = 'Impossible de lancer le jeu. Recharge la page.'
      root?.classList.add('failed')
    },
  }
}

function makeToast(uiRoot: HTMLElement): (text: string) => void {
  const el = document.createElement('div')
  el.className = 'core-toast'
  uiRoot.appendChild(el)
  let timer = 0
  return (text) => {
    el.textContent = text
    el.classList.add('show')
    window.clearTimeout(timer)
    timer = window.setTimeout(() => el.classList.remove('show'), 3000)
  }
}

function applyCameraPose(camera: THREE.PerspectiveCamera, pose: CameraPose): void {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z)
  if (pose.fov !== undefined && pose.fov !== camera.fov) {
    camera.fov = pose.fov
    camera.updateProjectionMatrix()
  }
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
}

export async function boot({ systems }: BootOptions): Promise<void> {
  const ui = bootUi()
  const params = new URLSearchParams(location.search)
  const debugMode = params.has('debug')
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  const uiRoot = document.getElementById('ui')
  if (!canvas || !uiRoot) throw new Error('index.html is missing #game or #ui')

  let readyResolve: () => void = () => undefined
  const ready = new Promise<void>((r) => {
    readyResolve = r
  })

  try {
    const total = systems.length + 2
    ui.progress(0, total, 'Mise en eau…')

    const qParam = params.get('q')
    const bus = createEventBus()
    let state: GameState = createInitialState()
    const save = createSaveStore(() => state, bus, !params.has('nosave'))
    const loaded = save.load()
    if (loaded) state = loaded
    if (isQualityLevel(qParam)) state.settings.quality = qParam
    const quality = createQuality(state.settings.quality)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.info.autoReset = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000)
    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.settings.pixelRatio))
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)
    quality.settings.onChange(resize)

    ui.progress(1, total, 'Réveil des courants…')
    const physicsRt = await createPhysics()
    const inputRt = createInput(canvas, () => state)
    const poses = createPoseRegistry()
    registerCorePoses(poses)

    const ctx: GameContext = {
      scene, camera, renderer, canvas, uiRoot,
      physics: physicsRt.physics,
      input: inputRt.input,
      bus,
      get state() {
        return state
      },
      set state(s: GameState) {
        state = s
      },
      save,
      quality: quality.settings,
      services: { debug: poses },
      clock: { elapsed: 0, frame: 0, paused: false },
      rng: seededRng,
    }

    const toast = makeToast(uiRoot)
    const modes = createModeController(ctx)
    const setQuality = (q: QualityLevel) => {
      state.settings.quality = q
      quality.set(q)
    }

    ui.progress(2, total, 'Chargement…')
    for (let i = 0; i < systems.length; i++) {
      const s = systems[i]!
      ui.progress(2 + i, total, LOADING_LABELS[s.id])
      try {
        await s.init(ctx)
      } catch (err) {
        console.error(`[core] init ${s.id} failed`, err)
      }
    }
    ui.progress(total, total, '')

    if (scene.children.length === 0) {
      scene.background = new THREE.Color(0x3a8c98)
      scene.add(new THREE.HemisphereLight(0xcfefe3, 0x1b5e73, 1.2))
      const sun = new THREE.DirectionalLight(0xfff1c9, 1.5)
      sun.position.set(30, 60, 20)
      scene.add(sun)
      const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xe8674a }))
      cube.name = 'core-test-cube'
      cube.position.set(0, 1, 0)
      scene.add(cube)
      camera.position.set(4, 3, 6)
      camera.lookAt(0, 1, 0)
    }

    // ---- loop ----
    let lockedPose: CameraPose | null = null
    let pendingSteps = 0
    const stepWaiters: { frame: number; resolve: () => void }[] = []
    const afterDraw: (() => void)[] = []
    let lastHourInt = Math.floor(state.time.hours)
    let lastPhase = phaseAt(state.time.hours)
    let autosaveTimer = 0
    let fps = 60
    let slowTimer = 0
    let slowFrames = 0
    let slowSum = 0
    let autoDropped = false
    let menuOpen = false

    const setPaused = (p: boolean) => {
      if (ctx.clock.paused === p) return
      ctx.clock.paused = p
      bus.emit('game:paused', { paused: p })
    }
    bus.on('game:paused', ({ paused }) => {
      ctx.clock.paused = paused
    })
    bus.on('ui:menu', ({ open }) => {
      menuOpen = open !== null
      inputRt.setMenuOpen(menuOpen)
    })
    for (const k of ['sonde:activated', 'shallow:completed', 'act:changed', 'quest:step', 'sleep:done', 'sortie:end'] as const) {
      bus.on(k, () => {
        save.write()
      })
    }

    const advanceTime = (dt: number) => {
      const t = state.time
      t.hours += dt * t.scale
      while (t.hours >= 24) {
        t.hours -= 24
        t.day += 1
        lastHourInt = -1
      }
      const hi = Math.floor(t.hours)
      if (hi !== lastHourInt) {
        lastHourInt = hi
        bus.emit('time:hour', { hour: hi, day: t.day })
      }
      const ph = phaseAt(t.hours)
      if (ph !== lastPhase) {
        lastPhase = ph
        bus.emit('time:phase', { phase: ph })
      }
    }

    const overlay = debugMode ? document.createElement('div') : null
    if (overlay) {
      overlay.className = 'core-debug'
      uiRoot.appendChild(overlay)
    }

    const stats = () => {
      const r = ctx.services.render?.stats()
      return {
        fps: Math.round(fps),
        drawCalls: r?.drawCalls ?? renderer.info.render.calls,
        triangles: r?.triangles ?? renderer.info.render.triangles,
      }
    }

    let last = performance.now()
    let unloading = false
    const frame = (now: number) => {
      if (unloading) return
      requestAnimationFrame(frame)
      const rawDt = Math.max(0, (now - last) / 1000)
      last = now
      const stepping = ctx.clock.paused && pendingSteps > 0
      const dt = stepping ? PHYSICS.step : Math.min(rawDt, PHYSICS.maxFrameDt)
      if (stepping) pendingSteps--
      const paused = ctx.clock.paused && !stepping
      fps += (1 / Math.max(rawDt, 1e-4) - fps) * 0.05

      inputRt.poll(dt)
      if (!paused) {
        ctx.clock.elapsed += dt
        advanceTime(dt)
      }
      for (const s of systems) {
        if (paused && s.id !== 'render' && s.id !== 'gameplay') continue
        try {
          s.update(dt, ctx)
        } catch (err) {
          console.error(`[core] update ${s.id}`, err)
        }
      }
      if (!paused) physicsRt.step(dt)
      for (const s of systems) {
        if (!s.lateUpdate || (paused && s.id !== 'render' && s.id !== 'gameplay')) continue
        try {
          s.lateUpdate(dt, ctx)
        } catch (err) {
          console.error(`[core] lateUpdate ${s.id}`, err)
        }
      }
      if (state.debug.cameraLocked && lockedPose) applyCameraPose(camera, lockedPose)

      renderer.info.reset()
      const render = ctx.services.render
      if (render) render.draw(ctx)
      else renderer.render(scene, camera)
      while (afterDraw.length > 0) afterDraw.shift()!()

      ctx.clock.frame++
      for (let i = stepWaiters.length - 1; i >= 0; i--) {
        const w = stepWaiters[i]!
        if (ctx.clock.frame >= w.frame) {
          stepWaiters.splice(i, 1)
          w.resolve()
        }
      }

      autosaveTimer += rawDt
      if (autosaveTimer >= AUTOSAVE_SECONDS) {
        autosaveTimer = 0
        save.write()
      }

      if (!autoDropped && !paused && document.visibilityState === 'visible') {
        slowTimer += rawDt
        slowFrames++
        slowSum += rawDt * 1000
        if (slowTimer >= AUTO_QUALITY.windowSeconds) {
          if (slowSum / slowFrames > AUTO_QUALITY.frameMs) {
            const idx = QUALITY_ORDER.indexOf(quality.settings.level)
            if (idx > 0) {
              setQuality(QUALITY_ORDER[idx - 1]!)
              toast('Qualité réduite')
            }
            autoDropped = true
          }
          slowTimer = slowFrames = slowSum = 0
        }
      }

      if (overlay && ctx.clock.frame % 15 === 0) {
        const s = stats()
        const ms = ctx.services.render?.stats().ms
        overlay.textContent =
          `${s.fps} ips · ${s.drawCalls} appels · ${(s.triangles / 1000).toFixed(0)} k tri` +
          (ms !== undefined ? ` · ${ms.toFixed(1)} ms` : '') +
          ` · ${quality.settings.level} · j${state.time.day} ${state.time.hours.toFixed(2)} h`
      }
    }

    const waitFrames = (n: number) =>
      new Promise<void>((resolve) => stepWaiters.push({ frame: ctx.clock.frame + n, resolve }))

    const applyPose = (pose: DebugPose) => {
      if (pose.hour !== undefined) api.setTime(pose.hour)
      if (pose.place) modes.goto(pose.place)
      else if (pose.hero) {
        const { position, yaw } = pose.hero
        if (ctx.services.hero) ctx.services.hero.teleport(position, yaw)
        else {
          state.hero.position = { ...position }
          state.hero.yaw = yaw
        }
      }
      lockedPose = pose.camera
      state.debug.cameraLocked = true
      applyCameraPose(camera, pose.camera)
    }

    const api: DebugApi = {
      get state() {
        return state
      },
      ready,
      ctx,
      teleport(xOrPlace, y = 0, z = 0) {
        lockedPose = null
        state.debug.cameraLocked = false
        if (typeof xOrPlace === 'string') {
          if (!modes.goto(xOrPlace)) console.warn(`[core] lieu inconnu : ${xOrPlace}`, Object.keys(PLACES))
          return
        }
        const p = { x: xOrPlace, y, z }
        if (ctx.services.hero) ctx.services.hero.teleport(p)
        else state.hero.position = p
      },
      goto(place: PlaceId) {
        lockedPose = null
        return modes.goto(place)
      },
      places: () => Object.keys(PLACES),
      mode: () => state.mode,
      startSortie: (lockId) => modes.startSortie(lockId),
      endSortie: () => modes.endSortie(),
      setAct(n: Act) {
        if (ctx.services.gameplay) ctx.services.gameplay.setAct(n)
        else {
          state.act = n
          bus.emit('act:changed', { act: n })
        }
      },
      setTime(h) {
        state.time.hours = ((h % 24) + 24) % 24
        lastHourInt = Math.floor(state.time.hours)
        bus.emit('time:hour', { hour: lastHourInt, day: state.time.day })
        const ph = phaseAt(state.time.hours)
        if (ph !== lastPhase) {
          lastPhase = ph
          bus.emit('time:phase', { phase: ph })
        }
      },
      giveItem(id, n = 1) {
        if (ctx.services.gameplay) ctx.services.gameplay.giveItem(id, n)
        else {
          state.inventory.items[id] = (state.inventory.items[id] ?? 0) + n
          bus.emit('item:gained', { itemId: id, count: n })
        }
      },
      setWeather(env: Partial<EnvState>) {
        if (ctx.services.gameplay) ctx.services.gameplay.setWeather(env)
        else {
          Object.assign(state.env, env)
          bus.emit('weather:changed', { env: state.env })
        }
      },
      setQuality,
      pause: setPaused,
      async step(frames) {
        if (!ctx.clock.paused) return waitFrames(frames)
        pendingSteps += frames
        return waitFrames(frames)
      },
      async screenshotPose(name) {
        const pose = poses.resolve(name, ctx)
        if (!pose) throw new Error(`pose inconnue : ${name}`)
        applyPose(pose)
        bus.emit('debug:pose', { name })
        if (ctx.clock.paused) pendingSteps += 2
        await waitFrames(2)
        const again = poses.resolve(name, ctx)
        if (again) applyPose(again)
        return new Promise<string>((resolve) => {
          afterDraw.push(() => resolve(canvas.toDataURL('image/png')))
        })
      },
      poses: () => poses.names(),
      stats,
      enterRoom(room: RoomId) {
        state.hero.medium = 'air'
        state.hero.room = room
        state.hero.wetness = 0
        state.debug.cameraLocked = false
        lockedPose = null
        modes.set('inside', null)
        const drift = ctx.services.drift
        if (!drift) return
        const spawn = drift.roomSpawn(room)
        state.hero.localPosition = drift.toLocal(spawn.position)
        if (ctx.services.hero) ctx.services.hero.teleport(spawn.position, spawn.yaw)
        else {
          state.hero.position = { ...spawn.position }
          state.hero.yaw = spawn.yaw
        }
      },
    }
    ;(window as unknown as { __game: DebugApi }).__game = api

    const actParam = Number(params.get('act'))
    if (actParam === 1 || actParam === 2 || actParam === 3) api.setAct(actParam)
    const tParam = params.get('t')
    if (tParam !== null && Number.isFinite(Number(tParam))) api.setTime(Number(tParam))
    const roomParam = params.get('room') ?? params.get('cell')
    if (roomParam && (ROOMS as readonly string[]).includes(roomParam)) api.enterRoom(roomParam as RoomId)
    const placeParam = params.get('place') ?? (params.get('mode') === 'sortie' ? 'sortie' : null)
      ?? (params.get('district') ? Object.entries(PLACES).find(([, p]) => p.district === params.get('district'))?.[0] ?? null : null)
    if (placeParam) api.goto(placeParam)
    if (!loaded && !roomParam && !placeParam) api.enterRoom('cabine')
    const poseParam = params.get('pose')
    if (poseParam) {
      const pose = poses.resolve(poseParam, ctx)
      if (pose) applyPose(pose)
    }

    requestAnimationFrame((t) => {
      last = t
      frame(t)
    })

    bus.emit('game:ready', {})
    readyResolve()

    ui.ready(() => {
      inputRt.setEnabled(true)
      inputRt.requestPointerLock()
      ctx.services.audio?.unlock().catch(() => undefined)
    })

    window.addEventListener('beforeunload', () => {
      unloading = true
      save.write()
      modes.dispose()
      for (const s of [...systems].reverse()) {
        try {
          s.dispose()
        } catch {
          /* page is going away */
        }
      }
      inputRt.dispose()
    })
  } catch (err) {
    ui.error(err)
    throw err
  }
}
