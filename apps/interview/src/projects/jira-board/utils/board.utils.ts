import type { BoardAction, BoardFilter, BoardState, Issue, MoveRequest, Position } from '../jira-board.types';

/** Where an issue currently is. O(columns) — the only search on the board, and columns are few. */
export function findPosition(state: BoardState, issueId: string): Position | null {
  for (const columnId of state.columnOrder) {
    const index = state.columns[columnId].issueIds.indexOf(issueId);
    if (index !== -1) return { columnId, index };
  }
  return null;
}

/**
 * Move an issue to (columnId, index). Only the two affected columns are copied.
 *
 * The index trap: within one column, removing the card first shifts every later index down by one, so a
 * drop target computed against the ORIGINAL list must be decremented when moving downwards.
 */
export function moveIssue(state: BoardState, issueId: string, to: Position): BoardState {
  const from = findPosition(state, issueId);
  if (!from || !state.columns[to.columnId]) return state;

  const sameColumn = from.columnId === to.columnId;
  const targetIndex = sameColumn && to.index > from.index ? to.index - 1 : to.index;
  if (sameColumn && targetIndex === from.index) return state; // no-op: same object out, no re-render

  const source = [...state.columns[from.columnId].issueIds];
  source.splice(from.index, 1);
  const destination = sameColumn ? source : [...state.columns[to.columnId].issueIds];
  destination.splice(Math.max(0, Math.min(targetIndex, destination.length)), 0, issueId);

  return {
    ...state,
    columns: {
      ...state.columns,
      [from.columnId]: { ...state.columns[from.columnId], issueIds: sameColumn ? destination : source },
      [to.columnId]: { ...state.columns[to.columnId], issueIds: destination },
    },
  };
}

/**
 * The server's primitive: put the issue in `columnId` directly after `afterId` (null = first).
 * Used for rollback and for applying someone else's move — both are "re-rank to a known neighbour",
 * which is stable even though indexes have shifted in the meantime.
 */
export function moveIssueAfter(state: BoardState, issueId: string, columnId: string, afterId: string | null): BoardState {
  const from = findPosition(state, issueId);
  if (!from || !state.columns[columnId]) return state;
  const source = [...state.columns[from.columnId].issueIds];
  source.splice(from.index, 1);
  const destination = from.columnId === columnId ? source : [...state.columns[columnId].issueIds];
  const at = afterId === null ? 0 : destination.indexOf(afterId) + 1;
  destination.splice(at, 0, issueId);
  return {
    ...state,
    columns: {
      ...state.columns,
      [from.columnId]: { ...state.columns[from.columnId], issueIds: from.columnId === columnId ? destination : source },
      [columnId]: { ...state.columns[columnId], issueIds: destination },
    },
  };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'moveIssue':
      return moveIssue(state, action.issueId, action.to);
    case 'rankIssue':
      return moveIssueAfter(state, action.issueId, action.columnId, action.afterId);
    case 'addColumn':
      return {
        ...state,
        columns: { ...state.columns, [action.id]: { id: action.id, title: action.title, wipLimit: null, issueIds: [] } },
        columnOrder: [...state.columnOrder, action.id],
      };
    case 'renameColumn':
      return {
        ...state,
        columns: { ...state.columns, [action.columnId]: { ...state.columns[action.columnId], title: action.title } },
      };
    case 'moveColumn': {
      const order = state.columnOrder.filter((id) => id !== action.columnId);
      order.splice(Math.max(0, Math.min(action.toIndex, order.length)), 0, action.columnId);
      return { ...state, columnOrder: order };
    }
    case 'setWipLimit':
      return {
        ...state,
        columns: { ...state.columns, [action.columnId]: { ...state.columns[action.columnId], wipLimit: action.wipLimit } },
      };
    default:
      return state;
  }
}

/**
 * What to send the server: the neighbours, not the index. "Rank issue X after Y" survives someone else
 * inserting a card above it; "put X at index 3" does not. (Jira's rank API works this way.)
 */
export function toMoveRequest(state: BoardState, issueId: string): MoveRequest | null {
  const position = findPosition(state, issueId);
  if (!position) return null;
  const ids = state.columns[position.columnId].issueIds;
  return {
    issueId,
    columnId: position.columnId,
    afterId: ids[position.index - 1] ?? null,
    beforeId: ids[position.index + 1] ?? null,
  };
}

/** Drop index from card midpoints: the first card whose middle is below the pointer. */
export function dropIndexFromMidpoints(midpoints: number[], pointerY: number): number {
  const index = midpoints.findIndex((middle) => pointerY < middle);
  return index === -1 ? midpoints.length : index;
}

export const matchesFilter = (issue: Issue, filter: BoardFilter): boolean => {
  const text = filter.text.trim().toLowerCase();
  if (filter.assignee && issue.assignee !== filter.assignee) return false;
  if (!text) return true;
  return `${issue.key} ${issue.summary}`.toLowerCase().includes(text);
};

export interface ColumnView {
  id: string;
  title: string;
  wipLimit: number | null;
  issues: Issue[];
  /** Cards hidden by the filter — shown as a count so the board never looks empty for no reason. */
  hiddenCount: number;
  points: number;
  overWip: boolean;
}

/** One pass over the board: what each column renders. Filtering never changes the underlying order. */
export function columnViews(state: BoardState, filter: BoardFilter): ColumnView[] {
  return state.columnOrder.map((columnId) => {
    const column = state.columns[columnId];
    const all = column.issueIds.map((id) => state.issues[id]).filter(Boolean);
    const issues = all.filter((issue) => matchesFilter(issue, filter));
    return {
      id: column.id,
      title: column.title,
      wipLimit: column.wipLimit,
      issues,
      hiddenCount: all.length - issues.length,
      points: issues.reduce((total, issue) => total + issue.points, 0),
      // The WIP limit counts every card in the column, not just the filtered ones.
      overWip: column.wipLimit !== null && all.length > column.wipLimit,
    };
  });
}

/** Keyboard move: one column left/right (to the same index, clamped) or one row up/down. */
export function keyboardTarget(state: BoardState, issueId: string, key: string): Position | null {
  const from = findPosition(state, issueId);
  if (!from) return null;
  const columnIndex = state.columnOrder.indexOf(from.columnId);
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const nextColumnIndex = columnIndex + (key === 'ArrowRight' ? 1 : -1);
    if (nextColumnIndex < 0 || nextColumnIndex >= state.columnOrder.length) return null;
    const columnId = state.columnOrder[nextColumnIndex];
    return { columnId, index: Math.min(from.index, state.columns[columnId].issueIds.length) };
  }
  if (key === 'ArrowUp') return from.index === 0 ? null : { columnId: from.columnId, index: from.index - 1 };
  if (key === 'ArrowDown') {
    const size = state.columns[from.columnId].issueIds.length;
    // +1 because the card is still counted in its own column while computing the target index
    return from.index >= size - 1 ? null : { columnId: from.columnId, index: from.index + 2 };
  }
  return null;
}
