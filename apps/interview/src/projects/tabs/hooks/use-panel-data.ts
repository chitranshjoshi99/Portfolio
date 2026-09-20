import { useCallback, useEffect, useState } from 'react';
import type { LoadStatus, PanelData } from '../tabs.types';
import { fetchPanel } from '../utils/panel-api';
import { createLoaderCache } from '../utils/tabs.utils';

/** Module scope: survives a panel unmounting, so keepMounted=false still never refetches a tab. */
export const panelCache = createLoaderCache(fetchPanel);

export interface UsePanelData {
  status: LoadStatus;
  data: PanelData | null;
  error: string | null;
  retry: () => void;
}

export function usePanelData(id: string, enabled: boolean): UsePanelData {
  const [state, setState] = useState<{ status: LoadStatus; data: PanelData | null; error: string | null }>(() => {
    const cached = panelCache.peek(id);
    return cached ? { status: 'ready', data: cached, error: null } : { status: 'idle', data: null, error: null };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true; // a response for a panel we've left must not write state
    setState((s) => ({ ...s, status: s.data ? 'ready' : 'loading', error: null }));
    panelCache
      .get(id)
      .then((data) => current && setState({ status: 'ready', data, error: null }))
      .catch((reason: unknown) =>
        current &&
        setState({ status: 'error', data: null, error: reason instanceof Error ? reason.message : 'Load failed' }),
      );
    return () => {
      current = false;
    };
  }, [attempt, enabled, id]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
