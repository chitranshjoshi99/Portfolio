export interface ValueNode {
  value: string;
  children: ValueNode[];
}

/**
 * The phone-screen question: [{ value, children }] → [{ value }] in pre-order.
 * Iterative with an explicit stack (children pushed in reverse), so depth cannot overflow the call stack.
 */
export function flattenTree(nodes: ValueNode[]): { value: string }[] {
  const out: { value: string }[] = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop() as ValueNode;
    out.push({ value: node.value });
    for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push(node.children[i]);
  }
  return out;
}

/**
 * The follow-up: `getValueList(fromIndex, toIndex)` using `getBatch(index)` (a promise of nodes).
 * Fetch every batch in the range IN PARALLEL, keep them in index order, flatten each with the first
 * function. A failed batch fails the call — a partial list would silently miss rows.
 */
export async function getValueList(
  getBatch: (index: number) => Promise<ValueNode[]>,
  fromIndex: number,
  toIndex: number,
): Promise<{ value: string }[]> {
  const indices = Array.from({ length: Math.max(0, toIndex - fromIndex + 1) }, (_, i) => fromIndex + i);
  const batches = await Promise.all(indices.map((index) => getBatch(index)));
  return batches.flatMap((batch) => flattenTree(batch));
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * `{ a: { b: 1, c: [2, 3] } }` → `{ 'a.b': 1, 'a.c.0': 2, 'a.c.1': 3 }`.
 * Empty objects/arrays are kept as values (else they would vanish). Cycles throw instead of looping.
 */
export function flattenObject(input: Record<string, Json>, separator = '.'): Record<string, Json> {
  const out: Record<string, Json> = {};
  const seen = new WeakSet<object>();

  const walk = (value: Json, path: string) => {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) throw new TypeError(`Cycle at "${path}"`);
      const keys = Object.keys(value);
      if (keys.length === 0) {
        if (path) out[path] = value;
        return;
      }
      seen.add(value);
      for (const key of keys) {
        walk((value as Record<string, Json>)[key], path ? `${path}${separator}${key}` : key);
      }
      seen.delete(value); // same object in two sibling branches is fine; only an ancestor is a cycle
      return;
    }
    out[path] = value;
  };

  walk(input, '');
  return out;
}
