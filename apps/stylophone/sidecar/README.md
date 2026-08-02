# Stylophone Beat Coach — Python sidecar

Desktop-only local reduction engine (EPIC-2). Binds `127.0.0.1` only. No cloud.

## Story 2.1 — `reduce()` engine (this file: `reduce.py`)

Turns a ≤15s audio clip into a **draft** lesson JSON (README schema v1). It's the
prototype gate: proven on 2–3 real songs before any UI is built.

### Setup (heavy — ~2GB torch + demucs model download)

Use Python 3.11 or newer. Current yt-dlp releases no longer support the old
Python 3.9 sidecar environment reliably against YouTube.

```sh
brew install ffmpeg                     # decode mp3/m4a
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### Run

```sh
# pure-python checks, no heavy deps needed:
python reduce.py --selfcheck

# reduce a clip (region must be <=15s):
python reduce.py song.mp3 --start 30 --end 38 --out draft.json
python reduce.py song.mp3 --start 30 --end 38 --bpm 128   # pass a known BPM

# validate any draft against the schema:
python reduce.py --validate draft.json
```

`reduce(path, clip_start, clip_end, bpm=None) -> dict` is the one interface the
sidecar (story 2.2) will call. Returns the schema minus `id`/`title` (app fills those).

Pipeline: clip → Demucs `htdemucs` (drums+bass stems) → drums onset-detect +
spectral-band classify {kick,snare,hat} → bass pYIN → nearest pad + octave →
quantize to 32 steps → assemble + schema-validate.

## Story 2.2 — localhost API

From the repository root, start the sidecar with:

```sh
sidecar/.venv/bin/python -m sidecar.app
```

It listens only on `http://127.0.0.1:8000`. Send `POST /reduce` as
`multipart/form-data` with exactly one source: either an MP3/WAV `file` or a
single-video `youtube_url`. YouTube playlists are rejected. Include these text fields:

- `clip_start` — required, finite seconds from the start of the source
- `clip_end` — required, finite seconds greater than `clip_start`; the region must
  be 15 seconds or less
- `bpm` — optional, finite and greater than zero

Sources may be at most 30 minutes and 50 MiB, and the selected clip may be at most
15 seconds. Uploads must have an MP3/WAV filename, matching MIME type, recognizable
container header, and decodable matching contents. A successful request acquires the
source, renders the selected region as a normalized clip, and returns the lesson draft
JSON produced by `reduce()`. Its `source` metadata identifies the original upload or
YouTube URL and original clip offsets. Contract errors use JSON
`{"detail": "..."}` with these status classes:

- `400` — missing/ambiguous or invalid source, invalid clip fields, or unsupported input
- `413` — source exceeds the 50 MiB or 30-minute cap
- `422` — an unexpected acquisition or reduction failure

The boundary is intentionally local: CORS permits the Vite development app only at
`http://localhost:5173` and `http://127.0.0.1:5173`, and the server does not bind a
LAN/public interface.

Run the offline API contract tests from the repository root:

```sh
sidecar/.venv/bin/python -m unittest sidecar.test_ingest sidecar.test_app -v
```
