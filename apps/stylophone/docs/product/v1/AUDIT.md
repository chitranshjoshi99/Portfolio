# Product audit — 2026-07-12

Reviewed after: **docs generated, nothing built yet** (pre-build paper audit).
Method: re-entered each persona (including the deferred DS/FB/SM/DO/LB) and interrogated its own locked decisions. Ordered most-wrong first.

| Persona | Verdict | Regret / drift | Fix |
|---------|---------|----------------|-----|
| Product-head | **Revise** | 16-step (eighth-note) grid can't represent 16th-note hats — the staple of the HIP/TEC banks the device ships with | Grid = **16th-note resolution (32 steps over the 2-bar loop)**; set `steps: 32` default |
| Architect | **Revise** | Named "plug Demucs up" as the drum fallback — but Demucs separates *instruments*, not *drum pieces*; it can't split kick/snare/hat | Fallback for drum-piece ID = a **drum-transcription model** (madmom / omnizart-drums), not better stem-sep |
| DevOps | **Revise** | "Web is publishable" is only half-true — the `reduce()` pipeline needs the local Python sidecar a hosted web app can't provide | Treat publish as **two tiers**: practice/authoring = pure web (easy); reduction = needs Electron or a cloud GPU backend (a real v1.1+ call) |
| Security-master | **Revise** | Docs say "validate upload" but don't name the actual holes | Sharpen: yt-dlp URL passed as **arg not shell** (no injection), sidecar binds **127.0.0.1 only**, CORS to local origin, treat every uploaded file as hostile to ffmpeg/Demucs (type+size+duration caps) |
| Product-head | **Watch** | v1 lesson = one 8-beat loop = one section — may feel like a toy, not a song | If one loop underwhelms in practice, pull minimal **2-pattern (verse/chorus)** support forward from v2 |
| Tech-bro | **Watch** | If the `reduce()` gate barely passes, the whole EPIC-2 UI (2.2–2.4) is low-ROI vs. great hand-authoring | Let the **gate result size the pipeline-UI investment** — don't over-build upload if the draft is weak |
| Co-founder | **Holds*** | "Share it later" is a bigger pivot than "someday" implies — v1 choices (trademark replica, sampled sounds, YouTube ripper, no accounts) actively complicate publishing | Accept publish = a *re-skin + legal pass*, not a toggle. No v1 change needed |
| Design-girl | **Holds*** | Orange carries brand + layer-state + hit-now at once — could get muddy on a busy grid mid-play | Validate the visual hierarchy in real playback; keep motion+shape doing real work, not just brightness |
| Legal-bro | **Holds (deferred)** | Correctly out of scope for personal v1 | Before ANY public release: re-skin off Stylophone®/Beat trademark, replace sampled sounds, remove/gate yt-dlp, address user-shared copyrighted-song lessons |
| Data-scientist | **Holds (deferred)** | n=1 — no market gating needed | Revisit before the community/publish pivot |
| Finance-bro | **Holds (deferred)** | Same | Same |
| COO / EM | **Holds (N/A)** | Solo personal build — no cohorts, no team execution to plan | Re-run only if this becomes a team/commercial product |

\* Holds, with a watch-item attached.

## Detail (most-wrong first)

### Product-head — Revise: grid resolution
The single most likely thing to bite. I overrode the user's "8 steps" up to **16 (eighth-note)** — but 16 steps across an 8-beat / 2-bar loop still can't place a **16th note**. The Beat's own sound banks are **ROK / TECHNO / HIPHOP / BEATBOX** — techno and hip-hop grooves *live* on 16th-note hi-hats. A grid that can't represent them will teach flattened, wrong-feeling versions of exactly the genres this device is for. Staying faithful to the device's 2-bar loop *and* supporting 16ths means **32 steps (16th-note resolution)**.
**Fix:** default `steps: 32`. The schema is already versioned and `steps` is already a field — this is a near-free change *now* and an expensive one after the grid, editor, and cue engine are built against 16. Make it before Priority 5 (the grid).

