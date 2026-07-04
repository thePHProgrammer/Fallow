import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface JournalEntry {
  id: string
  createdAt: number
  feelings: string
  thoughts: string
  gratitude: string
}

interface Draft {
  feelings: string
  thoughts: string
  gratitude: string
}

const EMPTY_DRAFT: Draft = { feelings: '', thoughts: '', gratitude: '' }

/** Private by design: this store persists to localStorage only. It must
 *  never be wired to a sync backend or any analytics. */
interface JournalState {
  entries: JournalEntry[]
  draft: Draft
  setDraft: (patch: Partial<Draft>) => void
  saveEntry: () => void
  removeEntry: (id: string) => void
}

export const useJournal = create<JournalState>()(
  persist(
    (set) => ({
      entries: [],
      draft: EMPTY_DRAFT,

      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

      saveEntry: () =>
        set((s) => {
          const { feelings, thoughts, gratitude } = s.draft
          if (!feelings.trim() && !thoughts.trim() && !gratitude.trim()) return s
          const entry: JournalEntry = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            feelings: feelings.trim(),
            thoughts: thoughts.trim(),
            gratitude: gratitude.trim(),
          }
          return { entries: [entry, ...s.entries], draft: EMPTY_DRAFT }
        }),

      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    }),
    { name: 'fallow-journal' },
  ),
)
