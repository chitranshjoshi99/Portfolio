# EPIC 5: First-visit walkthrough

Give a stranger landing on the live URL a scripted, automatic demo of the app instead of a
blank grid and no context — the highest-complexity, lowest-urgency piece of v1.2; it can
slip a session without blocking publish.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a first-time visitor, I want the app to demonstrate itself by setting a tempo, playing, and writing a groove into the grid, so that I understand what it does without reading instructions. | High | Medium | 8 |
| 2 | As a first-time visitor, I want a spotlight tour dimming everything except the section being explained, so that I'm not overwhelmed by the full interface at once. | High | Medium | 9 |
| 3 | As a returning visitor, I want to be able to replay the tour on demand, so that I'm not stuck if I skipped it or want a refresher. | Medium | Low | 10 |
| 4 | As a first-time visitor, I want the demo to build up state step by step instead of dumping tempo, metronome, groove, and guidance on me all at once, so that each tour step actually shows only what it's talking about. | Medium | Low | 10.1 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

- **Tech stack:** React 18 + TypeScript + Vite + Tone.js (unchanged). **No new dependency**
  — no tour/onboarding library (evaluated React Joyride, Shepherd.js, Driver.js, Tour Kit;
  rejected — see Architect rationale below).
- **Project structure:** `src/hooks/useWalkthrough.ts` (step index, backdrop target,
  first-visit localStorage flag, Next/Skip handlers), `src/components/Walkthrough.tsx` +
  `.css` (the backdrop overlay + Next/Skip UI), `src/lib/demoGroove.ts` (one exported
  original `Pattern` constant). Matches the existing placement rule — see `README.md`.
- **Architecture:** the demo groove is a **static, pre-authored, original `Pattern`
  constant** (same schema as any saved pattern) loaded via the existing
  `commitPatternEdit` — not a scripted per-cell timed write synced to the transport. The
  existing playhead/active-step rendering supplies the "reveal" visual for free during
  normal playback. `commitPatternEdit` remains the sole write boundary — no bypass path
  (Architect, v1.2). Walkthrough spotlight is **hand-rolled**, not a library: exactly 6
  fixed, always-present targets (not arbitrary/dynamic DOM), and the state-orchestration
  work (BPM, metronome, pattern write, `startGuidance()` per step) is unavoidable custom
  code regardless of library choice — a library would only buy spotlight-mask CSS, ~30–40%
  of the actual work, at the cost of a dependency in a codebase with already-fragile
  unscoped global CSS (Architect, v1.2).
- **Deployment:** N/A this epic.
- **Security:** N/A — demo groove is bundled static content, no new input surface.
- **Design:** walkthrough **auto-launches on first visit** (no blank-grid orientation beat
  — user's explicit choice against Design-girl's recommendation; recorded as an accepted
  risk). Spotlight is **dim-only** — a backdrop overlay darkens every section except the
  target, no border/glow chrome. Sequence: Status Bar → Control Rail → Status Bar → Grid →
  Lesson Control → Visualizer. Next/Skip buttons bottom-right. Demo groove **persists** in
  the grid/draft after the tour ends or is skipped — same persistence path as any authored
  pattern, no special-cased demo storage. Respects `prefers-reduced-motion` exactly as
  v1.1 already does elsewhere (instant swap, no crossfade, no separate exception). Below
  the v1.1 desktop floor (1280×720), show a plain "best viewed on a larger screen" message
  instead of attempting to scale the layout down (Design-girl, v1.2).
- **Legal/compliance:** the demo groove content **must be original** (self-composed), not
  transcribed from an existing song — a transcribed rhythm/note pattern can infringe
  composition copyright independent of the (already CC0-relicensed) audio samples. Zero
  extra engineering cost either way since it's a JSON fixture regardless of content
  (Legal-bro/Architect, v1.2).
- **Data/market basis:** N/A — no step-level funnel analytics inside the walkthrough;
  S3.3 (deferred) covers plain pageview-only, nothing more granular this cycle.

## Execution instructions (priority order)

### 1. Demo-mode controller  (Priority 8)
- **Goal:** on trigger, the app sets a BPM, arms the metronome, presses play, writes the
  original demo groove into the grid via the existing pattern-write path, then runs
  guidance to completion — using only functions that already exist.
- **Data model:** `src/lib/demoGroove.ts` exports one `Pattern` constant, schema-identical
  to a saved pattern (schemaVersion 3). Content is original, composed by the product owner
  — not transcribed from any existing song. **Locked (Auditor pre-build pass,
  2026-07-16): the groove must include both populated drum pads and at least one bass
  note.** `derivePasses()` only appends a bass guidance pass when the pattern has bass
  content — a drums-only demo groove would silently skip the bass pass and the walkthrough
  would never demonstrate half the app's value proposition. This wasn't decided by any
  prior persona; it's locked here so the build session doesn't compose a drums-only demo
  by default.
- **Key decisions:** the groove load is a single `commitPatternEdit` call at `"compose"`
  status, before `startGuidance()` fires — not a scripted per-cell timed write. Guidance
  stepping reuses `startGuidance()`/`advanceGuidance()` exactly as a real lesson does.
