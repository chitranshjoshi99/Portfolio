import type { Benchable, MeasureOptions, MeasureResult } from '../perf-benchmark.types';
// .ts extension: this file is also run directly by node in the check script
import { errorMessage, summarize } from './stats.utils.ts';

/**
 * Results are written here so the engine cannot prove the call is unused and skip it
 * (dead-code elimination would make a pure function look infinitely fast).
 */
export let sink: unknown;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';

const defaultNow = () => performance.now();
/** A macrotask, not a microtask: lets the browser paint and handle input between samples. */
const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Time one function.
 *  1. probe once — a returned promise means async; its rejection/throw becomes the error, not a crash
 *  2. warm up (untimed) so the JIT has optimised the hot path
 *  3. calibrate — double the iterations until one batch ≥ minSampleMs, because a 50 ns function (or
 *     an already-resolved promise) is far below performance.now()'s resolution (5 µs–100 µs, by design)
 *  4. take `samples` timed batches, each divided by its iteration count
 *  5. summarise with median/p95 — the mean is dragged by GC pauses and scheduler noise
 */
export async function measure(name: string, fn: Benchable, options: MeasureOptions = {}): Promise<MeasureResult> {
  const {
    samples = 20,
    warmup = 5,
    minSampleMs = 5,
    maxIterations = 1_000_000,
    now = defaultNow,
    yieldBetween = defaultYield,
  } = options;

  try {
    const probe = fn();
    const isAsync = isThenable(probe);
    if (isAsync) sink = await probe;

    // Warm-up (the probe counts as the first run).
    for (let i = 1; i < warmup; i += 1) sink = isAsync ? await fn() : fn();

    /** Time `count` back-to-back calls. Async calls are awaited one after another: latency, not throughput. */
    const timeBatch = async (count: number): Promise<number> => {
      const start = now();
      if (isAsync) for (let i = 0; i < count; i += 1) sink = await fn();
      else for (let i = 0; i < count; i += 1) sink = fn();
      return now() - start;
    };

    // Calibrate: an `await Promise.resolve()` is as far below timer resolution as a 50 ns loop.
    let iterations = 1;
    while ((await timeBatch(iterations)) < minSampleMs && iterations < maxIterations) {
      iterations = Math.min(maxIterations, iterations * 2);
    }

    const durations: number[] = [];
    for (let s = 0; s < samples; s += 1) {
      durations.push((await timeBatch(iterations)) / iterations);
      await yieldBetween();
    }

    const stats = summarize(durations);
    return {
      name,
      isAsync,
      samples,
      iterationsPerSample: iterations,
      opsPerSec: stats.median > 0 ? 1000 / stats.median : Number.POSITIVE_INFINITY,
      error: null,
      ...stats,
    };
  } catch (error) {
    return {
      name,
      isAsync: false,
      samples: 0,
      iterationsPerSample: 0,
      opsPerSec: 0,
      error: errorMessage(error),
      mean: 0,
      median: 0,
      p95: 0,
      min: 0,
      max: 0,
      stdDev: 0,
    };
  }
}

/**
 * Measure several candidates one after another and rank by median. Errors sort last.
 * `onResult` streams each result as it finishes, so a UI can show progress.
 */
export async function compare(
  candidates: { name: string; fn: Benchable }[],
  options: MeasureOptions = {},
  onResult?: (result: MeasureResult, index: number) => void,
): Promise<MeasureResult[]> {
  const results: MeasureResult[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const result = await measure(candidate.name, candidate.fn, options);
    results.push(result);
    onResult?.(result, index);
  }
  return results.sort((a, b) => Number(Boolean(a.error)) - Number(Boolean(b.error)) || a.median - b.median);
}

/** V0, kept only to show why it is wrong: millisecond resolution, one run, wall clock. */
export function timeOnceWithDateNow(fn: () => unknown): number {
  const start = Date.now();
  sink = fn();
  return Date.now() - start;
}
