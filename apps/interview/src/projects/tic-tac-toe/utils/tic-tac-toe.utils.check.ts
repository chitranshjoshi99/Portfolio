/**
 * Plain assertions, no framework — run with
 * `node src/projects/tic-tac-toe/utils/tic-tac-toe.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import {
  buildBoard,
  clampWinLength,
  deriveStatus,
  findWinnerByScan,
  lineThrough,
  nextCell,
  playerForMove,
} from './tic-tac-toe.utils.ts';

const status = (moves: number[], size = 3, winLength = 3) =>
  deriveStatus(buildBoard(moves, size), moves, size, winLength);

// --- 3×3 basics ---------------------------------------------------------------------------

assert.equal(playerForMove(0), 'X');
assert.equal(playerForMove(1), 'O');
assert.deepEqual(status([]), { kind: 'playing', next: 'X' });
assert.deepEqual(status([4]), { kind: 'playing', next: 'O' });

// X: 0,1,2 (top row)
assert.deepEqual(status([0, 3, 1, 4, 2]), { kind: 'won', winner: 'X', line: [0, 1, 2] });
// O: 1,4,7 (middle column)
assert.deepEqual(status([0, 1, 3, 4, 8, 7]), { kind: 'won', winner: 'O', line: [1, 4, 7] });
// X: 0,4,8 (diagonal)
assert.deepEqual(status([0, 1, 4, 2, 8]), { kind: 'won', winner: 'X', line: [0, 4, 8] });
// X: 2,4,6 (anti-diagonal)
assert.deepEqual(status([2, 0, 4, 1, 6]), { kind: 'won', winner: 'X', line: [2, 4, 6] });

// a full board with no line is a draw
// X O X / X O O / O X X
assert.deepEqual(status([0, 1, 2, 4, 3, 5, 7, 6, 8]), { kind: 'draw' });

// the last move completing a line on a full board is a WIN, not a draw
// X O X / O X O / O X X  -> X plays 8 last, diagonal 0-4-8
assert.equal(status([0, 1, 2, 3, 4, 5, 7, 6, 8]).kind, 'won');

// --- N×N with K-in-a-row --------------------------------------------------------------------

// 5×5, K=4, anti-diagonal 3,7,11,15 (O plays filler on the bottom row)
const anti = [3, 20, 7, 21, 11, 22, 15];
assert.deepEqual(status(anti, 5, 4), { kind: 'won', winner: 'X', line: [3, 7, 11, 15] });
// same moves, K=5: not yet a win
assert.equal(status(anti, 5, 5).kind, 'playing');

// a gap filled in the MIDDLE of a run completes it — the scan must walk both ways
// 6×6, K=4: X at 0,1,3 then 2
const gap = [0, 30, 1, 31, 3, 32, 2];
assert.deepEqual(status(gap, 6, 4), { kind: 'won', winner: 'X', line: [0, 1, 2, 3] });

// an empty cell never wins
assert.equal(lineThrough(buildBoard([], 3), 3, 3, 4), null);
assert.equal(clampWinLength(9, 5), 5);
assert.equal(clampWinLength(1, 5), 3);

// --- differential: the O(K) check must agree with the O(N²·K) oracle, every move ------------

let seed = 42;
const random = () => {
  // mulberry32 — deterministic, so a failure reproduces
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let games = 0;
let positions = 0;
for (let size = 3; size <= 7; size += 1) {
  for (let winLength = 3; winLength <= size; winLength += 1) {
    for (let game = 0; game < 150; game += 1) {
      const free = Array.from({ length: size * size }, (_, i) => i);
      const moves: number[] = [];
      while (free.length) {
        const [cell] = free.splice(Math.floor(random() * free.length), 1);
        moves.push(cell);
        const board = buildBoard(moves, size);
        const fast = lineThrough(board, size, winLength, cell);
        const slow = findWinnerByScan(board, size, winLength);
        positions += 1;
        assert.equal(fast !== null, slow !== null, `size ${size} K ${winLength} moves ${moves}`);
        if (fast) {
          assert.equal(board[cell], slow);
          assert.ok(fast.length >= winLength);
          break;
        }
      }
      games += 1;
    }
  }
}
console.log(`differential: ${games} random games, ${positions} positions, lineThrough === scan`);

// --- keyboard movement clamps at edges ------------------------------------------------------

assert.equal(nextCell(0, 'ArrowLeft', 3), 0);
assert.equal(nextCell(0, 'ArrowUp', 3), 0);
assert.equal(nextCell(2, 'ArrowRight', 3), 2);
assert.equal(nextCell(2, 'ArrowDown', 3), 5);
assert.equal(nextCell(4, 'Home', 3), 3);
assert.equal(nextCell(4, 'End', 3), 5);
assert.equal(nextCell(8, 'ArrowDown', 3), 8);

console.log('tic-tac-toe.utils: all checks passed');
