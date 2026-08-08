# Autocomplete / Typeahead — Interview Build Guide

Build a search input that suggests cities from a remote source: debounced, ranked, highlighted,
keyboard navigable, race-safe, cached, and accessible. Plain JavaScript, fresh CodeSandbox.
Target 45–60 minutes.

This guide is a script for the room: what to ask, what to say, what to type, and where to stop.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Matching | **Build the ranked trie** — `O(q + k)` per query, independent of dataset size. The `O(N)` scan is written first as a 6-line *oracle*, then replaced and kept as the test. |
| Async | Debounce the derived value, request-id ordering guard, query cache. All three, all built. |
| Discussed, not built | n-gram inverted index (fuzzy/typo matching), server-side search, virtualised list. |

The scan is not the deliverable. It is the reference implementation you diff the index against — that
is what makes shipping the index safe in 45 minutes instead of reckless.

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements, assumptions stated out loud |
| 5–10 | HLD, data shape, state list |
| 10–14 | Scan oracle + list rendering — something on screen |
| 14–24 | **The trie index** — build, top-k per node, differential check |
| 24–30 | Debounce and the async boundary |
| 30–40 | Race conditions and cache — the correctness centrepiece |
| 40–50 | Keyboard navigation and selection |
| 50–60 | ARIA, all five UI states, demo, trade-off talk |

---

## 0. Sandbox setup

React + JS template, one file to start. Split when it stops fitting on screen.

```text
src/
  App.jsx
  styles.css
```

