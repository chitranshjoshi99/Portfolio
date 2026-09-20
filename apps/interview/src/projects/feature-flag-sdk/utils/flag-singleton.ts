import { DEFAULT_LATENCY_MS, SERVER_SEED, STORAGE_KEY, TTL_MS } from '../constants/feature-flag-sdk.constants';
import { FlagClient } from './flag-client';
import { createFakeFlagServer, safeLocalStorage } from './fake-flag-server';

/**
 * ONE client per page. Module scope is the singleton: every import gets the same instance, so
 * ten components asking for flags share one cache and one request. No getInstance() ceremony.
 */
export const flagServer = createFakeFlagServer(SERVER_SEED, DEFAULT_LATENCY_MS);

export const flagClient = new FlagClient({
  fetchFlags: flagServer.fetchFlags,
  ttlMs: TTL_MS,
  storage: safeLocalStorage(),
  storageKey: STORAGE_KEY,
});
