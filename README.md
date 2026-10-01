# 🐱 Meowdoku Solver

**Fast, zero-dependency JavaScript solver for Meowdoku / Star Battle puzzles.**
Board sizes 6×6 – 12×12 · given clues · uniqueness proof · hints · seeded puzzle generator · CLI + interactive browser demo.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue.svg)
![Tests: 31 passing](https://img.shields.io/badge/tests-31%20passing-brightgreen.svg)

Live interactive web version, complete level answers, and screenshot solver available at: meowdokuweb.com.

---

## What is Meowdoku?

**Meowdoku** (also known as *Star Battle*, *Queens* or *cat sudoku*) is a logic puzzle played on an N×N board that is carved into N irregular regions. The rules are simple but surprisingly deep:

1. 🐱 **Exactly one cat in every row**
2. 🐱 **Exactly one cat in every column**
3. 🐱 **Exactly one cat in every region**
4. 🚫 **No two cats may touch** — not even diagonally

This repository contains the complete solving core used across the [meowdokuweb.com](https://meowdokuweb.com) toolset — solving, uniqueness checking, logical hints, puzzle generation, a CLI and a browser demo — all in plain ES modules with **zero runtime dependencies**.

> ℹ️ This is an unofficial, community-made engineering project. It is not affiliated with the publisher of the Meowdoku mobile games.

## Features

- **Solves any board size** from 6×6 to 12×12 (4×4 and 5×5 work too) in milliseconds
- **Uniqueness proof** — `countSolutions()` finds 1 solution or proves there are ≥ 2 / none
- **Given clues** — pre-placed cats *and* “no cat here” ✕ marks are respected
- **Logical hints** — `findHint()` returns a cell that is a cat in *every* solution when one exists, with an honest `certain` flag
- **Seeded puzzle generator** — random region maps, retried + clue-augmented until the puzzle has a unique solution; a given seed always produces the same board
- **Three ways to use it** — ES-module library, command-line tool, and an interactive browser demo with region painting and clue tools
- **Zero dependencies** — one code base for Node.js ≥ 18 and modern browsers
- **Tested** — 31 unit tests covering the rules, the solver, uniqueness counting, hints and the generator (including every size 6–12)

## Quick start

### As a library

```js
import { solve, countSolutions, findHint, generatePuzzle } from 'meowdoku-solver';

const puzzle = {
  size: 10,
  regions: [
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    // … N×N region ids (0 .. N-1)
  ],
  cats: [[0, 4]],       // optional given cats
  crosses: [[1, 1]],    // optional “no cat” marks
};

const res = solve(puzzle, { limit: 1 });
console.log(res.count, res.solutions[0].cats, `${res.ms} ms`);

// Prove uniqueness:
const check = countSolutions(puzzle, { limit: 2 });
console.log(check.count === 1 && check.exact ? 'unique ✓' : 'not unique');

// Generate a fresh unique board (seeded & reproducible):
const gen = generatePuzzle(9, { seed: 42 });
```

### CLI

```bash
git clone https://github.com/<your-account>/meowdoku-solver.git
cd meowdoku-solver

node bin/cli.js solve examples/10x10.json       # solve a puzzle file
node bin/cli.js solve examples/6x6.json --limit 5 --json
node bin/cli.js verify examples/12x12.json      # validate + prove uniqueness
node bin/cli.js generate --size 9 --seed 42     # generate a unique puzzle
```

### Browser demo

```bash
npm run demo
# → http://localhost:4173/demo/
```

The demo mirrors the puzzle editor on meowdokuweb.com: pick a board size (6–12), paint regions with the colour palette, drop given cats / ✕ marks, then **Check board**, ask for **One hint**, or hit **Find solution**.

## Puzzle format

A puzzle is a plain JSON object. Only `regions` is required.

```json
{
  "name": "10x10 puzzle #399",
  "size": 10,
  "regions": [
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [0, 2, 2, 2, 2, 2, 2, 1, 1, 1],
    "… 10 rows in total"
  ],
  "cats": [[0, 4]],
  "crosses": [[1, 1]],
  "solution": [4, 8, 1, 3, 7, 2, 5, 9, 6, 0]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `size` | no | Board size; inferred from `regions` when omitted |
| `regions` / `regionMap` | **yes** | N×N region ids. Accepts `number[][]`, rows of digit strings (`["0011", …]`), or a flat array |
| `cats` / `givenCats` | no | Cells `[row, col]` (or `{r, c}`) that **must** contain a cat |
| `crosses` / `givenCrosses` | no | Cells that must **not** contain a cat |
| `solution` | no | Reference solution in “column per row” form; the CLI `verify` command checks it |

A solution is a permutation `cols` where `cols[r]` is the cat column in row `r`; `colsToCats()` converts it to cell coordinates.

## How it works

### The model

A solution is represented as a permutation — `cols[r] = c` means the cat of row `r` sits in column `c`. The four rules collapse into:

| Rule | Becomes |
| --- | --- |
| one cat per row | the representation itself |
| one cat per column | `cols` must be a permutation of `0..N-1` |
| one cat per region | region ids of the chosen cells must be a permutation |
| cats don't touch | `|cols[r] − cols[r±1]| > 1` |

### The search

Rows are filled top-down (`src/solver.js`). At every step candidate columns are filtered by all four rules. On top of that, a **region reachability prune** applies: every region that doesn’t have a cat yet must still own at least one usable cell in the not-yet-assigned rows, otherwise the branch is dead. In practice this keeps the tree tiny — a typical unique 10×10 puzzle is solved in a few hundred nodes.

### Uniqueness & hints

`countSolutions(puzzle, { limit: 2 })` explores until it either proves the solution is unique (exact, `count === 1`) or finds a second one. `findHint()` enumerates up to `maxSolutions` solutions and returns a cell that is a cat in **all** of them (a logically forced placement, `certain: true` when the whole space was searched), falling back to an example step otherwise.

### The generator

`generateRegions()` grows N regions from random seeds with an interleaved random-growth process — every region ends up non-empty and 4-connected. `generatePuzzle()` then:

1. solves the bare region map — maps with no solution are retried;
2. when the map admits several solutions, it **augments the puzzle with given cats** (always drawn from a real solution, so solvability is preserved) until uniqueness is proven — usually 0–3 clues, at most one per row;
3. returns the puzzle together with its solution. The whole pipeline is seeded, so `seed` fully determines the result.

### Performance (Node.js 24, single core)

| Workload | Time |
| --- | --- |
| Solve unique 6×6 … 9×9 | < 3 ms |
| Solve unique 10×10 (417 nodes) | ~2 ms |
| Solve unique 12×12 | ~8–25 ms |
| Generate unique 12×12 (incl. augmentation) | ~130 ms |

## API

All functions accept a puzzle object (or JSON string) and never mutate it.

| Function | Description |
| --- | --- |
| `solve(puzzle, {limit=1, timeLimitMs=0})` | Find up to `limit` solutions |
| `countSolutions(puzzle, {limit=1000})` | Count solutions; `exact: true` when not truncated |
| `enumerate(puzzle, {limit, timeLimitMs})` | Low-level search, full result metadata (`nodes`, `ms`, `truncated`) |
| `findHint(puzzle, {maxSolutions=512, exclude=[]})` | A forced (or example) next cat cell |
| `generatePuzzle(size, {seed, attempts=120, requireUnique=true})` | Seeded generator, unique-solution by default |
| `generateRegions(size, rng)` | Just the region map (N connected regions) |
| `validateRegions(regions, {requireConnected=true})` | Shape / coverage / connectivity checks |
| `findConflicts(cats, regions)` | Classify every conflicting pair (`row`/`column`/`region`/`adjacent`/`duplicate`) |
| `isComplete(cats, regions)` | Full solution check |
| `normalizePuzzle(input)` · `parsePuzzle(text)` | Input normalisation (`PuzzleError` on bad input) |
| `colsToCats(cols)` · `catsToCols(cats, size)` | Solution ↔ cell conversions |
| `renderBoard({regions, cats, crosses})` | ASCII rendering (used by the CLI) |
| `mulberry32(seed)` · `shuffle(array, rng)` | The seeding utilities used by the generator |

`solve()`/`countSolutions()` return `{ count, exact, truncated, timedOut, solutions: [{cols, cats}], nodes, ms, size, givenConflicts }`.

## CLI reference

```
meowdoku-solver solve <puzzle.json | ->   [--limit N] [--json]
meowdoku-solver verify <puzzle.json | ->  [--json]
meowdoku-solver generate [--size N] [--seed N] [--no-unique] [--json]
meowdoku-solver demo
```

- `solve` — prints the board with cats at their solution cells (`*`), plus node/time stats
- `verify` — validates the stored `solution` and proves whether the puzzle is unique
- `generate` — prints a fresh puzzle (and its solution), sizes 6–12 recommended
- `-` reads the puzzle JSON from stdin

## Example puzzles

`examples/` ships one real puzzle per board size — every one of them verified to have a **unique** solution (see `test/examples.test.js`):

| File | Size | Notes |
| --- | --- | --- |
| `4x4.json` … `9x9.json` | 4–9 | starter / mid-size boards |
| `10x10.json` | 10 | 417 search nodes |
| `11x11.json` · `12x12.json` | 11–12 | large boards (~6k nodes) |

## Development

```bash
npm test        # run the test-suite (node --test, zero dependencies)
npm run demo    # serve the repo (demo + library) on http://localhost:4173/demo/
```

Project layout:

```
meowdoku-solver/
├── src/            # the library (ES modules)
│   ├── solver.js      # backtracking core, counting, hints
│   ├── generator.js   # region growth + clue augmentation
│   ├── rules.js       # rule primitives & validation
│   ├── puzzle.js      # input normalisation
│   ├── render.js      # ASCII output
│   └── random.js      # seeded RNG (mulberry32)
├── bin/cli.js      # command-line interface
├── scripts/serve.js# zero-dependency static server (npm run demo)
├── demo/index.html # interactive browser demo
├── examples/       # real puzzles, one per size 4–12 (all unique)
└── test/           # node:test suites
```

## FAQ

**A generic Star Battle solver says my puzzle has no solution — is the data broken?**
Probably not. Most generic tools default to **2 stars per row / column / region**, while Meowdoku uses exactly **one cat** per row, column and region. We verified this first-hand: a 10×10 board can be uniquely solvable under 1★ rules while exhaustive search proves it has *no* 2★ arrangement. Also remember that in Meowdoku cats may not touch **diagonally** either — solvers that only forbid orthogonal touching will find “extra” solutions.

**Which board sizes are supported?**
The solver is general, but the sizes used by the game (and exercised in tests) are **6×6 through 12×12**. Smaller boards like 4×4 also work and are handy for unit tests.

**How do I find the answer for a specific level?**
Use the [live web version](https://meowdokuweb.com) — it has the full interactive puzzles, hints, screenshot solving and complete level answers.

## License

[MIT](LICENSE) © 2026 Meowdoku Solver contributors.

---

*Meowdoku Solver is an unofficial community project. Live interactive web version, complete level answers, and screenshot solver available at: [meowdokuweb.com](https://meowdokuweb.com).*
