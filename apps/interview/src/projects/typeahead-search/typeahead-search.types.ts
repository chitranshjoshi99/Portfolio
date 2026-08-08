export interface City {
  id: string;
  name: string;
  country: string;
  population: number;
}

/** One piece of a suggestion label: either part of the match, or not. */
export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * One character of the suggestion trie.
 * `hits` is build-time scratch (city -> strongest tier); `top` is the ranked answer for the
 * prefix that reaches this node, computed once at build so a query never sorts.
 */
export interface SuggestNode {
  children: Map<string, SuggestNode>;
  hits: Map<City, number>;
  top: City[];
}

export interface SuggestIndex {
  root: SuggestNode;
  /** How many results each node stores. A query asking for more cannot be served from the index. */
  topK: number;
}
