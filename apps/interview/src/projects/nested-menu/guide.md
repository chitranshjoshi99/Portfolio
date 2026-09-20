# Nested Navigation Menu — Interview Build Guide

Build a recursive navigation menu from nested JSON. Clicking a parent opens its children and closes any
other open branch at the same level. Clicking deeper keeps the path above it open. Only the active page
is highlighted, and only the path containing it is expanded on load. The menu is pruned by the user's
permissions, and a typed URL is guarded: *403* for a page that exists but is forbidden, *404* for one that
does not. Arrow keys work. Plain JavaScript, fresh sandbox. Target 45–60 minutes.

Reported at Atlassian as: *"Create a menu with children as per image. How would you close opened children
when you click on another parent? How would you keep your children open when you click on a child's
children?"*, *"print a navigation menu with categories and children, recursive; highlight only the active
item and expand only the path that contains the active item"*, *"dynamic hierarchical menu with multiple
levels"* (browser round) paired with *"an API that retrieves the menu options and routes to the page
according to access rights"* (JS round), *"build a navigation tree"*, *"collapsible menu from a brief"*,
*"implement a nested collapse UI"*, *"create a category component via recursion"*.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Open state | **One array, `openPath`: a root→node chain.** "One open per level" means the open set *is* a path. Opening X = `pathTo(X)`; closing X = the chain up to X. Sibling-closing is automatic. |
| Active path | **Parent map built once**; `pathTo(id)` walks up in `O(depth)`. A DFS is written first as the oracle. |
| Access | `filterByAccess(tree, permissions)` prunes forbidden subtrees and folders left empty. Guard checks the full index too, to tell 403 from 404. |
| Discussed, not built | Hover-open flyouts, lazy-loaded children, server-side filtering, virtualisation for huge trees. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements — especially "accordion or independent?" |
| 5–10 | HLD, the open-state decision |
| 10–18 | Recursive render from JSON |
| 18–28 | **Open state — the accordion rule** |
| 28–36 | **Active item + active path — the index** |
| 36–46 | Access filtering + route guard |
| 46–55 | Keyboard, ARIA |
| 55–60 | Demo, cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
nested-menu/
  index.tsx                          # role picker, address bar, <nav>, page panel
  nested-menu.types.ts               # MenuNode, MenuIndex, Role, RouteResult
  nested-menu.css
  constants/nested-menu.constants.ts # MENU (what GET /menu returns), ROLES, DEFAULT_ROUTE
  utils/menu.utils.ts                # pure: filterByAccess, buildIndex, pathTo, findPathByDfs (oracle),
                                     #       toggleOpen, visibleOrder, resolveRoute
  utils/menu.utils.check.ts
  hooks/use-nested-menu.ts           # role, route, openPath, focus, keyboard
  components/menu-list.tsx           # recursive list
  components/page-panel.tsx          # page / 403 / 404
