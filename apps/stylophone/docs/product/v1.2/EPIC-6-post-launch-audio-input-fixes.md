# EPIC 6: Post-launch audio and input fixes

Four bugs surfaced in ad-hoc user testing after EPIC-2/4/5 shipped: bass reset losing
tempo, the bass synth reading as a trumpet instead of a plucked instrument, drum/bass bank
filters being too subtle (or, for BOX, too muffled) to tell apart, the visualizer octave
range being unreachable from the pad itself, and the visualizer lighting both voices
regardless of the selected mode. None of these are new product/UX — they're corrections to
behavior EPIC-1.1 and earlier v1.2 epics already shipped.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a user, I want Reset Pattern to clear the grid but keep my current tempo, so that I don't lose a tempo I dialed in while experimenting with a groove. | Medium | Low | 11 |
| 2 | As a user, I want the bass voice to sound like a plucked bass instead of a swelling brass patch, and the four drum/bass banks (ROK/HIP/TEC/BOX) to sound clearly distinct from each other, so that switching banks is audibly meaningful. | High | Medium | 12 |
| 3 | As a user playing bass on the visualizer pad, I want dragging across the 12 o'clock boundary to shift the octave up or down (clockwise = up, counter-clockwise = down), within the supported ±2 range, so that I can reach the full bass register without a separate control. | Medium | Medium | 13 |
| 4 | As a user running a groove, I want the visualizer to show only the drum map or only the bass map — whichever mode is selected — instead of lighting both voices at once, so that the labeled map matches what's actually shown. | Medium | Low | 14 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

- **Tech stack:** React 18 + TypeScript + Vite + Tone.js (unchanged).
- **Project structure:** no new files. `src/hooks/useDraftPersistence.ts` (Story 1),
  `src/lib/audio.ts` (Story 2), `src/components/BeatPad.tsx` +
  `src/hooks/useLiveInput.ts` + `src/components/VisualizerPad.tsx` (Story 3),
  `src/hooks/useTransportEngine.ts` + `src/App.tsx` (Story 4).
- **Architecture:**
  - Story 1: `performReplacement()` gains a `kind` parameter; `"reset"` seeds
    `createPatternDocument({ bpm })` with the current tempo, `"new"` keeps the existing
    default-BPM behavior. No new state.
  - Story 2: bass timbres were literally `Tone.MonoSynth`'s factory defaults for ROK (a
    0.6s filter-envelope attack over 3 octaves on a sawtooth — the textbook brass patch).
    Every bank's `filterEnvelope.attack` is now ≤20ms (a pluck, not a swell); character
    lives in decay/sweep depth/oscillator choice instead. Drum bank filters are retuned to
    sit inside the kit's actual energy band instead of past it.
  - Story 3: octave shift is derived from the angular jump between consecutive pointer
    samples on the visualizer's SVG dial — a jump >180° between samples can only mean the
    drag crossed 12 o'clock, since real pointer samples land far closer together than that.
    The shift is drag-local (resets per touch), added to the control-rail base octave, and
    clamped through the existing `clampOctave` (±2) — no new range or state.
  - Story 4: `useTransportEngine`'s per-step scheduler already computes which drum pads and
    which bass pad are sounding on each step; the fix is projecting those into two lists
    (`{ drums, bass }`) instead of one merged list, and having `App.tsx` pick the list
    matching the selected mode.
- **Deployment:** N/A this epic.
- **Security:** N/A — no new trust boundary in any story.
- **Design:** no new visual language in any story; Story 3 and 4 change existing pad/
  visualizer *behavior*, not appearance.
- **Legal/compliance:** N/A.
- **Data/market basis:** N/A.

## Execution instructions (priority order)

### 1. Preserve BPM on Reset Pattern  (Priority 11)
- **Goal:** clicking Reset clears the grid (new document id, title, banks) but keeps the
  tempo the user had dialed in, instead of snapping back to the default BPM.
