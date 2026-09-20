# Jira Issue View + Comments — Interview Build Guide

Render an issue: summary, description, a field panel, and its comments — where the comments are a
**second request**, a new comment appears **before** the server confirms it, a failed one can be retried
or discarded without losing the text, an edit rolls back, a delete restores, and a refetch never eats a
comment that is still in flight. Plain JavaScript, fresh sandbox, 45 minutes.

Reported at Atlassian as: *"build the Jira issue detail page"*, *"render a list of comments from an API
and let the user add one"*, *"what happens to the comment if the request fails?"*, and as the React-round
pairing of a layout task with an async task.

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: one request or two, what a failure looks like |
| 5–12 | Issue fetch + layout + the three load states |
| 12–22 | Comments list, composer, **optimistic add** |
| 22–32 | Failure: retry, discard, edit rollback, delete restore |
| 32–40 | Refetch merge, keyboard, accessibility |
| 40–45 | Scale, realtime, cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
jira-issue-view/
  index.tsx                       # header, fields panel, comment list, composer
  jira-issue-view.types.ts        # Issue, Comment, CommentStatus, Loadable<T>
  jira-issue-view.css
  utils/issue-api.ts              # fetchIssue, fetchComments, post/patch/deleteComment, updateIssue
  utils/comments.utils.ts         # addOptimistic, confirmComment, failComment, editComment,
                                  #   removeComment, mergeServerComments, normaliseBody, timeAgo
  utils/comments.check.ts
  hooks/use-issue.ts              # the two fetches and every optimistic transition
  components/comment-item.tsx     # one comment: read, edit, failed
```

---

## 1. Requirement gathering (5 minutes)

1. **"Are the comments in the issue payload, or a separate call?"** *Default: separate — the issue must
   render before a long comment list arrives.*
2. **"What should the UI do between pressing Comment and the server answering?"** The question the whole
   task is about. *Default: show the comment immediately, marked as sending.*
3. **"And if that request fails?"** *Default: keep the comment visible, marked as not sent, with Retry and
   Discard. Never silently drop text a user typed.*
4. **"Editing and deleting — mine only?"** *Default: yes, and both are optimistic with a rollback.*
5. **"Does anything else change the comments while the page is open?"** *Default: assume a refetch can
   happen; it must merge rather than replace.*
6. **"Threading, mentions, rich text?"** *Default: flat, plain text. Say what changes if not.*
7. **"Who is 'me'?"** *Default: a constant; in production, the session user.*

Plan in one breath:

> "Two requests: the issue, then the comments. A new comment is added to the list immediately with a
> temporary id and a `sending` status, then the server's copy replaces it in place. A failure flips it to
> `failed` and keeps the text so Retry re-sends the same draft. Edit and delete are optimistic against a
> snapshot, so a rejection restores exactly what was there. A refetch merges the server list with whatever
> this client has not had confirmed yet."

---

## 2. High-level design (HLD)

```text
   mount ──┬──▶ fetchIssue()     ──▶ Loadable<Issue>  (skeleton → ready | error)
           └──▶ fetchComments()  ──▶ Comment[]        (arrives later; issue is already on screen)

   submit ──▶ normaliseBody(draft)  → null? stop
          ──▶ addOptimistic(list, { id: tmp-x, status: 'sending' })   ← paint FIRST
          ──▶ postComment()
                 ├─ ok    ──▶ confirmComment(list, tmp-x, saved)      ← replace IN PLACE
                 └─ fail  ──▶ failComment(list, tmp-x, message)       ← keep the text
                                  ├─ Retry   → same draft, status back to 'sending'
                                  └─ Discard → removeComment

   edit   ──▶ editComment(...)   → patch → confirm | restore previous body + error
   delete ──▶ removeComment(...) → delete → ok | setComments(snapshot)   ← whole list, not an index
   refetch ─▶ mergeServerComments(server, local)   ← pending survive, confirmed take the server's copy
