import type { TreeNode } from '../file-explorer.types';
import type { UseFileTree } from '../hooks/use-file-tree';
import { CHEVRON, NODE_ICON } from '../constants/file-explorer.constants';
import { NameInput } from './name-input';

interface NodeRowProps {
  node: TreeNode;
  isExpanded: boolean;
  tree: UseFileTree;
}

export function NodeRow({ node, isExpanded, tree }: NodeRowProps) {
  const { draft, toggleFolder, startCreate, startRename, changeDraftName, commitDraft, cancelDraft, removeNode } = tree;
  const isFolder = node.type === 'folder';
  // ponytail: `childIds` is the only nesting signal — a folder with no children is still a folder.
  const isRenaming = draft?.mode === 'rename' && draft.nodeId === node.id;

  if (isRenaming) {
    return (
      <div className="explorer__row">
        <NameInput
          value={draft.name}
          placeholder="Rename"
          onChange={changeDraftName}
          onCommit={commitDraft}
          onCancel={cancelDraft}
        />
      </div>
    );
  }

  return (
    <div className="explorer__row">
      <button
        type="button"
        className="explorer__label"
        aria-expanded={isFolder ? isExpanded : undefined}
        onClick={() => isFolder && toggleFolder(node.id)}
      >
        <span className="explorer__chevron">
          {isFolder ? (isExpanded ? CHEVRON.expanded : CHEVRON.collapsed) : ''}
        </span>
        <span className="explorer__icon">{NODE_ICON[node.type]}</span>
        <span className="explorer__name">{node.name}</span>
      </button>

      <span className="explorer__actions">
        {isFolder && (
          <>
            <button type="button" title="New file" aria-label={`New file in ${node.name}`} onClick={() => startCreate(node.id, 'file')}>
              ＋📄
            </button>
            <button type="button" title="New folder" aria-label={`New folder in ${node.name}`} onClick={() => startCreate(node.id, 'folder')}>
              ＋📁
            </button>
          </>
        )}
        <button type="button" title="Rename" aria-label={`Rename ${node.name}`} onClick={() => startRename(node)}>
          ✏️
        </button>
        <button type="button" title="Delete" aria-label={`Delete ${node.name}`} onClick={() => removeNode(node.id)}>
          🗑️
        </button>
      </span>
    </div>
  );
}