- **Acceptance:** triggering the demo results in a fully populated grid, audible playback,
  and a running guided lesson — all via calls to existing `usePattern`/`useTransportEngine`
  exports, zero new pattern-mutation code path. After the tour ends (finished or skipped),
  the demo groove remains in the draft exactly as if hand-authored.

### 2. Spotlight/backdrop tour UI  (Priority 9)
- **Goal:** a dim-only backdrop sequentially highlights Status Bar → Control Rail → Status
  Bar → Grid → Lesson Control → Visualizer, with Next/Skip controls, holding at the locked
  desktop viewport floors (1280×720, 1680×1046).
- **Key decisions:** `getBoundingClientRect` on the five existing components (known, fixed
  set — no dynamic element discovery needed). No positioning/tour library. Respects
  `prefers-reduced-motion` — instant swap, no crossfade, when set.
- **Acceptance:** at both locked desktop widths, each step's backdrop correctly dims every
  section except the current target; Next/Skip both function; reduced-motion setting
  removes the transition without breaking the sequence; below 1280px width, the app shows
  the message-gate instead of a broken layout.

### 3. First-visit trigger + retrigger  (Priority 10)
- **Goal:** the tour auto-launches exactly once per browser (first visit), and a permanent
  "?" icon retriggers it on demand afterward.
- **Key decisions:** localStorage flag, same pattern as the existing draft-persistence key
  in `useDraftPersistence.ts`. No account/server-side persistence — resetting on cleared
  browser storage is accepted (Design-girl/Product-head, v1.2).
- **Acceptance:** first load with no prior flag auto-launches the tour; reload after
  completion/skip does not relaunch it; clicking "?" relaunches it from step 1 regardless
  of the flag's state.

### 4. Re-choreograph demo to stage per tour step  (Priority 10.1) — **Done**
- **Goal:** the demo builds up in stages tied to the tour step instead of setting BPM,
  metronome, groove, and guidance all at once before step 1 even renders.
- **What was wrong:** `startDemo()` did everything up front — by the time step 1 (Status
  Bar) rendered, the metronome was already on, the groove was already in the grid, and
  guidance was already running. Steps 1–3 described things that hadn't happened yet.
- **Key decisions:** replaced the single `startDemo()` with a transition-guarded effect
  keyed on `tourStepIndex`. Step 1 (index 0): rest state — BPM set, grid cleared, metronome
  off, transport stopped. Step 2 (index 1): metronome on, transport starts, grid still
  empty. Step 4 (index 3): demo groove commits, guidance + auto-advance start. Tour end
  (finish or skip): auto-advance stops and transport pauses, grid stays painted. No new
  functions — only `setBpm`/`onToggleClick`/`onTogglePlay`/`commitPatternEdit`/
  `startGuidance`/`setGuideCompose`/`emptyPattern`, all already exported elsewhere.
- **Acceptance:** each tour step's copy matches what's actually audible/visible at that
  step; the grid remains painted and the transport is paused after the tour ends or is
  skipped.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Demo-mode controller | Done | 2026-07-16 | `demoGroove.ts` + `useWalkthrough.ts` built. Auto-advance reuses `onStep` (loop-boundary detection) instead of a timer. Verified live: reached complete · 4/4 passes via a temporary click-triggered debug harness in `App.tsx`, to be replaced by Story 3's real first-visit trigger. |
| 2 | Spotlight/backdrop tour UI | Done | 2026-07-16 | `Walkthrough.tsx`+`.css` built (hand-rolled box-shadow spotlight), 6-step sequence in `useWalkthrough.ts`. Sub-1280px handling revised per product-owner after initial verification: dismissible info `Modal` (reusing the existing component) instead of a hard gate, so the app stays usable underneath in the existing v1.1 responsive layout. Verified live: all 6 steps correct, Next/Skip work, modal dismiss/re-arm confirmed at 1024px and 1280px. |
| 3 | First-visit trigger + retrigger | Done | 2026-07-16 | `storage.ts` gets `hasSeenWalkthrough()`/`markWalkthroughSeen()`. `useWalkthrough.ts` owns the first-gesture auto-launch (unseen flag → one-time click listener → demo+tour) plus `retriggerTour()`; removed Story 1/2's `?demo=1` debug harness from `App.tsx`. Permanent "?" button added to `Header.tsx` (reuses `.tbtn`, 44px touch target preserved), wired to `retriggerTour`. Verified live at 1280×720: fresh load waits for a gesture then auto-launches; reload after skip doesn't relaunch; "?" relaunches from step 1 regardless of flag state. No console errors. |
| 4 | Re-choreograph demo to stage per tour step | Done | 2026-07-17 | `useWalkthrough.ts`'s single `startDemo()` replaced with a transition-guarded effect on `tourStepIndex`: step 1 rest state, step 2 metronome+play, step 4 groove+guidance, tour end pauses with grid kept. `retriggerTour()` calls `setGuideCompose()` before `startTour()` so the step-1 grid clear can't be rejected mid-replay. `tsc --noEmit` clean; flow traced end to end by reading. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching net
> tracker in every build session.
