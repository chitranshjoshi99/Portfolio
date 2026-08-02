# Beats Drum Machine Coach — v1.2

v1.2 makes zero changes to v1.1's frozen product/UX — the grid-first pattern composer and
hardware-guidance app is done. This cycle exists entirely to cross the release boundary
v1.1 explicitly left closed: rename away from the "Stylophone" trademark, relicense the
audio to CC0, fix one confirmed UAT bug, add a first-visit walkthrough, and go live.

**Wedge:** publish the finished v1.1 product, not build new product.
**Status:** Building — docs generated, pre-build audit pending.

## Epics

| Epic | Title | Goal | Doc |
|------|-------|------|-----|
| 1 | Rebrand | Cross the trademark boundary that blocked v1.1 from publishing. | [EPIC-1](EPIC-1-rebrand.md) |
| 2 | Audio relicensing swap | Replace unverified archive.org samples with CC0-verified ones. | [EPIC-2](EPIC-2-audio-relicense.md) |
| 3 | Go-live readiness | Deploy live, re-review security for public exposure, add analytics. | [EPIC-3](EPIC-3-go-live.md) |
| 4 | Lesson-completion UX fix | Fix the confirmed post-lesson editability discoverability bug. | [EPIC-4](EPIC-4-lesson-completion-fix.md) |
| 5 | First-visit walkthrough | Scripted demo + spotlight tour for anonymous first-time visitors. | [EPIC-5](EPIC-5-first-visit-walkthrough.md) |
| 6 | Post-launch audio and input fixes | Reset-BPM loss, trumpet-sounding bass, muffled/near-identical bank filters, unreachable visualizer octave range, and a mode-blind visualizer. | [EPIC-6](EPIC-6-post-launch-audio-input-fixes.md) |

## Key locked decisions (product-wide)

- **Tech stack:** React 18 + TypeScript + Vite + Tone.js/Web Audio; browser
  `localStorage`, `Blob`, and file input only. Unchanged from v1.1 — no new dependency
  added anywhere in v1.2 (walkthrough is hand-rolled, not a library).
- **Architecture:** v1.1's pattern-only persistence and derived-state model are frozen and
  untouched. `commitPatternEdit` (in `src/hooks/usePattern.ts`) remains the sole pattern
  write boundary — the demo groove loader and the lesson-completion fix both reuse it,
  neither adds a new write path.
- **Deployment & Security:** **not locked this cycle.** EPIC 3's hosting pick and
  public-exposure security re-review are explicitly deferred to a separate
  Security-master/DevOps session per product-owner request (2026-07-16) — do not improvise
  either without that session.
- **Design:** layout and musical/hardware functionality are completely frozen from v1.1.
  The only new visual surface is the walkthrough (dim-only spotlight, hand-rolled) and a
  plain-text rebrand (no new logo). Sub-1280px visitors get a message gate, not a scaled
  layout.
- **Legal/compliance:** name is **"Beats Drum Machine Coach"** (risk-reduced, not
  cleared). Every audio sample is individually CC0-verified (see
  `public/rok-cc0/CREDITS.md`). Git history scrub of the old audio blobs is planned as a
  post-swap follow-up (blob-ID stripping, not a path purge — see EPIC-2). Demo groove
  content must be original, not transcribed from an existing song.
- **Project structure — locked folder tree, naming, and placement rule (Tech-bro, v1.2):**
  ```
  src/
    components/   presentational .tsx, each owns its matching .css
    hooks/        operation-scoped use*.ts (state + orchestration)
    lib/          pure logic/data, no React
    App.tsx, main.tsx, App.css, theme.css   (shell, at root)
  public/
    rok/          live audio assets (13 files post-swap)
    rok-cc0/       staged CC0 replacements + CREDITS.md (pre-swap)
  ```
  **Placement rule:** new UI → `src/components/<Name>.tsx` + matching `.css`; new
  state/orchestration → `src/hooks/use<Name>.ts`; new pure data/logic →
  `src/lib/<name>.ts`. camelCase for hooks/components — matches the existing convention,
  no new casing style. If a new file doesn't have an obvious home in this tree, the
  structure is wrong — fix it, don't invent a junk-drawer folder.
- **Data/market basis:** Finance-bro skipped — no revenue model, no market-sizing gate.
  This is a prototype release with no traction bar (same call v1.1 made).

## Net tracker

