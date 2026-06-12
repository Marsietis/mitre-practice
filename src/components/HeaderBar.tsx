import { useGameStore } from '../store/gameStore'
import { useStatsStore } from '../store/statsStore'
import type { Mode } from '../types'

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'drill', label: 'Procedure Drill' },
  { mode: 'incident', label: 'Incident Report' },
  { mode: 'stats', label: 'Analyst Record' },
]

export function HeaderBar() {
  const mode = useGameStore((s) => s.mode)
  const setMode = useGameStore((s) => s.setMode)
  const sessionRounds = useGameStore((s) => s.sessionRounds)
  const sessionScore = useGameStore((s) => s.sessionScore)
  const streak = useStatsStore((s) => s.streak)
  const bestStreak = useStatsStore((s) => s.bestStreak)

  const avg = sessionRounds ? Math.round((sessionScore / sessionRounds) * 100) : null

  return (
    <header className="header">
      <div className="header-brand">
        <span className="brand-sigil">◢</span>
        <h1>
          ATT&CK<span className="brand-slash">//</span>RANGE
        </h1>
        <span className="brand-sub">mapping practice console</span>
      </div>
      <nav className="header-tabs" aria-label="Mode">
        {TABS.map((t) => (
          <button
            key={t.mode}
            className={`tab ${mode === t.mode ? 'tab-active' : ''}`}
            onClick={() => setMode(t.mode)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="header-stats">
        <div className="hstat" title="Current streak / best streak">
          <span className="hstat-label">streak</span>
          <span className="hstat-value streak-value">
            {streak}
            <span className="hstat-dim"> / {bestStreak}</span>
          </span>
        </div>
        <div className="hstat" title="Average score this session">
          <span className="hstat-label">session</span>
          <span className="hstat-value">{avg === null ? '—' : `${avg}%`}</span>
        </div>
      </div>
    </header>
  )
}
