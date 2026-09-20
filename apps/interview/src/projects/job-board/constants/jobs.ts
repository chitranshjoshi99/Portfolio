import type { Job } from '../job-board.types';

export const PAGE_SIZE = 6;
export const CONCURRENCY_OPTIONS = [1, 3, 6, 12];
export const DEFAULT_CONCURRENCY = 6;

const TITLES = [
  'Senior Frontend Engineer',
  'Staff Engineer, Editor Platform',
  'Design Systems Engineer',
  'Full-stack Engineer (React / Node)',
  'Frontend Engineer, Growth',
  'Principal Engineer, Performance',
  'Engineering Manager, Collaboration',
  'Accessibility Engineer',
];

const COMPANIES = [
  ['Atlassian', 'atlassian.com'],
  ['Canva', 'canva.com'],
  ['Figma', 'figma.com'],
  ['Linear', 'linear.app'],
  ['Notion', 'notion.so'],
  ['Vercel', 'vercel.com'],
  ['Stripe', 'stripe.com'],
];

const LOCATIONS = ['Sydney (hybrid)', 'Remote (AU/NZ)', 'Bengaluru', 'Remote (worldwide)', 'San Francisco'];

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** The "database": 87 postings. The API only ever hands out ids; details are a second call each. */
export const ALL_JOBS: Job[] = (() => {
  const random = seeded(4242);
  const now = Date.UTC(2026, 8, 20, 9, 0, 0);
  return Array.from({ length: 87 }, (_, index) => {
    const [company, domain] = COMPANIES[Math.floor(random() * COMPANIES.length)];
    return {
      id: 41_000_000 + index,
      title: TITLES[Math.floor(random() * TITLES.length)],
      company,
      url: `https://${domain}/careers/${41_000_000 + index}`,
      location: LOCATIONS[Math.floor(random() * LOCATIONS.length)],
      postedAt: now - Math.floor(random() * 1000 * 60 * 60 * 24 * 21),
      points: Math.floor(random() * 240),
    };
  });
})();

/** Two ids always fail: partial failure has to be visible in the demo, not a story. */
export const FLAKY_IDS = new Set([ALL_JOBS[3].id, ALL_JOBS[9].id]);
