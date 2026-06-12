import { create } from 'zustand'
import { loadDataset, loadD3Dataset } from '../data/loadProcedures'
import { synthesizeIncident } from '../game/incident'
import { mulberry32, newSeed } from '../game/rng'
import { scoreCounterRound, scoreRound } from '../game/scoring'
import { pickCounterItem, pickDrillItem, pickGroup, type CounterCandidate } from '../game/selection'
import { lookupTech } from '../data/d3fend'
import type { D3DrillItem, GroupInfo, Incident, Mode, Phase, ProcedureItem, ScoreResult } from '../types'
import { useStatsStore } from './statsStore'

export type CurrentRound =
  | { kind: 'drill'; item: ProcedureItem }
  | { kind: 'incident'; incident: Incident }
  | { kind: 'd3drill'; item: D3DrillItem }
  | { kind: 'counter'; item: ProcedureItem; mapped: string[] }

/** Minimum mapped countermeasures for a procedure to qualify for counter mode. */
const COUNTER_MIN_MAPPED = 4
/** Maximum selections in counter mode. */
export const COUNTER_MAX_PICKS = 6

interface GameState {
  mode: Mode
  phase: Phase
  loadError: string | null
  d3LoadError: string | null
  procedures: ProcedureItem[] | null
  groups: GroupInfo[] | null
  d3items: D3DrillItem[] | null
  d3map: Record<string, string[]> | null
  counterPool: CounterCandidate[] | null
  current: CurrentRound | null
  selected: Set<string>
  expanded: Set<string>
  result: ScoreResult | null
  sessionRounds: number
  sessionScore: number
  init: () => Promise<void>
  setMode: (mode: Mode) => void
  toggleTechnique: (tid: string) => void
  toggleExpand: (tid: string) => void
  clearSelection: () => void
  submit: () => void
  giveUp: () => void
  next: () => void
}

function currentAnswers(current: CurrentRound): string[] {
  if (current.kind === 'incident') return current.incident.answers
  if (current.kind === 'counter') return current.mapped
  return current.item.a
}

/** Mapped D3FEND techniques for a procedure (sub-techniques fall back to their parent). */
function mappedFor(item: ProcedureItem, map: Record<string, string[]>): string[] {
  const union = new Set<string>()
  for (const tid of item.a) {
    for (const did of map[tid] ?? map[tid.split('.')[0]] ?? []) union.add(did)
  }
  return [...union].sort()
}

const isD3Mode = (mode: Mode) => mode === 'd3drill' || mode === 'counter'

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'drill',
  phase: 'loading',
  loadError: null,
  d3LoadError: null,
  procedures: null,
  groups: null,
  d3items: null,
  d3map: null,
  counterPool: null,
  current: null,
  selected: new Set(),
  expanded: new Set(),
  result: null,
  sessionRounds: 0,
  sessionScore: 0,

  init: async () => {
    try {
      const { procedures, groups } = await loadDataset()
      set({ procedures, groups })
      get().next()
    } catch (e) {
      set({ loadError: e instanceof Error ? e.message : String(e) })
    }
  },

  setMode: (mode) => {
    if (mode === get().mode) return
    set({ mode })
    if (mode !== 'stats') {
      set({ phase: 'loading', current: null, result: null })
      get().next()
    }
  },

  toggleTechnique: (tid) => {
    if (get().phase !== 'answering') return
    const selected = new Set(get().selected)
    if (selected.has(tid)) selected.delete(tid)
    else if (get().mode === 'counter' && selected.size >= COUNTER_MAX_PICKS) return
    else selected.add(tid)
    set({ selected })
  },

  toggleExpand: (tid) => {
    const expanded = new Set(get().expanded)
    if (expanded.has(tid)) expanded.delete(tid)
    else expanded.add(tid)
    set({ expanded })
  },

  clearSelection: () => {
    if (get().phase === 'answering') set({ selected: new Set() })
  },

  submit: () => {
    const { current, selected, phase, mode } = get()
    if (!current || phase !== 'answering' || selected.size === 0) return
    const result =
      current.kind === 'counter'
        ? scoreCounterRound(selected, current.mapped)
        : scoreRound(selected, currentAnswers(current))
    finishRound(set, get, result, mode)
  },

  giveUp: () => {
    const { current, phase, mode } = get()
    if (!current || phase !== 'answering') return
    const result =
      current.kind === 'counter'
        ? scoreCounterRound(get().selected, current.mapped, true)
        : scoreRound(get().selected, currentAnswers(current), true)
    finishRound(set, get, result, mode)
  },

  next: () => {
    const { procedures, groups, mode } = get()
    if (!procedures || !groups) return
    if (isD3Mode(mode) && !ensureD3Data(set, get)) return
    const stats = useStatsStore.getState()
    const seed = newSeed()
    let current: CurrentRound
    if (mode === 'incident') {
      const group = pickGroup(groups, procedures, stats.techStats, mulberry32(seed))
      current = { kind: 'incident', incident: synthesizeIncident(group, procedures, seed, stats.difficulty) }
    } else if (mode === 'd3drill') {
      const item = pickDrillItem(get().d3items!, stats.techStats, stats.recentD3ItemIds, mulberry32(seed))
      stats.rememberD3Item(item.i)
      current = { kind: 'd3drill', item }
    } else if (mode === 'counter') {
      const pick = pickCounterItem(get().counterPool!, stats.techStats, stats.recentItemIds, mulberry32(seed))
      stats.rememberItem(pick.item.i)
      current = { kind: 'counter', item: pick.item, mapped: pick.mapped }
    } else {
      const item = pickDrillItem(procedures, stats.techStats, stats.recentItemIds, mulberry32(seed))
      stats.rememberItem(item.i)
      current = { kind: 'drill', item }
    }
    set({ current, phase: 'answering', selected: new Set(), result: null })
  },
}))

/** Lazily load the D3FEND dataset; returns true when it is ready. */
function ensureD3Data(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): boolean {
  const { d3items, d3map, counterPool, procedures } = get()
  if (d3items && d3map && counterPool) return true
  set({ phase: 'loading', d3LoadError: null })
  loadD3Dataset()
    .then(({ items, map }) => {
      if (get().d3items) return // a concurrent load already finished
      const counterPool: CounterCandidate[] = []
      for (const item of procedures ?? []) {
        const mapped = mappedFor(item, map)
        if (mapped.length >= COUNTER_MIN_MAPPED) counterPool.push({ item, mapped })
      }
      set({ d3items: items, d3map: map, counterPool })
      if (isD3Mode(get().mode)) get().next()
    })
    .catch((e) => {
      set({ d3LoadError: e instanceof Error ? e.message : String(e) })
    })
  return false
}

function finishRound(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  result: ScoreResult,
  mode: Mode,
) {
  useStatsStore.getState().recordResult(result, mode)
  // auto-expand rows of any sub-technique involved in the verdict
  const expanded = new Set(get().expanded)
  for (const tid of Object.keys(result.verdicts)) {
    const tech = lookupTech(tid)
    if (tech?.parent) expanded.add(tech.parent)
    if (tech?.row) expanded.add(tech.row)
  }
  set({
    result,
    phase: 'revealed',
    expanded,
    sessionRounds: get().sessionRounds + 1,
    sessionScore: get().sessionScore + result.score,
  })
}
