import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Tactic, Technique } from '../types'
import { TechniqueCell } from './TechniqueCell'

interface BoardData {
  title: string
  tactics: Tactic[]
  columns: Map<string, Technique[]>
  subsOf: Map<string, Technique[]>
}

function TacticColumn({
  tactic,
  techniques,
  subsOf,
  filter,
}: {
  tactic: Tactic
  techniques: Technique[]
  subsOf: Map<string, Technique[]>
  filter: string
}) {
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
          <TechniqueCell key={t.id} tech={t} subs={subsOf.get(t.id) ?? []} filter={filter} />
        ))}
      </div>
    </div>
  )
}

export function MatrixBoard({ title, tactics, columns, subsOf }: BoardData) {
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
        <h2 className="matrix-title">{title}</h2>
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
        {tactics.map((tac) => (
          <TacticColumn
            key={tac.id}
            tactic={tac}
            techniques={columns.get(tac.shortname) ?? []}
            subsOf={subsOf}
            filter={filter.trim().toLowerCase()}
          />
        ))}
      </div>
    </section>
  )
}
