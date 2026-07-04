import { useEffect, useState } from 'react'
import { useTimer } from '../store/timer'
import { noiseEngine } from '../audio/noise'
import { NoiseMixer } from './NoiseMixer'

function format(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function TimerPanel() {
  const timer = useTimer()
  const [now, setNow] = useState(() => Date.now())

  // Re-render on a coarse tick; correctness comes from the timestamps, so it
  // does not matter that background tabs throttle this interval.
  useEffect(() => {
    if (timer.phase === 'idle') return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [timer.phase])

  // Phase transitions, derived from wall-clock time.
  useEffect(() => {
    if (timer.endsAt !== null && now >= timer.endsAt) {
      noiseEngine.chime()
      if (timer.phase === 'focus') timer.completeFocus()
      else if (timer.phase === 'break') timer.endBreak()
    }
  }, [now, timer])

  const remaining = timer.endsAt !== null ? timer.endsAt - now : null
  const elapsed = timer.startedAt !== null ? now - timer.startedAt : 0

  const clock =
    timer.phase === 'idle'
      ? format(0)
      : remaining !== null
        ? format(remaining)
        : format(elapsed)

  useEffect(() => {
    document.title = timer.phase === 'idle' ? 'Fallow' : `${clock} · Fallow`
  }, [clock, timer.phase])

  const phaseLabel =
    timer.phase === 'idle'
      ? 'Ready'
      : timer.phase === 'break'
        ? 'Break'
        : timer.mode === 'pomodoro'
          ? 'Focus'
          : 'Focus — counting up'

  const confirmAbandon = () => {
    // Indivisibility: stopping mid-block is deliberate, never casual.
    if (window.confirm('Stop this focus block? It will not count.')) {
      timer.abandon()
    }
  }

  return (
    <section aria-label="Focus timer">
      <div className="timer">
        <p className="timer-phase">{phaseLabel}</p>
        <p className="timer-clock" role="timer" aria-live="off">
          {clock}
        </p>
        <p className="timer-blocks">
          {timer.blocksCompleted === 0
            ? 'No blocks completed yet today — that is fine.'
            : `${timer.blocksCompleted} block${timer.blocksCompleted === 1 ? '' : 's'} completed`}
        </p>

        {timer.phase === 'idle' && (
          <>
            <div className="mode-switch" role="group" aria-label="Timer mode">
              <button
                aria-pressed={timer.mode === 'pomodoro'}
                onClick={() => timer.setMode('pomodoro')}
              >
                Pomodoro
              </button>
              <button
                aria-pressed={timer.mode === 'flowtime'}
                onClick={() => timer.setMode('flowtime')}
              >
                Flowtime
              </button>
            </div>
            <div className="timer-actions">
              <button className="btn btn-primary" onClick={timer.startFocus}>
                Begin focus
              </button>
            </div>
          </>
        )}

        {timer.phase === 'focus' && (
          <div className="timer-actions">
            {timer.mode === 'flowtime' && (
              <button className="btn btn-primary" onClick={timer.completeFocus}>
                Finish &amp; take break
              </button>
            )}
            <button className="btn btn-stop" onClick={confirmAbandon}>
              Stop
            </button>
          </div>
        )}

        {timer.phase === 'break' && (
          <div className="timer-actions">
            <button className="btn btn-quiet" onClick={timer.endBreak}>
              End break early
            </button>
          </div>
        )}
      </div>

      <NoiseMixer />
    </section>
  )
}
