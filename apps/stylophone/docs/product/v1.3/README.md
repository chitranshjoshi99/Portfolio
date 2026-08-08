# Beats Drum Machine Coach — v1.3

A browser drum-machine + coach: author a 2-bar / 64-step groove on a 12×64 grid, hear it
through an on-screen visualizer pad, and practise the timing — with optional guidance for
Stylophone Beat hardware owners. v1.3 is a **usability/refinement cycle**: the core authoring
interaction and the touch experience are painful to use, so this cycle makes the existing
app actually usable — no new product surface.

**Wedge:** make *printing grooves into the grid* fast (mouse + touch) and fix the broken
input/audio feedback loop — the reasons even the builder struggles to use v1.2.
**Status:** building — docs generated, **pre-build audit pending** (see `execute.md`).

**Explicitly deferred to a separate session (do NOT scope here):** target user, TAM,
launch, positioning vs. browser-drum-machine incumbents.

**Decoupled from the deferral (AUDIT — LB):** the `/apps/stylophone-visualiser` URL still
serves the "Stylophone" trademark v1.2 spent a whole cycle removing, on a **live** deploy. That
is legal hygiene, not positioning — do the route rename (+ redirect) as a standalone task,
independent of the user/TAM session. The rename lives in the portfolio/deploy repo, not these
app docs, so it is flagged here, not scheduled as a v1.3 story.

## Epics

| Epic | Title | Goal | Doc |
|------|-------|------|-----|
| 1 | Fast groove authoring | Drag-paint, one-tap fills, dup-bar, touch scroll-claim — make authoring fast. | [EPIC-1](EPIC-1-fast-groove-authoring.md) |
| 2 | Single-source audio + timing pipeline | One engine trigger for all sound; nearest-snap capture. The spine. | [EPIC-2](EPIC-2-single-source-audio-pipeline.md) |
| 3 | Touch hardening | Gate all `:hover` behind `@media (hover: hover)` — kill sticky hover. | [EPIC-3](EPIC-3-touch-hardening.md) |
| 4 | Pad practice restore | Bring back green-on-correct-hit practice on the pad, touch-enhanced. | [EPIC-4](EPIC-4-pad-practice-restore.md) |

## Post-execution refinements

The implemented v1.3 workspace received a responsive Visualizer, status-bar, keyboard
feedback, and walkthrough polish pass. See
[post-execution UI refinements](POST-EXECUTION-UI-REFINEMENTS.md) for the current
behavior and verification record.

## Key locked decisions (product-wide)

- **Tech stack:** React + TypeScript + Vite, Tone.js for audio. **No new dependencies this
  cycle** — every fix is native (Pointer Events, `touch-action`, `@media (hover: hover)`,
  `navigator.vibrate`) or reuses in-repo machinery.
- **Architecture — the spine (EPIC 2):** `engine.triggerStep(step)` in `lib/transport.ts` is
  the **only** thing that makes sound. Pad + keyboard + sequencer all route through it; **at
  most one trigger per (step, tick)** (local dedup). **Record mode only decides persistence**
  (write-to-grid or transient), not sound. Practice = record OFF + scoring, and falls out of
  the same pipeline. Feel stays responsive in jam/stopped mode.
- **Design (DG):** drag-paint + quick-fill are **coexistent, no mode switch**; paint direction
  = first cell touched. One step-instant = one sound; on-beat must sound clean. Touch is
  first-class this cycle (scroll-claim, hover-gating, bigger targets, haptics).
- **Reuse mandate (TB):** drum drag-paint **generalizes the existing bass-drag machinery** in
  `StepGrid.tsx`; nearest-snap is a change in the single `captureStep()`; the pad green reuses
  the existing `guidance.ts` `hit`/`miss` pass-state system (find the regression commit first).
