import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CONCURRENT_CALLS, LOG_LIMIT, TTL_MS } from '../constants/feature-flag-sdk.constants';
import type { FlagEvent, FlagMap, FlagSnapshot, FlagStats } from '../feature-flag-sdk.types';
import { flagClient, flagServer } from '../utils/flag-singleton';

export interface ServerView {
  flags: FlagMap;
  latencyMs: number;
  failNext: boolean;
}

export interface UseFlagPlayground {
  snapshot: FlagSnapshot;
  stats: FlagStats;
  events: FlagEvent[];
  server: ServerView;
  cacheAgeMs: number | null;
  ttlMs: number;
  lastBurst: string | null;
  fireConcurrent: () => void;
  refreshNow: () => void;
  clearCache: () => void;
  setOverride: (name: string, value: boolean | null) => void;
  toggleServerFlag: (name: string) => void;
  setLatency: (ms: number) => void;
  setFailNext: (fail: boolean) => void;
}

const readServer = (): ServerView => ({ ...flagServer.state, flags: { ...flagServer.state.flags } });

/** Demo wiring only — the SDK itself is utils/flag-client.ts. */
export function useFlagPlayground(): UseFlagPlayground {
  const snapshot = useSyncExternalStore(flagClient.subscribeStore, flagClient.getSnapshot);
  const [stats, setStats] = useState<FlagStats>({ ...flagClient.stats });
  const [events, setEvents] = useState<FlagEvent[]>([]);
  const [server, setServer] = useState<ServerView>(readServer);
  const [now, setNow] = useState(() => Date.now());
  const [lastBurst, setLastBurst] = useState<string | null>(null);

  useEffect(
    () =>
      flagClient.onEvent((event) => {
        setEvents((current) => [event, ...current].slice(0, LOG_LIMIT));
        setStats({ ...flagClient.stats }); // stats is a plain mutable object on the client
      }),
    [],
  );

  // A ticking clock so "cache age" visibly crosses the TTL.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const fireConcurrent = useCallback(() => {
    const startedAt = performance.now();
    const calls = Array.from({ length: CONCURRENT_CALLS }, () => flagClient.getFeatureState('new-editor'));
    void Promise.all(calls).then((values) => {
      const ms = Math.round(performance.now() - startedAt);
      setLastBurst(`${CONCURRENT_CALLS} calls → [${values.join(', ')}] in ${ms} ms`);
      setStats({ ...flagClient.stats });
    });
  }, []);

  const refreshNow = useCallback(() => {
    flagClient.refresh().catch(() => undefined);
  }, []);

  const clearCache = useCallback(() => {
    flagClient.clear();
    setLastBurst(null);
  }, []);

  const setOverride = useCallback((name: string, value: boolean | null) => {
    flagClient.setOverride(name, value);
  }, []);

  const toggleServerFlag = useCallback((name: string) => {
    flagServer.state.flags[name] = !flagServer.state.flags[name];
    setServer(readServer());
  }, []);

  const setLatency = useCallback((ms: number) => {
    flagServer.state.latencyMs = ms;
    setServer(readServer());
  }, []);

  const setFailNext = useCallback((fail: boolean) => {
    flagServer.state.failNext = fail;
    setServer(readServer());
  }, []);

  // failNext is consumed by the server on the next request; re-read after each event.
  useEffect(() => {
    setServer(readServer());
  }, [events]);

  return {
    snapshot,
    stats,
    events,
    server,
    cacheAgeMs: snapshot.fetchedAt === null ? null : now - snapshot.fetchedAt,
    ttlMs: TTL_MS,
    lastBurst,
    fireConcurrent,
    refreshNow,
    clearCache,
    setOverride,
    toggleServerFlag,
    setLatency,
    setFailNext,
  };
}
