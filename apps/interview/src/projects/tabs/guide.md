# Tabs (lazy panels + URL state) — Interview Build Guide

Build a tabs component: accessible (ARIA tabs pattern, one Tab stop, arrow keys, disabled tabs skipped),
panels mounted **lazily** on first visit and kept alive afterwards, each panel's data fetched once and only
when the widget is actually on screen, and the active tab mirrored in the URL (`?tab=`) so links and reloads
land on the right tab. Built as a **headless hook with prop getters** so it can be reused. Plain JavaScript
(and a vanilla DOM version, because that is also reported). Target 45–60 minutes.

Reported at Atlassian as: *"Build a Tab component with some variations like lazy loading content when Tab
Panel is visible"* (Principal FE, UI coding round), *"Create a tab with plain JS — how can you make it
extendable and optimise it?"*, *"implement the tabs in vanilla JS and CSS"* (pair programming), and in
GreatFrontEnd's Atlassian topic list as *"tabs with URL state"*. A CoderPad variant had three sections
switched by tabs with dropdowns and a Run button — the same component with forms inside.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| API | **Headless `useTabs`** returning `getTabListProps / getTabProps / getPanelProps`. Markup belongs to the caller; behaviour lives once. |
| Mounting | **Lazy mount + keep visited**: a never-shown panel renders nothing; a shown one stays mounted but `hidden`. |
| Data | Per-tab loader behind a **promise cache**: one request per tab ever, shared by concurrent callers, failures retried. Gated on `IntersectionObserver` when "load when visible". |
| URL | `?tab=` read on init, written with `replaceState`, followed on `popstate`. Unknown/disabled values fall back. |
| Discussed, not built | Code-splitting each panel with `React.lazy`, compound-component API, vertical tabs, overflow scrolling tab list. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements — what "lazy" means here |
| 5–10 | HLD: headless hook, the mounting ladder |
| 10–20 | Working tabs: state, list, panels, click |
| 20–30 | **Lazy mount + keep-alive + cached loaders — the ladder** |
| 30–38 | Keyboard + ARIA |
| 38–45 | URL state |
| 45–52 | Load when on screen |
| 52–60 | Vanilla version / cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
tabs/
  index.tsx                        # playground: switches, request log, widget
  tabs.types.ts                    # TabDefinition, ActivationMode, LoadStatus, PanelData
  tabs.css
  constants/tabs.constants.ts      # ISSUE_TABS, URL_PARAM, fake content
  utils/tabs.utils.ts              # pure: nextTabId, tabFromSearch, searchWithTab, createLoaderCache
  utils/tabs.utils.check.ts
  utils/panel-api.ts               # fake GET per tab, logs every request, failNext
  hooks/use-tabs.ts                # THE component: headless state + prop getters
  hooks/use-panel-data.ts          # per-panel load through the cache
  hooks/use-in-view.ts             # IntersectionObserver, latches true
  hooks/use-tabs-playground.ts     # demo switches
  components/tabs-widget.tsx       # spreads the prop getters onto real elements
  components/issue-panel.tsx
