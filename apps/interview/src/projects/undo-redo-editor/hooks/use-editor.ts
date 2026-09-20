import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_STATE, NEW_NOTE_TITLE } from '../constants/notes';
import type { EditorAction, EditorState, History, Note } from '../undo-redo-editor.types';
import {
  canRedo, canUndo, commit, editorReducer, isUndoable, labelFor, mergeKeyFor,
  redo as redoHistory, redoLabel, shortcutFor, undo as undoHistory, undoLabel,
} from '../utils/editor.utils';

/**
 * The document and its history are one value. Keeping them in separate useStates means an undo has to
 * write both from inside the other's updater, which is where the off-by-one bugs live: the history
 * pops while the state is still the pre-pop one, and the two drift apart after a fast Cmd+Z Cmd+Z.
 */
interface Editor {
  state: EditorState;
  history: History;
}

const INITIAL: Editor = { state: INITIAL_STATE, history: { past: [], future: [] } };

export function useEditor() {
  const [editor, setEditor] = useState<Editor>(INITIAL);

  /** One entry point for every change: reduce, then decide whether it is worth remembering. */
  const run = useCallback((action: EditorAction) => {
    setEditor((current) => {
      const next = editorReducer(current.state, action);
      if (next === current.state) return current; // a no-op edit never enters history
      if (!isUndoable(action)) return { ...current, state: next };
      return {
        state: next,
        history: commit(
          current.history,
          { label: labelFor(action), before: current.state, after: next, mergeKey: mergeKeyFor(action) },
          { now: Date.now() },
        ),
      };
    });
  }, []);

  const undo = useCallback(() => {
    setEditor((current) => undoHistory(current.history, current.state));
  }, []);

  const redo = useCallback(() => {
    setEditor((current) => redoHistory(current.history, current.state));
  }, []);

  // Cmd/Ctrl+Z anywhere, textareas included: the browser's own undo would otherwise fight this one
  // and only ever step back the last keystroke in whichever field has focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutFor(event);
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut === 'undo') undo();
      else redo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const { state, history } = editor;
  const notes = useMemo(() => state.order.map((id) => state.notes[id]), [state]);
  const selected = state.selectedId ? state.notes[state.selectedId] ?? null : null;

  return {
    notes,
    selected,
    history,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoLabel: undoLabel(history),
    redoLabel: redoLabel(history),
    undo,
    redo,
    select: (id: string | null) => run({ type: 'select', id }),
    addNote: () =>
      run({
        type: 'addNote',
        note: {
          id: `n${Date.now().toString(36)}`,
          title: NEW_NOTE_TITLE,
          body: '',
          colour: 'grey',
          pinned: false,
        },
      }),
    deleteNote: (id: string) => run({ type: 'deleteNote', id }),
    setTitle: (id: string, title: string) => run({ type: 'editTitle', id, title }),
    setBody: (id: string, body: string) => run({ type: 'editBody', id, body }),
    setColour: (id: string, colour: Note['colour']) => run({ type: 'setColour', id, colour }),
    togglePin: (id: string) => run({ type: 'togglePin', id }),
    move: (id: string, toIndex: number) => run({ type: 'moveNote', id, toIndex }),
  };
}
