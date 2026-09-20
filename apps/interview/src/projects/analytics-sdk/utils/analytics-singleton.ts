import type { AnalyticsEvent, AnalyticsOptions, Batch } from '../analytics-sdk.types';
import { COLLECTOR_LATENCY_MS, DEFAULT_CONFIG, type CollectorMode } from '../constants/analytics-sdk.constants';
import { AnalyticsClient } from './analytics-client';

/** Stand-in for POST /collect. `mode` is flipped from the demo UI. */
export const collector = {
  mode: 'healthy' as CollectorMode,
  batches: [] as Batch[],
  beaconEvents: 0,
};

const transport = (batch: Batch): Promise<void> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      const fails = collector.mode === 'down' || (collector.mode === 'flaky' && Math.random() < 0.5);
      if (fails) return reject(new Error('503'));
      collector.batches.push(batch);
      resolve();
    }, COLLECTOR_LATENCY_MS);
  });

/** navigator.sendBeacon stand-in: the browser queues it and returns immediately. Refused when "down". */
const beacon = (events: AnalyticsEvent[]): boolean => {
  if (collector.mode === 'down') return false;
  collector.beaconEvents += events.length;
  return true;
};

const safeStorage = () => {
  try {
    window.localStorage.setItem('__an_probe', '1');
    window.localStorage.removeItem('__an_probe');
    return window.localStorage;
  } catch {
    return null;
  }
};

export type AnalyticsConfig = Pick<AnalyticsOptions, 'maxBatchSize' | 'flushIntervalMs' | 'maxQueueSize' | 'maxAttempts' | 'backoffBaseMs'>;

/**
 * The singleton. `init` once at app start; everything else calls `getAnalytics()`.
 * Module scope already makes it one-per-page — init() exists so config is set in one place.
 */
let instance: AnalyticsClient | null = null;

export function initAnalytics(config: AnalyticsConfig = DEFAULT_CONFIG): AnalyticsClient {
  instance?.dispose();
  instance = new AnalyticsClient({ ...config, transport, beacon, storage: safeStorage(), storageKey: 'analytics-sdk:unsent' });
  return instance;
}

export function getAnalytics(): AnalyticsClient {
  return instance ?? initAnalytics();
}
