# Server-side Data Table — Interview Build Guide

Build an issues table backed by an API: search, filter by status, sort by any column, paginate, expand a
row to load its subtasks. The data does not fit in memory, so **the server does the work and the client
owns the query** — which turns the question into the two things it is really about: what the query is, and
what happens to the request that is already in flight when the query changes. Plain JavaScript, fresh
sandbox, 45 minutes.

Reported at Atlassian as: *"fetch from a mock API and render a table, then add sorting, filtering and
pagination"*, *"tasks and their subtasks grouped by status"*, *"the list comes paginated from the server —
show 10 at a time"*, and as the follow-up to the typeahead question (*"now the same, but the result set is
100k rows"*).

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: where does the work happen, how big is the set |
| 5–10 | The query object and the page envelope |
| 10–20 | Fetch, render, **abort** — the race is the whole question |
| 20–28 | Sorting (with the tiebreak), status tabs, debounced search |
| 28–36 | Pagination maths, clamping, empty and error states |
| 36–45 | Subtask rows, accessibility, scale |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
data-table/
  index.tsx                        # toolbar, table, pager, request log
  data-table.types.ts              # Task, Subtask, Query, Page<T>, Status, SortColumn
  data-table.css
  constants/tasks.ts               # 137 seeded tasks, statuses, page sizes, debounce
  utils/table-api.ts               # THE SERVER: filter, sort, slice, counts, latency, failure
  utils/table.utils.ts             # nextSort, clampPage, totalPages, rangeLabel, pageWindow, queryKey, ariaSort
  utils/table.check.ts
  hooks/use-task-table.ts          # query state, debounce, abort, keep-previous, expansion
  components/table-pagination.tsx
  components/task-row.tsx
```

---

## 1. Requirement gathering (5 minutes)

1. **"How many rows, and does the server paginate?"** The fork the whole design hangs on. *Default:
   more than fits in memory, server paginates.*
2. **"Does sorting apply to the page or the whole set?"** The question that catches people. Sorting the
   ten rows you happen to be holding is not sorting. *Default: server-side, whole set.*
3. **"Which columns are sortable, and is there a default order?"** *Default: all of them; newest updated
   first.*
4. **"Search: which fields, and how does it interact with the status filter?"** *Default: key, summary,
   assignee; search and status compose, and the tab counts describe the search result.*
5. **"Subtasks: in the payload or a separate call?"** *Default: a count in the row, the subtasks loaded
   on expand.*
6. **"What should the table do while the next page loads?"** *Default: keep the current rows, dim them.
   Never collapse to a spinner — the layout jumping is worse than the wait.*
7. **"Is the state in the URL?"** *Default: yes in production (a shared link must reproduce the view);
   here, local state with the same shape.*

Plan in one breath:

> "One query object — page, size, sort, dir, search, status — is the entire input to the server, and its
> serialised form is the cache key. Every change to it starts a request, aborts the one in flight and sets
> an ignore flag for the one that may already have resolved, so a slow earlier response can never overwrite
> a newer one. The server returns rows plus the filtered total
> and per-status counts, because the client cannot compute either. Rows stay on screen while the next page
> loads."

---

## 2. High-level design (HLD)

```text
   controls ──▶ Query { page, pageSize, sort, dir, search, status }
                   │           ▲
      search box ──┘ (debounced 300ms; every other control writes immediately, and resets page to 1)
                   │
             queryKey(query) ──── changes ───▶ useEffect
                   │                             ├─ AbortController for THIS request + `ignore` flag
                   │                             ├─ fetch → if (!ignore) setPage(result)
                   │                             └─ cleanup: ignore = true; controller.abort()
                   ▼
   server: filter → sort (+ stable tiebreak) → slice
                   │
                   ▼
   Page<T> { rows, total, page, pageSize, statusCounts }
                   │
      ┌────────────┼────────────────────────┐
   table rows   pager (total ÷ size)    status tabs (counts)
