# EPIC 1: Fast groove authoring

The app's primary action is printing grooves into a 12×64 drum grid, and today it's the
worst interaction in the product — every hit is a separate precise click on a ~24px target,
and regular patterns (4-on-the-floor = 8 identical clicks) are pure manual labour. This epic
makes authoring fast on both mouse and touch: paint runs by dragging, drop regular grooves
in one tap, and duplicate a bar. This is the cycle's headline value — it's why the builder
himself struggles to use it.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a composer, I want to drag across a drum row to paint/erase a run of steps, so I stop clicking each cell one at a time. | Critical | Medium | 1 |
| 2 | As a composer, I want one-tap per-row fills (every 2/4/8, offbeat, backbeat, clear), so regular grooves need no manual clicking. | High | Low | 2 |
| 3 | As a touch user, I want grid drags to paint instead of scrolling the page, so authoring works on a tablet at all. | High | Low | 3 |
| 4 | As a composer, I want to duplicate bar 1 into bar 2, so repeating loops take half the work. | Medium | Low | 4 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

Non-negotiable choices a future build session must not re-litigate:

- **Tech stack:** React + TypeScript + Vite, Tone.js for audio. **No new dependencies** —
  drag machinery, gestures, and fills are all native / already in-repo.
- **Project structure (locked placement):**
  - Grid interaction (paint, scroll-claim) → `src/components/StepGrid.tsx` (+ `StepGrid.css`).
  - Pure pattern mutations (fills, clear, duplicate-bar) → `src/lib/pattern.ts`.
  - Row-fill chip UI → in `StepGrid.tsx` on the existing `.step-grid__rail` row labels.
  - New pure helpers get a co-located `demo()`/assert self-check; no test framework added.
- **Architecture:** `StepGrid` stays **stateless/timerless** — playhead comes from the
  `currentStep` prop (Tone.Draw), no interval/timeout/rAF added. All grid edits flow through
  the existing `commitPatternEdit` mutator path; fills/duplicate are pure `Pattern → Pattern`.
- **Design (DG):** A1 (drag-paint) and A2 (quick-fill) are **coexistent, no mode switch** —
  a mode toggle was explicitly rejected as a cognitive tax. Direction of a paint drag is
  decided by the **first cell touched** (start empty → paint ON; start lit → erase). Single
  click still toggles one cell.
- **Reuse mandate (TB):** drum drag-paint **generalizes the pointer-drag machinery that
  already exists** for bass-length dragging in `StepGrid.tsx` (`startBassDrag` /
  `extendBassDrag` / `endBassDrag` / `cellStepAtPoint` via `elementFromPoint` +
  `setPointerCapture`). Do **not** write a new drag system.
- **Scope (AUDIT note):** this epic covers **drums authoring only**. Bass authoring is
  unchanged and intentionally out of scope — bass is monophonic and pitched (each cell carries a
  pitch), so drag-paint (binary on/off runs) and quick-fill (regular boolean patterns) don't map
  to it. The bass-length drag it already has stays as-is. Do not read bass as a missed gap.

## Execution instructions (priority order)

### 1. Drag-to-paint drums  (Priority 1)
- **Goal:** press and sweep across a drum row to fill a run of steps; sweeping over lit
  cells erases. One drag replaces many clicks. Single click still toggles one cell.
- **Data model:** `pattern.drums[padId][step]: boolean`. Mutations via existing
  `toggleDrum(p, padId, step)` / a new `setDrum(p, padId, step, on)` in `pattern.ts`
  (add `setDrum` for explicit on/off — `toggleDrum` flips, which a paint sweep must not).
- **Key decisions:**
  - Generalize the existing pointer handlers so they run in **drums mode too** (today gated
    `if (!bass) return`). On `pointerdown` over a drum cell: read that cell's current filled
    state → **paint target = !filled** → apply to the first cell → `setPointerCapture`.
  - On `pointermove`: resolve the cell under the pointer with the existing `cellStepAtPoint`;
    if it's a new cell, `setDrum(pad, step, paintTarget)`. Track the last-painted step to
    avoid redundant commits (mirror `bassDragStep` ref).
  - Suppress the trailing `onClick` toggle after a drag (reuse the `suppressBassClick`
    pattern → generalize to `suppressClick`).
  - Paint stays within the row the drag started in (drum paint is per-voice); cross-row
    painting is out of scope.
- **Acceptance:** press on an empty kick step and drag right across 8 cells → all 8 fill in
  one gesture; drag back over them → all clear; a single click on one cell still toggles just
  that cell; no stray extra toggle fires at drag end.