```

Four claims:

- **Two requests, not one.** The issue is small and the comment list is not; joining them means the
  summary waits for the comments. It also gives each one its own failure: a comment fetch that 500s must
  not blank the issue.
- **A comment's status is client-side.** `sending` and `failed` only ever exist in this tab; the server
  knows `sent`. That is why the status lives on the comment rather than in a separate "pending" array —
  the row renders itself from one object.
- **The optimistic row goes where the server will put it.** Newest last, same as the list. Insert it at
  the top and the list visibly reorders when the real comment arrives.
- **Rollback restores a snapshot, not an inverse.** For delete, the whole previous list is captured before
  the call; putting a comment "back at index 3" is wrong the moment anything else changed meanwhile.

---

## 3. Low-level design (LLD)

```js
const [issue, setIssue]       = useState({ kind: 'loading' });   // Loadable<Issue>
const [comments, setComments] = useState([]);                    // Comment[] incl. unconfirmed
const [commentsState, setCommentsState] = useState('loading');
const [commentsError, setCommentsError] = useState(null);        // fetch error AND rollback message
const [draft, setDraft]       = useState('');
const [editing, setEditing]   = useState(null);                  // { id, body } | null
const commentsRef = useRef([]);                                  // read inside async callbacks
commentsRef.current = comments;
```

```js
draftId(seed)                          -> 'tmp-…'
addOptimistic(comments, comment)       -> Comment[]
confirmComment(comments, tempId, saved)-> Comment[]      // replace in place, status 'sent'
failComment(comments, tempId, error)   -> Comment[]      // keep the body, add the reason
editComment(comments, id, body, at)    -> Comment[]      // body + editedAt + status 'sending'
removeComment(comments, id)            -> Comment[]
mergeServerComments(server, local)     -> Comment[]      // pending survive a refetch
normaliseBody(raw)                     -> string | null  // trim, reject empty, cap at 2000
timeAgo(ts, now)                       -> '2 hours ago' | '2026-08-21'
isSubmitShortcut(event)                -> boolean        // Cmd/Ctrl+Enter
```

---

## 4. The data model

```json
{ "id": "c2", "author": "Lee", "body": "The transform never re-maps the selection.",
  "createdAt": 1774025400000, "editedAt": null, "status": "sent", "error": null }
```

`status: 'sent' | 'sending' | 'failed'` is a **client** field. The temporary id (`tmp-…`) is the other
half: it is what `confirmComment` looks for, and `isDraft(id)` is how the UI knows not to offer Edit on a
comment the server has never seen.

`Loadable<T>` — `{ kind: 'loading' } | { kind: 'error', error } | { kind: 'ready', value }` — is used for
the issue so the three states are exhaustive rather than three booleans that can all be true at once
(`loading && error && data` is the bug that renders a spinner over an error).

---

## 5. Pass 1 — the issue and its three states (7 minutes)

```jsx
{issue.kind === 'loading' && <Skeleton />}
{issue.kind === 'error' && <p role="alert">{issue.error} <button onClick={refresh}>Retry</button></p>}
{issue.kind === 'ready' && <IssueBody issue={issue.value} />}
```

One detail that came out of testing this build: **the refresh must not reset to `loading`.**

```js
setIssue((current) => (current.kind === 'ready' ? current : { kind: 'loading' }));
```

Without that line, pressing Refresh replaces a page the user is reading with a skeleton, and every comment
disappears for a second because the whole article unmounts. Skeleton on first load, swap in place after —
stale-while-revalidate, in one line.

The comment fetch is a **separate** effect with its own state, so the issue renders 250ms earlier and a
comment failure leaves the issue intact.

---

## 6. Pass 2 — the optimistic comment (10 minutes)

### The ladder

| Rung | What the user sees after pressing Comment | On failure | Complexity |
| --- | --- | --- | --- |
| V0 | nothing until the response, then the list refetches | error toast, **text gone** | trivial |
| V1 | spinner on the button, comment appears on response | toast, text still in the box | small |
| V2 | **comment appears at once, marked sending** | the comment turns red with Retry / Discard | +1 status field |
| V3 | V2 + persisted outbox, replayed after a reload | survives a crash | offline-scale |

**Ship V2.** V0 is the version that loses work: a 500 after a paragraph of typing means the paragraph is
gone, and it is the single most common complaint about comment boxes. V1 keeps the text but makes the
reader wait on a round trip for feedback they could have had instantly. V3 is right for an editor that
must work offline; say it and move on.

```js
const submit = () => {
  const body = normaliseBody(draft);
  if (!body) return;                                   // whitespace is not a comment
  const tempId = draftId(++seed.current + Date.now());
  setComments((current) => addOptimistic(current, {
    id: tempId, author: ME, body, createdAt: Date.now(), status: 'sending',
  }));
  setDraft('');                                        // the box clears: the text is on screen below
  send(tempId, body);
};

