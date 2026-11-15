import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../store/settings'
import { useBird } from '../store/bird'
import { useUi, WAVES_THRESHOLD } from '../store/ui'
import { noiseEngine } from '../audio/noise'
import { radio } from '../audio/radio'
import { getScene, setScene } from '../scene/handle'
import type { Anchor, BirdSceneHandle, SceneMode } from '../scene/birdScene'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The whole composition (mug … nest … lamp and books) is about this many
 *  robin-heights wide; used to fit it into the space available. */
const SCENE_WIDTH_IN_BIRDS = 5.8

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Where the robin should sit:
 *  - fullscreen, or the banner on narrow screens: centre stage, with the
 *    whole composition in view;
 *  - behind the app on wide screens: in the free space to the right of the
 *    content column. */
function measureAnchor(stage: HTMLElement): Anchor {
  const w = stage.clientWidth
  const h = stage.clientHeight
  const shell = document.querySelector<HTMLElement>('.shell')
  const behindApp = getComputedStyle(stage).position === 'fixed' && shell && shell.offsetWidth > 0
  const left = behindApp ? shell.getBoundingClientRect().right : 0
  const free = w - left
  const size = clamp(Math.min(h * 0.34, free / SCENE_WIDTH_IN_BIRDS), behindApp ? 130 : 40, 320)
  // The room has more on the robin's right (lamp, books) than its left, so
  // sit it a little left of centre.
  const x = (left + free / 2 - size * 0.5) / w
  return { x, y: 0.58, size }
}

/** The living scene. three.js and the scene are loaded lazily so the app
 *  paints first; the canvas fades in once ready. Sits behind the app on
 *  wide screens, as a banner on narrow ones, and fills the screen in
 *  fullscreen mode (all CSS — see `.backdrop`). */
export function BirdBackdrop() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BirdSceneHandle | null>(null)
  const calmMode = useSettings((s) => s.calmMode)
  const waves = useSettings((s) => s.soundMix.waves)
  const rain = useSettings((s) => s.soundMix.rain)
  const noiseOn = useUi((u) => u.noiseOn)
  const ambient = useUi((u) => u.ambient)
  const [ready, setReady] = useState(false)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const [radioOn, setRadioOn] = useState(radio.status === 'playing')

  const animated = !calmMode && !reduced
  const rainy = noiseOn && rain > WAVES_THRESHOLD
  const atSea = noiseOn && waves > WAVES_THRESHOLD
  const mode: SceneMode = atSea ? (rainy ? 'storm' : 'sea') : 'room'
  const latest = useRef({ animated, mode, rainy, radioOn })
  latest.current = { animated, mode, rainy, radioOn }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => radio.subscribe((status) => setRadioOn(status === 'playing')), [])

  useEffect(() => {
    let cancelled = false
    import('../scene/birdScene')
      .then(({ createBirdScene }) => {
        if (cancelled || !canvasRef.current || !stageRef.current) return
        const now = latest.current
        const scene = createBirdScene(canvasRef.current, {
          animated: now.animated,
          mode: now.mode,
          anchor: measureAnchor(stageRef.current),
          ambience: { rainy: now.rainy, radioOn: now.radioOn },
          onChirp: () => noiseEngine.chirp(),
          onVeil: (v) => {
            if (veilRef.current) veilRef.current.style.opacity = String(v)
          },
          onFlash: (v) => {
            if (flashRef.current) flashRef.current.style.opacity = String(v * 0.55)
          },
        })
        sceneRef.current = scene
        setScene(scene)
        setReady(true)
      })
      .catch(() => {}) // e.g. no WebGL — a plain background stays, the app still works
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

  useEffect(() => {
    sceneRef.current?.setAmbience({ rainy, radioOn })
  }, [rainy, radioOn, ready])

  // Re-frame whenever the stage changes shape (resize, rotation, fullscreen).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const apply = () => sceneRef.current?.setAnchor(measureAnchor(stage))
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(stage)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [ambient, ready])

  return (
    <div className="backdrop" ref={stageRef} data-full={ambient} aria-hidden="true">
      <canvas ref={canvasRef} className="backdrop-canvas" data-ready={ready} />
      <div className="backdrop-flash" ref={flashRef} />
      <div className="backdrop-veil" ref={veilRef} />
      <div className="backdrop-paper" />
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
