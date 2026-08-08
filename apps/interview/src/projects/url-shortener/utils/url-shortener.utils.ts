import {
  ALIAS_LENGTH,
  ALIAS_PATTERN,
  ALLOWED_PROTOCOLS,
  BASE62_ALPHABET,
  ERROR,
  RESERVED_ALIASES,
  // .ts extension so this file also runs under plain `node` for the self-check.
} from '../constants/url-shortener.constants.ts';
import type { FormError, LinkIndex, ShortLink } from '../url-shortener.types';

/**
 * Base62 of a monotonic counter. A counter cannot collide, so there is no retry
 * loop and no lookup before insert — the whole reason to prefer it over random
 * codes when the codes do not need to be unguessable.
 */
export const toBase62 = (value: number): string => {
  if (value === 0) return BASE62_ALPHABET[0];
  let remaining = value;
  let code = '';
  while (remaining > 0) {
    code = BASE62_ALPHABET[remaining % 62] + code;
    remaining = Math.floor(remaining / 62);
  }
  return code;
};

export const fromBase62 = (code: string): number =>
  [...code].reduce((total, char) => total * 62 + BASE62_ALPHABET.indexOf(char), 0);

/**
 * Parses user input into a safe absolute URL, or returns an error.
 *
 * This is a trust boundary: the result is rendered as an anchor `href`, so
 * `javascript:` and `data:` must be rejected here — an allowlist of protocols,
 * never a blocklist of strings. A bare "example.com" is treated as https.
 */
export const parseLongUrl = (raw: string): { url: string } | { error: FormError } => {
  const trimmed = raw.trim();
  if (!trimmed) return { error: { field: 'url', message: ERROR.urlRequired } };

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: { field: 'url', message: ERROR.urlInvalid } };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { error: { field: 'url', message: ERROR.urlProtocol } };
  }
  // "https://" alone parses fine but has no host.
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { error: { field: 'url', message: ERROR.urlInvalid } };
  }

  return { url: parsed.toString() };
};

/**
 * Two indexes over the link list, rebuilt whenever it changes — the same thing a database does
 * with a unique index on `code` and one on `long_url`. Codes are keyed lower-case because the
 * resolver and the alias check are both case-insensitive; keying on the raw code would let
 * "AbC" and "abc" coexist and then resolve unpredictably.
 *
 * Build O(n), every read O(1). Derived data, never a second source of truth — the array is
 * still the state, and this is recomputed from it rather than maintained alongside it.
 */
export const buildLinkIndex = (links: ShortLink[]): LinkIndex => {
  const byCode = new Map<string, ShortLink>();
  const byLongUrl = new Map<string, ShortLink>();
  for (const link of links) {
    byCode.set(link.code.toLowerCase(), link);
    // First writer wins, and `links` is newest-first — so dedupe hands back the most recent
    // link for a destination, exactly as the linear `find` it replaced did.
    if (!byLongUrl.has(link.longUrl)) byLongUrl.set(link.longUrl, link);
  }
  return { byCode, byLongUrl };
};

/** Validates a user-supplied alias against charset, length, reserved words and existing codes. */
export const validateAlias = (alias: string, index: LinkIndex): FormError | null => {
  const trimmed = alias.trim();
  if (trimmed.length < ALIAS_LENGTH.min || trimmed.length > ALIAS_LENGTH.max) {
    return { field: 'alias', message: ERROR.aliasLength };
  }
  if (!ALIAS_PATTERN.test(trimmed)) return { field: 'alias', message: ERROR.aliasCharset };
  if (RESERVED_ALIASES.has(trimmed.toLowerCase())) return { field: 'alias', message: ERROR.aliasReserved };
  if (index.byCode.has(trimmed.toLowerCase())) return { field: 'alias', message: ERROR.aliasTaken };
  return null;
};

/**
 * Same destination shortened twice should reuse the existing code — comparing the
 * normalised URLs, so "example.com/a" and "https://example.com/a" count as one. O(1).
 */
export const findByLongUrl = (index: LinkIndex, longUrl: string): ShortLink | undefined =>
  index.byLongUrl.get(longUrl);

/** O(1) resolve — the read path a real shortener serves billions of times a day. */
export const findByCode = (index: LinkIndex, code: string): ShortLink | undefined =>
  index.byCode.get(code.trim().toLowerCase());

/** Accepts a bare code or a full short URL, and returns just the code. */
export const extractCode = (input: string): string => {
  const trimmed = input.trim().replace(/\/+$/, '');
  const lastSegment = trimmed.split('/').pop() ?? '';
  return lastSegment;
};

/** Middle-truncates a long URL so both the host and the tail stay readable. */
export const truncateUrl = (url: string, max = 58): string => {
  if (url.length <= max) return url;
  const head = Math.ceil((max - 1) / 2);
  return `${url.slice(0, head)}…${url.slice(url.length - (max - head - 1))}`;
};

export const incrementVisit = (links: ShortLink[], code: string, now: number): ShortLink[] =>
  links.map((link) =>
    link.code === code ? { ...link, clicks: link.clicks + 1, lastVisitedAt: now } : link,
  );
