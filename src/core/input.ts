import { INPUT } from './tuning'
import type { ButtonAction, GameState, Input } from './types'

const ACTIONS: readonly ButtonAction[] = [
  'up', 'down', 'sprint', 'interact', 'scrub', 'map', 'inventory', 'pause', 'whistle', 'recenter',
]

const KEY_BINDINGS: Record<ButtonAction, readonly string[]> = {
  up: ['Space'],
  down: ['ControlLeft', 'ControlRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  scrub: ['KeyF'],
  map: ['KeyM'],
  inventory: ['Tab'],
  pause: ['Escape'],
  whistle: ['KeyR'],
  recenter: [],
}

const MOUSE_BINDINGS: Partial<Record<ButtonAction, number>> = { recenter: 1 }

// Standard Gamepad mapping indices.
const PAD_BINDINGS: Record<ButtonAction, readonly number[]> = {
  up: [0],
  down: [1],
  interact: [2],
  scrub: [3],
  sprint: [6],
  inventory: [5],
  map: [8],
  pause: [9],
  recenter: [11],
  whistle: [13],
}

const PAD_LABELS: Record<ButtonAction, string> = {
  up: 'A', down: 'B', interact: 'X', scrub: 'Y', sprint: 'LT', inventory: 'RB',
  map: 'Select', pause: 'Start', recenter: 'R3', whistle: 'Croix bas',
}

const FIXED_KEY_LABELS: Record<string, string> = {
  Space: 'Espace', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', ShiftLeft: 'Maj', ShiftRight: 'Maj',
  Tab: 'Tab', Escape: 'Échap',
}

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
}

const BLOCKED_DEFAULTS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export interface InputRuntime {
  input: Input
  poll(dt: number): void
  setEnabled(enabled: boolean): void
  requestPointerLock(): void
  setMenuOpen(open: boolean): void
  dispose(): void
}

function deadzone(v: number): number {
  const a = Math.abs(v)
  if (a < INPUT.deadzone) return 0
  return Math.sign(v) * (a - INPUT.deadzone) / (1 - INPUT.deadzone)
}

