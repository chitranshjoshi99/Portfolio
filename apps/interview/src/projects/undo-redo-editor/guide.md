# Undo / Redo Editor — Interview Build Guide

Build a notes editor where **every** change is undoable: typing, colour, pin, reorder, add, delete — with
`Cmd/Ctrl+Z` and `Shift+Cmd+Z` working everywhere, including inside the text fields. The visible feature is
two buttons. The question is a data-structure question: what goes on the stack, when two edits become one
entry, and what happens to the redo branch. Plain JavaScript, fresh sandbox, 45 minutes.

Reported at Atlassian as: *"implement undo/redo for this editor"*, *"how would you add undo to the board
you just built?"*, and as the follow-up that turns into the collaboration question — *"now two people are
editing, whose undo is it?"*

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: what is undoable, how far back, whose undo |
| 5–12 | The reducer, immutably, with no-op detection |
| 12–22 | **The history ladder**: snapshots → coalescing → patches |
| 22–30 | The two stacks, the discarded branch, the bound |
| 30–38 | Shortcuts (including inside inputs), labels, the history panel |
| 38–45 | Collaboration, persistence, cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
undo-redo-editor/
  index.tsx                        # list, editor pane, history panel, toolbar
  undo-redo-editor.types.ts        # Note, EditorState, EditorAction, HistoryEntry, History
  undo-redo-editor.css
  constants/notes.ts               # three seeded notes, colours
  utils/editor.utils.ts            # editorReducer, labelFor, mergeKeyFor, commit, undo, redo, shortcutFor
  utils/editor.check.ts
  hooks/use-editor.ts              # ONE useState holding { state, history }
```

---

## 1. Requirement gathering (5 minutes)

1. **"What counts as undoable?"** The question that shapes the stack. *Default: document changes only —
   selection, scroll position and which panel is open are not steps.*
2. **"Is typing one undo per character?"** *Default: no. A burst of typing is one entry; a pause starts a
   new one.*
3. **"How far back?"** *Default: bounded — 60 entries — so a long session cannot grow without limit.*
4. **"After undoing, if the user edits, is redo still available?"** *Default: no. The branch they did not
   take is discarded, which is what every editor does.*
5. **"Does undo move the cursor / selection?"** *Default: keep the live selection where it still points at
   something; do not teleport the user.*
6. **"Single user?"** *Default: yes — and say what changes when it is not, because that is the follow-up.*
7. **"Persisted across a reload?"** *Default: the document yes, the history no.*

Plan in one breath:

> "One reducer produces the next document, and one commit function decides whether that change is a new
> history entry or merges into the last one. The stack holds snapshots of before and after plus a label,
> which is cheap here and trivially correct; I would move to inverse patches when the document is large.
> Undo pops from past to future, redo the other way, and any new edit clears the future."

---

## 2. High-level design (HLD)

```text
  every user action ──▶ run(action)
                          │
                 editorReducer(state, action)
                          │
              next === state ?  ──yes──▶ nothing happened: no state change, no history
                          │ no
              isUndoable(action) ? ──no──▶ (selection) new state, history untouched
                          │ yes
         commit(history, { label, before, after, mergeKey }, now)
                          │
        mergeKey matches last entry AND within 700ms ?
            ├── yes ──▶ rewrite last.after   (the burst stays ONE undo)
            └── no  ──▶ push entry, drop oldest past 60, future = []
                          │
   { state, history }  ── ONE useState ──▶ undo(): state = past.top.before
                                           redo(): state = future.top.after
```

Four claims:

- **The document and the history are one value.** Two `useState`s mean an undo writes one from inside the
  other's updater, and after two fast `Cmd+Z`s they disagree about where they are. One atom, one
  transition, no ordering bug.
- **The reducer returns the *same object* when nothing changed.** That identity check is what keeps a
  re-typed identical value, a no-op move, and a click on the already-selected colour out of the history.
- **Coalescing is a rule about the edit, not about time alone.** Same kind + same field + same note +
  inside the window. Change any of those and the burst breaks — which is exactly what a user expects.
- **Undo restores the document, not the view.** The selection is taken from the live state where it still
  resolves, so undoing an edit made ten minutes ago does not yank the user to that note.

---

## 3. Low-level design (LLD)

```js
const [editor, setEditor] = useState({ state: INITIAL_STATE, history: { past: [], future: [] } });
```

```js
editorReducer(state, action)   -> EditorState          // pure; same object when nothing changed
labelFor(action)               -> 'typing' | 'delete note' | …   // what the menu says
mergeKeyFor(action)            -> 'body:n1' | null     // null = never merge
isUndoable(action)             -> boolean              // selection is false
commit(history, entry, { now, coalesceMs }) -> History // merge or push, clear future, bound the stack
undo(history, state)           -> { history, state }
redo(history, state)           -> { history, state }
shortcutFor(event)             -> 'undo' | 'redo' | null
```

A history entry:

```js
{ label: 'typing', before: EditorState, after: EditorState, mergeKey: 'body:n1', at: 1774003912345 }
```

---

## 4. The data model

```json
{ "notes": { "n1": { "id": "n1", "title": "Rollout checklist", "body": "…",
                     "colour": "yellow", "pinned": true } },
  "order": ["n1", "n2", "n3"],
  "selectedId": "n1" }
