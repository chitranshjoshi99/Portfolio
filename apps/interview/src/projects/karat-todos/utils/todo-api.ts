import { DATASET_SIZE, HOSTILE_TODO, LATENCY_MS, TASKS } from '../constants/karat-todos.constants';
import type { Todo, TodoPage } from '../karat-todos.types';

/** Deterministic dataset in the dummyjson shape — same rows every load. */
const DATASET: Todo[] = (() => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: DATASET_SIZE }, (_, index) => ({
    id: index + 1,
    todo: index === 12 ? HOSTILE_TODO : TASKS[index % TASKS.length],
    completed: random() < 0.45,
    userId: 1 + Math.floor(random() * 30),
  }));
})();

export const failureControl = { failNext: false };

/** GET /todos?limit=&skip= — same envelope as dummyjson.com, abortable, can be told to fail. */
export function fetchTodos(limit: number, skip: number, signal?: AbortSignal): Promise<TodoPage> {
  const shouldFail = failureControl.failNext;
  failureControl.failNext = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (shouldFail) return reject(new Error('Request failed with 500'));
      resolve({
        todos: DATASET.slice(skip, skip + limit).map((todo) => ({ ...todo })),
        total: DATASET.length,
        skip,
        limit,
      });
    }, LATENCY_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
