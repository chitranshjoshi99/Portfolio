# Todos by User (Karat) — Interview Build Guide

Fetch todos from a paginated API, show one block per user with the `userId` as the block title and that
user's todos inside, load 20 at a time, let the user tick and edit todos with the edits saved locally, and
never let fetched text become markup. **Vanilla JavaScript — no framework** — because this is the Karat
screen, where React is not allowed. Target 20–25 minutes (it is one of three parts of a 60-minute screen).

This is the most repeated Atlassian Karat task. Reported verbatim: *"Given an API returning a list of
todos, fetch the list, create a separate block for each user, and display their todos in the appropriate
block. Use `https://dummyjson.com/todos?limit=10&skip=80` … Each block should contain the userId as the
title of the block and the list of todos."* Variants: *"fetch todos from an API and render 20 at a time"*,
*"vanilla JS fetching and manipulating the DOM to edit and save the fetched data (locally)"*, *"call an API
and build a todo list with vanilla JS"*, *"show task list"*, *"fetch data and display task and sub tasks,
sort by status"*, *"build a UI to list and update tasks"*. It is usually preceded by the security question
this guide also answers: *"Can you find a security issue in `const data = await fetch("api"); div.innerHTML
= data`?"*

The Karat IDE has no autocomplete, no formatter, no hot reload and the interviewer will not help. The
guide optimises for **typing little and being right first time**.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Grouping | **A `Map` keyed by `userId`**, filled in one pass. Not a plain object: integer-like keys iterate in ascending numeric order, not arrival order. |
| Pagination | `limit=20&skip=n`, append each page into the existing groups instead of regrouping everything. |
| DOM | `createElement` + `textContent` only. One `DocumentFragment` per page. One delegated listener. A `Map` from id → row for `O(1)` updates. |
| Local edits | Store **patches** (`{ [id]: { completed, todo } }`) in `localStorage`, merged over server rows — the server copy stays pristine. |
| Discussed, not built | Infinite scroll (`IntersectionObserver`), virtualisation, real PATCH requests with optimistic rollback. |

**Minute budget (inside a Karat hour)**

| Time | Phase |
| --- | --- |
| 0–2 | Read the prompt aloud, state assumptions |
| 2–8 | `fetch` + group + render blocks (the graded minimum) |
| 8–12 | Pagination (20 at a time) |
| 12–18 | Toggle + edit + save locally |
| 18–22 | Loading / error / empty states, the XSS answer |
| 22–25 | Say what you'd do with more time |

---

## 0. Sandbox setup

Karat gives you HTML, CSS and JS panes. Only one element in HTML:

```html
<div id="app"></div>
```

Everything else is created from JS so there is nothing to keep in sync between panes.

This repo's version is React (the rest of the app is React) and mirrors the same pieces:

```text
karat-todos/
  index.tsx                            # toolbar, meta line, blocks, load more
  karat-todos.types.ts                 # Todo, TodoPage (dummyjson envelope), UserGroup, PatchMap
  karat-todos.css
  constants/karat-todos.constants.ts   # PAGE_SIZE, STORAGE_KEY, API_URL, dataset text, the hostile row
  utils/todos.utils.ts                 # pure: groupByUser, groupByUserNested (oracle), appendToGroups,
                                       #       applyPatch, setPatch, sortByStatus, buildTodoUrl, escapeHtml
  utils/todos.utils.check.ts
  utils/todo-api.ts                    # same envelope as dummyjson, abortable, failNext switch
  utils/todo-storage.ts                # load/save patches, try/catch
  hooks/use-todos.ts                   # pages, patches, status, one in-flight request
  components/user-block.tsx
  components/todo-row.tsx
