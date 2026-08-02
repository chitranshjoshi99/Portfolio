# Execute — autonomous v1 bug-resolution handoff

Implement the remediation defined in [README.md](README.md), [TRACKER.md](TRACKER.md), [BUG-002](BUG-002-instrument-input-and-audio.md), and [BUG-001](BUG-001-main-workspace-layout.md). Continue across sessions without asking the user to choose routine implementation details already locked in these documents.

## Source-of-truth order

1. `TRACKER.md` — status, dependency, and resume point.
2. `BUG-002-instrument-input-and-audio.md` — functional/audio contract.
3. `BUG-001-main-workspace-layout.md` — layout/design contract.
4. `README.md` — cross-ticket locks and resolved UAT decisions.
5. `docs/product/v1/` — original product contracts that remain valid unless explicitly revised by these bug tickets.

When a bug ticket conflicts with the original product docs, the newer bug ticket wins for v1 remediation.

## Each implementation session

1. Read this file, `README.md`, `TRACKER.md`, and the ticket for the next item.
2. Inspect the worktree and preserve unrelated or user-owned changes, including the source sample library.
3. Select the lowest-order **Not started** row whose dependencies are Done. Skip Blocked rows and continue with the next unblocked item.
4. Set that row to **In progress** before editing.
5. Implement the smallest change that satisfies the ticket contract. Do not re-litigate locked decisions.
6. Verify behavior in proportion to risk. Compilation alone is never enough for input, audio, grid, modal, or migration work.
7. Create or update `docs/bugs/v1/executions/<ID>-<slug>.md` with the evidence listed in `TRACKER.md`.
8. Set the row to **Done**, or **Blocked** with the exact reason and evidence. Update the ticket rollup when all of its rows are complete.
9. Commit the coherent work item with a conventional commit referencing the bug and resolution id.
10. If budget remains, continue to the next unblocked row. Otherwise stop cleanly; `TRACKER.md` is the resume point.

## Strict implementation order

### R1 — drum contract and schema migration

- Create a single `DRUM_BY_PAD` configuration keyed by all 12 `PadId` values.
- Copy only the locked runtime WAVs from `StylophoneSamples/Drums/Rok` into stable names under `public/rok`; never alter the source files.
- Change drum hits to schema v2 `{step,pad}` and save only v2.
- Accept and migrate schema v1: kick → `1`, snare → `1.5`, hat → `2`.
- Add round-trip, rejection, and migration self-checks before moving on.

### R2 — twelve-pad integration

- Replace the three-player drum zone with one `Tone.Player` per physical pad through a shared drum bus.
- Make `Pattern.drums` a 12-pad record.
- Thread exact pad identity through recording, grid editing, lesson serialization, guided cues, and hit feedback.
- Keep reduction three-class for v1; map kick/snare/hat drafts to the canonical pads from R1.
- Remove coarse-zone assumptions such as choosing an arbitrary representative `DRUM_PAD` for cues.

### R3 — continuous live bass

- Use Tone.js already in the project; add no gesture or state dependency.
- Provide separate monophonic live and sequenced bass voices.
- Implement attack, change-note, and release. Coordinate-based pointer hit testing must work under touch/pen implicit capture.
- Provide keyboard keydown/keyup parity.
- Release on pointer cancel, mode switch, transport stop, blur/unmount, and every error/escape path that could leave a note hanging.

### R4 — bass recording and playback

- Use the existing bass `length` field rather than inventing a second duration model.
- A hold extends one recorded note; a slide closes the prior note and starts the next at the quantized boundary.
- Handle step 31 → 0 loop wrap.
- Sequenced playback sustains for stored length and changes adjacent pitches legato instead of re-triggering every 16th.

### R5 — metronome

- Remove the `Tone.MembraneSynth` click.
- Use the copied `Stick.wav` through its own volume bus, starting at −18 dB with downbeat no more than +3 dB.
- Keep the existing Tone.Transport schedule and beat callbacks unchanged.
- Do not add a mixer UI.

### R6 — octave mode state

- Use native `disabled` on octave buttons during DRUMS mode and `aria-disabled` on the group/readout.
- Preserve the octave value and restore controls in BASS mode.
- Switching away from BASS releases a held live bass voice without affecting sequenced playback.

### R7 — compact device and pad

- Build one approximately 3:2 device chassis using the locked spatial contract: BPM top-right with tempo directly below; 2×2 profile selector mid-left; vertical octave immediately left of the dominant mid-right pad; symbol transport bottom-left; DRUMS/BASS bottom-middle.
- Use metronome, play-stop, and record inline SVG controls with accessible names, tooltips, pressed states, and 44px targets.
- Render natural keys as a continuous full-depth base that meets edge-to-edge along the inner lane. Place each `.5` key between its neighboring natural keys at approximately half radial depth, like a black piano key.
- Preserve R3 coordinate mapping and test two BASS drag paths: inner `1 → 2` changes directly with no gap or `1.5`; outer `1 → 1.5 → 2` selects all three deliberately.
- Keep `.5` targets accessible without expanding their hit regions into the inner natural-key lane.
- Retain the current orange global accent and matte-charcoal theme. Soft-white stays neutral/text contrast; green stays limited to correct-hit feedback.
- Keep HIP, TEC, and BOX profile cells natively disabled while ROK is the only implemented v1 bank.

