/**
 * Tiny deterministic PRNG utilities used by the puzzle generator.
 *
 * `mulberry32` is a 32-bit seeded generator that is fast, dependency-free and
 * good enough for puzzle generation. Using a seeded generator means the
 * "Generate puzzle" button and the test-suite can both reproduce the exact
 * same boards.
 */

/**
 * Create a seeded random number generator.
 *
 * @param {number} seed 32-bit integer seed
 * @returns {() => number} function that returns floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates shuffle (in place) using the supplied RNG.
 *
 * @template T
 * @param {T[]} array
 * @param {() => number} rng
 * @returns {T[]} the same array, shuffled
 */
export function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Random integer in [0, n).
 *
 * @param {number} n
 * @param {() => number} rng
 */
export function randomInt(n, rng) {
  return Math.floor(rng() * n);
}
