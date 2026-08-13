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
4. **Publish the cheat-sheet artifact** (below) and set the entry's `guideUrl` to its URL.

Listing page and route pick the project up automatically. A project is not finished until
`guideUrl` is filled in — the ↗ icon on the listing card and the project header only render when
it is set, so a missing artifact is visible on the home page.

## Cheat-sheet artifact standard

Every project has a published Artifact — the **one-screen counterpart to `guide.md`**, titled
`<Project Title> — Machine Coding Cheat Sheet`. The guide is what you read the night before; the
sheet is what you glance at during the interview. It never introduces a fact the guide does not
have.

Publish it with the `Artifact` tool from a self-contained HTML file (no `<!doctype>`/`<html>`/
`<head>`/`<body>` — write `<title>`, `<style>`, then the markup), and reuse the **existing sheet's
CSS verbatim**: the dark/light token block (`--accent --bad --bg --panel --panel-head --line
--text --muted --code`, redefined under both `@media (prefers-color-scheme: dark|light)` and
`:root[data-theme="dark"|"light"]`), `font-size: clamp(8.5px, min(1.39vh, 0.868vw), 12.5px)`,
`height: auto` (never `100dvh` — the embed sizes itself from `scrollHeight` and clips), and the
`.sheet` / `.grid` / `.block` / `.body` structure. Copy it from any existing sheet rather than
re-deriving it.

Layout: a 12-column `grid-template-areas` map of `.block` sections, each with a numbered mono
header (`<span class="idx">01</span>`) and an optional right-aligned `.note`. Blocks stack to one
column under 1000px. The standard blocks, in order:

| Block | Contents |
| --- | --- |
| Clarify | 5–7 requirement questions as `.q` / `.a` pairs |
| Model | the JSON record in a `<pre>`, plus the two or three notes that justify its shape |
| State | the `useState` / `useMemo` / `useRef` list with the comment on each |
| Traps | the graded one-liners — `<b>` the mono token, then why it bites |
| Core | the pure functions the question is actually about |
| Ladder | a `<table>` with `tr.dead` for the rejected rung, `tr.ship` for the one to build, then a `.verdict` paragraph explaining what *changed*, not just what is faster. A project with two real ladders gets two blocks |
| Hook | the one function that wires state to the pure core |
| Build order | `<ol class="steps">` plus a `.verdict` naming where it is safe to stop |
| Demo + cross-Q | demo beats, then the interviewer questions as `.q` / `.a` pairs |
| Full code | the whole project as one file, collapsed, with a copy button — see below |

### The full-code block (last block on every sheet)

The sheet ends with the complete single-file source, so the page is both the glance
reference and the thing you paste into the sandbox. Rules:

- **Content is §9/§10 of `guide.md` verbatim** — the single-file `App.jsx`. The sheet never
  holds a second copy of the code that can drift; regenerate the block from the guide.
- **Its own full-width grid row.** Append `"fullcode ×12"` to `grid-template-areas` and one
  more `auto` to `grid-template-rows`, then `<section class="block" style="--area: fullcode">`
  as the last block, numbered after the existing ones.
- **Collapsed by default** — the code lives in `<details class="fc"><summary>show App.jsx</summary>`
  so the sheet still reads as one screen. The `.note` carries the line count.
- **Copy button in the header**, so the file can be copied without expanding it:
  `<button class="copy" data-copy="fc-<slug>">` with an inline SVG copy glyph and a
  `.copy__label` that flips to `COPIED` for 1.5s. One `<script>` at the end of the file wires
  every `.copy` on the page: `navigator.clipboard.writeText`, falling back to a hidden
  `<textarea>` + `document.execCommand('copy')` because the async clipboard API is blocked in
  some embedded frames.
- **Sections are separated by a file banner comment naming the file the block becomes** in the
  repo — `// utils/rbac.utils.js — pure`, `// hooks/use-flag-console.js`, `// App.jsx` — one
  banner per real file, so a generic `constants` / `hooks` / `components` banner in the guide is
  expanded into the concrete file names (`hooks/use-debounced-value.js`,
  `components/feedback-row.jsx`, …). Banners are wrapped in `<span class="f">` and drawn in
  `--accent`; they are the map from the one file back onto the project folder.

Pass `favicon` (one emoji, stable across redeploys) and a one-sentence `description`. To revise a
published sheet, republish the same file path in the same conversation, or pass its `url` from a
new one — never mint a second URL for a project that already has one.

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
