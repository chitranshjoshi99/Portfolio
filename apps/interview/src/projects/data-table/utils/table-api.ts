import { ALL_TASKS, STATUSES } from '../constants/tasks.ts';
import type { Page, Query, Status, Subtask, Task } from '../data-table.types.ts';

/** Knobs the demo flips: latency and a forced failure, so the loading and error paths are real. */
export const apiControl = { latencyMs: 450, failNext: false };

export const requestLog: string[] = [];

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compare(a: Task, b: Task, query: Query): number {
  const direction = query.dir === 'asc' ? 1 : -1;
  if (query.sort === 'points') return (a.points - b.points) * direction;
  const left = String(a[query.sort]);
  const right = String(b[query.sort]);
  // Numeric collation so CONF-4109 sorts before CONF-4110, which a plain < would not.
  const result = collator.compare(left, right);
  // A stable tiebreak on the id: without it, equal values reshuffle between pages and rows "jump".
  return (result !== 0 ? result : collator.compare(a.id, b.id)) * direction;
}

/** This is the server. Filtering, sorting and slicing all happen here, on the full set. */
export function queryTasksSync(query: Query): Page<Task> {
  const needle = query.search.trim().toLowerCase();
  const matched = ALL_TASKS.filter((task) => {
    if (query.status !== 'all' && task.status !== query.status) return false;
    if (!needle) return true;
    return (
      task.key.toLowerCase().includes(needle) ||
      task.summary.toLowerCase().includes(needle) ||
      task.assignee.toLowerCase().includes(needle)
    );
  });

  const sorted = [...matched].sort((a, b) => compare(a, b, query));
  const start = (query.page - 1) * query.pageSize;

  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Status, number>;
  // Counts describe the search results, not the current page, and ignore the status filter itself —
  // otherwise every tab but the selected one would read zero.
  for (const task of ALL_TASKS) {
    if (!needle) statusCounts[task.status] += 1;
    else if (
      task.key.toLowerCase().includes(needle) ||
      task.summary.toLowerCase().includes(needle) ||
      task.assignee.toLowerCase().includes(needle)
    ) {
      statusCounts[task.status] += 1;
    }
  }

  return {
    rows: sorted.slice(start, start + query.pageSize),
    total: matched.length,
    page: query.page,
    pageSize: query.pageSize,
    statusCounts,
  };
}

export function queryTasks(query: Query, signal?: AbortSignal): Promise<Page<Task>> {
  const label = `GET /tasks?page=${query.page}&size=${query.pageSize}&sort=${query.sort}:${query.dir}` +
    `${query.search ? `&q=${query.search}` : ''}${query.status !== 'all' ? `&status=${query.status}` : ''}`;
  requestLog.unshift(label);
  requestLog.length = Math.min(requestLog.length, 12);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (apiControl.failNext) {
        apiControl.failNext = false;
        reject(new Error('503 — the search index is rebuilding'));
        return;
      }
      resolve(queryTasksSync(query));
    }, apiControl.latencyMs);

    // An aborted request must stop costing anything, including the timer.
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export function fetchSubtasks(taskId: string): Promise<Subtask[]> {
  const parent = ALL_TASKS.find((task) => task.id === taskId);
  requestLog.unshift(`GET /tasks/${taskId}/subtasks`);
  requestLog.length = Math.min(requestLog.length, 12);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        Array.from({ length: parent?.subtaskCount ?? 0 }, (_, index) => ({
          id: `${taskId}-s${index + 1}`,
          key: `${parent?.key}-${index + 1}`,
          summary: ['Write the failing test', 'Patch the handler', 'Update the docs', 'Verify on staging'][index],
          status: (index === 0 ? 'done' : 'todo') as Status,
          assignee: parent?.assignee ?? 'Unassigned',
        })),
      );
    }, 250);
  });
}