const send = (tempId, body) =>
  postComment(body, ME)
    .then((saved) => setComments((c) => confirmComment(c, tempId, saved)))
    .catch((error) => setComments((c) => failComment(c, tempId, error.message)));
```

Clearing the draft is safe **because the text is already visible in the list**. Clearing it in V1 is what
loses work. The failed row keeps `body`, so Retry re-sends the same draft and Discard removes it — and in
both cases the user can still select and copy their text.

---

## 7. Pass 3 — edit, delete, and rollback (10 minutes)

```js
const saveEdit = () => {
  const body = normaliseBody(editing.body);
  if (!body) return;
  const previous = commentsRef.current.find((c) => c.id === editing.id);   // capture BEFORE
  setComments((c) => editComment(c, editing.id, body, Date.now()));
  setEditing(null);
  patchComment(editing.id, body)
    .then((saved) => setComments((c) => confirmComment(c, editing.id, saved)))
    .catch((error) => setComments((c) => c.map((comment) => comment.id === editing.id
      ? { ...comment, body: previous?.body ?? comment.body, status: 'failed', error: error.message }
      : comment)));
};

const remove = (id) => {
  const snapshot = commentsRef.current;                 // the WHOLE list
  setComments((c) => removeComment(c, id));
  deleteComment(id).catch((error) => {
    setComments(snapshot);                              // back exactly as it was
    setCommentsError(error.message);
  });
};
```

Two things worth saying while typing:

- **Capture before, not after.** `previous` and `snapshot` are read before the optimistic write, through a
  ref so the callback does not need the comments in its dependency list and go stale.
- **A rolled-back delete needs somewhere to say why.** In the first version of this file the 403 was
  written to `commentsError`, which was only rendered while the *fetch* had failed — so the comment
  reappeared with no explanation, which reads as a bug in the UI rather than a rejection from the server.
  Render that error whenever it is set.

---

## 8. Pass 4 — the refetch merge (5 minutes)

```js
export function mergeServerComments(server, local) {
  const pending = local.filter((comment) => comment.status !== 'sent');
  return [...server, ...pending];
}
```

Three lines, and it is the difference between a correct optimistic list and one that eats work. A refetch
(polling, a websocket nudge, the Refresh button) replaces the confirmed comments with the server's copies
— which may have been edited or deleted elsewhere — and **appends whatever this client has not had
confirmed**, exactly where it was drawn. Once a comment is confirmed it is in the server list, so it is
not appended twice; the check file asserts both directions.

---

## 9. The single-file version — what you actually type

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';

/* ───────────── utils/issue-api.js ───────────── */

const ME = 'You';
const LATENCY = 500;
const control = { failNext: false };

const ISSUE = {
  id: 'i-4137', key: 'CONF-4137',
  summary: 'Editor drops the selection after pasting a table',
  description: 'Paste a table and the caret jumps to the start. Plain text is fine.',
  status: 'In Progress', priority: 'High', assignee: 'Priya', reporter: 'Sam',
  labels: ['editor', 'regression'], points: 5,
};

let SERVER = [
  { id: 'c1', author: 'Sam', body: 'Repro is reliable with a 3×3 table.', createdAt: Date.now() - 86400000, status: 'sent' },
  { id: 'c2', author: 'Lee', body: 'The transform never re-maps the selection.', createdAt: Date.now() - 3600000, status: 'sent' },
];
let nextId = 3;

const delay = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); });
});

const fetchIssue = async (signal) => { await delay(LATENCY, signal); return ISSUE; };
const fetchComments = async (signal) => { await delay(LATENCY + 250, signal); return SERVER.map((c) => ({ ...c })); };

async function postComment(body) {
  await delay(LATENCY + 200);
  if (control.failNext) { control.failNext = false; throw new Error('409 — comment rejected'); }
  const saved = { id: `c${nextId++}`, author: ME, body, createdAt: Date.now(), status: 'sent' };
  SERVER.push({ ...saved });
  return saved;
}

async function patchComment(id, body) {
  await delay(LATENCY);
  if (control.failNext) { control.failNext = false; throw new Error('409 — someone edited it first'); }
  const found = SERVER.find((c) => c.id === id);
  Object.assign(found, { body, editedAt: Date.now() });
  return { ...found };
}

async function deleteComment(id) {
  await delay(LATENCY);
  if (control.failNext) { control.failNext = false; throw new Error('403 — not your comment'); }
  SERVER = SERVER.filter((c) => c.id !== id);
}

/* ───────────── utils/comments.utils.js — pure ───────────── */

const draftId = (seed) => `tmp-${seed.toString(36)}`;
const addOptimistic = (comments, comment) => [...comments, comment];
const confirmComment = (comments, tempId, saved) =>
  comments.map((c) => (c.id === tempId ? { ...saved, status: 'sent' } : c));
const failComment = (comments, tempId, error) =>
  comments.map((c) => (c.id === tempId ? { ...c, status: 'failed', error } : c));
const removeComment = (comments, id) => comments.filter((c) => c.id !== id);
const editComment = (comments, id, body, at) =>
  comments.map((c) => (c.id === id ? { ...c, body, editedAt: at, status: 'sending' } : c));

const mergeServerComments = (server, local) => [...server, ...local.filter((c) => c.status !== 'sent')];

function normaliseBody(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;                            // whitespace is not a comment
  return trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
}

function timeAgo(ts, now) {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

const isSubmitShortcut = (event) => event.key === 'Enter' && (event.metaKey || event.ctrlKey);

/* ───────────── hooks/use-issue.js ───────────── */

function useIssue() {
  const [issue, setIssue] = useState({ kind: 'loading' });
  const [comments, setComments] = useState([]);
  const [commentsState, setCommentsState] = useState('loading');
  const [commentsError, setCommentsError] = useState(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [reload, setReload] = useState(0);
  const seed = useRef(0);
  const commentsRef = useRef([]);
  commentsRef.current = comments;

  useEffect(() => {
    const controller = new AbortController();
    // Skeleton on the FIRST load only: a refresh keeps the page the user is reading.
    setIssue((current) => (current.kind === 'ready' ? current : { kind: 'loading' }));
    fetchIssue(controller.signal)
      .then((value) => setIssue({ kind: 'ready', value }))
      .catch((error) => { if (error.name !== 'AbortError') setIssue({ kind: 'error', error: error.message }); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    setCommentsState('loading');
    fetchComments(controller.signal)
      .then((server) => {
        setComments((current) => mergeServerComments(server, current));   // pending survive a refetch
        setCommentsState('ready');
        setCommentsError(null);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setCommentsState('error');
        setCommentsError(error.message);
      });
    return () => controller.abort();
  }, [reload]);

  const send = useCallback((tempId, body) => {
    postComment(body)
      .then((saved) => setComments((c) => confirmComment(c, tempId, saved)))
      .catch((error) => setComments((c) => failComment(c, tempId, error.message)));
  }, []);

  const submit = useCallback(() => {
    const body = normaliseBody(draft);
    if (!body) return;
    const tempId = draftId(++seed.current + Date.now());
    setComments((c) => addOptimistic(c, { id: tempId, author: ME, body, createdAt: Date.now(), status: 'sending' }));
    setDraft('');                                       // safe: the text is already on screen
    send(tempId, body);
  }, [draft, send]);

  const retry = useCallback((id) => {
    const target = commentsRef.current.find((c) => c.id === id);
    if (!target) return;
    setComments((c) => c.map((x) => (x.id === id ? { ...x, status: 'sending', error: undefined } : x)));
    send(id, target.body);
  }, [send]);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    const body = normaliseBody(editing.body);
    if (!body) return;
    const { id } = editing;
    const previous = commentsRef.current.find((c) => c.id === id);        // capture BEFORE
    setComments((c) => editComment(c, id, body, Date.now()));
    setEditing(null);
    patchComment(id, body)
      .then((saved) => setComments((c) => confirmComment(c, id, saved)))
      .catch((error) => setComments((c) => c.map((comment) => (comment.id === id
        ? { ...comment, body: previous?.body ?? comment.body, status: 'failed', error: error.message }
        : comment))));
  }, [editing]);

  const remove = useCallback((id) => {
    const snapshot = commentsRef.current;                                 // the WHOLE list
    setComments((c) => removeComment(c, id));
    deleteComment(id).catch((error) => {
      setComments(snapshot);
      setCommentsError(error.message);
    });
  }, []);

  return { issue, comments, commentsState, commentsError, draft, setDraft, submit, retry, saveEdit,
    remove, editing, setEditing,
    discard: (id) => setComments((c) => removeComment(c, id)),
    refresh: () => setReload((n) => n + 1),
    failNext: () => { control.failNext = true; },
    pending: comments.filter((c) => c.status !== 'sent').length };
}

/* ───────────── App.jsx ───────────── */

const NOW = Date.now();

export default function App() {
  const v = useIssue();

  return (
    <section>
      <button type="button" onClick={v.refresh}>Refresh</button>
      <button type="button" onClick={v.failNext}>Fail next comment request</button>
      {v.pending > 0 && <span>{v.pending} unsent</span>}

      {v.issue.kind === 'loading' && <p aria-busy="true">Loading issue…</p>}
      {v.issue.kind === 'error' && (
        <p role="alert">{v.issue.error} <button type="button" onClick={v.refresh}>Retry</button></p>
      )}

      {v.issue.kind === 'ready' && (
        <article>
          <p>{v.issue.value.key}</p>
          <h2>{v.issue.value.summary}</h2>
          <p>{v.issue.value.description}</p>

          <section aria-label="Comments">
            <h3>Comments</h3>
            {v.commentsState === 'loading' && <p>Loading comments…</p>}
            {/* shown for a failed FETCH and for a rolled-back delete */}
            {v.commentsError && <p role="alert">{v.commentsError}</p>}

            <ul>
              {v.comments.map((comment) => (
                <li key={comment.id} className={`is-${comment.status}`}>
                  <p>
                    <strong>{comment.author}</strong>{' '}
                    <time dateTime={new Date(comment.createdAt).toISOString()}>
                      {timeAgo(comment.createdAt, NOW)}
                    </time>
                    {comment.editedAt && <span> edited</span>}
                    {comment.status === 'sending' && <span> sending…</span>}
                    {comment.status === 'failed' && <span> not sent</span>}
                  </p>

                  {v.editing?.id === comment.id ? (
                    <>
                      <textarea rows={3} value={v.editing.body} autoFocus
                        onChange={(event) => v.setEditing({ id: comment.id, body: event.target.value })}
                        onKeyDown={(event) => {
                          if (isSubmitShortcut(event)) { event.preventDefault(); v.saveEdit(); }
                          if (event.key === 'Escape') v.setEditing(null);
                        }} />
                      <button type="button" onClick={v.saveEdit}>Save</button>
                      <button type="button" onClick={() => v.setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <p>{comment.body}</p>
                  )}

                  {comment.status === 'failed' && (
                    <p role="alert">
                      {comment.error}
                      <button type="button" onClick={() => v.retry(comment.id)}>Retry</button>
                      <button type="button" onClick={() => v.discard(comment.id)}>Discard</button>
                    </p>
                  )}

                  {comment.author === ME && comment.status === 'sent' && !v.editing && (
                    <>
                      <button type="button" onClick={() => v.setEditing({ id: comment.id, body: comment.body })}>Edit</button>
                      <button type="button" onClick={() => v.remove(comment.id)}>Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <form onSubmit={(event) => { event.preventDefault(); v.submit(); }}>
              <label htmlFor="comment">Add a comment</label>
              <textarea id="comment" rows={3} value={v.draft}
                onChange={(event) => v.setDraft(event.target.value)}
                onKeyDown={(event) => { if (isSubmitShortcut(event)) { event.preventDefault(); v.submit(); } }} />
              <button type="submit" disabled={!v.draft.trim()}>Comment</button>
              <span>⌘↵ to send</span>
            </form>
          </section>
        </article>
      )}
    </section>
  );
}
```

