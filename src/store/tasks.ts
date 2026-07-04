import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Quadrant = 'I' | 'II' | 'III' | 'IV'
export type BoardContext = 'work' | 'personal'

export interface Task {
  id: string
  title: string
  quadrant: Quadrant
  context: BoardContext
  /** Implementation intention: "If X happens, then I will Y." */
  trigger: string
  done: boolean
  createdAt: number
}

/** Hard cap of open tasks per quadrant — the board is a lens, not a landfill. */
export const QUADRANT_CAP = 10

interface TaskState {
  tasks: Task[]
  /** Returns false when the target quadrant is already at the cap. */
  addTask: (t: Pick<Task, 'title' | 'quadrant' | 'context' | 'trigger'>) => boolean
  /** Returns false when the target quadrant is already at the cap. */
  moveTask: (id: string, quadrant: Quadrant) => boolean
  toggleDone: (id: string) => void
  removeTask: (id: string) => void
}

function openCount(tasks: Task[], context: BoardContext, quadrant: Quadrant): number {
  return tasks.filter(
    (t) => t.context === context && t.quadrant === quadrant && !t.done,
  ).length
}

export const useTasks = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: ({ title, quadrant, context, trigger }) => {
        if (openCount(get().tasks, context, quadrant) >= QUADRANT_CAP) return false
        const task: Task = {
          id: crypto.randomUUID(),
          title,
          quadrant,
          context,
          trigger,
          done: false,
          createdAt: Date.now(),
        }
        set((s) => ({ tasks: [...s.tasks, task] }))
        return true
      },

      moveTask: (id, quadrant) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task || task.quadrant === quadrant) return true
        if (!task.done && openCount(get().tasks, task.context, quadrant) >= QUADRANT_CAP)
          return false
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, quadrant } : t)),
        }))
        return true
      },

      toggleDone: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
    }),
    { name: 'fallow-tasks' },
  ),
)