### R8 — 12×32 projected grid

- Use the existing instrument `mode` as the only projection state.
- DRUMS renders 12 pad/sample rows with hardware + voice labels.
- BASS renders 12 pitch rows with consistent sharps and visible octave on filled cells.
- Mode switching changes only visibility/edit routing; both layers remain stored and audible.
- Place row labels in a fixed-width rail outside the step-plane column calculation. The header and every row must share one 32-column template, gaps, and padding so all centerlines align.
- Replace conflicting `aspect-ratio`/minimum geometry. Fit all 32 columns at the desktop target; below it, horizontally scroll only the aligned step plane while the labels remain fixed.

### R9 — utility modals

- Remove persistent `SourcePanel` and `LessonLibrary` from the canvas.
- Add an Upload/Download icon array at the visualizer bottom-right.
- Upload opens the Source / Clip dialog. Download opens the Save Lesson / Import Lesson dialog.
- Reuse the existing feature components inside dialogs; do not rebuild their business logic.
- Dialogs require labelled semantics, focus trap, Escape/overlay close, return focus, and unchanged validation/status/data-loss protection.

### R10 — core drum order (completed UAT decision)

- The user confirmed the physical order on 2026-07-14: 1 Kick, 1.5 Clap, 2 Snare, 2.5 Rimshot, 3 Claves, 4 Open Hi-Hat, 4.5 Closed Hi-Hat, 5 Low Tom, 5.5 Mid Tom, 6 High Tom, 6.5 Crash, and 7 Ride.
- Preserve that order in `DRUM_BY_PAD`; do not substitute an ergonomic or filename-inferred arrangement.
- The matching source-WAV timbre and relative levels remain observable checks in R11.

### R11 — complete regression

- Run the automated and observable checks below.
- Fix regressions before marking Done; do not create follow-up debt for failures introduced by remediation.
- R10 is already Done. All implementation rows and observable regression checks must pass.

## Non-negotiable rules

- Tone.Transport / Tone.Draw remain the only timing sources. No `setInterval` sequencer.
- No gesture library, global state library, alternate lesson model, or second grid-mode state.
- `DRUM_BY_PAD` is the only source of drum label/sample/class mapping.
- Hidden grid layers are never deleted or muted by view switching.
- Source samples remain untouched and are never loaded dynamically from `StylophoneSamples` in production.
- Schema migration is explicit and tested; imported invalid data never mutates the current editor.
- Modal extraction must preserve upload/reduction, save/load, import/export, errors, busy state, and dirty-data protection.
- Icon-only controls retain accessible names, focus indicators, tooltips, pressed/disabled state, and ≥44px effective targets.
- Reduced-motion and non-color state cues remain intact.

## Verification matrix

### Automated

- `npm run build`
- Existing pure self-checks plus new schema-v1→v2, 12-pad round-trip, and bass-duration checks.
- `sidecar/.venv/bin/python -m pytest sidecar`
- Search for forbidden regressions: no new `setInterval`; no coarse three-zone drum mapping on the runtime path; no second grid projection state.

### Browser behavior

- At 1280×720 with dialogs closed: no vertical scroll in either pane; full device and grid visible.
- All 32 columns remain distinct; narrower layouts scroll rather than overlap.
- DRUMS/BASS changes instrument input and grid projection together while both loop layers remain audible.
- Every drum pad records, displays, saves, reloads, exports, imports, cues, and grades as the same exact pad.
- Upload opens Source / Clip and Download opens Save Lesson / Import Lesson; both close through all supported paths, trap/restore focus, and preserve existing workflows.
- Keyboard navigation, keyboard playing, focus rings, reduced motion, and visible non-color state cues remain functional.

### Audio/input behavior

- Mouse, touch/pen, and keyboard bass input sustains, slides without a silent gap, and always releases.
- Held/slide recording loops with correct lengths and legato transitions, including loop wrap.
- Click is short and non-pitched, remains below instruments at 40/120/240 BPM, and preserves a restrained downbeat accent.
- Every pad uses the locked voice order, and each selected source WAV is audibly recognizable and balanced for its assigned voice.
- Octave controls are disabled only in DRUMS and restore the prior octave in BASS.
- Stopping transport or changing mode cannot leave a hanging live note.

### Data safety

- Schema-v1 lessons migrate without losing kick/snare/hat or bass notes.
- Schema-v2 lessons preserve all 12 drum pads and bass octave/length through local save and JSON export/import.
- Invalid JSON, unsupported versions, or invalid pad ids produce a visible error and leave the current editor untouched.

## Stop conditions

- If a locked contract proves impossible, mark the relevant row Blocked with evidence and surface it to the user.
- Do not call the remediation complete while any row is Not started, In progress, or Blocked.
