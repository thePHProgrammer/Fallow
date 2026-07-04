import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSettings } from './settings'

export type TimerMode = 'pomodoro' | 'flowtime'
export type TimerPhase = 'idle' | 'focus' | 'break'

export interface SessionRecord {
  id: string
  mode: TimerMode
  start: number
  end: number
  completed: boolean
}

// Flowtime: break earned is a fifth of the time focused.
const FLOWTIME_BREAK_RATIO = 5
const MIN_BREAK_MS = 2 * 60_000
const MAX_BREAK_MS = 30 * 60_000

interface TimerState {
  mode: TimerMode
  phase: TimerPhase
  /** Epoch ms. Time is always derived from these timestamps, never from
   *  accumulated ticks — background tabs throttle timers, wall clocks don't. */
  startedAt: number | null
  /** Null during a flowtime focus, which counts up. */
  endsAt: number | null
  blocksCompleted: number
  sessions: SessionRecord[]
  setMode: (mode: TimerMode) => void
  startFocus: () => void
  /** Pomodoro/flowtime focus reached its natural end → move into a break. */
  completeFocus: () => void
  /** Indivisibility rule: no pause. This is the hard stop — back to idle,
   *  the partial block is logged as not completed and earns no break. */
  abandon: () => void
  endBreak: () => void
}

function logSession(s: TimerState, end: number, completed: boolean): SessionRecord[] {
  if (s.startedAt === null) return s.sessions
  const record: SessionRecord = {
    id: crypto.randomUUID(),
    mode: s.mode,
    start: s.startedAt,
    end,
    completed,
  }
  return [...s.sessions, record].slice(-500)
}

export const useTimer = create<TimerState>()(
  persist(
    (set) => ({
      mode: 'pomodoro',
      phase: 'idle',
      startedAt: null,
      endsAt: null,
      blocksCompleted: 0,
      sessions: [],

      setMode: (mode) =>
        set((s) => (s.phase === 'idle' ? { mode } : s)),

      startFocus: () =>
        set((s) => {
          const now = Date.now()
          const { focusMinutes } = useSettings.getState().timerConfig
          return {
            phase: 'focus',
            startedAt: now,
            endsAt: s.mode === 'pomodoro' ? now + focusMinutes * 60_000 : null,
          }
        }),

      completeFocus: () =>
        set((s) => {
          if (s.phase !== 'focus' || s.startedAt === null) return s
          const now = Date.now()
          const cfg = useSettings.getState().timerConfig
          const blocks = s.blocksCompleted + 1
          let breakMs: number
          if (s.mode === 'pomodoro') {
            const long = blocks % cfg.blocksPerLongBreak === 0
            breakMs = (long ? cfg.longBreakMinutes : cfg.breakMinutes) * 60_000
          } else {
            const earned = (now - s.startedAt) / FLOWTIME_BREAK_RATIO
            breakMs = Math.min(Math.max(earned, MIN_BREAK_MS), MAX_BREAK_MS)
          }
          return {
            phase: 'break',
            sessions: logSession(s, now, true),
            blocksCompleted: blocks,
            startedAt: now,
            endsAt: now + breakMs,
          }
        }),

      abandon: () =>
        set((s) => ({
          phase: 'idle',
          sessions: s.phase === 'focus' ? logSession(s, Date.now(), false) : s.sessions,
          startedAt: null,
          endsAt: null,
        })),

      endBreak: () =>
        set({ phase: 'idle', startedAt: null, endsAt: null }),
    }),
    { name: 'fallow-timer' },
  ),
)