```

Say: *"Tree logic in pure functions, so the accordion rule and the permission pruning are testable without
rendering. The list component is recursive and dumb — it takes the open set and the active id as props."*

---

## 1. Requirement gathering (5 minutes)

1. **"When I open one parent, do its open siblings close?"**
   The fork of the whole question. Independent toggles → a `Set` of open ids. Accordion → the open state
   collapses to a single chain, which is simpler.
   *Default: accordion per level (the reported wording: "close opened children when you click on another parent").*
2. **"Clicking a child's child — does anything above it close?"**
   *Default: no — the whole path above stays open.*
3. **"How is 'active' known — URL, prop, or click?"**
   *Default: the current route; on load, expand exactly its ancestors.*
4. **"Can a node be both a page and a folder?"**
   Changes what a click does. *Default: folders toggle, leaves navigate.*
5. **"How deep can it go? How many items?"**
   Sets up the index discussion: re-searching the tree per render is `O(n)`.
   *Default: arbitrary depth, hundreds of nodes.*
6. **"Who decides access — server or client?"**
   *Default: server sends the full tree with a `permission` per node; client prunes for display; server
   still enforces on the page itself.*
7. **"Keyboard?"** *Default: Up/Down between visible items, Right opens/enters, Left closes/goes to parent.*

Plan in one breath:

> "Render the JSON recursively. Because only one branch per level can be open, the whole open state is one
> chain from the root, so I store `openPath` as an array — opening a node sets it to that node's path, and
> sibling-closing falls out for free. I index the tree once into a parent map so the active item's
> ancestors are an `O(depth)` walk. Permissions prune the tree before indexing, and the route guard uses
> the unpruned index to tell 403 from 404."

---

## 2. High-level design (HLD)

```text
 GET /menu (full tree, permission per node)
        │
        ├──────────────▶ FULL_INDEX = buildIndex(MENU)            (once, at load)
        │
        ▼  role → permissions
 tree  = filterByAccess(MENU, permissions)                         (per role change)
 index = buildIndex(tree)   byId · parentOf · byRoute              (per role change)
        │
        │  route ──▶ resolveRoute(index, FULL_INDEX, route)
        │              ok → activeId        forbidden → 403        missing → 404
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ state: openPath (chain) · route result · focusId             │
 │ derived: openSet · activeTrail = pathTo(activeId)            │
 │          order = visibleOrder(tree, openSet)  (for arrows)    │
 └──────────────────────────┬───────────────────────────────────┘
                            ▼
      <MenuList nodes depth openSet activeId activeTrail …>   (recursive)
          parent → <button aria-expanded>   leaf → <a aria-current="page">
