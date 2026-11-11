import { create } from 'zustand'

/** Session-only UI state (not persisted). */
interface UiState {
  /** Whether the procedural noise mixer is currently sounding. */
  noiseOn: boolean
  /** Ambient mode: hide the app, keep the scene and a small clock. */
  ambient: boolean
  setNoiseOn: (on: boolean) => void
  setAmbient: (on: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  noiseOn: false,
  ambient: false,
  setNoiseOn: (noiseOn) => set({ noiseOn }),
  setAmbient: (ambient) => set({ ambient }),
}))

/** Waves loud enough to hear → the bird heads out over the water. */
export const WAVES_THRESHOLD = 0.02
