# Product audit — 2026-07-15

Reviewed after: v1.1 docs generated, before build.

| Persona | Verdict | Regrets / drift | Fix |
|---------|---------|-----------------|-----|
| Co-founder | Holds | The product is now a grid-to-hardware guide rather than a laptop replica. | Keep the physical Beat as performance authority. |
| Product-head | Holds | Free-float bass originally appeared in the early story spine. | Docs now explicitly defer it to v1.2. |
| Data-scientist | Holds (out of scope) | No market research was performed. | Personal/local n=1 scope does not use market sizing as a build gate; revisit before public distribution. |
| Finance-bro | Holds (out of scope) | No revenue model exists. | Keep v1.1 non-commercial and local; revisit with a publish decision. |
| Architect | Holds after revision | A guided bass pass could have remained hidden in drum projection. | Active pass now sets the presented instrument projection; bass-only guidance opens in bass mode. |
| Design-girl | Holds after revision | Pause was specified but had no allocated visible control. | In Guided, Play/Stop is Pause/Resume; the action strip remains Start/Next/Restart. |
| Security-master | Holds | The only material boundary is import replacement and local draft loss. | Strict v3 validation, atomic import, dirty confirmation, export-before-discard path, and no active sidecar. |
| DevOps | Holds (out of scope) | No deploy plan exists. | V1.1 runs locally in browser; no deployment or server starts. |
| Legal-bro | Holds with boundary | Stylophone branding and audio treatment cannot be assumed publishable. | README explicitly restricts v1.1 to personal/local use; clear rights before any distribution. |
| Tech-bro | Holds | Audio/profile ambition could grow into an asset project. | Runtime processing over current ROK assets; no downloads, sample browser, or library. |
| COO | Holds (out of scope) | No operational cohorts are needed for one local user. | Resume with implementation tracker only. |
| EM | Holds | Execution had no prior session plan. | `execute.md` and the net tracker provide priority-ordered sessions. |

## Detail

### Auditor — Holds after two revisions

The docs had two genuine cross-persona gaps: the design required a paused editing state without assigning a control to reach it, and the product/architecture docs did not guarantee the grid would show a current bass pass. Both are now locked: Guided uses Play/Stop as Pause/Resume, and every current pass controls the visible instrument projection. These are documentation corrections, not product-scope additions.

### Product / architecture — Holds

The most expensive decision is appropriately simple: the persistent object is only a 64-step pattern. Guidance, audio state, grid state, and pad translation are derived. That prevents the old two-layer lesson model from returning as duplicate mutable state. Free-time bass is clearly deferred; retaining it in v1.1 would make saving, rendering, recording, and guidance all less trustworthy.

### Design — Holds

The grid-first layout is correctly tied to the actual job: manual hardware recording from a readable score. The docs require all 64 slots at the supported desktop floor and make the pad a compact translator. Do not reintroduce an equal-sized pad workspace while implementing the CSS.

### Security / legal / deployment — Holds with explicit boundaries

No server, accounts, PII, upload pipeline, or public release belong in this scope. The build must still treat JSON import as hostile until proven valid, preserve the current draft on failure, and retain a visible export path. The personal/local release boundary is non-negotiable before future publishing.

## Pre-build gate

**Passed.** There are no unresolved `Revise` findings. Build may begin at README net-tracker priority 1.
