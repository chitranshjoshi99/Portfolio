/**
 * The reported prompt: `const z = new Stream(); z.subscribe(v => log(v)); z.subscribe(v => log(v * 2));
 * z.push(2)` → 2 4. Follow-up: "how do you remove a single subscriber?"
 *
 * subscribe returns its own unsubscribe (a closure over a unique token), so two subscriptions of the
 * SAME function are independent, and removing one never removes the other.
 */
export class Stream<T> {
  private readonly subscribers = new Map<symbol, (value: T) => void>();

  subscribe(callback: (value: T) => void): () => void {
    const token = Symbol('subscription');
    this.subscribers.set(token, callback);
    return () => {
      this.subscribers.delete(token);
    };
  }

  push(value: T): void {
    // Snapshot first: a subscriber that unsubscribes (or subscribes) during delivery
    // must not change who receives THIS value.
    for (const callback of [...this.subscribers.values()]) {
      try {
        callback(value);
      } catch (error) {
        // One bad subscriber must not stop delivery to the rest.
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  get size(): number {
    return this.subscribers.size;
  }
}
