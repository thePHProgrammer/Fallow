import * as THREE from 'three'

interface RainOptions {
  count: number
  min: THREE.Vector3
  max: THREE.Vector3
  /** Direction of fall (need not be normalised). */
  dir: THREE.Vector3
  length: number
  speed: number
  color: number
}

/** Rain as short streaks falling through a box and wrapping around. */
export function buildRain(o: RainOptions) {
  const dir = o.dir.clone().normalize()
  const size = o.max.clone().sub(o.min)
  const seeds = new Float32Array(o.count * 4)
  for (let i = 0; i < o.count; i++) {
    seeds.set([Math.random(), Math.random(), Math.random(), 0.7 + Math.random() * 0.6], i * 4)
  }
  const positions = new Float32Array(o.count * 6)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({ color: o.color, transparent: true, opacity: 0.5 })
  const lines = new THREE.LineSegments(geo, material)
  lines.frustumCulled = false

  /** `amount` 0..1 scales how many streaks show and how bright they are. */
  function update(t: number, amount: number) {
    lines.visible = amount > 0.01
    if (!lines.visible) return
    geo.setDrawRange(0, Math.max(2, Math.floor(o.count * Math.min(1, amount)) * 2))
    material.opacity = 0.25 + 0.3 * Math.min(1, amount)
    for (let i = 0; i < o.count; i++) {
      const fall = (seeds[i * 4 + 1] + (t * o.speed * seeds[i * 4 + 3]) / size.y) % 1
      const y = o.max.y - fall * size.y
      // Drift sideways with the fall so slanted rain stays slanted.
      const drift = (dir.x / -dir.y) * fall * size.y
      const x = o.min.x + ((seeds[i * 4] * size.x + drift) % size.x)
      const z = o.min.z + seeds[i * 4 + 2] * size.z
      const len = o.length * seeds[i * 4 + 3]
      positions.set([x, y, z, x + dir.x * len, y + dir.y * len, z + dir.z * len], i * 6)
    }
    geo.attributes.position.needsUpdate = true
  }

  return { lines, update }
}

/** A branching lightning bolt far out over the water. `strike()` reshapes
 *  it; `update()` returns the flash brightness (0..1) for the sky. */
export function buildLightning() {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: 0xf6f8ff, fog: false })
  const geo = new THREE.CylinderGeometry(1, 1, 1, 5)
  const segments = Array.from({ length: 22 }, () => {
    const m = new THREE.Mesh(geo, material)
    group.add(m)
    return m
  })
  group.visible = false
  const up = new THREE.Vector3(0, 1, 0)
  let age = -1

  function span(i: number, a: THREE.Vector3, b: THREE.Vector3, width: number) {
    const m = segments[i]
    const d = b.clone().sub(a)
    m.position.copy(a).addScaledVector(d, 0.5)
    m.scale.set(width, d.length(), width)
    m.quaternion.setFromUnitVectors(up, d.normalize())
  }

  function strike() {
    const x = (Math.random() - 0.5) * 70
    let p = new THREE.Vector3(x, 62, -170)
    let i = 0
    const forks: THREE.Vector3[] = []
    for (let s = 0; s < 12; s++) {
      const q = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 9, -5, 0))
      span(i++, p, q, 0.55 - s * 0.025)
      if (s === 3 || s === 6) forks.push(q.clone())
      p = q
    }
    for (const f of forks) {
      let a = f
      const lean = Math.random() < 0.5 ? -1 : 1
      for (let s = 0; s < 5; s++) {
        const b = a.clone().add(new THREE.Vector3(lean * (3 + Math.random() * 4), -3.5, 0))
        span(i++, a, b, 0.28)
        a = b
      }
    }
    age = 0
  }

  function update(dt: number): number {
    if (age < 0) return 0
    age += dt
    if (age > 0.45) {
      age = -1
      group.visible = false
      return 0
    }
    // Two quick pulses, like real lightning.
    const pulse = age < 0.12 ? 1 : age < 0.2 ? 0.15 : age < 0.3 ? 0.8 : (0.45 - age) / 0.15 * 0.5
    group.visible = pulse > 0.3
    return pulse
  }

  function clear() {
    age = -1
    group.visible = false
  }

  return { group, strike, update, clear }
}
