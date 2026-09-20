/**
 * Plain assertions — run with `node src/projects/jira-board/utils/board.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { INITIAL_BOARD } from '../constants/jira-board.constants.ts';
import type { BoardState } from '../jira-board.types.ts';
import {
  boardReducer,
  columnViews,
  dropIndexFromMidpoints,
  findPosition,
  keyboardTarget,
  moveIssue,
  moveIssueAfter,
  toMoveRequest,
} from './board.utils.ts';

const ids = (state: BoardState, columnId: string) => state.columns[columnId].issueIds;
const board = INITIAL_BOARD;

// --- positions --------------------------------------------------------------------------------

assert.deepEqual(findPosition(board, 'i9'), { columnId: 'todo', index: 2 });
assert.equal(findPosition(board, 'nope'), null);

// --- across columns ---------------------------------------------------------------------------

let next = moveIssue(board, 'i3', { columnId: 'progress', index: 1 });
assert.deepEqual(ids(next, 'todo'), ['i8', 'i9', 'i5']);
assert.deepEqual(ids(next, 'progress'), ['i1', 'i3', 'i2', 'i7']);
assert.equal(next.columns.review, board.columns.review, 'untouched columns keep identity');
assert.equal(next.issues, board.issues, 'issues are never rewritten by a move');
assert.deepEqual(ids(board, 'todo'), ['i3', 'i8', 'i9', 'i5'], 'input not mutated');

// clamping past the end
assert.deepEqual(ids(moveIssue(board, 'i3', { columnId: 'done', index: 99 }), 'done'), ['i6', 'i3']);

// --- within one column: the index-shift trap ---------------------------------------------------

// moving DOWN: target index computed against the original list must be decremented
assert.deepEqual(ids(moveIssue(board, 'i3', { columnId: 'todo', index: 3 }), 'todo'), ['i8', 'i9', 'i3', 'i5']);
// to the very end
assert.deepEqual(ids(moveIssue(board, 'i3', { columnId: 'todo', index: 4 }), 'todo'), ['i8', 'i9', 'i5', 'i3']);
// moving UP needs no adjustment
assert.deepEqual(ids(moveIssue(board, 'i5', { columnId: 'todo', index: 1 }), 'todo'), ['i3', 'i5', 'i8', 'i9']);
// dropping where it already is is a no-op AND returns the same object
assert.equal(moveIssue(board, 'i8', { columnId: 'todo', index: 1 }), board);
assert.equal(moveIssue(board, 'i8', { columnId: 'todo', index: 2 }), board, 'index+1 of itself is also a no-op');
assert.equal(moveIssue(board, 'ghost', { columnId: 'todo', index: 0 }), board);

// --- move requests use neighbours, not indexes --------------------------------------------------

next = moveIssue(board, 'i3', { columnId: 'progress', index: 1 });
assert.deepEqual(toMoveRequest(next, 'i3'), { issueId: 'i3', columnId: 'progress', afterId: 'i1', beforeId: 'i2' });
assert.deepEqual(toMoveRequest(moveIssue(board, 'i3', { columnId: 'review', index: 0 }), 'i3'), {
  issueId: 'i3',
  columnId: 'review',
  afterId: null,
  beforeId: 'i4',
});

// --- rank after a neighbour: the rollback / remote-move primitive ---------------------------------

// a move and its rollback round-trip exactly, in every direction
for (const [issueId, target] of [
  ['i9', { columnId: 'todo', index: 0 }],
  ['i3', { columnId: 'todo', index: 4 }],
  ['i3', { columnId: 'review', index: 1 }],
  ['i5', { columnId: 'progress', index: 0 }],
] as const) {
  const undo = toMoveRequest(board, issueId)!; // where it was, as neighbours
  const moved = moveIssue(board, issueId, target);
  const restored = moveIssueAfter(moved, issueId, undo.columnId, undo.afterId);
  assert.deepEqual(restored.columns, board.columns, `rollback of ${issueId} → ${target.columnId}`);
}
assert.deepEqual(ids(moveIssueAfter(board, 'i1', 'todo', 'i9'), 'todo'), ['i3', 'i8', 'i9', 'i1', 'i5']);
assert.deepEqual(ids(moveIssueAfter(board, 'i1', 'todo', null), 'todo'), ['i1', 'i3', 'i8', 'i9', 'i5']);
assert.equal(moveIssueAfter(board, 'ghost', 'todo', null), board);

// --- reducer: columns ---------------------------------------------------------------------------

let state = boardReducer(board, { type: 'addColumn', id: 'blocked', title: 'Blocked' });
assert.deepEqual(state.columnOrder, ['todo', 'progress', 'review', 'done', 'blocked']);
state = boardReducer(state, { type: 'moveColumn', columnId: 'blocked', toIndex: 1 });
assert.deepEqual(state.columnOrder, ['todo', 'blocked', 'progress', 'review', 'done']);
state = boardReducer(state, { type: 'renameColumn', columnId: 'blocked', title: 'Blocked / waiting' });
assert.equal(state.columns.blocked.title, 'Blocked / waiting');
state = boardReducer(state, { type: 'setWipLimit', columnId: 'blocked', wipLimit: 2 });
assert.equal(state.columns.blocked.wipLimit, 2);

// --- views: filter, WIP, points -------------------------------------------------------------------

const all = columnViews(board, { text: '', assignee: null });
assert.deepEqual(all.map((c) => c.issues.length), [4, 3, 1, 1]);
assert.equal(all[1].overWip, false, '3 cards with a limit of 3 is at the limit, not over');
assert.equal(columnViews(boardReducer(board, { type: 'setWipLimit', columnId: 'progress', wipLimit: 2 }), { text: '', assignee: null })[1].overWip, true);
assert.equal(all[1].points, 10);

const byPriya = columnViews(board, { text: '', assignee: 'Priya' });
assert.deepEqual(byPriya.map((c) => c.issues.map((i) => i.id)), [['i9', 'i5'], ['i1'], [], []]);
assert.equal(byPriya[0].hiddenCount, 2, 'hidden cards are counted, not silently dropped');
assert.equal(byPriya[1].overWip, false);
const text = columnViews(board, { text: 'CONF-4101', assignee: null });
assert.deepEqual(text[1].issues.map((i) => i.id), ['i1'], 'matches the key too');

// --- drop index from midpoints ---------------------------------------------------------------------

assert.equal(dropIndexFromMidpoints([50, 150, 250], 10), 0);
assert.equal(dropIndexFromMidpoints([50, 150, 250], 100), 1);
assert.equal(dropIndexFromMidpoints([50, 150, 250], 300), 3);
assert.equal(dropIndexFromMidpoints([], 100), 0);

// --- keyboard moves ----------------------------------------------------------------------------------

assert.deepEqual(keyboardTarget(board, 'i9', 'ArrowRight'), { columnId: 'progress', index: 2 });
assert.deepEqual(keyboardTarget(board, 'i9', 'ArrowLeft'), null, 'already in the first column');
assert.deepEqual(keyboardTarget(board, 'i4', 'ArrowRight'), { columnId: 'done', index: 0 }, 'clamped to a shorter column');
assert.deepEqual(keyboardTarget(board, 'i9', 'ArrowUp'), { columnId: 'todo', index: 1 });
assert.deepEqual(ids(moveIssue(board, 'i9', keyboardTarget(board, 'i9', 'ArrowUp')!), 'todo'), ['i3', 'i9', 'i8', 'i5']);
assert.deepEqual(ids(moveIssue(board, 'i9', keyboardTarget(board, 'i9', 'ArrowDown')!), 'todo'), ['i3', 'i8', 'i5', 'i9']);
assert.equal(keyboardTarget(board, 'i5', 'ArrowDown'), null, 'already last');

console.log('board.utils: all checks passed');
