# Atlassian JS Round Utilities — Interview Build Guide

The Atlassian **JavaScript coding** round asks for executable code with visible (logged) output: *"set up an
IDE that can log the current time when the program runs"*. Beyond the big SDK questions (feature flags,
analytics, performance — each has its own project), candidates report a set of smaller utilities, often as
the first question or a follow-up. This guide covers all of them, each as a short build with the one decision
that is actually graded. Plain JavaScript, one `index.js`, `console.log` output. Each utility is 5–15 minutes.

| Utility | Reported as | Where |
| --- | --- | --- |
| `Stream` subscribe / push / unsubscribe | Glassdoor FE phone screen; FrontendLead #473, #475 (Confluence team), #471 | Pass 1 |
| `retry(task, n)` recursive | Glassdoor FE onsite — *"you have to use recursion"* | Pass 2 |
| `flattenTree` + `getValueList(from, to)` with `getBatch` | FrontendLead #466; Glassdoor *"Flatten List + async/await"* | Pass 3 |
| `flattenObject` | Blind — *"why is Atlassian so obsessed with flattening nested objects?"* | Pass 3 |
| `Promise.any` from memory | Frontend Interview Handbook (Karat); Glassdoor | Pass 4 |
| run in sequence / promise pool | Prepfully (Atlassian FE) | Pass 4 |
| `Function.prototype.bind` | GreatFrontEnd Atlassian list; Glassdoor *"change the reference of this"* | Pass 5 |
| `memoize` + shared async fetch by key | GreatFrontEnd list; Glassdoor *"a common module used by multiple apps to fetch data for a key (memoization)"* | Pass 5 |
| `throttle` / `debounce` | GreatFrontEnd list; Glassdoor *"question related to throttle and closure"* | Pass 6 |
| chainable API client | GreatFrontEnd Atlassian list: *"API Client"* | Pass 7 |
| rate limiter | FrontendLead #474 (frontend phone interview) | Pass 8 |
| `localStorage` with expiry | Prepfully (Atlassian FE); the feature-flag caching follow-up | Pass 9 |

**Minute budget (a 60-minute round usually takes two or three of these, with follow-ups)**

| Time | Phase |
| --- | --- |
| 0–3 | Restate the prompt, write the example as a test (`console.assert` / logged expectation) |
| 3–15 | First utility, simplest correct version, run it |
| 15–25 | Its follow-ups (the interviewer escalates) |
| 25–50 | Second (and third) utility |
| 50–60 | Edge cases, complexity, how you'd test it |

---

## 0. Sandbox setup

```text
src/
  index.js     # utilities + a main() that logs; run with `node src/index.js` or the sandbox console
```

Target split (this repo):

```text
js-round/
  index.tsx                   # list of utilities, prompt, Run button, on-page console
  js-round.css
  constants/demos.ts          # one runnable demo per utility (what is logged)
  utils/stream.ts
  utils/promise.utils.ts      # retry, promiseAny, runInSequence, promisePool
  utils/flatten.utils.ts      # flattenTree, getValueList, flattenObject
  utils/function.utils.ts     # bindPolyfill, memoize, memoizeAsync, debounce, throttle
  utils/api-client.ts         # createApiClient, HttpError
  utils/rate-limiter.ts       # createRateLimiter, rateLimited
  utils/ttl-storage.ts        # createTtlStorage
  utils/js-round.check.ts     # assertions for all of the above
  hooks/use-js-round.ts       # selection, run id, log lines
```

Habit worth showing in the round: **write the prompt's example as the first test before the code**, then run
it. *"Output matters"* is how the Karat and JS rounds are graded.

---

## 1. Requirement gathering (for every utility)

Four questions cover almost all of them:

1. **"What exactly is the input and output — can you give me one example?"** Then say it back as a test.
2. **"Sync or async? Can a callback throw / a promise reject?"** Decides error paths.
3. **"Order — does output have to follow input order or completion order?"** (`getValueList`, pools, `Promise.any` errors.)
4. **"Scale — how many items, how deep, how often?"** (recursion depth, parallelism limits, memory.)

