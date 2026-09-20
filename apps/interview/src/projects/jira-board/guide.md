# Jira Board (Kanban) — Interview Build Guide

Build a Jira/Trello board: columns configured at runtime (add, rename, reorder, WIP limits), issue cards
that move within and between columns by **drag-and-drop and by keyboard**, quick filters by text and
assignee, moves saved **optimistically** and rolled back when the server rejects them, and other people's
moves arriving without clobbering yours. Plain JavaScript, fresh sandbox. Target 45–60 minutes as a coding
question — and the same model answers the system-design round, which is the form Atlassian asks it in most
often.

Reported at Atlassian as: **system design** — *"Design a board similar to Jira. Initially for 1 user, later
extended to multiple users"*, *"design a Trello board with three different states … data model,
request/response payload and state management with normalisation"* (the candidate was rejected for not
normalising), *"a dynamic sprint dashboard where users could add columns such as Backlog, Scheduled, In
Progress, each containing tasks or stories; focus on reusable components and versioning"*, *"Jira sprint
board, what components would you use, how would you optimise the FE loading of thousands/millions of tickets,
how would you measure performance"*, *"Design the UI/UX experience of a Jira board (personal and team)"*,
*"Design a Kanban board: component breakdown, state management, drag and drop, data fetching and caching,
optimistic UI"* (P40 onsite); and as **browser coding** in the form of nested-list and card-list exercises.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| State | **Normalised**: `issues` by id, `columns` by id holding `issueIds`, `columnOrder`. A move touches two arrays. |
| Move maths | One pure `moveIssue(state, id, { columnId, index })` with the **same-column index shift** handled once. |
| Persistence | Send **neighbours, not indexes**: "rank X after Y in column Z" — the shape Jira's rank API uses, and the only one that survives concurrent edits. |
| Optimistic UI | Paint immediately; capture the undo as neighbours *before* the move; on failure re-rank back and toast. |
| Drag | HTML5 drag-and-drop with a measured drop index (card midpoints) **and** `Alt`+arrows for keyboard, with a live-region announcement. |
| Discussed, not built | LexoRank strings, virtualised swimlanes, WebSocket fan-out, permissions, drag of columns themselves. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: columns fixed or configurable? multi-user? scale? |
| 5–12 | **The data model — the part that fails candidates** |
| 12–22 | Columns + cards render from normalised state |
| 22–32 | **The move: pure function, index trap, drop index** |
| 32–42 | Optimistic save + rollback + conflicts |
| 42–50 | Keyboard moves, WIP limits, filters |
| 50–60 | Scale and multi-user discussion |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
jira-board/
  index.tsx                          # toolbar, columns, live region, server log, toasts
  jira-board.types.ts                # Issue, Column, BoardState, Position, BoardAction, MoveRequest
  jira-board.css
  constants/jira-board.constants.ts  # seeded board, assignees, latency
  utils/board.utils.ts               # pure: findPosition, moveIssue, moveIssueAfter, boardReducer,
                                     #       toMoveRequest, dropIndexFromMidpoints, columnViews, keyboardTarget
  utils/board.utils.check.ts
  utils/board-api.ts                 # PUT /rest/agile/1.0/issue/rank stand-in + failNext
  hooks/use-board.ts                 # reducer + optimistic persistence + drag state + keyboard
  components/board-column.tsx        # drop target, drop indicator, WIP header
  components/issue-card.tsx          # draggable card
