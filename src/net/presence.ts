import { DISTRICT_BY_ID } from '../core/layout'
import type { DistrictId, NetStatus } from '../core/types'
import type { PlayerCardView, PlayerId } from '../shared/protocol'
import { el, hexColor } from './style'
import { TEXT } from './text'

const STATUS_LABEL: Record<PlayerCardView['status'], string> = { actif: '', absent: 'absent', dort: 'dort', dehors: 'dehors' }

function districtName(id: string): string {
  return id in DISTRICT_BY_ID ? DISTRICT_BY_ID[id as DistrictId].nom : id
}

/** « À bord »: who is in the Drift right now, and where. Offers to rejoin when the server was lost. */
export class Presence {
  private readonly root: HTMLDivElement
  private readonly title: HTMLHeadingElement
  private readonly list: HTMLUListElement
  private readonly rejoin: HTMLButtonElement
  private readonly note: HTMLParagraphElement
  private signature = ''

  constructor(parent: HTMLElement, onRejoin: () => void) {
    this.root = el('div', 'net-presence net-panel')
    this.title = el('h3')
    this.list = el('ul')
    this.note = el('p', 'net-note')
    this.rejoin = el('button', '', TEXT.rejoin)
    this.rejoin.addEventListener('click', (e) => {
      e.stopPropagation()
      onRejoin()
    })
    this.root.append(this.title, this.list, this.note, this.rejoin)
    parent.appendChild(this.root)
  }

  render(status: NetStatus, players: readonly PlayerCardView[], me: PlayerId | null, canRejoin: boolean, note: string | null): void {
    const sig = `${status}|${canRejoin}|${note}|${players.map((p) => `${p.id}${p.name}${p.color}${p.district}${p.status}`).join(',')}`
    if (sig === this.signature) return
    this.signature = sig
    this.root.style.display = status === 'solo' && !canRejoin ? 'none' : ''
    this.rejoin.style.display = status === 'solo' && canRejoin ? '' : 'none'
    this.note.textContent = note ?? ''
    this.note.style.display = status === 'solo' && note ? '' : 'none'
    const head = status === 'online' ? `${TEXT.aboard} (${players.length})`
      : status === 'solo' ? TEXT.solo : status === 'connecting' ? TEXT.connecting : TEXT.reconnecting
    this.title.textContent = head
    this.list.replaceChildren(...(status === 'solo' ? [] : players).map((p) => {
      const li = el('li', p.status === 'absent' ? 'absent' : '')
      const dot = el('i')
      dot.style.background = hexColor(p.color)
      const where = [districtName(p.district), STATUS_LABEL[p.status]].filter(Boolean).join(' · ')
      li.append(dot, document.createTextNode(p.id === me ? `${p.name} (toi)` : p.name), el('span', '', where))
      return li
    }))
  }

  dispose(): void {
    this.root.remove()
  }
}