Target split (this repo's layout — mirror it once behaviour is right):

```text
typeahead-search/
  index.tsx
  typeahead-search.types.ts               # City, HighlightSegment
  typeahead-search.css
  constants/city-dataset.ts               # the seed data
  constants/typeahead.constants.ts        # debounce ms, min length, max results, messages
  utils/typeahead.utils.ts                # pure: normalise, scoreCity, rankByScan (oracle),
                                          #       buildSuggestIndex, suggest,
                                          #       splitHighlight, nextIndex
  utils/suggest-api.ts                    # fake async service: latency + jitter + failures
  hooks/use-debounced-value.ts
  hooks/use-click-outside.ts
  hooks/use-typeahead.ts                  # all state, effects, refs, keyboard handling
  components/suggestion-list.tsx
  components/suggestion-option.tsx
  components/highlighted-text.tsx
```

Say: *"Pure ranking functions in utils so I can test them without React, one hook that owns every
piece of state and the request lifecycle, and dumb components. The fake API stays behind the same
interface a real `fetch` would have, so swapping it changes nothing above it."*

---

## 1. Requirement gathering (5 minutes)

1. **"Is the data local or remote?"**
   Local means a pure filter and no async at all. Remote brings debounce, loading, errors, races,
   caching — i.e. the actual interview.
   *Default: remote, behind a promise-returning function.*
2. **"How big is the dataset, and does it change while the page is open?"**
   Size decides scan vs index; mutability decides whether an index is even legal — an index that is
   rebuilt on every write is worse than no index.
   *Default: static for the session, so precomputation is free after load.*
3. **"Prefix match, substring, or fuzzy?"**
   This picks the data structure, so ask it before writing anything.
   | Answer | Structure | Query cost |
   | --- | --- | --- |
   | Prefix only | trie over names | `O(q + k)` |
   | Prefix + substring | trie over **every suffix** | `O(q + k)` |
   | Fuzzy / typo-tolerant | n-gram inverted index, or a search service | `O(candidates)` |
   *Default: substring, ranked below prefix — so the suffix trie is the one being built.*
4. **"How do results rank when several match?"**
   Never let this go unasked — "alphabetical" and "by population" produce very different products.
   *Default: match quality, then population, then name.*
5. **"Single select or multi-select chips?"**
   *Default: single.*
6. **"Keyboard and screen-reader support in scope?"**
   *Default: yes — it is half the reason this question gets asked.*
7. **"What should happen on a failed request? Free-text submit allowed?"**
   *Default: inline error, keep the typed text; Enter with no active option submits the raw text.*

Then state the plan:

> "The input stays fully controlled and updates on every keystroke — I'll debounce the *network*, not
> the typing. Only the newest response is allowed to write to state. Focus never leaves the input;
> the active option is exposed with `aria-activedescendant`. For matching I'll write the naive scan
> first as a reference, then build a ranked suffix trie with the top-k precomputed at each node, and
> assert the two agree — so the read path is `O(query length)`, not `O(dataset)`."

---

## 2. High-level design (HLD)

```text
 keystroke
    │
    ▼
┌──────────────┐   query (every keystroke, no delay)   ┌─────────────────┐
│  <input>     │ ────────────────────────────────────▶ │  query state    │
└──────────────┘                                       └────────┬────────┘
                                                                │ 250ms debounce
                                                                ▼
                                                       ┌─────────────────┐
                                            ┌───────── │ debouncedQuery  │
                                            │          └────────┬────────┘
                                            │ normalise(q) = cache key
                                            ▼                   │
                                   ┌────────────────┐           │ miss
                                   │ cache: Map     │ ── hit ─┐ │
                                   │ q -> results   │         │ ▼
                                   └────────────────┘         │ ┌──────────────────┐
                                                              │ │ searchCities()   │
                                            ┌─────────────────┘ │ latency + jitter │
                                            ▼                   │ + failures       │
                                            │                   │   ↓              │
                                            │                   │ suggest(index,q) │
                                            │                   │ trie walk, O(q+k)│
                                   ┌────────────────┐           └────────┬─────────┘
                                   │ requestId ref  │◀───────────────────┘
                                   │ stale? drop it │  only newest writes state
                                   └───────┬────────┘
                                           ▼
                                   ┌────────────────┐        ┌────────────────────┐
                                   │ suggestions[]  │ ─────▶ │ <SuggestionList>   │
                                   │ isOpen/Loading │        │  <SuggestionOption>│
                                   │ error/selected │        │   <HighlightedText>│
                                   │ activeIndex    │        └────────────────────┘
                                   └────────────────┘
```

Five claims to make about this picture:

- **The index is built once, outside React.** It is derived from data that does not change during
  the session, so it belongs at module load (or one `useMemo`), never inside the effect that runs
  per keystroke. Building an index per keystroke is strictly worse than not having one.
- **The input is never debounced.** Debouncing `setQuery` makes a controlled input visibly lag behind
  the keyboard. Debounce the derived value that triggers the effect.
- **`normalise(query)` is one function used three ways**: the fetch guard, the cache key, and the
  highlight needle. One place to change trimming/casing rules.
- **Two independent async defences.** The cache removes repeated *work*; the request id enforces
  *ordering*. Neither replaces the other — a cache hit must also invalidate an older in-flight
  request, or the slow response lands on top of the instant one.
- **`activeIndex` is virtual focus.** DOM focus stays in the input, always, because the user is still
  typing.

---

## 3. Low-level design (LLD)

### State

```js
const [query, setQuery]           = useState('');   // exactly what is in the input
const [suggestions, setSuggestions] = useState([]); // newest accepted result set
const [isOpen, setIsOpen]         = useState(false);
const [isLoading, setIsLoading]   = useState(false);
const [error, setError]           = useState(null);
const [selected, setSelected]     = useState(null); // the committed city, or null
const [activeIndex, setActiveIndex] = useState(-1); // -1 = nothing highlighted
```

### Refs (things that must not cause a render)

```js
const latestRequestId  = useRef(0);        // ordering guard
const cache            = useRef(new Map()); // normalised query -> results
const suppressNextFetch = useRef(false);    // selecting rewrites the input; that must not re-search
```

Say why these are refs: bumping a request counter is bookkeeping, not UI. Putting it in state causes
a render per keystroke and — worse — the effect would read a stale value from its own closure.

### Pure function signatures

```js
normalise(query)                     -> string     // trim + lowercase
scoreCity(city, query)               -> number     // 3 prefix, 2 infix, 1 country, -1 no match
rankByScan(cities, query, limit)     -> City[]     // O(N) oracle — tested against, not shipped
buildSuggestIndex(cities, topK)      -> { root, topK }   // once, at load
suggest(index, query, limit)         -> City[]     // O(q + k) — the shipped read path
splitHighlight(label, query)         -> [{ text, isMatch }]
nextIndex(current, delta, length)    -> number     // wrapping, -1 aware
```

Two functions produce the same answer by different means. That is deliberate: `rankByScan` is
obviously correct and slow, `suggest` is fast and non-obvious, and the check file asserts they are
equal over every substring in the dataset. Say this out loud — it is the difference between
"optimised" and "optimised and proven".

---

## 4. The data model

```json
[
  { "id": "in-mumbai",  "name": "Mumbai",  "country": "India",         "population": 20411000 },
  { "id": "us-nyc",     "name": "New York","country": "United States", "population": 18800000 },
  { "id": "es-madrid",  "name": "Madrid",  "country": "Spain",         "population": 6642000 }
]
```

`population` is not decoration — it is the tiebreaker that makes the product feel right. Typing
`san` should surface San Francisco before San Fernando. Say that out loud; ranking by relevance
*only* is the most common weak answer to this question.

The highlight model is a list of segments, never an HTML string:

```json
[{ "text": "San ", "isMatch": false }, { "text": "Fran", "isMatch": true }, { "text": "cisco", "isMatch": false }]
```

Why: building `` `<mark>${query}</mark>` `` and passing it to `dangerouslySetInnerHTML` is how a
typeahead ships an XSS hole — the needle is raw user input. Segments render as React nodes, which
escape by construction.

---

## 5. Pass 1 — the matching algorithm (target: 14 minutes)

This is the pass the question exists for. Everything after it is craft; this is the part that
separates candidates.

### 5.1 The ladder — say all four rungs, build the fourth

Notation: **N** = cities, **L** = average name length, **q** = query length, **k** = results shown (8),
**m** = matches for a query.

State the verdict before you climb, so nobody thinks you are stuck on the naive version:

> "There are four ways to do this. I'll write the scan first because it takes ninety seconds and
> gives me a correctness oracle, then I'm building the trie and asserting the two agree. The scan is
> my test, not my answer."

#### V0 — filter, no ranking

```js
const results = cities.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
```

`O(N·L)` per keystroke. Three faults, named out loud and not fixed:

- dataset order is not relevance — typing `lon` puts *Colon* above *London*;
- `toLowerCase()` allocates a string per row per keystroke;
- unbounded result count; 4,000 `<li>` will drop frames.

#### V1 — score, sort, slice (the oracle)

```js
const TIER = { namePrefix: 3, nameInfix: 2, country: 1, none: -1 };

const normalise = (q) => q.trim().toLowerCase();

function scoreCity(city, query) {
  const needle = normalise(query);
  if (!needle) return TIER.none;
  const name = city.name.toLowerCase();
  if (name.startsWith(needle)) return TIER.namePrefix;
  if (name.includes(needle)) return TIER.nameInfix;
  if (city.country.toLowerCase().includes(needle)) return TIER.country;
  return TIER.none;
}

// the one ordering rule in the codebase — the index reuses this exact comparator
const byRelevance = (a, b) =>
  b.tier - a.tier ||                                 // match quality
  b.city.population - a.city.population ||           // then the city people actually mean
  a.city.name.localeCompare(b.city.name);            // then deterministic, so nothing reshuffles

function rankByScan(cities, query, limit) {
  return cities
    .map((city) => ({ city, tier: scoreCity(city, query) }))
    .filter((entry) => entry.tier > 0)
    .sort(byRelevance)
    .slice(0, limit)
    .map((entry) => entry.city);
}
```

`O(N + m log m)` per keystroke. Correct, six lines, and **it is the thing every other rung will be
tested against**. Narrate the comparator, because a missing final tiebreak is a real bug: without
`localeCompare` the sort is unstable across engines and the list visibly jumps between renders.

#### V2 — bounded top-k, no full sort

Sorting `m` matches to display 8 is wasted work. A size-k insertion buffer with early rejection gets
`O(N·log k)`, or `O(N)` in practice because k is 8:

```js
// once the buffer is full, most rows die on one comparison
if (best.length === k && !better(candidate, best[k - 1])) continue;
```

This removes the sort. It does **not** remove the scan — still `O(N)` per keystroke. That is the
limit of anything that looks at every row, and it is the reason to stop optimising this shape.

#### V3 — precomputed ranked suffix trie ← **build this**

The scan is `O(N)` *per keystroke*, and keystrokes are the thing that happens thousands of times.
Move the work to the one thing that happens once: load.

```js
const createNode = () => ({ children: new Map(), hits: new Map(), top: [] });

// records `city` at `tier` on every node along `text`, keeping the strongest tier seen
function insertSuffix(root, text, tier, city) {
  let node = root;
  for (const char of text) {
    if (!node.children.has(char)) node.children.set(char, createNode());
    node = node.children.get(char);
    const seen = node.hits.get(city);
    if (seen === undefined || seen < tier) node.hits.set(city, tier);
  }
}

function buildSuggestIndex(cities, topK) {
  const root = createNode();

  for (const city of cities) {
    const name = city.name.toLowerCase();
    // EVERY suffix, not just the whole name — this is what makes "ark" find Newark
    for (let i = 0; i < name.length; i++) {
      insertSuffix(root, name.slice(i), i === 0 ? TIER.namePrefix : TIER.nameInfix, city);
    }
    const country = city.country.toLowerCase();
    for (let i = 0; i < country.length; i++) insertSuffix(root, country.slice(i), TIER.country, city);
  }

  // one pass turns hit maps into ranked arrays, so a query never sorts
  (function finalise(node) {
    node.top = [...node.hits]
      .map(([city, tier]) => ({ city, tier }))
      .sort(byRelevance)
      .slice(0, topK)
      .map((entry) => entry.city);
    node.hits = new Map();          // build scratch; keeping it doubles the index's memory
    node.children.forEach(finalise);
  })(root);

  return { root, topK };
}

function suggest(index, query, limit) {
  const needle = normalise(query);
  if (!needle) return [];
  let node = index.root;
  for (const char of needle) {
    node = node.children.get(char);
    if (!node) return [];                       // dead prefix: nothing contains this text anywhere
  }
  return node.top.slice(0, Math.min(limit, index.topK));
}
```

Four things to say while typing it, in this order — they are the four things being graded:

1. **Every suffix, not every name.** Inserting only whole names gives prefix matching. Inserting
   every suffix gives substring matching at the same query cost. The price is build time and memory,
   both paid once.
2. **Rank at build, not at read.** `node.top` is already sorted, so `suggest` does zero comparisons.
   Storing `topK` (25) rather than all matches is what keeps memory bounded at hot nodes like `a`.
3. **`hits` is dropped after the build.** A `Map` per node held forever would roughly double the
   footprint for data used only during construction.
4. **The clamp is not defensive noise.** `limit > topK` is a question the index cannot answer; it
   must be clamped, not silently truncated, or "show 50 results" quietly returns 25 and looks like
   missing data.

#### V4 — n-gram inverted index (discussed, not built)

Fuzzy and typo-tolerant matching breaks the trie: `lodnon` shares no prefix *or* suffix with
`london`. The answer is grams — map every 3-character gram to a posting list of ids, intersect the
posting lists for the query's grams, rank the small candidate set, and score edit distance only on
survivors. That is what Elasticsearch/Typesense do. Say where you'd stop: the moment matching is
fuzzy *and* N is large, this leaves the client entirely.

### 5.2 Comparison

| | Per keystroke | Build | Memory | Substring? |
| --- | --- | --- | --- | --- |
| V0 filter | `O(N·L)` | — | `O(1)` | yes, unranked |
| V1 scan (oracle) | `O(N + m log m)` | — | `O(m)` | yes |
| V2 top-k buffer | `O(N·log k)` | — | `O(k)` | yes |
| **V3 suffix trie** | **`O(q + k)`** | `O(Σ L²)` | `O(Σ L²)` nodes | yes |
| V4 n-gram index | `O(candidates)` | `O(N·L)` | high | fuzzy too |

**Why V3 wins:** the cost moved from the axis that scales with *user typing* to the axis that scales
with *deploys*. A query touches `q` map lookups and one `slice` — the dataset could be a hundred
times bigger and the keystroke would cost the same. Nothing below V3 has that property, because
every other rung reads rows proportional to N.

**Where V3 stops winning**, say both without being asked:

- **Mutable data.** Every insert re-walks `L` suffixes and re-ranks every node on those paths. If the
  dataset changes more often than it is queried, the index is a liability — go back to V1.
- **Memory.** `Σ L²` nodes, each with a `Map`. For 70 cities that is nothing; for a million rows with
  20-character names it is gigabytes, which is precisely when search stops being a client-side
  problem at all.

### 5.3 Ship V3 — and make it safe with the oracle

Building the fast version in an interview is only defensible if you can show it is correct. That
costs four lines:

```js
// differential test: the index must agree with the scan, everywhere
for (const query of everySubstringInTheDataset) {
  assert.deepEqual(names(suggest(index, query, 8)), names(rankByScan(CITIES, query, 8)));
}
```

The repo's check runs 1,104 queries × 4 limits through both paths. Say it plainly: *"The scan is 6
lines and obviously right; the trie is 25 lines and not obviously right. So the scan stays in the
file as the test oracle. That is why I can ship the optimised version and still sleep."*

**Demonstrate before moving on:** results ranked, `ark` finds Newark, `zzz` returns nothing, the
check passes.

### 5.4 Highlighting

```js
function splitHighlight(label, query) {
  const needle = normalise(query);
  const index = needle ? label.toLowerCase().indexOf(needle) : -1;
  if (index === -1) return [{ text: label, isMatch: false }];
  return [
    { text: label.slice(0, index), isMatch: false },
    { text: label.slice(index, index + needle.length), isMatch: true },
    { text: label.slice(index + needle.length), isMatch: false },
  ].filter((segment) => segment.text !== '');
}
```

Slice from the **original** label, not the lowercased copy, or "MUMBAI" comes back as "mumbai". The
`filter` drops empty leading/trailing segments so a prefix match doesn't render an empty `<span>`.

Verify the pure layer before the UI grows:

```bash
node src/projects/typeahead-search/utils/typeahead.utils.check.ts
```

**Demonstrate:** typing filters and ranks; matched text is highlighted.

---

## 6. Pass 2 — debounce and the async boundary (target: 10 minutes)

```js
function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);   // each keystroke cancels the previous timer
  }, [value, delayMs]);
  return debounced;
}

const debouncedQuery = useDebouncedValue(query, 250);
```

The cleanup **is** the debounce — that is the whole mechanism, worth pointing at.

The fake service must be hostile, or none of the next section is demonstrable:

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchCities(query, limit) {
  await sleep(350 * (0.4 + Math.random()));       // jitter, so responses CAN arrive out of order
  if (Math.random() < failureRate) throw new Error('suggest failed');
  return suggest(SUGGEST_INDEX, query, limit);      // trie walk, built once at module load
}
```

Say: *"Jittered latency on purpose — a service that always takes exactly 300ms never reproduces the
race, and then the race ships to production instead."*

And guard the minimum length:

```js
const key = normalise(debouncedQuery);
const isTooShort = key.length > 0 && key.length < 2;
// below 2 chars: no request, show a hint instead. One character matches half the dataset;
// it is a wasted round trip and a useless list.
```

**Demonstrate:** typing fast fires one request, not ten. One character fires none.

---

## 7. Pass 3 — races and cache (target: 10 minutes)

This is the correctness centrepiece. Set up the failure before fixing it.

#### V0 — Naive: whoever resolves last wins

```js
useEffect(() => {
  searchCities(key, 8).then(setSuggestions);
}, [key]);
```

Type `san`, then `sant`. Two requests are in flight. If `san` is slower it resolves **after** `sant`
and overwrites the newer list — the user sees results for text they have already replaced. It is
intermittent, so it survives code review and reproduces only for users on bad networks.

#### V1 — Monotonic request id (the fix)

```js
const latestRequestId = useRef(0);

useEffect(() => {
  const requestId = ++latestRequestId.current;
  setIsLoading(true);

  searchCities(key, 8)
    .then((results) => {
      if (requestId !== latestRequestId.current) return;   // stale — drop it silently
      setSuggestions(results);
      setError(null);
    })
    .catch(() => {
      if (requestId !== latestRequestId.current) return;
      setSuggestions([]);
      setError('Suggestions could not be loaded.');
    })
    .finally(() => {
      if (requestId === latestRequestId.current) setIsLoading(false);
    });
}, [key]);
```

Three details worth saying out loud:

- The guard goes in `.then`, `.catch` **and** `.finally`. Miss `finally` and a stale rejection clears
  the spinner while the current request is still running.
- It is a `ref`, not state: incrementing must not trigger a render, and the effect must read the
  current value rather than one captured in an old closure.
- Clearing results also has to bump the id — otherwise an in-flight response repopulates a list the
  user just emptied by deleting their query.

#### V2 — Cache: skip the work entirely

```js
const cache = useRef(new Map());   // normalised query -> results

const cached = cache.current.get(key);
if (cached) {
  latestRequestId.current += 1;    // a cache hit must ALSO beat an older in-flight response
  setSuggestions(cached);
  setIsLoading(false);
  return;
}
// ...on success:
cache.current.set(key, results);   // store even if stale for this render — it helps the next query
```

Keying on the **normalised** query is what makes `San`, `san` and `" san "` one entry. Backspacing
from `sant` to `san` then becomes instant, with no flicker.

Say why both mechanisms exist: *"The cache is a performance optimisation. The request id is a
correctness guarantee. If I only had the cache, an old response could still land on top of a cache
hit — which is exactly why the cache branch bumps the id too."*

#### V3 — What production adds

- **`AbortController`** in the effect cleanup so the browser stops the wasted transfer. It does not
  replace the id guard: abort is best-effort and a response that already resolved still runs its
  handler.
- **Bound the cache** — an LRU with a cap of ~50, or it grows for the life of the session.
- **TTL** only if results can go stale. City names don't; product inventory does.
- Move the whole block to TanStack Query in a real codebase, and say so: `queryKey: ['cities', key]`
  gives the cache, dedupe, cancellation and stale handling that were just hand-rolled. **Hand-roll it
  in the interview** — the interviewer is asking whether you know what the library does.

**Demonstrate:** with jitter on, type fast and show only the newest results ever render; backspace
and show a cache hit with a request counter that does not move.

---

## 8. Pass 4 — keyboard navigation and selection (target: 10 minutes)

Rule one: **focus never leaves the input.** Moving DOM focus into the list stops the user typing.
Track a virtual `activeIndex` and expose it with `aria-activedescendant`.

```js
function nextIndex(current, delta, length) {
  if (length === 0) return -1;
  if (current === -1) return delta > 0 ? 0 : length - 1;   // first ArrowUp goes to the last item
  return (current + delta + length) % length;              // + length: JS % is negative for -1
}
```

The `+ length` before `%` is a genuine trap — `(-1) % 8` is `-1` in JavaScript, not `7`.

```js
function handleKeyDown(event) {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      if (suggestions.length === 0) return;
      event.preventDefault();                    // else the caret jumps to start/end of the input
      if (!isOpen) { setIsOpen(true); return; }  // first arrow re-opens a closed list
      setActiveIndex((i) => nextIndex(i, event.key === 'ArrowDown' ? 1 : -1, suggestions.length));
      return;
    }
    case 'Enter': {
      if (!isOpen || activeIndex < 0) return;    // nothing highlighted = user is submitting their
      event.preventDefault();                    // own text; do not hijack the form submit
      select(suggestions[activeIndex]);
      return;
    }
    case 'Escape': {
      if (!isOpen) return;                       // let a second Escape reach the browser/modal
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);                        // closes the list, KEEPS the typed text
      return;
    }
    case 'Tab': {
      setIsOpen(false);                          // focus is leaving; the popup must not stay behind
      setActiveIndex(-1);                        // Tab is not a selection
    }
  }
}
```

Reset the highlight whenever the result set changes, or index 4 points into a two-item list:

```js
useEffect(() => { setActiveIndex(-1); }, [suggestions]);
```

Selecting rewrites the input, which would immediately trigger a fresh search for the city that was
just chosen. Suppress exactly one cycle:

```js
const suppressNextFetch = useRef(false);

