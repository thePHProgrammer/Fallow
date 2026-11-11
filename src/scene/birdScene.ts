import * as THREE from 'three'

/**
 * The living background: a small low-poly bird, built entirely from
 * primitives (no model files, no textures), in one of two places —
 *
 *   perch  the bird rests on a branch over soft hills
 *   ocean  the bird glides over a rolling low-poly sea
 *
 * `fly` (0..1) blends between them: the bird lifts off, the land drops away,
 * and the sea rises to meet it. Landing is the same blend in reverse.
 *
 * Feeding on the branch is a tiny state machine:
 *   idle → watch → hop → peck ×n → happy → return
 * In flight, seeds are tossed ahead and the bird catches them on the wing.
 *
 * Still mode (Calm Mode / reduced motion) renders single frames on demand.
 * Lazy-loaded with three.js by BirdScene.tsx so the app paints first.
 */

export type SceneMode = 'perch' | 'ocean'

/** Where on screen the bird should sit (fractions of the canvas) and how
 *  tall it should be in CSS pixels. */
export interface Anchor {
  x: number
  y: number
  size: number
}

export interface BirdSceneOptions {
  animated: boolean
  mode: SceneMode
  anchor: Anchor
  /** Called when the bird is pleased (after eating, or when tapped). */
  onChirp: () => void
}

export interface BirdSceneHandle {
  feed: () => void
  setAnimated: (on: boolean) => void
  setMode: (mode: SceneMode) => void
  setAnchor: (anchor: Anchor) => void
  dispose: () => void
}

const PALETTE = {
  back: 0x8a6a52,
  wing: 0x7a5c47,
  breast: 0xe2905e,
  belly: 0xf3dfc4,
  beak: 0xe7b45a,
  eye: 0x2e2c29,
  blush: 0xf0a0a0,
  leg: 0xc08a5a,
  branch: 0x6b4f3a,
  leaf: 0x4a7a63,
  leafLight: 0x79a487,
  seed: 0xc9a46a,
  hill: 0x9db89a,
  hillFar: 0xbccdb4,
  cloud: 0xfffaf2,
  seaDeep: new THREE.Color(0x4f9da3),
  seaMid: new THREE.Color(0x86c5c0),
  seaCrest: new THREE.Color(0xe8f6ee),
  seaGlint: new THREE.Color(0xfff0c4),
  fogPerch: new THREE.Color(0xf1e6d6),
  fogOcean: new THREE.Color(0xd9e9e0),
}

const BRANCH_TOP = 0.12
const HOME_X = 0
const HOME_YAW = 0.45
const SEED_X = -1.1
const BODY_Y = 0.52
const BIRD_HEIGHT = 1.3
const FOV = 32
const FLY_SECONDS = 3.2
/** Flying left across the view, turned a little toward us. */
const FLY_YAW = -1.15
/** How fast the world slides past in flight (opposite the heading). */
const FLY_VX = 6.4
const FLY_VZ = -2.6
const SEA_Y = -1.7
const SUN = new THREE.Vector3(-9, 12, -150)

type Phase = 'idle' | 'watch' | 'hop' | 'peck' | 'happy' | 'return'

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 })
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** 0 below a, 1 above b, smooth in between. */
const step = (a: number, b: number, v: number) => {
  const p = clamp01((v - a) / (b - a))
  return p * p * (3 - 2 * p)
}

