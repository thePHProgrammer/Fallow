import { useRef } from 'react'
import { useSettings, type TimerConfig } from '../store/settings'

// Every persisted store. Export/import moves all of them at once, so data
// is never locked into one browser.
const STORE_KEYS = [
  'fallow-settings',
  'fallow-timer',
  'fallow-tasks',
  'fallow-habits',
  'fallow-journal',
]

const DURATIONS: { key: keyof TimerConfig; label: string; hint: string }[] = [
  { key: 'focusMinutes', label: 'Focus block', hint: 'Minutes per Pomodoro block' },
  { key: 'breakMinutes', label: 'Short break', hint: 'Minutes after each block' },
  { key: 'longBreakMinutes', label: 'Long break', hint: 'Minutes after a full cycle' },
  { key: 'blocksPerLongBreak', label: 'Blocks per cycle', hint: 'Blocks before the long break' },
]

export function SettingsPanel() {
  const { calmMode, timerConfig, setCalmMode, setTimerConfig } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const data = Object.fromEntries(
      STORE_KEYS.map((k) => [k, JSON.parse(localStorage.getItem(k) ?? 'null')]),
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    a.download = `fallow-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>
      const known = STORE_KEYS.filter((k) => data[k] != null)
      if (known.length === 0) throw new Error('no Fallow data found')
      if (!window.confirm(`Replace current data with this export (${known.length} stores)?`))
        return
      for (const k of known) localStorage.setItem(k, JSON.stringify(data[k]))
      location.reload()
    } catch {
      window.alert('That file does not look like a Fallow export.')
    }
  }

  return (
    <section className="settings" aria-label="Settings">
      <div className="setting-row">
        <div>
          <label htmlFor="calm-mode">Calm Mode</label>
          <p className="hint">Mutes accent colours and removes all motion.</p>
        </div>
        <input
          id="calm-mode"
          type="checkbox"
          checked={calmMode}
          onChange={(e) => setCalmMode(e.target.checked)}
        />
      </div>

      {DURATIONS.map(({ key, label, hint }) => (
        <div className="setting-row" key={key}>
          <div>
            <label htmlFor={`cfg-${key}`}>{label}</label>
            <p className="hint">{hint}</p>
          </div>
          <input
            id={`cfg-${key}`}
            type="number"
            min={1}
            max={180}
            value={timerConfig[key]}
            onChange={(e) => {
              const v = e.target.valueAsNumber
              if (Number.isFinite(v) && v >= 1) setTimerConfig({ [key]: v })
            }}
          />
        </div>
      ))}

      <div className="setting-row">
        <div>
          <p>Your data</p>
          <p className="hint">
            Everything lives in this browser. Export a JSON snapshot any time;
            import replaces what's here.
          </p>
        </div>
        <div className="form-row">
          <button className="btn" onClick={exportData}>
            Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importData(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </section>
  )
}
