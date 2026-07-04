import { useEffect, useState } from 'react'
import { useSettings } from './store/settings'
import { TimerPanel } from './components/TimerPanel'
import { SettingsPanel } from './components/SettingsPanel'

// Phase 3+ will add 'board'; keeping navigation order stable (WCAG 3.2.3).
const TABS = [
  { id: 'focus', label: 'Focus' },
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
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
