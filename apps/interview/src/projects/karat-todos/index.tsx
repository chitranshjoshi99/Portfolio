import { UserBlock } from './components/user-block';
import { API_URL, PAGE_SIZE } from './constants/karat-todos.constants';
import { useTodos } from './hooks/use-todos';
import './karat-todos.css';

export default function KaratTodosPage() {
  const t = useTodos();

  return (
    <section className="kt">
      <div className="kt__toolbar">
        <code className="kt__url">
          GET {API_URL}?limit={PAGE_SIZE}&amp;skip={t.loaded}
        </code>
        <label className="kt__field">
          <input type="checkbox" checked={t.openFirst} onChange={(event) => t.setOpenFirst(event.target.checked)} />
          Open first
        </label>
        <button type="button" className="kt__btn" onClick={t.resetEdits} disabled={t.editedCount === 0}>
          Discard {t.editedCount} local edit{t.editedCount === 1 ? '' : 's'}
        </button>
        <button type="button" className="kt__btn" onClick={t.failNextRequest}>
          Fail next request
        </button>
      </div>

      <p className="kt__meta" role="status">
        {t.loaded} of {t.total ?? '…'} todos · {t.groups.length} users · edits saved to localStorage
      </p>

      <div className="kt__grid">
        {t.groups.map((group) => (
          <UserBlock
            key={group.userId}
            group={group}
            patches={t.patches}
            editingId={t.editingId}
            onToggle={t.toggle}
            onStartEdit={t.startEdit}
            onSave={t.saveEdit}
            onCancel={t.cancelEdit}
          />
        ))}
      </div>

      {t.status === 'error' && (
        <p className="kt__error" role="alert">
          {t.error}.{' '}
          <button type="button" className="kt__link" onClick={t.loadMore}>
            Retry
          </button>
        </p>
      )}

      {t.canLoadMore && t.status !== 'error' && (
        <button
          type="button"
          className="kt__btn kt__btn--primary"
          onClick={t.loadMore}
          disabled={t.status === 'loading'}
        >
          {t.status === 'loading' ? 'Loading…' : `Load ${PAGE_SIZE} more`}
        </button>
      )}
    </section>
  );
}
