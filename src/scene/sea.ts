import * as THREE from 'three'
import { at, ball, box, cyl, flat, halo, outline, toon, toonBands } from './toon'

/**
 * The open sea, calm or stormy. `storm` (0..1) blends everything: sky and
 * water colour, wave height, cloud colour and the lighthouse lamps. The bird flies left, so the scenery drifts right, far
 * things slower than near ones.
 */

/** How fast the water slides past under the bird. */
export const FLY_VX = 6.4
export const FLY_VZ = -2.6
export const SEA_Y = -1.7

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const CALM = {
  deep: new THREE.Color(0x0f4c88),
  mid: new THREE.Color(0x2a7bc0),
  crest: new THREE.Color(0xffffff),
  skyTop: new THREE.Color(0x4f9fe0),
  skyLow: new THREE.Color(0xe2f1f8),
  fog: new THREE.Color(0xd3e6ee),
  cloud: new THREE.Color(0xffffff),
}
const STORM = {
  deep: new THREE.Color(0x24393f),
  mid: new THREE.Color(0x496a70),
  crest: new THREE.Color(0xe6efec),
  skyTop: new THREE.Color(0x33383e),
  skyLow: new THREE.Color(0x7c8587),
  fog: new THREE.Color(0x6c7679),
  cloud: new THREE.Color(0x565c62),
}

/** Height of the water at a point — shared by the mesh and anything that
 *  floats on it. */
function swell(x: number, z: number, t: number): number {
  const sx = x - t * FLY_VX
  const sz = z - t * FLY_VZ
  return (
    Math.sin(sx * 0.12 + sz * 0.13) * 0.55 +
    Math.sin(sz * 0.43 - sx * 0.21 + t * 0.9) * 0.22 +
    Math.sin(sx * 0.6 + sz * 0.33 + t * 1.6) * 0.1
  )
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
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), toon(0x7a6a5a))
    rock.geometry.scale(w, h, d)
    g.add(at(outline(rock, 0.12), x, y, z))
  }
  // Tower: banded, tapering, with a lamp room and a cap.
  const H = 8
  for (let i = 0; i < 4; i++) {
    const r0 = lerp(1.25, 0.8, i / 4)
    const r1 = lerp(1.25, 0.8, (i + 1) / 4)
    g.add(at(cyl(r1, r0, H / 4, i % 2 ? band : body, { ink: 0.1 }, 12), 0, 2 + (i + 0.5) * (H / 4), 0))
  }
  g.add(at(cyl(1.15, 1.15, 0.25, 0x4a4038, { ink: 0.08 }, 12), 0, 2 + H + 0.1, 0))
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.0, 10), flat(0xffe9a6))
  g.add(at(outline(lampRoom, 0.08), 0, 2 + H + 0.75, 0))
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.9, 10), toon(cap))
  g.add(at(outline(roof, 0.08), 0, 2 + H + 1.7, 0))
  const glow = halo(7, 0xffd98a, 0)
  g.add(at(glow, 0, 2 + H + 0.75, 1.2))
  return { group: g, glow }
}

function boat(hull: number) {
  const g = new THREE.Group()
  g.add(at(box(3.4, 0.8, 1.2, hull, { ink: 0.08 }), 0, 0.2, 0))
  g.add(at(box(3.6, 0.2, 1.3, 0xf2ead8, { ink: 0.06 }), 0, 0.66, 0))
  g.add(at(box(1.1, 0.9, 0.9, 0xf2ead8, { ink: 0.07 }), -0.5, 1.2, 0))
  g.add(at(cyl(0.05, 0.05, 2.2, 0x4a4038, { ink: false }, 6), 0.6, 1.8, 0))
  return g
}

