import { useEffect } from 'react'
import { ContentPanel } from './components/ContentPanel'
import { HeaderBar } from './components/HeaderBar'
import { MatrixBoard } from './components/MatrixBoard'
import { StatsView } from './components/StatsView'
import { COLUMN_TECHNIQUES, SUBS_OF, TACTICS } from './data/attack'
import { D3_COLUMN_ROWS, D3_SUBS_OF, D3_TACTICS } from './data/d3fend'
import { useGameStore } from './store/gameStore'

export default function App() {
  const mode = useGameStore((s) => s.mode)
  const init = useGameStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const { phase, submit, next, clearSelection } = useGameStore.getState()
      if (e.key === 'Enter') {
        if (phase === 'answering') submit()
        else if (phase === 'revealed') next()
      } else if (e.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isD3 = mode === 'd3drill' || mode === 'counter'

  return (
    <div className="app">
      <HeaderBar />
      {mode === 'stats' ? (
        <StatsView />
      ) : (
        <main className="game-layout">
          <ContentPanel />
          {isD3 ? (
            <MatrixBoard
              title="D3FEND Matrix"
              tactics={D3_TACTICS}
              columns={D3_COLUMN_ROWS}
              subsOf={D3_SUBS_OF}
            />
          ) : (
            <MatrixBoard
              title="Enterprise Matrix"
              tactics={TACTICS}
              columns={COLUMN_TECHNIQUES}
              subsOf={SUBS_OF}
            />
          )}
        </main>
      )}
      <footer className="app-footer">
        <span>
          ATT&CK® and D3FEND™ content © MITRE
        </span>
        <span>⏎ submit / next · esc clear</span>
      </footer>
    </div>
  )
}
