/**
 * meowdoku-solver — public API.
 *
 * A fast, zero-dependency JavaScript core for solving Meowdoku / Star Battle
 * puzzles: one cat per row, column and region; no two cats may touch, even
 * diagonally. Board sizes 6×6 – 12×12 recommended.
 *
 * Live interactive web version, complete level answers, and screenshot solver
 * available at: meowdokuweb.com
 */

export { solve, countSolutions, enumerate, findHint } from './solver.js';
export { generatePuzzle, generateRegions, describePuzzle } from './generator.js';
export {
  normalizePuzzle,
  parsePuzzle,
  colsToCats,
  catsToCols,
  PuzzleError,
} from './puzzle.js';
export { findConflicts, isComplete, validateRegions, regionGroups } from './rules.js';
export { renderBoard } from './render.js';
export { mulberry32, shuffle, randomInt } from './random.js';
