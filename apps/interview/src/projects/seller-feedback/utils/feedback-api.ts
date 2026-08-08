import { FAILURE_RATE, LATENCY_MS } from '../constants/seller-feedback.constants';
import { FEEDBACK_SEED } from '../constants/feedback-seed';
import type { FeedbackPage, FeedbackQuery, FeedbackStatus } from '../seller-feedback.types';
import { applyQuery, buildFeedbackIndex, withStatus } from './feedback.utils';

/**
 * Stand-in for a backend. Everything the UI knows about feedback comes through here,
 * so the hook has to deal with latency, failure and out-of-order responses for real.
 * The index is module state on purpose: a successful mutation must survive the next refetch.
 */
let index = buildFeedbackIndex(FEEDBACK_SEED);

/**
 * Paging within one filter should not re-filter. Keyed on the parts of the query that change the
 * *set* — page and pageSize only change the slice.
 *
 * Every write clears it. That single invalidation point is the entire reason this cache is safe;
 * a cache with two writers and one invalidator is how an approved row keeps rendering as pending.
 */
let pageCache = new Map<string, FeedbackPage>();

const cacheKey = (query: FeedbackQuery): string =>
  `${query.search.trim().toLowerCase()}|${query.status}|${query.page}|${query.pageSize}`;

/** Overridable so the UI can force every mutation to fail and make rollback easy to see. */
let mutationFailureRate = FAILURE_RATE.mutation;

export function setMutationFailureRate(rate: number): void {
  mutationFailureRate = rate;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Jitter, so two requests fired back to back can genuinely resolve out of order. */
const jitter = (ms: number) => ms * (0.5 + Math.random());

export async function listFeedback(query: FeedbackQuery): Promise<FeedbackPage> {
  await sleep(jitter(LATENCY_MS.list));
  if (Math.random() < FAILURE_RATE.list) throw new Error('list failed');

  const key = cacheKey(query);
  const hit = pageCache.get(key);
  if (hit) return hit;

  const page = applyQuery(index, query);
  pageCache.set(key, page);
  return page;
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  await sleep(jitter(LATENCY_MS.mutation));
  if (Math.random() < mutationFailureRate) throw new Error('update failed');
  index = withStatus(index, id, status);
  pageCache = new Map(); // the only write path, and therefore the only invalidation point
}

/** Puts the demo data back to its seed state. */
export function resetFeedbackDb(): void {
  index = buildFeedbackIndex(FEEDBACK_SEED);
  pageCache = new Map();
}
