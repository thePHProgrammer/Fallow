import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../store/settings'
import { useBird } from '../store/bird'
import { useUi, WAVES_THRESHOLD } from '../store/ui'
import { noiseEngine } from '../audio/noise'
import { getScene, setScene } from '../scene/handle'
import type { Anchor, BirdSceneHandle, SceneMode } from '../scene/birdScene'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Where the bird should sit so the app never covers it:
 *  - ambient mode: centre stage;
 *  - narrow screens: inside the clear "window" above the content;
 *  - wide screens: in the free margin to the right of the content column. */
function measureAnchor(ambient: boolean): Anchor {
  const w = window.innerWidth
  const h = window.innerHeight
  if (ambient) return { x: 0.5, y: 0.6, size: clamp(Math.min(w, h) * 0.3, 150, 360) }
  const win = document.querySelector<HTMLElement>('.scene-window')
  if (win && win.offsetHeight > 0) {
    const r = win.getBoundingClientRect()
    const top = r.top + window.scrollY // where it sits when scrolled to the top
    return {
      x: (r.left + r.width / 2) / w,
      y: (top + r.height * 0.6) / h,
      size: clamp(r.height * 0.5, 80, 220),
    }
  }
  const shell = document.querySelector<HTMLElement>('.shell')
  const margin = shell ? w - shell.getBoundingClientRect().right : w * 0.2
  return { x: 1 - margin / 2 / w, y: 0.56, size: clamp(margin * 0.5, 130, 260) }
}

/** The full-screen living background. three.js and the scene are loaded
 *  lazily so the app paints first; the canvas fades in over a CSS sky. */
export function BirdBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BirdSceneHandle | null>(null)
  const calmMode = useSettings((s) => s.calmMode)
  const waves = useSettings((s) => s.soundMix.waves)
  const noiseOn = useUi((u) => u.noiseOn)
  const ambient = useUi((u) => u.ambient)
  const [ready, setReady] = useState(false)
  const [reduced, setReduced] = useState(prefersReducedMotion)

  const animated = !calmMode && !reduced
  const mode: SceneMode = noiseOn && waves > WAVES_THRESHOLD ? 'ocean' : 'perch'
  const latest = useRef({ animated, mode, ambient })
  latest.current = { animated, mode, ambient }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    import('../scene/birdScene')
      .then(({ createBirdScene }) => {
        if (cancelled || !canvasRef.current) return
        const scene = createBirdScene(canvasRef.current, {
          animated: latest.current.animated,
          mode: latest.current.mode,
          anchor: measureAnchor(latest.current.ambient),
          onChirp: () => noiseEngine.chirp(),
        })
        sceneRef.current = scene
        setScene(scene)
        setReady(true)
      })
      .catch(() => {}) // e.g. no WebGL — the CSS sky stays, the app still works
    return () => {
      cancelled = true
      sceneRef.current?.dispose()
      sceneRef.current = null
      setScene(null)
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setAnimated(animated)
  }, [animated, ready])

  useEffect(() => {
    sceneRef.current?.setMode(mode)
  }, [mode, ready])

  // Keep the bird clear of the content as the layout changes.
  useEffect(() => {
    const apply = () => sceneRef.current?.setAnchor(measureAnchor(latest.current.ambient))
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [ambient, ready])

  return (
    <div className="backdrop" data-scene={mode} aria-hidden="true">
      <div className="backdrop-sky backdrop-sky-perch" />
      <div className="backdrop-sky backdrop-sky-ocean" />
      <canvas ref={canvasRef} className="backdrop-canvas" data-ready={ready} />
    </div>
  )
}

/** Feed button on the Focus tab; talks to the background scene. */
export function BirdFeeder() {
  const seeds = useBird((s) => s.seeds)
  const fed = useBird((s) => s.fed)
  const feed = useBird((s) => s.feed)

  const onFeed = () => {
    if (feed()) getScene()?.feed()
  }

  return (
    <div className="feeder">
      <button className="btn" onClick={onFeed} disabled={seeds === 0}>
        Feed the bird
      </button>
      <p className="feeder-note" aria-live="polite">
        {seeds === 0
          ? 'Finish a focus block to earn seeds.'
          : `${seeds} seed${seeds === 1 ? '' : 's'} saved`}
        {fed > 0 && ` · fed ${fed} time${fed === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}