function select(city) {
  suppressNextFetch.current = true;
  setSelected(city);
  setQuery(city.name);   // this query change must not re-open the list
  setIsOpen(false);
}

// at the top of the search effect:
if (suppressNextFetch.current) { suppressNextFetch.current = false; return; }
```

**Mouse selection has its own trap:** use `onPointerDown` with `preventDefault`, not `onClick`. The
input's blur fires before click, the list unmounts, and the click lands on nothing — the classic
"the dropdown ignores my mouse" bug. Same reason outside-dismiss listens for `pointerdown`.

**Demonstrate:** arrows wrap without moving the caret, Enter selects only when highlighted, Escape
keeps the text, clicking a suggestion works, clicking outside closes.

---

## 9. Pass 5 — ARIA and the five states (target: 6 minutes)

```jsx
<input
  role="combobox"
  aria-expanded={isOpen}
  aria-controls={listboxId}
  aria-autocomplete="list"
  aria-activedescendant={activeIndex >= 0 ? getOptionId(activeIndex) : undefined}
/>
<ul id={listboxId} role="listbox">
  <li id={getOptionId(i)} role="option" aria-selected={i === activeIndex} />
</ul>
```

Use `useId()` for the listbox id — two comboboxes on one page must not share it.

Render five **visually distinct** states; collapsing them is the most common polish failure:

| State | Condition | Shows |
| --- | --- | --- |
| Hint | `0 < key.length < 2` | "Type at least 2 characters." |
| Loading | `isLoading` | spinner, **old results still visible** |
| Results | `suggestions.length > 0` | the list |
| Empty | fetched, zero matches | "No cities match that search." |
| Error | `error` | message + retry affordance |

Keeping stale results on screen during a refetch (dimmed) instead of blanking the list is what stops
the dropdown flickering on every keystroke. Announce loading/empty in an `aria-live="polite"` region
so it isn't a sighted-only signal.

---

## 10. The single-file version — what you actually type

Everything above is the conversation. This is the code. In a real 45-minute slot you build it
top-to-bottom in `App.jsx` and say *"in a repo this splits into utils / api / hook / components along
these comment banners."*

Assumes the CSS classes already exist. No styles here.

```jsx
import { useCallback, useEffect, useId, useRef, useState } from 'react';