Say the plan in one sentence per utility; this guide gives that sentence at the top of each pass.

---

## 2. High-level design — what connects them

```text
 closures holding state        promises composed          recursion vs explicit stack
 ─────────────────────         ─────────────────          ─────────────────────────
 Stream (Map of subscribers)   retry (recursive chain)    flattenTree (stack, pre-order)
 memoize (Map cache)           Promise.any (counter)      flattenObject (path accumulator)
 debounce/throttle (timer)     sequence / pool (slots)    getValueList (Promise.all + flatten)
 rate limiter (timestamp log)  memoizeAsync (promise memo)
 TTL storage (expiry in value) API client (immutable builder → fetch)
```

The claim that ties them: **the interesting state lives in a closure or a small Map, and every utility has one
line that is the whole question** — call it out while typing.

---

## 3. Low-level design — signatures

```js
new Stream()                          .subscribe(fn) -> unsubscribe · .push(value)
retry(task, n, delayMs = 0)           -> Promise
flattenTree(nodes)                    -> [{ value }]              // pre-order
getValueList(getBatch, from, to)      -> Promise<[{ value }]>     // parallel, index order
flattenObject(obj, sep = '.')         -> { 'a.b': v }
promiseAny(iterable)                  -> Promise                  // AggregateError if all reject
runInSequence(tasks)                  -> Promise<results>
promisePool(tasks, limit)             -> Promise<results>         // ≤ limit in flight, task order
bindPolyfill(fn, thisArg, ...preset)  -> bound                    // works with `new`
memoize(fn, resolver?)                -> memoized (.cache)
memoizeAsync(fetcher, ttlMs?)         -> (key) => Promise         // shared in-flight, failures not cached
debounce(fn, wait)                    -> debounced (.cancel, .flush)
throttle(fn, wait)                    -> throttled (.cancel)      // leading + one trailing with latest args
createApiClient(base, fetcher)        -> builder (.get/.post/.query/.headers/.send)
createRateLimiter(limit, windowMs)    -> { tryAcquire(key) }      // sliding log
rateLimited(fn, limit, windowMs)      -> queued fn
createTtlStorage(store)               -> { set(k, v, ttl), get(k, fallback), remove(k) }
```

---

## 4. The data model

The shapes the prompts use:

```json
[{ "value": "value1", "children": [{ "value": "value2", "children": [] }] }]
```

```json
{ "a": { "b": 1, "c": [2, 3] } }   →   { "a.b": 1, "a.c.0": 2, "a.c.1": 3 }
```

```json
{ "value": { "new-editor": true }, "expiresAt": 1789850010000 }       // TTL storage entry
```

---

## 5. Pass 1 — Stream (8 minutes)

> *"A Map from a unique token to the callback; `subscribe` returns a closure that deletes its own token; `push`
> iterates a snapshot."*

```js
class Stream {
  #subscribers = new Map();
  subscribe(callback) {
    const token = Symbol('subscription');
    this.#subscribers.set(token, callback);
    return () => this.#subscribers.delete(token);          // removes exactly this subscription
  }
  push(value) {
    for (const callback of [...this.#subscribers.values()]) callback(value);  // snapshot
  }
}
```

| Storage | `unsubscribe` | Same fn subscribed twice | Unsubscribe during push |
| --- | --- | --- | --- |
| Array + `indexOf(fn)` | `O(n)`, removes the **first** match — maybe the wrong one | works | skips the next subscriber (index shift) |
| `Set` of fns | `O(1)` | **second subscribe is a no-op** | fine if iterating a copy |
| **`Map<token, fn>`** | **`O(1)`, exact** | **two independent subscriptions** | **fine with a snapshot** |

