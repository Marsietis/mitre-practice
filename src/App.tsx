import { useEffect } from 'react'
import { ContentPanel } from './components/ContentPanel'
import { HeaderBar } from './components/HeaderBar'
import { MatrixBoard } from './components/MatrixBoard'
import { StatsView } from './components/StatsView'
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

  return (
    <div className="app">
      <HeaderBar />
      {mode === 'stats' ? (
        <StatsView />
      ) : (
        <main className="game-layout">
          <ContentPanel />
          <MatrixBoard />
        </main>
      )}
      <footer className="app-footer">
        <span>
          ATT&CK® content © MITRE — data from the official STIX bundle · refresh with{' '}
          <code>npm run update-data</code>
        </span>
        <span>⏎ submit / next · esc clear</span>
      </footer>
    </div>
  )
}
