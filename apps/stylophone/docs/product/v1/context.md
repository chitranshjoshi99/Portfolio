# Product context

**Product:** A personal, interactive app that turns any song into a layer-by-layer play-along lesson for the Stylophone **Beat** drum machine, using a skeuomorphic device replica synced to a 16-step grid visualizer.
**Status:** in discovery

---

## Co-founder (CF) — 2026-07-12

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **Wedge = Stylophone Beat variant, not GenX1** — user can approximate melody on GenX1 (piano-like) but has no learning aid for the Beat sequencer; that is the desperate, unserved need. GenX1 melody play-along is a fast-follow, not v1.
- **v1 is a single-user, local, personal tool** — no accounts, auth, cloud library, sharing, or community. Sharing/publishing is an explicit *someday*, only after the personal tool proves useful. This deletes the entire fragile, expensive half of the original pitch.
- **UI = two synced, interactive panes:** (1) skeuomorphic **exact replica** of the physical Beat (circular pad, native 1 / 1.5 / 2 / 2.5 … numbering), (2) **16-step grid visualizer** (industry-standard step-sequencer notation). Both are clickable and produce sound like the real device.
- **Pedagogy = layered build.** Lessons construct a groove one layer at a time (e.g. kick → bass → hats), the way a musician actually builds a pattern — not a flat dump of the finished pattern.
- **Transcription is a rough draft the user hand-corrects.** Auto-transcription is imperfect; the single trusted user (a musician) edits the draft into a correct lesson. Hand-correction is an accepted, designed-in step, not a failure.

**Recommendations:**
- Treat auto-transcription as *assistive*, never authoritative. The Beat's grid-quantized, monophonic-ish content (drums + bass) makes onset-detection + 16-step quantization far more tractable than continuous vocal melody — lean into that advantage.
- The stylophone's odd pad numbering (1, 1.5, 2, 2.5 …) is a **lookup table**, not a hard problem — model it as a mapping, not a music-theory engine.

**Open risks / unknowns:**
- Transcription accuracy on real songs (severity: medium) — mitigated by hand-correction + single expert user, but still the load-bearing technical assumption. Revisit with ARCH.
- Two-instrument dream workflow (loop on Beat + melody on GenX1 + sing) is descoped to Beat-only for v1 — user confirmed the Beat is the piece he can't live without.

**For the next persona (Product Head):**
- Nail the exact Beat interaction model: it is a **step sequencer you program then loop**, not a cursor-chasing instrument. The "play-along" is layered *pattern construction*, synced across the replica pane and the 16-step grid pane. Define what a "lesson" is concretely (song → stems → per-layer 16-step patterns → guided build), and the JTBD around upload → draft → hand-correct → practice.

---

## Product Head (PH) — 2026-07-12

**Clarity gate:** met (9/10 — grid resolution is the one open decision)

**Device model (from official Beat manual, `BEAT01`):**
- The Beat is a **live real-time looper**, NOT a step editor. PLAY starts an 8-beat click (4/4, 2 bars, "1234 2234"); REC records taps played *live against the click*; you layer DRUMS then BASS, "as many layers as you like." No on-device grid, no data output (audio mini-jack only).
- Circular pad = one octave of pitch for BASS/TRNSP: 1, 1.5, 2, 2.5, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7 — half-steps map to piano black keys and **skip where piano has none** (no 3.5, no 7.5). Drums are on/off hits.
- **Bass = 5 octaves.** Octave shift by *swiping across the 7↔1 seam*: 7→1 up, 1→7 down, range ±2.
- 4 sound banks (ROK / TECHNO / HIPHOP / BEATBOX) — timbre only; the pattern is identical across banks.
- Advanced (v2): PATRN (4 stored 8-beat patterns, tap to swap — covers song sections), TRNSP (hold a pad to shift the recorded bassline by that interval), pattern-length, MUTE. FILTER — not actually on this model.

