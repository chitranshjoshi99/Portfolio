/**
 * node src/projects/data-table/utils/table.check.ts
 * The table's logic is the query: what the server is asked, and what the controls do to it.
 */
import assert from 'node:assert/strict';
import { ALL_TASKS, DEFAULT_QUERY } from '../constants/tasks.ts';
import type { Query, Task } from '../data-table.types.ts';
import { queryTasksSync } from './table-api.ts';
import { ariaSort, clampPage, nextSort, pageWindow, queryKey, rangeLabel, totalPages } from './table.utils.ts';

const base: Query = { ...DEFAULT_QUERY };
const fallback = { sort: DEFAULT_QUERY.sort, dir: DEFAULT_QUERY.dir };

// --- sort cycle ------------------------------------------------------------
const first = nextSort({ ...base, page: 4 }, 'summary', fallback);
assert.equal(first.sort, 'summary');
assert.equal(first.dir, 'asc', 'a new column starts ascending');
assert.equal(first.page, 1, 'sorting resets the page: page 4 of the old order means nothing');
assert.equal(nextSort(first, 'summary', fallback).dir, 'desc');
const third = nextSort(nextSort(first, 'summary', fallback), 'summary', fallback);
assert.equal(third.sort, DEFAULT_QUERY.sort, 'the third click returns to the default order');
assert.equal(third.dir, DEFAULT_QUERY.dir);

assert.equal(ariaSort(first, 'summary'), 'ascending');
assert.equal(ariaSort(first, 'points'), 'none', 'every other header reports none, not the table state');

// --- pagination maths ------------------------------------------------------
assert.equal(totalPages(137, 10), 14);
assert.equal(totalPages(0, 10), 1, 'an empty result is still one page');
assert.equal(totalPages(10, 10), 1);
assert.equal(clampPage(14, 137, 10), 14);
assert.equal(clampPage(14, 12, 10), 2, 'a filter that shrinks the set pulls the page back into range');
assert.equal(clampPage(0, 137, 10), 1);
assert.equal(clampPage(Number.NaN, 137, 10), 1, 'a page from a URL is not a number until it is checked');

assert.equal(rangeLabel(3, 10, 137), 'Showing 21–30 of 137');
assert.equal(rangeLabel(14, 10, 137), 'Showing 131–137 of 137', 'the last page is short, and says so');
assert.equal(rangeLabel(1, 10, 0), 'No matching issues');

assert.deepEqual(pageWindow(1, 1), [1]);
assert.deepEqual(pageWindow(1, 5), [1, 2, 3, 4, 5], 'no gaps when everything fits');
assert.deepEqual(pageWindow(6, 20), [1, null, 4, 5, 6, 7, 8, null, 20]);
assert.deepEqual(pageWindow(2, 20), [1, 2, 3, 4, null, 20], 'no gap of one page');
assert.deepEqual(pageWindow(19, 20), [1, null, 17, 18, 19, 20]);
for (const items of [pageWindow(6, 20), pageWindow(1, 20), pageWindow(20, 20)]) {
  const pages = items.filter((item): item is number => item !== null);
  assert.deepEqual(pages, [...new Set(pages)].sort((a, b) => a - b), 'pages are unique and ordered');
}

// --- the query key is the cache key ---------------------------------------
assert.equal(queryKey(base), queryKey({ ...base }));
assert.equal(queryKey({ ...base, search: '  CONF ' }), queryKey({ ...base, search: 'conf' }),
  'trimmed and lower-cased: the same request, so the same key');
assert.notEqual(queryKey(base), queryKey({ ...base, page: 2 }));
assert.notEqual(queryKey(base), queryKey({ ...base, dir: 'asc' }));

// --- the server: filter, sort, slice --------------------------------------
const all = queryTasksSync({ ...base, pageSize: 1000 });
assert.equal(all.total, ALL_TASKS.length);
assert.equal(all.rows.length, ALL_TASKS.length);

