import { DocNodeView } from './components/doc-node';
import './document-renderer.css';
import { useDocument } from './hooks/use-document';

export default function DocumentRendererPage() {
  const d = useDocument();

  return (
    <section className="dr">
      <div className="dr__bar">
        <span className="dr__stat">{d.stats.nodes} nodes</span>
        <span className="dr__stat">{d.stats.words} words</span>
        {d.stats.unknown.length > 0 && (
          <span className="dr__stat dr__stat--warn">
            {d.stats.unknown.length} unsupported: {d.stats.unknown.join(', ')}
          </span>
        )}
        {d.stats.blockedLinks.length > 0 && (
          <span className="dr__stat dr__stat--bad">{d.stats.blockedLinks.length} link blocked</span>
        )}
        <button type="button" className="dr__btn" onClick={d.toggleSource}>
          {d.showSource ? 'Hide JSON' : 'Edit JSON'}
        </button>
      </div>

      {d.showSource && (
        <div className="dr__editor">
          <label className="dr__sr" htmlFor="dr-source">
            Document JSON
          </label>
          <textarea
            id="dr-source"
            className="dr__source"
            spellCheck={false}
            value={d.source}
            onChange={(event) => d.setSource(event.target.value)}
          />
          <div className="dr__editor-actions">
            <button type="button" className="dr__btn dr__btn--primary" onClick={d.apply}>
              Render
            </button>
            <button type="button" className="dr__btn" onClick={d.reset}>
              Reset
            </button>
            {d.error && (
              <p className="dr__error" role="alert">
                {d.error}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="dr__layout">
        <nav className="dr__outline" aria-label="On this page">
          <h2 className="dr__outline-title">On this page</h2>
          <ul>
            {d.headings.map((heading) => (
              <li key={heading.id} data-level={heading.level}>
                <a href={`#${heading.id}`}>{heading.text}</a>
              </li>
            ))}
            {d.headings.length === 0 && <li className="dr__muted">No headings</li>}
          </ul>
        </nav>

        <article className="dr__page">
          <DocNodeView node={d.doc} anchorOf={d.anchorOf} />
        </article>
      </div>
    </section>
  );
}
