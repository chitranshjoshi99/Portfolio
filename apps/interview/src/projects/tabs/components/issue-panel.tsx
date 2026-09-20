import { useState } from 'react';
import { usePanelData } from '../hooks/use-panel-data';

interface IssuePanelProps {
  id: string;
  /** False until the widget is on screen (when deferring). Mounted-but-not-loading is allowed. */
  canLoad: boolean;
}

export function IssuePanel({ id, canLoad }: IssuePanelProps) {
  const { status, data, error, retry } = usePanelData(id, canLoad);
  // Captured once per mount: with keepMounted it stays put across tab switches.
  const [mountedAt] = useState(() => new Date().toLocaleTimeString());

  return (
    <div className="tb__panel-body">
      <p className="tb__meta">
        mounted {mountedAt}
        {data && ` · data fetched ${new Date(data.loadedAt).toLocaleTimeString()}`}
      </p>
      {!canLoad && <p className="tb__muted">Waiting until this widget is on screen…</p>}
      {canLoad && status === 'loading' && <p className="tb__muted">Loading…</p>}
      {status === 'error' && (
        <p className="tb__error" role="alert">
          {error}{' '}
          <button type="button" className="tb__link" onClick={retry}>
            Retry
          </button>
        </p>
      )}
      {data && (
        <ul className="tb__lines">
          {data.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <label className="tb__note">
        Scratch note (survives switching only if the panel stays mounted)
        <input placeholder="type, switch tab, come back" />
      </label>
    </div>
  );
}