```

Say: *"The reusable thing is the hook, not the markup. Any team can put its own buttons and panels on top
and still get the keyboard model, ARIA wiring, lazy mount and URL sync."*

---

## 1. Requirement gathering (5 minutes)

1. **"Lazy — lazy to mount, lazy to fetch, or lazy to download the code?"**
   Three different mechanisms: conditional render, a cached loader, `React.lazy`. Ask which one they mean;
   usually all three come up. *Default: mount on first visit, fetch on first visit, and only once on screen.*
2. **"When I leave a tab and come back, should its state survive?"**
   Decides keep-alive vs unmount. A half-typed comment must not vanish. *Default: keep visited panels mounted.*
3. **"Automatic or manual activation?"**
   WAI-ARIA gives both. Automatic (arrows select) is right when panels are cheap; manual (arrows move focus,
   Enter selects) when selecting triggers a fetch. *Default: automatic, configurable.*
4. **"Should the tab be in the URL?"** *Default: yes, `?tab=id`, without adding history entries.*
5. **"Disabled tabs?"** *Default: visible, skipped by arrows, not selectable, not reachable via URL.*
6. **"How many tabs? Could they overflow?"** *Default: a handful; overflow is a follow-up.*
7. **"Is this one widget, or a component other teams use?"** — sets up the headless answer.
   *Default: shared component.*

Plan:

> "A headless `useTabs` hook owns active and focused ids, visited ids, the keyboard model and URL sync, and
> hands out prop getters. Panels mount on first visit and stay mounted but hidden. Each panel's data comes
> through a promise cache keyed by tab id, so it is fetched once. An IntersectionObserver gates loading
> when the widget starts off-screen."

---

## 2. High-level design (HLD)

```text
            URL ?tab=history ──(init / popstate)──┐
                                                  ▼
 ┌──────────────────────── useTabs({ tabs, defaultId, activation, keepMounted, urlParam }) ─┐
 │ activeId · focusedId (roving) · visited:Set                                               │
 │ select(id) → setActive, add to visited, history.replaceState(?tab=id)                     │
 │ onKeyDown → nextTabId (wrap, skip disabled) → focus; automatic ? select : wait for Enter  │
 │ getTabListProps · getTabProps(tab) · getPanelProps(id) · isMounted(id)                    │
 └───────────────────────────────┬───────────────────────────────────────────────────────────┘
                                 ▼
  <div role=tablist> <button role=tab aria-selected aria-controls tabIndex=±1> …
  <div role=tabpanel hidden={!active}>  {isMounted(id) && <Panel id canLoad={onScreen}/>}
                                                              │
                         useInView(root) ── IntersectionObserver, latches ──┘
                                                              ▼
                          usePanelData(id) → panelCache.get(id)   (Map<id, Promise>)
                                                              ▼
                                                  GET /issue/CONF-4121/<tab>   once per tab
```

Claims:

- **Hidden, not unmounted, after first visit.** `hidden` keeps component state, scroll and DOM; unmounting
  throws them away and refetches.
- **Never-visited = not rendered.** Rendering all panels and hiding them with CSS runs every panel's effects
  (every fetch) on first paint — the opposite of lazy.
- **The cache lives outside the component.** Even with keep-alive off, coming back to a tab reads cached
  data instead of refetching.
- **URL sync uses `replaceState`.** A tab switch is not a navigation; Back should leave the page.

---

## 3. Low-level design (LLD)

### Hook state

```js
const [activeId, setActiveId]   = useState(() => urlParam ? tabFromSearch(location.search, urlParam, tabs, defaultId) : defaultId);
const [focusedId, setFocusedId] = useState(activeId);            // roving tabindex
const [visited, setVisited]     = useState(() => new Set([activeId])); // lazy-mount memory
const tabRefs = useRef(new Map());                               // id -> button, for .focus()
```

`focusedId` differs from `activeId` only in manual activation mode, while the user is arrowing.

### Prop getters (the extendable API)

```js
getTabListProps(label)  -> { role: 'tablist', 'aria-label', onKeyDown }
getTabProps(tab)        -> { id, role: 'tab', 'aria-selected', 'aria-controls', 'aria-disabled', tabIndex, ref, onClick, onFocus }
getPanelProps(id)       -> { id, role: 'tabpanel', 'aria-labelledby', hidden, tabIndex: 0 }
isMounted(id)           -> id === activeId || (keepMounted && visited.has(id))
```

### Pure function signatures

```js
nextTabId(tabs, currentId, key)            -> id      // wraps, skips disabled, Home/End
tabFromSearch(search, param, tabs, fallback) -> id    // unknown/disabled → fallback
searchWithTab(search, param, id)           -> '?…'   // other params survive
createLoaderCache(load)                    -> { get(id): Promise, peek(id), has, clear }
```

---

## 4. The data model

```json
[
  { "id": "summary", "label": "Summary" },
  { "id": "comments", "label": "Comments" },
  { "id": "attachments", "label": "Attachments", "disabled": true }
]
```

Panel payload: `{ "title": "comments", "lines": ["…"], "loadedAt": 1789850000000 }`.

Ids are URL-safe and stable (`?tab=comments`), labels are free text and can be translated. Never put a
label in the URL — renaming "Comments" to "Discussion" would break every shared link.

**Fork — config array vs compound components**

| | `tabs={[{id,label,content}]}` | `<Tabs><TabList><Tab/></TabList><TabPanel/></Tabs>` | Headless hook + prop getters |
| --- | --- | --- | --- |
| Custom markup per tab | awkward (render props) | natural | natural |
| Wiring | inside the component | React context | caller spreads props |
| Works outside React | no | no | the pure utils do |
| Code | least | most | middle |

Ship the headless hook; say that compound components are a thin context layer on top of it.

---

## 5. Pass 1 — working tabs (target: 10 minutes)

```jsx
function Tabs({ tabs }) {
  const [activeId, setActiveId] = useState(tabs[0].id);
  return (
    <>
      <div role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={tab.id === activeId} onClick={() => setActiveId(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => tab.id === activeId && <div key={tab.id} role="tabpanel">{tab.content}</div>)}
    </>
  );
}
```

On screen in five minutes. Now point at the flaw the interviewer will: switching away unmounts the panel —
type in a field, switch, come back, it is gone; and if the panel fetches, it fetches again.

---

## 6. Pass 2 — the mounting ladder (target: 10 minutes)

### 6.1 The ladder

#### V0 — render every panel, hide inactive with CSS

Every panel mounts on first paint → every panel's fetch fires immediately. `N` requests for a page where the
user looks at one tab. State survives, but nothing is lazy.

#### V1 — render only the active panel

Lazy on first view — and every revisit remounts: local state lost, request repeated. `k` switches = `k`
requests.

#### V2 — lazy mount, keep visited, cache loaders ← **build this**

```js
const isMounted = (id) => id === activeId || (keepMounted && visited.has(id));
// panels: <div role="tabpanel" hidden={id !== activeId}>{isMounted(id) && <Panel id={id} />}</div>