function buildBird() {
  // bird: position + heading. pose: pitch/roll about the body centre.
  const bird = new THREE.Group()
  const pose = new THREE.Group()
  pose.position.y = BODY_Y
  bird.add(pose)
  const parts = new THREE.Group()
  parts.position.y = -BODY_Y
  pose.add(parts)

  // Body: an egg, slightly longer front-to-back.
  const body = new THREE.Group()
  body.position.y = BODY_Y
  parts.add(body)
  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(PALETTE.back))
  torso.scale.set(0.95, 0.9, 1.1)
  body.add(torso)
  const breast = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat(PALETTE.breast))
  breast.position.set(0, 0.02, 0.2)
  breast.scale.set(0.95, 0.95, 0.85)
  body.add(breast)
  const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), mat(PALETTE.belly))
  belly.position.set(0, -0.17, 0.2)
  body.add(belly)

  // Tail: three fanned feathers angled up behind.
  const tail = new THREE.Group()
  tail.position.set(0, 0.42, -0.5)
  for (const [i, yaw] of [-0.35, 0, 0.35].entries()) {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.5),
      mat(i === 1 ? PALETTE.back : PALETTE.wing),
    )
    f.position.set(Math.sin(yaw) * 0.16, 0, -0.2)
    f.rotation.set(-0.5, yaw, 0)
    tail.add(f)
  }
  parts.add(tail)

  // Wings pivot at the shoulder. Each has a folded shape (perching) and an
  // open, two-feather span (flying); `open` cross-scales between them.
  const wings: { pivot: THREE.Group; folded: THREE.Mesh; span: THREE.Group }[] = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.42, 0.72, -0.02)
    const folded = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), mat(PALETTE.wing))
    folded.scale.set(0.22, 0.6, 0.95)
    folded.position.set(side * 0.02, -0.18, -0.08)
    folded.rotation.x = 0.25
    pivot.add(folded)

    const span = new THREE.Group()
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), mat(PALETTE.wing))
    inner.scale.set(1.2, 0.07, 0.8)
    inner.position.set(side * 0.44, 0, -0.04)
    span.add(inner)
    const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), mat(PALETTE.back))
    tip.scale.set(1.0, 0.05, 0.5)
    tip.position.set(side * 1.02, 0, -0.18)
    tip.rotation.y = side * -0.35
    span.add(tip)
    span.visible = false
    pivot.add(span)

    parts.add(pivot)
    wings.push({ pivot, folded, span })
  }

  // Head with beak, eyes, highlights and blush.
  const head = new THREE.Group()
  head.position.set(0, 1.0, 0.2)
  parts.add(head)
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), mat(PALETTE.back))
  head.add(skull)
  const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), mat(PALETTE.breast))
  face.position.set(0, -0.06, 0.1)
  head.add(face)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 5), mat(PALETTE.beak))
  beak.position.set(0, -0.03, 0.36)
  beak.rotation.x = Math.PI / 2
  head.add(beak)
  const eyes: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(PALETTE.eye))
    eye.position.set(side * 0.16, 0.06, 0.23)
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    glint.position.set(side * 0.012 + 0.012, 0.018, 0.04)
    eye.add(glint)
    head.add(eye)
    eyes.push(eye)
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), mat(PALETTE.blush))
    blush.position.set(side * 0.2, -0.06, 0.2)
    blush.rotation.y = side * 0.8
    head.add(blush)
  }

  // Legs and toes gripping the branch (tucked away in flight).
  const legs = new THREE.Group()
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 5), mat(PALETTE.leg))
    leg.position.set(side * 0.14, BRANCH_TOP + 0.09, 0.05)
    legs.add(leg)
    for (const yaw of [-0.4, 0, 0.4]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 4), mat(PALETTE.leg))
      toe.rotation.set(Math.PI / 2, 0, yaw)
      toe.position.set(side * 0.14 + Math.sin(yaw) * 0.05, BRANCH_TOP + 0.02, 0.09)
      legs.add(toe)
    }
  }
  parts.add(legs)

  return { bird, pose, body, head, wings, eyes, tail, legs }
}

