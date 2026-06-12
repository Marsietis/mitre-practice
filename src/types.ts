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
}

export type SourceKind = 'group' | 'software' | 'campaign'

export interface ProcedureItem {
  i: number
  t: string
  a: string[]
  s: string
  k: SourceKind
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
}

export type Mode = 'drill' | 'incident' | 'stats'
export type Phase = 'loading' | 'answering' | 'revealed'

export interface TechStat {
  seen: number
  ewma: number
}
