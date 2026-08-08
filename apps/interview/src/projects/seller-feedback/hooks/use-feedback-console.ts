import { useCallback, useEffect, useRef, useState } from 'react';
import { MESSAGE, PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../constants/seller-feedback.constants';
import type { Feedback, FeedbackQuery, FeedbackStatus } from '../seller-feedback.types';
import { listFeedback, updateFeedbackStatus } from '../utils/feedback-api';
import { patchRowStatus, totalPages } from '../utils/feedback.utils';
import { useDebouncedValue } from './use-debounced-value';

/** A mutation that failed, kept per row so that row can offer Retry. */
export interface FailedMutation {
  status: FeedbackStatus;
  message: string;
}

export interface UseFeedbackConsole {
  search: string;
  setSearch: (search: string) => void;
  status: FeedbackQuery['status'];
  setStatus: (status: FeedbackQuery['status']) => void;
  items: Feedback[];
  total: number;
  page: number;
  pageCount: number;
  goToPage: (page: number) => void;
  isLoading: boolean;
  listError: string | null;
  reload: () => void;
  pendingIds: Set<string>;
  failedById: Record<string, FailedMutation>;
  setFeedbackStatus: (id: string, status: FeedbackStatus) => void;
  retry: (id: string) => void;
  dismissFailure: (id: string) => void;
}

export function useFeedbackConsole(): UseFeedbackConsole {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FeedbackQuery['status']>('all');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [failedById, setFailedById] = useState<Record<string, FailedMutation>>({});

  /** Only the newest request may write to state — older ones are dropped on arrival. */
  const latestRequestId = useRef(0);

  // A narrower filter can leave you on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);

    listFeedback({ search: debouncedSearch, status, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (requestId !== latestRequestId.current) return;
        setItems(result.items);
        setTotal(result.total);
        setListError(null);
      })
      .catch(() => {
        if (requestId !== latestRequestId.current) return;
        setListError(MESSAGE.listFailed);
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });
  }, [debouncedSearch, status, page, reloadToken]);

  const pageCount = totalPages(total, PAGE_SIZE);

  const goToPage = useCallback((next: number) => setPage(Math.min(Math.max(1, next), pageCount)), [pageCount]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const togglePending = useCallback((id: string, isPending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Optimistic: the row flips immediately, then the server is asked.
   * On rejection the previous status is put back and the failure is parked on that
   * row, so the retry re-runs exactly the mutation the user asked for.
   */
  const setFeedbackStatus = useCallback(
    async (id: string, status: FeedbackStatus) => {
      const previousStatus = items.find((item) => item.id === id)?.status;
      if (previousStatus === undefined || previousStatus === status) return;

      setItems((current) => patchRowStatus(current, id, status));
      togglePending(id, true);
      setFailedById(({ [id]: _dropped, ...rest }) => rest);

      try {
        await updateFeedbackStatus(id, status);
        // The server is now the source of truth: counts and filters may have moved.
        reload();
      } catch {
        setItems((current) => patchRowStatus(current, id, previousStatus));
        setFailedById((current) => ({ ...current, [id]: { status, message: MESSAGE.mutationFailed(status) } }));
      } finally {
        togglePending(id, false);
      }
    },
    [items, reload, togglePending],
  );

  const retry = useCallback(
    (id: string) => {
      const failure = failedById[id];
      if (failure) void setFeedbackStatus(id, failure.status);
    },
    [failedById, setFeedbackStatus],
  );

  const dismissFailure = useCallback((id: string) => {
    setFailedById(({ [id]: _dropped, ...rest }) => rest);
  }, []);

  return {
    search,
    setSearch,
    status,
    setStatus,
    items,
    total,
    page,
    pageCount,
    goToPage,
    isLoading,
    listError,
    reload,
    pendingIds,
    failedById,
    setFeedbackStatus: (id, status) => void setFeedbackStatus(id, status),
    retry,
    dismissFailure,
  };
}
