# Product context — v1.4

**Product:** Beats Drum Machine Coach — a browser companion for practising and composing Stylophone Beat grooves.
**Status:** discovery — co-founder direction locked; product-head next.

---

## Design-girl (DG) — 2026-07-18

**Clarity gate:** met (9/10 problems answered cleanly)

**Design direction / core-flow shape:**
- Preserve the existing premium instrument layout. The beginner's dominant action remains composing a two-bar groove in the grid/pad; Pattern and Transpose remain visibly present but clearly secondary, advanced rail controls.
- Pattern and Transpose sit horizontally below Drums/Bass and above a smaller octave control. They are icon-first controls with tooltips and accessible names, not text-heavy affordances.
- Whenever Pattern, Transpose or Delete owns the visualizer, its matching icon appears as a compact heading badge. The rail icon and visualizer badge are redundant state confirmation; no explanatory paragraph belongs around the pad.
- **Pattern appearance:** active slot has a solid accent; queued slot has an outlined/pulsing accent; idle slots are neutral. The current grid stays visible until the loop-boundary activation.
- **Transpose appearance:** home/root `1` is neutral; a held pad carries the accent and a compact `+n` cue. The effect exits cleanly on release.
- **Delete appearance:** icon/badge use a destructive tint and only valid targets are visually eligible. It automatically exits after the destructive action; pattern deletion offers the locked temporary Undo.
- **Lesson panel:** permanent zones only—lesson step, utility icons (Save/Load and dim Reset), action array, fixed primary-action slot. State changes disable/enable and update the primary action without layout movement. Duplicate-bar moves to the grid corner.
- **Motion:** spring-snap is exclusively for real spatial reflow (visualizer expansion/sibling resizing) plus modal entry/exit. Grid, transport and timing feedback remain precise/non-spring. `prefers-reduced-motion` uses crisp crossfade/snap, with equal functionality.

**Accessibility must-haves:**
- Every icon-only affordance has an accessible name and focus/hover tooltip; visual active states cannot rely on color alone.
- `Escape` cancels any active Pattern/Transpose/Delete mode; keyboard behavior must not trigger musical input when a control mode owns the pad.
- Keep existing touch-target hardening. Disabled controls name their prerequisite through tooltip/accessible description, including no-hover equivalents.

**Open risks / unknowns:**
- Icon clarity is a product risk for first-time touch users. Validate with the 5–8 person usability test; if users cannot identify modes, improve the iconography/tooltip behavior rather than adding static copy. (severity: medium)
- Reflow motion can introduce responsive layout regressions; test all supported horizontal screen widths with and without reduced motion. (severity: medium)

**For the next persona:**
- Security-master should focus on local import/export and browser storage: malformed files, local data loss and safe UI feedback—not auth/server threats.

---

## Architect (ARCH) — 2026-07-18

**Clarity gate:** met (9/10 problems answered cleanly)

