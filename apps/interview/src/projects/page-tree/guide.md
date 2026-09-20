# Confluence Page Tree — Interview Build Guide

Build the Confluence sidebar: a page tree whose children are fetched from an API **when a node is first
expanded** (one request per node even if the user double-clicks, a loading row while it runs, an error row
with Retry if it fails), rendered as a **flat list** of rows with the full ARIA tree semantics
(`aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded`, `aria-selected`), driven by the keyboard
(arrows, Home/End, `*`, type-ahead), and **virtualised** so a space with 2 000 pages renders ~20 DOM nodes.
Plain JavaScript, fresh sandbox. Target 45–60 minutes.

Reported at Atlassian as: *"File Explorer — implement a folder tree from nested JSON, expand/collapse, support
lazy-loading subfolders via a mock API call; follow-up: how would this scale in a large enterprise setup and
how would you manage performance"* (P40 onsite), *"build a basic file tree in React — follow-ups as in File
Explorer II"* (P50), GreatFrontEnd's Atlassian list *File Explorer II: appropriate ARIA roles, states and
properties* and *File Explorer III: a flat DOM structure*, and Devtools' *"Confluence-like sidebar with tree
structure"*. The repo's `file-explorer` project covers the CRUD version (add/rename/delete); this project is
the **lazy + accessible + scalable** version those follow-ups ask for.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Data | **Normalised store** `{ id: { parentId, childIds: null | [], hasChildren, load } }`. `childIds: null` = never fetched. |
| Loading | On expand: dedupe through a `Map<parentId, Promise>`; `load` = `idle → loading → loaded | error`; the failure is not cached. |
| Rendering | **Flatten to rows** with a DFS that descends only into expanded nodes; render rows flat, positioned absolutely. |
| ARIA | `role="tree"` / `"treeitem"` with `aria-level`, `aria-setsize`, `aria-posinset` on every row — nesting is expressed in attributes, not DOM. |
| Scale | Fixed row height → window = `[scrollTop / h − overscan, … + viewport / h + overscan]`; the tab-stop row is always kept rendered. |
| Discussed, not built | Prefetch on hover/focus, drag-and-drop reorder, server-side "expand to page" (ancestor path), live updates. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: lazy? how big? keyboard? |
| 5–10 | HLD: store + rows + window |
| 10–18 | Store + load root + flat rows on screen |
| 18–28 | **Lazy expand: dedupe, loading/error rows — ladder A** |
| 28–38 | **Flat rendering + virtualisation — ladder B** |
| 38–50 | Keyboard + ARIA (+ type-ahead) |
| 50–60 | Demo, scaling cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
page-tree/
  index.tsx                         # toolbar (rows / DOM rows / requests), viewport, page panel
  page-tree.types.ts                # PageSummary, PageNode, PageStore, TreeRow, RowWindow
  page-tree.css
  constants/page-tree.constants.ts  # ROW_HEIGHT, VIEWPORT_HEIGHT, OVERSCAN, latency, archive size
  utils/tree.utils.ts               # pure: mergeChildren, setLoad, visibleRows, visibleIdsByRecursion (oracle),
                                    #       windowRows, typeaheadIndex
  utils/tree.utils.check.ts
  utils/page-api.ts                 # GET /pages/:id/children, failNext, request counter
  hooks/use-page-tree.ts            # store, expanded, loads, focus, keyboard, virtual window
  components/tree-row.tsx           # one row: page, loading or error
