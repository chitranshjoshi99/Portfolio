import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';
import { OVERSCAN, ROOT_ID, ROW_HEIGHT, TYPEAHEAD_RESET_MS, VIEWPORT_HEIGHT } from '../constants/page-tree.constants';
import type { PageStore } from '../page-tree.types';
import { apiControl, fetchChildren } from '../utils/page-api';
import { mergeChildren, setLoad, typeaheadIndex, visibleRows, windowRows } from '../utils/tree.utils';

const INITIAL: PageStore = {
  [ROOT_ID]: { id: ROOT_ID, title: 'Space', hasChildren: true, parentId: null, childIds: null, load: 'idle' },
};

export function usePageTree() {
  const [store, setStore] = useState<PageStore>(INITIAL);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [requests, setRequests] = useState(0);

  /** Refs, not state: bookkeeping that must not re-render. */
  const inFlight = useRef(new Map<string, Promise<void>>()); // parentId → pending load (dedupe)
  const storeRef = useRef(store); // latest store for async callbacks
  storeRef.current = store;
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);
  const typeahead = useRef({ buffer: '', timer: 0 as ReturnType<typeof setTimeout> | 0 });

  const loadChildren = useCallback((parentId: string): Promise<void> => {
    const node = storeRef.current[parentId];
    if (!node || node.load === 'loaded') return Promise.resolve();
    const pending = inFlight.current.get(parentId);
    if (pending) return pending; // double-click / re-expand while loading = same request

    setStore((current) => setLoad(current, parentId, 'loading'));
    const request = fetchChildren(parentId)
      .then((children) => setStore((current) => mergeChildren(current, parentId, children)))
      .catch(() => setStore((current) => setLoad(current, parentId, 'error')))
      .finally(() => {
        inFlight.current.delete(parentId);
        setRequests(apiControl.requests);
      });
    inFlight.current.set(parentId, request);
    setRequests(apiControl.requests);
    return request;
  }, []);

  useEffect(() => {
    void loadChildren(ROOT_ID);
  }, [loadChildren]);

  const rows = useMemo(() => visibleRows(store, ROOT_ID, expanded), [store, expanded]);
  const indexOf = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows]);
  const rowWindow = windowRows(rows.length, scrollTop, ROW_HEIGHT, VIEWPORT_HEIGHT, OVERSCAN);
  const tabStop = focusedId && indexOf.has(focusedId) ? focusedId : (rows.find((r) => r.kind === 'page')?.id ?? null);
  /**
   * The window, plus the tab-stop row if it has scrolled out: a virtualised tree whose only tabIndex=0
   * row is not in the DOM cannot be entered with Tab at all.
   */
  const rendered = useMemo(() => {
    const indexes: number[] = [];
    for (let i = rowWindow.start; i < rowWindow.end; i += 1) indexes.push(i);
    const stop = tabStop ? indexOf.get(tabStop) : undefined;
    if (stop !== undefined && (stop < rowWindow.start || stop >= rowWindow.end)) indexes.push(stop);
    return indexes.map((index) => ({ row: rows[index], index }));
  }, [indexOf, rowWindow.end, rowWindow.start, rows, tabStop]);

  const expand = useCallback(
    (id: string) => {
      setExpanded((current) => (current.has(id) ? current : new Set(current).add(id)));
      void loadChildren(id);
    },
    [loadChildren],
  );

  const collapse = useCallback((id: string) => {
    setExpanded((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => (expanded.has(id) ? collapse(id) : expand(id)), [collapse, expand, expanded]);

  /** Focus a row that may not be rendered yet (virtualised): scroll it into the window, focus after render. */
  const focusRow = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      setFocusedId(row.id);
      const viewport = viewportRef.current;
      if (viewport) {
        const top = index * ROW_HEIGHT;
        if (top < viewport.scrollTop) viewport.scrollTop = top;
        else if (top + ROW_HEIGHT > viewport.scrollTop + VIEWPORT_HEIGHT) viewport.scrollTop = top + ROW_HEIGHT - VIEWPORT_HEIGHT;
        setScrollTop(viewport.scrollTop);
      }
      pendingFocus.current = row.id;
    },
    [rows],
  );

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const element = rowRefs.current.get(pendingFocus.current);
    if (element) {
      element.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  });

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, rowId: string) => {
      const index = indexOf.get(rowId) ?? 0;
      const row = rows[index];
      const node = store[row.pageId];
      const step = (dir: 1 | -1) => {
        for (let i = index + dir; i >= 0 && i < rows.length; i += dir) if (rows[i].kind === 'page') return focusRow(i);
      };
      switch (event.key) {
        case 'ArrowDown':
          step(1);
          break;
        case 'ArrowUp':
          step(-1);
          break;
        case 'Home':
          focusRow(0);
          break;
        case 'End':
          focusRow(rows.length - 1);
          break;
        case 'ArrowRight':
          if (node?.hasChildren && !expanded.has(node.id)) expand(node.id);
          else if (node?.hasChildren && rows[index + 1]?.depth > row.depth) focusRow(index + 1);
          break;
        case 'ArrowLeft':
          if (node?.hasChildren && expanded.has(node.id)) collapse(node.id);
          else if (node?.parentId && node.parentId !== ROOT_ID) focusRow(indexOf.get(node.parentId) ?? index);
          break;
        case 'Enter':
        case ' ':
          setSelectedId(row.pageId);
          break;
        case '*': {
          // APG: expand every sibling at this level
          const siblings = store[node?.parentId ?? ROOT_ID]?.childIds ?? [];
          siblings.filter((id) => store[id]?.hasChildren).forEach(expand);
          break;
        }
        default: {
          if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
          const state = typeahead.current;
          if (state.timer) clearTimeout(state.timer);
          state.buffer += event.key;
          state.timer = setTimeout(() => {
            state.buffer = '';
            state.timer = 0;
          }, TYPEAHEAD_RESET_MS);
          // single repeated letter cycles; a longer buffer searches from the current row
          const from = state.buffer.length === 1 ? index : index - 1;
          const match = typeaheadIndex(rows, (id) => store[id]?.title ?? '', from, state.buffer);
          if (match >= 0) focusRow(match);
        }
      }
      event.preventDefault();
    },
    [collapse, expand, expanded, focusRow, indexOf, rows, store],
  );

  const registerRow = useCallback((id: string, element: HTMLElement | null) => {
    if (element) rowRefs.current.set(id, element);
    else rowRefs.current.delete(id);
  }, []);

  return {
    store,
    rows,
    rendered,
    totalHeight: rows.length * ROW_HEIGHT,
    expanded,
    selectedId,
    tabStop,
    requests,
    viewportRef,
    onScroll: (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop),
    toggle,
    select: setSelectedId,
    retry: (id: string) => void loadChildren(id),
    onRowKeyDown,
    onRowFocus: setFocusedId,
    registerRow,
    failNext: () => {
      apiControl.failNext = true;
    },
    renderedCount: rendered.length,
  };
}
