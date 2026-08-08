import type { City, HighlightSegment, SuggestIndex, SuggestNode } from '../typeahead-search.types';

/** Lower-cased and trimmed — the one place query text is normalised, also the cache key. */
export const normalise = (query: string): string => query.trim().toLowerCase();

/** Match tiers. Higher wins. Kept as named constants so the trie and the scan agree by construction. */
export const TIER = {
  namePrefix: 3, // query starts the city name
  nameInfix: 2, // query appears later in the city name
  country: 1, // query appears in the country name
  none: -1,
} as const;

/**
 * Reference scorer — the O(N) scan below is the oracle the index is tested against.
 * Not on the hot path: the shipped read path is `suggest()`.
 */
export const scoreCity = (city: City, query: string): number => {
  const needle = normalise(query);
  if (!needle) return TIER.none;

  const name = city.name.toLowerCase();
  if (name.startsWith(needle)) return TIER.namePrefix;
  if (name.includes(needle)) return TIER.nameInfix;
  if (city.country.toLowerCase().includes(needle)) return TIER.country;
  return TIER.none;
};

/** The one ordering rule, used by the scan and by the index build. Never duplicated. */
const byRelevance = (a: { city: City; tier: number }, b: { city: City; tier: number }): number =>
  b.tier - a.tier || // match quality
  b.city.population - a.city.population || // then the city people actually mean
  a.city.name.localeCompare(b.city.name); // then deterministic, so the list never reshuffles

/**
 * V1 of the ladder: score every row, sort, slice. O(N + m log m) per keystroke.
 * Shipped nowhere — it exists so the index can be proved equivalent to it in the check file.
 */
export const rankByScan = (cities: City[], query: string, limit: number): City[] =>
  cities
    .map((city) => ({ city, tier: scoreCity(city, query) }))
    .filter((entry) => entry.tier > 0)
    .sort(byRelevance)
    .slice(0, limit)
    .map((entry) => entry.city);

const createNode = (): SuggestNode => ({ children: new Map(), hits: new Map(), top: [] });

/** Records `city` at `tier` on every node along `text`, keeping the strongest tier seen. */
const insertSuffix = (root: SuggestNode, text: string, tier: number, city: City): void => {
  let node = root;
  for (const char of text) {
    let child = node.children.get(char);
    if (!child) {
      child = createNode();
      node.children.set(char, child);
    }
    node = child;
    const seen = node.hits.get(city);
    if (seen === undefined || seen < tier) node.hits.set(city, tier);
  }
};

/**
 * Builds the ranked trie once, at O(sum of L^2) — every suffix of every name is inserted, so a
 * mid-word query ("ark" -> Newark) is a walk, not a scan. Each node then stores its own ranked
 * top-`topK`, which is what makes a query O(q + k) with zero sorting at read time.
 *
 * Memory is the trade: O(sum of L^2) nodes. That is the deal being struck — read time for space.
 */
export const buildSuggestIndex = (cities: City[], topK: number): SuggestIndex => {
  const root = createNode();

  for (const city of cities) {
    const name = city.name.toLowerCase();
    for (let start = 0; start < name.length; start += 1) {
      insertSuffix(root, name.slice(start), start === 0 ? TIER.namePrefix : TIER.nameInfix, city);
    }
    const country = city.country.toLowerCase();
    for (let start = 0; start < country.length; start += 1) {
      insertSuffix(root, country.slice(start), TIER.country, city);
    }
  }

  // One post-order pass turns the hit maps into ranked arrays, then drops them.
  const finalise = (node: SuggestNode): void => {
    node.top = [...node.hits]
      .map(([city, tier]) => ({ city, tier }))
      .sort(byRelevance)
      .slice(0, topK)
      .map((entry) => entry.city);
    node.hits = new Map(); // build-only scratch; keeping it would double the index's memory
    node.children.forEach(finalise);
  };
  finalise(root);

  return { root, topK };
};

/**
 * O(q + limit): walk `q` characters, read the list that was already ranked at build time.
 * Independent of dataset size — this is the whole point of the index.
 *
 * `limit` above the index's `topK` is not answerable from the index; the caller is asking a
 * different question and must scan. Clamped rather than silently truncated.
 */
export const suggest = (index: SuggestIndex, query: string, limit: number): City[] => {
  const needle = normalise(query);
  if (!needle) return [];

  let node = index.root;
  for (const char of needle) {
    const child = node.children.get(char);
    if (!child) return []; // dead prefix: no city contains this text anywhere
    node = child;
  }
  return node.top.slice(0, Math.min(limit, index.topK));
};

/**
 * Splits a label around the first case-insensitive occurrence of the query.
 * Returns segments rather than an HTML string on purpose: the query is user input,
 * and building `<mark>${query}</mark>` is how a typeahead ships an XSS hole.
 */
export const splitHighlight = (label: string, query: string): HighlightSegment[] => {
  const needle = normalise(query);
  const index = needle ? label.toLowerCase().indexOf(needle) : -1;
  if (index === -1) return [{ text: label, isMatch: false }];

  return [
    { text: label.slice(0, index), isMatch: false },
    { text: label.slice(index, index + needle.length), isMatch: true },
    { text: label.slice(index + needle.length), isMatch: false },
  ].filter((segment) => segment.text !== '');
};

/** Arrow-key movement that wraps at both ends. `-1` means "nothing active yet". */
export const nextIndex = (current: number, delta: number, length: number): number => {
  if (length === 0) return -1;
  if (current === -1) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
};
