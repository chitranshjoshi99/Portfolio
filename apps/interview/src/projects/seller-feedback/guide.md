# Seller Feedback Console — Interview Build Guide

Build a moderation queue: searchable, filterable, paginated, with optimistic approve/reject, rollback
on failure, and per-row retry. Plain JavaScript, fresh CodeSandbox. Target 50–60 minutes.

This guide is a script for the room: what to ask, what to say, what to type, and where to stop.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Read path | **Precomputed index** behind the API — sorted once, bucketed by status, search text pre-lowercased. A query with no search term is `O(page size)`, whatever `n` is. |
| Caching | **Page cache with a single invalidation point** — every write clears it, and there is exactly one write path. |
| Writes | **Optimistic with exact rollback**, per-row pending and per-row retry. |
| Discussed, not built | Inverted token index, server-side SQL with `(status, submitted_at)`, keyset cursors, per-row write versioning, TanStack Query. |

The filter→sort→slice scan is written first and kept — as the oracle the index is diffed against, not
as the read path.

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements, assumptions stated out loud |
| 5–12 | HLD, row shape, query shape |
| 12–24 | **The read path: scan oracle, then the index, then the differential check** |
| 24–32 | Fake async API, debounced race-safe reads |
| 32–46 | Optimistic writes, rollback, per-row retry — the centrepiece |
| 46–54 | Loading/empty/error states, pagination edges |
| 54–60 | Demo, scale and concurrency talk |

---

## 0. Sandbox setup

React + JS, one file, split later.

```text
src/
  App.jsx
  styles.css
```

