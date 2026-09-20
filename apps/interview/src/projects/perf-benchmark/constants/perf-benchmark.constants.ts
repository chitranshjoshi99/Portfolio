import type { Benchable } from '../perf-benchmark.types';

const NUMBERS = Array.from({ length: 10_000 }, (_, i) => i);
const NUMBER_SET = new Set(NUMBERS);
const DOC = {
  id: 'CONF-4121',
  fields: { summary: 'Editor drops selection after paste', labels: ['editor', 'paste', 'safari'], points: 5 },
  comments: Array.from({ length: 40 }, (_, i) => ({ id: i, author: `user${i % 7}`, body: 'Looks good '.repeat(8) })),
};

export interface Suite {
  id: string;
  title: string;
  candidates: { name: string; fn: Benchable }[];
}

export const SUITES: Suite[] = [
  {
    id: 'sum',
    title: 'Sum 10 000 numbers',
    candidates: [
      {
        name: 'for (let i…)',
        fn: () => {
          let total = 0;
          for (let i = 0; i < NUMBERS.length; i += 1) total += NUMBERS[i];
          return total;
        },
      },
      {
        name: 'for…of',
        fn: () => {
          let total = 0;
          for (const n of NUMBERS) total += n;
          return total;
        },
      },
      { name: 'reduce', fn: () => NUMBERS.reduce((total, n) => total + n, 0) },
    ],
  },
  {
    id: 'lookup',
    title: 'Membership in 10 000 items (worst case)',
    candidates: [
      { name: 'Array.includes', fn: () => NUMBERS.includes(9_999) },
      { name: 'Set.has', fn: () => NUMBER_SET.has(9_999) },
    ],
  },
  {
    id: 'clone',
    title: 'Deep clone an issue with 40 comments',
    candidates: [
      { name: 'JSON round-trip', fn: () => JSON.parse(JSON.stringify(DOC)) },
      { name: 'structuredClone', fn: () => structuredClone(DOC) },
    ],
  },
  {
    id: 'async',
    title: 'Async latency (sync vs async detection)',
    candidates: [
      { name: 'await Promise.resolve()', fn: async () => Promise.resolve(1) },
      { name: 'await 2 ms timer', fn: () => new Promise((resolve) => setTimeout(resolve, 2)) },
      {
        name: 'rejects',
        fn: () => Promise.reject(new Error('flag service unavailable')),
      },
    ],
  },
];

export const SAMPLE_OPTIONS = [10, 20, 50];
export const WARMUP_OPTIONS = [0, 5, 20];
