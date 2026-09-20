import type {
  AnalyticsEvent,
  AnalyticsLogEntry,
  AnalyticsOptions,
  AnalyticsStats,
  Batch,
  FlushReason,
  Scheduler,
} from '../analytics-sdk.types';
// .ts extension: this file is also run directly by node in the check script
import { backoffDelay, chunkByJsonSize, dropOverflow } from './analytics.utils.ts';

const BEACON_CHUNK_CHARS = 60_000;

const browserScheduler: Scheduler = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (handle) => window.clearTimeout(handle),
};

export interface AnalyticsSnapshot {
  queue: AnalyticsEvent[];
  inFlight: Batch | null;
  retry: { batch: Batch; delayMs: number } | null;
  stats: AnalyticsStats;
}

/**
 * Collects events from anywhere in the app and ships them in batches.
 *   flush when: the queue reaches maxBatchSize · the interval timer fires · the page is hidden
 *   one batch in flight at a time; a failed batch is retried with backoff BEFORE newer events
 *   past maxAttempts the batch is dropped (analytics must never block the product)
 *   on page hide: everything left goes via sendBeacon; if the browser refuses, it is persisted
 */
export class AnalyticsClient {
  private readonly options: Required<Omit<AnalyticsOptions, 'beacon' | 'storage'>> &
    Pick<AnalyticsOptions, 'beacon' | 'storage'>;
  private queue: AnalyticsEvent[] = [];
  private inFlight: Batch | null = null;
  private retry: { batch: Batch; delayMs: number; handle: number } | null = null;
  private timer: number | null = null;
  private nextBatchId = 1;
  private sequence = 0;
  private readonly listeners = new Set<() => void>();
  private readonly logListeners = new Set<(entry: AnalyticsLogEntry) => void>();
  private snapshot: AnalyticsSnapshot;

  stats: AnalyticsStats = { tracked: 0, sent: 0, batchesSent: 0, failures: 0, dropped: 0, beaconed: 0 };

  constructor(options: AnalyticsOptions) {
    this.options = {
      now: () => Date.now(),
      scheduler: browserScheduler,
      storageKey: 'analytics:unsent',
      ...options,
    };
    this.snapshot = this.buildSnapshot();
    this.restore();
  }

  track(name: string, props: AnalyticsEvent['props'] = {}): void {
    const ts = this.options.now();
    this.sequence += 1;
    this.queue.push({ id: `${ts.toString(36)}-${this.sequence}`, name, props, ts });
    this.stats.tracked += 1;

    const { kept, dropped } = dropOverflow(this.queue, this.options.maxQueueSize);
    if (dropped) {
      this.queue = kept;
      this.stats.dropped += dropped;
      this.log('dropped', `queue full — dropped ${dropped} oldest`);
    }

    if (this.queue.length >= this.options.maxBatchSize) void this.flush('size');
    else this.ensureTimer();
    this.changed();
  }

  /** Send the next batch now, if nothing is in flight or waiting to retry. */
  async flush(reason: FlushReason = 'manual'): Promise<void> {
    if (this.inFlight || this.retry || this.queue.length === 0) return;
    this.clearTimer();
    const batch: Batch = {
      id: this.nextBatchId++,
      events: this.queue.splice(0, this.options.maxBatchSize),
      attempt: 1,
      reason,
    };
    await this.send(batch);
  }

