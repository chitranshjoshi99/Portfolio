import { useCallback, useEffect, useRef, useState } from 'react';
import type { Comment, Issue, Loadable } from '../jira-issue-view.types';
import {
  addOptimistic, confirmComment, draftId, editComment, failComment,
  mergeServerComments, normaliseBody, pendingCount, removeComment,
} from '../utils/comments.utils';
import * as api from '../utils/issue-api';

const ME = 'You';
const message = (error: unknown): string => (error instanceof Error ? error.message : 'Request failed');
const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export function useIssue() {
  const [issue, setIssue] = useState<Loadable<Issue>>({ kind: 'loading' });
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsState, setCommentsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [reload, setReload] = useState(0);
  const seed = useRef(0);
  /** The latest comments, readable inside async callbacks without making them dependencies. */
  const commentsRef = useRef<Comment[]>([]);
  commentsRef.current = comments;

  // The issue and its comments are two requests: the header renders as soon as the issue lands
  // rather than waiting for the slower list.
  useEffect(() => {
    const controller = new AbortController();
    // `ignore` alongside the controller: aborting a promise that already resolved does nothing, so
    // without it a response that landed a microtask before the cleanup can still write state.
    let ignore = false;
    // Only show the skeleton on the first load. A refresh keeps the issue on screen and swaps it when
    // the new copy lands — blanking a page the user is reading is worse than a stale second.
    setIssue((current) => (current.kind === 'ready' ? current : { kind: 'loading' }));
    api
      .fetchIssue(controller.signal)
      .then((value) => {
        if (!ignore) setIssue({ kind: 'ready', value });
      })
      .catch((error: unknown) => {
        if (!ignore && !aborted(error)) setIssue({ kind: 'error', error: message(error) });
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    setCommentsState('loading');
    api
      .fetchComments(controller.signal)
      .then((server) => {
        if (ignore) return;
        // Merge rather than replace: a comment this client is still sending must survive a refetch.
        setComments((current) => mergeServerComments(server, current));
        setCommentsState('ready');
        setCommentsError(null);
      })
      .catch((error: unknown) => {
        if (ignore || aborted(error)) return;
        setCommentsState('error');
        setCommentsError(message(error));
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [reload]);

  const send = useCallback((tempId: string, body: string) => {
    api
      .postComment(body, ME)
      .then((saved) => setComments((current) => confirmComment(current, tempId, saved)))
      .catch((error: unknown) => setComments((current) => failComment(current, tempId, message(error))));
  }, []);

  const submit = useCallback(() => {
    const body = normaliseBody(draft);
    if (!body) return;
    const tempId = draftId(++seed.current + Date.now());
    // Paint first: the comment appears where the server will put it, marked as sending.
    setComments((current) =>
      addOptimistic(current, { id: tempId, author: ME, body, createdAt: Date.now(), status: 'sending' }),
    );
    setDraft('');
    send(tempId, body);
  }, [draft, send]);

  const retry = useCallback(
    (id: string) => {
      const target = commentsRef.current.find((comment) => comment.id === id);
      if (!target) return;
      setComments((current) =>
        current.map((comment) =>
          comment.id === id ? { ...comment, status: 'sending', error: undefined } : comment,
        ),
      );
      send(id, target.body);
    },
    [send],
  );

  const discard = useCallback((id: string) => {
    setComments((current) => removeComment(current, id));
  }, []);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    const body = normaliseBody(editing.body);
    if (!body) return;
    const { id } = editing;
    const previous = commentsRef.current.find((comment) => comment.id === id);
    setComments((current) => editComment(current, id, body, Date.now()));
    setEditing(null);
    api
      .patchComment(id, body)
      .then((saved) => setComments((current) => confirmComment(current, id, saved)))
      .catch((error: unknown) => {
        // Roll back to the text the comment had, then say why.
        setComments((current) =>
          current.map((comment) =>
            comment.id === id
              ? { ...comment, body: previous?.body ?? comment.body, status: 'failed', error: message(error) }
              : comment,
          ),
        );
      });
  }, [editing]);

  const remove = useCallback((id: string) => {
    const snapshot = commentsRef.current;
    setComments((current) => removeComment(current, id));
    api.deleteComment(id).catch((error: unknown) => {
      // The comment comes back exactly where it was: the snapshot is the whole list, not an index.
      setComments(snapshot);
      setCommentsError(message(error));
    });
  }, []);

  return {
    issue,
    comments,
    commentsState,
    commentsError,
    pending: pendingCount(comments),
    draft,
    setDraft,
    submit,
    retry,
    discard,
    editing,
    setEditing,
    saveEdit,
    remove,
    refresh: () => setReload((count) => count + 1),
    failNext: () => {
      api.apiControl.failNextComment = true;
    },
    setStatus: (status: Issue['status']) => {
      setIssue((current) =>
        current.kind === 'ready' ? { kind: 'ready', value: { ...current.value, status } } : current,
      );
      void api.updateIssue({ status });
    },
  };
}
