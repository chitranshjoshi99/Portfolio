import type { Comment } from '../jira-issue-view.types.ts';

/** A client id for a comment that does not exist on the server yet. */
export const draftId = (seed: number): string => `tmp-${seed.toString(36)}`;

export const isDraft = (id: string): boolean => id.startsWith('tmp-');

/**
 * Insert an optimistic comment. It goes where the server will put it (newest last), so the list does
 * not reorder when the real id arrives.
 */
export function addOptimistic(comments: Comment[], comment: Comment): Comment[] {
  return [...comments, comment];
}

/** Replace the optimistic comment with the server's copy, keeping its position. */
export function confirmComment(comments: Comment[], tempId: string, saved: Comment): Comment[] {
  return comments.map((comment) => (comment.id === tempId ? { ...saved, status: 'sent' } : comment));
}

export function failComment(comments: Comment[], tempId: string, error: string): Comment[] {
  return comments.map((comment) =>
    comment.id === tempId ? { ...comment, status: 'failed', error } : comment,
  );
}

export const removeComment = (comments: Comment[], id: string): Comment[] =>
  comments.filter((comment) => comment.id !== id);

export function editComment(comments: Comment[], id: string, body: string, at: number): Comment[] {
  return comments.map((comment) =>
    comment.id === id ? { ...comment, body, editedAt: at, status: 'sending' } : comment,
  );
}

/**
 * Merge a server list with what this client is still sending. A refetch must not wipe a comment the
 * user just wrote and that the server has not acknowledged yet.
 */
export function mergeServerComments(server: Comment[], local: Comment[]): Comment[] {
  const pending = local.filter((comment) => comment.status !== 'sent');
  const byId = new Map(server.map((comment) => [comment.id, comment]));
  // Anything local and confirmed that the server also returned takes the server's copy (it may have
  // been edited elsewhere); anything still in flight is appended at the end, where it was drawn.
  const confirmed = server.map((comment) => byId.get(comment.id) ?? comment);
  return [...confirmed, ...pending];
}

export const pendingCount = (comments: Comment[]): number =>
  comments.filter((comment) => comment.status !== 'sent').length;

/** Trim, collapse the blank-only case, and cap: an empty comment is not a comment. */
export function normaliseBody(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
}

/** "2 hours ago" for recent comments, an absolute date once it stops being useful. */
export function timeAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Cmd/Ctrl+Enter submits a comment; plain Enter is a newline. */
export const isSubmitShortcut = (event: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean =>
  event.key === 'Enter' && (event.metaKey || event.ctrlKey);
