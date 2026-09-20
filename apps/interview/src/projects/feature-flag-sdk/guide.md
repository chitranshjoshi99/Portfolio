# Feature Flag SDK — Interview Build Guide

Build the client side of a feature-flag service: `getFeatureState(name, defaultValue)` returns a
promise of `true`/`false`, fetches all flags **once** no matter how many callers ask at the same time,
caches with a TTL, keeps serving stale values while it revalidates, survives a reload, never throws to
the UI, lets developers override flags locally, and notifies subscribers when a flag changes. Then a
`<Feature>` component and a `useFeatureFlag` hook on top. Plain JavaScript, fresh sandbox, output in the
console or on the page. Target 45–60 minutes.

This is the most frequently reported Atlassian **JavaScript coding** round question. Reported phrasings:
*"implement feature flag functions"*, *"write code to call an async feature flag API"*, *"fetch the
feature flag value, store the result and add a subscription method to flag value change"*, *"feature
flag utility with TTL and dev overrides"*, *"how would you cache it, measure performance, what if the
server fails"*, *"share it across different apps"*, *"build an A/B testing SDK"*, *"a common module used
by multiple applications to fetch data for a key (memoization)"*. They are one question with different
follow-ups; this guide builds the shape that absorbs all of them.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Dedupe | **Cache the promise, not just the value.** Ten concurrent callers await one request. A rejected promise is dropped so the next call retries. |
| Freshness | TTL + **stale-while-revalidate**: after the TTL, answer immediately from cache and refresh in the background. |
| Persistence | Last good snapshot in `localStorage`, read at construction → first render has values with no network wait. |
| Failure | `getFeatureState` **never rejects**: it resolves the caller's default. Last good values keep serving after a failed refresh. |
| Overrides / subscriptions | In-memory overrides beat the server; `subscribe(name, cb)` fires only when the *effective* value changes. |
| Discussed, not built | Cross-tab sync (`BroadcastChannel`), server push (SSE), percentage rollout / user targeting, exposure events for A/B analysis. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements, API shape out loud |
| 5–10 | HLD, the read-path decision table |
| 10–18 | V0 → V1 on screen: one call works, show the duplicate-request bug |
| 18–28 | **V2 promise cache — the dedupe, the failure path** |
| 28–38 | TTL + stale-while-revalidate + persistence |
| 38–46 | Overrides + subscribe |
| 46–55 | React: `useFeatureFlag` + `<Feature>` |
| 55–60 | Demo, performance/sharing cross-questions |

---

## 0. Sandbox setup

The Atlassian JS round asks for code whose output you can *see*. Start with a plain `index.js` that logs,
and move to React only when the interviewer asks for the component.

```text
src/
  index.js      # SDK + a main() that logs
  App.jsx       # later: hook + <Feature>
```

Target split (this repo):

```text
feature-flag-sdk/
  index.tsx                             # playground: stats, table, gated UI, event log
  feature-flag-sdk.types.ts             # FlagMap, FlagSnapshot, FlagStats, FlagEvent, options
  feature-flag-sdk.css
  constants/feature-flag-sdk.constants.ts
  utils/flag-client.ts                  # THE SDK: FlagClient class, no React
  utils/flag-client.check.ts            # injected clock + hand-resolved fetcher, no sleeps
  utils/fake-flag-server.ts             # GET /flags stand-in: latency, failNext, mutable flags
  utils/flag-singleton.ts               # the one client instance for the page
  hooks/use-feature-flag.ts             # useSyncExternalStore + trigger a read
  hooks/use-flag-playground.ts          # demo wiring
  components/feature.tsx                # <Feature name fallback>children</Feature>
  components/flag-table.tsx
  components/event-log.tsx
```

Say: *"The SDK is framework-free because the question says multiple apps use it. React is one consumer;
the hook is twelve lines on top."*

---

## 1. Requirement gathering (5 minutes)

