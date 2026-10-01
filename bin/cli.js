#!/usr/bin/env node
/**
 * meowdoku-solver CLI
 *
 * Usage:
 *   meowdoku-solver solve <puzzle.json|-> [--limit N] [--json]
 *   meowdoku-solver verify <puzzle.json|-> [--json]
 *   meowdoku-solver generate [--size N] [--seed N] [--no-unique] [--json]
 *   meowdoku-solver demo
 *
 * The puzzle format is plain JSON:
 *   { "size": 10, "regions": [[0,0,...], ...], "cats": [[0,4]], "crosses": [[1,1]] }
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';

import {
  solve,
  countSolutions,
  generatePuzzle,
  normalizePuzzle,
  isComplete,
  renderBoard,
  colsToCats,
} from '../src/index.js';

const USAGE = `meowdoku-solver — Meowdoku / Star Battle puzzle solver

Usage:
  meowdoku-solver solve <puzzle.json | ->   [--limit N] [--json]
        Solve a puzzle ('-' reads from stdin).
  meowdoku-solver verify <puzzle.json | ->  [--json]
        Validate the stored "solution" and prove whether it is unique.
  meowdoku-solver generate [--size N] [--seed N] [--no-unique] [--json]
        Generate a (unique-solution) random puzzle, N ∈ 6..12.
  meowdoku-solver demo
        How to launch the interactive browser demo.

Examples:
  meowdoku-solver solve examples/10x10.json
  meowdoku-solver solve examples/6x6.json --limit 5 --json
  meowdoku-solver verify examples/12x12.json
  meowdoku-solver generate --size 9 --seed 42
`;

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') flags.json = true;
    else if (a === '--count') flags.count = true;
    else if (a === '--no-unique') flags.unique = false;
    else if (a === '--limit') flags.limit = Number.parseInt(args[++i], 10);
    else if (a === '--size') flags.size = Number.parseInt(args[++i], 10);
    else if (a === '--seed') flags.seed = Number.parseInt(args[++i], 10);
    else if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

function readPuzzleSource(file) {
  const text = !file || file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');
  return JSON.parse(text);
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function fmtCell([r, c]) {
  return `R${r + 1}C${c + 1}`;
}

// ---------------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'solve': {
      const { flags, positional } = parseFlags(rest);
      const puzzle = normalizePuzzle(readPuzzleSource(positional[0]));
      const limit = flags.count ? 1000 : flags.limit ?? 1;
      const res = solve(puzzle, { limit });

      if (flags.json) {
        console.log(JSON.stringify(res, null, 2));
        break;
      }
      if (res.count === 0) {
        console.log('No solution found with the given clues.');
        if (res.givenConflicts.length) {
          console.log(`Given clues already conflict: ${res.givenConflicts.map((x) => `${x.kind} ${fmtCell(x.a)}↔${fmtCell(x.b)}`).join(', ')}`);
        }
        process.exitCode = 2;
        break;
      }
      const first = res.solutions[0];
      console.log(renderBoard({ regions: puzzle.regions, cats: first.cats, crosses: puzzle.crosses }));
      console.log();
      console.log(`cats:  ${first.cats.map(fmtCell).join('  ')}`);
      const uniqueNote =
        res.count === 1 && res.exact
          ? 'unique solution ✓'
          : res.truncated
            ? `${res.count} solution(s) shown (search capped — raise --limit or use \`verify\` to prove uniqueness)`
            : `${res.count} solution(s)`;
      console.log(`found: ${uniqueNote} — ${res.nodes} nodes, ${res.ms} ms`);
      break;
    }

    case 'verify': {
      const { flags, positional } = parseFlags(rest);
      const raw = readPuzzleSource(positional[0]);
      const puzzle = normalizePuzzle(raw);

      const stored = raw.solution ?? raw.cols;
      const report = { size: puzzle.size, storedSolutionValid: null, unique: null, solutions: null };

      if (Array.isArray(stored) && stored.length === puzzle.size) {
        const cats = colsToCats(stored.map((v) => Number(v)));
        report.storedSolutionValid = isComplete(cats, puzzle.regions);
      }

      const res = countSolutions(puzzle, { limit: 2 });
      report.solutions = res.count;
      report.unique = res.count === 1 && res.exact;

      if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        const valid = report.storedSolutionValid;
        console.log(`board    : ${puzzle.size}×${puzzle.size}`);
        console.log(
          `stored   : ${valid == null ? 'n/a' : valid ? 'valid ✓' : 'INVALID ✗'}`
        );
        console.log(
          `solutions: ${report.unique ? '1 (unique ✓)' : `${report.solutions}${res.truncated ? '+' : ''}`} — ${res.nodes} nodes, ${res.ms} ms`
        );
      }
      break;
    }

    case 'generate': {
      const { flags } = parseFlags(rest);
      const size = flags.size ?? 8;
      if (size < 4 || size > 12) fail('--size must be between 4 and 12 (6..12 recommended)');

      const gen = generatePuzzle(size, { seed: flags.seed, requireUnique: flags.unique !== false });
      if (flags.json) {
        console.log(JSON.stringify({ size, regions: gen.puzzle.regions, unique: gen.unique, seed: gen.seed }, null, 2));
        break;
      }
      const res = solve(gen.puzzle, { limit: 1 });
      console.log(renderBoard({ regions: gen.puzzle.regions, cats: res.solutions[0]?.cats ?? [] }));
      console.log();
      console.log(`size    : ${size}×${size}`);
      console.log(`seed    : ${gen.seed}${gen.seed === flags.seed ? '' : ' (random)'}`);
      console.log(`unique  : ${gen.unique ? 'yes ✓' : 'no'} (attempt ${gen.attemptsUsed})`);
      break;
    }

    case 'demo':
      console.log('Run `npm run demo` and open http://localhost:4173/demo/');
      console.log('The demo lets you paint regions, place clues and solve boards from 6×6 to 12×12.');
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(USAGE);
      break;

    default:
      fail(`unknown command "${cmd}"\n\n${USAGE}`);
  }
} catch (err) {
  fail(`error: ${err.message}`);
}
