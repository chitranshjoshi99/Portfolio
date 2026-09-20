import type { BankQuestion } from './bank.types';

/**
 * Every Atlassian frontend question found in the reports, with the answer that gets full marks.
 *
 * Read while compiling this (Sep 2026): GreatFrontEnd's Atlassian page including the question list in its
 * payload, LeetCode Discuss threads for Atlassian frontend roles, Glassdoor interview reports, FrontendLead
 * threads, Blind, Devtools.tech, LearnersBucket, the Frontend Interview Handbook, Prepfully (an aggregator:
 * anything sourced only there is marked low confidence) and Atlassian's own Front-end Interview Guide.
 *
 * Citation honesty: entries citing a thread id (FrontendLead 2192, LeetCode 5857882) can be re-checked.
 * Entries citing "Glassdoor xN" or a Glassdoor page number cannot — Glassdoor is login-gated and its pages
 * reorder, so treat those as "seen while reading reports", not as a reference. Their `frequency` is the
 * weaker claim of the two.
 */
export const QUESTIONS: BankQuestion[] = [
  // ───────────────────────── Browser / UI coding round ─────────────────────────
  {
    id: 'ui-file-tree',
    round: 'ui-coding',
    prompt:
      'Render a file explorer / nested navigation tree from JSON: expand and collapse folders, add, rename, delete. Variants: Confluence sidebar tree, repo file tree, "category component via recursion", bullet list with sublists.',
    answer:
      'Recursive component over a normalised tree; expansion state is a Set of ids held by the parent, never inside each node. Folders before files, sorted. Do not rebuild the whole tree to toggle one node.',
    sources: ['GreatFrontEnd (File Explorer I/II/III)', 'LeetCode 4350727', 'Glassdoor ×6', 'FrontendLead 2926, 2302'],
    projectId: 'file-explorer',
    frequency: 'very-high',
  },
  {
    id: 'ui-tree-lazy',
    round: 'ui-coding',
    prompt:
      'Same tree, but children are loaded from a mock API when a folder is expanded — and it must stay usable with thousands of pages.',
    answer:
      'One in-flight request per node (a promise map dedupes double-expands), children cached after the first load, a flat virtualised row list so the DOM stays small, and full ARIA tree semantics with roving tabindex.',
    sources: ['FrontendLead 2192', 'GreatFrontEnd (File Explorer III)', 'Devtools.tech'],
    projectId: 'page-tree',
    frequency: 'high',
  },
  {
    id: 'ui-nested-menu',
    round: 'ui-coding',
    prompt:
      'Create a menu with children as per the image. Opening one parent closes the other open parent, but a child\'s own children stay open. Highlight only the active item and expand only the path that contains it.',
    answer:
      'Derive the open path from the active item rather than storing "open" per node: expanded = ancestors(active) ∪ manually toggled. Recursion renders levels; access rights prune the tree before render, and a route guard separates 403 from 404.',
    sources: ['Glassdoor (Sr FE)', 'Glassdoor (FE Eng)', 'Glassdoor p191'],
    projectId: 'nested-menu',
    frequency: 'very-high',
  },
  {
    id: 'ui-tic-tac-toe',
    round: 'ui-coding',
    prompt:
      'Tic-tac-toe: 3×3, detect the winner, reset. Then scale to N×N with K in a row, then render any number of independent boards from props.',
    answer:
      'Check only the four lines through the last move — O(K), not O(N²). Keep the move list so undo and the winning line are free. Boards are one component instantiated N times with their own state.',
    sources: ['GreatFrontEnd (Tic-tac-toe I/II)', 'LeetCode 6529428', 'FrontendLead 2003, 2421, 2672, 3511', 'Glassdoor ×4'],
    projectId: 'tic-tac-toe',
    frequency: 'very-high',
  },
  {
    id: 'ui-tabs',
    round: 'ui-coding',
    prompt:
      'Build a Tabs component that lazy-loads each panel\'s content when it first becomes visible. Variants: plain-JS tabs in a pair-programming round, "make it extendable and optimise", tabs with the active tab in the URL.',
    answer:
      'Headless hook with prop getters for the WAI-ARIA tabs pattern (arrow keys, Home/End, roving tabindex). Panels mount on first activation and stay mounted; each tab fetches once, keyed by tab id; the active tab syncs to ?tab= so a link reproduces the view.',
    sources: ['LeetCode 6769058 (P60)', 'LearnersBucket', 'Glassdoor ×2', 'FrontendLead 476', 'GreatFrontEnd'],
    projectId: 'tabs',
    frequency: 'high',
  },
  {
    id: 'ui-bar-chart',
    round: 'ui-coding',
    prompt:
      'Build the UI in this image from mock data: a bar chart with a tooltip on each bar, responsive. Variants: "produce a bar graph from this dataset using CSS", Jira velocity chart.',
    answer:
      'Percentage-height divs, not canvas, at this size. Axis ticks from a nice 1-2-5 scale over the visible maximum (never the raw max). One tooltip element, positioned above the tallest bar of the group and clamped into the plot, re-placed on resize via ResizeObserver.',
    sources: ['LeetCode 7131876 (P50)', 'FrontendLead 2735', 'Glassdoor ×2', 'Devtools.tech'],
    projectId: 'velocity-chart',
    frequency: 'high',
  },
  {
    id: 'ui-karat-todos',
    round: 'ui-coding',
    prompt:
      'Fetch todos from dummyjson (?limit=20&skip=…), render one block per userId, 20 at a time, let the user toggle and edit them, and keep edits locally.',
    answer:
      'Vanilla JS: fetch a page, group by userId preserving arrival order, render with textContent (never innerHTML — the fixture contains an <img onerror> payload), persist edits by id in localStorage and re-apply them over fetched rows.',
    sources: ['Glassdoor (Karat)', 'Frontend Interview Handbook', 'FrontendLead 2517, 2673, 2521, 2520'],
    projectId: 'karat-todos',
    frequency: 'very-high',
  },
  {
    id: 'ui-xss',
    round: 'ui-coding',
    prompt:
      'Here is some code: `const data = await fetch("api"); div.innerHTML = data`. What is the security issue and how would you fix it?',
    answer:
      'Stored XSS. A <script> tag inserted through innerHTML does not run, so the vector is event-handler markup — <img src=x onerror=…>, <svg onload=…> — which executes with your origin. Use textContent, or render through a node registry; if HTML is genuinely required, sanitise server-side and add a CSP. Allow-list link schemes too: javascript: in an href is the same bug. (Note the prompt also renders [object Response]: fetch resolves to a Response, not to text.)',
    sources: ['Glassdoor', 'FrontendLead 2360'],
    projectId: 'karat-todos',
    frequency: 'high',
  },
  {
    id: 'ui-doc-renderer',
    round: 'ui-coding',
    prompt:
      'Build a component that renders a document given a JSON structure (image, title, unordered list, paragraph, …).',
    answer:
      'Recursive render through a registry keyed by node type, so a new type is one key and a caller can extend it. Unknown types render a labelled placeholder rather than disappearing, and link hrefs go through a parsed scheme allow-list.',
    sources: ['FrontendLead 2371', 'Glassdoor'],
    projectId: 'document-renderer',
    frequency: 'medium',
  },
  {
    id: 'ui-issue-view',
    round: 'ui-coding',
    prompt:
      'Build the Jira issue view in HTML/CSS/JS. Follow-up: render its comment list from a promise-based API, "modular and performant", then let the user add one.',
    answer:
      'Issue and comments are two requests so the header is not held up. A new comment is optimistic with a temporary id and a sending status; a failure keeps the text with Retry/Discard; edit and delete roll back from a snapshot; a refetch merges instead of replacing.',
    sources: ['Glassdoor ×2'],
    projectId: 'jira-issue-view',
    frequency: 'high',
  },
  {
    id: 'ui-table-api',
    round: 'ui-coding',
    prompt:
      'Render a table from a mock API with sorting, filtering and pagination. Variants: "fetch data and display tasks and sub-tasks, sorted by status", paginated list in React, "scale it up".',
    answer:
      'One query object (page, size, sort, dir, search, filter) is the entire server input and its serialised form is the cache key. Abort the in-flight request in the effect cleanup, keep rows on screen while loading, and sort with a stable tiebreak or rows repeat across pages.',
    sources: ['FrontendLead 2421', 'Glassdoor ×3 (Karat + onsite)'],
    projectId: 'data-table',
    frequency: 'high',
  },
  {
    id: 'ui-job-board',
    round: 'ui-coding',
    prompt:
      'Job board: one call returns an array of job ids, each job needs its own call. Show the first six and add a Load More.',
    answer:
      'Fetch the page through a bounded concurrency pool that writes results by index, so the list keeps the API\'s ranked order. Settle each call individually so one 502 costs one row, guard Load More with a ref (two clicks in a tick share state), and abort on unmount.',
    sources: ['GreatFrontEnd (Job Board)', 'Glassdoor'],
    projectId: 'job-board',
    frequency: 'high',
  },
  {
    id: 'ui-todo-list',
    round: 'ui-coding',
    prompt: 'Build a todo list. (GreatFrontEnd listing; also asked as a plain vanilla-JS exercise.)',
    answer:
      'Add, toggle, delete, filter, with the list normalised by id and the filter derived rather than stored. The graded parts are the empty state, keyboard submit, and not mutating state in place.',
    sources: ['GreatFrontEnd (Todo List)', 'Glassdoor ×3'],
    projectId: 'karat-todos',
    frequency: 'high',
  },
  {
    id: 'ui-undo-redo',
    round: 'ui-coding',
    prompt: 'Add undo/redo to the editor you just built (topic listed by GreatFrontEnd as "undo/redo text editing").',
    answer:
      'Document and history in one state atom; the reducer returns the same object when nothing changed so no-op edits never enter history; typing coalesces by field id within ~700ms; a new edit clears the redo branch; Cmd/Ctrl+Z handled on window so the browser\'s per-field undo does not fight yours.',
    sources: ['GreatFrontEnd (topics)', 'Glassdoor'],
    projectId: 'undo-redo-editor',
    frequency: 'medium',
  },
  {
    id: 'ui-typeahead',
    round: 'ui-coding',
    prompt: 'Build an autocomplete / search input with suggestions (GreatFrontEnd topic "input/search"; asked as a UI round task).',
    answer:
      'Debounce the query, cache by term, and make the responses race-safe (ignore or abort stale ones). Full keyboard support with aria-activedescendant, and highlight the matched substring rather than re-rendering the label.',
    sources: ['GreatFrontEnd (topics)', 'Glassdoor'],
    projectId: 'typeahead-search',
    frequency: 'high',
  },
  {
    id: 'ui-stack',
    round: 'ui-coding',
    prompt: 'Implement a stack data structure with JS and HTML — a page driven by push/pop (Opsgenie HackerRank round).',
    answer:
      'Array-backed push/pop/peek/size with an immutable render from the array; the interest is in the empty state, disabled controls and not letting the DOM be the source of truth.',
    sources: ['Glassdoor (Opsgenie)', 'Glassdoor'],
    frequency: 'low',
  },
  {
    id: 'ui-builder',
    round: 'ui-coding',
    prompt: 'Build a basic website-builder surface: drag components onto a canvas and reorder them.',
    answer:
      'Normalised tree of components with a drop index computed from element midpoints; HTML5 drag for the mouse plus keyboard move commands; persistence is a serialisable tree, which is also the answer to the "how do you save it" follow-up.',
    sources: ['FrontendLead 2104, 2110'],
    projectId: 'jira-board',
    frequency: 'low',
  },

  // ───────────────────────── JS / SDK coding round ─────────────────────────
  {
    id: 'js-feature-flags',
    round: 'js-coding',
    prompt:
      'Implement getFeatureState(name, defaultValue) that returns a promise: fetch the flags once, cache them, dedupe concurrent calls, survive a reload, handle a typo in the key, and let the value be overridden in dev.',
    answer:
      'Memoise the in-flight promise (not just the result) so concurrent callers share one request; TTL cache with stale-while-revalidate; localStorage for persistence and dev overrides; unknown key returns the caller\'s default rather than throwing; subscribers notified only when a value actually changes.',
    sources: ['FrontendLead 3511', 'Glassdoor ×6', 'Devtools.tech', 'LearnersBucket'],
    projectId: 'feature-flag-sdk',
    frequency: 'very-high',
  },
  {
    id: 'js-feature-flag-ui',
    round: 'js-coding',
    prompt:
      'Design a feature-flag admin UI / library: per-environment roles, percentage rollout, user overrides, and "who sees this flag right now".',
    answer:
      'Deterministic bucketing by hash(flag + userId) % 100 so a user does not flip between renders; RBAC gates per environment; overrides beat rollout; the preview panel is a pure function of the same evaluation code the SDK runs.',
    sources: ['Glassdoor (LLD feature flag library)', 'Glassdoor (A/B testing SDK)'],
    projectId: 'feature-flags',
    frequency: 'high',
  },
  {
    id: 'js-analytics',
    round: 'js-coding',
    prompt:
      'Implement an analytics SDK: collect events, batch them, send on a size or time threshold, and do not lose the batch when the user navigates away.',
    answer:
      'Singleton collector, one request in flight at a time, batch by size or interval, retry with backoff ahead of newer events, bounded queue that drops oldest, and sendBeacon on visibilitychange with a localStorage fallback when the browser refuses it.',
    sources: ['LearnersBucket', 'FrontendLead 2211', 'Glassdoor'],
    projectId: 'analytics-sdk',
    frequency: 'very-high',
  },
  {
    id: 'js-perf-measure',
    round: 'js-coding',
    prompt:
      'Write a utility that measures the performance of given functions: use performance.now, run them multiple times, average the results, and handle async functions too.',
    answer:
      'Warm up, then calibrate the batch size so one measurement is well above timer resolution; report median and p95 rather than the mean; treat a throw as a result, not a crash; calibrate async work by timing a batch of awaited calls.',
    sources: ['LeetCode (P60)', 'FrontendLead 2991', 'Glassdoor', 'Frontend Interview Handbook'],
    projectId: 'perf-benchmark',
    frequency: 'high',
  },
  {
    id: 'js-stream',
    round: 'js-coding',
    prompt:
      'Implement a Stream: new Stream(); stream.subscribe(fn); stream.push(value) calls every subscriber; and you must be able to remove a single subscriber.',
    answer:
      'subscribe returns an unsubscribe closure (so removing an anonymous function is possible at all); iterate over a copy when pushing so a subscriber that unsubscribes mid-push cannot skip the next one; one throwing subscriber must not stop the rest.',
    sources: ['Glassdoor', 'FrontendLead 471, 473, 475'],
    projectId: 'js-round',
    frequency: 'high',
  },
  {
    id: 'js-retry',
    round: 'js-coding',
    prompt: 'Write a function that retries an async call n times until it succeeds — recursively.',
    answer:
      'Recurse on failure with attempts - 1, rethrow when they run out, and add a delay between attempts. The follow-up is always backoff plus jitter — say the jitter out loud, because plain exponential backoff re-synchronises every client onto the same retry tick — and whether every error deserves a retry (a 400 does not).',
    sources: ['Glassdoor', 'Prepfully'],
    projectId: 'js-round',
    frequency: 'high',
  },
  {
    id: 'js-flatten-list',
    round: 'js-coding',
    prompt:
      'Flatten [{ value, children }] into a flat [{ value }] list. Then implement getValueList(from, to) where values arrive through getBatch(index), which returns a promise for a page.',
    answer:
      'Iterative flatten with an explicit stack (recursion blows up on deep data). getValueList maps the index range onto batch indices, requests each batch once (cache the promise), and returns values in range order — not arrival order.',
    sources: ['FrontendLead 466', 'Glassdoor'],
    projectId: 'js-round',
    frequency: 'high',
  },
  {
    id: 'js-flatten-object',
    round: 'js-coding',
    prompt: 'Flatten a nested object into dotted keys (and the array variant).',
    answer:
      'Recurse, building the path; treat arrays with bracket notation; stop at non-plain objects (Date, null) instead of walking into them.',
    sources: ['Blind', 'Prepfully'],
    projectId: 'js-round',
    frequency: 'medium',
  },
  {
    id: 'js-api-client',
    round: 'js-coding',
    prompt: 'Implement a chainable API client: client.get("/x").query({…}).headers({…}).send().',
    answer:
      'Each builder method returns a new immutable request object (returning `this` breaks when a base client is reused), and send() is the only method that touches the network. Add interceptors and a timeout via AbortController for the follow-up.',
    sources: ['GreatFrontEnd (API Client)'],
    projectId: 'js-round',
    frequency: 'high',
  },
  {
    id: 'js-bind',
    round: 'js-coding',
    prompt: 'Implement Function.prototype.bind yourself.',
    answer:
      'Return a function that applies the saved thisArg and concatenates the partial arguments; handle `new` on the bound function (the instance wins over thisArg) and preserve the prototype chain.',
    sources: ['GreatFrontEnd', 'Glassdoor (trivia + coding)'],
    projectId: 'js-round',
    frequency: 'high',
  },
  {
    id: 'js-memoize',
    round: 'js-coding',
    prompt: 'Implement memoize.',
    answer:
      'Map keyed by serialised arguments; state the key strategy out loud (JSON.stringify breaks on objects with different key order and on functions). Mention cache size, TTL and a WeakMap for object arguments.',
    sources: ['GreatFrontEnd', 'Glassdoor (memoised db fetch by key)'],
    projectId: 'js-round',
    frequency: 'high',
  },
  {
    id: 'js-throttle-debounce',
    round: 'js-coding',
    prompt: 'Implement throttle (and debounce), and explain when each is right.',
    answer:
      'Throttle runs at most once per window (scroll, resize, drag); debounce waits for silence (search box, autosave). Leading/trailing options and a cancel method are the follow-ups; both need the timer cleared on unmount.',
    sources: ['GreatFrontEnd', 'Glassdoor (throttle + closure)'],
    projectId: 'js-round',
    frequency: 'very-high',
  },
  {
    id: 'js-promise-any',
    round: 'js-coding',
    prompt: 'Implement Promise.any (and describe how it differs from race and allSettled).',
    answer:
      'Resolve on the first fulfilment; only reject once every input has rejected, with an AggregateError carrying all the reasons. race settles on the first settlement either way; allSettled never rejects.',
    sources: ['Frontend Interview Handbook', 'Glassdoor'],
    projectId: 'js-round',
    frequency: 'medium',
  },
  {
    id: 'js-rate-limiter',
    round: 'js-coding',
    prompt: 'Implement a client-side API rate limiter.',
    answer:
      'Sliding window over timestamps, or a token bucket for burst tolerance; queue the caller rather than throwing, and expose the wait time so the UI can say why a request is pending.',
    sources: ['FrontendLead 474'],
    projectId: 'js-round',
    frequency: 'medium',
  },
  {
    id: 'js-ttl-storage',
    round: 'js-coding',
    prompt: 'Implement localStorage with expiry.',
    answer:
      'Store { value, expiresAt } and treat an expired read as a miss, deleting it on the way out. Wrap every access in try/catch: storage throws in private mode and in sandboxed frames.',
    sources: ['Prepfully', 'FrontendLead'],
    projectId: 'js-round',
    frequency: 'medium',
  },
  {
    id: 'js-sequence',
    round: 'js-coding',
    prompt: 'Run an array of promise-returning functions in sequence (and the bounded-parallel variant).',
    answer:
      'Reduce over the array chaining .then, or a for-of with await. The parallel-with-limit version is n workers pulling from a shared index — the same pool the job board needs.',
    sources: ['Prepfully', 'GreatFrontEnd (topics)'],
    projectId: 'js-round',
    frequency: 'medium',
  },
  {
    id: 'js-event-emitter',
    round: 'js-coding',
    prompt: 'Implement an event emitter with on / emit / off (and once).',
    answer:
      'Map of event name to handler array; off removes by identity; emit iterates a copy. Same shape as the Stream question, which is the one Atlassian actually asks.',
    sources: ['Prepfully'],
    projectId: 'js-round',
    frequency: 'low',
  },
  {
    id: 'js-deep-clone',
    round: 'js-coding',
    prompt: 'Implement deep clone.',
    answer:
      'Recurse over plain objects and arrays, handle Date/Map/Set, and keep a WeakMap of seen objects so cycles terminate. Mention structuredClone as the built-in answer.',
    sources: ['Prepfully'],
    frequency: 'low',
  },
  {
    id: 'js-promisify',
    round: 'js-coding',
    prompt: 'Write promisify: turn a callback-style function into one that returns a promise.',
    answer:
      'Return a function that wraps the call in a new Promise and passes (error, value) => error ? reject : resolve as the last argument, preserving `this` and the argument list.',
    sources: ['Prepfully'],
    frequency: 'low',
  },
  {
    id: 'js-dir-sizes',
    round: 'js-coding',
    prompt: 'Design a data structure that counts the data held by each of its components (directory sizes).',
    answer:
      'Tree where each node caches its own size and the sum of its children; adding a file walks up the parents updating the running totals, so a read is O(1) instead of a traversal.',
    sources: ['Glassdoor'],
    projectId: 'file-explorer',
    frequency: 'medium',
  },
  {
    id: 'js-permissions',
    round: 'js-coding',
    prompt: 'Implement permissions: given a user\'s roles and a resource, decide what they can do — and use it to drive a menu.',
    answer:
      'Permissions as a set of (role, action, resource) rules evaluated by a pure `can()`; the UI prunes the tree with the same function the route guard uses, so a hidden item is never merely invisible.',
    sources: ['Glassdoor', 'Glassdoor p191 (menu by access rights)'],
    projectId: 'nested-menu',
    frequency: 'medium',
  },
  {
    id: 'js-modify-snippets',
    round: 'js-coding',
    prompt:
      'Given some JS function snippets, modify them for scenarios the interviewer describes out loud, one change at a time.',
    answer:
      'This is a listening exercise: restate the requirement before typing, change the smallest thing that satisfies it, and run the snippet after each change. Interviewers report it as the round people fail by racing ahead.',
    sources: ['Glassdoor ×2'],
    frequency: 'medium',
  },
  {
    id: 'js-priority-fetch',
    round: 'js-coding',
    prompt: 'Priority-based data fetching: given tasks with priorities, run them in the right order with a concurrency cap.',
    answer:
      'A priority queue feeding the same worker-pool pattern: n workers pull the highest-priority pending task; support cancelling a queued task, which is the usual follow-up.',
    sources: ['Devtools.tech (low confidence)'],
    projectId: 'job-board',
    frequency: 'low',
  },

  // ───────────────────────── Karat HTML/CSS ─────────────────────────
  {
    id: 'css-search-bar',
    round: 'karat-css',
    prompt:
      'Build a search input with a button next to it, to a list of constraints (single row, no gap between them, input at least twice the button, button never wraps).',
    answer:
      'Flex row: input `flex: 1 1 auto; min-width: 0` (without min-width:0 it refuses to shrink and the row overflows), button `flex: 0 0 auto; white-space: nowrap`. A real <label>, 44px touch targets, visible focus ring.',
    sources: ['FrontendLead 2360, 2210, 2521, 2520, 2243, 2846', 'Frontend Interview Handbook'],
    projectId: 'karat-html-css',
    frequency: 'very-high',
  },
  {
    id: 'css-header',
    round: 'karat-css',
    prompt: 'Make this header responsive: logo, nav links, sign-in — with a mobile menu. No JavaScript.',
    answer:
      '<details>/<summary> gives a keyboard-operable disclosure with announced state for free. Keep `display: list-item` on the summary (changing it drops the disclosure marker) and remove the triangle with list-style: none; re-show the closed panel on desktop with both the legacy child rule and ::details-content.',
    sources: ['FrontendLead 2517, 2671', 'Glassdoor'],
    projectId: 'karat-html-css',
    frequency: 'very-high',
  },
  {
    id: 'css-article',
    round: 'karat-css',
    prompt:
      'Article layout: bold centred title, image on the left at 30vw, paragraph to its right, "Published - 2023" aligned right. Six marked points.',
    answer:
      '`flex: 0 0 30vw` on the figure (width alone still shrinks — flex-shrink defaults to 1), `min-width: 0` + `overflow-wrap: anywhere` on the text column, and aspect-ratio on the image so the text does not reflow when it loads.',
    sources: ['Glassdoor'],
    projectId: 'karat-html-css',
    frequency: 'high',
  },
  {
    id: 'css-holy-grail',
    round: 'karat-css',
    prompt: 'Build the holy grail layout: header, footer, fixed side columns, fluid centre, footer at the bottom on a short page.',
    answer:
      'One grid with named areas and `grid-template-rows: auto 1fr auto`; `min-height: 100dvh`, not 100vh. Put main first in the DOM and place it with grid-area so the tab order does not walk the nav first.',
    sources: ['GreatFrontEnd (Holy Grail)', 'Glassdoor'],
    projectId: 'karat-html-css',
    frequency: 'high',
  },
  {
    id: 'css-hover-overlay',
    round: 'karat-css',
    prompt: 'Image card where hovering shows an information overlay.',
    answer:
      'Pair :hover with :focus-within so keyboard users see it, and `@media (hover: none)` to show it outright on touch (otherwise tap one only hovers). Transition opacity and transform, never `all`, and put a scrim behind the text.',
    sources: ['Prepfully', 'Glassdoor'],
    projectId: 'karat-html-css',
    frequency: 'medium',
  },
  {
    id: 'css-form-bug',
    round: 'karat-css',
    prompt: 'Here is a sign-up form whose validation is broken. Fix it.',
    answer:
      'Three defects: :invalid paints untouched fields red on load (use :user-invalid or an aria-invalid class set after a real attempt), the message is not linked with aria-describedby, and confirm-password is compared against a stale captured value instead of the current one.',
    sources: ['FrontendLead 2210'],
    projectId: 'karat-html-css',
    frequency: 'high',
  },
  {
    id: 'css-cookie-banner',
    round: 'karat-css',
    prompt: 'Build a cookie consent banner.',
    answer:
      'Fixed to the bottom with `padding-bottom: calc(… + env(safe-area-inset-bottom))`, the page reserving its height via `body:has(.cc:not([hidden]))` so it never covers the last paragraph, Accept and Reject equally prominent, and storage access wrapped in try/catch.',
    sources: ['Frontend Interview Handbook', 'GreatFrontEnd (topics)'],
    projectId: 'karat-html-css',
    frequency: 'medium',
  },
  {
    id: 'css-from-screenshot',
    round: 'karat-css',
    prompt: 'Recreate this UI from a screenshot / wireframe (dropdown with data, custom search widget, "a form or search bar").',
    answer:
      'Read the image aloud first and name the layout mechanism before typing: one row is flex, a page skeleton is grid. Semantic elements over divs, then spacing with gap, then the states nobody demos — focus, narrow width, long content.',
    sources: ['Glassdoor ×4', 'Frontend Interview Handbook'],
    projectId: 'karat-html-css',
    frequency: 'high',
  },

  // ───────────────────────── Karat trivia ─────────────────────────
  {
    id: 'trivia-coercion',
    round: 'karat-trivia',
    prompt: 'What do these print? true + false · "test" + 15 + 2 · "test" + +"now" · 12 / "6" · NaN === NaN · [1] > null',
    answer:
      '1 · "test152" · "testNaN" · 2 · false · true. Booleans coerce to 1/0; + with a string concatenates left to right; unary + on "now" is NaN; / coerces the string to a number; NaN is never equal to itself; [1] becomes "1" then 1, and null becomes 0.',
    sources: ['FrontendLead 2516'],
    frequency: 'very-high',
  },
  {
    id: 'trivia-let-var-const',
    round: 'karat-trivia',
    prompt: 'Difference between var, let and const?',
    answer:
      'var is function-scoped and hoisted as undefined; let and const are block-scoped with a temporal dead zone until the declaration. const binds the reference, not the value — a const object is still mutable.',
    sources: ['GreatFrontEnd quiz', 'Glassdoor ×5'],
    frequency: 'very-high',
  },
  {
    id: 'trivia-load-dcl',
    round: 'karat-trivia',
    prompt: 'Difference between the load and DOMContentLoaded events?',
    answer:
      'DOMContentLoaded fires when the HTML is parsed and deferred scripts have run; load waits for every subresource. The catch worth knowing: deferred and parser-blocking scripts wait on stylesheets, so on a real page a slow stylesheet does delay DOMContentLoaded even though it does not wait for images or iframes.',
    sources: ['GreatFrontEnd quiz', 'Glassdoor'],
    frequency: 'very-high',
  },
  {
    id: 'trivia-script-async-defer',
    round: 'karat-trivia',
    prompt: 'script vs script async vs script defer?',
    answer:
      'Plain blocks parsing while it downloads and executes. async downloads in parallel and runs as soon as it arrives, out of order. defer downloads in parallel and runs in document order just before DOMContentLoaded — the default choice for app code.',
    sources: ['Glassdoor ×3'],
    frequency: 'high',
  },
  {
    id: 'trivia-event-loop',
    round: 'karat-trivia',
    prompt: 'What does this log? setTimeout(() => log(1), 0); Promise.resolve().then(() => log(2)); log(3);',
    answer:
      '3, 2, 1. Synchronous code first, then the microtask queue (promise callbacks) drains completely, then the next macrotask (timers). This is also the answer to "explain the event loop".',
    sources: ['Glassdoor ×4', 'FrontendLead'],
    frequency: 'very-high',
  },
  {
    id: 'trivia-closure',
    round: 'karat-trivia',
    prompt: 'Nested-function scope question: what is the value of x here, and why? (closures and hoisting)',
    answer:
      'A closure captures the variable, not its value at creation — the classic var-in-a-loop prints the final value while let creates a binding per iteration. Function declarations hoist entirely; function expressions hoist only the variable.',
    sources: ['FrontendLead 2516', 'Glassdoor ×3'],
    frequency: 'high',
  },
  {
    id: 'trivia-call-apply-bind',
    round: 'karat-trivia',
    prompt: 'Difference between call, apply and bind?',
    answer:
      'call and apply invoke immediately (arguments listed vs as an array); bind returns a new function with `this` and any leading arguments fixed, and is the only one of the three that does not call anything.',
    sources: ['GreatFrontEnd quiz', 'Glassdoor ×2'],
    frequency: 'high',
  },
  {
    id: 'trivia-this',
    round: 'karat-trivia',
    prompt: 'How is `this` determined? And what is the prototype chain?',
    answer:
      '`this` is set by the call site: method call → the object, plain call → undefined in strict mode, new → the instance, arrow functions → the enclosing scope, permanently. Property lookup walks the prototype chain until Object.prototype, then undefined.',
    sources: ['Glassdoor ×3'],
    frequency: 'high',
  },
  {
    id: 'trivia-promises-callbacks',
    round: 'karat-trivia',
    prompt: 'Promises versus callbacks?',
    answer:
      'Promises are first-class values, so they compose (all / any / race), have one error channel, and cannot call you twice. Callbacks nest, need error-first conventions by hand, and can fire zero or many times.',
    sources: ['GreatFrontEnd quiz', 'Glassdoor'],
    frequency: 'high',
  },
  {
    id: 'trivia-null-undefined',
    round: 'karat-trivia',
    prompt: 'undefined vs null? And for-in vs for-of vs forEach?',
    answer:
      'undefined is "never assigned", null is "assigned nothing"; typeof null is "object" (a historical bug). for-in walks enumerable string keys including inherited ones; for-of walks iterable values and supports break/await; forEach cannot break.',
    sources: ['Glassdoor ×2'],
    frequency: 'medium',
  },
  {
    id: 'trivia-http-304',
    round: 'karat-trivia',
    prompt: 'Does an HTTP 304 response have a body? And what is the difference between bandwidth and latency?',
    answer:
      'No body: 304 means "your cached copy is still valid", validated by ETag or Last-Modified, and the client reuses what it has. Bandwidth is how much fits through the pipe; latency is how long the first byte takes — more bandwidth does not fix a slow round trip.',
    sources: ['Glassdoor ×2'],
    frequency: 'medium',
  },
  {
    id: 'trivia-strict-mode',
    round: 'karat-trivia',
    prompt: 'What does strict mode change? And generators — what are they for?',
    answer:
      'Strict mode removes implicit globals, makes silent assignment failures throw, forbids duplicate parameters and octal literals, and sets `this` to undefined in plain calls. Generators pause and resume, which makes them useful for lazy sequences and hand-rolled async flows.',
    sources: ['Glassdoor', 'Frontend Interview Handbook'],
    frequency: 'medium',
  },
  {
    id: 'trivia-perf',
    round: 'karat-trivia',
    prompt:
      'How would you improve web performance? What happens when a page is heavy? How do you speed up first paint, or optimise a large React app?',
    answer:
      'Measure first (Core Web Vitals: LCP, INP, CLS). Then: ship less JavaScript (split, defer, tree-shake), stream HTML, preconnect and preload the critical path, size images and reserve space, cache immutably with hashed assets. In React: memoise the expensive subtree, virtualise long lists, move state down, and keep context values stable.',
    sources: ['Glassdoor ×5', 'FrontendLead'],
    frequency: 'very-high',
  },
  {
    id: 'trivia-browser',
    round: 'karat-trivia',
    prompt: 'How do browsers work? And where should validation live, frontend or backend?',
    answer:
      'Parse HTML into the DOM and CSS into the CSSOM, build the render tree, layout, paint, composite; JavaScript blocks parsing unless deferred. Validation belongs in both: the client for immediate feedback, the server because the client is attacker-controlled.',
    sources: ['Glassdoor ×2'],
    frequency: 'medium',
  },

  // ───────────────────────── Karat 20-minute design ─────────────────────────
  {
    id: 'karat-sd-comment',
    round: 'karat-sd',
    prompt: 'Walk through what happens when a user posts a comment, from the UI to the backend.',
    answer:
      'Optimistic render with a client id → POST /comments → server validates, persists, returns the canonical row → client reconciles by id. Cover idempotency (a retry must not double-post), the failure path, and how other viewers find out (poll, SSE or websocket).',
    sources: ['Glassdoor (Karat SD)'],
    projectId: 'jira-issue-view',
    frequency: 'high',
  },
  {
    id: 'karat-sd-login',
    round: 'karat-sd',
    prompt: 'Explain what happens after a user presses Login (also asked as "what happens after you press Enter on a URL").',
    answer:
      'DNS → TCP → TLS handshake → HTTP request → server validates credentials → session cookie (HttpOnly, Secure, SameSite) or token → redirect → the app loads and fetches the session. Mention rate limiting, MFA and where the token is stored (not localStorage if XSS is a concern).',
    sources: ['Glassdoor ×2'],
    frequency: 'high',
  },
  {
    id: 'karat-sd-upload',
    round: 'karat-sd',
    prompt: 'A user uploads a profile picture that ends up in S3. Design the flow.',
    answer:
      'Client asks the API for a pre-signed URL, uploads directly to S3 (the bytes never touch your server), then tells the API the key. Validate type and size on both ends, strip EXIF, generate thumbnails asynchronously, and serve through a CDN with a cache-busting key.',
    sources: ['Glassdoor (Karat SD)'],
    frequency: 'medium',
  },
  {
    id: 'karat-sd-rideshare',
    round: 'karat-sd',
    prompt: 'Design the flow for a rideshare app from the UI down to the backend.',
    answer:
      'Location stream from the device, a matching service, and a websocket for driver position; the client renders an optimistic "searching" state, reconciles on assignment, and degrades to polling. Talk about update frequency versus battery, and what the UI does when the connection drops.',
    sources: ['Glassdoor (Karat SD)'],
    frequency: 'medium',
  },
  {
    id: 'karat-sd-tinyurl',
    round: 'karat-sd',
    prompt: 'A user types a long URL and presses Enter in a URL shortener. What happens?',
    answer:
      'Validate and normalise, generate a short code (base62 of a counter, or a hash with collision checks), store the mapping, return the short URL. Redirect with 301 for permanence or 302 to keep counting clicks — and say which you picked and why.',
    sources: ['Glassdoor (Karat SD)'],
    projectId: 'url-shortener',
    frequency: 'medium',
  },
  {
    id: 'karat-sd-misc',
    round: 'karat-sd',
    prompt:
      'Other reported 20-minute prompts: checkout experience; Facebook friend counts per post; a round-robin load-balancer problem for a Google-Doc-style service; consistency trade-offs; an e-sign service losing notifications; flaws in a delivery app\'s architecture.',
    answer:
      'These are conversation prompts, not designs: state the requirement, name one bottleneck, propose a mechanism, then say its cost. The graded behaviour is asking what the constraint is before proposing anything.',
    sources: ['Glassdoor (Karat SD) ×6'],
    frequency: 'medium',
  },

  // ───────────────────────── Frontend system design ─────────────────────────
  {
    id: 'sd-jira-board',
    round: 'system-design',
    prompt:
      'Design a board like Jira — initially for one user, then for a team. Follow-ups: data model, request/response payloads, state management with normalisation, thousands or millions of tickets, and how you would measure performance.',
    answer:
      'Normalised store (issues by id, columns holding id arrays, column order); moves sent as "rank X after Y in column Z", never an index; optimistic with rollback; websocket events replayed through the same action. Scale: a board shows a sprint, the backlog virtualises and paginates. Measure with marks around first paint, frame time per drag and INP.',
    sources: ['LeetCode ×3', 'Glassdoor ×5', 'LearnersBucket (Trello)'],
    projectId: 'jira-board',
    frequency: 'very-high',
  },
  {
    id: 'sd-sprint-dashboard',
    round: 'system-design',
    prompt:
      'Design a dynamic sprint dashboard where users can add columns (Backlog, Scheduled, In Progress…) each holding tasks or stories. Focus on reusable components and versioning.',
    answer:
      'Columns are data, not code: a config payload drives them, so adding one is a row not a release. Presentational column/card components with the board owning state; version the config schema (and migrate on read) rather than versioning components.',
    sources: ['LeetCode 5857882'],
    projectId: 'jira-board',
    frequency: 'high',
  },
  {
    id: 'sd-google-docs',
    round: 'system-design',
    prompt: 'Design Google Docs / a collaborative editor (also asked as a collaborative code editor).',
    answer:
      'Document as a tree of nodes, edits as operations, not snapshots. OT needs a server to order and transform operations; CRDTs make concurrent operations commute at the cost of metadata. Cover presence, cursors, offline queue, per-user undo (invert your own op, transformed against everything since) and conflict-free reconnect.',
    sources: ['GreatFrontEnd (SD)', 'LeetCode (P60)', 'LeetCode 6697470'],
    projectId: 'undo-redo-editor',
    frequency: 'high',
  },
  {
    id: 'sd-confluence-editor',
    round: 'system-design',
    prompt: 'Design the Confluence editor / page surface (GreatFrontEnd topic list).',
    answer:
      'Document model first (nodes + marks), a plugin registry for node types, autosave with debounce and a dirty flag, comment anchors that survive edits (positions mapped through each transaction), and a renderer that degrades gracefully on unknown node types.',
    sources: ['GreatFrontEnd (topics)'],
    projectId: 'document-renderer',
    frequency: 'medium',
  },
  {
    id: 'sd-doc-list',
    round: 'system-design',
    prompt: 'Design a webpage that shows a very large number of documents as a list (also: "design a list component" for the Trello team).',
    answer:
      'Cursor pagination, windowed rendering with stable row heights, a skeleton that matches the row box, server-side sort and filter with the query in the URL, and a cache keyed by that query so back-navigation is instant.',
    sources: ['Glassdoor ×2'],
    projectId: 'data-table',
    frequency: 'high',
  },
  {
    id: 'sd-notifications',
    round: 'system-design',
    prompt: 'Design a notifications / activity surface.',
    answer:
      'Feed paginated by cursor, unread count from the server (never derived client-side), delivery by websocket with polling fallback, dedupe by notification id, mark-as-read optimistic and idempotent, and grouping rules applied server-side so every client agrees.',
    sources: ['FrontendLead', 'GreatFrontEnd (topics)'],
    frequency: 'medium',
  },
  {
    id: 'sd-cookie-consent',
    round: 'system-design',
    prompt: 'Design a cookie consent surface across products.',
    answer:
      'Consent state in a first-party cookie readable by every surface, a versioned policy id so a changed policy re-prompts, scripts loaded only after the matching category is granted, and an audit trail of who consented to what and when.',
    sources: ['Frontend Interview Handbook', 'GreatFrontEnd (topics)'],
    projectId: 'karat-html-css',
    frequency: 'medium',
  },
  {
    id: 'sd-perf-utility',
    round: 'system-design',
    prompt: 'Design a performance benchmarking utility (as a design question rather than a coding one).',
    answer:
      'API: measure(fn, options) and compare(candidates). Warm-up, calibrated batches, median and p95, outlier handling, async support, and a reporting format that is comparable across machines — plus what it must not claim (micro-benchmarks do not predict page performance).',
    sources: ['Frontend Interview Handbook'],
    projectId: 'perf-benchmark',
    frequency: 'medium',
  },
  {
    id: 'sd-website-builder',
    round: 'system-design',
    prompt: 'Design a drag-and-drop website builder.',
    answer:
      'Serialisable component tree, a registry mapping type to renderer and editor, drop targets computed from geometry, undo/redo over the tree, and a publish step that renders the same tree server-side. Keyboard reordering is the accessibility answer.',
    sources: ['FrontendLead 2104, 2110'],
    frequency: 'medium',
  },
  {
    id: 'sd-tags',
    round: 'system-design',
    prompt: 'Design a tagging system (tags management), asked in FE loops at P50.',
    answer:
      'Tags normalised by id with a many-to-many join, typeahead over a cached tag list, create-on-enter with duplicate detection by normalised name, and permissions on who may create global tags versus personal ones.',
    sources: ['Glassdoor'],
    frequency: 'low',
  },
  {
    id: 'sd-tictactoe-api',
    round: 'system-design',
    prompt: 'Phone screen: design the API and data model for a tic-tac-toe web app.',
    answer:
      'Game resource with board state, turn, players and status; moves as POST /games/:id/moves with the cell and an expected move number for idempotency; server validates legality and detects the win. Realtime via websocket, or polling for a tiny app.',
    sources: ['LeetCode 3643520'],
    projectId: 'tic-tac-toe',
    frequency: 'medium',
  },

  // ───────────────────────── React follow-ups ─────────────────────────
  {
    id: 'react-state-shape',
    round: 'react',
    prompt: 'Why normalise state? How would you shape it for this board / list?',
    answer:
      'Entities by id plus arrays of ids: one source of truth per entity, O(1) updates, no duplicate copies to drift, and untouched entities keep their identity so React skips them. Nested arrays of full objects is the shape that gets people rejected.',
    sources: ['LearnersBucket (Trello)', 'Glassdoor ×3'],
    projectId: 'jira-board',
    frequency: 'very-high',
  },
  {
    id: 'react-rerender',
    round: 'react',
    prompt: 'This component re-renders too often. What do you do?',
    answer:
      'Measure with the Profiler first. Then: move state down, split context, memo the expensive child with stable props (useCallback/useMemo where identity matters), key lists by stable ids, and virtualise long lists. Do not sprinkle memo everywhere — it has its own cost.',
    sources: ['Glassdoor ×3', 'GreatFrontEnd (React follow-ups)'],
    frequency: 'high',
  },
  {
    id: 'react-effects',
    round: 'react',
    prompt: 'How do you avoid race conditions with data fetching in useEffect?',
    answer:
      'Both halves: an AbortController to cancel the request, and an ignore flag set in the cleanup to drop a response that already resolved. Aborting a settled promise does nothing, so the abort alone still leaves the window where the response landed a microtask before the cleanup ran. React\'s own docs use the ignore flag for exactly this.',
    sources: ['Glassdoor ×2'],
    projectId: 'data-table',
    frequency: 'high',
  },
  {
    id: 'react-testing',
    round: 'react',
    prompt: 'How would you test what you just built?',
    answer:
      'Pure logic with plain unit tests (that is why the utils have no React import), the component with Testing Library asserting behaviour not markup, and one end-to-end test for the interaction that cannot be faked — drag, keyboard move, or a failed save.',
    sources: ['Glassdoor ×3'],
    frequency: 'high',
  },
  {
    id: 'react-a11y',
    round: 'react',
    prompt: 'How would you make this accessible?',
    answer:
      'Semantic elements first, then the ARIA pattern for the widget (tabs, tree, listbox), roving tabindex for composite widgets, a live region for anything that changes without focus, visible focus, and never colour alone for state.',
    sources: ['GreatFrontEnd (File Explorer II)', 'Glassdoor ×2'],
    projectId: 'page-tree',
    frequency: 'high',
  },

  // ───────────────────────── AI-assisted round ─────────────────────────
  {
    id: 'ai-round',
    round: 'ai-round',
    prompt:
      'New 2026 format: an unfamiliar repository in HackerRank with a coding agent available. Debug failing tests or implement a scoped feature, using the agent, while explaining your reasoning.',
    answer:
      'Orient before prompting: read the failing test, find the module it exercises, and state the hypothesis out loud. Use the agent for mechanical work and verification, review every diff it produces, and run the tests yourself. What is graded is judgement about the agent\'s output, not typing speed.',
    sources: ['LeetCode 8522673', 'Glassdoor p7', 'PracHub'],
    frequency: 'high',
  },

  // ───────────────────────── Values & management ─────────────────────────
  {
    id: 'values-list',
    round: 'values',
    prompt:
      'Values interview, built on Atlassian\'s five values: Be the change you seek · Play, as a team · Don\'t #@!% the customer · Open company, no bullshit · Build with heart and balance.',
    answer:
      'Have one specific story per value, in STAR form, with a number in the result. Reusing a story across two values is fine if the angle differs; inventing a story is the common failure — they probe for details.',
    sources: ['atlassian.com/company/values (the five values)', 'Atlassian Front-end Interview Guide (tells candidates to research the culture)'],
    frequency: 'very-high',
  },
  {
    id: 'values-reported',
    round: 'values',
    prompt:
      'Reported prompts: a disagreement with a coworker; how you took negative feedback; putting team goals over personal ones; shipping something broken; missing a deadline; manager and PM wanting different things; helping someone improve; your most complex project; resolving a conflict.',
    answer:
      'Each maps to a value: conflict → Play as a team; broken release → Don\'t #@!% the customer; feedback → Open company, no bullshit. Say what you would do differently — the reflection is the part being scored.',
    sources: ['Glassdoor ×9', 'LeetCode Discuss'],
    frequency: 'very-high',
  },
  {
    id: 'values-management',
    round: 'values',
    prompt:
      'Management/lead areas from the official guide: driving outcomes across the SDLC, lessons learnt, managing conflict, taking initiative and inspiring others.',
    answer:
      'For senior and lead roles, the stories need scope: who else was involved, what you changed about how the team worked, and what stayed changed after you left the project.',
    sources: ['Atlassian Front-end Interview Guide (official)'],
    frequency: 'high',
  },
];

export const PROJECT_LINKED = QUESTIONS.filter((question) => question.projectId).length;