- **Project structure (locked placement — every session follows this):**

  ```
  src/
    components/
      StepGrid.tsx / StepGrid.css   ← grid paint, quick-fill chips, touch scroll-claim (E1)
      BeatPad.tsx                   ← pad green/wrong states, targets, haptics (E4)
      VisualizerPad.tsx             ← wraps BeatPad (no logic)
      *.css                         ← hover-gating lives in these (E3)
    hooks/
      useLiveInput.ts               ← input signals + captureStep() nearest-snap (E2)
      useTransportEngine.ts         ← sequencer tick source (E2)
    lib/
      transport.ts                  ← engine.triggerStep + per-tick dedup ledger (E2)
      audio.ts                      ← sample primitives, called ONLY by the engine (E2)
      pattern.ts                    ← setDrum / fillRow / clearRow / duplicateBar1To2 (E1)
      guidance.ts / teaching.ts     ← practice verdicts, reused for pad green (E4)
  ```
  New pure helpers in `lib/` carry a co-located `demo()`/assert self-check; **no test
  framework is added.** Never dump files into `src/` or invent a new directory.

## Net tracker

Every story across every epic. Each build session updates its row here **and** in the epic doc.

| Epic | # | User story | Severity | Priority | Status | Session | Notes |
|------|---|-----------|----------|----------|--------|---------|-------|
| 1 | 1 | Drag-to-paint drums | Critical | 1 | Done | s1 | setDrum + generalized pointer-drag; verified live (paint/erase/single-click/row-pinned) |
| 1 | 2 | Per-row quick-fill | High | 2 | Done | s2 | fillRow/clearRow + native <details> fill chips on rail (drums only); verified live |
| 1 | 3 | Touch scroll-claim | High | 3 | Done | s3 | `touch-action:none` on `.step-cell` (cells own the drag, page/rail still scroll); coarse-pointer `--sg-row` 24→36px enlarges single-tap target without touching 64-col layout. Verified: touchAction=none, coarse rule parsed |
| 1 | 4 | Duplicate bar 1→2 | Medium | 4 | Done | s8 | `duplicateBar1To2` overwrites all bar-2 drum cells and clones bass starts, clamping destination sustains at step 64; Lesson Actions control reuses `commitPatternEdit`. Verified build + live: Kick 1→33 copied; clearing bar-1 bass then duplicating cleared bar 2 too; no console errors. |
| 2 | 1 | Single-source audio + per-tick dedup | Critical | 1 | Done | s4 | `triggerStep` in transport.ts is sole drum-sampler caller; live pad/keyboard + sequencer route through it; dedup keyed (row:step, last-sounded-time) within ±½-step window (not per-tick). jam=earliest-wins, practice=live pre-suppressed→sequencer-authoritative. Bass live left as its own sustained voice (documented; not a step one-shot). Verified: pipeline sounds live (no errors), `shouldSound` guard unit-asserted, tsc clean |
| 2 | 2 | Nearest-step snap on capture | High | 2 | Done | s5 | `captureStep()` now `Math.round(currentStep16()) % STEPS` (nearest, not floored playhead); `captureAndGradePad` drum path routed through it too, so drum + bass capture snap in one place. Module-load asserts: 7.4→7, 7.6→8, 63.6→0. Verified: tsc clean, app loads, no assert failures/console errors |
| 3 | 1 | Gate hover behind `@media (hover: hover)` | Medium | 1 | Done | s6 | All 7 current hover selectors gated; focus-visible/active preserved. Build + live desktop browser check pass; tablet layout rendered at 768px (browser cannot emulate coarse pointer). |
| 4 | 1 | Restore green-on-correct-hit on pad | High | 1 | Done | s5 | Removal commit: c440d19 dropped the App `hitPad` flash wiring (the pure `lib/hit.ts` seam survived). Restored: `useLiveInput.handleDrumPad` now, during practice (guide≠compose) + playing, builds this pad's lit-lane targets and `isHit(targets, currentStep16(), 1.5)` → 350ms green flash via new `hitPad` state; threaded App→VisualizerPad→BeatPad `is-hit`. Reused existing `hit.ts` (no reinvent) + existing `is-hit` CSS. Verified: isHit self-check passes, tsc clean, `is-hit` renders green (#3fb950) on pad wedge, no console errors |
| 4 | 2 | Touch-enhance practice pad | Medium | 2 | Done | s7 | Practice verdicts now flash green on hit / red-dashed on miss; correct taps request native 12ms haptic before audio awaits; existing `activePads` cue retained; coarse-pointer visualizer grows 210→up to 360px with 300px geometry floor. Build + live browser checks pass (browser cannot emulate coarse pointer). |

> Status ∈ {Not started, In progress, Blocked, Done}.
