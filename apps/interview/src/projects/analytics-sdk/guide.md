# Analytics SDK (batching) — Interview Build Guide

Build the client that every component in the app calls to record analytics: `track(name, props)` queues an
event, events leave in **batches** — when the queue reaches a size, or when a timer fires, whichever is
first — with only one request in flight, failed batches retried with backoff *before* newer events, a
bounded queue so a dead endpoint cannot eat memory, and a final flush with `navigator.sendBeacon` when the
page is hidden or closed (persisted to storage if the browser refuses). One instance per page. Plain
JavaScript, output in the console or on a page. Target 45–60 minutes.

Reported at Atlassian as: *"Create an analytics SDK that will be used to collect analytics throughout the
components in the application and batch-send them to the server — which design pattern would you use,
since a single instance should be used throughout the app?"* (singleton), *"Create a class that will serve
as an analytics manager: collect and dispatch events to the backend. Handle batching, interval-based
batching, and edge cases like navigating away from the window"* (senior FE), *"Implement an analytic tool"*,
and GreatFrontEnd's Atlassian topic list: *"analytics batching"*.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Triggers | **Size OR interval**, whichever first. The interval timer is one-shot and only armed while the queue is non-empty. |
| Concurrency | **One batch in flight.** Newer events wait; order is preserved. |
| Failure | Retry with exponential backoff, the failed batch **goes first**; after `maxAttempts` it is dropped and counted. |
| Memory | Bounded queue: drop the **oldest** past `maxQueueSize`, counted. |
| Leaving the page | `visibilitychange→hidden` + `pagehide` → `sendBeacon` in ≤ 60 KB chunks, including in-flight events (at-least-once; server dedupes on event id). Refused → `localStorage` → restored next load. |
| Pattern | **Singleton by module scope** + `init(config)` once. |
| Discussed, not built | Sampling, consent/opt-out gating, PII scrubbing, compression, a Web Worker, `fetch(…, { keepalive: true })`. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: triggers, guarantees, what "navigating away" must do |
| 5–10 | HLD: queue → batch → transport; the singleton question |
| 10–18 | V0 → V1: `track` + size batching, console output |
| 18–26 | **Interval + one-in-flight — the ladder** |
| 26–36 | **Failure: backoff, ordering, max attempts, bounded queue** |
| 36–46 | Page hide: beacon, chunking, persistence, restore |
| 46–55 | Tests with a fake clock |
| 55–60 | Cross-questions |

---

## 0. Sandbox setup

The JS round wants visible output. Start in `index.js` with `console.log` in the fake transport.

```text
src/
  index.js      # SDK + fake transport + a main() that tracks things
  App.jsx       # optional page showing the queue
```

Target split (this repo):

```text
analytics-sdk/
  index.tsx                                # playground: track buttons, config, collector mode, pipeline view
  analytics-sdk.types.ts                   # AnalyticsEvent, Batch, FlushReason, Stats, Scheduler, Options
  analytics-sdk.css
  constants/analytics-sdk.constants.ts     # defaults, options, sample events
  utils/analytics.utils.ts                 # pure: backoffDelay, dropOverflow, chunkByJsonSize
  utils/analytics-client.ts                # THE SDK: AnalyticsClient + attachPageLifecycle
  utils/analytics-client.check.ts          # manual scheduler + hand-settled transport
  utils/analytics-singleton.ts             # fake collector, initAnalytics / getAnalytics
  hooks/use-analytics-playground.ts        # demo wiring (useSyncExternalStore)
```

Say: *"The SDK has no React and no globals except the one instance. Time and the network are injected —
a scheduler and a transport — so the tests control both."*

---

## 1. Requirement gathering (5 minutes)

1. **"Delivery guarantee — best effort, at-least-once, exactly-once?"**
   Decides retry and dedupe. Exactly-once is not achievable from a browser; at-least-once + server dedupe on
   an event id is the standard answer. *Default: at-least-once, events carry an id.*
2. **"Batch triggers — size, time, both?"**
   *Default: 10 events or 5 seconds, whichever comes first.*
