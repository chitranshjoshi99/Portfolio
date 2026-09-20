import { useEffect, useSyncExternalStore } from 'react';
import { flagClient } from '../utils/flag-singleton';

export interface UseFeatureFlag {
  enabled: boolean;
  /** True only before the very first value exists — cached/stale values never show a spinner. */
  isLoading: boolean;
}

/**
 * The React face of the SDK. useSyncExternalStore, not useState + effect: every component on the
 * page reads the same snapshot in the same render, so two components can never disagree about a flag
 * mid-update (no tearing).
 */
export function useFeatureFlag(name: string, defaultValue = false): UseFeatureFlag {
  const snapshot = useSyncExternalStore(flagClient.subscribeStore, flagClient.getSnapshot);

  // Reading is what triggers load / revalidate. The SDK dedupes, so N components = 1 request.
  useEffect(() => {
    void flagClient.getFeatureState(name, defaultValue);
  }, [name, defaultValue]);

  const enabled =
    name in snapshot.overrides
      ? snapshot.overrides[name]
      : snapshot.flags && name in snapshot.flags
        ? snapshot.flags[name]
        : defaultValue;

  return { enabled, isLoading: snapshot.flags === null && snapshot.status !== 'error' };
}
