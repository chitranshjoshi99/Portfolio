import type { EditorState, Note } from '../undo-redo-editor.types';

export const COLOURS: Note['colour'][] = ['grey', 'yellow', 'blue', 'green'];

const seed: Note[] = [
  {
    id: 'n1',
    title: 'Rollout checklist',
    body: 'Flag wired, telemetry on paste events, old docs migrated.',
    colour: 'yellow',
    pinned: true,
  },
  {
    id: 'n2',
    title: 'Postmortem actions',
    body: 'Add a regression test for the selection bug before Friday.',
    colour: 'blue',
    pinned: false,
  },
  {
    id: 'n3',
    title: 'Interview prep',
    body: 'Undo/redo: snapshots first, patches when the document gets big.',
    colour: 'grey',
    pinned: false,
  },
];

export const INITIAL_STATE: EditorState = {
  notes: Object.fromEntries(seed.map((note) => [note.id, note])),
  order: seed.map((note) => note.id),
  selectedId: 'n1',
};

export const NEW_NOTE_TITLE = 'Untitled note';