```

Normalised for the same reason as any board: a move touches `order` only, an edit touches one entry of
`notes`, and every untouched note keeps its object identity — which is what makes a snapshot history cheap.
Two snapshots of a three-note document share every note that did not change; only the spine is new.

`selectedId` lives **inside** the snapshot even though selection is not undoable. It rides along so a
restored state is complete, and `undo` then overrides it with the live selection when that still resolves.
Keeping it outside would mean a snapshot cannot be restored as-is; keeping it in without the override
means undo teleports the user.

---

## 5. Pass 1 — the reducer (7 minutes)

```js
case 'editTitle':
case 'editBody':
case 'setColour': {
  const note = state.notes[action.id];
  if (!note) return state;                       // an action against a deleted note is a no-op
  const field = action.type === 'editTitle' ? 'title' : action.type === 'editBody' ? 'body' : 'colour';
  const value = action.title ?? action.body ?? action.colour;
  if (note[field] === value) return state;       // ← the identity check the history depends on
  return { ...state, notes: { ...state.notes, [action.id]: { ...note, [field]: value } } };
}
```

Returning `state` itself rather than a new object with the same contents is the whole trick: the caller
tests `next === state` and skips the history entirely. Without it, a `<textarea>` that fires `change` on
blur, a paste of identical text, or a colour click on the current colour each push a "step" that undoes
nothing — the single most common complaint about hand-rolled undo.

Delete also moves the selection to a note that still exists, or the keyboard is left pointing at nothing.

---

## 6. Pass 2 — the history ladder (10 minutes)

| Rung | What is stored | Memory for a 5MB doc | Undo cost | Merge typing | Collaboration |
| --- | --- | --- | --- | --- | --- |
| V0 | nothing | — | — | — | — |
| V1 | full snapshot per keystroke | **500 × 5MB** | O(1) | no — 500 undos for a paragraph | no |
| V2 | **snapshot per coalesced edit** | 60 × structural sharing | O(1) | **yes** | no |
| V3 | inverse patch per edit (command pattern) | proportional to the change | O(patch) | yes | patches can be transformed |
| V4 | CRDT / OT log | proportional to the change | O(op) | yes | **yes, by construction** |

**Ship V2.** With a normalised, immutably-updated document, a snapshot is a handful of new objects and a
pointer to everything else, so the memory argument against snapshots mostly evaporates — it returns when
the document is one huge string or a large array, which is when V3 earns its complexity.

V3 is worth describing precisely, because it is the answer to "what if the document is big": each entry
stores `{ do, undo }` (or a patch and its inverse), so `deleteNote` remembers the note and its index
rather than the whole document. It is also the on-ramp to V4: an operation that can be inverted can
usually be *transformed* against a concurrent one, which is what OT needs; CRDTs go further and make
concurrent operations commute so no transform is needed.

```js
export function commit(history, entry, { now, coalesceMs = 700 }) {
  const last = history.past[history.past.length - 1];
  const canMerge = last && entry.mergeKey !== null
    && last.mergeKey === entry.mergeKey && now - last.at <= coalesceMs;

  if (canMerge) {
    // Rewrite the LAST entry's `after`. Its `before` still points at the state from before the burst,
    // so one undo removes the whole word — that is the entire coalescing mechanism.
    const merged = { ...last, after: entry.after, at: now };
    return { past: [...history.past.slice(0, -1), merged], future: [] };
  }

  const past = [...history.past, { ...entry, at: now }];
  return { past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past, future: [] };
}
```

```js
const mergeKeyFor = (action) =>
  action.type === 'editTitle' ? `title:${action.id}`
  : action.type === 'editBody' ? `body:${action.id}`
  : null;                                        // structural changes never merge
