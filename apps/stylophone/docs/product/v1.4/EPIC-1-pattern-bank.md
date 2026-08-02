# EPIC 1: Pattern bank and in-time performance

Four independent note grids that behave like the physical Pattern control without ever desynchronising the editor from sequenced audio.

## User stories
| # | User story | Severity | Complexity | Priority |
|---|---|---|---|---:|
| 1 | As a maker, I author/select four note-only slots. | High | Medium | 2 |
| 2 | As a player, queued selection swaps at the next loop boundary. | High | Medium | 3 |
| 3 | As a learner, a lesson practices only the active pattern. | High | Low | 4 |

## Locked architecture

Add `src/hooks/usePatternBank.ts`; do not introduce Context, a store package, or a second audio engine. It owns `patterns`, `activeSlot`, `queuedSlot`, and `activePatternRef` (always points at the active slot's `Pattern`). It exposes immutable active-slot edits so existing grid, live-input and guidance paths do not learn about slot IDs. Drum/bass banks remain global runtime controls and never move with a slot.

**Ownership split (AUDIT F3):** today `usePattern` owns `useState<Pattern>` *and* guide state, tightly coupled (its own comment notes they can't split — guide passes derive from the active pattern each edit). After this epic, `usePatternBank` owns the four `patterns` and `activeSlot`; `usePattern` no longer holds pattern state — it reads the active pattern from the bank and mutates via a `commitActiveSlot(mutator)` that routes through the existing `commitPatternEdit` gate (guided = read-only; paused/complete restart guidance). `usePattern` keeps guide state. `patternRef` passed to `useTransportEngine` **is** `usePatternBank.activePatternRef`. On a slot switch **outside a lesson**, reset guide to `compose` — the derived passes belong to the newly active slot; during a lesson, slot switch is already blocked (story 3).

## Execution instructions

1. Define `PatternSlot = "1" | "2" | "3" | "4"`, create four `emptyPattern()` note grids, and derive the current editor `pattern` solely from `activeSlot`.
2. Route every existing pattern mutation through an active-slot mutator. A mutation changes only that slot, recalculates guidance for that slot, and invalidates a pending whole-pattern undo.
3. Add `selectSlot(slot, playing)`: stopped playback commits active immediately; playing stores/replaces `queuedSlot`. Latest selection wins.
4. Commit the queued slot at the loop boundary (AUDIT F4 — seam locked). In `transport.ts:152` the step tick fires `stepAudioSubscribers` synchronously **first**, then visual `stepSubscribers` via `Tone.Draw` (later) — so the swap must happen in the audio path, not the visual one. Expose `bank.commitQueuedSlot()` and call it as the **first line of the existing `onStepAudio` callback** in `useTransportEngine`, gated `s === 0`, before `const p = patternRef.current`:
   ```js
   onStepAudio((s, time) => {
     if (s === 0) bank.commitQueuedSlot(); // move queued→active: swap activePatternRef.current, clear queued, setState(activeSlot)
     const p = patternRef.current;         // reads the freshly active slot
     …
   });
   ```
   The ref swap is synchronous → audio sounds the new slot this tick; the batched `setState` renders grid + active-slot badge immediately after → visually atomic. Do not switch the grid early. Rejected: swapping in `onStep` (fires after the audio read); a separate pre-registered subscriber (depends on `Set` insertion order). `commitQueuedSlot` is a no-op when `queuedSlot` is null.
5. Lesson start binds guidance to the active slot and disables Pattern selection until lesson exit. Other slots are untouched.

## Acceptance

- Slots 2–4 start empty; edits in one slot never alter another.
- While stopped, selection changes grid immediately. While playing, grid/audio stay on active slot, chosen slot is visibly queued, and both change on the next step-0 boundary.
- Rapid choices `2 → 3 → 4` before a boundary activate only `4`.
- Starting a lesson on slot 3 targets only slot 3 and blocks selection until exit.

## Tracker
| # | Status | Notes |
|---|---|---|
| 1 | Done | Four-slot bank, independent authoring, persistence, and boundary-safe selection verified. |
| 2 | Done | Committed step-0 audio/grid latest-wins swap verified in real playback. |
| 3 | Done | Slot-3 guidance isolation and selection lock verified in the browser. |
