import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { BIRD_HEIGHT, buildHearts, loadBird } from './bird'
import { buildRoom } from './room'
import { buildSea } from './sea'
import { buildLightning, buildRain } from './weather'
import { ball, painted } from './clay'

/**
 * The living scene behind the app: a cozy lo-fi diorama at dusk. Matte clay
 * shapes in twilight fog, one warm amber lamp casting soft shadows, drifting
 * fireflies, and a gentle bloom on anything that glows. Three places:
 *
 *   room   the bird tucked in its nest on a desk by a rainy window
 *   sea    the bird gliding over open water past lighthouses and boats
 *   storm  the same sea under black skies: big waves, rain, lightning
 *
 * room ↔ sea: the bird flaps up, the picture fades through a dark veil,
 * and it is somewhere else. sea ↔ storm blends continuously.
 *
 * Still mode (Calm Mode / reduced motion) renders single frames on demand.
 * Lazy-loaded with three.js by BirdScene.tsx so the app paints first.
 */

export type SceneMode = 'room' | 'sea' | 'storm'

/** Where on screen the bird should sit (fractions of the canvas) and how
 *  tall it should be in CSS pixels. */
export interface Anchor {
  x: number
  y: number
  size: number
}

export interface Ambience {
  /** Rain sound on: heavier rain on the window. */
  rainy: boolean
  /** Lofi radio playing: the little radio's dial glows. */
  radioOn: boolean
}

export interface BirdSceneOptions {
  animated: boolean
  mode: SceneMode
  anchor: Anchor
  ambience: Ambience
  /** Called when the bird is pleased (after eating, or when tapped). */
  onChirp: () => void
  /** Opacity (0..1) of the soft veil used to change place. */
  onVeil: (opacity: number) => void
  /** Brightness (0..1) of a lightning flash. */
  onFlash: (brightness: number) => void
}

export interface BirdSceneHandle {
  feed: () => void
  setAnimated: (on: boolean) => void
  setMode: (mode: SceneMode) => void
  setAnchor: (anchor: Anchor) => void
  setAmbience: (ambience: Ambience) => void
  dispose: () => void
}

const FOV = 32
const NEST_Y = 0.22
const HOME_YAW = 0.35
/** Flying left across the view, turned a little toward us. */
const FLY_YAW = -1.15
/** Wing pose at rest (the model's wings are spread; fold them down/back). */
const WING_REST = -2.05
const WING_REST_SWEEP = 0.5
const TWILIGHT = 0x1a1625
const AMBER = 0xff9e44
const FIREFLIES = 150

type Phase = 'idle' | 'watch' | 'peck' | 'happy'
type Place = 'room' | 'sea'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** 0 below a, 1 above b, smooth in between. */
const step = (a: number, b: number, v: number) => {
  const p = clamp01((v - a) / (b - a))
  return p * p * (3 - 2 * p)
}
/** Move `v` toward `target` at `rate` per second. */
const toward = (v: number, target: number, rate: number, dt: number) =>
  target > v ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt)

