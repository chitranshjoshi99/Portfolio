# File Explorer — Interview Build Guide

Build a recursive file tree with expand/collapse, add file/folder, rename, and recursive delete, in
plain JavaScript, in a fresh CodeSandbox. Target 45–60 minutes.

This guide is a script for the room: what to ask, what to say, what to type, and where to stop. Every
snippet is plain JS, pasteable into a `.jsx` sandbox file.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Data model | **Normalised store** — flat `nodes` map + `parentOf` map. Lookup `O(1)`, edit `O(children)`. |
| Sorting | Sorted **at write time** via binary search, so rendering never sorts. |
| Discussed, not built | Nested tree with `mapTree` rebuild, path-copying DFS, mutable store behind `useSyncExternalStore`, virtualisation. |

The nested-tree version is the one most candidates ship. It is in this guide as a rung on the ladder,
with the specific reason it loses — not as the plan.

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements, assumptions stated out loud |
| 5–12 | HLD, the nested-vs-normalised fork, state list |
| 12–20 | Static recursive render from the store |
| 20–26 | Expand/collapse |
| 26–42 | **Add file/folder — the algorithm section** |
| 42–50 | Rename, delete, validation |
| 50–60 | A11y pass, demo, trade-off talk |

---

## 0. Sandbox setup (2 minutes, talk while you do it)

React + JS template. Start with **one file** and split only when a file stops fitting on screen —
splitting early burns minutes and hides the logic the interviewer wants to see.

```text
src/
  App.jsx          // everything starts here
  styles.css
```

