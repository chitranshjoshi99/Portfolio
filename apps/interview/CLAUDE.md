# Frontend Interview Prep Workspace

React 19 + TypeScript + Vite. Machine-coding practice projects, each listed on a grid home page.

## Conventions

- File names: **kebab-case** everywhere (`file-explorer-page.tsx`, `use-file-tree.ts`).
- `.tsx` files are **presentational only** — render UI, receive props, wire handlers. No business logic.
- All logic lives in custom hooks in `.ts` files (`use-*.ts`). Pure helpers go in `*.utils.ts`.
- Grouped by feature/project. **Projects never share code with each other** — a project folder
  has to stand alone as an interview answer, so a hook two projects both need (e.g.
  `use-debounced-value`) is duplicated, not hoisted. Only app-level code (registry, routing,
  listing shell) is shared. Mark the copy with a `ponytail:` comment.
- Plain CSS per feature, imported by the page component. Global tokens in `src/index.css`.

## Structure

```
src/
  main.tsx
  app/app.tsx                      # router
  features/
    project-list/                  # grid listing page
    project-page/                  # /projects/:projectId shell
  projects/
    project.types.ts
    project-registry.ts            # single source of truth: listing + routes
    <project-slug>/                # one folder per machine-coding project
      index.tsx                    # entry, default export — the only entry point
      <project-slug>.types.ts
      <project-slug>.css
      guide.md                     # how to build it in an interview
      components/                  # .tsx, render only
      hooks/                       # use-*.ts, all state and logic
      utils/                       # pure functions, no React import
      constants/                   # strings, icons, config maps
```

## Adding a project

1. Create `src/projects/<slug>/` with the folder split above and a default-exported `index.tsx`.
2. Add an entry to `projects` in `src/projects/project-registry.ts` (lazy import).
3. Write `guide.md` in the project folder using the guide standard below.

Listing page and route pick the project up automatically.

## Project guide standard

Every `src/projects/<slug>/guide.md` is a **script for building that project live in an interview**,
in plain JavaScript, in a fresh CodeSandbox. It tells the candidate what to ask, what to say, what to
type, and where to stop. It is not API reference, a code dump, or a retrospective.

Required structure:

1. **Title, outcome, minute budget** — one sentence on the finished feature, a realistic timebox, and
   a table splitting that timebox across phases.
2. **Sandbox setup** — start in one file, split later; show the target project-local file tree and
   the one sentence that states the boundary (utils pure, hooks own state and effects, TSX renders).
3. **Requirement gathering** — 5–7 questions to ask the interviewer, each with why it changes the
   code and the default assumption if unanswered. At least one question must set up the later
   algorithm discussion (dataset size, secrecy, match type). End with the plan stated in one breath.
4. **HLD** — an ASCII diagram of data flow and boundaries, followed by three or four claims about the
   design worth saying out loud.
5. **LLD** — the state list with a comment on each, the refs and why they are refs, and the pure
   function signatures written before implementation.
6. **Data model** — the JSON, plus the alternative shape and a comparison table when the choice is a
   real fork (nested vs normalised, offset vs cursor). Justify each field that has a non-obvious
   type.
7. **Iterative build passes** — numbered, each with what to build and what to demonstrate before
   moving on. Plain JavaScript snippets only; no TypeScript in snippets.
8. **The algorithm ladder** — the heart of the guide, placed inside the pass where it belongs. Walk
   V0 brute force → V1 the correct simple version → V2 the better traversal/structure → V3 the
   precomputed/indexed/memoised version. Each rung needs its code, its time/space complexity in terms
   of named variables, and the specific failure mode that motivates the next rung. Close with a
   comparison table, a "why the best one wins" paragraph explaining it in terms of what actually
   changed, and an explicit statement of **which rung to ship in a 45-minute interview** and why.
   Never claim an optimisation is dynamic programming unless it genuinely is one (`f(node) =
   g(node, f(children))`, overlapping subproblems); precomputed indexes are memoisation — say so.
9. **The single-file version** — one complete, correct, copy-pasteable `App.jsx` containing the whole
   project in plain JavaScript: constants, pure utils, fake API, hooks and components, separated by
   comment banners naming the file each block would become. This is what actually gets typed in an
   interview after the thought process has been explained. Assume the CSS classes already exist —
   never include styles. Follow it with the order to build it in and the one or two lines to narrate
   while typing because they are what the question is really testing.
10. **Verification** — the local utility check command, then a numbered demo script in the order to
    perform it.
10. **Cross-questions and answers** — the questions an interviewer actually asks, answered concretely
    for this project: trade-offs, scale, concurrency, failure modes, accessibility, security, and
    what changes with a real backend.

Guides must be accurate to the files that exist in the project, and every command in them must
actually run. Prefer direct language, tables over prose for comparisons, and complexity stated with
real numbers where they are illuminating. Every snippet must be pasteable into a `.jsx` sandbox file.
Avoid filler, motivational prose, unscoped “senior” claims, invented commands, and interviewer
role-play dialogue. These guides are long by design — completeness over brevity.

## Commands

```bash
npm run dev
npm run build   # tsc -b && vite build — this is the gate
npm run lint    # oxlint
```
