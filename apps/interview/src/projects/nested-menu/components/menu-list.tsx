import type { KeyboardEvent } from 'react';
import type { MenuNode } from '../nested-menu.types';

interface MenuListProps {
  nodes: MenuNode[];
  depth: number;
  openSet: ReadonlySet<string>;
  activeId: string | null;
  activeTrail: ReadonlySet<string>;
  focusId: string | null;
  onActivate: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void;
  onFocus: (id: string) => void;
  registerItem: (id: string, element: HTMLElement | null) => void;
}

/** Recursive: a list renders itself for every open child. Depth only drives indentation. */
export function MenuList(props: MenuListProps) {
  const { nodes, depth, openSet, activeId, activeTrail, focusId, onActivate, onKeyDown, onFocus, registerItem } =
    props;

  return (
    <ul className="nm__list" role="list">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isOpen = openSet.has(node.id);
        const isActive = node.id === activeId;
        const onTrail = activeTrail.has(node.id) && !isActive;
        const classes = ['nm__item'];
        if (isActive) classes.push('nm__item--active');
        if (onTrail) classes.push('nm__item--trail');
        const common = {
          ref: (element: HTMLElement | null) => registerItem(node.id, element),
          className: classes.join(' '),
          style: { paddingLeft: 10 + depth * 16 },
          tabIndex: node.id === focusId ? 0 : -1,
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, node.id),
          onFocus: () => onFocus(node.id),
        };

        return (
          <li key={node.id}>
            {hasChildren ? (
              <button
                {...common}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`nm-${node.id}`}
                onClick={() => onActivate(node.id)}
              >
                <span className={`nm__chevron ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
                  ▸
                </span>
                {node.label}
              </button>
            ) : (
              <a
                {...common}
                href={`#${node.route ?? ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault(); // routing is ours; the href keeps "open in new tab" meaningful
                  onActivate(node.id);
                }}
              >
                <span className="nm__chevron" aria-hidden="true" />
                {node.label}
              </a>
            )}
            {hasChildren && isOpen && (
              <div id={`nm-${node.id}`}>
                <MenuList {...props} nodes={node.children ?? []} depth={depth + 1} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
