import { COUNTER_MAX_PICKS, useGameStore, type CurrentRound } from '../store/gameStore'
import { useStatsStore } from '../store/statsStore'
import { D3DefinitionCard } from './D3DefinitionCard'
import { IncidentReport } from './IncidentReport'
import { ProcedureCard } from './ProcedureCard'
import { ResultBar } from './ResultBar'

function RoundCard({ current }: { current: CurrentRound }) {
  switch (current.kind) {
    case 'drill':
      return <ProcedureCard item={current.item} />
    case 'incident':
      return <IncidentReport incident={current.incident} />
    case 'd3drill':
      return <D3DefinitionCard item={current.item} />
    case 'counter':
      return <ProcedureCard item={current.item} directive="select 3–6 D3FEND countermeasures" />
  }
}

export function ContentPanel() {
  const phase = useGameStore((s) => s.phase)
  const current = useGameStore((s) => s.current)
  const result = useGameStore((s) => s.result)
  const selectedCount = useGameStore((s) => s.selected.size)
  const submit = useGameStore((s) => s.submit)
  const giveUp = useGameStore((s) => s.giveUp)
  const clearSelection = useGameStore((s) => s.clearSelection)
  const loadError = useGameStore((s) => s.loadError)
  const d3LoadError = useGameStore((s) => s.d3LoadError)
  const mode = useGameStore((s) => s.mode)
  const difficulty = useStatsStore((s) => s.difficulty)
  const setDifficulty = useStatsStore((s) => s.setDifficulty)
  const isD3 = mode === 'd3drill' || mode === 'counter'

  if (loadError || (isD3 && d3LoadError)) {
    return (
      <div className="content-panel">
        <div className="panel-message error">
          Failed to load dataset: {loadError ?? d3LoadError}. Run{' '}
          <code>{loadError ? 'npm run update-data' : 'npm run update-d3fend'}</code> and reload.
        </div>
      </div>
    )
  }

  if (phase === 'loading' || !current) {
    return (
      <div className="content-panel">
        <div className="panel-message">
          <span className="loading-pulse">▮▮▮</span>{' '}
          {isD3 ? 'loading defensive intelligence…' : 'loading procedure intelligence…'}
        </div>
      </div>
    )
  }

  return (
    <div className="content-panel">
      <RoundCard current={current} />

      {phase === 'answering' ? (
        <div className="action-bar">
          <span className="selection-readout">
            {mode === 'counter' ? (
              <>
                <strong>{selectedCount}</strong>/{COUNTER_MAX_PICKS} selected · best scored at 3+
              </>
            ) : (
              <>
                <strong>{selectedCount}</strong> selected
              </>
            )}
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
