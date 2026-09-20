export const MIN_SIZE = 3;
export const MAX_SIZE = 10;
export const DEFAULT_SIZE = 3;

export const MIN_BOARDS = 1;
export const MAX_BOARDS = 4;

export const SIZE_OPTIONS = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);

export const MESSAGE = {
  turn: (player: string) => `${player} to move`,
  won: (player: string) => `${player} wins`,
  draw: 'Draw — board full',
} as const;
