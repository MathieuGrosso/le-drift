export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text !== undefined) el.textContent = text
  if (parent) parent.appendChild(el)
  return el
}

export function button(label: string, onClick: () => void, parent?: HTMLElement, cls = 'gp-btn'): HTMLButtonElement {
  const b = h('button', cls, label, parent)
  b.type = 'button'
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return b
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  if (parent) parent.appendChild(el)
  return el
}

/** Writes `text` into `el`, turning each `[key]` into a key pill. */
export function keyHint(el: HTMLElement, text: string): void {
  el.textContent = ''
  text.split(/\[([^\]]+)\]/).forEach((part, i) => {
    if (i % 2 === 1) h('span', 'gp-key', part, el)
    else if (part) el.appendChild(document.createTextNode(part))
  })
}
