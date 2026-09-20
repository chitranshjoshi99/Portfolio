# Performance Benchmark Utility — Interview Build Guide

Write `measure(fn)` that reports how long a function takes — sync **or** async — accurately enough to
compare candidates: the right clock, warm-up runs, repeated samples, batching for functions faster than the
timer can see, robust statistics (median, p95, standard deviation, ops/s), errors reported instead of thrown,
and a `compare()` that ranks several functions. Plain JavaScript, output logged. Target 45–60 minutes.

Reported at Atlassian as: *"Build a function to measure performance of a given function(s). I tried Date.now
and later realised about performance.now. Hint: run functions multiple times to get the average running time.
Also handle sync and async functions"* (Principal FE, JS coding round, 2025), *"Create a performance SDK
which measures the performance of a sync or async function when passed"* (P40/P50, 1st round), *"Write a
function that measures the performances of other functions"* (Glassdoor, JS round), and the Front End
Interview Handbook's Atlassian system-design entry *"Design a performance benchmarking utility"*. Also a
follow-up on the feature-flag question: *"how would you measure the performance?"*

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Clock | **`performance.now()`**, injected — monotonic, sub-millisecond. Never `Date.now()`. |
| Sync vs async | Call once; a returned thenable means async. Every later call is awaited, sequentially. |
| Accuracy | Warm-up (untimed) → **calibrate**: double iterations until one batch ≥ 5 ms → N samples of `batch / iterations`. |
| Statistics | **Median** as the headline, p95 for tail, mean ± sd for spread; ops/s from the median. |
| Robustness | A throwing or rejecting function yields a result with `error`, never an exception out of `compare`. |
| Discussed, not built | Interleaved round-robin sampling, statistical significance (Welch's t / Mann-Whitney), memory measurement, `performance.mark/measure`, running in a Worker. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: what "performance" means here, sync/async, output |
| 5–10 | HLD: probe → warm-up → calibrate → sample → summarise |
| 10–16 | V0 `Date.now` → V1 `performance.now` — show why V0 lies |
| 16–26 | **N runs + warm-up + calibration — the ladder** |
| 26–34 | **Async detection and timing** |
| 34–42 | Statistics: median/p95/sd |
| 42–50 | `compare()`, errors, ranking |
| 50–60 | Tests with a fake clock, cross-questions |

---

## 0. Sandbox setup

The round wants logged output. `index.js` with a `main()` that `console.table`s results is enough; the
repo page is a UI on the same functions.

```text
src/
  index.js      # measure, stats, compare, main()
```

Target split (this repo):

```text
perf-benchmark/
  index.tsx                              # suites, settings, results table
  perf-benchmark.types.ts                # Benchable, MeasureOptions, Stats, MeasureResult
  perf-benchmark.css
  constants/perf-benchmark.constants.ts  # candidate suites (sum, lookup, clone, async)
  utils/stats.utils.ts                   # pure: mean, percentile, stdDev, summarize, formatDuration
  utils/benchmark.ts                     # measure, compare, timeOnceWithDateNow (V0, for contrast)
  utils/benchmark.check.ts               # fake clock advanced BY the measured functions
  hooks/use-benchmark.ts                 # suite, settings, streaming results, run id
  components/results-table.tsx
```

---

## 1. Requirement gathering (5 minutes)

1. **"Wall time of one call, or a statistically useful number to compare implementations?"**
   The question behind the question. One call is a stopwatch; comparing needs repeats and statistics.
   *Default: comparable numbers — median of many samples.*
2. **"Sync functions only, or promises too?"**
   *Default: both; detect by the return value.*
3. **"For async — latency of one call, or throughput of many concurrent calls?"**
   Different measurements. *Default: latency — awaited one after another.*
4. **"How fast can the functions be?"**
   Sets up calibration: a 50 ns function is invisible to a timer with 5–100 µs resolution.
   *Default: anything from nanoseconds to seconds.*
5. **"What if the function throws?"** *Default: report the error for that candidate; keep going.*
6. **"Browser or Node?"** *Default: browser — `performance.now()`; Node has the same API.*
7. **"Should it block the page?"** *Default: yield between samples so the UI stays responsive.*

Plan:

> "Call the function once to find out whether it returns a promise. Warm it up untimed so the JIT settles.
> Then calibrate: keep doubling the number of back-to-back calls until one batch takes at least 5 ms, so
> the timer's resolution is irrelevant. Take N such batches with `performance.now()`, divide by the batch
> size, and report the median and p95 — the mean gets dragged by GC pauses. Errors become results."

---

## 2. High-level design (HLD)

```text
 measure(name, fn, { samples, warmup, minSampleMs, now, yieldBetween })
        │
        ├─ probe:   r = fn();  isAsync = typeof r?.then === 'function';  await r if async
        │           (a throw/reject here → { error })
        ├─ warm-up: warmup − 1 more untimed calls
        ├─ calibrate: k = 1; while (timeBatch(k) < minSampleMs) k *= 2         ← beats timer resolution
        ├─ sample:  repeat `samples` times: durations.push(timeBatch(k) / k); await yield
        └─ summarise: sort → median, p95, min, max, mean, stdDev → ops/s = 1000 / median

 timeBatch(k): t0 = now(); k × (isAsync ? await fn() : fn()); return now() − t0
               every result → `sink` (so the engine cannot optimise the call away)

 compare(candidates) → measure each in turn → stream each result → sort by median, errors last
```

Claims:

- **`Date.now()` is the wrong clock** — millisecond resolution and wall-clock time, which NTP or the user
  can move backwards mid-measurement. `performance.now()` is monotonic and sub-millisecond.
- **Browsers deliberately coarsen `performance.now()`** (5 µs with cross-origin isolation, up to 100 µs
  otherwise) to blunt timing attacks. Anything faster needs batching — calibration makes that automatic.
- **The median is the headline.** Timing distributions are right-skewed: GC and scheduling only ever add
  time. One 50 ms pause can double a mean of ten 1 ms samples; the median doesn't move.
- **Warm-up exists because of the JIT.** The first calls run in the interpreter; the optimised code arrives
  after the engine has seen the function hot.

---

## 3. Low-level design (LLD)

### Options

```js
measure(name, fn, {
  samples = 20,          // timed batches
  warmup = 5,            // untimed calls first
  minSampleMs = 5,       // each batch must take at least this long
  maxIterations = 1e6,   // calibration cap
  now = () => performance.now(),
  yieldBetween = () => new Promise((r) => setTimeout(r, 0)),   // a macrotask: lets the page paint
})
```

### Result

```js
{ name, isAsync, samples, iterationsPerSample, median, p95, mean, stdDev, min, max, opsPerSec, error }
```

### Pure function signatures

```js
mean(values)                 -> number
percentile(sortedValues, p)  -> number      // linear interpolation (R-7)
stdDev(values)               -> number      // sample (n − 1)
summarize(durations)         -> { mean, median, p95, min, max, stdDev }
formatDuration(ms)           -> 'x ms' | 'x µs' | 'x ns'
```

Why `now` and `yieldBetween` are injected: with a fake clock that the measured function advances itself,
every expected number in the tests is exact — no sleeps, no flaky thresholds.

---

## 4. The data model

A result per candidate:

```json
{
  "name": "Set.has", "isAsync": false, "samples": 20, "iterationsPerSample": 1000000,
  "median": 0.000005, "p95": 0.0000052, "mean": 0.0000051, "stdDev": 0.0000002,
  "min": 0.0000049, "max": 0.0000071, "opsPerSec": 200000000, "error": null
}
```

All durations are **milliseconds per call** (after dividing by `iterationsPerSample`) — one unit everywhere,
formatted only at the edge. `iterationsPerSample` is reported because it tells the reader how far below
timer resolution the function was.

**Fork — how to summarise samples**

| Statistic | Robust to outliers | Answers | Use |
| --- | --- | --- | --- |
| mean | no | total cost over many calls | capacity planning |
| **median** | **yes** | typical call | **ranking candidates** |
| p95 / p99 | — | tail latency | user-facing latency budgets |
| min | yes | best case, least noise | micro-benchmarks of pure CPU work |
| std dev | no | spread | "is the difference real?" |

---

## 5. Pass 1 — the naive versions (target: 6 minutes)

#### V0 — `Date.now()` around one call

```js
function timeOnce(fn) {
  const start = Date.now();
  fn();
  return Date.now() - start;   // 0 for anything under a millisecond
}
```

Run it on `NUMBERS.includes(9999)` → `0 ms`. On `Set.has` → `0 ms`. Both "equally fast". The playground's
last column shows exactly this.

#### V1 — `performance.now()` around one call

Now `includes` shows `0.0something` and `Set.has` shows `0` or one timer tick. Better resolution, same
problem: one sample of a noisy process, cold JIT, and a function faster than the tick.

---

## 6. Pass 2 — repeated, warmed, calibrated (target: 10 minutes)

### 6.1 The ladder

| Rung | 50 ns function | 5 ms function | Outliers (GC) | Cold JIT |
| --- | --- | --- | --- | --- |
| V0 `Date.now()` once | 0 ms | 5 ms ± 1 | whatever happened | measured |
| V1 `performance.now()` once | 0 or one tick | 5.02 ms | whatever happened | measured |
| V2 N runs + mean | still 0 per run → 0 | good | **skew the mean** | averaged in |
| **V3 warm-up + calibrated batches + median/p95** | **50 ns** | **5.02 ms** | **median ignores** | **excluded** |

#### V2 — N runs, average

```js
const times = [];
for (let i = 0; i < 20; i++) { const t0 = performance.now(); fn(); times.push(performance.now() - t0); }
const avg = times.reduce((a, b) => a + b) / times.length;
```

This is the interviewer's hint, and it is still wrong for fast functions: twenty zeros average to zero.

#### V3 — warm-up, calibrate, sample, median ← **build this**

```js
const timeBatch = async (count) => {
  const start = now();
  if (isAsync) for (let i = 0; i < count; i++) sink = await fn();
  else for (let i = 0; i < count; i++) sink = fn();
  return now() - start;
};

let iterations = 1;
while ((await timeBatch(iterations)) < minSampleMs && iterations < maxIterations) iterations *= 2;

const durations = [];
for (let s = 0; s < samples; s++) {
  durations.push((await timeBatch(iterations)) / iterations);
  await yieldBetween();
}
```

### 6.2 Why V3 wins

What changed is **what one sample means**. In V1/V2 a sample is one call, so its precision is capped by the
timer. In V3 a sample is *as many calls as it takes to be measurable*, and the per-call time is recovered by
division — so precision comes from the batch size, not the clock. Calibration costs `O(log k)` extra
batches (doubling), and the median then discards the samples that GC or the scheduler inflated. **Ship V3.**
Each piece is a few lines, and each one answers a follow-up the interviewer is likely to ask ("what about
very fast functions?", "why is the first run slower?", "why is the average noisy?").

This is not dynamic programming; the doubling is an exponential search for the batch size.

---

## 7. Pass 3 — async (target: 8 minutes)

```js
const probe = fn();
const isAsync = typeof probe?.then === 'function';   // thenable, not `instanceof Promise`
if (isAsync) sink = await probe;
```

- Detect by **behaviour**, not by `fn.constructor.name === 'AsyncFunction'` — a normal function that returns
  a promise is async too, and transpiled code loses the `async` keyword.
- `await` each call **sequentially**. `Promise.all` of N calls measures overlap (throughput), not latency — a
  different question; name it.
- Calibration applies to async too: `await Promise.resolve()` costs ~100 ns, far below the timer.
- Timers are clamped: `setTimeout(fn, 2)` measures ~4–5 ms because nested timers are clamped to 4 ms and
  background tabs are throttled harder. That is a *correct* measurement of what the user gets.

---

## 8. Pass 4 — statistics, errors, compare (target: 10 minutes)

```js
function percentile(sorted, p) {                 // linear interpolation
  if (!sorted.length) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

async function compare(candidates, options, onResult) {
  const results = [];
  for (const [i, c] of candidates.entries()) {
    const result = await measure(c.name, c.fn, options);     // errors come back as { error }
    results.push(result);
    onResult?.(result, i);                                   // stream progress to the UI
  }
  return results.sort((a, b) => Number(!!a.error) - Number(!!b.error) || a.median - b.median);
}
```

- `measure` wraps everything in `try/catch` and returns `{ error }` — one broken candidate must not lose the
  other results.
- Results stream so a UI can show progress; `compare` resolves with the ranked list.
- Candidates run one after another. CPU frequency and thermal state drift over a run, which favours whoever
  runs first — interleaving samples round-robin is the fix (see cross-questions).

---

## 9. The single-file version — what you actually type

```jsx
import { useState } from 'react';

/* ───────────── utils/stats.utils.js — pure ───────────── */

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function stdDev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function summarize(durations) {
  const s = [...durations].sort((a, b) => a - b);
  return { mean: mean(s), median: percentile(s, 50), p95: percentile(s, 95), min: s[0] ?? 0, max: s.at(-1) ?? 0, stdDev: stdDev(s) };
}

const formatDuration = (ms) =>
  ms >= 1 ? `${ms.toFixed(2)} ms` : ms >= 0.001 ? `${(ms * 1000).toFixed(2)} µs` : `${Math.round(ms * 1e6)} ns`;

/* ───────────── utils/benchmark.js ───────────── */

let sink;                                                    // defeats dead-code elimination

async function measure(name, fn, {
  samples = 20, warmup = 5, minSampleMs = 5, maxIterations = 1e6,
  now = () => performance.now(),
  yieldBetween = () => new Promise((r) => setTimeout(r, 0)),
} = {}) {
  try {
    const probe = fn();
    const isAsync = typeof probe?.then === 'function';     // behaviour, not the async keyword
    if (isAsync) sink = await probe;
    for (let i = 1; i < warmup; i++) sink = isAsync ? await fn() : fn();   // untimed: let the JIT settle

    const timeBatch = async (count) => {
      const start = now();
      if (isAsync) for (let i = 0; i < count; i++) sink = await fn();       // sequential = latency
      else for (let i = 0; i < count; i++) sink = fn();
      return now() - start;
    };

    let iterations = 1;                                      // calibrate past the timer's resolution
    while ((await timeBatch(iterations)) < minSampleMs && iterations < maxIterations) iterations *= 2;

    const durations = [];
    for (let s = 0; s < samples; s++) {
      durations.push((await timeBatch(iterations)) / iterations);
      await yieldBetween();                                  // keep the page responsive
    }
    const stats = summarize(durations);
    return { name, isAsync, iterationsPerSample: iterations, ...stats,
      opsPerSec: stats.median > 0 ? 1000 / stats.median : Infinity, error: null };
  } catch (error) {
    return { name, error: error instanceof Error ? error.message : String(error) };
  }
}

async function compare(candidates, options, onResult) {
  const results = [];
  for (const [i, c] of candidates.entries()) {
    const r = await measure(c.name, c.fn, options);
    results.push(r);
    onResult?.(r, i);
  }
  return results.sort((a, b) => Number(!!a.error) - Number(!!b.error) || a.median - b.median);
}

/* ───────────── constants/candidates.js ───────────── */

const NUMBERS = Array.from({ length: 10_000 }, (_, i) => i);
const SET = new Set(NUMBERS);
const CANDIDATES = [
  { name: 'Array.includes', fn: () => NUMBERS.includes(9_999) },
  { name: 'Set.has', fn: () => SET.has(9_999) },
  { name: 'await 2ms timer', fn: () => new Promise((r) => setTimeout(r, 2)) },
  { name: 'throws', fn: () => { throw new Error('boom'); } },
];

/* ───────────── App.jsx ───────────── */

export default function App() {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults([]);
    const ranked = await compare(CANDIDATES, { samples: 20 }, (r) => setResults((cur) => [...cur, r]));
    setResults(ranked);
    setRunning(false);
    console.table(ranked.map(({ name, median, p95, iterationsPerSample, error }) => ({ name, median, p95, iterationsPerSample, error })));
  };

  return (
    <main>
      <button onClick={run} disabled={running}>{running ? 'Measuring…' : 'Run'}</button>
      <table>
        <thead><tr><th>Candidate</th><th>Median</th><th>p95</th><th>Batch</th><th>Error</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.name}>
              <td>{r.name}{r.isAsync ? ' (async)' : ''}</td>
              <td>{r.error ? '—' : formatDuration(r.median)}</td>
              <td>{r.error ? '—' : formatDuration(r.p95)}</td>
              <td>{r.error ? '—' : `×${r.iterationsPerSample}`}</td>
              <td>{r.error ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

**Build it in this order:** V0 with `Date.now()` on a fast function, log `0` → switch to `performance.now()` →
loop N samples, log the array → `summarize` with median/p95 → warm-up → calibration → async probe + awaited
batches → try/catch → `compare` + ranking → the page.

Narrate the two lines that the round is testing: `while ((await timeBatch(iterations)) < minSampleMs) iterations
*= 2` — *"a sample is as many calls as it takes to be measurable"* — and `typeof probe?.then === 'function'` —
*"detect async by behaviour, then await sequentially so I'm measuring latency."*

---

## 10. Verification

```bash
node src/projects/perf-benchmark/utils/benchmark.check.ts
```

The fake clock is advanced *by the measured functions themselves* (`clock += 0.001` is a "1 µs function"), so:
a 1 µs sync function is calibrated to ≥ 5000 iterations and its median recovered as exactly 0.001 ms; a 20 ms
function needs no batching; a 7 ms async function is detected, awaited, one call per sample, and called
exactly probe + warm-up + one calibration batch + samples times; a 2 µs async function is batched like a fast
sync one; a sample set with one 50 ms outlier has median 1 and a mean pulled above it; throw and reject become
`{ error }`; `compare` streams in run order and ranks fastest first with errors last. Stats helpers are checked
against known values (percentile interpolation, sample std dev 2.1381 for the textbook set).

Demo script:

1. *Membership* suite → `Set.has` ≈ 5 ns batched ×1 000 000, `Array.includes` ≈ 1 µs — the naive Date.now
   column says `0 ms` for both.
2. *Sum* suite → three loops within a small factor of each other; run twice and watch the medians hold while
   the means wobble.
3. *Async* suite → `await Promise.resolve()` ≈ 100 ns (calibrated ×30 000), `2 ms timer` ≈ 4.5 ms (clamping),
   `rejects` shows its error without stopping the run.

---

## 11. Cross-questions and answers

**"Is the difference between two candidates real?"**
Look at the spread before the ratio: if the medians are 3% apart and the standard deviations are 10%, it is
noise. Formally: Mann-Whitney U on the two sample sets (no normality assumption), or bootstrap a confidence
interval for the ratio of medians.

**"Why does the first candidate look slower/faster?"**
Order effects: CPU frequency scaling, thermal throttling, GC state, caches warmed by the previous candidate.
Interleave: for each sample round, time every candidate once, in a shuffled order.

**"How do you measure in production instead?"**
`performance.mark('x-start')` / `performance.measure('x', 'x-start')`, read with a `PerformanceObserver`, and
send percentiles to analytics with `sendBeacon`. Real-user data beats lab data for anything user-facing.
Long tasks (`PerformanceObserver({ type: 'longtask' })`) and INP for responsiveness.

**"Memory?"**
`performance.measureUserAgentSpecificMemory()` (needs cross-origin isolation) or DevTools heap snapshots;
there is no portable per-call memory counter.

**"Should this run on the main thread?"**
For CPU benchmarks, a Worker isolates them from rendering. But if the question is "how long does this take on
the main thread while the user is here", the main thread is the honest place — yield between samples.

**"Why `sink`?"**
If a pure function's result is never used, an optimising compiler may delete the call; the benchmark then
measures an empty loop. Writing to a module-level variable keeps the work observable.

**"How would you test the utility itself?"**
Inject the clock. A fake clock advanced by the function under test gives exact expected values for
calibration, per-call recovery, async detection and call counts — the check file does exactly this.
