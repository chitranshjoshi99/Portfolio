# Lesson (PatternDocument) format — schema v4

An import-ready lesson file for the Beats Drum Machine Coach app. Author the
JSON, load it through **Save/Load Lesson → Import** in the app, and it becomes
an editable 2-bar practice groove with drum + bass guidance passes.

This doc is written to be handed to an LLM: paste it (plus
[`lesson-schema.v4.json`](lesson-schema.v4.json)) and ask for a lesson for a
specific song.

Validated by `src/lib/document.ts:validatePatternDocument`. Invalid files are
rejected on import with a message — the validator is the source of truth.

## The grid

- **2 bars, 64 steps.** Each step is a 16th note. Steps `0–63`, left to right.
  Bar 1 = steps `0–31`, bar 2 = steps `32–63`.
- One beat = 4 steps. Downbeats of bar 1 are `0, 4, 8, 12, 16, 20, 24, 28`.
- **12 drum pads**, native Stylophone chromatic layout. In the **ROK** bank:

  | Pad | Sound | Pad | Sound |
  |-----|-------|-----|-------|
  | `1` | Kick | `4.5` | Closed hi-hat |
  | `1.5` | Clap | `5` | Low tom |
  | `2` | Snare | `5.5` | Mid tom |
  | `2.5` | Rimshot | `6` | High tom |
  | `3` | Claves | `6.5` | Crash |
  | `4` | Open hi-hat | `7` | Ride |

  Half-step ids (`1.5`, `2.5`, `4.5`, `5.5`, `6.5`) skip where a piano has no
  black key — there is no `3.5` or `7.5`.

## Top-level fields

| Field | Value |
|-------|-------|
| `schemaVersion` | `4` |
| `id` | UUID v4 string (any valid one; generate a fresh one) |
| `title` | 1–80 chars |
| `bpm` | number, `40`–`240` |
| `bars` | `2` (fixed) |
| `steps` | `64` (fixed) |
| `drumBank` / `bassBank` | one of `ROK`, `HIP`, `TEC`, `BOX` (use `ROK`) |
| `pattern` | `{ drums, bass }` — see below |

## `pattern.drums` — sparse lanes

An object keyed by pad id. Each value is the **strictly ascending** list of
step indices where that pad fires. **Omit any pad that never fires** — do not
write empty arrays.

```json
"drums": {
  "1":   [0, 8, 16, 24, 32, 40, 48, 56],
  "1.5": [8, 24, 40, 56],
  "4.5": [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60]
}
```

Reads as: kick on every half-beat, clap on the backbeats, closed hi-hat on
every 16th.

## `pattern.bass` — sparse note list

An array of notes, **sorted by ascending `step`**, no two overlapping.

```json
"bass": [
  { "step": 0,  "pad": "5", "octave": -1, "length": 4 },
  { "step": 8,  "pad": "2", "octave": 0,  "length": 2 }
]
```

- `step` — where the note starts, `0`–`63`.
- `pad` — same 12 pad ids (bass is pitched; pad = which chromatic key).
- `octave` — integer `-2`–`2`, relative to the pad's base octave.
- `length` — how many steps it holds, `1`–`64`. A hold may **wrap** past step
  63 back to 0 (e.g. `step 62, length 4` sounds on 62, 63, 0, 1).
- **No overlap:** a note occupies `length` consecutive steps from `step`
  (wrapping mod 64); another note may not start inside that span.

## Full minimal example

```json
{
  "schemaVersion": 4,
  "id": "e860fd12-36fa-4bfa-a5d4-8d9fbcb86de5",
  "title": "example — four-on-the-floor",
  "bpm": 120,
  "bars": 2,
  "steps": 64,
  "drumBank": "ROK",
  "bassBank": "ROK",
  "pattern": {
    "drums": {
      "1":   [0, 8, 16, 24, 32, 40, 48, 56],
      "2":   [8, 24, 40, 56],
      "4.5": [4, 12, 20, 28, 36, 44, 52, 60]
    },
    "bass": [
      { "step": 0,  "pad": "1", "octave": -1, "length": 8 },
      { "step": 16, "pad": "5", "octave": -1, "length": 8 },
      { "step": 32, "pad": "3", "octave": -1, "length": 8 },
      { "step": 48, "pad": "1", "octave": -1, "length": 8 }
    ]
  }
}
```

## Authoring rules (checklist for a generator)

1. `schemaVersion: 4`, `bars: 2`, `steps: 64` — never change these.
2. Fresh UUID v4 in `id`.
3. Drum step lists strictly ascending, `0`–`63`, one entry per hit; omit silent
   pads entirely.
4. Bass notes sorted by `step`; no two notes' spans overlap.
5. Keep it a **concise study**, not a note-for-note transcription — populate
   both drums and bass so the app emits both guidance passes.

## Older schema v3

The app still **reads** the older dense v3 format (12 lanes × 64 booleans, plus
a 64-slot bass array of null-or-cell) and normalizes it to v4 on import, but
**writes v4 only**. Generate v4.
