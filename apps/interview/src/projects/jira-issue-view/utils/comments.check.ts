/**
 * node src/projects/jira-issue-view/utils/comments.check.ts
 * The optimistic list is the graded part: add, confirm, fail, retry, edit, delete, and a refetch that
 * must not eat a comment still in flight.
 */
import assert from 'node:assert/strict';
import type { Comment } from '../jira-issue-view.types.ts';
import {
  addOptimistic, confirmComment, draftId, editComment, failComment, isDraft, isSubmitShortcut,
  mergeServerComments, normaliseBody, pendingCount, removeComment, timeAgo,
} from './comments.utils.ts';

const sent = (id: string, body: string, at = 1000): Comment => ({
  id, author: 'Sam', body, createdAt: at, status: 'sent',
});

const server: Comment[] = [sent('c1', 'first', 1000), sent('c2', 'second', 2000)];

// --- ids -------------------------------------------------------------------
assert.equal(isDraft(draftId(7)), true);
assert.equal(isDraft('c3'), false, 'a server id is never mistaken for a draft');
assert.notEqual(draftId(1), draftId(2), 'two drafts in the same tick get different ids');

// --- optimistic add → confirm ----------------------------------------------
{
  const temp = draftId(1);
  const optimistic: Comment = { id: temp, author: 'You', body: 'mine', createdAt: 3000, status: 'sending' };
  const withDraft = addOptimistic(server, optimistic);
  assert.equal(withDraft.length, 3);
  assert.equal(withDraft[2].id, temp, 'the draft is drawn last, where the server will put it');
  assert.equal(server.length, 2, 'the input list is not mutated');
  assert.equal(pendingCount(withDraft), 1);

  const confirmed = confirmComment(withDraft, temp, sent('c9', 'mine', 3100));
  assert.equal(confirmed[2].id, 'c9', 'the real id replaces the draft in place');
  assert.equal(confirmed[2].status, 'sent');
  assert.equal(confirmed.length, 3, 'confirming does not append a second copy');
  assert.equal(pendingCount(confirmed), 0);
  assert.deepEqual(confirmed.slice(0, 2), server, 'the other comments are untouched');
}

// --- optimistic add → fail → retry -----------------------------------------
{
  const temp = draftId(2);
  const withDraft = addOptimistic(server, { id: temp, author: 'You', body: 'mine', createdAt: 3000, status: 'sending' });
  const failed = failComment(withDraft, temp, '409 — comment rejected');

  assert.equal(failed[2].status, 'failed');
  assert.equal(failed[2].error, '409 — comment rejected');
  assert.equal(failed[2].body, 'mine', 'the text the user typed is still there to retry or copy');
  assert.equal(pendingCount(failed), 1, 'a failed comment still counts as unsent');

  // Retry re-sends the same draft: back to sending, then confirmed.
  const retrying = failed.map((comment) =>
    comment.id === temp ? { ...comment, status: 'sending' as const, error: undefined } : comment,
  );
  const done = confirmComment(retrying, temp, sent('c10', 'mine', 3200));
  assert.equal(done[2].id, 'c10');
  assert.equal(done[2].status, 'sent');
  assert.equal(done[2].error, undefined);

  // Or the user gives up and the draft is removed.
  assert.deepEqual(removeComment(failed, temp), server);
}

// --- edit and delete -------------------------------------------------------
{
  const edited = editComment(server, 'c1', 'first, corrected', 5000);
  assert.equal(edited[0].body, 'first, corrected');
  assert.equal(edited[0].editedAt, 5000);
  assert.equal(edited[0].status, 'sending', 'an edit is in flight until the server answers');
  assert.equal(edited[1], server[1], 'the other comment keeps its identity');
  assert.equal(server[0].body, 'first', 'the input was not mutated');

  assert.deepEqual(removeComment(server, 'c2').map((c) => c.id), ['c1']);
  assert.deepEqual(removeComment(server, 'missing'), server.slice(), 'deleting nothing changes nothing');
}

// --- refetch must not eat an in-flight comment -----------------------------
{
  const temp = draftId(3);
  const local = addOptimistic(server, { id: temp, author: 'You', body: 'still sending', createdAt: 4000, status: 'sending' });
  const fresh = [...server, sent('c3', 'someone else posted', 3500)];

  const merged = mergeServerComments(fresh, local);
  assert.deepEqual(merged.map((c) => c.id), ['c1', 'c2', 'c3', temp],
    'the server list wins for confirmed comments, the pending draft survives at the end');
  assert.equal(pendingCount(merged), 1);

  // A refetch after the comment landed does NOT duplicate it.
  const confirmed = confirmComment(local, temp, sent('c4', 'still sending', 4100));
  const afterLanding = mergeServerComments([...server, sent('c4', 'still sending', 4100)], confirmed);
  assert.deepEqual(afterLanding.map((c) => c.id), ['c1', 'c2', 'c4']);
  assert.equal(pendingCount(afterLanding), 0);

  // A comment deleted elsewhere disappears on the next fetch, and a failed local one still survives.
  const withFailed = failComment(local, temp, 'nope');
  assert.deepEqual(mergeServerComments([sent('c1', 'first', 1000)], withFailed).map((c) => c.id), ['c1', temp]);
}

// --- input handling --------------------------------------------------------
assert.equal(normaliseBody('   '), null, 'whitespace is not a comment');
assert.equal(normaliseBody(''), null);
assert.equal(normaliseBody('  hello  '), 'hello');
assert.equal(normaliseBody('x'.repeat(2500))?.length, 2000, 'capped');
assert.equal(isSubmitShortcut({ key: 'Enter', metaKey: true, ctrlKey: false }), true);
assert.equal(isSubmitShortcut({ key: 'Enter', metaKey: false, ctrlKey: true }), true);
assert.equal(isSubmitShortcut({ key: 'Enter', metaKey: false, ctrlKey: false }), false, 'plain Enter is a newline');
assert.equal(isSubmitShortcut({ key: 'a', metaKey: true, ctrlKey: false }), false);

// --- timeAgo ---------------------------------------------------------------
const now = Date.UTC(2026, 8, 20, 12, 0, 0);
assert.equal(timeAgo(now, now), 'just now');
assert.equal(timeAgo(now - 59_000, now), 'just now');
assert.equal(timeAgo(now - 60_000, now), '1 minute ago');
assert.equal(timeAgo(now - 3_600_000, now), '1 hour ago');
assert.equal(timeAgo(now - 86_400_000 * 3, now), '3 days ago');
assert.equal(timeAgo(now - 86_400_000 * 30, now), '2026-08-21', 'old comments get a real date');
assert.equal(timeAgo(now + 5_000, now), 'just now', 'a clock skew does not print a negative age');

console.log('jira-issue-view: all checks passed');
