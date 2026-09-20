import { useCallback, useEffect, useState } from 'react';
import type { ActivationMode } from '../tabs.types';
import { failureControl, requestLog } from '../utils/panel-api';
import { panelCache } from './use-panel-data';

/** Demo switches around the widget. The widget itself is useTabs + usePanelData. */
export function useTabsPlayground() {
  const [activation, setActivation] = useState<ActivationMode>('automatic');
  const [keepMounted, setKeepMounted] = useState(true);
  const [syncUrl, setSyncUrl] = useState(true);
  const [deferUntilVisible, setDeferUntilVisible] = useState(false);
  const [requests, setRequests] = useState<string[]>([]);
  /** Changing a structural option remounts the widget so the difference is visible from a clean start. */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRequests([...requestLog]), 250);
    return () => clearInterval(timer);
  }, []);

  const restart = useCallback(() => {
    panelCache.clear();
    requestLog.length = 0;
    setRequests([]);
    setGeneration((g) => g + 1);
  }, []);

  const withRestart =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      restart();
    };

  return {
    activation,
    keepMounted,
    syncUrl,
    deferUntilVisible,
    requests,
    generation,
    setActivation: withRestart(setActivation),
    setKeepMounted: withRestart(setKeepMounted),
    setSyncUrl: withRestart(setSyncUrl),
    setDeferUntilVisible: withRestart(setDeferUntilVisible),
    restart,
    failNext: () => {
      failureControl.failNext = true;
    },
  };
}