Follow-ups: `once` (unsubscribe inside the wrapper), error isolation (try/catch per subscriber, rethrow async so
one bad subscriber can't stop the rest), replay the last value to late subscribers (`BehaviorSubject`).

---

## 6. Pass 2 — retry, recursively (6 minutes)

> *"Call the task; on rejection, if attempts remain, call myself with one fewer; otherwise rethrow the last error."*

```js
function retry(task, attempts, delayMs = 0) {
  return task().catch((error) => {
    if (attempts <= 1) throw error;
    const wait = delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve();
    return wait.then(() => retry(task, attempts - 1, delayMs * 2));   // exponential backoff
  });
}
```

The recursion is on the **promise chain**, not the call stack — each retry starts from a fresh microtask, so
large `n` cannot overflow. Say what to retry: network errors and 5xx/429, never 4xx validation errors (pass a
`shouldRetry(error)` predicate). Add jitter in production.

---

## 7. Pass 3 — flattening (12 minutes)

> *"Pre-order with an explicit stack, children pushed in reverse. Then fetch every batch in parallel and
> flatten in index order."*

```js
function flattenTree(nodes) {
  const out = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop();
    out.push({ value: node.value });
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return out;
}

async function getValueList(getBatch, from, to) {
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const batches = await Promise.all(indices.map(getBatch));   // parallel; Promise.all keeps INDEX order
  return batches.flatMap(flattenTree);
}
```

### Ladder — `getValueList`

| Rung | Latency for k batches | Output order | Failure |
| --- | --- | --- | --- |
| `for … await getBatch(i)` | sum of all | index | stops at the failing batch |
| `forEach(async …)` pushing into an array | fast | **completion order — wrong** | unhandled rejections |
| **`Promise.all(indices.map(getBatch))`** | **max of all** | **index** | **one rejection rejects the call** |
| `promisePool(k tasks, limit)` | ≈ `k/limit × max` | index | same | 

What changed from the first rung to the third: the waits overlap instead of adding up, and `Promise.all`
places each result by its **input position**, so the arrival order stops mattering. Ship `Promise.all`; use the
pool when `k` is large enough to hammer the server.

`flattenObject` — recursive walk with a path accumulator; arrays become numeric path segments; empty
objects/arrays are kept as values (else they silently vanish); a `WeakSet` of ancestors turns a cycle into an
error instead of a hang (and is removed after the subtree, so a shared non-cyclic reference is allowed).

```js
function flattenObject(input, sep = '.') {
  const out = {};
  const ancestors = new WeakSet();
  (function walk(value, path) {
    if (value !== null && typeof value === 'object') {
      if (ancestors.has(value)) throw new TypeError(`Cycle at "${path}"`);
      const keys = Object.keys(value);
      if (!keys.length) { if (path) out[path] = value; return; }
      ancestors.add(value);
      for (const key of keys) walk(value[key], path ? `${path}${sep}${key}` : key);
      ancestors.delete(value);
      return;
    }
    out[path] = value;
  })(input, '');
  return out;
}
```

---

## 8. Pass 4 — Promise.any, sequence, pool (12 minutes)

> *"Resolve on the first fulfilment; count rejections, storing each by index; when the count reaches the input
> length, reject with an AggregateError."*

```js
function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = [...iterable];
    const errors = new Array(items.length);
    let pending = items.length;
    if (!pending) return reject(new AggregateError([], 'All promises were rejected'));
    items.forEach((item, i) => Promise.resolve(item).then(resolve, (error) => {
      errors[i] = error;                                     // input order, not timing order
      if (--pending === 0) reject(new AggregateError(errors, 'All promises were rejected'));
    }));
  });
}
```

`Promise.resolve(item)` so plain values and thenables work. Empty input rejects (spec behaviour — unlike
`Promise.all([])`, which resolves).

Sequence is a `for … of` with `await`. The pool keeps `limit` slots busy: each finished task pulls the next
index; results are written by index; the first rejection rejects the pool (or collect settled results if the
interviewer wants `allSettled` semantics).

---

## 9. Pass 5 — bind and memoize (10 minutes)

> *"`bind` returns a function that applies the original with the fixed `this` and preset args — unless it is
> called with `new`, in which case `this` is the new object."*

```js
function bindPolyfill(fn, thisArg, ...preset) {
  function bound(...args) {
    return new.target ? new fn(...preset, ...args) : fn.apply(thisArg, [...preset, ...args]);
  }
  if (fn.prototype) bound.prototype = Object.create(fn.prototype);   // instanceof keeps working
  return bound;
}
```

> *"Memoize by a key; for async, cache the promise so concurrent callers share one request, and delete it on
> rejection."*

```js
function memoizeAsync(fetcher, ttlMs = Infinity) {
  const cache = new Map();
  return (key) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
    const promise = fetcher(key).catch((e) => { cache.delete(key); throw e; });
    cache.set(key, { promise, at: Date.now() });
    return promise;
  };
}
```

Memoize cost to name: unbounded memory. Bound it with an LRU (a `Map` iterates in insertion order: delete +
re-set on hit, evict `map.keys().next().value` when full).

---

## 10. Pass 6 — debounce and throttle (10 minutes)

> *"Debounce: reset a timer on every call, run once after `wait` of silence. Throttle: run now if the window
> has passed, otherwise remember only the latest args and run them once when the window ends."*

| | Fires | Use for |
| --- | --- | --- |
| debounce | once, after the calls **stop** | search-as-you-type, resize end, autosave |
| throttle | at most once **per interval**, during the calls | scroll, mousemove, drag, rate-limited APIs |

```js
function throttle(fn, wait) {
  let last = -Infinity, timer, trailing = null;
  return (...args) => {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) { clearTimeout(timer); timer = undefined; trailing = null; last = Date.now(); fn(...args); return; }
    trailing = args;                                        // keep only the latest
    timer ??= setTimeout(() => { timer = undefined; last = Date.now(); const a = trailing; trailing = null; fn(...a); }, remaining);
  };
}
```

The trailing call is the follow-up that separates answers: a throttle without it drops the *final* scroll
position. The closure is the answer to *"explain the closure"*: `last`, `timer` and `trailing` persist between
calls because the returned function captured them.

---

## 11. Pass 7 — chainable API client (10 minutes)

> *"Each chain step returns a new builder with the change applied; `send()` builds the URL with
> URLSearchParams, adds JSON headers when there is a body, and throws on non-2xx because fetch doesn't."*

```js
const api = createApiClient('https://site.atlassian.net/rest/api/3', fetch).headers({ Authorization });
await api.get('/search').query({ jql: 'project = CONF' }).send();
await api.post('/issue', { fields: { summary } }).send();
```

Immutable builders are the design point: `api` is a shared base; if `.query()` mutated it, one request's query
would leak into the next. `URLSearchParams` encodes `&`, `=`, spaces and quotes — string concatenation doesn't.

---

## 12. Pass 8 — rate limiter (10 minutes)

### Ladder

| Algorithm | Memory per key | Burst at window edge | Exactness |
| --- | --- | --- | --- |
| Fixed window counter | `O(1)` | **2 × limit** across a boundary | approximate |
| **Sliding window log** | `O(limit)` | none | **exact** |
| Sliding window counter (weighted previous window) | `O(1)` | small | approximate |
| Token bucket | `O(1)` | controlled burst (bucket size) | exact for rate + burst |

```js
function createRateLimiter(limit, windowMs) {
  const logs = new Map();
  return {
    tryAcquire(key = 'default') {
      const now = Date.now();
      const log = logs.get(key) ?? [];
      while (log.length && now - log[0] >= windowMs) log.shift();        // expire from the front
      if (log.length < limit) { log.push(now); logs.set(key, log); return { allowed: true, retryAfterMs: 0 }; }
      return { allowed: false, retryAfterMs: windowMs - (now - log[0]) };
    },
  };
}
```

What changed from fixed window: the window moves with each request instead of resetting on the clock, so no
boundary exists to exploit. Amortised `O(1)` per call. The client-side variant (`rateLimited(fn)`) **queues**
calls and drains them when `retryAfterMs` passes, preserving order — a UI should delay, not drop.

---

## 13. Pass 9 — localStorage with expiry (5 minutes)

> *"Store the expiry next to the value; check it on read; expired reads delete and return the fallback; every
> storage call in try/catch."*

Storage has no TTL, so expiry is data. Lazy expiry (on read) is enough; a sweep on startup cleans keys that are
never read again. `JSON.parse` can throw, private mode can throw on `setItem`, quota can throw — all three are
"miss", never a crash.

---

## 14. The single-file version — what you actually type

All utilities plus a `main()` that logs, in plain JS. In the round you type only the ones asked for; the
banners say which file each block would be.

```js
/* ───────────── utils/stream.js ───────────── */

class Stream {
  #subscribers = new Map();
  subscribe(callback) {
    const token = Symbol('subscription');
    this.#subscribers.set(token, callback);
    return () => this.#subscribers.delete(token);
  }
  push(value) {
    for (const callback of [...this.#subscribers.values()]) callback(value);
  }
}

/* ───────────── utils/promise.utils.js ───────────── */

function retry(task, attempts, delayMs = 0) {
  return task().catch((error) => {
    if (attempts <= 1) throw error;
    const wait = delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve();
    return wait.then(() => retry(task, attempts - 1, delayMs * 2));
  });
}

function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = [...iterable];
    const errors = new Array(items.length);
    let pending = items.length;
    if (!pending) return reject(new AggregateError([], 'All promises were rejected'));
    items.forEach((item, i) =>
      Promise.resolve(item).then(resolve, (error) => {
        errors[i] = error;
        if (--pending === 0) reject(new AggregateError(errors, 'All promises were rejected'));
      }));
  });
}

async function runInSequence(tasks) {
  const results = [];
  for (const task of tasks) results.push(await task());
  return results;
}

function promisePool(tasks, limit) {
  return new Promise((resolve, reject) => {
    const results = new Array(tasks.length);
    let next = 0, done = 0, failed = false;
    if (!tasks.length) return resolve([]);
    const launch = () => {
      if (failed || next >= tasks.length) return;
      const i = next++;
      tasks[i]().then((value) => {
        results[i] = value;
        if (++done === tasks.length) resolve(results); else launch();
      }, (error) => { failed = true; reject(error); });
    };
    for (let i = 0; i < Math.min(limit, tasks.length); i++) launch();
  });
}

/* ───────────── utils/flatten.utils.js ───────────── */

function flattenTree(nodes) {
  const out = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop();
    out.push({ value: node.value });
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return out;
}

async function getValueList(getBatch, from, to) {
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const batches = await Promise.all(indices.map(getBatch));
  return batches.flatMap(flattenTree);
}

function flattenObject(input, sep = '.') {
  const out = {};
  const ancestors = new WeakSet();
  (function walk(value, path) {
    if (value !== null && typeof value === 'object') {
      if (ancestors.has(value)) throw new TypeError(`Cycle at "${path}"`);
      const keys = Object.keys(value);
      if (!keys.length) { if (path) out[path] = value; return; }
      ancestors.add(value);
      for (const key of keys) walk(value[key], path ? `${path}${sep}${key}` : key);
      ancestors.delete(value);
      return;
    }
    out[path] = value;
  })(input, '');
  return out;
}

/* ───────────── utils/function.utils.js ───────────── */

function bindPolyfill(fn, thisArg, ...preset) {
  function bound(...args) {
    return new.target ? new fn(...preset, ...args) : fn.apply(thisArg, [...preset, ...args]);
  }
  if (fn.prototype) bound.prototype = Object.create(fn.prototype);
  return bound;
}

function memoize(fn, resolver = (...args) => args[0]) {
  const cache = new Map();
  return (...args) => {
    const key = resolver(...args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
}

function memoizeAsync(fetcher, ttlMs = Infinity) {
  const cache = new Map();
  return (key) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
    const promise = fetcher(key).catch((e) => { cache.delete(key); throw e; });
    cache.set(key, { promise, at: Date.now() });
    return promise;
  };
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function throttle(fn, wait) {
  let last = -Infinity, timer, trailing = null;
  return (...args) => {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      clearTimeout(timer); timer = undefined; trailing = null;
      last = Date.now(); fn(...args);
      return;
    }
    trailing = args;
    timer ??= setTimeout(() => {
      timer = undefined; last = Date.now();
      const a = trailing; trailing = null; fn(...a);
    }, remaining);
  };
}

/* ───────────── utils/api-client.js ───────────── */

function createApiClient(baseUrl, fetcher, spec = { method: 'GET', path: '/', query: {}, headers: {} }) {
  const next = (patch) => createApiClient(baseUrl, fetcher, { ...spec, ...patch });   // immutable
  const url = () => {
    const search = new URLSearchParams(spec.query).toString();
    return `${baseUrl.replace(/\/+$/, '')}/${spec.path.replace(/^\/+/, '')}${search ? `?${search}` : ''}`;
  };
  return {
    get: (path) => next({ method: 'GET', path }),
    post: (path, body) => next({ method: 'POST', path, body }),
    query: (params) => next({ query: { ...spec.query, ...params } }),
    headers: (extra) => next({ headers: { ...spec.headers, ...extra } }),
    url,
    async send() {
      const hasBody = spec.body !== undefined;
      const response = await fetcher(url(), {
        method: spec.method,
        headers: hasBody ? { 'Content-Type': 'application/json', ...spec.headers } : spec.headers,
        body: hasBody ? JSON.stringify(spec.body) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, data });
      return data;
    },
  };
}

/* ───────────── utils/rate-limiter.js ───────────── */

function createRateLimiter(limit, windowMs) {
  const logs = new Map();
  return {
    tryAcquire(key = 'default') {
      const now = Date.now();
      const log = logs.get(key) ?? [];
      while (log.length && now - log[0] >= windowMs) log.shift();
      if (log.length < limit) { log.push(now); logs.set(key, log); return { allowed: true, retryAfterMs: 0 }; }
      return { allowed: false, retryAfterMs: windowMs - (now - log[0]) };
    },
  };
}

/* ───────────── utils/ttl-storage.js ───────────── */

function createTtlStorage(store) {
  return {
    set(key, value, ttlMs) {
      try { store.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs })); return true; } catch { return false; }
    },
    get(key, fallback) {
      try {
        const raw = store.getItem(key);
        if (raw === null) return fallback;
        const entry = JSON.parse(raw);
        if (Date.now() >= entry.expiresAt) { store.removeItem(key); return fallback; }
        return entry.value;
      } catch { return fallback; }
    },
  };
}

/* ───────────── index.js — main() ───────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function main(log = console.log) {
  log('started', new Date().toISOString());

  const z = new Stream();
  z.subscribe((v) => log(v));
  const off = z.subscribe((v) => log(v * 2));
  z.subscribe((v) => log(v * 3));
  z.push(2);                                                    // 2 4 6
  off();
  z.push(2);                                                    // 2 6

  let attempt = 0;
  log(await retry(() => (++attempt < 3 ? Promise.reject(new Error('503')) : Promise.resolve(`ok after ${attempt}`)), 5));

  const tree = [{ value: 'value0', children: [] }, { value: 'value1', children: [{ value: 'value2', children: [] }] }];
  log(flattenTree(tree).map((n) => n.value));
  log(await getValueList((i) => sleep(30 - i * 10).then(() => [tree[i - 1]]), 1, 2));
  log(flattenObject({ a: { b: 1, c: [2, 3] } }));

  log(await promiseAny([Promise.reject(new Error('down')), sleep(10).then(() => 'first')]));
  log(await promisePool([30, 10, 20].map((ms, i) => () => sleep(ms).then(() => i)), 2));

  function greet(greeting) { return `${greeting}, ${this.name}`; }
  log(bindPolyfill(greet, { name: 'Priya' }, 'Hi')());

  let requests = 0;
  const load = memoizeAsync(async (id) => { requests++; await sleep(10); return id; });
  await Promise.all([load('a'), load('a'), load('b')]);
  log(`requests: ${requests}`);                                 // 2

  const limiter = createRateLimiter(2, 1000);
  log([1, 2, 3].map(() => limiter.tryAcquire().allowed));        // true true false

  const memory = new Map();
  const ttl = createTtlStorage({ getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) });
  ttl.set('flags', { on: true }, 20);
  log(ttl.get('flags', null));
  await sleep(30);
  log(ttl.get('flags', 'expired'));

  const api = createApiClient('https://example.atlassian.net/rest', async (url) => ({ ok: true, status: 200, json: async () => ({ url }) }));
  log(await api.get('/search').query({ jql: 'a = "b"' }).send());
  log(typeof debounce(() => {}, 10), typeof throttle(() => {}, 10), await runInSequence([async () => 1, async () => 2]));
}

main();
```

**Build order in the round:** the prompt's example as a logged expectation → the simplest version that prints
the right thing → the follow-up the interviewer adds → edge cases you name without being asked (empty input,
errors, order, scale).

Narrate the one line per utility that is the question: `return () => subscribers.delete(token)`;
`return wait.then(() => retry(task, attempts - 1))`; `await Promise.all(indices.map(getBatch))`;
`errors[i] = error`; `new.target ? new fn(…) : fn.apply(…)`; `cache.set(key, promise)` before it resolves;
`trailing = args`; `return createApiClient(…, { ...spec, ...patch })`; `while (now - log[0] >= windowMs)
log.shift()`; `if (Date.now() >= entry.expiresAt)`.

---

## 15. Verification

```bash
node src/projects/js-round/utils/js-round.check.ts
```

Covers: Stream (same fn twice = two subscriptions, idempotent unsubscribe, unsubscribing mid-delivery),
retry (stops at first success, rethrows the last error after n), Promise.any (first fulfilment, AggregateError
with errors in input order, empty input rejects, plain values), sequence order, pool (task-order results, peak
concurrency = limit), flattenTree (the reported example, a 20 000-deep tree without stack overflow),
getValueList (all batches start before any finishes, index order despite reverse resolution), flattenObject
(arrays, empty objects, shared refs allowed, cycles throw), bind (partial args, `new`, `instanceof`), memoize
(resolver keys), memoizeAsync (shared in-flight, TTL, failures not cached), debounce (last call, flush, cancel),
throttle (leading + one trailing with latest args), API client (encoding, immutability, JSON body, HttpError),
rate limiter (per key, retry-after, sliding), `rateLimited` (queued, ordered, waited), TTL storage (expiry,
corrupt JSON, throwing storage).

Demo: the playground page runs each utility and prints timestamped output — e.g. `getBatch(3) resolved` before
`getBatch(1) resolved`, yet the list comes back in index order; the throttled scroll prints 0, 80, 180, 280 and
the trailing 300.

---

## 16. Cross-questions and answers

**"Why is `retry` recursion safe for large n?"** Each call returns a promise; the next attempt runs in a later
microtask, so the call stack never grows. The promise chain grows, and is released as it settles.

**"Why `Promise.resolve(item)` in Promise.any?"** Inputs may be values or foreign thenables; normalising gives one
code path.

**"Debounce in React?"** Keep the debounced function stable (`useMemo`/`useRef`) or every render creates a new
timer. Usually better: debounce the *value* with an effect (see the typeahead project).

**"Throttle vs requestAnimationFrame?"** For visual updates on scroll, rAF-throttling (one update per frame) is the
right clock; a time-based throttle can still update between frames or miss the last frame.

**"What does `bind` return for `length` and `name`?"** Native bound functions have `name = 'bound fn'` and
`length = max(0, fn.length - preset.length)`; set them with `Object.defineProperty` if asked.

**"Memoize with object arguments?"** A `Map` compares keys by identity — two equal objects are different keys.
Use a resolver (`JSON.stringify` for plain data) or a `WeakMap` when the key is an object and must not leak.

**"Rate limiter across tabs?"** In-memory state is per tab. Share through `BroadcastChannel`, or accept per-tab
limits; the real limit is enforced by the server anyway (`429` + `Retry-After`, which the client should honour).

**"flattenObject — how would you unflatten?"** Split each key on the separator, walk/create objects (or arrays when
the next segment is numeric), assign the leaf. Ambiguous if keys contain the separator — escape or use a
different separator.
