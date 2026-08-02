# EPIC 3: Authoring & Library

The human-in-the-loop that turns a rough draft into a correct, playable lesson — and the local library that keeps them. Hand-correction is the moat: it's why an imperfect `reduce()` is acceptable. The editor is a shared surface with the instrument grid (EPIC 1), so editing and playing use the same 16-step model.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|-----------|----------|
| 3.1 | As the user, I want to edit the drafted pattern (add/remove/move drum hits, set bass note + octave per step) so I can fix transcription errors into a correct lesson. | Critical | Medium | 8 |
| 3.2 | As the user, I want to save/name/load lessons locally and export/import them as a file so I keep a personal library and can move lessons between devices. | High | Low | 9 |
| 3.3 | As the user, I want to start a lesson from scratch so I'm never blocked on the pipeline. | Medium | Low | 10 |

> Severity & complexity are business/conceptual.

## Locked decisions

See [README](README.md). Epic-specific:

- **Editor operates on the Lesson schema** (README) — the same in-memory model the instrument and guided-play read. No separate edit format.
- **Persistence = `localStorage`.** Key per lesson by `id`; store the JSON. No IndexedDB in v1.
- **Export/import = a `.json` file** (download / file-input). This is the only cross-device sync in v1 — manual and deliberate.
- **New-from-scratch = an empty lesson** in the same editor (empty layers, default bpm/bank/steps).

## Execution instructions (priority order)

### 1. Grid editor — S3.1 (Priority 8)
- **Goal:** every part of a lesson is editable on the 16-step grid.
- **API contract (state):** operations on the in-memory lesson — `toggleDrumHit(step, sound)`, `setBassNote(step, pad, octave, length)`, `clearStep(step, layer)`. Editing plays the sound for immediate feedback.
- **Data model:** the Lesson schema `layers` array (drums `hits`, bass `notes`).
- **Key decisions:** reuse the EPIC 1 grid; add edit affordances (click to place/remove, pick sound for drums, pick pad+octave for bass). Live audition on edit. No undo stack required in v1 (revisit if painful).
- **Acceptance:** can transform a draft into a target pattern — add/remove kick/snare/hat on any step, set/adjust any bass note's pitch and octave; changes reflect on both panes and in playback immediately.

### 2. Lesson persistence + export/import — S3.2 (Priority 9)
- **Goal:** a local library of named lessons, plus file export/import.
- **API contract (state):** `saveLesson(lesson)`, `listLessons()`, `loadLesson(id)`, `deleteLesson(id)`, `exportLesson(id) -> download .json`, `importLesson(file) -> lesson`.
- **Data model:** `localStorage` — an index of `{id, title, updatedAt}` + per-lesson JSON. Fill `id` (uuid) + `title` on save.
- **Key decisions:** validate imported JSON against `schemaVersion` + shape before loading; reject/normalize mismatches. Simple list UI (no thumbnails — that's v1.1 Electron catalogue).
- **Acceptance:** save a lesson, reload the app, load it back intact; export produces a `.json` that re-imports to an identical lesson; a malformed import is rejected with a clear message.

### 3. New-from-scratch — S3.3 (Priority 10)
- **Goal:** create an empty lesson without any upload.
- **Key decisions:** "New lesson" → empty layers (drums + bass), default bpm 120, bank ROK, 16 steps, teachOrder `["drums","bass"]`. Same editor.
- **Acceptance:** from a cold home, create a blank lesson, hand-build a groove, save it, and practice it (EPIC 4) — with the pipeline never touched.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 3.1 | Grid editor (hand-correction) | Done | S4 | BassInspector edits any bass note's pitch (12 pads) + octave (±2) or removes it; bass-cell click selects (drums unchanged). Added audio-time pattern playback (transport.onStepAudio) so the loop sounds the stored hits and edits are heard on the next pass. Reused setBass/clearBass/playPad/clampOctave — no new helper/audio path/dep, no setInterval. Prod-build verified; no console errors. |
| 3.2 | Persistence + export/import | Done | S4 | lesson.ts (Pattern↔schema seam + validateLesson trust boundary + _selfcheck) + storage.ts (localStorage CRUD, crypto.randomUUID, no dep) + LessonLibrary UI (save/list/load/delete/export/import; import validates before load). Prod-build verified: save→reload→load restores exact pattern (bass pad+octave survive); export↔import identical; malformed/wrong-schemaVersion rejected with clear message + editor untouched; delete clears; no console errors. |
| 3.3 | New-from-scratch | Done | S4 | 'New lesson' button resets editor to a blank lesson (emptyPattern, bpm 120, no title/id, clears bass selection) with a dirty-check confirm guard. Prod-verified: Cancel keeps edits; Confirm clears; fresh build+Save mints a new lesson without overwriting. No console errors. |

> Status ∈ {Not started, In progress, Blocked, Done}.
