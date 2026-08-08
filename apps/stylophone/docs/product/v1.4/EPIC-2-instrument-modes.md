# EPIC 2: Pattern, Transpose and Delete modes

Instrument-faithful advanced exploration without corrupting saved notes or allowing a control gesture to leak into musical input.

## User stories
| # | User story | Severity | Complexity | Priority |
|---|---|---|---|---:|
| 1 | Select/clear patterns or rows through explicit pad modes. | High | Medium | 4 |
| 2 | Hold a pad to transpose active bass temporarily. | Medium | Medium | 5 |

## Input contract

Extend presentation state with explicit, mutually exclusive pad owners: normal drums/bass, Pattern, Transpose, and armed Delete. The rail keeps Drums/Bass primary; Pattern and Transpose are icon controls below them and above a reduced octave control. Any owner cancels with Escape; keyboard pad input is inert while it is active.

## Execution instructions

1. Pattern mode maps visualizer pads `1`–`4` to slots and makes all other pads inert. Selection uses EPIC 1 timing rules; it never triggers audio.
2. Delete is a lower-right visualizer icon. It arms exactly one action. In normal Drums/Bass presentation, tapping a pad clears that tapped row in the active slot. In Pattern mode, tapping slot pad 1–4 clears that complete slot. Then exit Delete.
3. Before a whole-slot clear, retain exactly one snapshot. Show Undo for 15 seconds; the first edit or slot switch cancels it. Undo restores that same slot only. Row clear has no Undo.
4. Enable Transpose only when playing, active slot contains bass, and lesson is inactive. Hold-pad mapping is `1=0`, `1.5=+1`, `2=+2`, `2.5=+3`, `3=+4`, `4=+5`, `4.5=+6`, `5=+7`, `5.5=+8`, `6=+9`, `6.5=+10`, `7=+11`. **Seam (AUDIT F2):** bass is voiced by `{pad, octave}`, not semitones — there is no semitone path today. Add an optional `semitoneOffset: number` (default 0) parameter to `playBassAt` in `src/lib/audio.ts` and thread it into the pad+octave→note computation so `+n` shifts the sounded pitch by `n` semitones without touching `BassCell`. Keep a held-offset ref (`0` when nothing held); read it at the **top of the `onStepAudio` bass branch** in `useTransportEngine` and pass it to `playBassAt`. Release, stop, lesson start, and bass clear all reset the ref to `0`. Never mutate or save note octaves.
5. Visualizer heading shows matching icon badge; active/queued/delete/transpose states have non-color cues plus accessible name/tooltips.

## Acceptance

- Modes never cause drum/bass sound or recording; Escape restores normal input.
- Delete clears only the requested target; slot Undo expires exactly on timeout/edit/switch.
- Held transpose audibly changes sequenced bass only while held; lesson start, bass clear, stop or release clears it.

## Tracker
| # | Status | Notes |
|---|---|---|
| 1 | Done | Execution: `docs/executions/v1.4/EPIC-2-story-1-explicit-pad-modes.json` |
| 2 | Done | Execution: `docs/executions/v1.4/EPIC-2-story-2-held-pad-transpose.json` |
