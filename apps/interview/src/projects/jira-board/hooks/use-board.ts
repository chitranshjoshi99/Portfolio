import { useCallback, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { ASSIGNEES, INITIAL_BOARD, TOAST_MS } from '../constants/jira-board.constants';
import type { BoardFilter, Position } from '../jira-board.types';
import { persistMove, serverControl, serverLog } from '../utils/board-api';
import { boardReducer, columnViews, findPosition, keyboardTarget, moveIssue, toMoveRequest } from '../utils/board.utils';

interface DragState {
  issueId: string;
  overColumnId: string | null;
  overIndex: number | null;
}

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

export function useBoard() {
  const [board, dispatch] = useReducer(boardReducer, INITIAL_BOARD);
  const [filter, setFilter] = useState<BoardFilter>({ text: '', assignee: null });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const toastId = useRef(0);

  const views = useMemo(() => columnViews(board, filter), [board, filter]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  /**
   * Optimistic move: paint first, persist second. The undo is captured as NEIGHBOUR ids before the
   * move, so a rollback lands the card exactly where it was even if the board changed meanwhile.
   */
  const commitMove = useCallback(
    (issueId: string, to: Position) => {
      const next = moveIssue(board, issueId, to);
      if (next === board) return; // dropped where it already was
      const undo = toMoveRequest(board, issueId);
      dispatch({ type: 'moveIssue', issueId, to });

      const request = toMoveRequest(next, issueId);
      if (!request || !undo) return;
      setPending((count) => count + 1);
      persistMove(request)
        .catch((error: unknown) => {
          dispatch({ type: 'rankIssue', issueId, columnId: undo.columnId, afterId: undo.afterId });
          toast(`${board.issues[issueId].key} moved back — ${error instanceof Error ? error.message : 'failed'}`, 'error');
        })
        .finally(() => {
          setPending((count) => count - 1);
          setLog([...serverLog].slice(0, 8));
        });
    },
    [board, toast],
  );

  const onCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, issueId: string) => {
      if (!event.altKey) return; // plain arrows still scroll / move focus
      const target = keyboardTarget(board, issueId, event.key);
      if (!target) return;
      event.preventDefault();
      commitMove(issueId, target);
      const column = board.columns[target.columnId];
      setAnnouncement(`${board.issues[issueId].key} moved to ${column.title}, position ${Math.min(target.index + 1, column.issueIds.length)}`);
    },
    [board, commitMove],
  );

  /** Someone else's move arriving over a websocket: the same re-rank the server would send. */
  const simulateRemoteMove = useCallback(() => {
    const issueIds = Object.keys(board.issues);
    const issueId = issueIds[Math.floor(Math.random() * issueIds.length)];
    const from = findPosition(board, issueId);
    const targets = board.columnOrder.filter((id) => id !== from?.columnId);
    const columnId = targets[Math.floor(Math.random() * targets.length)];
    const target = board.columns[columnId].issueIds;
    const afterId = target.length > 0 ? target[target.length - 1] : null;
    dispatch({ type: 'rankIssue', issueId, columnId, afterId });
    toast(`${ASSIGNEES[Math.floor(Math.random() * ASSIGNEES.length)]} moved ${board.issues[issueId].key} to ${board.columns[columnId].title}`);
  }, [board, toast]);

  return {
    board,
    views,
    filter,
    setFilter,
    drag,
    setDrag,
    selectedId,
    setSelectedId,
    pending,
    toasts,
    announcement,
    log,
    commitMove,
    onCardKeyDown,
    simulateRemoteMove,
    addColumn: (title: string) => dispatch({ type: 'addColumn', id: `col-${Date.now().toString(36)}`, title }),
    renameColumn: (columnId: string, title: string) => dispatch({ type: 'renameColumn', columnId, title }),
    setWipLimit: (columnId: string, wipLimit: number | null) => dispatch({ type: 'setWipLimit', columnId, wipLimit }),
    moveColumn: (columnId: string, toIndex: number) => dispatch({ type: 'moveColumn', columnId, toIndex }),
    failNext: () => {
      serverControl.failNext = true;
    },
  };
}