| Epic | # | User story | Severity | Priority | Status | Session | Notes |
|------|---|-----------|----------|----------|--------|---------|-------|
| 1 | 1 | Rename to Beats Drum Machine Coach | Critical | 1 | Done | 2026-07-16 | Renamed across index.html, Header.tsx, theme.css, StepGrid.tsx, constants.ts, package.json. Dubreq non-affiliation disclaimer added under header brand. Grep clean, verified live at 1280×720. |
| 2 | 1 | Source and verify 13 CC0 samples | Critical | 2 | Done | 2026-07-16 | Staged in `public/rok-cc0/`, credited. MP3/WAV gap + cross-kit listen-through still open. |
| 2 | 2 | Swap into `public/rok/`, delete dead files | Critical | 3 | Done | 2026-07-16 | 13 CC0 files swapped in at existing filenames (MP3 hi-hat converted to WAV via ffmpeg first); `kick.wav`/`snare.wav`/`hat.wav`/`bass_C2.wav` deleted. Zero `src/` diff. Verified live: all 13 assets 200 OK over network, no console errors. Kit rejected in the flagged listen-through — re-sourced, see 2/3 below. |
| 2 | 3 | Re-source kit v2 after listen-through rejection | Critical | 3.1 | Done | 2026-07-17 | Kit v1 sounded wrong (synth D&B kick/snare, near-silent ride, 0.11–0.99 peak spread across 5 unrelated creators). Rebuilt from Sonic Pi (kick/toms/hats/cymbals/click, mostly one creator) + Virtuosity Drums (snare/rimshot) + rated Freesound one-shots (clap/claves), gated by two user audition rounds on an A/B page. `CREDITS.md` rewritten. All 13 assets 200 OK, byte-exact to approved files. |
| 3 | 1 | Deploy to live URL | Critical | 4 | Blocked | — | Deferred to separate Security-master/DevOps session. |
| 3 | 2 | Public-exposure security re-review | High | 5 | Blocked | — | Same deferral. |
| 3 | 3 | Cookieless pageview analytics | Medium | 6 | Blocked | — | Tool pick pairs with hosting; same deferral. |
| 4 | 1 | Add Stop/Continue-editing control | Medium | 7 | Done | 2026-07-16 | New `onStopLesson` prop wired straight to existing `setGuideCompose()`; "Continue editing" button added in `LayerStack.tsx` at `paused`/`complete` status. No new state. Verified live: complete → click → lands in compose with grid editable. |
| 5 | 1 | Demo-mode controller | High | 8 | Done | 2026-07-16 | `src/lib/demoGroove.ts` (original C-F-G-C groove, drums+bass) + `src/hooks/useWalkthrough.ts` (`startDemo()`: setBpm → arm click → single `commitPatternEdit` → `onTogglePlay()` → `startGuidance()`, then reuses transport's `onStep` clock to call `advanceGuidance()` once per loop instead of a new timer path). Verified live end-to-end via a temporary click-triggered harness in `App.tsx` (documented `ponytail:` comment, to be removed by Story 3's real trigger): reached `complete · 4/4 passes`. |
| 5 | 2 | Spotlight/backdrop tour UI | High | 9 | Done | 2026-07-16 | `src/components/Walkthrough.tsx`+`.css` (box-shadow hole-punch spotlight, no library), 6-step sequence added to `useWalkthrough.ts` targeting 5 fixed `aria-label` selectors. Sub-1280px handling revised post-verification, per product-owner: a dismissible info `Modal` (reusing the existing component) instead of a hard full-screen gate — narrow-viewport visitors can dismiss it and keep using the app in the existing cramped v1.1 responsive layout. Re-arms if width crosses back above 1280px and narrows again. Verified live: 6-step tour correct, Next/Skip work, modal shows/dismisses/re-arms correctly at 1024px and 1280px. |
| 5 | 3 | First-visit trigger + retrigger | Medium | 10 | Done | 2026-07-16 | `hasSeenWalkthrough()`/`markWalkthroughSeen()` added to `storage.ts` (same browserStorage()-wrapped pattern as DRAFT_KEY). `useWalkthrough.ts` now owns a first-gesture effect: unseen flag → one-time click listener → `retriggerTour()` (startDemo+startTour). Removed the Story 1/2 `?demo=1` debug harness from `App.tsx`; added a permanent "?" button in `Header.tsx` (reuses `.tbtn`, keeps 44px touch target) wired to `retriggerTour`. Verified live: fresh load + click auto-launches demo+tour, reload after skip doesn't relaunch, "?" relaunches regardless of flag. No console errors. |
| 5 | 4 | Re-choreograph demo to stage per tour step | Medium | 10.1 | Done | 2026-07-17 | Single `startDemo()` replaced with a transition-guarded effect on `tourStepIndex`: step 1 rest state (empty grid, metronome off, stopped), step 2 metronome+play, step 4 groove+guidance, tour end pauses with grid kept. `retriggerTour()` calls `setGuideCompose()` first so the step-1 grid clear can't be rejected mid-replay. `tsc --noEmit` clean. |
| 6 | 1 | Preserve BPM on Reset Pattern | Medium | 11 | Done | 2026-07-17 | `performReplacement(kind)` seeds the new document with the current BPM only for `"reset"`; `handleResetPattern` now sends `"reset"` (previously sent `"new"`, silently dead-coding the confirm dialog's own "Reset this beat?" title). `tsc --noEmit` clean. |
| 6 | 2 | Rework bass and drum-bank timbres | High | 12 | Done | 2026-07-17 | Bass "trumpet" bug traced to `Tone.MonoSynth` factory defaults (0.6s filter swell over 3 octaves — the brass patch) plus a latent bug where both bass voices never got the ROK timbre applied at all until the first bank switch. All 4 bass banks rewritten with a pluck envelope (filter attack ≤20ms) and distinct character; drum bank filters retuned to sit inside the kit's energy (BOX's bandpass widened from Q3.5 to Q0.8, fixing the telephone-muffle). `tsc --noEmit` clean. |
| 6 | 3 | Octave wrap on visualizer bass drags | Medium | 13 | Done | 2026-07-17 | Dragging across the visualizer's 12 o'clock boundary now shifts the bass octave (clockwise up, counter-clockwise down) via a >180° pointer-angle-jump detector, clamped through the existing `clampOctave` (±2). Keyboard bass slides unaffected. `tsc --noEmit` clean; browser-drive tools were unavailable this session so verification was full-flow code tracing, not a live screenshot — recommend a manual check. |
| 6 | 4 | Visualizer shows only the selected mode's map | Medium | 14 | Done | 2026-07-17 | `useTransportEngine.ts`'s merged `sequencedPads` list split into `{ drums, bass }`; `App.tsx` feeds the visualizer only the list matching the selected mode. `tsc --noEmit` clean; same caveat as 6/3 — verified by code tracing, live check recommended. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching epic
> tracker in every build session. Blocked rows (EPIC 3) stay blocked until the deferred
> session runs — skip them and build the next unblocked story by priority order.
