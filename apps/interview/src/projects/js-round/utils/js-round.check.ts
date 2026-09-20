/**
 * Plain assertions for every utility — run with `node src/projects/js-round/utils/js-round.check.ts`.
 */
import assert from 'node:assert/strict';
import { createApiClient, HttpError, type Fetcher } from './api-client.ts';
import { flattenObject, flattenTree, getValueList, type ValueNode } from './flatten.utils.ts';
import { bindPolyfill, debounce, memoize, memoizeAsync, throttle } from './function.utils.ts';
import { promiseAny, promisePool, retry, runInSequence } from './promise.utils.ts';
import { createRateLimiter, rateLimited } from './rate-limiter.ts';
import { Stream } from './stream.ts';
import { createTtlStorage } from './ttl-storage.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Stream --------------------------------------------------------------------------------
{
  const z = new Stream<number>();
  const out: number[] = [];
  z.subscribe((v) => out.push(v));
  const double = (v: number) => out.push(v * 2);
  const offA = z.subscribe(double);
  z.subscribe(double); // same function twice = two independent subscriptions
  z.subscribe((v) => out.push(v * 3));
  z.push(2);
  assert.deepEqual(out, [2, 4, 4, 6]);
  offA();
  offA(); // idempotent
  out.length = 0;
  z.push(1);
  assert.deepEqual(out, [1, 2, 3], 'removing one subscription of a function leaves the other');

  // unsubscribing during delivery does not change who gets the current value
  const s = new Stream<string>();
  const got: string[] = [];
  const offFirst = s.subscribe((v) => {
    got.push(`a:${v}`);
    offSecond();
  });
  const offSecond = s.subscribe((v) => got.push(`b:${v}`));
  s.push('x');
  s.push('y');
  assert.deepEqual(got, ['a:x', 'b:x', 'a:y']);
  offFirst();
  assert.equal(s.size, 0);
}

// --- retry ---------------------------------------------------------------------------------
{
  let calls = 0;
  const flaky = () => (++calls < 3 ? Promise.reject(new Error(`fail ${calls}`)) : Promise.resolve('ok'));
  assert.equal(await retry(flaky, 5), 'ok');
  assert.equal(calls, 3, 'stops at the first success');
  calls = 0;
  await assert.rejects(retry(() => Promise.reject(new Error(`n${++calls}`)), 3), /n3/, 'last error after n tries');
  assert.equal(calls, 3);
}

// --- Promise.any / sequence / pool ---------------------------------------------------------
{
  assert.equal(await promiseAny([Promise.reject(1), sleep(20).then(() => 'slow'), sleep(5).then(() => 'fast')]), 'fast');
  await assert.rejects(promiseAny([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]), (error: Error & { errors?: Error[] }) => {
    assert.deepEqual(error.errors?.map((e) => e.message), ['a', 'b'], 'errors in INPUT order');
    return true;
  });
  await assert.rejects(promiseAny([]));
  assert.equal(await promiseAny([Promise.reject(0), 42]), 42, 'plain values count as fulfilled');

  const order: number[] = [];
  const seq = await runInSequence([30, 10, 20].map((ms, i) => () => sleep(ms).then(() => (order.push(i), i))));
  assert.deepEqual(seq, [0, 1, 2]);
  assert.deepEqual(order, [0, 1, 2], 'strictly one after another');

  let inFlight = 0;
  let peak = 0;
  const tasks = [30, 5, 20, 10, 15, 5].map((ms, i) => async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await sleep(ms);
    inFlight -= 1;
    return i;
  });
  assert.deepEqual(await promisePool(tasks, 2), [0, 1, 2, 3, 4, 5], 'results in task order');
  assert.equal(peak, 2, 'never more than the limit in flight');
  assert.deepEqual(await promisePool([], 3), []);
}

