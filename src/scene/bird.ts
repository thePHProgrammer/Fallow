import * as THREE from 'three'
import { at, ball, cyl, flat, outline, toon } from './toon'

/** The robin: round body, orange face and breast, pale belly, feathered
 *  wings that fold when resting and fan open in flight. */

const C = {
  back: 0x94683c,
  wing: 0xa67c4c,
  feather: 0xb99262,
  featherLight: 0xd2b283,
  orange: 0xf08a24,
  belly: 0xe9e3d8,
  beak: 0x4a4038,
  eye: 0x1c1714,
  leg: 0x9a5f52,
  heart: 0xe8607a,
}

export const BODY_Y = 0.52
export const BIRD_HEIGHT = 1.35

export interface Wing {
  pivot: THREE.Group
  folded: THREE.Object3D
  span: THREE.Group
}

export function buildBird() {
  // root: position + heading. pose: pitch/roll about the body centre.
  const root = new THREE.Group()
  const pose = new THREE.Group()
  pose.position.y = BODY_Y
  root.add(pose)
  const parts = new THREE.Group()
  parts.position.y = -BODY_Y
  pose.add(parts)

  const body = new THREE.Group()
  body.position.y = BODY_Y
  parts.add(body)
  body.add(ball(0.98, 0.96, 1.1, C.back))
  body.add(at(ball(0.84, 0.84, 0.78, C.orange), 0, 0.07, 0.2))
  body.add(at(ball(0.76, 0.62, 0.7, C.belly), 0, -0.19, 0.17))

  // Tail: a small fan of feathers.
  const tail = new THREE.Group()
  tail.position.set(0, 0.42, -0.48)
  for (const [i, yaw] of [-0.5, -0.25, 0, 0.25, 0.5].entries()) {
    const f = ball(0.2, 0.045, 0.62, i % 2 ? C.feather : C.wing, { ink: 0.018 })
    at(f, Math.sin(yaw) * 0.18, i * 0.004, -0.24, -0.5, yaw, 0)
    tail.add(f)
  }
  parts.add(tail)

  // Wings.
  const wings: Wing[] = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.44, 0.72, -0.02)

    const folded = at(ball(0.2, 0.52, 0.8, C.wing), side * 0.03, -0.2, -0.08, 0.25, 0, 0)
    pivot.add(folded)

    const span = new THREE.Group()
    span.add(at(ball(0.8, 0.1, 0.46, C.back, { ink: 0.02 }), side * 0.38, 0.012, 0.02))
    const n = 9
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1)
      // Inner feathers trail back toward the tail; outer ones reach outward.
      const a = -0.15 + f * 1.45
      const len = 0.5 + 0.42 * Math.sin(f * 2.2 + 0.25)
      const dx = side * Math.sin(a)
      const dz = -Math.cos(a)
      const baseX = side * (0.12 + f * 0.62)
      const feather = ball(len, 0.035, 0.2, i % 2 ? C.featherLight : C.feather, { ink: 0.018 })
      feather.position.set(baseX + (dx * len) / 2, -i * 0.004, -0.04 + (dz * len) / 2)
      feather.rotation.y = Math.atan2(-dz, dx)
      span.add(feather)
    }
    span.visible = false
    pivot.add(span)

    parts.add(pivot)
    wings.push({ pivot, folded, span })
  }

  // Head: brown cap, orange face, dark beak, glossy eye.
  const head = new THREE.Group()
  head.position.set(0, 1.0, 0.2)
  parts.add(head)
  head.add(ball(0.66, 0.64, 0.66, C.back))
  head.add(at(ball(0.6, 0.56, 0.56, C.orange), 0, -0.06, 0.09))
  const beak = outline(new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 8), toon(C.beak)), 0.012)
  head.add(at(beak, 0, -0.03, 0.4, Math.PI / 2, 0, 0))
  const eyes: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), flat(C.eye))
    eye.position.set(side * 0.18, 0.06, 0.25)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), flat(0xffffff))
    glint.position.set(side * 0.012 + 0.014, 0.022, 0.045)
    eye.add(glint)
    head.add(eye)
    eyes.push(eye)
  }

  const legs = new THREE.Group()
  for (const side of [-1, 1]) {
    legs.add(at(cyl(0.025, 0.025, 0.2, C.leg, { ink: false }, 6), side * 0.14, 0.1, 0.05))
    for (const yaw of [-0.4, 0, 0.4]) {
      const toe = cyl(0.018, 0.018, 0.13, C.leg, { ink: false }, 5)
      legs.add(at(toe, side * 0.14 + Math.sin(yaw) * 0.05, 0.02, 0.09, Math.PI / 2, 0, yaw))
    }
  }
  parts.add(legs)

  return { root, pose, body, head, wings, eyes, tail, legs }
}

/** Little hearts that float up when the robin is pleased. */
export function buildHearts(count = 5) {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.5)
  shape.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.3)
  shape.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 8 })
  geo.center()
  const group = new THREE.Group()
  const hearts = Array.from({ length: count }, (_, i) => {
    const mesh = outline(new THREE.Mesh(geo, toon(C.heart)), 0.05)
    mesh.visible = false
    group.add(mesh)
    return { mesh, t: -1, x: 0, y: 0, z: 0, sway: i * 1.7, delay: 0 }
  })

  function burst(origin: THREE.Vector3) {
    for (const [i, h] of hearts.entries()) {
      h.t = 0
      h.delay = i * 0.16
      h.x = origin.x + (Math.random() - 0.5) * 0.7
      h.y = origin.y + 0.25
      h.z = origin.z + 0.2
    }
  }

  function update(dt: number) {
    for (const h of hearts) {
      if (h.t < 0) continue
      h.t += dt
      const p = (h.t - h.delay) / 1.5
      if (p < 0) continue
      if (p >= 1) {
        h.t = -1
        h.mesh.visible = false
        continue
      }
      h.mesh.visible = true
      h.mesh.position.set(h.x + Math.sin(p * 5 + h.sway) * 0.12, h.y + p * 1.3, h.z)
      // Pop in, then shrink away as it rises.
      const s = 0.2 * Math.min(1, p * 6) * (p > 0.7 ? (1 - p) / 0.3 : 1)
      h.mesh.scale.setScalar(Math.max(0.001, s))
      h.mesh.rotation.z = Math.sin(p * 4 + h.sway) * 0.25
    }
  }

  function clear() {
    for (const h of hearts) {
      h.t = -1
      h.mesh.visible = false
    }
  }

  return { group, burst, update, clear }
}
