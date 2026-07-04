import { useState, type FormEvent } from 'react'
import { MAX_HABITS, localDay, streakOf, useHabits, type Habit } from '../store/habits'

function HabitCard({ habit }: { habit: Habit }) {
  const toggleToday = useHabits((s) => s.toggleToday)
  const markYesterday = useHabits((s) => s.markYesterday)
  const removeHabit = useHabits((s) => s.removeHabit)

  const streak = streakOf(habit)
  const doneToday = habit.log.includes(localDay(0))
  const missedYesterday =
    !habit.log.includes(localDay(-1)) && !habit.frozen.includes(localDay(-1))

  const status =
    streak > 0
      ? `${streak}-day streak · ${habit.freezes} freeze${habit.freezes === 1 ? '' : 's'} in reserve`
      : habit.log.length > 0
        ? 'A pause, not a failure. Never miss twice — today is a good restart.'
        : 'New — the first time counts double.'

  return (
    <div className="habit-card">
      <div className="habit-body">
        <p className="habit-name">{habit.name}</p>
        {habit.trigger && <p className="habit-trigger">{habit.trigger}</p>}
        <p className="habit-status">{status}</p>
      </div>
      <div className="habit-actions">
        <label className="habit-log">
          <input type="checkbox" checked={doneToday} onChange={() => toggleToday(habit.id)} />
          Done today
        </label>
        {missedYesterday && habit.log.length > 0 && (
          <button className="btn btn-quiet" onClick={() => markYesterday(habit.id)}>
            I did it yesterday
          </button>
        )}
        <button
          className="icon-btn"
          onClick={() => removeHabit(habit.id)}
          aria-label={`Delete habit: ${habit.name}`}
        >
          ×
        </button>
      </div>
    </div>
  )
}

export function HabitsPanel() {
  const habits = useHabits((s) => s.habits)
  const addHabit = useHabits((s) => s.addHabit)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addHabit(name.trim(), trigger.trim())
    setName('')
    setTrigger('')
  }

  return (
    <section className="habits" aria-label="Habits">
      <p className="section-intro">
        Three habits at most, each tied to a cue that already exists in your day.
        Logging takes one tap. Streaks bend — they don't shatter.
      </p>

      {habits.map((h) => (
        <HabitCard key={h.id} habit={h} />
      ))}

      {habits.length < MAX_HABITS ? (
        <form className="add-task" onSubmit={onSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit — keep it small enough to do on a bad day"
            aria-label="Habit name"
          />
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="After I … (the cue it attaches to, optional)"
            aria-label="Habit trigger"
          />
          <div className="form-row">
            <button className="btn btn-primary" type="submit">
              Add habit
            </button>
          </div>
        </form>
      ) : (
        <p className="section-intro">
          Three is the cap. If one of these has become automatic, retire it and
          make room.
        </p>
      )}
    </section>
  )
}