```

---

## 1. Requirement gathering (5 minutes)

1. **"Are the columns fixed, or configured per board?"**
   Fixed → three hard-coded lists. Configured → columns are data, which changes the model.
   *Default: configurable (add, rename, reorder, WIP limit) — the reported "dynamic sprint dashboard".*
2. **"One user or a team on the same board?"**
   *Default: build for one, design for many — every move is expressed so it can be replayed from someone else.*
3. **"How many issues?"** *Default: a sprint board (tens to hundreds); a backlog is thousands → virtualise.*
4. **"What happens if a save fails?"** *Default: optimistic paint, rollback + toast on failure.*
5. **"Keyboard and screen reader?"** *Default: yes — drag-and-drop alone excludes people (and Atlassian ships its own accessible DnD libraries for exactly this).*
6. **"Do WIP limits block or warn?"** *Default: warn (Jira's behaviour).*
7. **"Filters — do they change the board or only the view?"** *Default: view only; hidden cards are counted.*

Plan:

> "Normalised state: issues by id, each column holding an array of issue ids, plus a column order. A move is
> one pure function over two arrays. I paint the move immediately and send the server 'rank this issue after
> that one in this column' — neighbours, not an index — so it still makes sense if someone else moved cards
> meanwhile; if it fails I re-rank back to the neighbour it had before. Dragging computes the drop index from
> card midpoints; Alt+arrows do the same move from the keyboard."

---

## 2. High-level design (HLD)

```text
                 ┌──────────────── BoardState (normalised) ────────────────┐
                 │ issues:   { i1: {key, summary, assignee, points, …} }   │
                 │ columns:  { todo: { title, wipLimit, issueIds: [...] } }│
                 │ columnOrder: ['todo','progress','review','done']        │
                 └───────────────┬────────────────────────────────────────┘
      drag drop / Alt+arrow      │ dispatch moveIssue(issueId, {columnId,index})
                 ┌───────────────▼────────────────┐
                 │ moveIssue  (pure, 2 arrays)     │  ← same-column index shift handled here
                 └───────────────┬────────────────┘
                                 │  toMoveRequest(next, issueId) → { columnId, afterId, beforeId }
                                 ▼
                 PUT /rest/agile/1.0/issue/rank  ──ok──▶ done
                                 │
                                fail ──▶ dispatch rankIssue(issueId, undo.columnId, undo.afterId)  + toast
                                 ▲
  remote move (WebSocket) ───────┘  same action shape: "rank X after Y"

 columnViews(state, filter) → per column: visible issues, hidden count, points, overWip