export async function createBirdScene(
  canvas: HTMLCanvasElement,
  options: BirdSceneOptions,
): Promise<BirdSceneHandle> {
  const bird = await loadBird()

  let animated = options.animated
  let mode = options.mode
  let anchor = options.anchor
  let ambience = options.ambience

  const small = Math.min(window.innerWidth, window.innerHeight) < 600
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  const pixelRatio = Math.min(window.devicePixelRatio, small ? 1.5 : 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(TWILIGHT)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  // Deep twilight haze: thin indoors, thick enough at sea to melt the horizon.
  const fog = new THREE.FogExp2(TWILIGHT, 0.012)
  scene.fog = fog
  const camera = new THREE.PerspectiveCamera(FOV, 2, 0.1, 500)

  // Dusk: a dim indigo sky light, and one warm amber lamp near the bird
  // that does the real lighting and casts soft shadows.
  const hemi = new THREE.HemisphereLight(0x6f6fb0, 0x2a2438, 1.1)
  const lamp = new THREE.PointLight(AMBER, 40, 15, 2)
  lamp.castShadow = true
  lamp.shadow.mapSize.setScalar(small ? 512 : 1024)
  lamp.shadow.camera.near = 0.2
  lamp.shadow.camera.far = 15
  lamp.shadow.bias = -0.003
  lamp.shadow.normalBias = 0.04
  lamp.shadow.radius = 6
  // The last of the sunset, low across the water (sea only).
  const dusk = new THREE.DirectionalLight(0xff8f6b, 0)
  scene.add(hemi, lamp, dusk)

  // Bloom: only what is brighter than the threshold glows — lamp, bulbs,
  // lighthouse lights, lightning.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4 })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(pixelRatio)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.85)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const room = buildRoom()
  const sea = buildSea()
  dusk.position.copy(sea.sunAt).setY(40)
  const rain = buildRain({
    count: small ? 260 : 520,
    min: new THREE.Vector3(-28, -3, -18),
    max: new THREE.Vector3(28, 15, 8),
    dir: new THREE.Vector3(0.38, -1, 0),
    length: 1.4,
    speed: 26,
    color: 0xcfd6dc,
  })
  const lightning = buildLightning()
  sea.group.add(rain.lines, lightning.group)
  scene.add(room.group, sea.group)

  scene.add(bird.root)
  const hearts = buildHearts()
  scene.add(hearts.group)

  // Fireflies / dust: slow warm specks drifting upward through the scene.
  const flyPos = new Float32Array(FIREFLIES * 3)
  const flyCol = new Float32Array(FIREFLIES * 3)
  const flySeed = new Float32Array(FIREFLIES * 3)
  for (let i = 0; i < FIREFLIES; i++) {
    flyPos.set([rand(-13, 13), rand(-2, 9), rand(-7, 4)], i * 3)
    flySeed.set([Math.random() * 10, rand(0.12, 0.38), rand(0.5, 1.5)], i * 3)
  }
  const flyGeo = new THREE.BufferGeometry()
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3))
  flyGeo.setAttribute('color', new THREE.BufferAttribute(flyCol, 3))
  const fireflies = new THREE.Points(
    flyGeo,
    new THREE.PointsMaterial({
      size: 0.16,
      map: painted(64, 64, (ctx, w) => {
        const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
        g.addColorStop(0, 'rgba(255,236,200,1)')
        g.addColorStop(1, 'rgba(255,236,200,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, w)
      }),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  )
  fireflies.frustumCulled = false
  scene.add(fireflies)
  const glowColour = new THREE.Color(0xffb866)

  // Seeds: dropped into the nest, or tossed ahead in flight.
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

  // --- State ---------------------------------------------------------------
  let place: Place = mode === 'room' ? 'room' : 'sea'
  /** 0 = tucked in the nest, 1 = on the wing. */
  let aloft = place === 'sea' ? 1 : 0
  let storm = mode === 'storm' ? 1 : 0
  let veil = 0
  let lastVeil = -1
  let lastFlash = -1
  let nextStrike = rand(3, 7)

  let phase: Phase = 'idle'
  let phaseT = 0
  let pecks = 0
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

  function pleased() {
    options.onChirp()
    bird.face.getWorldPosition(headWorld)
    hearts.burst(headWorld)
  }

  function dropSeeds(n: number) {
    const flying = place === 'sea' || aloft > 0.05
    for (let i = 0; i < n; i++) {
      const mesh = ball(0.13, 0.09, 0.18, 0xd2a85e)
      mesh.castShadow = true
      const at = bird.root.position
      if (flying) mesh.position.set(at.x - rand(1, 2), at.y + rand(1.2, 2), at.z + rand(0.2, 0.9))
      else mesh.position.set(rand(-0.15, 0.5), rand(2.6, 3.3), rand(0.7, 0.9))
      mesh.rotation.set(rand(0, 3), rand(0, 3), 0)
      scene.add(mesh)
      seeds.push({ mesh, vy: 0, landed: false, chaseIn: flying ? 0.35 + i * 0.4 : null })
    }
  }

  function update(dt: number, t: number) {
    phaseT += dt
    const wantSea = mode !== 'room'

    // --- Changing place ----------------------------------------------------
    // Leave the nest only once any snack is finished.
    const mayLeave = phase === 'idle' || aloft > 0
    const aloftTarget = place === 'sea' || (wantSea && mayLeave) ? 1 : 0
    aloft = toward(aloft, aloftTarget, 1 / 1.3, dt)
    const veilTarget = (place === 'room' && wantSea && aloft > 0.45) || (place === 'sea' && !wantSea) ? 1 : 0
    veil = toward(veil, veilTarget, 1 / 0.7, dt)
    if (veil >= 1 && (place === 'sea') !== wantSea) {
      place = wantSea ? 'sea' : 'room'
      aloft = 1
      clearSeeds()
    }
    storm = toward(storm, mode === 'storm' ? 1 : 0, 1 / 4, dt)
    if (veil !== lastVeil) options.onVeil((lastVeil = veil))

    const inRoom = place === 'room'
    room.group.visible = inRoom
    sea.group.visible = !inRoom

    // --- Light ---------------------------------------------------------------
    let flash = 0
    if (inRoom) {
      // The amber light sits in the desk lamp.
      const flicker = room.update(t, ambience)
      lamp.position.copy(room.bulbAt)
      lamp.intensity = 24 * flicker
      hemi.intensity = 1.5
      dusk.intensity = 0
      fog.density = 0.012
    } else {
      if (storm > 0.6 && dt > 0) {
        nextStrike -= dt
        if (nextStrike <= 0) {
          lightning.strike()
          nextStrike = rand(6, 14)
        }
      }
      flash = lightning.update(dt) * storm
      // Out here it travels with the bird, like a lantern in the dusk.
      lamp.position.set(bird.root.position.x - 1.6, bird.root.position.y + 2.2, 2.4)
      lamp.intensity = 30
      hemi.intensity = lerp(2.6, 1.5, storm) + flash * 4
      dusk.intensity = lerp(1.0, 0.2, storm)
      fog.density = lerp(0.0075, 0.011, storm)
      sea.update(t, dt, storm)
      rain.update(t, storm)
    }
    if (flash !== lastFlash) options.onFlash((lastFlash = flash))

    // Fireflies drift up, wobble sideways, and slowly pulse.
    for (let i = 0; i < FIREFLIES; i++) {
      const seed = flySeed[i * 3]
      flyPos[i * 3 + 1] += dt * flySeed[i * 3 + 1]
      flyPos[i * 3] += Math.sin(t * 0.5 * flySeed[i * 3 + 2] + seed) * dt * 0.12
      if (flyPos[i * 3 + 1] > 9) flyPos[i * 3 + 1] = -2
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * flySeed[i * 3 + 2] + seed * 3))
      flyCol.set([glowColour.r * pulse, glowColour.g * pulse, glowColour.b * pulse], i * 3)
    }
    flyGeo.attributes.position.needsUpdate = true
    flyGeo.attributes.color.needsUpdate = true

    // --- The bird's small habits ------------------------------------------------
    const breath = 1 + Math.sin(t * 2.2) * 0.015
    const fluff = phase === 'happy' ? 1 + 0.06 * Math.sin(Math.min(phaseT, 1) * Math.PI) : 1
    bird.body.scale.set(fluff, breath * fluff, fluff)

    nextLook -= dt
    if (nextLook <= 0 && phase === 'idle') {
      lookTarget =
        aloft > 0.5
          ? { yaw: rand(-0.2, 0.7), tilt: 0 }
          : { yaw: rand(-0.7, 0.5), tilt: Math.random() < 0.35 ? rand(-0.3, 0.3) : 0 }
      nextLook = rand(1.8, 4)
    }

    nextRuffle -= dt
    if (nextRuffle <= 0 && phase === 'idle' && aloft === 0) {
      ruffleT = 0
      nextRuffle = rand(8, 16)
    }
    let flap = 0
    if (ruffleT >= 0) {
      ruffleT += dt
      flap = Math.sin(ruffleT * 30) * 0.25 * (1 - ruffleT / 0.5)
      if (ruffleT > 0.5) ruffleT = -1
    }

    // --- Seeds -----------------------------------------------------------------
    bird.root.updateWorldMatrix(true, true)
    bird.face.getWorldPosition(headWorld)
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
              pleased()
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
      const floor = 0.6
      if (s.mesh.position.y <= floor) {
        s.mesh.position.y = floor
        if (Math.abs(s.vy) > 1) s.vy = -s.vy * 0.3
        else s.landed = true
      }
    }

    // --- Eating in the nest ----------------------------------------------------
    let pitch = 0
    let hopY = 0
    switch (phase) {
      case 'watch':
        lookTarget = { yaw: -0.2, tilt: 0.25 } // eyes on the seeds
        if (phaseT > 0.9 && seeds.every((s) => s.landed)) {
          pecks = 0
          go('peck')
        }
        break
      case 'peck': {
        const cycle = 0.42
        const p = (phaseT % cycle) / cycle
        pitch = Math.sin(p * Math.PI) * 0.9
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
            pleased()
            go('happy')
          }
        }
        break
      }
      case 'happy':
        hopY = Math.abs(Math.sin(phaseT * 9)) * 0.1 * Math.max(0, 1 - phaseT / 1.1)
        flap = Math.sin(phaseT * 34) * 0.4 * Math.max(0, 1 - phaseT / 0.9)
        lookTarget = { yaw: -0.3, tilt: 0.25 } // turn to face you, pleased
        if (phaseT > 2) go('idle')
        break
    }

    // --- Flight ----------------------------------------------------------------
    // Hard flapping on the way up, then long glides with easy beats.
    const open = step(0, 0.25, aloft)
    const cruising = inRoom ? 0 : 1
    const beat = Math.sin(t * 9)
    const effort = lerp(1, 0.5 + 0.3 * Math.max(0, Math.sin(t * 0.45)) + storm * 0.25, cruising)
    waggleT = Math.max(0, waggleT - dt)
    const waggle = Math.sin(waggleT * 16) * 0.35 * Math.min(1, waggleT)
    // The storm knocks it about a bit.
    const gust = storm * Math.sin(t * 1.7) * 0.12
    const bank = (Math.sin(t * 0.37) * 0.2 + gust) * cruising + waggle
    // Resting: a slow, smooth bob, as if breathing with its whole body.
    const idleBob = Math.sin(t * 1.5) * 0.035 * (1 - open)
    const y = inRoom
      ? NEST_Y + hopY + idleBob + aloft * 2.1
      : 1.0 - beat * 0.07 + Math.sin(t * 0.8) * 0.12 * (1 + storm)
    const x = Math.sin(t * 0.37) * 0.3 * cruising

    look.yaw = lerp(look.yaw, lookTarget.yaw, Math.min(1, dt * 4))
    look.tilt = lerp(look.tilt, lookTarget.tilt, Math.min(1, dt * 4))

    // The model's head is part of its body, so glances, tilts and pecks are
    // small turns of the whole bird.
    bird.root.position.set(x, y, 0)
    bird.root.rotation.y = lerp(HOME_YAW, FLY_YAW, step(0.1, 0.9, aloft)) - bank * 0.4 + look.yaw * 0.35 * (1 - open)
    bird.pose.rotation.x =
      0.55 * step(0.05, 0.6, aloft) -
      (inRoom ? Math.sin(aloft * Math.PI) * 0.3 : 0) +
      pitch * 0.5 +
      Math.sin(t * 1.5 + 0.8) * 0.02 * (1 - open)
    bird.pose.rotation.z = bank + look.tilt * 0.4 * (1 - open) + Math.sin(t * 0.9) * 0.015

    // Wings: folded down along the body at rest, with a tiny restless
    // shuffle; spread and beating in flight.
    const rest = WING_REST + flap * 0.6 + Math.sin(t * 2.3) * 0.025 + Math.sin(t * 0.7) * 0.02
    const beating = -0.35 + beat * 0.6 * effort
    for (const [i, pivot] of bird.wings.entries()) {
      const side = i === 0 ? -1 : 1
      pivot.rotation.z = side * lerp(rest, beating, open)
      pivot.rotation.x = lerp(WING_REST_SWEEP, 0, open)
    }
    // Tucked into the nest, the feet don't show.
    for (const leg of bird.legs) leg.visible = open > 0.1

    hearts.update(dt)

    camera.position.y = inRoom ? 1.9 : 2.2
    camera.lookAt(0, inRoom ? NEST_Y + 0.72 + aloft * 0.9 : 1.75, 0)
  }

  // --- Rendering -------------------------------------------------------------
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
    camera.setViewOffset(viewW, viewH, viewW * (0.5 - anchor.x), viewH * (0.5 - anchor.y), viewW, viewH)
    // Keep the near edge of the water just behind the camera.
    sea.group.position.z = Math.max(0, dist - 11)
  }

  function still() {
    update(0, 0)
    composer.render()
  }

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    viewW = w
    viewH = h
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w, h)
    frameCamera()
    if (!animated) still()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  const clock = new THREE.Clock()
  let raf = 0
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1)
    update(dt, clock.elapsedTime)
    composer.render(dt)
    raf = requestAnimationFrame(frame)
  }

  /** Jump straight to where things should end up (still mode). */
  function settle() {
    clearSeeds()
    hearts.clear()
    lightning.clear()
    go('idle')
    place = mode === 'room' ? 'room' : 'sea'
    aloft = place === 'sea' ? 1 : 0
    storm = mode === 'storm' ? 1 : 0
    veil = 0
    waggleT = 0
    ruffleT = -1
    lookTarget = { yaw: 0, tilt: aloft ? 0 : 0.15 }
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
    if (raycaster.intersectObject(bird.root, true).length === 0) return
    if (!animated) {
      options.onChirp()
      return
    }
    pleased()
    if (aloft > 0.5) waggleT = 1.2
    else if (phase === 'idle' && aloft === 0) go('happy')
  }
  canvas.addEventListener('pointerdown', onPointer)

  return {
    feed() {
      if (!animated) {
        options.onChirp()
        return
      }
      dropSeeds(3)
      if (place === 'room' && aloft <= 0.05 && (phase === 'idle' || phase === 'happy')) go('watch')
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
    setAmbience(next) {
      ambience = next
      if (!animated) still()
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointer)
      clearSeeds()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
          o.geometry.dispose()
          const m = o.material as THREE.Material | THREE.Material[]
          for (const x of Array.isArray(m) ? m : [m]) {
            const map = (x as THREE.MeshBasicMaterial).map
            if (map) map.dispose()
            x.dispose()
          }
        }
      })
      composer.dispose()
      target.dispose()
      renderer.dispose()
    },
  }
}
