# v1 bug-resolution tracker

This is the single source of truth for remediation progress. Work proceeds in strict order among unblocked items; development effort does not influence priority.

## Ticket rollup

| Ticket | Severity | Status | Completion rule |
|---|---|---|---|
| BUG-002 | Critical | In progress | R1–R6 and R11 implemented and verified; the core drum order is already locked in R10. |
| BUG-001 | High | In progress | Revised R7–R9 specification is locked; all three implementation rows and R11 regression must pass. R7–R9 done; R11 remains. |

## Resolution tracker

| Order | ID | Ticket | Work item | Severity | Complexity | Depends on | Status | Session | Evidence / notes |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | R1 | BUG-002 | `DRUM_BY_PAD`, selected runtime assets, schema v2, and schema-v1 migration | Critical | Medium | — | Done | 2026-07-14 | [Evidence](executions/R1-drum-contract-and-schema-migration.md): exact pad model, v2 writes, v1 migration, and approved asset hashes verified. |
| 2 | R2 | BUG-002 | Twelve-pad audio, pattern, reduction, editor, cue, and hit-check integration | Critical | Medium | R1 | Done | 2026-07-14 | [Evidence](executions/R2-twelve-pad-integration.md): all editor rows and runtime paths retain exact `PadId`. |
| 3 | R3 | BUG-002 | Continuous live bass attack, hold, slide, and release for pointer + keyboard | Critical | Medium | — | Done | 2026-07-14 | [Evidence](executions/R3-continuous-live-bass.md): separate live/sequenced voices, coordinate slides, and release-path checks. |
| 4 | R4 | BUG-002 | Length-aware bass recording and legato sequenced playback | Critical | Medium | R3 | Done | 2026-07-14 | [Evidence](executions/R4-bass-recording-and-playback.md): quantized hold/slide capture, loop-aware duration resolution, and legato sequenced voice verified. |
| 5 | R5 | BUG-002 | Replace laser click with attenuated sampled click | High | Low | — | Done | 2026-07-14 | [Evidence](executions/R5-sampled-metronome-click.md): byte-matched Stick asset, −18 dB bus, retained Transport schedule, and +3 dB maximum downbeat accent. |
| 6 | R6 | BUG-002 | Disable octave controls in DRUMS mode | Medium | Low | — | Done | 2026-07-14 | [Evidence](executions/R6-octave-mode-state.md): native disabled controls, disabled group semantics, and BASS-state restoration verified. |
| 7 | R7 | BUG-001 | Compact chassis with exact control placement, physical pad-key geometry, symbol transport, and retained orange theme | High | Medium | R3 | Done | 2026-07-14 | [Evidence](executions/R7-compact-device-and-pad.md): physical key geometry, layered hit testing, 44px symbol transport, no pane scroll at 1280×720. Chassis frame retired and the control topology revised by user UAT on 2026-07-14 — BPM/tempo top-left, nameplate + beat dots top-right, horizontal DRUMS/BASS, octave matched to the profile grid height. |
| 8 | R8 | BUG-001 | Fixed 12×32 mode-projected grid with a separate aligned label rail | High | Medium | R2 | Done | 2026-07-15 | [Evidence](executions/R8-projected-step-grid.md): 12 rows projected by instrument mode, one shared 32-column template (header-to-row alignment delta 0.000px), fixed label rail, narrow-width plane scroll, and both stored layers verified intact across a mode round trip. |
| 9 | R9 | BUG-001 | Bottom-right Upload/Download array and two accessible utility modals | High | Medium | — | Done | 2026-07-15 | [Evidence](executions/R9-utility-modals.md): `SourcePanel`/`LessonLibrary` moved into native-`<dialog>`-backed modals; overlay-click close, ×-button close, focus trap/return, 44px targets, and tooltips verified. A `display:flex` CSS bug that defeated the browser's default `dialog:not([open])` hiding (both dialogs open on load) was caught and fixed during verification. |
| 10 | R10 | BUG-002 | Lock the physical-device core drum order | Critical | Low | — | Done | UAT 2026-07-14 | [Evidence](executions/R10-core-drum-order.md): user-confirmed 12-pad order; all matching ROK candidates exist. |
| 11 | R11 | Cross-ticket | Responsive, accessibility, audio, data-migration, and full-flow regression | Critical | Medium | R1–R9 | In progress | 2026-07-15 | [Evidence](executions/R11-full-regression.md): build, sidecar tests, forbidden-pattern search, all 8 pure self-checks, full save/export/import round trip (exact `{step,pad}` + bass octave/length), modal accessibility, and a real keyboard-leak-through-an-open-modal regression (found and fixed) all verified. Blocked on human listening for audible click balance (40/120/240 BPM) and per-pad sample timbre — cannot be verified from this environment. |

> Status ∈ {Not started, In progress, Blocked, Deferred, Done}.

## Required evidence per item

Every completed row must link or name evidence under `docs/bugs/v1/executions/` and include:

- files changed and the locked decision implemented;
- automated checks and their results;
- browser/audio behavior observed, not merely compiled;
- regressions checked;
- any remaining UAT limitation.

## Completion policy

- A ticket remains open until every associated row is Done.
- R10's ordering decision is complete from user UAT; runtime sample timbre and level must still pass R11.
- Do not mark audio balance or slide feel Done from code inspection alone.
- If implementation reveals a locked decision is impossible, set the affected row to Blocked with concrete evidence. Do not silently substitute another architecture.