```

Claims:

- **Normalisation is the graded part.** With `columns: [{ title, issues: [{…}] }]`, moving an issue means
  finding it by scanning nested arrays and rebuilding both, every card object gets new identity, and two
  columns can end up holding two copies of the same issue.
- **Indexes are not a safe wire format.** Between the user's drop and the request landing, someone can insert
  a card; "index 3" then means a different slot. "After issue Y" does not move.
- **The same action shape serves three jobs**: my move, my rollback, and someone else's move.
- **Filtering is a view**, never a state change: `columnViews` derives what to render and reports what it hid.

---

## 3. Low-level design (LLD)

### State

```js
const [board, dispatch] = useReducer(boardReducer, INITIAL_BOARD);   // issues, columns, columnOrder
const [filter, setFilter] = useState({ text: '', assignee: null });
const [drag, setDrag]     = useState(null);   // { issueId, overColumnId, overIndex } while dragging
const [selectedId, setSelectedId] = useState(null);
const [pending, setPending] = useState(0);    // in-flight saves, for the "saving…" hint
```

### Pure function signatures

```js
findPosition(state, issueId)                  -> { columnId, index } | null
moveIssue(state, issueId, { columnId, index })-> state        // index semantics: position in the ORIGINAL list
moveIssueAfter(state, issueId, columnId, afterId) -> state    // the server's primitive; used for rollback + remote
boardReducer(state, action)                   -> state        // moveIssue | rankIssue | add/rename/move column | wip
toMoveRequest(state, issueId)                 -> { issueId, columnId, afterId, beforeId }
dropIndexFromMidpoints(midpoints, pointerY)   -> index
columnViews(state, filter)                    -> [{ id, title, issues, hiddenCount, points, overWip }]
keyboardTarget(state, issueId, key)           -> { columnId, index } | null
```

---

## 4. The data model

```json
{
  "issues": { "i1": { "id": "i1", "key": "CONF-4101", "summary": "Editor drops selection after paste",
                       "assignee": "Priya", "points": 5, "priority": "highest" } },
  "columns": { "progress": { "id": "progress", "title": "In Progress", "wipLimit": 3,
                              "issueIds": ["i1", "i2", "i7"] } },
  "columnOrder": ["todo", "progress", "review", "done"]
}
```

Move request (what goes over the wire):

```json
{ "issueId": "i3", "columnId": "progress", "afterId": "i1", "beforeId": "i2" }
```

### Ladder A — the state shape

| Rung | Find an issue | Move | Two columns can disagree | Card identity on unrelated change |
| --- | --- | --- | --- | --- |
| A0 `columns: [{ title, issues: [{…}] }]` (nested) | scan every column | rebuild nested arrays | **yes** (duplicate object) | **changes** → re-renders |
| A1 normalised `issues` + `issueIds` + `columnOrder` | `O(columns)` for position, `O(1)` for data | two arrays | impossible (one id list) | stable |
| A2 A1 + **rank strings** (LexoRank) instead of arrays | `O(1)` | write **one** field on the issue | impossible | stable |

What changes from A0 to A1: the issue's *data* and its *position* stop being the same object. Position lives in
one place (the column's id array), so a move cannot duplicate or lose a card, and untouched columns keep
their identity so React skips them.

A2 is what Jira actually does: each issue carries a rank string (`0|i0004:`) and ordering is a sort. Moving
one card writes one field instead of rewriting a list — which matters when two people move cards at once, and
when the list is 10 000 long and lives on a server. Say it; build A1 (rank strings need a rebalancing scheme,
which is not a 45-minute problem).

---

## 5. Pass 1 — render the board (target: 10 minutes)

```jsx
{board.columnOrder.map((columnId) => {
  const column = board.columns[columnId];
  return (
    <section key={columnId}>
      <h2>{column.title} <span>{column.issueIds.length}{column.wipLimit && ` / ${column.wipLimit}`}</span></h2>
      <ul>{column.issueIds.map((id) => <IssueCard key={id} issue={board.issues[id]} />)}</ul>
    </section>
  );
})}
```

Two lines of rendering, because the model is right. `columnViews` then adds filtering, points and the WIP flag
in one pass so the JSX stays this flat.

---

## 6. Pass 2 — the move (target: 10 minutes)

```js
export function moveIssue(state, issueId, to) {
  const from = findPosition(state, issueId);
  if (!from || !state.columns[to.columnId]) return state;

  const sameColumn = from.columnId === to.columnId;
  const targetIndex = sameColumn && to.index > from.index ? to.index - 1 : to.index;  // ← the trap
  if (sameColumn && targetIndex === from.index) return state;                          // no-op keeps identity

  const source = [...state.columns[from.columnId].issueIds];
  source.splice(from.index, 1);
  const destination = sameColumn ? source : [...state.columns[to.columnId].issueIds];
  destination.splice(Math.max(0, Math.min(targetIndex, destination.length)), 0, issueId);

  return { ...state, columns: { ...state.columns,
    [from.columnId]: { ...state.columns[from.columnId], issueIds: sameColumn ? destination : source },
    [to.columnId]:   { ...state.columns[to.columnId],   issueIds: destination } } };
}
```

**The index trap**: the drop index is computed against the list *as the user sees it* — with the dragged card
still in it. Removing the card first shifts every later position down by one, so a downward move inside one
column must decrement the target. Get this wrong and cards land one slot too low, which looks like a random
bug and is the single most common defect in a hand-rolled board.

The drop index itself comes from geometry, not guesswork:

```js
const midpoints = cards.map((card) => { const b = card.getBoundingClientRect(); return b.top + b.height / 2; });
const index = midpoints.findIndex((middle) => pointerY < middle);   // -1 → past the last card → append
```

`onDragOver` **must** call `event.preventDefault()`, or `drop` never fires — the second most common defect.

---

## 7. Pass 3 — optimistic save, rollback, other people (target: 10 minutes)

### Ladder B — what to send

| Rung | Payload | Two users moving at once | Rollback |
| --- | --- | --- | --- |
| B0 whole column | `['i1','i3','i2']` | **last write wins**, silently discards the other move | replace the array |
| B1 index | `{ issueId, columnId, index: 3 }` | index means something else by the time it lands | needs the old index, also stale |
| **B2 neighbours** | `{ issueId, columnId, afterId, beforeId }` | server re-ranks between the same two cards | **re-rank back to the old neighbour** |

```js
const commitMove = (issueId, to) => {
  const next = moveIssue(board, issueId, to);
  if (next === board) return;                          // dropped where it already was
  const undo = toMoveRequest(board, issueId);          // BEFORE the move: where it was, as neighbours
  dispatch({ type: 'moveIssue', issueId, to });        // paint now

  persistMove(toMoveRequest(next, issueId)).catch((error) => {
    dispatch({ type: 'rankIssue', issueId, columnId: undo.columnId, afterId: undo.afterId });
    toast(`${board.issues[issueId].key} moved back — ${error.message}`);
  });
};
```

Why the undo is captured as **neighbours** rather than `{ columnId, index }`: by the time the failure comes
back, other cards may have moved; "put it back after CONF-4102" still means the right slot, while "put it back
at index 2" may not. The check file asserts a move followed by its rollback reproduces the original board
exactly, in every direction (up, down, across, to an empty column).

A remote move (WebSocket) is the *same* action: `rankIssue(issueId, columnId, afterId)`. Because it is
expressed relative to neighbours, applying it to a board that has drifted still puts the card in the intended
place.

---

## 8. Pass 4 — keyboard, WIP, filters (target: 8 minutes)

```js
// Alt + arrows: move the focused card. Plain arrows keep their normal meaning.
const target = keyboardTarget(board, issueId, event.key);   // left/right = adjacent column, clamped index
if (target) { commitMove(issueId, target); announce(`${key} moved to ${title}, position ${index + 1}`); }
```

- Announce every move in a `role="status"` live region — a keyboard user gets no visual drag feedback.
- `aria-roledescription="Draggable issue. Press alt with arrow keys to move."` tells screen-reader users the
  affordance exists. (Atlassian's own `react-beautiful-dnd` / `pragmatic-drag-and-drop` exist because this is
  hard; in production, use them.)
- WIP limits **warn**: the header and border change when `issueIds.length > wipLimit`. Counting uses all cards
  in the column, not the filtered ones — a filter must not make a breach disappear.
- Filters are view-level; each column reports `hiddenCount` so an empty-looking column explains itself.

---

## 9. If this is the system-design round

Same model, wider frame. Cover these in order:

1. **Scope**: one board, one sprint, ~200 issues visible; backlog view is the thousands case.
2. **Component tree**: `Board → Toolbar (filters, avatars) → ColumnList → Column (header, WIP, droppable) →
   Card (draggable)`, plus `IssueDetailPanel`. Cards are pure and memoised; the drag layer is separate so a drag
   re-renders one card, not the board.
3. **API contracts**:
   `GET /board/:id/config` → columns, WIP limits, swimlane config ·
   `GET /board/:id/issues?sprint=&fields=` → normalised issues (paginated for the backlog) ·
   `PUT /issue/rank { issueId, columnId, afterId, beforeId }` ·
   `PUT /issue/:id/transition { statusId }` when a column maps to a workflow status ·
   `WS /board/:id` → `{ type: 'ranked' | 'updated' | 'created', … }`.
4. **State**: normalised store; server cache (React Query / RTK Query) keyed by board+sprint; the drag state is
   local UI state and never goes into the cache.
5. **Thousands of tickets**: the board shows a sprint, not a backlog; for the backlog, virtualise rows per
   swimlane, paginate by cursor, and keep only summary fields (`key, summary, assignee, points, status`) —
   detail loads on open. Measure with `performance.mark` around the first meaningful paint and per-drag frame
   times; watch INP for the drag interaction.
6. **Multi-user**: WebSocket fan-out of rank events; apply them with the same `rankIssue` action; last-write-wins
   per issue with a rank string; show "Sam moved CONF-4103" toasts; on reconnect, refetch the board and diff.
7. **Conflicts**: two people move the same card — the server accepts both, the later rank wins, and both clients
   converge because the event is relative to neighbours. A card moved into a column that was deleted meanwhile
   falls back to the first column with a toast.
8. **Permissions**: the server enforces transitions; the client greys columns the user may not move into.
9. **Failure**: optimistic with rollback (built), offline queue for moves, and a "board out of date, refresh"
   banner after repeated conflicts.

---

## 10. The single-file version — what you actually type

```jsx
import { useReducer, useRef, useState } from 'react';

