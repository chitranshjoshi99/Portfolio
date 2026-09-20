import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CONCURRENCY, PAGE_SIZE } from '../constants/jobs';
import type { JobResult } from '../job-board.types';
import { apiStats, fetchJob, fetchJobIds, resetApiStats } from '../utils/jobs-api';
import { hasMore, mapWithConcurrency, pageSlice, uniqueIds } from '../utils/jobs.utils';

const message = (error: unknown): string => (error instanceof Error ? error.message : 'Request failed');
const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export function useJobBoard() {
  const [ids, setIds] = useState<number[]>([]);
  const [results, setResults] = useState<JobResult[]>([]);
  const [idsError, setIdsError] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState(true);
  const [loadingCount, setLoadingCount] = useState(0);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [stats, setStats] = useState({ ...apiStats });
  const [retrying, setRetrying] = useState<Set<number>>(new Set());

  /** One controller for the whole screen: unmounting cancels the page that is still arriving. */
  const abortRef = useRef<AbortController | null>(null);
  /** Load-more is guarded by a ref, not by state: two clicks in one tick see the same state. */
  const busyRef = useRef(false);
  const idsRef = useRef<number[]>([]);
  const loadedRef = useRef(0);
  /**
   * The pool size is read through a ref so `loadPage` has no dependencies. As a dependency it would
   * rebuild the callback, re-run the mount effect, and append page one a second time — which is
   * exactly what happened the first time this was wired up.
   */
  const concurrencyRef = useRef(concurrency);
  concurrencyRef.current = concurrency;

  const loadPage = useCallback(
    async (pageIds: number[], signal: AbortSignal) => {
      if (pageIds.length === 0) return;
      setLoadingCount(pageIds.length);
      apiStats.peakInFlight = 0; // per page, so changing the pool size is visible in the next load
      try {
        const page = await mapWithConcurrency(pageIds, concurrencyRef.current, async (id): Promise<JobResult> => {
          try {
            return { id, job: await fetchJob(id, signal) };
          } catch (error) {
            if (aborted(error)) throw error; // an abort cancels the page, it is not a per-row failure
            return { id, error: message(error) };
          }
        });
        if (signal.aborted) return;
        // Appended as one batch, in request order: rows never reshuffle as responses land. The id
        // filter makes a second append of the same page a no-op rather than a duplicated row.
        setResults((current) => {
          const seen = new Set(current.map((entry) => entry.id));
          return [...current, ...page.filter((entry) => !seen.has(entry.id))];
        });
        loadedRef.current += page.length;
      } catch (error) {
        if (!aborted(error)) setIdsError(message(error));
      } finally {
        if (!signal.aborted) {
          setLoadingCount(0);
          setStats({ ...apiStats });
        }
        busyRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    resetApiStats();
    busyRef.current = true;

    fetchJobIds(controller.signal)
      .then((all) => {
        const unique = uniqueIds(all);
        idsRef.current = unique;
        setIds(unique);
        setLoadingIds(false);
        return loadPage(pageSlice(unique, 0, PAGE_SIZE), controller.signal);
      })
      .catch((error: unknown) => {
        if (aborted(error)) return;
        setIdsError(message(error));
        setLoadingIds(false);
        busyRef.current = false;
      });

    return () => controller.abort();
  }, [loadPage]);

  const loadMore = useCallback(() => {
    // The guard that stops a double click loading the same six jobs twice.
    if (busyRef.current) return;
    const controller = abortRef.current;
    if (!controller || controller.signal.aborted) return;
    const page = Math.floor(loadedRef.current / PAGE_SIZE);
    const next = pageSlice(idsRef.current, page, PAGE_SIZE);
    if (next.length === 0) return;
    busyRef.current = true;
    void loadPage(next, controller.signal);
  }, [loadPage]);

  const retry = useCallback(async (id: number) => {
    setRetrying((current) => new Set(current).add(id));
    try {
      const job = await fetchJob(id, abortRef.current?.signal);
      // Replaced in place: a retried row keeps its position in the list.
      setResults((current) => current.map((entry) => (entry.id === id ? { id, job } : entry)));
    } catch (error) {
      if (!aborted(error)) {
        setResults((current) => current.map((entry) => (entry.id === id ? { id, error: message(error) } : entry)));
      }
    } finally {
      setRetrying((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setStats({ ...apiStats });
    }
  }, []);

  return {
    ids,
    results,
    idsError,
    loadingIds,
    loadingCount,
    isLoadingMore: loadingCount > 0 && results.length > 0,
    canLoadMore: hasMore(ids, results.length) && loadingCount === 0,
    remaining: Math.max(0, ids.length - results.length),
    concurrency,
    setConcurrency,
    stats,
    retrying,
    retry,
    loadMore,
  };
}