```

---

## 1. Requirement gathering (5 minutes)

1. **"Does the API return the whole tree, or children per node?"**
   Whole tree → a render problem. Per node → lazy loading, loading states, dedupe, errors.
   *Default: `GET /pages/:id/children`, each child with `hasChildren` so a chevron can render without a fetch.*
2. **"How big can one space get?"**
   Sets up virtualisation. *Default: thousands of pages under one parent (meeting notes, archives).*
3. **"When a node collapses and reopens, refetch?"** *Default: no — keep loaded children; refresh is a separate action.*
4. **"Keyboard and screen readers?"** *Default: yes — full WAI-ARIA tree pattern.*
5. **"Selection vs expansion — does clicking the title expand?"** *Default: chevron toggles, title selects/navigates (Confluence).*
6. **"What if a fetch fails?"** *Default: inline error row with Retry, in the place the children would go.*
7. **"Deep links — open the tree at a page nobody expanded yet?"** *Default: out of scope; discuss (needs the ancestor path).*

Plan:

> "A normalised store keyed by page id, where `childIds` is null until fetched. Expanding a node adds it to an
> `expanded` set and calls `loadChildren`, which reuses an in-flight promise if there is one. I derive a flat
> array of rows with a DFS that only walks expanded nodes, each row carrying its level, position and set size,
> and render just the rows in the scrolled window. Keyboard focus is a roving tabindex over those rows."

---

## 2. High-level design (HLD)

```text
 expand(id) ──▶ expanded.add(id)
          └───▶ loadChildren(id):  loaded? done · inFlight.get(id)? reuse · else
                  store[id].load = 'loading' → fetchChildren(id)
                     ├─ ok   → mergeChildren(store, id, children)   load='loaded', childIds=[…]
                     └─ fail → load='error'                        (not cached: Retry refetches)
                  finally inFlight.delete(id)

 store + expanded ──visibleRows (DFS, expanded only)──▶ rows: [{ id, depth, posInSet, setSize, kind }]
                                                            kind: page | loading | error
 scrollTop ──windowRows──▶ { start, end }  ── rows[start..end) (+ tab-stop row) ──▶ absolutely placed <div role=treeitem>
 keydown on a row ──▶ move focus by index (scroll first if outside window, focus after render)
```

Claims:

- **`childIds: null` vs `[]`** is the difference between "not fetched" and "has no children". Collapse the two and
  an empty folder refetches forever.
- **The DFS cost is the number of visible rows**, not the number of loaded pages: collapsed subtrees are never
  entered, even though they stay loaded.
- **Loading and error rows live in the flat list** at the position the children will occupy — the same keyboard
  and virtualisation code handles them.
- **Flat DOM is what makes virtualisation possible.** A nested `<ul>` tree cannot render "rows 400–420" without
  also rendering their ancestors' containers.

---

## 3. Low-level design (LLD)

### State

```js
const [store, setStore]       = useState({ root: { id: 'root', childIds: null, load: 'idle', … } });
const [expanded, setExpanded] = useState(new Set());
const [selectedId, setSelectedId] = useState(null);
const [focusedId, setFocusedId]   = useState(null);   // roving tabindex
const [scrollTop, setScrollTop]   = useState(0);
```

### Refs

```js
const inFlight     = useRef(new Map());   // parentId -> Promise (dedupe)
const storeRef     = useRef(store);       // latest store inside async callbacks
const viewportRef  = useRef(null);        // the scrolling element
const rowRefs      = useRef(new Map());   // rowId -> element (only rendered rows exist)
const pendingFocus = useRef(null);        // focus to apply after the next render
```

### Pure function signatures

```js
mergeChildren(store, parentId, children) -> store          // keeps already-loaded grandchildren
setLoad(store, id, load)                 -> store
visibleRows(store, rootId, expanded)     -> TreeRow[]      // O(visible rows)
visibleIdsByRecursion(store, id, exp)    -> id[]           // oracle
windowRows(total, scrollTop, rowH, viewH, overscan) -> { start, end, offsetTop }
typeaheadIndex(rows, titleOf, from, prefix) -> index | -1
```

---

## 4. The data model

API response for `GET /pages/eng/children`:

```json
[
  { "id": "eng-arch", "title": "Architecture decisions", "hasChildren": true },
  { "id": "eng-oncall", "title": "On-call handbook", "hasChildren": false }
]
```

Store entry:

```json
{ "id": "eng-arch", "title": "Architecture decisions", "hasChildren": true,
  "parentId": "eng", "childIds": null, "load": "idle" }
