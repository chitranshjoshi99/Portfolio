import { useCallback, useState } from 'react';
import { DEFAULT_SIZE, MAX_BOARDS, MIN_BOARDS } from '../constants/tic-tac-toe.constants';

export interface UseArena {
  boardCount: number;
  defaultSize: number;
  setBoardCount: (count: number) => void;
  setDefaultSize: (size: number) => void;
}

/** "The number of boards is passed as a prop" — the page owns only the count and the starting size. */
export function useArena(): UseArena {
  const [boardCount, setCount] = useState(1);
  const [defaultSize, setDefaultSize] = useState(DEFAULT_SIZE);

  const setBoardCount = useCallback((count: number) => {
    setCount(Math.min(MAX_BOARDS, Math.max(MIN_BOARDS, count)));
  }, []);

  return { boardCount, defaultSize, setBoardCount, setDefaultSize };
}