```

Claims to make:

- **"One open per level" ⇒ the open set is a path.** That removes the whole class of bugs around closing
  siblings and their descendants: there is nothing to close, you replace the chain.
- **Indexes are rebuilt per role, not per click.** A click is `O(depth)`; role changes are rare.
- **Pruning happens before indexing.** The UI index cannot contain a node the user may not see, so no
  render path needs a permission check.
- **The guard needs both indexes.** Visible index answers "may I?"; full index answers "does it exist?".

---

## 3. Low-level design (LLD)

### State

```js
const [roleId, setRoleId]     = useState('lead');
const [route, setRoute]       = useState(() => resolveRoute(index, FULL_INDEX, DEFAULT_ROUTE)); // ok|forbidden|not-found
const [openPath, setOpenPath] = useState(() => parentChain(activeId));  // root→node chain
const [focusId, setFocusId]   = useState(activeId);                     // roving tabindex
```

### Derived

```js
const tree        = useMemo(() => filterByAccess(MENU, permissions), [permissions]);
const index       = useMemo(() => buildIndex(tree), [tree]);
const openSet     = useMemo(() => new Set(openPath), [openPath]);
const activeTrail = useMemo(() => new Set(pathTo(index, activeId)), [activeId, index]);
const order       = useMemo(() => visibleOrder(tree, openSet), [tree, openSet]);
```

### Refs

```js
const itemRefs = useRef(new Map()); // id -> element, for arrow-key .focus()
```

### Pure function signatures

```js
filterByAccess(nodes, permissions)      -> MenuNode[]        // O(n), new objects, never mutates
buildIndex(nodes)                       -> { byId, parentOf, byRoute }  // O(n), iterative DFS
pathTo(index, id)                       -> id[]              // root→id, O(depth)
findPathByDfs(nodes, id)                -> id[]              // oracle, O(n)
toggleOpen(index, openPath, id)         -> id[]              // the accordion rule
visibleOrder(nodes, openSet)            -> id[]              // what Up/Down walks
resolveRoute(visible, full, route)      -> {kind:'ok',id} | {kind:'forbidden'} | {kind:'not-found'}
```

---

## 4. The data model

```json
[
  { "id": "home", "label": "Home", "route": "/home" },
  { "id": "projects", "label": "Projects", "children": [
      { "id": "jira", "label": "Jira", "children": [
          { "id": "jira-board", "label": "Board", "route": "/jira/board" },
          { "id": "jira-reports", "label": "Reports", "permission": "reports:view", "children": [
              { "id": "velocity", "label": "Velocity chart", "route": "/jira/reports/velocity" }
          ]}
      ]}
  ]},
  { "id": "admin", "label": "Administration", "permission": "admin", "children": [ … ] }
]
```

- `id` is stable and unique: keys, open state and focus all hang off it. Labels are not ids — two
  "Settings" items under different parents are normal.
- `permission` on a parent hides its whole subtree; on a leaf it hides only the leaf.
- `route` only on pages. A folder with no route and no visible children is pruned.

**Fork — keep the nested tree, or normalise?**

| | Nested tree only | Nested tree + index (`byId`, `parentOf`, `byRoute`) |
| --- | --- | --- |
| Render | natural recursion | same (render from the tree) |
| Ancestors of active | DFS, `O(n)` | `O(depth)` |
| Route → node | DFS, `O(n)` | `O(1)` |
| Cost | none | one `O(n)` build per role |

Keep the tree for rendering (recursion matches the UI) and build the index next to it. You do not have to
choose.

---

## 5. Pass 1 — recursive render (target: 8 minutes)

```jsx
function MenuList({ nodes, depth, openSet, onActivate }) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          {node.children ? (
            <button aria-expanded={openSet.has(node.id)} onClick={() => onActivate(node.id)}
              style={{ paddingLeft: depth * 16 }}>{node.label}</button>
          ) : (
            <a href={`#${node.route}`} style={{ paddingLeft: depth * 16 }}
              onClick={(e) => { e.preventDefault(); onActivate(node.id); }}>{node.label}</a>
          )}
          {node.children && openSet.has(node.id) && (
            <MenuList nodes={node.children} depth={depth + 1} openSet={openSet} onActivate={onActivate} />
          )}
        </li>
      ))}
    </ul>
  );
}
```

Children render only when open — closed branches cost nothing. Demonstrate with a hard-coded `openSet`.

---

## 6. Pass 2 — the open state (target: 10 minutes)

### 6.1 Ladder A — how to store "what is open"

#### A0 — `isOpen` inside each node component (`useState` per item)

Each item owns a boolean. Easy — and the accordion is impossible: a node cannot close its sibling, and the
parent cannot open a path to the active item on load. Every reported follow-up needs lifted state.

#### A1 — a lifted `Set` of open ids + manual sibling closing

```js
function toggle(openSet, id, index) {
  const next = new Set(openSet);
  if (next.has(id)) { removeWithDescendants(next, id); return next; }
  const parent = index.parentOf.get(id);
  for (const sibling of childrenOf(parent)) removeWithDescendants(next, sibling); // O(siblings × subtree)
  next.add(id);
  return next;
}
```

Works, but "remove descendants" is a subtree walk you must remember in two places, and it is exactly where
the bug appears: close a parent, forget its open grandchild, reopen the parent — the grandchild is
still open.

#### A2 — the open set is one chain ← **build this**

With "at most one open per level", the open nodes form a single path from the root. So store the path:

```js
function toggleOpen(index, openPath, id) {
  const node = index.byId.get(id);
  if (!node?.children?.length) return openPath;
  const at = openPath.indexOf(id);
  return at === -1 ? pathTo(index, id) : openPath.slice(0, at);
}
```

- Open X: the new chain is X's ancestors + X. Every other branch is simply not in it.
- Close X: keep the chain above X. X's descendants were after it in the array — gone.
- Click a child's child: its path *contains* every ancestor, so they stay open.

| Rung | Close siblings | Close descendants | Open path to active | State |
| --- | --- | --- | --- | --- |
| A0 local boolean | impossible | automatic (unmount) | impossible | per item |
| A1 lifted Set | manual walk | manual walk (bug-prone) | add each ancestor | `Set` |
| **A2 chain** | **free** | **free** | **`pathTo(active)`** | **one array** |

What changed: A1 stores *a set of facts* and has to keep them consistent; A2 stores *the one fact the rule
allows* (a path), so inconsistent states are unrepresentable. If the interviewer changes the rule to
"independent toggles", A1 is the correct model — say so, that is the adaptability they grade.

---

## 7. Pass 3 — active item and its path (target: 8 minutes)

### 7.1 Ladder B — finding the active item's ancestors

#### B0 — DFS per render, copying the path at every node

```js
function findPathByDfs(nodes, id, trail = []) {
  for (const node of nodes) {
    const next = [...trail, node.id];
    if (node.id === id) return next;
    if (node.children) {
      const found = findPathByDfs(node.children, id, next);
      if (found.length) return found;
    }
  }
  return [];
}
```

`O(n · d)` with the array copies, run on every render. Obviously correct — keep it as the oracle.

#### B1 — DFS with a shared, backtracked path

Push before recursing, pop after: `O(n)` per query. Still a full-tree search for every click and every
route change.

#### B2 — index once, walk up ← **build this**

```js
function buildIndex(nodes) {
  const byId = new Map(), parentOf = new Map(), byRoute = new Map();
  const stack = nodes.map((node) => ({ node, parent: null }));
  while (stack.length) {
    const { node, parent } = stack.pop();
    byId.set(node.id, node);
    parentOf.set(node.id, parent);
    if (node.route) byRoute.set(node.route, node.id);
    node.children?.forEach((child) => stack.push({ node: child, parent: node.id }));
  }
  return { byId, parentOf, byRoute };
}

