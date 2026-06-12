import matrixData from './matrix.json'
import type { Tactic, Technique } from '../types'

export const TACTICS: Tactic[] = matrixData.tactics
export const TECHNIQUES: Technique[] = matrixData.techniques

export const TECH_MAP: Map<string, Technique> = new Map(TECHNIQUES.map((t) => [t.id, t]))

/** Parent techniques per tactic column, alphabetical (ATT&CK convention). */
export const COLUMN_TECHNIQUES: Map<string, Technique[]> = new Map(
  TACTICS.map((tac) => [
    tac.shortname,
    TECHNIQUES.filter((t) => !t.parent && t.tactics.includes(tac.shortname)).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  ]),
)

/** Sub-techniques per parent, alphabetical. */
export const SUBS_OF: Map<string, Technique[]> = new Map()
for (const t of TECHNIQUES) {
  if (!t.parent) continue
  if (!SUBS_OF.has(t.parent)) SUBS_OF.set(t.parent, [])
  SUBS_OF.get(t.parent)!.push(t)
}
for (const subs of SUBS_OF.values()) subs.sort((a, b) => a.name.localeCompare(b.name))

export function techniqueUrl(tid: string): string {
  return `https://attack.mitre.org/techniques/${tid.replace('.', '/')}/`
}

/** Primary tactic of a technique (first kill-chain phase). */
export function primaryTactic(tid: string): string | undefined {
  return TECH_MAP.get(tid)?.tactics[0]
}

const TACTIC_ORDER = new Map(TACTICS.map((t, i) => [t.shortname, i]))
export function tacticIndex(shortname: string | undefined): number {
  return shortname !== undefined ? (TACTIC_ORDER.get(shortname) ?? 99) : 99
}