```

---

## 1. Requirement gathering (2 minutes — Karat will not answer much, so state defaults)

1. **"Block order — by userId, or in the order users first appear?"**
   The trap question. A plain object sorts integer keys; a `Map` keeps arrival order.
   *Default: first-appearance order (it is what "display in the appropriate block" reads as).*
2. **"How many at a time?"** *Default: 20, via `limit`/`skip`; a Load more button.*
3. **"Edits — sent to the server or saved locally?"**
   dummyjson does not persist writes. *Default: saved to `localStorage`, re-applied on reload.*
4. **"Completed items — sorted, styled, or hidden?"** *Default: struck through; sort open-first as a toggle.*
5. **"What if the request fails?"** *Default: an error line with Retry; already-loaded todos stay.*
6. **"Any constraint on DOM APIs?"** *Default: no `innerHTML` with data.*

Say the plan:

> "One fetch per page with `limit` and `skip`. I group each page into a `Map` of userId to block, creating
> a block the first time a user appears and appending rows to existing blocks after that. Everything is
> built with `createElement` and `textContent`, into a fragment, so a page is one DOM insertion. One
> delegated listener handles ticks and edits. Edits are stored as patches in localStorage."

---

## 2. High-level design (HLD)

```text
 click "Load 20 more" ─┐
 page load ────────────┤
                       ▼
            fetch(`${API}?limit=20&skip=${skip}`)  ── AbortController, one in flight
                       │ {todos, total, skip, limit}
                       ▼
            for each todo:  applyPatch(todo, patches)
                       │
         groups: Map<userId, { section, list }>
            ├─ has userId?  → list.append(row)
            └─ new userId   → section + h2(userId) + ul → fragment
                       │
            blocks.append(fragment)          ← one insertion per page
                       │
            rows: Map<id, li>                ← O(1) update after a tick/edit
                       │
 #blocks  ◀── one 'change' + one 'click' + one 'keydown' listener (delegation)
                       │
            patches ──▶ localStorage (only what differs from the server)