```

Row:

```json
{ "kind": "page", "id": "eng-arch", "pageId": "eng-arch", "depth": 2, "posInSet": 1, "setSize": 3 }
```

**Fork — nested tree state vs normalised store**

| | Nested `{ children: [...] }` | Normalised by id |
| --- | --- | --- |
| Insert children for node X | find X (DFS), rebuild the path to it | `store[X].childIds = …` |
| Parent of X (Left arrow) | search | `store[X].parentId` |
| Loading state per node | on the nested node | on the entry |
| Render | natural recursion | flatten to rows |

Lazy loading writes into arbitrary depths constantly; normalised wins.

---

## 5. Pass 1 — store, root, rows on screen (target: 8 minutes)

```js
useEffect(() => { loadChildren('root'); }, []);
const rows = useMemo(() => visibleRows(store, 'root', expanded), [store, expanded]);
// render rows.map((row) => <div role="treeitem" style={{ paddingLeft: row.depth * 18 }}>…</div>)
```

On screen: the five top-level pages. Everything else is how `store` and `expanded` change.

---

## 6. Pass 2 — lazy expand (target: 10 minutes)

### 6.1 Ladder A — loading children

| Rung | Requests on double-click | Reopen after collapse | Failure | Big tree first paint |
| --- | --- | --- | --- | --- |
| A0 fetch the whole tree up front | 1 (huge) | free | whole sidebar fails | **slow: every page** |
| A1 fetch on every expand | **2** | **refetch** | per node | fast |
| **A2 fetch once per node, dedupe in-flight, cache result, don't cache failure** | **1** | **free** | **per node, retryable** | **fast** |
| A3 A2 + prefetch on hover/focus | 1 | free | per node | fast, and expand feels instant |

```js
function loadChildren(parentId) {
  const node = storeRef.current[parentId];
  if (!node || node.load === 'loaded') return Promise.resolve();
  if (inFlight.current.has(parentId)) return inFlight.current.get(parentId);
  setStore((s) => setLoad(s, parentId, 'loading'));
  const request = fetchChildren(parentId)
    .then((children) => setStore((s) => mergeChildren(s, parentId, children)))
    .catch(() => setStore((s) => setLoad(s, parentId, 'error')))
    .finally(() => inFlight.current.delete(parentId));
  inFlight.current.set(parentId, request);
  return request;
}
```

What changed from A1 to A2: the fetch became **a property of the node** (its `load` state and its in-flight
promise) rather than a side effect of a click. Two clicks, a keyboard Right and a StrictMode double effect all
arrive at the same node state and share one request. **Ship A2**; mention A3 as a one-liner
(`onPointerEnter={() => loadChildren(id)}`).

`storeRef` is read inside the callback because the callback must see the *latest* store even when it was
created in an earlier render; state setters use the functional form for the same reason.

---

## 7. Pass 3 — flat rows and virtualisation (target: 10 minutes)

```js
function visibleRows(store, rootId, expanded) {
  const rows = [];
  (function walk(parentId, depth) {
    const ids = store[parentId]?.childIds;
    if (!ids) return;
    ids.forEach((id, i) => {
      const node = store[id];
      rows.push({ kind: 'page', id, pageId: id, depth, posInSet: i + 1, setSize: ids.length });
      if (!node.hasChildren || !expanded.has(id)) return;
      if (node.load === 'loaded') walk(id, depth + 1);
      else rows.push({ kind: node.load === 'error' ? 'error' : 'loading', id: `${id}:${node.load}`, pageId: id,
        depth: depth + 1, posInSet: 1, setSize: 1 });
    });
  })(rootId, 1);
  return rows;
}

