import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_SIZE } from '../constants/karat-todos.constants';
import type { PatchMap, Todo, UserGroup } from '../karat-todos.types';
import { failureControl, fetchTodos } from '../utils/todo-api';
import { loadPatches, savePatches } from '../utils/todo-storage';
import { appendToGroups, applyPatch, setPatch, sortByStatus } from '../utils/todos.utils';

type Status = 'idle' | 'loading' | 'error';

export interface UseTodos {
  groups: UserGroup[];
  loaded: number;
  total: number | null;
  status: Status;
  error: string | null;
  canLoadMore: boolean;
  patches: PatchMap;
  editedCount: number;
  openFirst: boolean;
  editingId: number | null;
  loadMore: () => void;
  toggle: (id: number) => void;
  startEdit: (id: number) => void;
  saveEdit: (id: number, text: string) => void;
  cancelEdit: () => void;
  resetEdits: () => void;
  setOpenFirst: (value: boolean) => void;
  failNextRequest: () => void;
}

export function useTodos(): UseTodos {
  /** Server rows, grouped as they arrive. Never edited — edits live in `patches`. */
  const [serverGroups, setServerGroups] = useState<UserGroup[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [patches, setPatches] = useState<PatchMap>(loadPatches);
  const [openFirst, setOpenFirst] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  /** One request at a time; a second click on "Load more" must not fetch the same page twice. */
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => savePatches(patches), [patches]);

  const loadPage = useCallback((skip: number) => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus('loading');
    setError(null);
    fetchTodos(PAGE_SIZE, skip, controller.signal)
      .then((page) => {
        setServerGroups((current) => appendToGroups(current, page.todos));
        setLoaded(skip + page.todos.length);
        setTotal(page.total);
        setStatus('idle');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setStatus('error');
        setError(reason instanceof Error ? reason.message : 'Could not load todos');
      })
      .finally(() => {
        if (inFlight.current === controller) inFlight.current = null;
      });
  }, []);

  // First page on mount; abort on unmount (StrictMode mounts twice — the first request is cancelled).
  useEffect(() => {
    loadPage(0);
    return () => {
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [loadPage]);

  const byId = useMemo(() => {
    const map = new Map<number, Todo>();
    serverGroups.forEach((group) => group.todos.forEach((todo) => map.set(todo.id, todo)));
    return map;
  }, [serverGroups]);

  const groups = useMemo(
    () =>
      serverGroups.map((group) => {
        const todos = group.todos.map((todo) => applyPatch(todo, patches));
        return { userId: group.userId, todos: openFirst ? sortByStatus(todos) : todos };
      }),
    [serverGroups, patches, openFirst],
  );

  const edit = useCallback(
    (id: number, change: Parameters<typeof setPatch>[2]) => {
      const original = byId.get(id);
      if (original) setPatches((current) => setPatch(current, original, change));
    },
    [byId],
  );

  const toggle = useCallback(
    (id: number) => {
      const original = byId.get(id);
      if (!original) return;
      const current = applyPatch(original, patches);
      edit(id, { completed: !current.completed });
    },
    [byId, edit, patches],
  );

  const saveEdit = useCallback(
    (id: number, text: string) => {
      const trimmed = text.trim();
      if (trimmed) edit(id, { todo: trimmed }); // empty text is a cancel, not a blank todo
      setEditingId(null);
    },
    [edit],
  );

  return {
    groups,
    loaded,
    total,
    status,
    error,
    canLoadMore: total === null || loaded < total,
    patches,
    editedCount: Object.keys(patches).length,
    openFirst,
    editingId,
    loadMore: () => loadPage(loaded),
    toggle,
    startEdit: setEditingId,
    saveEdit,
    cancelEdit: () => setEditingId(null),
    resetEdits: () => setPatches({}),
    setOpenFirst,
    failNextRequest: () => {
      failureControl.failNext = true;
    },
  };
}
