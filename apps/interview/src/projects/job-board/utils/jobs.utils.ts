/** The page of ids to request next. Slicing ids is free; fetching details is not. */
export function pageSlice<T>(items: T[], page: number, size: number): T[] {
  const start = Math.max(0, page) * Math.max(1, size);
  return items.slice(start, start + Math.max(1, size));
}

/**
 * Run `task` over every item with at most `limit` in flight, and return results **in input order**.
 * Promise.all is the same thing with limit = Infinity; a pool matters the moment a page is 50 items
 * and the browser is queueing them six at a time anyway.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const size = Math.max(1, Math.floor(limit));
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1; // claimed before the await, so two workers never take the same item
      results[index] = await task(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

/** "3 hours ago" — the only formatting a job list needs, and the one people get wrong at boundaries. */
export function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 0) return 'just now'; // a clock skew is not a reason to print "in -2 minutes"
  if (seconds < 60) return 'just now';

  const units: [label: string, seconds: number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [label, span] of units) {
    const value = Math.floor(seconds / span);
    if (value >= 1) return `${value} ${label}${value === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/** The host, for the little "(example.com)" after a title. Never throws on a malformed url. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const uniqueIds = (ids: number[]): number[] => [...new Set(ids)];

export const hasMore = (ids: number[], loaded: number): boolean => loaded < ids.length;
