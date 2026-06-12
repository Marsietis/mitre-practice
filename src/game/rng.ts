/** Deterministic PRNG so an incident can be re-derived from its stored seed. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
}

export function pickWeighted<T>(items: T[], weights: number[], rng: Rng): T {
  let total = 0
  for (const w of weights) total += w
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}