function windowRows(total, scrollTop, rowHeight, viewportHeight, overscan) {
  const first = Math.floor(scrollTop / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(total, first + Math.ceil(viewportHeight / rowHeight) + overscan);
  return { start, end, offsetTop: start * rowHeight };
}
```

### 7.1 Ladder B — rendering

| Rung | DOM for 2 000 expanded pages | Can virtualise | ARIA level / position |
| --- | --- | --- | --- |
| B0 recursive `<ul><li>` components | 2 000+ nodes | no (ancestors wrap descendants) | implicit from nesting |
| B1 flat rows, all rendered | 2 000 nodes | yes, but not done | **explicit attributes needed** |
| **B2 flat rows, windowed** | **~20 nodes** | **yes** | **explicit: `aria-level/setsize/posinset`** |

What changed: **structure moved from the DOM into data**. Once each row carries its own depth, position and set
size, the DOM no longer has to mirror the tree, so only the rows on screen need to exist — and screen readers
still announce "level 2, 1 of 3" from the attributes. `visibleRows` is `O(visible)`; the window makes rendering
`O(viewport / rowHeight)`. The check file asserts the flat DFS equals a naive recursive order on 150 random
trees. This is a traversal plus a window, not DP.

Two virtualisation details that break accessibility if missed: keep the **tab-stop row rendered** even when it
scrolls away (else Tab can't enter the tree), and when the keyboard moves focus to a row outside the window,
**scroll first, focus after the render** (the element doesn't exist yet).

---

## 8. Pass 4 — keyboard and ARIA (target: 10 minutes)

| Key | Action (WAI-ARIA tree pattern) |
| --- | --- |
| ↓ / ↑ | next / previous visible page row |
| → | collapsed parent: expand · expanded parent: first child |
| ← | expanded parent: collapse · otherwise: parent |
| Home / End | first / last visible row |
| Enter / Space | select (navigate to the page) |
| `*` | expand every sibling at this level |
| letters | type-ahead: next row whose title starts with the typed prefix (resets after 600 ms) |

Row attributes: `role="treeitem"`, `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` (only on
parents — leaves must not have it), `aria-selected`, `aria-busy` while its children load, `tabIndex` 0 on one
row. Loading/error rows are `role="none"` and skipped by the arrows.

---

## 9. The single-file version — what you actually type

```jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/* ───────────── constants/page-tree.constants.js ───────────── */

const ROW_HEIGHT = 30;
const VIEWPORT_HEIGHT = 420;
const OVERSCAN = 6;

/* ───────────── utils/page-api.js ───────────── */

const TREE = {
  root: [
    { id: 'eng', title: 'Engineering', hasChildren: true },
    { id: 'product', title: 'Product', hasChildren: true },
    { id: 'big', title: 'Archive (2,000 pages)', hasChildren: true },
  ],
  eng: [{ id: 'adr', title: 'Architecture decisions', hasChildren: true }, { id: 'oncall', title: 'On-call', hasChildren: false }],
  adr: [{ id: 'adr-1', title: 'ADR-001 State', hasChildren: false }],
  product: [{ id: 'roadmap', title: 'Roadmap', hasChildren: false }],
};

let failNext = false;
const fetchChildren = (id) =>
  new Promise((resolve, reject) => setTimeout(() => {
    if (failNext) { failNext = false; return reject(new Error('500')); }
    resolve(id === 'big'
      ? Array.from({ length: 2000 }, (_, i) => ({ id: `big-${i}`, title: `Meeting notes ${i + 1}`, hasChildren: false }))
      : TREE[id] ?? []);
  }, 400));

/* ───────────── utils/tree.utils.js — pure ───────────── */

function mergeChildren(store, parentId, children) {
  const next = { ...store };
  for (const c of children) next[c.id] = store[c.id] ? { ...store[c.id], ...c } : { ...c, parentId, childIds: null, load: 'idle' };
  next[parentId] = { ...store[parentId], childIds: children.map((c) => c.id), load: 'loaded' };
  return next;
}

const setLoad = (store, id, load) => ({ ...store, [id]: { ...store[id], load } });

function visibleRows(store, rootId, expanded) {
  const rows = [];
  (function walk(parentId, depth) {
    const ids = store[parentId]?.childIds;
    if (!ids) return;
    ids.forEach((id, i) => {
      const node = store[id];
      rows.push({ kind: 'page', id, pageId: id, depth, posInSet: i + 1, setSize: ids.length });
      if (!node.hasChildren || !expanded.has(id)) return;
      if (node.load === 'loaded') walk(id, depth + 1);
      else rows.push({ kind: node.load === 'error' ? 'error' : 'loading', id: `${id}:status`, pageId: id, depth: depth + 1, posInSet: 1, setSize: 1 });
    });
  })(rootId, 1);
  return rows;
}

function windowRows(total, scrollTop) {
  const first = Math.floor(scrollTop / ROW_HEIGHT);
  return { start: Math.max(0, first - OVERSCAN), end: Math.min(total, first + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN) };
}

/* ───────────── hooks/use-page-tree.js ───────────── */

function usePageTree() {
  const [store, setStore] = useState({ root: { id: 'root', title: 'Space', hasChildren: true, parentId: null, childIds: null, load: 'idle' } });
  const [expanded, setExpanded] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [scrollTop, setScrollTop] = useState(0);
  const inFlight = useRef(new Map());
  const storeRef = useRef(store);
  storeRef.current = store;
  const viewportRef = useRef(null);
  const rowRefs = useRef(new Map());
  const pendingFocus = useRef(null);

  const loadChildren = (id) => {
    const node = storeRef.current[id];
    if (!node || node.load === 'loaded') return;
    if (inFlight.current.has(id)) return;                      // dedupe
    setStore((s) => setLoad(s, id, 'loading'));
    const request = fetchChildren(id)
      .then((children) => setStore((s) => mergeChildren(s, id, children)))
      .catch(() => setStore((s) => setLoad(s, id, 'error')))   // not cached: Retry refetches
      .finally(() => inFlight.current.delete(id));
    inFlight.current.set(id, request);
  };

  useEffect(() => { loadChildren('root'); }, []);

  const rows = useMemo(() => visibleRows(store, 'root', expanded), [store, expanded]);
  const indexOf = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);
  const tabStop = indexOf.has(focusedId) ? focusedId : rows[0]?.id;
  const { start, end } = windowRows(rows.length, scrollTop);
  const rendered = [];
  for (let i = start; i < end; i++) rendered.push(i);
  const stopIndex = indexOf.get(tabStop);
  if (stopIndex !== undefined && (stopIndex < start || stopIndex >= end)) rendered.push(stopIndex); // keep Tab working

  const expand = (id) => { setExpanded((e) => new Set(e).add(id)); loadChildren(id); };
  const collapse = (id) => setExpanded((e) => { const n = new Set(e); n.delete(id); return n; });

  const focusRow = (index) => {
    const row = rows[index];
    if (!row) return;
    const vp = viewportRef.current;
    const top = index * ROW_HEIGHT;
    if (top < vp.scrollTop) vp.scrollTop = top;
    else if (top + ROW_HEIGHT > vp.scrollTop + VIEWPORT_HEIGHT) vp.scrollTop = top + ROW_HEIGHT - VIEWPORT_HEIGHT;
    setScrollTop(vp.scrollTop);
    setFocusedId(row.id);
    pendingFocus.current = row.id;                             // the element may not exist until the next render
  };

  useLayoutEffect(() => {
    const el = pendingFocus.current && rowRefs.current.get(pendingFocus.current);
    if (el) { el.focus({ preventScroll: true }); pendingFocus.current = null; }
  });

  const onKeyDown = (event, rowId) => {
    const i = indexOf.get(rowId);
    const row = rows[i];
    const node = store[row.pageId];
    const step = (dir) => { for (let j = i + dir; j >= 0 && j < rows.length; j += dir) if (rows[j].kind === 'page') return focusRow(j); };
    if (event.key === 'ArrowDown') step(1);
    else if (event.key === 'ArrowUp') step(-1);
    else if (event.key === 'Home') focusRow(0);
    else if (event.key === 'End') focusRow(rows.length - 1);
    else if (event.key === 'ArrowRight') {
      if (node.hasChildren && !expanded.has(node.id)) expand(node.id);
      else if (rows[i + 1]?.depth > row.depth) focusRow(i + 1);
    } else if (event.key === 'ArrowLeft') {
      if (node.hasChildren && expanded.has(node.id)) collapse(node.id);
      else if (node.parentId && node.parentId !== 'root') focusRow(indexOf.get(node.parentId));
    } else if (event.key === 'Enter' || event.key === ' ') setSelectedId(node.id);
    else return;
    event.preventDefault();
  };

  return { store, rows, rendered, expanded, selectedId, tabStop, viewportRef, rowRefs, setScrollTop, setFocusedId,
    setSelectedId, expand, collapse, loadChildren, onKeyDown, fail: () => { failNext = true; } };
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const t = usePageTree();

  return (
    <main>
      <button onClick={t.fail}>Fail next load</button>
      <p>{t.rows.length} rows · {t.rendered.length} in the DOM</p>
      <div ref={t.viewportRef} role="tree" aria-label="Space pages" className="viewport"
        style={{ height: VIEWPORT_HEIGHT, overflowY: 'auto', position: 'relative' }}
        onScroll={(e) => t.setScrollTop(e.currentTarget.scrollTop)}>
        <div style={{ height: t.rows.length * ROW_HEIGHT, position: 'relative' }}>
          {t.rendered.map((index) => {
            const row = t.rows[index];
            const node = t.store[row.pageId];
            const style = { position: 'absolute', top: index * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0, paddingLeft: row.depth * 18 };
            if (row.kind !== 'page') {
              return (
                <div key={row.id} role="none" style={style}>
                  {row.kind === 'loading' ? 'Loading…' : <>Failed. <button onClick={() => t.loadChildren(row.pageId)}>Retry</button></>}
                </div>
              );
            }
            const isOpen = t.expanded.has(row.pageId);
            return (
              <div
                key={row.id}
                ref={(el) => { if (el) t.rowRefs.current.set(row.id, el); else t.rowRefs.current.delete(row.id); }}
                role="treeitem"
                aria-level={row.depth}
                aria-setsize={row.setSize}
                aria-posinset={row.posInSet}
                aria-expanded={node.hasChildren ? isOpen : undefined}
                aria-selected={row.pageId === t.selectedId}
                tabIndex={row.id === t.tabStop ? 0 : -1}
                style={style}
                onKeyDown={(e) => t.onKeyDown(e, row.id)}
                onFocus={() => t.setFocusedId(row.id)}
                onClick={() => t.setSelectedId(row.pageId)}
              >
                {node.hasChildren && (
                  <span aria-hidden="true" onClick={(e) => { e.stopPropagation(); (isOpen ? t.collapse : t.expand)(row.pageId); }}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                )}{' '}
                {node.title}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

**Build it in this order:** store + `loadChildren('root')` + rows rendered flat (no virtualisation yet) →
expand/collapse with the chevron → dedupe + loading row + error row + Retry → ARIA attributes on rows → roving
tabindex + arrows → `windowRows` + absolute positioning → focus-after-scroll + keep tab stop rendered →
type-ahead.

Narrate: `if (inFlight.current.has(id)) return` — *"the request belongs to the node, not the click"* — and
`aria-level={row.depth} aria-posinset aria-setsize` — *"the tree lives in attributes, so the DOM can be flat and
windowed."*

---

## 10. Verification

```bash
node src/projects/page-tree/utils/tree.utils.check.ts
```

Asserts: `mergeChildren` sets `childIds`/`parentId`/`load` and keeps loaded grandchildren on a re-fetch; rows
for collapsed / loading / error / loaded states with correct level, posinset and setsize; collapsing hides a
subtree without unloading it; the flat DFS equals the recursive oracle on 150 random trees; window maths at the
top, middle and end; type-ahead cycles, advances and wraps.

Demo script:

1. Load → 5 top-level rows, 1 request.
2. Focus *Engineering*, press → twice quickly → one request (toolbar count), a *Loading…* row, then children at
   level 2.
3. → moves into *Architecture decisions* (level 2), ← back to the parent, type `d` → *Design system*.
4. *Fail next load*, expand *Product* → error row with Retry → Retry loads it.
5. Expand the archive → *2 008 visible rows · ~20 in the DOM*; press End → the view scrolls and focus lands on
   the last row; screen reader says "5 of 5, level 1".
6. Collapse and re-expand a loaded node → instant, no request.

---

## 11. Cross-questions and answers

**"Deep link to a page nobody expanded."** Ask the server for the ancestor path (`GET /pages/:id/ancestors`),
fetch children along it (in parallel per level where possible), expand those ids, scroll the target row into
view. Confluence does exactly this for the current page.

**"Children change on the server."** Invalidate by node: on a push event or a page-level refetch, re-run
`loadChildren` for that parent with `load` reset; `mergeChildren` keeps grandchildren already loaded.

**"Variable row heights?"** Measure rows as they render (`ResizeObserver`), keep a prefix-sum of heights, and
binary-search `scrollTop` into it. Fixed height is the right default for a sidebar.

**"Drag-and-drop to reorder?"** Drop targets by row index; compute the new parent and position from the row's
depth and pointer offset; optimistic move in the store, rollback on failure; keyboard alternative (cut/paste
or Alt+↑↓) for accessibility.

**"Why not `aria-activedescendant`?"** Also valid: focus stays on the tree container and points at the active
row. It avoids focus juggling under virtualisation, but the referenced row must still be in the DOM. Roving
tabindex was chosen because it gives native focus styles and scroll-into-view.

**"Search within the tree?"** Server-side search returns matching pages with their ancestor paths; show results
as a flat filtered list or expand the paths. Client-side type-ahead only covers visible rows.

**"How do you test it?"** Pure functions in Node (the check file). Component tests with a mocked fetch: two
Right presses → one call; failed call → error row → Retry → children. Accessibility: axe on the tree, and
assert `aria-level`/`posinset` on rows.