/* ───────────── constants ───────────── */

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 8;
const INDEX_TOP_K = 25;               // results stored per node; must be >= MAX_SUGGESTIONS
const TIER = { namePrefix: 3, nameInfix: 2, country: 1, none: -1 };

const CITIES = [
  { id: 'in-mumbai', name: 'Mumbai', country: 'India', population: 20411000 },
  { id: 'in-delhi', name: 'Delhi', country: 'India', population: 16787000 },
  { id: 'us-nyc', name: 'New York', country: 'United States', population: 18800000 },
  { id: 'us-sf', name: 'San Francisco', country: 'United States', population: 3600000 },
  { id: 'us-sd', name: 'San Diego', country: 'United States', population: 3200000 },
  { id: 'us-sj', name: 'San Jose', country: 'United States', population: 1800000 },
  { id: 'es-madrid', name: 'Madrid', country: 'Spain', population: 6642000 },
  { id: 'es-barcelona', name: 'Barcelona', country: 'Spain', population: 5600000 },
  { id: 'gb-london', name: 'London', country: 'United Kingdom', population: 9300000 },
  { id: 'jp-tokyo', name: 'Tokyo', country: 'Japan', population: 37400000 },
];

/* ───────────── utils/typeahead.utils.js — pure ───────────── */

const normalise = (query) => query.trim().toLowerCase();

