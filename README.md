# ATT&CK//RANGE — MITRE Mapping Practice

A practice game for mapping real-world threat intelligence to MITRE ATT&CK techniques.
Content is shown at the top, you select techniques on an interactive enterprise matrix,
submit, and get graded feedback with links to the official technique pages.

## Quick start

```bash
npm install
npm run dev      # open http://localhost:5173
```

## Game modes

- **Procedure Drill** — one real procedure example from the official ATT&CK dataset
  (~13,300 items); map it to the right technique(s). Technique names that would give
  the answer away are shown as redaction bars.
- **Incident Report** — a synthesized TI brief assembled from 4–8 real procedures of
  one threat group, in kill-chain order; find every technique present. On **hard**
  (default) the actor is unattributed; attribution is revealed after you submit.
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
npm run update-data            # downloads the latest MITRE ATT&CK STIX bundle
npm run update-data -- --cached  # reprocess from the cached bundle
```

The script pulls the official enterprise STIX bundle from
[mitre-attack/attack-stix-data](https://github.com/mitre-attack/attack-stix-data),
cleans the procedure descriptions (citations stripped, answer-leaking technique
names/links redacted), merges duplicates, and regenerates:

- `src/data/matrix.json` — tactics and techniques
- `public/data/procedures.json` — cleaned procedure examples with ground-truth answers
- `public/data/groups.json` — groups eligible for incident mode

Hard assertions make the script fail loudly if MITRE's schema drifts.

ATT&CK® and the underlying data are © The MITRE Corporation.
