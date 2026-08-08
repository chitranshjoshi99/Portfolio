/** Below this, typing is still noise — do not spend a request on it. */
export const MIN_QUERY_LENGTH = 2;

export const SEARCH_DEBOUNCE_MS = 250;

export const MAX_SUGGESTIONS = 8;

/**
 * Results stored per trie node. Must be >= MAX_SUGGESTIONS; the headroom is what lets the same
 * index answer a "show more" list without a rebuild. Raising it costs memory linearly.
 */
export const INDEX_TOP_K = 25;

export const LATENCY_MS = 350;

/** Overridable at runtime so the error state can be demonstrated on request. */
export const FAILURE_RATE = 0;

export const MESSAGE = {
  hint: `Type at least ${MIN_QUERY_LENGTH} characters.`,
  empty: 'No cities match that search.',
  failed: 'Suggestions could not be loaded.',
  loading: 'Searching…',
};
