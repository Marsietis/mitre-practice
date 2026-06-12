import { primaryTactic, tacticIndex, TACTICS } from '../data/attack'
import { mulberry32 } from './rng'
import type { GroupInfo, Incident, ProcedureItem } from '../types'

const SECTORS = [
  'financial services',
  'healthcare',
  'energy',
  'government',
  'telecommunications',
  'manufacturing',
  'defense industrial base',
  'higher education',
]

const EARLY = [
  'Initial triage established that',
  'The earliest observed activity indicated that',
  'Entry-point analysis showed that',
]
const MID = [
  'Subsequently,',
  'Further forensic review revealed that',
  'Telemetry from affected hosts showed that',
  'Analysts additionally observed that',
  'Continued investigation determined that',
]
const LATE = [
  'In the later stages of the intrusion,',
  'Toward the end of the activity window,',
  'Finally, responders determined that',
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TARGET = 6
const MIN = 4
const MAX = 8
const MAX_ANSWERS = 10

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceActor(text: string, names: string[], replacement: string): string {
  let out = text
  for (const name of names) {
    if (name.length < 3) continue
    out = out.replace(new RegExp(`\\b${escapeRe(name)}\\b`, 'gi'), replacement)
  }
  // collapse "the actor (the actor)" artifacts from alias parentheticals
  return out.replace(/the actor\s*\(\s*the actor\s*\)/gi, 'the actor')
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

export function synthesizeIncident(
  group: GroupInfo,
  items: ProcedureItem[],
  seed: number,
  difficulty: 'easy' | 'hard',
): Incident {
  const rng = mulberry32(seed)

  // bucket the group's procedures by primary tactic, ordered along the kill chain
  const buckets = new Map<string, ProcedureItem[]>()
  for (const pid of group.procIds) {
    const item = items[pid]
    const tactic = primaryTactic(item.a[0]) ?? 'unknown'
    if (!buckets.has(tactic)) buckets.set(tactic, [])
    buckets.get(tactic)!.push(item)
  }
  const orderedTactics = [...buckets.keys()].sort((a, b) => tacticIndex(a) - tacticIndex(b))
  for (const t of orderedTactics) {
    const arr = buckets.get(t)!
    // shuffle within bucket (Fisher-Yates with seeded rng)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  // round-robin across tactics in kill-chain order, max 2 per tactic,
  // skipping procedures that add no new techniques
  const chosen: ProcedureItem[] = []
  const covered = new Set<string>()
  for (let round = 0; round < 2 && chosen.length < MAX; round++) {
    for (const tactic of orderedTactics) {
      if (chosen.length >= MAX) break
      const candidate = buckets.get(tactic)![round]
      if (!candidate) continue
      if (candidate.a.every((tid) => covered.has(tid))) continue
      chosen.push(candidate)
      for (const tid of candidate.a) covered.add(tid)
      if (chosen.length >= TARGET && round > 0) break
    }
  }
  // cap the answer burden: drop last-picked items until the union is small enough
  while (chosen.length > MIN) {
    const union = new Set(chosen.flatMap((c) => c.a))
    if (union.size <= MAX_ANSWERS) break
    chosen.pop()
  }
  chosen.sort(
    (a, b) => tacticIndex(primaryTactic(a.a[0])) - tacticIndex(primaryTactic(b.a[0])),
  )
  const answers = [...new Set(chosen.flatMap((c) => c.a))].sort()

  const hard = difficulty === 'hard'
  const actorLabel = hard ? 'an unattributed threat actor' : group.name
  const actorNames = [group.name, ...group.aliases]

  const paragraphs = chosen.map((item, idx) => {
    let body = item.t
    // rewrite a leading source name so the connector splices naturally
    if (body.toLowerCase().startsWith(item.s.toLowerCase())) {
      body = 'The actor' + body.slice(item.s.length)
    }
    if (hard) body = replaceActor(body, actorNames, 'the actor')
    const stage = idx === 0 ? EARLY : idx >= chosen.length - 1 ? LATE : MID
    const connector = stage[Math.floor(rng() * stage.length)]
    return `${connector} ${lowerFirst(body)}`
  })

  const day = 1 + Math.floor(rng() * 28)
  const month = MONTHS[Math.floor(rng() * 12)]
  const year = 2024 + Math.floor(rng() * 2)

  return {
    irNumber: `IR-${(seed % 9000) + 1000}`,
    date: `${day} ${month} ${year}`,
    sector: SECTORS[Math.floor(rng() * SECTORS.length)],
    actorLabel,
    groupName: group.name,
    groupId: group.id,
    paragraphs,
    answers,
    seed,
  }
}

/** Sanity helper used by the UI: tactic count covered by an incident. */
export function tacticsCovered(answers: string[]): number {
  const set = new Set<string>()
  for (const a of answers) {
    const t = primaryTactic(a)
    if (t) set.add(t)
  }
  return Math.min(set.size, TACTICS.length)
}
