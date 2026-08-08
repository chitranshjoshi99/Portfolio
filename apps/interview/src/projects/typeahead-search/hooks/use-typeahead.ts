import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  MAX_SUGGESTIONS,
  MESSAGE,
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
} from '../constants/typeahead.constants';
import type { City } from '../typeahead-search.types';
import { searchCities } from '../utils/suggest-api';
import { nextIndex, normalise } from '../utils/typeahead.utils';
import { useDebouncedValue } from './use-debounced-value';

export interface UseTypeahead {
  query: string;
  changeQuery: (query: string) => void;
  suggestions: City[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  selected: City | null;
  select: (city: City) => void;
  open: () => void;
  close: () => void;
  clear: () => void;
  isTooShort: boolean;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  listboxId: string;
  getOptionId: (index: number) => string;
  requestCount: number;
  cacheSize: number;
}

export function useTypeahead(): UseTypeahead {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<City | null>(null);
  /** Which option the keyboard is on. -1 = none. Focus never leaves the input. */
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Requests actually sent — visible proof that debounce and cache suppress work. */
  const [requestCount, setRequestCount] = useState(0);

  const listboxId = useId();
  const getOptionId = useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  /** Only the newest request may write to state. */
  const latestRequestId = useRef(0);
  /** query -> results. Re-typing a prefix is then free, and the list never flickers. */
  const cache = useRef(new Map<string, City[]>());
  /** Picking a suggestion rewrites the input; that rewrite must not trigger a search. */
  const suppressNextFetch = useRef(false);

  const key = normalise(debouncedQuery);
  const isTooShort = key.length > 0 && key.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false;
      return;
    }

    if (key.length < MIN_QUERY_LENGTH) {
      latestRequestId.current += 1; // any in-flight response is now irrelevant
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = cache.current.get(key);
    if (cached) {
      latestRequestId.current += 1;
      setSuggestions(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setRequestCount((count) => count + 1);

    searchCities(key, MAX_SUGGESTIONS)
      .then((results) => {
        cache.current.set(key, results);
        if (requestId !== latestRequestId.current) return;
        setSuggestions(results);
        setError(null);
      })
      .catch(() => {
        if (requestId !== latestRequestId.current) return;
        setSuggestions([]);
        setError(MESSAGE.failed);
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });
  }, [key]);

  // A new result set invalidates the old highlight — never leave it pointing at row 4
  // of a list that now has two rows.
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  const changeQuery = useCallback((next: string) => {
    setQuery(next);
    setSelected(null);
    setIsOpen(true);
  }, []);

  const select = useCallback((city: City) => {
    suppressNextFetch.current = true;
    setSelected(city);
    setQuery(city.name);
    setIsOpen(false);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const clear = useCallback(() => {
    setQuery('');
    setSelected(null);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          if (suggestions.length === 0) return;
          // Otherwise the caret jumps to the start/end of the input while navigating.
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            return;
          }
          setActiveIndex((current) => nextIndex(current, event.key === 'ArrowDown' ? 1 : -1, suggestions.length));
          return;
        }
        case 'Enter': {
          // No active option means the user is submitting their own text — leave it alone.
          if (!isOpen || activeIndex < 0) return;
          event.preventDefault();
          select(suggestions[activeIndex]);
          return;
        }
        case 'Escape': {
          // Closes the list but keeps what was typed; a second Escape is the browser's to handle.
          if (!isOpen) return;
          event.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          return;
        }
        case 'Tab': {
          // Focus is leaving — the popup must not stay behind. Not a selection.
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }
    },
    [activeIndex, isOpen, select, suggestions],
  );

  return {
    query,
    changeQuery,
    suggestions,
    isOpen,
    isLoading,
    error,
    selected,
    select,
    open,
    close,
    clear,
    isTooShort,
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    listboxId,
    getOptionId,
    requestCount,
    cacheSize: cache.current.size,
  };
}
