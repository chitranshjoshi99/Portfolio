# Job Board (ids → details) — Interview Build Guide

The two-step API: one call returns an ordered list of ids, and each posting needs a call of its own.
Render the first six, a **Load more** button fetches the next six. Everything interesting is in the
middle: fetching in parallel without losing the API's order, surviving one call in the page failing,
making the button un-double-clickable, and cancelling on unmount. Plain JavaScript, fresh sandbox,
40 minutes.

Reported at Atlassian (and as a standard Karat/HN-style screen) as: *"the API gives you an array of job
ids; fetch the details for the first N and show them, with a Load More"*, *"what happens if one of those
calls fails?"*, *"how many requests would you fire at once?"*

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–4 | Requirements: page size, order, failure policy |
| 4–10 | ids → first page → render |
| 10–20 | **Parallel fetch: the ladder** (sequential → all → allSettled → pool) |
| 20–28 | Load more: the guard, skeletons, "all loaded" |
| 28–35 | Per-row failure + retry in place, abort on unmount |
| 35–40 | Scale, caching, cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
job-board/
  index.tsx                    # list, skeletons, Load more, request stats
  job-board.types.ts           # Job, JobResult = { id, job } | { id, error }
  job-board.css
  constants/jobs.ts            # 87 seeded postings, PAGE_SIZE, concurrency options, two flaky ids
  utils/jobs-api.ts            # fetchJobIds, fetchJob (latency, failures, in-flight stats)
  utils/jobs.utils.ts          # pageSlice, mapWithConcurrency, relativeTime, hostOf, uniqueIds, hasMore
  utils/jobs.check.ts
  hooks/use-job-board.ts       # ids, results, load-more guard, retry, abort
  components/job-card.tsx      # loaded row, failed row, skeleton row
```

---

## 1. Requirement gathering (4 minutes)

1. **"The ids come in one call and each job needs its own?"** Confirm the shape, because it is the
   question. *Default: yes — 87 ids, one call each.*
2. **"How many per page, and does the order matter?"** *Default: six, and the API's order is the order on
   screen — it is ranked.*
3. **"If one of the six fails, do we show five or none?"** The fork the whole thing turns on.
   *Default: five plus a failed row that can be retried.*
4. **"Prefetch the next page, or fetch on click?"** *Default: on click; mention prefetch-on-hover later.*
5. **"How many requests at once?"** *Default: a bounded pool — six.*
6. **"Do jobs change while the page is open?"** *Default: no; a real board would poll the id list and
   diff.*
7. **"Infinite scroll or a button?"** *Default: a button. It is keyboard reachable, it does not trap the
   footer, and it is what was asked for.*

Plan in one breath:

> "Fetch the ids, slice the first six, fetch those six through a small concurrency pool that returns
> results in input order, and settle each call individually so one failure costs one row. Load more
> slices the next six; a ref guards it so a double click cannot load the same page twice. Everything
> hangs off one AbortController that the unmount cancels."

---

## 2. High-level design (HLD)

```text
  fetchJobIds()  ──▶  [41000000, 41000001, …]   (87 ids, ranked, fetched once)
                            │
             pageSlice(ids, page, 6)
                            │
        mapWithConcurrency(pageIds, limit, fetchJob)
          ├─ at most `limit` in flight
          ├─ results written to results[index]  ──▶ INPUT ORDER, not arrival order
          └─ each task try/catches  ──▶ { id, job } | { id, error }
                            │
                  setResults(prev => [...prev, ...page])       (one batch, no reshuffle)
                            │
        ┌───────────────────┼────────────────────┐
     loaded row        failed row + Retry     skeleton × loadingCount
```

Four claims:

- **Order is the caller's problem.** Responses arrive in latency order; the list is ranked. Writing each
  result into `results[index]` keeps the two apart, and it is why the code never sorts anything.
- **A failure is a result, not a gap.** `JobResult` is a union, so a failed call occupies its row and can
  be retried in place. `Promise.all` cannot express that: one rejection throws away five good responses.
- **The load-more guard belongs in a ref.** Two clicks in the same tick read the same state; a ref is
  written synchronously, so the second click sees `busy` already true.
- **One AbortController for the screen.** Unmounting mid-page cancels six requests and every `setState`
  that would have followed.

---

## 3. Low-level design (LLD)

```js
const [ids, setIds]             = useState([]);      // the ranked list, fetched once
const [results, setResults]     = useState([]);      // JobResult[], append-only, in id order
const [loadingCount, setCount]  = useState(0);       // how many skeletons to draw
const [idsError, setIdsError]   = useState(null);    // the one failure that empties the screen
const [retrying, setRetrying]   = useState(new Set());

