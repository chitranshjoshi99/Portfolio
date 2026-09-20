import { COLOURS } from './constants/notes';
import { useEditor } from './hooks/use-editor';
import './undo-redo-editor.css';

export default function UndoRedoEditorPage() {
  const e = useEditor();

  return (
    <section className="ur">
      <div className="ur__bar">
        <button type="button" className="ur__btn" onClick={e.undo} disabled={!e.canUndo}>
          ↶ Undo{e.undoLabel ? ` ${e.undoLabel}` : ''}
        </button>
        <button type="button" className="ur__btn" onClick={e.redo} disabled={!e.canRedo}>
          ↷ Redo{e.redoLabel ? ` ${e.redoLabel}` : ''}
        </button>
        <button type="button" className="ur__btn ur__btn--primary" onClick={e.addNote}>
          + Note
        </button>
        <span className="ur__hint">
          <kbd>⌘Z</kbd> / <kbd>⇧⌘Z</kbd> work inside the fields too
        </span>
        <span className="ur__stat">
          {e.history.past.length} undo · {e.history.future.length} redo
        </span>
      </div>

      <div className="ur__layout">
        <ul className="ur__list">
          {e.notes.map((note, index) => (
            <li key={note.id}>
              <button
                type="button"
                className={`ur__card ur__card--${note.colour} ${e.selected?.id === note.id ? 'is-selected' : ''}`}
                aria-current={e.selected?.id === note.id ? 'true' : undefined}
                onClick={() => e.select(note.id)}
              >
                <span className="ur__card-title">
                  {note.pinned && <span className="ur__pin">pinned</span>} {note.title || 'Untitled'}
                </span>
                <span className="ur__card-body">{note.body || 'Empty'}</span>
              </button>
              <div className="ur__card-actions">
                <button
                  type="button"
                  className="ur__mini"
                  aria-label={`Move ${note.title} up`}
                  disabled={index === 0}
                  onClick={() => e.move(note.id, index - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ur__mini"
                  aria-label={`Move ${note.title} down`}
                  disabled={index === e.notes.length - 1}
                  onClick={() => e.move(note.id, index + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ur__mini"
                  aria-label={`Delete ${note.title}`}
                  onClick={() => e.deleteNote(note.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="ur__editor">
          {e.selected ? (
            <>
              <label className="ur__field">
                <span className="ur__label">Title</span>
                <input
                  value={e.selected.title}
                  onChange={(event) => e.setTitle(e.selected!.id, event.target.value)}
                />
              </label>
              <label className="ur__field">
                <span className="ur__label">Body</span>
                <textarea
                  rows={7}
                  value={e.selected.body}
                  onChange={(event) => e.setBody(e.selected!.id, event.target.value)}
                />
              </label>
              <div className="ur__row">
                <span className="ur__label">Colour</span>
                {COLOURS.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    className={`ur__swatch ur__swatch--${colour} ${e.selected!.colour === colour ? 'is-on' : ''}`}
                    aria-label={colour}
                    aria-pressed={e.selected!.colour === colour}
                    onClick={() => e.setColour(e.selected!.id, colour)}
                  />
                ))}
                <button
                  type="button"
                  className="ur__btn"
                  aria-pressed={e.selected.pinned}
                  onClick={() => e.togglePin(e.selected!.id)}
                >
                  {e.selected.pinned ? 'Unpin' : 'Pin'}
                </button>
              </div>
            </>
          ) : (
            <p className="ur__muted">Select a note.</p>
          )}
        </div>

        <ol className="ur__history" aria-label="History">
          {e.history.past.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <span className="ur__num">{index + 1}</span> {entry.label}
            </li>
          ))}
          {e.history.future.map((entry, index) => (
            <li key={`future-${entry.at}-${index}`} className="is-future">
              <span className="ur__num">↷</span> {entry.label}
            </li>
          ))}
          {e.history.past.length === 0 && e.history.future.length === 0 && (
            <li className="ur__muted">Nothing to undo yet</li>
          )}
        </ol>
      </div>
    </section>
  );
}
