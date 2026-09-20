import type {
  FlagClientOptions,
  FlagEvent,
  FlagEventType,
  FlagMap,
  FlagSnapshot,
  FlagStats,
  KeyValueStorage,
} from '../feature-flag-sdk.types';

interface Persisted {
  flags: FlagMap;
  fetchedAt: number;
}

/**
 * The SDK. No React in here — it is the thing every app on the page shares.
 *
 * Read path:
 *   override?          -> override value
 *   cache fresh?       -> cached value                         (hit)
 *   cache stale?       -> cached value now + background refresh (stale-while-revalidate)
 *   no cache?          -> await the ONE in-flight request       (dedupe)
 *   request failed?    -> caller's default, never a throw
 */
export class FlagClient {
  private readonly fetchFlags: () => Promise<FlagMap>;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly storage: KeyValueStorage | null;
  private readonly storageKey: string;

  /** The promise is what gets cached while a request is running — that is the dedupe. */
  private inFlight: Promise<FlagMap> | null = null;
  private snapshot: FlagSnapshot;
  private readonly storeListeners = new Set<() => void>();
  private readonly flagListeners = new Map<string, Set<(next: boolean, previous: boolean | undefined) => void>>();
  private readonly eventListeners = new Set<(event: FlagEvent) => void>();

  stats: FlagStats = { requests: 0, deduped: 0, hits: 0, failures: 0, lastLatencyMs: null };

  constructor(options: FlagClientOptions) {
    this.fetchFlags = options.fetchFlags;
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? (() => Date.now());
    this.storage = options.storage ?? null;
    this.storageKey = options.storageKey ?? 'feature-flags';

    // Hydrate from the last session: the first render gets real values with no network wait.
    // They are treated as stale, so the first read also refreshes.
    const persisted = this.readPersisted();
    this.snapshot = {
      flags: persisted?.flags ?? null,
      overrides: {},
      fetchedAt: persisted?.fetchedAt ?? null,
      status: persisted ? 'ready' : 'idle',
    };
  }

  /** The reported API: resolves true/false, never rejects. */
  async getFeatureState(name: string, defaultValue = false): Promise<boolean> {
    if (name in this.snapshot.overrides) {
      this.emit('override', `${name} = ${this.snapshot.overrides[name]}`);
      return this.snapshot.overrides[name];
    }
    let flags: FlagMap;
    try {
      flags = await this.load();
    } catch {
      return defaultValue; // an unavailable flag service must not take the page down
    }
    if (!(name in flags)) {
      this.emit('unknown', `"${name}" not on the server — returned default ${defaultValue}`);
      return defaultValue;
    }
    return flags[name];
  }

  /** Synchronous read for render paths. Uses whatever is cached; never fetches. */
  peek(name: string, defaultValue = false): boolean {
    const { overrides, flags } = this.snapshot;
    if (name in overrides) return overrides[name];
    return flags && name in flags ? flags[name] : defaultValue;
  }

  /** Force a request (still deduped against one already running). */
  refresh(): Promise<FlagMap> {
    if (this.inFlight) {
      this.stats.deduped += 1;
      this.emit('dedupe', 'joined the request already running');
      return this.inFlight;
    }

    this.stats.requests += 1;
    this.emit('request', 'GET /flags');
    const startedAt = this.now();
    if (!this.snapshot.flags) this.setSnapshot({ ...this.snapshot, status: 'loading' });

    this.inFlight = this.fetchFlags()
      .then((flags) => {
        this.stats.lastLatencyMs = this.now() - startedAt;
        this.commit(flags);
        return flags;
      })
      .catch((error: unknown) => {
        this.stats.failures += 1;
        this.emit('failure', error instanceof Error ? error.message : 'request failed');
        // Keep serving the last good values if we have them.
        this.setSnapshot({ ...this.snapshot, status: this.snapshot.flags ? 'ready' : 'error' });
        throw error;
      })
      .finally(() => {
        this.inFlight = null; // a failure must not be cached — the next read retries
      });

    return this.inFlight;
  }