**Build it in this order:** `fetchIssue` + the three states → the layout → `fetchComments` as its own
effect → the composer with `normaliseBody` → optimistic add + confirm → failed row with Retry/Discard →
edit with rollback → delete with the snapshot → `mergeServerComments` on refetch.

Narrate two lines: *"the draft box clears because the text is already visible in the list below"* and
*"the rollback captures the previous list before the optimistic write, through a ref so the callback
cannot go stale."*

---

## 10. Verification

```bash
node src/projects/jira-issue-view/utils/comments.check.ts
```

Asserts: draft ids distinguishable from server ids and unique within a tick; the optimistic comment drawn
last and the input list never mutated; confirm replacing in place without appending a second copy; fail
keeping the body and the reason and still counting as pending; retry returning to sending and then
confirming with the error cleared; discard restoring the original list exactly; edit setting body,
`editedAt` and `sending` while leaving the neighbour's identity alone; delete of a missing id changing
nothing; `mergeServerComments` keeping a pending draft at the end while taking the server's copies, not
duplicating a comment that has landed, and dropping one deleted elsewhere while a failed local one
survives; `normaliseBody` on whitespace, empty and over-length input; `isSubmitShortcut` for both
modifiers and not for plain Enter; and `timeAgo` at every boundary plus a clock skew.