3. **"What must happen when the user navigates away or closes the tab?"**
   *Default: flush with `sendBeacon`; if refused, persist and send on the next visit.*
4. **"Can the endpoint be down for long? How much can we buffer?"**
   *Default: bounded queue (200), drop oldest, count drops.*
5. **"Do events need to arrive in order?"**
   *Default: yes per client — one batch in flight, retries first.*
6. **"Who calls it?"** Many components, possibly many bundles → the singleton question.
7. **"Consent / sampling / PII?"** *Default: out of scope; name where they'd hook in (`track`).*

Plan:

> "One instance per page — module scope is the singleton, with an `init` for config. `track` pushes an event
> with an id and timestamp. When the queue hits the batch size I flush; otherwise a one-shot timer flushes
> after the interval. Only one batch is in flight; a failed batch is retried with exponential backoff before
> anything newer, and dropped after three attempts. On `visibilitychange` to hidden and `pagehide` I send
> everything left with `sendBeacon`, in chunks under its size limit, and persist whatever it refuses."

---

## 2. High-level design (HLD)

```text
 components ──track(name, props)──▶ queue [e1 e2 … ]   (bounded: drop oldest past maxQueueSize)
                                       │
               queue.length ≥ size ────┤──── one-shot timer (armed only while queue non-empty)
                                       ▼
                             flush(reason)  — skipped if inFlight or retry pending
                                       │ batch = queue.splice(0, size)
                                       ▼
                             transport(batch)  ── ok ──▶ stats.sent += n; drain again
                                       │
                                      fail
                                       ▼
                   attempt < max ?  retry = setTimeout(send(batch'), base·2^(n-1))   (goes FIRST)
                                 :  drop batch, count, continue
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ visibilitychange→hidden / pagehide:                                                  │
 │   events = retry.batch + inFlight + queue  → chunk(≤60KB) → navigator.sendBeacon    │
 │   refused → localStorage['analytics:unsent'] → restored & re-queued on next load     │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

Claims:

- **Size-only batching loses data on quiet pages** — 3 events never reach 10. The timer bounds latency.
- **An always-running `setInterval` wastes wakeups** on idle tabs and mobile battery; arm a one-shot timer
  only when there is something to send.
- **One in flight** is what makes ordering and backoff simple. Parallel batches reorder under failure.
- **`unload`/`beforeunload` are the wrong events** — unreliable on mobile and they disable the back/forward
  cache. `visibilitychange` (hidden) is the last event you reliably get; `pagehide` covers the rest.
- **`sendBeacon` is fire-and-forget**, survives the page, has a ~64 KB budget — so chunk, and fall back to
  storage when it returns `false`.

---

## 3. Low-level design (LLD)

### Client fields

```js
this.queue = [];          // events waiting
this.inFlight = null;     // the one batch currently being POSTed
this.retry = null;        // { batch, delayMs, handle } — a failed batch waiting for backoff
this.timer = null;        // one-shot interval timer handle
this.nextBatchId = 1;
this.stats = { tracked, sent, batchesSent, failures, dropped, beaconed };
```

### API

```js
track(name, props)        -> void                // O(1) amortised
flush(reason)             -> Promise<void>       // no-op if inFlight / retry / empty
flushOnUnload()           -> void                // synchronous; beacon + persist
subscribe / getSnapshot                          // for a UI
dispose()                                        // clear timers
```

### Injected dependencies

```js
new AnalyticsClient({ transport, beacon, maxBatchSize, flushIntervalMs, maxQueueSize,
  maxAttempts, backoffBaseMs, now, scheduler: { set, clear }, storage, storageKey })
