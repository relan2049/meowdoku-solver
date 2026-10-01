/**
 * Puzzle input normalisation.
 *
 * `normalizePuzzle()` accepts the many friendly shapes people hand to a
 * solver and produces one canonical internal representation:
 *
 *   { size, regions: number[][], cats: [r,c][], crosses: [r,c][] }
 *
 * Accepted keys
 *   - size ............ optional; inferred from the region map when absent
 *   - regions / regionMap
 *   - cats  / givenCats ...... placed cats (clues that MUST hold)
 *   - crosses / givenCrosses / x ... cells that must NOT contain a cat
 *
 * `regions` may be:
 *   - number[][]                 e.g. [[0,0,1],[1,1,2],...]
 *   - string[] of row strings    e.g. ['001', '112', ...]
 *   - string grid                e.g. '001\n112\n...'
 *   - a flat array               (size taken from `size` or sqrt(length))
 */

import { validateRegions } from './rules.js';

/** Error thrown for malformed puzzle input. */
export class PuzzleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PuzzleError';
  }
}

const toInt = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) ? v : Number.NaN;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
  return Number.NaN;
};

/**
 * Normalise a puzzle object (or JSON string).
 *
 * @param {object|string} input
 * @returns {{size: number, regions: number[][], cats: [number, number][], crosses: [number, number][]}}
 */
export function normalizePuzzle(input) {
  if (typeof input === 'string') return normalizePuzzle(JSON.parse(input));
  if (input == null || typeof input !== 'object') {
    throw new PuzzleError('puzzle must be an object (or a JSON string)');
  }

  const rawRegions = input.regions ?? input.regionMap;
  if (rawRegions == null) throw new PuzzleError('puzzle.regions (or puzzle.regionMap) is required');

  const { size, regions } = normalizeRegions(rawRegions, input.size);
  const cats = normalizeCells(input.cats ?? input.givenCats ?? [], size, 'cats');
  const crosses = normalizeCells(input.crosses ?? input.givenCrosses ?? input.x ?? [], size, 'crosses');
  return { size, regions, cats, crosses };
}

/** Parse a JSON string into a normalised puzzle. */
export function parsePuzzle(text) {
  return normalizePuzzle(JSON.parse(text));
}

function normalizeRegions(raw, sizeHint) {
  let rows;

  if (typeof raw === 'string') {
    const lines = raw
      .trim()
      .split(/\s*\n\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    rows = lines.length > 1 ? lines.map((line) => Array.from(line)) : [Array.from(lines[0] ?? '')];
  } else if (Array.isArray(raw) && raw.length) {
    if (typeof raw[0] === 'string') {
      rows = raw.map((s) => Array.from(String(s).trim()));
    } else if (Array.isArray(raw[0])) {
      rows = raw.map((row) => row.slice());
    } else {
      const n = sizeHint ?? Math.round(Math.sqrt(raw.length));
      rows = [];
      for (let i = 0; i < n; i++) rows.push(raw.slice(i * n, (i + 1) * n));
    }
  } else {
    throw new PuzzleError('unsupported regions format');
  }

  const size = sizeHint ?? rows.length;
  if (rows.length !== size) {
    throw new PuzzleError(`regions has ${rows.length} rows but size is ${size}`);
  }

  const regions = rows.map((row, r) => {
    if (row.length !== size) {
      throw new PuzzleError(`regions row ${r} has ${row.length} cells but size is ${size}`);
    }
    return Array.from(row, (v, c) => {
      const n = toInt(v);
      if (Number.isNaN(n)) throw new PuzzleError(`invalid region id "${v}" at row ${r}, col ${c}`);
      return n;
    });
  });

  const check = validateRegions(regions, { requireConnected: false });
  if (!check.ok) throw new PuzzleError(`invalid regions: ${check.errors.join('; ')}`);
  return { size, regions };
}

function normalizeCells(list, size, label) {
  if (!Array.isArray(list)) throw new PuzzleError(`${label} must be an array of [row, col] cells`);
  const seen = new Map();
  for (const item of list) {
    let r;
    let c;
    if (Array.isArray(item) && item.length === 2) {
      r = toInt(item[0]);
      c = toInt(item[1]);
    } else if (item && typeof item === 'object') {
      r = toInt(item.r ?? item.row);
      c = toInt(item.c ?? item.col);
    }
    if (Number.isNaN(r) || Number.isNaN(c) || r < 0 || c < 0 || r >= size || c >= size) {
      throw new PuzzleError(`invalid cell in ${label}: ${JSON.stringify(item)} (board is ${size}×${size})`);
    }
    seen.set(r * size + c, [r, c]);
  }
  return [...seen.values()];
}

/**
 * Convert a "column per row" solution (`solution[r] = cat column in row r`)
 * into a list of cat cells.
 *
 * @param {number[]} cols
 * @returns {[number, number][]}
 */
export function colsToCats(cols) {
  return cols.map((c, r) => [r, c]);
}

/**
 * Convert cat cells into the "column per row" representation.
 *
 * @param {[number, number][]} cats
 * @param {number} size
 * @returns {number[]} `cols[r] = column of the cat in row r`
 */
export function catsToCols(cats, size = cats.length) {
  const cols = new Array(size).fill(-1);
  for (const [r, c] of cats) cols[r] = c;
  return cols;
}
