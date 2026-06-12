import { useState } from 'react'
import { TECH_MAP, techniqueUrl } from '../data/attack'
import { useStatsStore } from '../store/statsStore'

export function StatsView() {
  const techStats = useStatsStore((s) => s.techStats)
  const totalAnswered = useStatsStore((s) => s.totalAnswered)
  const totalPerfect = useStatsStore((s) => s.totalPerfect)
  const bestStreak = useStatsStore((s) => s.bestStreak)
  const resetAll = useStatsStore((s) => s.resetAll)
  const [confirming, setConfirming] = useState(false)

  const rows = Object.entries(techStats)
    .filter(([tid]) => TECH_MAP.has(tid))
    .sort(([, a], [, b]) => a.ewma - b.ewma)

  return (
    <div className="stats-view">
      <div className="stats-totals">
        <div className="total-card">
          <span className="total-value">{totalAnswered}</span>
          <span className="total-label">rounds answered</span>
        </div>
        <div className="total-card">
          <span className="total-value">{totalPerfect}</span>
          <span className="total-label">perfect mappings</span>
        </div>
        <div className="total-card">
          <span className="total-value">{bestStreak}</span>
          <span className="total-label">best streak</span>
        </div>
        <div className="total-card">
          <span className="total-value">{rows.length}</span>
          <span className="total-label">techniques drilled</span>
        </div>
      </div>

      <div className="stats-table-wrap">
        <div className="stats-table-head">
          <h2>Technique proficiency — weakest first</h2>
          <p className="stats-hint">
            Techniques you miss appear up to ~3× more often in the rotation.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="panel-message">No rounds answered yet. Run a drill to build your record.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Technique</th>
                <th>Reps</th>
                <th>Accuracy</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([tid, s]) => {
                const tech = TECH_MAP.get(tid)!
                const pct = Math.round(s.ewma * 100)
                return (
                  <tr key={tid}>
                    <td className="stats-tid">{tid}</td>
                    <td>{tech.name}</td>
                    <td className="stats-num">{s.seen}</td>
                    <td className="stats-acc">
                      <span className="acc-bar">
                        <span
                          className={`acc-fill ${pct < 40 ? 'acc-low' : pct < 70 ? 'acc-mid' : 'acc-high'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="acc-pct">{pct}%</span>
                    </td>
                    <td>
                      <a href={techniqueUrl(tid)} target="_blank" rel="noreferrer" className="answer-link">
                        study ↗
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="stats-danger">
        {confirming ? (
          <>
            <span>Erase all progress?</span>
            <button
              className="btn btn-danger"
              onClick={() => {
                resetAll()
                setConfirming(false)
              }}
            >
              Yes, erase
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirming(true)}>
            Reset progress
          </button>
        )}
      </div>
    </div>
  )
}