**System shape / decisions locked:**
- **Local-first boundary:** no server, account, sync or Context provider. Browser local storage holds the one four-slot document; import/export moves that document. Existing drafts are intentionally replaced rather than migrated.
- **Pattern-bank domain:** introduce a focused `usePatternBank` reducer/hook adjacent to `usePattern`, not an app-wide store. It owns exactly: `{ patterns: Record<"1"|"2"|"3"|"4", PatternNotes>, activeSlot, queuedSlot | null, mode, deleteArmed, undo }`. It exposes atomic author/edit/clear/select/undo actions and a stable `activePatternRef` for audio.
- **Sound profiles:** drum and bass banks are global runtime state, independent of slots and never serialized. A pattern slot changes notes only.
- **Queue invariant:** stopped selection updates active slot immediately. Playing selection writes/replaces `queuedSlot`; latest selection wins. At transport step 0, commit the queued slot before the sequencer reads notes for that loop. The active slot, audio source and displayed grid change as one state transition. Clearing/switching/editing invalidates any stale whole-pattern undo as already specified.
- **Mode arbitration:** explicit mutually-exclusive input modes extend the existing drum/bass presentation state: Pattern, Transpose and one-shot Delete may own visualizer input; keyboard is inert while a control mode owns the pad. Lesson start exits Transpose and locks Pattern selection. Mode labels/aria state must identify the owner.
- **Transpose seam:** calculate the temporary semitone offset at bass playback time from the held visualizer pad; never mutate stored bass cells. Release/reset sets offset to 0. This preserves lesson and saved-note determinism.
- **Persistence contract:** the sole v1.4 serialized form is `{ bpm, patterns: { "1": { drums, bass }, … "4": { drums, bass } } }`, reusing the **existing v4 sparse pattern shape** — drums `Partial<Record<PadId, number[]>>`, bass a step-indexed monophonic list `{ step, pad, octave, length }`. Bass `length` **wraps the two-bar loop** (matches `bassLengthThroughStep`/`activeBassCell`); do not impose a non-wrapping start/end. Validate fixed pad keys, ascending steps, and bounded step/octave/length. No version/title/id/bank fields and no compatibility parsing. *(AUDIT F1: earlier `{octave,start,end}` per-pad model contradicted the engine and was corrected to the shipping v4 shape.)*
- **Most expensive-to-reverse choice:** keeping bank state out of each pattern and document. It makes pattern switching a pure note swap and stops sound-profile drift from infecting imports, lessons and queued playback.

**Complexity calls:**
- Pattern bank + atomic loop-boundary commit: **Medium** — modifies the audio/read-ref handoff but has no external service.
- Input-mode arbitration + one-shot deletion/undo: **Medium** — several interaction paths must remain mutually exclusive.
- Temporary transpose: **Medium** — sustained bass playback must accept a live offset without mutating notes.
- Four-slot compact document + local persistence: **Medium** — compact model and validation replace a more verbose existing format; legacy data is intentionally unsupported.
- Lesson-panel permanence/grid control relocation: **Low** — presentational behavior, isolated after callback wiring.
- Spacing tokens + spatial/modal motion: **Medium** — cross-cutting CSS must not disturb responsive layouts or audio-timing feedback.

**Open risks / unknowns:**
- The transport must expose an unambiguous step-0 commit point before its audio subscriber reads the active pattern; validate at loop boundaries under rapid selection. (severity: high)
- Removing old-document parsing means local data can be lost after deploy; present a clear replacement state rather than silently failing import. (severity: medium)
- Web storage quota/availability remains an existing failure path; retain the visible save-failed state. (severity: medium)

**For the next persona:**
- Design-girl should specify the visible mode/queued/disabled/undo states and accessibility expectations. Do not change the locked rail hierarchy or reintroduce transient Lesson panel controls.

---

## Finance-bro (FB) — 2026-07-18

**Conclusion:** v1.4 has no defensible revenue or break-even case yet. There is no public Stylophone BEAT installed-base figure or willingness-to-pay evidence for this exact companion; free browser-native alternatives mean the product cannot charge merely for “making beats in a grid.” Market size/share/revenue are intentionally unquantified pending validation.

