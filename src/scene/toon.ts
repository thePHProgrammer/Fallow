import * as THREE from 'three'

/**
 * The illustrated look: cel shading (three flat bands of light) plus ink
 * outlines drawn as an "inverted hull" — a slightly larger, inside-out copy
 * of each shape in dark ink, so only its rim shows.
 */

export const INK = 0x3a2a20

let bands: THREE.DataTexture | null = null
function gradientMap(): THREE.DataTexture {
  if (!bands) {
    bands = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat)
    bands.needsUpdate = true
  }
  return bands
}

const toonCache = new Map<number, THREE.MeshToonMaterial>()
export function toonBands(): THREE.DataTexture {
  return gradientMap()
}

export function toon(color: number): THREE.MeshToonMaterial {
  let m = toonCache.get(color)
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() })
    toonCache.set(color, m)
  }
  return m
}

/** Unlit, for things that glow or are painted flat. */
export function flat(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
}

const inkCache = new Map<number, THREE.MeshBasicMaterial>()
/** Ink that pushes every vertex out along its normal (for round shapes). */
function inkAlongNormals(thickness: number): THREE.MeshBasicMaterial {
  let m = inkCache.get(thickness)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = position + normalize( normal ) * ${thickness.toFixed(4)};`,
      )
    }
    m.customProgramCacheKey = () => `ink-${thickness}`
    inkCache.set(thickness, m)
  }
  return m
}
const inkHull = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })

/** Add an ink outline to a mesh. Round shapes grow along their normals;
 *  hard-edged ones (boxes, cylinders) use a scaled copy so corners stay
 *  closed. */
export function outline<T extends THREE.Mesh>(mesh: T, thickness = 0.025): T {
  const geo = mesh.geometry
  const hard =
    geo instanceof THREE.BoxGeometry ||
    geo instanceof THREE.CylinderGeometry ||
    geo instanceof THREE.ExtrudeGeometry
  let rim: THREE.Mesh
  if (hard) {
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    const size = bb.getSize(new THREE.Vector3())
    const centre = bb.getCenter(new THREE.Vector3())
    rim = new THREE.Mesh(geo, inkHull)
    rim.scale.set(
      1 + (2 * thickness) / Math.max(size.x, 1e-3),
      1 + (2 * thickness) / Math.max(size.y, 1e-3),
      1 + (2 * thickness) / Math.max(size.z, 1e-3),
    )
    rim.position.set(
      centre.x * (1 - rim.scale.x),
      centre.y * (1 - rim.scale.y),
      centre.z * (1 - rim.scale.z),
    )
  } else {
    rim = new THREE.Mesh(geo, inkAlongNormals(thickness))
  }
  rim.userData.ink = true
  mesh.add(rim)
  return mesh
}

interface Opts {
  /** Outline thickness; false for none. */
  ink?: number | false
}

function finish(geo: THREE.BufferGeometry, color: number, o?: Opts): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, toon(color))
  return o?.ink === false ? mesh : outline(mesh, o?.ink)
}

/** Ellipsoid with the given full width/height/depth. */
export function ball(w: number, h: number, d: number, color: number, o?: Opts): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.5, 20, 14)
  geo.scale(w, h, d)
  geo.computeVertexNormals()
  return finish(geo, color, o)
}

export function box(w: number, h: number, d: number, color: number, o?: Opts): THREE.Mesh {
  return finish(new THREE.BoxGeometry(w, h, d), color, o)
}

export function cyl(top: number, bottom: number, h: number, color: number, o?: Opts, seg = 18): THREE.Mesh {
  return finish(new THREE.CylinderGeometry(top, bottom, h, seg), color, o)
}

/** A straight rod between two points. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, o?: Opts): THREE.Mesh {
  const dir = b.clone().sub(a)
  const m = cyl(r, r, dir.length(), color, o, 8)
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
/** A soft, additive glow that always faces the camera's side of the scene. */
export function halo(radius: number, color: number, opacity: number): THREE.Mesh {
  softDot ??= painted(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
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
