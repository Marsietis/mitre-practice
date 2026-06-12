export interface Tactic {
  id: string
  shortname: string
  name: string
}

export interface Technique {
  id: string
  name: string
  tactics: string[]
  parent: string | null
  /** D3FEND only: website class name, e.g. "DecoyFile" */
  uri?: string
  /** D3FEND only: top-level base technique rendered as a group-header row */
  base?: boolean
  /** D3FEND only: the board row this deep sub-technique renders under */
  row?: string
}

export type SourceKind = 'group' | 'software' | 'campaign'

export interface ProcedureItem {
  i: number
  t: string
  a: string[]
  s: string
  k: SourceKind
}

/** D3FEND definition-drill item: redacted definition text + the technique it describes. */
export interface D3DrillItem {
  i: number
  t: string
  a: string[]
}

export interface GroupInfo {
  id: string
  name: string
  aliases: string[]
  procIds: number[]
}

export interface Incident {
  irNumber: string
  date: string
  sector: string
  actorLabel: string
  groupName: string
  groupId: string
  paragraphs: string[]
  answers: string[]
  seed: number
}

export type Verdict = 'hit' | 'partial' | 'missed' | 'wrong'

export interface ScoreResult {
  score: number
  tier: 'perfect' | 'pass' | 'fail'
  hits: string[]
  partials: { selected: string; answer: string }[]
  missed: string[]
  wrong: string[]
  /** technique id -> verdict, for matrix coloring */
  verdicts: Record<string, Verdict>
  gaveUp: boolean
  /** counter mode only: mapped countermeasures the user did not pick — painted
   *  as missed on the board but excluded from `missed` so stats stay sane */
  coverage?: string[]
}

export type Mode = 'drill' | 'incident' | 'd3drill' | 'counter' | 'stats'
export type Phase = 'loading' | 'answering' | 'revealed'

export interface TechStat {
  seen: number
  ewma: number
}