Target split (this repo's real layout, mirror it once things work):

```text
file-explorer/
  index.tsx                      # page: calls the hook, renders the root id
  file-explorer.types.ts         # TreeNode, FileTree, Draft, NodeType
  file-explorer.css
  constants/file-explorer.constants.ts   # icons, error strings, confirm copy
  utils/file-tree.utils.ts       # pure: create, get, add, rename, delete, sorted insert
  hooks/use-file-tree.ts         # all React state, all handlers
  components/
    tree-node.tsx                # recursive node + children (takes an id, not a node)
    node-row.tsx                 # one row: chevron, icon, name, buttons
    name-input.tsx               # inline create/rename editor
```

The boundary to state explicitly: **utils take values and return values, the hook owns state and
side effects, components render props and call handlers.** It is the sentence that turns "I wrote
some React" into "I have a design".

---

## 1. Requirement gathering (do not skip — 5 minutes)

Ask these, in this order. Each one changes code you are about to write:

1. **"Is this local state, or is there an API behind it?"**
   An API means async, optimistic updates, and per-node loading state.
   *Default: in-memory, seeded from a JSON constant.*
2. **"Arbitrary nesting, or a fixed depth?"**
   Arbitrary nesting is why the component must be recursive.
   *Default: arbitrary.*
3. **"Which operations are in scope — add, rename, delete, move?"**
   Move is the one that decides the data model: reparenting a subtree in a nested tree rebuilds two
   paths, in a normalised store it swaps two arrays. Ask before choosing the shape.
   *Default: add file, add folder, rename, delete; move discussed.*
4. **"Can two siblings share a name? Case-sensitive?"**
   *Default: no duplicates among siblings, case-insensitive.*
5. **"Deleting a non-empty folder — allowed, and does it need confirmation?"**
   *Default: allowed, with a confirm for non-empty folders. Root cannot be deleted.*
6. **"Roughly how many nodes, and how wide is the widest folder?"**
   Depth is rarely the problem; a single folder with 10,000 entries is. It decides whether per-folder
   operations may be linear scans.
   *Default: hundreds of nodes, but assume one folder can be large — `node_modules` exists.*

Then state the plan in one breath:

> "I'll normalise the tree — a flat map of id to node, each folder holding child *ids*, plus a
> parent map. Lookup by id is then O(1) instead of a search from the root, an edit touches one
> folder instead of rebuilding the tree, and every untouched node keeps its object identity. Expand
> state stays out of the data. I'll keep siblings sorted on write so render never sorts."

---

## 2. High-level design (HLD)

Draw this. It takes 90 seconds and frames every later decision.

```text
                 ┌──────────────────────────────────────┐
   seed  ──────▶ │  useFileTree (the hook)              │
                 │  ──────────────────────────────────  │
                 │  tree        { rootId, nodes,        │
                 │                parentOf }            │
                 │  expandedIds Set<id>                 │ ← view state, NOT file-system state
                 │  draft       create|rename|null      │
                 │  error       string|null             │
                 └───────┬──────────────────▲───────────┘
                    id + │ getNode(id)      │ handler calls
                         ▼                  │
                 ┌───────────────────────────┴──────────┐
                 │  <TreeNode nodeId>  (recursive)      │
                 │    <NodeRow>   row UI                │
                 │    <NameInput> inline edit           │
                 │    childIds.map(TreeNode)            │──┐ recursion over IDs
                 └──────────────────────────────────────┘◀─┘
                         │
                         ▼ pure calls, no React
                 ┌──────────────────────────────────────┐
                 │ file-tree.utils                      │
                 │ getNode/getParent      O(1)          │
                 │ addNode                O(log c + c)  │
                 │ renameNode             O(c)          │
                 │ deleteNode             O(subtree)    │
                 └──────────────────────────────────────┘
```

Four things to say about the picture:

- **Components hold ids, not nodes.** A component that captured a node object holds a stale copy the
  moment that node is edited. Holding the id and resolving through the store means every render reads
  the current value, and it is what makes the recursion work over `childIds`.
- **One source of truth.** The store lives in one `useState` at the top. Nodes never hold their own
  state; a node that owned its own name would make rename-with-validation impossible to coordinate.
- **View state is separate from data.** `expandedIds` is a `Set` next to the store, not an `isOpen`
  flag inside each node. Collapsing a folder is not a file-system edit.
- **Pure core, thin shell.** Every transformation is `(tree, args) → tree`. Testable without React,
  and undo becomes "keep the previous tree".

---

## 3. Low-level design (LLD)

### State

```js
const [tree, setTree]            = useState(createInitialTree); // { rootId, nodes, parentOf }
const [expandedIds, setExpanded] = useState(() => new Set());   // folder ids that are open
const [draft, setDraft]          = useState(null);              // the inline input, or null
const [error, setError]          = useState(null);              // validation message
```

Why `draft` is one piece of state and not four: creating and renaming are the same interaction —
an input with a value that either commits or cancels. One shape covers both:

```js
// creating:  { mode: 'create', parentId, type: 'file' | 'folder', name: '' }
// renaming:  { mode: 'rename', nodeId, name: 'button.tsx' }
// idle:      null
```

In TypeScript this becomes a discriminated union, so `draft.parentId` is only reachable in the
create branch. Mention that; do not spend interview minutes on it.

### Function signatures (write these as comments before implementing)

```js
createNode(name, type)                        -> node
getNode(tree, id)                             -> node | undefined      // O(1)
getParent(tree, id)                           -> node | undefined      // O(1)
addNode(tree, parentId, child)                -> newTree               // O(log c + c)
renameNode(tree, id, name)                    -> newTree               // O(c)
deleteNode(tree, id)                          -> newTree               // O(subtree)
findChildNamed(tree, parentId, name)          -> node | undefined      // O(log c)
collectFolderIds(tree)                        -> string[]              // O(n), once
```

Every mutating function returns a **new tree**. Never `void`. Write the complexity in the comment as
you write the signature — it is the cheapest way to show you chose the shape on purpose.

---

## 4. The data model — the fork that decides the whole question

Ask: *"Nested or flat?"* This is the real design decision, so answer it with a table, not a
preference.

**Nested (the common answer):**

```json
{
  "id": "n1", "name": "root", "type": "folder",
  "children": [
    { "id": "n2", "name": "src", "type": "folder",
      "children": [
        { "id": "n3", "name": "components", "type": "folder",
          "children": [ { "id": "n4", "name": "button.tsx", "type": "file" } ] },
        { "id": "n5", "name": "index.ts", "type": "file" }
      ] },
    { "id": "n6", "name": "package.json", "type": "file" }
  ]
}
```

**Normalised (chosen, and built):**

```json
{
  "rootId": "n1",
  "nodes": {
    "n1": { "id": "n1", "name": "root",       "type": "folder", "childIds": ["n2", "n6"] },
    "n2": { "id": "n2", "name": "src",        "type": "folder", "childIds": ["n3", "n5"] },
    "n3": { "id": "n3", "name": "components", "type": "folder", "childIds": ["n4"] },
    "n4": { "id": "n4", "name": "button.tsx", "type": "file" },
    "n5": { "id": "n5", "name": "index.ts",   "type": "file" },
    "n6": { "id": "n6", "name": "package.json", "type": "file" }
  },
  "parentOf": { "n2": "n1", "n3": "n2", "n4": "n3", "n5": "n2", "n6": "n1" }
}
```

| | Nested | Normalised |
| --- | --- | --- |
| Find node by id | `O(n)` walk from root | **`O(1)`** |
| Find parent | `O(n)` second walk | **`O(1)`** |
| Add / rename | rebuild every node on the path (and, naively, all `n`) | one folder's `childIds` |
| Delete subtree | drop a reference, subtree follows | **must delete descendants explicitly** |
| Move / reparent | rebuild two paths | swap two `childIds` entries |
| Render | `children.map` | `childIds.map(id => getNode(id))` — one extra hop |
| Reads like the domain | yes | no |

Say: *"Normalised. Both halves of every operation — find the target, then edit it — go from linear
to constant or to the size of one folder. The two costs are the extra lookup hop when rendering, and
that deleting a subtree has to be explicit. I'll handle the second one deliberately, because
forgetting it is the classic normalisation bug: you drop the parent's edge and leave every
descendant in the map forever."*

Three rules about the shape, each worth stating:

- **`id` is `crypto.randomUUID()`, not the name and not the array index.** Names are editable and
  indexes change the moment the list re-sorts, so neither can identify a node across a rename.
- **`childIds` exists only on folders.** Its presence doubles as "is this a folder"; an empty folder
  is `[]`, a file is `undefined`.
- **The root is special.** It cannot be deleted, so the tree always has somewhere to add.

```js
const createNode = (name, type) => ({
  id: crypto.randomUUID(),
  name,
  type,                                          // 'file' | 'folder'
  ...(type === 'folder' ? { childIds: [] } : {}),
});
```

---

## 5. Pass 1 — render the tree (target: 8 minutes)

Smallest demonstrable version: the seed on screen, correctly nested, at any depth. Note the prop —
`nodeId`, not `node`.

```jsx
function TreeNode({ nodeId, tree }) {
  const node = tree.nodes.get(nodeId);
  if (!node) return null;                        // deleted mid-render: render nothing, never throw

  return (
    <li>
      <span>{node.type === 'folder' ? '📁' : '📄'} {node.name}</span>
      {node.childIds && (
        <ul>
          {node.childIds.map((childId) => (
            <TreeNode key={childId} nodeId={childId} tree={tree} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function App() {
  const [tree] = useState(createInitialTree);
  return <ul><TreeNode nodeId={tree.rootId} tree={tree} /></ul>;
}
```

**Discuss while typing:**

- *Why recursion?* The component mirrors the data. One component handles depth 1 and depth 40; a
  hand-written nested `map` handles exactly the depth you wrote and breaks on the next one.
- *Why `key={childId}`?* With index keys, deleting the first of three siblings makes React reuse the
  wrong DOM node — the open inline editor jumps to a different row. Stable ids make reconciliation
  correct. In a normalised store the id is already the thing you are mapping over, so the right key
  is the obvious one.
- *Why the `if (!node) return null`?* In a normalised store a child id can outlive its node for one
  render. Rendering nothing is the correct, boring answer; throwing on a dangling id is how this
  design fails in production.
- **Indentation comes from the nesting** — nested `<ul>` with `padding-left`, not a `depth * 16px`
  inline style. The DOM then carries the hierarchy for screen readers too.

**Demonstrate before moving on:** the seed renders at three levels.

---

## 6. Pass 2 — expand/collapse (target: 6 minutes)

The mistake to name out loud and avoid: putting `isExpanded` on the node.

```js
// ✗ don't: { id, name, type, childIds, isExpanded }
```

It mixes UI state into domain data. Every save would persist it, every server response would fight
it, and collapsing a folder would mark the tree dirty. Keep a `Set` of open folder ids in the hook:

```js
const [expandedIds, setExpandedIds] = useState(
  () => new Set(collectFolderIds(initialTree))   // start fully open so the demo shows depth
);

function toggleFolder(id) {
  setExpandedIds((current) => {
    const next = new Set(current);       // copy: mutating the old Set keeps the same
    if (!next.delete(id)) next.add(id);  // reference and React skips the re-render
    return next;
  });
}
```

`Set` over an array: `has` is O(1) and is called once per rendered node, so an array turns each
render into O(n²). `next.delete(id)` returns a boolean, which makes toggle a single expression.

Collecting the folder ids is where normalisation quietly pays for the first time — no traversal:

```js
const collectFolderIds = (tree) =>
  [...tree.nodes.values()].filter((node) => node.type === 'folder').map((node) => node.id);
```

Render children only when open, and give the toggle `aria-expanded={isExpanded}`.

**Demonstrate:** collapse `src`, its whole subtree disappears; re-expand, it comes back.

---

## 7. Pass 3 — add file/folder: the algorithm section (target: 16 minutes)

This is the centre of the interview. The button is trivial; **locating the parent and producing the
next tree is what is being assessed.**

Let **n** = total nodes, **d** = depth of the target, **c** = children in the affected folder.

State the verdict before climbing, so nobody thinks you are stuck on rung one:

> "An edit has two halves — find the target, then produce a new tree containing the change. Every
> version below fixes one half. I'm building the last one, where both halves are cheap, and I'll say
> what it costs."

### V0 — flatten, scan, mutate

```js
function addNodeBrute(root, parentId, child) {
  const parent = flatten(root).find((node) => node.id === parentId);
  parent.children.push(child);   // mutation
  return { ...root };            // shallow copy to "tell React something changed"
}
```

`O(n)` time, `O(n)` extra space for the flattened array. It renders correctly, so name the three
faults and move on:

- **It mutates.** `parent.children.push` edits the object the previous state still points at. Any
  snapshot kept for undo is silently rewritten.
- **`{ ...root }` is a lie.** A shallow copy: every nested object is the same reference. It works
  only because React compares the top-level reference. Wrap a child in `React.memo` and the UI stops
  updating — a bug that surfaces weeks later during an optimisation pass.
- **The flatten allocates the whole tree** to find one node.

### V1 — recursive rebuild (`mapTree`)

One traversal that maps every node; returning `null` deletes, returning a new object replaces. Add,
rename and delete share one code path.

```js
function mapTree(node, fn) {
  const next = fn(node);
  if (!next) return null;              // null drops this node and its subtree
  if (!next.children) return next;
  return {
    ...next,
    children: sortNodes(next.children.map((child) => mapTree(child, fn)).filter(Boolean)),
  };
}
```

`O(n log n)` — every node is rebuilt and **every folder is re-sorted**, on every edit. This is the
version most candidates ship, so be precise about why it is not the answer: adding one file to a
5,000-node tree allocates 5,000 objects and performs thousands of string comparisons, and because
every object is new, `React.memo` cannot skip a single row. It is elegant and it scales badly on both
axes at once.

### V2 — DFS with early exit and path copying

Only the nodes from the root to the target actually change. Copy those; return untouched subtrees
**by reference**.

```js
const next = addNodeDfs(child, parentId, node);
if (next !== child) changed = true;    // reference inequality IS the change signal
```

Allocation drops to `O(d)`, and untouched subtrees stay reference-equal so `React.memo` skips them.
Search is still `O(n)` worst case, and each of the three operations now needs its own tailored
recursion. Half the problem solved, twice the code.

### V3 — normalised store ← **build this**

Delete the search entirely. Store the tree flat, keep the reverse edge, keep siblings sorted.

```js
// folders first, then files, each case-insensitive alphabetical. the ONE ordering rule.
const compareNodes = (a, b) =>
  a.type === b.type
    ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    : a.type === 'folder' ? -1 : 1;

// first index whose node is not ordered before `target` — O(log c) comparisons
function lowerBound(nodes, childIds, target) {
  let low = 0, high = childIds.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (compareNodes(nodes.get(childIds[mid]), target) < 0) low = mid + 1;
    else high = mid;
  }
  return low;
}

const insertAt = (childIds, at, id) => [...childIds.slice(0, at), id, ...childIds.slice(at)];

function addNode(tree, parentId, child) {
  const parent = tree.nodes.get(parentId);
  if (!parent?.childIds) return tree;               // files cannot contain anything

  const nodes = new Map(tree.nodes);                // shallow: pointer copies, no node rebuilt
  nodes.set(child.id, child);
  const at = lowerBound(nodes, parent.childIds, child);
  nodes.set(parentId, { ...parent, childIds: insertAt(parent.childIds, at, child.id) });

  const parentOf = new Map(tree.parentOf);
  parentOf.set(child.id, parentId);
  return { rootId: tree.rootId, nodes, parentOf };
}

function renameNode(tree, id, name) {
  const node = tree.nodes.get(id);
  if (!node) return tree;

  const renamed = { ...node, name };
  const nodes = new Map(tree.nodes);
  nodes.set(id, renamed);

  const parentId = tree.parentOf.get(id);
  if (parentId !== undefined) {                     // a rename can move the row: re-slot it
    const parent = nodes.get(parentId);
    const without = parent.childIds.filter((childId) => childId !== id);
    const at = lowerBound(nodes, without, renamed);
    nodes.set(parentId, { ...parent, childIds: insertAt(without, at, id) });
  }
  return { rootId: tree.rootId, nodes, parentOf: tree.parentOf };
}

function deleteNode(tree, id) {
  if (id === tree.rootId || !tree.nodes.has(id)) return tree;   // root always exists

  const nodes = new Map(tree.nodes);
  const parentOf = new Map(tree.parentOf);

  // the descendants MUST go too — dropping only the parent's edge leaks the whole subtree
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop();
    const node = nodes.get(current);
    if (!node) continue;
    if (node.childIds) stack.push(...node.childIds);
    nodes.delete(current);
    parentOf.delete(current);
  }

  const parentId = tree.parentOf.get(id);
  const parent = nodes.get(parentId);
  if (parent) {
    nodes.set(parentId, { ...parent, childIds: parent.childIds.filter((c) => c !== id) });
  }
  return { rootId: tree.rootId, nodes, parentOf };
}
```

Five things to say while typing it, in this order — they are what is being graded:

1. **Sorted on write, never on read.** `lowerBound` finds the slot in `O(log c)` comparisons. V1
   re-sorted every folder on every edit; this compares about 13 names for a 10,000-entry folder, once.
2. **The splice is still `O(c)`, and that is fine.** Moving pointers in an array is a memmove; the
   thing worth removing was the `O(c log c)` *string comparisons*, and that is what went.
3. **Rename re-slots.** Renaming `zebra.txt` to `alpha.txt` must move the row. Remove-then-insert is
   the whole implementation, and forgetting it is the most common bug in this question.
4. **Delete walks the subtree on purpose.** Say the leak out loud before the interviewer asks: in a
   normalised store, orphaned descendants are invisible — the UI looks right and memory grows.
5. **`new Map(tree.nodes)` copies pointers, not nodes.** Every untouched node keeps its identity, so
   `React.memo(NodeRow)` can skip it. Contrast with V1, where every node is a new object and memo is
   useless.

### V4 — mutable store behind `useSyncExternalStore` (discussed, not built)

The remaining cost is the `O(n)` pointer copy of the map per edit. Removing it means giving up
immutable snapshots: keep one mutable store, notify subscribers, and let each row subscribe to its
own id. Edits become `O(c)` with no copying at all, and only the rows that actually changed re-render.
That is roughly how a real editor's file tree works. The price is undo, time-travel and `React.memo`
by reference all stop being free. Say where the line is: **at 10⁴ nodes the pointer copy is
irrelevant; at 10⁶ it is the design.**

### Comparison

| | Find | Edit | Objects rebuilt | Sorting cost | Memo can skip? |
| --- | --- | --- | --- | --- | --- |
| V0 flatten + mutate | `O(n)` | `O(1)` mutate | 1 (shallow, lying) | none (unsorted) | no — **broken model** |
| V1 `mapTree` | `O(n)` | `O(n)` | `O(n)` | `O(n log c)` every edit | no |
| V2 DFS + path copy | `O(n)`, early exit | `O(d)` | `O(d)` | `O(c log c)` on one folder | yes, `n − d` rows |
| **V3 normalised** | **`O(1)`** | **`O(log c + c)`** | **2** | **`O(log c)`** | yes, all but 2 |
| V4 mutable + subscribe | `O(1)` | `O(c)` | 0 | `O(log c)` | n/a — per-row subscriptions |

**Why V3 wins:** the two halves of an edit were independent problems, and every earlier rung fixed
only one. V0 and V1 pay `O(n)` to *find*; V1 additionally pays `O(n)` to *rebuild*. V2 fixes the
rebuild and leaves the search. Normalising deletes the search by storing the answer (`nodes`,
`parentOf` are the index), and sorted insertion deletes the re-sort by keeping the invariant instead
of re-establishing it. What is left — copying `n` pointers — is the cheapest kind of `O(n)` there is,
one contiguous copy with no allocation per node.

**Where V3 costs you**, say both without being asked:

- **Deletes are manual.** The subtree walk exists only because the model does not nest.
- **Rendering has an extra hop**, and a component holding an id must tolerate that id vanishing.

### Wiring the buttons (short, once the algorithm is settled)

```js
function startCreate(parentId, type) {
  setError(null);
  setDraft({ mode: 'create', parentId, type, name: '' });
  setExpandedIds((ids) => new Set(ids).add(parentId));  // creating in a closed folder must open it
}
```

Auto-expanding the parent is the detail people skip: without it the user clicks "new file", the row
appears inside a collapsed folder, and nothing visibly happens.

**Demonstrate before moving on:** add a file at depth 3, it lands in sorted position; add a folder,
it sorts above the files.

---

## 8. Pass 4 — validation, rename, delete (target: 8 minutes)

Validation runs at commit, against the **parent's** children. With sorted siblings the duplicate
check is a binary search, not a scan:

```js
// two probes: a folder and a file with the same name live in different halves of the sorted array
function findChildNamed(tree, parentId, name) {
  const parent = tree.nodes.get(parentId);
  if (!parent?.childIds) return undefined;
  const trimmed = name.trim();

  for (const type of ['folder', 'file']) {
    const at = lowerBound(tree.nodes, parent.childIds, { id: '', name: trimmed, type });
    const hit = at < parent.childIds.length ? tree.nodes.get(parent.childIds[at]) : undefined;
    if (hit?.type === type &&
        hit.name.localeCompare(trimmed, undefined, { sensitivity: 'base' }) === 0) return hit;
  }
  return undefined;
}

const hasSiblingNamed = (tree, parentId, name, ignoreId) => {
  const hit = findChildNamed(tree, parentId, name);
  return hit !== undefined && hit.id !== ignoreId;
};

function validateName(tree, parentId, name, ignoreId) {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed.includes('/')) return 'Name cannot contain "/".';
  if (hasSiblingNamed(tree, parentId, trimmed, ignoreId)) return `"${trimmed}" already exists here.`;
  return null;
}
```

Two things to flag here:

- **The two probes are not paranoia.** One binary search finds a name only within its own type block;
  a file named `utils` would not be found by a probe that assumes folder. Getting this wrong lets a
  duplicate through in exactly one case, which is the kind of bug an interviewer probes for.
- **`ignoreId`**: renaming a node to its own current name must be allowed, colliding with a different
  sibling must not. Rename therefore needs the parent id — which is `tree.parentOf.get(id)`, `O(1)`,
  where the nested model needed a second full traversal.

Commit both modes through one function:

```js
function commitDraft() {
  if (!draft) return;
  const name = draft.name.trim();

  if (draft.mode === 'create') {
    if (!tree.nodes.has(draft.parentId)) return;
    const message = validateName(tree, draft.parentId, name);
    if (message) return setError(message);
    setTree(addNode(tree, draft.parentId, createNode(name, draft.type)));
  } else {
    const parentId = tree.parentOf.get(draft.nodeId);
    if (parentId === undefined) return;
    const message = validateName(tree, parentId, name, draft.nodeId);
    if (message) return setError(message);
    setTree(renameNode(tree, draft.nodeId, name));
  }

  setDraft(null);
  setError(null);
}
```

Delete: confirm **outside** the state updater.

```js
function removeNode(id) {
  const node = tree.nodes.get(id);
  if (!node) return;
  if (node.childIds?.length && !window.confirm(`Delete "${node.name}" and everything inside it?`)) return;

  setTree(deleteNode(tree, id));
  setExpandedIds((current) => { const next = new Set(current); next.delete(id); return next; });
  setDraft(null);
}
```

Say why: **React may call a state updater more than once** (Strict Mode in development, and
re-invocation during concurrent rendering). Updaters must be pure. A `confirm()` inside one shows the
dialog twice. Same rule for analytics calls and network requests.

Also drop the deleted id from `expandedIds` — otherwise the Set grows forever with ids of nodes that
no longer exist. It is the same leak as the orphaned descendants, one layer up.

---

## 9. Pass 5 — accessibility and polish (target: 6 minutes)

Cheap, and interviewers notice:

- `<ul role="tree">` at the root, `role="treeitem"` per node, `aria-expanded` on folders.
- Icon-only buttons need `aria-label={`Rename ${node.name}`}` — "✏️" reads as nothing.
- `NameInput`: `autoFocus`, select-all on rename, **Enter** commits, **Escape** cancels, blur cancels.
- Errors in `role="alert"` so they are announced, not just coloured red.
- The row is a `<button>` or has `onKeyDown`, not a `<div onClick>` — keyboard users need it.

`NameInput` owns no business state. It receives `draft.name` and calls the hook's handlers. Keep it
that way and rename/create stay one code path.

---

## 10. The single-file version — what you actually type

Everything above is the conversation. This is the code. In a real 45-minute slot you do not create
nine files — you talk through the structure, then build it top-to-bottom in `App.jsx` in the order
below, and say *"in a repo this splits into utils / hook / components along these comment banners."*

Assumes the CSS classes already exist. No styles here.

```jsx
import { useCallback, useState } from 'react';

/* ───────────── utils/file-tree.utils.js — pure, no React ───────────── */

const createNode = (name, type) => ({
  id: crypto.randomUUID(),
  name,
  type,
  ...(type === 'folder' ? { childIds: [] } : {}),
});

// folders first, then files, each case-insensitive alphabetical
const compareNodes = (a, b) =>
  a.type === b.type
    ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    : a.type === 'folder'
      ? -1
      : 1;

// O(log c): siblings are already sorted, so the slot is found, not searched for
function lowerBound(nodes, childIds, target) {
  let low = 0;
  let high = childIds.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (compareNodes(nodes.get(childIds[mid]), target) < 0) low = mid + 1;
    else high = mid;
  }
  return low;
}

const insertAt = (childIds, at, id) => [...childIds.slice(0, at), id, ...childIds.slice(at)];

const getNode = (tree, id) => tree.nodes.get(id);

const getParent = (tree, id) => {
  const parentId = tree.parentOf.get(id);
  return parentId === undefined ? undefined : tree.nodes.get(parentId);
};

function addNode(tree, parentId, child) {
  const parent = tree.nodes.get(parentId);
  if (!parent?.childIds) return tree;

  const nodes = new Map(tree.nodes);              // pointer copy: no node is rebuilt
  nodes.set(child.id, child);
  const at = lowerBound(nodes, parent.childIds, child);
  nodes.set(parentId, { ...parent, childIds: insertAt(parent.childIds, at, child.id) });

  const parentOf = new Map(tree.parentOf);
  parentOf.set(child.id, parentId);
  return { rootId: tree.rootId, nodes, parentOf };
}

function renameNode(tree, id, name) {
  const node = tree.nodes.get(id);
  if (!node) return tree;

  const renamed = { ...node, name };
  const nodes = new Map(tree.nodes);
  nodes.set(id, renamed);

  const parentId = tree.parentOf.get(id);
  if (parentId !== undefined) {                   // a rename can move the row
    const parent = nodes.get(parentId);
    const without = parent.childIds.filter((childId) => childId !== id);
    const at = lowerBound(nodes, without, renamed);
    nodes.set(parentId, { ...parent, childIds: insertAt(without, at, id) });
  }
  return { rootId: tree.rootId, nodes, parentOf: tree.parentOf };
}

function deleteNode(tree, id) {
  if (id === tree.rootId || !tree.nodes.has(id)) return tree;

  const nodes = new Map(tree.nodes);
  const parentOf = new Map(tree.parentOf);

  const stack = [id];                             // descendants must go too, or they leak
  while (stack.length > 0) {
    const current = stack.pop();
    const node = nodes.get(current);
    if (!node) continue;
    if (node.childIds) stack.push(...node.childIds);
    nodes.delete(current);
    parentOf.delete(current);
  }

  const parentId = tree.parentOf.get(id);
  const parent = nodes.get(parentId);
  if (parent) {
    nodes.set(parentId, { ...parent, childIds: parent.childIds.filter((c) => c !== id) });
  }
  return { rootId: tree.rootId, nodes, parentOf };
}

// two probes: a folder and a file of the same name sit in different halves of the sorted array
function findChildNamed(tree, parentId, name) {
  const parent = tree.nodes.get(parentId);
  if (!parent?.childIds) return undefined;
  const trimmed = name.trim();

  for (const type of ['folder', 'file']) {
    const at = lowerBound(tree.nodes, parent.childIds, { id: '', name: trimmed, type });
    const hit = at < parent.childIds.length ? tree.nodes.get(parent.childIds[at]) : undefined;
    if (hit?.type === type &&
        hit.name.localeCompare(trimmed, undefined, { sensitivity: 'base' }) === 0) return hit;
  }
  return undefined;
}

const hasSiblingNamed = (tree, parentId, name, ignoreId) => {
  const hit = findChildNamed(tree, parentId, name);
  return hit !== undefined && hit.id !== ignoreId;
};

const collectFolderIds = (tree) =>
  [...tree.nodes.values()].filter((node) => node.type === 'folder').map((node) => node.id);

const validateName = (tree, parentId, name, ignoreId) => {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed.includes('/')) return 'Name cannot contain "/".';
  if (hasSiblingNamed(tree, parentId, trimmed, ignoreId)) return `"${trimmed}" already exists here.`;
  return null;
};

function createInitialTree() {
  const root = createNode('root', 'folder');
  const src = createNode('src', 'folder');
  const components = createNode('components', 'folder');

  const seed = [
    [root.id, src],
    [src.id, components],
    [components.id, createNode('button.jsx', 'file')],
    [src.id, createNode('index.js', 'file')],
    [root.id, createNode('package.json', 'file')],
    [root.id, createNode('README.md', 'file')],
  ];

  // building the seed through addNode proves sorted insertion works before any UI exists
  return seed.reduce(
    (tree, [parentId, node]) => addNode(tree, parentId, node),
    { rootId: root.id, nodes: new Map([[root.id, root]]), parentOf: new Map() },
  );
}

/* ───────────── hooks/use-file-tree.js — all the state ───────────── */

function useFileTree() {
  const [tree, setTree] = useState(createInitialTree);
  const [expandedIds, setExpandedIds] = useState(() => new Set(collectFolderIds(tree)));
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const toggleFolder = useCallback((id) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const startCreate = useCallback((parentId, type) => {
    setError(null);
    setDraft({ mode: 'create', parentId, type, name: '' });
    setExpandedIds((current) => new Set(current).add(parentId)); // creating in a closed folder
  }, []);

  const startRename = useCallback((node) => {
    setError(null);
    setDraft({ mode: 'rename', nodeId: node.id, name: node.name });
  }, []);

  const changeDraftName = useCallback((name) => {
    setError(null);
    setDraft((current) => (current ? { ...current, name } : current));
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  const commitDraft = useCallback(() => {
    if (!draft) return;
    const name = draft.name.trim();

    if (draft.mode === 'create') {
      if (!tree.nodes.has(draft.parentId)) return;
      const message = validateName(tree, draft.parentId, name);
      if (message) return setError(message);
      setTree(addNode(tree, draft.parentId, createNode(name, draft.type)));
    } else {
      const parentId = tree.parentOf.get(draft.nodeId);   // O(1) — no second traversal
      if (parentId === undefined) return;
      const message = validateName(tree, parentId, name, draft.nodeId);
      if (message) return setError(message);
      setTree(renameNode(tree, draft.nodeId, name));
    }

    setDraft(null);
    setError(null);
  }, [draft, tree]);

  const removeNode = useCallback(
    (id) => {
      const node = tree.nodes.get(id);
      if (!node) return;
      // confirm OUTSIDE the updater: updaters must stay pure, they can run twice
      if (node.childIds?.length && !window.confirm(`Delete "${node.name}" and everything inside it?`))
        return;

      setTree(deleteNode(tree, id));
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setDraft(null);
      setError(null);
    },
    [tree],
  );

  return {
    tree, getNode: (id) => getNode(tree, id), expandedIds, draft, error,
    toggleFolder, startCreate, startRename, changeDraftName, commitDraft, cancelDraft, removeNode,
  };
}

/* ───────────── components ───────────── */

function NameInput({ value, placeholder, onChange, onCommit, onCancel }) {
  return (
    <input
      className="explorer__input"
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onCommit();
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}

function NodeRow({ node, isExpanded, tree }) {
  const { draft, toggleFolder, startCreate, startRename, changeDraftName, commitDraft, cancelDraft, removeNode } = tree;
  const isFolder = node.type === 'folder';
  const isRenaming = draft?.mode === 'rename' && draft.nodeId === node.id;

  if (isRenaming) {
    return (
      <div className="explorer__row">
        <NameInput
          value={draft.name}
          placeholder="New name"
          onChange={changeDraftName}
          onCommit={commitDraft}
          onCancel={cancelDraft}
        />
      </div>
    );
  }

  return (
    <div className="explorer__row">
      <button
        className="explorer__label"
        onClick={() => isFolder && toggleFolder(node.id)}
        aria-expanded={isFolder ? isExpanded : undefined}
      >
        {isFolder ? (isExpanded ? '▾' : '▸') : ' '} {isFolder ? '📁' : '📄'} {node.name}
      </button>

      <span className="explorer__actions">
        {isFolder && (
          <>
            <button aria-label={`New file in ${node.name}`} onClick={() => startCreate(node.id, 'file')}>＋📄</button>
            <button aria-label={`New folder in ${node.name}`} onClick={() => startCreate(node.id, 'folder')}>＋📁</button>
          </>
        )}
        <button aria-label={`Rename ${node.name}`} onClick={() => startRename(node)}>✏️</button>
        <button aria-label={`Delete ${node.name}`} onClick={() => removeNode(node.id)}>🗑️</button>
      </span>
    </div>
  );
}

// takes an ID, not a node — resolving through the store is what keeps rows from going stale
function TreeNode({ nodeId, tree }) {
  const { draft, expandedIds, changeDraftName, commitDraft, cancelDraft } = tree;
  const node = tree.getNode(nodeId);
  if (!node) return null;

  const isExpanded = expandedIds.has(node.id);
  const isCreatingHere = draft?.mode === 'create' && draft.parentId === node.id;

  return (
    <li className="explorer__node">
      <NodeRow node={node} isExpanded={isExpanded} tree={tree} />

      {node.type === 'folder' && isExpanded && (
        <ul className="explorer__children">
          {isCreatingHere && (
            <li className="explorer__node">
              <div className="explorer__row">
                <NameInput
                  value={draft.name}
                  placeholder={draft.type === 'folder' ? 'New folder name' : 'New file name'}
                  onChange={changeDraftName}
                  onCommit={commitDraft}
                  onCancel={cancelDraft}
                />
              </div>
            </li>
          )}
          {node.childIds?.map((childId) => (
            <TreeNode key={childId} nodeId={childId} tree={tree} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function App() {
  const tree = useFileTree();

  return (
    <section className="explorer">
      <h1>File Explorer</h1>
      {tree.error && <p className="explorer__error" role="alert">{tree.error}</p>}
      <ul className="explorer__tree" role="tree">
        <TreeNode nodeId={tree.tree.rootId} tree={tree} />
      </ul>
    </section>
  );
}
```

**Build it in this order:** `createNode` + `compareNodes` + `lowerBound` + `addNode` → `createInitialTree`
built *through* `addNode` (the seed is your first test) → `TreeNode` recursion over `childIds` (tree on
screen) → `expandedIds` → the create draft → validation → rename → delete.

The two lines to narrate because they are what the question is really testing: `lowerBound` — *"sorted
on write, so render never sorts"* — and the `while (stack.length)` loop in `deleteNode` — *"in a
normalised store the descendants don't leave on their own."*

## 11. Verification

```bash
node src/projects/file-explorer/utils/file-tree.utils.check.ts
```

(Prints `file-tree.utils: all checks passed`.)

Demo script — run it in this order:

1. Add a file at depth 3; it appears in sorted position, and the folder auto-expands.
2. Add a folder named `alpha`; folders sort above files.
3. Rename `zebra.txt` → `alpha.txt`; the row **moves** — proves rename re-slots, not just relabels.
4. Reject: empty name, `a/b`, a duplicate sibling, and a file named after an existing folder.
5. Delete a file (no prompt), delete a populated folder (prompt, whole subtree goes).
6. Try to delete the root: nothing happens, by design.
7. Collapse/expand; press Escape mid-edit.

---

## 12. Cross-questions and answers

**"Why normalise? The nested tree is simpler."**
Simpler to read, more expensive on both halves of every operation. Nested costs `O(n)` to find a node
and `O(n)` to rebuild after; normalised is `O(1)` and one folder. The decisive one is not speed
though — it is that the nested model has no answer for "who is this node's parent" without a second
full traversal, and rename, move and drag-and-drop all need it.

**"What did normalising cost you?"**
Two things, both real: deleting a subtree is manual (the walk in `deleteNode`), and a component
holding an id must handle that id disappearing. The `if (!node) return null` in `TreeNode` is that
cost, paid in one line.

**"Isn't `new Map(tree.nodes)` still O(n) per edit?"**
Yes — and it is the cheapest `O(n)` available: a contiguous copy of `n` pointers with no per-node
allocation, versus V1's `n` object allocations plus `O(n log c)` string comparisons. If it ever
mattered, the fix is V4: a mutable store with per-row subscriptions via `useSyncExternalStore`, which
trades away free undo and reference-based memoisation.

**"Why not put `isExpanded` on the node?"**
It is view state. In the data it gets persisted, overwritten by every server response, and makes
collapsing a folder look like an edit. Two users viewing the same tree also need different expansion
states — impossible if it lives in shared data.

**"How would drag-and-drop move work?"**
Splice the id out of the old parent's `childIds`, `lowerBound`-insert into the new parent's, and
update `parentOf` — three `O(c)` writes, no subtree touched, because the descendants never referenced
their ancestors' positions. The critical guard: reject a drop into the node's own descendant subtree,
or you detach a cycle and lose it. Walk up from the target with `parentOf` — `O(d)`. This operation is
the single strongest argument for the normalised model.

**"Add undo."**
Keep `past` and `future` arrays of trees. Every mutation pushes the previous tree; because nothing
mutates, a snapshot is one reference and the two maps share every unchanged node.

**"Add search/filter."**
Keep a node if it matches or any descendant matches — a bottom-up pass, `f(node) = match(node) || any
f(child)`, which is a genuine tree DP: each node's answer is computed from its children's, once. Cache
it in a `WeakMap` keyed by the node object; structural sharing means only the changed path misses the
cache after an edit. Derive the folders to auto-expand from the result rather than writing into
`expandedIds`, so clearing the search restores the user's own expansion state.

**"What changes with a real backend?"**
Children load lazily per folder, so each node needs `childrenLoaded` / `isLoading` — which the
normalised store holds naturally, as a field on the folder node. Writes become optimistic with
rollback. Ids come from the server, so a created node needs a temporary id reconciled on response.
Names collide server-side too — client validation becomes a UX nicety, not the guarantee.

**"10,000 nodes?"**
Virtualise: flatten the *visible* (expanded) rows into a linear array and render only the window.
That flattening is a walk over `childIds` from the root, cut off at collapsed folders — cheap in this
model, and the reason virtualisation is an incremental change here rather than a rewrite.
