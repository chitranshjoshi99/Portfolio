# Execute — autonomous build handoff

You are building **Stylophone Beat Coach**, described in `README.md`. Implement it across multiple sessions **without waiting for user prompts between steps**. Everything you need is locked in `README.md` and the `EPIC-*.md` docs — do not re-litigate decisions already made there.

## Each session, do this

1. Read `README.md` (product + net tracker) and the relevant `EPIC-<n>-*.md`.
2. Find the next unblocked story by **priority order** in the net tracker (Status = Not started, dependencies Done). That is your task.
3. Set its Status to **In progress** in both the epic tracker and the net tracker.
4. Build it to the story's **acceptance** criteria, honoring the **locked decisions** (stack, API contracts, schema, design, a11y). These are fixed.
5. Verify it works — run it, observe real behavior (audio plays, playhead stays synced, draft JSON is valid). Not just types.
6. Update both trackers: Status → **Done** (or **Blocked** + reason), fill Session + Notes.
7. Commit with a conventional-commit message referencing the epic + story.
8. If budget remains, go to step 2. Otherwise stop cleanly — the trackers are the resume point.

## Rules
- **Build order = priority order** across the net tracker. Don't cherry-pick.
- **Priority 1 is a hard gate.** Story 2.1 (`reduce()` engine) must be built as a plain script and validated on **2–3 of the user's real songs** — the user confirms the draft is "close enough to hand-correct" on ≥2 of 3 — **before** building anything downstream. If it fails, mark Blocked, note it, and surface to the user; do not build the UI on an unproven engine.
- **Locked decisions are locked.** React/TS + Web Audio (Tone.js) for the app; Python sidecar (FastAPI + Demucs + librosa) for reduction; `localStorage` for lessons; the Lesson JSON schema in README is the spine — bump `schemaVersion` if it ever must change. If reality makes a locked decision impossible, mark the story **Blocked**, write why, move on — never silently swap a load-bearing decision.
- **Never hand-roll the audio scheduler.** All timing goes through Tone.Transport / Tone.Draw. A `setInterval` sequencer is a bug.
- **Ship the lazy version that meets acceptance** (tech-bro's cuts in the docs) — but never skip: file-upload validation before the Python subprocess, the a11y non-negotiables, or error handling that loses a user's lesson.
- **Resume from trackers.** The net tracker is the only source of truth for what's done. Keep it honest every session.

## Build order (priority sequence)

1. **EPIC-2 · 2.1** — `reduce()` engine (script) — **GATE: validate on real songs first**
2. EPIC-1 · 1.1 — Beat replica shell
3. EPIC-1 · 1.2 — Audio engine (ROK sample playback)
4. EPIC-1 · 1.3 — Metronome + 8-beat loop transport + BPM readout
5. EPIC-1 · 1.4 — 32-step grid visualizer (synced)
6. EPIC-1 · 1.5 — Bass 5-octave + simple octave control
7. EPIC-1 · 1.6 — Responsive two-pane layout + a11y baseline
8. EPIC-3 · 3.1 — Grid editor (hand-correction)
9. EPIC-3 · 3.2 — Lesson persistence + export/import JSON
10. EPIC-3 · 3.3 — New-lesson-from-scratch
11. EPIC-4 · 4.1 — Layered teaching model
12. EPIC-4 · 4.2 — Real-time cue engine
13. EPIC-4 · 4.3 — Hit/miss highlight
14. EPIC-2 · 2.2 — FastAPI sidecar `POST /reduce`
15. EPIC-2 · 2.3 — Audio ingest (file + yt-dlp + ≤15s clip)
16. EPIC-2 · 2.4 — Upload UI → draft into editor

> Rationale for the split: the `reduce()` **engine** is proven first (risk-first). The instrument, editor, and guided-play are then built on hand-authorable lessons (no pipeline dependency). The reduction **sidecar + ingest + upload UI** wire in last, once there's an app to receive drafts.

## First-session setup (before story 1)
- Scaffold the repo: a Vite + React + TypeScript app, and a `sidecar/` Python project (FastAPI, demucs, librosa, aubio/pyin, yt-dlp).
- No Electron, no cloud, no accounts. Sidecar binds `127.0.0.1` only.
- Then start story 1 (`reduce()` script) — it can be built and validated with only the Python side.

## Deferred (do NOT build in v1 unless a tracker says so)
- Electron packaging + thumbnail lesson catalogue (v1.1)
- Mobile PWA install / forced-landscape / touch tuning (fast-follow; keep layout responsive now)
- Authentic swipe-across-seam octave gesture (v1.1)
- Sound banks beyond ROK, PATRN storage, TRNSP, mute, filter (v2)
- Scoring / accuracy-% / streaks (v2)
- Anything requiring the deferred personas' sign-off for **publishing** (Legal: YouTube ingest, sampled sounds, Stylophone® trademark). Personal v1 is fine; a public release is not cleared.
