import * as THREE from 'three'
import { BIRD_HEIGHT, buildBird, buildHearts } from './bird'
import { buildRoom } from './room'
import { buildSea } from './sea'
import { buildLightning, buildRain } from './weather'
import { ball } from './toon'

/**
 * The living scene behind the app, drawn like an illustration (cel shading
 * and ink outlines; see toon.ts). Three places:
 *
 *   room   the robin tucked in its nest on a desk by a rainy window
 *   sea    the robin gliding over open water past lighthouses and boats
 *   storm  the same sea under dark skies: big waves, rain, lightning
 *
 * room ↔ sea: the robin flaps up, the picture fades through a soft veil,
 * and it is somewhere else. sea ↔ storm blends continuously.
 *
 * Still mode (Calm Mode / reduced motion) renders single frames on demand.
 * Lazy-loaded with three.js by BirdScene.tsx so the app paints first.
 */

export type SceneMode = 'room' | 'sea' | 'storm'

/** Where on screen the robin should sit (fractions of the canvas) and how
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
  /** Called when the robin is pleased (after eating, or when tapped). */
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
const WALL = 0xc9a377

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

export function createBirdScene(
  canvas: HTMLCanvasElement,
  options: BirdSceneOptions,
): BirdSceneHandle {
  let animated = options.animated
  let mode = options.mode
  let anchor = options.anchor
  let ambience = options.ambience

  const small = Math.min(window.innerWidth, window.innerHeight) < 600
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(WALL)

  const scene = new THREE.Scene()
  const fog = new THREE.Fog(0xd3e6ee, 40, 300)
  const camera = new THREE.PerspectiveCamera(FOV, 2, 0.1, 500)

  const hemi = new THREE.HemisphereLight(0xffffff, 0x9ab4c4, 1.6)
  const sun = new THREE.DirectionalLight(0xfff4e0, 2)
  sun.position.set(-3, 6, 6)
  scene.add(hemi, sun)

  const room = buildRoom()
  const sea = buildSea(small ? 0.62 : 1)
  const rain = buildRain({
    count: small ? 260 : 520,
    min: new THREE.Vector3(-28, -3, -18),
    max: new THREE.Vector3(28, 15, 8),
    dir: new THREE.Vector3(0.38, -1, 0),
    length: 1.4,
    speed: 26,
    color: 0xe3ebf0,
  })
  const lightning = buildLightning()
  sea.group.add(rain.lines, lightning.group)
  scene.add(room.group, sea.group)

  const bird = buildBird()
  scene.add(bird.root)
  const hearts = buildHearts()
  scene.add(hearts.group)

  // Seeds: dropped into the nest, or tossed ahead in flight.
  interface Seed {
    mesh: THREE.Mesh
    vy: number
    landed: boolean
    /** In flight: seconds until the robin goes for it. */
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

  function pleased() {
    options.onChirp()
    bird.head.getWorldPosition(headWorld)
    hearts.burst(headWorld)
  }

  function dropSeeds(n: number) {
    const flying = place === 'sea' || aloft > 0.05
    for (let i = 0; i < n; i++) {
      const mesh = ball(0.13, 0.09, 0.18, 0xd2a85e, { ink: 0.015 })
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
    scene.fog = inRoom ? null : fog

    // --- Light ---------------------------------------------------------------
    let flash = 0
    if (inRoom) {
      hemi.color.set(0xfff0dc)
      hemi.groundColor.set(0x6a4a34)
      hemi.intensity = 1.2
      sun.color.set(0xffd9b0)
      sun.intensity = 0.5
      room.update(t, ambience)
    } else {
      if (storm > 0.6 && dt > 0) {
        nextStrike -= dt
        if (nextStrike <= 0) {
          lightning.strike()
          nextStrike = rand(6, 14)
        }
      }
      flash = lightning.update(dt) * storm
      hemi.color.set(0xffffff)
      hemi.groundColor.set(0x9ab4c4)
      hemi.intensity = lerp(1.7, 0.95, storm) + flash * 1.2
      sun.color.set(0xfff4e0)
      sun.intensity = lerp(2, 0.5, storm)
      fog.color.copy(sea.update(t, dt, storm))
      renderer.setClearColor(fog.color)
      rain.update(t, storm)
    }
    if (inRoom) renderer.setClearColor(WALL)
    if (flash !== lastFlash) options.onFlash((lastFlash = flash))

    // --- The robin's small habits ---------------------------------------------
    const breath = 1 + Math.sin(t * 2.2) * 0.02
    const fluff = phase === 'happy' ? 1 + 0.08 * Math.sin(Math.min(phaseT, 1) * Math.PI) : 1
    bird.body.scale.set(fluff, breath * fluff, fluff)

    nextBlink -= dt
    if (nextBlink <= 0) {
      blinkT = 0
      nextBlink = rand(2.5, 5.5)
    }
    if (blinkT >= 0) {
      blinkT += dt
      const s = blinkT < 0.07 ? 1 - blinkT / 0.07 : Math.min(1, (blinkT - 0.07) / 0.07)
      for (const e of bird.eyes) e.scale.y = Math.max(0.1, s)
      if (blinkT > 0.14) blinkT = -1
    }

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
    bird.head.getWorldPosition(headWorld)
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
    const flightFlap = 0.2 + beat * 0.75 * effort
    waggleT = Math.max(0, waggleT - dt)
    const waggle = Math.sin(waggleT * 16) * 0.35 * Math.min(1, waggleT)
    // The storm knocks it about a bit.
    const gust = storm * Math.sin(t * 1.7) * 0.12
    const bank = (Math.sin(t * 0.37) * 0.2 + gust) * cruising + waggle
    const y = inRoom
      ? NEST_Y + hopY + aloft * 2.1
      : 1.0 - beat * 0.07 + Math.sin(t * 0.8) * 0.12 * (1 + storm)
    const x = Math.sin(t * 0.37) * 0.3 * cruising

    bird.root.position.set(x, y, 0)
    bird.root.rotation.y = lerp(HOME_YAW, FLY_YAW, step(0.1, 0.9, aloft)) - bank * 0.4
    bird.pose.rotation.x = 0.75 * step(0.05, 0.6, aloft) - (inRoom ? Math.sin(aloft * Math.PI) * 0.3 : 0)
    bird.pose.rotation.z = bank

    look.yaw = lerp(look.yaw, lookTarget.yaw, Math.min(1, dt * 6))
    look.tilt = lerp(look.tilt, lookTarget.tilt, Math.min(1, dt * 6))
    // In flight the head lifts to look where it's going.
    bird.head.rotation.set(pitch - 0.55 * open, look.yaw, look.tilt)
    bird.head.position.set(0, 1.0 - pitch * 0.28, 0.2 + pitch * 0.18)
    bird.tail.rotation.x = -Math.sin(t * 2.2) * 0.04 + pitch * 0.25 - 0.25 * open

    for (const [i, w] of bird.wings.entries()) {
      const side = i === 0 ? -1 : 1
      w.pivot.rotation.z = side * lerp(flap, flightFlap, open)
      w.span.visible = open > 0.02
      w.span.scale.set(Math.max(0.05, open), 1, Math.max(0.3, open))
      w.folded.visible = open < 0.6
    }
    // Tucked into the nest, the feet don't show.
    bird.legs.visible = open > 0.1

    hearts.update(dt)

    camera.position.y = inRoom ? 1.9 : 2.2
    camera.lookAt(0, inRoom ? NEST_Y + 0.72 + aloft * 0.9 : 1.75, 0)
  }

  // --- Rendering -------------------------------------------------------------
  let viewW = 0
  let viewH = 0

  /** Frame the robin at the anchor: distance sets its size, a view offset
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
    const dt = Math.min(clock.getDelta(), 0.1)
    update(dt, clock.elapsedTime)
    renderer.render(scene, camera)
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
    blinkT = -1
    for (const e of bird.eyes) e.scale.y = 1
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

  // Tap the robin to say hello.
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
      renderer.dispose()
    },
  }
}