**Decisions locked:**
- **v1 audio = ROK bank only** (drum hits + bass, sampled from the user's own hardware). Other 3 banks are v2.
- **Sound bank is cosmetic** — lesson stores pattern + note data + chosen bank, not per-bank content.
- **No hardware sync in v1.** Beat has no data port. The **on-screen replica is the practice + feedback surface** (app knows on-glass taps, can guide/grade); the physical Beat is the destination the user graduates to. Deliberately, the replica does NOT auto-snap timing — same struggle as the real box, on purpose. The **grid pane is the teaching overlay** that makes timing legible.
- **Metronome faithful to the device** (knob position matches) **plus an added tiny BPM readout** the real device lacks.
- **A lesson is a *reduction/arrangement*, not a faithful transcription** — song's kick/snare/hat → Beat kit, bassline → monophonic line in the 5-octave pad range. Auto-pipeline gives a draft; the user hand-corrects it musical. This is the moat.
- **v1 lesson = one 8-beat loop = one song section.** Full multi-section songs need PATRN → v2.
- **Both upload AND real-time guided layered play are essential to v1** — neither is cut; only sequenced (E1 → E3 → E4 buildable without E2; E2 is the risky research piece, validated once the surface exists).
- **Metronome/BPM, 5-octave bass swipe gesture — in v1.**

**Open decision (needs user):**
- **Grid resolution.** PH recommends **16 steps (eighth-note)** over the user's suggested 8 (quarter-note) — 8 can't represent off-beats and would teach wrong-sounding grooves. Proceeding with 16 unless vetoed. (The "8 beat" refers to the loop length, not grid cells; device has no cells.)

**v1 EPIC → STORY spine (severity = business, complexity = conceptual/integration/unknown; dev effort ignored):**

*EPIC 1 — The Instrument*
- S1.1 On-screen Beat replica (circular pad w/ correct numbering, tempo knob, CLICK/PLAY/REC, mode/sound switches). Sev High · Cx Med
- S1.2 Tap pad → hear mapped ROK drum/bass (low-latency audio engine). Sev Critical · Cx Med
- S1.3 Faithful metronome/click + visible BPM readout + correct knob position. Sev High · Cx Low
- S1.4 8-beat loop transport (play / rec / loop scheduling). Sev High · Cx Med
- S1.5 16-step grid visualizer synced to pad + click. Sev Critical · Cx Med
- S1.6 Bass 5-octave swipe-seam gesture → pitch mapping. Sev Med · Cx Med

*EPIC 2 — Song → Lesson pipeline*
- S2.1 Upload a song file. Sev Critical · Cx Low
- S2.2 Stem-separate (drums / bass / other) — Demucs-class. Sev High · Cx High
- S2.3 Auto-reduce drums → 8-beat kick/snare/hat grid draft (onset detect + classify + quantize). Sev Critical · Cx High (accuracy = key risk)
- S2.4 Auto-reduce bass → monophonic note-per-step mapped to 5-oct pad. Sev Critical · Cx High

*EPIC 3 — Authoring & hand-correction*
- S3.1 Edit drafted grid (add/remove/move hits, change bass note + octave). Sev Critical · Cx Med
- S3.2 Save / name / load lessons locally (personal library). Sev High · Cx Low
- S3.3 Hand-author a lesson from scratch (no upload). Sev Med · Cx Low

*EPIC 4 — Guided play-along*
- S4.1 Teach one layer at a time (drums → bass). Sev Critical · Cx Med
- S4.2 Real-time pad + grid cues (which pad, which beat) synced to click. Sev Critical · Cx High
- S4.3 Timing feedback on on-screen taps (grade against tolerance). Sev Med · Cx Med

**Open risks / unknowns:**
- Auto-reduction accuracy on real songs (S2.3 / S2.4) — the load-bearing technical bet. Mitigated by hand-correction + single expert user. Hand to ARCH.
- Sound-sample source = recording the user's own Beat hardware — a content + (later) licensing question. Hand to ARCH / Legal.
- Grid resolution (16 vs 8) pending final user veto.

**For the next persona (Data Scientist):**
- v1 is a **personal tool** (n=1). A market reality check should size the *someday* community/publish opportunity (owners of the Stylophone Beat + niche-instrument learners), and validate the "no tutorials for niche instruments" gap the user claims — not gate v1, which is scratch-your-own-itch. Also worth: rough numbers on stem-separation quality / compute cost to inform ARCH.

> Note: DS + FB were **skipped for now** (user choice) — v1 is n=1, market sizing doesn't gate a scratch-your-own-itch build. Revisit before the community/publish "someday". Went to DG next.

---

## Design-girl (DG) — 2026-07-12

**Clarity gate:** met (9/10)

**Decisions locked:**
- **Visual direction = modern stealth.** Matte charcoal / near-black surfaces, minimal chrome, greys + soft-white text. NOT retro plastic. "The Beat, remastered" — faithful *mental model*, stylized for clarity.
- **Circular pad preserved exactly** — same layout + native 1 / 1.5 / 2 / 2.5 … numbering, so muscle memory transfers to the physical device. Everything else may be redesigned for looks *provided it still covers every feature*. Speaker grille → repurposed as an **info display** (BPM now, extensible later).
- **Single accent = Anthropic orange.** The only accent in the system; **state encoded by brightness of that one hue** — dim/muted orange = completed layer (keeps playing underneath), bright glowing orange = active layer + live "hit-now" cue. Brightest element on screen is always "now."
- **Home = instrument-first.** Land on the playable replica (best-looking surface, usable standalone to free-play / build a loop by hand). Lessons + library are entered *from* the instrument. Free-play must be fully functional with zero lessons.
- **Layout:** Desktop = replica **left**, grid **right**, both live. Mobile = **forced landscape, one pane at a time, grid default, swipe to switch** (no cramming). Portrait shows a clean "rotate to play" prompt, never a broken layout.
- **Live-cue visual language = switchable, default grid-cursor + pad-echo** (grid pane carries time via a sweeping playhead; pad pane echoes the target wedge). Alt = pulse-head (target wedge pulses ahead of the beat).
- **Layered teaching UX = progressive layer stack** (Drums → Bass → …). Practice the current layer looping; on completion it dims and keeps sounding while the next layer joins bright. Always visible how many layers deep you are.

**Accessibility must-haves (non-negotiable):**
- Live cues **never color-alone** — always hue *plus* motion *plus* shape (ring/brightness).
- **Reduced-motion mode** — calmer cue (flash/scale, not sweeping motion) for a motion-heavy rhythm app.
- Contrast AA on text/controls; pad wedges ≥44px-equivalent targets.
- **Desktop keyboard play** — map pad + transport to keys (also speeds practice + testing).

**Recommendations / design must-haves for build:**
- **First-run discoverability** for two non-obvious things: the **octave swipe-across-the-7↔1-seam gesture** (invisible affordance — needs an inline hint/animation) and the **pad numbering** (1, 1.5, 2 … skipping 3.5 / 7.5 — confuses newcomers; label or brief legend).
- Empty/first-run state for instrument-first home (invite to free-play or upload a first song).

**Open risks / unknowns:**
- Forced-landscape on mobile is a deliberate friction (device is landscape; pad + grid need width) — accepted, must be graceful.

**For the next persona (Architect):**
- The load-bearing technical bet is **Epic 2 auto-reduction accuracy** (stem-sep → playable 8-beat Beat draft: kick/snare/hat on a 16-step grid + monophonic bass in a 5-octave pad range). Assess feasibility, tech stack, and where reduction runs (on-device vs server) for a **mobile + desktop** app that is otherwise **local / single-user / no-accounts**. Also: **sound-sample sourcing** — v1 audio = ROK bank only, sampled from the user's own hardware (content + later licensing question). And a **low-latency audio + timing engine** (8-beat loop, click, grid-synced cues) is core to Epic 1/4.

---

## Architect (ARCH) — 2026-07-12

**Clarity gate:** met

**Platform / device targets (locked):**
- **Stack = Web, React + TypeScript + Web Audio API (Tone.js for transport/click/loop/cue scheduling).** Chosen over Flutter because the make-or-break component is the real-time timing engine, where Web Audio is best-in-class and Flutter is weaker — and Flutter's only edge (native resource access) buys nothing since heavy compute lives in a desktop sidecar. User is also more familiar with React/TS, and web is publishable.
- **Mobile = the same Web UI as a PWA. Desktop = Electron shell** hosting the Web UI + spawning a Python sidecar. (Electron over Tauri for predictable Chromium Web Audio; revisit if bundle size matters.)
- **Supported devices (locked):** Samsung S24+, iPhone 14+, MacBook M3+. Tight modern matrix, no low-end optimization. Note: iOS audio quirks (tap-to-start audio, background limits) are platform policy, not device power — still must be handled.

**Component shape (locked):**
- **Web UI (React/TS):** instrument (skeuomorphic replica + 16-step grid + Tone.js engine), guided-play/practice, authoring/editor, library (IndexedDB), lesson import/export.
- **Desktop-only Python sidecar (Electron-spawned):** audio in (file upload *or* yt-dlp) → clip ≤15s → **Demucs** stem-sep → **`reduce()`** (drum onset + frequency-band classify → kick/snare/hat; YIN monophonic pitch → pad + octave) → returns **draft lesson JSON**.
- **Mobile:** Web UI (PWA) only — import/play/free-play/hand-author, **no sidecar**.
- **Sync = manual export/import of lesson JSON.** No cloud, no accounts, no LAN discovery — the laziest sync that works.

**Load-bearing decisions (★ = most expensive to reverse):**
1. ★ Web platform (React/TS + Web Audio/Tone.js), PWA mobile + Electron desktop.
2. **Desktop-only heavy processing** via Python sidecar (**Demucs — MIT, free, best open-source separator**); export/import JSON sync. Enables heavy/accurate tooling with zero infra.
3. **`reduce(clip) → draft` behind ONE interface** — isolates the risky bet; Demucs now, on-device DSP (HPSS + band-classify + YIN) swappable later if mobile upload is ever wanted.
4. ★ **Lesson = versioned JSON schema** (below) — the spine everything hangs off.
5. **Prototype gate (do first):** build `reduce()` on 2–3 of the user's real songs, measure draft accuracy *before hand-correction*, before committing the rest. Cheapest de-risk in the project. If DSP/Demucs lands ~70%, ship; if ~40%, revisit.

**Lesson JSON schema (v1):**
```json
{ "schemaVersion": 1, "id": "uuid", "title": "…",
  "source": { "type": "upload|youtube|manual", "ref": "…", "clipStart": 0, "clipEnd": 15 },
  "bpm": 120, "bank": "ROK", "bars": 2, "steps": 16,
  "layers": [
    { "id": "drums", "type": "drums", "hits": [ { "step": 0, "sound": "kick" } ] },
    { "id": "bass",  "type": "bass",  "notes": [ { "step": 0, "pad": "1.5", "octave": 0, "length": 1 } ] }
  ],
  "teachOrder": ["drums", "bass"] }
```
`step` 0–15 · `sound` ∈ kick|snare|hat (ROK kit) · `pad` = native numbering string · `octave` −2..+2.

**Scope decisions:**
- **Loop selection ≤ 15 seconds** (locked) — keeps reduction accurate and processing fast.
- **YouTube-link ingest** via yt-dlp = desktop convenience, **personal-use v1 only**. **Spotify-link ingest = dropped** (DRM, no audio API — technically impossible to get full-song audio).

**Complexity adjustments to PH spine (business/conceptual only):**
- S2.2 stem-sep → **Medium** (commodity buy). **S2.3 drum reduction → High (the one true unknown).** S2.4 bass reduction → Med-High. S4.2 real-time cues → Med-High. Rest Low-Med.

**Open risks / unknowns:**
- **Reduction accuracy (S2.3 esp.)** — still the #1 bet; gated by the prototype above; hand-correction is the built-in fallback.
- **★ LEGAL: YouTube-link ingest** — fine for personal use, but shipping/publishing a built-in YouTube ripper is a ToS/copyright exposure. **Hand to LB.**
- **★ LEGAL: ROK sound samples recorded from the user's own Dubreq Beat hardware** — personal use likely fine; redistribution in a published app is a rights question. **Hand to LB.**

**For the next persona (Legal-bro):**
- Two live exposures to rule on before any public/publish path: (1) built-in **YouTube audio download** (yt-dlp) for stem separation; (2) **redistributing sampled Beat/Dubreq sounds** + the skeuomorphic replica of a **trademarked product** (Stylophone® is a Dubreq trademark; the app replicates its look and name-adjacent identity). Personal v1 is low-risk; publishing changes everything. Give sound, compliant guidance + the risk ladder, not workarounds.

---

## Tech-bro (TB) — 2026-07-12

**Clarity gate:** met

**Buy / borrow (write zero):**
- Stem-sep → **Demucs**. Transport/click/loop/cue scheduling → **Tone.js Transport** (do NOT hand-roll an audio scheduler). Onset/tempo/pitch → **librosa + aubio/pYIN**. YouTube → **yt-dlp**. ROK samples → record once, ship as **static files**.

**Deliberate cuts (with when-to-revisit):**
- **Electron → v1.1** — v1 runs as **React dev server + local FastAPI sidecar on `localhost`**; browser calls localhost. Package with Electron only when sharing with others. The **thumbnail lesson catalogue / "premium" shell** ships with the Electron packaging in v1.1.
- **IndexedDB → cut; use `localStorage`** (lessons are ~KB JSON). Revisit if storing audio blobs or a huge library.
- **Grading/scoring (S4.3) → trim to free version:** light pad **green on hit inside step window, nothing on miss**. Cut accuracy-%, streaks, scoreboards → v2.
- **Authentic swipe-across-seam octave gesture (S1.6) → trim:** keep octave in data + a **plain octave control**; exact device-matching seam-swipe feel → v1.1.
- **`reduce()` pipeline UI → one button + spinner** ("select ≤15s → Process → draft fills grid").
- **Mobile polish (PWA install, forced-landscape handling, touch tuning) → fast-follow.** BUT build **responsive two-pane layout (CSS grid that collapses to single-pane) from day one** so mobile is later config, not surgery.

**NOT lazy about (kept):** DG's a11y non-negotiables (reduced-motion, color-never-alone, keyboard play); **input validation on file upload** in the sidecar (untrusted file → subprocess = trust boundary; confirm with SM).

**Build order (locked — risk first):**
0. **`reduce()` as a plain script** (no UI). Run on 2–3 of the user's real songs, print draft JSON, eyeball accuracy. **Everything else waits behind this gate.**
1. Instrument (replica + 16-step grid + Tone.js engine + ROK sound + click + 8-beat loop).
2. Editor / hand-correction + localStorage library (save/name/load) + export/import JSON.
3. Guided layered play (cue engine: grid-cursor + pad-echo; hit/miss highlight).
4. Wire upload → sidecar `reduce()` → draft into editor.
(Mobile polish + Electron packaging + banks/PATRN/TRNSP = v1.1/v2.)

**Decisions confirmed by user:**
- Skip Electron for personal v1 (A = yes). Desktop-first with mobile-ready responsive layout (B = yes).

**For generate / remaining personas:**
- **DS, FB skipped** (n=1 personal tool — no market gating). **SM = minimal** (local app, no server/accounts; only real surface = file-upload validation into the Python subprocess). **DO = near-trivial** (v1 is a local dev server + localhost sidecar; deployment is a v1.1 concern when publishing web/Electron). **LB = publish-time only** (YouTube ingest, sampled sounds, Stylophone® trademark) — does NOT gate personal v1 build.
- Build-critical inputs for the EPIC docs (PH, ARCH, DG, TB) are all captured above.

---

## Design-girl (DG) — post-build UAT — 2026-07-14

**Clarity gate:** met (9/10 — 12×32 mode-projected grid resolved after the initial handoff)

**Decisions locked:**
- **Compact device chassis** — match the physical Beat's control topology and approximately 3:2 proportions; do not reproduce decorative dead space such as the stylus trough.
- **BPM replaces the speaker grille** — keeps the hardware spatial map while making the grille useful.
- **Transport becomes symbol-only** — metronome, play/stop, and record glyphs with accessible names, tooltips, focus states, and 44px targets.
- **Half-step wedges become black-key geometry** — `.5` pads stop well outside the center circle while natural wedges reach it; invisible hit regions preserve accessible targets.
- **Upload and library become utility modals** — launched from upload/download icons at the visualizer bottom; the default workspace keeps the instrument and grid visible.
- **Theme lock revised** — global active/playhead emphasis is soft-white; orange is local to the circular pad; semantic green may remain for hit confirmation.
- **Grid geometry must not collapse** — stable cells at desktop, horizontal scroll below supported width rather than overlap/compression.
- **Grid = one fixed 12×32 surface projected by instrument mode** — DRUMS shows 12 physical pad/sample rows; BASS shows 12 chromatic pitch rows with octave on cells. The existing mode is the only view state; hidden layer data remains intact and audible.

**Recommendations:**
- Persist exact drum `pad` identity so the DRUMS projection and guided practice point to the real physical target. In BASS projection label rows `1 · C` through `7 · B` with consistent sharps and show octave per filled cell.

**Open risks / unknowns:**
- The current Pattern/Lesson schema stores only kick/snare/hat drum lanes; implementing the locked 12-pad DRUMS projection requires the schema-v2 pad-identity migration specified in BUG-002 (severity: high, resolution defined).

**For the next persona (Tech-bro):**
- Choose the smallest honest data/audio change that supports 12 physical drum-pad targets, continuous bass hold/slide interaction, drum-mode octave disabling, quieter click sound, and the supplied drum-sample library. Do not build 13 visual aliases over three stored drum sounds.

---

## Design-girl (DG) — UAT specification revision — 2026-07-14

**Clarity gate:** met (10/10 for the BUG-001 design scope)

**Decisions locked:**
- **Fidelity boundary clarified** — only the circular pad-key geometry must match the physical device exactly; the chassis remains a compact approximately 3:2 reinterpretation without decorative dead space.
- **Pad traversal is functional, not decorative** — natural keys meet along an uninterrupted inner lane; `.5` keys sit between them at half radial depth. An inner BASS slide goes directly between natural notes, while an outer slide can intentionally traverse the half-step.
- **Device topology is explicit** — BPM top-right with tempo below; 2×2 profile selector mid-left; vertical octave immediately left of the dominant mid-right pad; symbol transport bottom-left; DRUMS/BASS bottom-middle.
- **Profile selector = 2×2** — faster and clearer than a miniature four-position vertical control. ROK is active; unshipped HIP/TEC/BOX banks remain disabled in v1.
- **Current orange theme stays** — this supersedes the prior post-build proposal for global soft-white and pad-only orange. Soft-white remains text/neutral contrast; green remains semantic correct-hit feedback.
- **Utility launchers are exact** — bottom-right Upload opens Source / Clip; Download opens Save Lesson / Import Lesson.
- **Grid labels are structurally separate** — a fixed label rail never consumes any of the 32 step tracks; headers, rows, dividers, and playhead share one aligned column template.

**Recommendations:**
- Implement the pad as a natural-key base with half-step overlays and deliberately layered hit regions; equal annular wedges cannot reproduce the physical interaction.

**Open risks / unknowns:**
- None in the revised BUG-001 design brief. Audible profile expansion beyond ROK remains outside v1.

**For the next persona:**
- Implement and visually verify BUG-001 R7–R9 against both physical-device references at 1280×720. Do not revive the withdrawn white-global-accent decision.

---
