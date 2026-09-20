/**
 * node src/projects/job-board/utils/jobs.check.ts
 * The graded parts: paging ids, fetching in parallel without losing order, and the time labels.
 */
import assert from 'node:assert/strict';
import { PAGE_SIZE } from '../constants/jobs.ts';
import { apiStats, fetchJob, fetchJobIds, resetApiStats } from './jobs-api.ts';
import { hasMore, hostOf, mapWithConcurrency, pageSlice, relativeTime, uniqueIds } from './jobs.utils.ts';

// --- paging ----------------------------------------------------------------
const ids = Array.from({ length: 14 }, (_, index) => index + 1);
assert.deepEqual(pageSlice(ids, 0, PAGE_SIZE), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(pageSlice(ids, 2, PAGE_SIZE), [13, 14], 'the last page is short, not padded');
assert.deepEqual(pageSlice(ids, 3, PAGE_SIZE), [], 'past the end is empty, not an error');
assert.deepEqual(pageSlice(ids, -1, PAGE_SIZE), [1, 2, 3, 4, 5, 6], 'a negative page clamps to the first');
assert.deepEqual(pageSlice([], 0, PAGE_SIZE), []);
assert.deepEqual(uniqueIds([1, 2, 2, 3, 1]), [1, 2, 3], 'a duplicated id would render twice');
assert.equal(hasMore(ids, 12), true);
assert.equal(hasMore(ids, 14), false, 'the button disappears exactly when the ids run out');

// --- mapWithConcurrency ----------------------------------------------------
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

{
  // Results come back in INPUT order even though the slowest item is first.
  const input = [80, 10, 40, 5, 30];
  const order: number[] = [];
  const results = await mapWithConcurrency(input, 2, async (ms) => {
    await sleep(ms);
    order.push(ms);
    return ms * 2;
  });
  assert.deepEqual(results, [160, 20, 80, 10, 60], 'output follows input order');
  assert.notDeepEqual(order, input, '…while completion order is genuinely different');
}

{
  // The limit is respected, and it is a limit rather than a batch size: a worker picks up the next
  // item the moment it is free, so one slow item does not stall the rest of its "batch".
  let inFlight = 0;
  let peak = 0;
  const timings = [50, 10, 10, 10, 10, 10, 10, 10];
  const started: number[] = [];
  const begin = Date.now();
  await mapWithConcurrency(timings, 3, async (ms, index) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    started[index] = Date.now() - begin;
    await sleep(ms);
    inFlight -= 1;
    return index;
  });
  assert.equal(peak, 3, 'never more than the limit in flight');
  assert.ok(started[4] < 45, 'a free worker starts item 5 long before the 50ms item finishes');
}

assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), [], 'an empty input does not hang');
assert.deepEqual(await mapWithConcurrency([1, 2], 99, async (n) => n), [1, 2], 'a limit above the length is fine');
assert.deepEqual(await mapWithConcurrency([1, 2, 3], 0, async (n) => n), [1, 2, 3], 'a zero limit still runs, serially');

{
  // A rejecting task must not take the whole page with it: the caller settles inside the task.
  const results = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
    try {
      if (value === 2) throw new Error('boom');
      return { value };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });
  assert.deepEqual(results, [{ value: 1 }, { error: 'boom' }, { value: 3 }]);
}

// --- relativeTime ----------------------------------------------------------
const now = Date.UTC(2026, 8, 20, 12, 0, 0);
const ago = (ms: number) => relativeTime(now - ms, now);
assert.equal(ago(0), 'just now');
assert.equal(ago(59_000), 'just now', 'under a minute is not "0 minutes ago"');
assert.equal(ago(60_000), '1 minute ago', 'singular');
assert.equal(ago(120_000), '2 minutes ago');
assert.equal(ago(3_600_000), '1 hour ago');
assert.equal(ago(3_599_000), '59 minutes ago', 'the boundary belongs to the smaller unit');
assert.equal(ago(86_400_000), '1 day ago');
assert.equal(ago(86_400_000 * 20), '20 days ago');
assert.equal(ago(2_592_000_000), '1 month ago');
assert.equal(ago(31_536_000_000), '1 year ago');
assert.equal(relativeTime(now + 60_000, now), 'just now', 'a clock skew must not print a negative age');

// --- hostOf ----------------------------------------------------------------
assert.equal(hostOf('https://www.atlassian.com/careers/1'), 'atlassian.com');
assert.equal(hostOf('https://linear.app/x'), 'linear.app');
assert.equal(hostOf('not a url'), '', 'a malformed url is blank, never a throw in render');

// --- the two-step fetch, end to end ---------------------------------------
resetApiStats();
const allIds = await fetchJobIds();
assert.equal(allIds.length, 87);
assert.deepEqual(uniqueIds(allIds), allIds, 'the id list has no duplicates');

const firstPage = pageSlice(allIds, 0, PAGE_SIZE);
const page = await mapWithConcurrency(firstPage, 3, async (id) => {
  try {
    return { id, job: await fetchJob(id) };
  } catch (error) {
    return { id, error: (error as Error).message };
  }
});
assert.deepEqual(page.map((entry) => entry.id), firstPage, 'rows stay in the API order');
assert.equal(apiStats.peakInFlight, 3, 'the pool held to its limit against the real API');
const failed = page.filter((entry) => 'error' in entry);
assert.equal(failed.length, 1, 'the flaky id failed, and the other five still arrived');
assert.equal(page.filter((entry) => 'job' in entry).length, 5);

// Retrying the failed one succeeds, and does not disturb the rest.
const retried = await fetchJob(failed[0].id);
assert.equal(retried.id, failed[0].id);

console.log('job-board: all checks passed');
