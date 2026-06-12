import { pickWeighted, type Rng } from './rng'
import type { GroupInfo, ProcedureItem, TechStat } from '../types'

/**
 * Adaptive weight: weak techniques (low accuracy) weigh more, never-seen
 * techniques get an exploration bonus, and a floor keeps everything reachable.
 */
export function techniqueWeight(stats: Record<string, TechStat>, tid: string): number {
  const s = stats[tid]
  if (!s || s.seen === 0) return 0.5 + 0.5 + 0.1
  return 1 - s.ewma + 0.1
}

const RECENT_PENALTY = 0.05

export function pickDrillItem<T extends { i: number; a: string[] }>(
  items: T[],
  stats: Record<string, TechStat>,
  recentIds: number[],
  rng: Rng,
): T {
  const recent = new Set(recentIds)
  const weights = items.map((item) => {
    let w = 0
    for (const tid of item.a) w = Math.max(w, techniqueWeight(stats, tid))
    return recent.has(item.i) ? w * RECENT_PENALTY : w
  })
  return pickWeighted(items, weights, rng)
}

export interface CounterCandidate {
  item: ProcedureItem
  mapped: string[]
}

/** Pick a counter-mode procedure, weighted toward weak defensive techniques. */
export function pickCounterItem(
  pool: CounterCandidate[],
  stats: Record<string, TechStat>,
  recentIds: number[],
  rng: Rng,
): CounterCandidate {
  const recent = new Set(recentIds)
  const weights = pool.map(({ item, mapped }) => {
    let w = 0
    for (const did of mapped) w = Math.max(w, techniqueWeight(stats, did))
    return recent.has(item.i) ? w * RECENT_PENALTY : w
  })
  return pickWeighted(pool, weights, rng)
}

export function pickGroup(
  groups: GroupInfo[],
  items: ProcedureItem[],
  stats: Record<string, TechStat>,
  rng: Rng,
): GroupInfo {
  const weights = groups.map((g) => {
    const tids = new Set<string>()
    for (const pid of g.procIds) for (const tid of items[pid].a) tids.add(tid)
    let sum = 0
    for (const tid of tids) sum += techniqueWeight(stats, tid)
    return tids.size ? Math.max(sum / tids.size, 0.1) : 0.1
  })
  return pickWeighted(groups, weights, rng)
}
