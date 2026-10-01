import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generatePuzzle, generateRegions, validateRegions, countSolutions, solve, mulberry32 } from '../src/index.js';

test('generateRegions produces N connected regions exactly once', () => {
  const rng = mulberry32(1234);
  for (const size of [6, 8, 10, 12]) {
    const regions = generateRegions(size, rng);
    const check = validateRegions(regions);
    assert.equal(check.ok, true, `${size}×${size}: ${check.errors.join('; ')}`);
  }
});

test('seeded generation is deterministic', () => {
  const a = generateRegions(9, mulberry32(777));
  const b = generateRegions(9, mulberry32(777));
  assert.deepEqual(a, b);
});

// Generating unique boards for every supported size is the generator's main
// promise — verify it end to end for the full 6..12 range.
for (const size of [6, 7, 8, 9, 10, 11, 12]) {
  test(`generatePuzzle(${size}) yields a unique-solution board`, () => {
    const gen = generatePuzzle(size, { seed: 1000 + size, attempts: 200 });
    assert.equal(gen.unique, true, `no unique board found for ${size}×${size}`);
    assert.equal(gen.attemptsUsed >= 1, true);

    // Re-check with an independent enumeration (limit 2 = uniqueness proof).
    const check = countSolutions(gen.puzzle, { limit: 2 });
    assert.equal(check.count, 1);
    assert.equal(check.exact, true);

    // And the solver must actually return a valid placement.
    const solved = solve(gen.puzzle, { limit: 1 });
    assert.equal(solved.count, 1);
    assert.equal(solved.solutions[0].cats.length, size);

    // Deterministic across runs.
    const again = generatePuzzle(size, { seed: 1000 + size, attempts: 200 });
    assert.deepEqual(again.puzzle, gen.puzzle);
  });
}
