import * as THREE from 'three'

/**
 * A small low-poly bird on a branch, built entirely from primitives — no
 * model files, no textures. Lazy-loaded (with three.js) by BirdScene.tsx so
 * the Focus tab paints before any 3D code arrives.
 *
 * Feeding is a tiny state machine:
 *   idle → watch (looks at the falling seeds) → hop → peck ×n → happy → return
 * In still mode (Calm Mode / reduced motion) nothing animates: the scene
 * renders single frames on demand and feeding just chirps.
 */

export interface BirdSceneOptions {
  animated: boolean
  /** Called when the bird is pleased (after eating, or when tapped). */
  onChirp: () => void
}

export interface BirdSceneHandle {
  feed: () => void
  setAnimated: (on: boolean) => void
  dispose: () => void
}

const PALETTE = {
  back: 0x8a6a52,
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
}

const BRANCH_TOP = 0.12
const HOME_X = -0.2
const SEED_X = 1.25

type Phase = 'idle' | 'watch' | 'hop' | 'peck' | 'happy' | 'return'

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 })
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function buildBird() {
  const bird = new THREE.Group()

  // Body: an egg, slightly longer front-to-back.
  const body = new THREE.Group()
  body.position.y = 0.52
  bird.add(body)
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
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.5), mat(i === 1 ? PALETTE.back : 0x7a5c47))
    f.position.set(Math.sin(yaw) * 0.16, 0, -0.2)
    f.rotation.set(-0.5, yaw, 0)
    tail.add(f)
  }
  bird.add(tail)

  // Wings pivot at the shoulder so they can ruffle and flutter.
  const wings: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.42, 0.72, -0.02)
    const wing = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), mat(0x7a5c47))
    wing.scale.set(0.22, 0.6, 0.95)
    wing.position.set(side * 0.02, -0.18, -0.08)
    wing.rotation.x = 0.25
    pivot.add(wing)
    bird.add(pivot)
    wings.push(pivot)
  }

  // Head with beak, eyes, highlights and blush.
  const head = new THREE.Group()
  head.position.set(0, 1.0, 0.2)
  bird.add(head)
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

  // Legs and toes gripping the branch.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 5), mat(PALETTE.leg))
    leg.position.set(side * 0.14, BRANCH_TOP + 0.09, 0.05)
    bird.add(leg)
    for (const yaw of [-0.4, 0, 0.4]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 4), mat(PALETTE.leg))
      toe.rotation.set(Math.PI / 2, 0, yaw)
      toe.position.set(side * 0.14 + Math.sin(yaw) * 0.05, BRANCH_TOP + 0.02, 0.09)
      bird.add(toe)
    }
  }

  return { bird, body, head, wings, eyes, tail }
}

function buildBranch(): THREE.Group {
  const g = new THREE.Group()
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 18, 7), mat(PALETTE.branch))
  limb.rotation.z = Math.PI / 2
  g.add(limb)
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.4, 5), mat(PALETTE.branch))
  twig.position.set(-2.1, 0.55, -0.1)
  twig.rotation.z = 0.6
  g.add(twig)
  const leafGeo = new THREE.IcosahedronGeometry(0.22, 0)
  const spots: [number, number, number, number][] = [
    [-2.55, 1.15, 0, 0.6],
    [-2.2, 1.05, 0.15, -0.3],
    [-1.75, 0.6, -0.1, 0.9],
    [2.4, 0.2, 0.15, -0.5],
    [2.75, 0.05, -0.15, 0.4],
    [3.2, 0.25, 0.05, -0.9],
    [-3.3, 0.18, 0.1, 0.3],
  ]
  for (const [i, [x, y, z, r]] of spots.entries()) {
    const leaf = new THREE.Mesh(leafGeo, mat(i % 2 ? PALETTE.leafLight : PALETTE.leaf))
    leaf.position.set(x, y, z)
    leaf.scale.set(1.4, 0.35, 0.8)
    leaf.rotation.set(0.3, r, r * 0.5)
    g.add(leaf)
  }
  return g
}

