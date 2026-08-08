# Execute — autonomous build handoff

You are building the product described in `README.md`. Implement it across multiple
sessions **without waiting for user prompts between steps**. Everything you need is locked
in `README.md` and the `EPIC-*.md` docs — do not re-litigate decisions already made there.

## Before the first build session — pre-build audit gate

Do not write code until the docs have passed a pre-build audit. If `docs/product/v1.2/AUDIT.md`
does not exist or is stale, run the kimchi Auditor in **pre-build mode** over these docs (it
re-checks every persona's locked decisions for contradictions, flawed calls, and gaps
between personas — the cheapest place to catch a bad architecture is before it's built).
Resolve every **Revise** finding — edit the affected EPIC doc, then continue. This gate
exists because a flawed decision caught here is a doc edit; caught after building, it's a
rewrite.

## Each session, do this

1. Read `README.md` (product + net tracker) and the relevant `EPIC-<n>-<slug>.md`.
2. Find the next unblocked story by **priority order** in the net tracker (Status = Not
   started, dependencies Done). **EPIC 3's three stories are Blocked — skip them entirely
   until a separate Security-master/DevOps session unblocks them.** That is not this
   session's job.
3. Set its Status to **In progress** in both the epic tracker and the net tracker.
4. Build it to the story's **acceptance** criteria, honoring the **locked decisions** (tech
   stack, architecture, design, legal/compliance) — these are fixed; build to them.
5. Verify it works (run it / test it — observe real behavior, not just types). This app
   has no test suite (v1.1 precedent); verify live against the dev server, same as
   RESTRUCTURE.md's approach — screenshot/interact, don't just typecheck.
6. Update both trackers: Status → **Done** (or **Blocked** + reason), fill Session + Notes.
7. Commit with a conventional-commit message referencing the epic + story.
8. If session budget remains, go to step 2 for the next story. Otherwise stop cleanly —
   the trackers are the resume point for the next session.

## Rules

- **Build order = priority order** across the net tracker, skipping Blocked rows. Don't
  cherry-pick.
- **Follow the locked project structure** in `README.md` — `src/components/`,
  `src/hooks/`, `src/lib/`, camelCase naming. Never dump files into `src/` root or invent
  a new directory; if a file has no obvious home, the story is Blocked on a structure gap,
  not improvised around.
- **Locked decisions are locked.** No new dependency for the walkthrough (hand-rolled,
  per Architect). Demo groove content must be original (per Legal-bro) — do not substitute
  a transcribed real song under time pressure. `commitPatternEdit` stays the sole pattern
  write path — do not add a bypass for the demo loader's convenience.
- **EPIC 3 is off-limits until the deferred session runs.** Do not pick a host, do not
  touch the import/security boundary, do not add an analytics tool — even if it seems
  small enough to just do. That decision belongs to a session this doc explicitly is not.
- **Resume from trackers.** The only source of truth for "what's done" is the net tracker
  in `README.md`. Keep it honest and current every session.
- **Ship the lazy version that meets acceptance** (Tech-bro's build plan in each EPIC doc),
  but never skip the accessibility/reduced-motion requirements Design-girl locked, or the
  legal/provenance requirements Legal-bro locked.

## Build order

1. EPIC-1 · Story 1 — Rename to Beats Drum Machine Coach
2. EPIC-2 · Story 2 — Swap CC0 samples into `public/rok/`, delete dead files (Story 1 is
   already Done — sourcing/staging complete, see `public/rok-cc0/CREDITS.md`)
3. EPIC-4 · Story 1 — Add Stop/Continue-editing control
4. EPIC-5 · Story 1 — Demo-mode controller
5. EPIC-5 · Story 2 — Spotlight/backdrop tour UI
6. EPIC-5 · Story 3 — First-visit trigger + retrigger

*(EPIC-3's three stories resume this sequence at their locked priority slots — 4, 5, 6 in
the net tracker — once the deferred Security-master/DevOps session unblocks them. Until
then, this is the real build order.)*