**Evidence / decisions:**
- Broad free substitutes exist: [BandLab Studio](https://help.bandlab.com/hc/en-us/articles/115002945153-Getting-Started-with-the-BandLab-Studio) and its [browser/mobile Drum Machine](https://blog.bandlab.com/how-to-use-drum-machine/) make generic sequencer monetization untenable.
- The v1.4 validation delivery can be effectively $0/month: [Cloudflare Pages](https://www.cloudflare.com/en-in/developer-platform/products/pages/) advertises a free tier with unlimited sites, requests, bandwidth and Web Analytics. Avoid server work; [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) begins at $5/month and is unnecessary here.
- No checkout/payment work belongs in v1.4. If a future India payment experiment happens, [Stripe India pricing](https://stripe.com/in/pricing) lists 2% for domestic Visa/Mastercard and 0.7% additional subscription billing, but do not build toward that now.

**Recommendations:**
- Treat this release as a low-cash validation asset. Do not spend on paid acquisition, backend, billing, or a generic consumer price point.
- Before any monetization decision: segment owner/non-owner activation + 7-day return, conduct 5–8 moderated tests, then test conversion intent for a differentiated outcome before building payments.
- A school offer is a separate product decision—teacher workflow, procurement and content rights do not exist yet. Do not borrow education-subscription pricing as a proxy.

**Open risks / unknowns:**
- Free substitutes make consumer willingness to pay the central business risk. (severity: high)
- Acquisition, support and content creation—not static hosting—could become the material cost centers. (severity: medium)
- “Stylophone companion” must not imply endorsement/official status without authorization. (severity: medium)

**For the next persona:**
- Architect should preserve the no-backend, local-first posture: four-slot persistence/import/export is browser-local. Do not introduce accounts, sync or server infrastructure for a validation release.

---

## Data-scientist (DS) — 2026-07-18

**Research conclusion:** the hardware-optional, browser-first beginner wedge is credible. Position as a small guided groove instrument, not a DAW and not hardware-dependent. Evidence supports category availability and immediate-feedback conventions; it does **not** establish that a visualizer itself makes non-musicians learn faster.

**Evidence / decisions:**
- Official Stylophone BEAT positioning is entry-level/non-drummer friendly and exposes four kits, four bass sounds, layered recording, click and tempo lock. Four-slot variation is faithful, but the browser must deliver standalone value. [Official product page](https://stylophone.com/product/stylophone-beat/)
- Browser music learning is a real, no-install convention: [Chrome Music Lab](https://musiclab.chromeexperiments.com/) runs hands-on music experiments across phone, tablet and laptop; [Groove Pizza](https://apps.musedlab.org/groovepizza/) is an established circular visual rhythm editor. The product differentiates via coaching plus the Stylophone-pad mental model—not via “having a visualizer.”
- Vendor category evidence from [BandLab’s browser drum sequencer](https://blog.bandlab.com/introduction-to-drum-machine-online-sequencer/) supports immediate grid edits and audible feedback. Preserve the first-session target (two bars, at least three drum layers plus bass) and keep Pattern/Transpose post-activation.
- Browser-only audio is technically mature: [Web Audio API baseline support](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) is widely available and covers sequencers/visualizations.

**Recommendations:**
- Put the hardware-optional promise plainly in first-view copy: “Make a groove in your browser; use your Stylophone Beat too, if you have one.” Avoid language implying official affiliation.
- Make each guided action visibly and audibly causal; the visualizer must never be decorative.
- Instrument the hypothesis rather than market it as fact: primary activation = new browser-only users who independently create/play a two-bar groove with ≥3 drum layers + bass in first session; segment owners/non-owners; observe 7-day return.
- Before acquisition work, conduct a 5–8 person usability test split between hardware owners and non-owners.

**Open risks / unknowns:**
- No public Stylophone BEAT sales/installed-base or hardware-owner split was found, so TAM/hardware funnel claims are ungrounded. (severity: high)
- No causal evidence says visualizers accelerate novice learning. Treat as falsifiable through activation/comparison testing. (severity: high)
- Browser autoplay still needs the first user action to unlock audio and yield obvious sound/visual feedback. [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) (severity: high)
- “Companion” can imply endorsement; accurately describe optional compatibility unless licensed. (severity: medium)

**For the next persona:**
- Finance-bro should keep economics/outcome framing modest: no credible public TAM exists for this exact product. Focus on low-cost browser distribution and the gated validation experiment rather than invented revenue forecasts.

---

## Product-head (PH) — 2026-07-18

**Clarity gate:** met (9/10 problems answered cleanly)

**Primary user / job:**
- **Primary user:** a curious non-musician learning to make grooves, with or without Stylophone Beat hardware. The visualizer is the primary instrument and supplies roughly the hardware experience; hardware ownership is optional.
- **Core job:** make a satisfying two-bar groove unaided. First-session value = three drum layers plus a bassline. Patterns and transpose are advanced, later discovery for experimenting with song-like variation—not onboarding requirements.

**v1.4 scope line:**
- **In:** four-slot pattern bank, in-time queued switches, active-pattern lessons, temporary held-pad transpose, explicit one-shot deletion, full-bank simplified Save/Load, stable Lesson panel, duplicate-bar relocation, spacing tokens, spatial/modal motion.
- **Out:** song bank, titles/IDs/schema-version compatibility, user-saved pattern-library features, multi-pattern lesson progression, persisted transpose, new onboarding/walkthrough, profile/bank persistence in exported lesson data, broader audio redesign, and global React Context.

**Decisions locked:**
- **Advanced discovery:** Pattern/Transpose remain secondary controls with contextual disabled-state labels/tooltips; no new walkthrough or modal.
- **Lesson boundary:** a lesson practices the pattern active when it starts. Pattern switching is locked during that lesson; remaining slots are untouched.
- **Whole-pattern safety:** clearing a pattern shows a non-blocking Undo toast for 15 seconds, ending earlier on the next edit or pattern switch. Row clears do not create an undo toast.
- **Save/Load contract:** persist all slots, BPM, and authored drum/bass data only. New document shape is `{ bpm, patterns: { "1": Pattern, "2": Pattern, "3": Pattern, "4": Pattern } }`. A `Pattern` reuses the existing v4 sparse shape: sparse drum hits `Partial<Record<PadId, number[]>>` and a step-indexed monophonic bass list `{ step, pad, octave, length }`, with `length` wrapping the two-bar loop. Do not retain title, id, schema version, fixed 2-bar/64-step declarations, or sound-profile/bank fields. No pre-release compatibility/migration requirement is accepted. *(AUDIT F1: bass corrected from `{octave,start,end}` per-pad to the shipping v4 `{step,pad,octave,length}` list.)*

**EPIC → story draft:**
- **EPIC 1 — Pattern bank and in-time performance**
  - As a groove maker, I can author four independent numbered patterns so I can build variations. *(severity: High; complexity: Medium)*
  - As a performer, I can queue a pattern during playback and have visual and audio state change together on the next loop boundary. *(High; Medium)*
  - As a learner, I can start a lesson against the current pattern without the target changing mid-practice. *(High; Low)*
- **EPIC 2 — Instrument modes: Pattern, Transpose, Delete**
  - As a player, I can enter Pattern mode and select slots from pads 1–4 without triggering sounds. *(High; Medium)*
  - As a player with a running bassline, I can hold a pad to temporarily transpose recorded bass by a fixed semitone offset. *(Medium; Medium)*
  - As an author, I can explicitly clear a selected row or pattern and recover a whole-pattern clear immediately. *(High; Medium)*
- **EPIC 3 — Simplified full-bank Save/Load**
  - As a user, I can refresh and retain all four patterns. *(Critical; Medium)*
  - As a user, I can save/load a compact, readable four-pattern beat document. *(High; Medium)*
- **EPIC 4 — Stable, polished control surfaces**
  - As a learner, the Lesson panel remains spatially stable as its state changes. *(High; Low)*
  - As an author, I find Duplicate bar 1→2 next to the grid it changes. *(Medium; Low)*
  - As a user, I experience consistent spacing and intentional spatial/modal motion without timing feedback becoming soft. *(Medium; Medium)*

**Recommendations:**
- Treat EPIC 3 (persistence/document) as the first implementation dependency even though the user-facing priority is pattern switching: feature work without a settled bank model risks a second migration.
- Make keyboard behavior explicitly inert while Pattern/Transpose/Delete mode owns the visualizer; visible mode and keyboard focus state must always agree.

**Open risks / unknowns:**
- **Legacy local draft:** user explicitly accepts no backward compatibility, so old local data may be discarded. Confirm the replacement message makes that loss legible. (severity: medium)
- **Touchable mode cues:** contextual tooltips must have an accessible non-hover equivalent and disabled states must name the prerequisite. (severity: high)
- **Undo boundary:** undo state is intentionally ephemeral; refresh cannot restore a just-deleted pattern. (severity: low)

**For the next persona:**
- Data-scientist should validate the primary non-musician/no-hardware segment and the claim that a visualizer-led browser companion has a credible learning wedge. Product scope is intentionally narrow and does not need a market-sized song-bank thesis.

---

## Co-founder (CF) — 2026-07-18

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **Release thesis:** v1.4 faithfully adds the Stylophone Beat's pattern-selection and live bass-transpose controls; it is not a general composition-library feature.
- **Pattern bank:** exactly four numbered slots for v1.4, each owning its own drum and bass grid. Persist all slots across refresh; keep the model slot-count agnostic for a future expansion.
- **Pattern selection:** Pattern mode routes visualizer pads `1`–`4` to slots `1`–`4`; the other pads are inactive in that mode. While stopped, a tap switches immediately. While playing, it queues the selected slot and makes the selection visibly queued; audio, active-slot indication, and the editor grid all switch together at the next loop boundary.
- **Pattern authoring:** a chosen slot is edited by the existing grid and Record flow. Slots 2–4 begin empty; slot 1 is the current/default score.
- **Deletion:** a small lower-right visualizer delete control enters an explicit, visibly armed, one-shot delete mode. In Pattern mode, a pad action clears the active selected pattern. In a drum/bass selection, it clears that one row/layer in the active pattern. The mode exits immediately after the deletion. This intentionally preserves the instrument mechanism without copying its error-prone gesture.
- **Transpose:** it is an ephemeral performance gesture, not persisted or lesson data. Pattern + Transpose are horizontally paired below the primary Drums/Bass switch and above a reduced-height octave control. It is enabled only while playback is running, a bassline exists, and no lesson is active. In Transpose mode, holding a visualizer pad temporarily shifts all recorded bass by its fixed chromatic offset: `1=0`, `1.5=+1`, `2=+2`, `2.5=+3`, `3=+4`, `4=+5`, `4.5=+6`, `5=+7`, `5.5=+8`, `6=+9`, `6.5=+10`, `7=+11`; releasing restores the original pitch. Clearing bass or activating a lesson exits transpose.
- **Lesson panel stability:** every action remains mounted; eligibility changes only its enabled/disabled state. A permanent structure holds the lesson-step region, Save/Load and Reset utility icons, a remaining action array, and one primary-action slot (`Start` / `Next` / `Continue editing`) with the accent treatment. No status transition may cause a layout shift.
- **Grid ownership:** move Duplicate bar 1 → 2 from the Lesson panel to a small lower-right grid icon control.
- **Visual polish:** establish a shared CSS spacing-token scale and replace local spacing values incrementally. Spring-snap motion is limited to actual spatial reflows (notably visualizer expansion and sibling-panel shrink/reflow) and modal entry/exit. Timing-critical grid and transport feedback stays crisp and non-spring.

**Recommendations:**
- Keep all pattern-bank state in a focused `usePatternBank`/reducer alongside existing `usePattern`; do **not** add app-wide React Context for v1.4. App-level callback passing is currently shallow, while audio/transport needs stable refs and clear ownership.
- Keep the visualizer musical: Pattern and Transpose consume its pads only while their explicit mode is active; the rail must show the mode/state unambiguously.

**Open risks / unknowns:**
- **Mode discoverability:** Pattern/Transpose and delete mode share the visualizer; state indication and keyboard accessibility must be designed carefully so a player never mistakes a control gesture for sound input. (severity: high)
- **Destructive semantics:** whether an accidental one-shot Pattern delete needs undo is intentionally not decided; no confirmation was requested. (severity: medium)
- **Persistence migration:** existing single-pattern drafts/import/export have no settled four-slot document contract. (severity: high)

**For the next persona:**
- Product-head should turn the locked behavior into strict stories, especially pattern-bank/persistence migration, queued-switch state, mode arbitration, and lesson-panel stability. Do not reopen the physical-control mapping or use Context as a default.

---
