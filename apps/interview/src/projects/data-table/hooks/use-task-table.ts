import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_QUERY, SEARCH_DEBOUNCE_MS } from '../constants/tasks';
import type { Page, Query, SortColumn, Status, Subtask, Task } from '../data-table.types';
import { apiControl, fetchSubtasks, queryTasks, requestLog } from '../utils/table-api';
import { clampPage, nextSort, queryKey, totalPages } from '../utils/table.utils';

const FALLBACK = { sort: DEFAULT_QUERY.sort as SortColumn, dir: DEFAULT_QUERY.dir };

export function useTaskTable() {
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY });
  /** What the input shows, before the debounce turns it into a request. */
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState<Page<Task> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[] | 'loading'>>({});
  const [log, setLog] = useState<string[]>([]);
  const [reloads, setReloads] = useState(0);

  // Debounce the text box into the query: one request per pause, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((current) => (current.search === searchDraft ? current : { ...current, search: searchDraft, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const key = queryKey(query);

  useEffect(() => {
    const controller = new AbortController();
    // Both halves are needed. The controller cancels the request that is still on the wire; `ignore`
    // catches the response that already resolved, because aborting a settled promise does nothing and
    // its .then is a microtask that can still be queued when the cleanup runs.
    let ignore = false;
    setLoading(true);
    setError(null);

    queryTasks(query, controller.signal)
      .then((result) => {
        if (ignore) return;
        setPage(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (ignore || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError(cause instanceof Error ? cause.message : 'Request failed');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
        setLog([...requestLog]);
      });

    return () => {
      ignore = true;
      controller.abort();
    };
    // `key` is the whole request: any field the server reads changes it, and nothing else does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloads]);

  // The server is the authority on how many pages there are. A filter that shrinks the set can leave
  // the table on page 9 of 3; pull it back rather than showing an empty table with rows behind it.
  useEffect(() => {
    if (!page) return;
    const clamped = clampPage(query.page, page.total, query.pageSize);
    if (clamped !== query.page) setQuery((current) => ({ ...current, page: clamped }));
  }, [page, query.page, query.pageSize]);

  const pages = totalPages(page?.total ?? 0, query.pageSize);
  /** Rows stay on screen while the next page loads: the table dims instead of collapsing. */
  const rows = page?.rows ?? [];
  const isStale = loading && page !== null;

  const toggleExpand = useCallback(
    (task: Task) => {
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(task.id)) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
      // Subtasks load once per task and are kept: collapsing is not a reason to throw them away.
      setSubtasks((current) => {
        if (current[task.id] || task.subtaskCount === 0) return current;
        void fetchSubtasks(task.id).then((result) => {
          setSubtasks((state) => ({ ...state, [task.id]: result }));
          setLog([...requestLog]);
        });
        return { ...current, [task.id]: 'loading' };
      });
    },
    [],
  );

  const patch = useCallback((next: Partial<Query>) => {
    setQuery((current) => ({ ...current, page: 1, ...next }));
  }, []);

  return {
    query,
    rows,
    total: page?.total ?? 0,
    statusCounts: page?.statusCounts,
    pages,
    loading,
    isStale,
    error,
    log,
    searchDraft,
    setSearchDraft,
    expanded,
    subtasks,
    toggleExpand,
    sortBy: (column: SortColumn) => setQuery((current) => nextSort(current, column, FALLBACK)),
    setStatus: (status: Status | 'all') => patch({ status }),
    setPageSize: (pageSize: number) => patch({ pageSize }),
    goToPage: (value: number) => setQuery((current) => ({ ...current, page: value })),
    retry: () => setReloads((count) => count + 1),
    reset: () => {
      setSearchDraft('');
      setQuery({ ...DEFAULT_QUERY });
    },
    failNext: () => {
      apiControl.failNext = true;
    },
    isEmpty: !loading && !error && rows.length === 0,
  };
}
