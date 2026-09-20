# Future task: serve the guides from the interview app

**Status:** not started. **Estimate:** about 1 hour for the middle path, 2 to 3 hours for the full version.

## Why

Every project's cheat sheet is a claude.ai artifact, linked through `guideUrl` in
`src/projects/project-registry.ts`. That has three weak spots:

- **Account dependency.** If an artifact is deleted or unshared, or the owning account changes,
  the link dies. The 2026-09-20 republish (see `GUIDE_URLS.backup.md`) was needed because five
  artifacts sat under a different account.
- **Two copies of each guide.** `guide.md` in the repo and the artifact are separate files. The
  artifact is hand-converted, not generated from `guide.md`, so they can drift.
- **Manual republish.** Any fix means editing markdown, then rebuilding and republishing an artifact.

## Middle path (do this first, about 1 hour)

Render `guide.md` inside the app. Keep the one-screen cheat sheets as artifacts.

1. Render each `src/projects/<slug>/guide.md` at a new route, for example `/guides/:projectId`.
   Use `react-markdown` + `remark-gfm`, or Vite's MDX plugin (the portfolio already uses one).
2. Highlight code with highlight.js or Shiki. Reuse the token palette from the sheets (keyword
   `#7b4bb8` / `#b79cf0`, string `#2f7a47` / `#8fc9a0`, number `#96610f` / `#e2b872`, function
   `#1f5f9e` / `#7db4e8`, property `#1a6f78` / `#7fc8d0`; light / dark) so the two look alike.
3. Lazy-load the guide route so the markdown and highlighter stay off the listing page bundle.
4. Add heading anchors and a table of contents. The guides are long (about 15.9k lines across 22
   files), so they are unusable without navigation.
5. In `project.types.ts` add an optional `guidePath` next to `guideUrl`. `GuideLink` prefers
   `guidePath` (an in-app route) and falls back to `guideUrl`, so the cheat sheet link still works.

The guides are the content that cannot be recreated cheaply. The sheets can be regenerated at any
time, so hosting the guides first removes the main risk.

## Full version (2 to 3 hours)

Also rebuild the cheat sheets as React pages, then drop `guideUrl` entirely. That is the bulk of the
extra time: the sheets are hand-designed 12-column grids, not a rendering of `guide.md`, so they
cannot simply be generated from it.

## Gains

- One source of truth that deploys with the app.
- No hosting risk, because it ships with the existing Vercel deploy.
- Guide edits go live in a normal commit, with no republish step.
- Full markdown, working anchors, and the app's own light and dark theme.

## Costs

- A markdown and highlighting dependency in the interview bundle (mitigated by lazy loading).
- The sheets stay as artifacts under the middle path.

## Reusable pieces already exist

The scripts that produced the highlighted sheets are in the 2026-09-20 session scratchpad, not the
repo: `conv.py` (artifact HTML to highlighted HTML) and `ff-template.html` (the shared CSS, token
palette and highlight script). If the sheets need regenerating, recover them from that session or
rebuild from the palette above.

## Conventions to keep

- Kebab-case file names, `.tsx` presentational only, logic in `use-*.ts` hooks (see `CLAUDE.md`).
- Update `CLAUDE.md` (the "Adding a project" and "Cheat-sheet artifact standard" sections) when
  this lands, since step 4 there currently says to publish an artifact and set `guideUrl`.
