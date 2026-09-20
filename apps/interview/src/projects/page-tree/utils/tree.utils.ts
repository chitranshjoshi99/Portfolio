import type { PageNode, PageStore, PageSummary, RowWindow, TreeRow } from '../page-tree.types';

/** Insert fetched children under a parent. Returns a new store; nothing else is copied. */
export function mergeChildren(store: PageStore, parentId: string, children: PageSummary[]): PageStore {
  const next: PageStore = { ...store };
  for (const child of children) {
    const existing = store[child.id];
    next[child.id] = existing
      ? { ...existing, ...child } // re-fetch keeps an already-loaded subtree
      : { ...child, parentId, childIds: null, load: 'idle' };
  }
  const parent = store[parentId];
  if (parent) next[parentId] = { ...parent, childIds: children.map((c) => c.id), load: 'loaded' };
  return next;
}

export const setLoad = (store: PageStore, id: string, load: PageNode['load']): PageStore =>
  store[id] ? { ...store, [id]: { ...store[id], load } } : store;

/**
 * The flat, render-ready list. DFS that only descends into EXPANDED nodes, so the cost is the number of
 * visible rows — not the number of pages loaded. An expanded node whose children are loading or failed
 * gets a single placeholder row, so loading and error states sit in the tree where the children will go.
 */
export function visibleRows(store: PageStore, rootId: string, expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (parentId: string, depth: number) => {
    const parent = store[parentId];
    if (!parent?.childIds) return;
    const size = parent.childIds.length;
    parent.childIds.forEach((id, index) => {
      const node = store[id];
      rows.push({ kind: 'page', id, pageId: id, depth, posInSet: index + 1, setSize: size });
      if (!node?.hasChildren || !expanded.has(id)) return;
      if (node.load === 'loading' || node.load === 'idle') {
        rows.push({ kind: 'loading', id: `${id}:loading`, pageId: id, depth: depth + 1, posInSet: 1, setSize: 1 });
      } else if (node.load === 'error') {
        rows.push({ kind: 'error', id: `${id}:error`, pageId: id, depth: depth + 1, posInSet: 1, setSize: 1 });
      } else {
        walk(id, depth + 1);
      }
    });
  };
  walk(rootId, 1);
  return rows;
}

/** The oracle for visibleRows: a straightforward recursive render order over the same data. */
export function visibleIdsByRecursion(store: PageStore, parentId: string, expanded: ReadonlySet<string>): string[] {
  const parent = store[parentId];
  if (!parent?.childIds) return [];
  return parent.childIds.flatMap((id) => [
    id,
    ...(expanded.has(id) && store[id]?.load === 'loaded' ? visibleIdsByRecursion(store, id, expanded) : []),
  ]);
}

/** Only the rows inside the scrolled viewport (plus overscan) are rendered. */
export function windowRows(total: number, scrollTop: number, rowHeight: number, viewportHeight: number, overscan: number): RowWindow {
  const first = Math.floor(scrollTop / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(total, first + Math.ceil(viewportHeight / rowHeight) + overscan);
  return { start, end, offsetTop: start * rowHeight };
}

/**
 * APG tree type-ahead: the next PAGE row (after `from`, wrapping) whose title starts with `prefix`.
 * Returns -1 when nothing matches.
 */
export function typeaheadIndex(rows: TreeRow[], titles: (pageId: string) => string, from: number, prefix: string): number {
  const needle = prefix.toLowerCase();
  for (let step = 1; step <= rows.length; step += 1) {
    const index = (from + step) % rows.length;
    const row = rows[index];
    if (row.kind === 'page' && titles(row.pageId).toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
