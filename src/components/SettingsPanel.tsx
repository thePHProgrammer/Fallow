import { useSettings, type TimerConfig } from '../store/settings'

const DURATIONS: { key: keyof TimerConfig; label: string; hint: string }[] = [
  { key: 'focusMinutes', label: 'Focus block', hint: 'Minutes per Pomodoro block' },
  { key: 'breakMinutes', label: 'Short break', hint: 'Minutes after each block' },
  { key: 'longBreakMinutes', label: 'Long break', hint: 'Minutes after a full cycle' },
  { key: 'blocksPerLongBreak', label: 'Blocks per cycle', hint: 'Blocks before the long break' },
]

export function SettingsPanel() {
  const { calmMode, timerConfig, setCalmMode, setTimerConfig } = useSettings()

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
    </section>
  )
}
