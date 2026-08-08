# Product context — v1.2

**Product:** Beats Drum Machine Coach — next cycle after v1.1 (Done). Publish-readiness cycle: rebrand, audio relicense, one UX fix, first-visit walkthrough, go live.
**Status:** docs generated, pre-build audit pending

---

## Co-founder (CF) — 2026-07-16

**Clarity gate:** met (3/3 problems answered cleanly)

**Decisions locked:**
- **v1.2 wedge = cross the release boundary, not add scope.** v1.1's functionality and layout are frozen as-is; v1.2 does zero new product work. The entire cycle is "make the existing app safe and correct to publish live."
- **Rename:** ship as **"Stylo Drum Machine Coach"**, dropping the literal "Stylophone" trademark from product name/branding.
- **Audio:** current 12 ROK pad samples (sourced off archive.org, unverified/unlicensed "random drum kit sounds") must be replaced with samples under a clean, explicit free license (CC0 preferred) before any public release. Since HIP/TEC/BOX are runtime-filtered derivatives of the same 12 base samples (not separately sourced), **one clean license on the base 12 covers all four banks** — filtering doesn't create a new licensing obligation under CC0.
  - Candidate sources researched: [freesound.org CC0-tagged samples](https://freesound.org/browse/tags/cc0/) (per-file license tags, verify each of the 12 individually), [Producer Space CC0 pack](https://producerspace.com/) (2000+ samples, no attribution required).
  - Recommendation: freesound.org, because per-sample CC0 tagging gives provable license per asset — safer than a bundle pack where license scope can be ambiguous.
- **Publish scope: live hosted app**, not repo-only. This reopens two decisions v1.1 explicitly closed as "not applicable while local-only": DevOps had no deploy plan (out of scope in v1.1 AUDIT), and Security-master said "no deployment hardening needed while local/browser-only" — both assumptions break now and must be re-litigated for v1.2.

**Recommendations:**
- Treat the audio swap as a strict 1:1 replacement — same pad count, same role (kick/snare/hat/etc.), so zero pattern/schema/UI changes are needed. This keeps the "no new functionality" constraint honest.
- Do not let "Stylo Drum Machine Coach" stand as a cleared name on my say-so — it's a plausible distancing move, not a legal verdict.

**Open risks / unknowns:**
- Naming distance from "Stylophone" trademark is not legally verified (severity: high) — hand to Legal-bro.
- Archive.org samples must be fully removed from the shipped build, not just superseded in the active bank map — verify no reachable code path still bundles them (severity: high) — hand to Tech-bro/Security-master.
- Live hosting reopens deploy architecture and security posture v1.1 deferred (severity: high) — hand to DevOps and Security-master.
- Each of the 12 replacement samples needs individual license verification, not pack-level trust (severity: medium) — hand to Legal-bro.

**For the next persona:**
- Structure v1.2 as an EPIC→STORY spine around exactly three work streams: rebrand (name/assets), audio relicensing swap, and going live (hosting + security posture) — no product/feature epics. Do not reopen v1.1's frozen UX/functionality.

---

## Product-head (PH) — 2026-07-16

**Clarity gate:** met (well past 9/10 — every raised problem got a direct answer)

**Decisions locked:**
- **User model widens, JTBD splits by segment:** the grid/groove-composer is now usable by *anyone* (no hardware required to make grooves); the lesson/visualizer guidance remains a Beat-owner-specific value-add layered on the same artifact. No functional gating needed — same app, value scales with what hardware the visitor owns.
- **CF's "zero new work" lock is explicitly widened**, with user sign-off: *no changes to musical/hardware functionality*, but onboarding scaffolding (walkthrough) and instrumentation (analytics) are in scope since they wrap the outside without touching grid/lesson/audio logic.
- **Kill line:** this release has no traction bar. It is a prototype release to get the app in front of anyone who wants to try it; real traction is explicitly deferred to a future iPad app (stylus + touch — out of scope, noted only as future direction, not v1.2 work). Finance-bro market sizing is **not a gate** for this cycle — same out-of-scope call v1.1 made, still holds.
- **Analytics:** pageview/open tracking only — no interaction/session-level tracking. Must be a cookieless, consent-banner-free mechanism (e.g. Plausible or Vercel Web Analytics class of tool) so no new legal consent-flow surface opens up. Exact tool choice deferred to Architect/DevOps.
- **Walkthrough is a scripted demo-mode, not a static tour.** Sequence: Status Bar → Control Rail → Status Bar (metronome confirmation) → Grid → Lesson Control → Visualizer. It actively drives real state — sets a BPM, arms the metronome, presses play, writes a demo groove into the grid row-by-row as it plays, then runs guidance through to completion. Next/Skip buttons live bottom-right, standard product-tour placement. Backdrop dims all sections except the one being highlighted.
- **Demo groove persists.** After the walkthrough ends (finished or skipped), the demo pattern it wrote stays in the grid/draft as the visitor's starting point — it is not cleared back to blank. It uses the same persistence path as any authored pattern; no special-cased "demo" storage.
- **Trigger mechanism:** first-visit-only via a localStorage flag (same pattern as the existing draft key), plus a permanent "?" icon that retriggers it on demand. No objection to it resetting if the visitor clears browser storage.
- **Accepted exception — lesson-completion UX fix:** current behavior (grid only becomes editable again via an edit that force-restarts the lesson) is confirmed as a real UAT bug, not a style preference. v1.2 adds an explicit Stop/Complete Lesson control and makes the grid activate automatically on lesson completion, without requiring the user to discover that clicking edits it first. This is a scoped exception to the "no musical functionality changes" rule — logged as its own story, not folded into walkthrough or hidden inside "no new work."

**EPIC → STORY spine (priority order; severity/complexity = business/conceptual only, per doctrine):**

*EPIC 1 — Rebrand*
- S1.1 Rename product to "Stylo Drum Machine Coach" across UI, page metadata, README, and any asset copy; remove literal "Stylophone" branding. Sev Critical · Cx Low

*EPIC 2 — Audio relicensing swap*
- S2.1 Source and verify 12 CC0-licensed replacement samples matching current pad roles 1:1 (same count, same instrument role per pad). Sev Critical · Cx Medium (matching timbre/role to the existing 12-pad map is a real judgment call, not just a download)
- S2.2 Swap sample files into the existing bank map; remove the archive.org-sourced samples from the shipped build entirely (not just superseded in code). Sev Critical · Cx Low

*EPIC 3 — Go-live readiness*
- S3.1 Deploy to a live hosted URL. Sev Critical · Cx Low–Medium (hand to DevOps)
- S3.2 Security re-review for public/anonymous exposure — the import-validation and local-draft boundaries were designed for a single trusted user; confirm they hold for anonymous internet visitors. Sev High · Cx Low (hand to Security-master)
- S3.3 Integrate cookieless, pageview-only analytics. Sev Medium · Cx Low

*EPIC 4 — Lesson-completion UX fix (accepted exception)*
- S4.1 Add explicit Stop/Complete Lesson control; grid becomes editable automatically on lesson completion without requiring an edit-triggered exit. Sev Medium · Cx Medium (touches the locked lesson reducer's restart-on-edit invariant — needs Architect sign-off it doesn't destabilize that state machine)

*EPIC 5 — First-visit walkthrough*
- S5.1 Scripted demo-mode controller: sets BPM, arms metronome, presses play, writes a demo groove into the grid row-by-row during playback, then runs guidance to completion. Sev High · Cx High (new controller driving transport + pattern + lesson state together — the real unknown of this cycle)
- S5.2 Spotlight/backdrop tour UI over the sequence Status Bar → Control Rail → Status Bar → Grid → Lesson Control → Visualizer, with Next/Skip controls. Sev High · Cx Medium
- S5.3 First-visit trigger (localStorage flag) plus permanent "?" icon retrigger. Sev Medium · Cx Low

**Recommendations:**
- Build EPICs 1–3 first — they're the actual legal/publish gate. Nothing else matters if the app can't legally go live. EPIC 5 (walkthrough) is the highest-complexity, lowest-urgency item; it can slip a session without blocking publish.
- Keep the demo-mode controller (S5.1) behind a single entry point that *only* the walkthrough calls — do not let it become a general "load sample pattern" feature; that would be new functionality CF didn't sign off on.

**Open risks / unknowns:**
- Whether 12 CC0 samples can be found that plausibly match the existing pad roles (kick/snare/hat/etc.) without sounding like a downgrade is unverified (severity: medium) — hand to Legal-bro to source, Tech-bro/Design-girl to judge fit.
- The demo-mode controller writing directly into the same pattern object the lesson reducer derives guidance from is architecturally delicate — confirm it can't leave the pattern in a state the reducer wasn't designed to guide from (severity: high) — hand to Architect.
- The lesson-completion fix changes a state machine v1.1 explicitly locked (Design-girl: "any edit restarts the lesson") — confirm the fix doesn't quietly reopen a broader "when does editing restart the lesson" question (severity: medium) — hand to Architect/Design-girl.

**For the next persona:**
- Finance-bro is skippable this cycle (no traction bar, no revenue model) — same call v1.1 made. Recommend Architect next: sign off on the demo-mode controller's interaction with the locked pattern/lesson state, and the lesson-completion fix's blast radius.

---

## Architect (ARCH) — 2026-07-16

**Clarity gate:** met (every raised problem got a direct, confirmed answer)

**Mid-session note:** repo was restructured in a separate session (see [docs/RESTRUCTURE.md](../../RESTRUCTURE.md)) — `App.tsx` split 1030→217 lines into `src/components/` (presentational) and `src/hooks/` (operation-scoped: `usePattern`, `useLiveInput`, `useTransportEngine`, `useKeyboardControls`, `useDraftPersistence`). No product behavior changed; all findings below hold against the new file layout (`commitPatternEdit`/`setGuideCompose`/`GuideStatus` now live in `src/hooks/usePattern.ts`).

**Decisions locked:**
- **Lesson-completion fix (S4.1) is far cheaper than scoped.** The grid was never actually locked outside `"guided"` status — [usePattern.ts:132](../../../src/hooks/usePattern.ts:132) shows `commitPatternEdit` already accepts edits at `"paused"`/`"complete"` and already calls the existing `setGuideCompose()` to exit. The bug is pure discoverability, not a state lock. Fix: wire a new "Stop/Continue editing" button directly to the existing `setGuideCompose()` — **zero new state, zero reducer change.** Cx downgraded **Medium → Low**.
- **Demo groove (S5.1) is a static, pre-authored, original Pattern JSON fixture** (same schema as any saved pattern, schemaVersion 3) loaded in **one `commitPatternEdit` call** — not a scripted per-cell timed write synced to the transport. The existing playhead/active-step rendering supplies the "reveal" visual for free during normal playback; no new timing/sync engine needed. Cx downgraded **High → Medium** — remaining complexity is walkthrough step-sequencing (UI), not data or timing.
- **Demo groove content must be original** (self-composed by the user), not transcribed from an existing song. Transcribing a real song's rhythm/note pattern into step-data can infringe composition copyright independent of the (now CC0) audio samples — same risk category as the sample-licensing issue, sidestepped entirely at zero extra engineering cost by using original material.
- **Walkthrough spotlight/backdrop is hand-rolled, not a library** (evaluated React Joyride, Shepherd.js, Driver.js, Tour Kit). Reasoning: exactly 6 fixed, always-present layout regions — not the dynamic/multi-page case these libraries are built for; the state-orchestration work (BPM, metronome, pattern write, `startGuidance()` per step) is unavoidable custom code regardless of library choice; this app's global unscoped CSS is already fragile (RESTRUCTURE.md's caught cascade-order regression) and a styled dependency risks a second collision; consistent with this session's earlier, separately-made call to reject Context API for the same "abstraction not earning its keep at this scale" reason.
- **`commitPatternEdit` remains the sole pattern-write boundary** — the demo-mode loader uses it exactly like any manual edit, no bypass path. Keeps "one pattern, one source of truth" intact and means the saved draft after a walkthrough is indistinguishable from a hand-authored one (matches PH's "no special-cased demo storage" lock).

**Component shape:** one new hook, `useWalkthrough` (or equivalent), holding step-index + backdrop-target state — consistent with the existing operation-scoped hook pattern from the restructure. No changes to `usePattern`, `useTransportEngine`, or `useLiveInput` internals; the walkthrough only calls their existing exported functions.

**Most expensive-to-reverse choice:** using a real song's transcription for the demo groove would have been the costly-to-reverse pick (a public legal exposure discovered post-ship forces an emergency asset swap). Already avoided by locking original content. The hand-rolled-vs-library choice is comparatively cheap to reverse later (UI-only, doesn't touch core app state) — correctly not over-engineered up front.

