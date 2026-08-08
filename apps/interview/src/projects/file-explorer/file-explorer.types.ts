export type NodeType = 'file' | 'folder';

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  /**
   * Folders only. Ids, not nodes — the nesting lives in the index, not in the object graph.
   * Kept sorted (folders before files, then case-insensitive alphabetical) so rendering never sorts.
   */
  childIds?: string[];
}

/**
 * Normalised tree. `nodes` is flat, so lookup by id is O(1); `parentOf` is the reverse edge, so
 * "who is this node's parent" is O(1) instead of a search from the root.
 */
export interface FileTree {
  rootId: string;
  nodes: Map<string, TreeNode>;
  parentOf: Map<string, string>;
}

/** What the inline input is currently doing. `null` = nothing being edited. */
export type Draft =
  | { mode: 'create'; parentId: string; type: NodeType; name: string }
  | { mode: 'rename'; nodeId: string; name: string };
