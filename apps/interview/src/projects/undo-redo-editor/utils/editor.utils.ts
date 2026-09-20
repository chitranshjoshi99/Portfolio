import type { EditorAction, EditorState, History, HistoryEntry, Note } from '../undo-redo-editor.types.ts';

/** Typing is coalesced into one history entry while the edits keep landing inside this window. */
export const COALESCE_MS = 700;
/** Snapshots are cheap here but not free: drop the oldest beyond this. */
export const MAX_HISTORY = 60;

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'addNote':
      return {
        ...state,
        notes: { ...state.notes, [action.note.id]: action.note },
        order: [action.note.id, ...state.order],
        selectedId: action.note.id,
      };

    case 'deleteNote': {
      if (!state.notes[action.id]) return state;
      const notes = { ...state.notes };
      delete notes[action.id];
      const order = state.order.filter((id) => id !== action.id);
      return {
        ...state,
        notes,
        order,
        // Selecting the neighbour keeps the keyboard somewhere useful after a delete.
        selectedId: state.selectedId === action.id ? order[0] ?? null : state.selectedId,
      };
    }

    case 'editTitle':
    case 'editBody':
    case 'setColour': {
      const note = state.notes[action.id];
      if (!note) return state;
      const field = action.type === 'editTitle' ? 'title' : action.type === 'editBody' ? 'body' : 'colour';
      const value = action.type === 'editTitle' ? action.title : action.type === 'editBody' ? action.body : action.colour;
      if (note[field as keyof Note] === value) return state; // a no-op edit must not enter history
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

/** What the Undo menu says. A history nobody can read is a history nobody trusts. */
export function labelFor(action: EditorAction): string {
  switch (action.type) {
    case 'addNote':
      return 'add note';
    case 'deleteNote':
      return 'delete note';
    case 'editTitle':
      return 'typing title';
    case 'editBody':
      return 'typing';
    case 'setColour':
      return 'colour';
    case 'togglePin':
      return 'pin';
    case 'moveNote':
      return 'move note';
    default:
      return 'change';
  }
}

/**
 * Two edits merge only when they are the same kind of edit to the same field of the same note.
 * Typing "hello" is one undo; typing then changing colour then typing again is three.
 */
export function mergeKeyFor(action: EditorAction): string | null {
  switch (action.type) {
    case 'editTitle':
      return `title:${action.id}`;
    case 'editBody':
      return `body:${action.id}`;
    default:
      return null; // structural changes are never merged
  }
}

/** Selection is view state: it rides along in the snapshot but never creates an undo step. */
export const isUndoable = (action: EditorAction): boolean => action.type !== 'select';

interface CommitOptions {
  now: number;
  coalesceMs?: number;
}

/**
 * Record one edit. Coalescing rewrites the previous entry's `after` rather than pushing a new one,
 * so its `before` still points at the state from before the whole burst of typing.
 */
export function commit(
  history: History,
  entry: Omit<HistoryEntry, 'at'>,
  { now, coalesceMs = COALESCE_MS }: CommitOptions,
): History {
  const last = history.past[history.past.length - 1];
  const canMerge =
    last !== undefined &&
    entry.mergeKey !== null &&
    last.mergeKey === entry.mergeKey &&
    now - last.at <= coalesceMs;

  if (canMerge) {
    const merged: HistoryEntry = { ...last, after: entry.after, at: now };
    return { past: [...history.past.slice(0, -1), merged], future: [] };
  }

  const past = [...history.past, { ...entry, at: now }];
  return {
    // Dropping the oldest entry is the cost of a bounded history: undo stops there, it does not break.
    past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past,
    // Any new edit invalidates the redo branch: the future the user could have had no longer exists.
    future: [],
  };
}

export const canUndo = (history: History): boolean => history.past.length > 0;
export const canRedo = (history: History): boolean => history.future.length > 0;

export function undo(history: History, state: EditorState): { history: History; state: EditorState } {
  const entry = history.past[history.past.length - 1];
  if (!entry) return { history, state };
  return {
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    // Selection is preserved from the live state where it still exists, so undoing an edit does not
    // also move the user's cursor to wherever they happened to be when they made it.
    state: withLiveSelection(entry.before, state),
  };
}

export function redo(history: History, state: EditorState): { history: History; state: EditorState } {
  const [entry, ...rest] = history.future;
  if (!entry) return { history, state };
  return {
    history: { past: [...history.past, entry], future: rest },
    state: withLiveSelection(entry.after, state),
  };
}

function withLiveSelection(target: EditorState, live: EditorState): EditorState {
  const keep = live.selectedId && target.notes[live.selectedId] ? live.selectedId : target.selectedId;
  return keep === target.selectedId ? target : { ...target, selectedId: keep };
}

/** The undo/redo labels the menu shows, or null when the stack is empty. */
export const undoLabel = (history: History): string | null =>
  history.past[history.past.length - 1]?.label ?? null;
export const redoLabel = (history: History): string | null => history.future[0]?.label ?? null;

/**
 * Cmd/Ctrl+Z undoes; Shift adds redo, and Ctrl+Y redoes on Windows. Returns null when the event is
 * not a history shortcut so the caller does not preventDefault on everything.
 */
export function shortcutFor(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): 'undo' | 'redo' | null {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.metaKey) return 'redo'; // Ctrl+Y is Windows redo; Cmd+Y is not
  return null;
}
