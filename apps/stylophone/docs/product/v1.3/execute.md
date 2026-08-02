# Execute — autonomous build handoff (v1.3)

You are building the v1.3 refinement cycle described in `README.md` (this folder,
`docs/product/v1.3/`). Implement it across multiple sessions **without waiting for user
prompts between steps**. Everything you need is locked in `README.md` and the `EPIC-*.md`
docs — do not re-litigate decisions already made there.

**Scope guard:** v1.3 is usability/refinement only. Do NOT touch the deferred items (target
user, TAM, launch, front door / the `stylophone-visualiser` URL, positioning) — those are a
separate session by explicit user instruction.

## Before the first build session — pre-build audit gate

Do not write code until the docs have passed a pre-build audit. If `docs/product/v1.3/AUDIT.md`
does not exist or is stale, run the kimchi Auditor in **pre-build mode** over these docs (it
re-checks every persona's locked decisions for contradictions, flawed calls, and gaps between
personas — the cheapest place to catch a bad architecture is before it's built). Resolve every
**Revise** finding — edit the affected EPIC doc — then continue. A flawed decision caught here
is a doc edit; caught after building, it's a rewrite.

## Each session, do this

1. Read `README.md` (product + net tracker) and the relevant `EPIC-<n>-<slug>.md`.
2. Find the next unblocked story by **priority order in the Build order below** (Status = Not
   started, dependencies Done). That is your task for this session.
3. Set its Status to **In progress** in both the epic tracker and the net tracker.
4. Build it to the story's **acceptance** criteria, honoring the **locked decisions** — these
   are fixed; build to them.
5. **Verify it works in the real app** — run the dev server and drive the actual flow in a
   browser (paint a run, tap in time, tap on a tablet/touch-emulated viewport), not just
   types/tests. This is a UI/interaction cycle; observe real behaviour.
6. Update both trackers: Status → **Done** (or **Blocked** + reason), fill Session + Notes.
7. Commit with a conventional-commit message referencing the epic + story
   (e.g. `feat(v1.3): drag-to-paint drums (E1.1)`).
8. If session budget remains, go to step 2. Otherwise stop cleanly — the trackers are the
   resume point.

## Rules

- **Build order = the sequence below.** Don't cherry-pick. EPIC 4 must not start before
  EPIC 2 is Done (it reuses the pipeline). EPIC 1 story 3 needs story 1 first. EPIC 3 is
  independent and may be slotted at any point as a cheap quick-win.
- **Follow the locked project structure** in `README.md`. Every new file goes where the tree
  says; new pure `lib/` helpers carry a `demo()`/assert self-check. Never dump files into
  `src/` or add a new directory. No new npm dependencies this cycle — if you think you need
  one, mark the story Blocked and note why instead.
- **Locked decisions are locked.** The audio spine (single `engine.triggerStep`, one trigger
  per (step, tick), record = persistence only) and the no-mode-switch authoring are load-
  bearing. If reality makes one impossible, mark the story **Blocked**, write why, and move on
  — don't silently swap it.
- **Resume from trackers.** The net tracker in `README.md` is the only source of truth for
  what's done. Keep it honest every session.
- **Ship the lazy version that meets acceptance**, but never skip the accessibility basics
  called out (touch targets, interaction states, hover-gating).

## Build order

1. **EPIC 1 · Story 1** — Drag-to-paint drums *(Critical; the headline pain)*
2. **EPIC 1 · Story 2** — Per-row quick-fill
3. **EPIC 1 · Story 3** — Touch scroll-claim *(needs E1.1)*
4. **EPIC 2 · Story 1** — Single-source audio + per-tick dedup *(the spine)*
5. **EPIC 2 · Story 2** — Nearest-step snap on capture
6. **EPIC 4 · Story 1** — Restore green-on-correct-hit on pad *(needs EPIC 2; find removal commit first)*
7. **EPIC 4 · Story 2** — Touch-enhance practice pad
8. **EPIC 1 · Story 4** — Duplicate bar 1→2 *(lowest priority; droppable if the cycle crowds)*

- **EPIC 3 · Story 1** — Gate hover behind `@media (hover: hover)` — independent CSS-only
  quick-win; do it whenever convenient (good warm-up before step 1, or filler between epics).
