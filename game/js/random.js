// random.js — deterministic seeded RNG so the city layout is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function range(rng, a, b) { return a + (b - a) * rng(); }
export function irange(rng, a, b) { return Math.floor(range(rng, a, b + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function chance(rng, p) { return rng() < p; }
// Port Solara uses one fixed seed: the same streets, crowds and coins every visit.
