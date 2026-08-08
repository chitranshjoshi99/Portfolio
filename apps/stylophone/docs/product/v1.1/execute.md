# Execute — v1.1 autonomous build handoff

You are implementing v1.1 described in `README.md` and `EPIC-*.md`. Work across sessions without waiting for new prompts. Locked decisions are fixed; do not revive deferred scope.

## Pre-build audit gate

`AUDIT.md` exists and is the pre-build audit for these docs. It contains no unresolved Revise finding. Read it before implementation; if a new contradiction appears, mark the relevant tracker row Blocked and document it rather than silently changing architecture.

## Every session

1. Read `README.md`, `AUDIT.md`, and the EPIC for the next unblocked priority.
2. Set that story to **In progress** in its EPIC tracker and the README net tracker.
3. Implement only the story acceptance criteria, preserving earlier behavior unless the story deliberately replaces it.
4. Run `npm run build`; run/extend pure self-checks where the story changes pattern, lesson, teaching, transport, or audio logic.
5. Browser-test the relevant interaction on a clean reload. For audio, document the observable trigger/route contract and perform a real audible check when an output device is available.
6. Update both trackers to Done or Blocked with session notes, then commit a conventional message referencing epic/story.

## Non-negotiables

- Build order is the README priority order: 1 → 12.
- `STEPS = 64` has one source. Do not leave 32-step assumptions in transport, grid, parser, storage, or audio.
- `schemaVersion: 3` is v1.1-only. Reject old documents; do not migrate them.
- No server, sidecar, upload/reduction UI, library catalogue, free-float bass, hardware I/O, scoring, packaging, or mobile work.
- Import validates before any state change; destructive actions respect dirty confirmation.
- Guidance is derived from pattern and never verifies hardware performance. Any edit resets it.
- Keep all 64 grid columns visible at supported desktop width; do not solve density by hiding loop context.

## Build order

1. EPIC 1 · Story 1 — V1.1 pattern schema and 64-step clock
2. EPIC 1 · Story 2 — 64-step grid and snapped bass holds
3. EPIC 1 · Story 3 — Grid/pad/audio translation and independent banks
4. EPIC 2 · Story 1 — One local draft and safe reset/new flow
5. EPIC 2 · Story 2 — Strict v1.1 JSON import/export
6. EPIC 2 · Story 3 — Remove generator from active surface
7. EPIC 3 · Story 1 — Derived row-by-row guide
8. EPIC 3 · Story 2 — Next, restart, redo, and restart-on-edit
9. EPIC 3 · Story 3 — Guided visual/audio hierarchy
10. EPIC 4 · Story 1 — 64-step grid-first desktop layout
11. EPIC 4 · Story 2 — Mode-aware compact controls and REC states
12. EPIC 4 · Story 3 — Accessibility and real desktop UAT