/* ───────────── constants/board.constants.js ───────────── */

const INITIAL = {
  issues: {
    i1: { id: 'i1', key: 'CONF-4101', summary: 'Editor drops selection after paste', assignee: 'Priya', points: 5 },
    i2: { id: 'i2', key: 'CONF-4102', summary: 'Mention picker slow', assignee: 'Sam', points: 3 },
    i3: { id: 'i3', key: 'CONF-4103', summary: 'Page tree loses expansion', assignee: null, points: 2 },
    i4: { id: 'i4', key: 'CONF-4104', summary: 'Inline comments overlap', assignee: 'Lee', points: 3 },
  },
  columns: {
    todo: { id: 'todo', title: 'To Do', wipLimit: null, issueIds: ['i3'] },
    progress: { id: 'progress', title: 'In Progress', wipLimit: 2, issueIds: ['i1', 'i2'] },
    done: { id: 'done', title: 'Done', wipLimit: null, issueIds: ['i4'] },
  },
  columnOrder: ['todo', 'progress', 'done'],
};

/* ───────────── utils/board.utils.js — pure ───────────── */

function findPosition(state, issueId) {
  for (const columnId of state.columnOrder) {
    const index = state.columns[columnId].issueIds.indexOf(issueId);
    if (index !== -1) return { columnId, index };
  }
  return null;
}