```

Four claims:

- **The query is the cache key.** `queryKey` contains exactly what the server reads. Two states that would
  produce the same page share a key; any difference is a refetch. That one function also makes "should
  this refetch?" a question with an answer instead of a dependency array argument.
- **The effect cleanup is the race fix — with two halves.** React runs the cleanup before the next effect:
  set an `ignore` flag there so a response that already resolved cannot write state, and abort so the one
  still on the wire stops costing anything. Either alone leaves a hole.
- **`total` and `statusCounts` must come from the server.** The client holds ten rows; it cannot know that
  137 match, and it certainly cannot count the ones it has never seen. Computing either locally is the bug
  that makes the pager say "page 1 of 1" on page 1 of 14.
- **Every filter resets the page.** Page 9 of an unfiltered list is not page 9 of the filtered one. Reset
  on change, and clamp defensively when a result comes back smaller than expected.

---

## 3. Low-level design (LLD)

```js
const [query, setQuery]     = useState(DEFAULT_QUERY);   // the whole server input
const [searchDraft, setDraft] = useState('');            // what the box shows, pre-debounce
const [page, setPage]       = useState(null);            // last successful Page<Task>
const [loading, setLoading] = useState(true);
const [error, setError]     = useState(null);
const [expanded, setExpanded] = useState(new Set());     // task ids
const [subtasks, setSubtasks] = useState({});            // id -> Subtask[] | 'loading'
```

```js
nextSort(query, column, fallback) -> Query          // asc → desc → default, and page: 1
totalPages(total, pageSize)       -> number         // at least 1, even for 0 rows
clampPage(page, total, pageSize)  -> number         // NaN-safe: a page from a URL is a string
rangeLabel(page, pageSize, total) -> 'Showing 21–30 of 137'
pageWindow(page, pages, span)     -> (number|null)[]  // null is a gap, never clickable
queryKey(query)                   -> string         // trimmed, lower-cased search
ariaSort(query, column)           -> 'ascending' | 'descending' | 'none'
```

---

## 4. The data model — the page envelope

```json
{ "rows": [ { "id": "t1", "key": "CONF-4100", "summary": "Editor drops selection after paste",
              "assignee": "Priya", "status": "in-progress", "points": 5,
              "updated": "2026-03-19", "subtaskCount": 3 } ],
  "total": 137, "page": 3, "pageSize": 10,
  "statusCounts": { "todo": 35, "in-progress": 40, "blocked": 29, "done": 33 } }