// 3 prefix > 2 infix > 1 country > -1 no match
const scoreCity = (city, query) => {
  const needle = normalise(query);
  if (!needle) return TIER.none;
  const name = city.name.toLowerCase();
  if (name.startsWith(needle)) return TIER.namePrefix;
  if (name.includes(needle)) return TIER.nameInfix;
  if (city.country.toLowerCase().includes(needle)) return TIER.country;
  return TIER.none;
};

const byRelevance = (a, b) =>
  b.tier - a.tier ||                                  // match quality
  b.city.population - a.city.population ||            // then importance
  a.city.name.localeCompare(b.city.name);             // then deterministic

// O(N) reference implementation. NOT the read path — it is the oracle the index is tested against.
const rankByScan = (cities, query, limit) =>
  cities
    .map((city) => ({ city, tier: scoreCity(city, query) }))
    .filter((entry) => entry.tier > 0)
    .sort(byRelevance)
    .slice(0, limit)
    .map((entry) => entry.city);

/* ───────────── utils/suggest-index.js — the shipped read path ───────────── */

const createNode = () => ({ children: new Map(), hits: new Map(), top: [] });

const insertSuffix = (root, text, tier, city) => {
  let node = root;
  for (const char of text) {
    if (!node.children.has(char)) node.children.set(char, createNode());
    node = node.children.get(char);
    const seen = node.hits.get(city);
    if (seen === undefined || seen < tier) node.hits.set(city, tier);
  }
};

