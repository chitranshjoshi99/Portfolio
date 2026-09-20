/**
 * Plain assertions — run with `node src/projects/karat-todos/utils/todos.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import type { Todo } from '../karat-todos.types.ts';
import {
  appendToGroups,
  applyPatch,
  buildTodoUrl,
  escapeHtml,
  groupByUser,
  groupByUserNested,
  setPatch,
  sortByStatus,
} from './todos.utils.ts';

const t = (id: number, userId: number, completed = false): Todo => ({ id, todo: `task ${id}`, completed, userId });

// the prompt's sample: userIds out of order
const sample = [t(1, 26), t(2, 3), t(3, 26), t(4, 9), t(5, 3)];

// --- grouping keeps FIRST-SEEN user order (the object-key trap) ------------------------------

assert.deepEqual(
  groupByUser(sample).map((g) => g.userId),
  [26, 3, 9],
);
const asObject: Record<number, Todo[]> = {};
for (const todo of sample) (asObject[todo.userId] ??= []).push(todo);
assert.deepEqual(Object.keys(asObject).map(Number), [3, 9, 26], 'plain object reorders integer keys');

// V1 agrees with the V0 oracle on random data
let seed = 3;
const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
for (let round = 0; round < 200; round += 1) {
  const todos = Array.from({ length: 1 + Math.floor(random() * 60) }, (_, i) => t(i, 1 + Math.floor(random() * 12)));
  assert.deepEqual(groupByUser(todos), groupByUserNested(todos));

  // V2: appending pages equals grouping everything at once
  let groups = groupByUser([]);
  for (let skip = 0; skip < todos.length; skip += 7) groups = appendToGroups(groups, todos.slice(skip, skip + 7));
  assert.deepEqual(groups, groupByUser(todos));
}

// appendToGroups copies only touched groups
const base = groupByUser([t(1, 1), t(2, 2)]);
const after = appendToGroups(base, [t(3, 2), t(4, 5)]);
assert.equal(after[0], base[0], 'untouched group keeps identity');
assert.notEqual(after[1], base[1], 'touched group is a new object');
assert.deepEqual(base[1].todos.map((x) => x.id), [2], 'input not mutated');
assert.deepEqual(after.map((g) => g.userId), [1, 2, 5]);

// --- patches -------------------------------------------------------------------------------

const original = t(7, 1, false);
let patches = setPatch({}, original, { completed: true });
assert.deepEqual(patches, { 7: { completed: true } });
patches = setPatch(patches, original, { todo: 'renamed' });
assert.deepEqual(applyPatch(original, patches), { ...original, completed: true, todo: 'renamed' });
patches = setPatch(patches, original, { completed: false, todo: 'task 7' });
assert.deepEqual(patches, {}, 'reverting by hand leaves nothing stored');
assert.equal(applyPatch(original, {}), original, 'unpatched row is the same object');

// --- sort + url + escaping -----------------------------------------------------------------

assert.deepEqual(
  sortByStatus([t(1, 1, true), t(2, 1), t(3, 1, true), t(4, 1)]).map((x) => x.id),
  [2, 4, 1, 3],
  'open first, server order kept inside each bucket',
);
assert.equal(buildTodoUrl('https://dummyjson.com/todos', 10, 80), 'https://dummyjson.com/todos?limit=10&skip=80');
assert.equal(
  escapeHtml('<img src=x onerror="alert(1)"> & \'q\''),
  '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;q&#39;',
);
assert.equal(escapeHtml('&lt;'), '&amp;lt;', '& is escaped first');

console.log('todos.utils: all checks passed');
