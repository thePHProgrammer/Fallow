import { useTimer } from '../store/timer'
import { useClock } from '../store/timerClock'
import { NoiseMixer } from './NoiseMixer'
import { BreakPanel } from './BreakPanel'
import { BirdFeeder } from './BirdScene'

const LONG_FOCUS_NUDGE_MS = 90 * 60_000

export function TimerPanel() {
  const timer = useTimer()
  // Phase transitions and the tab title live in TimerDriver (App level), so
  // the timer keeps working on every tab and in ambient mode.
  const { elapsed, clock, phaseLabel } = useClock()

  const confirmAbandon = () => {
    // Indivisibility: stopping mid-block is deliberate, never casual.
    if (window.confirm('Stop this focus block? It will not count.')) {
      timer.abandon()
    }
  }

  return (
    <section aria-label="Focus timer">
      <BirdFeeder />
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

        {timer.phase === 'focus' && elapsed >= LONG_FOCUS_NUDGE_MS && (
          <p className="nudge">
            Ninety minutes of continuous focus. Quality drops from here —
            consider closing this block and taking a real break.
          </p>
        )}

        {timer.phase === 'break' && <BreakPanel />}

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
