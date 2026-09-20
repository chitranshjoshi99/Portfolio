/**
 * Plain assertions, no framework — run with
 * `node src/projects/feature-flag-sdk/utils/flag-client.check.ts`.
 * Time and the network are both injected, so nothing here sleeps.
 */
import assert from 'node:assert/strict';
import type { FlagMap } from '../feature-flag-sdk.types.ts';
import { FlagClient } from './flag-client.ts';

/** A fetcher whose responses we resolve by hand. */
function controlledServer() {
  const pending: { resolve: (flags: FlagMap) => void; reject: (error: Error) => void }[] = [];
  let calls = 0;
  return {
    fetchFlags: () =>
      new Promise<FlagMap>((resolve, reject) => {
        calls += 1;
        pending.push({ resolve, reject });
      }),
    respond: (flags: FlagMap) => pending.shift()?.resolve(flags),
    fail: () => pending.shift()?.reject(new Error('503')),
    get calls() {
      return calls;
    },
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

let clock = 1_000;
const now = () => clock;

// --- 1. ten concurrent reads before the first response = ONE request ----------------------
{
  const server = controlledServer();
  const client = new FlagClient({ fetchFlags: server.fetchFlags, ttlMs: 5_000, now });
  const reads = Array.from({ length: 10 }, () => client.getFeatureState('new-editor'));
  assert.equal(server.calls, 1, 'dedupe: one request for ten callers');
  assert.equal(client.stats.deduped, 9);
  server.respond({ 'new-editor': true });
  assert.deepEqual(await Promise.all(reads), Array(10).fill(true));

  // --- 2. inside the TTL: cache hit, no request
  assert.equal(await client.getFeatureState('new-editor'), true);
  assert.equal(server.calls, 1);
  assert.ok(client.stats.hits >= 1);

  // --- 3. unknown flag (typo) -> the caller's default, no request
  assert.equal(await client.getFeatureState('new-edtior', false), false);
  assert.equal(await client.getFeatureState('new-edtior', true), true);
  assert.equal(server.calls, 1);

  // --- 4. past the TTL: stale value NOW, one background request, subscriber told about the change
  const changes: string[] = [];
  client.subscribe('new-editor', (next, previous) => changes.push(`${previous}->${next}`));
  clock += 6_000;
  assert.equal(await client.getFeatureState('new-editor'), true, 'stale value served immediately');
  assert.equal(server.calls, 2, 'background refresh started');
  server.respond({ 'new-editor': false });
  await flush();
  assert.deepEqual(changes, ['true->false']);
  assert.equal(await client.getFeatureState('new-editor'), false, 'fresh value after refresh');

  // --- 5. overrides beat the server, and clearing one restores the server value
  client.setOverride('new-editor', true);
  assert.equal(await client.getFeatureState('new-editor'), true);
  assert.deepEqual(changes, ['true->false', 'false->true']);
  client.setOverride('new-editor', null);
  assert.equal(client.peek('new-editor'), false);

  // --- 6. a server change hidden by an override does NOT notify (effective value unchanged)
  client.setOverride('new-editor', true);
  const before = changes.length;
  clock += 6_000;
  await client.getFeatureState('other');
  server.respond({ 'new-editor': true, other: true });
  await flush();
  // new-editor server value flipped false -> true, but the override already said true
  assert.equal(changes.length, before, 'no change reported — the effective value never moved');
}

// --- 7. first request fails: default returned, failure NOT cached, next read retries -------
{
  const server = controlledServer();
  const client = new FlagClient({ fetchFlags: server.fetchFlags, ttlMs: 5_000, now });
  const first = client.getFeatureState('beta', true);
  server.fail();
  assert.equal(await first, true, 'default on failure, never a rejection');
  assert.equal(client.getSnapshot().status, 'error');
  const second = client.getFeatureState('beta', true);
  assert.equal(server.calls, 2, 'retried — the failed promise was not cached');
  server.respond({ beta: false });
  assert.equal(await second, false);
  assert.equal(client.stats.failures, 1);
}

// --- 8. persisted snapshot: first read answers without waiting, then revalidates ----------
{
  const storage = memoryStorage({ ff: JSON.stringify({ flags: { beta: true }, fetchedAt: 0 }) });
  const server = controlledServer();
  const client = new FlagClient({ fetchFlags: server.fetchFlags, ttlMs: 5_000, now, storage, storageKey: 'ff' });
  assert.equal(client.getSnapshot().status, 'ready', 'hydrated before any request');
  assert.equal(await client.getFeatureState('beta'), true, 'answered from storage');
  assert.equal(server.calls, 1, 'but refreshed because it is stale');
  server.respond({ beta: false });
  await flush();
  assert.equal(JSON.parse(storage.data.get('ff') ?? '{}').flags.beta, false, 'new values persisted');

  // corrupt storage is a miss, not a crash
  const broken = new FlagClient({
    fetchFlags: server.fetchFlags,
    ttlMs: 5_000,
    now,
    storage: memoryStorage({ ff: '{not json' }),
    storageKey: 'ff',
  });
  assert.equal(broken.getSnapshot().flags, null);
}

// --- 9. a failed background refresh keeps serving the last good values --------------------
{
  const server = controlledServer();
  const client = new FlagClient({ fetchFlags: server.fetchFlags, ttlMs: 1_000, now });
  const first = client.getFeatureState('x');
  server.respond({ x: true });
  await first;
  clock += 2_000;
  assert.equal(await client.getFeatureState('x'), true);
  server.fail();
  await flush();
  assert.equal(client.getSnapshot().status, 'ready');
  assert.equal(await client.getFeatureState('x'), true);
}

console.log('flag-client: all checks passed');
