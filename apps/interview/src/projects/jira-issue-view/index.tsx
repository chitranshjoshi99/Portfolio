import { CommentItem } from './components/comment-item';
import { useIssue } from './hooks/use-issue';
import './jira-issue-view.css';
import { isSubmitShortcut } from './utils/comments.utils';

/** Fixed clock so the relative times do not shift while the page is open. */
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);
const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'] as const;

export default function JiraIssueViewPage() {
  const v = useIssue();

  return (
    <section className="iv">
      <div className="iv__bar">
        <button type="button" className="iv__btn" onClick={v.refresh}>
          Refresh
        </button>
        <button type="button" className="iv__btn" onClick={v.failNext}>
          Fail next comment request
        </button>
        {v.pending > 0 && <span className="iv__chip">{v.pending} unsent</span>}
      </div>

      {v.issue.kind === 'loading' && (
        <div className="iv__skeleton" aria-busy="true" aria-label="Loading issue">
          <span className="iv__bone iv__bone--title" />
          <span className="iv__bone" />
          <span className="iv__bone iv__bone--short" />
        </div>
      )}

      {v.issue.kind === 'error' && (
        <p className="iv__error" role="alert">
          {v.issue.error}{' '}
          <button type="button" className="iv__link" onClick={v.refresh}>
            Retry
          </button>
        </p>
      )}

      {v.issue.kind === 'ready' && (
        <article className="iv__layout">
          <div className="iv__main">
            <p className="iv__key">{v.issue.value.key}</p>
            <h2 className="iv__summary">{v.issue.value.summary}</h2>
            <p className="iv__description">{v.issue.value.description}</p>

            <section className="iv__comments" aria-label="Comments">
              <h3 className="iv__h3">Comments</h3>

              {v.commentsState === 'loading' && <p className="iv__muted">Loading comments…</p>}
              {/* Shown for a failed fetch AND for a failed delete that was rolled back. */}
              {v.commentsError && (
                <p className="iv__error" role="alert">
                  {v.commentsError}{' '}
                  {v.commentsState === 'error' && (
                    <button type="button" className="iv__link" onClick={v.refresh}>
                      Retry
                    </button>
                  )}
                </p>
              )}

              <ul className="iv__list">
                {v.comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    now={NOW}
                    editing={v.editing}
                    onEdit={v.setEditing}
                    onSaveEdit={v.saveEdit}
                    onRetry={v.retry}
                    onDiscard={v.discard}
                    onRemove={v.remove}
                  />
                ))}
                {v.commentsState === 'ready' && v.comments.length === 0 && (
                  <li className="iv__muted">No comments yet.</li>
                )}
              </ul>

              <form
                className="iv__composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  v.submit();
                }}
              >
                <label className="iv__sr" htmlFor="iv-comment">
                  Add a comment
                </label>
                <textarea
                  id="iv-comment"
                  rows={3}
                  placeholder="Add a comment…"
                  value={v.draft}
                  onChange={(event) => v.setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (!isSubmitShortcut(event)) return;
                    event.preventDefault();
                    v.submit();
                  }}
                />
                <div className="iv__row">
                  <button type="submit" className="iv__btn iv__btn--primary" disabled={!v.draft.trim()}>
                    Comment
                  </button>
                  <span className="iv__muted">⌘↵ to send</span>
                </div>
              </form>
            </section>
          </div>

          <aside className="iv__side">
            <dl className="iv__fields">
              <dt>Status</dt>
              <dd>
                <select
                  value={v.issue.value.status}
                  aria-label="Status"
                  onChange={(event) => v.setStatus(event.target.value as (typeof STATUSES)[number])}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </dd>
              <dt>Assignee</dt>
              <dd>{v.issue.value.assignee ?? 'Unassigned'}</dd>
              <dt>Reporter</dt>
              <dd>{v.issue.value.reporter}</dd>
              <dt>Priority</dt>
              <dd>{v.issue.value.priority}</dd>
              <dt>Points</dt>
              <dd>{v.issue.value.points}</dd>
              <dt>Labels</dt>
              <dd className="iv__labels">
                {v.issue.value.labels.map((label) => (
                  <span key={label} className="iv__chip">
                    {label}
                  </span>
                ))}
              </dd>
            </dl>
          </aside>
        </article>
      )}
    </section>
  );
}
