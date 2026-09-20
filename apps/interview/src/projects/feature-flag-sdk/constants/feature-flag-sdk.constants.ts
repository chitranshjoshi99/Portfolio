import type { FlagMap } from '../feature-flag-sdk.types';

/** What the fake server starts with. */
export const SERVER_SEED: FlagMap = {
  'new-editor': true,
  'dark-sidebar': false,
  'ai-summaries': true,
  'bulk-edit': false,
};

export const TTL_MS = 10_000;
export const STORAGE_KEY = 'ffsdk:v1';
export const LATENCY_OPTIONS = [200, 800, 2000];
export const DEFAULT_LATENCY_MS = 800;
export const CONCURRENT_CALLS = 10;
export const LOG_LIMIT = 14;

export const EVENT_LABEL: Record<string, string> = {
  request: 'request sent',
  dedupe: 'joined in-flight request',
  hit: 'cache hit',
  stale: 'served stale, refreshing',
  change: 'value changed',
  failure: 'request failed',
  unknown: 'unknown flag',
  override: 'override',
};
