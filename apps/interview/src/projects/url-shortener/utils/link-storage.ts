import { FIRST_ID, STORAGE_KEY } from '../constants/url-shortener.constants.ts';
import type { ShortLink, ShortenerState } from '../url-shortener.types.ts';

export const emptyState = (): ShortenerState => ({ links: [], nextId: FIRST_ID });

const isShortLink = (value: unknown): value is ShortLink => {
  if (typeof value !== 'object' || value === null) return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.code === 'string' &&
    link.code.length > 0 &&
    typeof link.longUrl === 'string' &&
    typeof link.createdAt === 'number' &&
    typeof link.clicks === 'number' &&
    typeof link.isCustom === 'boolean' &&
    (link.lastVisitedAt === null || typeof link.lastVisitedAt === 'number')
  );
};

/**
 * Anything can be in localStorage: another app's data, a half-written value, a
 * shape from an older version of this code. Parsing must therefore never throw
 * and never trust the payload — bad rows are dropped, a bad document is discarded.
 */
export const parseState = (raw: string | null): ShortenerState => {
  if (!raw) return emptyState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyState();
  }

  if (typeof parsed !== 'object' || parsed === null) return emptyState();
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.links)) return emptyState();

  const links = candidate.links.filter(isShortLink);
  const nextId = typeof candidate.nextId === 'number' && Number.isFinite(candidate.nextId) ? candidate.nextId : FIRST_ID;

  // A stored nextId lower than the codes already issued would re-issue a code.
  return { links, nextId: Math.max(nextId, FIRST_ID + links.length) };
};

export const loadState = (): ShortenerState => {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Safari private mode and blocked-storage settings throw on access.
    return emptyState();
  }
};

export const saveState = (state: ShortenerState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — the app still works for this session.
  }
};
