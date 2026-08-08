# EPIC 4: Pad practice restore

The app used to let you practise a lesson on the visualizer pad itself — hit the right pad in
time and it lit green. That feedback regressed and needs to come back, with a proper touch
experience. This is the **no-hardware practice path**: value without owning a Stylophone Beat.
It rides the EPIC-2 pipeline (matched tap = one sound + a green verdict), so it must build
after EPIC 2.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a learner without hardware, I want the pad to light green when I hit the right pad in time, so I can practise a lesson on-screen. | High | Medium | 1 |
| 2 | As a tablet learner, I want big pad targets, a clear next-hit cue, an explicit wrong/late state, and a haptic tap, so practice is usable by touch. | Medium | Low | 2 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

Non-negotiable choices a future build session must not re-litigate:

- **Depends on EPIC 2** (single-source pipeline + nearest-snap timing). Do not start until
  EPIC 2 stories are Done — the scoring reuses the same (step, tick) matching.
- **Tech stack:** React + TypeScript. Haptics via native `navigator.vibrate` — **no library.**
- **Project structure (locked placement):**
  - Pad rendering + touch targets + green/wrong states → `src/components/BeatPad.tsx`
    (`VisualizerPad.tsx` just wraps it).
  - Scoring/verdict logic → `src/lib/guidance.ts` (the existing pass-state system) and/or
    `src/lib/teaching.ts`; reuse, don't reinvent.
- **Architecture (DG spine):** the pad is a **dumb signal emitter** (EPIC 2). Practice = record
  OFF + scoring. The `is-guide-hit` / `is-guide-miss` pass-state plumbing already exists in
  `StepGrid` + `guidance.ts` (from v1's EPIC-4 "hit/miss highlight", commit `3d572cb`). The
  green **on the pad** regressed — reuse the existing verdict states rather than a parallel one.
- **Investigate before rebuilding (TB):** `git log` shows the pad hit/miss feedback existed
  (`3d572cb`). **Find the commit that dropped the pad-side green before rebuilding**, or it
  regresses again. Check `BeatPad.tsx` history (`cuedPad` / `cueStyle` / `activePads` are the
  current cueing props).

## Execution instructions (priority order)

### 1. Restore green-on-correct-hit on the pad  (Priority 1)
- **Goal:** while a lesson plays with record OFF, tapping the correct pad within the timing
  window lights that pad segment green; a wrong or out-of-window tap does not.
- **Key decisions:**
  - Reuse the EPIC-2 (step, loop-pass) match: a tap whose snapped step + pad matches the
    expected grid entry for the current playhead position = **hit** → green verdict; else **miss**.
  - **Collision policy here = sequencer-authoritative (AUDIT fix):** in practice the learner must
    hear the reference grid pulse to judge a match, not their own slightly-off tap. This is the
    mode-aware branch locked in EPIC-2 — practice does NOT use jam's earliest-wins.
  - Reuse the existing `guidance.ts` pass-state verdicts (`hit`/`miss`); surface them on the
    pad segment in `BeatPad.tsx`, mirroring how `StepGrid` renders `is-guide-hit`.
  - The **timing window** (tolerance for "in time") is an open value — start with the
    nearest-snap boundary and expose a single tuning constant; too tight = unwinnable on
    touch, too loose = meaningless. Tune against real play.
  - First recover the removed behaviour from git history (see locked decision) before adding.
- **Acceptance:** load a lesson, press play with record off, tap the cued pad on the beat →
  the pad flashes green and you hear one sound; tap the wrong pad or well off-beat → no green;
  matches the timing window in the tuning constant.

### 2. Touch-enhance the practice pad  (Priority 2)
- **Goal:** practice is comfortable and legible by touch.
- **Key decisions:**
  - **Bigger segment targets** on the pad (CSS sizing / min hit area) for finger use.
  - **Next-target cue:** verify `BeatPad` already indicates the next expected pad via
    `cuedPad` / `activePads` before adding anything — enhance the existing cue rather than
    duplicating it.
  - **Explicit wrong/late state** (not just green-or-nothing) — a distinct visual on a
    mistimed/wrong hit so the learner gets a signal, reusing the `miss` verdict state.
  - **Haptic:** `navigator.vibrate(…)` on a registered hit (feature-detect; silent no-op where
    unsupported). One line, native, no dependency.
  - Hover styling on the pad must follow EPIC 3 (`@media (hover: hover)`).
- **Acceptance:** on a tablet, pad segments are comfortably tappable; the next expected pad is
  clearly cued; a wrong/late hit shows a distinct state; a correct hit produces a short haptic
  where supported and no error where not.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Restore green-on-correct-hit on pad | Done | s5 | Removal commit: c440d19 (`add derived guidance passes`) dropped the App-side `hitPad` flash wiring introduced in 3d572cb; the pure `lib/hit.ts` `isHit`/`nearestStepDistance` seam survived the restructure, so reused it rather than reinventing (locked reuse mandate). Restored in `useLiveInput.handleDrumPad`: while practising (`guide.status !== "compose"`) and playing, build the tapped pad's own lit-lane target steps and `isHit(targets, currentStep16(), HIT_TOL_STEPS=1.5)` → set `hitPad` for a 350ms cosmetic green flash (transport-time based, BPM-fair). Threaded `hitPad` App → VisualizerPad → BeatPad, reusing the existing `is-hit` green CSS. Collision policy already sequencer-authoritative from E2.1 (practice pre-suppresses the matched live tap). Verified: `hit.ts` self-check passes at load; tsc clean; `is-hit` computes green stroke #3fb950 on the pad-1 wedge; app loads with zero console errors. |
| 2 | Touch-enhance practice pad | Done | s7 | Practice verdicts now flash green on hit / red-dashed on miss; correct taps request native 12ms haptic before audio awaits; existing `activePads` cue retained; coarse-pointer visualizer grows 210→up to 360px with 300px geometry floor. Build + live browser checks pass (browser cannot emulate coarse pointer). |

> Status ∈ {Not started, In progress, Blocked, Done}. Each build session updates this
> table before finishing so the next session knows where it left off.
