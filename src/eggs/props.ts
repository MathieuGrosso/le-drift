import * as THREE from 'three'
import type { Vec3 } from '../core/types'
import { glow, halo, mesh, type MatFn } from './mats'
import { ACCENT, HAND, INK, SERIF, canvas2d, frog, goat, lines, paper, stamp, title, type Canvas2D } from './paint'
import { ATLAS, GREFFIER, POSTERS } from './text'

export function poster(mat: MatFn, c: Canvas2D, w: number, h: number, at: Vec3, yaw: number, frame = 0x8a5a3b): THREE.Group {
  const g = new THREE.Group()
  g.position.set(at.x, at.y, at.z)
  g.rotation.y = yaw
  g.add(mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03), mat({ color: frame, indoor: true }), 0, 0, -0.01))
  g.add(mesh(new THREE.PlaneGeometry(w, h), mat({ color: 0xffffff, map: c.texture, indoor: true }), 0, 0, 0.008))
  return g
}

export function paintComptage(): Canvas2D {
  const c = canvas2d(256, 320)
  paper(c)
  title(c, POSTERS.comptage.titre, 44, 30)
  const g = c.g
  g.strokeStyle = INK
  g.lineWidth = 3
  for (let i = 0; i < 9; i++) {
    g.beginPath()
    g.moveTo(78 + i * 11, 78)
    g.lineTo(78 + i * 11, 78 + (i % 3 === 0 ? 34 : 26))
    g.stroke()
  }
  lines(c, POSTERS.comptage.lignes, 150, 30, 34)
  return c
}