function pathTo(index, id) {
  const path = [];
  for (let current = id; current != null && index.byId.has(current); current = index.parentOf.get(current)) {
    path.push(current);
  }
  return path.reverse();
}
```

| Rung | Build | Per query | Route → node |
| --- | --- | --- | --- |
| B0 DFS + copies | — | `O(n·d)` | `O(n)` |
| B1 DFS backtracking | — | `O(n)` | `O(n)` |
| **B2 parent map** | **`O(n)` per role** | **`O(d)`** | **`O(1)`** |

What changed: the search moved from *query time* to *load time*. The tree only changes when the role
changes, so the index is rebuilt then and every click afterwards is a walk up `d` pointers. The iterative
stack means a pathological 10 000-deep tree does not overflow the call stack. **Ship B2**; the check file
asserts `pathTo === findPathByDfs` for every node. It is precomputation, not DP.

Highlight rule: the active node gets `aria-current="page"` and the strong style; its ancestors
(`activeTrail`) get a lighter "you are inside this" style. On navigation, `openPath = pathTo(parent(active))`
— exactly the active path, nothing else, which is the reported requirement.

---

## 8. Pass 4 — access rights and the route guard (target: 10 minutes)

```js
function filterByAccess(nodes, permissions) {
  const visible = [];
  for (const node of nodes) {
    if (node.permission && !permissions.has(node.permission)) continue; // hides the subtree
    if (!node.children) { visible.push(node); continue; }
    const children = filterByAccess(node.children, permissions);
    if (children.length === 0 && !node.route) continue;                // empty folder
    visible.push({ ...node, children });                                // new object: never mutate
  }
  return visible;
}

function resolveRoute(visible, full, route) {
  const normalised = route.trim().replace(/\/+$/, '') || '/';
  const id = visible.byRoute.get(normalised);
  if (id) return { kind: 'ok', id };
  if (full.byRoute.has(normalised)) return { kind: 'forbidden', route: normalised };
  return { kind: 'not-found', route: normalised };
}
```

Say three things:

1. Hiding a menu item is **not** access control. The guard runs on every navigation, including a typed
   URL, and the server enforces again when the page loads data.
2. On role change, re-resolve the current route — a user who loses access must not be left looking at the
   page.
3. 403 vs 404 is a product decision. Some teams deliberately return 404 for forbidden pages so the
   existence of `/admin/billing` doesn't leak. Ask.

---

## 9. Pass 5 — keyboard and ARIA (target: 8 minutes)

- Folders are `<button aria-expanded aria-controls>`; pages are `<a href aria-current="page">`. This is the
  **disclosure navigation** pattern, which is what site navs should use — `role="menu"` is for application
  menus and changes how screen readers read everything inside it.
- Roving tabindex: one Tab stop for the whole nav.
- Up/Down walk `visibleOrder(tree, openSet)`; Right opens or enters the first child; Left closes or moves to
  the parent; Home/End jump.
- If the focused item is hidden by a close, the Tab stop falls back to the first item — otherwise the nav
  has no Tab stop at all.

---

## 10. The single-file version — what you actually type

```jsx
import { useMemo, useRef, useState } from 'react';

