import { useGameStore } from '../store/gameStore'
import { useStatsStore } from '../store/statsStore'
import { IncidentReport } from './IncidentReport'
import { ProcedureCard } from './ProcedureCard'
import { ResultBar } from './ResultBar'

export function ContentPanel() {
  const phase = useGameStore((s) => s.phase)
  const current = useGameStore((s) => s.current)
  const result = useGameStore((s) => s.result)
  const selectedCount = useGameStore((s) => s.selected.size)
  const submit = useGameStore((s) => s.submit)
  const giveUp = useGameStore((s) => s.giveUp)
  const clearSelection = useGameStore((s) => s.clearSelection)
  const loadError = useGameStore((s) => s.loadError)
  const mode = useGameStore((s) => s.mode)
  const difficulty = useStatsStore((s) => s.difficulty)
  const setDifficulty = useStatsStore((s) => s.setDifficulty)

  if (loadError) {
    return (
      <div className="content-panel">
        <div className="panel-message error">
          Failed to load dataset: {loadError}. Run <code>npm run update-data</code> and reload.
        </div>
      </div>
    )
  }

  if (phase === 'loading' || !current) {
    return (
      <div className="content-panel">
        <div className="panel-message">
          <span className="loading-pulse">▮▮▮</span> loading procedure intelligence…
        </div>
      </div>
    )
  }

  return (
    <div className="content-panel">
      {current.kind === 'drill' ? (
        <ProcedureCard item={current.item} />
      ) : (
        <IncidentReport incident={current.incident} />
      )}

      {phase === 'answering' ? (
        <div className="action-bar">
          <span className="selection-readout">
            <strong>{selectedCount}</strong> selected
          </span>
          {mode === 'incident' && (
            <button
              className="btn btn-ghost"
              onClick={() => setDifficulty(difficulty === 'hard' ? 'easy' : 'hard')}
              title="Easy shows the real actor name on the next report"
            >
              difficulty: {difficulty}
            </button>
          )}
          <button className="btn btn-ghost" onClick={clearSelection} disabled={selectedCount === 0}>
            Clear
          </button>
          <button className="btn btn-ghost btn-reveal" onClick={giveUp} title="Resets your streak">
            Reveal answer
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={selectedCount === 0}
            title="Enter"
          >
            Submit mapping ⏎
          </button>
        </div>
      ) : (
        result && <ResultBar result={result} />
      )}
    </div>
  )
}
