# Repo structure & App.tsx restructure — 2026-07-16

**Status:** Done. **Trigger:** ad-hoc repo-structure/naming audit (Auditor + Tech-bro), mid v1.2 cycle.

Scope: dead-asset cleanup, `src/` reorganization, and splitting the 1030-line `App.tsx`
monolith into presentational components + operation-scoped hooks. No product behavior
changed — verified against the running app at every step.

## 1. Cleanup

- `public/Tec/`, `dist/Tec/` — deleted. Empty; the TEC bank is runtime-filtered from ROK
  samples (`src/lib/audio.ts`), no static TEC assets were ever needed.
- `StylophoneSamples/` — deleted. Full hardware sample tree, 0 files ever git-tracked,
  already superseded by the one-set-of-samples-plus-filters approach in `public/rok`.
- `samples/*.mp3` — deleted. Song-reduction feature is paused until a later release.
- `lessons/` — added to `.gitignore`. Not ready to commit yet.
- `.gitignore` — dropped a dead `docs/executions/previews/` rule (path never existed;
  the real path `docs/executions/v1/previews` has its own separate rule).

## 2. `src/` reorganization

Flat `src/` (20+ files) split into:

- `src/components/` — every `.tsx` + its matching `.css`.
- `src/lib/` — the 11 non-component logic modules (`audio.ts`, `pattern.ts`, etc).
- `src/App.tsx`, `main.tsx`, `App.css`, `theme.css` stay at `src/` root.

Fixed while moving:

- **`UtilityDock.css`** — deleted. Zero usage anywhere in the codebase, fully dead.
- **`Device.css`** — was imported by `App.tsx` but only ever styled `TransportControls.tsx`.
  Import moved to its actual owner.
- **`StepGrid.css`** — `StepGrid.tsx` never imported its own stylesheet; `App.tsx` was the
  sole importer. Caught this because deleting the "duplicate" import broke the grid's
  styling. Gave `StepGrid.tsx` a proper self-import.
- **`Workspace.css` → `App.css`** — renamed. There is no `Workspace` component; the file
  styles `App.tsx`'s own root markup. Its import stayed in `main.tsx` (its original
  cascade position) rather than moving into `App.tsx` — see the CSS-ordering note below.

### CSS-ordering regression (caught, not shipped)

Mid-reorg, moving `App.css`'s import into `App.tsx` (instead of leaving it in `main.tsx`)
silently changed cascade order — this app has no CSS scoping, just plain global
stylesheets ordered by import order, so this broke the header layout. Diffed against the
unmodified original at the same viewport width and confirmed a **second, pre-existing**
bug in the same area (a stale `@media (max-width:1100px)` rule sized for a 4-column header
that's actually 3 children now) — real but unrelated, left alone, flagged separately.
Fix for the regression: keep `App.css`'s import in `main.tsx`, in its original slot, after
`theme.css`.

## 3. `App.tsx` → presentational components

Extracted the render tree into `src/components/`, each taking props only, no state:

`Header`, `ScoreSection`, `ControlRail`, `LessonPanel`, `VisualizerPad`,
`ReplacementConfirmDialog`, plus `BeatIndicator` (pulled out of an inlined block that
already had its own orphaned CSS file).

`App.tsx`: 1030 → 916 lines.

## 4. `App.tsx` → hooks, by operation

The remaining ~700 lines of state/handlers split into `src/hooks/`:

- **`usePattern.ts`** — the authored pattern *and* its guided-practice state, as one
  domain (see §5 — these two don't split cleanly).
- **`useLiveInput.ts`** — pad taps, bass attack/slide/release, REC-armed capture. Owns the
  live playhead ref (see §5).
- **`useTransportEngine.ts`** — bpm/play/beat/step, the audio-scheduling effect.
- **`useKeyboardControls.ts`** — the window keydown/keyup listeners.
- **`useDraftPersistence.ts`** — hydrate/autosave, import/export, the replace flow.

`App.tsx`: 916 → 217 lines. No business logic left in it — just hook composition and JSX.

## 5. The circular-dependency catch, and how it was actually fixed

First pass left `pattern`/`patternRef` and `stepRef` owned by `App()` itself rather than
inside a hook, purely to break two hook-call-ordering conflicts. On being asked to fix
this properly (Context API was considered and explicitly rejected — see rationale below),
each case turned out to need a different fix:

- **`pattern` + `guide` — genuinely circular, merged.** `useGuidance`'s `guidancePasses`
  needs the *reactive* pattern value in a `useMemo`; `usePatternEditor`'s
  `commitPatternEdit` needs guidance's `guideRef`/`setGuideCompose` to exist *before* it's
  called. Each hook needed the other's live output to construct — an actual circular
  dependency, not just an ordering inconvenience. No amount of param-reordering fixes
  that. Fixed by merging both into `usePattern.ts` — they're one domain anyway ("the
  pattern and its guided-practice state"), and the split was papering over that.
- **`stepRef` — not actually circular, just misassigned.** `useTransportEngine` only
  needed `handleBassRelease`/`setRecording`/`extendRecordedBass` from `useLiveInput` *at
  its own call time* (as constructor params); `useLiveInput` only needed `stepRef` inside
  event-handler closures, not during its own render. Since `useLiveInput` is necessarily
  called first (to produce those params), it can just create `stepRef` itself and hand it
  back — `useTransportEngine` writes into the same ref object, ownership doesn't need to
  match "who reads it more."

Net result: `App()` now holds zero raw `useState`/`useRef` except `mode` and
`openDialog` — genuine local UI state, not shared across hooks.

**Why not Context API:** considered and discussed before implementing. Context would
replace "pass ref as a hook param" with "read ref via `useContext`" — the refs themselves
don't go away, since the audio-scheduling effect in `useTransportEngine` reads
`patternRef`/`stepRef` from Tone.js's own clock callback, outside React's render cycle,
and needs a ref there regardless of Context. What Context would remove is the explicit,
fully-typed parameter list `App()` uses to wire hooks together — but this app has one
consumer tree, one level deep; Context earns its keep skipping 5+ component layers, not
here. Traded a working, traceable wire-up for indirection that solves a cosmetic itch,
not a real bug — skipped.

## Verification

No test suite exists for this app; every step was verified live against the dev server:
`tsc --noEmit` clean after each change, screenshots diffed against the pre-restructure
original at matched viewport widths, and a full interaction pass (drum + bass grid edits,
transport play/stop, guidance start/advance with auto mode-switching, bank/octave
controls, save/load modal, draft persistence round-trip through `localStorage`) after the
hooks split and again after the circular-dependency fix.