export function buildSea(detail: number) {
  const group = new THREE.Group()

  // --- Sky: a painted gradient far behind everything ------------------------
  const skyGeo = new THREE.PlaneGeometry(1600, 150, 1, 1)
  const skyColors = new Float32Array(12)
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3))
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))
  sky.position.set(0, 60, -290)
  sky.frustumCulled = false
  group.add(sky)

  // --- Water ------------------------------------------------------------------
  const cols = Math.round(76 * detail)
  const rows = Math.round(48 * detail)
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const baseX = new Float32Array(n)
  const baseZ = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const u = pos.getX(i)
    const v = 0.5 - pos.getZ(i) // 0 near … 1 far
    const depth = v * v // more rows close to the camera
    baseX[i] = u * lerp(46, 760, depth)
    baseZ[i] = 14 - depth * 250
    pos.setXYZ(i, baseX[i], 0, baseZ[i])
  }
  const colors = new Float32Array(n * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const water = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }),
  )
  water.position.y = SEA_Y
  water.frustumCulled = false
  group.add(water)

  // --- Scenery that drifts past ----------------------------------------------
  const left = lighthouse(0xe9dcc4, 0x9a6a4a, 0x6a4a3a)
  const right = lighthouse(0xf2ead8, 0xc0503a, 0x4f7a5a)
  left.group.scale.setScalar(0.9)
  const drifters: { obj: THREE.Object3D; x: number; z: number; speed: number; wrap: number; floats: boolean }[] = [
    { obj: left.group, x: -26, z: -70, speed: 0.7, wrap: 95, floats: false },
    { obj: right.group, x: 34, z: -88, speed: 0.55, wrap: 115, floats: false },
    { obj: boat(0x6f8fa3), x: -19, z: -44, speed: 1.3, wrap: 62, floats: true },
    { obj: boat(0xc0503a), x: 23, z: -38, speed: 1.5, wrap: 56, floats: true },
  ]
  for (const d of drifters) group.add(d.obj)
  // Distant headland.
  const headland = ball(170, 16, 30, 0x6f8a94, { ink: false })
  group.add(at(headland, 120, SEA_Y, -230))

  // Clouds.
  // Self-lit a little, so the undersides stay soft rather than grey.
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonBands(), emissive: 0xffffff, emissiveIntensity: 0.45 })
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

  const deep = new THREE.Color()
  const mid = new THREE.Color()
  const crest = new THREE.Color()
  const top = new THREE.Color()
  const low = new THREE.Color()
  const c = new THREE.Color()
  const fog = new THREE.Color()

  function update(t: number, dt: number, storm: number) {
    deep.copy(CALM.deep).lerp(STORM.deep, storm)
    mid.copy(CALM.mid).lerp(STORM.mid, storm)
    crest.copy(CALM.crest).lerp(STORM.crest, storm)
    top.copy(CALM.skyTop).lerp(STORM.skyTop, storm)
    low.copy(CALM.skyLow).lerp(STORM.skyLow, storm)
    fog.copy(CALM.fog).lerp(STORM.fog, storm)
    cloudMat.color.copy(CALM.cloud).lerp(STORM.cloud, storm)
    cloudMat.emissive.copy(cloudMat.color)

    // Plane vertices: top-left, top-right, bottom-left, bottom-right.
    for (const [i, col] of [top, top, low, low].entries()) skyColors.set([col.r, col.g, col.b], i * 3)
    skyGeo.attributes.color.needsUpdate = true

    const rough = 1 + storm * 1.5
    for (let i = 0; i < n; i++) {
      const far = clamp01(-baseZ[i] / 120)
      const h = swell(baseX[i], baseZ[i], t) * rough * (1 + far * 1.4)
      pos.setY(i, h)
      const lift = clamp01(h / (rough * (1.1 + far * 1.4)) + 0.45)
      c.copy(deep).lerp(mid, lift)
      // Foam on the crests; more of it when the sea is up.
      const foamAt = 0.9 - storm * 0.06 + far * 0.05
      if (lift > foamAt) c.lerp(crest, Math.min(1, (lift - foamAt) / 0.06))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    pos.needsUpdate = true
    geo.attributes.color.needsUpdate = true

    for (const d of drifters) {
      d.x += dt * d.speed
      if (d.x > d.wrap) d.x = -d.wrap
      const h = d.floats ? swell(d.x, d.z, t) * rough : 0
      d.obj.position.set(d.x, SEA_Y + h * 0.8 - (d.floats ? 0.1 : 0.4), d.z)
      if (d.floats) d.obj.rotation.z = Math.sin(t * 1.1 + d.x) * 0.08 * rough
    }
    const lampGlow = storm * (0.45 + 0.1 * Math.sin(t * 2.3))
    ;(left.glow.material as THREE.MeshBasicMaterial).opacity = lampGlow
    ;(right.glow.material as THREE.MeshBasicMaterial).opacity = lampGlow

    for (const cl of clouds) {
      cl.position.x += dt * (0.9 + storm * 1.6)
      if (cl.position.x > 150) cl.position.x = -150
    }

    return fog
  }

  return { group, update }
}
