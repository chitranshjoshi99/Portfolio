import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the element has been on screen. Latches — scrolling away again does not unload anything.
 * No IntersectionObserver (very old browsers, some test envs) = treat as visible, never as "never load".
 */
export function useInView(ref: RefObject<Element | null>, enabled: boolean): boolean {
  const [seen, setSeen] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setSeen(true);
      return;
    }
    setSeen(false);
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, ref]);

  return seen;
}
