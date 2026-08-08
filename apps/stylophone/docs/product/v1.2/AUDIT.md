# Product audit — 2026-07-16

Reviewed after: v1.2 docs generated, before build. No code exists yet for this cycle.

| Persona | Verdict | Regrets / drift | Fix |
|---------|---------|-----------------|-----|
| Co-founder | Holds | Every open risk CF flagged (naming distance, full sample removal, deploy/security reopening, per-sample verification) was picked up by a later persona — none dropped. | None needed. |
| Product-head | Holds | Widening CF's "zero new work" to cover walkthrough + analytics scaffolding was a real scope change, made explicitly with user sign-off and logged as such, not smuggled in. | None needed. |
| Finance-bro | Holds (skipped, correctly) | No market/revenue work done — same call v1.1 made, and the "no traction bar" framing this cycle makes it explicitly non-applicable, not an oversight. | None needed. |
| Architect | Holds after revision | Demo-groove data model didn't lock that it needs both drum and bass content — a drums-only groove would silently skip `derivePasses()`'s bass pass and the walkthrough would never demonstrate the app's dual-instrument value. | Locked in EPIC-5: groove must include populated drums **and** at least one bass note. |
| Design-girl | Holds | Auto-launch-on-first-visit was recorded as an accepted risk against DG's own recommendation, not silently overridden — correct handling of a user override. | None needed. |
| Security-master | Not run this cycle | Explicitly deferred to a separate session per user request. EPIC-3 is locked Blocked, `execute.md` is written to skip it — the deferral is documented, not a silent gap. | Resume when that session runs. |
| DevOps | Not run this cycle | Same deferral as Security-master — hosting pick untouched. | Resume when that session runs. |
| Legal-bro | Holds after revision | Git-history-scrub sequencing (swap-then-strip-by-blob-ID) is technically sound and correctly ordered. The one real gap: the MP3-vs-WAV format decision for one replacement sample was flagged three times (by DG, ARCH, TB) across three different context.md blocks but never actually resolved by any of them — a build session hitting EPIC-2 Story 2 would have had no locked answer. | Locked in EPIC-2: convert to WAV during Story 2, no separate decision point. |
| Tech-bro | Holds | Confirmed the existing RESTRUCTURE.md structure rather than inventing a new one — correctly lazy, not a missed opportunity to simplify further. | None needed. |
| COO | Not applicable | Solo build, no cohorts to split — same as v1.1. | None needed. |

## Detail

### Architect — Holds after revision

The load-bearing technical calls (commitPatternEdit as sole write boundary, static
one-shot demo groove instead of scripted timed writes, hand-rolled spotlight over a tour
library) all survive a second read — each is grounded in an actual file read (`usePattern.ts`,
`audio.ts`, `constants.ts`), not an assumption. The one gap was a content requirement, not
an architecture flaw: nothing in the docs required the demo groove to actually exercise
both the drum and bass guidance passes. Since `derivePasses()` (in `src/lib/guidance.ts`)
only appends a bass pass when `pattern.bass` has content, an innocuous drums-only demo
groove would have quietly shipped a walkthrough that never shows bass guidance — the
kind of gap that's invisible in a doc review and only surfaces when someone actually
builds and plays through it. Fixed by locking the requirement directly in EPIC-5's data
model section.

### Legal-bro — Holds after revision

The naming call ("Beats" over singular "BEAT"), the CC0 sourcing-and-verification work,
and the git-history sequencing plan are all sound and none needed revision. The gap was a
process failure, not a legal one: three different personas (Design-girl in passing,
Architect explicitly, Tech-bro explicitly) each *noticed* the MP3-format inconsistency and
each left it as an open question for "whoever does the swap" — which meant nobody actually
owned the decision. This is exactly the kind of cross-persona gap a pre-build audit exists
to catch before it costs a stalled build session. Fixed by locking "convert to WAV" as
part of EPIC-2 Story 2, removing the ambiguity.

### Deferred personas — Security-master, DevOps

Not run this cycle by explicit user request, not an audit finding. The docs handle this
correctly: EPIC-3's three stories are marked Blocked, the net tracker in `README.md`
reflects it, and `execute.md`'s build order explicitly tells a future session to skip
EPIC-3 until that separate session unblocks it. There is no silent gap here — the
deferral is itself a locked decision.

## Pre-build gate

**Passed, after two revisions applied inline.** Both findings were genuine cross-persona
gaps (a decision three personas touched but none closed, and a data requirement no
persona stated), not superficial nitpicks — and both are now locked in the affected EPIC
docs rather than left as open questions. No unresolved **Revise** findings remain. Build
may begin at `README.md` net-tracker priority 1, per `execute.md`'s build order (EPIC-3
excluded until the deferred session runs).
