export type Benchable = () => unknown | Promise<unknown>;

export interface MeasureOptions {
  /** Timed samples to collect. More = tighter median/p95. */
  samples?: number;
  /** Untimed runs first, so the JIT and caches are warm when timing starts. */
  warmup?: number;
  /** Each sample runs the function enough times to take at least this long (beats timer resolution). */
  minSampleMs?: number;
  /** Cap on calibrated iterations per sample. */
  maxIterations?: number;
  /** Injected clock — performance.now in the browser, a fake in tests. */
  now?: () => number;
  /** Yield to the event loop between samples so the page stays responsive. */
  yieldBetween?: () => Promise<void>;
}

export interface Stats {
  mean: number;
  median: number;
  p95: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface MeasureResult extends Stats {
  name: string;
  isAsync: boolean;
  samples: number;
  iterationsPerSample: number;
  /** Operations per second, from the median. */
  opsPerSec: number;
  error: string | null;
}