```

### Pure helpers

```js
backoffDelay(baseMs, attempt, capMs = 30000) -> ms     // 1s, 2s, 4s … capped
dropOverflow(queue, max)                     -> { kept, dropped }
chunkByJsonSize(events, maxChars)            -> events[][]  // keeps order
```

---

## 4. The data model

```json
{ "id": "m1a2b3-17", "name": "issue_opened", "props": { "key": "CONF-4121" }, "ts": 1789850000000 }
```

```json
{ "id": 7, "attempt": 2, "reason": "retry", "events": [ … ] }
```

- `id` is generated on the client so a retried batch that *did* land the first time can be deduplicated by
  the server. `ts` is the client time of the action, not the send time — batches can be seconds late.
- `reason` (`size | interval | manual | retry | unload`) is for your own dashboards: a flood of `unload`
  batches means your interval is too long.

**Fork — `sendBeacon` or `fetch(…, { keepalive: true })` on unload?**

| | `navigator.sendBeacon` | `fetch` + `keepalive` |
| --- | --- | --- |
| Survives the page | yes | yes |
| Method / headers | POST only, limited content types | any |
| Size budget | ~64 KB (shared) | ~64 KB (shared) |
| Know if it was queued | returns `false` if refused | promise may never settle |
| Support | everywhere | modern browsers |

Use the beacon for the unload path and `fetch` for normal batches; the fallback for a refused beacon is
storage.

---

## 5. Pass 1 — track + size batching (target: 8 minutes)

#### V0 — one request per event

```js
track(name, props) { transport([{ name, props, ts: Date.now() }]); }
```

A page view with 40 events is 40 requests, each with its own headers, TLS work and radio wake-up on mobile.

#### V1 — batch by size only

```js
track(name, props) {
  this.queue.push({ id: makeId(), name, props, ts: Date.now() });
  if (this.queue.length >= this.maxBatchSize) this.flush('size');
}
```

Demo it: 25 events → 2 batches of 10… and 5 events that never leave. A quiet page loses everything.

---

## 6. Pass 2 — interval + one in flight (target: 8 minutes)

### 6.1 The ladder

| Rung | Requests for 25 events | Quiet page (3 events) | Ordering under failure | Page close |
| --- | --- | --- | --- | --- |
| V0 per event | 25 | sent | per event | whatever is mid-flight |
| V1 size only | 2 (+5 stuck) | **never sent** | ok | lost |
| V2 size + interval | 3 | sent after ≤ interval | **can reorder** (parallel flushes) | lost |
| **V3 + one in flight, retry first, bounded, beacon** | **3** | **sent** | **preserved** | **beacon / persisted** |

```js
ensureTimer() {                                   // one-shot, only while there is work
  if (this.timer !== null || !this.queue.length || this.inFlight || this.retry) return;
  this.timer = this.scheduler.set(() => { this.timer = null; this.flush('interval'); }, this.flushIntervalMs);
}

