import type { MenuIndex, MenuNode, RouteResult } from '../nested-menu.types';

/**
 * Prune the tree to what this user may see. A forbidden node hides its whole subtree; a folder whose
 * children were all pruned disappears too (unless it is itself a page). O(n), one pass.
 */
export function filterByAccess(nodes: MenuNode[], permissions: ReadonlySet<string>): MenuNode[] {
  const visible: MenuNode[] = [];
  for (const node of nodes) {
    if (node.permission && !permissions.has(node.permission)) continue;
    if (!node.children) {
      visible.push(node);
      continue;
    }
    const children = filterByAccess(node.children, permissions);
    if (children.length === 0 && !node.route) continue; // an empty folder is noise
    visible.push({ ...node, children });
  }
  return visible;
}

/** One DFS, once per (tree, role). Iterative, so a deep tree cannot blow the stack. */
export function buildIndex(nodes: MenuNode[]): MenuIndex {
  const byId = new Map<string, MenuNode>();
  const parentOf = new Map<string, string | null>();
  const byRoute = new Map<string, string>();
  const stack: { node: MenuNode; parent: string | null }[] = nodes.map((node) => ({ node, parent: null }));

  while (stack.length) {
    const { node, parent } = stack.pop() as { node: MenuNode; parent: string | null };
    byId.set(node.id, node);
    parentOf.set(node.id, parent);
    if (node.route) byRoute.set(node.route, node.id);
    node.children?.forEach((child) => stack.push({ node: child, parent: node.id }));
  }
  return { byId, parentOf, byRoute };
}

/** Root → id, inclusive. O(depth) via the parent map. [] for an unknown id. */
export function pathTo(index: MenuIndex, id: string | null): string[] {
  const path: string[] = [];
  let current = id;
  while (current !== null && current !== undefined && index.byId.has(current)) {
    path.push(current);
    current = index.parentOf.get(current) ?? null;
  }
  return path.reverse();
}

/** The oracle: DFS with backtracking, O(n) per query. The check file diffs pathTo against it. */
export function findPathByDfs(nodes: MenuNode[], id: string, trail: string[] = []): string[] {
  for (const node of nodes) {
    const next = [...trail, node.id];
    if (node.id === id) return next;
    if (node.children) {
      const found = findPathByDfs(node.children, id, next);
      if (found.length) return found;
    }
  }
  return [];
}

/**
 * Accordion rule: at most one open node per level. So the whole open state is ONE root→node chain,
 * and toggling is just choosing a new chain:
 *   open X  -> pathTo(X): ancestors stay open, every sibling branch drops out
 *   close X -> the chain up to (not including) X: X and everything under it closes
 */
export function toggleOpen(index: MenuIndex, openPath: string[], id: string): string[] {
  const node = index.byId.get(id);
  if (!node?.children?.length) return openPath;
  const at = openPath.indexOf(id);
  return at === -1 ? pathTo(index, id) : openPath.slice(0, at);
}

/** The ids a user can currently see, in screen order — what Up/Down walks. */
export function visibleOrder(nodes: MenuNode[], open: ReadonlySet<string>): string[] {
  const order: string[] = [];
  const walk = (list: MenuNode[]) => {
    for (const node of list) {
      order.push(node.id);
      if (node.children && open.has(node.id)) walk(node.children);
    }
  };
  walk(nodes);
  return order;
}

/**
 * Route guard. Checks the FULL index too, so the user gets "no access" rather than "not found" for
 * a page that exists but is hidden from them.
 */
export function resolveRoute(visible: MenuIndex, full: MenuIndex, route: string): RouteResult {
  const normalised = route.trim().replace(/\/+$/, '') || '/';
  const id = visible.byRoute.get(normalised);
  if (id) return { kind: 'ok', id };
  if (full.byRoute.has(normalised)) return { kind: 'forbidden', route: normalised };
  return { kind: 'not-found', route: normalised };
}
