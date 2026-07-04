import { useTimer } from '../store/timer'

/**
 * Gentle gamification, growth-only by design. Completed focus blocks grow
 * plants; there is no decay, no loss, no red state. A bare plot is soil
 * resting, not a failure — that's what fallow means.
 */

const DAYS_SHOWN = 14

function dayKey(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA')
}

function pastDay(offset: number): { key: string; label: string; isToday: boolean } {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return {
    key: d.toLocaleDateString('en-CA'),
    label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
    isToday: offset === 0,
  }
}

/** stage 0: resting soil · 1: sprout · 2: young plant · 3: full plant · 4: flowering */
function Plant({ stage }: { stage: number }) {
  const stem = [0, 14, 24, 32, 36][stage]
  return (
    <svg viewBox="0 0 60 70" aria-hidden="true">
      <ellipse cx="30" cy="62" rx="15" ry="5" fill="#dccfba" />
      {stage >= 1 && (
        <>
          <path
            d={`M30 62 V ${62 - stem}`}
            stroke="#4a7a63"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M30 ${62 - stem * 0.55} q 9 -1 12 -9 q -10 0 -12 9`}
            fill="#679478"
          />
        </>
      )}
      {stage >= 2 && (
        <path
          d={`M30 ${62 - stem * 0.75} q -9 -1 -12 -9 q 10 0 12 9`}
          fill="#679478"
        />
      )}
      {stage >= 3 && (
        <path d={`M30 ${62 - stem * 0.35} q 8 0 11 -7 q -9 -1 -11 7`} fill="#93b89b" />
      )}
      {stage >= 4 && (
        <>
          <circle cx="30" cy={62 - stem - 4} r="6" fill="#d9a662" />
          <circle cx="30" cy={62 - stem - 4} r="2.5" fill="#a9773a" />
        </>
      )}
    </svg>
  )
}

export function FieldPanel() {
  const sessions = useTimer((s) => s.sessions)

  const completed = sessions.filter((s) => s.completed)
  const perDay = new Map<string, number>()
  for (const s of completed) {
    const k = dayKey(s.end)
    perDay.set(k, (perDay.get(k) ?? 0) + 1)
  }

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) =>
    pastDay(DAYS_SHOWN - 1 - i),
  )

  return (
    <section className="field" aria-label="The field">
      <p className="section-intro">
        Each finished focus block grows something here. Nothing ever withers —
        bare plots are soil resting, and rest is part of the cycle.
      </p>

      <div className="field-grid">
        {days.map(({ key, label, isToday }) => {
          const count = perDay.get(key) ?? 0
          const stage = Math.min(count, 4)
          return (
            <div className={`plot${isToday ? ' plot-today' : ''}`} key={key}>
              <Plant stage={stage} />
              <span className="plot-label" aria-hidden="true">
                {label}
              </span>
              <span className="sr-only">
                {`${label}: ${count} focus block${count === 1 ? '' : 's'}`}
              </span>
            </div>
          )
        })}
      </div>

      <p className="field-total">
        {completed.length === 0
          ? 'The field is quiet. The first block plants the first seed.'
          : `${completed.length} block${completed.length === 1 ? '' : 's'} grown all time.`}
      </p>
    </section>
  )
}
