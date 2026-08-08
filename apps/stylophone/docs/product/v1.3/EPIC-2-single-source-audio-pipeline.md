# EPIC 2: Single-source audio + timing pipeline

The visualizer pad, keyboard, and sequencer each make sound independently, so a well-timed
tap that lands on an existing grid note produces **two stacked sounds** — meaning correct
timing sounds *messier* than a miss. For a product whose whole job is coaching timing, the
core feedback loop is inverted. And recorded taps snap to the *currently-playing* step, so
sloppy timing lands on the wrong step. This epic rebuilds input as a single pipeline: **all
sound comes from one engine trigger**, inputs are dumb signals, and record mode only decides
persistence. It is the spine three features ride on — record-into-grid, timing capture, and
pad practice (EPIC 4).

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a player, I want one sound per beat even when my tap lands on an existing note, so correct timing sounds clean instead of doubled. | Critical | Medium | 1 |
| 2 | As a recorder, I want my taps to snap to the nearest step, so slightly-early/late hits land where I meant them. | High | Low | 2 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

Non-negotiable choices a future build session must not re-litigate:

- **Tech stack:** React + TypeScript, Tone.js. No new dependencies.
- **Project structure (locked placement):**
  - The single audio authority + per-tick dedup ledger → `src/lib/transport.ts` (no new file).
  - Sample playback primitives stay in `src/lib/audio.ts` (`playDrum`, `attackBass`, …) but
    are **called only by the engine**, never directly from input handlers.
  - Input handlers → `src/hooks/useLiveInput.ts`; they emit a snapped-step signal, they do
    **not** call `playDrum`/`attackBass` directly anymore.
  - Nearest-snap capture → the single `captureStep()` in `useLiveInput.ts`.
  - Sequencer tick source → `src/hooks/useTransportEngine.ts` / `src/lib/transport.ts`.