export function createInput(canvas: HTMLCanvasElement, getState: () => GameState): InputRuntime {
  const keys = new Set<string>()
  const mouseButtons = new Set<number>()
  const latchedPresses = new Set<ButtonAction>()
  let prevDown = new Set<ButtonAction>()
  let curDown = new Set<ButtonAction>()
  let latchedPressesFrame = new Set<ButtonAction>()
  let mouseDX = 0
  let mouseDY = 0
  let enabled = false
  let menuOpen = false
  let escapeSeen = false
  let layoutMap: Map<string, string> | null = null

  const input: Input = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    down: (a) => curDown.has(a),
    pressed: (a) => (curDown.has(a) && !prevDown.has(a)) || latchedPressesFrame.has(a),
    released: (a) => !curDown.has(a) && prevDown.has(a),
    device: 'kbm',
    pointerLocked: false,
    keyLabel(a) {
      if (input.device === 'gamepad') return PAD_LABELS[a]
      if (a === 'recenter') return 'Clic milieu'
      const code = KEY_BINDINGS[a][0]
      if (!code) return ''
      const fixed = FIXED_KEY_LABELS[code]
      if (fixed) return fixed
      const mapped = layoutMap?.get(code)
      if (mapped) return mapped.toUpperCase()
      return code.startsWith('Key') ? code.slice(3) : code
    },
  }

  const nav = navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }
  nav.keyboard?.getLayoutMap?.().then((m) => {
    layoutMap = m
  }).catch(() => undefined)

  const actionForKey = (code: string): ButtonAction | undefined =>
    ACTIONS.find((a) => KEY_BINDINGS[a].includes(code))

  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return
    input.device = 'kbm'
    if (BLOCKED_DEFAULTS.has(e.code) || (input.pointerLocked && actionForKey(e.code))) e.preventDefault()
    if (e.code === 'Escape') escapeSeen = true
    if (!keys.has(e.code)) {
      const a = actionForKey(e.code)
      if (a) latchedPresses.add(a)
    }
    keys.add(e.code)
  }
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!enabled || !input.pointerLocked) return
    input.device = 'kbm'
    mouseDX += e.movementX
    mouseDY += e.movementY
  }
  const onMouseDown = (e: MouseEvent) => {
    if (!enabled) return
    if (e.button === 1) e.preventDefault()
    mouseButtons.add(e.button)
    for (const a of ACTIONS) if (MOUSE_BINDINGS[a] === e.button) latchedPresses.add(a)
  }
  const onMouseUp = (e: MouseEvent) => {
    mouseButtons.delete(e.button)
  }
  const onBlur = () => {
    keys.clear()
    mouseButtons.clear()
  }
  const onCanvasClick = () => {
    if (enabled && !menuOpen && !input.pointerLocked) runtime.requestPointerLock()
  }
  const onLockChange = () => {
    const locked = document.pointerLockElement === canvas
    if (input.pointerLocked && !locked && enabled && !menuOpen && !escapeSeen) latchedPresses.add('pause')
    escapeSeen = false
    input.pointerLocked = locked
  }
  const onContextMenu = (e: Event) => e.preventDefault()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('blur', onBlur)
  canvas.addEventListener('click', onCanvasClick)
  canvas.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('pointerlockchange', onLockChange)

  const keyAxis = (pos: readonly string[], neg: readonly string[]) =>
    (pos.some((k) => keys.has(k)) ? 1 : 0) - (neg.some((k) => keys.has(k)) ? 1 : 0)

  const runtime: InputRuntime = {
    input,
    poll(dt) {
      prevDown = curDown
      curDown = new Set()
      latchedPressesFrame = new Set(latchedPresses)
      latchedPresses.clear()
      const settings = getState().settings
      const invert = settings.invertY ? -1 : 1

      let mx = keyAxis(MOVE_KEYS.right, MOVE_KEYS.left)
      let my = keyAxis(MOVE_KEYS.forward, MOVE_KEYS.back)
      let lx = mouseDX * INPUT.mouseRadiansPerPixel * settings.sensitivity
      let ly = mouseDY * INPUT.mouseRadiansPerPixel * settings.sensitivity * invert
      mouseDX = 0
      mouseDY = 0

      if (enabled) {
        for (const a of ACTIONS) {
          if (KEY_BINDINGS[a].some((k) => keys.has(k))) curDown.add(a)
          const mb = MOUSE_BINDINGS[a]
          if (mb !== undefined && mouseButtons.has(mb)) curDown.add(a)
        }
        const pads = navigator.getGamepads?.() ?? []
        for (const pad of pads) {
          if (!pad || !pad.connected) continue
          const ax = deadzone(pad.axes[0] ?? 0)
          const ay = deadzone(pad.axes[1] ?? 0)
          const rx = deadzone(pad.axes[2] ?? 0)
          const ry = deadzone(pad.axes[3] ?? 0)
          let used = ax !== 0 || ay !== 0 || rx !== 0 || ry !== 0
          for (const a of ACTIONS) {
            if (PAD_BINDINGS[a].some((i) => pad.buttons[i]?.pressed)) {
              curDown.add(a)
              used = true
            }
          }
          if (used) input.device = 'gamepad'
          mx += ax
          my -= ay
          const rate = INPUT.stickRadiansPerSecond * settings.sensitivity * dt
          lx += rx * rate
          ly += ry * rate * invert
          break
        }
      } else {
        mx = my = lx = ly = 0
        latchedPressesFrame.clear()
      }
      const m = Math.hypot(mx, my)
      input.move.x = m > 1 ? mx / m : mx
      input.move.y = m > 1 ? my / m : my
      input.look.x = lx
      input.look.y = ly
    },
    setEnabled(v) {
      enabled = v
    },
    requestPointerLock() {
      try {
        const p = canvas.requestPointerLock() as unknown
        if (p instanceof Promise) p.catch(() => undefined)
      } catch {
        /* not allowed outside a user gesture */
      }
    },
    setMenuOpen(open) {
      menuOpen = open
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('click', onCanvasClick)
      canvas.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('pointerlockchange', onLockChange)
    },
  }
  return runtime
}
