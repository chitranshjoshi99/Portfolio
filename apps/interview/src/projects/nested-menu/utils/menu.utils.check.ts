/**
 * Plain assertions — run with `node src/projects/nested-menu/utils/menu.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { MENU, ROLES } from '../constants/nested-menu.constants.ts';
import type { MenuNode } from '../nested-menu.types.ts';
import {
  buildIndex,
  filterByAccess,
  findPathByDfs,
  pathTo,
  resolveRoute,
  toggleOpen,
  visibleOrder,
} from './menu.utils.ts';

const role = (id: string) => new Set(ROLES.find((r) => r.id === id)?.permissions ?? []);
const ids = (nodes: MenuNode[]): string[] => nodes.flatMap((n) => [n.id, ...ids(n.children ?? [])]);

// --- access filtering -----------------------------------------------------------------------

const viewer = ids(filterByAccess(MENU, role('viewer')));
assert.ok(!viewer.includes('jira-reports'), 'viewer cannot see reports');
assert.ok(!viewer.includes('velocity'), 'hidden parent hides its subtree');
assert.ok(!viewer.includes('admin'));
assert.ok(viewer.includes('jira-board'));

const admin = ids(filterByAccess(MENU, role('admin')));
assert.ok(admin.includes('users') && admin.includes('audit'));
assert.ok(!admin.includes('billing'), 'per-leaf permission still applies inside a visible parent');
assert.ok(ids(filterByAccess(MENU, role('owner'))).includes('billing'));

// a folder whose children are all forbidden disappears; a folder that is also a page stays
const tree: MenuNode[] = [
  { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', route: '/a1', permission: 'x' }] },
  { id: 'b', label: 'B', route: '/b', children: [{ id: 'b1', label: 'B1', route: '/b1', permission: 'x' }] },
];
assert.deepEqual(ids(filterByAccess(tree, new Set())), ['b']);
assert.deepEqual(ids(filterByAccess(tree, new Set(['x']))), ['a', 'a1', 'b', 'b1']);

// filtering never mutates the source tree
const before = JSON.stringify(MENU);
filterByAccess(MENU, role('viewer'));
assert.equal(JSON.stringify(MENU), before);

// --- index: parent-map path agrees with the DFS oracle for every node ------------------------

const index = buildIndex(MENU);
for (const id of ids(MENU)) assert.deepEqual(pathTo(index, id), findPathByDfs(MENU, id), id);
assert.deepEqual(pathTo(index, 'audit'), ['admin', 'security', 'audit']);
assert.deepEqual(pathTo(index, 'nope'), []);
assert.deepEqual(pathTo(index, null), []);

// --- accordion: the open state is one chain ------------------------------------------------

let open: string[] = [];
open = toggleOpen(index, open, 'projects');
assert.deepEqual(open, ['projects']);
open = toggleOpen(index, open, 'jira');
assert.deepEqual(open, ['projects', 'jira']);
open = toggleOpen(index, open, 'jira-reports');
assert.deepEqual(open, ['projects', 'jira', 'jira-reports'], "child's child keeps the path open");
open = toggleOpen(index, open, 'confluence');
assert.deepEqual(open, ['projects', 'confluence'], 'opening a sibling closes jira and its subtree');
open = toggleOpen(index, open, 'admin');
assert.deepEqual(open, ['admin'], 'opening another root closes the whole projects branch');
open = toggleOpen(index, ['projects', 'jira', 'jira-reports'], 'jira');
assert.deepEqual(open, ['projects'], 'closing a node closes its descendants');
assert.deepEqual(toggleOpen(index, ['projects'], 'home'), ['projects'], 'a leaf does not toggle');

// --- visible order follows the open chain --------------------------------------------------

assert.deepEqual(visibleOrder(MENU, new Set()), ['home', 'projects', 'admin', 'help']);
assert.deepEqual(visibleOrder(MENU, new Set(['projects', 'jira'])), [
  'home', 'projects', 'jira', 'jira-board', 'jira-backlog', 'jira-reports', 'confluence', 'admin', 'help',
]);

// --- route guard ----------------------------------------------------------------------------

const viewerIndex = buildIndex(filterByAccess(MENU, role('viewer')));
const leadIndex = buildIndex(filterByAccess(MENU, role('lead')));
assert.deepEqual(resolveRoute(viewerIndex, index, '/jira/reports/velocity'), {
  kind: 'forbidden',
  route: '/jira/reports/velocity',
});
assert.deepEqual(resolveRoute(leadIndex, index, '/jira/reports/velocity/'), { kind: 'ok', id: 'velocity' });
assert.deepEqual(resolveRoute(leadIndex, index, '/nope'), { kind: 'not-found', route: '/nope' });

console.log('menu.utils: all checks passed');
