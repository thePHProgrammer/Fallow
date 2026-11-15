import * as THREE from 'three'
import { at, ball, box, cyl, flat, halo, label, outline, painted, rod, seeded, toon } from './toon'
import { buildRain } from './weather'

/**
 * The cozy room: a desk by a rainy window at dusk. The robin's nest sits at
 * the origin; the desk top is y = 0.
 */

const C = {
  wall: 0xc9a377,
  wood: 0x8f5d36,
  woodDark: 0x6e4526,
  woodDeep: 0x4a2f1e,
  straw: 0xcfab6c,
  strawDark: 0xa98548,
  blanket: 0xec9550,
  cream: 0xf3e3c3,
  mug: 0xece4d2,
  tea: 0x8a4a22,
  brass: 0xc08f3e,
  terracotta: 0xc8693f,
  leaf: 0x6f9a5c,
  leafLight: 0x8fb878,
  succulent: 0x86b58a,
  bulb: 0xffe9a6,
}

const BOOKS = [0x6f7f8f, 0x8f5a4a, 0xb9905a, 0x55705a, 0x7a6a8a, 0xc9a66b, 0x4f6a7a, 0xa8683c]

export interface RoomState {
  /** Rain sound is on: heavier rain on the glass. */
  rainy: boolean
  /** The lofi radio is playing: its dial lights up. */
  radioOn: boolean
}

function plant(pot: number, leaves: number, rand: () => number): THREE.Group {
  const g = new THREE.Group()
  g.add(at(cyl(pot, pot * 0.75, pot * 1.3, C.terracotta), 0, pot * 0.65, 0))
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand()
    const leaf = ball(pot * 1.5, pot * 0.3, pot * 0.8, i % 2 ? C.leafLight : C.leaf, { ink: 0.015 })
    at(leaf, Math.cos(a) * pot * 0.7, pot * 1.5 + rand() * pot, Math.sin(a) * pot * 0.5, 0, -a, 0.5)
    g.add(leaf)
  }
  return g
}

function picture(w: number, h: number, tex: THREE.Texture): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(w + 0.16, h + 0.3), flat(0xf2ead8)))
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }))
  art.position.set(0, 0.06, 0.01)
  g.add(art)
  g.add(at(box(0.22, 0.1, 0.02, 0xd9c08a, { ink: false }), 0, h / 2 + 0.17, 0.02, 0, 0, 0.15))
  return g
}

