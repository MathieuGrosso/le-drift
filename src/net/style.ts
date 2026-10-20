const CSS = `
.net-ui { position: fixed; inset: 0; pointer-events: none; font: 14px/1.35 ui-rounded, "SF Pro Rounded", system-ui, sans-serif; color: #3e3a5a; z-index: 30; }
.net-panel { background: rgba(246, 242, 232, 0.9); border-radius: 14px; box-shadow: 0 4px 14px rgba(14, 59, 82, 0.25); }
.net-tags { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.net-tag { position: absolute; transform: translate(-50%, -100%); padding: 2px 8px; border-radius: 10px; background: rgba(30, 40, 60, 0.55); color: #fff6e6; font-size: 12px; white-space: nowrap; transition: opacity 0.3s; }
.net-tag i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
.net-chat { position: absolute; left: 16px; bottom: 16px; width: min(360px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 4px; }
.net-chat-log { display: flex; flex-direction: column; gap: 3px; }
.net-chat-line { padding: 4px 10px; border-radius: 10px; background: rgba(30, 40, 60, 0.5); color: #fff6e6; transition: opacity 0.6s; overflow-wrap: anywhere; }
.net-chat-line b { margin-right: 6px; }
.net-chat-line.old { opacity: 0; }
.net-chat input { pointer-events: auto; border: 0; outline: 0; padding: 8px 12px; border-radius: 12px; font: inherit; background: rgba(246, 242, 232, 0.95); color: #3e3a5a; display: none; }
.net-chat.open input { display: block; }
.net-chat.open .net-chat-line.old { opacity: 0.85; }
.net-hint { font-size: 12px; color: rgba(255, 246, 230, 0.75); text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
.net-presence { position: absolute; right: 16px; top: 76px; padding: 8px 12px; min-width: 150px; max-width: 240px; pointer-events: auto; }
.net-presence h3 { margin: 0 0 4px; font-size: 13px; font-weight: 700; }
.net-presence ul { list-style: none; margin: 0; padding: 0; }
.net-presence li { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 1px 0; }
.net-presence li i { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.net-presence li span { opacity: 0.65; margin-left: auto; padding-left: 8px; }
.net-presence li.absent { opacity: 0.5; }
.net-presence .net-note { margin: 2px 0 8px; font-size: 12px; line-height: 1.35; }
.net-presence button, .net-welcome button { font: inherit; border: 0; border-radius: 10px; padding: 6px 12px; cursor: pointer; background: #d8644e; color: #fff6e6; }
.net-presence button.ghost, .net-welcome button.ghost { background: transparent; color: #3e3a5a; }
.net-wheel { position: absolute; left: 50%; top: 50%; width: 300px; height: 300px; margin: -150px 0 0 -150px; display: none; pointer-events: auto; }
.net-wheel.open { display: block; }
.net-wheel button { position: absolute; width: 84px; margin: -16px 0 0 -42px; padding: 6px 0; border: 0; border-radius: 12px; font: inherit; cursor: pointer; background: rgba(246, 242, 232, 0.92); color: #3e3a5a; box-shadow: 0 3px 10px rgba(14, 59, 82, 0.25); }
.net-wheel button:hover, .net-wheel button:focus { background: #d8644e; color: #fff6e6; outline: 0; }
.net-wheel button small { opacity: 0.6; margin-right: 4px; }
.net-welcome { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(340px, calc(100vw - 32px)); padding: 18px; pointer-events: auto; display: flex; flex-direction: column; gap: 12px; }
.net-welcome h2 { margin: 0; font-size: 18px; }
.net-welcome input { font: inherit; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(62, 58, 90, 0.25); background: #fffaf0; color: #3e3a5a; }
.net-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.net-swatches button { width: 28px; height: 28px; padding: 0; border-radius: 50%; border: 3px solid transparent; }
.net-swatches button.on { border-color: #3e3a5a; }
.net-welcome .row { display: flex; justify-content: flex-end; gap: 8px; }
`

let injected = false

export function netRoot(parent: HTMLElement): HTMLDivElement {
  if (!injected) {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    injected = true
  }
  const root = document.createElement('div')
  root.className = 'net-ui'
  parent.appendChild(root)
  return root
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text) e.textContent = text
  return e
}

export function hexColor(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`
}
