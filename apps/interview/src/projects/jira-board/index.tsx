import { useState } from 'react';
import { BoardColumn } from './components/board-column';
import { ASSIGNEES } from './constants/jira-board.constants';
import { useBoard } from './hooks/use-board';
import './jira-board.css';

export default function JiraBoardPage() {
  const b = useBoard();
  const [newColumn, setNewColumn] = useState('');

  return (
    <section className="jb">
      <div className="jb__toolbar">
        <input
          className="jb__search"
          type="search"
          placeholder="Filter by key or summary…"
          aria-label="Filter issues"
          value={b.filter.text}
          onChange={(event) => b.setFilter({ ...b.filter, text: event.target.value })}
        />
        <div className="jb__avatars" role="group" aria-label="Filter by assignee">
          {ASSIGNEES.map((name) => (
            <button
              key={name}
              type="button"
              className={`jb__avatar-btn ${b.filter.assignee === name ? 'is-on' : ''}`}
              aria-pressed={b.filter.assignee === name}
              onClick={() => b.setFilter({ ...b.filter, assignee: b.filter.assignee === name ? null : name })}
            >
              {name[0]}
            </button>
          ))}
        </div>
        <form
          className="jb__add"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newColumn.trim()) return;
            b.addColumn(newColumn.trim());
            setNewColumn('');
          }}
        >
          <input
            value={newColumn}
            placeholder="New column…"
            aria-label="New column title"
            onChange={(event) => setNewColumn(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
        <button type="button" className="jb__btn" onClick={b.simulateRemoteMove}>
          Another user moves a card
        </button>
        <button type="button" className="jb__btn" onClick={b.failNext}>
          Fail next save
        </button>
        <span className="jb__pending">{b.pending > 0 ? `saving ${b.pending}…` : 'saved'}</span>
      </div>

      <p className="jb__hint">
        Drag a card, or focus one and press <kbd>Alt</kbd> + arrows. Moves save optimistically and roll back on
        failure.
      </p>

      <div className="jb__columns">
        {b.views.map((view) => (
          <BoardColumn
            key={view.id}
            view={view}
            draggingId={b.drag?.issueId ?? null}
            dropIndex={b.drag?.overColumnId === view.id ? b.drag.overIndex : null}
            selectedId={b.selectedId}
            onDragStart={(event, issueId) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', issueId); // required by Firefox
              b.setDrag({ issueId, overColumnId: null, overIndex: null });
            }}
            onDragEnd={() => b.setDrag(null)}
            onDragOverColumn={(columnId, index) =>
              b.setDrag((current) =>
                current && (current.overColumnId !== columnId || current.overIndex !== index)
                  ? { ...current, overColumnId: columnId, overIndex: index }
                  : current,
              )
            }
            onDrop={(columnId, index) => {
              if (b.drag) b.commitMove(b.drag.issueId, { columnId, index });
              b.setDrag(null);
            }}
            onCardKeyDown={b.onCardKeyDown}
            onSelect={b.setSelectedId}
            onWipChange={b.setWipLimit}
            onRename={b.renameColumn}
          />
        ))}
      </div>

      <p className="jb__sr" role="status" aria-live="polite">
        {b.announcement}
      </p>

      <div className="jb__foot">
        <ol className="jb__log">
          {b.log.map((line, index) => (
            <li key={`${line}-${index}`} className={line.startsWith('✗') ? 'is-error' : undefined}>
              {line}
            </li>
          ))}
          {b.log.length === 0 && <li className="jb__muted">PUT /rest/agile/1.0/issue/rank — move a card</li>}
        </ol>
        <ul className="jb__toasts">
          {b.toasts.map((toast) => (
            <li key={toast.id} className={toast.kind === 'error' ? 'is-error' : undefined}>
              {toast.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
