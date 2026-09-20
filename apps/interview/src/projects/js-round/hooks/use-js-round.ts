import { useCallback, useRef, useState } from 'react';
import { DEMOS } from '../constants/demos';

const format = (part: unknown) => (typeof part === 'string' ? part : JSON.stringify(part));

export function useJsRound() {
  const [selectedId, setSelectedId] = useState(DEMOS[0].id);
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  /** A run that is no longer the latest must not write into the console of the next demo. */
  const runId = useRef(0);

  const demo = DEMOS.find((d) => d.id === selectedId) ?? DEMOS[0];

  const run = useCallback(async () => {
    const id = ++runId.current;
    setLines([]);
    setRunning(true);
    const started = performance.now();
    const log = (...parts: unknown[]) => {
      if (id !== runId.current) return;
      const at = Math.round(performance.now() - started).toString().padStart(4, ' ');
      setLines((current) => [...current, `${at}ms  ${parts.map(format).join(' ')}`]);
    };
    try {
      await demo.run(log);
    } catch (error) {
      log('✗ uncaught:', error instanceof Error ? error.message : String(error));
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, [demo]);

  const select = useCallback((id: string) => {
    runId.current += 1;
    setSelectedId(id);
    setLines([]);
    setRunning(false);
  }, []);

  return { demos: DEMOS, demo, selectedId, select, lines, running, run };
}
