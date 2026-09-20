import { EventLog } from './components/event-log';
import { Feature } from './components/feature';
import { FlagTable } from './components/flag-table';
import { CONCURRENT_CALLS, LATENCY_OPTIONS } from './constants/feature-flag-sdk.constants';
import { useFlagPlayground } from './hooks/use-flag-playground';
import './feature-flag-sdk.css';

export default function FeatureFlagSdkPage() {
  const p = useFlagPlayground();
  const age = p.cacheAgeMs === null ? 'empty' : `${(p.cacheAgeMs / 1000).toFixed(1)}s`;
  const isStale = p.cacheAgeMs !== null && p.cacheAgeMs >= p.ttlMs;

  return (
    <section className="ff">
      <div className="ff__stats" role="status">
        <span>
          requests <b>{p.stats.requests}</b>
        </span>
        <span>
          deduped <b>{p.stats.deduped}</b>
        </span>
        <span>
          cache hits <b>{p.stats.hits}</b>
        </span>
        <span>
          failures <b>{p.stats.failures}</b>
        </span>
        <span>
          last fetch <b>{p.stats.lastLatencyMs === null ? '—' : `${p.stats.lastLatencyMs} ms`}</b>
        </span>
        <span className={isStale ? 'ff__stale' : undefined}>
          cache age <b>{age}</b> / TTL {p.ttlMs / 1000}s{isStale ? ' — stale' : ''}
        </span>
        <span>
          status <b>{p.snapshot.status}</b>
        </span>
      </div>

      <div className="ff__actions">
        <button type="button" className="ff__btn ff__btn--primary" onClick={p.fireConcurrent}>
          Call getFeatureState ×{CONCURRENT_CALLS} at once
        </button>
        <button type="button" className="ff__btn" onClick={p.refreshNow}>
          Refresh now
        </button>
        <button type="button" className="ff__btn" onClick={p.clearCache}>
          Clear cache + storage
        </button>
        {p.lastBurst && <span className="ff__muted">{p.lastBurst}</span>}
      </div>

      <FlagTable
        snapshot={p.snapshot}
        server={p.server}
        onToggleServer={p.toggleServerFlag}
        onOverride={p.setOverride}
      />

      <div className="ff__server">
        <label className="ff__field">
          Server latency
          <select value={p.server.latencyMs} onChange={(event) => p.setLatency(Number(event.target.value))}>
            {LATENCY_OPTIONS.map((ms) => (
              <option key={ms} value={ms}>
                {ms} ms
              </option>
            ))}
          </select>
        </label>
        <label className="ff__field">
          <input
            type="checkbox"
            checked={p.server.failNext}
            onChange={(event) => p.setFailNext(event.target.checked)}
          />
          Fail the next request
        </label>
      </div>

      <div className="ff__columns">
        <div className="ff__panel">
          <h2 className="ff__h">Gated UI</h2>
          <Feature name="new-editor" fallback={<div className="ff__demo">Legacy editor</div>}>
            <div className="ff__demo ff__demo--new">New editor ✦</div>
          </Feature>
          <Feature name="dark-sidebar" fallback={<div className="ff__demo">Light sidebar</div>}>
            <div className="ff__demo ff__demo--new">Dark sidebar ✦</div>
          </Feature>
          <Feature name="ai-summaries">
            <div className="ff__demo ff__demo--new">AI summary panel ✦</div>
          </Feature>
          <Feature name="bulk-edit" fallback={<div className="ff__demo ff__muted">bulk edit hidden</div>}>
            <div className="ff__demo ff__demo--new">Bulk edit toolbar ✦</div>
          </Feature>
        </div>
        <div className="ff__panel">
          <h2 className="ff__h">SDK events</h2>
          <EventLog events={p.events} />
        </div>
      </div>
    </section>
  );
}
