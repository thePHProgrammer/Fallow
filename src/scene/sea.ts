import * as THREE from 'three'
import { at, ball, box, clay, cyl, flat, halo } from './clay'

/**
 * The sea at dusk, as a little diorama. `storm` (0..1) blends everything:
 * sky and water colour, wave height, clouds and the lighthouse lamps.
 * The bird flies left, so the scenery drifts right — far things slower.
 *
 * The water is one 80×80 plane whose vertices are moved every frame by four
 * overlapping Gerstner waves; `waveHeight` is the same formula, so anything
 * floating can ride the surface exactly.
 */

/** How fast the water slides past under the bird. */
export const FLY_VX = 6.4
export const FLY_VZ = -2.6
export const SEA_Y = -1.7

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (a: number, b: number, v: number) => {
  const p = clamp01((v - a) / (b - a))
  return p * p * (3 - 2 * p)
}

// --- Waves --------------------------------------------------------------------
interface Wave {
  dx: number
  dz: number
  /** Wave number (2π / wavelength). */
  k: number
  amp: number
  speed: number
  /** How much crests bunch up sideways (Gerstner steepness). */
  q: number
}

function wave(dirX: number, dirZ: number, length: number, amp: number, speed: number): Wave {
  const len = Math.hypot(dirX, dirZ)
  const k = (Math.PI * 2) / length
  return { dx: dirX / len, dz: dirZ / len, k, amp, speed, q: 0.5 / (k * amp * 4) }
}

/** A long swell, a cross swell, and two smaller chops, all heading
 *  different ways at different speeds. */
const WAVES: Wave[] = [
  wave(1, 0.3, 27, 0.5, 1.0),
  wave(-0.4, 1, 15, 0.27, 1.35),
  wave(0.7, -0.7, 8.5, 0.13, 1.8),
  wave(-0.9, -0.35, 5, 0.065, 2.3),
]
const MAX_AMP = WAVES.reduce((sum, w) => sum + w.amp, 0)

/** Phase of one wave at a point. The whole sea also slides past (the bird
 *  is flying), so the pattern is sampled where the bird "really" is. */
function phase(w: Wave, x: number, z: number, t: number): number {
  return w.k * (w.dx * (x - t * FLY_VX) + w.dz * (z - t * FLY_VZ)) - w.speed * t
}

/** Height of the water at (x, z). */
export function waveHeight(x: number, z: number, t: number, rough = 1): number {
  let y = 0
  for (const w of WAVES) y += w.amp * Math.sin(phase(w, x, z, t))
  return y * rough
}

// --- Colours --------------------------------------------------------------------
const CALM = {
  trough: new THREE.Color(0x132a3e),
  mid: new THREE.Color(0x265473),
  foam: new THREE.Color(0xf5ebe0),
  skyTop: new THREE.Color(0x2b2548),
  skyLow: new THREE.Color(0xe8946a),
  cloud: new THREE.Color(0xc99a9a),
}
const STORM = {
  trough: new THREE.Color(0x0b1820),
  mid: new THREE.Color(0x1c3643),
  foam: new THREE.Color(0xd9d2c8),
  skyTop: new THREE.Color(0x131119),
  skyLow: new THREE.Color(0x3a3442),
  cloud: new THREE.Color(0x35323e),
}

function lighthouse(body: number, band: number, cap: number) {
  const g = new THREE.Group()
  // Rocky islet.
  const rocks: [number, number, number, number, number, number][] = [
    [0, 0.6, 0, 9, 3.2, 6],
    [-5, 0.2, 1, 6, 2.2, 4],
    [5.5, 0.1, 0.5, 6.5, 2, 4.5],
    [-9.5, -0.1, 1.5, 3.5, 1.4, 3],
  ]
  for (const [x, y, z, w, h, d] of rocks) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), clay(0x5f5248))
    rock.geometry.scale(w, h, d)
    g.add(at(rock, x, y, z))
  }
  // Tower: banded, tapering, with a lamp room and a cap.
  const H = 8
  for (let i = 0; i < 4; i++) {
    const r0 = lerp(1.25, 0.8, i / 4)
    const r1 = lerp(1.25, 0.8, (i + 1) / 4)
    g.add(at(cyl(r1, r0, H / 4, i % 2 ? band : body, 12), 0, 2 + (i + 0.5) * (H / 4), 0))
  }
  g.add(at(cyl(1.15, 1.15, 0.25, 0x3a322c, 12), 0, 2 + H + 0.1, 0))
  // The lamp is unlit and bright, so the bloom makes it glow.
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.0, 10), flat(0xffe2a8)), 0, 2 + H + 0.75, 0))
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.9, 10), clay(cap)), 0, 2 + H + 1.7, 0))
  const glow = halo(6, 0xff9e44, 0.25)
  g.add(at(glow, 0, 2 + H + 0.75, 1.2))
  return { group: g, glow }
}