**Complexity ratings (final, supersedes PH's initial draft):**
- S4.1 (lesson-completion fix): **Low** (was Medium)
- S5.1 (demo-mode controller): **Medium** (was High)
- S5.2 (spotlight/backdrop UI): **Medium** (unchanged — hand-rolled cutout/positioning across the supported desktop widths is real but bounded work)

**Open risks / unknowns:**
- The demo groove JSON still needs to be authored and needs a "does it sound like a good demo" pass — that's a content/judgment task, not an architecture risk.
- Hand-rolled backdrop positioning needs verification at the same desktop viewport floors v1.1 locked (1280×720, 1680×1046) — same class of risk RESTRUCTURE.md already flagged for this app's CSS.

**For the next persona:**
- Design-girl: spec the actual backdrop/spotlight visual treatment (hand-rolled, no library) and confirm it holds at the locked desktop viewport floors.
- Legal-bro still owed: CC0 sample sourcing/verification and "Stylo Drum Machine Coach" naming-distance call (both flagged by CF/PH, untouched by this ARCH pass).
- Security-master and DevOps still owed: public-exposure re-review and hosting pick (S3.1/S3.2), unaffected by anything decided here.

---

## Legal-bro (LB) — 2026-07-16

**Clarity gate:** met

**Decisions locked:**
- **Name: "Beats Drum Machine Coach"** (plural "Beats", not singular "BEAT"). Singular "BEAT" mirrors the hardware's own sub-brand name ("Stylophone BEAT") too closely; plural "Beats" reads as ordinary descriptive English, a materially safer trademark position — not a cleared name, no attorney/clearance search performed, just a lower-risk distancing move. Add an explicit "not affiliated with or endorsed by Dubreq Ltd" disclaimer in-app (footer/about) regardless — cheap, standard nominative-fair-use hygiene, applies no matter the final name.
- **Audio relicense executed.** All 12 `pad-*.wav` roles plus the `stick.wav` metronome click (13 files — the real in-use set; `kick.wav`/`snare.wav`/`hat.wav`/`bass_C2.wav` are dead code, confirmed via `src/lib/audio.ts` and `src/lib/constants.ts`, deleted not relicensed) sourced from freesound.org, each individually verified "Creative Commons 0" on its own sound page — not pack-level trust. Staged in `public/rok-cc0/` with full provenance in `public/rok-cc0/CREDITS.md` (title, uploader, URL, upload date, license, download date per file). **Not yet wired into `public/rok/`** — that's EPIC 2 S2.2 execution, still open.
  - Known gaps for whoever does the wire-up: one file (`pad-4-open-hihat`) downloaded as MP3 while the rest are WAV — decide on conversion; low/mid/high tom share one creator's kit, kick/snare share a different one — listen through for consistency before locking.
- **Git history scrub: locked as a planned follow-up, explicitly NOT done yet.** The repo (`github.com/chitranshjoshi99/Stylophone`, confirmed private) has the archive.org-sourced samples in history since commit `3eb2628`. Scrubbing now would break the app — the CC0 replacements aren't wired into `public/rok/` yet, and a naive path-based purge would delete the *current* files too since replacements will likely share the same filenames. **Correct order:** (1) EPIC 2 S2.2 swap + commit first, (2) then strip the old archive.org blobs by SHA-1 (`git filter-repo --strip-blobs-with-ids`, not a path-based purge) so the new commit's same-path files survive, (3) confirm again before any force-push. Repo is still private, so no forks/clones are at risk in the meantime.

**Recommendations:**
- Keep the disclaimer and the CREDITS.md record even though neither is strictly legally mandated for a personal/hobby release — both are cheap insurance against a dispute, and cost nothing to maintain going forward.

**Open risks / unknowns:**
- "Beats Drum Machine Coach" is a risk-reduction choice, not a cleared one — if this ever generates real traffic/attention, a real trademark clearance search is still worth doing (severity: medium, low urgency at prototype scale).
- Kit-consistency across the 13 replacement samples needs a human listening pass before EPIC 2 locks the swap (severity: low — audio quality, not legal risk).

**For the next persona:**
- DevOps: hosting pick for S3.1, and coordinate the "swap-then-scrub" git sequencing above with whatever deploy pipeline gets set up. Security-master: S3.2 public-exposure re-review is still untouched by this pass.

---

## Design-girl (DG) — 2026-07-16

**Clarity gate:** met (5/5 answered, 2 resolved via recommendation on "your call")

**Decisions locked:**
- **Walkthrough auto-launches on first visit** — no blank-grid orientation beat first. Flagged the risk (feels like an ambush before the visitor has oriented) and the user chose auto-launch anyway; recorded as an accepted risk, not silently overridden.
- **Spotlight treatment: dim-only.** A backdrop overlay darkens every section except the current target; no border/glow/extra chrome on the highlighted section. Simplest hand-rolled option — confirms ARCH's Cx-Medium estimate for S5.2, no new visual language invented.
- **Rebrand is a plain text swap.** "Beats Drum Machine Coach" replaces the header title text only — no new logo/wordmark. Keeps v1.1's locked "quiet branding" header treatment intact.
- **Reduced motion:** the walkthrough's dim/spotlight transitions respect `prefers-reduced-motion` exactly as v1.1 already does elsewhere — instant swap, no crossfade, no separate exception carved out for the walkthrough.
- **Sub-desktop-floor visitors get a message gate, not a scaled view.** Below the existing supported-desktop floor (1280×720 per v1.1), show a plain "best viewed on a larger screen" message instead of the app. Rejected CSS-scaling the full desktop layout into a phone viewport — technically shows "the same view" but renders every control/label illegibly small, which is worse than nothing. Real mobile support stays deferred to a future iPad app (CF/PH's already-locked call) — this is only a guard rail against a broken/jumbled experience in the meantime, not new mobile UX.

**Recommendations:**
- Keep the message-gate copy minimal and non-apologetic — it's a scoping fact ("built for larger screens"), not an error state.

**Open risks / unknowns:**
- Auto-launch-on-first-visit for a stranger with zero context is a real UX bet the user made against my recommendation — worth watching via the pageview analytics (S3.3) for early-bounce signal, though that alone won't prove causation (severity: low, accepted knowingly).

**For the next persona:**
- Security-master: S3.2 public-exposure re-review, untouched by this pass. DevOps: S3.1 hosting pick, untouched by this pass.

---

## Tech-bro (TB) — 2026-07-16

**Clarity gate:** met

**Decisions locked:**
- **Existing structure from RESTRUCTURE.md is confirmed as the standing rule for v1.2**, not reinvented: `src/components/` (presentational, self-owns its `.css`), `src/hooks/` (operation-scoped), `src/lib/` (pure logic), shell files at `src/` root.
- **Placement rule:** new UI → `src/components/<Name>.tsx` + matching `.css`; new state/orchestration → `src/hooks/use<Name>.ts`; new pure data/logic → `src/lib/<name>.ts`. Naming stays camelCase for hooks/components, matching the existing convention — no new casing style introduced.
- **Rebrand (EPIC 1): zero new files.** Text-only swap — `index.html` title, `Header.tsx` title string, `README.md`, the DG/LB disclaimer line.
- **Audio swap (EPIC 2): zero new code.** Move/rename the 13 staged `public/rok-cc0/` files into `public/rok/` at their existing paths (`pad-1.wav`, `stick.wav`, etc.) — `audio.ts`/`constants.ts` already reference those exact paths. Delete the 4 dead files. File-ops only, no refactor.
- **Lesson-completion fix (EPIC 4): one new prop.** [LessonPanel.tsx](../../../src/components/LessonPanel.tsx) already owns `guideStatus`/`guideLabel`/`onRestartGuidance` fed from `usePattern`'s `setGuideCompose`. Add `onStopLesson` wired to the same existing `setGuideCompose()`, same pattern as `onRestartGuidance`. No new component, no new hook — confirms ARCH's Cx-Low.
- **Walkthrough (EPIC 5): the one real build.** `src/hooks/useWalkthrough.ts` (step index, backdrop target, first-visit localStorage flag, Next/Skip handlers — calls existing `usePattern`/`useTransportEngine` exports, no new write path), `src/components/Walkthrough.tsx`+`.css` (dim-only backdrop, `getBoundingClientRect` on the five known target components, no positioning library per ARCH's hand-rolled call), `src/lib/demoGroove.ts` (one exported original `Pattern` constant, same schema as any saved pattern).
- **Buy/borrow: nothing new.** No tour library, no animation library — CSS transitions + existing React state cover the whole cycle.

**Deliberate cuts (revisit later):**
- No "?" retrigger persistence beyond localStorage — account-based persistence is a real feature addition, not a v1.2 concern.
- No step-level analytics inside the walkthrough — S3.3 locked plain pageview-only; funnel tracking is a v1.3+ ask if ever needed.

**For the next persona:**
- Ready for `generate`. Security-master (S3.2) and DevOps (S3.1) are explicitly deferred to a separate session per user request — `generate` will document those two stories as blocked/not-started rather than fully speced, not silently drop them.

---
