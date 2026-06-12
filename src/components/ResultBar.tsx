import { lookupTech, studyUrl } from '../data/d3fend'
import { useGameStore } from '../store/gameStore'
import type { ScoreResult, Verdict } from '../types'

const TIER_LABEL = { perfect: 'PERFECT MATCH', pass: 'PARTIAL MATCH', fail: 'MISMATCH' }
const VERDICT_LABEL: Record<Verdict, string> = {
  hit: 'HIT',
  partial: 'PARTIAL',
  missed: 'MISSED',
  wrong: 'WRONG',
}

function AnswerRow({ tid, verdict }: { tid: string; verdict: Verdict }) {
  const tech = lookupTech(tid)
  if (!tech) return null
  const site = tid.startsWith('T') ? 'attack.mitre.org' : 'd3fend.mitre.org'
  return (
    <li className={`answer-row answer-${verdict}`}>
      <span className="answer-verdict">{VERDICT_LABEL[verdict]}</span>
      <span className="answer-tid">{tid}</span>
      <span className="answer-name">{tech.name}</span>
      <a
        className="answer-link"
        href={studyUrl(tid)}
        target="_blank"
        rel="noreferrer"
        title={`Open on ${site}`}
      >
        {site} ↗
      </a>
    </li>
  )
}

export function ResultBar({ result }: { result: ScoreResult }) {
  const next = useGameStore((s) => s.next)
  const pct = Math.round(result.score * 100)

  const answerRows: { tid: string; verdict: Verdict }[] = [
    ...result.hits.map((tid) => ({ tid, verdict: 'hit' as const })),
    ...result.partials.map((p) => ({ tid: p.answer, verdict: 'partial' as const })),
    ...result.missed.map((tid) => ({ tid, verdict: 'missed' as const })),
  ].sort((a, b) => a.tid.localeCompare(b.tid))

  return (
    <section className={`result-bar result-${result.tier}`}>
      <div className="result-summary">
        <div className={`tier-stamp stamp-${result.tier}`}>
          {result.gaveUp ? 'REVEALED' : TIER_LABEL[result.tier]}
        </div>
        <div className="result-score">
          <span className="score-num">{pct}</span>
          <span className="score-pct">%</span>
        </div>
        <div className="result-counts">
          <span className="count-chip chip-hit">{result.hits.length} hit</span>
          <span className="count-chip chip-partial">{result.partials.length} partial</span>
          <span className="count-chip chip-missed">{result.missed.length} missed</span>
          <span className="count-chip chip-wrong">{result.wrong.length} wrong</span>
        </div>
        <button className="btn btn-primary" onClick={next} autoFocus>
          Next ⏎
        </button>
      </div>
      <div className="result-detail">
        <div className="result-col">
          <h3>Correct mapping</h3>
          <ul className="answer-list">
            {answerRows.map((r) => (
              <AnswerRow key={r.tid} tid={r.tid} verdict={r.verdict} />
            ))}
          </ul>
          {result.coverage && result.coverage.length > 0 && (
            <p className="coverage-note">
              +{result.coverage.length} more mapped countermeasure
              {result.coverage.length > 1 ? 's' : ''} highlighted on the matrix
            </p>
          )}
        </div>
        {result.wrong.length > 0 && (
          <div className="result-col">
            <h3>Incorrect selections</h3>
            <ul className="answer-list">
              {result.wrong.map((tid) => (
                <AnswerRow key={tid} tid={tid} verdict="wrong" />
              ))}
            </ul>
          </div>
        )}
        {result.partials.length > 0 && (
          <p className="partial-note">
            Partial credit: you selected{' '}
            {result.partials
              .map((p) => `${p.selected} ${lookupTech(p.selected)?.parent ? '(sub)' : '(parent)'} for ${p.answer}`)
              .join('; ')}
            .
          </p>
        )}
      </div>
    </section>
  )
}
