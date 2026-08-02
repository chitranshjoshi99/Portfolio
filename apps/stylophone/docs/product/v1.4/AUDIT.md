# Product audit — 2026-07-18 (pre-build, re-run against source)

Reviewed after: docs generated, pre-build. This pass reads the **actual codebase**
(`src/lib/pattern.ts`, `src/lib/document.ts`, `src/hooks/usePattern.ts`,
`src/hooks/useTransportEngine.ts`, `src/lib/constants.ts`) against the locked docs.
The earlier pre-build pass checked the docs for internal consistency only and missed
that two locked contracts contradict the shipping engine. Verdicts below supersede it.

| Persona | Verdict | Regrets / drift | Fix |
|---|---|---|---|
| CF | Holds | — | — |
| PH | **Revise** | Locked a bass model (`{octave,start,end}` keyed by pad) that does not match the shipping model. | Adopt existing v4 sparse shape (F1). |
| FB | Holds | No TAM/revenue claim justified. | Keep validation local-first. |
| DS | Holds | Don't claim visualizer accelerates learning. | Validate with user tests. |
| ARCH | **Revise** | (a) Bass persistence contract contradicts the engine; (b) transpose seam assumes a semitone path the audio layer lacks; (c) pattern-bank/`usePattern` ownership + guide-on-switch left undefined. | F1, F2, F3. |
| DG | Holds | — | — |
| SM | Holds | Import parser already all-or-nothing, size-capped, no-throw in `document.ts`. | Reuse it; keep `.beatcoach` on the same validator. |
| DO | n/a | Local-first, static host. | — |
| LB | Holds | No "official Stylophone" implication. | Keep compatibility framing only. |
| TB | Holds w/ note | Per-pad bass keying re-implements as validation the monophony the per-step array enforces structurally — more code, not less. | Folds into F1. |
| COO | n/a | — | — |

Lead finding is F1: a locked data contract that breaks round-trip of patterns the current
build already produces. Caught here it is a doc edit; caught mid-build it is a rewrite of
`pattern.ts` + `document.ts` + every caller.

## Detail

### F1 — Bass persistence model contradicts the engine (ARCH + PH — Revise) — Critical

**Locked in docs** (context.md ARCH/PH, EPIC-3 data contract, README):
```ts
bass: Partial<Record<PadId, Array<{ octave: number; start: number; end: number }>>>
// "inclusive start, exclusive end", "0 <= start < end <= 64", "no two spans overlap regardless of pad"
```

**Actual codebase** (`pattern.ts`, `document.ts` schema v4):
```ts
type BassCell = { pad: PadId; octave: number; length: number };
type Pattern  = { …; bass: (BassCell | null)[] };      // indexed by STEP, monophonic
type BassNote = { step: number; pad: PadId; octave: number; length: number }; // serialized v4
```

Three concrete conflicts:
1. **Wrap ban breaks existing data.** The engine's bass length **wraps the loop boundary** —
   `bassLengthThroughStep(63,0) === 2`, `activeBassCell` searches wrapped, and `pattern.ts`
   `_selfcheck` asserts a note at step 63 length 2 sounds at step 0. The doc's `end <= 64`
   with no wrap has **no representation** for that note. A pattern the current app can author
   and save today fails the new contract on import → round-trip is not deep-equal, violating
   EPIC-3's own acceptance.
