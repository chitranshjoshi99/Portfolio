import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

type RegisterFn = (el: HTMLElement) => () => void;
const Ctx = createContext<RegisterFn>(() => () => {});

export function ScrollProgressProvider({
  children,
  stageRef,
}: {
  children: ReactNode;
  stageRef: RefObject<HTMLElement | null>;
}) {
  const elements = useRef<Set<HTMLElement>>(new Set());
  const rafRef = useRef<number>(0);
  const reducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      if (reducedMotion.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const stageRect = stage.getBoundingClientRect();
      const stageH = stageRect.height;
      const stageCenterY = stageRect.top + stageH / 2;

      for (const el of elements.current) {
        const rect = el.getBoundingClientRect();
        const elCenterY = rect.top + rect.height / 2;
        const dist = Math.abs(elCenterY - stageCenterY);
        // p = 1 when centered in the stage, 0 when one full stage-height away
        const p = Math.max(0, Math.min(1, 1 - dist / stageH));
        el.style.setProperty('--p', p.toFixed(3));
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stageRef]);

  const register = useCallback<RegisterFn>((el) => {
    elements.current.add(el);
    return () => elements.current.delete(el);
  }, []);

  return <Ctx.Provider value={register}>{children}</Ctx.Provider>;
}

export const useScrollProgressRegister = () => useContext(Ctx);