function createLoaderCache(load) {
  const cache = new Map();
  return {
    get(id) {
      if (!cache.has(id)) {
        cache.set(id, load(id).catch((error) => { cache.delete(id); throw error; }));
      }
      return cache.get(id);
    },
  };
}
```

#### V3 — V2 + load only when the widget is on screen + code-split panels

`IntersectionObserver` on the widget root; panels mount (so layout is right) but do not fetch until it has
been visible once. `React.lazy(() => import('./CommentsPanel'))` so the panel's *code* is not downloaded
until the tab is opened.

### 6.2 Comparison

| Rung | Requests on load | Requests after `k` switches | Local state on return | Off-screen widget |
| --- | --- | --- | --- | --- |
| V0 all mounted | `N` | `N` | kept | fetches anyway |
| V1 active only | 1 | up to `k + 1` | **lost** | fetches anyway |
| **V2 lazy + keep + cache** | **1** | **≤ tabs visited** | **kept** | fetches anyway |
| V3 + in-view gate + lazy code | 0 until visible | ≤ tabs visited | kept | **nothing until seen** |

### 6.3 Why V2 wins

What changed is *when* a panel is allowed to exist and *where* its data lives. V0 creates every panel up
front; V1 destroys them on every switch. V2 creates a panel the first time it is needed and never destroys
it, and moves data out of the component into a cache, so even a destroyed panel would not refetch. **Ship
V2 in a 45-minute interview**, then add the observer (V3) when the interviewer says "only when visible" —
it is a one-line gate on top (`canLoad={onScreen}`), which is the point of having separated mounting from
loading.

The loader cache is promise memoisation — not dynamic programming.

Cost to name: keep-alive holds every visited panel in memory. For heavy panels (charts, editors), cap it —
keep the last *k* visited (LRU) and unmount older ones; the data cache still prevents refetches.

---

## 7. Pass 3 — keyboard and ARIA (target: 8 minutes)

```js
function nextTabId(tabs, currentId, key) {
  const enabled = tabs.filter((tab) => !tab.disabled);
  const at = enabled.findIndex((tab) => tab.id === currentId);
  if (key === 'ArrowRight') return enabled[(at + 1) % enabled.length].id;
  if (key === 'ArrowLeft') return enabled[(at - 1 + enabled.length) % enabled.length].id;
  if (key === 'Home') return enabled[0].id;
  if (key === 'End') return enabled[enabled.length - 1].id;
  return currentId;
}
```

- `role="tablist"` / `"tab"` / `"tabpanel"`, `aria-selected`, `aria-controls` ↔ `aria-labelledby`.
- **Roving tabindex**: only the focused tab has `tabIndex=0`. Tab moves from the tab list *into the panel*,
  not through every tab — that is the defining behaviour of the pattern.
- The panel has `tabIndex=0` so there is always something to land on, even when it has no focusable content.
- `aria-disabled` rather than `disabled` if disabled tabs should still be discoverable by screen readers;
  arrows skip them either way.
- Automatic vs manual activation is one `if` in `onKeyDown`.

---

## 8. Pass 4 — URL state (target: 7 minutes)

```js
function tabFromSearch(search, param, tabs, fallback) {
  const value = new URLSearchParams(search).get(param);
  const match = tabs.find((tab) => tab.id === value && !tab.disabled);
  return match ? match.id : fallback;
}

