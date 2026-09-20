import type { Comment } from '../jira-issue-view.types';
import { isSubmitShortcut, timeAgo } from '../utils/comments.utils';

interface CommentItemProps {
  comment: Comment;
  now: number;
  editing: { id: string; body: string } | null;
  onEdit: (value: { id: string; body: string } | null) => void;
  onSaveEdit: () => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onRemove: (id: string) => void;
}

export function CommentItem({
  comment, now, editing, onEdit, onSaveEdit, onRetry, onDiscard, onRemove,
}: CommentItemProps) {
  const isEditing = editing?.id === comment.id;
  const mine = comment.author === 'You';

  return (
    <li className={`iv__comment is-${comment.status}`}>
      <div className="iv__avatar" aria-hidden="true">
        {comment.author[0]}
      </div>

      <div className="iv__comment-body">
        <p className="iv__comment-head">
          <strong>{comment.author}</strong>
          <time dateTime={new Date(comment.createdAt).toISOString()}>{timeAgo(comment.createdAt, now)}</time>
          {comment.editedAt && <span className="iv__muted">edited</span>}
          {comment.status === 'sending' && <span className="iv__chip">sending…</span>}
          {comment.status === 'failed' && <span className="iv__chip iv__chip--bad">not sent</span>}
        </p>

        {isEditing ? (
          <div className="iv__edit">
            <textarea
              rows={3}
              value={editing.body}
              autoFocus
              onChange={(event) => onEdit({ id: comment.id, body: event.target.value })}
              onKeyDown={(event) => {
                if (isSubmitShortcut(event)) {
                  event.preventDefault();
                  onSaveEdit();
                }
                if (event.key === 'Escape') onEdit(null);
              }}
            />
            <div className="iv__row">
              <button type="button" className="iv__btn iv__btn--primary" onClick={onSaveEdit}>
                Save
              </button>
              <button type="button" className="iv__btn" onClick={() => onEdit(null)}>
                Cancel
              </button>
              <span className="iv__muted">⌘↵ to save, Esc to cancel</span>
            </div>
          </div>
        ) : (
          <p className="iv__comment-text">{comment.body}</p>
        )}

        {comment.status === 'failed' && (
          <p className="iv__error" role="alert">
            {comment.error}{' '}
            <button type="button" className="iv__link" onClick={() => onRetry(comment.id)}>
              Retry
            </button>
            <button type="button" className="iv__link" onClick={() => onDiscard(comment.id)}>
              Discard
            </button>
          </p>
        )}

        {mine && !isEditing && comment.status === 'sent' && (
          <div className="iv__row">
            <button
              type="button"
              className="iv__link"
              onClick={() => onEdit({ id: comment.id, body: comment.body })}
            >
              Edit
            </button>
            <button type="button" className="iv__link" onClick={() => onRemove(comment.id)}>
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