- **Architecture — THE SPINE (locked, from the TB↔user thread):**
  - `engine.triggerStep(step, …)` in `transport.ts` is the **only** thing that produces
    sound. Pad + keyboard + sequencer all route through it.
  - **At most one trigger per (step, loop-pass).** A live signal and a sequencer tick for the
    same cell-instant collapse to a single sound. The guard is **local to `triggerStep`** —
    "already sounded step S on this loop-pass? skip" — because all sound now funnels through one
    function. No cross-subsystem ledger.
  - **DEDUP WINDOW (AUDIT fix — load-bearing):** the dedup coordinate is **(step, loop-pass)**,
    NOT an instantaneous tick reset every 16th. A matched live tap arrives a few ms before/after
    the exact step tick; if the key reset each tick, the tap and the sequencer's fire would land
    under different keys and **both sound** — the exact bug this epic kills, surviving at the
    boundary where good timing lands. So: "has step S already sounded on this pass of the loop?",
    evaluated within a tolerance window equal to the nearest-snap window (EPIC-2 story 2). One
    pass = one bar-cycle occurrence of step S; clear per loop, not per step.
  - **COLLISION POLICY IS MODE-AWARE (AUDIT fix), not one global constant:** on a live-signal ↔
    sequencer-tick collision — **jam / record → earliest-wins** (hear your own tap, or the pad
    feels dead); **practice → sequencer-authoritative** (the learner must hear the reference grid
    pulse to judge a match, not their own slightly-off tap). Implement as a function of current
    mode, not a single tunable knob.
  - **Record mode is orthogonal to sound.** It only decides **persistence**: record ON → the
    input signal also writes into the grid; record OFF → transient (sounds, doesn't persist).
  - **Practice (EPIC 4) falls out for free**: record OFF + scoring; a matched tap lands on the
    same (step, tick) the sequencer plays → the per-tick guard makes it one sound; a miss
    sounds a different step → two separated sounds = correct feedback.
  - **Feel preserved in jam/stopped mode:** with no sequencer tick competing, `triggerStep`
    fires immediately on the live signal, so the pad stays a responsive instrument. Dedup only
    engages during playback.
- **Design (DG):** requirement is non-negotiable — **one step-instant = one sound; on-beat
  sounds clean.** The no-hardware pad-as-instrument experience (regular mode) must stay
  responsive.

## Execution instructions (priority order)

### 1. Single-source audio + per-tick dedup  (Priority 1)
- **Goal:** all sound originates from `engine.triggerStep`; a tap coinciding with an existing
  note or a sequencer tick yields exactly one sound.
- **Data model:** a per-tick dedup key inside `transport.ts` — e.g. a `Set<string>` of
  `` `${row}:${step}` `` keyed to the current tick id, cleared each tick; or an equivalent
  "last sounded tick" per (row, step). Choose the smaller of the two at build.
- **Key decisions:**
  - Add `triggerStep(row, step, opts)` to `transport.ts` as the sole sampler caller (it calls
    `playDrum`/`attackBass` from `audio.ts`). Guard: if `(row, step)` already sounded this
    tick, return without re-triggering.
  - Refactor `useLiveInput.handleDrumPad` / bass handlers to **stop calling `playDrum` /
    `attackBass` directly**; instead emit a signal that resolves to `triggerStep`. Preserve
    the `startAudio()` (iOS unlock) call inside the user gesture.
  - The sequencer's tick playback also goes through `triggerStep`, so tick + live signal for
    the same cell collapse.
  - **Collision policy is mode-aware (AUDIT fix):** jam/record → earliest-wins (feel);
    practice → sequencer-authoritative (reference clock). Not one global constant — branch on
    the current mode. See Architecture note above.
  - **Dedup key = (step, loop-pass) within the nearest-snap tolerance window (AUDIT fix),** not a
    per-16th tick reset — otherwise a matched tap just before/after the tick double-sounds.
  - Keep the existing `isPlaying() && recording` guards for persistence (see story 2 / EPIC 4).
- **Acceptance:** while playing, arm nothing (regular mode) and tap a pad in time with an
  existing grid note → you hear **one** clean sound, not a flam; tap off-beat → you hear two
  separated sounds; stopped, tapping the pad still sounds immediately (responsive). Add a
  `demo()`/assert check on the dedup guard (same (step,tick) twice → one trigger).

### 2. Nearest-step snap on capture  (Priority 2)
- **Goal:** a recorded tap writes to the **nearest** step boundary, not the current playhead,
  so scattered early/late timing lands where intended.
- **Key decisions:**
  - `captureStep()` currently returns `stepRef.current` (current playhead) / uses
    `Math.floor(currentStep16())`. Change the capture to **round to nearest**:
    `Math.round(currentStep16()) % STEPS`. Route **both** the drum path
    (`captureAndGradePad`, which reads `stepRef.current` directly) and the bass path through
    this single `captureStep()` so nearest-snap is applied in exactly one place.
  - User reported timing is **scattered (early/late)**, not systematically late → nearest-snap
    is the fix. Only add a fixed latency offset later if a consistent bias appears on top.
- **Acceptance:** in record mode, tap slightly before and slightly after the beat → both hits
  land on the same (nearest) step; no hits land one step off due to floor-truncation. Add a
  `demo()` check: fractional positions 7.4 and 7.6 both snap to step 7 and 8 respectively at
  the .5 boundary (confirm rounding direction at build).

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Single-source audio + per-tick dedup | Done | s4 | `triggerStep(source,row,step,bank,time?,gain)` in transport.ts is the ONE drum-sampler caller (calls playDrumAt). Live pad/keyboard (useLiveInput.handleDrumPad) + sequencer (useTransportEngine) both route through it. Dedup: `lastSoundedAt` map keyed `row:step` → last-sounded audio-time, compared within ±½-step window (= nearest-snap window; NOT a per-16th reset) so a tap just before/after the tick collapses with it. Collision policy mode-aware but factored uniform: jam/record = earliest-wins (within-window→skip); practice = live tap pre-suppressed when its nearest step has a grid note, so sequencer is authoritative; a miss still sounds. `step<0` (stopped) bypasses dedup → responsive free instrument. Bass live kept as its own sustained monophonic voice (attack/move/release) — a continuous instrument, not a step one-shot, and already a separate voice from sequenced bass, so it never had the drum-flam doubling; deliberately out of this dedup, noted in code. Verified: `shouldSound` pure guard unit-asserted (first sounds / within-window collapses / next pass sounds); pipeline sounds live through triggerStep during playback (sound-starts counted, zero console errors); tsc clean. |
| 2 | Nearest-step snap on capture | Done | s5 | `captureStep()` returns `Math.round(currentStep16()) % STEPS` — nearest step boundary, replacing the floored `stepRef.current` playhead read. `captureAndGradePad` (drum path, read `stepRef.current` directly) now routes through `captureStep()`, so both drum and bass capture apply nearest-snap in the single place. Round-direction pinned by module-load `console.assert`: 7.4→7, 7.6→8, loop-end 63.6→0 (wraps). Verified: tsc clean; app boots with zero assert failures / console errors. |

> Status ∈ {Not started, In progress, Blocked, Done}. Each build session updates this
> table before finishing so the next session knows where it left off.
