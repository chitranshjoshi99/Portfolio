import type { Cell, GameStatus, Player } from '../tic-tac-toe.types';

/** [dRow, dCol] for each axis a line can run along. Each is walked in both directions. */
const AXES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // row
  [1, 0], // column
  [1, 1], // diagonal
  [1, -1], // anti-diagonal
];

/** X always opens, so a move's owner is its parity — no `currentPlayer` state to keep in sync. */
export const playerForMove = (turn: number): Player => (turn % 2 === 0 ? 'X' : 'O');

export const clampWinLength = (winLength: number, size: number): number =>
  Math.min(size, Math.max(3, Math.round(winLength)));

/** The move list is the source of truth; the board is a replay of it. O(moves). */
export function buildBoard(moves: number[], size: number): Cell[] {
  const board: Cell[] = Array.from({ length: size * size }, () => null);
  moves.forEach((cell, turn) => {
    board[cell] = playerForMove(turn);
  });
  return board;
}

/**
 * V3 — the shipped check. Only a line through the cell just played can have just been completed,
 * so walk the 4 axes out from that cell, at most `winLength - 1` steps each way: O(K), not O(N²).
 * Returns the matched cells (sorted) or null.
 */
export function lineThrough(board: Cell[], size: number, winLength: number, index: number): number[] | null {
  const player = board[index];
  if (!player) return null;
  const row = Math.floor(index / size);
  const col = index % size;

  for (const [dRow, dCol] of AXES) {
    const line = [index];
    for (const sign of [1, -1]) {
      let r = row + dRow * sign;
      let c = col + dCol * sign;
      for (let step = 1; step < winLength; step += 1) {
        if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== player) break;
        line.push(r * size + c);
        r += dRow * sign;
        c += dCol * sign;
      }
    }
    if (line.length >= winLength) return line.sort((a, b) => a - b);
  }
  return null;
}

/**
 * V0 — the oracle. Every cell as a start, every axis, K cells each: O(N² · K).
 * Not on the read path; the check file diffs `lineThrough` against it over random games.
 */
export function findWinnerByScan(board: Cell[], size: number, winLength: number): Player | null {
  for (let index = 0; index < board.length; index += 1) {
    const player = board[index];
    if (!player) continue;
    const row = Math.floor(index / size);
    const col = index % size;
    for (const [dRow, dCol] of AXES) {
      let count = 1;
      while (count < winLength) {
        const r = row + dRow * count;
        const c = col + dCol * count;
        if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== player) break;
        count += 1;
      }
      if (count === winLength) return player;
    }
  }
  return null;
}

/**
 * Play stops at the first win, so only the LAST move can have produced one — the status never
 * needs a full-board scan.
 */
export function deriveStatus(board: Cell[], moves: number[], size: number, winLength: number): GameStatus {
  const last = moves[moves.length - 1];
  if (last !== undefined) {
    const line = lineThrough(board, size, winLength, last);
    if (line) return { kind: 'won', winner: board[last] as Player, line };
  }
  if (moves.length === size * size) return { kind: 'draw' };
  return { kind: 'playing', next: playerForMove(moves.length) };
}

/** Arrow-key movement inside the grid. Clamps at the edges instead of wrapping rows. */
export function nextCell(index: number, key: string, size: number): number {
  const row = Math.floor(index / size);
  const col = index % size;
  switch (key) {
    case 'ArrowRight':
      return col < size - 1 ? index + 1 : index;
    case 'ArrowLeft':
      return col > 0 ? index - 1 : index;
    case 'ArrowDown':
      return row < size - 1 ? index + size : index;
    case 'ArrowUp':
      return row > 0 ? index - size : index;
    case 'Home':
      return row * size;
    case 'End':
      return row * size + size - 1;
    default:
      return index;
  }
}
