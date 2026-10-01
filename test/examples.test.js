/**
 * Every puzzle in /examples must:
 *   1. have valid, 4-connected regions;
 *   2. have exactly ONE solution under the Meowdoku rules;
 *   3. solve to the stored reference solution.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { solve, countSolutions, validateRegions, isComplete, colsToCats } from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = join(root, 'examples');

const files = readdirSync(examplesDir).filter((f) => f.endsWith('.json')).sort();
assert.ok(files.length >= 6, 'expected at least 6 example puzzles');

for (const file of files) {
  test(`example ${file}: unique solution matches the stored reference`, () => {
    const puzzle = JSON.parse(readFileSync(join(examplesDir, file), 'utf8'));

    const regions = validateRegions(puzzle.regions);
    assert.equal(regions.ok, true, `regions invalid: ${regions.errors.join('; ')}`);

    const res = solve(puzzle, { limit: 2 });
    assert.equal(res.count, 1, 'expected exactly one solution');
    assert.equal(res.exact, true, 'uniqueness proof should be exact');
    assert.ok(res.ms < 5000, `solve took too long: ${res.ms} ms`);

    const expected = colsToCats(puzzle.solution);
    assert.deepEqual(res.solutions[0].cats, expected);
    assert.equal(isComplete(res.solutions[0].cats, puzzle.regions), true);

    // countSolutions with a bigger cap must agree & be exact.
    const count = countSolutions(puzzle, { limit: 10 });
    assert.equal(count.count, 1);
    assert.equal(count.exact, true);
  });
}