  /** pagehide / visibilitychange→hidden. Synchronous on purpose: the page may be gone after this returns. */
  flushOnUnload(): void {
    // In-flight events are included too: at-least-once. The server dedupes on event id.
    const events = [...(this.retry?.batch.events ?? []), ...(this.inFlight?.events ?? []), ...this.queue];
    this.clearTimer();
    if (this.retry) this.options.scheduler.clear(this.retry.handle);
    this.retry = null;
    this.inFlight = null; // its response, if it ever lands, is ignored — the beacon carries these events
    this.queue = [];
    if (events.length === 0) return this.changed();

    const chunks = chunkByJsonSize(events, BEACON_CHUNK_CHARS);
    const unsent: AnalyticsEvent[] = [];
    for (const chunk of chunks) {
      if (unsent.length === 0 && this.options.beacon?.(chunk)) {
        this.stats.beaconed += chunk.length;
      } else {
        unsent.push(...chunk); // once one beacon is refused, keep order: persist the rest
      }
    }
    if (chunks.length > 0 && unsent.length < events.length) {
      this.log('beacon', `sendBeacon ${events.length - unsent.length} events`);
    }
    if (unsent.length) this.persist(unsent);
    this.changed();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AnalyticsSnapshot => this.snapshot;

  onLog(listener: (entry: AnalyticsLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  /** Stop timers — for tests and for replacing the instance. Unsent events stay queued in memory. */
  dispose(): void {
    this.clearTimer();
    if (this.retry) this.options.scheduler.clear(this.retry.handle);
    this.retry = null;
    this.listeners.clear();
    this.logListeners.clear();
  }

  // --- internals ------------------------------------------------------------------------------

  private async send(batch: Batch): Promise<void> {
    this.inFlight = batch;
    this.changed();
    try {
      await this.options.transport(batch);
      if (this.inFlight !== batch) return; // flushed on unload meanwhile; the beacon already carried it
      this.inFlight = null;
      this.stats.sent += batch.events.length;
      this.stats.batchesSent += 1;
      this.log('sent', `batch #${batch.id} · ${batch.events.length} events · ${batch.reason}`);
      this.changed();
      // Keep draining: a full queue goes now, a partial one waits for the timer.
      if (this.queue.length >= this.options.maxBatchSize) void this.flush('size');
      else this.ensureTimer();
    } catch {
      if (this.inFlight !== batch) return;
      this.inFlight = null;
      this.stats.failures += 1;
      if (batch.attempt >= this.options.maxAttempts) {
        this.stats.dropped += batch.events.length;
        this.log('dropped', `batch #${batch.id} gave up after ${batch.attempt} attempts`);
        this.ensureTimer();
      } else {
        const delayMs = backoffDelay(this.options.backoffBaseMs, batch.attempt);
        const next: Batch = { ...batch, attempt: batch.attempt + 1, reason: 'retry' };
        const handle = this.options.scheduler.set(() => {
          this.retry = null;
          void this.send(next);
        }, delayMs);
        this.retry = { batch: next, delayMs, handle };
        this.log('failed', `batch #${batch.id} attempt ${batch.attempt} failed — retry in ${delayMs} ms`);
      }
      this.changed();
    }
  }

  /** One-shot timer, re-armed only while there is something to send — an idle page runs no timers. */
  private ensureTimer(): void {
    if (this.timer !== null || this.queue.length === 0 || this.inFlight || this.retry) return;
    this.timer = this.options.scheduler.set(() => {
      this.timer = null;
      void this.flush('interval');
    }, this.options.flushIntervalMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.options.scheduler.clear(this.timer);
    this.timer = null;
  }

  private persist(events: AnalyticsEvent[]): void {
    try {
      this.options.storage?.setItem(this.options.storageKey, JSON.stringify(events));
    } catch {
      this.stats.dropped += events.length; // nowhere left to put them
    }
  }

  private restore(): void {
    try {
      const raw = this.options.storage?.getItem(this.options.storageKey);
      if (!raw) return;
      this.options.storage?.removeItem(this.options.storageKey);
      const events = JSON.parse(raw) as AnalyticsEvent[];
      if (!Array.isArray(events) || events.length === 0) return;
      this.queue = [...events, ...this.queue];
      this.log('restored', `restored ${events.length} events from the last session`);
      this.ensureTimer();
      this.changed();
    } catch {
      /* corrupt storage: nothing to restore */
    }
  }

  private buildSnapshot(): AnalyticsSnapshot {
    return {
      queue: [...this.queue],
      inFlight: this.inFlight,
      retry: this.retry ? { batch: this.retry.batch, delayMs: this.retry.delayMs } : null,
      stats: { ...this.stats },
    };
  }

  private changed(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private log(kind: AnalyticsLogEntry['kind'], detail: string): void {
    const entry = { at: this.options.now(), kind, detail };
    this.logListeners.forEach((listener) => listener(entry));
  }
}

/** Page lifecycle wiring. pagehide + visibilitychange — NOT unload/beforeunload (unreliable, break bfcache). */
export function attachPageLifecycle(client: AnalyticsClient): () => void {
  const onHidden = () => {
    if (document.visibilityState === 'hidden') client.flushOnUnload();
  };
  const onPageHide = () => client.flushOnUnload();
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', onPageHide);
  };
}
