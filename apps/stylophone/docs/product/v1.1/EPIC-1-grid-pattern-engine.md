# EPIC 1: Grid-first pattern engine

Make an 8-beat Beat loop reliable to author, hear, and translate. This is the product’s indispensable value: a 64-step grid with exact pad identity and independently selected drum/bass profiles.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a Beat owner, I want every pattern represented by one 64-step source of truth so that playback, pad translation, and saving agree. | Critical | Medium | 1 |
| 2 | As a Beat owner, I want to add drum hits and snapped bass holds on a 64-step score so that I can write the loop I will record on hardware. | Critical | Medium | 2 |
| 3 | As a Beat owner, I want grid edits and playback to show/hear their physical pad translation, with separate drum and bass profiles, so that the app mirrors my hardware choices. | High | Medium | 3 |

## Locked decisions

- **Tech stack:** existing React/TypeScript/Tone.js; add no dependency.
- **Architecture:** `pattern.ts` owns `STEPS = 64` and immutable edits. `transport.ts` is the only clock. `audio.ts` resolves `{ instrument, bank, pad }` to a voice. React holds the current pattern and derives views.
- **Deployment:** browser-only local app; no sidecar starts for v1.1.
- **Security:** event values are locally authored; imported values are validated in EPIC 2 before reaching this engine.
- **Design:** full 64 slots represent the fixed two-bar loop; 32-step cycle divider sits after step 32. Pad is a secondary live translator.
- **Legal/compliance:** generated profile treatment and existing ROK assets are preview audio; do not represent them as official/captured banks.
- **Data/market basis:** personal single-user tool; market research is intentionally not a priority gate.

## Execution instructions (priority order)

### 1. V1.1 pattern schema and 64-step clock (Priority 1)
- **Goal:** all in-memory data, playhead, and scheduled audio share 64 slots over exactly eight beats.
- **API contract:** export from `pattern.ts`: `STEPS = 64`, `emptyPattern()`, immutable drum/bass edits, `activeBassCell()`, and `setBassLength()`/equivalent. `transport.ts` retains `onStep`, `onStepAudio`, and `currentStep*`, but they emit `0..63`; schedule repeat interval is `32n`, loop end stays `2m`.
- **Data model:** `Pattern = { drums: Record<PadId, boolean[64]>; bass: (BassCell|null)[64] }`; `BassCell = {pad, octave, length}`. Clamp length to `1..64` and resolve no overlap deterministically by clearing/replacing conflicting starts.
- **Key decisions:** do not add free-time timestamps, a second tempo clock, or bank on events. Update all self-checks from 32 to 64, including wrap at `63 → 0`.
- **Acceptance:** at 120 BPM, the playhead visits 0–63 exactly once per `2m`; click still accents beats 0 and 4; fresh arrays have 64 slots for all 12 pads and bass.

### 2. 64-step grid and snapped bass holds (Priority 2)
- **Goal:** compose any drum-only, bass-only, or combined loop directly in the score.
- **API contract:** `StepGrid` receives 64 columns, exact `Pattern`, mode, current step, and edit callbacks. Bass press creates/replaces a start note; drag extension writes an integer `length`; clearing a start removes its held span.
- **Data model:** unchanged from story 1; bass has entries only at note starts, with `activeBassCell` resolving sustained cells for rendering/playback.
- **Key decisions:** preserve 12 exact drum rows in native `PAD_IDS` visual order. The grid must distinguish bass start from sustain and never create overlapping bass starts. Grid edit auditions through existing audio path.
- **Acceptance:** edit a drum hit at step 63; it loops correctly. Drag bass from 62 through 1 yields a four-step wrapped hold. A bass-only pattern plays without a drum row.

### 3. Grid/pad/audio translation and independent banks (Priority 3)
- **Goal:** the score visibly and audibly explains the physical Beat’s mapping.
- **API contract:** add `Bank = "ROK" | "HIP" | "TEC" | "BOX"`; pattern-owner state holds `drumBank` and `bassBank`. `playDrum`, `playDrumAt`, `previewBass`, `attackBass`, and sequenced bass receive/read the active mode bank without storing it in events.
- **Data model:** bank values are top-level v1.1 pattern fields (serialized in EPIC 2). Existing events do not change when a bank changes.
- **Key decisions:** ROK uses current sounds unchanged. HIP/TEC/BOX are a small effects/voice configuration over the same assets; no downloaded sample packs, effect editor, or per-row bank. Changing drum bank retimbres all drum playback immediately; bass bank does the same for bass only.
- **Acceptance:** a grid event audibly triggers and highlights its exact pad. Select ROK drums + TEC bass, start playback, then switch drum bank: drums change immediately while bass remains TEC. No event data mutates from a bank change.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | V1.1 pattern schema and 64-step clock | Done | 2026-07-15 | `STEPS = 64` pattern and `32n` two-bar transport verified; pure 63→0 checks and production build pass. |
| 2 | 64-step grid and snapped bass holds | Done | 2026-07-15 | 64 visible score columns, step-33 divider, derived wrapped bass holds, and accessible length editing verified. |
| 3 | Grid/pad/audio translation and independent banks | Done | 2026-07-15 | Independent pattern-level profiles, bank-aware audio routes, and scheduled exact-pad projection verified. |