// on select:
history.replaceState(history.state, '', searchWithTab(location.search, 'tab', id));

// on back/forward:
window.addEventListener('popstate', () => select(tabFromSearch(location.search, 'tab', tabs, defaultId)));
```

Three details worth saying: read the URL **in the `useState` initialiser** (no flash of the default tab),
**preserve other params** (`URLSearchParams.set`, not string concatenation), and **validate** — a stale
link to a removed or disabled tab must render the default, not a blank panel. `replaceState` vs `pushState`
is a product decision; ask.

---

## 9. Pass 5 — load only when on screen (target: 5 minutes)

```js
function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return seen;
}
```

It latches: scrolling away does not unload. Missing `IntersectionObserver` means "load", never "never
load".

### Vanilla version (for the pair-programming variant)

```js
// <div class="tabs" data-tabs>
//   <div role="tablist"><button role="tab" data-tab="a">A</button>…</div>
//   <section role="tabpanel" data-panel="a" data-src="/api/a" hidden></section>…
// </div>
function initTabs(root) {
  const tabs = [...root.querySelectorAll('[role=tab]')];
  const panels = new Map([...root.querySelectorAll('[role=tabpanel]')].map((p) => [p.dataset.panel, p]));
  const loaded = new Set();

  function select(tab) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      panels.get(t.dataset.tab).hidden = !on;
    }
    const panel = panels.get(tab.dataset.tab);
    if (panel.dataset.src && !loaded.has(tab.dataset.tab)) {       // lazy, once
      loaded.add(tab.dataset.tab);
      panel.textContent = 'Loading…';
      fetch(panel.dataset.src).then((r) => r.text()).then((text) => { panel.textContent = text; })
        .catch(() => { loaded.delete(tab.dataset.tab); panel.textContent = 'Failed — reselect to retry'; });
    }
  }

  root.querySelector('[role=tablist]').addEventListener('click', (event) => {   // one delegated listener
    const tab = event.target.closest('[role=tab]');
    if (tab) select(tab);
  });
  root.querySelector('[role=tablist]').addEventListener('keydown', (event) => {
    const at = tabs.indexOf(document.activeElement);
    const next = event.key === 'ArrowRight' ? tabs[(at + 1) % tabs.length]
      : event.key === 'ArrowLeft' ? tabs[(at - 1 + tabs.length) % tabs.length] : null;
    if (next) { event.preventDefault(); next.focus(); select(next); }
  });
  select(tabs[0]);
}
document.querySelectorAll('[data-tabs]').forEach(initTabs);        // "extendable": markup-driven, any number
```

"Extendable and optimised" in vanilla means: markup-driven (add a tab by adding HTML), one delegated
listener per tab list, content fetched on first show only, `textContent` for fetched text.

---

## 10. The single-file version — what you actually type

```jsx
import { useCallback, useEffect, useId, useRef, useState } from 'react';

/* ───────────── constants/tabs.constants.js ───────────── */

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
  { id: 'attachments', label: 'Attachments', disabled: true },
  { id: 'worklog', label: 'Work log' },
];

/* ───────────── utils/tabs.utils.js — pure ───────────── */

