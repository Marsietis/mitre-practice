import { TECH_MAP } from '../data/attack'
import type { Mode, ScoreResult, Verdict } from '../types'

function isParentChild(a: string, b: string): boolean {
  const ta = TECH_MAP.get(a)
  const tb = TECH_MAP.get(b)
  return ta?.parent === b || tb?.parent === a
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

/** Streak delta: +1 increment, 0 hold, -1 reset. */
export function streakAction(result: ScoreResult, mode: Mode): 1 | 0 | -1 {
  if (result.gaveUp) return -1
  if (result.score < 0.5) return -1
  const incrementAt = mode === 'incident' ? 0.75 : 1
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
