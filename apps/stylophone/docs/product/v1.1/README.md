# Stylophone Beat Coach — v1.1

Stylophone Beat Coach v1.1 is a local, desktop-first pattern composer and recording guide for an owner of the physical Stylophone Beat. The app makes a two-bar, 8-beat pattern legible as a 64-step grid, translates every event to the circular pad, and guides the owner through recording each populated drum row and then bass on their hardware.

**Wedge:** grid-to-Beat translation, not a laptop replica.
**Status:** Done — Epic 4 Story 1 single-chassis layout rework verified at the target desktop sizes.

## Epics

| Epic | Title | Goal | Doc |
|------|-------|------|-----|
| 1 | Grid-first pattern engine | Author and hear a correct 64-step pattern. | [EPIC-1](EPIC-1-grid-pattern-engine.md) |
| 2 | Durable local pattern | Keep one safe local draft and exchange v1.1 JSON. | [EPIC-2](EPIC-2-durable-local-pattern.md) |
| 3 | Hardware companion guidance | Turn a pattern into honest row-by-row hardware guidance. | [EPIC-3](EPIC-3-hardware-companion-guidance.md) |
| 4 | Grid-first workspace | Make the score dominant and controls subordinate. | [EPIC-4](EPIC-4-grid-first-workspace.md) |

## Key locked decisions

- **Stack:** React 18 + TypeScript + Vite + Tone.js/Web Audio; browser `localStorage`, `Blob`, and file input only.
- **Pattern schema:** v1.1 JSON, fresh schema version `3`; reject legacy schemas. The pattern is the sole persisted source of truth.
- **Timing:** fixed 8-beat / 2-bar loop, `steps: 64`, Tone transport interval `32n`; no free-time bass in v1.1.
- **Audio:** preserve current 12 ROK pad assets. `drumBank` and `bassBank` are separate pattern-level values (`ROK|HIP|TEC|BOX`) that retimbre their entire instrument immediately. HIP/TEC/BOX are generated/processed previews, not hardware captures.
- **Guidance:** derive populated drum pads in visible pad order, then optional bass. Progress is user-confirmed via `Next row`; there is no hardware grading or sync. Any edit restarts the guide.
- **Design:** all 64 steps visible at supported desktop widths; grid is primary, circular pad is a compact synchronized translator. Active = bright/full, passed = dim/quieter, unreached = grey/silent.
- **Security:** strict import validation before atomic replacement; confirm before discarding unsaved draft; do not start/expose the deferred sidecar.
- **Release boundary:** personal/local use only. Do not publish or distribute this branded app or its audio until trademark, design, and asset rights have been separately cleared.
- **Explicitly deferred:** free-float bass, local catalogue/presets, Electron/PWA/mobile, song upload/reduction, hardware audio input/sync, exact hardware sample captures, scoring, and collaboration.

## v1.1 JSON contract

```json
{
  "schemaVersion": 3,
  "id": "uuid",
  "title": "Untitled Beat",
  "bpm": 120,
  "bars": 2,
  "steps": 64,
  "drumBank": "ROK",
  "bassBank": "TEC",
  "pattern": {
    "drums": { "1": [false], "1.5": [false], "2": [false], "2.5": [false], "3": [false], "4": [false], "4.5": [false], "5": [false], "5.5": [false], "6": [false], "6.5": [false], "7": [false] },
    "bass": [{ "pad": "1", "octave": 0, "length": 4 }]
  }
}
```

`drums[pad]` and `pattern.bass` each have exactly 64 entries. Drum entries are booleans. A bass entry is `null` or `{ pad: PadId, octave: -2..2, length: 1..64 }`; occupied spans cannot overlap. Bank is deliberately not stored on individual events.

## Net tracker

| Epic | # | User story | Severity | Priority | Status | Session | Notes |
|------|---|-----------|----------|----------|--------|---------|-------|
| 1 | 1 | V1.1 pattern schema and 64-step clock | Critical | 1 | Done | 2026-07-15 | `STEPS = 64` pattern and `32n` two-bar transport verified; pure 63→0 checks and production build pass. |
| 1 | 2 | 64-step grid and snapped bass holds | Critical | 2 | Done | 2026-07-15 | 64 visible score columns, step-33 divider, derived wrapped bass holds, and accessible length editing verified. |
| 1 | 3 | Grid/pad/audio translation and independent banks | High | 3 | Done | 2026-07-15 | Independent pattern-level ROK/HIP/TEC/BOX profiles, bank-aware audio routes, and scheduled exact-pad projection verified. |
| 2 | 1 | One local draft and safe reset/new flow | Critical | 4 | Done | 2026-07-15 | One local `stylophone-beat:v1.1:draft` restores on reload; edits autosave and New/Reset use explicit in-app replacement protection. |
| 2 | 2 | Strict v1.1 JSON import/export | High | 5 | Done | 2026-07-15 | Strict schema-v3 parse, 512 KiB cap, atomic replacement, safe export filename, and recoverable import errors verified. |
| 2 | 3 | Remove generator from active surface | Medium | 6 | Done | 2026-07-15 | Source/generator launcher, processing route, and modal removed from the active workspace; legacy files remain repository-only. |
| 3 | 1 | Derived row-by-row guide | Critical | 7 | Done | 2026-07-15 | Pure `derivePasses` order and visible guidance list verified for empty and populated patterns; no guide metadata is persisted. |
| 3 | 2 | Next/restart/redo and restart-on-edit | Critical | 8 | Done | 2026-07-15 | Ephemeral compose/guided/paused/complete lifecycle, manual Next/Restart/Redo, guided edit lock, paused/complete restart-on-edit, and REC/mode safeguards verified. |
| 3 | 3 | Guided visual/audio hierarchy | High | 9 | Done | 2026-07-15 | Shared derived active/passed/unreached state drives row labels/classes, pad echoes, and scheduled gain; unreached material is silent and passed context is -12 dB. |
| 4 | 1 | Single-chassis grid-first workstation | Critical | 10 | Done | 2026-07-15 | Reworked into one full-width header, dominant 64-step score band, and horizontal lower action deck with compact control rail, lesson actions, and lower-right visualizer pad; verified at 1280×720 and 1680×1046. |
| 4 | 2 | Mode-aware compact controls and REC states | High | 11 | Done | 2026-07-15 | Compact action strip exposes guidance/reset/import/export/cue actions; mode-owned banks, drum octave disablement, and Compose-only REC verified in the browser. |
| 4 | 3 | Accessibility and real desktop UAT | High | 12 | Done | 2026-07-15 | Keyboard pad audition, modal isolation, 44px visible controls, reduced-motion coverage, guided locks, pure self-checks, and clean 1280×720 browser UAT pass. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching epic tracker in every build session.