Target split (this repo's layout):

```text
seller-feedback/
  index.tsx
  seller-feedback.types.ts              # Feedback, FeedbackQuery, FeedbackPage, FeedbackStatus
  seller-feedback.css
  constants/feedback-seed.ts            # the fake table
  constants/seller-feedback.constants.ts# page size, debounce, messages, failure rates
  utils/feedback.utils.ts               # pure: buildFeedbackIndex, applyQuery, withStatus,
                                        #       statusCounts, patchRowStatus, totalPages,
                                        #       applyQueryByScan (the test oracle)
  utils/feedback-api.ts                 # fake backend: latency, jitter, failures, the index,
                                        #               and the page cache
  hooks/use-debounced-value.ts
  hooks/use-feedback-console.ts         # query state, reads, optimistic writes, retry
  hooks/use-demo-controls.ts            # force failures / reset data during the demo
  components/feedback-toolbar.tsx
  components/feedback-row.tsx
  components/pagination-bar.tsx
  components/demo-controls.tsx
```

Say: *"The fake API is a hard boundary — it owns the data and it fails on purpose. Everything above
it has to handle latency, out-of-order responses and rejected writes for real, which is the actual
question here."*

---

## 1. Requirement gathering (5 minutes)

1. **"Does the server filter and paginate, or does the client hold all rows?"**
   The single biggest fork. Client-side means one fetch and pure functions. Server-side means every
   filter change is a request, with debounce, races and loading states.
   *Default: server-side query — that's the realistic version and the harder one.*
2. **"How many rows total?"**
   Earns the algorithm discussion later, and decides offset vs cursor pagination.
   *Default: thousands, growing.*
3. **"What does search cover — buyer, order id, comment body?"**
   *Default: all three, case-insensitive.*
4. **"Can moderation writes fail? Permissions, conflicts, network?"**
   If they can't, optimistic updates are trivial and the question is boring. They can.
   *Default: yes, ~30% failure rate wired in so rollback is demonstrable.*
5. **"Bulk actions, or one row at a time?"**
   *Default: one row. Bulk is an extension — and a different concurrency problem.*
6. **"Multiple moderators on the same queue? Live updates?"**
   *Default: single user, refetch after write. Polling/websockets are the follow-up.*
7. **"Default sort?"**
   *Default: newest first — the only order a review queue is ever wanted in.*

State the plan:

> "The server is the source of truth for reads. Reads are debounced and race-guarded so only the
> newest response can write to state. Writes go optimistic — the row flips immediately — but I keep
> the previous value so a rejected write rolls back exactly that row, not the table. Failures are
> stored per row so retry repeats the action the user actually asked for."

---

## 2. High-level design (HLD)

```text
 ┌──────────────────────────────────────────────────────────────────┐
 │ useFeedbackConsole                                               │
 │                                                                  │
 │  QUERY STATE            search ──debounce 300ms──▶ debouncedSearch│
 │                         status, page                             │
 │                                │                                 │
 │                                ▼                                 │
 │  READ PATH        ┌────────────────────────┐                     │
 │                   │ effect: listFeedback() │ ── requestId guard ──┼──▶ items, total
 │                   └────────────────────────┘   (drop stale)      │    isLoading, listError
 │                                                                  │
 │  WRITE PATH       setFeedbackStatus(id, next)                    │
 │                     1. remember previousStatus                   │
 │                     2. setItems(optimistic)   ← instant UI       │
 │                     3. pendingIds.add(id)                        │
 │                     4. await updateFeedbackStatus                │
 │                        ok   → reload()  (server reconciles)      │
 │                        fail → setItems(previousStatus)           │
 │                                failedById[id] = { status, msg }  │
 └──────────────────────────────┬───────────────────────────────────┘
                                │ props / handlers
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
 <FeedbackToolbar>        <FeedbackRow>            <PaginationBar>
  search, status filter    status, actions,         clamped page nav
                           pending, error, retry

                    ┌──────────────────────────────────────┐
                    │ feedback-api (fake backend)          │
                    │  index: { sorted, byStatus, byId }   │
                    │  pageCache: key -> page              │
                    │  latency + jitter + failures         │
                    │  listFeedback  -> cache | applyQuery │
                    │  updateFeedbackStatus -> withStatus, │
                    │                          clear cache │
                    └──────────────────────────────────────┘
```

Four claims about this picture:

- **Reads and writes are different problems.** Reads need *ordering* (drop stale responses). Writes
  need *reversibility* (roll back). Different mechanisms; do not conflate them.
- **`pendingIds` is a `Set` and `failedById` is a map keyed by row id.** Both are per-row on purpose —
  one failing row must never disable the table.
- **After a successful write, refetch.** The mutation may have moved the row out of the current
  filter, or changed the total. The optimistic value was a guess; the server has the answer.
- **`applyQuery` is pure and lives on the fake server side.** Same function a real backend would run
  as SQL. That framing is what makes the client/server split a design decision rather than an accident.
- **The index and the cache live with the data, not with React.** They are the server's business.
  Putting either in a hook would mean the client caching something it does not own, which is how a
  UI ends up serving rows a write already invalidated.

---

## 3. Low-level design (LLD)

### State

```js
const [search, setSearch] = useState('');
const [status, setStatus] = useState('all');
const [page, setPage]     = useState(1);
const debouncedSearch     = useDebouncedValue(search, 300);

const [items, setItems]       = useState([]);   // current page only
const [total, setTotal]       = useState(0);    // count of the FILTERED set, not the page
const [isLoading, setLoading] = useState(true);
const [listError, setError]   = useState(null);
const [reloadToken, setReloadToken] = useState(0);   // bump to force a refetch

const [pendingIds, setPendingIds] = useState(() => new Set());  // rows with a write in flight
const [failedById, setFailedById] = useState({});               // id -> { status, message }

const latestRequestId = useRef(0);
```

`total` is the one that gets fumbled: it must be the size of the **filtered** set, not
`items.length`. Page 3 of 5 has 5 items and a total of 47; pagination needs 47.

`reloadToken` in the effect dependency array is a deliberate, readable "refetch now" trigger. Say so —
otherwise it reads like a hack.

### Function signatures

```js
// server side of the boundary — runs against the whole table
buildFeedbackIndex(rows)          -> { sorted, byStatus, byId }   // O(n log n), once + per write
applyQuery(index, query)          -> { items, total }             // O(p) with no search term
withStatus(index, id, status)     -> newIndex                     // O(n), re-buckets, never re-sorts
statusCounts(index)               -> { pending, approved, rejected }   // O(1)

// client side — runs against the page on screen
patchRowStatus(rows, id, status)  -> newRows                      // O(p) optimistic flip
totalPages(total, pageSize)       -> number

// neither: the oracle
applyQueryByScan(rows, query)     -> { items, total }             // O(n + m log m), test only
```

Two boundaries worth naming while writing these:

- **The index lives on the server side**, because the server owns the table. The client holds one
  page, so its optimistic patch is `O(p)` over that page — a different function on purpose.
- `patchRowStatus` is a *prediction of the server's transformation*. It must agree with what
  `withStatus` will do, which is why the check file asserts the index result matches a scan over the
  mutated rows. If the two can diverge, the UI lies for the length of a request.

---

## 4. The data model

```json
{
  "id": "fb-014",
  "buyer": "A. Sharma",
  "orderId": "ORD-3391",
  "rating": 2,
  "comment": "Item arrived two days late but packaging was fine.",
  "submittedAt": "2026-05-04T09:12:00.000Z",
  "status": "pending"
}
```

The query, as a single object — this is the contract with the backend:

```json
{ "search": "sharma", "status": "pending", "page": 2, "pageSize": 5 }
```

The response:

```json
{ "items": [ /* pageSize rows */ ], "total": 47 }
```

The index the server serves from — derived from the rows, never a second source of truth:

```json
{
  "sorted":   [ /* every row, newest-first, each with a precomputed `search` string */ ],
  "byStatus": { "pending": [ /* … */ ], "approved": [ /* … */ ], "rejected": [ /* … */ ] },
  "byId":     "Map<id, row>"
}
```

Three modelling notes worth stating:

- **The index is derived, and rebuilt on write.** Editing a bucket in place is what makes a stale
  bucket outlive its data; re-deriving means the only way to be wrong is to be wrong everywhere at
  once, which shows up immediately.
- **`submittedAt` stays an ISO string.** It is serialisable, sorts correctly with a plain string
  compare (ISO 8601 is lexicographically ordered), and survives `JSON.parse` without a revival step.
  Converting to `Date` at the boundary buys nothing here.
- **`status` is a closed set** (`pending | approved | rejected`), not a boolean. `isApproved` cannot
  express "rejected", and adding a fourth state to a boolean is a migration.

---

## 5. Pass 1 — the read path (target: 12 minutes)

Everything the list does — search, filter, sort, paginate — happens behind the API boundary. Write it
as pure functions first, test them without React, then decide what runs per query and what runs once.

Let **n** = total rows, **m** = rows matching the filter, **p** = page size.

Say the verdict before climbing:

> "I'll write the filter-sort-slice version first because it takes two minutes and gives me a
> correctness oracle. Then I'm building an index — the rows sorted once, bucketed by status, with the
> searchable text precomputed — so a query with no search term never looks at a row at all. I'll
> assert the two agree."

### V0 — filter and slice, in that order

```js
const visible = all
  .filter((f) => f.comment.toLowerCase().includes(search.toLowerCase()))
  .slice((page - 1) * 5, page * 5);
```

`O(n)` per keystroke, plus `n` lowercase allocations per character typed. Three bugs to name:

- **No sort**, so the order is insertion order — a review queue must be newest-first.
- **`total` is unknowable** from this, so pagination cannot render "page 2 of 10".
- **Page is not clamped.** Filter down to 3 rows while sitting on page 7 and the user gets a blank
  table with no way back — the single most common bug in this exercise.

### V1 — filter → sort → clamp → slice (the oracle)

```js
const matchesSearch = (feedback, search) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return feedback.buyer.toLowerCase().includes(needle)
      || feedback.orderId.toLowerCase().includes(needle)
      || feedback.comment.toLowerCase().includes(needle);
};

const matchesStatus = (f, status) => status === 'all' || f.status === status;

const totalPages = (total, pageSize) => Math.max(1, Math.ceil(total / pageSize));

function applyQueryByScan(all, query) {
  const filtered = all
    .filter((f) => matchesSearch(f, query.search) && matchesStatus(f, query.status))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));   // newest first

  const page = Math.min(Math.max(1, query.page), totalPages(filtered.length, query.pageSize));
  const start = (page - 1) * query.pageSize;

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
}
```

`O(n + m log m)`. The order of the four steps is the whole answer, and each has a failure mode:

| Step | Get it wrong and… |
| --- | --- |
| filter **before** slice | slicing first gives short pages — page 1 shows 2 of 5 rows |
| sort **after** filter | sorting all n rows to throw most away is wasted work |
| clamp **before** slice | a narrowed filter strands the user on an empty page 7 |
| `total` = filtered length | pagination shows the wrong page count, last page unreachable |

Keep this function. It never runs in the app — it is the reference the index is diffed against.

### V2 — precomputed index ← **build this**

Three costs in V1 repeat on every single query, and all three are avoidable because the data changes
far less often than it is read.

```js
const searchKey = (f) => `${f.buyer} ${f.orderId} ${f.comment}`.toLowerCase();

function buildFeedbackIndex(rows) {
  // sorted ONCE. filter preserves order and sort is stable (ES2019+), so queries never sort again
  const sorted = rows
    .map((row) => ({ ...row, search: searchKey(row) }))     // haystack built once, not per keystroke
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const byStatus = { pending: [], approved: [], rejected: [] };
  const byId = new Map();
  for (const row of sorted) {
    byStatus[row.status].push(row);        // pushed in sorted order, so each bucket is sorted too
    byId.set(row.id, row);
  }
  return { sorted, byStatus, byId };
}

function applyQuery(index, query) {
  const candidates = query.status === 'all' ? index.sorted : index.byStatus[query.status];
  const needle = query.search.trim().toLowerCase();
  const filtered = needle ? candidates.filter((row) => row.search.includes(needle)) : candidates;

  const page = Math.min(Math.max(1, query.page), totalPages(filtered.length, query.pageSize));
  const start = (page - 1) * query.pageSize;

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
}
```

Four things to say while typing it — these are what is being graded:

1. **Sorting moved from per-query to once.** It is legal only because `filter` preserves order and
   `sort` is stable; state that, because it is the load-bearing assumption. Without stability the
   buckets would drift out of order and the bug would be invisible until a tie appeared.
2. **The status filter became a lookup.** `byStatus[status]` *is* the filtered, sorted answer.
3. **With no search term, the query touches no row.** Bucket, clamp, slice — `O(p)`, independent of
   `n`. That is the headline number: the default view of a million-row queue costs the same as a
   five-row one.
4. **The counts come free.** `byStatus.pending.length` is the toolbar's "Pending (23)" without the
   second full scan V1 needed.

Writes re-derive the index, and deliberately do not re-sort — a status change cannot move a row in
`submittedAt` order:

```js
function withStatus(index, id, status) {
  const current = index.byId.get(id);                  // O(1)
  if (!current || current.status === status) return index;   // no-op writes return the same object

  const updated = { ...current, status };
  const sorted = index.sorted.map((row) => (row.id === id ? updated : row));

  const byStatus = { pending: [], approved: [], rejected: [] };
  const byId = new Map(index.byId).set(id, updated);
  for (const row of sorted) byStatus[row.status].push(row);   // re-bucket, never re-sort
  return { sorted, byStatus, byId };
}
```

`O(n)` per write with no comparisons. Say the trade out loud: *"Writes got more expensive so reads
got cheaper. In a moderation queue reads outnumber writes by orders of magnitude, so that is the
right direction — and it is the same reason a database indexes a column you filter on and accepts a
slower `INSERT`."*

### V3 — cache whole pages, with one invalidation point ← **build this too**

Paging within one filter should not re-filter. The cache lives with the data, in the fake API:

```js
let pageCache = new Map();
const cacheKey = (q) => `${q.search.trim().toLowerCase()}|${q.status}|${q.page}|${q.pageSize}`;

async function listFeedback(query) {
  const key = cacheKey(query);
  if (pageCache.has(key)) return pageCache.get(key);
  const page = applyQuery(index, query);
  pageCache.set(key, page);
  return page;
}

async function updateFeedbackStatus(id, status) {
  index = withStatus(index, id, status);
  pageCache = new Map();     // the ONLY write path, and therefore the only invalidation point
}
```

The invalidation is the part to defend, not the cache: **a cache is only safe when every writer
clears it, so there must be exactly one writer.** Point at the single `updateFeedbackStatus` and say
that. A cache with two write paths and one invalidator is how an approved row keeps rendering as
pending — and it looks like a backend bug for a week.

### V4 — the server and its index (discussed, not built)

For text search at real scale the answer is an inverted index of tokens → row ids, intersected per
query term. Say it, then say where it belongs:

> "At that point I'm rebuilding a database in the browser, which is the signal to stop. In production
> this is `WHERE status = $1 AND search_vector @@ $2 ORDER BY submitted_at DESC LIMIT 5 OFFSET 10`
> with an index on `(status, submitted_at)` — the same three structures I just built, maintained by
> something that does it better. And I'd move OFFSET to a keyset cursor, because OFFSET 10000 makes
> the database count 10,000 rows it will not return."

### Comparison

| | Per query, no search | Per query, with search | Setup / write | Verdict |
| --- | --- | --- | --- | --- |
| V0 filter+slice | `O(n)` + allocations | `O(n)` | — | wrong results (no sort, no clamp) |
| V1 scan (oracle) | `O(n + m log m)` | `O(n + m log m)` | — | kept as the test |
| **V2 index** | **`O(p)`** | `O(candidates)` | `O(n log n)` once, `O(n)` per write | **built** |
| **V3 + page cache** | `O(1)` on a hit | `O(1)` on a hit | full clear per write | **built** |
| V4 server + DB index | `O(log n + p)` | `O(log n + p)` | maintained by the DB | past ~10k rows |

**Why V2 wins:** every cost V1 pays per query is derivable from data that has not changed. Sorting,
lower-casing and status partitioning all depend only on the rows, so they belong on the write path,
which runs rarely. What is left at read time — pick a bucket, clamp, slice — is the only part that
genuinely depends on the query. The general rule, worth saying in exactly these words: *move work to
the axis that changes least often.*

**Where V2 costs you:** memory (a second copy of every row, plus the buckets), and a write that is
now `O(n)`. Both are the correct side of the trade for a read-heavy queue, and both stop being
correct if the table is written to as often as it is read.

```bash
node src/projects/seller-feedback/utils/feedback.utils.check.ts
```

The check runs 128 query combinations through both `applyQuery` and `applyQueryByScan` and asserts
identical ids and totals. That differential is what makes shipping the index defensible rather than
brave — point at the line that prints `index === scan`.

---

## 6. Pass 2 — the async boundary and race-safe reads (target: 10 minutes)

Make the fake backend hostile:

```js
let index = buildFeedbackIndex(FEEDBACK_SEED);            // module state: writes must survive refetch
let pageCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.5 + Math.random());        // so two calls CAN resolve out of order

async function listFeedback(query) {
  await sleep(jitter(450));
  if (Math.random() < LIST_FAILURE_RATE) throw new Error('list failed');
  const key = cacheKey(query);
  if (pageCache.has(key)) return pageCache.get(key);
  const page = applyQuery(index, query);
  pageCache.set(key, page);
  return page;
}

async function updateFeedbackStatus(id, status) {
  await sleep(jitter(700));
  if (Math.random() < mutationFailureRate) throw new Error('update failed');
  index = withStatus(index, id, status);
  pageCache = new Map();                                  // one writer, one invalidation point
}
```

`db` at module scope is deliberate: a successful write has to survive the refetch that follows it,
otherwise "optimistic update then reload" would visibly undo itself and hide real bugs.

Debounce the *value the effect reads*, never the input setter:

```js
const debouncedSearch = useDebouncedValue(search, 300);
```

Reset to page 1 whenever the filter changes — a narrower filter has fewer pages:

```js
useEffect(() => { setPage(1); }, [debouncedSearch, status]);
```

Then the read effect, with the ordering guard:

```js
useEffect(() => {
  const requestId = ++latestRequestId.current;
  setIsLoading(true);

  listFeedback({ search: debouncedSearch, status, page, pageSize: 5 })
    .then((result) => {
      if (requestId !== latestRequestId.current) return;   // stale response — drop it
      setItems(result.items);
      setTotal(result.total);
      setListError(null);
    })
    .catch(() => {
      if (requestId !== latestRequestId.current) return;
      setListError('Could not load feedback.');
    })
    .finally(() => {
      if (requestId === latestRequestId.current) setIsLoading(false);
    });
}, [debouncedSearch, status, page, reloadToken]);
```

Without the id: click "next page" twice quickly, page 2's slower response lands after page 3's, and
the table shows page 2 while the control says page 3. Intermittent, network-dependent, survives code
review — say that; it is why the guard is not optional.

Keep the old rows visible and dimmed while loading rather than blanking the table. A table that
empties on every keystroke reads as broken even when it is correct.

**Demonstrate:** type fast → one request; change the filter on page 4 → back to page 1; force slow
responses → stale ones never land.

---

## 7. Pass 3 — optimistic writes, rollback, retry (target: 14 minutes)

The centrepiece. Walk the ladder.

### V0 — Pessimistic: wait, then refetch

```js
async function setStatus(id, next) {
  setIsLoading(true);
  await updateFeedbackStatus(id, next);
  reload();
}
```

Correct, and it is the right default for irreversible or high-stakes actions — say that, because
"always be optimistic" is a wrong answer. Here it costs 700ms of nothing happening per click, and a
moderator clicks hundreds of times an hour. The cost is real; the risk (a status flag) is low.

### V1 — optimistic with exact rollback ← **build this**

```js
async function setFeedbackStatus(id, nextStatus) {
  const previousStatus = items.find((i) => i.id === id)?.status;
  if (previousStatus === undefined || previousStatus === nextStatus) return;   // nothing to do

  setItems((current) => patchRowStatus(current, id, nextStatus)); // 1. flip the row NOW
  togglePending(id, true);                                       // 2. mark that row busy
  setFailedById(({ [id]: _dropped, ...rest }) => rest);          // 3. clear its old failure

  try {
    await updateFeedbackStatus(id, nextStatus);
    reload();                       // 4a. server is truth: totals/filters may have moved
  } catch {
    setItems((current) => patchRowStatus(current, id, previousStatus)); // 4b. exact rollback
    setFailedById((current) => ({
      ...current,
      [id]: { status: nextStatus, message: `Could not ${nextStatus === 'approved' ? 'approve' : 'reject'} this review.` },
    }));
  } finally {
    togglePending(id, false);
  }
}
```

The five details that make this an answer rather than a snippet:

1. **Capture `previousStatus` before the optimistic write**, not inside the catch. By the time the
   catch runs, `items` already holds the optimistic value — rolling back to "current" is a no-op, and
   the bug is invisible until a request actually fails.
2. **Roll back to the exact previous value, not to a default.** Hardcoding `'pending'` corrupts a row
   that was `approved` and is being changed to `rejected`.
3. **Store the failure keyed by row id, with the attempted status.** Retry then repeats what the user
   asked for. A global "something failed" banner cannot do that.
4. **Per-row pending**, so one slow request disables one row's buttons — not the table.
5. **Refetch after success.** The row may no longer belong in the current filter, and the total moved.
   The optimistic value was a prediction; only the server knows the truth.

Retry is then three lines, because the intent was stored:

```js
function retry(id) {
  const failure = failedById[id];
  if (failure) setFeedbackStatus(id, failure.status);
}
```

Note `setFailedById(({ [id]: _dropped, ...rest }) => rest)` — destructuring-with-rest is the concise
immutable key delete. Worth one sentence, not three.

### V2 — Concurrency, when writes can overlap

Two rapid clicks on one row (approve → reject) are two in-flight writes with no ordering guarantee.
The slower one wins and the row ends up in the state the user *didn't* pick last.

Three fixes, in ascending cost:

- **Disable the row while pending** (`pendingIds.has(id)`). One line, and it is what this build does.
  Ship it.
- **Per-row write version.** Bump a counter per row on each write; ignore a response whose version
  isn't current — the write-path twin of the read path's `requestId`.
- **Serialise per row.** Keep a promise chain per id so writes apply in click order. Necessary when
  the writes aren't idempotent (incrementing a counter, appending to a log).

For bulk actions the same problem scales up: fire N writes and you need partial-failure handling —
`Promise.allSettled`, a per-row result map, and a summary like "3 of 5 approved". Mention it as the
extension; do not build it.

### V3 — What the library does

TanStack Query's `onMutate` / `onError` / `onSettled` is exactly this shape: snapshot, optimistic
patch, rollback with the snapshot, invalidate on settle. Say so, then say why you hand-rolled it: the
interviewer is checking whether you know what the library is doing on your behalf. In production,
use the library and add request idempotency keys so a retried write can't apply twice server-side.

---

## 8. Pass 4 — states and edges (target: 8 minutes)

| State | Rendering rule |
| --- | --- |
| Initial load | skeleton rows, not a blank table |
| Refetching | previous rows dimmed, kept mounted |
| Empty results | "No feedback matches these filters." + a clear-filters action |
| List error | message + **Retry** (calls `reload()`), previous rows kept if any |
| Row pending | that row's buttons disabled + spinner |
| Row failed | inline message on the row + Retry + Dismiss |

Pagination must clamp at both ends:

```js
const pageCount = totalPages(total, PAGE_SIZE);
const goToPage = (next) => setPage(Math.min(Math.max(1, next), pageCount));
```

Disable Prev on page 1 and Next on the last page — `aria-disabled` plus actually not firing, so a
keyboard user gets the same behaviour as a mouse user. Announce "Page 2 of 10" in a live region.

Accessibility that costs nothing: a real `<table>` with `<th scope="col">`, buttons labelled
`aria-label={`Approve review from ${buyer}`}` rather than "Approve" ×20, and `role="alert"` on row
failures.

`DemoControls` (force mutation failures, reset the seed data) is not padding — it is what lets you
*demonstrate* rollback on demand instead of clicking until a random failure happens. Building your
own demo affordance reads well.

---

## 9. The single-file version — what you actually type

Everything above is the conversation. This is the code. In a real 50-minute slot you build it
top-to-bottom in `App.jsx` and say *"in a repo this splits into utils / api / hook / components along
these comment banners."*

Assumes the CSS classes already exist. No styles here.

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';

/* ───────────── constants + seed ───────────── */

const PAGE_SIZE = 5;
const DEBOUNCE_MS = 300;
const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'];

const SEED = [
  { id: 'fb-1', buyer: 'A. Sharma', orderId: 'ORD-3391', rating: 2, comment: 'Arrived two days late.',      submittedAt: '2026-05-04T09:12:00.000Z', status: 'pending' },
  { id: 'fb-2', buyer: 'M. Okafor', orderId: 'ORD-3388', rating: 5, comment: 'Exactly as described.',        submittedAt: '2026-05-03T16:40:00.000Z', status: 'approved' },
  { id: 'fb-3', buyer: 'L. Chen',   orderId: 'ORD-3402', rating: 1, comment: 'Wrong size, seller ignored me.',submittedAt: '2026-05-05T11:05:00.000Z', status: 'pending' },
  { id: 'fb-4', buyer: 'R. Silva',  orderId: 'ORD-3375', rating: 4, comment: 'Good packaging, slow dispatch.',submittedAt: '2026-05-01T08:22:00.000Z', status: 'rejected' },
  { id: 'fb-5', buyer: 'K. Tanaka', orderId: 'ORD-3399', rating: 3, comment: 'Fine, nothing special.',       submittedAt: '2026-05-04T19:31:00.000Z', status: 'pending' },
  { id: 'fb-6', buyer: 'P. Novak',  orderId: 'ORD-3410', rating: 5, comment: 'Fast delivery, will buy again.',submittedAt: '2026-05-06T07:48:00.000Z', status: 'pending' },
];

/* ───────────── utils/feedback.utils.js — pure ───────────── */

const totalPages = (total, pageSize) => Math.max(1, Math.ceil(total / pageSize));

const searchKey = (f) => `${f.buyer} ${f.orderId} ${f.comment}`.toLowerCase();

// built once, and again per write. sorted ONCE; filter preserves order and sort is stable,
// so no query ever sorts again.
function buildFeedbackIndex(rows) {
  const sorted = rows
    .map((row) => ({ ...row, search: searchKey(row) }))   // haystack built here, not per keystroke
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const byStatus = { pending: [], approved: [], rejected: [] };
  const byId = new Map();
  for (const row of sorted) {
    byStatus[row.status].push(row);      // pushed in sorted order, so each bucket is sorted too
    byId.set(row.id, row);
  }
  return { sorted, byStatus, byId };
}

// read path: pick a bucket, filter by text, clamp, slice.
// with no search term this touches ZERO rows — O(page size), whatever n is.
function applyQuery(index, query) {
  const candidates = query.status === 'all' ? index.sorted : index.byStatus[query.status];
  const needle = query.search.trim().toLowerCase();
  const filtered = needle ? candidates.filter((row) => row.search.includes(needle)) : candidates;

  const page = Math.min(Math.max(1, query.page), totalPages(filtered.length, query.pageSize));
  const start = (page - 1) * query.pageSize;

  // total counts the FILTERED set, not the page — pagination needs it
  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
}

// server write: re-bucket, never re-sort (a status change can't move a row in date order)
function withStatus(index, id, status) {
  const current = index.byId.get(id);
  if (!current || current.status === status) return index;

  const updated = { ...current, status };
  const sorted = index.sorted.map((row) => (row.id === id ? updated : row));
  const byStatus = { pending: [], approved: [], rejected: [] };
  const byId = new Map(index.byId).set(id, updated);
  for (const row of sorted) byStatus[row.status].push(row);
  return { sorted, byStatus, byId };
}

// client write: one row of the page on screen. a prediction of what withStatus will do.
const patchRowStatus = (rows, id, status) =>
  rows.map((row) => (row.id === id ? { ...row, status } : row));

// the oracle: obviously correct, never on the read path, kept so the index can be diffed against it
function applyQueryByScan(all, query) {
  const needle = query.search.trim().toLowerCase();
  const filtered = all
    .filter((f) => (!needle || searchKey(f).includes(needle))
                && (query.status === 'all' || f.status === query.status))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const page = Math.min(Math.max(1, query.page), totalPages(filtered.length, query.pageSize));
  const start = (page - 1) * query.pageSize;
  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
}

/* ───────────── utils/feedback-api.js — the fake backend ───────────── */

let index = buildFeedbackIndex(SEED);   // module scope: a write must survive the next refetch
let pageCache = new Map();              // key -> page. paging within a filter must not re-filter
let mutationFailureRate = 0.3;          // set to 1 in the demo to prove rollback

const cacheKey = (q) => `${q.search.trim().toLowerCase()}|${q.status}|${q.page}|${q.pageSize}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (ms) => ms * (0.5 + Math.random()); // so two calls CAN resolve out of order

async function listFeedback(query) {
  await sleep(jitter(450));
  const key = cacheKey(query);
  if (pageCache.has(key)) return pageCache.get(key);
  const page = applyQuery(index, query);
  pageCache.set(key, page);
  return page;
}

async function updateFeedbackStatus(id, status) {
  await sleep(jitter(700));
  if (Math.random() < mutationFailureRate) throw new Error('update failed');
  index = withStatus(index, id, status);
  pageCache = new Map();   // the ONLY write path, and therefore the only invalidation point
}

/* ───────────── hooks ───────────── */

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function useFeedbackConsole() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [failedById, setFailedById] = useState({});

  const latestRequestId = useRef(0);

  // a narrower filter can leave you stranded on a page that no longer exists
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);

    listFeedback({ search: debouncedSearch, status, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (requestId !== latestRequestId.current) return; // stale response — drop it
        setItems(result.items);
        setTotal(result.total);
        setListError(null);
      })
      .catch(() => {
        if (requestId !== latestRequestId.current) return;
        setListError('Could not load feedback.');
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });
  }, [debouncedSearch, status, page, reloadToken]);

  const pageCount = totalPages(total, PAGE_SIZE);
  const goToPage = useCallback((next) => setPage(Math.min(Math.max(1, next), pageCount)), [pageCount]);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const togglePending = useCallback((id, isPending) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setFeedbackStatus = useCallback(
    async (id, nextStatus) => {
      // capture BEFORE the optimistic write, or the rollback restores the optimistic value
      const previousStatus = items.find((item) => item.id === id)?.status;
      if (previousStatus === undefined || previousStatus === nextStatus) return;

      setItems((current) => patchRowStatus(current, id, nextStatus)); // flip the row now
      togglePending(id, true);
      setFailedById(({ [id]: _dropped, ...rest }) => rest);

      try {
        await updateFeedbackStatus(id, nextStatus);
        reload();                                                // server is the source of truth
      } catch {
        setItems((current) => patchRowStatus(current, id, previousStatus)); // exact rollback
        setFailedById((current) => ({
          ...current,
          [id]: { status: nextStatus, message: `Could not ${nextStatus} this review.` },
        }));
      } finally {
        togglePending(id, false);
      }
    },
    [items, reload, togglePending],
  );

  const retry = useCallback(
    (id) => {
      const failure = failedById[id];
      if (failure) setFeedbackStatus(id, failure.status); // repeat what the user actually asked for
    },
    [failedById, setFeedbackStatus],
  );

  const dismissFailure = useCallback((id) => {
    setFailedById(({ [id]: _dropped, ...rest }) => rest);
  }, []);

  return {
    search, setSearch, status, setStatus, items, total, page, pageCount, goToPage,
    isLoading, listError, reload, pendingIds, failedById, setFeedbackStatus, retry, dismissFailure,
  };
}

/* ───────────── components ───────────── */

function FeedbackRow({ feedback, isPending, failure, onSetStatus, onRetry, onDismiss }) {
  return (
    <tr className={isPending ? 'feedback__row is-pending' : 'feedback__row'}>
      <td>{feedback.buyer}<br /><small>{feedback.orderId}</small></td>
      <td>{'★'.repeat(feedback.rating)}</td>
      <td>{feedback.comment}</td>
      <td>{new Date(feedback.submittedAt).toLocaleDateString()}</td>
      <td><span className={`badge badge--${feedback.status}`}>{feedback.status}</span></td>
      <td>
        <button
          disabled={isPending || feedback.status === 'approved'}
          aria-label={`Approve review from ${feedback.buyer}`}
          onClick={() => onSetStatus(feedback.id, 'approved')}
        >
          Approve
        </button>
        <button
          disabled={isPending || feedback.status === 'rejected'}
          aria-label={`Reject review from ${feedback.buyer}`}
          onClick={() => onSetStatus(feedback.id, 'rejected')}
        >
          Reject
        </button>

        {failure && (
          <p className="feedback__row-error" role="alert">
            {failure.message}
            <button onClick={() => onRetry(feedback.id)}>Retry</button>
            <button onClick={() => onDismiss(feedback.id)}>Dismiss</button>
          </p>
        )}
      </td>
    </tr>
  );
}

export default function App() {
  const c = useFeedbackConsole();

  return (
    <section className="feedback">
      <h1>Seller feedback</h1>

      <div className="feedback__toolbar">
        <input
          className="feedback__search"
          placeholder="Search buyer, order or comment…"
          value={c.search}
          onChange={(event) => c.setSearch(event.target.value)}
        />
        <select value={c.status} onChange={(event) => c.setStatus(event.target.value)}>
          {STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <span aria-live="polite">{c.isLoading ? 'Loading…' : `${c.total} results`}</span>
      </div>

      {c.listError && (
        <p className="feedback__error" role="alert">
          {c.listError} <button onClick={c.reload}>Retry</button>
        </p>
      )}

      {/* keep old rows mounted while refetching — a table that blanks reads as broken */}
      <table className={c.isLoading ? 'feedback__table is-loading' : 'feedback__table'}>
        <thead>
          <tr>
            <th scope="col">Buyer</th><th scope="col">Rating</th><th scope="col">Comment</th>
            <th scope="col">Date</th><th scope="col">Status</th><th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {c.items.map((feedback) => (
            <FeedbackRow
              key={feedback.id}
              feedback={feedback}
              isPending={c.pendingIds.has(feedback.id)}
              failure={c.failedById[feedback.id]}
              onSetStatus={c.setFeedbackStatus}
              onRetry={c.retry}
              onDismiss={c.dismissFailure}
            />
          ))}
        </tbody>
      </table>

      {!c.isLoading && c.items.length === 0 && (
        <p className="feedback__empty">No feedback matches these filters.</p>
      )}

      <div className="feedback__pagination">
        <button disabled={c.page <= 1} onClick={() => c.goToPage(c.page - 1)}>Prev</button>
        <span aria-live="polite">Page {c.page} of {c.pageCount}</span>
        <button disabled={c.page >= c.pageCount} onClick={() => c.goToPage(c.page + 1)}>Next</button>
      </div>
    </section>
  );
}
```

**Build it in this order:** `applyQueryByScan` + a static table (correct rows on screen in 8 minutes,
and you now have an oracle) → `buildFeedbackIndex` + `applyQuery`, switch the API to it → the fake
async API and the page cache → debounce → the `requestId` guard → pagination clamping → optimistic
writes → rollback → per-row retry. If time runs out you stop on a working race-safe list rather than a
half-finished mutation path.

The scan comes first so the screen is never empty and the fast path has something to be checked
against — not because the scan is the plan. Swap `listFeedback` to the index the moment it exists.

Two lines to point at while typing, because they are what the question is testing:

- `const previousStatus = items.find(...)` sitting **above** the optimistic `setItems`. Move it into
  the `catch` and the code still compiles, still passes a happy-path demo, and silently rolls back to
  the wrong value.
- `pageCache = new Map()` inside `updateFeedbackStatus`. Delete it and everything still works until a
  moderator approves a row, pages away and comes back to see it pending — which will be reported as a
  backend bug.

## 10. Verification

```bash
node src/projects/seller-feedback/utils/feedback.utils.check.ts
```

It prints `differential: 128 queries, index === scan` before the pass line — that is the evidence the
index is equivalent to the obvious implementation, across every search/status/page combination.

Demo script, in this order:

1. Type quickly → one request for the final term (show the network/latency).
2. Go to page 4, change the status filter → back to page 1, correct rows.
3. Force slow responses, click through pages fast → the table always matches the page control.
4. Approve a row → it flips instantly, spinner on that row only, other rows stay usable.
5. Force 100% mutation failure → approve → the row reverts to its exact previous status, inline error
   on that row, table unaffected.
6. Click Retry → the same action is re-attempted; turn failures off → it succeeds and the list
   refetches.
7. Filter to something with no matches → the empty state, not a blank table.

---

## 11. Cross-questions and answers

**"Why a request id if you also have AbortController?"**
Abort saves bandwidth but doesn't guarantee a settled handler won't run. The id is the state-write
correctness guard, and it is three lines. Use both.

**"Offset or cursor pagination?"**
Offset is fine here: small, mostly stable dataset, and the user wants "page 7". It has two real
problems at scale — `OFFSET 100000` makes the database walk 100k rows, and a row inserted during
paging shifts everything so you see a duplicate. Cursor pagination (`WHERE submitted_at < $last`) is
O(log n) and stable, at the cost of losing random page access. For a moderation queue where the
default view is "newest pending", cursor is usually the right call.

**"Two moderators approve the same row?"**
Last write wins by default, which is wrong for moderation. Send the row's version/`updatedAt` with
the write and let the server reject a stale one with a 409; the client then shows "this was changed
by someone else" and refetches. For timeliness, poll on an interval or subscribe over websockets.

**"What if the optimistic update makes the row leave the current filter?"**
It should — approving while filtered to "pending" means the row no longer belongs. Either animate it
out, or keep it visible until the refetch with a "moved" affordance. What you must not do is leave a
row on screen that contradicts the active filter with no explanation.

**"Is optimistic UI always right?"**
No. It is right when the action is low-risk, high-frequency and reversible. For irreversible or
money-moving actions, stay pessimistic and show real progress — a rollback that flashes "paid" then
"not paid" is worse than a 700ms wait.

**"How do you test this?"**
`applyQuery` and `withStatus` unit-test with no React — that's why they're pure. The index gets a
differential test against `applyQueryByScan` rather than hand-written expectations, because
hand-writing the expected page for a bucketed index is how you encode the bug into the test. The race
gets an explicit test: resolve request A after B, assert B's data survives. Rollback gets a test with
a rejecting mock: assert the row returns to its exact previous status and that only that row changed.

**"Your index makes every write O(n). Isn't that worse?"**
Worse on the axis that runs rarely, better on the axis that runs constantly. A moderation queue is
read-heavy by orders of magnitude — every filter change, page turn and refetch is a read. If writes
ever outnumbered reads I'd delete the index and go back to the scan, which is still in the file. The
general form of the answer: move work to whichever axis changes least often.

**"When would you drop the page cache?"**
The moment there is a second write path, unless every one of them clears it. It is safe here because
`updateFeedbackStatus` is the only mutation and it invalidates everything — a blunt, obviously
correct rule. Per-key invalidation would be cheaper and is exactly where cache bugs come from; at
this size, clearing the map costs nothing.

**"Where does this break with 100k rows?"**
Not in the query — the server handles that. It breaks in the DOM if page size grows, so keep pages
small or virtualise. The other pressure point is `COUNT(*)` for the total on every request; at that
size you use an estimated count, or cursor pagination that doesn't need one.