export function createBirdScene(
  canvas: HTMLCanvasElement,
  options: BirdSceneOptions,
): BirdSceneHandle {
  let animated = options.animated
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 50)

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xc9b79c, 1.6))
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.2)
  sun.position.set(3, 5, 4)
  scene.add(sun)

  // Everything sways together on a slow breeze.
  const world = new THREE.Group()
  scene.add(world)
  world.add(buildBranch())
  const { bird, body, head, wings, eyes, tail } = buildBird()
  bird.position.set(HOME_X, 0, 0)
  bird.rotation.y = 0.45
  world.add(bird)

  // Drifting warm motes, like dust in afternoon light.
  const moteCount = 28
  const motePos = new Float32Array(moteCount * 3)
  const moteSeed = new Float32Array(moteCount)
  for (let i = 0; i < moteCount; i++) {
    motePos.set([rand(-5, 5), rand(-0.6, 2.4), rand(-2, 1)], i * 3)
    moteSeed[i] = Math.random() * 10
  }
  const moteGeo = new THREE.BufferGeometry()
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.06, transparent: true, opacity: 0.7 }),
  )
  scene.add(motes)

  // Seeds (and their falling state).
  const seedGeo = new THREE.IcosahedronGeometry(0.075, 0)
  const seedMat = mat(PALETTE.seed)
  const seeds: { mesh: THREE.Mesh; vy: number; landed: boolean }[] = []

  function dropSeeds(n: number) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(seedGeo, seedMat)
      mesh.scale.set(1, 0.7, 1.4)
      mesh.position.set(SEED_X + rand(-0.18, 0.18), animated ? rand(2.2, 2.8) : BRANCH_TOP + 0.04, rand(-0.04, 0.08))
      mesh.rotation.set(rand(0, 3), rand(0, 3), 0)
      world.add(mesh)
      seeds.push({ mesh, vy: 0, landed: !animated })
    }
  }

  // --- Animation state ----------------------------------------------------
  let phase: Phase = 'idle'
  let phaseT = 0
  let fromX = HOME_X
  let toX = HOME_X
  let fromYaw = 0.45
  let toYaw = 0.45
  let pecks = 0
  let nextBlink = rand(2, 4)
  let blinkT = -1
  let nextLook = rand(1.5, 3)
  let look = { yaw: 0, tilt: 0 }
  let lookTarget = { yaw: 0, tilt: 0 }
  let nextRuffle = rand(6, 12)
  let ruffleT = -1

  function go(next: Phase) {
    phase = next
    phaseT = 0
  }

  function startHop(x: number, yaw: number, next: Phase) {
    fromX = bird.position.x
    toX = x
    fromYaw = bird.rotation.y
    toYaw = yaw
    go(next)
  }

  function update(dt: number, t: number) {
    phaseT += dt
    world.rotation.z = Math.sin(t * 0.6) * 0.012

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
      lookTarget = { yaw: rand(-0.7, 0.7), tilt: Math.random() < 0.35 ? rand(-0.35, 0.35) : 0 }
      nextLook = rand(1.8, 4)
    }

    // Occasional wing ruffle.
    nextRuffle -= dt
    if (nextRuffle <= 0 && phase === 'idle') {
      ruffleT = 0
      nextRuffle = rand(8, 16)
    }
    let flap = 0
    if (ruffleT >= 0) {
      ruffleT += dt
      flap = Math.sin(ruffleT * 30) * 0.25 * (1 - ruffleT / 0.5)
      if (ruffleT > 0.5) ruffleT = -1
    }

    // Seeds fall with a little bounce.
    for (const s of seeds) {
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

    let pitch = 0
    let hopY = 0
    switch (phase) {
      case 'watch':
        lookTarget = { yaw: 0.8, tilt: 0.3 } // eyes on the seeds
        if (phaseT > 0.7) startHop(SEED_X - 0.55, Math.PI / 2, 'hop')
        break
      case 'hop':
      case 'return': {
        const p = Math.min(1, phaseT / 0.55)
        bird.position.x = lerp(fromX, toX, ease(p))
        bird.rotation.y = lerp(fromYaw, toYaw, ease(p))
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
            world.remove(seeds[landed].mesh)
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
        lookTarget = { yaw: bird.rotation.y > 1 ? -1.0 : -0.3, tilt: 0.25 }
        if (phaseT > 2) {
          if (Math.abs(bird.position.x - HOME_X) > 0.01) startHop(HOME_X, 0.45, 'return')
          else go('idle')
        }
        break
    }

    bird.position.y = hopY
    look.yaw = lerp(look.yaw, lookTarget.yaw, Math.min(1, dt * 6))
    look.tilt = lerp(look.tilt, lookTarget.tilt, Math.min(1, dt * 6))
    head.rotation.set(pitch, look.yaw, look.tilt)
    head.position.set(0, 1.0 - pitch * 0.28, 0.2 + pitch * 0.18)
    tail.rotation.x = -Math.sin(t * 2.2) * 0.04 + pitch * 0.25
    wings[0].rotation.z = -flap
    wings[1].rotation.z = flap

    // Motes.
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3 + 1] += dt * 0.06
      motePos[i * 3] += Math.sin(t * 0.3 + moteSeed[i]) * dt * 0.05
      if (motePos[i * 3 + 1] > 2.6) motePos[i * 3 + 1] = -0.6
    }
    moteGeo.attributes.position.needsUpdate = true
  }

  // --- Rendering ----------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Pull back on narrow screens so the bird and seed spot both fit.
    const dist = camera.aspect < 2 ? 6.6 : 4.9
    camera.position.set(0.5, 1.2, dist)
    camera.lookAt(0.5, 0.6, 0)
    camera.updateProjectionMatrix()
    if (!animated) renderer.render(scene, camera)
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

  function setAnimated(on: boolean) {
    animated = on
    cancelAnimationFrame(raf)
    if (on) {
      clock.getDelta()
      raf = requestAnimationFrame(frame)
    } else {
      // Settle into a calm pose and render one still frame.
      for (const s of seeds) world.remove(s.mesh)
      seeds.length = 0
      go('idle')
      bird.position.set(HOME_X, 0, 0)
      bird.rotation.y = 0.45
      head.rotation.set(0, 0, 0.15)
      head.position.set(0, 1.0, 0.2)
      body.scale.set(1, 1, 1)
      for (const e of eyes) e.scale.y = 1
      wings.forEach((w) => (w.rotation.z = 0))
      world.rotation.z = 0
      renderer.render(scene, camera)
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
    if (animated && phase === 'idle') go('happy')
  }
  canvas.addEventListener('pointerdown', onPointer)

  return {
    feed() {
      if (!animated) {
        options.onChirp()
        return
      }
      dropSeeds(3)
      if (phase === 'idle' || phase === 'happy' || phase === 'return') go('watch')
    },
    setAnimated,
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
