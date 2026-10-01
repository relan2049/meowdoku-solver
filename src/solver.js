/**
 * The Meowdoku solving core.
 *
 * ## Model
 *
 * A solution is represented as a permutation: `cols[r] = c` means the cat of
 * row `r` sits in column `c`. The rules then become:
 *
 *   1. one cat per row ............ the representation itself (exactly one
 *                                   choice per row);
 *   2. one cat per column ......... `cols` must be a permutation of 0..N-1;
 *   3. one cat per region ......... the region ids of the chosen cells must be
 *                                   a permutation of 0..N-1;
 *   4. cats don't touch ........... |cols[r] − cols[r±1]| must be > 1.
 *
 * ## Search
 *
 * Rows are filled top-down. At every step the candidate columns are filtered
 * by the four rules above, which prunes the search tree dramatically (a
 * typical 10×10 puzzle explores only a few hundred nodes). On top of that we
 * apply a *region reachability* prune: every region that still lacks a cat
 * must have at least one usable cell left in the rows that are not yet
 * assigned — otherwise the branch is dead immediately.
 *
 * The search is capped by `limit` (stop after N solutions) and optionally by
 * `timeLimitMs`.
 */

import { normalizePuzzle } from './puzzle.js';
import { findConflicts } from './rules.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Find up to `limit` solutions of a Meowdoku puzzle.
 *
 * @param {object|string} puzzleInput
 * @param {{limit?: number, timeLimitMs?: number}} [options]
 * @returns {{
 *   count: number, exact: boolean, truncated: boolean, timedOut: boolean,
 *   solutions: {cols: number[], cats: [number, number][]}[],
 *   nodes: number, ms: number, size: number,
 *   givenConflicts: {kind: string, a: number[], b: number[]}[]
 * }}
 */
export function enumerate(puzzleInput, options = {}) {
  const { limit = 1, timeLimitMs = 0 } = options;
  const { size, regions, cats, crosses } = normalizePuzzle(puzzleInput);

  const t0 = now();
  const result = {
    count: 0,
    exact: true,
    truncated: false,
    timedOut: false,
    solutions: [],
    nodes: 0,
    ms: 0,
    size,
    givenConflicts: findConflicts(cats, regions),
  };

  // ---- Fast-fail on contradictory givens -------------------------------
  // (two different given cats in the same row can never both be satisfied)
  const givenByRow = new Map();
  for (const [r, c] of cats) {
    if (givenByRow.has(r) && givenByRow.get(r) !== c) {
      result.ms = now() - t0;
      return result;
    }
    givenByRow.set(r, c);
  }

  // ---- Pre-computation ---------------------------------------------------
  const blocked = new Set(crosses.map(([r, c]) => r * size + c));
  const cellsByRegion = Array.from({ length: size }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) cellsByRegion[regions[r][c]].push([r, c]);
  }

  const usedCols = new Uint8Array(size);
  const usedRegions = new Uint8Array(size);
  const colOfRow = new Int16Array(size).fill(-1);
  const found = [];

  let nodes = 0;
  let truncated = false;
  let timedOut = false;
  const deadline = timeLimitMs > 0 ? t0 + timeLimitMs : 0;

  /**
   * Region reachability prune: every region without a cat so far must still
   * have at least one non-blocked cell in rows >= r (rows < r are already
   * assigned and cannot host it anymore).
   */
  const regionsFeasible = (r) => {
    for (let g = 0; g < size; g++) {
      if (usedRegions[g]) continue;
      let ok = false;
      for (let i = 0; i < cellsByRegion[g].length; i++) {
        const [rr, cc] = cellsByRegion[g][i];
        if (rr >= r && !blocked.has(rr * size + cc)) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }
    return true;
  };

  const backtrack = (r) => {
    if (found.length >= limit) {
      truncated = true;
      return;
    }
    if (deadline && now() > deadline) {
      timedOut = true;
      return;
    }
    if (r === size) {
      found.push(Array.from(colOfRow));
      return;
    }

    nodes++;
    if (!regionsFeasible(r)) return;

    const forced = givenByRow.get(r);
    const prev = r > 0 ? colOfRow[r - 1] : -1;

    for (let c = 0; c < size; c++) {
      if (forced !== undefined && c !== forced) continue;
      if (usedCols[c]) continue;
      if (blocked.has(r * size + c)) continue;
      const g = regions[r][c];
      if (usedRegions[g]) continue;
      if (prev >= 0 && Math.abs(c - prev) <= 1) continue;

      usedCols[c] = 1;
      usedRegions[g] = 1;
      colOfRow[r] = c;

      backtrack(r + 1);

      usedCols[c] = 0;
      usedRegions[g] = 0;
      colOfRow[r] = -1;

      if (truncated || timedOut) return;
    }
  };

  backtrack(0);

  result.solutions = found.map((cols) => ({
    cols: [...cols],
    cats: cols.map((c, r) => [r, c]),
  }));
  result.count = found.length;
  result.truncated = truncated;
  result.timedOut = timedOut;
  result.exact = !truncated && !timedOut;
  result.nodes = nodes;
  result.ms = +(now() - t0).toFixed(3);
  return result;
}

/**
 * Solve a puzzle, returning the first `limit` solutions (default 1).
 * Shorthand for `enumerate(puzzle, {limit, ...})`.
 */
export function solve(puzzleInput, options = {}) {
  return enumerate(puzzleInput, { limit: 1, ...options });
}

/**
 * Count the solutions of a puzzle. The search stops after `limit` solutions
 * (default 1000). When `truncated` is false the count is exact — e.g. a count
 * of 1 with `limit >= 2` *proves* the puzzle has a unique solution.
 */
export function countSolutions(puzzleInput, options = {}) {
  return enumerate(puzzleInput, { limit: 1000, ...options });
}

/**
 * Produce a logical hint.
 *
 * The solver first tries to find a cell that is a cat in EVERY solution
 * (a logically forced placement). When the puzzle has too many solutions to
 * enumerate, it falls back to a cell from one example solution.
 *
 * @param {object|string} puzzleInput
 * @param {{maxSolutions?: number, exclude?: [number, number][]}} [options]
 *        `exclude` – cells to ignore (e.g. cats the player already placed)
 * @returns {null | {cell: [number, number], certain: boolean, solutionsChecked: number, truncated: boolean}}
 */
export function findHint(puzzleInput, options = {}) {
  const { maxSolutions = 512, exclude = [] } = options;
  const res = enumerate(puzzleInput, { limit: maxSolutions + 1 });
  if (res.count === 0) return null;

  const size = res.size;
  const excluded = new Set(exclude.map(([r, c]) => r * size + c));

  // Cells that appear in every enumerated solution.
  let common = new Set(res.solutions[0].cats.map(([r, c]) => r * size + c));
  for (let i = 1; i < res.solutions.length && common.size; i++) {
    const cur = new Set(res.solutions[i].cats.map(([r, c]) => r * size + c));
    common = new Set([...common].filter((key) => cur.has(key)));
  }

  const enumeratedAll = !res.truncated && !res.timedOut;
  for (const key of [...common].sort((a, b) => a - b)) {
    if (!excluded.has(key)) {
      return {
        cell: [Math.floor(key / size), key % size],
        certain: enumeratedAll,
        solutionsChecked: res.count,
        truncated: res.truncated,
      };
    }
  }

  for (const [r, c] of res.solutions[0].cats) {
    if (!excluded.has(r * size + c)) {
      return { cell: [r, c], certain: false, solutionsChecked: res.count, truncated: res.truncated };
    }
  }
  return null;
}
