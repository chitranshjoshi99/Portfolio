import type { FlagMap } from '../feature-flag-sdk.types';

/**
 * Stand-in for GET /flags. Mutable on purpose so the demo can flip a flag "on the server"
 * and watch the client pick it up after the TTL.
 */
export function createFakeFlagServer(seed: FlagMap, latencyMs: number) {
  const state = { flags: { ...seed }, latencyMs, failNext: false };

  return {
    state,
    fetchFlags(): Promise<FlagMap> {
      const shouldFail = state.failNext;
      state.failNext = false;
      const snapshot = { ...state.flags }; // the response is a copy, like JSON over the wire
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (shouldFail) reject(new Error('503 from /flags'));
          else resolve(snapshot);
        }, state.latencyMs);
      });
    },
  };
}

/** localStorage, or null where it throws (private mode, sandboxed iframes). */
export function safeLocalStorage() {
  try {
    const probe = '__ffsdk_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
