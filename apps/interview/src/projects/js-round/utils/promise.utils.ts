/**
 * "Build an async method that calls itself n times until success; return fail if it could not succeed
 * after n times." Recursion was explicitly asked for. Optional delay doubles each attempt.
 */
export function retry<T>(task: () => Promise<T>, attempts: number, delayMs = 0): Promise<T> {
  return task().catch((error: unknown) => {
    if (attempts <= 1) throw error;
    const wait = delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
    return wait.then(() => retry(task, attempts - 1, delayMs * 2));
  });
}

/** AggregateError where the runtime has it (ES2021+), an Error carrying `.errors` where it doesn't. */
function aggregateError(errors: unknown[], message: string): Error {
  const Native = (globalThis as { AggregateError?: new (errors: unknown[], message: string) => Error }).AggregateError;
  return Native ? new Native(errors, message) : Object.assign(new Error(message), { errors });
}

/** Promise.any: first fulfilment wins; if every input rejects, reject with an AggregateError of all reasons. */
export function promiseAny<T>(inputs: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    const items = [...inputs];
    const errors: unknown[] = new Array(items.length);
    let pending = items.length;
    if (pending === 0) {
      reject(aggregateError([], 'All promises were rejected'));
      return;
    }
    items.forEach((item, index) => {
      Promise.resolve(item).then(
        (value) => resolve(value as Awaited<T>),
        (error: unknown) => {
          errors[index] = error; // by index, so the order matches the input, not the timing
          pending -= 1;
          if (pending === 0) reject(aggregateError(errors, 'All promises were rejected'));
        },
      );
    });
  });
}

/** Run async tasks strictly one after another; results in task order. */
export async function runInSequence<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];
  for (const task of tasks) results.push(await task());
  return results;
}

/** At most `limit` tasks in flight; results in task order; the first rejection rejects the whole run. */
export function promisePool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = new Array(tasks.length);
    let next = 0;
    let done = 0;
    let failed = false;
    if (tasks.length === 0) return resolve([]);

    const launch = () => {
      if (failed || next >= tasks.length) return;
      const index = next;
      next += 1;
      tasks[index]().then(
        (value) => {
          results[index] = value;
          done += 1;
          if (done === tasks.length) resolve(results);
          else launch(); // a finished slot pulls the next task
        },
        (error: unknown) => {
          failed = true;
          reject(error);
        },
      );
    };
    for (let i = 0; i < Math.min(limit, tasks.length); i += 1) launch();
  });
}
