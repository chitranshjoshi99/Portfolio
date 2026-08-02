# EPIC 2: Song → Lesson Reduction

Turn a ≤15s slice of a song into a **draft lesson**: a simplified 8-beat groove (kick/snare/hat + a monophonic bassline) mapped onto the Beat. This is the app's magic and its biggest technical risk — so its core engine is built and validated **first, as a plain script**, before any UI. The output is always a *rough draft* the user hand-corrects (EPIC 3); it is a reduction/arrangement, never a faithful transcription.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|-----------|----------|
| 2.1 | As the builder, I want a `reduce()` engine that turns a ≤15s clip into a draft lesson JSON so the risky bet is proven before I build around it. | Critical | High | 1 |
| 2.2 | As the app, I want a local sidecar exposing `POST /reduce` so the browser can request reductions on localhost. | High | Low | 14 |
| 2.3 | As the user, I want to feed a song via file upload or a YouTube link and clip a ≤15s region so I can choose exactly what to reduce. | High | Medium | 15 |
| 2.4 | As the user, I want an upload UI that runs Process and drops the draft into the editor so the pipeline is usable end to end. | Critical | Medium | 16 |

> Severity & complexity are business/conceptual. **2.1 is the prototype gate — do it first; 2.2–2.4 come last, after the app exists to receive drafts.**

## Locked decisions

See [README](README.md). Epic-specific:

- **`reduce(clip) → draftLesson` is ONE interface.** v1 impl = Demucs stem-sep + DSP; keep it swappable (on-device DSP later).
- **Pipeline:** clip (≤15s) → **Demucs** (drums + bass stems) → drums: onset detection (librosa) + frequency-band classification → {kick, snare, hat}, quantized to the 32-step grid at the detected/given BPM → bass: **YIN/pYIN** monophonic pitch per step → nearest pad position + octave (−2..+2) → assemble draft JSON (schema in README). **Grid = 32 steps (16th-note) over the 8-beat / 2-bar loop** — quantize onsets/notes to the nearest of 32 steps.
- **Draft ≠ final.** Optimize for "close enough to hand-correct," not perfection. Hand-correction (EPIC 3) is the built-in safety net.
- **Reduction runs on a user-selected ≤15s region only.** Not the whole song.
- **Runs desktop-only** in the Python sidecar. Sidecar binds `127.0.0.1` only.
- **BPM:** prefer detecting tempo (librosa) but allow the UI to pass a known BPM to improve quantization.
- **Legal (publish-time):** yt-dlp ingest is a personal-use convenience; sampled sounds + trademark are publish risks. Not blocking for personal v1.

## Execution instructions (priority order)

### 1. `reduce()` engine (script) — S2.1 (Priority 1) — PROTOTYPE GATE
- **Goal:** a standalone Python script `reduce.py <audio> --start S --end E [--bpm N]` prints/writes a draft lesson JSON matching the README schema. Validated by running on **2–3 of the user's real target songs** and eyeballing the draft (loaded into the grid once EPIC 1 exists, or inspected as JSON).
- **API contract (function):** `reduce(path, clip_start, clip_end, bpm=None) -> dict` returning the lesson schema (minus `id`/`title`, which the app fills).
- **Data model:** input audio file; output lesson JSON.
- **Key decisions:**
  - Stems: Demucs (`htdemucs`), take `drums` + `bass` stems on the clipped region.
  - Drums: `librosa.onset.onset_detect` on the drum stem; classify each onset by spectral band energy (low→kick, mid/broadband-transient→snare, high→hat); quantize onset times to nearest step given BPM + downbeat. **Fallback if band-classify lands <~50%:** a drum-transcription model (**madmom** drum transcription / **omnizart-drums**) — NOT better stem-sep (Demucs separates *instruments*, not *drum pieces*, so a cleaner drums stem still needs piece-level transcription).
  - Bass: `librosa.pyin` on the bass stem; per step take the dominant pitch; map Hz → nearest semitone → pad position (1..7 numbering) + `octave` (−2..+2 relative to a chosen center).
  - BPM: `librosa.beat.beat_track` if `--bpm` not given.
- **Acceptance:** on a real clip, produces valid schema JSON; drum hits land on plausible steps; bass notes map to in-range pad positions/octaves; **user confirms the draft is "close enough to fix by hand" on ≥2 of 3 test songs.** If drum accuracy is weak, switch the drum path to a **drum-transcription model** (madmom/omnizart-drums) — not better stem-sep — and re-test before proceeding. This gates the rest of the build.

