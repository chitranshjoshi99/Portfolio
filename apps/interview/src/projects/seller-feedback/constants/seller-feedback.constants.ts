import type { FeedbackStatus } from '../seller-feedback.types';

export const PAGE_SIZE = 5;

export const SEARCH_DEBOUNCE_MS = 300;

export const STATUS_FILTERS: { value: FeedbackStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const MESSAGE = {
  listFailed: 'Could not load feedback.',
  mutationFailed: (status: FeedbackStatus) => `Could not ${status === 'approved' ? 'approve' : 'reject'} this review.`,
  empty: 'No feedback matches these filters.',
};

/** Share of API calls that fail on purpose, so rollback and retry are demonstrable. */
export const FAILURE_RATE = { list: 0, mutation: 0.3 };

export const LATENCY_MS = { list: 450, mutation: 700 };
