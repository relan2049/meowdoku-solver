import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  solve,
  countSolutions,
  findHint,
  colsToCats,
  normalizePuzzle,
  PuzzleError,
} from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (name) => JSON.parse(readFileSync(join(root, 'examples', name), 'utf8'));

const p10 = load('10x10.json');
const solution10 = colsToCats(p10.solution);

test('givens: a correct given cat keeps the unique solution', () => {
  const res = solve({ ...p10, cats: [solution10[0]] }, { limit: 2 });
  assert.equal(res.count, 1);
  assert.deepEqual(res.solutions[0].cats, solution10);
});

test('givens: crossing a solution cell wipes out all solutions', () => {
  const res = solve({ ...p10, crosses: [solution10[0]] }, { limit: 2 });
  assert.equal(res.count, 0);
  assert.equal(res.givenConflicts.length, 0);
});

test('givens: contradictory row givens fail fast', () => {
  const res = solve({ ...p10, cats: [[0, 0], [0, 1]] });
  assert.equal(res.count, 0);
  assert.equal(res.nodes, 0, 'should bail out before searching');
});

test('limit caps the enumeration and reports truncation', () => {
  // Regions = rows: only "one per column" and "no touching" remain between
  // rows. This board has exactly two valid arrangements (hand-enumerable).
  const regions = [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [2, 2, 2, 2],
    [3, 3, 3, 3],
  ];
  const exact = countSolutions({ size: 4, regions }, { limit: 5 });
  assert.equal(exact.count, 2);
  assert.equal(exact.exact, true);

  const capped = countSolutions({ size: 4, regions }, { limit: 1 });
  assert.equal(capped.count, 1);
  assert.equal(capped.truncated, true);
  assert.equal(capped.exact, false);
});

test('findHint returns a forced cell on a unique board', () => {
  const hint = findHint(p10);
  assert.ok(hint);
  assert.equal(hint.certain, true);
  assert.equal(hint.solutionsChecked, 1);
  assert.ok(solution10.some(([r, c]) => r === hint.cell[0] && c === hint.cell[1]));
});

test('findHint respects excluded cells', () => {
  const first = findHint(p10);
  const second = findHint(p10, { exclude: [first.cell] });
  assert.ok(second);
  assert.notDeepEqual(second.cell, first.cell);
});

test('normalizePuzzle accepts friendly input shapes', () => {
  const fromStrings = normalizePuzzle({ regions: ['01', '10'], size: 2 });
  assert.deepEqual(fromStrings.regions, [
    [0, 1],
    [1, 0],
  ]);
  const fromObjects = normalizePuzzle({ regions: fromStrings.regions, cats: [{ r: 0, c: 0 }], crosses: [{ row: 1, col: 1 }] });
  assert.deepEqual(fromObjects.cats, [[0, 0]]);
  assert.deepEqual(fromObjects.crosses, [[1, 1]]);
});

test('normalizePuzzle rejects malformed input with PuzzleError', () => {
  assert.throws(() => normalizePuzzle({ regions: [[0, 0], [0, 0]] }), PuzzleError, 'missing region id 1');
  assert.throws(() => normalizePuzzle({ regions: [[0, 1], [0]] }), PuzzleError, 'ragged rows');
  assert.throws(() => normalizePuzzle({ regions: p10.regions, cats: [[99, 0]] }), PuzzleError, 'out-of-range cat');
});
