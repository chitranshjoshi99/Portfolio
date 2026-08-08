# Beats Drum Machine Coach — v1.4

Browser-first groove coach for curious non-musicians; hardware is optional. First win: independently create a two-bar groove with three drum layers and bass. Patterns/Transpose are secondary performance exploration.

**Wedge:** a guided, playable Stylophone-pad mental model—not a DAW or song bank.
**Status:** planned; pre-build audit required.

## Epics

| Epic | Goal | Doc |
|---|---|---|
| 1 | Four-pattern local bank + timed swap | [EPIC-1](EPIC-1-pattern-bank.md) |
| 2 | Pattern, Transpose, Delete modes | [EPIC-2](EPIC-2-instrument-modes.md) |
| 3 | Compact safe Save/Load | [EPIC-3](EPIC-3-local-documents.md) |
| 4 | Stable polished controls | [EPIC-4](EPIC-4-control-polish.md) |

## Locked product-wide decisions

- React, TypeScript, Vite and existing Tone.js only; no Context, backend, accounts, sync, animation library, or AI integration.
- Global sound profiles; slots hold notes only. Slots 1–4 persist locally. A playing selection queues; latest wins; audio/grid/active state swap together at next loop boundary.
- `.beatcoach` is strict JSON: `{ bpm, patterns: { "1"…"4" } }`, reusing the existing v4 sparse pattern shape. Pattern holds sparse drum hits (`Partial<Record<PadId, number[]>>`) plus a step-indexed monophonic bass list `{ step, pad, octave, length }`; `length` wraps the two-bar loop, matching the engine. No envelope fields (id/title/version/bank), no legacy support.
- Import via valid file or paste only; one parser, all-or-nothing. Copy a generic original-groove schema prompt only—not song-specific material.
- Icon-first controls retain accessible names/tooltips. Respect reduced motion.

## Net tracker

| Epic | # | Story | Severity | Priority | Status |
|---|---|---|---|---:|---|
| 3 | 1 | Four-slot document/persistence | Critical | 1 | Done |
| 1 | 1 | Author/select four slots | High | 2 | Done |
| 1 | 2 | Queue loop-boundary swap | High | 3 | Done |
| 1 | 3 | Active-pattern lesson lock | High | 4 | Done |
| 2 | 1 | Pattern/Delete modes + undo | High | 4 | Done |
| 2 | 2 | Held-pad transpose | Medium | 5 | Done |
| 4 | 1 | Stable lesson/grid controls | High | 6 | Done |
| 4 | 2 | Tokens and motion | Medium | 7 | Done |
