import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { DEFAULT_ROUTE, MENU, ROLES } from '../constants/nested-menu.constants';
import type { MenuIndex, MenuNode, RouteResult } from '../nested-menu.types';
import { buildIndex, filterByAccess, pathTo, resolveRoute, toggleOpen, visibleOrder } from '../utils/menu.utils';

/** The unfiltered tree never changes, so its index is built once at module load. */
const FULL_INDEX = buildIndex(MENU);

const parentChain = (index: MenuIndex, id: string) => pathTo(index, index.parentOf.get(id) ?? null);

export interface UseNestedMenu {
  roleId: string;
  changeRole: (roleId: string) => void;
  tree: MenuNode[];
  openSet: ReadonlySet<string>;
  activeId: string | null;
  activeTrail: ReadonlySet<string>;
  breadcrumb: MenuNode[];
  focusId: string | null;
  route: RouteResult;
  routeInput: string;
  setRouteInput: (value: string) => void;
  navigate: (route: string) => void;
  activate: (id: string) => void;
  onItemKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void;
  onItemFocus: (id: string) => void;
  registerItem: (id: string, element: HTMLElement | null) => void;
}

export function useNestedMenu(): UseNestedMenu {
  const [roleId, setRoleId] = useState('lead');
  const permissions = useMemo(
    () => new Set(ROLES.find((role) => role.id === roleId)?.permissions ?? []),
    [roleId],
  );
  // Re-filtered and re-indexed only when the role changes, never per click.
  const tree = useMemo(() => filterByAccess(MENU, permissions), [permissions]);
  const index = useMemo(() => buildIndex(tree), [tree]);

  const [route, setRoute] = useState<RouteResult>(() =>
    resolveRoute(buildIndex(filterByAccess(MENU, permissions)), FULL_INDEX, DEFAULT_ROUTE),
  );
  const [routeInput, setRouteInput] = useState(DEFAULT_ROUTE);
  const activeId = route.kind === 'ok' ? route.id : null;

  /** The ONLY open state: one root→node chain (accordion per level). Starts on the active path. */
  const [openPath, setOpenPath] = useState<string[]>(() => (activeId ? parentChain(FULL_INDEX, activeId) : []));
  const [focusId, setFocusId] = useState<string | null>(activeId);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  const openSet = useMemo(() => new Set(openPath), [openPath]);
  const activeTrail = useMemo(() => new Set(activeId ? pathTo(index, activeId) : []), [activeId, index]);
  const breadcrumb = useMemo(
    () => (activeId ? pathTo(index, activeId).map((id) => index.byId.get(id) as MenuNode) : []),
    [activeId, index],
  );
  const order = useMemo(() => visibleOrder(tree, openSet), [tree, openSet]);
  // If the focused item was just hidden (its branch closed), the Tab stop falls back to the first item.
  const effectiveFocus = focusId && order.includes(focusId) ? focusId : (order[0] ?? null);

  const focusItem = useCallback((id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    itemRefs.current.get(id)?.focus();
  }, []);

  const goTo = useCallback(
    (result: RouteResult, currentIndex: MenuIndex) => {
      setRoute(result);
      if (result.kind === 'ok') {
        setOpenPath(parentChain(currentIndex, result.id)); // expand exactly the active path
        setFocusId(result.id);
        const node = currentIndex.byId.get(result.id);
        if (node?.route) setRouteInput(node.route);
      }
    },
    [],
  );

  const navigate = useCallback(
    (value: string) => goTo(resolveRoute(index, FULL_INDEX, value), index),
    [goTo, index],
  );

  const activate = useCallback(
    (id: string) => {
      const node = index.byId.get(id);
      if (!node) return;
      if (node.children?.length) setOpenPath((current) => toggleOpen(index, current, id));
      else if (node.route) goTo({ kind: 'ok', id }, index);
    },
    [goTo, index],
  );

  const changeRole = useCallback(
    (nextRoleId: string) => {
      setRoleId(nextRoleId);
      const nextPermissions = new Set(ROLES.find((role) => role.id === nextRoleId)?.permissions ?? []);
      const nextIndex = buildIndex(filterByAccess(MENU, nextPermissions));
      // Re-check the page you are on: losing access must not leave you looking at it.
      const currentRoute = route.kind === 'ok' ? FULL_INDEX.byId.get(route.id)?.route : route.route;
      if (currentRoute) goTo(resolveRoute(nextIndex, FULL_INDEX, currentRoute), nextIndex);
    },
    [goTo, route],
  );

  const onItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, id: string) => {
      const at = order.indexOf(id);
      const node = index.byId.get(id);
      const isOpen = openSet.has(id);
      switch (event.key) {
        case 'ArrowDown':
          focusItem(order[at + 1]);
          break;
        case 'ArrowUp':
          focusItem(order[at - 1]);
          break;
        case 'Home':
          focusItem(order[0]);
          break;
        case 'End':
          focusItem(order[order.length - 1]);
          break;
        case 'ArrowRight':
          if (node?.children?.length && !isOpen) setOpenPath((current) => toggleOpen(index, current, id));
          else if (isOpen) focusItem(node?.children?.[0]?.id);
          break;
        case 'ArrowLeft':
          if (isOpen) setOpenPath((current) => toggleOpen(index, current, id));
          else focusItem(index.parentOf.get(id) ?? undefined);
          break;
        default:
          return; // Enter/Space: the native button/link click does the work
      }
      event.preventDefault();
    },
    [focusItem, index, openSet, order],
  );

  const registerItem = useCallback((id: string, element: HTMLElement | null) => {
    if (element) itemRefs.current.set(id, element);
    else itemRefs.current.delete(id);
  }, []);

  return {
    roleId,
    changeRole,
    tree,
    openSet,
    activeId,
    activeTrail,
    breadcrumb,
    focusId: effectiveFocus,
    route,
    routeInput,
    setRouteInput,
    navigate,
    activate,
    onItemKeyDown,
    onItemFocus: setFocusId,
    registerItem,
  };
}
