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
    guideUrl: 'https://claude.ai/artifact/A1vLRotKC9WNgv9oYGpaWv',
  },
  {
    id: 'data-table',
    title: 'Server-side Data Table',
    description:
      'Issues table against a mock API: debounced search, status tabs with counts that survive paging, sortable headers with aria-sort and a stable tiebreak, page clamping, keep-previous rows while loading, abort on every query change, and lazily loaded subtask rows.',
    difficulty: 'hard',
    tags: ['atlassian', 'pagination', 'async', 'race-conditions', 'a11y'],
    Component: lazy(() => import('./data-table')),
    guideUrl: 'https://claude.ai/artifact/2dRmvqy4U6mk24C9Mcx9gi',
  },
  {
    id: 'document-renderer',
    title: 'Document Renderer (ADF)',
    description:
      'Renders a Confluence-shaped JSON document: node registry instead of a switch, marks pipeline, allow-listed link schemes, an honest placeholder for node types a newer editor sent, outline with unique anchors, and a paste-your-own-JSON pane.',
    difficulty: 'medium',
    tags: ['atlassian', 'recursion', 'registry', 'security', 'xss'],
    Component: lazy(() => import('./document-renderer')),
    guideUrl: 'https://claude.ai/artifact/DyQQr1WxNwpJucatPpBEjF',
  },
  {
    id: 'feature-flags',
    title: 'Feature Flag Control',
    description:
      'RBAC-gated flag console: per-environment role grants, deterministic percentage rollout, user overrides and a live who-sees-it preview.',
    difficulty: 'hard',
    tags: ['rbac', 'permissions', 'hashing', 'optimistic-ui'],
    Component: lazy(() => import('./feature-flags')),
    guideUrl: 'https://claude.ai/artifact/L7quvBX19XeC5rhNxTVofp',
  },
  {
    id: 'feature-flag-sdk',
    title: 'Feature Flag SDK',
    description:
      'getFeatureState(name, default) that dedupes concurrent calls into one request, caches with a TTL and stale-while-revalidate, persists, supports dev overrides and per-flag subscriptions.',
    difficulty: 'hard',
    tags: ['atlassian', 'js-round', 'caching', 'promises', 'singleton'],
    Component: lazy(() => import('./feature-flag-sdk')),
    guideUrl: 'https://claude.ai/artifact/TWWfwrcDnb8jDqtPtJ3NTb',
  },
  {
    id: 'file-explorer',
    title: 'File Explorer',
    description:
      'Nested tree with add / rename / delete for files and folders, expand-collapse state.',
    difficulty: 'medium',
    tags: ['atlassian', 'tree', 'recursion', 'crud'],
    Component: lazy(() => import('./file-explorer')),
    guideUrl: 'https://claude.ai/artifact/SYp9iFo13SuGW9i6C5ixgz',
  },
  {
    id: 'jira-board',
    title: 'Jira Board (Kanban)',
    description:
      'Normalised board with configurable columns and WIP limits, drag-and-drop plus Alt+arrow keyboard moves, quick filters, and optimistic rank-after-neighbour saves that roll back on conflict.',
    difficulty: 'hard',
    tags: ['atlassian', 'drag-and-drop', 'normalized-state', 'optimistic-ui', 'system-design'],
    Component: lazy(() => import('./jira-board')),
    guideUrl: 'https://claude.ai/artifact/58rDn5kneZeacrYVL4j57E',
  },
  {
    id: 'karat-html-css',
    title: 'HTML & CSS Round (Karat)',
    description:
      'The seven reported layout tasks, each live in a sandboxed frame with a width ruler: search row, responsive header, 30vw article, holy grail, hover overlay, a broken form to fix, and a consent banner.',
    difficulty: 'easy',
    tags: ['atlassian', 'karat', 'css', 'layout', 'a11y'],
    Component: lazy(() => import('./karat-html-css')),
    guideUrl: 'https://claude.ai/artifact/3FEVNJmN9xspu4ByZhYDQp',
  },
  {
    id: 'job-board',
    title: 'Job Board (ids → details)',
    description:
      'The two-step API: one call for ordered ids, one per posting. Bounded-concurrency pool that keeps input order, per-row failure with retry in place, skeletons sized like real rows, a double-click-proof Load more, and abort on unmount.',
    difficulty: 'medium',
    tags: ['atlassian', 'async', 'concurrency', 'pagination', 'error-handling'],
    Component: lazy(() => import('./job-board')),
    guideUrl: 'https://claude.ai/artifact/A44T5jHrt3DH4jXjNs6GTy',
  },
  {
    id: 'jira-issue-view',
    title: 'Jira Issue View + Comments',
    description:
      'Issue detail with its comments as a second request: optimistic add that keeps its place, retry or discard on failure, edit with rollback, delete with a whole-list snapshot, and a refetch that never eats a comment still in flight.',
    difficulty: 'medium',
    tags: ['atlassian', 'optimistic-ui', 'async', 'error-handling', 'forms'],
    Component: lazy(() => import('./jira-issue-view')),
    guideUrl: 'https://claude.ai/artifact/5GTcxzS72GB6fdbepmujjB',
  },
  {
    id: 'js-round',
    title: 'Atlassian JS Round Utilities',
    description:
      'The smaller reported JS-round prompts, each runnable with logged output: Stream pub/sub, recursive retry, flatten tree + batched getValueList, flatten object, Promise.any, bind, memoize, debounce/throttle, chainable API client, rate limiter, TTL storage, sequence/pool.',
    difficulty: 'medium',
    tags: ['atlassian', 'js-round', 'promises', 'polyfills', 'closures'],
    Component: lazy(() => import('./js-round')),
    guideUrl: 'https://claude.ai/artifact/6rDLhpq2DLBWBb5pewAotU',
  },
  {
    id: 'karat-todos',
    title: 'Todos by User (Karat)',
    description:
      'Fetch dummyjson-style todos 20 at a time, render one block per userId in arrival order, toggle and edit with edits saved locally, and never let fetched text become markup.',
    difficulty: 'easy',
    tags: ['atlassian', 'karat', 'vanilla-js', 'fetch', 'xss', 'localstorage'],
    Component: lazy(() => import('./karat-todos')),
    guideUrl: 'https://claude.ai/artifact/WijMf6SxpQq1Pb4bvjFdxU',
  },
  {
    id: 'nested-menu',
    title: 'Nested Navigation Menu',
    description:
      'Recursive menu from JSON: accordion per level, expand-and-highlight only the active path, access-rights pruning, a route guard with 403 vs 404, and arrow-key navigation.',
    difficulty: 'medium',
    tags: ['atlassian', 'tree', 'recursion', 'permissions', 'a11y'],
    Component: lazy(() => import('./nested-menu')),
    guideUrl: 'https://claude.ai/artifact/YWuqkBAgvAH1L6zuaDJq1j',
  },
  {
    id: 'page-tree',
    title: 'Confluence Page Tree',
    description:
      'Sidebar tree that lazy-loads children per expand (deduped, retryable), renders a flat virtualised DOM with full ARIA tree semantics, and supports arrow keys, *, and type-ahead over 2,000 pages.',
    difficulty: 'hard',
    tags: ['atlassian', 'tree', 'lazy-loading', 'a11y', 'virtualization'],
    Component: lazy(() => import('./page-tree')),
    guideUrl: 'https://claude.ai/artifact/UyicduwjXe7sJ14jz5U59E',
  },
  {
    id: 'perf-benchmark',
    title: 'Performance Benchmark Utility',
    description:
      'measure(fn) for sync and async functions: warm-up, calibrated batches below timer resolution, median/p95/sd, ops/s, errors as results, and a ranked compare() of candidates.',
    difficulty: 'medium',
    tags: ['atlassian', 'js-round', 'performance', 'async', 'statistics'],
    Component: lazy(() => import('./perf-benchmark')),
    guideUrl: 'https://claude.ai/artifact/RfyLTsZ5Vep5LYCQT8ubzP',
  },
  {
    id: 'seller-feedback',
    title: 'Seller Feedback Review',
    description:
      'Searchable feedback queue with status filter, pagination and optimistic approve / reject that rolls back and retries.',
    difficulty: 'hard',
    tags: ['async', 'optimistic-ui', 'pagination', 'debounce'],
    Component: lazy(() => import('./seller-feedback')),
    guideUrl: 'https://claude.ai/artifact/HmoZpK1NtU7qMHsKr577yf',
  },
  {
    id: 'tabs',
    title: 'Tabs (lazy panels + URL state)',
    description:
      'Headless useTabs with prop getters: ARIA tabs keyboard pattern, lazy-mounted and kept-alive panels, per-tab data fetched once and only when on screen, ?tab= synced with the URL.',
    difficulty: 'medium',
    tags: ['atlassian', 'a11y', 'lazy-loading', 'url-state', 'headless'],
    Component: lazy(() => import('./tabs')),
    guideUrl: 'https://claude.ai/artifact/Vr7ZF2ELMXHN7iE9G2c7Sg',
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe (N×N)',
    description:
      'Configurable N×N board with K-in-a-row wins, O(K) win check from the last move, undo, scores, arrow-key grid and any number of independent boards.',
    difficulty: 'medium',
    tags: ['atlassian', 'state-machine', 'game', 'a11y'],
    Component: lazy(() => import('./tic-tac-toe')),
    guideUrl: 'https://claude.ai/artifact/PH6EaHicJK8YQjKQwpF54T',
  },
  {
    id: 'typeahead-search',
    title: 'Autocomplete / Typeahead',
    description:
      'Debounced remote suggestions with match highlighting, full keyboard navigation, caching and race-safe requests.',
    difficulty: 'medium',
    tags: ['atlassian', 'debounce', 'a11y', 'keyboard', 'caching'],
    Component: lazy(() => import('./typeahead-search')),
    guideUrl: 'https://claude.ai/artifact/Mh5n6JQpBdwuV2zvN1SFTU',
  },
  {
    id: 'undo-redo-editor',
    title: 'Undo / Redo Editor',
    description:
      'Notes editor with real history: one entry point for every action, typing coalesced into a single step, no-op edits ignored, selection excluded, redo branch discarded on a new edit, bounded stack, and Cmd/Ctrl+Z working inside the fields.',
    difficulty: 'hard',
    tags: ['atlassian', 'state-machine', 'history', 'keyboard', 'immutability'],
    Component: lazy(() => import('./undo-redo-editor')),
    guideUrl: 'https://claude.ai/artifact/FcsZSYAz8NW1dmL7e84Px7',
  },
  {
    id: 'url-shortener',
    title: 'URL Shortener',
    description:
      'Validated long URLs, base62 codes, custom aliases, click counts and a link table that survives a reload.',
    difficulty: 'medium',
    tags: ['forms', 'validation', 'localstorage', 'security'],
    Component: lazy(() => import('./url-shortener')),
    guideUrl: 'https://claude.ai/artifact/16x8LBFFWCJHySVCcyHdTx',
  },
  {
    id: 'velocity-chart',
    title: 'Jira Velocity Bar Chart',
    description:
      'Grouped commitment-vs-completed bars from mock data in plain CSS, nice 1-2-5 axis ticks, one shared clamped tooltip, legend toggles, average velocity, responsive by container width.',
    difficulty: 'medium',
    tags: ['atlassian', 'charts', 'css', 'tooltip', 'responsive'],
    Component: lazy(() => import('./velocity-chart')),
    guideUrl: 'https://claude.ai/artifact/ViqJQu1UkcctYATMsYyG9M',
  },
];

export const findProject = (id: string | undefined): Project | undefined =>
  projects.find((project) => project.id === id);
