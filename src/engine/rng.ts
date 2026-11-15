// Seeded RNG (A16). This is the exact mulberry32 from docs/tech-spec.md
// section 5.2. Do not substitute another generator, and do not use
// Math.random anywhere in the engine.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One independent stream per line (0-based line index).
export function lineStream(seed: number, lineIndex: number): () => number {
  return mulberry32((seed + (lineIndex + 1) * 10007) >>> 0);
}
