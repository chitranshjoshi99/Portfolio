export const STORAGE_KEY = 'interview-prep:url-shortener:v1';

/** Codes start here so the first one is 3 chars — 'q0' looks like a bug report. */
export const FIRST_ID = 250_000;

export const BASE62_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Only these schemes may ever reach an anchor href. */
export const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export const ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const ALIAS_LENGTH = { min: 3, max: 24 };

/** Aliases that would collide with app routes if this were a real service. */
export const RESERVED_ALIASES = new Set(['api', 'admin', 'login', 'signup', 'stats', 'new', 'projects']);

/** Display-only origin for the short links; nothing is actually served from it. */
export const SHORT_ORIGIN = 'short.ly';

export const COPIED_FEEDBACK_MS = 1500;

export const ERROR = {
  urlRequired: 'Enter a URL to shorten.',
  urlInvalid: 'That is not a valid URL.',
  urlProtocol: 'Only http:// and https:// links can be shortened.',
  aliasCharset: 'Alias can use letters, numbers, hyphen and underscore only.',
  aliasLength: `Alias must be ${ALIAS_LENGTH.min}–${ALIAS_LENGTH.max} characters.`,
  aliasReserved: 'That alias is reserved.',
  aliasTaken: 'That alias is already in use.',
};
