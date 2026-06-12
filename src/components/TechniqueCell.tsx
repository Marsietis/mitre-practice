import { memo } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Technique } from '../types'

function matches(t: Technique, filter: string): boolean {
  return t.name.toLowerCase().includes(filter) || t.id.toLowerCase().includes(filter)
}

/** Short display id for a sub row: the suffix for ATT&CK subs, the full id otherwise. */
const subDisplayId = (tid: string) => (tid.includes('.') ? tid.split('.')[1] : tid)

function SubRow({ sub, filter }: { sub: Technique; filter: string }) {
  const selected = useGameStore((s) => s.selected.has(sub.id))
  const verdict = useGameStore((s) => s.result?.verdicts[sub.id])
  const toggle = useGameStore((s) => s.toggleTechnique)
  const dim = filter !== '' && !matches(sub, filter)

  return (
    <button
      className={[
        'cell sub-cell',
        selected ? 'cell-selected' : '',
        verdict ? `cell-${verdict}` : '',
        dim ? 'cell-dim' : '',
      ].join(' ')}
      data-verdict={verdict}
      onClick={() => toggle(sub.id)}
    >
      <span className="cell-tid">{subDisplayId(sub.id)}</span>
      <span className="cell-name">{sub.name}</span>
    </button>
  )
}

export const TechniqueCell = memo(function TechniqueCell({
  tech,
  subs,
  filter,
}: {
  tech: Technique
  subs: Technique[]
  filter: string
}) {
  const selected = useGameStore((s) => s.selected.has(tech.id))
  const verdict = useGameStore((s) => s.result?.verdicts[tech.id])
  const expanded = useGameStore((s) => s.expanded.has(tech.id))
  const toggle = useGameStore((s) => s.toggleTechnique)
  const toggleExpand = useGameStore((s) => s.toggleExpand)

  const subMatch = filter !== '' && subs.some((s) => matches(s, filter))
  const dim = filter !== '' && !matches(tech, filter) && !subMatch
  const multiTactic = tech.tactics.length > 1

  return (
    <div className="cell-group">
      <div
        className={[
          'cell parent-cell',
          tech.base ? 'cell-base' : '',
          selected ? 'cell-selected' : '',
          verdict ? `cell-${verdict}` : '',
          dim ? 'cell-dim' : '',
        ].join(' ')}
        data-verdict={verdict}
        onClick={() => toggle(tech.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle(tech.id)
          }
        }}
      >
        <span className="cell-tid">
          {tech.id}
          {multiTactic && (
            <span className="multi-tactic" title={`Appears in ${tech.tactics.length} tactics — selection applies everywhere`}>
              ⧉
            </span>
          )}
        </span>
        <span className="cell-name">{tech.name}</span>
        {subs.length > 0 && (
          <button
            className={`sub-toggle ${expanded ? 'sub-toggle-open' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(tech.id)
            }}
            title={`${subs.length} sub-techniques`}
          >
            {subs.length}
            <span className="chevron">{expanded ? '▾' : '▸'}</span>
          </button>
        )}
      </div>
      {expanded && (
        <div className="sub-list">
          {subs.map((sub) => (
            <SubRow key={sub.id} sub={sub} filter={filter} />
          ))}
        </div>
      )}
    </div>
  )
})