```

Three decisions worth defending:

- **`total` is the filtered count**, not the collection size and not `rows.length`. Everything the pager
  shows is derived from it.
- **`statusCounts` ignores the status filter but respects the search.** Otherwise selecting *Blocked*
  makes every other tab read zero, and the tabs stop being a way to see where the results are.
- **`updated` is an ISO date string.** ISO sorts correctly as a string, so the column needs no date
  parsing anywhere — and the moment the API returns `"19 Mar 2026"` instead, sorting silently becomes
  alphabetical. Say that out loud; it is a real bug in real tables.

---

## 5. Pass 1 — fetch, render, and the race (10 minutes)

### The ladder — what happens to the in-flight request

| Rung | Code | Type fast, then stop | Cost |
| --- | --- | --- | --- |
| V0 | `fetch(url).then(setRows)` | **a slow early response lands last and wins** — the table shows results for a query nobody is looking at | none, and it is wrong |
| V1 | `let ignore = false;` in the effect, cleanup sets it | correct | the response still arrives and is parsed |
| V2 | request-id counter compared on resolve | correct | same, plus bookkeeping |
| V3 | `AbortController` alone | **still races**: aborting a settled promise is a no-op | request cancelled on the wire |
| V4 | **`AbortController` + `ignore`** | correct | cancelled on the wire *and* no stale `setState` |

```js
useEffect(() => {
  const controller = new AbortController();
  let ignore = false;                               // ...and this is the half people forget
  setLoading(true);
  setError(null);

  queryTasks(query, controller.signal)
    .then((result) => { if (!ignore) setPage(result); })
    .catch((cause) => { if (!ignore && cause.name !== 'AbortError') setError(cause.message); })
    .finally(() => { if (!ignore) setLoading(false); });

  return () => { ignore = true; controller.abort(); };
}, [queryKey(query)]);                              // the key is the request
```

**Why both, and why this is the part interviewers push on.** `abort()` cancels a request that is still in
flight; it does nothing to a promise that has already settled. So there is a real window — the response is
read, its `.then` is queued as a microtask, the user types, React runs the cleanup, the abort no-ops, and
the queued callback writes stale rows. The `ignore` flag closes that window, which is why React's own
documentation uses a flag and does not mention `AbortController` here.

The controller still earns its place: without it a user typing through eight characters leaves eight
requests running against the search index, which on the server side is the difference between a debounce
and a load test. It also has to clear the mock's timer — a cancelled request that still costs a timeout is
not cancelled.

**Key on `queryKey(query)`, not on `query`.** The object is new on every `setQuery`, so depending on it
refetches when nothing the server reads has changed.

---

## 6. Pass 2 — sorting, search, tabs (8 minutes)

```js
export function nextSort(query, column, fallback) {
  if (query.sort !== column) return { ...query, sort: column, dir: 'asc', page: 1 };
  if (query.dir === 'asc')   return { ...query, dir: 'desc', page: 1 };
  return { ...query, sort: fallback.sort, dir: fallback.dir, page: 1 };   // third click = back to default
}
```

Three clicks rather than two, because "no sort" is a state users want back and a toggle cannot give them.
Every branch resets the page, in the pure function, so no caller can forget.

**The tiebreak is the part that gets noticed.** Sorting by `updated` when thirty rows share a date leaves
their relative order to the sort implementation on each call. Paging through then shows the same issue
twice and skips another — the classic "why did that row appear on both pages" bug:

```js
const result = collator.compare(left, right);
return (result !== 0 ? result : collator.compare(a.id, b.id)) * direction;   // stable, total order
```

`Intl.Collator` with `numeric: true` also gets `CONF-4109` before `CONF-4110`, which `<` gets right only by
accident of digit count, and handles case and accents the way a human expects.

Search is debounced into the query, and the input keeps its own immediate state so typing never waits:

```js
useEffect(() => {
  const timer = setTimeout(() =>
    setQuery((q) => (q.search === draft ? q : { ...q, search: draft, page: 1 })), 300);
  return () => clearTimeout(timer);
}, [draft]);
```

Returning `q` unchanged when the value matches keeps the identity stable, so the debounce firing on an
unchanged value cannot trigger a refetch.

---

## 7. Pass 3 — pagination, empty, error (8 minutes)

```js
export function pageWindow(page, pages, span = 2) {
  if (pages <= 1) return [1];
  const items = [];
  let from = Math.max(2, page - span);
  let to   = Math.min(pages - 1, page + span);
  if (from === 3) from = 2;              // a gap hiding ONE page is worse than the page
  if (to === pages - 2) to = pages - 1;  // "1 … 3" costs the same width as "1 2 3"
  items.push(1);
  if (from > 2) items.push(null);
  for (let value = from; value <= to; value += 1) items.push(value);
  if (to < pages - 1) items.push(null);
  items.push(pages);
  return items;
}
```

Those two lines came out of the check file: `pageWindow(1, 5)` was returning `1 2 3 … 5`. Gaps are `null`
and render as an inert `<span aria-hidden>`, never a disabled button — nothing in the tab order that
cannot be pressed.

Clamping is defensive, not decorative:

```js
useEffect(() => {
  if (!page) return;
  const clamped = clampPage(query.page, page.total, query.pageSize);
  if (clamped !== query.page) setQuery((q) => ({ ...q, page: clamped }));
}, [page, query.page, query.pageSize]);
```

Filters reset the page already; this catches the other route in — a page number restored from a URL or a
bookmark, or a result set that shrank because someone else closed twenty issues. `clampPage` handles
`NaN`, because a page number from a URL is a string until proven otherwise.

The empty state names the query and offers the way out (`Nothing matches "paste" in Blocked. Clear
filters.`); the error state keeps the rows that are already on screen, says what failed, and offers Retry.
A table that blanks itself on a failed refresh has thrown away the only data the user had.

---

## 8. Pass 4 — subtask rows (5 minutes)

```jsx
<tr>…</tr>
{isExpanded && (
  <tr className="dt__subrow">
    <td colSpan={7}>{subtasks === 'loading' ? 'Loading subtasks…' : <ul>…</ul>}</td>
  </tr>
)}
```

A second `<tr>` with one spanning cell, not a nested `<table>`: nesting a table breaks column alignment
and produces a second grid for screen readers to announce. The expander is a real `<button>` with
`aria-expanded` and a label naming the issue (`Show 3 subtasks of CONF-4137`) — "▸" alone is announced as
nothing.

Subtasks are fetched once per task and kept after collapse: re-collapsing is not a reason to throw away a
response, and re-expanding should not hit the network again.

---

## 9. The single-file version — what you actually type

```jsx
import { useEffect, useState } from 'react';

