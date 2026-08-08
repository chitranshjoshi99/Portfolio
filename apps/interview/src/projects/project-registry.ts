import { lazy } from 'react';
import type { Project } from './project.types';

/**
 * Single source of truth for the listing page and the router.
 * Add a project here and it shows up in both.
 */
export const projects: Project[] = [
  {
    id: 'file-explorer',
    title: 'File Explorer',
    description:
      'Nested tree with add / rename / delete for files and folders, expand-collapse state.',
    difficulty: 'medium',
    tags: ['tree', 'recursion', 'crud'],
    Component: lazy(() => import('./file-explorer')),
    guideUrl: 'https://claude.ai/code/artifact/670ac156-5e09-442c-b1db-e635c6a9b3c4',
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
    id: 'typeahead-search',
    title: 'Autocomplete / Typeahead',
    description:
      'Debounced remote suggestions with match highlighting, full keyboard navigation, caching and race-safe requests.',
    difficulty: 'medium',
    tags: ['debounce', 'a11y', 'keyboard', 'caching'],
    Component: lazy(() => import('./typeahead-search')),
    guideUrl: 'https://claude.ai/code/artifact/fe1d6eae-5d0e-48b7-9101-85fb3478f64b',
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
];

export const findProject = (id: string | undefined): Project | undefined =>
  projects.find((project) => project.id === id);