```

The key is field + note id, not just "typing": typing in the body, switching to the title, and typing in
the body again is three entries, because merging them would make one undo jump across two fields.

---

## 7. Pass 3 — the two stacks (8 minutes)

```js
export function undo(history, state) {
  const entry = history.past.at(-1);
  if (!entry) return { history, state };          // an empty stack is a no-op, never a crash
  return {
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    state: withLiveSelection(entry.before, state),
  };
}
```

Three properties to state:

- **`future` is cleared on every commit.** After undoing three steps and typing, the three redos are gone.
  Editors that keep them produce a tree the user cannot see, which is worse than losing a branch.
- **The bound drops the oldest, not the newest.** Undo stops sixty steps back; it does not silently
  discard the step just made.
- **Undo and redo are symmetric.** The check file drives a five-action script, undoes all five and asserts
  the document matches the original, then redoes all five and asserts it matches where it was. That
  round-trip is the test that catches an inverse written slightly wrong.

---

## 8. Pass 4 — shortcuts and labels (7 minutes)

```js
export function shortcutFor(event) {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  const key = event.key.toLowerCase();            // Shift+Z arrives as 'Z'
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.metaKey) return 'redo';   // Ctrl+Y is Windows redo; Cmd+Y is not
  return null;                                    // everything else passes through untouched
}
```

The listener is on `window` and calls `preventDefault` **only** when the event is a history shortcut. That
matters twice: it leaves `Cmd+S`, `Cmd+C` and ordinary typing alone, and it stops the browser's own
per-field undo from fighting ours. Without it, `Cmd+Z` inside the textarea steps back one keystroke of
that field's native history while the app's stack stays where it was, and the two diverge immediately.

Labels are not decoration: **Undo typing**, **Undo delete note**. An undo button that says nothing forces
the user to press it to find out what it does — and pressing it is the thing they are unsure about. The
history panel shows the past entries in order and the discarded-on-next-edit future greyed out, which
makes coalescing visible: type five characters, see one row.

---

## 9. The single-file version — what you actually type

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react';

/* ───────────── constants/notes.js ───────────── */

const COLOURS = ['grey', 'yellow', 'blue', 'green'];

const INITIAL_STATE = {
  notes: {
    n1: { id: 'n1', title: 'Rollout checklist', body: 'Flag wired, telemetry on paste events.', colour: 'yellow', pinned: true },
    n2: { id: 'n2', title: 'Postmortem actions', body: 'Add a regression test before Friday.', colour: 'blue', pinned: false },
    n3: { id: 'n3', title: 'Interview prep', body: 'Undo: snapshots first, patches when it gets big.', colour: 'grey', pinned: false },
  },
  order: ['n1', 'n2', 'n3'],
  selectedId: 'n1',
};

const COALESCE_MS = 700;
const MAX_HISTORY = 60;

/* ───────────── utils/editor.utils.js — pure ───────────── */

function editorReducer(state, action) {
  switch (action.type) {
    case 'addNote':
      return { ...state, notes: { ...state.notes, [action.note.id]: action.note },
        order: [action.note.id, ...state.order], selectedId: action.note.id };

    case 'deleteNote': {
      if (!state.notes[action.id]) return state;
      const notes = { ...state.notes };
      delete notes[action.id];
      const order = state.order.filter((id) => id !== action.id);
      return { ...state, notes, order,
        selectedId: state.selectedId === action.id ? order[0] ?? null : state.selectedId };
    }

    case 'editTitle':
    case 'editBody':
    case 'setColour': {
      const note = state.notes[action.id];
      if (!note) return state;
      const field = action.type === 'editTitle' ? 'title' : action.type === 'editBody' ? 'body' : 'colour';
      const value = action.title ?? action.body ?? action.colour;
      if (note[field] === value) return state;          // no-op: never enters history
      return { ...state, notes: { ...state.notes, [action.id]: { ...note, [field]: value } } };
    }

    case 'togglePin': {
      const note = state.notes[action.id];
      if (!note) return state;
      return { ...state, notes: { ...state.notes, [action.id]: { ...note, pinned: !note.pinned } } };
    }

    case 'moveNote': {
      const from = state.order.indexOf(action.id);
      if (from === -1) return state;
      const target = Math.max(0, Math.min(action.toIndex, state.order.length - 1));
      if (target === from) return state;
      const order = [...state.order];
      order.splice(from, 1);
      order.splice(target, 0, action.id);
      return { ...state, order };
    }

    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };

    default:
      return state;
  }
}

const labelFor = (action) => ({
  addNote: 'add note', deleteNote: 'delete note', editTitle: 'typing title',
  editBody: 'typing', setColour: 'colour', togglePin: 'pin', moveNote: 'move note',
}[action.type] ?? 'change');

const mergeKeyFor = (action) =>
  action.type === 'editTitle' ? `title:${action.id}`
    : action.type === 'editBody' ? `body:${action.id}`
      : null;

const isUndoable = (action) => action.type !== 'select';

function commit(history, entry, now) {
  const last = history.past[history.past.length - 1];
  const canMerge = last && entry.mergeKey !== null
    && last.mergeKey === entry.mergeKey && now - last.at <= COALESCE_MS;

  if (canMerge) {
    const merged = { ...last, after: entry.after, at: now };   // `before` stays: one undo, whole burst
    return { past: [...history.past.slice(0, -1), merged], future: [] };
  }
  const past = [...history.past, { ...entry, at: now }];
  return { past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past, future: [] };
}

const withLiveSelection = (target, live) => {
  const keep = live.selectedId && target.notes[live.selectedId] ? live.selectedId : target.selectedId;
  return keep === target.selectedId ? target : { ...target, selectedId: keep };
};

function undo(history, state) {
  const entry = history.past[history.past.length - 1];
  if (!entry) return { history, state };
  return { history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    state: withLiveSelection(entry.before, state) };
}

function redo(history, state) {
  const [entry, ...rest] = history.future;
  if (!entry) return { history, state };
  return { history: { past: [...history.past, entry], future: rest },
    state: withLiveSelection(entry.after, state) };
}

function shortcutFor(event) {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.metaKey) return 'redo';
  return null;
}

/* ───────────── hooks/use-editor.js ───────────── */

function useEditor() {
  // ONE atom: the document and its history move together, or a fast Cmd+Z Cmd+Z desynchronises them.
  const [editor, setEditor] = useState({ state: INITIAL_STATE, history: { past: [], future: [] } });

  const run = useCallback((action) => {
    setEditor((current) => {
      const next = editorReducer(current.state, action);
      if (next === current.state) return current;               // nothing happened
      if (!isUndoable(action)) return { ...current, state: next };
      return { state: next,
        history: commit(current.history,
          { label: labelFor(action), before: current.state, after: next, mergeKey: mergeKeyFor(action) },
          Date.now()) };
    });
  }, []);

  const undoAction = useCallback(() => setEditor((c) => undo(c.history, c.state)), []);
  const redoAction = useCallback(() => setEditor((c) => redo(c.history, c.state)), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const shortcut = shortcutFor(event);
      if (!shortcut) return;                 // preventDefault ONLY for history keys
      event.preventDefault();                // …or the browser's per-field undo fights ours
      (shortcut === 'undo' ? undoAction : redoAction)();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoAction, redoAction]);

  const { state, history } = editor;
  const notes = useMemo(() => state.order.map((id) => state.notes[id]), [state]);

  return {
    notes, history, run,
    selected: state.selectedId ? state.notes[state.selectedId] ?? null : null,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoLabel: history.past[history.past.length - 1]?.label ?? null,
    redoLabel: history.future[0]?.label ?? null,
    undo: undoAction, redo: redoAction,
  };
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const e = useEditor();
  const selected = e.selected;

  return (
    <section>
      <div className="bar">
        <button type="button" onClick={e.undo} disabled={!e.canUndo}>
          ↶ Undo{e.undoLabel ? ` ${e.undoLabel}` : ''}
        </button>
        <button type="button" onClick={e.redo} disabled={!e.canRedo}>
          ↷ Redo{e.redoLabel ? ` ${e.redoLabel}` : ''}
        </button>
        <button type="button" onClick={() => e.run({ type: 'addNote', note: {
          id: `n${Date.now().toString(36)}`, title: 'Untitled note', body: '', colour: 'grey', pinned: false } })}>
          + Note
        </button>
        <span>{e.history.past.length} undo · {e.history.future.length} redo</span>
      </div>

      <ul className="list">
        {e.notes.map((note, index) => (
          <li key={note.id}>
            <button type="button" onClick={() => e.run({ type: 'select', id: note.id })}>
              {note.pinned && <span className="pin">pinned</span>} {note.title || 'Untitled'}
            </button>
            <button type="button" aria-label={`Move ${note.title} up`} disabled={index === 0}
                    onClick={() => e.run({ type: 'moveNote', id: note.id, toIndex: index - 1 })}>↑</button>
            <button type="button" aria-label={`Move ${note.title} down`} disabled={index === e.notes.length - 1}
                    onClick={() => e.run({ type: 'moveNote', id: note.id, toIndex: index + 1 })}>↓</button>
            <button type="button" aria-label={`Delete ${note.title}`}
                    onClick={() => e.run({ type: 'deleteNote', id: note.id })}>✕</button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="editor">
          <input value={selected.title}
                 onChange={(event) => e.run({ type: 'editTitle', id: selected.id, title: event.target.value })} />
          <textarea rows={7} value={selected.body}
                    onChange={(event) => e.run({ type: 'editBody', id: selected.id, body: event.target.value })} />
          {COLOURS.map((colour) => (
            <button key={colour} type="button" aria-label={colour} aria-pressed={selected.colour === colour}
                    onClick={() => e.run({ type: 'setColour', id: selected.id, colour })}>{colour}</button>
          ))}
          <button type="button" aria-pressed={selected.pinned}
                  onClick={() => e.run({ type: 'togglePin', id: selected.id })}>
            {selected.pinned ? 'Unpin' : 'Pin'}
          </button>
        </div>
      )}

      <ol className="history" aria-label="History">
        {e.history.past.map((entry, index) => <li key={`${entry.at}-${index}`}>{index + 1} {entry.label}</li>)}
        {e.history.future.map((entry, index) => <li key={`f-${entry.at}-${index}`} className="future">↷ {entry.label}</li>)}
      </ol>
    </section>
  );
}
```