1. **"Does the API return all flags at once, or one flag per request?"**
   All-at-once means one request serves every flag — so the problem is *dedupe and cache*. Per-flag
   means batching (collect names for a tick, one request) — a different algorithm.
   *Default: `GET /flags` returns the full map.*
2. **"How many callers? Can they ask before the first response?"**
   This is the question that sets up the ladder: yes → concurrent calls must share one request.
   *Default: many components, all on first render.*
3. **"What happens if the flag service is down?"**
   *Default: resolve the caller's default; never throw into the UI; keep serving last good values.*
4. **"How fresh must values be?"**
   *Default: a TTL (10 s in the demo, minutes in production); stale values are acceptable while refreshing.*
5. **"Unknown flag names — typo in the key?"**
   *Default: default value + a dev warning; do not request again for it.*
6. **"Dev overrides? From where?"**
   *Default: an API `setOverride(name, value|null)`; a query-param or storage source feeds it.*
7. **"Do consumers need to react to changes?"**
   *Default: yes — `subscribe(name, cb)` fired on effective-value change.*

Plan, in one breath:

> "One client instance per page. `getFeatureState` checks overrides, then a cache with a TTL. If there
> is no cache, it awaits a single in-flight promise that every concurrent caller shares; if that promise
> rejects, the caller gets their default and the promise is dropped so the next call retries. After the
> TTL I answer from cache and refresh in the background. Snapshots are persisted so a reload renders with
> values immediately. React subscribes with `useSyncExternalStore`."

---

## 2. High-level design (HLD)

```text
  <Feature> ×N   useFeatureFlag ×N   other app on the page   node script
        │               │                     │                   │
        └───────────────┴─────────┬───────────┴───────────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │ flagClient  (module singleton) │
                   │ getFeatureState(name, def)     │
                   └──────────────┬─────────────────┘
                                  │
          override? ──yes──▶ return override
                                  │ no
          cache fresh? ─yes─▶ return cached            (hit)
                                  │ no
          cache stale? ─yes─▶ return cached + refresh() in background   (SWR)
                                  │ no cache
                                  ▼
                   ┌──────────────────────────────┐
                   │ refresh():                     │
                   │  inFlight? → return inFlight   │  (dedupe: cache the PROMISE)
                   │  else inFlight = fetch()       │
                   │   .then(commit)                │─▶ snapshot + localStorage
                   │   .catch(count, keep last)     │
                   │   .finally(inFlight = null)    │  (failure is never cached)
                   └──────────────┬─────────────────┘
                                  ▼
                 commit(): diff old vs new → notify subscribe(name) listeners
                                  ▼
                 storeListeners → useSyncExternalStore → re-render
```

Claims worth saying out loud:

- **The promise is the cache key's value while a request is running.** Caching only resolved values is
  the most common wrong answer: ten components mounting together all see an empty cache and fire ten
  requests.
- **`.finally(() => inFlight = null)`** is the line that makes failure non-sticky. Without it one 503
  poisons the page until reload.
- **The read never throws.** A flag service outage must degrade to defaults, not a white screen.
- **Stale-while-revalidate means TTL expiry costs the user nothing.** Only the very first load ever waits.
- **Module scope is the singleton.** Every `import { flagClient }` gets the same instance; there is no
  need for `getInstance()`.

---

## 3. Low-level design (LLD)

### Client fields

```js
this.snapshot = { flags: null, overrides: {}, fetchedAt: null, status: 'idle' }; // replaced, never mutated
this.inFlight = null;                  // Promise<flags> while a request runs — the dedupe
this.storeListeners = new Set();       // useSyncExternalStore
this.flagListeners = new Map();        // name -> Set<(next, previous) => void>
this.stats = { requests: 0, deduped: 0, hits: 0, failures: 0, lastLatencyMs: null };
```

Why `snapshot` is replaced on every change: `useSyncExternalStore` compares snapshots by reference. A
mutated object would look unchanged and React would not re-render.