```

Claims to make:

- **`textContent` is the XSS fix.** Fetched strings are data. `innerHTML` parses them as HTML, so a todo
  of `<img src=x onerror=...>` runs code. Escaping works too, but `textContent` cannot be forgotten on one
  field.
- **Delegation.** Rows come and go with pagination; one listener on the container never needs rebinding.
- **Patches, not copies.** Store only what the user changed. A refetch never overwrites an edit and a
  reverted edit leaves nothing behind.
- **One insertion per page.** Appending 20 rows one by one to the live DOM can cause 20 layouts; a
  fragment is one.

---

## 3. Low-level design (LLD)

### State (vanilla — one plain object)

```js
const state = {
  skip: 0,                 // next page offset
  total: null,             // from the envelope; null until the first response
  loading: false,          // guards double-clicks on Load more
  groups: new Map(),       // userId -> { section, list, count }
  rows: new Map(),         // todo id -> <li>
  server: new Map(),       // todo id -> the server copy (never edited)
  patches: loadPatches(),  // id -> { completed?, todo? } — mirrored to localStorage
};
```

### Pure function signatures

```js
buildTodoUrl(base, limit, skip)        -> string
groupByUserNested(todos)               -> [{ userId, todos }]   // O(U·N) oracle
groupByUser(todos)                     -> [{ userId, todos }]   // O(N), Map, arrival order
appendToGroups(groups, page)           -> groups                 // O(page + groups), copies only touched groups
applyPatch(todo, patches)              -> todo                   // same object when unpatched
setPatch(patches, original, change)    -> patches                // drops fields equal to the server value
sortByStatus(todos)                    -> todos                  // stable: open first
escapeHtml(text)                       -> string                 // only for the "must use innerHTML" follow-up
```

---

## 4. The data model

The envelope, exactly as dummyjson returns it:

```json
{
  "todos": [
    { "id": 81, "todo": "Do something nice for someone I care about", "completed": true, "userId": 26 },
    { "id": 82, "todo": "Memorize a poem", "completed": false, "userId": 3 }
  ],
  "total": 254,
  "skip": 80,
  "limit": 10
}
```

`total` is what tells you when to hide *Load more* — don't guess from "the page came back short".

Local edits:

```json
{ "81": { "completed": false }, "82": { "todo": "Memorise two poems" } }
```

**Fork — object or Map for the groups?**

| | `{}` keyed by userId | `new Map()` |
| --- | --- | --- |
| Iteration order | **integer keys ascending**, then strings | insertion order |
| `{26:…, 3:…}` iterates as | `3, 26` | `26, 3` |
| Key type | coerced to string | kept as number |
| Size | `Object.keys(o).length` | `map.size` |

Both are `O(1)` per operation. The Map is chosen for order, and say so — this is the detail a Karat grader
notices.

---

## 5. Pass 1 — fetch, group, render (target: 6 minutes)

### 5.1 Ladder A — grouping

#### A0 — filter once per user (the oracle)

```js
const userIds = [...new Set(todos.map((t) => t.userId))];
const groups = userIds.map((userId) => ({ userId, todos: todos.filter((t) => t.userId === userId) }));
```

`O(U · N)`. Fine for 10 todos, and it is the version to diff against.

#### A1 — one pass into a Map

```js
function groupByUser(todos) {
  const groups = new Map();
  for (const todo of todos) {
    if (!groups.has(todo.userId)) groups.set(todo.userId, []);
    groups.get(todo.userId).push(todo);
  }
  return [...groups].map(([userId, list]) => ({ userId, todos: list }));
}
```

`O(N)`. Correct for one page.

#### A2 — append each page into existing groups ← **build this**

With pagination, regrouping everything loaded so far on every page is `O(loaded)` per click, and in the
DOM version it means rebuilding every block. Instead, keep the groups and fold each page in:

```js
for (const todo of page) {
  let group = state.groups.get(todo.userId);
  if (!group) { group = createBlock(todo.userId); state.groups.set(todo.userId, group); fragment.append(group.section); }
  group.list.append(renderRow(todo));
}
```

| Rung | Per page | Rebuilds old blocks | Keeps arrival order |
| --- | --- | --- | --- |
| A0 filter per user | `O(U · N)` | yes | yes |
| A1 Map, regroup all | `O(loaded)` | yes | yes |
| **A2 fold into existing** | **`O(page)`** | **no** | **yes** |

What changed: the work per click stopped depending on how much was already loaded. With 20 rows per page
the numbers are small; the reason to do it is that a rebuild also destroys focus, scroll position and any
open edit field in the blocks you rebuilt.

### 5.2 Ladder B — rendering

| Rung | Safe from XSS | Cost of one tick | Keeps focus/scroll |
| --- | --- | --- | --- |
| B0 build an HTML string, `innerHTML =` | **no** | re-render everything | no |
| B1 `createElement` + `textContent`, re-render all | yes | re-render everything | no |
| **B2 build once, update one row by id** | **yes** | **`O(1)` via `rows.get(id)`** | **yes** |

Ship B2: rows are created once per page and a tick touches exactly one `<li>`.

---

## 6. Pass 2 — 20 at a time (target: 4 minutes)

```js
async function loadMore() {
  if (state.loading || (state.total !== null && state.skip >= state.total)) return;
  state.loading = true;
  setStatus('Loading…');
  try {
    const response = await fetch(`${API}?limit=${PAGE}&skip=${state.skip}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { todos, total } = await response.json();
    state.total = total;
    state.skip += todos.length;
    renderPage(todos);
    setStatus(`${state.skip} of ${total}`);
  } catch (error) {
    setStatus(`Could not load todos (${error.message}).`, true);   // keep what is already shown
  } finally {
    state.loading = false;
    more.hidden = state.total !== null && state.skip >= state.total;
  }
}
```

Two things interviewers check: `response.ok` (fetch only rejects on network failure, not on 500), and the
`loading` guard (two fast clicks must not load the same page twice).

---

## 7. Pass 3 — toggle, edit, save locally (target: 6 minutes)

```js
blocks.addEventListener('change', (event) => {
  if (!event.target.matches('input[type=checkbox]')) return;
  const id = Number(event.target.closest('li').dataset.id);
  updateTodo(id, { completed: event.target.checked });
});

function updateTodo(id, change) {
  state.patches = setPatch(state.patches, state.server.get(id), change);
  savePatches(state.patches);
  paintRow(state.rows.get(id), applyPatch(state.server.get(id), state.patches));   // O(1)
}
```

Edit in place: clicking *Edit* swaps the text `<span>` for an `<input>` with the current value; Enter saves,
Escape cancels, empty text counts as cancel. Only one row edits at a time.

Why patches: if you save the whole list, a later refetch either overwrites the user's edits or you have to
merge two full copies. Storing only the diff makes the merge `{ ...server, ...patch }`.

---

## 8. The security question — say this answer

```js
const data = await fetch('api');
const div = document.getElementById('todo');
div.innerHTML = data;
```

Three bugs, in order of severity:

1. **XSS.** `innerHTML` parses the string as HTML. A response containing `<img src=x onerror="…">` executes
   script in your origin (cookies, tokens, actions as the user). `<script>` tags inserted via `innerHTML`
   do not run, but event-handler attributes do.
2. `fetch` returns a `Response`, not data — `innerHTML = data` writes `"[object Response]"`. You need
   `await response.json()` (or `.text()`), and `response.ok` checked.
3. No error handling — a failure is an unhandled rejection and an empty div.

Fix: `div.textContent = text`, or build elements with `createElement` + `textContent`. If HTML is genuinely
required (rich text), sanitise with a vetted allow-list sanitiser (DOMPurify) and set a Content-Security-
Policy that forbids inline handlers; never hand-roll a regex sanitiser. `escapeHtml` is the minimum if you
are forced to build a string.

---

## 9. The single-file version — what you actually type

Vanilla JS, one file, `<div id="app"></div>` in the HTML pane. No styles.

```js
/* ───────────── constants.js ───────────── */

const API = 'https://dummyjson.com/todos';
const PAGE = 20;
const STORAGE_KEY = 'todo-patches';

/* ───────────── utils/todos.utils.js — pure ───────────── */

const applyPatch = (todo, patches) => (patches[todo.id] ? { ...todo, ...patches[todo.id] } : todo);

function setPatch(patches, original, change) {
  const merged = { ...patches[original.id], ...change };
  for (const key of Object.keys(merged)) if (merged[key] === original[key]) delete merged[key];
  const next = { ...patches };
  if (Object.keys(merged).length === 0) delete next[original.id];
  else next[original.id] = merged;
  return next;
}

/* ───────────── utils/todo-storage.js ───────────── */

function loadPatches() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function savePatches(patches) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(patches)); } catch { /* private mode */ }
}

/* ───────────── state.js ───────────── */

const state = {
  skip: 0,
  total: null,
  loading: false,
  editingId: null,
  groups: new Map(),   // userId -> { section, list, count }  (Map: keeps first-seen order)
  rows: new Map(),     // id -> <li>
  server: new Map(),   // id -> server todo, never edited
  patches: loadPatches(),
};

/* ───────────── dom/elements.js ───────────── */

const app = document.getElementById('app');
const status = document.createElement('p');
status.setAttribute('role', 'status');
const blocks = document.createElement('div');
const more = document.createElement('button');
more.textContent = `Load ${PAGE} more`;
app.append(status, blocks, more);

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;   // textContent, never innerHTML
  if (className) node.className = className;
  return node;
}

function setStatus(text, isError = false) {
  status.textContent = text;
  status.className = isError ? 'error' : '';
}

/* ───────────── dom/render.js ───────────── */

function createBlock(userId) {
  const section = el('section', undefined, 'block');
  const heading = el('h2', `User ${userId}`);
  const list = el('ul');
  section.append(heading, list);
  return { section, list, count: 0 };
}

function paintRow(li, todo) {
  li.replaceChildren();
  const box = el('input');
  box.type = 'checkbox';
  box.checked = todo.completed;
  box.setAttribute('aria-label', `Done: ${todo.todo}`);
  const text = el('span', todo.todo, todo.completed ? 'done' : '');
  const edit = el('button', 'Edit', 'edit');
  li.append(box, text, edit);
  if (todo.id in state.patches) li.append(el('small', 'edited'));
}

function renderRow(todo) {
  const li = el('li');
  li.dataset.id = todo.id;
  paintRow(li, applyPatch(todo, state.patches));
  state.rows.set(todo.id, li);
  return li;
}

function renderPage(todos) {
  const fragment = document.createDocumentFragment();   // one insertion per page
  for (const todo of todos) {
    state.server.set(todo.id, todo);
    let group = state.groups.get(todo.userId);
    if (!group) {
      group = createBlock(todo.userId);
      state.groups.set(todo.userId, group);
      fragment.append(group.section);                   // new block goes to the end, in arrival order
    }
    group.list.append(renderRow(todo));                 // existing block: append in place
  }
  blocks.append(fragment);
}

/* ───────────── actions.js ───────────── */

function updateTodo(id, change) {
  state.patches = setPatch(state.patches, state.server.get(id), change);
  savePatches(state.patches);
  paintRow(state.rows.get(id), applyPatch(state.server.get(id), state.patches)); // O(1), one row
}

function startEdit(id) {
  if (state.editingId !== null) paintRow(state.rows.get(state.editingId), applyPatch(state.server.get(state.editingId), state.patches));
  state.editingId = id;
  const li = state.rows.get(id);
  const current = applyPatch(state.server.get(id), state.patches);
  const input = el('input');
  input.value = current.todo;
  input.className = 'edit-input';
  li.querySelector('span').replaceWith(input);
  input.focus();
}

function finishEdit(id, text) {
  state.editingId = null;
  const trimmed = text.trim();
  if (trimmed) updateTodo(id, { todo: trimmed });      // empty = cancel
  else paintRow(state.rows.get(id), applyPatch(state.server.get(id), state.patches));
}

async function loadMore() {
  if (state.loading || (state.total !== null && state.skip >= state.total)) return;
  state.loading = true;
  more.disabled = true;
  setStatus('Loading…');
  try {
    const response = await fetch(`${API}?limit=${PAGE}&skip=${state.skip}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);   // fetch doesn't reject on 500
    const { todos, total } = await response.json();
    state.total = total;
    state.skip += todos.length;
    renderPage(todos);
    setStatus(`${state.skip} of ${total} todos · ${state.groups.size} users`);
  } catch (error) {
    setStatus(`Could not load todos (${error.message}). Click to retry.`, true);
  } finally {
    state.loading = false;
    more.disabled = false;
    more.hidden = state.total !== null && state.skip >= state.total;
  }
}

