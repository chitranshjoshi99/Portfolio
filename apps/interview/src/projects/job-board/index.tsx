import { FailedCard, JobCard, SkeletonCard } from './components/job-card';
import { CONCURRENCY_OPTIONS } from './constants/jobs';
import { useJobBoard } from './hooks/use-job-board';
import { isLoaded } from './job-board.types';
import './job-board.css';

/** Fixed clock: "3 hours ago" must not change under the reader while they scroll. */
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

export default function JobBoardPage() {
  const b = useJobBoard();

  return (
    <section className="jb">
      <div className="jb__bar">
        <label className="jb__conc">
          Max parallel requests
          <select
            value={b.concurrency}
            onChange={(event) => b.setConcurrency(Number(event.target.value))}
            disabled={b.loadingCount > 0}
          >
            {CONCURRENCY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <span className="jb__stat">{b.stats.requests} detail requests</span>
        <span className="jb__stat">peak {b.stats.peakInFlight} in flight</span>
        <span className="jb__stat">
          {b.results.length} of {b.ids.length} loaded
        </span>
      </div>

      {b.idsError && (
        <p className="jb__error" role="alert">
          {b.idsError}
        </p>
      )}

      <ol className="jb__list">
        {b.results.map((result) =>
          isLoaded(result) ? (
            <JobCard key={result.id} job={result.job} now={NOW} />
          ) : (
            <FailedCard
              key={result.id}
              id={result.id}
              error={result.error}
              isRetrying={b.retrying.has(result.id)}
              onRetry={b.retry}
            />
          ),
        )}
        {/* Placeholders for the page being fetched: the list grows to its final height first. */}
        {Array.from({ length: b.loadingCount }, (_, index) => (
          <SkeletonCard key={`skeleton-${index}`} />
        ))}
      </ol>

      <div className="jb__foot">
        <button
          type="button"
          className="jb__more"
          onClick={b.loadMore}
          disabled={!b.canLoadMore}
          aria-describedby="jb-remaining"
        >
          {/* Before the ids arrive, "remaining" is 0 — which is not the same as everything being loaded. */}
          {b.loadingCount > 0 || b.loadingIds ? 'Loading…' : b.remaining > 0 ? 'Load more' : 'All jobs loaded'}
        </button>
        <span className="jb__stat" id="jb-remaining">
          {b.remaining > 0 ? `${b.remaining} more` : 'nothing left to load'}
        </span>
        <span className="jb__sr" role="status">
          {b.loadingCount > 0 ? `Loading ${b.loadingCount} jobs` : `${b.results.length} jobs loaded`}
        </span>
      </div>
    </section>
  );
}
