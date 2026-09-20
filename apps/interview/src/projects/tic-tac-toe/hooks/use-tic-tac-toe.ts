import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Cell, GameStatus, Scoreboard } from '../tic-tac-toe.types';
import { buildBoard, clampWinLength, deriveStatus, nextCell } from '../utils/tic-tac-toe.utils';

export interface UseTicTacToe {
  size: number;
  winLength: number;
  board: Cell[];
  status: GameStatus;
  moveCount: number;
  scores: Scoreboard;
  play: (index: number) => void;
  undo: () => void;
  newGame: () => void;
  changeSize: (size: number) => void;
  changeWinLength: (winLength: number) => void;
  handleCellKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  registerCell: (index: number, element: HTMLButtonElement | null) => void;
  /** Roving tabindex: the one cell that is in the Tab order. */
  tabStop: number;
  setTabStop: (index: number) => void;
}

export function useTicTacToe(initialSize: number): UseTicTacToe {
  const [size, setSize] = useState(initialSize);
  const [winLength, setWinLength] = useState(initialSize);
  /** The whole game. Board, turn and winner are all derived from it — nothing to keep in sync. */
  const [moves, setMoves] = useState<number[]>([]);
  const [scores, setScores] = useState<Scoreboard>({ X: 0, O: 0, draws: 0 });
  /** One Tab stop for the whole grid; arrows move inside it. 100 tab stops on a 10×10 is not a11y. */
  const [tabStop, setTabStop] = useState(0);

  /** Cell buttons by index, for arrow-key focus. Bookkeeping, so a ref, not state. */
  const cellRefs = useRef(new Map<number, HTMLButtonElement>());

  const board = useMemo(() => buildBoard(moves, size), [moves, size]);
  const status = useMemo(() => deriveStatus(board, moves, size, winLength), [board, moves, size, winLength]);

  const play = useCallback(
    (index: number) => {
      if (status.kind !== 'playing' || board[index] !== null) return;
      const nextMoves = [...moves, index];
      setMoves(nextMoves);
      // Score in the event, not in an effect watching `status`: an effect would double-count
      // under StrictMode and re-count after an undo/redo round trip.
      const next = deriveStatus(buildBoard(nextMoves, size), nextMoves, size, winLength);
      if (next.kind === 'won') setScores((s) => ({ ...s, [next.winner]: s[next.winner] + 1 }));
      if (next.kind === 'draw') setScores((s) => ({ ...s, draws: s.draws + 1 }));
    },
    [board, moves, size, status.kind, winLength],
  );

  // Undo only while the game is live — undoing a scored game would leave the tally wrong.
  const undo = useCallback(() => {
    if (status.kind !== 'playing') return;
    setMoves((current) => current.slice(0, -1));
  }, [status.kind]);

  const newGame = useCallback(() => setMoves([]), []);

  const changeSize = useCallback((nextSize: number) => {
    setSize(nextSize);
    setWinLength((current) => clampWinLength(current === size ? nextSize : current, nextSize));
    setMoves([]); // a half-played game on a different grid means nothing
    setTabStop(0);
  }, [size]);

  const changeWinLength = useCallback(
    (next: number) => {
      setWinLength(clampWinLength(next, size));
      setMoves([]);
    },
    [size],
  );

  const registerCell = useCallback((index: number, element: HTMLButtonElement | null) => {
    if (element) cellRefs.current.set(index, element);
    else cellRefs.current.delete(index);
  }, []);

  const handleCellKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const target = nextCell(index, event.key, size);
      if (target === index) return;
      event.preventDefault(); // arrows would otherwise scroll the page
      cellRefs.current.get(target)?.focus();
    },
    [size],
  );

  return {
    size,
    winLength,
    board,
    status,
    moveCount: moves.length,
    scores,
    play,
    undo,
    newGame,
    changeSize,
    changeWinLength,
    handleCellKeyDown,
    registerCell,
    tabStop,
    setTabStop,
  };
}
