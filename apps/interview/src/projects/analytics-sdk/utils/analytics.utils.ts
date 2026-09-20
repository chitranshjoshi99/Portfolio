import type { AnalyticsEvent } from '../analytics-sdk.types';

/** 1s, 2s, 4s … capped. attempt is 1-based: the delay BEFORE attempt n+1. */
export const backoffDelay = (baseMs: number, attempt: number, capMs = 30_000): number =>
  Math.min(capMs, baseMs * 2 ** (attempt - 1));

/** Keep the newest `max` events; report how many of the oldest were dropped. */
export function dropOverflow<T>(queue: T[], max: number): { kept: T[]; dropped: number } {
  if (queue.length <= max) return { kept: queue, dropped: 0 };
  const dropped = queue.length - max;
  return { kept: queue.slice(dropped), dropped };
}

/**
 * sendBeacon rejects payloads over ~64 KB (and the limit is shared by all beacons in flight), so an
 * unload flush is split into chunks under `maxChars` of JSON. String length ≈ bytes for ASCII payloads;
 * TextEncoder would be exact. An event larger than the limit on its own goes alone.
 */
export function chunkByJsonSize(events: AnalyticsEvent[], maxChars: number): AnalyticsEvent[][] {
  const chunks: AnalyticsEvent[][] = [];
  let current: AnalyticsEvent[] = [];
  let size = 2; // "[]"
  for (const event of events) {
    const eventSize = JSON.stringify(event).length + 1; // + comma
    if (current.length > 0 && size + eventSize > maxChars) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(event);
    size += eventSize;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
