import { useEffect } from 'react'
import { useTimer } from '../store/timer'
import { useUi } from '../store/ui'
import { useClock, useNow } from '../store/timerClock'
import { noiseEngine } from '../audio/noise'

/** Always mounted: drives phase transitions and the tab title from
 *  wall-clock time, whichever tab (or ambient mode) is showing. */
export function TimerDriver() {
  const { now, clock, phase } = useClock()
  const endsAt = useTimer((s) => s.endsAt)

  useEffect(() => {
    if (endsAt !== null && now >= endsAt) {
      const timer = useTimer.getState()
      noiseEngine.chime()
      if (timer.phase === 'focus') timer.completeFocus()
      else if (timer.phase === 'break') timer.endBreak()
    }
  }, [now, endsAt])

  useEffect(() => {
    document.title = phase === 'idle' ? 'Fallow' : `${clock} · Fallow`
  }, [clock, phase])

  return null
}

export function AmbientButton() {
  const setAmbient = useUi((u) => u.setAmbient)
  const enter = () => {
    setAmbient(true)
    // Fullscreen is a nicety (great on a second monitor); fine if refused.
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  return (
    <button className="btn btn-quiet ambient-enter" onClick={enter}>
      Ambient
    </button>
  )
}

/** Ambient mode: just the scene, a small clock, and a way back. Meant for
 *  leaving open on a second monitor. */
export function AmbientOverlay() {
  const setAmbient = useUi((u) => u.setAmbient)
  const { clock, phaseLabel, phase } = useClock()
  const wall = useNow(phase === 'idle', 10_000)

  const exit = () => {
    setAmbient(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAmbient(false)
    }
    // Leaving fullscreen (Esc is swallowed by the browser there) also exits.
    const onFs = () => {
      if (!document.fullscreenElement) setAmbient(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)

    // Keep the screen awake while ambient mode is showing, where supported.
    let lock: WakeLockSentinel | null = null
    let gone = false
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock
        ?.request('screen')
        .then((l) => {
          if (gone) void l.release()
          else lock = l
        })
        .catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)

    return () => {
      gone = true
      void lock?.release()
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('visibilitychange', acquire)
    }
  }, [setAmbient])

  const time =
    phase === 'idle'
      ? new Date(wall).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : clock

  return (
    <div className="ambient">
      <div className="ambient-clock">
        <p className="ambient-label">{phase === 'idle' ? 'Fallow' : phaseLabel}</p>
        <p className="ambient-time" role="timer" aria-live="off">
          {time}
        </p>
      </div>
      <button className="btn ambient-exit" onClick={exit}>
        Back to Fallow
      </button>
    </div>
  )
}
