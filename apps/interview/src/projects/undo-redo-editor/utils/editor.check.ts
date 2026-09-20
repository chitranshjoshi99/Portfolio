/**
 * node src/projects/undo-redo-editor/utils/editor.check.ts
 * Undo is a data-structure question: the reducer, the coalescing rule, and the two stacks.
 */
import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../constants/notes.ts';
import type { EditorAction, EditorState, History } from '../undo-redo-editor.types.ts';
import {
  canRedo, canUndo, commit, editorReducer, isUndoable, labelFor, MAX_HISTORY, mergeKeyFor,
  redo, redoLabel, shortcutFor, undo, undoLabel,
} from './editor.utils.ts';

const empty: History = { past: [], future: [] };

/** Apply an action the way the hook does: reduce, then record unless it was a no-op. */
function apply(state: EditorState, history: History, action: EditorAction, now: number) {
  const next = editorReducer(state, action);
  if (next === state || !isUndoable(action)) return { state: next, history };
  return {
    state: next,
    history: commit(history, { label: labelFor(action), before: state, after: next, mergeKey: mergeKeyFor(action) }, { now }),
  };
}

// --- the reducer -----------------------------------------------------------
{
  const typed = editorReducer(INITIAL_STATE, { type: 'editBody', id: 'n1', body: 'new body' });
  assert.equal(typed.notes.n1.body, 'new body');
  assert.notEqual(typed.notes.n1, INITIAL_STATE.notes.n1, 'the edited note is a new object');
  assert.equal(typed.notes.n2, INITIAL_STATE.notes.n2, 'every other note keeps its identity');
  assert.equal(
    editorReducer(typed, { type: 'editBody', id: 'n1', body: 'new body' }),
    typed,
    'writing the same value returns the SAME state, so it never enters history',
  );
  assert.equal(editorReducer(INITIAL_STATE, { type: 'editBody', id: 'nope', body: 'x' }), INITIAL_STATE);
}

{
  const deleted = editorReducer(INITIAL_STATE, { type: 'deleteNote', id: 'n1' });
  assert.equal(deleted.notes.n1, undefined);
  assert.deepEqual(deleted.order, ['n2', 'n3']);
  assert.equal(deleted.selectedId, 'n2', 'selection moves to a note that still exists');
  assert.equal(INITIAL_STATE.notes.n1.id, 'n1', 'the original state was not mutated');
}

{
  const moved = editorReducer(INITIAL_STATE, { type: 'moveNote', id: 'n1', toIndex: 2 });
  assert.deepEqual(moved.order, ['n2', 'n3', 'n1']);
  assert.deepEqual(editorReducer(INITIAL_STATE, { type: 'moveNote', id: 'n1', toIndex: 99 }).order, ['n2', 'n3', 'n1'],
    'an out-of-range index clamps to the end');
  assert.equal(editorReducer(INITIAL_STATE, { type: 'moveNote', id: 'n1', toIndex: 0 }), INITIAL_STATE, 'a no-op move');
}

// --- coalescing ------------------------------------------------------------
{
  // Typing five characters inside the window is ONE undo step.
  let state = INITIAL_STATE;
  let history = empty;
  const word = ['h', 'he', 'hel', 'hell', 'hello'];
  word.forEach((body, index) => {
    ({ state, history } = apply(state, history, { type: 'editBody', id: 'n1', body }, 1000 + index * 100));
  });
  assert.equal(history.past.length, 1, 'one entry for the burst');
  assert.equal(state.notes.n1.body, 'hello');

  const back = undo(history, state);
  assert.equal(back.state.notes.n1.body, INITIAL_STATE.notes.n1.body, 'one undo removes the whole word');
  assert.equal(canRedo(back.history), true);
  assert.equal(redo(back.history, back.state).state.notes.n1.body, 'hello', 'and redo puts it all back');
}

{
  // A pause longer than the window starts a new entry.
  let state = INITIAL_STATE;
  let history = empty;
  ({ state, history } = apply(state, history, { type: 'editBody', id: 'n1', body: 'one' }, 1000));
  ({ state, history } = apply(state, history, { type: 'editBody', id: 'n1', body: 'one two' }, 3000));
  assert.equal(history.past.length, 2, 'a pause breaks the burst');
  assert.equal(undo(history, state).state.notes.n1.body, 'one', 'undo steps back one burst, not all of it');
}

{
  // Different fields never merge, even back to back.
  let state = INITIAL_STATE;
  let history = empty;
  ({ state, history } = apply(state, history, { type: 'editBody', id: 'n1', body: 'a' }, 1000));
  ({ state, history } = apply(state, history, { type: 'editTitle', id: 'n1', title: 'b' }, 1050));
  ({ state, history } = apply(state, history, { type: 'editBody', id: 'n1', body: 'ab' }, 1100));
  assert.equal(history.past.length, 3, 'title and body are separate edits');
  assert.deepEqual(history.past.map((entry) => entry.label), ['typing', 'typing title', 'typing']);

  // Same field, different note: also separate.
  ({ state, history } = apply(state, history, { type: 'editBody', id: 'n2', body: 'x' }, 1150));
  assert.equal(history.past.length, 4);
}