// --- flatten -------------------------------------------------------------------------------
{
  const input: ValueNode[] = [
    { value: 'value0', children: [] },
    { value: 'value1', children: [{ value: 'value2', children: [{ value: 'value3', children: [] }] }, { value: 'value4', children: [] }] },
    { value: 'value5', children: [] },
    { value: 'value6', children: [] },
  ];
  const expected = ['value0', 'value1', 'value2', 'value3', 'value4', 'value5', 'value6'].map((value) => ({ value }));
  assert.deepEqual(flattenTree(input), expected, 'the reported example, pre-order');

  // deep tree: no stack overflow
  let deep: ValueNode = { value: 'leaf', children: [] };
  for (let i = 0; i < 20_000; i += 1) deep = { value: `n${i}`, children: [deep] };
  assert.equal(flattenTree([deep]).length, 20_001);

  // getValueList: batches fetched in parallel, stitched in index order
  const batches: Record<number, ValueNode[]> = { 1: [input[0]], 2: [input[1]], 3: [input[2], input[3]] };
  const started: number[] = [];
  const getBatch = (index: number) => {
    started.push(index);
    return sleep(30 - index * 5).then(() => batches[index]); // later batches resolve FIRST
  };
  const t0 = Date.now();
  assert.deepEqual(await getValueList(getBatch, 1, 3), expected);
  assert.deepEqual(started, [1, 2, 3], 'all started before any finished');
  assert.ok(Date.now() - t0 < 60, 'parallel, not sequential');

  assert.deepEqual(flattenObject({ a: { b: 1, c: [2, 3] }, d: null, e: {}, f: 'x' }), {
    'a.b': 1,
    'a.c.0': 2,
    'a.c.1': 3,
    d: null,
    e: {},
    f: 'x',
  });
  const shared = { k: 1 };
  assert.deepEqual(flattenObject({ x: shared, y: shared }), { 'x.k': 1, 'y.k': 1 }, 'shared (non-cyclic) refs are fine');
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  assert.throws(() => flattenObject(cyclic as never), /Cycle/);
}

// --- bind / memoize --------------------------------------------------------------------------
{
  function greet(this: { name: string }, greeting: string, mark: string) {
    return `${greeting}, ${this.name}${mark}`;
  }
  const bound = bindPolyfill(greet, { name: 'Priya' }, 'Hi');
  assert.equal(bound('!'), 'Hi, Priya!', 'this + partial args');
  function Point(this: { x: number; y: number }, x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  const BoundPoint = bindPolyfill(Point, { ignored: true }, 1);
  const p = new (BoundPoint as unknown as new (y: number) => { x: number; y: number })(2);
  assert.deepEqual({ x: p.x, y: p.y }, { x: 1, y: 2 }, 'new ignores the bound this');
  assert.ok(p instanceof (Point as unknown as new () => unknown), 'prototype chain kept');

  let computations = 0;
  const square = memoize((n: number) => (computations++, n * n));
  assert.equal(square(4), 16);
  assert.equal(square(4), 16);
  assert.equal(computations, 1);
  const sum = memoize((a: number, b: number) => a + b, (a, b) => `${a},${b}`);
  assert.equal(sum(1, 2), 3);
  assert.equal(sum(2, 1), 3);
  assert.equal(sum.cache.size, 2, 'resolver decides the key');

  let fetches = 0;
  let badCalls = 0;
  let clock = 0;
  const load = memoizeAsync(async (key: string) => {
    fetches += 1;
    if (key === 'bad' && ++badCalls === 1) throw new Error('503'); // first attempt fails
    return key.toUpperCase();
  }, 1_000, () => clock);
  assert.deepEqual(await Promise.all([load('a'), load('a'), load('a')]), ['A', 'A', 'A']);
  assert.equal(fetches, 1, 'concurrent callers share one request');
  clock = 2_000;
  await load('a');
  assert.equal(fetches, 2, 'expired after ttl');
  await assert.rejects(load('bad'));
  assert.equal(await load('bad'), 'BAD', 'a failure is not cached');
}

// --- debounce / throttle --------------------------------------------------------------------
{
  const calls: number[] = [];
  const d = debounce((n: number) => calls.push(n), 20);
  d(1);
  d(2);
  d(3);
  await sleep(40);
  assert.deepEqual(calls, [3], 'only the last call, once');
  d(4);
  d.flush();
  assert.deepEqual(calls, [3, 4], 'flush runs the pending call now');
  d(5);
  d.cancel();
  await sleep(40);
  assert.deepEqual(calls, [3, 4]);

  const hits: number[] = [];
  const t = throttle((n: number) => hits.push(n), 30);
  t(1);
  t(2);
  t(3);
  assert.deepEqual(hits, [1], 'leading call immediately');
  await sleep(45);
  assert.deepEqual(hits, [1, 3], 'one trailing call with the LATEST args');
  await sleep(40);
  t(4);
  assert.deepEqual(hits, [1, 3, 4], 'after the window, leading again');
  t.cancel();
}

// --- API client -----------------------------------------------------------------------------
{
  const seen: { url: string; init: Parameters<Fetcher>[1] }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    seen.push({ url, init });
    if (url.includes('/missing')) return { ok: false, status: 404, json: async () => ({ error: 'nope' }) };
    return { ok: true, status: 200, json: async () => ({ url }) };
  };
  const api = createApiClient('https://jira.example.com/rest/', fetcher).headers({ Authorization: 'Bearer t' });
  const search = api.get('/search').query({ jql: 'project = CONF & status = "Open"', maxResults: 50 });
  assert.equal(
    search.url(),
    'https://jira.example.com/rest/search?jql=project+%3D+CONF+%26+status+%3D+%22Open%22&maxResults=50',
    'query values are encoded',
  );
  await search.send();
  assert.equal(seen[0].init.headers.Authorization, 'Bearer t');
  assert.equal(api.get('/other').url(), 'https://jira.example.com/rest/other', 'builders are immutable: no query leak');
  await api.post('issue', { summary: 'x' }).send();
  assert.equal(seen[1].init.method, 'POST');
  assert.equal(seen[1].init.body, '{"summary":"x"}');
  assert.equal(seen[1].init.headers['Content-Type'], 'application/json');
  await assert.rejects(api.get('/missing').send(), (error: unknown) => error instanceof HttpError && error.status === 404);
}