const page1 = queryTasksSync(base);
const page2 = queryTasksSync({ ...base, page: 2 });
assert.equal(page1.rows.length, 10);
assert.equal(page1.total, 137, 'total is the filtered count, not the page length');
assert.equal(new Set([...page1.rows, ...page2.rows].map((row) => row.id)).size, 20,
  'consecutive pages never repeat a row');

// The whole point of a stable tiebreak: two rows with the same `updated` keep their relative order,
// so paging through does not show the same issue twice or skip one.
const byUpdated = queryTasksSync({ ...base, sort: 'updated', pageSize: 1000 }).rows;
const ties = byUpdated.filter((row, index) => index > 0 && row.updated === byUpdated[index - 1].updated);
assert.ok(ties.length > 0, 'the fixture has ties, otherwise this proves nothing');
assert.deepEqual(
  queryTasksSync({ ...base, sort: 'updated', pageSize: 1000 }).rows.map((row) => row.id),
  byUpdated.map((row) => row.id),
  'the same query returns the same order every time',
);

const keyAsc = queryTasksSync({ ...base, sort: 'key', dir: 'asc', pageSize: 1000 }).rows;
assert.equal(keyAsc[0].key, 'CONF-4100');
assert.ok(
  keyAsc.findIndex((row) => row.key === 'CONF-4109') < keyAsc.findIndex((row) => row.key === 'CONF-4110'),
  'numeric collation: CONF-4109 before CONF-4110, which a plain string compare gets right only by luck',
);
const keyDesc = queryTasksSync({ ...base, sort: 'key', dir: 'desc', pageSize: 1000 }).rows;
assert.deepEqual(keyDesc.map((row) => row.id), [...keyAsc].reverse().map((row) => row.id),
  'desc is exactly asc reversed — including the tiebreak');

// Oracle: the server's own filter, re-implemented the slow obvious way, must agree.
const naive = (query: Query): Task[] => {
  const needle = query.search.trim().toLowerCase();
  return ALL_TASKS.filter((task) => {
    const statusOk = query.status === 'all' || task.status === query.status;
    const text = `${task.key} ${task.summary} ${task.assignee}`.toLowerCase();
    return statusOk && (!needle || text.includes(needle));
  });
};
for (const query of [
  { ...base, search: 'paste' },
  { ...base, search: 'PRIYA' },
  { ...base, search: 'conf-41' },
  { ...base, status: 'blocked' as const },
  { ...base, status: 'done' as const, search: 'editor' },
  { ...base, search: 'no such issue anywhere' },
]) {
  assert.equal(queryTasksSync({ ...query, pageSize: 1000 }).total, naive(query).length, `filter: ${queryKey(query)}`);
}

const empty = queryTasksSync({ ...base, search: 'no such issue anywhere' });
assert.deepEqual(empty.rows, []);
assert.equal(empty.total, 0);
assert.equal(rangeLabel(empty.page, empty.pageSize, empty.total), 'No matching issues');

// Status counts describe the search result and ignore the status filter, or the tabs would read zero.
const counts = queryTasksSync({ ...base, status: 'blocked' }).statusCounts;
assert.ok(counts.done > 0, 'the Done tab still shows its count while Blocked is selected');
assert.equal(
  Object.values(counts).reduce((sum, value) => sum + value, 0),
  ALL_TASKS.length,
  'with no search, the counts add up to everything',
);
const searched = queryTasksSync({ ...base, search: 'paste' }).statusCounts;
assert.equal(
  Object.values(searched).reduce((sum, value) => sum + value, 0),
  naive({ ...base, search: 'paste' }).length,
  'with a search, they add up to the matches',
);

// A page past the end returns nothing rather than throwing — the client clamps, the server copes.
assert.deepEqual(queryTasksSync({ ...base, page: 99 }).rows, []);
assert.equal(queryTasksSync({ ...base, page: 99 }).total, 137);

console.log('data-table: all checks passed');
