import { useEffect, useRef, useState } from 'react'
import { COLUMN_TECHNIQUES, TACTICS } from '../data/attack'
import { useGameStore } from '../store/gameStore'
import type { Tactic } from '../types'
import { TechniqueCell } from './TechniqueCell'

function TacticColumn({ tactic, filter }: { tactic: Tactic; filter: string }) {
  const techniques = COLUMN_TECHNIQUES.get(tactic.shortname) ?? []
  const selectedInColumn = useGameStore(
    (s) => techniques.filter((t) => s.selected.has(t.id)).length,
  )

  return (
    <div className="tactic-column">
      <div className="tactic-header">
        <span className="tactic-name">{tactic.name}</span>
        <span className="tactic-meta">
          {selectedInColumn > 0 && <span className="tactic-selected">{selectedInColumn} ●</span>}
          <span className="tactic-count">{techniques.length}</span>
        </span>
      </div>
      <div className="tactic-cells">
        {techniques.map((t) => (
          <TechniqueCell key={t.id} tech={t} filter={filter} />
        ))}
      </div>
    </div>
  )
}

export function MatrixBoard() {
  const [filter, setFilter] = useState('')
  const result = useGameStore((s) => s.result)
  const boardRef = useRef<HTMLDivElement>(null)

  // after submit, bring the first missed answer into view
  useEffect(() => {
    if (!result) return
    const target = boardRef.current?.querySelector('[data-verdict="missed"], [data-verdict="partial"]')
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [result])

  return (
    <section className="matrix-section">
      <div className="matrix-toolbar">
        <h2 className="matrix-title">Enterprise Matrix</h2>
        <div className="legend">
          <span className="legend-item legend-selected">selected</span>
          <span className="legend-item legend-hit">hit</span>
          <span className="legend-item legend-partial">partial</span>
          <span className="legend-item legend-missed">missed</span>
          <span className="legend-item legend-wrong">wrong</span>
        </div>
        <input
          className="matrix-filter"
          type="search"
          placeholder="filter techniques…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="matrix-board" ref={boardRef}>
        {TACTICS.map((tac) => (
          <TacticColumn key={tac.id} tactic={tac} filter={filter.trim().toLowerCase()} />
        ))}
      </div>
    </section>
  )
}
