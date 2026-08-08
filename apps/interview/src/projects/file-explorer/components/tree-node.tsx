import type { UseFileTree } from '../hooks/use-file-tree';
import { DRAFT_PLACEHOLDER } from '../constants/file-explorer.constants';
import { NameInput } from './name-input';
import { NodeRow } from './node-row';

interface TreeNodeProps {
  /** Ids, not nodes — the component resolves through the store, so nothing here goes stale. */
  nodeId: string;
  tree: UseFileTree;
}

export function TreeNode({ nodeId, tree }: TreeNodeProps) {
  const { draft, expandedIds, changeDraftName, commitDraft, cancelDraft } = tree;
  const node = tree.getNode(nodeId);
  if (!node) return null;

  const isExpanded = expandedIds.has(node.id);
  const isCreatingHere = draft?.mode === 'create' && draft.parentId === node.id;

  return (
    <li className="explorer__node">
      <NodeRow node={node} isExpanded={isExpanded} tree={tree} />

      {node.type === 'folder' && isExpanded && (
        <ul className="explorer__children">
          {isCreatingHere && (
            <li className="explorer__node">
              <div className="explorer__row">
                <NameInput
                  value={draft.name}
                  placeholder={DRAFT_PLACEHOLDER[draft.type]}
                  onChange={changeDraftName}
                  onCommit={commitDraft}
                  onCancel={cancelDraft}
                />
              </div>
            </li>
          )}
          {node.childIds?.map((childId) => (
            <TreeNode key={childId} nodeId={childId} tree={tree} />
          ))}
        </ul>
      )}
    </li>
  );
}
