export const SPEECH_BUBBLE = 'speech-bubble'

export interface ScreenBox { l: number; r: number; t: number; b: number }

export function shownBubbles(root: HTMLElement, origin: HTMLElement, except: HTMLElement): ScreenBox[] {
  const o = origin.getBoundingClientRect()
  return [...root.querySelectorAll<HTMLElement>(`.${SPEECH_BUBBLE}`)]
    .filter((el) => el !== except && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.2)
    .map((el) => el.getBoundingClientRect())
    .map((r) => ({ l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top }))
}