### Public API

```js
getFeatureState(name, defaultValue = false) -> Promise<boolean>   // never rejects
peek(name, defaultValue = false)            -> boolean            // sync, cache only
refresh()                                   -> Promise<flags>     // deduped
setOverride(name, value | null)             -> void
subscribe(name, (next, previous) => void)   -> unsubscribe
subscribeStore(listener) / getSnapshot()    // React contract
clear()                                     -> void               // drop memory + storage
```

### Options (all injectable — that is what makes it testable)

```js
new FlagClient({ fetchFlags, ttlMs, now = Date.now, storage = localStorage, storageKey })
```

`now` and `fetchFlags` are injected so the check file can move time and resolve responses by hand. A
flag SDK tested with real `setTimeout` is a flaky test suite.

---

## 4. The data model

Wire format:

```json
{ "new-editor": true, "dark-sidebar": false, "ai-summaries": true, "bulk-edit": false }
```

Persisted:

```json
{ "flags": { "new-editor": true, "dark-sidebar": false }, "fetchedAt": 1789850000000 }
```

`fetchedAt` is stored so a reload knows how old the snapshot is. It is treated as stale on load, so the
first read answers from storage **and** refreshes.

**Fork — values only, or rich flag objects?**

| | `{ name: boolean }` | `{ name: { value, variant, rollout, rules } }` |
| --- | --- | --- |
| Evaluated where | server, per user | client evaluates rules |
| Payload | tiny | grows with rules |
| Leaks targeting rules to the browser | no | yes |
| A/B variants | boolean only | multivariate |

Ship booleans (the question). Say that multivariate becomes `Record<string, string | boolean>` with the
same cache, and that targeting rules should stay server-side.

---

## 5. Pass 1 — the naive versions (target: 8 minutes)

#### V0 — fetch on every call

```js
async function getFeatureState(name, defaultValue = false) {
  try {
    const flags = await fetchFlags();
    return name in flags ? flags[name] : defaultValue;
  } catch {
    return defaultValue;
  }
}
```

Correct and simple. `N` flag reads per page = `N` requests. With 30 gated components that is 30 identical
GETs on every navigation.

#### V1 — cache the resolved value

```js
let cache = null;
async function getFeatureState(name, defaultValue = false) {
  if (!cache) cache = await fetchFlags();          // ← read-then-await-then-write
  return name in cache ? cache[name] : defaultValue;
}
```

Demonstrate the bug in the console, because it is the point of the question:

```js
await Promise.all(Array.from({ length: 10 }, () => getFeatureState('new-editor')));
// fetchFlags called 10 times — every caller saw cache === null before the first response landed
```

`cache` is only written after the await, so every call that starts before then misses.

---

## 6. Pass 2 — the promise cache (target: 10 minutes)

### 6.1 The ladder

| Rung | Requests for 10 concurrent first reads | After failure | After TTL |
| --- | --- | --- | --- |
| V0 fetch per call | 10 | fine | fine |
| V1 cache value | **10** | fine | never refreshes |
| V2 cache the promise | **1** | retries next call | never refreshes |
| **V3 V2 + TTL + SWR + persist** | **1** | **retries; last good kept** | **stale answer now, 1 background refresh** |

#### V2 — cache the promise, drop it on failure

```js
let inFlight = null;
let flags = null;

function refresh() {
  if (inFlight) return inFlight;                    // everyone joins the running request
  inFlight = fetchFlags()
    .then((next) => { flags = next; return next; })
    .finally(() => { inFlight = null; });           // failure is NOT cached
  return inFlight;
}

async function getFeatureState(name, defaultValue = false) {
  try {
    const current = flags ?? (await refresh());
    return name in current ? current[name] : defaultValue;
  } catch {
    return defaultValue;
  }
}
```

