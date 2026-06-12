import { Fragment } from 'react'

/** Renders cleaned procedure text, turning [REDACTED] markers into redaction bars. */
export function RedactedText({ text }: { text: string }) {
  const parts = text.split('[REDACTED]')
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <span className="redacted">REDACTED</span>}
        </Fragment>
      ))}
    </>
  )
}
