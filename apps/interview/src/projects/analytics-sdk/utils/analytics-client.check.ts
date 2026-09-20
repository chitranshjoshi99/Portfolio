/**
 * Plain assertions — run with `node src/projects/analytics-sdk/utils/analytics-client.check.ts`.
 * Time and the network are injected: a manual scheduler and a transport we settle by hand.
 */
import assert from 'node:assert/strict';
import type { AnalyticsEvent, Batch, Scheduler } from '../analytics-sdk.types.ts';
import { AnalyticsClient } from './analytics-client.ts';
import { backoffDelay, chunkByJsonSize, dropOverflow } from './analytics.utils.ts';

function manualClock() {
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  const scheduler: Scheduler = {
    set(fn, ms) {
      nextId += 1;
      tasks.set(nextId, { at: now + ms, fn });
      return nextId;
    },
    clear(handle) {
      tasks.delete(handle);
    },
  };
  return {
    scheduler,
    now: () => now,
    pending: () => tasks.size,
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...tasks.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        tasks.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
  };
}

function controlledTransport() {
  const sent: Batch[] = [];
  const pending: { resolve: () => void; reject: (e: Error) => void }[] = [];
  return {
    sent,
    transport: (batch: Batch) =>
      new Promise<void>((resolve, reject) => {
        sent.push(batch);
        pending.push({ resolve, reject });
      }),
    ok: () => pending.shift()?.resolve(),
    fail: () => pending.shift()?.reject(new Error('503')),
    open: () => pending.length,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const base = { maxBatchSize: 10, flushIntervalMs: 5_000, maxQueueSize: 1_000, maxAttempts: 3, backoffBaseMs: 1_000 };

// --- 1. size + interval batching, one in flight, drain in order ------------------------------
{
  const clock = manualClock();
  const net = controlledTransport();
  const a = new AnalyticsClient({ ...base, transport: net.transport, scheduler: clock.scheduler, now: clock.now });
  for (let i = 0; i < 25; i += 1) a.track('click', { i });
  assert.equal(net.sent.length, 1, 'size flush at 10, then blocked by the one in flight');
  assert.equal(net.sent[0].events.length, 10);
  assert.equal(net.sent[0].reason, 'size');
  net.ok();
  await flush();
  assert.equal(net.sent.length, 2, 'queue still ≥ 10 → drains immediately');
  net.ok();
  await flush();
  assert.equal(net.sent.length, 2, 'the last 5 wait for the timer');
  clock.advance(5_000);
  assert.equal(net.sent.length, 3);
  assert.equal(net.sent[2].reason, 'interval');
  assert.equal(net.sent[2].events.length, 5);
  net.ok();
  await flush();
  assert.deepEqual(
    net.sent.flatMap((b) => b.events.map((e) => e.props.i)),
    Array.from({ length: 25 }, (_, i) => i),
    'every event, once, in order',
  );
  assert.equal(clock.pending(), 0, 'an idle client leaves no timer running');
  assert.equal(a.stats.sent, 25);
}

// --- 2. failure → backoff retry BEFORE newer events --------------------------------------------
{
  const clock = manualClock();
  const net = controlledTransport();
  const a = new AnalyticsClient({ ...base, transport: net.transport, scheduler: clock.scheduler, now: clock.now });
  for (let i = 0; i < 10; i += 1) a.track('view', { i });
  net.fail();
  await flush();
  for (let i = 10; i < 20; i += 1) a.track('view', { i });
  assert.equal(net.sent.length, 1, 'no new batch while a retry is pending');
  clock.advance(999);
  assert.equal(net.sent.length, 1);
  clock.advance(1);
  assert.equal(net.sent.length, 2, 'retry after 1s backoff');
  assert.equal(net.sent[1].attempt, 2);
  assert.equal(net.sent[1].events[0].props.i, 0, 'the failed batch goes first');
  net.ok();
  await flush();
  assert.equal(net.sent[2].events[0].props.i, 10, 'then the newer events');
  assert.equal(a.stats.failures, 1);
}

// --- 3. max attempts → dropped, pipeline continues ---------------------------------------------
{
  const clock = manualClock();
  const net = controlledTransport();
  const a = new AnalyticsClient({ ...base, transport: net.transport, scheduler: clock.scheduler, now: clock.now });
  for (let i = 0; i < 10; i += 1) a.track('x');
  net.fail();
  await flush();
  clock.advance(1_000);
  net.fail();
  await flush();
  clock.advance(2_000);
  net.fail();
  await flush();
  assert.equal(a.stats.dropped, 10, 'gave up after 3 attempts');
  assert.equal(net.sent.length, 3);
  a.track('after');
  clock.advance(5_000);
  assert.equal(net.sent.length, 4, 'new events still flow');
}

// --- 4. bounded queue drops the oldest ------------------------------------------------------
{
  const clock = manualClock();
  const net = controlledTransport();
  const a = new AnalyticsClient({ ...base, maxBatchSize: 100, maxQueueSize: 5, transport: net.transport, scheduler: clock.scheduler, now: clock.now });
  for (let i = 0; i < 8; i += 1) a.track('e', { i });
  assert.equal(a.stats.dropped, 3);
  assert.deepEqual(a.getSnapshot().queue.map((e) => e.props.i), [3, 4, 5, 6, 7]);
}

// --- 5. page hide: beacon everything (retry + in flight + queue); refused → persisted → restored
{
  const clock = manualClock();
  const net = controlledTransport();
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const beaconed: AnalyticsEvent[][] = [];
  let beaconWorks = true;
  const a = new AnalyticsClient({
    ...base,
    transport: net.transport,
    scheduler: clock.scheduler,
    now: clock.now,
    storage,
    beacon: (events) => {
      if (!beaconWorks) return false;
      beaconed.push(events);
      return true;
    },
  });
  for (let i = 0; i < 12; i += 1) a.track('e', { i }); // 10 in flight, 2 queued
  a.flushOnUnload();
  assert.equal(beaconed.flat().length, 12, 'in-flight and queued events all go by beacon');
  assert.equal(clock.pending(), 0, 'timers cleared');
  net.ok();
  await flush();
  assert.equal(a.stats.sent, 0, 'a late response for a beaconed batch is ignored');

  beaconWorks = false;
  for (let i = 0; i < 3; i += 1) a.track('late', { i });
  a.flushOnUnload();
  assert.ok(store.has('analytics:unsent'), 'refused beacon → persisted');

  const next = new AnalyticsClient({ ...base, transport: net.transport, scheduler: clock.scheduler, now: clock.now, storage });
  assert.equal(next.getSnapshot().queue.length, 3, 'restored on the next page load');
  assert.equal(store.has('analytics:unsent'), false, 'and removed from storage');
}

// --- pure helpers -------------------------------------------------------------------------

assert.deepEqual([1, 2, 3, 4, 5].map((n) => backoffDelay(1_000, n)), [1_000, 2_000, 4_000, 8_000, 16_000]);
assert.equal(backoffDelay(1_000, 20), 30_000, 'capped');
assert.deepEqual(dropOverflow([1, 2, 3], 5), { kept: [1, 2, 3], dropped: 0 });
assert.deepEqual(dropOverflow([1, 2, 3, 4], 2), { kept: [3, 4], dropped: 2 });
const big = Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, name: 'n', props: { pad: 'x'.repeat(100) }, ts: i }));
const chunks = chunkByJsonSize(big, 1_000);
assert.ok(chunks.length > 1);
assert.deepEqual(chunks.flat(), big, 'chunking keeps every event, in order');
assert.ok(chunks.every((c) => JSON.stringify(c).length <= 1_000 || c.length === 1));

console.log('analytics-client: all checks passed');
