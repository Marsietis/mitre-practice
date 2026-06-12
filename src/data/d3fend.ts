import d3MatrixData from './d3fend-matrix.json'
import { TECH_MAP, techniqueUrl } from './attack'
import type { Tactic, Technique } from '../types'

export const D3_TACTICS: Tactic[] = d3MatrixData.tactics
export const D3_TECHNIQUES: Technique[] = d3MatrixData.techniques

export const D3_TECH_MAP: Map<string, Technique> = new Map(D3_TECHNIQUES.map((t) => [t.id, t]))

/**
 * Rows per tactic column: each base technique as a group-header row followed by
 * its direct children, alphabetical within each group.
 */
export const D3_COLUMN_ROWS: Map<string, Technique[]> = new Map(
  D3_TACTICS.map((tac) => {
    const bases = D3_TECHNIQUES.filter((t) => t.base && t.tactics.includes(tac.shortname)).sort(
      (a, b) => a.name.localeCompare(b.name),
    )
    const rows: Technique[] = []
    for (const base of bases) {
      rows.push(base)
      rows.push(
        ...D3_TECHNIQUES.filter((t) => t.parent === base.id).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
    }
    return [tac.shortname, rows]
  }),
)

/** Deeper sub-techniques per board row, flattened and alphabetical. */
export const D3_SUBS_OF: Map<string, Technique[]> = new Map()
for (const t of D3_TECHNIQUES) {
  if (!t.row) continue
  if (!D3_SUBS_OF.has(t.row)) D3_SUBS_OF.set(t.row, [])
  D3_SUBS_OF.get(t.row)!.push(t)
}
for (const subs of D3_SUBS_OF.values()) subs.sort((a, b) => a.name.localeCompare(b.name))

export function d3TechniqueUrl(tid: string): string {
  const uri = D3_TECH_MAP.get(tid)?.uri
  return uri ? `https://d3fend.mitre.org/technique/d3f:${uri}/` : 'https://d3fend.mitre.org/'
}

/** Look up a technique id in either knowledge base (id spaces are disjoint). */
export function lookupTech(tid: string): Technique | undefined {
  return TECH_MAP.get(tid) ?? D3_TECH_MAP.get(tid)
}

export function studyUrl(tid: string): string {
  return D3_TECH_MAP.has(tid) ? d3TechniqueUrl(tid) : techniqueUrl(tid)
}
