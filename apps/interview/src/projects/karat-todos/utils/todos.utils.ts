import type { Patch, PatchMap, Todo, UserGroup } from '../karat-todos.types';

export const buildTodoUrl = (base: string, limit: number, skip: number): string =>
  `${base}?limit=${limit}&skip=${skip}`;

/**
 * V0 — the oracle: collect user ids, then filter the whole list once per user. O(U · N).
 * Obviously correct, which is why the check file keeps it.
 */
export function groupByUserNested(todos: Todo[]): UserGroup[] {
  const userIds: number[] = [];
  for (const todo of todos) if (!userIds.includes(todo.userId)) userIds.push(todo.userId);
  return userIds.map((userId) => ({ userId, todos: todos.filter((todo) => todo.userId === userId) }));
}

/**
 * V1 — one pass into a Map. O(N).
 * A Map, not a plain object: an object with integer-like keys iterates them in ASCENDING NUMERIC
 * order, not first-seen order — `{26: …, 3: …}` comes back as 3, 26. The Map keeps arrival order.
 */
export function groupByUser(todos: Todo[]): UserGroup[] {
  const groups = new Map<number, Todo[]>();
  for (const todo of todos) {
    const list = groups.get(todo.userId);
    if (list) list.push(todo);
    else groups.set(todo.userId, [todo]);
  }
  return [...groups].map(([userId, list]) => ({ userId, todos: list }));
}

/**
 * V2 — fold a new page into existing groups without regrouping everything already loaded.
 * O(page + groups); only groups that received rows are copied, so untouched blocks keep their
 * identity (and a memoised block component does not re-render).
 */
export function appendToGroups(groups: UserGroup[], page: Todo[]): UserGroup[] {
  const next = [...groups];
  const positionOf = new Map(next.map((group, index) => [group.userId, index]));
  const copied = new Set<number>();
  for (const todo of page) {
    const at = positionOf.get(todo.userId);
    if (at === undefined) {
      positionOf.set(todo.userId, next.length);
      copied.add(todo.userId);
      next.push({ userId: todo.userId, todos: [todo] });
      continue;
    }
    if (!copied.has(todo.userId)) {
      next[at] = { userId: todo.userId, todos: [...next[at].todos] };
      copied.add(todo.userId);
    }
    next[at].todos.push(todo);
  }
  return next;
}

/** Local edits over server rows. Unpatched rows are returned as the same object. */
export const applyPatch = (todo: Todo, patches: PatchMap): Todo =>
  patches[todo.id] ? { ...todo, ...patches[todo.id] } : todo;

/**
 * Record an edit. A field set back to the server value is removed from the patch, and an empty
 * patch is removed from the map — so "undo by hand" leaves no residue in storage.
 */
export function setPatch(patches: PatchMap, original: Todo, change: Patch): PatchMap {
  const merged: Patch = { ...patches[original.id], ...change };
  (Object.keys(merged) as (keyof Patch)[]).forEach((key) => {
    if (merged[key] === original[key]) delete merged[key];
  });
  const next = { ...patches };
  if (Object.keys(merged).length === 0) delete next[original.id];
  else next[original.id] = merged;
  return next;
}

/** Open first, done last. Array.prototype.sort is stable, so the server order survives inside each bucket. */
export const sortByStatus = (todos: Todo[]): Todo[] =>
  [...todos].sort((a, b) => Number(a.completed) - Number(b.completed));

/** Only for the "I must use innerHTML" follow-up. textContent is the real answer. */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;') // first, or it re-escapes the entities below
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