assert.equal(mergeKeyFor({ type: 'editBody', id: 'n1', body: 'x' }), 'body:n1');
assert.equal(mergeKeyFor({ type: 'deleteNote', id: 'n1' }), null, 'structural changes never merge');
assert.equal(isUndoable({ type: 'select', id: 'n2' }), false, 'selection is not an undo step');

// --- the two stacks --------------------------------------------------------
{
  let state = INITIAL_STATE;
  let history = empty;
  assert.equal(canUndo(history), false);
  assert.equal(undoLabel(history), null);
  assert.deepEqual(undo(history, state), { history, state }, 'undo on an empty stack is a no-op');
  assert.deepEqual(redo(history, state), { history, state });

  ({ state, history } = apply(state, history, { type: 'togglePin', id: 'n2' }, 1000));
  ({ state, history } = apply(state, history, { type: 'setColour', id: 'n2', colour: 'green' }, 2000));
  assert.equal(undoLabel(history), 'colour');

  const first = undo(history, state);
  assert.equal(first.state.notes.n2.colour, 'blue');
  assert.equal(first.state.notes.n2.pinned, true, 'the earlier edit is still applied');
  assert.equal(redoLabel(first.history), 'colour');

  const second = undo(first.history, first.state);
  assert.equal(second.state.notes.n2.pinned, false);
  assert.equal(canUndo(second.history), false);
  assert.equal(second.history.future.length, 2);

  // A new edit after undoing discards the redo branch.
  const branched = apply(second.state, second.history, { type: 'setColour', id: 'n3', colour: 'yellow' }, 3000);
  assert.equal(canRedo(branched.history), false, 'the future the user did not take is gone');
  assert.equal(branched.history.past.length, 1);
}

// --- round trip ------------------------------------------------------------
{
  let state = INITIAL_STATE;
  let history = empty;
  const script: EditorAction[] = [
    { type: 'addNote', note: { id: 'n4', title: 'New', body: '', colour: 'grey', pinned: false } },
    { type: 'editBody', id: 'n4', body: 'draft' },
    { type: 'moveNote', id: 'n4', toIndex: 2 },
    { type: 'deleteNote', id: 'n2' },
    { type: 'togglePin', id: 'n3' },
  ];
  script.forEach((action, index) => {
    ({ state, history } = apply(state, history, action, 1000 + index * 2000));
  });
  assert.equal(history.past.length, 5);

  let rewind = { history, state };
  for (let i = 0; i < 5; i += 1) rewind = undo(rewind.history, rewind.state);
  assert.deepEqual(rewind.state.order, INITIAL_STATE.order, 'undoing everything restores the original order');
  assert.deepEqual(Object.keys(rewind.state.notes).sort(), Object.keys(INITIAL_STATE.notes).sort());
  assert.equal(rewind.state.notes.n3.pinned, INITIAL_STATE.notes.n3.pinned);

  let forward = rewind;
  for (let i = 0; i < 5; i += 1) forward = redo(forward.history, forward.state);
  assert.deepEqual(forward.state.order, state.order, 'and redoing everything returns to where we were');
  assert.equal(forward.state.notes.n4.body, 'draft');
  assert.equal(forward.state.notes.n2, undefined);
}

// --- bounded history -------------------------------------------------------
{
  let state = INITIAL_STATE;
  let history = empty;
  for (let i = 0; i < MAX_HISTORY + 20; i += 1) {
    ({ state, history } = apply(state, history, { type: 'editBody', id: 'n1', body: `body ${i}` }, i * 5000));
  }
  assert.equal(history.past.length, MAX_HISTORY, 'the stack is bounded');
  assert.equal(history.past[0].after.notes.n1.body, 'body 20', 'the oldest entries were dropped, not the newest');
}

// --- shortcuts -------------------------------------------------------------
const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) =>
  shortcutFor({ key: k, metaKey: false, ctrlKey: false, shiftKey: false, ...mods });
assert.equal(key('z', { metaKey: true }), 'undo');
assert.equal(key('z', { ctrlKey: true }), 'undo');
assert.equal(key('Z', { metaKey: true, shiftKey: true }), 'redo', 'shift makes the key uppercase');
assert.equal(key('y', { ctrlKey: true }), 'redo', 'Windows redo');
assert.equal(key('y', { metaKey: true }), null, 'Cmd+Y is not redo on a Mac');
assert.equal(key('z'), null, 'z alone is typing, not undo');
assert.equal(key('s', { metaKey: true }), null, 'other shortcuts pass through');

console.log('undo-redo-editor: all checks passed');