function nextTabId(tabs, currentId, key) {
  const enabled = tabs.filter((t) => !t.disabled);
  const at = enabled.findIndex((t) => t.id === currentId);
  if (key === 'ArrowRight') return enabled[(at + 1) % enabled.length].id;
  if (key === 'ArrowLeft') return enabled[(at - 1 + enabled.length) % enabled.length].id;
  if (key === 'Home') return enabled[0].id;
  if (key === 'End') return enabled[enabled.length - 1].id;
  return currentId;
}

function tabFromSearch(search, param, tabs, fallback) {
  const value = new URLSearchParams(search).get(param);
  return tabs.find((t) => t.id === value && !t.disabled)?.id ?? fallback;
}

function searchWithTab(search, param, id) {
  const params = new URLSearchParams(search);
  params.set(param, id);                                    // other params survive
  return `?${params}`;
}

function createLoaderCache(load) {
  const cache = new Map();
  return {
    get(id) {
      if (!cache.has(id)) cache.set(id, load(id).catch((e) => { cache.delete(id); throw e; }));
      return cache.get(id);                                 // concurrent callers share one promise
    },
  };
}

/* ───────────── utils/panel-api.js ───────────── */

const fetchPanel = (id) =>
  new Promise((resolve) => setTimeout(() => resolve({ id, lines: [`${id} line 1`, `${id} line 2`], loadedAt: Date.now() }), 600));

const panelCache = createLoaderCache(fetchPanel);           // module scope: outlives unmounts

/* ───────────── hooks/use-tabs.js — headless ───────────── */

function useTabs({ tabs, defaultId, activation = 'automatic', keepMounted = true, urlParam = 'tab' }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(() => tabFromSearch(window.location.search, urlParam, tabs, defaultId));
  const [focusedId, setFocusedId] = useState(activeId);
  const [visited, setVisited] = useState(() => new Set([activeId]));
  const refs = useRef(new Map());

  const select = useCallback((id) => {
    if (tabs.find((t) => t.id === id)?.disabled) return;
    setActiveId(id);
    setFocusedId(id);
    setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
    window.history.replaceState(window.history.state, '', searchWithTab(window.location.search, urlParam, id));
  }, [tabs, urlParam]);

  useEffect(() => {
    const onPop = () => select(tabFromSearch(window.location.search, urlParam, tabs, defaultId));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [defaultId, select, tabs, urlParam]);

  const onKeyDown = (event) => {
    const target = nextTabId(tabs, focusedId, event.key);
    if (target === focusedId) return;
    event.preventDefault();
    setFocusedId(target);
    refs.current.get(target)?.focus();
    if (activation === 'automatic') select(target);         // manual: Enter/Space clicks the button
  };

  return {
    activeId,
    isMounted: (id) => id === activeId || (keepMounted && visited.has(id)),
    getTabListProps: (label) => ({ role: 'tablist', 'aria-label': label, onKeyDown }),
    getTabProps: (tab) => ({
      id: `${baseId}-tab-${tab.id}`,
      role: 'tab',
      'aria-selected': tab.id === activeId,
      'aria-controls': `${baseId}-panel-${tab.id}`,
      'aria-disabled': tab.disabled || undefined,
      tabIndex: tab.id === focusedId ? 0 : -1,
      ref: (el) => { if (el) refs.current.set(tab.id, el); else refs.current.delete(tab.id); },
      onClick: () => select(tab.id),
      onFocus: () => setFocusedId(tab.id),
    }),
    getPanelProps: (id) => ({
      id: `${baseId}-panel-${id}`,
      role: 'tabpanel',
      'aria-labelledby': `${baseId}-tab-${id}`,
      hidden: id !== activeId,
      tabIndex: 0,
    }),
  };
}

/* ───────────── hooks/use-in-view.js ───────────── */

function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); observer.disconnect(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return seen;
}

/* ───────────── hooks/use-panel-data.js ───────────── */

function usePanelData(id, enabled) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let current = true;                                     // ignore a response for a panel we left
    setState((s) => ({ ...s, status: s.data ? 'ready' : 'loading' }));
    panelCache.get(id)
      .then((data) => current && setState({ status: 'ready', data, error: null }))
      .catch((e) => current && setState({ status: 'error', data: null, error: e.message }));
    return () => { current = false; };
  }, [id, enabled]);
  return state;
}

/* ───────────── components/panel.jsx ───────────── */

