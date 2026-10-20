import { AVATAR_COLORS, LIMITS, sanitizeText, type Profile } from '../shared/protocol'
import { el, hexColor } from './style'
import { TEXT } from './text'

/**
 * First join only: a name and a colour. Resolves null when the player prefers to stay alone.
 * Mounted on its own layer above the title screen, which otherwise takes the clicks and starts the game.
 */
export function askProfile(previous: Profile | null): Promise<Profile | null> {
  return new Promise((resolve) => {
    const form = el('form', 'net-welcome net-panel')
    const input = el('input')
    input.maxLength = LIMITS.nameMax
    input.value = previous?.name ?? ''
    input.placeholder = 'Ilo'
    let color: number = previous?.color ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!
    const swatches = el('div', 'net-swatches')
    const buttons = AVATAR_COLORS.map((c) => {
      const b = el('button')
      b.type = 'button'
      b.style.background = hexColor(c)
      b.addEventListener('click', () => {
        color = c
        buttons.forEach((x, i) => x.classList.toggle('on', AVATAR_COLORS[i] === c))
      })
      b.classList.toggle('on', c === color)
      return b
    })
    swatches.append(...buttons)
    const go = el('button', '', TEXT.welcomeGo)
    go.type = 'submit'
    const solo = el('button', 'ghost', TEXT.welcomeSolo)
    solo.type = 'button'
    const row = el('div', 'row')
    row.append(solo, go)
    form.append(el('h2', '', TEXT.welcomeTitle), input, el('div', '', TEXT.welcomeColour), swatches, row)
    for (const type of ['keydown', 'keyup', 'mousedown', 'click'] as const) form.addEventListener(type, (e) => e.stopPropagation())
    const layer = el('div', 'net-ui')
    layer.append(form)
    const finish = (p: Profile | null) => {
      layer.remove()
      resolve(p)
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const name = sanitizeText(input.value, LIMITS.nameMax)
      if (name.length < LIMITS.nameMin) {
        input.focus()
        return
      }
      finish({ name, color })
    })
    solo.addEventListener('click', () => finish(null))
    document.body.appendChild(layer)
    if (document.pointerLockElement) document.exitPointerLock()
    input.focus()
  })
}
