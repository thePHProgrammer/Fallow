import { useEffect, useState } from 'react'
import { useTimer } from './timer'

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Current time, refreshed on a coarse tick while `active`. Correctness
 *  comes from wall-clock timestamps, so it does not matter that background
 *  tabs throttle this interval. */
export function useNow(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  return now
}

/** The timer's display values, derived from timestamps. */
export function useClock() {
  const phase = useTimer((s) => s.phase)
  const mode = useTimer((s) => s.mode)
  const startedAt = useTimer((s) => s.startedAt)
  const endsAt = useTimer((s) => s.endsAt)
  const now = useNow(phase !== 'idle')

  const remaining = endsAt !== null ? endsAt - now : null
  const elapsed = startedAt !== null ? now - startedAt : 0
  const clock =
    phase === 'idle'
      ? formatClock(0)
      : remaining !== null
        ? formatClock(remaining)
        : formatClock(elapsed)
  const phaseLabel =
    phase === 'idle'
      ? 'Ready'
      : phase === 'break'
        ? 'Break'
        : mode === 'pomodoro'
          ? 'Focus'
          : 'Focus — counting up'

  return { now, elapsed, clock, phaseLabel, phase }
}
