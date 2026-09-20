import type { Status, Task } from '../data-table.types';

export const STATUSES: Status[] = ['todo', 'in-progress', 'blocked', 'done'];

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const PAGE_SIZES = [10, 25, 50];

const ASSIGNEES = ['Priya', 'Sam', 'Lee', 'Mia', 'Ravi', 'Jo', 'Unassigned'];

const SUMMARIES = [
  'Editor drops selection after paste',
  'Mention picker slow on large spaces',
  'Page tree loses expansion on reload',
  'Inline comments overlap on narrow screens',
  'Search returns archived pages',
  'Attachment upload fails over 40MB',
  'Board filter resets after drag',
  'Sprint report double-counts carryover',
  'Export to PDF drops table borders',
  'Notification email links to the wrong space',
  'Keyboard shortcut conflicts with screen reader',
  'Dark theme contrast fails on lozenges',
];

/** A deterministic corpus: a seeded generator, so a bug is reproducible and the tests are stable. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const ALL_TASKS: Task[] = (() => {
  const random = seeded(20260320);
  return Array.from({ length: 137 }, (_, index) => {
    const status = STATUSES[Math.floor(random() * STATUSES.length)];
    const day = 1 + Math.floor(random() * 28);
    return {
      id: `t${index + 1}`,
      key: `CONF-${4100 + index}`,
      summary: SUMMARIES[Math.floor(random() * SUMMARIES.length)],
      assignee: ASSIGNEES[Math.floor(random() * ASSIGNEES.length)],
      status,
      points: [1, 2, 3, 5, 8][Math.floor(random() * 5)],
      updated: `2026-03-${String(day).padStart(2, '0')}`,
      subtaskCount: Math.floor(random() * 4),
    };
  });
})();

export const DEFAULT_QUERY = {
  page: 1,
  pageSize: 10,
  sort: 'updated',
  dir: 'desc',
  search: '',
  status: 'all',
} as const;

export const SEARCH_DEBOUNCE_MS = 300;