/* ───────────── constants/nested-menu.constants.js ───────────── */

const MENU = [
  { id: 'home', label: 'Home', route: '/home' },
  { id: 'projects', label: 'Projects', children: [
    { id: 'jira', label: 'Jira', children: [
      { id: 'jira-board', label: 'Board', route: '/jira/board' },
      { id: 'jira-backlog', label: 'Backlog', route: '/jira/backlog' },
      { id: 'jira-reports', label: 'Reports', permission: 'reports:view', children: [
        { id: 'velocity', label: 'Velocity chart', route: '/jira/reports/velocity' },
        { id: 'burndown', label: 'Burndown', route: '/jira/reports/burndown' },
      ] },
    ] },
    { id: 'confluence', label: 'Confluence', children: [
      { id: 'spaces', label: 'Spaces', route: '/confluence/spaces' },
      { id: 'templates', label: 'Templates', route: '/confluence/templates' },
    ] },
  ] },
  { id: 'admin', label: 'Administration', permission: 'admin', children: [
    { id: 'users', label: 'Users', route: '/admin/users' },
    { id: 'billing', label: 'Billing', route: '/admin/billing', permission: 'billing' },
  ] },
  { id: 'help', label: 'Help', route: '/help' },
];

const ROLES = { viewer: [], lead: ['reports:view'], admin: ['reports:view', 'admin'] };

/* ───────────── utils/menu.utils.js — pure ───────────── */

function filterByAccess(nodes, permissions) {
  const visible = [];
  for (const node of nodes) {
    if (node.permission && !permissions.has(node.permission)) continue;
    if (!node.children) { visible.push(node); continue; }
    const children = filterByAccess(node.children, permissions);
    if (children.length === 0 && !node.route) continue;
    visible.push({ ...node, children });
  }
  return visible;
}

function buildIndex(nodes) {
  const byId = new Map(), parentOf = new Map(), byRoute = new Map();
  const stack = nodes.map((node) => ({ node, parent: null }));
  while (stack.length) {
    const { node, parent } = stack.pop();
    byId.set(node.id, node);
    parentOf.set(node.id, parent);
    if (node.route) byRoute.set(node.route, node.id);
    node.children?.forEach((child) => stack.push({ node: child, parent: node.id }));
  }
  return { byId, parentOf, byRoute };
}

function pathTo(index, id) {                       // root → id, O(depth)
  const path = [];
  for (let cur = id; cur != null && index.byId.has(cur); cur = index.parentOf.get(cur)) path.push(cur);
  return path.reverse();
}

function toggleOpen(index, openPath, id) {         // accordion: open state is ONE chain
  if (!index.byId.get(id)?.children?.length) return openPath;
  const at = openPath.indexOf(id);
  return at === -1 ? pathTo(index, id) : openPath.slice(0, at);
}

function visibleOrder(nodes, openSet, order = []) {
  for (const node of nodes) {
    order.push(node.id);
    if (node.children && openSet.has(node.id)) visibleOrder(node.children, openSet, order);
  }
  return order;
}

function resolveRoute(visible, full, route) {
  const r = route.trim().replace(/\/+$/, '') || '/';
  if (visible.byRoute.has(r)) return { kind: 'ok', id: visible.byRoute.get(r) };
  return full.byRoute.has(r) ? { kind: 'forbidden', route: r } : { kind: 'not-found', route: r };
}

const FULL_INDEX = buildIndex(MENU);

/* ───────────── hooks/use-nested-menu.js ───────────── */

