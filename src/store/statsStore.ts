import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode, ScoreResult, TechStat } from '../types'
import { streakAction, techniqueOutcomes } from '../game/scoring'

const EWMA_ALPHA = 0.3
const RECENT_MAX = 200

interface StatsState {
  techStats: Record<string, TechStat>
  streak: number
  bestStreak: number
  totalAnswered: number
  totalPerfect: number
  recentItemIds: number[]
  recentD3ItemIds: number[]
  difficulty: 'easy' | 'hard'
  recordResult: (result: ScoreResult, mode: Mode) => void
  rememberItem: (itemId: number) => void
  rememberD3Item: (itemId: number) => void
  setDifficulty: (d: 'easy' | 'hard') => void
  resetAll: () => void
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      techStats: {},
      streak: 0,
      bestStreak: 0,
      totalAnswered: 0,
      totalPerfect: 0,
      recentItemIds: [],
      recentD3ItemIds: [],
      difficulty: 'hard',

      recordResult: (result, mode) => {
        const techStats = { ...get().techStats }
        for (const [tid, outcome] of techniqueOutcomes(result)) {
          const prev = techStats[tid]
          techStats[tid] = prev
            ? { seen: prev.seen + 1, ewma: EWMA_ALPHA * outcome + (1 - EWMA_ALPHA) * prev.ewma }
            : { seen: 1, ewma: EWMA_ALPHA * outcome + (1 - EWMA_ALPHA) * 0.5 }
        }
        const action = streakAction(result, mode)
        const streak = action === 1 ? get().streak + 1 : action === -1 ? 0 : get().streak
        set({
          techStats,
          streak,
          bestStreak: Math.max(get().bestStreak, streak),
          totalAnswered: get().totalAnswered + 1,
          totalPerfect: get().totalPerfect + (result.tier === 'perfect' ? 1 : 0),
        })
      },

      rememberItem: (itemId) =>
        set({ recentItemIds: [...get().recentItemIds, itemId].slice(-RECENT_MAX) }),

      rememberD3Item: (itemId) =>
        set({ recentD3ItemIds: [...get().recentD3ItemIds, itemId].slice(-RECENT_MAX) }),

      setDifficulty: (difficulty) => set({ difficulty }),

      resetAll: () =>
        set({
          techStats: {},
          streak: 0,
          bestStreak: 0,
          totalAnswered: 0,
          totalPerfect: 0,
          recentItemIds: [],
          recentD3ItemIds: [],
        }),
    }),
    { name: 'mitre-practice-v1', version: 1 },
  ),
)
