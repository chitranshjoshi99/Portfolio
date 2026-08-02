# EPIC 3: Simplified local documents

This is the implementation dependency for every other epic. Replace the current single-pattern `PatternDocument` with one local-first beat document that captures the exact four authored note grids and BPM, while deliberately excluding title, IDs, schema version, geometry, active slot, queued slot, transpose, lesson state, and sound-bank selections. A browser refresh restores the full bank; a `.beatcoach` file shares the same payload with a friend.

## User stories
| # | User story | Severity | Complexity | Priority |
|---|---|---|---|---:|
| 1 | Persist all four slots locally. | Critical | Medium | 1 |
| 2 | Validate/paste/file-import compact `.beatcoach` documents. | High | Medium | 1 |

## Locked data contract

This reuses the **existing v4 sparse pattern shape** already in `src/lib/document.ts`; it does not invent a new bass model. Only the per-document envelope (`schemaVersion`, `id`, `title`, `bars`, `steps`, `drumBank`, `bassBank`) is dropped and the pattern is wrapped per slot.

```ts
type BeatDocument = {
  bpm: number;
  patterns: Record<"1" | "2" | "3" | "4", {
    drums: Partial<Record<PadId, number[]>>;
    bass: Array<{ step: number; pad: PadId; octave: number; length: number }>;
  }>;
};
```

- `bpm` remains within existing BPM bounds. Every pattern key is required, and no unknown root/pattern keys are accepted.
- Drum arrays contain unique, strictly-ascending integer steps in `0..63`; silent lanes are omitted.
- Bass is a **step-indexed monophonic** list, sorted strictly ascending by `step` (`0..63`). Each note carries a native `pad` ID, integer `octave` within existing bounds, and `length` in `1..64`. **Length wraps the two-bar loop** (a note at step 63 length 2 sounds into step 0) — this matches the engine (`bassLengthThroughStep`, `activeBassCell`); do not impose a non-wrapping `end <= 64`. No two notes' wrapped holds overlap. Monophony is enforced structurally by the step-indexed list, not by a per-pad overlap rule.
- The maximum raw file/text size is 512 KiB. Parsing returns `{ok, document}` or `{ok:false,error}`; never throw through UI.

## Execution instructions

1. Reshape `src/lib/document.ts` to the contract above. The existing v4 `readSparsePattern` already validates a per-slot pattern (`drums: Partial<Record<PadId,number[]>>`, `bass: {step,pad,octave,length}[]` with ascending steps, wrap-aware overlap) — reuse that per-slot validator across all four keys; do not rewrite the bass model. Drop the envelope fields (`schemaVersion`, `id`, `title`, `bars`, `steps`, `drumBank`, `bassBank`) and delete the v3 dense-read path and all legacy-schema/migration handling. Keep the pure sparse↔dense pattern conversion helpers.
2. Change `useDraftPersistence` so hydration/autosave receives and writes the full bank plus BPM. Hydration must finish before autosave; failed storage keeps the current in-memory beat and exposes existing save-failed status.
3. Replace the lesson-library title field with a controlled import surface: file input plus paste textarea. Each change runs the exact parser and displays validity; Import is disabled unless valid. Import first saves the validated document, then atomically replaces local editor state. Invalid input changes nothing.
4. Export exactly the serialised document with extension `.beatcoach` and MIME `application/json`. Copy button writes a generic original-groove schema prompt to clipboard; it must not name songs, artists or suggest copyrighted arrangements.
5. Communicate unsupported old documents as invalid, not silently as an empty beat.

## Acceptance

- Create different notes in slots 1–4, refresh, and observe all grids/BPM restored.
- Export then import the file and prove deep equality of all four slots/BPM.
- A pattern whose bass wraps the loop (e.g. step 63, length 2) round-trips deep-equal — the contract must not reject it.
- Invalid JSON, unknown key, oversized input, non-ascending drum step, overlapping bass hold and old (enveloped) document all leave the current beat unchanged and leave Import disabled.
- A valid file and identical valid pasted text enable Import and result in the same bank.

## Tracker
| # | Status | Notes |
|---|---|---|
| 1 | Done | BeatDocument {bpm, patterns:{1..4}} shipped (v4 sparse per-slot, wrap bass); v1.4 draft key; refresh restores grid+BPM; old/invalid draft → clean fresh start, no crash. Held slots 2-4 live in useDraftPersistence until EPIC-1 usePatternBank. Evidence: docs/executions/v1.4/EPIC-3-story-1-four-slot-persistence.json. Commit pending. |
| 2 | Done | Live-validated file/paste `.beatcoach` import (Import disabled unless parse-valid; invalid changes nothing; old enveloped doc reads invalid); generic Copy-schema-prompt button (no copyrighted refs); export `groove.beatcoach`/`application/json`. Browser-verified: export→import + paste==file deep-equal incl wrap bass. Evidence: docs/executions/v1.4/EPIC-3-story-2-import-export-surface.json. Commit pending. |
