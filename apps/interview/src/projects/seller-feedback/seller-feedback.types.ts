export type FeedbackStatus = 'pending' | 'approved' | 'rejected';

export interface Feedback {
  id: string;
  buyer: string;
  orderId: string;
  rating: number;
  comment: string;
  /** ISO date — kept as a string so it stays serialisable. */
  submittedAt: string;
  status: FeedbackStatus;
}

/** What the list endpoint accepts. `status: 'all'` means no status filter. */
export interface FeedbackQuery {
  search: string;
  status: FeedbackStatus | 'all';
  page: number;
  pageSize: number;
}

export interface FeedbackPage {
  items: Feedback[];
  total: number;
}

/** A row with its searchable text precomputed — built at ingest, never per keystroke. */
export interface IndexedFeedback extends Feedback {
  /** `buyer orderId comment`, lower-cased. One `includes` replaces three. */
  search: string;
}

/**
 * The read structure the fake backend serves from. Derived from the rows and rebuilt on write —
 * never edited in place, so a stale bucket cannot outlive the data it came from.
 */
export interface FeedbackIndex {
  /** Every row, newest-first. Filtering preserves order, so a query never sorts. */
  sorted: IndexedFeedback[];
  /** Rows per status, each already newest-first. Status filtering is a lookup. */
  byStatus: Record<FeedbackStatus, IndexedFeedback[]>;
  /** id -> row, so a mutation finds its target in O(1). */
  byId: Map<string, IndexedFeedback>;
}