const abortRef       = useRef(null);   // one controller for the screen
const busyRef        = useRef(false);  // the double-click guard
const idsRef         = useRef([]);     // read inside callbacks without re-creating them
const loadedRef      = useRef(0);      // which page is next
const concurrencyRef = useRef(6);      // read, never depended on — see below
```

```js
pageSlice(items, page, size)                 -> T[]        // clamps, short last page, empty past the end
mapWithConcurrency(items, limit, task)       -> Promise<R[]>   // input order, at most `limit` in flight
relativeTime(timestamp, now)                 -> '3 hours ago'
hostOf(url)                                  -> 'atlassian.com' | ''
uniqueIds(ids) / hasMore(ids, loaded)
```

---

## 4. The data model

```json
{ "id": 41000003, "title": "Design Systems Engineer", "company": "Atlassian",
  "url": "https://atlassian.com/careers/41000003", "location": "Sydney (hybrid)",
  "postedAt": 1774000000000, "points": 168 }
```

```js
type JobResult = { id, job } | { id, error }   // one entry per requested id, always
```

That union is the design decision. The alternative — `jobs: Job[]` plus a separate `errors: number[]` —
loses the position of the failure, so a retried row cannot go back where it belongs, and the list
silently gets shorter than the page the user asked for.

`postedAt` is a timestamp, formatted at render against a **fixed `now`**. Formatting on the server or
storing "3 hours ago" bakes in the moment of fetch; recomputing from `Date.now()` on every render makes
the label change under a reader mid-scroll and breaks any snapshot test.

---

## 5. Pass 1 — ids, first page, render (6 minutes)

```js
useEffect(() => {
  const controller = new AbortController();
  abortRef.current = controller;
  busyRef.current = true;

  fetchJobIds(controller.signal)
    .then((all) => {
      const unique = uniqueIds(all);       // a repeated id would render the same row twice
      idsRef.current = unique;
      setIds(unique);
      return loadPage(pageSlice(unique, 0, PAGE_SIZE), controller.signal);
    })
    .catch((error) => { if (error.name !== 'AbortError') setIdsError(error.message); });

  return () => controller.abort();
}, [loadPage]);
```

**`loadPage` must have no dependencies.** It is a `useCallback([])` that reads the pool size from
`concurrencyRef`. The first version of this file took `concurrency` as a dependency — changing the
selector rebuilt the callback, re-ran this effect, and appended page one a second time. Six duplicate
rows, in a list that looked fine until you read the ids. The ref is not a style choice; it is what keeps
"fetch the first page" a mount-only effect.

---

## 6. Pass 2 — the parallel fetch (10 minutes)

### The ladder

| Rung | Code | 6 jobs at ~300ms | One call fails | Order |
| --- | --- | --- | --- | --- |
| V0 | `for (const id of ids) await fetchJob(id)` | **~1.8s** | stops the page | input |
| V1 | `Promise.all(ids.map(fetchJob))` | ~0.3s | **loses all six** | input |
| V2 | `Promise.allSettled(ids.map(fetchJob))` | ~0.3s | one row fails | input |
| V3 | **pool: `mapWithConcurrency(ids, 6, task)`** | ~0.3s | one row fails | input |

```js
export async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;                                  // claimed before the await: no two workers share an item
      results[index] = await task(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;   // input order, always
}
```

V0 is not merely slow, it is *n* × latency, which is the difference between a page that loads and a page
someone abandons. V1 is the reflex answer and the wrong one here: `Promise.all` rejects on the first
failure and discards the five results that did arrive. V2 fixes that, and for a page of six it is a
perfectly good answer — say so.

V3 earns its place when the page is fifty rather than six. The browser already caps connections per host
(six over HTTP/1.1), so firing fifty does not make them run fifty-wide; it makes forty-four of them queue
where you cannot see them, cancel them, or prioritise them. An explicit pool is the same throughput with
a knob you control — and the pool is a *limit*, not a batch: a free worker picks up the next item at
once, so one slow call never stalls the five behind it. The check file proves both: peak in-flight never
exceeds the limit, and item five starts long before a 50ms item one finishes.

Settling happens **inside** the task, which is what makes the union work:

```js
const page = await mapWithConcurrency(pageIds, concurrencyRef.current, async (id) => {
  try { return { id, job: await fetchJob(id, signal) }; }
  catch (error) {
    if (error.name === 'AbortError') throw error;   // an abort cancels the page, not one row
    return { id, error: error.message };
  }
});
```

---

## 7. Pass 3 — Load more, skeletons, empty (8 minutes)

```js
const loadMore = useCallback(() => {
  if (busyRef.current) return;                     // the double-click guard
  const controller = abortRef.current;
  if (!controller || controller.signal.aborted) return;
  const page = Math.floor(loadedRef.current / PAGE_SIZE);
  const next = pageSlice(idsRef.current, page, PAGE_SIZE);
  if (next.length === 0) return;
  busyRef.current = true;
  void loadPage(next, controller.signal);
}, [loadPage]);
```

Three clicks in one tick produce one page. A `disabled` attribute alone does not cover it — React has not
re-rendered yet when the second click arrives — and `useState` has the same lag. The ref is written
synchronously.

Skeletons are drawn `loadingCount` times, sized like a real row, so the list reaches its final height
before the data lands instead of pushing the button down as each row arrives. They are `aria-hidden`; the
live region says "Loading 6 jobs" once, because six identical "loading" announcements are noise.

The button states are three, not two: **Load more** → **Loading…** → **All jobs loaded** (disabled),
with the remaining count beside it. A Load-more button that stays enabled at the end of the list is a
click that does nothing, which reads as a bug.

---

## 8. Pass 4 — failure and cancellation (7 minutes)

```js
const retry = async (id) => {
  setRetrying((current) => new Set(current).add(id));
  try {
    const job = await fetchJob(id, abortRef.current?.signal);
    setResults((current) => current.map((entry) => (entry.id === id ? { id, job } : entry)));
  } catch (error) {
    if (error.name !== 'AbortError') {
      setResults((current) => current.map((entry) => (entry.id === id ? { id, error: error.message } : entry)));
    }
  } finally {
    setRetrying((current) => { const next = new Set(current); next.delete(id); return next; });
  }
};
```

`map` rather than filter-and-append: the retried row keeps its rank. Verified live — the failed row sits
at index 3 before the retry and at index 3 after it.

Two failure levels, deliberately different: the **id list** failing empties the screen and gets one
error; a **detail** call failing costs one row. Treating them the same is how a board shows "something
went wrong" because one of ninety postings 404s.

---

## 9. The single-file version — what you actually type

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';

/* ───────────── constants/jobs.js ───────────── */

const PAGE_SIZE = 6;
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

const ALL_JOBS = Array.from({ length: 87 }, (_, i) => ({
  id: 41_000_000 + i,
  title: ['Senior Frontend Engineer', 'Design Systems Engineer', 'Staff Engineer, Editor Platform',
          'Accessibility Engineer'][i % 4],
  company: ['Atlassian', 'Canva', 'Figma', 'Linear'][i % 4],
  url: `https://example.com/careers/${41_000_000 + i}`,
  location: ['Sydney (hybrid)', 'Remote (AU/NZ)', 'Bengaluru'][i % 3],
  postedAt: NOW - i * 3_600_000,
  points: (i * 17) % 240,
}));

