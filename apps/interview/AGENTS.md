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
3. Write `guide.md` in the project folder: clarifying questions, data-model decision and its
   trade-offs, build order with timings, the gotchas an interviewer probes for, a self-review
   checklist, and the extensions they ask for next.

Listing page and route pick the project up automatically.

## Commands

```bash
npm run dev
npm run build   # tsc -b && vite build — this is the gate
npm run lint    # oxlint
```
