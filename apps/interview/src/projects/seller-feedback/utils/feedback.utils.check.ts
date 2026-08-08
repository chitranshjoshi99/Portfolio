/**
 * ponytail: no test framework installed — run with
 * `node src/projects/seller-feedback/utils/feedback.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { FEEDBACK_SEED } from '../constants/feedback-seed.ts';
import type { FeedbackQuery } from '../seller-feedback.types.ts';
import {
  applyQuery,
  applyQueryByScan,
  buildFeedbackIndex,
  matchesSearch,
  patchRowStatus,
  statusCounts,
  totalPages,
  withStatus,
} from './feedback.utils.ts';

const query: FeedbackQuery = { search: '', status: 'all', page: 1, pageSize: 5 };
const index = buildFeedbackIndex(FEEDBACK_SEED);
const ids = (page: { items: { id: string }[] }) => page.items.map((item) => item.id);

// page 1 is newest-first and total counts the whole filtered set, not the page
const first = applyQuery(index, query);
assert.equal(first.items.length, 5);
assert.equal(first.total, FEEDBACK_SEED.length);
assert.equal(first.items[0].id, 'f-18');
assert.ok(first.items[0].submittedAt > first.items[4].submittedAt);

// pages do not overlap and the last page is a partial slice
const second = applyQuery(index, { ...query, page: 2 });
assert.equal(second.items.filter((item) => first.items.some((other) => other.id === item.id)).length, 0);
assert.equal(applyQuery(index, { ...query, page: 4 }).items.length, 3);

// an out-of-range page clamps to the last page instead of returning nothing
assert.deepEqual(ids(applyQuery(index, { ...query, page: 99 })), ids(applyQuery(index, { ...query, page: 4 })));

// status filter narrows the total, which is what drives the page count
const approved = applyQuery(index, { ...query, status: 'approved' });
assert.equal(approved.total, 4);
assert.ok(approved.items.every((item) => item.status === 'approved'));

// search covers buyer, order id and comment, case-insensitively
assert.equal(applyQuery(index, { ...query, search: 'ORD-4914' }).total, 1);
assert.equal(applyQuery(index, { ...query, search: 'priya' }).total, 1);
assert.equal(applyQuery(index, { ...query, search: 'refund' }).total, 1);
assert.equal(applyQuery(index, { ...query, search: '   ' }).total, FEEDBACK_SEED.length);
assert.equal(matchesSearch(FEEDBACK_SEED[0], 'ANITA'), true);

// combined filters intersect
assert.equal(applyQuery(index, { ...query, search: 'a', status: 'rejected' }).total, 2);

assert.equal(totalPages(0, 5), 1);
assert.equal(totalPages(11, 5), 3);

// the status buckets partition the table, so the counts are free and still correct
const counts = statusCounts(index);
assert.equal(counts.pending + counts.approved + counts.rejected, FEEDBACK_SEED.length);
assert.equal(counts.approved, 4);

// every bucket is newest-first, inherited from the one sort at build time
for (const bucket of [index.sorted, index.byStatus.pending, index.byStatus.approved]) {
  for (let at = 1; at < bucket.length; at += 1) {
    assert.ok(bucket[at - 1].submittedAt >= bucket[at].submittedAt);
  }
}

// --- differential test: the index must agree with the filter→sort→clamp→slice scan ---------
// The scan is obviously correct and slow; the index is fast and not obviously correct.

const searches = ['', 'a', 'ORD', 'priya', 'refund', 'ZZZ', '  Anita  ', 'ord-4914'];
const statuses: FeedbackQuery['status'][] = ['all', 'pending', 'approved', 'rejected'];
let cases = 0;
for (const search of searches) {
  for (const status of statuses) {
    for (const page of [1, 2, 3, 99]) {
      const probe = { search, status, page, pageSize: 5 };
      const fast = applyQuery(index, probe);
      const slow = applyQueryByScan(FEEDBACK_SEED, probe);
      assert.deepEqual(ids(fast), ids(slow), `mismatch for ${JSON.stringify(probe)}`);
      assert.equal(fast.total, slow.total, `total mismatch for ${JSON.stringify(probe)}`);
      cases += 1;
    }
  }
}
console.log(`differential: ${cases} queries, index === scan`);

// --- writes -------------------------------------------------------------------------------

// the server's write re-derives the index; the seed is untouched
const flipped = withStatus(index, 'f-01', 'approved');
assert.equal(flipped.byId.get('f-01')!.status, 'approved');
assert.equal(index.byId.get('f-01')!.status, 'pending');
assert.equal(FEEDBACK_SEED.find((item) => item.id === 'f-01')!.status, 'pending');

// re-bucketing is complete: the row left one bucket and joined exactly one other
assert.equal(statusCounts(flipped).approved, counts.approved + 1);
assert.equal(statusCounts(flipped).pending, counts.pending - 1);
assert.ok(!flipped.byStatus.pending.some((item) => item.id === 'f-01'));
assert.ok(flipped.byStatus.approved.some((item) => item.id === 'f-01'));

// a write that changes nothing returns the same index — no needless rebuild
assert.equal(withStatus(index, 'f-01', 'pending'), index);
assert.equal(withStatus(index, 'nope', 'approved'), index);

// the write agrees with the scan over the mutated rows, too
const mutatedRows = FEEDBACK_SEED.map((row) => (row.id === 'f-01' ? { ...row, status: 'approved' as const } : row));
for (const status of statuses) {
  const probe = { ...query, status };
  assert.deepEqual(ids(applyQuery(flipped, probe)), ids(applyQueryByScan(mutatedRows, probe)));
}

// the client's optimistic patch is immutable and touches exactly one row
const patched = patchRowStatus(first.items, 'f-18', 'rejected');
assert.equal(patched.find((item) => item.id === 'f-18')!.status, 'rejected');
assert.equal(first.items.find((item) => item.id === 'f-18')!.status !== 'rejected', true);
assert.equal(patched.filter((item, at) => item !== first.items[at]).length, 1);

console.log('feedback.utils: all checks passed');
