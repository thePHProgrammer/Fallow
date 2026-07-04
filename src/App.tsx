import { useEffect, useState } from 'react'
import { useSettings } from './store/settings'
import { TimerPanel } from './components/TimerPanel'
import { BoardPanel } from './components/BoardPanel'
import { HabitsPanel } from './components/HabitsPanel'
import { JournalPanel } from './components/JournalPanel'
import { FieldPanel } from './components/FieldPanel'
import { SettingsPanel } from './components/SettingsPanel'

// Keep this order stable everywhere (WCAG 3.2.3).
const TABS = [
  { id: 'focus', label: 'Focus' },
  { id: 'board', label: 'Board' },
  { id: 'habits', label: 'Habits' },
  { id: 'journal', label: 'Journal' },
  { id: 'field', label: 'Field' },
  { id: 'settings', label: 'Settings' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const calmMode = useSettings((s) => s.calmMode)
  const [tab, setTab] = useState<TabId>('focus')

  useEffect(() => {
    document.documentElement.dataset.calm = String(calmMode)
  }, [calmMode])

  return (
    <div className="shell">
      <header className="shell-header">
        <h1 className="shell-title">Fallow</h1>
      </header>

      <nav className="tabs" role="tablist" aria-label="Main">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className="tab"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'focus' && <TimerPanel />}
        {tab === 'board' && <BoardPanel />}
        {tab === 'habits' && <HabitsPanel />}
        {tab === 'journal' && <JournalPanel />}
        {tab === 'field' && <FieldPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