function useNestedMenu(initialRoute) {
  const [role, setRole] = useState('lead');
  const tree = useMemo(() => filterByAccess(MENU, new Set(ROLES[role])), [role]);
  const index = useMemo(() => buildIndex(tree), [tree]);

  const [route, setRoute] = useState(() => resolveRoute(buildIndex(filterByAccess(MENU, new Set(ROLES.lead))), FULL_INDEX, initialRoute));
  const activeId = route.kind === 'ok' ? route.id : null;
  const [openPath, setOpenPath] = useState(() => (activeId ? pathTo(FULL_INDEX, FULL_INDEX.parentOf.get(activeId)) : []));
  const [focusId, setFocusId] = useState(activeId);
  const refs = useRef(new Map());

  const openSet = useMemo(() => new Set(openPath), [openPath]);
  const trail = useMemo(() => new Set(pathTo(index, activeId)), [index, activeId]);
  const order = useMemo(() => visibleOrder(tree, openSet), [tree, openSet]);
  const tabStop = order.includes(focusId) ? focusId : order[0];

  const goTo = (result, idx) => {
    setRoute(result);
    if (result.kind === 'ok') { setOpenPath(pathTo(idx, idx.parentOf.get(result.id))); setFocusId(result.id); }
  };

  const activate = (id) => {
    const node = index.byId.get(id);
    if (node.children?.length) setOpenPath((p) => toggleOpen(index, p, id));
    else goTo({ kind: 'ok', id }, index);
  };

  const navigate = (value) => goTo(resolveRoute(index, FULL_INDEX, value), index);

  const changeRole = (next) => {
    setRole(next);
    const nextIndex = buildIndex(filterByAccess(MENU, new Set(ROLES[next])));
    const current = route.kind === 'ok' ? FULL_INDEX.byId.get(route.id).route : route.route;
    goTo(resolveRoute(nextIndex, FULL_INDEX, current), nextIndex);     // losing access = 403 now
  };

  const focus = (id) => { if (id) { setFocusId(id); refs.current.get(id)?.focus(); } };
  const onKeyDown = (event, id) => {
    const at = order.indexOf(id);
    const node = index.byId.get(id);
    const open = openSet.has(id);
    if (event.key === 'ArrowDown') focus(order[at + 1]);
    else if (event.key === 'ArrowUp') focus(order[at - 1]);
    else if (event.key === 'ArrowRight') { if (node.children && !open) activate(id); else if (open) focus(node.children[0].id); }
    else if (event.key === 'ArrowLeft') { if (open) activate(id); else focus(index.parentOf.get(id)); }
    else return;
    event.preventDefault();
  };

  return { role, changeRole, tree, index, route, activeId, openSet, trail, tabStop, setFocusId, refs,
    activate, navigate, onKeyDown };
}

/* ───────────── components/menu-list.jsx ───────────── */

