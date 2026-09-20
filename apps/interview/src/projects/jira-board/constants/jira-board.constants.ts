import type { BoardState, Issue } from '../jira-board.types';

const issue = (n: number, summary: string, assignee: string | null, points: number, priority: Issue['priority']): Issue => ({
  id: `i${n}`,
  key: `CONF-${4100 + n}`,
  summary,
  assignee,
  points,
  priority,
});

const ISSUES: Issue[] = [
  issue(1, 'Editor drops selection after paste', 'Priya', 5, 'highest'),
  issue(2, 'Mention picker slow in large spaces', 'Sam', 3, 'high'),
  issue(3, 'Page tree loses expansion on reload', null, 2, 'medium'),
  issue(4, 'Inline comments overlap on mobile', 'Lee', 3, 'medium'),
  issue(5, 'Table resize handle invisible in dark mode', 'Priya', 1, 'low'),
  issue(6, 'Export to PDF ignores page width', 'Sam', 5, 'high'),
  issue(7, 'Draft autosave fires twice', 'Lee', 2, 'high'),
  issue(8, 'Emoji reactions not announced by screen readers', null, 2, 'medium'),
  issue(9, 'Board filter resets on navigation', 'Priya', 3, 'medium'),
];

export const INITIAL_BOARD: BoardState = {
  issues: Object.fromEntries(ISSUES.map((i) => [i.id, i])),
  columns: {
    todo: { id: 'todo', title: 'To Do', wipLimit: null, issueIds: ['i3', 'i8', 'i9', 'i5'] },
    progress: { id: 'progress', title: 'In Progress', wipLimit: 3, issueIds: ['i1', 'i2', 'i7'] },
    review: { id: 'review', title: 'In Review', wipLimit: 2, issueIds: ['i4'] },
    done: { id: 'done', title: 'Done', wipLimit: null, issueIds: ['i6'] },
  },
  columnOrder: ['todo', 'progress', 'review', 'done'],
};

export const ASSIGNEES = ['Priya', 'Sam', 'Lee'];
export const API_LATENCY_MS = 500;
export const TOAST_MS = 3500;