async flush(reason) {
  if (this.inFlight || this.retry || !this.queue.length) return;   // one at a time, retries first
  this.clearTimer();
  await this.send({ id: this.nextBatchId++, events: this.queue.splice(0, this.maxBatchSize), attempt: 1, reason });
}
```

After a successful send, drain: if the queue is still ≥ size, flush again immediately; otherwise re-arm the
timer.

### 6.2 Why V3 wins

What changed is that sending became **a single serialized pipeline** instead of a reaction to each
trigger. Every trigger (size, timer, retry) funnels through `flush`, which refuses to start a second batch —
so batches leave in order, a failure naturally blocks newer events behind it, and the timer only exists when
the pipeline is idle with work waiting. **Ship V3.** It is ~60 more lines than V2, and every one of them is
an edge case the reported question names ("interval-based batching", "navigating away").

---

## 7. Pass 3 — failure (target: 10 minutes)

```js
async send(batch) {
  this.inFlight = batch;
  try {
    await this.transport(batch);
    this.inFlight = null;
    this.stats.sent += batch.events.length;
    if (this.queue.length >= this.maxBatchSize) this.flush('size'); else this.ensureTimer();
  } catch {
    this.inFlight = null;
    this.stats.failures++;
    if (batch.attempt >= this.maxAttempts) {                 // give up: analytics must not block the app
      this.stats.dropped += batch.events.length;
      this.ensureTimer();
      return;
    }
    const delayMs = backoffDelay(this.backoffBaseMs, batch.attempt);   // 1s, 2s, 4s …
    const next = { ...batch, attempt: batch.attempt + 1, reason: 'retry' };
    this.retry = { batch: next, delayMs, handle: this.scheduler.set(() => { this.retry = null; this.send(next); }, delayMs) };
  }
}
```

Say three things:

1. **Backoff with a cap**, and add jitter in production (`delay × random(0.5, 1.5)`) so a thousand clients
   recovering from the same outage don't retry in lockstep.
2. **Dropping is a feature.** An analytics SDK that retries forever grows memory and burns battery to
   deliver data nobody will trust. Count drops so the loss is visible.
3. **Bounded queue drops the oldest** — the newest events describe what the user is doing now.

---

## 8. Pass 4 — leaving the page (target: 10 minutes)

```js
flushOnUnload() {
  const events = [...(this.retry?.batch.events ?? []), ...(this.inFlight?.events ?? []), ...this.queue];
  this.clearTimer();
  if (this.retry) this.scheduler.clear(this.retry.handle);
  this.retry = null;
  this.inFlight = null;                                   // a late response for it is ignored
  this.queue = [];
  const unsent = [];
  for (const chunk of chunkByJsonSize(events, 60000)) {
    if (!unsent.length && this.beacon?.(chunk)) this.stats.beaconed += chunk.length;
    else unsent.push(...chunk);                           // keep order after the first refusal
  }
  if (unsent.length) this.storage?.setItem(this.storageKey, JSON.stringify(unsent));
}

// wiring
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') client.flushOnUnload();
});
window.addEventListener('pagehide', () => client.flushOnUnload());
```

- It is **synchronous** — the page may not get another task.
- The in-flight batch is included: its response may never arrive. Sending it twice is fine (at-least-once,
  server dedupes by event id); losing it is not.
- On construction, `restore()` reads the storage key, deletes it, and puts those events at the *front* of the
  queue.
- `visibilitychange` fires every time the user switches tabs, not just on close — that is fine: flushing
  when the user looks away is exactly when you want to, and the queue refills when they return.

---

## 9. The single-file version — what you actually type

```jsx
import { useEffect, useState, useSyncExternalStore } from 'react';

/* ───────────── utils/analytics.utils.js — pure ───────────── */

const backoffDelay = (baseMs, attempt, capMs = 30000) => Math.min(capMs, baseMs * 2 ** (attempt - 1));

