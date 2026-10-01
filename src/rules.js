/**
 * Rule primitives for Meowdoku (a.k.a. Star Battle / cat sudoku):
 *
 *   1. exactly one cat in every row;
 *   2. exactly one cat in every column;
 *   3. exactly one cat in every region;
 *   4. no two cats in neighbouring cells — diagonals count as neighbours.
 *
 * Everything in this module works on plain data:
 *   - `regions`: N×N array of region ids (0 .. N-1)
 *   - `cats`:    array of [row, col] cells that contain a cat
 */

/**
 * Group the cells of a board by region id.
 *
 * @param {number[][]} regions N×N region ids
 * @returns {[number, number][][]} `groups[id]` = list of [row, col] cells
 */
export function regionGroups(regions) {
  const size = regions.length;
  const groups = Array.from({ length: size }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      groups[regions[r][c]].push([r, c]);
    }
  }
  return groups;
}

/**
 * Find every conflicting pair of cats.
 *
 * @param {[number, number][]} cats
 * @param {number[][]} regions
 * @returns {{kind: string, a: [number, number], b: [number, number]}[]}
 *          kind ∈ 'duplicate' | 'row' | 'column' | 'region' | 'adjacent'
 */
export function findConflicts(cats, regions) {
  const conflicts = [];
  for (let i = 0; i < cats.length; i++) {
    const [r1, c1] = cats[i];
    for (let j = i + 1; j < cats.length; j++) {
      const [r2, c2] = cats[j];
      let kind = null;
      if (r1 === r2 && c1 === c2) kind = 'duplicate';
      else if (r1 === r2) kind = 'row';
      else if (c1 === c2) kind = 'column';
      else if (regions[r1][c1] === regions[r2][c2]) kind = 'region';
      else if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) kind = 'adjacent';
      if (kind) conflicts.push({ kind, a: [r1, c1], b: [r2, c2] });
    }
  }
  return conflicts;
}

/**
 * Is this placement a complete, valid solution?
 *
 * A placement with no conflicts and exactly `size` cats automatically has one
 * cat per row, column and region (duplicates in any of them would conflict),
 * so this is a full solution check.
 *
 * @param {[number, number][]} cats
 * @param {number[][]} regions
 */
export function isComplete(cats, regions) {
  const size = regions.length;
  if (cats.length !== size) return false;
  return findConflicts(cats, regions).length === 0;
}

/**
 * Validate the *shape* of a region map: square, ids 0..N-1 all present, and
 * (by default) every region 4-connected.
 *
 * @param {number[][]} regions
 * @param {{requireConnected?: boolean}} [options]
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateRegions(regions, options = {}) {
  const { requireConnected = true } = options;
  const errors = [];

  const size = Array.isArray(regions) ? regions.length : 0;
  if (!size) return { ok: false, errors: ['regions must be a non-empty square matrix'] };

  for (let r = 0; r < size; r++) {
    const row = regions[r];
    if (!Array.isArray(row)) {
      errors.push(`row ${r} is not an array`);
      continue;
    }
    if (row.length !== size) errors.push(`row ${r} has ${row.length} cells, expected ${size}`);
    for (const v of row) {
      if (!Number.isInteger(v) || v < 0 || v >= size) {
        errors.push(`invalid region id ${v} (expected an integer in 0..${size - 1})`);
      }
    }
    if (errors.length > 8) break; // don't flood callers on badly broken input
  }
  if (errors.length) return { ok: false, errors };

  const seen = new Set();
  for (const row of regions) for (const v of row) seen.add(v);
  for (let id = 0; id < size; id++) {
    if (!seen.has(id)) errors.push(`region id ${id} is missing (ids must cover 0..${size - 1})`);
  }

  if (requireConnected) {
    for (const id of seen) {
      const cells = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === id) cells.push([r, c]);
        }
      }
      if (!isConnected(cells, size)) errors.push(`region ${id} is not 4-connected`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * 4-connectivity check for a set of cells.
 *
 * @param {[number, number][]} cells
 * @param {number} size
 */
function isConnected(cells, size) {
  if (cells.length <= 1) return true;
  const inRegion = new Set(cells.map(([r, c]) => r * size + c));
  const start = cells[0];
  const seen = new Set([start[0] * size + start[1]]);
  const queue = [start];
  while (queue.length) {
    const [r, c] = queue.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr;
      const cc = c + dc;
      const key = rr * size + cc;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      if (inRegion.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push([rr, cc]);
      }
    }
  }
  return seen.size === cells.length;
}