  setOverride(name: string, value: boolean | null): void {
    const overrides = { ...this.snapshot.overrides };
    const previous = this.peek(name);
    if (value === null) delete overrides[name];
    else overrides[name] = value;
    this.setSnapshot({ ...this.snapshot, overrides });
    this.emit('override', value === null ? `${name} cleared` : `${name} forced ${value}`);
    const next = this.peek(name);
    if (next !== previous) this.notifyFlag(name, next, previous);
  }

  /** Drop the cache (memory + storage). The next read goes to the network. */
  clear(): void {
    this.storage?.removeItem(this.storageKey);
    this.setSnapshot({ flags: null, overrides: this.snapshot.overrides, fetchedAt: null, status: 'idle' });
  }

  /** Per-flag subscription: called with (next, previous) only when the effective value changes. */
  subscribe(name: string, callback: (next: boolean, previous: boolean | undefined) => void): () => void {
    if (!this.flagListeners.has(name)) this.flagListeners.set(name, new Set());
    this.flagListeners.get(name)?.add(callback);
    return () => this.flagListeners.get(name)?.delete(callback);
  }

  /** useSyncExternalStore contract. Arrow properties so they can be passed unbound. */
  subscribeStore = (listener: () => void): (() => void) => {
    this.storeListeners.add(listener);
    return () => this.storeListeners.delete(listener);
  };

  getSnapshot = (): FlagSnapshot => this.snapshot;

  onEvent(listener: (event: FlagEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  isFresh(): boolean {
    const { fetchedAt, flags } = this.snapshot;
    return flags !== null && fetchedAt !== null && this.now() - fetchedAt < this.ttlMs;
  }

  // --- internals ------------------------------------------------------------------------------

  private load(): Promise<FlagMap> {
    const { flags } = this.snapshot;
    if (flags && this.isFresh()) {
      this.stats.hits += 1;
      this.emit('hit', 'served from cache');
      return Promise.resolve(flags);
    }
    if (flags) {
      // Stale-while-revalidate: answer now, refresh behind the caller's back.
      this.stats.hits += 1;
      this.emit('stale', 'served stale value, refreshing');
      this.refresh().catch(() => undefined);
      return Promise.resolve(flags);
    }
    return this.refresh();
  }

  private commit(next: FlagMap): void {
    const before = this.snapshot;
    const changed = Object.keys({ ...before.flags, ...next }).filter(
      (name) => before.flags?.[name] !== next[name],
    );
    const previousEffective = new Map(changed.map((name) => [name, this.peekIn(before, name)]));

    this.setSnapshot({ ...before, flags: next, fetchedAt: this.now(), status: 'ready' });
    this.writePersisted({ flags: next, fetchedAt: this.now() });

    if (before.flags === null) return; // first load is not a "change"
    for (const name of changed) {
      const previous = previousEffective.get(name);
      const current = this.peek(name);
      if (current !== previous) {
        this.emit('change', `${name}: ${previous} → ${current}`);
        this.notifyFlag(name, current, previous);
      }
    }
  }

  private peekIn(snapshot: FlagSnapshot, name: string): boolean | undefined {
    if (name in snapshot.overrides) return snapshot.overrides[name];
    return snapshot.flags?.[name];
  }

  private notifyFlag(name: string, next: boolean, previous: boolean | undefined): void {
    this.flagListeners.get(name)?.forEach((callback) => callback(next, previous));
  }

  private setSnapshot(next: FlagSnapshot): void {
    this.snapshot = next;
    this.storeListeners.forEach((listener) => listener());
  }

  private emit(type: FlagEventType, detail: string): void {
    const event = { type, detail, at: this.now() };
    this.eventListeners.forEach((listener) => listener(event));
  }

  private readPersisted(): Persisted | null {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Persisted;
      return parsed && typeof parsed.flags === 'object' && typeof parsed.fetchedAt === 'number' ? parsed : null;
    } catch {
      return null; // corrupt or blocked storage is a cache miss, not a crash
    }
  }

  private writePersisted(value: Persisted): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(value));
    } catch {
      /* quota / private mode — the in-memory cache still works */
    }
  }
}
