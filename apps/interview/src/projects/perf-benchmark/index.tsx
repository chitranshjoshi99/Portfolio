import { ResultsTable } from './components/results-table';
import { SAMPLE_OPTIONS, SUITES, WARMUP_OPTIONS } from './constants/perf-benchmark.constants';
import { useBenchmark } from './hooks/use-benchmark';
import './perf-benchmark.css';

export default function PerfBenchmarkPage() {
  const b = useBenchmark();

  return (
    <section className="pb">
      <div className="pb__suites" role="radiogroup" aria-label="Benchmark suite">
        {SUITES.map((suite) => (
          <button
            key={suite.id}
            type="button"
            role="radio"
            aria-checked={suite.id === b.suiteId}
            className={suite.id === b.suiteId ? 'is-selected' : undefined}
            onClick={() => b.selectSuite(suite.id)}
          >
            {suite.title}
          </button>
        ))}
      </div>

      <div className="pb__controls">
        <label className="pb__field">
          Samples
          <select value={b.samples} onChange={(event) => b.setSamples(Number(event.target.value))}>
            {SAMPLE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="pb__field">
          Warm-up
          <select value={b.warmup} onChange={(event) => b.setWarmup(Number(event.target.value))}>
            {WARMUP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="pb__btn" onClick={() => void b.run()} disabled={b.running !== null}>
          {b.running ? `Measuring ${b.running}…` : 'Run benchmark'}
        </button>
      </div>

      <pre className="pb__code">
        {`measure(name, fn, { samples: ${b.samples}, warmup: ${b.warmup}, minSampleMs: 5 })`}
      </pre>

      {b.results.length > 0 ? (
        <ResultsTable results={b.results} naive={b.naive} />
      ) : (
        <p className="pb__muted">
          Pick a suite and run it. The last column is the naive answer — one run timed with Date.now() — for
          contrast.
        </p>
      )}
    </section>
  );
}
