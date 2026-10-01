import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findConflicts, isComplete, validateRegions, regionGroups } from '../src/index.js';

// A verified 4×4 puzzle: one cat per row / column / region, no touching cats.
const regions4 = [
  [0, 0, 0, 0],
  [0, 2, 1, 1],
  [2, 2, 2, 1],
  [2, 3, 3, 3],
];
const solution4 = [
  [0, 1],
  [1, 3],
  [2, 0],
  [3, 2],
];

test('isComplete accepts the reference solution', () => {
  assert.equal(isComplete(solution4, regions4), true);
});

test('isComplete rejects incomplete and conflicting placements', () => {
  assert.equal(isComplete(solution4.slice(0, 3), regions4), false, 'missing a cat');
  assert.equal(isComplete([[0, 1], [0, 2], [2, 0], [3, 2]], regions4), false, 'two cats in a row');
  assert.equal(isComplete([[0, 1], [1, 1], [2, 0], [3, 2]], regions4), false, 'two cats in a column');
  assert.equal(isComplete([[0, 1], [1, 3], [2, 2], [3, 2]], regions4), false, 'two cats in a region');
  assert.equal(isComplete([[0, 1], [1, 2], [2, 0], [3, 3]], regions4), false, 'touching diagonally');
});

test('findConflicts classifies conflicts', () => {
  const kinds = (cats) => findConflicts(cats, regions4).map((c) => c.kind);
  assert.deepEqual(kinds([[0, 1], [0, 2]]), ['row']);
  assert.deepEqual(kinds([[0, 1], [1, 1]]), ['column']);
  assert.deepEqual(kinds([[0, 1], [0, 1]]), ['duplicate']);
  // (1,1) and (3,0) share region 2 but don't touch → 'region'.
  assert.deepEqual(kinds([[1, 1], [3, 0]]), ['region']);
  // (0,1) and (1,0) share region 0 AND touch diagonally; 'region' wins.
  assert.deepEqual(kinds([[0, 1], [1, 0]]), ['region']);
  // (0,0) and (1,0) share a column — 'column' wins over region/adjacency.
  assert.deepEqual(kinds([[0, 0], [1, 0]]), ['column']);
});

test('findConflicts catches a diagonal trap', () => {
  // Two cats in different rows, columns and regions that touch diagonally.
  const regions = [
    [0, 0, 0, 0],
    [0, 1, 3, 3],
    [2, 2, 2, 3],
    [2, 2, 2, 2],
  ];
  const conflicts = findConflicts([[1, 1], [2, 2]], regions);
  assert.deepEqual(conflicts, [{ kind: 'adjacent', a: [1, 1], b: [2, 2] }]);
});

test('regionGroups returns exact cell lists', () => {
  const groups = regionGroups(regions4);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[3], [[3, 1], [3, 2], [3, 3]]);
});

test('validateRegions rejects broken boards', () => {
  // Not square.
  assert.equal(validateRegions([[0, 0], [0]]).ok, false);
  // Missing region id.
  assert.equal(validateRegions([[0, 0], [0, 0]]).ok, false);
  // Disconnected region: region 0 has an island at (3,0) that only touches
  // regions 2 and 3.
  const disconnected = [
    [0, 0, 1, 1],
    [0, 2, 1, 1],
    [2, 2, 3, 3],
    [0, 3, 3, 3],
  ];
  const res = validateRegions(disconnected);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('region 0 is not 4-connected')));
  // The same board passes when connectivity is not required.
  assert.equal(validateRegions(disconnected, { requireConnected: false }).ok, true);
});
