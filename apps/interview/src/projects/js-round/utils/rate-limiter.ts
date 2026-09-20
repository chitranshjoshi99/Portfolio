/**
 * Sliding-window log: allow at most `limit` calls in any `windowMs` span, per key.
 * Timestamps older than the window are dropped from the FRONT of a queue, so each check is amortised
 * O(1) and memory is O(limit) per key. A fixed window (count per clock minute) would let 2 × limit
 * through across a boundary — the classic follow-up.
 */
export function createRateLimiter(limit: number, windowMs: number, now = () => Date.now()) {
  const logs = new Map<string, number[]>();

  const tryAcquire = (key = 'default'): { allowed: boolean; retryAfterMs: number } => {
    const time = now();
    const log = logs.get(key) ?? [];
    while (log.length && time - log[0] >= windowMs) log.shift();
    if (log.length < limit) {
      log.push(time);
      logs.set(key, log);
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: windowMs - (time - log[0]) };
  };

  return { tryAcquire };
}

/**
 * The client-side twist: instead of rejecting, QUEUE calls and run each as soon as the window allows.
 * Order is preserved; every caller gets its own promise.
 */
export function rateLimited<A extends unknown[], R>(fn: (...args: A) => Promise<R>, limit: number, windowMs: number, now = () => Date.now()) {
  const limiter = createRateLimiter(limit, windowMs, now);
  const queue: { args: A; resolve: (value: R) => void; reject: (error: unknown) => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const drain = () => {
    timer = undefined;
    while (queue.length) {
      const { allowed, retryAfterMs } = limiter.tryAcquire();
      if (!allowed) {
        timer = setTimeout(drain, retryAfterMs);
        return;
      }
      const job = queue.shift() as (typeof queue)[number];
      fn(...job.args).then(job.resolve, job.reject);
    }
  };

  return (...args: A): Promise<R> =>
    new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
      if (timer === undefined) drain();
    });
}
