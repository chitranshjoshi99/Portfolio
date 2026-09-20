import type { MeasureResult } from '../perf-benchmark.types';
import { formatDuration } from '../utils/stats.utils';

interface ResultsTableProps {
  results: MeasureResult[];
  naive: Record<string, number>;
}

export function ResultsTable({ results, naive }: ResultsTableProps) {
  const fastest = Math.min(...results.filter((r) => !r.error).map((r) => r.median));

  return (
    <table className="pb__table">
      <thead>
        <tr>
          <th scope="col">Candidate</th>
          <th scope="col">Median</th>
          <th scope="col">p95</th>
          <th scope="col">Mean ± sd</th>
          <th scope="col">ops/s</th>
          <th scope="col">Batch</th>
          <th scope="col">Relative</th>
          <th scope="col">Date.now once</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => {
          // fastest can be 0 if everything was below timer resolution — no ratio beats a NaN× label.
          const ratio = result.error || !(fastest > 0) || !Number.isFinite(fastest) ? null : result.median / fastest;
          return (
            <tr key={result.name} className={result.error ? 'pb__row--error' : undefined}>
              <th scope="row">
                <code>{result.name}</code>
                {result.isAsync && <span className="pb__tag">async</span>}
              </th>
              {result.error ? (
                <td colSpan={6} className="pb__error">
                  threw: {result.error}
                </td>
              ) : (
                <>
                  <td>
                    <b>{formatDuration(result.median)}</b>
                  </td>
                  <td>{formatDuration(result.p95)}</td>
                  <td>
                    {formatDuration(result.mean)} ± {formatDuration(result.stdDev)}
                  </td>
                  <td>{Math.round(result.opsPerSec).toLocaleString()}</td>
                  <td>×{result.iterationsPerSample.toLocaleString()}</td>
                  <td>
                    <span className="pb__bar" style={{ width: `${Math.min(100, (ratio ?? 1) * 20)}%` }} />
                    {ratio === null ? '—' : ratio === 1 ? 'fastest' : `${ratio.toFixed(1)}× slower`}
                  </td>
                </>
              )}
              <td className="pb__naive">{result.name in naive ? `${naive[result.name]} ms` : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