function Panel({ id, canLoad }) {
  const { status, data, error } = usePanelData(id, canLoad);
  if (!canLoad) return <p>Waiting until visible…</p>;
  if (status === 'loading') return <p>Loading…</p>;
  if (status === 'error') return <p role="alert">{error}</p>;
  return (
    <div>
      <ul>{data?.lines.map((line) => <li key={line}>{line}</li>)}</ul>
      <input placeholder="state survives switching" />
    </div>
  );
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const t = useTabs({ tabs: TABS, defaultId: 'summary' });
  const rootRef = useRef(null);
  const onScreen = useInView(rootRef);

  return (
    <div ref={rootRef}>
      <div {...t.getTabListProps('Issue CONF-4121')}>
        {TABS.map((tab) => (
          <button key={tab.id} type="button" {...t.getTabProps(tab)}>{tab.label}</button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div key={tab.id} {...t.getPanelProps(tab.id)}>
          {t.isMounted(tab.id) && <Panel id={tab.id} canLoad={onScreen} />}
        </div>
      ))}
    </div>
  );
}
```

**Build it in this order:** Pass 1 tabs with `useState` (on screen) → `visited` + `isMounted` + `hidden` →
`createLoaderCache` + `usePanelData` → extract into `useTabs` with prop getters → `nextTabId` + roving
tabindex → URL read/write/popstate → `useInView` gate.

Narrate the two lines the question is about: `id === activeId || (keepMounted && visited.has(id))` —
*"never mount what was never shown, never unmount what was"* — and `cache.set(id, load(id).catch(...))` —
*"the data outlives the panel, so even an unmount can't cause a refetch."*

---

## 11. Verification

```bash
node src/projects/tabs/utils/tabs.utils.check.ts
```

It checks: arrows wrap both ways and skip disabled tabs; Home/End; URL values that are unknown or disabled
fall back; other query params survive; the loader cache shares one request between concurrent callers,
caches after resolve, exposes settled values synchronously, and does not cache failures.

Demo script:

1. Open `/projects/tabs?tab=history` → History is selected on first paint; request log shows only `history`.
2. Arrow right from History → lands on *Work log* (Attachments is disabled); URL becomes `?tab=worklog`.
3. Type in the scratch note on Work log, go to Summary, come back → the text is still there (keep-alive);
   *mounted* time unchanged; no new request.
4. Untick *Keep visited panels mounted*, repeat → the note is gone but the request log still shows no refetch
   (cache outlives the unmount).
5. *Manual* activation → arrows move focus only; Enter selects.
6. Tick *Load only when on screen* → request log says *none yet* until you scroll the box to the widget.
7. *Fail next load*, open an unvisited tab → error + Retry; retry succeeds.

---

## 12. Cross-questions and answers

**"Load the panel's code lazily too."**
`const Comments = lazy(() => import('./CommentsPanel'))` and render it inside `<Suspense fallback>` in the
panel slot. Preload on hover/focus of the tab (`import()` again — the module system dedupes) so the click
feels instant.

**"Too many tabs to fit."**
Horizontal scroll with scroll buttons, or collapse the overflow into a "More" menu. Keep the active tab
visible (`scrollIntoView({ inline: 'nearest' })`). Never wrap tabs onto two rows — the row order becomes
ambiguous.

**"pushState or replaceState?"**
`replaceState` if tabs are views of one page (Back leaves the page). `pushState` if each tab is a destination
people expect Back to return to. Either way, handle `popstate`.

**"Server rendering?"**
Read `?tab=` on the server so the right panel is in the HTML; `useId` keeps the ARIA ids stable between
server and client.

**"Memory with keep-alive?"**
Bounded by the number of tabs visited. For heavy panels keep an LRU of the last *k* and unmount the rest;
the data cache still prevents refetching.

**"Why not `display:none` via a class?"**
`hidden` does the same visually and also removes the panel from the accessibility tree; a class can be
overridden by a stylesheet and still be read out.

**"How would you test it?"**
Pure utils in Node (the check file). Component tests with Testing Library: `getByRole('tab', {name})`,
`userEvent.keyboard('{ArrowRight}')`, assert `aria-selected` and focus; mock `fetch` and assert call counts
across switches; set `window.location.search` before render to test URL restore.