`O(1)` requests per page load regardless of callers. The `Promise` object *is* the lock — JavaScript is
single-threaded, so the `if (inFlight)` check and the assignment cannot interleave.

#### V3 — TTL, stale-while-revalidate, persistence ← **build this**

```js
load() {
  const { flags } = this.snapshot;
  if (flags && this.isFresh()) return Promise.resolve(flags);          // hit
  if (flags) { this.refresh().catch(() => {}); return Promise.resolve(flags); } // stale: answer now
  return this.refresh();                                               // cold: wait once
}
```

### 6.2 Why V3 wins

What changed between rungs is **what is being cached**. V1 caches a value, which only exists after the
race is over. V2 caches the *work in progress*, which exists from the first call — so the race has
nobody to lose. V3 then decouples *answering* from *refreshing*: after the TTL the caller still gets an
answer synchronously-fast, and exactly one refresh runs behind it. Only a cold start with an empty
storage ever waits on the network.

**Ship V3 in a 45-minute interview.** V2 is the part that is graded; say it first and demo the counter
going from 10 to 1. TTL + SWR is ~6 more lines and is the first follow-up every report mentions.
Persistence is 2 methods wrapped in `try/catch`.

This is memoisation of an async call (a promise memo), not dynamic programming.

### 6.3 Failure semantics — say them as a table

| Situation | `getFeatureState` returns | Next call |
| --- | --- | --- |
| Cold start, request fails | caller's default | retries (promise dropped) |
| Stale refresh fails | last good value | retries after next read |
| Flag not on server (typo) | caller's default + warning | no extra request |
| Storage throws / corrupt | ignored, cache miss | normal fetch |

---

## 7. Pass 3 — overrides and subscriptions (target: 8 minutes)

```js
setOverride(name, value) {
  const previous = this.peek(name);
  const overrides = { ...this.snapshot.overrides };
  if (value === null) delete overrides[name]; else overrides[name] = value;
  this.setSnapshot({ ...this.snapshot, overrides });
  const next = this.peek(name);
  if (next !== previous) this.notifyFlag(name, next, previous);
}
```

Subscriptions fire on **effective** value change, not server value change. If a developer forced
`new-editor` on and the server flips it on too, nothing visible changed and nobody should be told. The
check file asserts exactly that.

Where overrides come from is a separate concern: `?ff.new-editor=on` in the URL, a dev toolbar, or
`localStorage`. They all call `setOverride`. Never honour URL overrides in production for flags that gate
security or billing — overrides are a client-side convenience, the server still enforces.

---

## 8. Pass 4 — React (target: 8 minutes)

```jsx
function useFeatureFlag(name, defaultValue = false) {
  const snapshot = useSyncExternalStore(flagClient.subscribeStore, flagClient.getSnapshot, flagClient.getSnapshot);
  useEffect(() => { flagClient.getFeatureState(name, defaultValue); }, [name, defaultValue]);
  const enabled = name in snapshot.overrides ? snapshot.overrides[name]
    : snapshot.flags && name in snapshot.flags ? snapshot.flags[name] : defaultValue;
  return { enabled, isLoading: snapshot.flags === null && snapshot.status !== 'error' };
}

function Feature({ name, fallback = null, children }) {
  const { enabled, isLoading } = useFeatureFlag(name);
  if (isLoading) return fallback;                 // never flash the new UI, then yank it
  return enabled ? children : fallback;
}
```

Why `useSyncExternalStore` and not `useState` + effect: the store lives outside React and changes from
outside React. With one `useState` per component, two components can read different values in the same
commit (tearing). The external-store hook gives every component the same snapshot for a render.

Why the loading state renders the *fallback*: the fallback is the current production UI. Showing a
spinner where the old editor was, or showing the new editor and then removing it, are both worse.

---

## 9. The single-file version — what you actually type

Plain JS SDK + React hook + component + a small page. No styles.

