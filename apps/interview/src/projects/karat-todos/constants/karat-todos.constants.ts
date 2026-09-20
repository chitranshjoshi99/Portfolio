export const PAGE_SIZE = 20;
export const STORAGE_KEY = 'karat-todos:patches:v1';
export const LATENCY_MS = 450;
export const DATASET_SIZE = 150;
/** The prompt's real endpoint; the demo serves the same shape from a local fake. */
export const API_URL = 'https://dummyjson.com/todos';

export const TASKS = [
  'Do something nice for someone I care about',
  'Memorize a poem',
  'Watch a classic movie',
  'Contribute code or a monetary donation to an open-source project',
  'Solve a Rubik’s cube',
  'Bake pastries for someone',
  'Go see a Broadway production',
  'Write a thank-you letter to an influential person',
  'Invite some friends over for a game night',
  'Have a football scrimmage with friends',
  'Text a friend I haven’t talked to in a while',
  'Organize pantry',
  'Buy a new house decoration',
  'Plan a vacation I’ve always wanted to take',
  'Clean out car',
  'Draw and color a Mandala',
  'Create a cookbook with favorite recipes',
  'Bake a pie with some friends',
  'Create a compost pile',
  'Take a hike at a local park',
];

/** One hostile row, on purpose: it must render as text, never as markup. */
export const HOSTILE_TODO = '<img src=x onerror="alert(`xss`)"> check the attachment';
