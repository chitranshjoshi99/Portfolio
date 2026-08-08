import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COPIED_FEEDBACK_MS, SHORT_ORIGIN } from '../constants/url-shortener.constants';
import type { FormError, ShortLink, ShortenerState } from '../url-shortener.types';
import { loadState, saveState } from '../utils/link-storage';
import {
  buildLinkIndex,
  extractCode,
  findByCode,
  findByLongUrl,
  incrementVisit,
  parseLongUrl,
  toBase62,
  validateAlias,
} from '../utils/url-shortener.utils';

export interface UseShortLinks {
  url: string;
  setUrl: (url: string) => void;
  alias: string;
  setAlias: (alias: string) => void;
  error: FormError | null;
  links: ShortLink[];
  totalClicks: number;
  lastCreatedCode: string | null;
  submit: () => void;
  remove: (code: string) => void;
  visit: (code: string) => void;
  copy: (code: string) => void;
  copiedCode: string | null;
  shortUrl: (code: string) => string;
  resolve: (input: string) => ShortLink | undefined;
}

export function useShortLinks(): UseShortLinks {
  // Lazy initialiser: read storage once, before the first paint, so there is no
  // empty-then-populated flash and no "hydrate in an effect" round trip.
  const [state, setState] = useState<ShortenerState>(loadState);
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One effect persists every mutation path — no action has to remember to save.
  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => () => clearTimeout(copyTimer.current ?? undefined), []);

  const shortUrl = useCallback((code: string) => `https://${SHORT_ORIGIN}/${code}`, []);

  // Rebuilt only when the links change, so every read below is O(1) instead of a scan.
  const index = useMemo(() => buildLinkIndex(state.links), [state.links]);

  const submit = useCallback(() => {
    const parsed = parseLongUrl(url);
    if ('error' in parsed) return setError(parsed.error);

    const trimmedAlias = alias.trim();
    if (trimmedAlias) {
      const aliasError = validateAlias(trimmedAlias, index);
      if (aliasError) return setError(aliasError);
    }

    // Same destination, no custom alias asked for: hand back the existing code
    // instead of minting a second one for the same page.
    const existing = findByLongUrl(index, parsed.url);
    if (existing && !trimmedAlias) {
      setError(null);
      setLastCreatedCode(existing.code);
      setUrl('');
      return;
    }

    const link: ShortLink = {
      code: trimmedAlias || toBase62(state.nextId),
      longUrl: parsed.url,
      createdAt: Date.now(),
      clicks: 0,
      lastVisitedAt: null,
      isCustom: Boolean(trimmedAlias),
    };

    setState((current) => ({
      links: [link, ...current.links],
      // The counter advances even for a custom alias, so a later generated code
      // can never land on a number that was skipped.
      nextId: current.nextId + 1,
    }));
    setLastCreatedCode(link.code);
    setError(null);
    setUrl('');
    setAlias('');
  }, [alias, index, state.nextId, url]);

  const remove = useCallback((code: string) => {
    setState((current) => ({ ...current, links: current.links.filter((link) => link.code !== code) }));
    setLastCreatedCode((current) => (current === code ? null : current));
  }, []);

  const visit = useCallback((code: string) => {
    setState((current) => ({ ...current, links: incrementVisit(current.links, code, Date.now()) }));
  }, []);

  const copy = useCallback(
    (code: string) => {
      // Fire and forget: a rejected clipboard permission must not break the app.
      void navigator.clipboard?.writeText(shortUrl(code)).catch(() => undefined);
      setCopiedCode(code);
      clearTimeout(copyTimer.current ?? undefined);
      copyTimer.current = setTimeout(() => setCopiedCode(null), COPIED_FEEDBACK_MS);
    },
    [shortUrl],
  );

  const resolve = useCallback((input: string) => findByCode(index, extractCode(input)), [index]);

  const totalClicks = useMemo(
    () => state.links.reduce((total, link) => total + link.clicks, 0),
    [state.links],
  );

  return {
    url,
    setUrl,
    alias,
    setAlias,
    error,
    links: state.links,
    totalClicks,
    lastCreatedCode,
    submit,
    remove,
    visit,
    copy,
    copiedCode,
    shortUrl,
    resolve,
  };
}
