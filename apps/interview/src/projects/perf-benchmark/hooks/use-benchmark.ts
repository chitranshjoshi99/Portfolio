import { useCallback, useRef, useState } from 'react';
import { SUITES } from '../constants/perf-benchmark.constants';
import type { MeasureResult } from '../perf-benchmark.types';
import { compare, timeOnceWithDateNow } from '../utils/benchmark';

export function useBenchmark() {
  const [suiteId, setSuiteId] = useState(SUITES[0].id);
  const [samples, setSamples] = useState(20);
  const [warmup, setWarmup] = useState(5);
  const [results, setResults] = useState<MeasureResult[]>([]);
  const [naive, setNaive] = useState<Record<string, number>>({});
  const [running, setRunning] = useState<string | null>(null);
  /** A newer run makes an older one's streamed results irrelevant. */
  const runId = useRef(0);

  const suite = SUITES.find((s) => s.id === suiteId) ?? SUITES[0];

  const run = useCallback(async () => {
    const id = ++runId.current;
    setResults([]);
    setNaive({});
    setRunning(suite.candidates[0]?.name ?? null);

    // V0 for contrast: one Date.now() run per sync candidate.
    const naiveTimes: Record<string, number> = {};
    for (const candidate of suite.candidates) {
      if (suite.id !== 'async') naiveTimes[candidate.name] = timeOnceWithDateNow(candidate.fn);
    }
    setNaive(naiveTimes);

    const ranked = await compare(suite.candidates, { samples, warmup }, (result, index) => {
      if (id !== runId.current) return;
      setResults((current) => [...current, result]);
      setRunning(suite.candidates[index + 1]?.name ?? null);
    });
    if (id === runId.current) {
      setResults(ranked);
      setRunning(null);
    }
  }, [samples, suite, warmup]);

  const selectSuite = useCallback((id: string) => {
    runId.current += 1; // abandon an in-progress run's updates
    setSuiteId(id);
    setResults([]);
    setNaive({});
    setRunning(null);
  }, []);

  return { suite, suiteId, selectSuite, samples, setSamples, warmup, setWarmup, results, naive, running, run };
}
