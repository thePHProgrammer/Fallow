import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../store/settings'
import { useBird } from '../store/bird'
import { noiseEngine } from '../audio/noise'
import type { BirdSceneHandle } from '../scene/birdScene'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The bird on the Focus tab. three.js and the scene are loaded lazily so
 *  the timer paints first; the canvas fades in once ready. */
export function BirdScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BirdSceneHandle | null>(null)
  const calmMode = useSettings((s) => s.calmMode)
  const seeds = useBird((s) => s.seeds)
  const fed = useBird((s) => s.fed)
  const feed = useBird((s) => s.feed)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reduced, setReduced] = useState(prefersReducedMotion)

  const animated = !calmMode && !reduced
  const animatedRef = useRef(animated)
  animatedRef.current = animated

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
        sceneRef.current = createBirdScene(canvasRef.current, {
          animated: animatedRef.current,
          onChirp: () => noiseEngine.chirp(),
        })
        setReady(true)
      })
      .catch(() => setFailed(true)) // e.g. no WebGL — the timer still works
    return () => {
      cancelled = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setAnimated(animated)
  }, [animated, ready])

  const onFeed = () => {
    if (feed()) sceneRef.current?.feed()
  }

  if (failed) return null

  return (
    <div className="bird">
      <canvas
        ref={canvasRef}
        className="bird-canvas"
        data-ready={ready}
        role="img"
        aria-label="A small bird resting on a branch"
      />
      <div className="bird-bar">
        <button className="btn" onClick={onFeed} disabled={seeds === 0}>
          Feed the bird
        </button>
        <p className="bird-note" aria-live="polite">
          {seeds === 0
            ? 'Finish a focus block to earn seeds.'
            : `${seeds} seed${seeds === 1 ? '' : 's'} saved`}
          {fed > 0 && ` · fed ${fed} time${fed === 1 ? '' : 's'}`}
        </p>
      </div>
    </div>
  )
}
