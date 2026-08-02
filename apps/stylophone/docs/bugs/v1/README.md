# Stylophone Beat Coach — v1 UAT remediation

This folder is the source of truth for resolving post-build v1 bugs and UAT findings. The remediation restores physical-device fidelity, fixes the core audio/input model, and reshapes the workspace around a compact instrument plus a stable mode-projected sequencer.

**Status:** Planned · implementation not started
**Tracker:** [TRACKER.md](TRACKER.md)
**Autonomous handoff:** [execute.md](execute.md)

## Resolution tickets

| Priority | Ticket | Severity | Goal | Status |
|---:|---|---|---|---|
| 1 | [BUG-002 — Instrument input and audio fidelity](BUG-002-instrument-input-and-audio.md) | Critical | Restore continuous bass interaction, twelve independent drum pads, correct mode behavior, and balanced click audio. | Not started |
| 2 | [BUG-001 — Main workspace layout and visual hierarchy](BUG-001-main-workspace-layout.md) | High | Replace the scrolling component stack with a compact hardware-shaped device and a stable 12×32 grid. | Not started |

## Locked v1 remediation model

- **Grid:** one fixed **12-row × 32-step** surface.
- **Projection:** the existing DRUMS/BASS instrument mode is the single source of truth for what the grid displays and edits.
- **DRUMS:** 12 independent physical pad/sample rows, each preserving exact `PadId`.
- **BASS:** 12 chromatic pitch rows labelled `1 · C` through `7 · B`; active cells expose octave `−2…+2`.
- **Playback:** switching grid projection never deletes, rewrites, or mutes the hidden layer. Both stored layers continue playing.
- **Data:** lesson schema v2 stores drum hits as `{ step, pad }`; schema-v1 lessons migrate kick/snare/hat to canonical pads.
- **Bass interaction:** pointer/key attack, held sustain, slide-to-note, and release; recorded and sequenced notes honor length.
- **Timing:** Tone.Transport remains the only scheduler. No parallel clock or `setInterval` sequencer.
- **Device layout:** compact approximately 3:2 chassis with BPM/tempo at top-right, profiles mid-left, vertical octave beside the dominant mid-right pad, symbol transport bottom-left, and DRUMS/BASS bottom-middle.
- **Profile control:** a 2×2 `ROK / HIP / TEC / BOX` selector; only shipped profiles may be enabled.
- **Pad geometry:** natural keys meet edge-to-edge along an uninterrupted inner traversal lane; `.5` keys sit between them at half radial depth without stealing that lane.
- **Utilities:** a bottom-right upload icon opens Source / Clip; download opens Save Lesson / Import Lesson.
- **Theme:** retain the current orange-accented matte-charcoal theme; soft-white is neutral/text contrast and green remains semantic hit confirmation only.
- **Assets:** source WAVs under `StylophoneSamples/Drums` remain untouched. Only approved runtime samples are copied into `public/rok`.

## Resolved core drum map

The user confirmed the physical-device order on 2026-07-14: 1 Kick, 1.5 Clap, 2 Snare, 2.5 Rimshot, 3 Claves, 4 Open Hi-Hat, 4.5 Closed Hi-Hat, 5 Low Tom, 5.5 Mid Tom, 6 High Tom, 6.5 Crash, and 7 Ride. There is no remaining external mapping blocker. [BUG-002](BUG-002-instrument-input-and-audio.md) locks the matching ROK source candidates; their timbre and balance remain part of observable audio regression.

## Working files

| Path | Purpose |
|---|---|
| `BUG-*.md` | Validated problem, locked resolution, and acceptance criteria. |
| `TRACKER.md` | Master implementation status and dependency order. |
| `execute.md` | Instructions for autonomous implementation across sessions. |
| `assets/` | UAT references such as the physical-device image. |
| `executions/` | Per-work-item implementation evidence created during remediation. |

Status changes are made in [TRACKER.md](TRACKER.md), not inferred from code or commit history.