function chunkByJsonSize(events, maxChars) {
  const chunks = [];
  let current = [];
  let size = 2;
  for (const event of events) {
    const eventSize = JSON.stringify(event).length + 1;
    if (current.length && size + eventSize > maxChars) { chunks.push(current); current = []; size = 2; }
    current.push(event);
    size += eventSize;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/* ───────────── utils/analytics-client.js — the SDK ───────────── */

class AnalyticsClient {
  constructor({ transport, beacon, maxBatchSize = 10, flushIntervalMs = 5000, maxQueueSize = 200,
    maxAttempts = 3, backoffBaseMs = 1000, storage = null, storageKey = 'analytics:unsent' }) {
    Object.assign(this, { transport, beacon, maxBatchSize, flushIntervalMs, maxQueueSize, maxAttempts,
      backoffBaseMs, storage, storageKey });
    this.queue = [];
    this.inFlight = null;
    this.retry = null;
    this.timer = null;
    this.nextBatchId = 1;
    this.seq = 0;
    this.listeners = new Set();
    this.stats = { tracked: 0, sent: 0, batchesSent: 0, failures: 0, dropped: 0, beaconed: 0 };
    this.snapshot = this.buildSnapshot();
    this.restore();
  }

  track(name, props = {}) {
    this.queue.push({ id: `${Date.now().toString(36)}-${++this.seq}`, name, props, ts: Date.now() });
    this.stats.tracked++;
    if (this.queue.length > this.maxQueueSize) {                     // bounded: drop the oldest
      const overflow = this.queue.length - this.maxQueueSize;
      this.queue.splice(0, overflow);
      this.stats.dropped += overflow;
    }
    if (this.queue.length >= this.maxBatchSize) this.flush('size');
    else this.ensureTimer();
    this.changed();
  }

  async flush(reason = 'manual') {
    if (this.inFlight || this.retry || this.queue.length === 0) return;  // one at a time, retry first
    this.clearTimer();
    await this.send({ id: this.nextBatchId++, events: this.queue.splice(0, this.maxBatchSize), attempt: 1, reason });
  }

  async send(batch) {
    this.inFlight = batch;
    this.changed();
    try {
      await this.transport(batch);
      if (this.inFlight !== batch) return;                             // beaconed meanwhile
      this.inFlight = null;
      this.stats.sent += batch.events.length;
      this.stats.batchesSent++;
      console.log(`sent batch #${batch.id} (${batch.events.length}, ${batch.reason})`);
      if (this.queue.length >= this.maxBatchSize) this.flush('size'); else this.ensureTimer();
    } catch {
      if (this.inFlight !== batch) return;
      this.inFlight = null;
      this.stats.failures++;
      if (batch.attempt >= this.maxAttempts) {
        this.stats.dropped += batch.events.length;
        this.ensureTimer();
      } else {
        const delayMs = backoffDelay(this.backoffBaseMs, batch.attempt);
        const next = { ...batch, attempt: batch.attempt + 1, reason: 'retry' };
        const handle = setTimeout(() => { this.retry = null; this.send(next); }, delayMs);
        this.retry = { batch: next, delayMs, handle };
      }
    }
    this.changed();
  }

  ensureTimer() {                                                      // one-shot, only while there is work
    if (this.timer !== null || !this.queue.length || this.inFlight || this.retry) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush('interval'); }, this.flushIntervalMs);
  }

  clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  flushOnUnload() {                                                    // synchronous: the page may be gone next
    const events = [...(this.retry?.batch.events ?? []), ...(this.inFlight?.events ?? []), ...this.queue];
    this.clearTimer();
    if (this.retry) clearTimeout(this.retry.handle);
    this.retry = null;
    this.inFlight = null;
    this.queue = [];
    const unsent = [];
    for (const chunk of chunkByJsonSize(events, 60000)) {
      if (!unsent.length && this.beacon?.(chunk)) this.stats.beaconed += chunk.length;
      else unsent.push(...chunk);
    }
    if (unsent.length) { try { this.storage?.setItem(this.storageKey, JSON.stringify(unsent)); } catch {} }
    this.changed();
  }

  restore() {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return;
      this.storage.removeItem(this.storageKey);
      this.queue = [...JSON.parse(raw), ...this.queue];
      this.ensureTimer();
      this.changed();
    } catch {}
  }

  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  buildSnapshot() { return { queue: [...this.queue], inFlight: this.inFlight, retry: this.retry, stats: { ...this.stats } }; }
  changed() { this.snapshot = this.buildSnapshot(); this.listeners.forEach((l) => l()); }
}

/* ───────────── utils/analytics-singleton.js ───────────── */

let collectorDown = false;
const transport = (batch) =>
  new Promise((resolve, reject) => setTimeout(() => (collectorDown ? reject(new Error('503')) : resolve()), 400));
const beacon = (events) => {
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    return navigator.sendBeacon('/collect', new Blob([JSON.stringify(events)], { type: 'application/json' }));
  }
  return false;
};
const storage = typeof window === 'undefined' ? null : window.localStorage;

let instance = null;                                                   // THE singleton
export function initAnalytics(config = {}) {
  if (!instance) instance = new AnalyticsClient({ transport, beacon, storage, ...config });
  return instance;
}
export const analytics = () => instance ?? initAnalytics();

/* ───────────── App.jsx ───────────── */

