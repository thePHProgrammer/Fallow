import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const MAX_HABITS = 3
const MAX_FREEZES = 3

export interface Habit {
  id: string
  name: string
  /** The cue this habit is tied to: "After I pour my morning coffee…" */
  trigger: string
  /** Streak freezes available; one is consumed automatically to bridge a
   *  single missed day. Earned back at every 7-day milestone. */
  freezes: number
  /** Local-timezone YYYY-MM-DD days the habit was done. */
  log: string[]
  /** Days bridged by a freeze (kept separate so honesty is preserved). */
  frozen: string[]
  createdAt: number
}

/** Local-timezone day key. All streak math happens in the user's timezone. */
export function localDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA')
}

/** Streak counting back from today. An unlogged today is not a miss yet —
 *  the streak just counts from yesterday (the grace window). */
export function streakOf(habit: Habit): number {
  const has = (day: string) => habit.log.includes(day) || habit.frozen.includes(day)
  let streak = 0
  let i = has(localDay(0)) ? 0 : -1
  while (has(localDay(i - streak))) streak++
  return streak
}

interface HabitState {
  habits: Habit[]
  addHabit: (name: string, trigger: string) => void
  removeHabit: (id: string) => void
  /** One tap. Logging today auto-bridges a single missed yesterday with a
   *  freeze, and 7-day milestones earn a freeze back. */
  toggleToday: (id: string) => void
  /** Grace window: "I did it yesterday, I just forgot to log it." */
  markYesterday: (id: string) => void
}

export const useHabits = create<HabitState>()(
  persist(
    (set) => ({
      habits: [],

      addHabit: (name, trigger) =>
        set((s) =>
          s.habits.length >= MAX_HABITS
            ? s
            : {
                habits: [
                  ...s.habits,
                  {
                    id: crypto.randomUUID(),
                    name,
                    trigger,
                    freezes: 1,
                    log: [],
                    frozen: [],
                    createdAt: Date.now(),
                  },
                ],
              },
        ),

      removeHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

      toggleToday: (id) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h
            const today = localDay(0)
            if (h.log.includes(today)) {
              return { ...h, log: h.log.filter((d) => d !== today) }
            }
            let next: Habit = { ...h, log: [...h.log, today] }
            const yesterday = localDay(-1)
            const dayBefore = localDay(-2)
            const has = (day: string) => next.log.includes(day) || next.frozen.includes(day)
            if (!has(yesterday) && has(dayBefore) && next.freezes > 0) {
              next = {
                ...next,
                frozen: [...next.frozen, yesterday],
                freezes: next.freezes - 1,
              }
            }
            const streak = streakOf(next)
            if (streak > 0 && streak % 7 === 0) {
              next = { ...next, freezes: Math.min(MAX_FREEZES, next.freezes + 1) }
            }
            return next
          }),
        })),

      markYesterday: (id) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id && !h.log.includes(localDay(-1))
              ? { ...h, log: [...h.log, localDay(-1)] }
              : h,
          ),
        })),
    }),
    { name: 'fallow-habits' },
  ),
)
