import { useEffect, useState } from 'react'

type Activity = 'breathe' | 'green' | 'stretch' | 'quiet'

const ACTIVITIES: { id: Activity; label: string }[] = [
  { id: 'breathe', label: 'Breathe' },
  { id: 'green', label: 'Green gaze' },
  { id: 'stretch', label: 'Stretch' },
  { id: 'quiet', label: 'Sit quietly' },
]

/** 4s in, 6s out. The circle animates via CSS transitions; under
 *  prefers-reduced-motion the circle holds still and the text cues carry
 *  the rhythm alone. */
function Breathing() {
  const [dir, setDir] = useState<'in' | 'out'>('in')

  useEffect(() => {
    let alive = true
    let t: ReturnType<typeof setTimeout>
    const step = (d: 'in' | 'out') => {
      if (!alive) return
      setDir(d)
      t = setTimeout(() => step(d === 'in' ? 'out' : 'in'), d === 'in' ? 4000 : 6000)
    }
    step('in')
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])

  return (
    <div className="breath">
      <div className={`breath-circle breath-${dir}`} aria-hidden="true" />
      <p className="break-cue" aria-live="polite">
        {dir === 'in' ? 'Breathe in…' : '…and slowly out'}
      </p>
    </div>
  )
}

/** 40 seconds of looking at something green restores directed attention. */
function GreenGaze() {
  const [endAt] = useState(() => Date.now() + 40_000)
  const [left, setLeft] = useState(40)

  useEffect(() => {
    const id = setInterval(
      () => setLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000))),
      250,
    )
    return () => clearInterval(id)
  }, [endAt])

  return (
    <div className="green-view">
      <svg viewBox="0 0 400 170" role="img" aria-label="Soft green hills">
        <rect width="400" height="170" fill="#eef4ec" />
        <path d="M0 90 Q 100 55 200 85 T 400 80 V170 H0 Z" fill="#c5d9c7" />
        <path d="M0 115 Q 120 80 240 110 T 400 105 V170 H0 Z" fill="#93b89b" />
        <path d="M0 140 Q 90 112 200 135 T 400 132 V170 H0 Z" fill="#679478" />
        <path d="M0 160 Q 130 138 260 156 T 400 152 V170 H0 Z" fill="#4a7a63" />
      </svg>
      <p className="break-cue" aria-live="polite">
        {left > 0
          ? `Rest your eyes on the green — ${left}s`
          : 'Done. Blink a few times, look somewhere far away.'}
      </p>
    </div>
  )
}

const STRETCHES = [
  'Stand up and reach for the ceiling — hold for three slow breaths.',
  'Roll your shoulders back five times, then forward five times.',
  'Tilt your head gently toward each shoulder — ten seconds a side.',
  'Clasp your hands, stretch your arms forward, and round your upper back.',
  'Arm out, palm up: gently pull your fingers back to stretch the wrist.',
]

function Stretch() {
  const [i, setI] = useState(0)
  return (
    <div className="stretch">
      <p className="break-cue">{STRETCHES[i]}</p>
      <button className="btn" onClick={() => setI((i + 1) % STRETCHES.length)}>
        Another one
      </button>
    </div>
  )
}

function Quiet() {
  return (
    <p className="break-cue">
      Nothing to do for a moment. Let your eyes rest and your thoughts settle.
    </p>
  )
}

/** Shown while the timer is in its break phase. Every option is
 *  restorative by construction — there is deliberately no option that
 *  points at a screen full of other people's thoughts. */
export function BreakPanel() {
  const [activity, setActivity] = useState<Activity | null>(null)

  return (
    <div className="break-panel">
      <div className="break-choices" role="group" aria-label="Break activity">
        {ACTIVITIES.map(({ id, label }) => (
          <button
            key={id}
            className="chip"
            aria-pressed={activity === id}
            onClick={() => setActivity(activity === id ? null : id)}
          >
            {label}
          </button>
        ))}
      </div>
      {activity === null && (
        <p className="break-cue">Step away from the work. Pick something restorative.</p>
      )}
      {activity === 'breathe' && <Breathing />}
      {activity === 'green' && <GreenGaze />}
      {activity === 'stretch' && <Stretch />}
      {activity === 'quiet' && <Quiet />}
    </div>
  )
}
