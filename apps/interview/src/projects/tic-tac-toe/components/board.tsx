import type { CSSProperties, KeyboardEvent } from 'react';
import type { Cell } from '../tic-tac-toe.types';

interface BoardProps {
  size: number;
  board: Cell[];
  winningLine: number[] | null;
  isOver: boolean;
  tabStop: number;
  onPlay: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onFocusCell: (index: number) => void;
  registerCell: (index: number, element: HTMLButtonElement | null) => void;
}

export function Board({
  size,
  board,
  winningLine,
  isOver,
  tabStop,
  onPlay,
  onKeyDown,
  onFocusCell,
  registerCell,
}: BoardProps) {
  const winning = new Set(winningLine ?? []);

  return (
    <div
      className="ttt__board"
      role="group"
      aria-label={`${size} by ${size} board`}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, '--n': size } as CSSProperties}
    >
      {board.map((cell, index) => {
        const row = Math.floor(index / size) + 1;
        const col = (index % size) + 1;
        const classes = ['ttt__cell'];
        if (cell) classes.push(`ttt__cell--${cell.toLowerCase()}`);
        if (winning.has(index)) classes.push('ttt__cell--win');

        return (
          <button
            key={index}
            ref={(element) => registerCell(index, element)}
            type="button"
            className={classes.join(' ')}
            tabIndex={index === tabStop ? 0 : -1}
            // aria-disabled, not disabled: a disabled button drops out of focus and the arrow keys stop working
            aria-disabled={cell !== null || isOver}
            aria-label={`Row ${row}, column ${col}, ${cell ?? 'empty'}`}
            onClick={() => onPlay(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onFocus={() => onFocusCell(index)}
          >
            {cell}
          </button>
        );
      })}
    </div>
  );
}