// --- rate limiter ---------------------------------------------------------------------------
{
  let clock = 0;
  const limiter = createRateLimiter(3, 1_000, () => clock);
  assert.deepEqual([1, 2, 3, 4].map(() => limiter.tryAcquire('u1').allowed), [true, true, true, false]);
  assert.equal(limiter.tryAcquire('u2').allowed, true, 'per key');
  clock = 500;
  assert.deepEqual(limiter.tryAcquire('u1'), { allowed: false, retryAfterMs: 500 });
  clock = 1_000;
  assert.equal(limiter.tryAcquire('u1').allowed, true, 'the oldest slid out');

  const runs: number[] = [];
  const limited = rateLimited(async (n: number) => (runs.push(n), n), 2, 30);
  const start = Date.now();
  const results = await Promise.all([1, 2, 3, 4, 5].map((n) => limited(n)));
  assert.deepEqual(results, [1, 2, 3, 4, 5], 'every caller resolved, in order');
  assert.deepEqual(runs, [1, 2, 3, 4, 5]);
  assert.ok(Date.now() - start >= 55, 'calls 3–5 waited for the window');
}

// --- TTL storage -----------------------------------------------------------------------------
{
  const data = new Map<string, string>();
  let clock = 0;
  const ttl = createTtlStorage(
    { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) },
    () => clock,
  );
  ttl.set('flags', { a: true }, 1_000);
  assert.deepEqual(ttl.get('flags', null), { a: true });
  clock = 1_000;
  assert.equal(ttl.get('flags', 'expired'), 'expired');
  assert.equal(data.has('flags'), false, 'expired entry removed on read');
  data.set('bad', '{nope');
  assert.equal(ttl.get('bad', 'fallback'), 'fallback');
  const broken = createTtlStorage({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
  assert.equal(broken.set('x', 1, 10), false);
  assert.equal(broken.get('x', 7), 7);
}

console.log('js-round: all checks passed');
