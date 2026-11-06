import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The bird on the Focus tab. Growth-only, like the field: completed focus
 * blocks earn seeds, seeds can be fed to the bird, and nothing ever decays —
 * the bird never gets hungry, sad, or flies away.
 */
interface BirdState {
  seeds: number
  /** Lifetime feedings. Only ever goes up. */
  fed: number
  lastFedAt: number | null
  earnSeeds: (n: number) => void
  /** Spend one seed. Returns false (and changes nothing) at zero. */
  feed: () => boolean
}

export const SEEDS_PER_POMODORO = 3

/** Flowtime: one seed per ~10 focused minutes, clamped to 1–5. */
export function flowtimeSeeds(focusedMs: number): number {
  return Math.min(5, Math.max(1, Math.round(focusedMs / 600_000)))
}

export const useBird = create<BirdState>()(
  persist(
    (set, get) => ({
      seeds: 0,
      fed: 0,
      lastFedAt: null,
      earnSeeds: (n) => set((s) => ({ seeds: s.seeds + Math.max(0, Math.floor(n)) })),
      feed: () => {
        if (get().seeds <= 0) return false
        set((s) => ({ seeds: s.seeds - 1, fed: s.fed + 1, lastFedAt: Date.now() }))
        return true
      },
    }),
    { name: 'fallow-bird' },
  ),
)