### 2. Per-row quick-fill  (Priority 2)
- **Goal:** each drum row exposes one-tap fills so a regular groove needs zero manual clicks.
- **Data model:** pure helpers in `pattern.ts`:
  - `fillRow(p, padId, everyN, offset=0): Pattern` — sets steps where `(step - offset) % everyN === 0`.
  - `clearRow(p, padId): Pattern`.
  - Derive named fills from these: `×2`=every2, `×4`=every4, `×8`=every8, `offbeat`=every4 offset 2, `backbeat`=steps 4,12,20,… (every8 offset 4). Confirm exact offsets against the 64-step / 16-per-bar layout at build.
- **Key decisions:** chips render on the existing `.step-grid__rail` row label (`rowLabel`),
  drums mode only (bass fills out of scope). Fills apply across **all 64 steps** (both bars).
  Each chip calls `commitPatternEdit` with the pure helper.
- **Acceptance:** on the kick row, tap `×8` → a clean four-on-the-floor appears across both
  bars in one action; `clear` empties the row; `backbeat` on snare lands on 2 & 4 of each bar.

### 3. Touch scroll-claim on grid  (Priority 3)
- **Goal:** on a touchscreen, dragging across the grid paints (story 1) instead of scrolling
  the page. Depends on story 1.
- **Key decisions:** add `touch-action: none` to the paint surface (the step cells / row
  area) in `StepGrid.css` so the browser stops claiming the drag for scroll; the existing
  Pointer Events + `setPointerCapture` then own the gesture. Keep the page scrollable
  **outside** the grid (do not put `touch-action: none` on a scroll container). No gesture
  library, no explicit paint-mode toggle.
  - **Grid cell touch targets (AUDIT fix):** drag-paint removes precision pain for *runs*, but a
    single add/remove of one cell on touch still pokes a ~24px target — the original precision
    complaint. Give step cells a larger effective hit area on coarse pointers via
    `@media (pointer: coarse)` (padding / min hit box that doesn't reflow the visual grid), or
    state and accept the limit if enlargement breaks the 64-column layout.
- **Acceptance:** on a tablet (or dev-tools touch emulation), a finger-drag across a drum row
  paints a run and the page does **not** scroll; scrolling the page from outside the grid
  still works; a single cell is comfortably tappable by finger (coarse-pointer hit area).

### 4. Duplicate bar 1 → bar 2  (Priority 4)
- **Goal:** one control copies steps 0–31 into 32–63 for every row, halving work on repeating
  loops. Lowest priority; droppable if the cycle crowds.
- **Data model:** `duplicateBar1To2(p): Pattern` in `pattern.ts` — copies `drums[pad][0..31]`
  → `[32..63]` for every pad, and the bass cells 0–31 → 32–63 (respecting bass cell/length
  semantics; clamp any sustain that would overrun step 63).
- **Key decisions:** single button in the existing Lesson Actions / control area. Overwrites
  bar 2 (no merge). Confirm bass-length clamping at build against `pattern.ts` bass model.
- **Acceptance:** author a pattern in bar 1, tap Duplicate → bar 2 becomes an exact copy;
  bass notes copy without a sustain overrunning the loop end.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Drag-to-paint drums | Done | s1 | setDrum() + generalized bass-drag handlers to drums paint; onPaintDrum wired App→ScoreSection→StepGrid. Verified live: one-gesture run paint, reverse-drag erase, single-click toggles one, row-pinned (snare untouched), no stray end-toggle, no console errors. |
| 2 | Per-row quick-fill | Done | s2 | fillRow/clearRow (replace-semantics) + per-row native <details> fill chips (×8 ×4 ×2 off back clr) on the rail, drums only, coarse-pointer targets. Corrected offsets for real 8-steps/beat layout (doc's 16/bar figures were stale). Verified live: ×8 kick=four-on-floor, snare backbeat=2&4, clr empties, bass mode shows none. |
| 3 | Touch scroll-claim | Done | s3 | `touch-action:none` scoped to `.step-cell` so cells claim the paint drag while rail + page-outside-grid still scroll; coarse-pointer bumps `--sg-row` 24→36px for a bigger single-cell finger target (horizontal enlargement impossible at 64 cols, so grow height only — 64-col layout untouched). CSS-only, no deps. Verified in browser: computed touch-action=none on cells, coarse media rule `--sg-row:36px` present in CSSOM, tsc clean. |
| 4 | Duplicate bar 1→2 | Done | s8 | `duplicateBar1To2` overwrites all bar-2 drum cells and clones bass starts, clamping destination sustains at step 64; Lesson Actions control reuses `commitPatternEdit`. Verified build + live: Kick 1→33 copied; clearing bar-1 bass then duplicating cleared bar 2 too; no console errors. |

> Status ∈ {Not started, In progress, Blocked, Done}. Each build session updates this
> table before finishing so the next session knows where it left off.
