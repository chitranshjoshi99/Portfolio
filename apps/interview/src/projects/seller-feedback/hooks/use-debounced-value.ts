import { useEffect, useState } from 'react';

/**
 * Delays a fast-changing value (a search box) so downstream effects don't fire per keystroke.
 * The cleanup cancels the pending timer, so only the last value in a burst survives.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
