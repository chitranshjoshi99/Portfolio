export interface AnalyticsEvent {
  /** Client-generated, so the server can drop duplicates when a retried batch did land the first time. */
  id: string;
  name: string;
  props: Record<string, string | number | boolean>;
  ts: number;
}

export type FlushReason = 'size' | 'interval' | 'manual' | 'retry' | 'unload';

export interface Batch {
  id: number;
  events: AnalyticsEvent[];
  attempt: number;
  reason: FlushReason;
}

export interface AnalyticsStats {
  tracked: number;
  sent: number;
  batchesSent: number;
  failures: number;
  dropped: number;
  beaconed: number;
}

export interface Scheduler {
  set(fn: () => void, ms: number): number;
  clear(handle: number): void;
}

export interface AnalyticsOptions {
  /** POST the batch; reject on failure. */
  transport: (batch: Batch) => Promise<void>;
  /** navigator.sendBeacon-shaped: fire-and-forget, returns false if the browser refused it. */
  beacon?: (events: AnalyticsEvent[]) => boolean;
  maxBatchSize: number;
  flushIntervalMs: number;
  /** Oldest events are dropped past this — a dead endpoint must not eat all the memory. */
  maxQueueSize: number;
  maxAttempts: number;
  backoffBaseMs: number;
  now?: () => number;
  scheduler?: Scheduler;
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null;
  storageKey?: string;
}

export type AnalyticsLogEntry = { at: number; kind: 'sent' | 'failed' | 'dropped' | 'beacon' | 'restored'; detail: string };
