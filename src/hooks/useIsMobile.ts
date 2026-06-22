import { useEffect, useState } from "react";

// Mobile = narrow viewport, OR a touch device that's still fairly small
// (landscape phones / small tablets). Width-first, touch as a widening net.
const QUERY = "(max-width: 768px), ((pointer: coarse) and (max-width: 899px))";

function match() {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

/** Reactive mobile-layout flag. Re-renders on viewport / orientation change. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(match);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange(); // sync in case it changed between first paint and mount
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
