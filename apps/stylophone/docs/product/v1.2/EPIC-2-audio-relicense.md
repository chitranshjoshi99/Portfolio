# EPIC 2: Audio relicensing swap

Replace the 13 archive.org-sourced samples actually in use (origin unverified, "random
drum kit sounds") with individually verified CC0-licensed replacements, so the app carries
no unresolvable audio-rights exposure once public.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As the product owner, I want 13 CC0-licensed replacement samples sourced and provenance-recorded so that every sound the app ships has a traceable, clean license. | Critical | Medium | 2 |
| 2 | As the product owner, I want the staged replacements swapped into the live asset path and the dead unused samples deleted so that the shipped build contains zero archive.org-sourced audio. | Critical | Low | 3 |
| 3 | As the product owner, I want a working kit re-sourced after the human listen-through rejected kit v1, so that the shipped audio actually sounds like a drum kit. | Critical | Medium | 3.1 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

- **Tech stack:** React 18 + TypeScript + Vite + Tone.js/Web Audio (unchanged from v1.1).
- **Project structure:** replacement samples staged at `public/rok-cc0/`, credited in
  `public/rok-cc0/CREDITS.md`. Final swap target is `public/rok/`, same filenames the app
  already references — no code path changes.
- **Architecture:** the real in-use asset set is exactly 12 `pad-*.wav` files (mapped in
  `src/lib/constants.ts`'s `DRUM_BY_PAD`) plus `stick.wav` (the metronome click, loaded in
  `src/lib/audio.ts`). `kick.wav`, `snare.wav`, `hat.wav`, `bass_C2.wav` are dead —
  unreferenced anywhere in code; bass is pure synthesis (`Tone.MonoSynth`), no sample file
  (Architect, v1.2 — confirmed by reading `audio.ts`/`constants.ts` directly).
- **Deployment:** N/A this epic.
- **Security:** none of these files touch a trust boundary — static asset replacement only.
- **Design:** N/A — same 12+1 sample roles, same audio interface (`{bank, pad} → voice`),
  no UI change.
- **Legal/compliance:** each of the 13 replacements is individually verified "Creative
  Commons 0" on its own Freesound page (not pack-level trust) — see
  `public/rok-cc0/CREDITS.md` for title/uploader/URL/date/license per file. CC0 requires
  no attribution; the credits file is kept anyway as a clean-provenance record (Legal-bro,
  v1.2). **Git history scrub of the old archive.org-sourced blobs is a locked follow-up,
  not part of this epic** — must happen *after* Story 2 lands (a swap commit exists), using
  blob-ID-specific stripping (not a path-based purge, which would also delete the new
  same-path files) — see `context.md`'s Legal-bro block for the full sequencing reasoning.
- **Data/market basis:** N/A.

## Execution instructions (priority order)

### 1. Source and verify 13 CC0 replacement samples  (Priority 2) — **Done**
- **Goal:** one CC0-verified replacement per role (12 drum pads + metronome click), with
  provenance recorded.
- **Status:** already executed in this kimchi session — 13 files staged in
  `public/rok-cc0/`, `CREDITS.md` written with full per-file provenance.
- **Locked (Auditor pre-build pass, 2026-07-16): convert `pad-4-open-hihat.mp3` to WAV
  before Story 2.** Flagged three times (Design-girl, Architect, Tech-bro) but never
  actually decided — a build session hitting this with no locked answer is exactly the
  gap a pre-build audit exists to catch. Converting is a one-file, no-judgment-call fix
  that keeps the whole kit format-uniform and removes any mixed-format edge case, at zero
  cost either way. Do the conversion as part of Story 2, not a separate decision point.
- **Resolved by Story 3 (2026-07-17):** the flagged listen-through gap was not just a
  tonal-consistency nit — the kit shipped in Story 2 sounded wrong (a synth D&B kick/snare,
  a digitally silent ride, mismatched levels). Re-sourced as kit v2; see Story 3.

### 2. Swap staged files into `public/rok/`, delete dead files  (Priority 3)
- **Goal:** `public/rok/` contains only the 13 CC0-verified files at their existing
  filenames; the 4 dead files are gone; the app plays identically to before (same roles,
  same file paths, zero code changes).
- **Key decisions:** pure file-ops — do not refactor `audio.ts`'s sample-loading code
  while doing this. If the MP3-vs-WAV gap from Story 1 isn't resolved, resolve it here
  (convert or accept format mismatch) before committing.
- **Acceptance:** `git status` shows only file adds/deletes/renames under `public/rok/`
  and `public/rok-cc0/`, zero diffs in `src/`. App boots, every drum pad and the metronome
  click play the new samples. `kick.wav`/`snare.wav`/`hat.wav`/`bass_C2.wav` no longer
  exist in the working tree.

### 3. Re-source kit v2 after listen-through rejection  (Priority 3.1) — **Done**
- **Goal:** replace kit v1 with CC0 samples that actually sound coherent, gated by a real
  human listen-through instead of license/title matching alone.
- **What was wrong:** kit v1 was picked on CC0 status and file naming only, never heard.
  The kick/snare were a synth Drum & Bass one-shot pair from an unrelated pack, the ride
  cymbal was digitally near-silent (peak amplitude ~1/32768), and levels ranged from 0.11
  to 0.99 peak across the 13 files — five different creators glued together with no
  balance pass.
- **Key decisions:** three CC0 source sets, chosen for coherence rather than one-off
  license hunting: Sonic Pi's bundled sample set (kick, all three toms, both hats, crash,
  ride, metronome click — 9 voices, six of them one creator/session); Virtuosity Drums
  (sfzinstruments) for snare + rimshot (one drum, one session, mid mics); individual rated
  Freesound one-shots for clap and claves. Two user-run audition rounds (a static A/B HTML
  page playing every candidate) gated every pick before any file touched `public/rok/`.
  All 13 files reprocessed to 44.1kHz/16-bit WAV and peak-normalized to a fixed kit-balance
  map.
- **Acceptance:** user approves the kit in listen-through; all 13 files remain CC0 with
  per-file provenance in `CREDITS.md`; app serves all 13 assets 200 OK with zero `src/`
  diff.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Source and verify 13 CC0 samples | Done | 2026-07-16 | 13 files staged in `public/rok-cc0/`, provenance in `CREDITS.md`. MP3/WAV gap and cross-kit tonal check still open — resolved by Story 3. |
| 2 | Swap into `public/rok/`, delete dead files | Done | 2026-07-16 | 13 CC0 files swapped in at existing filenames (MP3 hi-hat converted to WAV via ffmpeg first); dead files deleted. Zero `src/` diff. Verified live: all 13 assets load 200 OK, no console errors. Kit rejected in listen-through — see Story 3. |
| 3 | Re-source kit v2 | Done | 2026-07-17 | Rebuilt from Sonic Pi (kick/toms/hats/cymbals/click) + Virtuosity Drums (snare/rimshot) + Freesound one-shots (clap/claves), gated by two user audition rounds. `CREDITS.md` rewritten with per-file provenance. Verified: all 13 assets 200 OK, byte-exact to approved audition files. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching net
> tracker in every build session.
