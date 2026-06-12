import type { D3DrillItem } from '../types'
import { RedactedText } from './RedactedText'

export function D3DefinitionCard({ item }: { item: D3DrillItem }) {
  return (
    <article className="procedure-card" key={item.i}>
      <div className="doc-strip">
        <span>TLP:CLEAR</span>
        <span>TRAINING EXTRACT // DEFENSIVE TECHNIQUE PROFILE</span>
        <span>REF {String(item.i).padStart(5, '0')}</span>
      </div>
      <div className="procedure-meta">
        <span className="source-chip source-d3fend">
          knowledge base: <strong>D3FEND</strong>
        </span>
        <span className="target-count">locate 1 technique</span>
      </div>
      <p className="procedure-text">
        <RedactedText text={item.t} />
      </p>
    </article>
  )
}
