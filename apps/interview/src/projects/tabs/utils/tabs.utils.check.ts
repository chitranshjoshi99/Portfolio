/**
 * Plain assertions — run with `node src/projects/tabs/utils/tabs.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import type { TabDefinition } from '../tabs.types.ts';
import { createLoaderCache, nextTabId, searchWithTab, tabFromSearch } from './tabs.utils.ts';

const tabs: TabDefinition[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C', disabled: true },
  { id: 'd', label: 'D' },
];

// --- keyboard: wrap, skip disabled --------------------------------------------------------

assert.equal(nextTabId(tabs, 'a', 'ArrowRight'), 'b');
assert.equal(nextTabId(tabs, 'b', 'ArrowRight'), 'd', 'skips disabled c');
assert.equal(nextTabId(tabs, 'd', 'ArrowRight'), 'a', 'wraps at the end');
assert.equal(nextTabId(tabs, 'a', 'ArrowLeft'), 'd', 'wraps at the start');
assert.equal(nextTabId(tabs, 'd', 'ArrowLeft'), 'b', 'skips disabled going left');
assert.equal(nextTabId(tabs, 'b', 'Home'), 'a');
assert.equal(nextTabId(tabs, 'a', 'End'), 'd');
assert.equal(nextTabId(tabs, 'a', 'Tab'), 'a', 'other keys do nothing');
assert.equal(nextTabId([{ id: 'x', label: 'X', disabled: true }], 'x', 'ArrowRight'), 'x');

// --- URL state ----------------------------------------------------------------------------

assert.equal(tabFromSearch('?tab=b', 'tab', tabs, 'a'), 'b');
assert.equal(tabFromSearch('?tab=c', 'tab', tabs, 'a'), 'a', 'a disabled tab in a link falls back');
assert.equal(tabFromSearch('?tab=zzz', 'tab', tabs, 'a'), 'a');
assert.equal(tabFromSearch('', 'tab', tabs, 'a'), 'a');
assert.equal(searchWithTab('?filter=open&tab=a', 'tab', 'd'), '?filter=open&tab=d', 'other params survive');
assert.equal(searchWithTab('', 'tab', 'b'), '?tab=b');

// --- loader cache: one request per id, shared, failures retried ---------------------------

let calls = 0;
let failFirst = true;
const cache = createLoaderCache(async (id: string) => {
  calls += 1;
  if (id === 'flaky' && failFirst) {
    failFirst = false;
    throw new Error('500');
  }
  return `data:${id}`;
});

const [x1, x2] = await Promise.all([cache.get('x'), cache.get('x')]);
assert.equal(x1, 'data:x');
assert.equal(x2, 'data:x');
assert.equal(calls, 1, 'concurrent callers share one load');
await cache.get('x');
assert.equal(calls, 1, 'cached after resolve');
assert.equal(cache.peek('x'), 'data:x', 'settled value readable synchronously');
assert.equal(cache.peek('never'), undefined);

await assert.rejects(cache.get('flaky'));
assert.equal(cache.has('flaky'), false, 'failure is not cached');
assert.equal(await cache.get('flaky'), 'data:flaky');
assert.equal(calls, 3);

console.log('tabs.utils: all checks passed');
