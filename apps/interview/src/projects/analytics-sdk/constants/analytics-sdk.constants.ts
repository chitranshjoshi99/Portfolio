export const DEFAULT_CONFIG = {
  maxBatchSize: 10,
  flushIntervalMs: 5_000,
  maxQueueSize: 200,
  maxAttempts: 3,
  backoffBaseMs: 1_000,
};

export const BATCH_SIZE_OPTIONS = [5, 10, 20];
export const INTERVAL_OPTIONS = [2_000, 5_000, 10_000];
export const COLLECTOR_LATENCY_MS = 500;
export const LOG_LIMIT = 16;
export const BURST_SIZE = 25;

export const SAMPLE_EVENTS: { name: string; props: Record<string, string | number | boolean> }[] = [
  { name: 'page_view', props: { path: '/jira/board' } },
  { name: 'issue_opened', props: { key: 'CONF-4121' } },
  { name: 'button_click', props: { id: 'create-issue' } },
  { name: 'search', props: { q: 'velocity', results: 12 } },
];

export type CollectorMode = 'healthy' | 'flaky' | 'down';
