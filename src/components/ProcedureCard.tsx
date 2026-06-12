import type { ProcedureItem } from '../types'
import { RedactedText } from './RedactedText'

const KIND_LABEL = { group: 'threat group', software: 'software', campaign: 'campaign' }

export function ProcedureCard({ item }: { item: ProcedureItem }) {
  return (
    <article className="procedure-card" key={item.i}>
      <div className="doc-strip">
        <span>TLP:CLEAR</span>
        <span>TRAINING EXTRACT // PROCEDURE OBSERVATION</span>
        <span>REF {String(item.i).padStart(5, '0')}</span>
      </div>
      <div className="procedure-meta">
        <span className={`source-chip source-${item.k}`}>
          {KIND_LABEL[item.k]}: <strong>{item.s}</strong>
        </span>
        <span className="target-count">
          map {item.a.length} technique{item.a.length > 1 ? 's' : ''}
        </span>
      </div>
      <p className="procedure-text">
        <RedactedText text={item.t} />
      </p>
    </article>
  )
}
