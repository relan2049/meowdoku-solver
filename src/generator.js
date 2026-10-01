/**
 * Puzzle generator.
 *
 * `generateRegions()` carves an N×N board into N 4-connected regions with an
 * interleaved random growth process (each region grows from a random seed
 * cell, one random boundary cell at a time). The result has exactly N
 * regions, all connected — the same structure Meowdoku puzzles use.
 *
 * `generatePuzzle()` then verifies the puzzle with the solver and, by
 * default, keeps retrying until the board has a **unique** solution. The
 * whole process is seeded, so a given `seed` always produces the same board.
 */

import { mulberry32, shuffle, randomInt } from './random.js';
import { countSolutions, enumerate, solve } from './solver.js';
import { validateRegions } from './rules.js';

/**
 * Build a random region map.
 *
 * @param {number} size board size (6–12 recommended)
 * @param {() => number} rng seeded random source
 * @returns {number[][]} N×N array of region ids 0..N-1
 */
export function generateRegions(size, rng) {
  const total = size * size;
  const seeds = shuffle([...Array(total).keys()], rng).slice(0, size);

  const owner = new Int16Array(total).fill(-1);
  const frontiers = seeds.map((cell, id) => {
    owner[cell] = id;
    return [cell];
  });

  let remaining = total - size;
  while (remaining > 0) {
    // Pick a random region that still has boundary cells …
    const active = [];
    for (let i = 0; i < size; i++) if (frontiers[i].length) active.push(i);
    if (!active.length) break; // unreachable for a connected grid

    const g = active[randomInt(active.length, rng)];
    const frontier = frontiers[g];

    // … take a random boundary cell …
    const k = randomInt(frontier.length, rng);
    const cell = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();

    // … and absorb its unclaimed neighbours.
    const r = Math.floor(cell / size);
    const c = cell % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const idx = rr * size + cc;
      if (owner[idx] !== -1) continue;
      owner[idx] = g;
      frontier.push(idx);
      remaining--;
    }
  }

  const regions = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(owner[r * size + c]);
    regions.push(row);
  }
  return regions;
}

/**
 * Generate a solvable puzzle — unique-solution by default.
 *
 * When the bare region map admits several solutions, the generator locks
 * one of them in by adding **given cats** (always taken from a real solution,
 * so the puzzle always stays solvable) until uniqueness is proven. Puzzles
 * whose region map is already unique come back without any clues.
 *
 * @param {number} size board size (6–12 recommended)
 * @param {{seed?: number, attempts?: number, requireUnique?: boolean}} [options]
 * @returns {{
 *   puzzle: {size: number, regions: number[][], cats: [number, number][]},
 *   solution: number[] | null, solutions: number, unique: boolean,
 *   seed: number, attemptsUsed: number
 * }}
 */
export function generatePuzzle(size, options = {}) {
  const { seed = Date.now() >>> 0, attempts = 120, requireUnique = true } = options;
  const rng = mulberry32(seed);

  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const regions = generateRegions(size, rng);
    const base = { size, regions };

    const probe = solve(base, { limit: 1 });
    if (probe.count === 0) continue; // pathological map — retry

    let cats = [];
    let unique = false;

    if (requireUnique) {
      cats = augmentCluesToUnique(size, regions);
      if (cats === null) continue;
      unique = true;
    } else {
      const check = countSolutions(base, { limit: 2 });
      unique = check.count === 1 && check.exact;
    }

    last = {
      puzzle: { size, regions, cats },
      solution: probe.solutions[0].cols,
      solutions: unique ? 1 : 2,
      unique,
      seed,
      attemptsUsed: attempt,
    };
    if (unique || !requireUnique) return last;
  }

  if (!last) {
    // Extremely unlikely; surface a clear error instead of a broken puzzle.
    throw new Error(`could not generate a solvable ${size}×${size} board after ${attempts} attempts`);
  }
  return last;
}

/**
 * Starting from a solvable region map, add the fewest-possible given cats
 * (drawn from enumerated solutions) until the puzzle has exactly one
 * solution. Returns the clue list, or `null` if augmentation failed.
 *
 * @private
 * @param {number} size
 * @param {number[][]} regions
 * @returns {[number, number][] | null}
 */
function augmentCluesToUnique(size, regions) {
  const cats = [];
  // Strict progress is guaranteed: every clue kills at least one enumerated
  // alternative, and after all rows carry a clue the solution is fully pinned.
  for (let iter = 0; iter <= size + 1; iter++) {
    const res = enumerate({ size, regions, cats }, { limit: 64 });
    if (res.count === 0) return null; // clues contradict (shouldn't happen)
    if (res.count === 1 && res.exact) return cats;

    const anchor = res.solutions[0];
    let row = -1;
    for (let r = 0; r < size; r++) {
      const distinct = new Set(res.solutions.map((s) => s.cols[r]));
      if (distinct.size > 1) {
        row = r;
        break;
      }
    }
    if (row === -1) return null; // all enumerated solutions identical — impossible
    if (cats.some(([cr]) => cr === row)) return null;
    cats.push([row, anchor.cols[row]]);
  }
  return null;
}

/**
 * Convenience wrapper: generated puzzle + validity report (square regions,
 * connectivity, solvability).
 */
export function describePuzzle(size, options = {}) {
  const generated = generatePuzzle(size, options);
  const regions = validateRegions(generated.puzzle.regions);
  return { ...generated, regionsValid: regions.ok, regionsErrors: regions.errors };
}