### Architect — Revise: drum-piece fallback was misnamed
The risky story is splitting a drum stem into kick/snare/hat. My doc said if DSP band-classification is poor, "plug Demucs up." Wrong — **Demucs separates instruments (drums/bass/vocals/other), not drum pieces.** A better Demucs gives a cleaner *drums* stem but still one mixed drum track. The real fallback ladder is: **DSP band-energy classify → (if weak) a drum-transcription model** (madmom's drum-transcription, omnizart-drums). Bass pitch-tracking (YIN) is fine as-is.
**Fix:** update EPIC-2 S2.1 fallback wording to name a drum-transcription model, not stem-sep, as the accuracy upgrade. The `reduce()` prototype gate should test band-classify first and have the model path ready if it lands <~50%.

### DevOps — Revise: "web = publishable" is half-true
ARCH sold web partly on publishability. True for the **instrument, editor, and guided-play** — those are pure browser and host trivially. **Not** true for `reduce()`: it needs Demucs in the local Python sidecar, which a hosted web page cannot reach. So a publicly hosted web build can *play and author* but can't *reduce a song* without the user running local Python. Publishing the full experience means Electron (bundle Python) or a cloud GPU service (cost + accounts + the legal issues). This doesn't change v1, but it corrects a false sense that "publish" is one step.
**Fix:** record the two publish tiers in README's publish notes so a future session doesn't assume the whole app ships as a static site.

### Security-master — Revise: name the real holes
Low-severity for a localhost personal tool, but the doc's "validate upload" is too vague to act on. Concrete must-dos: (1) **yt-dlp** — pass the URL as a subprocess **argument list, never a shell string**; validate it's an `http(s)` YouTube URL. (2) **Sidecar binds `127.0.0.1` only** — never `0.0.0.0` (that would expose reduction to the LAN). (3) **CORS** allow only the local Vite origin. (4) Treat every uploaded file as hostile input to **ffmpeg/Demucs** — enforce type + size + ≤15s duration *before* processing.
**Fix:** add these four lines to EPIC-2's security notes.

### Product-head — Watch: is one loop a song?
The user's north-star was "loop beats+bass, play melody, sing along." v1 delivers only the Beat loop, one section, no melody (GenX1 descoped), no sections (PATRN v2). That's a real slice — but a single 8-beat loop may feel like a toy rather than "I played a song." The bet is that *nailing one killer groove* is motivating enough. If it isn't, the cheapest lift is minimal **2-pattern** support (verse/chorus swap) — the device's PATRN feature — pulled forward.
**Fix:** none now; watch after first real use. Flag PATRN as the first thing to pull from v2 if one loop underwhelms.

### Tech-bro — Watch: let the gate size the pipeline
If `reduce()` (Priority 1) lands ~70%, the upload pipeline (2.2–2.4) is high-value. If it lands ~40%, hand-correction ≈ hand-authoring, and the upload UI is polishing a weak feature. The build order already puts the gate first — good — but the *decision to invest in 2.2–2.4* should be made **after** seeing the gate result, not assumed.
**Fix:** treat Priority 14–16 as gated on the Priority-1 result; note it in the tracker.

## Resolution (user decisions, 2026-07-12)
- **ARCH (drum fallback) — APPLIED** to EPIC-2 S2.1.
- **DevOps (publish tiers) — DEFERRED to v1.1+** — v1 is personal, no publishing.
- **Security (upload/yt-dlp hardening) — DEFERRED to v1.1** — v1 is a purely functional personal build.
- **Grid resolution (16 → 32 steps) — APPLIED.** Grid = **32 steps (16th-note)** over the **8-beat / 2-bar loop** (loop length unchanged, faithful to the device). Updated in README (schema + tracker), EPIC-1 (locked decisions + S1.4), EPIC-2 (quantization), execute.md.

## Net: is the plan build-ready?
**Yes, with one change worth making before code:** the **32-step (16th-note) grid**. It's cheap now and structural later. The drum-fallback and security sharpenings are doc edits, not redesigns. Everything else holds or is a post-build watch-item. The risk-first build order (prove `reduce()` before building around it) is the plan's best decision and stands.