/* ───────────── index.js — wiring (one listener per event type) ───────────── */

blocks.addEventListener('change', (event) => {
  if (!event.target.matches('input[type=checkbox]')) return;
  updateTodo(Number(event.target.closest('li').dataset.id), { completed: event.target.checked });
});

blocks.addEventListener('click', (event) => {
  if (!event.target.matches('button.edit')) return;
  startEdit(Number(event.target.closest('li').dataset.id));
});

blocks.addEventListener('keydown', (event) => {
  if (!event.target.matches('input.edit-input')) return;
  const id = Number(event.target.closest('li').dataset.id);
  if (event.key === 'Enter') finishEdit(id, event.target.value);
  if (event.key === 'Escape') finishEdit(id, '');
});

more.addEventListener('click', loadMore);
status.addEventListener('click', () => { if (status.className === 'error') loadMore(); });

loadMore();
```

**Build it in this order:** `fetch` + `console.log(data)` (prove the shape) → `renderPage` with the Map and
`textContent` (the graded part — stop here if the clock says so) → `limit`/`skip` + Load more + the
`loading` guard → checkbox via delegation + `paintRow` → patches in `localStorage` → edit in place →
error line.

Narrate two lines, because they are what the screen is checking: `node.textContent = text` — *"data never
goes through the HTML parser"* — and `new Map()` for groups — *"an object would reorder numeric user ids."*

---

## 10. Verification

```bash
node src/projects/karat-todos/utils/todos.utils.check.ts
```

It proves: groups come back in arrival order (and that a plain object would *not* — asserted directly);
`groupByUser` agrees with the `O(U·N)` oracle on 200 random lists; paging through with `appendToGroups`
equals grouping everything at once, and untouched groups keep their identity; patches drop fields set back
to the server value; sort is stable; `escapeHtml` escapes `&` first.

Demo script (the React page):

1. Load → 20 todos, blocks titled `User 28`, `User 7`, … in arrival order.
2. Find the row `<img src=x onerror=…> check the attachment` — it shows as text; no `<img>` exists in the
   list (`document.querySelectorAll('.kt__grid img').length === 0`).
3. Tick a todo → struck through, `edited` badge, localStorage has `{"1":{"completed":false}}`.
4. Untick it → badge gone, storage key removed.
5. Load 20 more → existing blocks grow in place, new users appended at the end.
6. *Fail next request* → Load more → error line with Retry; the 40 loaded todos stay.
7. Reload → edits re-applied from storage.

---

## 11. Cross-questions and answers

**"Why not `innerHTML` with template literals — it's shorter?"**
Because the data is not yours. It is shorter until one field contains markup. `textContent` is the same
length per field and makes the unsafe version impossible to write by accident.

**"Render 10 000 todos."**
Pagination already bounds it. If they must all be on one page: virtualise (render only the rows in view,
spacer elements for the rest), and group headers become sticky rows in the virtual list.

**"Infinite scroll instead of a button."**
An `IntersectionObserver` on a sentinel element after the list calls `loadMore()`; the same `loading`
guard stops duplicate loads. Keep a button as a fallback for keyboard users and when the observer isn't
available.

**"Send the edits to the server."**
`PATCH /todos/:id` with the patch. Optimistic: paint first, send, on failure restore the previous patch and
show the error on the row. Keep the local patch until the server confirms, then drop it (the server copy now
matches).

**"Sort each block by status."**
`sortByStatus` is a stable sort, so server order survives inside open and done. In the DOM version, re-append
the rows of one block in the new order — `append` moves an existing node, it does not clone it.

**"How would you test this without a browser?"**
The grouping, patch and URL logic are pure functions — the check file runs them in Node. DOM behaviour with
jsdom/Testing Library: stub `fetch`, click Load more twice quickly, assert one request.

**"Why a DocumentFragment?"**
Appending 20 elements to the live DOM can trigger style/layout work per insertion; appending them to a
fragment and inserting the fragment once batches it into one. With modern engines the gain is modest, but it
also keeps half-rendered pages from being visible.

**"`loading` flag vs AbortController?"**
Different jobs. The flag prevents starting a second request; abort cancels one that is no longer wanted
(navigating away, changing a filter). The React version uses both.
