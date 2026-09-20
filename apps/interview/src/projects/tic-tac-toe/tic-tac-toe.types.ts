export type Player = 'X' | 'O';

export type Cell = Player | null;

export interface GameConfig {
  /** Board is size × size. */
  size: number;
  /** Marks in a row needed to win. 3 on a 3×3; configurable up to `size` on bigger boards. */
  winLength: number;
}

export type GameStatus =
  | { kind: 'playing'; next: Player }
  | { kind: 'won'; winner: Player; line: number[] }
  | { kind: 'draw' };

export interface Scoreboard {
  X: number;
  O: number;
  draws: number;
}