function moveIssue(state, issueId, to) {
  const from = findPosition(state, issueId);
  if (!from || !state.columns[to.columnId]) return state;
  const same = from.columnId === to.columnId;
  const target = same && to.index > from.index ? to.index - 1 : to.index;   // the index-shift trap
  if (same && target === from.index) return state;
  const source = [...state.columns[from.columnId].issueIds];
  source.splice(from.index, 1);
  const destination = same ? source : [...state.columns[to.columnId].issueIds];
  destination.splice(Math.max(0, Math.min(target, destination.length)), 0, issueId);
  return { ...state, columns: { ...state.columns,
    [from.columnId]: { ...state.columns[from.columnId], issueIds: same ? destination : source },
    [to.columnId]: { ...state.columns[to.columnId], issueIds: destination } } };
}

function moveIssueAfter(state, issueId, columnId, afterId) {      // the server's primitive
  const from = findPosition(state, issueId);
  if (!from) return state;
  const source = [...state.columns[from.columnId].issueIds];
  source.splice(from.index, 1);
  const destination = from.columnId === columnId ? source : [...state.columns[columnId].issueIds];
  destination.splice(afterId === null ? 0 : destination.indexOf(afterId) + 1, 0, issueId);
  return { ...state, columns: { ...state.columns,
    [from.columnId]: { ...state.columns[from.columnId], issueIds: from.columnId === columnId ? destination : source },
    [columnId]: { ...state.columns[columnId], issueIds: destination } } };
}

function toMoveRequest(state, issueId) {
  const at = findPosition(state, issueId);
  if (!at) return null;
  const ids = state.columns[at.columnId].issueIds;
  return { issueId, columnId: at.columnId, afterId: ids[at.index - 1] ?? null, beforeId: ids[at.index + 1] ?? null };
}

const dropIndexFromMidpoints = (midpoints, pointerY) => {
  const i = midpoints.findIndex((middle) => pointerY < middle);
  return i === -1 ? midpoints.length : i;
};

function keyboardTarget(state, issueId, key) {
  const from = findPosition(state, issueId);
  if (!from) return null;
  const col = state.columnOrder.indexOf(from.columnId);
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const next = col + (key === 'ArrowRight' ? 1 : -1);
    if (next < 0 || next >= state.columnOrder.length) return null;
    const columnId = state.columnOrder[next];
    return { columnId, index: Math.min(from.index, state.columns[columnId].issueIds.length) };
  }
  if (key === 'ArrowUp') return from.index === 0 ? null : { columnId: from.columnId, index: from.index - 1 };
  if (key === 'ArrowDown') {
    const size = state.columns[from.columnId].issueIds.length;
    return from.index >= size - 1 ? null : { columnId: from.columnId, index: from.index + 2 };
  }
  return null;
}