/** Branch, leaves and far hills — everything that stays behind on takeoff. */
function buildLand(): THREE.Group {
  const g = new THREE.Group()
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 60, 7), mat(PALETTE.branch))
  limb.rotation.z = Math.PI / 2
  g.add(limb)
  const twigs: [number, number, number][] = [
    [-2.4, 0.6, 0.6],
    [2.6, 0.5, -0.7],
    [-6.5, 0.7, -0.5],
    [7, 0.6, 0.55],
  ]
  for (const [x, len, lean] of twigs) {
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, len * 2.4, 5), mat(PALETTE.branch))
    twig.position.set(x, len, -0.1)
    twig.rotation.z = lean
    g.add(twig)
  }
  const leafGeo = new THREE.IcosahedronGeometry(0.22, 0)
  const spots: [number, number, number, number][] = [
    [-2.95, 1.25, 0, 0.6],
    [-2.6, 1.12, 0.15, -0.3],
    [-2.1, 0.62, -0.1, 0.9],
    [3.05, 1.05, 0.1, -0.5],
    [3.3, 0.8, -0.15, 0.4],
    [2.2, 0.22, 0.05, -0.9],
    [-4.3, 0.18, 0.1, 0.3],
    [-6.0, 1.3, 0, 0.7],
    [-6.35, 1.0, 0.12, -0.4],
    [7.5, 1.25, 0, -0.6],
    [7.2, 0.95, -0.1, 0.5],
    [5.0, 0.2, 0.1, 0.2],
    [-9, 0.2, 0, -0.3],
    [10.5, 0.22, 0.05, 0.8],
  ]
  for (const [i, [x, y, z, r]] of spots.entries()) {
    const leaf = new THREE.Mesh(leafGeo, mat(i % 2 ? PALETTE.leafLight : PALETTE.leaf))
    leaf.position.set(x, y, z)
    leaf.scale.set(1.4, 0.35, 0.8)
    leaf.rotation.set(0.3, r, r * 0.5)
    g.add(leaf)
  }
  // Soft rolling hills, far below and behind.
  const hillGeo = new THREE.IcosahedronGeometry(1, 1)
  const hills: [number, number, number, number, number][] = [
    [-62, -52, 30, 11, PALETTE.hillFar],
    [-24, -60, 34, 9, PALETTE.hillFar],
    [22, -56, 30, 12, PALETTE.hillFar],
    [64, -60, 36, 10, PALETTE.hillFar],
    [-42, -40, 24, 7, PALETTE.hill],
    [4, -42, 26, 6, PALETTE.hill],
    [44, -40, 22, 8, PALETTE.hill],
  ]
  for (const [x, z, w, h, color] of hills) {
    const hill = new THREE.Mesh(hillGeo, mat(color))
    hill.position.set(x, -15, z)
    hill.scale.set(w, h, 12)
    g.add(hill)
  }
  return g
}

function buildClouds(): THREE.Group[] {
  const geo = new THREE.IcosahedronGeometry(1, 1)
  const material = mat(PALETTE.cloud)
  const clouds: THREE.Group[] = []
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group()
    const puffs = 3 + (i % 3)
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(geo, material)
      const s = rand(2.2, 3.8)
      puff.scale.set(s * 1.5, s * 0.7, s)
      puff.position.set((p - puffs / 2) * 3.4 + rand(-0.6, 0.6), rand(-0.5, 0.5), rand(-1, 1))
      c.add(puff)
    }
    c.position.set(-95 + i * 30 + rand(-6, 6), rand(9, 24), rand(-110, -70))
    clouds.push(c)
  }
  return clouds
}

/** A rolling low-poly sea. One plane, widened toward the horizon so facets
 *  stay a similar size on screen; vertices are displaced every frame. */
function buildSea(detail: number) {
  const cols = Math.round(72 * detail)
  const rows = Math.round(46 * detail)
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const baseX = new Float32Array(n)
  const baseZ = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const u = pos.getX(i) // -0.5..0.5
    const v = 0.5 - pos.getZ(i) // 0 near … 1 far
    const depth = v * v // more rows close to the camera
    const z = 14 - depth * 240
    const x = u * lerp(46, 720, depth)
    baseX[i] = x
    baseZ[i] = z
    pos.setXYZ(i, x, 0, z)
  }
  const colors = new Float32Array(n * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55 }),
  )
  mesh.frustumCulled = false
  const c = new THREE.Color()

  function update(t: number, camX: number, camZ: number) {
    // The sea slides past under the bird: sample the pattern where the
    // bird "really" is.
    const dx = t * FLY_VX
    const dz = t * FLY_VZ
    for (let i = 0; i < n; i++) {
      const x = baseX[i] - dx
      const z = baseZ[i] - dz
      const swell = Math.sin(x * 0.12 + z * 0.13) * 0.55
      const chop = Math.sin(z * 0.43 - x * 0.21 + t * 0.9) * 0.22
      const ripple = Math.sin(x * 0.6 + z * 0.33 + t * 1.6) * 0.1
      const far = clamp01(-baseZ[i] / 120)
      const h = (swell + chop + ripple) * (1 + far * 1.4)
      pos.setY(i, h)

      const lift = clamp01(h / (1.1 + far * 1.4) + 0.45)
      c.copy(PALETTE.seaDeep).lerp(PALETTE.seaMid, lift)
      if (lift > 0.82) c.lerp(PALETTE.seaCrest, (lift - 0.82) / 0.18)
      // A flickering path of light on the water, running toward the sun.
      const along = (camZ - baseZ[i]) / (camZ - SUN.z)
      const pathX = camX + (SUN.x - camX) * along
      const width = 3 + along * 16
      const inPath = 1 - Math.min(1, Math.abs(baseX[i] - pathX) / width)
      if (inPath > 0) {
        const flicker = 0.5 + 0.5 * Math.sin(i * 12.9898 + t * 2.6)
        c.lerp(PALETTE.seaGlint, inPath * flicker * 0.75)
      }
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    pos.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }
  return { mesh, update }
}

