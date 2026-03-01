/**
 * Deterministic PRNG (Mulberry32) for reproducible tests.
 * Usage: const { random, randomInt, pick, shuffle } = seededMathRandom(42)
 */

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededMathRandom(seed = 42) {
  const rng = mulberry32(seed)

  const random = (): number => rng()

  const randomInt = (min: number, max: number): number =>
    Math.floor(rng() * (max - min + 1)) + min

  const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(rng() * arr.length)]

  const shuffle = <T>(arr: readonly T[]): T[] => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  return { random, randomInt, pick, shuffle }
}
