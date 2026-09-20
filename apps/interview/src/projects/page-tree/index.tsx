import { TreeRowView } from './components/tree-row';
import { ROW_HEIGHT, VIEWPORT_HEIGHT } from './constants/page-tree.constants';
import { usePageTree } from './hooks/use-page-tree';
import './page-tree.css';

export default function PageTreePage() {
  const t = usePageTree();
  const selected = t.selectedId ? t.store[t.selectedId] : null;

  return (
    <section className="pt">
      <div className="pt__toolbar">
        <span>
          {t.rows.length.toLocaleString()} visible rows · <b>{t.renderedCount}</b> in the DOM · {t.requests} requests
        </span>
        <button type="button" className="pt__btn" onClick={t.failNext}>
          Fail next load
        </button>
        <span className="pt__hint">↑↓ move · → expand · ← collapse · Enter select · * expand siblings · type to jump</span>
      </div>

      <div className="pt__layout">
        <div
          ref={t.viewportRef}
          className="pt__viewport"
          style={{ height: VIEWPORT_HEIGHT }}
          onScroll={t.onScroll}
          role="tree"
          aria-label="Space pages"
        >
          <div className="pt__spacer" style={{ height: Math.max(t.totalHeight, ROW_HEIGHT) }}>
            {t.rendered.map(({ row, index }) => (
              <TreeRowView
                key={row.id}
                row={row}
                node={t.store[row.pageId]}
                isExpanded={t.expanded.has(row.pageId)}
                isSelected={row.pageId === t.selectedId}
                isTabStop={row.id === t.tabStop}
                top={index * ROW_HEIGHT}
                onToggle={t.toggle}
                onSelect={t.select}
                onRetry={t.retry}
                onKeyDown={t.onRowKeyDown}
                onFocus={t.onRowFocus}
                registerRow={t.registerRow}
              />
            ))}
            {t.rows.length === 0 && <div className="pt__empty">Loading space…</div>}
          </div>
        </div>

        <article className="pt__page">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              <p className="pt__muted">/wiki/spaces/ENG/pages/{selected.id}</p>
            </>
          ) : (
            <p className="pt__muted">Select a page.</p>
          )}
        </article>
      </div>
    </section>
  );
}
