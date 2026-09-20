/**
 * Function.prototype.bind without using bind. Supports partial application and `new`:
 * when called with `new`, the bound `this` is ignored and the prototype chain is kept.
 */
export function bindPolyfill(fn: (...args: any[]) => any, thisArg: unknown, ...preset: unknown[]) {
  if (typeof fn !== 'function') throw new TypeError('bind target is not callable');
  function bound(this: unknown, ...args: unknown[]): unknown {
    const isNew = new.target !== undefined;
    return isNew ? new (fn as any)(...preset, ...args) : fn.apply(thisArg, [...preset, ...args]);
  }
  if (fn.prototype) bound.prototype = Object.create(fn.prototype);
  return bound;
}

/**
 * Memoize a function of ANY arguments. The key comes from `resolver` (default: first argument), so
 * callers choose what "same call" means; a Map keeps object keys by identity.
 */
export function memoize<A extends unknown[], R>(fn: (...args: A) => R, resolver: (...args: A) => unknown = (...args) => args[0]) {
  const cache = new Map<unknown, R>();
  const memoized = (...args: A): R => {
    const key = resolver(...args);
    if (cache.has(key)) return cache.get(key) as R;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  memoized.cache = cache;
  return memoized;
}

/**
 * "A common module used by multiple apps to fetch data for a given key": cache the PROMISE so concurrent
 * callers share one request, drop it on rejection so the next call retries, expire after ttlMs.
 */
export function memoizeAsync<R>(fetcher: (key: string) => Promise<R>, ttlMs = Number.POSITIVE_INFINITY, now = () => Date.now()) {
  const cache = new Map<string, { promise: Promise<R>; at: number }>();
  return (key: string): Promise<R> => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.promise;
    const promise = fetcher(key).catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, { promise, at: now() });
    return promise;
  };
}

/** Debounce: run once, `wait` ms after the LAST call. `flush` runs a pending call now; `cancel` drops it. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  const debounced = (...args: A) => {
    pending = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const call = pending;
      pending = null;
      if (call) fn(...call);
    }, wait);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
    pending = null;
  };
  debounced.flush = () => {
    clearTimeout(timer);
    const call = pending;
    pending = null;
    if (call) fn(...call);
  };
  return debounced;
}

/**
 * Throttle: at most once per `wait` ms. Leading call runs immediately; calls during the window are
 * collapsed into ONE trailing call with the latest arguments, so the last value is never lost.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, wait: number, now = () => Date.now()) {
  let lastRun = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let trailing: A | null = null;

  const run = (args: A) => {
    lastRun = now();
    fn(...args);
  };

  const throttled = (...args: A) => {
    const remaining = wait - (now() - lastRun);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = undefined;
      trailing = null;
      run(args);
      return;
    }
    trailing = args; // keep only the latest
    if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined;
        const call = trailing;
        trailing = null;
        if (call) run(call);
      }, remaining);
    }
  };
  throttled.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    trailing = null;
  };
  return throttled;
}