2. **Keying is reshaped.** Bass is monophonic-per-step in memory (one array slot per step).
   The doc re-keys by `PadId` with per-pad span arrays, then re-imposes monophony as a
   cross-pad overlap **validation rule**. That is a different shape *and* strictly more code
   than the existing per-step array, which enforces monophony by structure (TB's note).
3. **`length` vs `start/end`.** The whole engine (`setBass`, `setBassLength`,
   `duplicateBar1To2`, `activeBassCell`, audio scheduling) speaks `length`. Switching the
   document to `start/end` forces either a lossy converter at the seam or a rewrite of
   `pattern.ts`.

**Fix (EPIC-3, README, context ARCH/PH):** the sole serialized shape is the **existing v4
sparse pattern**, wrapped per slot. Drop only the envelope fields:
```ts
type BeatDocument = {
  bpm: number;
  patterns: Record<"1"|"2"|"3"|"4", {
    drums: Partial<Record<PadId, number[]>>;                          // sorted step indices, 0..63
    bass:  Array<{ step: number; pad: PadId; octave: number; length: number }>; // sorted by step, wrap-capable
  }>;
};
```
Removed vs current v4: `schemaVersion`, `id`, `title`, `bars`, `steps`, `drumBank`,
`bassBank`. Bass keeps `{step,pad,octave,length}` and wrap semantics. This is a *smaller*
diff over the shipping `document.ts` (already sparse v4) than the locked contract, and it
preserves round-trip. Delete the v3 dense-read path and legacy-schema handling as EPIC-3
already intends.

### F2 — Transpose defined in semitones, engine sounds bass by {pad, octave} (ARCH — Revise) — High

context.md/EPIC-2 lock a hold-pad → **semitone** offset map (`+0..+11`) applied "at bass
playback time." But bass is voiced as `{pad, octave}`: `useTransportEngine` calls
`playBassAt(bass, time, p.bassBank, gain)` with `bass: BassCell`. There is no semitone-delta
path through `playBassAt` or the audio pad→note mapping today. EPIC-2 step 4 says "use a held
offset ref at bass playback" but never names the seam that turns a semitone int into a
pitched voice.

**Fix (EPIC-2 story 2):** lock the seam explicitly — thread an optional `semitoneOffset:
number` through `playBassAt` and the audio note computation (pad+octave → base note → +offset
semitones); read a held-offset ref inside `onStepAudio` **before** `playBassAt`; release/reset
→ 0; never mutate `BassCell`. Call out that `audio.ts` needs a semitone-shift path so the
build session doesn't hit this cold mid-story.

### F3 — Pattern-bank ↔ usePattern ownership + guide-on-switch undefined (ARCH — Revise) — Medium

`usePattern` owns `useState<Pattern>` **and** guide state, and its own comment says the two
"can't be split cleanly … circular dependency." EPIC-1 moves `patterns` into a new
`usePatternBank` but never states who owns pattern **state** after the split, how a mutator
(`setPattern` today) writes back to the active slot, or what happens to `guide`/`guidancePasses`
when the active slot changes (they `useMemo` off `pattern`).

**Fix (EPIC-1):** lock it — `usePatternBank` owns `patterns`, `activeSlot`, `queuedSlot`, and
the active-slot ref. `usePattern` no longer holds pattern state; it receives the active
pattern + a `commitActiveSlot(mutator)` that routes through the existing `commitPatternEdit`
gate, and keeps guide. On a slot switch **outside a lesson**, reset guide to `compose` (the
derived passes belong to the newly active slot); during a lesson, slot switch is already
blocked (story 3). State both explicitly so the build doesn't re-derive the coupling.

### F4 — Step-0 queue commit ordering (ARCH — resolved, locked) — was flagged, now decided

`onStepAudio` reads `patternRef.current` at the top of its callback; the queued→active swap
must complete before that read on the `s === 0` tick. Checked the seam — the ordering is
already determined by `transport.ts:152`: the step `scheduleRepeat` fires
**`stepAudioSubscribers` synchronously first, then `stepSubscribers` via `Tone.Draw`
(later)**. So the visual `onStep` callback runs *after* the audio read and cannot be used to
pre-swap the ref.

**Locked decision:** perform the commit as the **first line of the existing `onStepAudio`
callback** in `useTransportEngine`, gated `s === 0`, before `const p = patternRef.current`:
```js
onStepAudio((s, time) => {
  if (s === 0) bank.commitQueuedSlot();  // swaps activePatternRef.current + setState(activeSlot)
  const p = patternRef.current;          // reads the freshly active slot
  …
});
```
`patternRef` **is** the bank's `activePatternRef`. The ref swap is synchronous → audio sounds
the new slot on this tick; the batched `setState` (grid + active-slot badge) renders
immediately after → visually atomic, matching EPIC-1's "audio/grid/active swap together."
Rejected: swapping in `onStep` (fires too late), and a separately pre-registered audio
subscriber (correctness would depend on `Set` insertion order). `s===0` recurs each 64-step
loop; a selection landing after the top-of-handler read waits one more loop — exactly the
"next loop boundary, latest-wins" spec. Put this in EPIC-1 execution step 4.

## Resolution — 2026-07-18

All findings applied to the docs. Gate cleared; build may start.

- **F1** — EPIC-3 data contract, README, context.md (ARCH + PH) now use the shipping v4 sparse shape with step-indexed wrap-capable bass; envelope fields dropped; wrap round-trip added to acceptance.
- **F2** — EPIC-2 story 2 locks the `semitoneOffset` seam through `playBassAt`/`audio.ts` and the held-offset ref.
- **F3** — EPIC-1 locked architecture states the `usePatternBank`/`usePattern` ownership split and guide→compose reset on non-lesson slot switch.
- **F4** — EPIC-1 exec step 4 pins the `s===0` commit inside `onStepAudio` with the seam rationale.

## Gate

**Build does not start until F1–F3 are resolved in the docs.** F1 is load-bearing: it changes
EPIC-3's data contract, which every other epic depends on. F2/F3 are single-story doc edits.
F4 is now a locked decision folded into EPIC-1 step 4 (no longer an open risk). After the
edits, build order is unchanged: EPIC 3 → EPIC 1 → EPIC 2 → EPIC 4.