// built ONCE. every suffix of every name -> substring matching at prefix-lookup cost
function buildSuggestIndex(cities, topK) {
  const root = createNode();

  for (const city of cities) {
    const name = city.name.toLowerCase();
    for (let i = 0; i < name.length; i++) {
      insertSuffix(root, name.slice(i), i === 0 ? TIER.namePrefix : TIER.nameInfix, city);
    }
    const country = city.country.toLowerCase();
    for (let i = 0; i < country.length; i++) insertSuffix(root, country.slice(i), TIER.country, city);
  }

  (function finalise(node) {
    node.top = [...node.hits]
      .map(([city, tier]) => ({ city, tier }))
      .sort(byRelevance)                              // rank at build, so a query never sorts
      .slice(0, topK)
      .map((entry) => entry.city);
    node.hits = new Map();                            // drop build scratch, halve the memory
    node.children.forEach(finalise);
  })(root);

  return { root, topK };
}

// O(q + k): walk q characters, read a list ranked at build time. Independent of N.
function suggest(index, query, limit) {
  const needle = normalise(query);
  if (!needle) return [];
  let node = index.root;
  for (const char of needle) {
    node = node.children.get(char);
    if (!node) return [];                             // dead prefix
  }
  return node.top.slice(0, Math.min(limit, index.topK));
}

const SUGGEST_INDEX = buildSuggestIndex(CITIES, INDEX_TOP_K);

// segments, never an HTML string — the needle is user input
const splitHighlight = (label, query) => {
  const needle = normalise(query);
  const index = needle ? label.toLowerCase().indexOf(needle) : -1;
  if (index === -1) return [{ text: label, isMatch: false }];
  return [
    { text: label.slice(0, index), isMatch: false },
    { text: label.slice(index, index + needle.length), isMatch: true },
    { text: label.slice(index + needle.length), isMatch: false },
  ].filter((segment) => segment.text !== '');
};

