import { lookupTech } from '../data/d3fend'
import type { Mode, ScoreResult, Verdict } from '../types'

function isParentChild(a: string, b: string): boolean {
  return lookupTech(a)?.parent === b || lookupTech(b)?.parent === a
}

/**
 * Greedy matching: exact ids first (credit 1.0), then parent<->child partials
 * (credit 0.5, each consumes one answer). Score is symmetric: misses and
 * extra selections both reduce it.
 */
export function scoreRound(selected: Set<string>, answers: string[], gaveUp = false): ScoreResult {
  const remainingAnswers = new Set(answers)
  const remainingSelected = new Set(selected)
  const hits: string[] = []
  const partials: { selected: string; answer: string }[] = []

  for (const sel of [...remainingSelected]) {
    if (remainingAnswers.has(sel)) {
      hits.push(sel)
      remainingAnswers.delete(sel)
      remainingSelected.delete(sel)
    }
  }
  for (const sel of [...remainingSelected]) {
    for (const ans of remainingAnswers) {
      if (isParentChild(sel, ans)) {
        partials.push({ selected: sel, answer: ans })
        remainingAnswers.delete(ans)
        remainingSelected.delete(sel)
        break
      }
    }
  }

  const missed = [...remainingAnswers]
  const wrong = [...remainingSelected]
  const credits = hits.length + 0.5 * partials.length
  const denom = Math.max(answers.length, selected.size, 1)
  const score = gaveUp ? 0 : credits / denom

  const verdicts: Record<string, Verdict> = {}
  for (const ans of missed) verdicts[ans] = 'missed'
  for (const p of partials) {
    verdicts[p.selected] = 'partial'
    verdicts[p.answer] = 'partial'
  }
  for (const h of hits) verdicts[h] = 'hit'
  for (const w of wrong) verdicts[w] = 'wrong'

  return {
    score,
    tier: score >= 1 ? 'perfect' : score >= 0.5 ? 'pass' : 'fail',
    hits,
    partials,
    missed,
    wrong,
    verdicts,
    gaveUp,
  }
}

/**
 * Counter mode: the mapped set is broad (often 30+), so score precision over a
 * minimum-picks floor instead of exact-set match. A pick counts if it is in
 * the mapped set (1.0) or a parent/child of an unconsumed mapped id (0.5).
 * Unpicked mapped ids go to `coverage` (revealed on the board, not penalized).
 */
export function scoreCounterRound(selected: Set<string>, mapped: string[], gaveUp = false): ScoreResult {
  const MIN_PICKS = 3
  const mappedSet = new Set(mapped)
  const remaining = new Set(mapped)
  const hits: string[] = []
  const partials: { selected: string; answer: string }[] = []
  const wrong: string[] = []

  for (const sel of selected) {
    if (mappedSet.has(sel)) {
      hits.push(sel)
      remaining.delete(sel)
    }
  }
  for (const sel of selected) {
    if (mappedSet.has(sel)) continue
    let matched = false
    for (const ans of remaining) {
      if (isParentChild(sel, ans)) {
        partials.push({ selected: sel, answer: ans })
        remaining.delete(ans)
        matched = true
        break
      }
    }
    if (!matched) wrong.push(sel)
  }

  const credits = hits.length + 0.5 * partials.length
  const score = gaveUp ? 0 : Math.min(1, credits / Math.max(selected.size, MIN_PICKS))
  const coverage = [...remaining]

  const verdicts: Record<string, Verdict> = {}
  for (const c of coverage) verdicts[c] = 'missed'
  for (const p of partials) {
    verdicts[p.selected] = 'partial'
    verdicts[p.answer] = 'partial'
  }
  for (const h of hits) verdicts[h] = 'hit'
  for (const w of wrong) verdicts[w] = 'wrong'

  return {
    score,
    tier: score >= 1 ? 'perfect' : score >= 0.5 ? 'pass' : 'fail',
    hits,
    partials,
    missed: [],
    wrong,
    verdicts,
    gaveUp,
    coverage,
  }
}

/** Streak delta: +1 increment, 0 hold, -1 reset. */
export function streakAction(result: ScoreResult, mode: Mode): 1 | 0 | -1 {
  if (result.gaveUp) return -1
  if (result.score < 0.5) return -1
  const incrementAt = mode === 'incident' || mode === 'counter' ? 0.75 : 1
  return result.score >= incrementAt ? 1 : 0
}

/** Per-technique outcomes feeding the adaptive selector. */
export function techniqueOutcomes(result: ScoreResult): Map<string, number> {
  const out = new Map<string, number>()
  for (const h of result.hits) out.set(h, 1)
  for (const p of result.partials) out.set(p.answer, 0.5)
  for (const m of result.missed) out.set(m, 0)
  for (const w of result.wrong) out.set(w, Math.min(out.get(w) ?? 0, 0))
  return out
}
