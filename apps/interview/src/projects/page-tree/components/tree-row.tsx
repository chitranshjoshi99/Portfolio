import type { KeyboardEvent } from 'react';
import { ROW_HEIGHT } from '../constants/page-tree.constants';
import type { PageNode, TreeRow } from '../page-tree.types';

interface TreeRowProps {
  row: TreeRow;
  node: PageNode | undefined;
  isExpanded: boolean;
  isSelected: boolean;
  isTabStop: boolean;
  top: number;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, rowId: string) => void;
  onFocus: (rowId: string) => void;
  registerRow: (id: string, element: HTMLElement | null) => void;
}

/** One absolutely positioned line of the flat tree. Nesting is expressed by aria-level, not by DOM nesting. */
export function TreeRowView(props: TreeRowProps) {
  const { row, node, isExpanded, isSelected, isTabStop, top, onToggle, onSelect, onRetry, onKeyDown, onFocus, registerRow } = props;
  const style = { top, height: ROW_HEIGHT, paddingLeft: 8 + (row.depth - 1) * 18 };

  if (row.kind === 'loading') {
    return (
      <div className="pt__row pt__row--status" style={style} role="none">
        <span className="pt__spinner" aria-hidden="true" /> Loading…
      </div>
    );
  }
  if (row.kind === 'error') {
    return (
      <div className="pt__row pt__row--status pt__row--error" style={style} role="none">
        Couldn’t load pages.{' '}
        <button type="button" className="pt__retry" onClick={() => onRetry(row.pageId)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={(element) => registerRow(row.id, element)}
      role="treeitem"
      aria-level={row.depth}
      aria-setsize={row.setSize}
      aria-posinset={row.posInSet}
      aria-expanded={node?.hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-busy={node?.load === 'loading' || undefined}
      tabIndex={isTabStop ? 0 : -1}
      className={`pt__row ${isSelected ? 'is-selected' : ''}`}
      style={style}
      onKeyDown={(event) => onKeyDown(event, row.id)}
      onFocus={() => onFocus(row.id)}
      onClick={() => onSelect(row.pageId)}
    >
      {node?.hasChildren ? (
        <span
          className={`pt__chevron ${isExpanded ? 'is-open' : ''}`}
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation(); // the chevron toggles; the title selects
            onToggle(row.pageId);
          }}
        >
          ▸
        </span>
      ) : (
        <span className="pt__chevron" aria-hidden="true" />
      )}
      <span className="pt__title">{node?.title}</span>
    </div>
  );
}