// wrapping movement; -1 means nothing active. (+ length because JS % goes negative)
const nextIndex = (current, delta, length) => {
  if (length === 0) return -1;
  if (current === -1) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
};

/* ───────────── utils/suggest-api.js — the fake network ───────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let failureRate = 0; // flip to 1 in the demo to show the error state

async function searchCities(query, limit) {
  await sleep(350 * (0.4 + Math.random())); // jitter: responses CAN arrive out of order
  if (Math.random() < failureRate) throw new Error('suggest failed');
  return suggest(SUGGEST_INDEX, query, limit);
}

/* ───────────── hooks ───────────── */

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer); // the cleanup IS the debounce
  }, [value, delayMs]);
  return debounced;
}

function useTypeahead() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [requestCount, setRequestCount] = useState(0); // visible proof debounce+cache work

  const listboxId = useId();
  const getOptionId = (index) => `${listboxId}-option-${index}`;

  const latestRequestId = useRef(0);          // ordering guard
  const cache = useRef(new Map());            // normalised query -> results
  const suppressNextFetch = useRef(false);    // selecting rewrites the input

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const key = normalise(debouncedQuery);
  const isTooShort = key.length > 0 && key.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false;
      return;
    }

    if (key.length < MIN_QUERY_LENGTH) {
      latestRequestId.current += 1; // an in-flight response is now irrelevant
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = cache.current.get(key);
    if (cached) {
      latestRequestId.current += 1; // a cache hit must ALSO beat an older response
      setSuggestions(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setRequestCount((count) => count + 1);

    searchCities(key, MAX_SUGGESTIONS)
      .then((results) => {
        cache.current.set(key, results);              // late data still helps a future query
        if (requestId !== latestRequestId.current) return;
        setSuggestions(results);
        setError(null);
      })
      .catch(() => {
        if (requestId !== latestRequestId.current) return;
        setSuggestions([]);
        setError('Suggestions could not be loaded.');
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });
  }, [key]);

  // a new result set invalidates the old highlight
  useEffect(() => { setActiveIndex(-1); }, [suggestions]);

  const changeQuery = useCallback((next) => {
    setQuery(next);
    setSelected(null);
    setIsOpen(true);
  }, []);

  const select = useCallback((city) => {
    suppressNextFetch.current = true; // rewriting the input must not re-search
    setSelected(city);
    setQuery(city.name);
    setIsOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          if (suggestions.length === 0) return;
          event.preventDefault(); // else the caret jumps to the start/end of the input
          if (!isOpen) { setIsOpen(true); return; }
          setActiveIndex((current) =>
            nextIndex(current, event.key === 'ArrowDown' ? 1 : -1, suggestions.length));
          return;
        }
        case 'Enter': {
          if (!isOpen || activeIndex < 0) return; // no highlight = user submits their own text
          event.preventDefault();
          select(suggestions[activeIndex]);
          return;
        }
        case 'Escape': {
          if (!isOpen) return;                    // let a second Escape reach the browser
          event.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);                     // keeps the typed text
          return;
        }
        case 'Tab': {
          setIsOpen(false);                       // focus is leaving; not a selection
          setActiveIndex(-1);
        }
      }
    },
    [activeIndex, isOpen, select, suggestions],
  );

  return {
    query, changeQuery, suggestions, isOpen, setIsOpen, isLoading, error, selected, select,
    isTooShort, activeIndex, setActiveIndex, handleKeyDown, listboxId, getOptionId,
    requestCount, cacheSize: cache.current.size,
  };
}

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    };
    // pointerdown, not click: the list must close before a blur-driven click is lost
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [ref, onOutside]);
}

/* ───────────── components ───────────── */

function HighlightedText({ text, query }) {
  return splitHighlight(text, query).map((segment, index) =>
    segment.isMatch ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
  );
}

