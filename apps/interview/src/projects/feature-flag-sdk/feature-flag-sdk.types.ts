export type FlagMap = Record<string, boolean>;

export type FlagStatus = 'idle' | 'loading' | 'ready' | 'error';

/** What React reads. Replaced (never mutated) on every change, so useSyncExternalStore can compare by reference. */
export interface FlagSnapshot {
  /** Server values as last fetched, or null before the first successful load. */
  flags: FlagMap | null;
  overrides: FlagMap;
  fetchedAt: number | null;
  status: FlagStatus;
}

export interface FlagStats {
  requests: number;
  deduped: number;
  hits: number;
  failures: number;
  lastLatencyMs: number | null;
}

export type FlagEventType = 'request' | 'dedupe' | 'hit' | 'stale' | 'change' | 'failure' | 'unknown' | 'override';

export interface FlagEvent {
  type: FlagEventType;
  detail: string;
  at: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FlagClientOptions {
  fetchFlags: () => Promise<FlagMap>;
  /** Cache is fresh for this long; after it, reads serve the stale value and refresh in the background. */
  ttlMs: number;
  now?: () => number;
  storage?: KeyValueStorage | null;
  storageKey?: string;
}
