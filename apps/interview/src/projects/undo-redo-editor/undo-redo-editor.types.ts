export type NoteId = string;

export interface Note {
  id: NoteId;
  title: string;
  body: string;
  colour: 'grey' | 'yellow' | 'blue' | 'green';
  pinned: boolean;
}

export interface EditorState {
  notes: Record<NoteId, Note>;
  order: NoteId[];
  selectedId: NoteId | null;
}

/**
 * Every change to the document is one of these. Undo replays the inverse; the reducer never mutates,
 * so a history entry is just the state before and after plus the label the user reads.
 */
export type EditorAction =
  | { type: 'addNote'; note: Note }
  | { type: 'deleteNote'; id: NoteId }
  | { type: 'editTitle'; id: NoteId; title: string }
  | { type: 'editBody'; id: NoteId; body: string }
  | { type: 'setColour'; id: NoteId; colour: Note['colour'] }
  | { type: 'togglePin'; id: NoteId }
  | { type: 'moveNote'; id: NoteId; toIndex: number }
  | { type: 'select'; id: NoteId | null };

export interface HistoryEntry {
  /** What the undo menu shows: "Undo typing", "Undo delete note". */
  label: string;
  /** The document as it was before this entry, and as it is after. */
  before: EditorState;
  after: EditorState;
  /** Used to decide whether the next edit merges into this one. */
  mergeKey: string | null;
  at: number;
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}