- **Key decisions:** `requestReplacement("reset")` (previously sent `"new"`, which is why
  the confirm-dialog's "Reset this beat?" title was dead code) threads through to
  `performReplacement(kind)`, which seeds `createPatternDocument({ bpm })` only for
  `"reset"`. The "New beat" and import flows are unaffected.
- **Acceptance:** setting a non-default BPM, then clicking Reset (both the direct path and
  the dirty-draft confirm-dialog path), clears the grid while the BPM stays exactly where
  it was.

### 2. Rework bass and drum-bank timbres  (Priority 12)
- **Goal:** the bass voice reads as a bass, not brass; the four drum/bass banks are
  audibly distinct from one another, including BOX (previously a near-telephone muffle).
- **Key decisions:** all four `BASS_TIMBRES` entries get a near-instant
  `filterEnvelope.attack` (≤20ms). ROK is a punchy resonant saw pluck; HIP is a deep round
  triangle sub; TEC is an acid-adjacent fast-sweep saw stab; BOX is a tight dry square
  (moved from a narrow bandpass to a lowpass, which kept the square's body instead of
  thinning it). Both `liveBass` and `sequencedBass` `Tone.MonoSynth` instances are now
  constructed directly from the ROK timbre table (previously they used raw `MonoSynth`
  defaults until the first bank switch, since `applyBassBank` no-ops when the target bank
  matches the already-active one). Drum bank filters move well inside the kit's energy:
  HIP lowpass drops to 3.2kHz (was 6.8kHz, nearly inaudible), TEC highpass rises to 250Hz
  with more resonance (was 110Hz), BOX bandpass widens from Q3.5 to Q0.8 at 1.5kHz (lofi
  color without the telephone effect).
- **Acceptance:** cycling ROK→HIP→TEC→BOX on both the drum row and the bass row produces
  four audibly different characters each; the bass voice plucks rather than swells on
  every bank.

### 3. Octave wrap on visualizer bass drags  (Priority 13)
- **Goal:** dragging across the visualizer's 12 o'clock boundary (the one gap between pad
  7 and pad 1 with no half-step key) shifts the bass octave — clockwise (7→1) up,
  counter-clockwise (1→7) down — within the existing ±2 supported range.
- **Key decisions:** `BeatPad.tsx` tracks the angle of each in-ring pointer sample during a
  held bass drag; a jump exceeding 180° between consecutive samples is treated as a
  12-o'clock crossing and accumulates a drag-local octave shift (clamped ±4 internally,
  since the *effective* octave is clamped ±2 downstream — extra winding past the limit is
  simply inert, and unwinding still works). `onBassMove` gained an optional
  `octaveShift` parameter; `useLiveInput.ts`'s `handleBassMove` adds it to the base octave
  and clamps through the existing `clampOctave`. Keyboard-driven bass slides are
  unaffected (they never pass a shift).
- **Acceptance:** holding a bass drag and circling clockwise past 12 o'clock raises the
  pitch an octave per crossing, capping at the control rail's octave +2; circling back
  counter-clockwise unwinds it, capping at −2.

### 4. Visualizer shows only the selected mode's map  (Priority 14)
- **Goal:** during playback, the visualizer lights only the drum map in Drums mode and
  only the bass map in Bass mode, matching its own heading text.
- **Key decisions:** `useTransportEngine.ts`'s per-step scheduling effect already computes
  which drum pads and which bass pad are sounding; it now returns them as
  `{ drums: PadId[], bass: PadId[] }` instead of one merged array. `App.tsx` passes
  `transport.sequencedPads.drums` or `.bass` to `VisualizerPad` based on the currently
  selected `mode`.
- **Acceptance:** running a groove with both drum and bass content populated, switching
  between Drums and Bass mode changes which pads light on the visualizer — never both at
  once.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Preserve BPM on Reset Pattern | Done | 2026-07-17 | `performReplacement(kind)` seeds `createPatternDocument({ bpm })` only for `"reset"`; `handleResetPattern` now actually sends `"reset"` instead of `"new"`. `tsc --noEmit` clean. |
| 2 | Rework bass and drum-bank timbres | Done | 2026-07-17 | All 4 `BASS_TIMBRES` given a pluck envelope (filter attack ≤20ms); voices constructed from the ROK table instead of raw `MonoSynth` defaults. Drum bank filters retuned (HIP 3.2kHz lowpass, TEC 250Hz resonant highpass, BOX Q0.8 bandpass at 1.5kHz). Self-check assertions updated (pluck-attack invariant, new TEC/BOX identities). `tsc --noEmit` clean. |
| 3 | Octave wrap on visualizer bass drags | Done | 2026-07-17 | `BeatPad.tsx` detects a >180° angular jump between pointer samples as a 12-o'clock crossing, accumulates a drag-local shift; `useLiveInput.ts` clamps the effective octave through the existing `clampOctave`. Self-check extended with wrap-direction assertions. `tsc --noEmit` clean. |
| 4 | Visualizer shows only the selected mode's map | Done | 2026-07-17 | `useTransportEngine.ts`'s `sequencedPads` state split into `{ drums, bass }`; `App.tsx` feeds `VisualizerPad` only the list matching the selected mode. `tsc --noEmit` clean. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching net
> tracker in every build session.
