import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import birdUrl from '../assets/bird.glb?url'
import { clay } from './clay'

/**
 * The bird: "Bird" by Kelli Ray (Google Poly, CC-BY), loaded from a small
 * glTF file and re-dressed in matte clay in its own colours. The model has
 * no animation or skeleton, so it is rigged here: the two wing meshes are
 * hung on pivots at the shoulders so they can fold and flap, and the whole
 * body sits in a pose group for pitch, bank and little tilts.
 */

const HEART = 0xe8607a

/** The model's own measurements (its units), read from the file. */
const MODEL = { bottom: 229.8, top: 509.5 }

export const BODY_Y = 0.55
/** Body height, bottom of the belly to top of the head. */
export const BIRD_HEIGHT = 1.35

function shoulderOf(wing: THREE.Mesh): THREE.Vector3 {
  // The shoulder is where the wing meets the body: its innermost vertices.
  const pos = wing.geometry.attributes.position
  let reach = 0
  for (let i = 0; i < pos.count; i++) reach = Math.max(reach, Math.abs(pos.getX(i)))
  const sum = new THREE.Vector3()
  let n = 0
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) < reach * 0.14) {
      sum.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)))
      n++
    }
  }
  return n ? sum.divideScalar(n) : new THREE.Vector3()
}

export async function loadBird() {
  const gltf = await new GLTFLoader().loadAsync(birdUrl)
  const model = gltf.scene

  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const from = o.material as THREE.MeshStandardMaterial
      o.material = clay(from.color.getHex())
      o.castShadow = true
    }
  })

  // root: position + heading. pose: pitch/roll about the body centre.
  const root = new THREE.Group()
  const pose = new THREE.Group()
  pose.position.y = BODY_Y
  root.add(pose)
  const parts = new THREE.Group()
  parts.position.y = -BODY_Y
  pose.add(parts)

  // body: breathing scale. Inside it the model is sized so the body is
  // BIRD_HEIGHT tall with the bottom of the belly at y = 0.
  const body = new THREE.Group()
  parts.add(body)
  const scale = BIRD_HEIGHT / (MODEL.top - MODEL.bottom)
  model.scale.setScalar(scale)
  model.position.y = -MODEL.bottom * scale
  body.add(model)

  // Hang each wing on a pivot at its shoulder. [right (x < 0), left].
  const wings: THREE.Group[] = []
  for (const name of ['rwing', 'lwing']) {
    const wing = model.getObjectByName(name)
    const pivot = new THREE.Group()
    if (wing instanceof THREE.Mesh) {
      const shoulder = shoulderOf(wing)
      pivot.position.copy(shoulder)
      wing.parent?.add(pivot)
      wing.position.sub(shoulder)
      pivot.add(wing)
    }
    wings.push(pivot)
  }

  const legs = ['leg', 'claws']
    .map((name) => model.getObjectByName(name))
    .filter((o): o is THREE.Object3D => !!o)

  // A marker at the face, for anything that needs to know where it is
  // (seeds flying to the beak, hearts rising from the head).
  const face = new THREE.Group()
  face.position.set(0, 1.2, 0.8)
  parts.add(face)

  return { root, pose, body, face, wings, legs }
}

/** Little hearts that float up when the bird is pleased. */
export function buildHearts(count = 5) {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.5)
  shape.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.3)
  shape.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 8 })
  geo.center()
  const group = new THREE.Group()
  const hearts = Array.from({ length: count }, (_, i) => {
    const mesh = new THREE.Mesh(geo, clay(HEART))
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
