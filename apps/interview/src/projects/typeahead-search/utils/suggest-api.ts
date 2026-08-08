import { CITIES } from '../constants/city-dataset';
import { FAILURE_RATE, INDEX_TOP_K, LATENCY_MS } from '../constants/typeahead.constants';
import type { City } from '../typeahead-search.types';
import { buildSuggestIndex, suggest } from './typeahead.utils';

let failureRate = FAILURE_RATE;

/** Lets the UI force the error state instead of waiting for a random failure. */
export function setSuggestFailureRate(rate: number): void {
  failureRate = rate;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Built once, at module load — the same thing a real service does at deploy time.
 * Every request after this is a trie walk, not a scan over CITIES.
 */
const index = buildSuggestIndex(CITIES, INDEX_TOP_K);

/** Jittered, so two in-flight requests can genuinely resolve out of order. */
export async function searchCities(query: string, limit: number): Promise<City[]> {
  await sleep(LATENCY_MS * (0.4 + Math.random()));
  if (Math.random() < failureRate) throw new Error('suggest failed');
  return suggest(index, query, limit);
}
