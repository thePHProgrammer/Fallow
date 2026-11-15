import * as THREE from 'three'

/**
 * The diorama look: everything is matte clay (rough, non-metallic), lit by
 * a warm lamp in twilight. Things that glow are unlit and bright, so the
 * bloom pass picks them out.
 */

/** Warm cream — used wherever "white" is wanted. Nothing is pure white. */
export const CREAM = 0xf5ebe0

const clayCache = new Map<number, THREE.MeshStandardMaterial>()
export function clay(color: number): THREE.MeshStandardMaterial {
  let m = clayCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 })
    clayCache.set(color, m)
  }
  return m
}

/** Matte clay with a painted picture or label on it. */
export function clayPainted(map: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 })
}

/** Unlit, for things that glow. */
export function flat(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
}

function finish(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  return new THREE.Mesh(geo, clay(color))
}

/** Ellipsoid with the given full width/height/depth. */
export function ball(w: number, h: number, d: number, color: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.5, 20, 14)
  geo.scale(w, h, d)
  geo.computeVertexNormals()
  return finish(geo, color)
}

export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  return finish(new THREE.BoxGeometry(w, h, d), color)
}

export function cyl(top: number, bottom: number, h: number, color: number, seg = 18): THREE.Mesh {
  return finish(new THREE.CylinderGeometry(top, bottom, h, seg), color)
}

/** A straight rod between two points. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, color: number): THREE.Mesh {
  const dir = b.clone().sub(a)
  const m = cyl(r, r, dir.length(), color, 8)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return m
}

export function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  obj.position.set(x, y, z)
  obj.rotation.set(rx, ry, rz)
  return obj
}

/** A small painted label or picture: draw on a 2D canvas, use as a texture. */
export function painted(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function label(text: string, bg: string, fg: string, w = 512, h = 96): THREE.CanvasTexture {
  return painted(w, h, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = fg
    ctx.lineWidth = 6
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = fg
    ctx.font = `bold ${Math.round(h * 0.5)}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 2, w - 40)
  })
}

let softDot: THREE.CanvasTexture | null = null
/** A soft, additive glow (a flat card facing the front of the scene). */
export function halo(radius: number, color: number, opacity: number): THREE.Mesh {
  softDot ??= painted(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    g.addColorStop(0, 'rgba(255,244,230,1)')
    g.addColorStop(0.35, 'rgba(255,244,230,0.45)')
    g.addColorStop(1, 'rgba(255,244,230,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, w)
  })
  return new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: softDot,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  )
}

/** Deterministic pseudo-random numbers, so the room looks the same each visit. */
export function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
