import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NoiseKind = 'white' | 'pink' | 'brown'

export interface TimerConfig {
  focusMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  blocksPerLongBreak: number
}

interface SettingsState {
  calmMode: boolean
  timerConfig: TimerConfig
  // Per-channel gain, 0..1. Defaults are deliberately low.
  soundMix: Record<NoiseKind, number>
  setCalmMode: (on: boolean) => void
  setTimerConfig: (patch: Partial<TimerConfig>) => void
  setNoiseLevel: (kind: NoiseKind, level: number) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      calmMode: false,
      timerConfig: {
        focusMinutes: 25,
        breakMinutes: 5,
        longBreakMinutes: 15,
        blocksPerLongBreak: 4,
      },
      soundMix: { white: 0, pink: 0.15, brown: 0 },
      setCalmMode: (on) => set({ calmMode: on }),
      setTimerConfig: (patch) =>
        set((s) => ({ timerConfig: { ...s.timerConfig, ...patch } })),
      setNoiseLevel: (kind, level) =>
        set((s) => ({ soundMix: { ...s.soundMix, [kind]: level } })),
    }),
    { name: 'fallow-settings' },
  ),
)
