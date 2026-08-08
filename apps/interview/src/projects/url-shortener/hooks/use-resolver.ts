import { useCallback, useState } from 'react';
import type { ShortLink } from '../url-shortener.types';

interface UseResolver {
  input: string;
  setInput: (input: string) => void;
  /** `undefined` = not looked up yet, `null` = looked up and missing. */
  result: ShortLink | null | undefined;
  lookup: () => void;
}

export function useResolver(
  resolve: (input: string) => ShortLink | undefined,
  visit: (code: string) => void,
): UseResolver {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ShortLink | null | undefined>(undefined);

  const lookup = useCallback(() => {
    const found = resolve(input);
    setResult(found ?? null);
    if (found) visit(found.code);
  }, [input, resolve, visit]);

  return { input, setInput, result, lookup };
}
