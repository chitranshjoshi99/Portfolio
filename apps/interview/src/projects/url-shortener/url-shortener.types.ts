export interface ShortLink {
  /** The short code — also the unique key. */
  code: string;
  /** Normalised absolute URL, always http(s). */
  longUrl: string;
  createdAt: number;
  clicks: number;
  lastVisitedAt: number | null;
  /** True when the user supplied the code instead of it being generated. */
  isCustom: boolean;
}

export interface ShortenerState {
  links: ShortLink[];
  /** Feeds base62 code generation; persisted so codes never repeat. */
  nextId: number;
}

/**
 * Derived read indexes over `links`. Rebuilt from the array on change — not a second
 * source of truth, which is what keeps the two from drifting apart.
 */
export interface LinkIndex {
  /** Lower-cased code -> link. Resolve and alias-taken checks are both O(1). */
  byCode: Map<string, ShortLink>;
  /** Normalised long URL -> the oldest link for that destination. Dedupe on submit is O(1). */
  byLongUrl: Map<string, ShortLink>;
}

/** Which field an error belongs to, so the form can put it in the right place. */
export type FormField = 'url' | 'alias';

export interface FormError {
  field: FormField;
  message: string;
}