### 2. Local FastAPI sidecar — S2.2 (Priority 14)
- **Goal:** expose `reduce()` over localhost for the browser.
- **API contract:** `POST http://localhost:8000/reduce` — multipart body: `file` (audio) OR `youtube_url` (string), `clip_start` (float), `clip_end` (float), optional `bpm` (float). Response `200`: the draft lesson JSON. Errors: `400` invalid input, `422` reduction failed (with message), `413` file too large.
- **Key decisions:** FastAPI + uvicorn, bind `127.0.0.1:8000` only. Run reduction in a worker (async/thread) so the request can stream a simple progress/status. CORS allow the local Vite origin.
- **Acceptance:** posting a clip returns a valid draft JSON; posting junk returns a clean 4xx; server is unreachable from other hosts.

### 3. Audio ingest — S2.3 (Priority 15)
- **Goal:** accept a file or a YouTube URL, and clip to the ≤15s region.
- **API contract:** internal — `ingest(file|url) -> wav_path`, `clip(wav, start, end) -> wav`.
- **Key decisions:** file → decode via ffmpeg/soundfile; YouTube → `yt-dlp` (bestaudio) → wav. Enforce **≤15s** clip length server-side. **Validate before subprocess** (SM trust boundary): allowed audio mime/extension, max file size, max duration; reject anything else.
- **Acceptance:** a local mp3/wav and a YouTube link both yield a clipped wav; clip > 15s is rejected/truncated; oversize/wrong-type files are rejected with 4xx before any heavy processing.

### 4. Upload UI + wire to editor — S2.4 (Priority 16)
- **Goal:** the user selects a source, picks a ≤15s region, hits Process, and the returned draft opens in the editor (EPIC 3).
- **API contract:** UI calls `POST /reduce`; on success, load the draft into the editor state.
- **Key decisions:** minimal UI — source picker (file / YouTube URL), a waveform or simple range selector for the ≤15s region, optional BPM field, one **Process** button + spinner (no progress theater). On error, show the sidecar's message.
- **Acceptance:** end to end — pick a song, select a section, Process, and a draft lesson appears in the editor ready to hand-correct and save.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 2.1 | `reduce()` engine (gate) | Done | S1 | GATE PASSED 2/3 (Janice/Billie Jean). Downbeat-phase align + 1 loop window + BPM override; drums per-band onset+strength gate (match BJ published grid); bass onset-driven (matches BJ riff). Limits→hand-correct: 808 low-ends, bass-less intros, busy sections. See `sidecar/reduce.py`, `render_preview.py`, plan `docs/executions/v1/EPIC-2-reduction.json`. |
| 2.2 | FastAPI sidecar `/reduce` | Done | S6 | `sidecar/app.py`: multipart file + clip/BPM validation, 50 MiB bound + audio-header preflight before Demucs, thread-pooled `reduce()`, clean 400/413/422 errors, temp cleanup, original filename preserved, local-Vite CORS, uvicorn bound `127.0.0.1:8000`. 9 contract tests pass. Live socket: junk→400; Janice 15s→200 + schema-valid populated draft. Plan: `docs/executions/v1/EPIC-2-sidecar.json`. |
| 2.3 | Audio ingest + ≤15s clip | Done | S7 | `ingest.py`: exactly-one MP3/WAV or YouTube source; type/header/50MiB/30min validation; YouTube host + no-playlist guard; argument-list `yt-dlp`; ffmpeg mono 44.1k WAV clip ≤15s. `/reduce` now runs ingest→clip→reduce in one worker and restores original source metadata. 20 tests pass. Real WAV+MP3 clips verified; live MP3 endpoint→valid draft; live YouTube→8s WAV on Python 3.12 + yt-dlp 2026.07.04. Runtime baseline raised to Python 3.11+ / current yt-dlp. Plan: `docs/executions/v1/EPIC-2-ingest.json`. |
| 2.4 | Upload UI → editor | Done | S8 | Typed reduction client + accessible source panel for MP3/WAV or YouTube, clip range, optional BPM, honest busy/error/success states, and validated draft adoption into the editor. Production build + React review pass; 20 sidecar tests pass. Browser QA verified responsive layout, invalid-duration isolation, and a successful 126 BPM draft with 23 populated cells and no console errors. EPIC-2 complete. Plan: `docs/executions/v1/EPIC-2-upload-ui.json`. |

> Status ∈ {Not started, In progress, Blocked, Done}.
