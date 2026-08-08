/**
 * ponytail: no test framework installed — run with `node src/projects/file-explorer/utils/file-tree.utils.check.ts`.
 * Swap for vitest when a second project needs real tests.
 */
import assert from 'node:assert/strict';
import type { FileTree } from '../file-explorer.types.ts';
import {
  addNode,
  collectFolderIds,
  createInitialTree,
  createNode,
  deleteNode,
  getNode,
  getParent,
  hasSiblingNamed,
  renameNode,
} from './file-tree.utils.ts';

const childNames = (tree: FileTree, id: string) =>
  getNode(tree, id)!.childIds!.map((childId) => getNode(tree, childId)!.name);

const idNamed = (tree: FileTree, parentId: string, name: string) =>
  getNode(tree, parentId)!.childIds!.find((childId) => getNode(tree, childId)!.name === name)!;

const tree = createInitialTree();
const srcId = idNamed(tree, tree.rootId, 'src');
const componentsId = idNamed(tree, srcId, 'components');

// the seed itself proves sorted insertion: folders first, then files, alphabetical
assert.deepEqual(childNames(tree, tree.rootId), ['src', 'package.json', 'README.md']);
assert.deepEqual(childNames(tree, srcId), ['components', 'index.ts']);

// add into a nested folder, original tree untouched (immutability)
const withAdded = addNode(tree, componentsId, createNode('input.tsx', 'file'));
assert.equal(getNode(withAdded, componentsId)!.childIds!.length, 2);
assert.equal(getNode(tree, componentsId)!.childIds!.length, 1);

// structural sharing: untouched nodes keep object identity across an edit
assert.equal(getNode(withAdded, srcId), getNode(tree, srcId));
assert.notEqual(getNode(withAdded, componentsId), getNode(tree, componentsId));

// insertion is sorted at write time — rendering never sorts
const withFolder = addNode(withAdded, componentsId, createNode('nested', 'folder'));
assert.deepEqual(childNames(withFolder, componentsId), ['nested', 'button.tsx', 'input.tsx']);

// rename moves the node to its new slot among siblings, and touches nothing else
const renamed = renameNode(withFolder, componentsId, 'ui');
assert.equal(getNode(renamed, componentsId)!.name, 'ui');
assert.equal(getNode(renamed, srcId)!.name, 'src');
const buttonId = idNamed(withFolder, componentsId, 'button.tsx');
assert.deepEqual(childNames(renameNode(renamed, buttonId, 'zzz.tsx'), componentsId), [
  'nested',
  'input.tsx',
  'zzz.tsx',
]);
assert.deepEqual(childNames(renameNode(renamed, buttonId, 'aaa.tsx'), componentsId), [
  'nested',
  'aaa.tsx',
  'input.tsx',
]);

// delete removes the whole subtree from the store — no orphans left behind
const deleted = deleteNode(renamed, srcId);
assert.equal(getNode(deleted, srcId), undefined);
assert.equal(getNode(deleted, componentsId), undefined);
assert.equal(getNode(deleted, buttonId), undefined);
// src, ui, nested, button.tsx, input.tsx, index.ts all leave together
assert.equal(deleted.nodes.size, renamed.nodes.size - 6);
assert.equal(deleted.nodes.size, 3); // root, package.json, README.md
assert.equal(deleted.parentOf.has(componentsId), false);
assert.deepEqual(childNames(deleted, deleted.rootId), ['package.json', 'README.md']);

// deleting the root is a no-op
assert.equal(deleteNode(deleted, deleted.rootId), deleted);

// O(1) parent lookup, both directions
assert.equal(getParent(tree, componentsId)!.id, srcId);
assert.equal(getParent(tree, tree.rootId), undefined);

// sibling collision is case-insensitive, and ignores the node being renamed
const indexId = idNamed(tree, srcId, 'index.ts');
assert.equal(hasSiblingNamed(tree, srcId, 'INDEX.TS'), true);
assert.equal(hasSiblingNamed(tree, srcId, 'index.ts', indexId), false);
assert.equal(hasSiblingNamed(tree, srcId, 'nope.ts'), false);
// a file and a folder of the same name are still a collision, despite living in different halves
assert.equal(hasSiblingNamed(tree, srcId, 'components'), true);
assert.equal(hasSiblingNamed(addNode(tree, srcId, createNode('utils', 'folder')), srcId, 'utils'), true);

// folder ids come from one flat pass, not a traversal
assert.deepEqual(new Set(collectFolderIds(tree)), new Set([tree.rootId, srcId, componentsId]));

// invariant sweep: every node except the root has a parent that lists it exactly once
for (const [id, node] of tree.nodes) {
  if (id === tree.rootId) continue;
  const parent = getParent(tree, id)!;
  assert.equal(parent.childIds!.filter((childId) => childId === id).length, 1, node.name);
}

console.log('file-tree.utils: all checks passed');
