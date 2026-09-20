/**
 * Plain assertions — run with `node src/projects/page-tree/utils/tree.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import type { PageStore, PageSummary } from '../page-tree.types.ts';
import { mergeChildren, setLoad, typeaheadIndex, visibleIdsByRecursion, visibleRows, windowRows } from './tree.utils.ts';

const s = (id: string, hasChildren = false): PageSummary => ({ id, title: id, hasChildren });
let store: PageStore = { root: { id: 'root', title: 'root', hasChildren: true, parentId: null, childIds: null, load: 'loading' } };

store = mergeChildren(store, 'root', [s('a', true), s('b'), s('c', true)]);
assert.deepEqual(store.root.childIds, ['a', 'b', 'c']);
assert.equal(store.root.load, 'loaded');
assert.equal(store.a.parentId, 'root');
assert.equal(store.a.childIds, null, 'children unknown until fetched');

// collapsed: only the top level
let rows = visibleRows(store, 'root', new Set());
assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c']);
assert.deepEqual(rows.map((r) => [r.depth, r.posInSet, r.setSize]), [[1, 1, 3], [1, 2, 3], [1, 3, 3]]);

// expanded but not fetched → a loading placeholder in the right place
store = setLoad(store, 'a', 'loading');
rows = visibleRows(store, 'root', new Set(['a']));
assert.deepEqual(rows.map((r) => `${r.kind}:${r.id}:${r.depth}`), ['page:a:1', 'loading:a:loading:2', 'page:b:1', 'page:c:1']);

// failed → an error row instead
store = setLoad(store, 'a', 'error');
assert.equal(visibleRows(store, 'root', new Set(['a']))[1].kind, 'error');

// loaded → real children, levels and set sizes computed
store = mergeChildren(store, 'a', [s('a1'), s('a2', true)]);
store = mergeChildren(store, 'a2', [s('a2x')]);
rows = visibleRows(store, 'root', new Set(['a', 'a2']));
assert.deepEqual(rows.map((r) => `${r.id}@${r.depth}(${r.posInSet}/${r.setSize})`), [
  'a@1(1/3)',
  'a1@2(1/2)',
  'a2@2(2/2)',
  'a2x@3(1/1)',
  'b@1(2/3)',
  'c@1(3/3)',
]);

// collapsing a parent hides its subtree, but KEEPS it loaded (re-expand is instant)
rows = visibleRows(store, 'root', new Set(['a2']));
assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c'], 'a2 is expanded but a is not — nothing under a shows');
assert.deepEqual(store.a2.childIds, ['a2x']);

// re-fetching a parent keeps grandchildren already loaded
store = mergeChildren(store, 'a', [s('a1'), s('a2', true), s('a3')]);
assert.deepEqual(store.a2.childIds, ['a2x']);

// differential: flat DFS agrees with a naive recursive order on random trees
let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let round = 0; round < 150; round += 1) {
  let st: PageStore = { root: { id: 'root', title: 'root', hasChildren: true, parentId: null, childIds: null, load: 'loading' } };
  const queue = ['root'];
  let n = 0;
  while (queue.length && n < 60) {
    const parent = queue.shift() as string;
    const kids = Array.from({ length: Math.floor(random() * 4) }, () => s(`n${n++}`, random() < 0.6));
    st = mergeChildren(st, parent, kids);
    kids.filter((k) => k.hasChildren && random() < 0.7).forEach((k) => queue.push(k.id));
  }
  const expanded = new Set(Object.keys(st).filter(() => random() < 0.6));
  const flat = visibleRows(st, 'root', expanded).filter((r) => r.kind === 'page').map((r) => r.id);
  assert.deepEqual(flat, visibleIdsByRecursion(st, 'root', expanded));
}

// --- virtual window -----------------------------------------------------------------------

assert.deepEqual(windowRows(2000, 0, 30, 420, 6), { start: 0, end: 20, offsetTop: 0 });
assert.deepEqual(windowRows(2000, 3000, 30, 420, 6), { start: 94, end: 120, offsetTop: 2820 });
assert.deepEqual(windowRows(10, 3000, 30, 420, 6).end, 10, 'never past the end');

// --- type-ahead ---------------------------------------------------------------------------

const titles: Record<string, string> = { a: 'Architecture', a1: 'ADR-001', a2: 'ADR-002', a2x: 'X', b: 'Billing', c: 'Components' };
rows = visibleRows(store, 'root', new Set(['a', 'a2']));
const title = (id: string) => titles[id] ?? id;
assert.equal(rows[typeaheadIndex(rows, title, 0, 'ad')].id, 'a1', 'from Architecture, next "ad…" is ADR-001');
assert.equal(rows[typeaheadIndex(rows, title, 1, 'ad')].id, 'a2', 'repeat moves to the next match');
assert.equal(rows[typeaheadIndex(rows, title, 5, 'ar')].id, 'a', 'wraps around');
assert.equal(typeaheadIndex(rows, title, 0, 'zzz'), -1);

console.log('tree.utils: all checks passed');
