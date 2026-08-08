import { useEffect, type RefObject } from 'react';

/**
 * Closes a popup when the pointer goes down anywhere outside `ref`.
 * `pointerdown`, not `click`: a click fires after mouseup, so a user who presses
 * inside the list and releases outside would otherwise dismiss their own selection.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  useEffect(() => {
    const handle = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };

    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [ref, onOutside]);
}