export default function App() {
  const client = analytics();
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot); // 3rd: SSR
  const [down, setDown] = useState(false);

  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === 'hidden') client.flushOnUnload(); };
    const onPageHide = () => client.flushOnUnload();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [client]);

  return (
    <main>
      <button onClick={() => client.track('button_click', { id: 'create' })}>track click</button>
      <button onClick={() => { for (let i = 0; i < 25; i++) client.track('page_view', { i }); }}>burst 25</button>
      <label>
        <input type="checkbox" checked={down} onChange={(e) => { collectorDown = e.target.checked; setDown(e.target.checked); }} />
        collector down
      </label>
      <p>queue {snap.queue.length} · in flight {snap.inFlight ? `#${snap.inFlight.id}` : '—'} ·
        retry {snap.retry ? `#${snap.retry.batch.id} in ${snap.retry.delayMs}ms` : '—'}</p>
      <pre>{JSON.stringify(snap.stats, null, 2)}</pre>
    </main>
  );
}
```

**Build it in this order:** `track` + size flush + a transport that `console.log`s (V1) → one-shot timer →
`inFlight` guard + drain after success → retry with backoff + max attempts → bounded queue → `flushOnUnload` +
lifecycle listeners → chunking + persistence + `restore` → the snapshot for a UI.

Narrate the two lines that the question is testing: `if (this.inFlight || this.retry || !this.queue.length)
return;` — *"one pipeline, so order and backoff come for free"* — and `document.visibilityState === 'hidden'`
→ `flushOnUnload()` — *"the last event you can rely on; `unload` isn't."*

---

## 10. Verification

```bash
node src/projects/analytics-sdk/utils/analytics-client.check.ts
```

A manual scheduler and a hand-settled transport make every case deterministic:

1. 25 events at size 10 → batch 1 at event 10, **blocked** while in flight, batch 2 drains immediately after,
   the last 5 wait exactly one interval; all 25 arrive once, in order; **no timer is left running** when idle.
2. A failed batch retries after 1 s, **before** 10 newer events, then the newer ones follow.
3. Three failures → the batch is dropped and counted; new events still flow.
4. A queue capped at 5 keeps the newest 5.
5. Page hide with a batch in flight and 2 queued → all 12 go by beacon, timers cleared, the late response is
   ignored; with the beacon refused → persisted; a new client restores them and clears storage.

Demo script (playground):

1. *Burst ×25* → in-flight batch #1 (size), then #2, then the last 5 after the interval.
2. *Collector down* + burst → *batch #3 retries in 1s*, then 2s, then dropped after 3 attempts.
3. *Simulate page hide* while down → beacon refused → events persisted; reload the page → *restored N events*.
4. Switch browser tabs with events queued → they leave by beacon (the real `visibilitychange`).

---

## 11. Cross-questions and answers

**"Why a singleton, and how?"**
Every component must share one queue — otherwise each has its own timer, its own batches, and ordering is
per-component. Module scope already gives one instance per bundle; `init(config)` sets it up once. For
several bundles on one page (micro-frontends), share a global (`window.__analytics ??= …`) with a version
check. The testability cost of singletons is why the class itself takes injected dependencies.

**"Exactly-once?"**
Not from a browser — you cannot know whether a request that failed on the client landed on the server.
At-least-once + an idempotency key (the event id) + server-side dedupe gives effectively-once.

**"What if the user is offline?"**
Transport failures back off; after `maxAttempts` the batch is dropped. Better: listen to `online`/`offline`,
pause retries while offline, persist the queue, resume on `online`.

**"Sampling and consent?"**
Both belong in `track`: return early if the user opted out (and don't even queue), and apply per-event-type
sampling (`Math.random() < rate`) there, recording the rate in the event so the backend can reweight.

**"Would you use a Web Worker?"**
Only if serialising or compressing big batches shows up on the main thread. Batching already makes the
per-event cost a push into an array.

**"How do you know the SDK works in production?"**
Its own counters (`sent`, `dropped`, `failures`, `beaconed`) sent as a heartbeat event; compare
client-reported sent counts with server-received counts to measure loss.

**"PII?"**
Scrub in `track` with an allow-list of property names per event, never a block-list; hash user ids; never put
free text (search queries, titles) in analytics without review.