function boat(hull: number) {
  const g = new THREE.Group()
  g.add(at(box(3.4, 0.8, 1.2, hull), 0, 0.2, 0))
  g.add(at(box(3.6, 0.2, 1.3, 0xe6d9c4), 0, 0.66, 0))
  g.add(at(box(1.1, 0.9, 0.9, 0xe6d9c4), -0.5, 1.2, 0))
  g.add(at(cyl(0.05, 0.05, 2.2, 0x3a322c, 6), 0.6, 1.8, 0))
  // A little cabin light.
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flat(0xffd9a0)), -0.5, 1.25, 0.47))
  return g
}

export function buildSea() {
  const group = new THREE.Group()

  // --- Sky: a twilight gradient far behind everything -------------------------
  const skyGeo = new THREE.PlaneGeometry(1600, 150, 1, 1)
  const skyColors = new Float32Array(12)
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3))
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))
  sky.position.set(0, 60, -290)
  sky.frustumCulled = false
  group.add(sky)

  // The last of the sun, low on the horizon.
  const sunAt = new THREE.Vector3(-70, 5, -280)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(13, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd3a0, fog: false, transparent: true }),
  )
  sunDisc.position.copy(sunAt)
  const sunGlow = halo(70, 0xff8a5c, 0.5)
  sunGlow.position.copy(sunAt).add(new THREE.Vector3(0, 0, 1))
  group.add(sunDisc, sunGlow)

  // --- Water --------------------------------------------------------------------
  const SEG = 80
  const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const baseX = new Float32Array(n)
  const baseZ = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const u = pos.getX(i)
    const v = 0.5 - pos.getZ(i) // 0 near … 1 far
    const depth = v * v // more rows close to the camera
    // Wider toward the horizon, so it fills the view at any distance.
    baseX[i] = u * lerp(46, 760, depth)
    baseZ[i] = 14 - depth * 250
  }
  const colors = new Float32Array(n * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  // Flat-shaded and a little glossy, so each facet can catch the sunset.
  const water = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35, metalness: 0.1 }),
  )
  water.position.y = SEA_Y
  water.frustumCulled = false
  group.add(water)

  // --- Scenery that drifts past ------------------------------------------------
  const left = lighthouse(0xd9cbb4, 0x8a5f44, 0x5a4034)
  const right = lighthouse(0xe6d9c4, 0xb04a36, 0x47705a)
  left.group.scale.setScalar(0.9)
  interface Drifter {
    obj: THREE.Object3D
    x: number
    z: number
    speed: number
    wrap: number
    floats: boolean
    /** How far its foam ring reaches. */
    foam: number
  }
  const drifters: Drifter[] = [
    { obj: left.group, x: -26, z: -70, speed: 0.7, wrap: 95, floats: false, foam: 9 },
    { obj: right.group, x: 34, z: -88, speed: 0.55, wrap: 115, floats: false, foam: 10 },
    { obj: boat(0x4f6f85), x: -19, z: -44, speed: 1.3, wrap: 62, floats: true, foam: 3.4 },
    { obj: boat(0xb04a36), x: 23, z: -38, speed: 1.5, wrap: 56, floats: true, foam: 3.4 },
  ]
  for (const d of drifters) group.add(d.obj)
  // Distant headland.
  group.add(at(ball(170, 16, 30, 0x2c2f44), 120, SEA_Y, -230))

  // Clouds: soft clay puffs catching the last light.
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xc99a9a,
    roughness: 0.92,
    metalness: 0,
    fog: false,
    emissive: 0xc99a9a,
    emissiveIntensity: 0.3,
  })
  const puffGeo = new THREE.SphereGeometry(1, 12, 8)
  const clouds: THREE.Group[] = []
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group()
    const puffs = 3 + (i % 3)
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat)
      const s = 3 + Math.random() * 2.5
      puff.scale.set(s * 1.6, s * 0.75, s)
      puff.position.set((p - puffs / 2) * 5 + Math.random(), Math.random() - 0.5, Math.random() * 2)
      c.add(puff)
    }
    c.position.set(-130 + i * 32 + Math.random() * 10, 16 + Math.random() * 22, -150 + Math.random() * 50)
    clouds.push(c)
    group.add(c)
  }

  const trough = new THREE.Color()
  const mid = new THREE.Color()
  const foam = new THREE.Color()
  const top = new THREE.Color()
  const low = new THREE.Color()
  const c = new THREE.Color()

  function update(t: number, dt: number, storm: number) {
    trough.copy(CALM.trough).lerp(STORM.trough, storm)
    mid.copy(CALM.mid).lerp(STORM.mid, storm)
    // Brightened so the cream reads as foam in the low dusk light.
    foam.copy(CALM.foam).lerp(STORM.foam, storm).multiplyScalar(2.2)
    top.copy(CALM.skyTop).lerp(STORM.skyTop, storm)
    low.copy(CALM.skyLow).lerp(STORM.skyLow, storm)
    cloudMat.color.copy(CALM.cloud).lerp(STORM.cloud, storm)
    cloudMat.emissive.copy(cloudMat.color)
    sunDisc.material.opacity = 1 - storm
    ;(sunGlow.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - storm)

    // Plane vertices: top-left, top-right, bottom-left, bottom-right.
    for (const [i, col] of [top, top, low, low].entries()) skyColors.set([col.r, col.g, col.b], i * 3)
    skyGeo.attributes.color.needsUpdate = true

    // Floating things first, so the water can foam around them.
    const rough = 1 + storm * 1.4
    for (const d of drifters) {
      d.x += dt * d.speed
      if (d.x > d.wrap) d.x = -d.wrap
      if (d.floats) {
        // Buoyancy: ride the surface at this exact spot, and lean with its slope.
        const e = 0.9
        const y = waveHeight(d.x, d.z, t, rough)
        const slopeX = (waveHeight(d.x + e, d.z, t, rough) - waveHeight(d.x - e, d.z, t, rough)) / (2 * e)
        const slopeZ = (waveHeight(d.x, d.z + e, t, rough) - waveHeight(d.x, d.z - e, t, rough)) / (2 * e)
        d.obj.position.set(d.x, SEA_Y + y - 0.05, d.z)
        d.obj.rotation.set(Math.atan(slopeZ) * 0.8, 0, Math.atan(slopeX) * 0.8)
      } else {
        d.obj.position.set(d.x, SEA_Y - 0.4, d.z)
      }
    }

    // Four Gerstner waves: each lifts the surface and pulls it sideways
    // toward its crests, which is what makes them look like water.
    for (let i = 0; i < n; i++) {
      const bx = baseX[i]
      const bz = baseZ[i]
      // Swells read bigger toward the horizon so it doesn't go flat.
      const size = rough * (1 + clamp01(-bz / 120) * 1.2)
      let x = bx
      let y = 0
      let z = bz
      for (const w of WAVES) {
        const p = phase(w, bx, bz, t)
        const cos = Math.cos(p)
        x += w.q * w.amp * w.dx * cos * size
        z += w.q * w.amp * w.dz * cos * size
        y += w.amp * Math.sin(p) * size
      }
      pos.setXYZ(i, x, y, z)

      // Colour by elevation: navy troughs, ocean-blue shoulders, cream foam
      // on the crests.
      // (Four waves rarely all peak together, so scale to the usual range.)
      const elevation = clamp01(y / (MAX_AMP * size * 1.25) + 0.5)
      c.copy(trough).lerp(mid, smooth(0.15, 0.62, elevation))
      let foamy = smooth(0.74 - storm * 0.05, 0.9, elevation)
      // …and a ring of foam around anything sitting in the water.
      for (const d of drifters) {
        const dist = Math.hypot(bx - d.x, (bz - d.z) * 1.6)
        if (dist < d.foam) foamy = Math.max(foamy, (1 - dist / d.foam) ** 1.5 * 0.9)
      }
      if (foamy > 0) c.lerp(foam, foamy)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    pos.needsUpdate = true
    geo.attributes.color.needsUpdate = true

    const lampGlow = 0.25 + storm * (0.3 + 0.08 * Math.sin(t * 2.3))
    ;(left.glow.material as THREE.MeshBasicMaterial).opacity = lampGlow
    ;(right.glow.material as THREE.MeshBasicMaterial).opacity = lampGlow

    for (const cl of clouds) {
      cl.position.x += dt * (0.9 + storm * 1.6)
      if (cl.position.x > 150) cl.position.x = -150
    }
  }

  /** Direction the last sunlight comes from, for the water's highlight. */
  return { group, update, sunAt }
}
