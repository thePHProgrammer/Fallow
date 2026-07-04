import { useState, type FormEvent } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  QUADRANT_CAP,
  useTasks,
  type BoardContext,
  type Quadrant,
  type Task,
} from '../store/tasks'

const QUADRANTS: { q: Quadrant; title: string; hint: string }[] = [
  { q: 'I', title: 'Do now', hint: 'Urgent and important' },
  { q: 'II', title: 'Schedule', hint: 'Important, not urgent — live here' },
  { q: 'III', title: 'Shrink or delegate', hint: 'Urgent, not important' },
  { q: 'IV', title: 'Let go', hint: 'Neither — be honest' },
]

function TaskCard({ task }: { task: Task }) {
  const toggleDone = useTasks((s) => s.toggleDone)
  const removeTask = useTasks((s) => s.removeTask)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`task-card${task.done ? ' task-done' : ''}${isDragging ? ' dragging' : ''}`}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => toggleDone(task.id)}
        aria-label={`Done: ${task.title}`}
      />
      <div className="task-body">
        <p className="task-title">{task.title}</p>
        {task.trigger && <p className="task-trigger">{task.trigger}</p>}
      </div>
      <button
        className="icon-btn drag-handle"
        {...listeners}
        {...attributes}
        aria-label={`Move: ${task.title}`}
      >
        ⠿
      </button>
      <button
        className="icon-btn"
        onClick={() => removeTask(task.id)}
        aria-label={`Delete: ${task.title}`}
      >
        ×
      </button>
    </div>
  )
}

function QuadrantBox({
  q,
  title,
  hint,
  tasks,
}: {
  q: Quadrant
  title: string
  hint: string
  tasks: Task[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: q })
  const open = tasks.filter((t) => !t.done).length

  return (
    <section
      ref={setNodeRef}
      className={`quadrant${isOver ? ' over' : ''}`}
      aria-label={`${title}: ${hint}`}
    >
      <h3>
        {title}{' '}
        <span className="q-count">
          {open}/{QUADRANT_CAP}
        </span>
      </h3>
      <p className="q-hint">{hint}</p>
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </section>
  )
}

export function BoardPanel() {
  const tasks = useTasks((s) => s.tasks)
  const addTask = useTasks((s) => s.addTask)
  const moveTask = useTasks((s) => s.moveTask)

  const [context, setContext] = useState<BoardContext>('work')
  const [title, setTitle] = useState('')
  const [trigger, setTrigger] = useState('')
  const [quadrant, setQuadrant] = useState<Quadrant>('II')
  const [notice, setNotice] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const target = e.over?.id as Quadrant | undefined
    if (!target) return
    setNotice(
      moveTask(String(e.active.id), target)
        ? ''
        : 'That quadrant is full — ten open tasks is the cap. Finish or let go of one first.',
    )
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const ok = addTask({ title: title.trim(), quadrant, context, trigger: trigger.trim() })
    if (!ok) {
      setNotice(
        'That quadrant is full — ten open tasks is the cap. Finish or let go of one first.',
      )
      return
    }
    setTitle('')
    setTrigger('')
    setNotice('')
  }

  const visible = tasks.filter((t) => t.context === context)

  return (
    <section aria-label="Prioritization board">
      <div className="board-head">
        <div className="mode-switch" role="group" aria-label="Board context">
          <button aria-pressed={context === 'work'} onClick={() => setContext('work')}>
            Work
          </button>
          <button
            aria-pressed={context === 'personal'}
            onClick={() => setContext('personal')}
          >
            Personal
          </button>
        </div>
      </div>

      <form className="add-task" onSubmit={onSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="Task title"
        />
        <input
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="If … happens, then I will … (implementation intention, optional)"
          aria-label="Implementation intention"
        />
        <div className="form-row">
          <select
            value={quadrant}
            onChange={(e) => setQuadrant(e.target.value as Quadrant)}
            aria-label="Quadrant"
          >
            {QUADRANTS.map(({ q, title: t }) => (
              <option key={q} value={q}>
                {t}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            Add task
          </button>
        </div>
        {notice && <p className="notice">{notice}</p>}
      </form>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="board-grid">
          {QUADRANTS.map(({ q, title: t, hint }) => (
            <QuadrantBox
              key={q}
              q={q}
              title={t}
              hint={hint}
              tasks={visible.filter((task) => task.quadrant === q)}
            />
          ))}
        </div>
      </DndContext>
    </section>
  )
}
