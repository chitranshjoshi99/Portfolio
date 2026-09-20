import type { Stats } from '../perf-benchmark.types';

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Linear-interpolated percentile over a SORTED array (the "R-7" method spreadsheets use).
 * p in [0, 100]. percentile(sorted, 50) is the median.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/** Sample standard deviation (n − 1). */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

export function summarize(durations: number[]): Stats {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    mean: mean(sorted),
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    stdDev: stdDev(sorted),
  };
}

/** Human units for a duration in milliseconds. */
export function formatDuration(ms: number): string {
  if (ms >= 1) return `${ms.toFixed(ms >= 100 ? 0 : 2)} ms`;
  if (ms >= 0.001) return `${(ms * 1000).toFixed(2)} µs`;
  return `${(ms * 1_000_000).toFixed(0)} ns`;
}

/** Wraps any throwing/rejecting call into a value, so one bad candidate can't abort a comparison. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