```jsx
import { useEffect, useSyncExternalStore } from 'react';

/* ───────────── utils/fake-flag-server.js ───────────── */

const server = { flags: { 'new-editor': true, 'dark-sidebar': false }, latencyMs: 800, failNext: false };

function fetchFlags() {
  const fail = server.failNext;
  server.failNext = false;
  const body = { ...server.flags };
  return new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error('503')) : resolve(body)), server.latencyMs));
}

/* ───────────── utils/flag-client.js — the SDK ───────────── */

class FlagClient {
  constructor({ fetchFlags, ttlMs, now = () => Date.now(), storage = null, storageKey = 'ff:v1' }) {
    this.fetchFlags = fetchFlags;
    this.ttlMs = ttlMs;
    this.now = now;
    this.storage = storage;
    this.storageKey = storageKey;
    this.inFlight = null;                                  // the dedupe
    this.storeListeners = new Set();
    this.flagListeners = new Map();
    this.stats = { requests: 0, deduped: 0, hits: 0, failures: 0 };
    const saved = this.readSaved();                        // reload renders with values, no wait
    this.snapshot = { flags: saved?.flags ?? null, overrides: {}, fetchedAt: saved?.fetchedAt ?? null,
      status: saved ? 'ready' : 'idle' };
  }

  async getFeatureState(name, defaultValue = false) {
    if (name in this.snapshot.overrides) return this.snapshot.overrides[name];
    let flags;
    try {
      flags = await this.load();
    } catch {
      return defaultValue;                                 // never throw into the UI
    }
    if (!(name in flags)) {
      console.warn(`[flags] unknown flag "${name}", using default ${defaultValue}`);
      return defaultValue;
    }
    return flags[name];
  }

  peek(name, defaultValue = false) {
    const { overrides, flags } = this.snapshot;
    if (name in overrides) return overrides[name];
    return flags && name in flags ? flags[name] : defaultValue;
  }

  isFresh() {
    const { flags, fetchedAt } = this.snapshot;
    return flags !== null && this.now() - fetchedAt < this.ttlMs;
  }

  load() {
    const { flags } = this.snapshot;
    if (flags && this.isFresh()) { this.stats.hits++; return Promise.resolve(flags); }
    if (flags) {                                           // stale-while-revalidate
      this.stats.hits++;
      this.refresh().catch(() => {});
      return Promise.resolve(flags);
    }
    return this.refresh();
  }

  refresh() {
    if (this.inFlight) { this.stats.deduped++; return this.inFlight; } // join the running request
    this.stats.requests++;
    if (!this.snapshot.flags) this.setSnapshot({ ...this.snapshot, status: 'loading' });
    this.inFlight = this.fetchFlags()
      .then((flags) => { this.commit(flags); return flags; })
      .catch((error) => {
        this.stats.failures++;
        this.setSnapshot({ ...this.snapshot, status: this.snapshot.flags ? 'ready' : 'error' });
        throw error;
      })
      .finally(() => { this.inFlight = null; });           // failure is never cached
    return this.inFlight;
  }

  commit(next) {
    const before = this.snapshot;
    const changed = Object.keys({ ...before.flags, ...next }).filter((n) => before.flags?.[n] !== next[n]);
    const previous = new Map(changed.map((n) => [n, n in before.overrides ? before.overrides[n] : before.flags?.[n]]));
    this.setSnapshot({ ...before, flags: next, fetchedAt: this.now(), status: 'ready' });
    try { this.storage?.setItem(this.storageKey, JSON.stringify({ flags: next, fetchedAt: this.now() })); } catch {}
    if (before.flags === null) return;                     // first load is not a change
    for (const name of changed) {
      const current = this.peek(name);
      if (current !== previous.get(name)) this.notifyFlag(name, current, previous.get(name));
    }
  }

  setOverride(name, value) {
    const previous = this.peek(name);
    const overrides = { ...this.snapshot.overrides };
    if (value === null) delete overrides[name]; else overrides[name] = value;
    this.setSnapshot({ ...this.snapshot, overrides });
    const next = this.peek(name);
    if (next !== previous) this.notifyFlag(name, next, previous);
  }

  clear() {
    try { this.storage?.removeItem(this.storageKey); } catch {}
    this.setSnapshot({ ...this.snapshot, flags: null, fetchedAt: null, status: 'idle' });
  }

  subscribe(name, callback) {
    if (!this.flagListeners.has(name)) this.flagListeners.set(name, new Set());
    this.flagListeners.get(name).add(callback);
    return () => this.flagListeners.get(name).delete(callback);
  }

  notifyFlag(name, next, previous) {
    this.flagListeners.get(name)?.forEach((cb) => cb(next, previous));
  }

  subscribeStore = (listener) => { this.storeListeners.add(listener); return () => this.storeListeners.delete(listener); };
  getSnapshot = () => this.snapshot;

  setSnapshot(next) {
    this.snapshot = next;                                  // replace, never mutate: React compares by reference
    this.storeListeners.forEach((listener) => listener());
  }

  readSaved() {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;                                         // corrupt/blocked storage = cache miss
    }
  }
}

/* ───────────── utils/flag-singleton.js ───────────── */

const safeStorage = (() => { try { localStorage.setItem('_p', '1'); localStorage.removeItem('_p'); return localStorage; } catch { return null; } })();

export const flagClient = new FlagClient({ fetchFlags, ttlMs: 10_000, storage: safeStorage });

/* ───────────── hooks/use-feature-flag.js ───────────── */

function useFeatureFlag(name, defaultValue = false) {
  const snapshot = useSyncExternalStore(flagClient.subscribeStore, flagClient.getSnapshot, flagClient.getSnapshot);
  useEffect(() => { flagClient.getFeatureState(name, defaultValue); }, [name, defaultValue]);
  const enabled = name in snapshot.overrides ? snapshot.overrides[name]
    : snapshot.flags && name in snapshot.flags ? snapshot.flags[name] : defaultValue;
  return { enabled, isLoading: snapshot.flags === null && snapshot.status !== 'error' };
}

/* ───────────── components/feature.jsx ───────────── */

function Feature({ name, fallback = null, children }) {
  const { enabled, isLoading } = useFeatureFlag(name);
  if (isLoading) return fallback;
  return enabled ? children : fallback;
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const snapshot = useSyncExternalStore(flagClient.subscribeStore, flagClient.getSnapshot, flagClient.getSnapshot);

  const burst = async () => {
    flagClient.clear();                                            // force a cold read
    const values = await Promise.all(Array.from({ length: 10 }, () => flagClient.getFeatureState('new-editor')));
    console.log(values, flagClient.stats);                         // requests +1, deduped +9
  };

  return (
    <main>
      <p>status: {snapshot.status}</p>
      <button onClick={burst}>10 concurrent reads</button>
      <button onClick={() => flagClient.setOverride('dark-sidebar', true)}>force dark-sidebar</button>
      <button onClick={() => flagClient.setOverride('dark-sidebar', null)}>clear override</button>
      <button onClick={() => { server.failNext = true; flagClient.refresh().catch(() => console.log('failed; last good kept')); }}>
        fail next refresh
      </button>

      <Feature name="new-editor" fallback={<div>Legacy editor</div>}>
        <div>New editor</div>
      </Feature>
      <Feature name="dark-sidebar" fallback={<div>Light sidebar</div>}>
        <div>Dark sidebar</div>
      </Feature>
    </main>
  );
}

flagClient.subscribe('dark-sidebar', (next, previous) => console.log(`dark-sidebar ${previous} → ${next}`));
```