/* ───────────── constants/tasks.js ───────────── */

const STATUSES = ['todo', 'in-progress', 'blocked', 'done'];
const ALL_TASKS = Array.from({ length: 137 }, (_, i) => ({
  id: `t${i + 1}`,
  key: `CONF-${4100 + i}`,
  summary: ['Editor drops selection after paste', 'Mention picker slow', 'Page tree loses expansion',
            'Export drops table borders'][i % 4],
  assignee: ['Priya', 'Sam', 'Lee', 'Unassigned'][i % 4],
  status: STATUSES[i % 4],
  points: [1, 2, 3, 5, 8][i % 5],
  updated: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
  subtaskCount: i % 4,
}));

const DEFAULT_QUERY = { page: 1, pageSize: 10, sort: 'updated', dir: 'desc', search: '', status: 'all' };

/* ───────────── utils/table-api.js — this is the server ───────────── */

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function matches(task, needle, status) {
  if (status !== 'all' && task.status !== status) return false;
  if (!needle) return true;
  return `${task.key} ${task.summary} ${task.assignee}`.toLowerCase().includes(needle);
}

function queryTasks(query, signal) {
  const needle = query.search.trim().toLowerCase();
  const matched = ALL_TASKS.filter((task) => matches(task, needle, query.status));
  const direction = query.dir === 'asc' ? 1 : -1;
  const sorted = [...matched].sort((a, b) => {
    const result = query.sort === 'points'
      ? a.points - b.points
      : collator.compare(String(a[query.sort]), String(b[query.sort]));
    return (result !== 0 ? result : collator.compare(a.id, b.id)) * direction;   // stable tiebreak
  });

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const task of ALL_TASKS) if (matches(task, needle, 'all')) statusCounts[task.status] += 1;

  const start = (query.page - 1) * query.pageSize;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({
      rows: sorted.slice(start, start + query.pageSize),
      total: matched.length, page: query.page, pageSize: query.pageSize, statusCounts,
    }), 450);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);                                  // a cancelled request costs nothing
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

const fetchSubtasks = (task) => new Promise((resolve) => setTimeout(() => resolve(
  Array.from({ length: task.subtaskCount }, (_, i) => ({
    id: `${task.id}-s${i + 1}`, key: `${task.key}-${i + 1}`,
    summary: ['Write the failing test', 'Patch the handler', 'Update the docs'][i],
    status: i === 0 ? 'done' : 'todo',
  })), 250)));

/* ───────────── utils/table.utils.js — pure ───────────── */

const totalPages = (total, size) => Math.max(1, Math.ceil(total / Math.max(1, size)));
const clampPage = (page, total, size) =>
  Math.min(Math.max(1, Math.floor(page) || 1), totalPages(total, size));

const rangeLabel = (page, size, total) => total === 0 ? 'No matching issues'
  : `Showing ${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`;

function pageWindow(page, pages, span = 2) {
  if (pages <= 1) return [1];
  const items = [];
  let from = Math.max(2, page - span);
  let to = Math.min(pages - 1, page + span);
  if (from === 3) from = 2;
  if (to === pages - 2) to = pages - 1;
  items.push(1);
  if (from > 2) items.push(null);
  for (let v = from; v <= to; v += 1) items.push(v);
  if (to < pages - 1) items.push(null);
  items.push(pages);
  return items;
}

const queryKey = (q) =>
  [q.page, q.pageSize, q.sort, q.dir, q.search.trim().toLowerCase(), q.status].join('|');

function nextSort(query, column) {
  if (query.sort !== column) return { ...query, sort: column, dir: 'asc', page: 1 };
  if (query.dir === 'asc') return { ...query, dir: 'desc', page: 1 };
  return { ...query, sort: DEFAULT_QUERY.sort, dir: DEFAULT_QUERY.dir, page: 1 };
}

const ariaSort = (q, column) =>
  q.sort !== column ? 'none' : q.dir === 'asc' ? 'ascending' : 'descending';

