import { useEffect, type RefObject } from 'react';
import { useScrollProgressRegister } from '../contexts/ScrollProgressContext';

export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const register = useScrollProgressRegister();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return register(el);
  }, [ref, register]);
}
