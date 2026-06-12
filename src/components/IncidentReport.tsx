import { useGameStore } from '../store/gameStore'
import type { Incident } from '../types'
import { RedactedText } from './RedactedText'

export function IncidentReport({ incident }: { incident: Incident }) {
  const revealed = useGameStore((s) => s.phase === 'revealed')

  return (
    <article className="incident-report" key={incident.seed}>
      <div className="doc-strip">
        <span>TLP:AMBER</span>
        <span>TRAINING SIMULATION // INCIDENT REPORT</span>
        <span>{incident.irNumber}</span>
      </div>
      <header className="incident-head">
        <h2>
          {incident.irNumber} — Intrusion at {incident.sector} organization
        </h2>
        <dl className="incident-facts">
          <div>
            <dt>Date escalated</dt>
            <dd>{incident.date}</dd>
          </div>
          <div>
            <dt>Attribution</dt>
            <dd>
              {revealed ? (
                <span className="attribution-revealed">
                  {incident.groupName} ({incident.groupId})
                </span>
              ) : (
                incident.actorLabel
              )}
            </dd>
          </div>
          <div>
            <dt>Objective</dt>
            <dd className="objective">
              identify all <strong>{incident.answers.length}</strong> techniques
            </dd>
          </div>
        </dl>
      </header>
      <div className="incident-body">
        {incident.paragraphs.map((p, i) => (
          <p key={i}>
            <span className="para-mark">{String(i + 1).padStart(2, '0')}</span>
            <RedactedText text={p} />
          </p>
        ))}
      </div>
      <footer className="incident-foot">
        Indicators have been shared with the sector ISAC. Map all observed techniques on the board
        below.
      </footer>
    </article>
  )
}
