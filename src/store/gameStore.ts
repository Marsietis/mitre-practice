import { create } from 'zustand'
import { loadDataset } from '../data/loadProcedures'
import { synthesizeIncident } from '../game/incident'
import { mulberry32, newSeed } from '../game/rng'
import { scoreRound } from '../game/scoring'
import { pickDrillItem, pickGroup } from '../game/selection'
import { TECH_MAP } from '../data/attack'
import type { GroupInfo, Incident, Mode, Phase, ProcedureItem, ScoreResult } from '../types'
import { useStatsStore } from './statsStore'

export type CurrentRound =
  | { kind: 'drill'; item: ProcedureItem }
  | { kind: 'incident'; incident: Incident }

interface GameState {
  mode: Mode
  phase: Phase
  loadError: string | null
  procedures: ProcedureItem[] | null
  groups: GroupInfo[] | null
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
  return current.kind === 'drill' ? current.item.a : current.incident.answers
}

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'drill',
  phase: 'loading',
  loadError: null,
  procedures: null,
  groups: null,
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
    finishRound(set, get, scoreRound(selected, currentAnswers(current)), mode)
  },

  giveUp: () => {
    const { current, phase, mode } = get()
    if (!current || phase !== 'answering') return
    finishRound(set, get, scoreRound(get().selected, currentAnswers(current), true), mode)
  },

  next: () => {
    const { procedures, groups, mode } = get()
    if (!procedures || !groups) return
    const stats = useStatsStore.getState()
    const seed = newSeed()
    let current: CurrentRound
    if (mode === 'incident') {
      const group = pickGroup(groups, procedures, stats.techStats, mulberry32(seed))
      current = { kind: 'incident', incident: synthesizeIncident(group, procedures, seed, stats.difficulty) }
    } else {
      const item = pickDrillItem(procedures, stats.techStats, stats.recentItemIds, mulberry32(seed))
      stats.rememberItem(item.i)
      current = { kind: 'drill', item }
    }
    set({ current, phase: 'answering', selected: new Set(), result: null })
  },
}))

function finishRound(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  result: ScoreResult,
  mode: Mode,
) {
  useStatsStore.getState().recordResult(result, mode)
  // auto-expand parents of any sub-technique involved in the verdict
  const expanded = new Set(get().expanded)
  for (const tid of Object.keys(result.verdicts)) {
    const parent = TECH_MAP.get(tid)?.parent
    if (parent) expanded.add(parent)
  }
  set({
    result,
    phase: 'revealed',
    expanded,
    sessionRounds: get().sessionRounds + 1,
    sessionScore: get().sessionScore + result.score,
  })
}
