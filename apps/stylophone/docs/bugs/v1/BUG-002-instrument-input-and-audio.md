# BUG-002 — Instrument input and audio fidelity

**Status:** Validated by Tech Bro · core ROK map locked
**Severity:** Critical (the replica cannot reproduce the device's core playing model)
**Complexity:** Medium (known input/audio patterns with a schema integration)
**UAT priority:** 1
**Related:** [BUG-001](BUG-001-main-workspace-layout.md)
**Authority:** [Official Stylophone BEAT product description](https://stylophone.com/product/stylophone-beat/)

## User impact

The replica currently behaves like a collection of short one-shot buttons, not a Stylophone. Bass cannot be held or slid between pads, recorded notes always play as fixed choppy steps, octave controls imply they affect drums, the metronome masks the instruments, and 12 physical drum pads collapse into only three sounds. These failures undermine practice transfer to the hardware.

## Verified causes

| Finding | Evidence | Verdict |
|---|---|---|
| Bass ends after a fixed short note | `src/audio.ts:64` uses `triggerAttackRelease(..., "8n")`; the source sample is only `0.600s` long | Real bug |
| Sliding is absent | `src/BeatPad.tsx:68` exposes only `onClick`; no pointer attack/move/release state exists | Missing core interaction |
| Recorded bass remains choppy | `src/App.tsx:253` always stores `length: 1`; `src/App.tsx:145` / `src/audio.ts:85` ignore stored length during playback | Real bug |
| Octave remains active in drums mode | `src/TransportControls.tsx:89` disables only at the octave limits, never by `mode` | Real bug |
| Click sounds synthetic and dominates | `src/transport.ts:23` uses a destination-connected `MembraneSynth`; line 53 fires C5/C4 at velocities `1.0/0.5` with no click bus attenuation | Real bug |
| Twelve pads collapse into three voices | `src/audio.ts:17` divides `PAD_IDS` into thirds; `src/pattern.ts:15` and schema v1 store only kick/snare/hat | Structural bug |

The official device description explicitly says the pad is played by **tapping and sliding**, and that **each segment plays a different drum or bass sound**. The current behavior contradicts both properties.

## Tech Bro call

Do not add a gesture library, custom audio scheduler, or a new state framework. Tone.js and Pointer Events already solve this. The minimum honest fix is:

1. One explicit 12-pad drum configuration.
2. One monophonic live bass voice with attack / change-note / release.
3. The existing `length` field finally honored for recording and playback.
4. One quiet sampled click instead of a synthesized laser.
5. Native `disabled` controls in drums mode.

## Resolution 1 — twelve independent drum pads

### Locked ROK map

The user confirmed the physical device's core drum order on 2026-07-14. The pad-to-voice order below is authoritative for v1. The source WAV column selects the matching ROK candidate from the supplied library; timbre and level still require audible regression testing.

| Pad | Voice | Source file |
|---|---|---|
| `1` | Kick drum | `StylophoneSamples/Drums/Rok/Bd1.wav` |
| `1.5` | Clap | `StylophoneSamples/Drums/Rok/Clap.wav` |
| `2` | Snare drum | `StylophoneSamples/Drums/Rok/Snar1.wav` |
| `2.5` | Rimshot | `StylophoneSamples/Drums/Rok/Rim.wav` |
| `3` | Claves | `StylophoneSamples/Drums/Rok/Clave.wav` |
| `4` | Open hi-hat | `StylophoneSamples/Drums/Rok/Ohh1.wav` |
| `4.5` | Closed hi-hat | `StylophoneSamples/Drums/Rok/Chh1.wav` |
| `5` | Low tom | `StylophoneSamples/Drums/Rok/Tom2.wav` |
| `5.5` | Mid tom | `StylophoneSamples/Drums/Rok/Tom4.wav` |
| `6` | High tom | `StylophoneSamples/Drums/Rok/Tom1.wav` |
| `6.5` | Crash cymbal | `StylophoneSamples/Drums/Rok/Crash.wav` |
| `7` | Ride cymbal | `StylophoneSamples/Drums/Rok/Ride1.wav` |

### Lean implementation

- Copy only the 12 selected WAVs into `public/rok/` under stable pad-based names. Do not ship or scan the entire source library at runtime.
- Define one `DRUM_BY_PAD: Record<PadId, { label; sample; reductionClass }>` map. This is the only drum-pad source of truth for audio, grid labels, cueing, and reduction fallback.
- Replace three `Tone.Player`s with `Record<PadId, Tone.Player>` routed through one shared drum volume bus.
- Change the in-memory pattern to `drums: Record<PadId, boolean[]>`; these render as the 12 rows of the grid only while DRUMS mode is active.
- Bump lesson data to **schemaVersion 2** with drum hits shaped as `{ step, pad }`. Do not persist a redundant `sound`; derive label and coarse class from `DRUM_BY_PAD`.
- Accept schema v1 on import/load and migrate once: `kick → 1`, `snare → 1.5`, `hat → 2`. Save only v2.
- Reduction remains three-class in v1: detected kick/snare/hat events map to those same canonical pads. Hand-authoring can use all 12.
- Guided cues and hit checks match exact `pad`, not a coarse sound zone.

### Grid projection contract

- Keep one fixed 12×32 grid component. Pass the existing `mode` into it; do not create independent grid-tab state.
- DRUMS mode projects `Pattern.drums` as 12 pad/sample rows.
- BASS mode projects `Pattern.bass` into 12 pitch-class rows. A note appears at the row for its `pad` and the column for its `step`, with the stored octave shown inside or beside the active cell.
- Use consistent sharp names matching the native pad mapping: C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B.
- Mode switching changes visibility and edit routing only. Drum and bass data remain loaded and both layers continue sounding during transport playback.

## Resolution 2 — held and sliding bass

### Lean implementation

- Replace the fixed-duration bass sampler path with two existing-dependency `Tone.MonoSynth` voices: one for live input and one for sequenced playback. Separate voices prevent a live touch from cutting off the loop.
- Keep `bassNote(pad, octave)` as the pitch mapper.
- Expose a tiny audio API:
  - `attackBass(pad, octave)` — begin and sustain one note.
  - `moveBass(pad, octave)` — call `setNote` on the active voice with a very short portamento; do not release to silence between adjacent pads.
  - `releaseBass()` — end on pointer/key release, pointer cancel, mode switch, transport stop, and component teardown.
- In `BeatPad`, use native pointer events and one active pointer id. Convert pointer coordinates to a pad id during movement so touch implicit capture cannot block cross-wedge sliding. Do not add a gesture dependency.
- Drums remain tap-triggered one-shots; hold/slide behavior is active only in bass mode.
- Keyboard parity is mandatory: Q–] keydown attacks/changes the monophonic bass voice and keyup releases it.

### Recording and playback contract

- While REC is armed, pointer/key down starts a bass note at the quantized 16th step.
- Holding updates that note's existing `length`; it does not create repeated 1-step attacks.
- Sliding closes the previous note at the boundary and starts the new pad without an audible silence gap.
- Pointer/key release closes the note. Length wraps correctly across step 31 → 0.
- Sequenced playback honors `BassCell.length`; adjacent bass notes change pitch on the active sequenced voice instead of re-triggering an envelope every step.
- Stopping transport releases both bass voices so no note can hang.

## Resolution 3 — octave state by mode

- In drums mode, both octave buttons receive native `disabled`; the readout group receives `aria-disabled="true"` and the same visual disabled treatment.
- Preserve the selected octave while in drums mode. Switching back to bass restores it; do not reset state.
- Programmatic drum playback never reads octave.

## Resolution 4 — metronome timbre and level

- Remove `Tone.MembraneSynth` from the click path.
- Copy `StylophoneSamples/Drums/Rok/Stick.wav` as the click asset and play it through `Tone.Player` on the existing Tone.Transport schedule.
- Route click through its own volume bus, initially **−18 dB** relative to destination; downbeats may be 3 dB louder than regular beats.
- Keep the click audibly below the quietest drum and bass voice. Tune the final bus level by ear on headphones and laptop speakers; numeric gain is a starting point, not a substitute for UAT.
- Do not add a mixer UI in v1. Revisit only if one fixed calibrated level fails across the supported devices.

## Execution order

| Priority | Change | Severity | Complexity |
|---:|---|---|---|
| 1 | 12-pad data/audio map + schema v2 migration | Critical | Medium |
| 2 | Continuous bass attack/slide/release + length-aware REC/playback | Critical | Medium |
| 3 | Sampled, attenuated metronome | High | Low |
| 4 | Disable octave controls in drums mode | Medium | Low |

Severity and complexity are business/conceptual metrics; coding effort is deliberately ignored.

## Acceptance criteria

### Drum pads

- Every numbered wedge triggers one and only one distinct sample in the locked order: 1 Kick, 1.5 Clap, 2 Snare, 2.5 Rimshot, 3 Claves, 4 Open Hi-Hat, 4.5 Closed Hi-Hat, 5 Low Tom, 5.5 Mid Tom, 6 High Tom, 6.5 Crash, and 7 Ride.
- PLAY+REC stores the exact physical drum pad and round-trips it through save/export/import; DRUMS mode projects it onto the corresponding one of 12 rows.
- BASS mode projects every stored note onto its pitch-class row with the correct octave; switching modes does not alter either layer.
- Old schema-v1 lessons load into canonical kick/snare/hat pads without data loss; new saves are v2.
- Auto-reduced kick/snare/hat drafts still populate the canonical three pads.

### Bass

- Pointer down sustains bass for as long as contact is held; pointer up/cancel always releases.
- Sliding clockwise/counter-clockwise across multiple pads changes pitch continuously without silent gaps or stacked notes.
- Mouse, touch/pen, and keyboard paths obey the same monophonic contract.
- A held recorded note loops as one sustained note with the stored length; a slide loops as adjacent legato note changes rather than repeated choppy 16ths.
- Mode switches and transport stop cannot leave a hanging bass voice.

### Controls and click

- Octave decrement/increment are unavailable and visibly disabled in drums mode, then restore in bass mode without losing the octave value.
- Click is short and percussive, not pitch-swept, and remains below every instrument voice at 40, 120, and 240 BPM.
- Downbeat remains distinguishable without overpowering the pattern.
- Tone.Transport remains the only timing source; no `setInterval` or parallel scheduler is introduced.

## Resolved core drum map

The physical-device voice order is user-confirmed as of 2026-07-14, so no external sample-order gate remains. The selected ROK WAV for each voice must still be audited by ear during full regression for recognizability, relative level, and device fidelity; any timbral substitution stays isolated to `DRUM_BY_PAD` and does not change the schema or engine.
