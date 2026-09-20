import {
  BATCH_SIZE_OPTIONS,
  BURST_SIZE,
  INTERVAL_OPTIONS,
  SAMPLE_EVENTS,
  type CollectorMode,
} from './constants/analytics-sdk.constants';
import { useAnalyticsPlayground } from './hooks/use-analytics-playground';
import './analytics-sdk.css';

const MODES: CollectorMode[] = ['healthy', 'flaky', 'down'];

export default function AnalyticsSdkPage() {
  const p = useAnalyticsPlayground();
  const { queue, inFlight, retry, stats } = p.snapshot;

  return (
    <section className="an">
      <div className="an__row">
        {SAMPLE_EVENTS.map((sample, index) => (
          <button key={sample.name} type="button" className="an__btn" onClick={() => p.track(index)}>
            track('{sample.name}')
          </button>
        ))}
        <button type="button" className="an__btn an__btn--primary" onClick={p.burst}>
          Burst ×{BURST_SIZE}
        </button>
      </div>

      <div className="an__row">
        <label className="an__field">
          Batch size
          <select
            value={p.config.maxBatchSize}
            onChange={(event) => p.restart({ ...p.config, maxBatchSize: Number(event.target.value) })}
          >
            {BATCH_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="an__field">
          Interval
          <select
            value={p.config.flushIntervalMs}
            onChange={(event) => p.restart({ ...p.config, flushIntervalMs: Number(event.target.value) })}
          >
            {INTERVAL_OPTIONS.map((ms) => (
              <option key={ms} value={ms}>
                {ms / 1000}s
              </option>
            ))}
          </select>
        </label>
        <div className="an__segment" role="radiogroup" aria-label="Collector">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={p.mode === mode}
              className={p.mode === mode ? 'is-selected' : undefined}
              onClick={() => p.setMode(mode)}
            >
              collector {mode}
            </button>
          ))}
        </div>
        <button type="button" className="an__btn" onClick={p.flushNow}>
          flush()
        </button>
        <button type="button" className="an__btn" onClick={p.simulateHide}>
          Simulate page hide
        </button>
      </div>

      <div className="an__stats" role="status">
        <span>
          tracked <b>{stats.tracked}</b>
        </span>
        <span>
          sent <b>{stats.sent}</b> in <b>{stats.batchesSent}</b> batches
        </span>
        <span>
          beacon <b>{stats.beaconed}</b>
        </span>
        <span>
          failures <b>{stats.failures}</b>
        </span>
        <span>
          dropped <b>{stats.dropped}</b>
        </span>
      </div>

      <div className="an__pipeline">
        <div className="an__stage">
          <h2>Queue ({queue.length})</h2>
          <div className="an__chips">
            {queue.slice(0, 40).map((event) => (
              <span key={event.id} className="an__chip" title={JSON.stringify(event.props)}>
                {event.name}
              </span>
            ))}
            {queue.length > 40 && <span className="an__muted">+{queue.length - 40}</span>}
            {queue.length === 0 && <span className="an__muted">empty</span>}
          </div>
        </div>
        <div className="an__stage">
          <h2>In flight</h2>
          {inFlight ? (
            <p>
              batch #{inFlight.id} · {inFlight.events.length} events · attempt {inFlight.attempt} · {inFlight.reason}
            </p>
          ) : (
            <p className="an__muted">nothing</p>
          )}
          {retry && (
            <p className="an__warn">
              batch #{retry.batch.id} retries in {retry.delayMs / 1000}s (attempt {retry.batch.attempt})
            </p>
          )}
        </div>
        <div className="an__stage">
          <h2>Delivery log</h2>
          <ol className="an__log">
            {p.log.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className={`an__log--${entry.kind}`}>
                <time>{new Date(entry.at).toLocaleTimeString()}</time> {entry.detail}
              </li>
            ))}
            {p.log.length === 0 && <li className="an__muted">no deliveries yet</li>}
          </ol>
        </div>
      </div>
    </section>
  );
}
