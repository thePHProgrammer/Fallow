import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NoiseKind = 'white' | 'pink' | 'brown' | 'rain' | 'waves'

const DEFAULT_MIX: Record<NoiseKind, number> = {
  white: 0,
  pink: 0.15,
  brown: 0,
  rain: 0,
  waves: 0,
}

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
      soundMix: DEFAULT_MIX,
      setCalmMode: (on) => set({ calmMode: on }),
      setTimerConfig: (patch) =>
        set((s) => ({ timerConfig: { ...s.timerConfig, ...patch } })),
      setNoiseLevel: (kind, level) =>
        set((s) => ({ soundMix: { ...s.soundMix, [kind]: level } })),
    }),
    {
      name: 'fallow-settings',
      version: 1,
      // v0 → v1: soundMix gained rain and waves; keep the user's levels and
      // default the new channels to silent.
      migrate: (persisted) => {
        const s = persisted as SettingsState
        return { ...s, soundMix: { ...DEFAULT_MIX, ...(s?.soundMix ?? {}) } }
      },
    },
  ),
)
