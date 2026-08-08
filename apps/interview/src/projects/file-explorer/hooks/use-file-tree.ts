import { useCallback, useState } from 'react';
import type { Draft, FileTree, NodeType, TreeNode } from '../file-explorer.types';
import { CONFIRM_DELETE, ERROR } from '../constants/file-explorer.constants';
import {
  addNode,
  collectFolderIds,
  createInitialTree,
  createNode,
  deleteNode,
  getNode,
  hasSiblingNamed,
  renameNode,
} from '../utils/file-tree.utils';

export interface UseFileTree {
  tree: FileTree;
  /** O(1) — components resolve child ids through this instead of holding nested nodes. */
  getNode: (id: string) => TreeNode | undefined;
  expandedIds: Set<string>;
  draft: Draft | null;
  error: string | null;
  toggleFolder: (id: string) => void;
  startCreate: (parentId: string, type: NodeType) => void;
  startRename: (node: TreeNode) => void;
  changeDraftName: (name: string) => void;
  commitDraft: () => void;
  cancelDraft: () => void;
  removeNode: (id: string) => void;
}

/** Returns an error message, or null when the name is usable. */
const validateName = (
  tree: FileTree,
  parentId: string,
  name: string,
  ignoreId?: string,
): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return ERROR.empty;
  if (trimmed.includes('/')) return ERROR.slash;
  if (hasSiblingNamed(tree, parentId, trimmed, ignoreId)) return ERROR.duplicate(trimmed);
  return null;
};

export function useFileTree(): UseFileTree {
  const [tree, setTree] = useState<FileTree>(createInitialTree);
  // Start with every folder open so the demo tree is visible on load.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(collectFolderIds(tree)));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expand = useCallback((id: string) => {
    setExpandedIds((current) => new Set(current).add(id));
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const startCreate = useCallback(
    (parentId: string, type: NodeType) => {
      setError(null);
      setDraft({ mode: 'create', parentId, type, name: '' });
      expand(parentId);
    },
    [expand],
  );

  const startRename = useCallback((node: TreeNode) => {
    setError(null);
    setDraft({ mode: 'rename', nodeId: node.id, name: node.name });
  }, []);

  const changeDraftName = useCallback((name: string) => {
    setError(null);
    setDraft((current) => (current ? { ...current, name } : current));
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  const commitDraft = useCallback(() => {
    if (!draft) return;
    const name = draft.name.trim();

    if (draft.mode === 'create') {
      if (!tree.nodes.has(draft.parentId)) return;
      const message = validateName(tree, draft.parentId, name);
      if (message) return setError(message);
      setTree(addNode(tree, draft.parentId, createNode(name, draft.type)));
    } else {
      const parentId = tree.parentOf.get(draft.nodeId);
      if (parentId === undefined) return;
      const message = validateName(tree, parentId, name, draft.nodeId);
      if (message) return setError(message);
      setTree(renameNode(tree, draft.nodeId, name));
    }

    setDraft(null);
    setError(null);
  }, [draft, tree]);

  const removeNode = useCallback(
    (id: string) => {
      const node = tree.nodes.get(id);
      if (!node) return;
      if (node.childIds?.length && !window.confirm(CONFIRM_DELETE(node.name))) return;

      setTree(deleteNode(tree, id));
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setDraft(null);
      setError(null);
    },
    [tree],
  );

  const readNode = useCallback((id: string) => getNode(tree, id), [tree]);

  return {
    tree,
    getNode: readNode,
    expandedIds,
    draft,
    error,
    toggleFolder,
    startCreate,
    startRename,
    changeDraftName,
    commitDraft,
    cancelDraft,
    removeNode,
  };
}