**Build it in this order:** the reducer with two actions and the identity check → `run` recording every
change as a snapshot → undo/redo over the two stacks → coalescing by `mergeKey` + time → the keyboard
shortcuts → labels and the history panel → the rest of the actions.

Narrate two lines: *"the reducer returns the same object when nothing changed, which is what keeps no-op
edits out of the history"* and *"merging rewrites the last entry's `after`, so its `before` still points at
the state from before the whole burst."*

---

## 10. Verification

```bash
node src/projects/undo-redo-editor/utils/editor.check.ts
```

Asserts: the reducer creating new objects only for what changed and returning the **same** state for a
re-written value, a missing note and a no-op move; delete re-pointing the selection and leaving the
original untouched; a five-keystroke burst producing one entry that one undo reverses whole; a pause
splitting the burst; title vs body and note vs note never merging; selection excluded; empty-stack undo
and redo as no-ops; a new edit after undoing discarding the redo branch; a five-action script undone all
the way back to the original document and redone all the way forward; the bound keeping the newest 60 and
dropping the oldest; and every shortcut case including `Shift+Z` arriving uppercase and `Cmd+Y` **not**
being redo on a Mac.

Demo script (measured in the browser):

1. Type five characters into the body: the history panel shows **one** row, `1 undo · 0 redo`.
2. Pause, type again: **two** rows. One undo removes only the second burst.
3. Delete a note (`3 undo`), then Undo: the note comes back **with its pinned state**, in its old position.
4. Focus the textarea and press `Cmd+Z`: the app's history steps back, not the browser's field history.
   `Shift+Cmd+Z` steps forward again.
