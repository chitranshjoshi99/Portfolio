# Product audit — v1.3 — 2026-07-17

Reviewed after: **docs generated (pre-build).** No code exists yet. This is the cheap-catch
pass — every finding below is a doc edit now, a rewrite later.

| Persona | Verdict | Regret / gap | Fix |
|---------|---------|--------------|-----|
| Architect (spine) | **Revise** | Dedup keyed "per tick, cleared each tick" won't collapse a live tap that lands just before/after the exact step tick — the double-sound survives at the boundary, defeating EPIC-2's whole purpose. | Key dedup per **(step, loop-pass)** with a tolerance window = the nearest-snap window, not per-instantaneous-tick. |
| Architect / Design | **Revise** | Collision policy (earliest-wins vs sequencer-authoritative) locked as **one global knob**. But the two modes want opposite answers: jam/record needs earliest-wins (feel); practice needs sequencer-authoritative (learner must hear the reference clock, not their own off-tap). | Make the collision policy **mode-aware**, not one constant. |
| Legal-bro | **Revise** | The live app still serves the "Stylophone" trademark v1.2 removed — in the public URL `/apps/stylophone-visualiser`. It's bundled into the deferred "positioning" session, but legally it's independent and the app is live **now**. | **Decouple** the URL rename from positioning; it's a cheap legal-hygiene task (route rename + redirect), do it standalone, don't gate it on the user/TAM discussion. |
| Design-girl | **Revise** | Touch-first cycle, but single-cell taps on the grid still hit ~24px targets — drag-paint only helps *runs*. The precision pain that started this whole cycle survives for single hits on touch. | Enlarge grid **cell hit area on touch** (min target), or explicitly accept + state the limit. |
| Co-founder | Holds | "Real product" intent with user/TAM/front-door deferred is a known, accepted gap — refinement serves the builder now and a product later. | — (deferred by user, tracked) |
| Design-girl (authoring) | Holds | No-mode-switch, first-cell-decides-direction, coexistent fill — sound. | — |
| Tech-bro | Holds | Reuse mandates, no-new-deps, A3 droppable all stand. The spine is *simpler* than the rejected ledger. | Note: the spine's **blast radius** (useLiveInput + transport + audio + transport-engine) is the cycle's main execution risk — build EPIC-2 as one focused session. |
| Tech-bro (scope) | Holds w/ note | Bass authoring is unchanged by this cycle. | State it explicitly in EPIC-1 so it isn't read as a missed gap (bass is monophonic/pitched — drag-paint and fills don't apply). |
| Security / DevOps | N/A | No new attack surface, no new deps, no deploy-arch change this cycle. | — |

## Detail

### Architect — Revise (dedup window) — most important
EPIC-2 story 1 says the dedup is "a `Set` keyed to the current tick id, cleared each tick."
Walk the failure: playhead approaches step S. A live tap nearest-snaps to S but arrives ~30ms
**before** the sequencer fires step S. At that moment the "current tick" is step S−1's tick, so
the tap marks `(row, S)` under the *wrong* tick key — or under a set that's about to be cleared
when the step advances. When the sequencer then fires step S, its key doesn't match the tap's →
**both sound.** That is exactly the double-sound the epic exists to kill, surviving at the
boundary where matched-timing taps actually land. **Fix:** the dedup coordinate must be
**(step, loop-pass)** — "has step S already sounded on this pass of the loop?" — checked within a
tolerance window equal to the nearest-snap window, not reset every 16th. One pass = one bar-cycle
occurrence of step S. This is load-bearing; EPIC-2 has been edited to specify it.

### Architect / Design — Revise (mode-aware collision)
"Earliest-wins vs sequencer-authoritative, pick one global constant, tune at build" is wrong
because the modes disagree. In **jam/record**, earliest-wins is correct — you must hear your own
tap when you hit, or the pad feels dead. In **practice**, sequencer-authoritative is correct — the
learner has to hear the *reference* grid pulse to judge whether they matched; if they always hear
their own (slightly-off) tap because they were a hair early, the feedback is useless. **Fix:**
collision policy is a function of mode — jam/record → earliest-wins, practice → sequencer-
authoritative. EPIC-2 and EPIC-4 edited.

### Legal-bro — Revise (decouple trademark URL)
CF deferred "front door / URL / positioning" as one bucket to a later session. But the trademark
exposure is not a positioning question — it's the exact boundary v1.2 spent a whole cycle
crossing, now reopened by the public URL on a **live** deployment. It shouldn't wait on the
user/TAM debate. **Fix:** treat the `stylophone-visualiser` → neutral-slug rename (+ redirect) as
a standalone hygiene task, do it independently of the positioning session. Recorded in README's
deferred note; the *rename itself* lives in the portfolio/deploy repo, not these app docs, so it's
flagged, not scheduled here.

### Design-girl — Revise (grid touch targets)
The cycle is explicitly touch-first, and C2 enlarges the *pad* segments — but the *grid* cells
that caused the original precision complaint stay ~24px. Drag-paint removes the need for precision
on runs; a single add/remove of one cell on touch is still a small-target poke. **Fix:** give grid
cells a larger effective hit area on coarse pointers (`@media (pointer: coarse)`), or state the
accepted limit. EPIC-1 edited to add this to story 3 (touch) acceptance.

## Verdict
Four Revise, all with concrete fixes, two in the audio spine. **None are blockers to starting —**
they're doc edits, now applied. Build gate is clear once the edits below are in: EPIC-2 (dedup
window + mode-aware collision), EPIC-1 (bass-scope note + grid touch targets), EPIC-4 (practice
collision policy), README (trademark decoupling note).
