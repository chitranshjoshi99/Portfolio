import { Fragment, useRef, type DragEvent, type KeyboardEvent } from 'react';
import type { ColumnView } from '../utils/board.utils';
import { dropIndexFromMidpoints } from '../utils/board.utils';
import { IssueCard } from './issue-card';

interface BoardColumnProps {
  view: ColumnView;
  draggingId: string | null;
  dropIndex: number | null;
  selectedId: string | null;
  onDragStart: (event: DragEvent<HTMLElement>, issueId: string) => void;
  onDragEnd: () => void;
  onDragOverColumn: (columnId: string, index: number) => void;
  onDrop: (columnId: string, index: number) => void;
  onCardKeyDown: (event: KeyboardEvent<HTMLElement>, issueId: string) => void;
  onSelect: (issueId: string) => void;
  onWipChange: (columnId: string, limit: number | null) => void;
  onRename: (columnId: string, title: string) => void;
}

export function BoardColumn(props: BoardColumnProps) {
  const { view, draggingId, dropIndex, selectedId, onDragOverColumn, onDrop, onWipChange, onRename } = props;
  const listRef = useRef<HTMLUListElement>(null);

  /** Drop position from the midpoints of the cards currently rendered — measured, not guessed. */
  const indexFromEvent = (event: DragEvent<HTMLElement>): number => {
    const cards = Array.from(listRef.current?.querySelectorAll('.jb__card') ?? []);
    const midpoints = cards.map((card) => {
      const box = card.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    return dropIndexFromMidpoints(midpoints, event.clientY);
  };

  return (
    <section
      className={`jb__column ${view.overWip ? 'is-over-wip' : ''}`}
      aria-label={`${view.title}, ${view.issues.length} issues`}
      onDragOver={(event) => {
        event.preventDefault(); // without this the drop event never fires
        event.dataTransfer.dropEffect = 'move';
        onDragOverColumn(view.id, indexFromEvent(event));
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(view.id, indexFromEvent(event));
      }}
    >
      <header className="jb__column-head">
        <input
          className="jb__column-title"
          value={view.title}
          aria-label={`Rename ${view.title}`}
          onChange={(event) => onRename(view.id, event.target.value)}
        />
        <span className={`jb__count ${view.overWip ? 'is-over' : ''}`}>
          {view.issues.length}
          {view.wipLimit !== null && ` / ${view.wipLimit}`}
        </span>
        <label className="jb__wip">
          WIP
          <input
            type="number"
            min={0}
            value={view.wipLimit ?? ''}
            placeholder="–"
            aria-label={`WIP limit for ${view.title}`}
            onChange={(event) => onWipChange(view.id, event.target.value === '' ? null : Number(event.target.value))}
          />
        </label>
      </header>
      <p className="jb__column-meta">
        {view.points} pts{view.hiddenCount > 0 && ` · ${view.hiddenCount} hidden by filter`}
      </p>

      <ul className="jb__list" ref={listRef}>
        {view.issues.map((issue, index) => (
          <Fragment key={issue.id}>
            {draggingId && dropIndex === index && <li className="jb__indicator" aria-hidden="true" />}
            <IssueCard
              issue={issue}
              isDragging={draggingId === issue.id}
              isSelected={selectedId === issue.id}
              onDragStart={props.onDragStart}
              onDragEnd={props.onDragEnd}
              onKeyDown={props.onCardKeyDown}
              onSelect={props.onSelect}
            />
          </Fragment>
        ))}
        {draggingId && dropIndex === view.issues.length && <li className="jb__indicator" aria-hidden="true" />}
        {view.issues.length === 0 && <li className="jb__empty">No issues</li>}
      </ul>
    </section>
  );
}
