import type { FileTree, NodeType, TreeNode } from '../file-explorer.types';

export const createNode = (name: string, type: NodeType): TreeNode => ({
  id: crypto.randomUUID(),
  name,
  type,
  ...(type === 'folder' ? { childIds: [] } : {}),
});

/** Folders first, then files, each case-insensitive alphabetical. The only ordering rule. */
const compareNodes = (a: TreeNode, b: TreeNode): number =>
  a.type === b.type
    ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    : a.type === 'folder'
      ? -1
      : 1;

/** O(1). This is the whole reason the tree is normalised. */
export const getNode = (tree: FileTree, id: string): TreeNode | undefined => tree.nodes.get(id);

/** O(1) too — the reverse edge is stored, never searched for. */
export const getParent = (tree: FileTree, id: string): TreeNode | undefined => {
  const parentId = tree.parentOf.get(id);
  return parentId === undefined ? undefined : tree.nodes.get(parentId);
};

/**
 * First index in `childIds` whose node is not ordered before `target`.
 * O(log c) comparisons: siblings are already sorted, so the slot is found, never searched for.
 */
const lowerBound = (nodes: Map<string, TreeNode>, childIds: string[], target: TreeNode): number => {
  let low = 0;
  let high = childIds.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (compareNodes(nodes.get(childIds[mid])!, target) < 0) low = mid + 1;
    else high = mid;
  }
  return low;
};

/**
 * The sibling with this name, if any. Two probes because a folder and a file with the same name
 * live in different halves of the sorted array — one binary search would miss the other half.
 */
export const findChildNamed = (
  tree: FileTree,
  parentId: string,
  name: string,
): TreeNode | undefined => {
  const parent = tree.nodes.get(parentId);
  if (!parent?.childIds) return undefined;
  const trimmed = name.trim();

  for (const type of ['folder', 'file'] as const) {
    const at = lowerBound(tree.nodes, parent.childIds, { id: '', name: trimmed, type });
    const hit = at < parent.childIds.length ? tree.nodes.get(parent.childIds[at]) : undefined;
    if (hit && hit.type === type && hit.name.localeCompare(trimmed, undefined, { sensitivity: 'base' }) === 0) {
      return hit;
    }
  }
  return undefined;
};

export const hasSiblingNamed = (
  tree: FileTree,
  parentId: string,
  name: string,
  ignoreId?: string,
): boolean => {
  const hit = findChildNamed(tree, parentId, name);
  return hit !== undefined && hit.id !== ignoreId;
};

const withChildIds = (parent: TreeNode, childIds: string[]): TreeNode => ({ ...parent, childIds });

const insertAt = (childIds: string[], at: number, id: string): string[] => [
  ...childIds.slice(0, at),
  id,
  ...childIds.slice(at),
];

/**
 * O(log c) to find the slot + O(c) to splice. No node outside the parent is touched, so every
 * other node object keeps its identity across the edit.
 */
export const addNode = (tree: FileTree, parentId: string, child: TreeNode): FileTree => {
  const parent = tree.nodes.get(parentId);
  if (!parent?.childIds) return tree; // files have no children — reject rather than silently nest

  const nodes = new Map(tree.nodes);
  nodes.set(child.id, child);
  const at = lowerBound(nodes, parent.childIds, child);
  nodes.set(parentId, withChildIds(parent, insertAt(parent.childIds, at, child.id)));

  const parentOf = new Map(tree.parentOf);
  parentOf.set(child.id, parentId);
  return { rootId: tree.rootId, nodes, parentOf };
};

/** O(c): the name changes, so the node may need to move within its (still sorted) siblings. */
export const renameNode = (tree: FileTree, id: string, name: string): FileTree => {
  const node = tree.nodes.get(id);
  if (!node) return tree;

  const renamed = { ...node, name };
  const nodes = new Map(tree.nodes);
  nodes.set(id, renamed);

  const parentId = tree.parentOf.get(id);
  if (parentId !== undefined) {
    const parent = nodes.get(parentId)!;
    const without = parent.childIds!.filter((childId) => childId !== id);
    const at = lowerBound(nodes, without, renamed);
    nodes.set(parentId, withChildIds(parent, insertAt(without, at, id)));
  }

  return { rootId: tree.rootId, nodes, parentOf: tree.parentOf };
};

/**
 * O(size of the removed subtree). Deleting the root is a no-op — the root folder always exists.
 * The descendants must be removed explicitly: in a normalised store, dropping the parent's edge
 * would leave every descendant in `nodes` forever. That leak is the classic normalisation bug.
 */
export const deleteNode = (tree: FileTree, id: string): FileTree => {
  if (id === tree.rootId || !tree.nodes.has(id)) return tree;

  const nodes = new Map(tree.nodes);
  const parentOf = new Map(tree.parentOf);

  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const node = nodes.get(current);
    if (!node) continue;
    if (node.childIds) stack.push(...node.childIds);
    nodes.delete(current);
    parentOf.delete(current);
  }

  const parentId = tree.parentOf.get(id);
  if (parentId !== undefined) {
    const parent = nodes.get(parentId)!;
    nodes.set(parentId, withChildIds(parent, parent.childIds!.filter((childId) => childId !== id)));
  }

  return { rootId: tree.rootId, nodes, parentOf };
};

export const collectFolderIds = (tree: FileTree): string[] =>
  [...tree.nodes.values()].filter((node) => node.type === 'folder').map((node) => node.id);

export const createInitialTree = (): FileTree => {
  const root = createNode('root', 'folder');
  const empty: FileTree = {
    rootId: root.id,
    nodes: new Map([[root.id, root]]),
    parentOf: new Map(),
  };

  const src = createNode('src', 'folder');
  const components = createNode('components', 'folder');

  const seed: [string, TreeNode][] = [
    [root.id, src],
    [src.id, components],
    [components.id, createNode('button.tsx', 'file')],
    [src.id, createNode('index.ts', 'file')],
    [root.id, createNode('package.json', 'file')],
    [root.id, createNode('README.md', 'file')],
  ];

  return seed.reduce((tree, [parentId, node]) => addNode(tree, parentId, node), empty);
};