**Build it in this order:** V0 in `index.js` with a `console.log` → V1 and the 10-call demo that
exposes the race → V2 `inFlight` + `.finally` → TTL + SWR in `load()` → persistence → overrides →
`subscribe` + diff in `commit` → the hook and `<Feature>`.

Narrate two lines while typing, because they are what the question tests: `if (this.inFlight) return
this.inFlight` — *"the promise is the lock"* — and `.finally(() => { this.inFlight = null })` —
*"otherwise one 503 is cached for the life of the page."*

---

## 10. Verification

```bash
node src/projects/feature-flag-sdk/utils/flag-client.check.ts
```

The check injects `now` and a hand-resolved `fetchFlags`, so every scenario is deterministic: 10 callers
→ 1 request (9 deduped), TTL hit, typo → default, stale answer + one background request + subscriber
told `true->false`, override beats server, a server change hidden by an override does **not** notify,
cold failure → default and retry, hydrated snapshot answers without waiting, corrupt storage is a miss.

Demo script (playground page):

1. Load → one `request sent` in the log even though four `<Feature>`s mounted (plus StrictMode's
   double effects) — the rest are `joined in-flight request`.
2. *Clear cache + storage*, then *Call getFeatureState ×10* → requests +1, deduped +9.
3. Flip `dark-sidebar` "on the server"; the *Client cache* column shows **stale** until the TTL passes and
   a read refreshes it; the gated UI switches without a reload.
