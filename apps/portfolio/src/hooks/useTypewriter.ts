import { useEffect, useState } from "react";

interface Options {
  speed?: number; // ms per character
  delay?: number; // ms before starting
  loop?: boolean;
  pauseEnd?: number; // ms to pause at end before looping
}

export function useTypewriter(text: string, opts: Options = {}) {
  const { speed = 60, delay = 0, loop = false, pauseEnd = 2000 } = opts;
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);

    let i = 0;
    let tid: ReturnType<typeof setTimeout>;

    const type = () => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
        tid = setTimeout(type, speed);
      } else {
        setDone(true);
        if (loop) {
          tid = setTimeout(() => {
            i = 0;
            setDisplayed("");
            setDone(false);
            tid = setTimeout(type, speed);
          }, pauseEnd);
        }
      }
    };

    const startId = setTimeout(type, delay);
    return () => {
      clearTimeout(startId);
      clearTimeout(tid);
    };
  }, [text, speed, delay, loop, pauseEnd]);

  return { displayed, done };
}
