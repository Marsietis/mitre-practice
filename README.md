# ATT&CK//RANGE — MITRE Mapping Practice

A practice game for mapping real-world threat intelligence to MITRE ATT&CK techniques
and the D3FEND countermeasures that defend against them. Content is shown at the top,
you select techniques on an interactive matrix, submit, and get graded feedback with
links to the official technique pages.

## Quick start

```bash
npm install
npm run dev      # open http://localhost:5173
```

## Game modes

ATT&CK (offense — enterprise matrix):

- **Procedure Drill** — one real procedure example from the official ATT&CK dataset
  (~13,300 items); map it to the right technique(s). Technique names that would give
  the answer away are shown as redaction bars.
- **Incident Report** — a synthesized TI brief assembled from 4–8 real procedures of
  one threat group, in kill-chain order; find every technique present. On **hard**
  (default) the actor is unattributed; attribution is revealed after you submit.

D3FEND (defense — countermeasure matrix):

- **Definition Drill** — a redacted D3FEND technique definition; map it to the right
  defensive technique on the D3FEND matrix.
- **Counter the Attack** — a real attack procedure is shown; pick the D3FEND
  countermeasures that defend against the technique it uses. Mapped countermeasures you
  missed are highlighted after you submit.

Record:

- **Analyst Record** — per-technique accuracy, streaks, and totals. Techniques you
  miss are weighted to appear up to ~3× more often.

## Scoring

- Exact technique match: full credit. Parent selected when a sub-technique was the
  answer (or vice versa): half credit.
- Score = credits / max(answers, selections) — misses and extra selections both hurt.
- Selection is by technique identity: a technique that appears in several tactic
  columns toggles everywhere with one click (marked ⧉).
- Streak: increments on a perfect drill (or ≥75% on incidents), holds on a pass,
  resets on a fail or on revealing the answer.

Progress is stored in `localStorage` — use *Analyst Record → Reset progress* to wipe it.

## Keyboard

- `Enter` — submit / next round
- `Esc` — clear selection

## Updating the dataset

```bash
npm run update-data              # downloads the latest MITRE ATT&CK STIX bundle
npm run update-data -- --cached  # reprocess from the cached bundle
npm run update-d3fend            # downloads the latest MITRE D3FEND matrix + KB
npm run update-d3fend -- --cached  # reprocess from the cached bundle
```

`update-data` pulls the official enterprise STIX bundle from
[mitre-attack/attack-stix-data](https://github.com/mitre-attack/attack-stix-data),
cleans the procedure descriptions (citations stripped, answer-leaking technique
names/links redacted), merges duplicates, and regenerates:

- `src/data/matrix.json` — tactics and techniques
- `public/data/procedures.json` — cleaned procedure examples with ground-truth answers
- `public/data/groups.json` — groups eligible for incident mode

`update-d3fend` pulls the D3FEND matrix and per-technique knowledge base from
[d3fend.mitre.org](https://d3fend.mitre.org) and regenerates:

- `src/data/d3fend-matrix.json` — D3FEND tactics and techniques
- `public/data/d3drill.json` — redacted definition-drill items with answers
- `public/data/d3map.json` — ATT&CK technique id → D3FEND countermeasure ids

Hard assertions make both scripts fail loudly if MITRE's schema drifts.

ATT&CK®, D3FEND™ and the underlying data are © The MITRE Corporation.