4. Force an override → *Effective* changes immediately; the server column is untouched.
5. Tick *Fail the next request*, *Refresh now* → `request failed`, status stays `ready`, values stay.
6. Reload the page → gated UI renders from storage before any request finishes.

---

## 11. Cross-questions and answers

**"How would you measure the performance?"**
`performance.now()` around `fetchFlags` (latency per request), counters for requests / deduped / hits /
failures (the playground shows them), and — the one that matters to users — time-to-first-flag on page
load. Report with `performance.mark`/`measure` and send to analytics with `navigator.sendBeacon`.
Track the hit ratio: a low one means the TTL is too short or instances are not shared.

**"How do you share it across different apps on the same page?"**
One module instance per bundle is the singleton *within* a bundle. Across independently-deployed apps
(micro-frontends), expose one instance on a namespaced global (`window.__FLAGS__ ??= new FlagClient(…)`)
or a shared-dependency in module federation, and version it so two major versions can coexist. Across
tabs: `BroadcastChannel('flags')` to push fresh snapshots so each tab doesn't refetch.

**"The server fails — what does the user see?"**
Nothing different: defaults on a cold start (defaults must be the *safe* choice, i.e. the existing UI),
last good values afterwards. Add exponential backoff on repeated failures so an outage doesn't turn every
component mount into a request.

**"Real-time updates instead of TTL polling?"**
SSE or a WebSocket pushing `{flag, value}`; `commit()` already diffs and notifies. Keep the TTL as a
safety net for missed messages.

**"User targeting / percentage rollout?"**
Evaluate on the server with the user id and return booleans — the client never sees the rules. If it
must be client-side, hash `userId + flagName` into 0–99 and compare to the rollout percentage, so the
same user always lands in the same bucket.

**"How does A/B testing differ?"**
Variants instead of booleans, and **exposure events**: log `{experiment, variant, userId}` the first time
the variant is actually rendered, not when it is fetched — otherwise analysis counts users who never saw
the treatment.

**"Why not React Context?"**
Context works for React-only consumers, but the question says multiple applications, some possibly not
React. The external store serves both; a Context provider can wrap it if a team wants one.

**"Isn't `this.inFlight` a race?"**
No. JavaScript runs one callback at a time; the check and the assignment happen in the same synchronous
turn. The race in V1 existed only because the write happened *after* an `await`.

**"How do you test it?"**
Inject time and network. The check file never sleeps: it resolves the fake request when it chooses and
moves the clock by assignment. Then assert on counts (requests/deduped) — the observable property the
feature exists for.

**"Security?"**
Flags are not permissions. Anything a flag hides must still be enforced by the server — a user can flip
any client-side flag in DevTools.
