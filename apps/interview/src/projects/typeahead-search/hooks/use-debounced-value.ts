import { useEffect, useState } from 'react';

/**
 * Debounce the VALUE, not the handler: the input keeps updating on every keystroke,
 * only the value that effects depend on lags behind. The cleanup cancels the pending
 * timer, so a burst of keystrokes produces exactly one settled value.
 *
 * ponytail: deliberately duplicated per project — each project folder has to stand
 * alone as an interview answer. See CLAUDE.md.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
