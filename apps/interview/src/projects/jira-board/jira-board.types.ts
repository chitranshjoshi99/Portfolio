export type Priority = 'highest' | 'high' | 'medium' | 'low';

export interface Issue {
  id: string;
  key: string;
  summary: string;
  assignee: string | null;
  points: number;
  priority: Priority;
}

export interface Column {
  id: string;
  title: string;
  /** Soft limit: the column warns, it does not block (Jira's behaviour). null = none. */
  wipLimit: number | null;
  issueIds: string[];
}

/** Normalised: entities by id, order in arrays. A move touches two arrays, never the issue itself. */
export interface BoardState {
  issues: Record<string, Issue>;
  columns: Record<string, Column>;
  columnOrder: string[];
}

export interface Position {
  columnId: string;
  index: number;
}

export type BoardAction =
  | { type: 'moveIssue'; issueId: string; to: Position }
  | { type: 'rankIssue'; issueId: string; columnId: string; afterId: string | null }
  | { type: 'addColumn'; id: string; title: string }
  | { type: 'renameColumn'; columnId: string; title: string }
  | { type: 'moveColumn'; columnId: string; toIndex: number }
  | { type: 'setWipLimit'; columnId: string; wipLimit: number | null };

/** What the server wants: rank relative to neighbours, not an index (indexes shift under concurrent edits). */
export interface MoveRequest {
  issueId: string;
  columnId: string;
  afterId: string | null;
  beforeId: string | null;
}

export interface BoardFilter {
  text: string;
  assignee: string | null;
}
