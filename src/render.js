/**
 * Minimal ASCII rendering for terminal output (used by the CLI).
 *
 * Each cell is printed as two characters:
 *   [region id][mark]  where mark is:
 *     '*' – a cat        'x' – a crossed-out cell        ' ' – empty
 *
 * Example (4×4):
 *   0 0 0 0
 *   0 2 1* 1
 *   2 2 2 1
 *   2 3 3 3
 */

const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * @param {{regions: number[][], cats?: [number, number][], crosses?: [number, number][]}} board
 * @returns {string}
 */
export function renderBoard({ regions, cats = [], crosses = [] }) {
  const size = regions.length;
  const catSet = new Set(cats.map(([r, c]) => r * size + c));
  const crossSet = new Set(crosses.map(([r, c]) => r * size + c));

  const lines = [];
  for (let r = 0; r < size; r++) {
    let line = '';
    for (let c = 0; c < size; c++) {
      const key = r * size + c;
      const id = ID_CHARS[regions[r][c]] ?? '?';
      const mark = catSet.has(key) ? '*' : crossSet.has(key) ? 'x' : ' ';
      line += `${id}${mark} `;
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}
