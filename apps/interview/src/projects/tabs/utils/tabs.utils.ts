import type { TabDefinition } from '../tabs.types';

/**
 * Where an arrow key goes. Wraps at both ends and skips disabled tabs.
 * Returns the current id when there is nowhere else to go.
 */
export function nextTabId(tabs: TabDefinition[], currentId: string, key: string): string {
  const enabled = tabs.filter((tab) => !tab.disabled);
  if (enabled.length === 0) return currentId;
  const at = enabled.findIndex((tab) => tab.id === currentId);
  switch (key) {
    case 'ArrowRight':
      return enabled[(at + 1) % enabled.length].id;
    case 'ArrowLeft':
      // at === -1 (current is disabled/unknown) → last; + length because JS % goes negative
      return enabled[(at - 1 + enabled.length) % enabled.length].id;
    case 'Home':
      return enabled[0].id;
    case 'End':
      return enabled[enabled.length - 1].id;
    default:
      return currentId;
  }
}

/** The tab to show for a URL. Unknown or disabled values fall back — a bad link must still render. */
export function tabFromSearch(search: string, param: string, tabs: TabDefinition[], fallback: string): string {
  const value = new URLSearchParams(search).get(param);
  const match = tabs.find((tab) => tab.id === value && !tab.disabled);
  return match ? match.id : fallback;
}

/** Same query string with only our param changed — other params (filters, ids) survive. */
export function searchWithTab(search: string, param: string, id: string): string {
  const params = new URLSearchParams(search);
  params.set(param, id);
  return `?${params.toString()}`;
}

/**
 * Promise cache keyed by tab id: one request per tab no matter how often it is shown, concurrent
 * callers share it, failures are dropped so a retry refetches.
 * ponytail: same promise-memo as the feature-flag SDK, duplicated because projects stand alone.
 */
export function createLoaderCache<T>(load: (id: string) => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  /** Settled values, readable synchronously — a remounted panel renders data on its first frame. */
  const values = new Map<string, T>();
  return {
    get(id: string): Promise<T> {
      const hit = cache.get(id);
      if (hit) return hit;
      const pending = load(id).then(
        (value) => {
          values.set(id, value);
          return value;
        },
        (error: unknown) => {
          cache.delete(id);
          throw error;
        },
      );
      cache.set(id, pending);
      return pending;
    },
    peek: (id: string): T | undefined => values.get(id),
    has: (id: string) => cache.has(id),
    clear: () => {
      cache.clear();
      values.clear();
    },
  };
}