export function createBirdScene(
  canvas: HTMLCanvasElement,
  options: BirdSceneOptions,
): BirdSceneHandle {
  let animated = options.animated
  let mode = options.mode
  let anchor = options.anchor
  /** 0 = on the branch, 1 = over the sea. */
  let fly = mode === 'ocean' ? 1 : 0

  const small = Math.min(window.innerWidth, window.innerHeight) < 600
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(PALETTE.fogPerch.getHex(), 30, 260)
  const camera = new THREE.PerspectiveCamera(FOV, 2, 0.1, 400)

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xc9b79c, 1.6))
  const sunLight = new THREE.DirectionalLight(0xffd9a8, 2.2)
  sunLight.position.set(3, 5, 4)
  scene.add(sunLight)

  const land = buildLand()
  scene.add(land)
  const clouds = buildClouds()
  for (const c of clouds) scene.add(c)

  const sea = buildSea(small ? 0.62 : 1)
  const ocean = new THREE.Group()
  ocean.add(sea.mesh)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5, 28),
    new THREE.MeshBasicMaterial({ color: 0xfff3cf, fog: false }),
  )
  sunDisc.position.copy(SUN)
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(14, 28),
    new THREE.MeshBasicMaterial({ color: 0xffe2ae, fog: false, transparent: true, opacity: 0.28 }),
  )
  sunGlow.position.copy(SUN).add(new THREE.Vector3(0, 0, -1))
  ocean.add(sunDisc, sunGlow)
  ocean.visible = false
  scene.add(ocean)

  const { bird, pose, body, head, wings, eyes, tail, legs } = buildBird()
  scene.add(bird)

  // Drifting warm motes, like dust in afternoon light.
  const moteCount = small ? 40 : 90
  const motePos = new Float32Array(moteCount * 3)
  const moteSeed = new Float32Array(moteCount)
  for (let i = 0; i < moteCount; i++) {
    motePos.set([rand(-16, 16), rand(-5, 7), rand(-8, 3)], i * 3)
    moteSeed[i] = Math.random() * 10
  }
  const moteGeo = new THREE.BufferGeometry()
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.07, transparent: true, opacity: 0.7 }),
  )
  motes.frustumCulled = false
  scene.add(motes)

  // Seeds: dropped on the branch, or tossed ahead in flight.
  const seedGeo = new THREE.IcosahedronGeometry(0.075, 0)
  const seedMat = mat(PALETTE.seed)
  interface Seed {
    mesh: THREE.Mesh
    vy: number
    landed: boolean
    /** In flight: seconds until the bird goes for it. */
    chaseIn: number | null
  }
  const seeds: Seed[] = []

  function clearSeeds() {
    for (const s of seeds) scene.remove(s.mesh)
    seeds.length = 0
  }

  function dropSeeds(n: number) {
    const flying = fly > 0.05
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(seedGeo, seedMat)
      mesh.scale.set(1, 0.7, 1.4)
      if (flying) {
        mesh.position.set(
          bird.position.x - rand(1, 2),
          bird.position.y + rand(1.2, 2),
          bird.position.z + rand(0.2, 0.9),
        )
      } else {
        mesh.position.set(SEED_X + rand(-0.18, 0.18), rand(2.4, 3), rand(-0.04, 0.08))
      }
      mesh.rotation.set(rand(0, 3), rand(0, 3), 0)
      scene.add(mesh)
      seeds.push({ mesh, vy: 0, landed: false, chaseIn: flying ? 0.35 + i * 0.4 : null })
    }
  }

  // --- Animation state ----------------------------------------------------
  let phase: Phase = 'idle'
  let phaseT = 0
  let perchX = HOME_X
  let perchYaw = HOME_YAW
  let fromX = HOME_X
  let toX = HOME_X
  let fromYaw = HOME_YAW
  let toYaw = HOME_YAW
  let pecks = 0
  let nextBlink = rand(2, 4)
  let blinkT = -1
  let nextLook = rand(1.5, 3)
  const look = { yaw: 0, tilt: 0 }
  let lookTarget = { yaw: 0, tilt: 0 }
  let nextRuffle = rand(6, 12)
  let ruffleT = -1
  /** Counts down after a mid-air snack: a pleased little wing-waggle. */
  let waggleT = 0
  const headWorld = new THREE.Vector3()

  function go(next: Phase) {
    phase = next
    phaseT = 0
  }

  function startHop(x: number, yaw: number, next: Phase) {
    fromX = perchX
    toX = x
    fromYaw = perchYaw
    toYaw = yaw
    go(next)
  }

  function update(dt: number, t: number) {
    phaseT += dt

    // Blend toward the requested place — but finish any snack on the branch
    // before leaving it.
    const target = mode === 'ocean' ? 1 : 0
    if (fly !== target && (target === 0 || phase === 'idle' || fly > 0)) {
      const d = dt / FLY_SECONDS
      fly = target > fly ? Math.min(1, fly + d) : Math.max(0, fly - d)
    }
    const aloft = step(0, 0.12, fly) // wings open, feet off the branch
    const cruising = step(0.55, 1, fly)

    // Breathing.
    const breath = 1 + Math.sin(t * 2.2) * 0.02
    const fluff = phase === 'happy' ? 1 + 0.08 * Math.sin(Math.min(phaseT, 1) * Math.PI) : 1
    body.scale.set(fluff, breath * fluff, fluff)

    // Blinks.
    nextBlink -= dt
    if (nextBlink <= 0) {
      blinkT = 0
      nextBlink = rand(2.5, 5.5)
    }
    if (blinkT >= 0) {
      blinkT += dt
      const s = blinkT < 0.07 ? 1 - blinkT / 0.07 : Math.min(1, (blinkT - 0.07) / 0.07)
      for (const e of eyes) e.scale.y = Math.max(0.1, s)
      if (blinkT > 0.14) blinkT = -1
    }

    // Idle glances and curious head tilts.
    nextLook -= dt
    if (nextLook <= 0 && phase === 'idle') {
      lookTarget =
        fly > 0.5
          ? { yaw: rand(-0.2, 0.7), tilt: 0 }
          : { yaw: rand(-0.7, 0.7), tilt: Math.random() < 0.35 ? rand(-0.35, 0.35) : 0 }
      nextLook = rand(1.8, 4)
    }

    // Occasional wing ruffle while perched.
    nextRuffle -= dt
    if (nextRuffle <= 0 && phase === 'idle' && fly === 0) {
      ruffleT = 0
      nextRuffle = rand(8, 16)
    }
    let flap = 0
    if (ruffleT >= 0) {
      ruffleT += dt
      flap = Math.sin(ruffleT * 30) * 0.25 * (1 - ruffleT / 0.5)
      if (ruffleT > 0.5) ruffleT = -1
    }

    // Seeds.
    bird.updateWorldMatrix(true, true)
    head.getWorldPosition(headWorld)
    for (let i = seeds.length - 1; i >= 0; i--) {
      const s = seeds[i]
      if (s.chaseIn !== null) {
        // Tossed in flight: drift, then get snapped up.
        s.chaseIn -= dt
        s.mesh.rotation.x += dt * 5
        if (s.chaseIn > 0) {
          s.mesh.position.y -= dt * 0.5
        } else {
          s.mesh.position.lerp(headWorld, Math.min(1, dt * 7))
          if (s.mesh.position.distanceTo(headWorld) < 0.22) {
            scene.remove(s.mesh)
            seeds.splice(i, 1)
            if (!seeds.some((x) => x.chaseIn !== null)) {
              options.onChirp()
              waggleT = 1.2
            }
          }
        }
        continue
      }
      if (s.landed) continue
      s.vy -= 9 * dt
      s.mesh.position.y += s.vy * dt
      s.mesh.rotation.x += dt * 6
      const floor = BRANCH_TOP + 0.04
      if (s.mesh.position.y <= floor) {
        s.mesh.position.y = floor
        if (Math.abs(s.vy) > 1) s.vy = -s.vy * 0.3
        else s.landed = true
      }
    }

    // Perch behaviour.
    let pitch = 0
    let hopY = 0
    switch (phase) {
      case 'watch':
        lookTarget = { yaw: -0.9, tilt: -0.3 } // eyes on the seeds
        if (phaseT > 0.7 && fly === 0) startHop(SEED_X + 0.55, -Math.PI / 2, 'hop')
        break
      case 'hop':
      case 'return': {
        const p = Math.min(1, phaseT / 0.55)
        perchX = lerp(fromX, toX, ease(p))
        perchYaw = lerp(fromYaw, toYaw, ease(p))
        hopY = Math.sin(p * Math.PI) * 0.35
        flap = Math.sin(phaseT * 40) * 0.5 * Math.sin(p * Math.PI)
        lookTarget = { yaw: 0, tilt: 0 }
        if (p >= 1) {
          if (phase === 'hop') {
            pecks = 0
            go('peck')
          } else go('idle')
        }
        break
      }
      case 'peck': {
        const cycle = 0.42
        const p = (phaseT % cycle) / cycle
        pitch = Math.sin(p * Math.PI) * 0.95
        lookTarget = { yaw: 0, tilt: 0 }
        const done = Math.floor(phaseT / cycle)
        if (done > pecks) {
          pecks = done
          const landed = seeds.findIndex((s) => s.landed)
          if (landed >= 0) {
            scene.remove(seeds[landed].mesh)
            seeds.splice(landed, 1)
          }
          if (seeds.length === 0) {
            options.onChirp()
            go('happy')
          }
        }
        break
      }
      case 'happy':
        hopY = Math.abs(Math.sin(phaseT * 9)) * 0.12 * Math.max(0, 1 - phaseT / 1.1)
        flap = Math.sin(phaseT * 34) * 0.45 * Math.max(0, 1 - phaseT / 0.9)
        // Turn to face you, pleased.
        lookTarget = { yaw: perchYaw < -1 ? 1.0 : -0.3, tilt: 0.25 }
        if (phaseT > 2) {
          if (Math.abs(perchX - HOME_X) > 0.01) startHop(HOME_X, HOME_YAW, 'return')
          else go('idle')
        }
        break
    }

    // Flight: hard flapping on the way up, then long glides with easy beats.
    const beat = Math.sin(t * 9)
    const effort = lerp(1, 0.45 + 0.3 * Math.max(0, Math.sin(t * 0.45)), cruising)
    const flightFlap = 0.15 + beat * 0.75 * effort
    waggleT = Math.max(0, waggleT - dt)
    const waggle = Math.sin(waggleT * 16) * 0.35 * Math.min(1, waggleT)
    const bank = Math.sin(t * 0.37) * 0.22 * cruising + waggle
    const climb = Math.sin(clamp01(fly / 0.6) * Math.PI) // up and over
    const flyY = lerp(0, 1.0, step(0, 0.35, fly)) + climb * 0.5 - beat * 0.07 * aloft
    const flyX = Math.sin(t * 0.37) * 0.3 * cruising

    bird.position.set(perchX + flyX, hopY + flyY, 0)
    bird.rotation.y = lerp(perchYaw, FLY_YAW, step(0.08, 0.6, fly)) - bank * 0.4
    pose.rotation.x = lerp(0, 0.75, step(0.04, 0.4, fly)) - climb * 0.3
    pose.rotation.z = bank

    look.yaw = lerp(look.yaw, lookTarget.yaw, Math.min(1, dt * 6))
    look.tilt = lerp(look.tilt, lookTarget.tilt, Math.min(1, dt * 6))
    // In flight the head lifts to look where it's going.
    head.rotation.set(pitch - 0.55 * aloft, look.yaw, look.tilt)
    head.position.set(0, 1.0 - pitch * 0.28, 0.2 + pitch * 0.18)
    tail.rotation.x = -Math.sin(t * 2.2) * 0.04 + pitch * 0.25 - 0.25 * aloft

    for (const [i, w] of wings.entries()) {
      const side = i === 0 ? -1 : 1
      w.pivot.rotation.z = side * lerp(flap, flightFlap, aloft)
      w.span.visible = aloft > 0.02
      w.span.scale.set(Math.max(0.05, aloft), 1, Math.max(0.3, aloft))
      w.folded.visible = aloft < 0.6
    }
    legs.scale.setScalar(Math.max(0.001, 1 - aloft))

    // The land drops away; the sea comes up to meet the bird.
    const sink = step(0.05, 0.55, fly)
    land.visible = sink < 1
    land.position.set(0, -60 * sink * sink, 0)
    land.rotation.z = Math.sin(t * 0.6) * 0.012 * (1 - aloft)
    const rise = step(0.4, 1, fly)
    ocean.visible = rise > 0
    ocean.position.y = lerp(-55, SEA_Y, 1 - (1 - rise) ** 2)
    ocean.position.z = Math.max(0, camera.position.z - 11)
    if (ocean.visible) sea.update(t, camera.position.x, camera.position.z)
    ;(scene.fog as THREE.Fog).color.copy(PALETTE.fogPerch).lerp(PALETTE.fogOcean, rise)

    for (const c of clouds) {
      c.position.x += dt * (0.5 + fly * 1.2)
      if (c.position.x > 110) c.position.x = -110
    }

    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3 + 1] += dt * 0.06
      motePos[i * 3] += Math.sin(t * 0.3 + moteSeed[i]) * dt * 0.05
      motePos[i * 3] += dt * 3 * fly // streaming past in flight
      if (motePos[i * 3 + 1] > 7) motePos[i * 3 + 1] = -5
      if (motePos[i * 3] > 16) motePos[i * 3] = -16
    }
    moteGeo.attributes.position.needsUpdate = true

    // Camera rises a little over the water for more sea, less sky.
    camera.position.y = lerp(1.2, 2.1, step(0.4, 1, fly))
    camera.lookAt(0, 0.65 + lerp(0, 1.0, step(0, 0.35, fly)), 0)
  }

  // --- Rendering ----------------------------------------------------------
  let viewW = 0
  let viewH = 0

  /** Frame the bird at the anchor: distance sets its size, a view offset
   *  slides it across the screen without distorting perspective. */
  function frameCamera() {
    if (viewW === 0 || viewH === 0) return
    camera.aspect = viewW / viewH
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const dist = (BIRD_HEIGHT * viewH) / (anchor.size * 2 * tan)
    camera.position.set(0, camera.position.y, dist)
    camera.setViewOffset(
      viewW,
      viewH,
      viewW * (0.5 - anchor.x),
      viewH * (0.5 - anchor.y),
      viewW,
      viewH,
    )
  }

  function still() {
    update(0, 0)
    renderer.render(scene, camera)
  }

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    viewW = w
    viewH = h
    renderer.setSize(w, h, false)
    frameCamera()
    if (!animated) still()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  const clock = new THREE.Clock()
  let raf = 0
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05)
    update(dt, clock.elapsedTime)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }

  function settle() {
    clearSeeds()
    go('idle')
    perchX = HOME_X
    perchYaw = HOME_YAW
    fly = mode === 'ocean' ? 1 : 0
    waggleT = 0
    ruffleT = -1
    blinkT = -1
    for (const e of eyes) e.scale.y = 1
    lookTarget = { yaw: 0, tilt: fly ? 0 : 0.15 }
    look.yaw = lookTarget.yaw
    look.tilt = lookTarget.tilt
  }

  function setAnimated(on: boolean) {
    animated = on
    cancelAnimationFrame(raf)
    if (on) {
      clock.getDelta()
      raf = requestAnimationFrame(frame)
    } else {
      // Settle into a calm pose and render one still frame.
      settle()
      still()
    }
  }
  setAnimated(animated)

  // Tap the bird to say hello.
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  function onPointer(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    if (raycaster.intersectObject(bird, true).length === 0) return
    options.onChirp()
    if (!animated) return
    if (fly > 0.5) waggleT = 1.2
    else if (phase === 'idle' && fly === 0) go('happy')
  }
  canvas.addEventListener('pointerdown', onPointer)

  return {
    feed() {
      if (!animated) {
        options.onChirp()
        return
      }
      dropSeeds(3)
      if (fly <= 0.05 && (phase === 'idle' || phase === 'happy' || phase === 'return')) go('watch')
    },
    setAnimated,
    setMode(next) {
      if (next === mode) return
      mode = next
      if (!animated) {
        settle()
        still()
      }
    },
    setAnchor(next) {
      anchor = next
      frameCamera()
      if (!animated) still()
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointer)
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose()
          const m = o.material as THREE.Material | THREE.Material[]
          ;(Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
        }
      })
      seedGeo.dispose()
      seedMat.dispose()
      renderer.dispose()
    },
  }
}
