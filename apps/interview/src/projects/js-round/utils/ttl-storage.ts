export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * localStorage with expiry. The expiry is stored WITH the value (storage has no TTL of its own), and
 * checked lazily on read — an expired read deletes the entry and returns the fallback.
 * Every call is guarded: quota errors, private mode and corrupt JSON behave like a miss.
 */
export function createTtlStorage(store: KeyValueStore, now = () => Date.now()) {
  return {
    set(key: string, value: unknown, ttlMs: number): boolean {
      try {
        store.setItem(key, JSON.stringify({ value, expiresAt: now() + ttlMs }));
        return true;
      } catch {
        return false;
      }
    },
    get<T>(key: string, fallback: T): T {
      try {
        const raw = store.getItem(key);
        if (raw === null) return fallback;
        const entry = JSON.parse(raw) as { value: T; expiresAt: number };
        if (typeof entry?.expiresAt !== 'number' || now() >= entry.expiresAt) {
          store.removeItem(key);
          return fallback;
        }
        return entry.value;
      } catch {
        return fallback;
      }
    },
    remove(key: string): void {
      try {
        store.removeItem(key);
      } catch {
        /* nothing to do */
      }
    },
  };
}