function MenuList({ nodes, depth, m }) {
  return (
    <ul>
      {nodes.map((node) => {
        const open = m.openSet.has(node.id);
        const cls = node.id === m.activeId ? 'item item--active' : m.trail.has(node.id) ? 'item item--trail' : 'item';
        const common = {
          ref: (el) => { if (el) m.refs.current.set(node.id, el); else m.refs.current.delete(node.id); },
          className: cls,
          style: { paddingLeft: 8 + depth * 16 },
          tabIndex: node.id === m.tabStop ? 0 : -1,
          onKeyDown: (e) => m.onKeyDown(e, node.id),
          onFocus: () => m.setFocusId(node.id),
        };
        return (
          <li key={node.id}>
            {node.children ? (
              <button {...common} aria-expanded={open} onClick={() => m.activate(node.id)}>
                {open ? '▾' : '▸'} {node.label}
              </button>
            ) : (
              <a {...common} href={`#${node.route}`} aria-current={node.id === m.activeId ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); m.activate(node.id); }}>
                {node.label}
              </a>
            )}
            {node.children && open && <MenuList nodes={node.children} depth={depth + 1} m={m} />}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const m = useNestedMenu('/jira/reports/velocity');
  const [typed, setTyped] = useState('/jira/reports/velocity');
  const page = m.activeId ? m.index.byId.get(m.activeId) : null;

  return (
    <main>
      <select value={m.role} onChange={(e) => m.changeRole(e.target.value)}>
        {Object.keys(ROLES).map((r) => <option key={r}>{r}</option>)}
      </select>
      <form onSubmit={(e) => { e.preventDefault(); m.navigate(typed); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button>Go</button>
      </form>

      <nav aria-label="Product navigation">
        <MenuList nodes={m.tree} depth={0} m={m} />
      </nav>

      <section>
        {m.route.kind === 'ok' && <h2>{pathTo(m.index, m.activeId).map((id) => m.index.byId.get(id).label).join(' / ')}</h2>}
        {m.route.kind === 'forbidden' && <p role="alert">403 — {m.route.route} exists but you cannot open it</p>}
        {m.route.kind === 'not-found' && <p role="alert">404 — {m.route.route}</p>}
        {page && <code>{page.route}</code>}
      </section>
    </main>
  );
}
```

**Build it in this order:** recursive `MenuList` with a hard-coded open set → `buildIndex` + `pathTo` →
`toggleOpen` (the accordion) → active highlight + `openPath = pathTo(parent(active))` on navigation →
`filterByAccess` + role select → `resolveRoute` + address bar → keyboard.

Narrate while typing the two lines the question is really about: `return at === -1 ? pathTo(index, id) :
openPath.slice(0, at)` — *"one open per level means the open state is a path, so closing siblings is
free"* — and `visible.push({ ...node, children })` — *"prune into new objects; the server's tree is
never mutated, so switching roles back is lossless."*

---

## 11. Verification

```bash
node src/projects/nested-menu/utils/menu.utils.check.ts
```

It asserts: viewer/lead/admin/owner see exactly their subtrees; a folder with all children forbidden is
pruned but a folder that is also a page stays; the source tree is never mutated; `pathTo === DFS` for every
node; the accordion sequence (open projects → jira → reports → confluence closes jira, → admin closes the
projects branch, closing jira closes reports); visible order; 403 vs 404 vs ok with a trailing slash.

Demo script:

1. Load as *Team lead* → only Projects › Jira › Reports is expanded and *Velocity chart* is highlighted;
   its ancestors show the trail colour.
2. Click *Confluence* → Jira closes, Confluence opens; Projects stays open.
3. Open Jira › Reports again, click *Burndown* → path stays open, highlight moves.
4. Switch role to *Viewer* → Reports disappears; the current page turns into **403**.
5. Type `/admin/users` as Viewer → 403. Type `/nope` → 404. Switch to *Site admin* and go to `/admin/users` → ok.
6. Tab into the nav (one stop), arrows move, Right/Left open and close.

---

## 12. Cross-questions and answers

**"Now make the toggles independent — several branches open at once."**
Swap `openPath` for a `Set` and `toggleOpen` for add/delete (A1). The render, index and guard don't change.
Mention the descendant-closing decision: close the subtree too, or remember it for when the parent
reopens (VS Code remembers).

**"Children should load lazily from the API."**
A node gets `hasChildren: true` and no `children`. Opening it triggers a fetch keyed by id, cached in a
`Map<id, Promise>` so double-clicks don't double-fetch, with loading/error rows. The index grows as
children arrive (`buildIndex` on the subtree and merge).

**"The tree has 10 000 nodes."**
Only open branches render, which is usually enough. If an expanded branch is huge, flatten
`visibleOrder` into rows and virtualise the list; indentation comes from `depth` stored per row.

**"Should the server filter instead?"**
Yes if the tree itself is sensitive (it reveals what exists). Then the client gets a pruned tree and the
403-vs-404 distinction disappears, which is often the point.

**"Hover to open, like a mega-menu?"**
Hover intent with a small delay, the same `openPath` model, `Escape` closes, and clicks still work for
touch. Hover-only menus fail keyboard and touch users.

**"How do you keep the URL and the menu in sync?"**
The route is the source of truth for the active item; listen to `popstate` (or the router) and call
`navigate(location.pathname)`. Never store "active" separately from the URL.

**"How would you test it?"**
Pure functions first (the check file). Then component tests: click sequences assert which `aria-expanded`
are true, role switch asserts items disappear and the page shows 403, keyboard tests use real key events.