export function buildRoom() {
  const group = new THREE.Group()
  const rand = seeded(7)

  // --- Walls and window ---------------------------------------------------
  group.add(at(new THREE.Mesh(new THREE.PlaneGeometry(90, 40), toon(C.wall)), 0, 6, -3.2))
  group.add(at(box(0.4, 16, 0.25, C.woodDark), -1.25, 5, -3.1))

  const WX = 1.7
  const WY = 2.75
  const dusk = painted(512, 448, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#8d8fb0')
    sky.addColorStop(0.45, '#d9a79a')
    sky.addColorStop(0.75, '#f2c08a')
    sky.addColorStop(1, '#e9b27a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    // Soft tree-line.
    const r = seeded(3)
    for (const [colour, base, size] of [
      ['#7f9a86', 0.62, 70],
      ['#5d7f68', 0.74, 85],
      ['#48664f', 0.88, 100],
    ] as const) {
      ctx.fillStyle = colour
      for (let x = -40; x < w + 40; x += size * 0.55) {
        ctx.beginPath()
        ctx.arc(x + r() * 30, h * base + r() * 40, size * (0.6 + r() * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillRect(0, h * (base + 0.1), w, h)
    }
  })
  group.add(
    at(new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.9), new THREE.MeshBasicMaterial({ map: dusk })), WX, WY, -3.17),
  )
  for (const [w, h, x, y] of [
    [5.0, 0.3, 0, 2.05],
    [5.0, 0.3, 0, -2.05],
    [0.3, 4.4, -2.35, 0],
    [0.3, 4.4, 2.35, 0],
    [0.16, 4.1, 0, 0],
    [4.7, 0.16, 0, 0.1],
  ]) {
    group.add(at(box(w, h, 0.22, C.wood), WX + x, WY + y, -3.02))
  }
  group.add(at(box(5.5, 0.22, 0.6, C.woodDark), WX, WY - 2.3, -2.85))

  // Rain running down the glass.
  const rain = buildRain({
    count: 90,
    min: new THREE.Vector3(WX - 2.15, WY - 1.9, -3.1),
    max: new THREE.Vector3(WX + 2.15, WY + 1.9, -3.08),
    dir: new THREE.Vector3(0.04, -1, 0),
    length: 0.32,
    speed: 2.6,
    color: 0xf4f7fb,
  })
  group.add(rain.lines)

  // --- Desk -----------------------------------------------------------------
  group.add(at(box(40, 0.36, 5.0, C.wood, { ink: 0.04 }), 0, -0.18, -0.75))
  group.add(at(new THREE.Mesh(new THREE.PlaneGeometry(40, 12), toon(C.woodDeep)), 0, -6.3, 1.6))
  // A shelf of books under the desk.
  group.add(at(box(40, 0.2, 1.2, C.woodDark), 0, -2.0, 1.3))
  for (let x = -11; x < 11; ) {
    const w = 0.22 + rand() * 0.22
    const h = 1.0 + rand() * 0.45
    if (rand() > 0.12) {
      const b = box(w, h, 0.9, BOOKS[Math.floor(rand() * BOOKS.length)])
      group.add(at(b, x + w / 2, -1.9 + h / 2, 1.35, 0, 0, rand() > 0.9 ? 0.12 : 0))
    }
    x += w + 0.03
  }
  const beats = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.27),
    new THREE.MeshBasicMaterial({ map: label('LOFI BEATS', '#efe2bd', '#4a2f1e') }),
  )
  group.add(at(beats, 2.9, -0.18, 1.77, 0, 0, -0.03))

  // --- Nest and blanket -------------------------------------------------------
  const nest = outline(new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.27, 12, 32), toon(C.straw)), 0.03)
  group.add(at(nest, 0, 0.27, 0, Math.PI / 2, 0, 0))
  group.add(at(cyl(0.8, 0.72, 0.2, C.strawDark, { ink: false }), 0, 0.12, 0))
  // Woven bands.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const band = ball(0.09, 0.5, 0.09, C.strawDark, { ink: false })
    group.add(at(band, Math.cos(a) * 1.03, 0.27, Math.sin(a) * 1.03, 0, 0, 0))
  }
  const arc = (r: number, tube: number, color: number, len: number, turn: number, y: number) => {
    const m = outline(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28, len), toon(color)), 0.03)
    // Round off the two cut ends.
    for (const a of [0, len]) m.add(at(ball(tube * 2, tube * 2, tube * 2, color), r * Math.cos(a), r * Math.sin(a), 0))
    return at(m, 0, y, 0, -Math.PI / 2, 0, turn)
  }
  group.add(arc(1.12, 0.3, C.blanket, Math.PI * 1.25, -0.5, 0.3))
  group.add(arc(1.42, 0.22, C.cream, Math.PI * 1.05, -0.3, 0.22))
  group.add(arc(1.62, 0.16, C.blanket, Math.PI * 0.9, -0.15, 0.16))
  group.add(at(ball(1.9, 0.3, 1.3, C.blanket), 1.25, 0.1, 0.75, 0, 0.5, 0))
  group.add(at(ball(1.5, 0.26, 0.5, C.cream), 1.5, 0.17, 1.05, 0, 0.5, 0))

  // --- Mug with steam ---------------------------------------------------------
  const MX = -2.35
  group.add(at(cyl(0.7, 0.7, 0.05, C.strawDark), MX, 0.025, 0.25, 0, 0, 0))
  group.add(at(cyl(0.42, 0.38, 0.78, C.mug), MX, 0.44, 0.25))
  group.add(at(cyl(0.36, 0.36, 0.02, C.tea, { ink: false }), MX, 0.835, 0.25))
  const handle = outline(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 16), toon(C.mug)), 0.02)
  group.add(at(handle, MX - 0.44, 0.45, 0.25))
  group.add(at(box(0.18, 0.22, 0.02, C.cream, { ink: 0.012 }), MX + 0.12, 0.4, 0.66))
  const steam = Array.from({ length: 5 }, (_, i) => {
    const puff = halo(0.3, 0xffffff, 0.3)
    puff.material = (puff.material as THREE.MeshBasicMaterial).clone()
    ;(puff.material as THREE.MeshBasicMaterial).blending = THREE.NormalBlending
    group.add(puff)
    return { puff, offset: i / 5 }
  })

  // --- Lamp -----------------------------------------------------------------
  const lampBase = new THREE.Vector3(4.3, 0.1, -2.1)
  const elbow = new THREE.Vector3(3.75, 2.55, -1.9)
  const headAt = new THREE.Vector3(2.35, 3.05, -1.3)
  group.add(at(cyl(0.5, 0.56, 0.12, C.brass), lampBase.x, 0.06, lampBase.z))
  group.add(rod(lampBase, elbow, 0.055, C.brass))
  group.add(rod(elbow, headAt, 0.055, C.brass))
  group.add(at(ball(0.2, 0.2, 0.2, C.brass), elbow.x, elbow.y, elbow.z))
  const aim = new THREE.Vector3(-0.72, -0.68, 0.16).normalize()
  const shade = outline(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.8, 20), flat(0xb07f33)), 0.03)
  shade.position.copy(headAt).addScaledVector(aim, 0.3)
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim)
  group.add(shade)
  const bulbAt = headAt.clone().addScaledVector(aim, 0.72)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), flat(C.bulb))
  bulb.position.copy(bulbAt)
  group.add(bulb)
  const glow = halo(2.6, 0xffcf80, 0.5)
  glow.position.copy(bulbAt).add(new THREE.Vector3(0, 0, 0.4))
  group.add(glow)
  const lamp = new THREE.PointLight(0xffd29a, 13, 16, 1.8)
  lamp.position.copy(bulbAt)
  group.add(lamp)

  // --- Books and radio --------------------------------------------------------
  const BX = 3.25
  const BZ = -0.45
  const stack: [string, number, string, number, number][] = [
    ['WOODLAND STORIES', 0x7f8c4e, '#e9dcae', 0.0, 0.03],
    ['LOFI CHILL', 0xc96f3a, '#f6dba6', 0.08, -0.04],
    ['NATURE TALES', 0x6f8a55, '#ead9a2', -0.05, 0.02],
  ]
  for (const [i, [title, color, paper, dx, turn]] of stack.entries()) {
    const book = box(2.5, 0.36, 1.6, color)
    at(book, BX + dx, 0.18 + i * 0.37, BZ, 0, turn, 0)
    const hex = `#${new THREE.Color(color).multiplyScalar(0.45).getHexString()}`
    const spine = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.24),
      new THREE.MeshBasicMaterial({ map: label(title, paper, hex) }),
    )
    spine.position.set(-0.1, 0, 0.805)
    book.add(spine)
    group.add(book)
  }
  const RY = 1.11
  group.add(at(box(1.7, 0.66, 0.6, 0xa8683c), BX + 0.1, RY + 0.33, BZ))
  group.add(at(cyl(0.2, 0.2, 0.02, C.woodDeep, { ink: false }, 20), BX - 0.42, RY + 0.33, BZ + 0.31, Math.PI / 2, 0, 0))
  for (let i = -1; i <= 1; i++) {
    group.add(at(box(0.3, 0.025, 0.01, 0xa8683c, { ink: false }), BX - 0.42, RY + 0.33 + i * 0.08, BZ + 0.325))
  }
  const dial = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.26),
    new THREE.MeshBasicMaterial({ map: label('LOFI RADIO', '#f4dc98', '#5a3a22', 384, 112) }),
  )
  group.add(at(dial, BX + 0.38, RY + 0.42, BZ + 0.305))
  const dialGlow = halo(0.9, 0xffd98a, 0)
  group.add(at(dialGlow, BX + 0.38, RY + 0.42, BZ + 0.36))
  group.add(at(cyl(0.05, 0.05, 0.05, C.woodDeep, { ink: false }, 10), BX + 0.78, RY + 0.16, BZ + 0.31, Math.PI / 2, 0, 0))
  group.add(
    rod(new THREE.Vector3(BX + 0.8, RY + 0.66, BZ), new THREE.Vector3(BX + 1.55, RY + 1.3, BZ), 0.018, 0x8a8478, {
      ink: false,
    }),
  )

  // --- Succulent --------------------------------------------------------------
  const SX = 1.85
  group.add(at(cyl(0.27, 0.2, 0.34, C.terracotta), SX, 0.17, 1.05))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const tilt = i % 2 ? 0.75 : 0.4
    const spike = outline(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.32, 6), toon(C.succulent)), 0.012)
    at(spike, SX + Math.cos(a) * 0.13, 0.44, 1.05 + Math.sin(a) * 0.13, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt)
    group.add(spike)
  }
  group.add(at(outline(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), toon(C.succulent)), 0.012), SX, 0.5, 1.05))

  // --- Fairy lights -----------------------------------------------------------
  const wire: THREE.Vector3[] = []
  const lights: { bulb: THREE.Mesh; phase: number }[] = []
  for (let i = 0; i <= 15; i++) {
    const f = i / 15
    const p = new THREE.Vector3(-3.6 + f * 6.2, 0.07, 1.45 + Math.sin(f * 11) * 0.18)
    wire.push(p)
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), flat(C.bulb))
    b.position.copy(p)
    group.add(b)
    const h = halo(0.3, 0xffd98a, 0.55)
    h.position.z = 0.05
    b.add(h)
    lights.push({ bulb: b, phase: rand() * 6 })
  }
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(wire).getPoints(60)),
      new THREE.LineBasicMaterial({ color: 0x4a3a2a }),
    ),
  )

  // --- Bookshelf, vine, pictures ---------------------------------------------
  const shelfX = -6.4
  group.add(at(box(5.0, 14, 0.2, C.woodDeep, { ink: false }), shelfX, 3, -3.05))
  group.add(at(box(0.25, 14, 1.0, C.woodDark), shelfX + 2.5, 3, -2.7))
  for (const y of [0.75, 2.45, 4.15, 5.85]) {
    group.add(at(box(5.0, 0.16, 1.0, C.woodDark), shelfX, y, -2.7))
    for (let x = shelfX - 2.35; x < shelfX + 2.2; ) {
      const w = 0.2 + rand() * 0.2
      const h = 0.9 + rand() * 0.45
      const roll = rand()
      if (roll > 0.86) {
        const p = plant(0.2, 5, rand)
        group.add(at(p, x + 0.3, y + 0.08, -2.6))
        x += 0.75
        continue
      }
      if (roll > 0.1) {
        const b = box(w, h, 0.75, BOOKS[Math.floor(rand() * BOOKS.length)])
        group.add(at(b, x + w / 2, y + 0.08 + h / 2, -2.65, 0, 0, roll > 0.8 ? 0.14 : 0))
      }
      x += w + 0.03
    }
  }
  // Hanging vine.
  const vine: THREE.Vector3[] = []
  for (let i = 0; i < 12; i++) {
    const y = 7 - i * 0.45
    const x = -2.75 + Math.sin(i * 0.9) * 0.22
    vine.push(new THREE.Vector3(x, y, -2.9))
    const leaf = ball(0.5, 0.08, 0.3, i % 2 ? C.leafLight : C.leaf, { ink: 0.018 })
    group.add(at(leaf, x + (i % 2 ? 0.22 : -0.22), y - 0.1, -2.85, 0.2, 0, i % 2 ? -0.9 : 0.9))
  }
  group.add(
    new THREE.Line(new THREE.BufferGeometry().setFromPoints(vine), new THREE.LineBasicMaterial({ color: 0x4f6a40 })),
  )

  const mountain = painted(256, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#f1b98a')
    sky.addColorStop(1, '#f6dcae')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#7d8aa3'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.75)
    ctx.lineTo(w * 0.35, h * 0.25)
    ctx.lineTo(w * 0.55, h * 0.55)
    ctx.lineTo(w * 0.72, h * 0.35)
    ctx.lineTo(w, h * 0.75)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(w * 0.35, h * 0.25)
    ctx.lineTo(w * 0.27, h * 0.38)
    ctx.lineTo(w * 0.43, h * 0.38)
    ctx.fill()
    ctx.fillStyle = '#6f8f5e'
    ctx.fillRect(0, h * 0.72, w, h)
  })
  const moon = painted(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#2f3352'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f4d58a'
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.5, w * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2f3352'
    ctx.beginPath()
    ctx.arc(w * 0.6, h * 0.45, w * 0.23, 0, Math.PI * 2)
    ctx.fill()
  })
  group.add(at(picture(1.25, 1.25, mountain), -2.45, 4.55, -3.15, 0, 0, 0.03))
  group.add(at(picture(1.0, 1.25, moon), -2.3, 2.75, -3.15, 0, 0, -0.04))
  group.add(at(picture(1.3, 1.0, mountain), 5.6, 2.6, -3.15, 0, 0, -0.03))
  // A little shelf with a plant, top right.
  group.add(at(box(2.4, 0.16, 0.8, C.woodDark), 5.5, 4.5, -2.8))
  group.add(at(plant(0.3, 7, rand), 5.5, 4.58, -2.8))

  // -------------------------------------------------------------------------
  function update(t: number, state: RoomState) {
    rain.update(t, state.rainy ? 1 : 0.4)

    for (const s of steam) {
      const p = (t * 0.22 + s.offset) % 1
      s.puff.position.set(MX + Math.sin(p * 6 + s.offset * 9) * 0.12, 0.95 + p * 1.5, 0.25)
      s.puff.scale.setScalar(0.7 + p * 1.2)
      ;(s.puff.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.sin(p * Math.PI)
    }

    // Lamp: a barely-there flicker. Fairy lights: slow twinkle.
    const flicker = 1 + Math.sin(t * 7.3) * 0.015 + Math.sin(t * 2.1) * 0.02
    lamp.intensity = 13 * flicker
    ;(glow.material as THREE.MeshBasicMaterial).opacity = 0.5 * flicker
    for (const l of lights) {
      const s = 0.8 + 0.35 * Math.sin(t * 1.3 + l.phase)
      l.bulb.scale.setScalar(s)
    }

    const on = state.radioOn ? 1 : 0
    ;(dial.material as THREE.MeshBasicMaterial).color.setScalar(0.72 + 0.28 * on)
    ;(dialGlow.material as THREE.MeshBasicMaterial).opacity = on * (0.3 + 0.06 * Math.sin(t * 2))
  }

  return { group, update }
}