export default function App() {
  const t = useTypeahead();
  const boxRef = useRef(null);
  useClickOutside(boxRef, () => t.setIsOpen(false));

  const showList = t.isOpen && !t.isTooShort;

  return (
    <section className="typeahead" ref={boxRef}>
      <h1>City search</h1>

      <input
        className="typeahead__input"
        role="combobox"
        aria-expanded={showList}
        aria-controls={t.listboxId}
        aria-autocomplete="list"
        aria-activedescendant={t.activeIndex >= 0 ? t.getOptionId(t.activeIndex) : undefined}
        placeholder="Search cities…"
        value={t.query}
        onChange={(event) => t.changeQuery(event.target.value)}
        onFocus={() => t.setIsOpen(true)}
        onKeyDown={t.handleKeyDown}
      />

      {t.isTooShort && <p className="typeahead__hint">Type at least {MIN_QUERY_LENGTH} characters.</p>}
      {t.error && <p className="typeahead__error" role="alert">{t.error}</p>}

      {showList && (
        <ul className="typeahead__list" id={t.listboxId} role="listbox">
          {t.suggestions.map((city, index) => (
            <li
              key={city.id}
              id={t.getOptionId(index)}
              role="option"
              aria-selected={index === t.activeIndex}
              className={index === t.activeIndex ? 'typeahead__option is-active' : 'typeahead__option'}
              onMouseEnter={() => t.setActiveIndex(index)}
              // pointerdown + preventDefault: a plain onClick is lost to the input's blur
              onPointerDown={(event) => { event.preventDefault(); t.select(city); }}
            >
              <HighlightedText text={city.name} query={t.query} />
              <small>{city.country}</small>
            </li>
          ))}

          {!t.isLoading && t.suggestions.length === 0 && !t.error && (
            <li className="typeahead__empty">No cities match that search.</li>
          )}
        </ul>
      )}

      <p className="typeahead__status" aria-live="polite">
        {t.isLoading ? 'Searching…' : t.selected ? `Selected: ${t.selected.name}` : ''}
      </p>
      <p className="typeahead__meta">requests: {t.requestCount} · cached queries: {t.cacheSize}</p>
    </section>
  );
}
```

**Build it in this order:** `rankByScan` + a plain input that filters synchronously (results on
screen in 6 minutes, and you now have an oracle) → `buildSuggestIndex` / `suggest`, switch the read
path to it → `useDebouncedValue` → the async `searchCities` → the `requestId` guard → the cache →
keyboard handling → ARIA and the five states.

The order matters for a reason worth stating: the scan comes first so the screen is never empty and
so the fast path has something to be checked against, **not** because the scan is the plan. Swap the
read path to `suggest` the moment it exists, and say so.

While typing, flag the three lines that look like noise and are not: `node.hits = new Map()` after
the build, `latestRequestId.current += 1` in the *cache-hit* branch, and `event.preventDefault()` in
`onPointerDown`. Each fixes something an interviewer is specifically watching for — memory, a race,
and a lost click.

## 11. Verification

```bash
node src/projects/typeahead-search/utils/typeahead.utils.check.ts
```

Demo script:

The check's first line is the one to point at: `differential: 1104 queries x 4 limits, index === scan`.
That is the evidence the optimisation is correct, and it is worth reading aloud.

1. One character → hint, zero requests (show the request counter).
2. Type `san` fast → one request, ranked results, prefix matches first.
3. Type `ark` → Newark, from a mid-name match — the suffix insertion doing its job.
4. Backspace to a previous query → instant, counter unchanged (cache hit).
5. With jitter on, type quickly → newest results only, never a stale flash.
6. Arrows wrap, Enter selects, Escape closes and keeps text, Tab closes.
7. Force the failure rate to 1 → error state, typed text preserved.
8. Search `Mumbai` in caps → highlight matches the original casing.

---

## 12. Cross-questions and answers

**"Debounce or throttle?"**
Debounce. The valuable request is the one after the user stops typing; throttle would fire mid-word
requests that are immediately obsolete. Throttle is for continuous streams — scroll, resize, mousemove.
A hybrid (throttle with a trailing debounce) is worth it only for very long inputs.

**"Why keep the request id when you have AbortController?"**
Abort saves bandwidth; it does not guarantee a handler cannot run. A response that already resolved
before `abort()` still hits `.then`. The id is the state-write guard, and it is three lines.

**"Cache invalidation?"**
Cap it (LRU ~50 entries) so a long session doesn't leak. Add TTL only if the data can change under
you. Key on the normalised query plus any filter that affects results — a cache key missing a filter
is a stale-data bug that looks like a backend problem.

**"Why not move focus into the list?"**
The user must keep typing. `aria-activedescendant` is the pattern precisely for "focus stays here,
but this option is active" — that is why the attribute exists.

**"A million cities?"**
Stop shipping the dataset to the browser. Search moves server-side, backed by a real index
(Elasticsearch / Typesense / Algolia), the client keeps debounce + cancel + cache, and the server
returns pre-ranked top-k. Client-side, the same shape as the trie: precompute, don't scan.

**"Multi-select?"**
`selected` becomes an array rendered as chips, selected ids are excluded from results, and Backspace
on an empty input removes the last chip. `aria-multiselectable` on the listbox.

**"Results shift as I type — how do you stop the flicker?"**
Keep previous results mounted during a refetch, reserve the dropdown height, and always break
ranking ties deterministically. Non-deterministic sort order alone is enough to make a list appear to
jump.

**"How would you test it?"**
Pure functions (`scoreCity`, `splitHighlight`, `nextIndex`) unit-test with no React — that is why
they're pure. The index gets the differential test against `rankByScan` rather than hand-written
expectations, because hand-written expectations for a trie are how you accidentally encode the bug
into the test. The race gets a deliberate test: resolve request A after request B and assert B's
results survive. Keyboard behaviour with Testing Library and real key events.

**"Why a trie and not a `Map` of every substring to its top-k?"**
Same query complexity, less code, more memory — a flat map stores every substring as its own string
key, the trie shares prefixes as paths. The real reason to keep the trie: it can answer questions a
flat map cannot, like "walk the subtree" for *did-you-mean* and range queries. If the only feature
is exact lookup and memory is not tight, the flat map is the honest simpler answer, and saying so is
worth more than defending the trie.

**"The dataset updates every few seconds. Now what?"**
The index stops paying. Each write re-walks `L` suffixes and re-ranks every node on those paths, so
at high write rates the build cost dominates the read savings. Two options: batch rebuilds behind a
debounce and serve the previous index meanwhile, or drop back to `rankByScan` — which is already in
the file. That is a second reason the oracle earns its place.