export function paintAntigaspi(): Canvas2D {
  const c = canvas2d(256, 320)
  paper(c, '#f6e7a8')
  title(c, POSTERS.antigaspi.titre, 46, 36, ACCENT)
  const g = c.g
  g.save()
  g.translate(128, 112)
  g.rotate(-0.12)
  g.fillStyle = '#f2c14e'
  g.fillRect(-58, -24, 116, 48)
  g.strokeStyle = INK
  g.lineWidth = 3
  g.strokeRect(-58, -24, 116, 48)
  g.fillStyle = INK
  g.font = `800 30px ${SERIF}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('-30 %', 0, 2)
  g.restore()
  lines(c, POSTERS.antigaspi.lignes, 180, 28, 34)
  return c
}

export function paintCreneaux(c: Canvas2D, hours: number): void {
  paper(c, '#2f3b36', '#c9b48a')
  title(c, POSTERS.creneaux.titre, 40, 26, '#f6f2e8')
  const g = c.g
  POSTERS.creneaux.lignes.forEach((l, i) => {
    const y = 96 + i * 52
    g.strokeStyle = '#f6f2e8'
    g.lineWidth = 3
    g.strokeRect(26, y - 14, 26, 26)
    if (hours >= l.h + 2) {
      g.strokeStyle = '#9ee6c9'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(30, y)
      g.lineTo(38, y + 9)
      g.lineTo(54, y - 16)
      g.stroke()
    }
    g.fillStyle = '#f6f2e8'
    g.font = `500 26px ${HAND}`
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(l.t, 64, y)
  })
  g.font = `italic 20px ${HAND}`
  g.textAlign = 'right'
  g.fillStyle = '#c9b48a'
  g.fillText(POSTERS.creneaux.signature, c.w - 24, c.h - 26)
  c.texture.needsUpdate = true
}

export function paintCommande(): Canvas2D {
  const c = canvas2d(512, 256)
  paper(c, '#e9d7b0')
  title(c, POSTERS.commande.titre, 52, 44, '#7a3b2a')
  const g = c.g
  g.strokeStyle = INK
  g.lineWidth = 3
  for (const [cx, label] of [[80, '4 h'], [432, '12 h']] as const) {
    g.beginPath()
    g.arc(cx, 160, 42, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(cx, 160)
    g.lineTo(cx, 130)
    g.moveTo(cx, 160)
    g.lineTo(cx + (label === '4 h' ? 24 : 0), label === '4 h' ? 172 : 124)
    g.stroke()
    g.fillStyle = INK
    g.font = `600 22px ${SERIF}`
    g.textAlign = 'center'
    g.fillText(label, cx, 222)
  }
  lines(c, POSTERS.commande.lignes, 118, 30, 38)
  return c
}

export function paintPatee(): Canvas2D {
  const c = canvas2d(256, 160)
  paper(c, '#d9b46a', '#6b4a22')
  title(c, POSTERS.patee.titre, 34, 24, '#4a2e12')
  lines(c, POSTERS.patee.lignes, 92, 26, 32, '#4a2e12')
  return c
}

export function paintAvis(c: Canvas2D, found: boolean): void {
  paper(c, '#f4ecd8')
  title(c, POSTERS.avis.titre, 40, 40, ACCENT)
  goat(c.g, 120, 112, 1.2, INK)
  lines(c, POSTERS.avis.lignes, 190, 26, 30)
  if (found) stamp(c, POSTERS.avis.tampon)
  c.texture.needsUpdate = true
}

export function paintRetro(): Canvas2D {
  const c = canvas2d(320, 256)
  paper(c, '#f6f2e8')
  title(c, POSTERS.retro.titre, 30, 24)
  const g = c.g
  const colW = (c.w - 40) / 4
  const stickies = ['#fff3a6', '#a8e6cf', '#ffd3b6', '#cdb4ff']
  POSTERS.retro.colonnes.forEach((col, i) => {
    const x = 20 + i * colW
    g.fillStyle = INK
    g.font = `600 18px ${SERIF}`
    g.textAlign = 'center'
    g.fillText(col, x + colW / 2, 66)
    const notes = POSTERS.retro.notes[i] ?? []
    notes.forEach((n, j) => {
      g.fillStyle = stickies[i]!
      g.fillRect(x + 6, 84 + j * 60, colW - 12, 52)
      g.fillStyle = INK
      g.font = `500 17px ${HAND}`
      g.fillText(n, x + colW / 2, 114 + j * 60)
    })
  })
  frog(g, 20 + colW * 2.5, 128, 1.1)
  return c
}

export function paintMercuriale(c: Canvas2D, day: number): void {
  paper(c, '#2b3532', '#8a5a3b')
  title(c, POSTERS.mercuriale.titre, 42, 34, '#f6f2e8')
  const g = c.g
  const { produits, prix, rupture } = POSTERS.mercuriale
  const out = day % produits.length
  produits.forEach((p, i) => {
    const y = 102 + i * 46
    g.textBaseline = 'middle'
    g.fillStyle = '#f6f2e8'
    g.font = `500 28px ${HAND}`
    g.textAlign = 'left'
    g.fillText(p, 34, y)
    g.textAlign = 'right'
    if (i === out) {
      g.fillStyle = '#f2c14e'
      g.font = `700 26px ${SERIF}`
      g.fillText(rupture, c.w - 34, y)
    } else {
      g.fillText(prix[i]!, c.w - 34, y)
    }
    g.strokeStyle = 'rgba(246,242,232,.25)'
    g.setLineDash([3, 6])
    g.beginPath()
    g.moveTo(34, y + 20)
    g.lineTo(c.w - 34, y + 20)
    g.stroke()
    g.setLineDash([])
  })
  c.texture.needsUpdate = true
}

export function paintJus(c: Canvas2D): void {
  paper(c, '#f6f2e8')
  const g = c.g
  g.fillStyle = '#f2a23a'
  g.beginPath()
  g.arc(c.w - 52, 52, 28, 0, Math.PI * 2)
  g.fill()
  title(c, 'LE JUS DU MATIN', 40, 28, '#c25a1a')
  lines(c, ['Encore une belle journée', 'qui s’annonce', '9 h 30'], 86, 22, 26)
  lines(c, ['Comment tu te sens ?', 'Qu’as-tu fait hier ?', 'Ta priorité du jour ?', 'Pression sur 5 ?', 'Comment t’aider ?'], 176, 22, 26, '#3a5a6a')
  c.texture.needsUpdate = true
}

export function paintGreffier(c: Canvas2D, name: string): void {
  const g = c.g
  g.fillStyle = '#c9a24a'
  g.fillRect(0, 0, c.w, c.h)
  g.strokeStyle = '#7a5a1e'
  g.lineWidth = 6
  g.strokeRect(6, 6, c.w - 12, c.h - 12)
  for (const [x, y] of [[18, 18], [c.w - 18, 18], [18, c.h - 18], [c.w - 18, c.h - 18]] as const) {
    g.fillStyle = '#7a5a1e'
    g.beginPath()
    g.arc(x, y, 5, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#4a3410'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `600 16px ${SERIF}`
  g.fillText(GREFFIER.plaque, c.w / 2, 36)
  let s = 30
  g.font = `700 ${s}px ui-monospace, monospace`
  while (s > 12 && g.measureText(name).width > c.w - 40) {
    s -= 2
    g.font = `700 ${s}px ui-monospace, monospace`
  }
  g.fillText(name, c.w / 2, 86)
  c.texture.needsUpdate = true
}

export function paintAtlas(c: Canvas2D, cursor: boolean, answer: string | null): void {
  const g = c.g
  g.fillStyle = '#0d1630'
  g.fillRect(0, 0, c.w, c.h)
  g.fillStyle = '#7b5cf0'
  g.font = '800 30px ui-monospace, monospace'
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.fillText(ATLAS.ecran[0]!, 18, 14)
  g.fillStyle = '#9ee6c9'
  g.font = '500 18px ui-monospace, monospace'
  if (answer) {
    const words = answer.split(' ')
    let line = ''
    let y = 62
    for (const w of words) {
      const t = line ? `${line} ${w}` : w
      if (g.measureText(t).width > c.w - 36) {
        g.fillText(line, 18, y)
        y += 22
        line = w
        if (y > c.h - 30) break
      } else line = t
    }
    if (y <= c.h - 30) g.fillText(line + (cursor ? ' _' : ''), 18, y)
  } else {
    g.fillText(ATLAS.ecran[1]!, 18, 62)
    g.fillText(ATLAS.ecran[2]! + (cursor ? ' _' : ''), 18, 86)
  }
  c.texture.needsUpdate = true
}

export function paintSign(lignesTitre: string, sous: readonly string[]): Canvas2D {
  const c = canvas2d(256, 160)
  paper(c, '#c79a62', '#5a3a1a')
  title(c, lignesTitre, 40, 28, '#3a2410')
  lines(c, sous, 92, 28, 34, '#3a2410')
  return c
}

export function goatModel(mat: MatFn, color: number, emissive: number, indoor = false): THREE.Group {
  const m = mat({ color, emissive, rim: 0.6, indoor })
  const g = new THREE.Group()
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.24, 0.22), m, 0, 0.36, 0))
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.16, 0.14), m, 0.3, 0.52, 0))
  for (const [x, z] of [[-0.18, -0.07], [-0.18, 0.07], [0.18, -0.07], [0.18, 0.07]] as const) {
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), m, x, 0.12, z))
  }
  for (const z of [-0.04, 0.04]) {
    const horn = mesh(new THREE.ConeGeometry(0.025, 0.16, 6), m, 0.25, 0.66, z)
    horn.rotation.z = 0.6
    g.add(horn)
  }
  g.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 6).rotateZ(Math.PI), m, 0.36, 0.4, 0))
  return g
}

export function sanctuary(mat: MatFn, at: Vec3): { root: THREE.Group; goat: THREE.Group; light: THREE.Sprite } {
  const root = new THREE.Group()
  root.name = 'eggs-sanctuaire'
  root.position.set(at.x, at.y, at.z)
  const stone = mat({ color: 0x8fa3a0, shadowColor: 0x4a6470, caustics: true })
  const moss = mat({ color: 0x6f9a5a, caustics: true })
  const R = 2.4
  const H = 2.1
  const n = 12
  root.add(mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.9, 0.5, 24), stone, 0, 0.0, 0))
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === 1) continue
    const a = ((i + 0.5) / n) * Math.PI * 2
    const x = Math.sin(a) * R
    const z = Math.cos(a) * R
    const seg = (2 * Math.PI * R) / n + 0.1
    const wall = mesh(new THREE.BoxGeometry(seg, H, 0.5), stone, x, H / 2, z)
    wall.rotation.y = a
    root.add(wall)
    if (i % 3 === 0) {
      const tuft = mesh(new THREE.SphereGeometry(0.3, 8, 6), moss, x * 1.05, H, z * 1.05)
      tuft.scale.y = 0.5
      root.add(tuft)
    }
  }
  const dome = mesh(new THREE.SphereGeometry(R + 0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, H, 0)
  dome.scale.y = 0.55
  root.add(dome)
  const lintel = mesh(new THREE.BoxGeometry(1.9, 0.4, 0.6), stone, Math.sin(Math.PI / n * 2) * R, H - 0.25, Math.cos(Math.PI / n * 2) * R)
  lintel.rotation.y = (Math.PI / n) * 2
  root.add(lintel)
  root.add(mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.8, 10), stone, 0, 0.4, -0.4))
  const goat = goatModel(mat, 0xf2c14e, 0x6a4a10)
  goat.position.set(0, 0.8, -0.4)
  goat.rotation.y = Math.PI / 2
  root.add(goat)
  const light = halo(0xffd77a, 2.2)
  light.position.set(0, 1.3, -0.4)
  root.add(light)
  return { root, goat, light }
}

export function remise(mat: MatFn, at: Vec3): { root: THREE.Group; ours: Vec3; plafond: Vec3 } {
  const root = new THREE.Group()
  root.name = 'eggs-remise-du-jus'
  root.position.set(at.x, at.y, at.z)
  const wood = mat({ color: 0x8a5a3b })
  const dark = mat({ color: 0x5a3a26 })
  const metal = mat({ color: 0x6b7a80 })
  root.add(mesh(new THREE.BoxGeometry(3.4, 0.15, 3), wood, 0, 0, 0))
  root.add(mesh(new THREE.BoxGeometry(3.4, 2.2, 0.12), dark, 0, 1.1, -1.45))
  for (const s of [-1, 1]) root.add(mesh(new THREE.BoxGeometry(0.12, 2.2, 3), dark, s * 1.65, 1.1, 0))
  root.add(mesh(new THREE.BoxGeometry(3.6, 0.12, 3.2), wood, 0, 2.25, 0))
  root.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), metal, 1.5, 3.0, -1.3))
  root.add(mesh(new THREE.PlaneGeometry(0.6, 0.35).translate(0.3, 0, 0), mat({ color: 0xf2a23a, side: THREE.DoubleSide }), 1.5, 3.5, -1.3))
  const juice = mat({ color: 0xf2a23a })
  for (let i = 0; i < 3; i++) {
    root.add(mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), wood, -0.9 + i * 0.65, 0.28, -1.05))
    for (let j = 0; j < 3; j++) root.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), juice, -1.1 + i * 0.65 + j * 0.18, 0.58, -1.05))
  }
  const sign = paintSign(POSTERS.remise.titre, POSTERS.remise.lignes)
  const s = mesh(new THREE.PlaneGeometry(1.4, 0.88), mat({ color: 0xffffff, map: sign.texture }), 0, 1.5, -1.38)
  root.add(s)
  const bulb = mesh(new THREE.SphereGeometry(0.08, 10, 8), glow(0xffd77a), 0, 2.05, 0)
  root.add(bulb)
  const h = halo(0xffd77a, 1.6)
  h.position.set(0, 2.0, 0)
  root.add(h)
  const ours = new THREE.Group()
  const fur = mat({ color: 0xb07a4a })
  ours.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), fur, 0, 0.2, 0))
  ours.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), fur, 0, 0.48, 0))
  for (const sx of [-1, 1]) {
    ours.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), fur, sx * 0.1, 0.6, 0))
    ours.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), fur, sx * 0.17, 0.18, 0.08))
    ours.add(mesh(new THREE.SphereGeometry(0.015, 6, 4), mat({ color: 0x222222 }), sx * 0.045, 0.5, 0.125))
  }
  ours.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat({ color: 0xe6c9a0 }), 0, 0.45, 0.12))
  ours.position.set(1.0, 0.08, -0.4)
  ours.rotation.y = -0.5
  root.add(ours)
  return { root, ours: { x: at.x + 1.0, y: at.y + 0.3, z: at.z - 0.4 }, plafond: { x: at.x - 0.6, y: at.y + 1.7, z: at.z + 0.2 } }
}

export function campSign(mat: MatFn, at: Vec3): THREE.Group {
  const g = new THREE.Group()
  g.name = 'eggs-camp-survie'
  g.position.set(at.x, at.y, at.z)
  const wood = mat({ color: 0x8a5a3b, caustics: true })
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.8, 6), wood, 0, 0.9, 0))
  const c = paintSign(POSTERS.camp.titre, POSTERS.camp.lignes)
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.82, 0.06), wood, 0, 1.55, 0.06))
  g.add(mesh(new THREE.PlaneGeometry(1.24, 0.76), mat({ color: 0xffffff, map: c.texture }), 0, 1.55, 0.095))
  const tent = mesh(new THREE.ConeGeometry(1.1, 1.3, 4), mat({ color: 0xd98a4a, caustics: true }), 2.2, 0.65, -1.2)
  tent.rotation.y = Math.PI / 4
  g.add(tent)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    g.add(mesh(new THREE.SphereGeometry(0.16, 6, 5), mat({ color: 0x7d8a86, caustics: true }), -1.4 + Math.cos(a) * 0.45, 0.08, 0.9 + Math.sin(a) * 0.45))
  }
  return g
}

export function scanGhost(): { root: THREE.Group; card: THREE.Sprite } {
  const root = new THREE.Group()
  root.name = 'eggs-scan-perdu'
  const c = canvas2d(64, 48)
  const g = c.g
  g.fillStyle = 'rgba(255,255,255,0)'
  g.fillRect(0, 0, 64, 48)
  g.fillStyle = '#ff6a5a'
  let x = 6
  let i = 0
  while (x < 58) {
    const w = 1 + ((i * 7) % 4)
    g.fillRect(x, 6, w, 36)
    x += w + 2 + (i % 3)
    i++
  }
  const card = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.texture, transparent: true, depthWrite: false, toneMapped: false }))
  card.scale.set(0.34, 0.26, 1)
  root.add(card)
  root.add(halo(0xff6a5a, 0.9))
  return { root, card }
}

export function plafondModel(mat: MatFn, id: string): THREE.Group {
  const g = new THREE.Group()
  const m = (color: number) => mat({ color, rim: 0.5 })
  switch (id) {
    case 'scanette':
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.26, 0.06), m(0x3a3f47)))
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), glow(0xff6a5a), 0, 0.08, 0.035))
      break
    case 'gobelet':
      g.add(mesh(new THREE.CylinderGeometry(0.09, 0.065, 0.22, 12), m(0xf2a23a)))
      g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 5), m(0xffffff), 0.03, 0.15, 0))
      break
    case 'etiquette':
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.14, 0.01), m(0xf2c14e)))
      break
    case 'colis':
      g.add(mesh(new THREE.BoxGeometry(0.32, 0.24, 0.26), m(0xb98a55)))
      g.add(mesh(new THREE.BoxGeometry(0.33, 0.03, 0.27), m(0xd8c49a), 0, 0.05, 0))
      break
    case 'stylo':
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), m(0x1d2a5c)))
      g.add(mesh(new THREE.ConeGeometry(0.015, 0.05, 8), m(0xc9a24a), 0, 0.17, 0))
      break
    case 'casque':
      g.add(mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(0xf6f2e8)))
      g.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 0.01), m(0xd8423a), 0, 0.09, 0.14))
      break
    case 'disquette':
      g.add(mesh(new THREE.BoxGeometry(0.22, 0.22, 0.02), m(0x2a2f6a)))
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.07, 0.022), m(0xc0c6cc), 0, 0.07, 0))
      break
    case 'bonnet':
      g.add(mesh(new THREE.ConeGeometry(0.12, 0.22, 12), m(0xd8423a), 0, 0.06, 0))
      g.add(mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14).rotateX(Math.PI / 2), m(0xffffff), 0, -0.05, 0))
      break
  }
  g.add(halo(0xfff1c9, 1.1))
  return g
}