const FLAKY = new Set([ALL_JOBS[3].id, ALL_JOBS[9].id]);

/* ───────────── utils/jobs-api.js ───────────── */

const recovered = new Set();
const delay = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); });
});

async function fetchJobIds(signal) {
  await delay(200, signal);
  return ALL_JOBS.map((job) => job.id);
}

async function fetchJob(id, signal) {
  await delay(120 + ((id * 37) % 420), signal);
  if (FLAKY.has(id) && !recovered.has(id)) { recovered.add(id); throw new Error('502 — upstream timed out'); }
  return ALL_JOBS.find((job) => job.id === id);
}

/* ───────────── utils/jobs.utils.js — pure ───────────── */

const pageSlice = (items, page, size) => {
  const start = Math.max(0, page) * Math.max(1, size);
  return items.slice(start, start + Math.max(1, size));
};

const uniqueIds = (ids) => [...new Set(ids)];

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;                                   // claimed before the await
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;                                  // INPUT order
}

function relativeTime(timestamp, now) {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 60) return 'just now';             // also covers a clock skew: no "in -2 minutes"
  for (const [label, span] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    const value = Math.floor(seconds / span);
    if (value >= 1) return `${value} ${label}${value === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/* ───────────── hooks/use-job-board.js ───────────── */

function useJobBoard(concurrency) {
  const [ids, setIds] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [idsError, setIdsError] = useState(null);

  const abortRef = useRef(null);
  const busyRef = useRef(false);
  const idsRef = useRef([]);
  const loadedRef = useRef(0);
  const concurrencyRef = useRef(concurrency);
  concurrencyRef.current = concurrency;            // read, never a dependency: see loadPage

  const loadPage = useCallback(async (pageIds, signal) => {
    if (pageIds.length === 0) return;
    setLoadingCount(pageIds.length);
    try {
      const page = await mapWithConcurrency(pageIds, concurrencyRef.current, async (id) => {
        try { return { id, job: await fetchJob(id, signal) }; }
        catch (error) {
          if (error.name === 'AbortError') throw error;     // abort kills the page, not one row
          return { id, error: error.message };
        }
      });
      if (signal.aborted) return;
      setResults((current) => {
        const seen = new Set(current.map((entry) => entry.id));
        return [...current, ...page.filter((entry) => !seen.has(entry.id))];
      });
      loadedRef.current += page.length;
    } catch (error) {
      if (error.name !== 'AbortError') setIdsError(error.message);
    } finally {
      if (!signal.aborted) setLoadingCount(0);
      busyRef.current = false;
    }
  }, []);                                          // NO dependencies, or the mount effect re-runs

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    busyRef.current = true;
    fetchJobIds(controller.signal)
      .then((all) => {
        const unique = uniqueIds(all);
        idsRef.current = unique;
        setIds(unique);
        return loadPage(pageSlice(unique, 0, PAGE_SIZE), controller.signal);
      })
      .catch((error) => { if (error.name !== 'AbortError') { setIdsError(error.message); busyRef.current = false; } });
    return () => controller.abort();
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (busyRef.current) return;                   // two clicks in one tick see the same state
    const controller = abortRef.current;
    if (!controller || controller.signal.aborted) return;
    const next = pageSlice(idsRef.current, Math.floor(loadedRef.current / PAGE_SIZE), PAGE_SIZE);
    if (next.length === 0) return;
    busyRef.current = true;
    void loadPage(next, controller.signal);
  }, [loadPage]);

  const retry = useCallback(async (id) => {
    try {
      const job = await fetchJob(id, abortRef.current?.signal);
      setResults((current) => current.map((entry) => (entry.id === id ? { id, job } : entry)));
    } catch (error) {
      if (error.name !== 'AbortError') {
        setResults((current) => current.map((entry) => (entry.id === id ? { id, error: error.message } : entry)));
      }
    }
  }, []);

  return { ids, results, loadingCount, idsError, loadMore, retry,
    remaining: Math.max(0, ids.length - results.length) };
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const [concurrency, setConcurrency] = useState(6);
  const b = useJobBoard(concurrency);

  return (
    <section>
      <label>
        Max parallel requests
        <select value={concurrency} disabled={b.loadingCount > 0}
                onChange={(event) => setConcurrency(Number(event.target.value))}>
          {[1, 3, 6, 12].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>

      {b.idsError && <p role="alert">{b.idsError}</p>}

      <ol className="jb__list">
        {b.results.map((result) =>
          'job' in result ? (
            <li key={result.id} className="jb__item">
              <h3>
                <a href={result.job.url} target="_blank" rel="noopener noreferrer">{result.job.title}</a>
                <span> ({hostOf(result.job.url)})</span>
              </h3>
              <p>
                {result.job.company} · {result.job.location} ·{' '}
                <time dateTime={new Date(result.job.postedAt).toISOString()}>
                  {relativeTime(result.job.postedAt, NOW)}
                </time> · {result.job.points} points
              </p>
            </li>
          ) : (
            <li key={result.id} className="jb__item jb__item--failed">
              <p>Job {result.id} failed to load: {result.error}</p>
              <button type="button" onClick={() => b.retry(result.id)}>Retry</button>
            </li>
          ),
        )}
        {Array.from({ length: b.loadingCount }, (_, index) => (
          <li key={`skeleton-${index}`} className="jb__item jb__item--skeleton" aria-hidden="true" />
        ))}
      </ol>

      <button type="button" onClick={b.loadMore}
              disabled={b.loadingCount > 0 || b.ids.length === 0 || b.remaining === 0}>
        {/* Before the ids arrive, `remaining` is 0 — which is not the same as everything being loaded. */}
        {b.loadingCount > 0 || b.ids.length === 0 ? 'Loading…'
          : b.remaining > 0 ? 'Load more' : 'All jobs loaded'}
      </button>
      <span role="status">
        {b.loadingCount > 0 ? `Loading ${b.loadingCount} jobs` : `${b.results.length} jobs loaded`}
      </span>
    </section>
  );
}
```

**Build it in this order:** `fetchJobIds` → `pageSlice` → six `fetchJob` calls with `Promise.all` and a
plain list → swap in the try/catch per task so a failure is a row → `mapWithConcurrency` → Load more with
the `busyRef` guard → skeletons and the three button states → retry in place → abort on unmount.

Narrate two lines: *"results are written by index, so the list is in the API's order however the responses
arrive"* and *"the guard is a ref because two clicks in one tick read the same state."*

---

## 10. Verification

```bash
node src/projects/job-board/utils/jobs.check.ts
```

Asserts: `pageSlice` at the start, at a short last page, past the end, and with a negative page; duplicate
ids collapsed; `hasMore` flipping exactly when the ids run out; `mapWithConcurrency` returning input order
while completion order differs, holding peak in-flight to the limit, starting item five before a slow item
one finishes, surviving a rejecting task, and handling empty input, a limit above the length and a zero
limit; `relativeTime` at every boundary (59s, 60s singular, 59 minutes, 1 hour, months, years) and under a
clock skew; `hostOf` on a `www.` host and on a malformed url; then the real two-step fetch: 87 unique ids,
one page fetched through the pool in API order with peak in-flight exactly 3, one flaky id failing while
the other five arrive, and the retry succeeding.

Demo script:

1. Load: six rows, **6 detail requests · peak 6 in flight · 6 of 87 loaded**, one row showing
   `502 — upstream timed out`.
2. Retry that row: it fills in **at the same position** (index 3 before and after).
3. Click *Load more* three times fast: six skeletons, then exactly six new rows — 12 total, no duplicates.
4. Set *Max parallel requests* to 1 and load a page: **peak 1 in flight**, and it takes about four times
   as long. Set it to 12: peak is back to 6 (the page is only six items).
5. Switch the pool size between pages: the list does not restart and no row is duplicated — the bug this
   project actually had.
6. Load to the end: the button reads **All jobs loaded** and is disabled.

---

## 11. Cross-questions and answers

**"Why not `Promise.all`?"** It rejects on the first failure and discards every settled result. For six
independent rows that is the wrong failure mode: five good responses thrown away because one 502'd.
`allSettled` or a pool of settling tasks keeps them.

**"Is a concurrency pool worth it for six?"** No, and say so. It starts to matter at tens of requests,
where the browser's own per-host cap (six on HTTP/1.1) queues the rest invisibly — a pool makes that limit
explicit, cancellable and tunable. Over HTTP/2 the cap is much higher, so an unbounded fan-out can
genuinely flood the server; the pool is as much backend protection as frontend.

**"Infinite scroll instead?"** `IntersectionObserver` on a sentinel calling the same `loadMore`. Keep the
button as well: a sentinel that fires while a screen reader is on the last row loads pages nobody asked
for, and an unreachable footer is a common complaint. Either way the guard is the same ref.

**"Caching?"** A `Map<id, Job>` consulted before fetching, so revisits and retries are free. That is the
path to React Query, whose `queryKey` per job id gives dedupe and revalidation for nothing.

**"Prefetching?"** Fetch the next page's ids on hover over Load more, or when the last row is 200px from
the viewport. Cheap, invisible when it misses, and it must share the cache or it is just more requests.

**"What if the id list is 10,000 long?"** It is one cheap call and ids are small, so holding them is fine;
never fetch 10,000 details. The page size is the real limit, and at that point virtualise the rendered
rows too.

**"How do you test this?"** The pure layer as above — particularly that `mapWithConcurrency` preserves
order while completion order does not. For the component: a mock API with staggered latencies asserting
render order, a failing id asserting one failed row and five loaded, and a triple click asserting exactly
one page is appended.

**"Accessibility?"** The list is an `<ol>` because rank is meaningful. One `role="status"` announcement per
page load, not per row. Skeletons are `aria-hidden`. The failed row states the id and the reason in text,
and its Retry is a real button. Times carry a machine-readable `dateTime` beside the human label.
