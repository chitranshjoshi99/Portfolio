/**
 * Plain assertions — run with `node src/projects/perf-benchmark/utils/benchmark.check.ts`.
 * A fake clock that the measured functions advance themselves makes every number exact.
 */
import assert from 'node:assert/strict';
import { compare, measure } from './benchmark.ts';
import { formatDuration, mean, percentile, stdDev, summarize } from './stats.utils.ts';

// --- stats --------------------------------------------------------------------------------

assert.equal(mean([1, 2, 3, 4]), 2.5);
assert.equal(mean([]), 0);
assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
assert.equal(percentile([1, 2, 3, 4], 50), 2.5, 'interpolates between the middle two');
assert.equal(percentile([10, 20], 95), 19.5);
assert.equal(percentile([], 50), 0);
assert.equal(stdDev([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4), '2.1381');
const s = summarize([5, 1, 100, 2, 3]);
assert.equal(s.median, 3, 'median ignores the 100 ms outlier');
assert.equal(s.mean, 22.2, 'the mean does not');
assert.equal(s.min, 1);
assert.equal(s.max, 100);
assert.equal(formatDuration(12.345), '12.35 ms');
assert.equal(formatDuration(0.0042), '4.20 µs');
assert.equal(formatDuration(0.00005), '50 ns');

// --- measure: fake clock ------------------------------------------------------------------

let clock = 0;
const now = () => clock;
const noYield = () => Promise.resolve();
const opts = { now, yieldBetween: noYield, samples: 10, warmup: 3, minSampleMs: 5 };

// a 1 µs function: calibration must batch it so each sample spans ≥ 5 ms
const fast = await measure('fast', () => {
  clock += 0.001;
  return 1;
}, opts);
assert.equal(fast.isAsync, false);
assert.ok(fast.iterationsPerSample >= 5000, `calibrated to ${fast.iterationsPerSample} iterations`);
assert.ok(Math.abs(fast.median - 0.001) < 1e-9, 'per-call time recovered exactly');
assert.equal(Math.round(fast.opsPerSec), 1_000_000);

// a slow sync function needs no batching
const slow = await measure('slow', () => {
  clock += 20;
}, opts);
assert.equal(slow.iterationsPerSample, 1);
assert.equal(slow.median, 20);

// async: detected from the returned promise, each call awaited, one call per sample
let calls = 0;
const asyncResult = await measure('async', async () => {
  calls += 1;
  clock += 7;
  return 'ok';
}, opts);
assert.equal(asyncResult.isAsync, true);
assert.equal(asyncResult.iterationsPerSample, 1, '7 ms per call already exceeds the 5 ms sample floor');
assert.equal(asyncResult.median, 7);
assert.equal(calls, 1 + 2 + 1 + 10, 'probe + remaining warmup + one calibration batch + samples');

// a microtask-fast async function is calibrated like a fast sync one
const quickAsync = await measure('quick async', async () => {
  clock += 0.002;
}, opts);
assert.ok(quickAsync.iterationsPerSample >= 2500, `async calibrated to ${quickAsync.iterationsPerSample}`);
assert.ok(Math.abs(quickAsync.median - 0.002) < 1e-9);

// variable durations: median and p95 come from the samples, not the mean
const pattern = [1, 1, 1, 1, 1, 1, 1, 1, 1, 50];
let i = 0;
const noisy = await measure('noisy', async () => {
  clock += pattern[i % pattern.length];
  i += 1;
}, { ...opts, warmup: 1, samples: 10, minSampleMs: 0 });
assert.equal(noisy.median, 1);
assert.ok(noisy.mean > noisy.median, 'the outlier drags the mean, not the median');

// errors become results, never exceptions
const broken = await measure('broken', () => {
  throw new Error('boom');
}, opts);
assert.equal(broken.error, 'boom');
const rejected = await measure('rejected', () => Promise.reject(new Error('nope')), opts);
assert.equal(rejected.error, 'nope');

// --- compare: ranked by median, errors last, results streamed ------------------------------

const streamed: string[] = [];
const ranked = await compare(
  [
    { name: 'b', fn: () => void (clock += 3) },
    { name: 'err', fn: () => { throw new Error('x'); } },
    { name: 'a', fn: () => void (clock += 1) },
  ],
  { ...opts, minSampleMs: 0 },
  (result) => streamed.push(result.name),
);
assert.deepEqual(streamed, ['b', 'err', 'a'], 'streamed in run order');
assert.deepEqual(ranked.map((r) => r.name), ['a', 'b', 'err'], 'ranked fastest first, errors last');

console.log('benchmark: all checks passed');