function boardReducer(state, action) {
  switch (action.type) {
    case 'moveIssue': return moveIssue(state, action.issueId, action.to);
    case 'rankIssue': return moveIssueAfter(state, action.issueId, action.columnId, action.afterId);
    case 'addColumn': return { ...state,
      columns: { ...state.columns, [action.id]: { id: action.id, title: action.title, wipLimit: null, issueIds: [] } },
      columnOrder: [...state.columnOrder, action.id] };
    case 'renameColumn': return { ...state,
      columns: { ...state.columns, [action.columnId]: { ...state.columns[action.columnId], title: action.title } } };
    default: return state;
  }
}

/* ───────────── utils/board-api.js ───────────── */

let failNext = false;
const persistMove = (request) =>
  new Promise((resolve, reject) => setTimeout(() => {
    if (failNext) { failNext = false; reject(new Error('409 — someone else moved this issue')); }
    else { console.log('rank', request); resolve(); }
  }, 500));

/* ───────────── hooks/use-board.js ───────────── */

function useBoard() {
  const [board, dispatch] = useReducer(boardReducer, INITIAL);
  const [drag, setDrag] = useState(null);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const commitMove = (issueId, to) => {
    const next = moveIssue(board, issueId, to);
    if (next === board) return;
    const undo = toMoveRequest(board, issueId);                  // neighbours, before the move
    dispatch({ type: 'moveIssue', issueId, to });
    persistMove(toMoveRequest(next, issueId)).catch((e) => {
      dispatch({ type: 'rankIssue', issueId, columnId: undo.columnId, afterId: undo.afterId });
      setError(`${board.issues[issueId].key} moved back — ${e.message}`);
    });
  };

  const onCardKeyDown = (event, issueId) => {
    if (!event.altKey) return;
    const target = keyboardTarget(board, issueId, event.key);
    if (!target) return;
    event.preventDefault();
    commitMove(issueId, target);
    setAnnouncement(`${board.issues[issueId].key} moved to ${board.columns[target.columnId].title}`);
  };

  return { board, drag, setDrag, error, announcement, commitMove, onCardKeyDown, dispatch,
    fail: () => { failNext = true; } };
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const b = useBoard();
  const listRefs = useRef(new Map());

  const indexFromEvent = (columnId, event) => {
    const list = listRefs.current.get(columnId);
    const midpoints = [...list.querySelectorAll('.card')].map((card) => {
      const box = card.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    return dropIndexFromMidpoints(midpoints, event.clientY);
  };

  return (
    <main>
      <button onClick={b.fail}>Fail next save</button>
      {b.error && <p role="alert">{b.error}</p>}
      <p role="status">{b.announcement}</p>

      <div className="columns">
        {b.board.columnOrder.map((columnId) => {
          const column = b.board.columns[columnId];
          const over = column.wipLimit !== null && column.issueIds.length > column.wipLimit;
          return (
            <section
              key={columnId}
              className={over ? 'column over-wip' : 'column'}
              onDragOver={(event) => {
                event.preventDefault();                                   // without this, no drop event
                setDragOver(b, columnId, indexFromEvent(columnId, event));
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (b.drag) b.commitMove(b.drag.issueId, { columnId, index: indexFromEvent(columnId, event) });
                b.setDrag(null);
              }}
            >
              <h2>
                <input value={column.title}
                  onChange={(e) => b.dispatch({ type: 'renameColumn', columnId, title: e.target.value })} />
                <span>{column.issueIds.length}{column.wipLimit !== null && ` / ${column.wipLimit}`}</span>
              </h2>
              <ul ref={(el) => { if (el) listRefs.current.set(columnId, el); }}>
                {column.issueIds.map((id, index) => {
                  const issue = b.board.issues[id];
                  return (
                    <li key={id}>
                      {b.drag?.overColumnId === columnId && b.drag.overIndex === index && <div className="indicator" />}
                      <div
                        className="card"
                        draggable
                        tabIndex={0}
                        aria-roledescription="Draggable issue. Press alt with arrow keys to move."
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', id);   // Firefox needs data
                          b.setDrag({ issueId: id, overColumnId: null, overIndex: null });
                        }}
                        onDragEnd={() => b.setDrag(null)}
                        onKeyDown={(event) => b.onCardKeyDown(event, id)}
                      >
                        <p>{issue.summary}</p>
                        <small>{issue.key} · {issue.points} pts · {issue.assignee ?? 'Unassigned'}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function setDragOver(b, columnId, index) {
  b.setDrag((current) =>
    current && (current.overColumnId !== columnId || current.overIndex !== index)
      ? { ...current, overColumnId: columnId, overIndex: index }
      : current);
}
```

**Build it in this order:** the normalised constant + render columns and cards (5 minutes, and the model is
already the answer to the design question) → `findPosition` + `moveIssue` with a button that moves a card →
HTML5 drag with `preventDefault` on `dragOver` → measured drop index + indicator → optimistic `commitMove` +
rollback → Alt+arrow keyboard + live region → WIP limits + filters → column add/rename.

Narrate: `const target = same && to.index > from.index ? to.index - 1 : to.index` — *"removing the card first
shifts everything below it"* — and `toMoveRequest(board, issueId)` before dispatching — *"capture the undo as
neighbours, because indexes go stale while the request is in flight."*

---

## 11. Verification

```bash
node src/projects/jira-board/utils/board.utils.check.ts
```

Asserts: moves across columns copy only the two affected columns and never touch `issues`; the same-column
index shift in both directions and to the very end; a drop where the card already is returns the **same object**;
clamping past the end; `toMoveRequest` neighbours; **move + rollback round-trips to the original board** for
four different moves; `moveIssueAfter` with a null neighbour; reducer column add/reorder/rename/WIP;
`columnViews` filtering (hidden counts, WIP counted over all cards, points); drop index from midpoints; and
every keyboard target including the clamped column change and the two "already at the edge" nulls.

Demo script:

1. Focus the first card, `Alt`+`→` → it moves to In Progress; the log shows `rank i3 → progress before i1`;
   the live region announces the move.
2. *Fail next save*, `Alt`+`→` again → the card moves immediately, then jumps back with a toast reading
   `409 — someone else moved this issue`.
3. Drag a card from In Progress to In Review, dropping below the last card → a blue indicator shows the slot,
   and the request is `rank … after i4`.
4. Set *In Progress* WIP to 2 → the header and border warn while it holds 3.
5. Filter by `Priya` → other cards hide, each column reports how many it hid, and the WIP warning stays.
6. *Another user moves a card* → a card jumps with a toast, exactly as a WebSocket event would.

---

## 12. Cross-questions and answers

**"Why not store an `order` number on each issue?"** Renumbering on every insert is `O(n)` writes. Fractional
ranks (`between(prev, next)`) fix that but the fractions degrade; LexoRank solves it with rebalancing —
Jira's answer, and worth naming.

**"Cards jump one slot too low when I drag within a column."** That is the index-shift bug: the drop index was
measured with the card still in the list.

**"Nothing happens when I drop."** `onDragOver` did not call `preventDefault()`; the element is not a drop
target, so `drop` never fires. On mobile there is no HTML5 drag at all — pointer events or a library.

**"Would you use a library?"** In production, yes: `@atlaskit/pragmatic-drag-and-drop` (or `dnd-kit`) for
accessible, performant dragging including touch and auto-scroll. In the interview the point is the state
model and the move maths, which the library does not do for you.

**"Ten thousand cards?"** A board shows a sprint; a backlog virtualises. Keep summary fields only; load issue
detail on demand; memoise cards on `issue` identity so a move re-renders two columns, not the board.

**"How do you test drag-and-drop?"** The logic is pure — `moveIssue`, `dropIndexFromMidpoints` and
`keyboardTarget` are unit-tested without a DOM. Then Testing Library for the keyboard path (`alt+ArrowRight`
and the announcement), and Playwright for real mouse dragging.

**"Two users drop on the same slot at the same time."** Both requests are "after Y"; the server applies them in
arrival order, so one ends up after the other — no lost card, no duplicate. Both clients receive both events
and converge.