Demo script (measured in the browser):

1. Load: the issue and fields render first, comments arrive ~250ms later.
2. Type a comment and press ⌘↵: it appears immediately at the end, dimmed, `1 unsent`; a second later it
   is a normal comment.
3. *Fail next comment request*, then post: the comment turns red, keeps its text, and offers **Retry** and
   **Discard**. Retry sends it for real.
4. Edit one of your comments with the failure armed: the text **rolls back** to what it was and the 409 is
   shown on that comment.
5. Delete with the failure armed: the comment disappears, then comes back in place with
   `403 — you can only delete your own comments` above the list.
6. Post a comment and press **Refresh** while it is still sending: the issue stays on screen (no
   skeleton), and after the refetch the list has every comment exactly once.

---

## 11. Cross-questions and answers

**"Why not just refetch after posting?"** It is a second round trip before the user sees their own words,
it discards anything else in flight, and it fails badly offline. Refetching is the recovery path, not the
happy path — and `mergeServerComments` is what makes it safe when it does happen.

**"Two people comment at the same time."** Both optimistic comments appear locally; each client's refetch
(or websocket event) brings the other's in. Ordering is the server's `createdAt`, so the lists converge.
The only visible artefact is a local comment briefly sitting below one that was actually earlier.

**"Threaded replies?"** `parentId` on the comment, render recursively, and keep the optimistic insert next
to its parent rather than at the end. The rollback logic is unchanged — which is the point of keeping it
as list transforms.

**"Rich text / mentions?"** The body becomes a document (see the ADF renderer question): store a node
tree, render through a registry, and never `dangerouslySetInnerHTML` a comment body — it is the most
user-controlled string on the page.

**"Thousands of comments?"** Paginate (`?after=<id>`), render newest last with a "load earlier" control,
and virtualise only if the DOM actually hurts; comments are usually tens, not thousands.

**"Realtime?"** A websocket event per comment, applied through the same three transforms
(`confirmComment`, `addOptimistic` for someone else's, `removeComment`). Because they are pure functions
over the list, the source of the change does not matter.

**"Accessibility?"** The composer has a real `<label>`; ⌘↵ submits while plain Enter stays a newline; each
failed comment's error is `role="alert"` so it is announced; times carry a machine-readable `dateTime`;
and the sending state is a word ("sending…"), not only reduced opacity.

**"What would you add with more time?"** An outbox in `localStorage` so an unsent comment survives a
reload, optimistic concurrency on edit (`If-Match` with the comment's version), and a confirm step on
delete — the only destructive action here.
