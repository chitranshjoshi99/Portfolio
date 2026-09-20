import { lazy } from 'react';
import type { Project } from './project.types';

/**
 * Single source of truth for the listing page and the router.
 * Add a project here and it shows up in both.
 */
export const projects: Project[] = [
  {
    id: 'analytics-sdk',
    title: 'Analytics SDK (batching)',
    description:
      'Singleton event collector: batches by size and interval, one request in flight, backoff retries ahead of newer events, bounded queue, sendBeacon on page hide with persistence when refused.',
    difficulty: 'hard',
    tags: ['atlassian', 'js-round', 'batching', 'singleton', 'reliability'],
    Component: lazy(() => import('./analytics-sdk')),
    guideUrl: 'https://claude.ai/artifact/KbFKYTtpgGnVr6YzQZAPoH',
  },
  {
    id: 'data-table',
    title: 'Server-side Data Table',
    description:
      'Issues table against a mock API: debounced search, status tabs with counts that survive paging, sortable headers with aria-sort and a stable tiebreak, page clamping, keep-previous rows while loading, abort on every query change, and lazily loaded subtask rows.',
    difficulty: 'hard',
    tags: ['atlassian', 'pagination', 'async', 'race-conditions', 'a11y'],
    Component: lazy(() => import('./data-table')),
    guideUrl: 'https://claude.ai/artifact/9JxtKyNYPu27ZvSgDiUK2V',
  },
  {
    id: 'document-renderer',
    title: 'Document Renderer (ADF)',
    description:
      'Renders a Confluence-shaped JSON document: node registry instead of a switch, marks pipeline, allow-listed link schemes, an honest placeholder for node types a newer editor sent, outline with unique anchors, and a paste-your-own-JSON pane.',
    difficulty: 'medium',
    tags: ['atlassian', 'recursion', 'registry', 'security', 'xss'],
    Component: lazy(() => import('./document-renderer')),
    guideUrl: 'https://claude.ai/artifact/SfHTv1FrQ66eHFaYM85gJs',
  },
  {
    id: 'feature-flags',
    title: 'Feature Flag Control',
    description:
      'RBAC-gated flag console: per-environment role grants, deterministic percentage rollout, user overrides and a live who-sees-it preview.',
    difficulty: 'hard',
    tags: ['rbac', 'permissions', 'hashing', 'optimistic-ui'],
    Component: lazy(() => import('./feature-flags')),
    guideUrl: 'https://claude.ai/code/artifact/004672f5-3a24-4462-9406-cb9e1a33849b',
  },
  {
    id: 'feature-flag-sdk',
    title: 'Feature Flag SDK',
    description:
      'getFeatureState(name, default) that dedupes concurrent calls into one request, caches with a TTL and stale-while-revalidate, persists, supports dev overrides and per-flag subscriptions.',
    difficulty: 'hard',
    tags: ['atlassian', 'js-round', 'caching', 'promises', 'singleton'],
    Component: lazy(() => import('./feature-flag-sdk')),
    guideUrl: 'https://claude.ai/artifact/RXejbmHi6DWJUe3ZX56PpM',
  },
  {
    id: 'file-explorer',
    title: 'File Explorer',
    description:
      'Nested tree with add / rename / delete for files and folders, expand-collapse state.',
    difficulty: 'medium',
    tags: ['atlassian', 'tree', 'recursion', 'crud'],
    Component: lazy(() => import('./file-explorer')),
    guideUrl: 'https://claude.ai/code/artifact/670ac156-5e09-442c-b1db-e635c6a9b3c4',
  },
  {
    id: 'jira-board',
    title: 'Jira Board (Kanban)',
    description:
      'Normalised board with configurable columns and WIP limits, drag-and-drop plus Alt+arrow keyboard moves, quick filters, and optimistic rank-after-neighbour saves that roll back on conflict.',
    difficulty: 'hard',
    tags: ['atlassian', 'drag-and-drop', 'normalized-state', 'optimistic-ui', 'system-design'],
    Component: lazy(() => import('./jira-board')),
    guideUrl: 'https://claude.ai/artifact/SSvTxeSScKHRtSh7UDazvG',
  },
  {
    id: 'karat-html-css',
    title: 'HTML & CSS Round (Karat)',
    description:
      'The seven reported layout tasks, each live in a sandboxed frame with a width ruler: search row, responsive header, 30vw article, holy grail, hover overlay, a broken form to fix, and a consent banner.',
    difficulty: 'easy',
    tags: ['atlassian', 'karat', 'css', 'layout', 'a11y'],
    Component: lazy(() => import('./karat-html-css')),
    guideUrl: 'https://claude.ai/artifact/4LKBhzEHpAH43EF3d4ivnt',
  },
  {
    id: 'job-board',
    title: 'Job Board (ids → details)',
    description:
      'The two-step API: one call for ordered ids, one per posting. Bounded-concurrency pool that keeps input order, per-row failure with retry in place, skeletons sized like real rows, a double-click-proof Load more, and abort on unmount.',
    difficulty: 'medium',
    tags: ['atlassian', 'async', 'concurrency', 'pagination', 'error-handling'],
    Component: lazy(() => import('./job-board')),
    guideUrl: 'https://claude.ai/artifact/UKVAyiFPhfKWZDq9PcZcHq',
  },
  {
    id: 'jira-issue-view',
    title: 'Jira Issue View + Comments',
    description:
      'Issue detail with its comments as a second request: optimistic add that keeps its place, retry or discard on failure, edit with rollback, delete with a whole-list snapshot, and a refetch that never eats a comment still in flight.',
    difficulty: 'medium',
    tags: ['atlassian', 'optimistic-ui', 'async', 'error-handling', 'forms'],
    Component: lazy(() => import('./jira-issue-view')),
    guideUrl: 'https://claude.ai/artifact/XMtKu8y5hc7t41RuHgMsCt',
  },
  {
    id: 'js-round',
    title: 'Atlassian JS Round Utilities',
    description:
      'The smaller reported JS-round prompts, each runnable with logged output: Stream pub/sub, recursive retry, flatten tree + batched getValueList, flatten object, Promise.any, bind, memoize, debounce/throttle, chainable API client, rate limiter, TTL storage, sequence/pool.',
    difficulty: 'medium',
    tags: ['atlassian', 'js-round', 'promises', 'polyfills', 'closures'],
    Component: lazy(() => import('./js-round')),
    guideUrl: 'https://claude.ai/artifact/7EmET6xsWNpec7CrV3hjhX',
  },
  {
    id: 'karat-todos',
    title: 'Todos by User (Karat)',
    description:
      'Fetch dummyjson-style todos 20 at a time, render one block per userId in arrival order, toggle and edit with edits saved locally, and never let fetched text become markup.',
    difficulty: 'easy',
    tags: ['atlassian', 'karat', 'vanilla-js', 'fetch', 'xss', 'localstorage'],
    Component: lazy(() => import('./karat-todos')),
    guideUrl: 'https://claude.ai/artifact/Fb1CEvQa4Kr957cxftVLme',
  },
  {
    id: 'nested-menu',
    title: 'Nested Navigation Menu',
    description:
      'Recursive menu from JSON: accordion per level, expand-and-highlight only the active path, access-rights pruning, a route guard with 403 vs 404, and arrow-key navigation.',
    difficulty: 'medium',
    tags: ['atlassian', 'tree', 'recursion', 'permissions', 'a11y'],
    Component: lazy(() => import('./nested-menu')),
    guideUrl: 'https://claude.ai/artifact/26KbBK79FVzYabFbjEwsG4',
  },
  {
    id: 'page-tree',
    title: 'Confluence Page Tree',
    description:
      'Sidebar tree that lazy-loads children per expand (deduped, retryable), renders a flat virtualised DOM with full ARIA tree semantics, and supports arrow keys, *, and type-ahead over 2,000 pages.',
    difficulty: 'hard',
    tags: ['atlassian', 'tree', 'lazy-loading', 'a11y', 'virtualization'],
    Component: lazy(() => import('./page-tree')),
    guideUrl: 'https://claude.ai/artifact/S4FQ4fPSdJENX3EJeiffZz',
  },
  {
    id: 'perf-benchmark',
    title: 'Performance Benchmark Utility',
    description:
      'measure(fn) for sync and async functions: warm-up, calibrated batches below timer resolution, median/p95/sd, ops/s, errors as results, and a ranked compare() of candidates.',
    difficulty: 'medium',
    tags: ['atlassian', 'js-round', 'performance', 'async', 'statistics'],
    Component: lazy(() => import('./perf-benchmark')),
    guideUrl: 'https://claude.ai/artifact/L2LgmwwLoGjYZLpoJrLmTx',
  },
  {
    id: 'seller-feedback',
    title: 'Seller Feedback Review',
    description:
      'Searchable feedback queue with status filter, pagination and optimistic approve / reject that rolls back and retries.',
    difficulty: 'hard',
    tags: ['async', 'optimistic-ui', 'pagination', 'debounce'],
    Component: lazy(() => import('./seller-feedback')),
    guideUrl: 'https://claude.ai/code/artifact/d362cf78-a436-4493-88a0-df8bfaad58cb',
  },
  {
    id: 'tabs',
    title: 'Tabs (lazy panels + URL state)',
    description:
      'Headless useTabs with prop getters: ARIA tabs keyboard pattern, lazy-mounted and kept-alive panels, per-tab data fetched once and only when on screen, ?tab= synced with the URL.',
    difficulty: 'medium',
    tags: ['atlassian', 'a11y', 'lazy-loading', 'url-state', 'headless'],
    Component: lazy(() => import('./tabs')),
    guideUrl: 'https://claude.ai/artifact/T2ubbGUAF6o5AhbJJn7hpV',
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe (N×N)',
    description:
      'Configurable N×N board with K-in-a-row wins, O(K) win check from the last move, undo, scores, arrow-key grid and any number of independent boards.',
    difficulty: 'medium',
    tags: ['atlassian', 'state-machine', 'game', 'a11y'],
    Component: lazy(() => import('./tic-tac-toe')),
    guideUrl: 'https://claude.ai/artifact/Dgj5YzF71quqBz67QWMC9f',
  },
  {
    id: 'typeahead-search',
    title: 'Autocomplete / Typeahead',
    description:
      'Debounced remote suggestions with match highlighting, full keyboard navigation, caching and race-safe requests.',
    difficulty: 'medium',
    tags: ['atlassian', 'debounce', 'a11y', 'keyboard', 'caching'],
    Component: lazy(() => import('./typeahead-search')),
    guideUrl: 'https://claude.ai/code/artifact/fe1d6eae-5d0e-48b7-9101-85fb3478f64b',
  },
  {
    id: 'undo-redo-editor',
    title: 'Undo / Redo Editor',
    description:
      'Notes editor with real history: one entry point for every action, typing coalesced into a single step, no-op edits ignored, selection excluded, redo branch discarded on a new edit, bounded stack, and Cmd/Ctrl+Z working inside the fields.',
    difficulty: 'hard',
    tags: ['atlassian', 'state-machine', 'history', 'keyboard', 'immutability'],
    Component: lazy(() => import('./undo-redo-editor')),
    guideUrl: 'https://claude.ai/artifact/UbYNh9KYrRGJNsFguwS7rw',
  },
  {
    id: 'url-shortener',
    title: 'URL Shortener',
    description:
      'Validated long URLs, base62 codes, custom aliases, click counts and a link table that survives a reload.',
    difficulty: 'medium',
    tags: ['forms', 'validation', 'localstorage', 'security'],
    Component: lazy(() => import('./url-shortener')),
    guideUrl: 'https://claude.ai/code/artifact/8cf3a986-642c-44b6-be82-a94a969679c4',
  },
  {
    id: 'velocity-chart',
    title: 'Jira Velocity Bar Chart',
    description:
      'Grouped commitment-vs-completed bars from mock data in plain CSS, nice 1-2-5 axis ticks, one shared clamped tooltip, legend toggles, average velocity, responsive by container width.',
    difficulty: 'medium',
    tags: ['atlassian', 'charts', 'css', 'tooltip', 'responsive'],
    Component: lazy(() => import('./velocity-chart')),
    guideUrl: 'https://claude.ai/artifact/34aY5uhaxoRXrXQbkUx1ai',
  },
];

export const findProject = (id: string | undefined): Project | undefined =>
  projects.find((project) => project.id === id);