5. Undo twice, then type: the redo button goes disabled — the branch is gone (`2 undo · 0 redo`).
6. Click the already-selected colour: nothing is added to the history.

---

## 11. Cross-questions and answers

**"Snapshots will blow up memory."** For a document that is a normalised object graph updated immutably,
two snapshots share every unchanged note — the delta is the spine. The bound caps the rest. When the
document is one large blob (a long string, a big array, an image buffer), move to inverse patches: store
`{ do, undo }` per entry so memory is proportional to the change.

**"How does this become collaborative?"** Snapshots stop working the moment someone else's edit is
interleaved: undoing to *your* previous document would revert their work too. You need per-user undo,
which needs operations rather than states — invert your own op and **transform** it against everything
that happened since (OT), or use a CRDT where concurrent ops commute and undo is "apply the inverse op".
Say which one you would pick and why: OT needs a server to order operations; CRDTs are heavier on the wire
but work peer-to-peer and offline.

**"Why not `document.execCommand('undo')` or the browser's native undo?"** It only covers a single focused
input, knows nothing about the colour, the pin or the order, and cannot be inspected or labelled. The
moment one action changes two fields, it is wrong.

**"Persisting the history across reloads?"** Persist the document; persist the history only if the product
needs it (a long-form editor might). It serialises fine — plain data — but the entries pin whole documents
in storage, which is another argument for patches.

**"Undo inside a text field: what about the caret?"** This build restores the document, and React puts the
caret at the end of the restored value. A real editor stores the selection range in the entry and restores
it, which is why editors like ProseMirror keep selection inside the transaction.

**"What about async actions — a save that failed?"** Undo is for local document edits. A failed save is a
different mechanism (retry, or an optimistic rollback), and mixing them means `Cmd+Z` sometimes talks to
the server, which no user expects.

**"How would you test it?"** Exactly as above: the reducer's identity contract, the coalescing rule at both
boundaries, and the full round trip — undo everything, assert the document equals the original; redo
everything, assert it equals where you were. Those three catch essentially every real undo bug.