/* ───────────── hooks/use-task-table.js ───────────── */

function useTaskTable() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [subtasks, setSubtasks] = useState({});

  useEffect(() => {                                        // debounce the box into the query
    const timer = setTimeout(() =>
      setQuery((q) => (q.search === draft ? q : { ...q, search: draft, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [draft]);

  const key = queryKey(query);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    queryTasks(query, controller.signal)
      .then(setPage)
      .catch((cause) => { if (cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [key]);                                               // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                        // the server decides how many pages exist
    if (!page) return;
    const clamped = clampPage(query.page, page.total, query.pageSize);
    if (clamped !== query.page) setQuery((q) => ({ ...q, page: clamped }));
  }, [page, query.page, query.pageSize]);

  const toggle = (task) => {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(task.id) ? next.delete(task.id) : next.add(task.id);
      return next;
    });
    setSubtasks((current) => {
      if (current[task.id] || task.subtaskCount === 0) return current;   // fetched once, kept
      fetchSubtasks(task).then((rows) => setSubtasks((s) => ({ ...s, [task.id]: rows })));
      return { ...current, [task.id]: 'loading' };
    });
  };

  return { query, setQuery, draft, setDraft, page, loading, error, expanded, subtasks, toggle,
    rows: page?.rows ?? [], total: page?.total ?? 0, pages: totalPages(page?.total ?? 0, query.pageSize),
    isStale: loading && page !== null };
}

/* ───────────── App.jsx ───────────── */

const COLUMNS = ['key', 'summary', 'assignee', 'status', 'points', 'updated'];

export default function App() {
  const t = useTaskTable();

  return (
    <section>
      <div className="toolbar">
        <input type="search" aria-label="Search issues" value={t.draft}
               placeholder="Search key, summary or assignee…"
               onChange={(event) => t.setDraft(event.target.value)} />
        {['all', ...STATUSES].map((status) => (
          <button key={status} type="button" aria-pressed={t.query.status === status}
                  onClick={() => t.setQuery((q) => ({ ...q, status, page: 1 }))}>
            {status}{t.page && status !== 'all' && ` ${t.page.statusCounts[status]}`}
          </button>
        ))}
      </div>

      {t.error && <p role="alert">{t.error} <button type="button" onClick={() => t.setQuery((q) => ({ ...q }))}>Retry</button></p>}

      <table className={t.isStale ? 'is-stale' : ''}>
        <caption className="sr">Issues, {t.total} matching, page {t.query.page} of {t.pages}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr">Expand</span></th>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" aria-sort={ariaSort(t.query, column)}>
                <button type="button" onClick={() => t.setQuery((q) => nextSort(q, column))}>
                  {column} {t.query.sort === column ? (t.query.dir === 'asc' ? '↑' : '↓') : '↕'}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((task) => (
            <Row key={task.id} task={task} expanded={t.expanded.has(task.id)}
                 subtasks={t.subtasks[task.id]} onToggle={t.toggle} />
          ))}
          {!t.loading && !t.error && t.rows.length === 0 && (
            <tr><td colSpan={7}>Nothing matches “{t.query.search}”.</td></tr>
          )}
        </tbody>
      </table>

      <div className="pager">
        <span>{rangeLabel(t.query.page, t.query.pageSize, t.total)}</span>
        <nav aria-label="Pagination">
          {pageWindow(t.query.page, t.pages).map((value, index) =>
            value === null
              ? <span key={`gap-${index}`} aria-hidden="true">…</span>
              : <button key={value} type="button" aria-label={`Page ${value}`}
                        aria-current={value === t.query.page ? 'page' : undefined}
                        onClick={() => t.setQuery((q) => ({ ...q, page: value }))}>{value}</button>)}
        </nav>
      </div>
    </section>
  );
}

function Row({ task, expanded, subtasks, onToggle }) {
  return (
    <>
      <tr>
        <td>
          {task.subtaskCount > 0 && (
            <button type="button" aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} ${task.subtaskCount} subtasks of ${task.key}`}
                    onClick={() => onToggle(task)}>{expanded ? '▾' : '▸'}</button>
          )}
        </td>
        <td>{task.key}</td><td>{task.summary}</td><td>{task.assignee}</td>
        <td>{task.status}</td><td>{task.points}</td><td>{task.updated}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7}>
            {subtasks === 'loading' || !subtasks
              ? 'Loading subtasks…'
              : <ul>{subtasks.map((s) => <li key={s.id}>{s.key} {s.summary} — {s.status}</li>)}</ul>}
          </td>
        </tr>
      )}
    </>
  );
}
```

**Build it in this order:** the query object and a hard-coded fetch → the table body → the effect with
`AbortController` keyed on `queryKey` → sortable headers with `nextSort` and `aria-sort` → debounced
search and status tabs → the pager with `rangeLabel`/`pageWindow` → empty, error and stale states →
subtask rows.

Narrate two lines: *"the cleanup sets ignore and aborts — abort cancels the request, ignore drops a
response that already resolved"* and *"the sort has a tiebreak on the id, or rows with equal values
reshuffle between pages."*

---

## 10. Verification

```bash
node src/projects/data-table/utils/table.check.ts
```

Asserts: the three-click sort cycle and its page reset; `aria-sort` reporting `none` for every other
column; pagination maths including an empty set, a short last page and a `NaN` page; `pageWindow` at the
edges, with no gap that hides a single page and no repeated or unordered page numbers; `queryKey`
normalising a trimmed, differently-cased search to the same key; consecutive pages never repeating a row;
the stable tiebreak returning the same order every call and `desc` being exactly `asc` reversed; numeric
collation putting `CONF-4109` before `CONF-4110`; the server's filter agreeing with a naive re-implementation
over six queries; status counts ignoring the status filter but respecting the search; and a page past the
end returning no rows rather than throwing.

Demo script:

1. Load: **Showing 1–10 of 137**, tabs read 35 / 40 / 29 / 33, one request in the log.
2. Type `paste` quickly: the log gains **one** request, not five, and the page resets to 1 (15 matches).
3. Click *Key* three times: ascending → descending → back to `updated:desc`. `CONF-4121` before
   `CONF-4124`; descending is the exact reverse.
4. While a page loads, the rows stay on screen and dim; they never disappear.
5. Click pages 2, 3, Next in quick succession: four requests logged, the table ends on **page 4 only** —
   the earlier ones were aborted.
6. *Fail next request*, then change a filter: the error line appears, the previous rows are still there,
   and Retry recovers.
7. Expand `CONF-4137`: one `GET /tasks/t38/subtasks`, three subtask rows; collapse and re-expand makes no
   second request.

---

## 11. Cross-questions and answers

**"Offset or cursor pagination?"** Offset is what a numbered pager needs, and it is what this UI shows.
Cursors (`?after=<id>`) are correct when rows are inserted while you page — offset skips and repeats rows
in that case — and when the table is deep enough that `OFFSET 100000` is a table scan. The trade is real:
cursors cannot answer "jump to page 400".

**"Why not fetch everything once and filter in memory?"** Under a few thousand rows that is genuinely
simpler and faster, and worth saying. It breaks on payload size, on freshness (your copy is stale the
moment someone edits an issue) and on permissions — the server must not send rows the user may not see
just so the client can filter them out.

**"What about React Query / SWR?"** They own exactly this: keyed cache, dedupe, keep-previous-data,
revalidation, retries. `queryKey` here is their `queryKey`. In production use one; in the interview the
abort and the key are the parts being examined.

**"100k rows on one page?"** Virtualise the body (`react-window`) and keep the row height fixed, or the
scrollbar lies. But a table nobody can scroll through is a search problem: better filters usually beat
more rows.

**"How do you test it?"** The pure layer as above, plus one differential test against a naive filter —
that is what catches an over-clever query builder. For the component: mock the API, assert the request
count after typing (debounce), and assert that a slow first response does not overwrite a fast second one.

**"Accessibility?"** `aria-sort` on the header cell (not the button), sort controls as real buttons, a
`<caption>` stating what the table holds and which page it is on, `aria-current="page"` on the pager, and
the expander labelled with the issue key. The status is also a word, never colour alone.

**"Persisting the view?"** Put the query in the URL: `?q=paste&status=blocked&sort=key:asc&page=3`. It is
the same object serialised, so it costs one `useSearchParams` and it makes every view shareable — and
`clampPage` is what stops a stale bookmark rendering an empty table.
