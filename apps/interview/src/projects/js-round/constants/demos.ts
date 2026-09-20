import { createApiClient, type Fetcher } from '../utils/api-client';
import { flattenObject, flattenTree, getValueList, type ValueNode } from '../utils/flatten.utils';
import { bindPolyfill, debounce, memoize, memoizeAsync, throttle } from '../utils/function.utils';
import { promiseAny, promisePool, retry, runInSequence } from '../utils/promise.utils';
import { createRateLimiter, rateLimited } from '../utils/rate-limiter';
import { Stream } from '../utils/stream';
import { createTtlStorage } from '../utils/ttl-storage';

export type Log = (...parts: unknown[]) => void;

export interface Demo {
  id: string;
  title: string;
  /** The prompt as candidates reported it. */
  prompt: string;
  reported: string;
  run: (log: Log) => Promise<void> | void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TREE: ValueNode[] = [
  { value: 'value0', children: [] },
  { value: 'value1', children: [{ value: 'value2', children: [{ value: 'value3', children: [] }] }, { value: 'value4', children: [] }] },
  { value: 'value5', children: [] },
  { value: 'value6', children: [] },
];

export const DEMOS: Demo[] = [
  {
    id: 'stream',
    title: 'Stream: subscribe / push / unsubscribe',
    prompt:
      'const z = new Stream(); z.subscribe(v => log(v)); z.subscribe(v => log(v * 2)); z.subscribe(v => log(v * 3)); z.push(2) → 2 4 6. Follow-up: remove a single subscriber.',
    reported: 'Glassdoor (Front End Developer, phone), FrontendLead #473 #475 (Confluence team), #471',
    run: (log) => {
      const z = new Stream<number>();
      z.subscribe((v) => log(v));
      const offDouble = z.subscribe((v) => log(v * 2));
      z.subscribe((v) => log(v * 3));
      log('push(2):');
      z.push(2);
      offDouble();
      log('after unsubscribing the ×2 subscriber, push(5):');
      z.push(5);
    },
  },
  {
    id: 'retry',
    title: 'retry(task, n) — recursive',
    prompt: 'Build an async method that calls itself n times until success. Return fail if it could not succeed after n times.',
    reported: 'Glassdoor (Frontend Engineer, onsite — "you have to use recursion")',
    run: async (log) => {
      let attempt = 0;
      const flaky = () => {
        attempt += 1;
        log(`attempt ${attempt}`);
        return attempt < 3 ? Promise.reject(new Error(`503 on attempt ${attempt}`)) : Promise.resolve('✓ success');
      };
      log(await retry(flaky, 5, 50));
      attempt = 0;
      try {
        await retry(() => Promise.reject(new Error(`still failing (${++attempt})`)), 3);
      } catch (error) {
        log('gave up:', (error as Error).message);
      }
    },
  },
  {
    id: 'flatten-tree',
    title: 'Flatten list + getValueList(from, to)',
    prompt:
      'Flatten [{ value, children }] into [{ value }]. Then write getValueList(fromIndex, toIndex) that uses getBatch(index) (a promise) and returns the same flat list.',
    reported: 'FrontendLead #466 (phone screen), Glassdoor ("Flatten List + async/await")',
    run: async (log) => {
      log('flattenTree →', JSON.stringify(flattenTree(TREE).map((n) => n.value)));
      const batches: Record<number, ValueNode[]> = { 1: [TREE[0]], 2: [TREE[1]], 3: [TREE[2], TREE[3]] };
      const getBatch = (index: number) => {
        log(`getBatch(${index}) started`);
        return sleep(300 - index * 80).then(() => {
          log(`getBatch(${index}) resolved`);
          return batches[index];
        });
      };
      const list = await getValueList(getBatch, 1, 3);
      log('getValueList(1, 3) →', JSON.stringify(list.map((n) => n.value)), '(index order, despite resolve order)');
    },
  },
  {
    id: 'flatten-object',
    title: 'Flatten a nested object',
    prompt: '{ a: { b: 1, c: [2, 3] } } → { "a.b": 1, "a.c.0": 2, "a.c.1": 3 }',
    reported: 'Blind ("why is Atlassian so obsessed with flattening nested objects?")',
    run: (log) => {
      log(JSON.stringify(flattenObject({ issue: { key: 'CONF-1', labels: ['editor', 'bug'], meta: {} }, done: false }), null, 2));
      const cyclic: Record<string, unknown> = { a: 1 };
      cyclic.self = cyclic;
      try {
        flattenObject(cyclic as never);
      } catch (error) {
        log('cycle →', (error as Error).message);
      }
    },
  },
  {
    id: 'promise-any',
    title: 'Promise.any from memory',
    prompt: 'Implement Promise.any: resolve with the first fulfilled value; reject with an AggregateError if all reject.',
    reported: 'Frontend Interview Handbook (Karat), Glassdoor ("How do you solve a promise.any")',
    run: async (log) => {
      const winner = await promiseAny([
        sleep(200).then(() => 'mirror-eu (200ms)'),
        Promise.reject(new Error('mirror-us down')),
        sleep(80).then(() => 'mirror-ap (80ms)'),
      ]);
      log('first fulfilled:', winner);
      try {
        await promiseAny([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]);
      } catch (error) {
        log('all rejected →', (error as Error).message, (error as { errors: Error[] }).errors.map((e) => e.message));
      }
    },
  },
  {
    id: 'sequence-pool',
    title: 'Run promises in sequence / with a concurrency limit',
    prompt: 'Execute an array of async tasks one by one. Follow-up: at most k at a time.',
    reported: 'Prepfully (Atlassian FE, ×2), GreatFrontEnd topics (async)',
    run: async (log) => {
      const task = (name: string, ms: number) => async () => {
        log(`  start ${name}`);
        await sleep(ms);
        log(`  done  ${name}`);
        return name;
      };
      log('sequence:');
      log('→', await runInSequence([task('A', 120), task('B', 40), task('C', 80)]));
      log('pool(limit 2):');
      log('→', await promisePool([task('A', 120), task('B', 40), task('C', 80), task('D', 30)], 2));
    },
  },
  {
    id: 'bind',
    title: 'Function.prototype.bind polyfill',
    prompt: 'Implement bind: fixed this, partial arguments, and correct behaviour with new.',
    reported: 'GreatFrontEnd (Atlassian list), Glassdoor ("change the reference of this"), FrontendLead #475',
    run: (log) => {
      function greet(this: { name: string }, greeting: string, mark: string) {
        return `${greeting}, ${this.name}${mark}`;
      }
      log(bindPolyfill(greet, { name: 'Priya' }, 'Hi')('!'));
      function Point(this: { x: number; y: number }, x: number, y: number) {
        this.x = x;
        this.y = y;
      }
      const BoundPoint = bindPolyfill(Point, { ignored: true }, 1) as unknown as new (y: number) => { x: number; y: number };
      const p = new BoundPoint(2);
      log('new BoundPoint(2) →', JSON.stringify(p), '— bound this ignored under new');
    },
  },
  {
    id: 'memoize',
    title: 'memoize + shared async fetch by key',
    prompt:
      'Memoize a function. JS round variant: "develop a common module used by multiple applications to fetch data for a given key" — concurrent callers must share one request.',
    reported: 'GreatFrontEnd (Atlassian list: Memoize), Glassdoor (JS round, memoization)',
    run: async (log) => {
      const slowSquare = memoize((n: number) => {
        log(`  computing ${n}²`);
        return n * n;
      });
      log(slowSquare(9), slowSquare(9), slowSquare(9));
      let requests = 0;
      const loadUser = memoizeAsync(async (id: string) => {
        requests += 1;
        await sleep(100);
        return { id, name: `user ${id}` };
      });
      const results = await Promise.all([loadUser('42'), loadUser('42'), loadUser('7'), loadUser('42')]);
      log(`${results.length} calls, ${requests} requests`);
    },
  },
  {
    id: 'debounce-throttle',
    title: 'Debounce and throttle',
    prompt: 'Throttle a function (and explain the closure). Contrast with debounce.',
    reported: 'GreatFrontEnd (Atlassian list: Throttle), Glassdoor ("question related to throttle and closure")',
    run: async (log) => {
      const debounced = debounce((q: string) => log(`  debounced search("${q}")`), 100);
      const throttled = throttle((y: number) => log(`  throttled scroll(${y})`), 100);
      log('typing j-i-r-a within 100ms:');
      for (const q of ['j', 'ji', 'jir', 'jira']) {
        debounced(q);
        await sleep(20);
      }
      await sleep(150);
      log('scroll events every 20ms for 300ms:');
      for (let y = 0; y <= 300; y += 20) {
        throttled(y);
        await sleep(20);
      }
      await sleep(150);
    },
  },
  {
    id: 'api-client',
    title: 'Chainable API client',
    prompt: 'Implement a chainable fetch-based API client with request builders: api.get(path).query({...}).headers({...}).send().',
    reported: 'GreatFrontEnd (Atlassian list: API Client)',
    run: async (log) => {
      const fakeFetch: Fetcher = async (url, init) => {
        log(`  ${init.method} ${url}`, init.body ? `body=${init.body}` : '');
        if (url.includes('missing')) return { ok: false, status: 404, json: async () => ({ message: 'Issue does not exist' }) };
        return { ok: true, status: 200, json: async () => ({ total: 3 }) };
      };
      const api = createApiClient('https://your-site.atlassian.net/rest/api/3', fakeFetch).headers({ Authorization: 'Bearer …' });
      log('→', JSON.stringify(await api.get('/search').query({ jql: 'project = CONF AND status = "In Progress"' }).send()));
      await api.post('/issue', { fields: { summary: 'Paste drops selection' } }).send();
      try {
        await api.get('/issue/missing').send();
      } catch (error) {
        log('→', (error as Error).message);
      }
    },
  },
  {
    id: 'rate-limiter',
    title: 'Rate limiter (sliding window)',
    prompt: 'Allow at most N calls per window. Client-side variant: queue calls instead of rejecting them.',
    reported: 'FrontendLead #474 (frontend phone interview), also a common Atlassian code-design round',
    run: async (log) => {
      const limiter = createRateLimiter(3, 1_000);
      log([1, 2, 3, 4, 5].map((i) => `${i}:${limiter.tryAcquire('user-1').allowed ? 'ok' : 'blocked'}`).join(' '));
      const start = Date.now();
      const call = rateLimited(async (n: number) => {
        log(`  request ${n} at +${Date.now() - start}ms`);
        return n;
      }, 2, 250);
      await Promise.all([1, 2, 3, 4, 5].map((n) => call(n)));
    },
  },
  {
    id: 'ttl-storage',
    title: 'localStorage with expiry',
    prompt: 'Make items stored in localStorage expire after a set period.',
    reported: 'Prepfully (Atlassian FE); used by the feature-flag caching follow-up',
    run: async (log) => {
      const data = new Map<string, string>();
      const ttl = createTtlStorage({
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => void data.set(k, v),
        removeItem: (k) => void data.delete(k),
      });
      ttl.set('flags', { 'new-editor': true }, 150);
      log('read now:', JSON.stringify(ttl.get('flags', null)));
      await sleep(200);
      log('read after 200ms:', JSON.stringify(ttl.get('flags', 'expired → fallback')), `(stored keys: ${data.size})`);
    },
  },
];
