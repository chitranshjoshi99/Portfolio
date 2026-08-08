import { TreeNode } from './components/tree-node';
import { useFileTree } from './hooks/use-file-tree';
import './file-explorer.css';

export default function FileExplorerPage() {
  const tree = useFileTree();

  return (
    <section className="explorer">
      <ul className="explorer__tree" role="tree" aria-label="File explorer">
        <TreeNode nodeId={tree.tree.rootId} tree={tree} />
      </ul>
      {tree.error && (
        <p className="explorer__error" role="alert">
          {tree.error}
        </p>
      )}
    </section>
  );
}
