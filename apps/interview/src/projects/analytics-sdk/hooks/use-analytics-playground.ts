import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { AnalyticsLogEntry } from '../analytics-sdk.types';
import { BURST_SIZE, DEFAULT_CONFIG, LOG_LIMIT, SAMPLE_EVENTS, type CollectorMode } from '../constants/analytics-sdk.constants';
import { attachPageLifecycle } from '../utils/analytics-client';
import { collector, getAnalytics, initAnalytics, type AnalyticsConfig } from '../utils/analytics-singleton';

export function useAnalyticsPlayground() {
  const [client, setClient] = useState(getAnalytics);
  const [config, setConfig] = useState<AnalyticsConfig>(DEFAULT_CONFIG);
  const [mode, setModeState] = useState<CollectorMode>(collector.mode);
  const [log, setLog] = useState<AnalyticsLogEntry[]>([]);
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot);

  useEffect(() => client.onLog((entry) => setLog((current) => [entry, ...current].slice(0, LOG_LIMIT))), [client]);
  // The real thing: hide the tab (or switch apps on mobile) and the queue goes out by beacon.
  useEffect(() => attachPageLifecycle(client), [client]);

  const track = useCallback((index: number) => {
    const sample = SAMPLE_EVENTS[index % SAMPLE_EVENTS.length];
    getAnalytics().track(sample.name, sample.props);
  }, []);

  const burst = useCallback(() => {
    for (let i = 0; i < BURST_SIZE; i += 1) track(i);
  }, [track]);

  const restart = useCallback((next: AnalyticsConfig) => {
    setConfig(next);
    setLog([]);
    setClient(initAnalytics(next));
  }, []);

  return {
    snapshot,
    config,
    mode,
    log,
    collectorReceived: collector.batches.length,
    beaconEvents: collector.beaconEvents,
    track,
    burst,
    flushNow: () => void client.flush('manual'),
    simulateHide: () => client.flushOnUnload(),
    setMode: (next: CollectorMode) => {
      collector.mode = next;
      setModeState(next);
    },
    restart,
  };
}
