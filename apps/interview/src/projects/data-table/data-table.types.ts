export type Status = 'todo' | 'in-progress' | 'blocked' | 'done';
export type SortColumn = 'key' | 'summary' | 'assignee' | 'status' | 'points' | 'updated';
export type SortDir = 'asc' | 'desc';

export interface Task {
  id: string;
  key: string;
  summary: string;
  assignee: string;
  status: Status;
  points: number;
  /** ISO date; sorted as a string because ISO sorts correctly either way. */
  updated: string;
  subtaskCount: number;
}

export interface Subtask {
  id: string;
  key: string;
  summary: string;
  status: Status;
  assignee: string;
}

export interface Query {
  page: number;
  pageSize: number;
  sort: SortColumn;
  dir: SortDir;
  search: string;
  status: Status | 'all';
}

export interface Page<T> {
  rows: T[];
  /** Rows matching the filter, not rows on this page: the client cannot know it. */
  total: number;
  page: number;
  pageSize: number;
  /** Counts per status for the whole filtered set, so the tabs do not lie on page 2. */
  statusCounts: Record<Status, number>;
}
