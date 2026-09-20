import type { Query, SortColumn, SortDir } from '../data-table.types.ts';

/**
 * Sorting a column cycles asc → desc → back to the default, and sorting a *different* column starts
 * at asc. Returning the whole query means the page reset lives here too: page 3 of the old sort has
 * no meaning under the new one.
 */
export function nextSort(query: Query, column: SortColumn, fallback: { sort: SortColumn; dir: SortDir }): Query {
  if (query.sort !== column) return { ...query, sort: column, dir: 'asc', page: 1 };
  if (query.dir === 'asc') return { ...query, dir: 'desc', page: 1 };
  return { ...query, sort: fallback.sort, dir: fallback.dir, page: 1 };
}

export const totalPages = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

/** A filter that shrinks the result set must not leave the table on a page that no longer exists. */
export const clampPage = (page: number, total: number, pageSize: number): number =>
  Math.min(Math.max(1, Math.floor(page) || 1), totalPages(total, pageSize));

/** "Showing 21–30 of 137" — computed from what the server reported, never from rows.length. */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return 'No matching issues';
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `Showing ${first}–${last} of ${total}`;
}

/** Page numbers with gaps: 1 … 4 5 [6] 7 8 … 20. `null` is a gap, never a clickable page. */
export function pageWindow(page: number, pages: number, span = 2): (number | null)[] {
  if (pages <= 1) return [1];
  const items: (number | null)[] = [];
  let from = Math.max(2, page - span);
  let to = Math.min(pages - 1, page + span);
  // A gap that hides exactly one page is worse than the page: "1 … 3" costs the same width as "1 2 3".
  if (from === 3) from = 2;
  if (to === pages - 2) to = pages - 1;

  items.push(1);
  if (from > 2) items.push(null);
  for (let value = from; value <= to; value += 1) items.push(value);
  if (to < pages - 1) items.push(null);
  if (pages > 1) items.push(pages);
  return items;
}

/**
 * The cache key for a request. Everything the server reads is in it and nothing else is, so two
 * queries that would return the same page share a key — and a key change is exactly a refetch.
 */
export function queryKey(query: Query): string {
  return [
    query.page, query.pageSize, query.sort, query.dir,
    query.search.trim().toLowerCase(), query.status,
  ].join('|');
}

export const isSameQuery = (a: Query, b: Query): boolean => queryKey(a) === queryKey(b);

/** aria-sort takes the column's own state, not the table's: every other header is 'none'. */
export const ariaSort = (query: Query, column: SortColumn): 'ascending' | 'descending' | 'none' =>
  query.sort !== column ? 'none' : query.dir === 'asc' ? 'ascending' : 'descending';
