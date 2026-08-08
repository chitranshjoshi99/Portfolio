import type {
  Feedback,
  FeedbackIndex,
  FeedbackPage,
  FeedbackQuery,
  FeedbackStatus,
  IndexedFeedback,
} from '../seller-feedback.types';

const STATUSES: FeedbackStatus[] = ['pending', 'approved', 'rejected'];

/** Newest first — the only order a review queue is ever wanted in. */
const bySubmittedAtDesc = (a: Feedback, b: Feedback): number =>
  b.submittedAt.localeCompare(a.submittedAt);

/** Every searchable field, lower-cased, joined once. Built at ingest, never per keystroke. */
const searchKey = (feedback: Feedback): string =>
  `${feedback.buyer} ${feedback.orderId} ${feedback.comment}`.toLowerCase();

/** Search hits buyer, order id and comment. Case-insensitive, trimmed. */
export const matchesSearch = (feedback: Feedback, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  return !needle || searchKey(feedback).includes(needle);
};

export const matchesStatus = (feedback: Feedback, status: FeedbackQuery['status']): boolean =>
  status === 'all' || feedback.status === status;

export const totalPages = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / pageSize));

/**
 * Built once when rows arrive, and rebuilt on write. Three pieces, each removing one
 * per-query cost:
 *
 * - `sorted` is ordered newest-first at build. `Array.prototype.filter` preserves order and
 *   `sort` is stable (required since ES2019), so a query never sorts — the `m log m` term is gone.
 * - `byStatus` turns the status filter into a lookup, and makes the toolbar counts free instead
 *   of a second full scan.
 * - `search` on each row is the pre-lowercased haystack, so a keystroke allocates nothing.
 */
export const buildFeedbackIndex = (rows: Feedback[]): FeedbackIndex => {
  const sorted: IndexedFeedback[] = rows
    .map((row) => ({ ...row, search: searchKey(row) }))
    .sort(bySubmittedAtDesc);

  const byStatus = { pending: [], approved: [], rejected: [] } as Record<
    FeedbackStatus,
    IndexedFeedback[]
  >;
  const byId = new Map<string, IndexedFeedback>();
  for (const row of sorted) {
    byStatus[row.status].push(row); // pushed in sorted order, so each bucket is sorted too
    byId.set(row.id, row);
  }

  return { sorted, byStatus, byId };
};

/**
 * The whole read path: pick a bucket, filter by text, clamp the page, slice.
 *
 * With no search text this is **O(p)** — no row is examined, because the bucket is already the
 * filtered, sorted answer. With search text it is O(candidates), over the status bucket rather
 * than the whole table.
 *
 * Page numbers are 1-based and clamped, so a filter change can never strand the user on page 7.
 */
export const applyQuery = (index: FeedbackIndex, query: FeedbackQuery): FeedbackPage => {
  const candidates = query.status === 'all' ? index.sorted : index.byStatus[query.status];
  const needle = query.search.trim().toLowerCase();
  const filtered = needle ? candidates.filter((row) => row.search.includes(needle)) : candidates;

  const page = Math.min(Math.max(1, query.page), totalPages(filtered.length, query.pageSize));
  const start = (page - 1) * query.pageSize;

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
};

/** `Pending (23)` in the toolbar, without a scan. */
export const statusCounts = (index: FeedbackIndex): Record<FeedbackStatus, number> =>
  Object.fromEntries(STATUSES.map((status) => [status, index.byStatus[status].length])) as Record<
    FeedbackStatus,
    number
  >;

/**
 * The server's write path: swap a row's status and re-derive the index.
 *
 * O(n) to re-bucket, and deliberately **not** a re-sort: a status change cannot move a row in
 * `submittedAt` order, so the existing order is reused. Writes are rare, reads are not — this is
 * the side of the trade that should be paying.
 */
export const withStatus = (
  index: FeedbackIndex,
  id: string,
  status: FeedbackStatus,
): FeedbackIndex => {
  const current = index.byId.get(id);
  if (!current || current.status === status) return index;

  const updated: IndexedFeedback = { ...current, status };
  const sorted = index.sorted.map((row) => (row.id === id ? updated : row));

  const byStatus = { pending: [], approved: [], rejected: [] } as Record<
    FeedbackStatus,
    IndexedFeedback[]
  >;
  const byId = new Map(index.byId);
  byId.set(id, updated);
  for (const row of sorted) byStatus[row.status].push(row);

  return { sorted, byStatus, byId };
};

/** Plain rows back out, for anything that wants the table rather than the index. */
export const toRows = (index: FeedbackIndex): Feedback[] => index.sorted;

/**
 * The client's optimistic patch: one row in the page currently on screen. O(p), not O(n) —
 * the client holds a page, not the table, which is exactly why the server keeps the index.
 */
export const patchRowStatus = (
  rows: Feedback[],
  id: string,
  status: FeedbackStatus,
): Feedback[] => rows.map((row) => (row.id === id ? { ...row, status } : row));

/**
 * V1 of the ladder: filter, sort, clamp, slice, over a raw array. Not on the read path —
 * it is the oracle the index is tested against in the check file.
 */
export const applyQueryByScan = (all: Feedback[], query: FeedbackQuery): FeedbackPage => {
  const filtered = all
    .filter((row) => matchesSearch(row, query.search) && matchesStatus(row, query.status))
    .sort(bySubmittedAtDesc);

  const page = Math.min(Math.max(1, query.page), totalPages(filtered.length, query.pageSize));
  const start = (page - 1) * query.pageSize;

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
};
