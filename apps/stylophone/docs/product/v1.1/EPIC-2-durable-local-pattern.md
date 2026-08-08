# EPIC 2: Durable local pattern

Keep the currently authored pattern safe without reintroducing a library product. The browser holds one local v1.1 draft; export is the durable handoff and import is a strictly validated replacement.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a Beat owner, I want my current v1.1 pattern to survive reload and destructive actions to be explicit so that I do not lose my work. | Critical | Low | 4 |
| 2 | As a Beat owner, I want to export and import a valid v1.1 pattern so that I can keep and reuse patterns without a library. | High | Medium | 5 |
| 3 | As a Beat owner, I want the unfinished generator absent from my workspace so that manual grid authoring is the product I experience. | Medium | Low | 6 |

## Locked decisions

- **Tech stack:** native `localStorage`, `Blob`, `URL.createObjectURL`, file input; no IndexedDB/database.
- **Architecture:** one local key `stylophone-beat:v1.1:draft`; replace legacy lesson-library CRUD with draft read/write functions.
- **Security:** maximum import size 512 KiB, JSON parse in `try/catch`, exact v1.1 validation into a new object, confirm replacement when dirty.
- **Design:** save/export is a utility action, not a primary panel. Clearly communicate that export, not browser storage, is durable backup.
- **Legal/compliance:** no uploaded songs or external acquisition; imported JSON contains only pattern metadata/events.

## Execution instructions (priority order)

### 1. One local draft and safe reset/new flow (Priority 4)
- **Goal:** the current pattern persists across reload, and reset/new cannot silently discard unsaved changes.
- **API contract:** replace `saveLesson/listLessons/loadLesson/deleteLesson` use in the active UI with `loadDraft(): PatternDocument|null`, `saveDraft(document): boolean`, and `clearDraft(): boolean`. Track `dirty` by comparison to the last saved document.
- **Data model:** `PatternDocument` is the exact schema in README, including `id`, `title`, `bpm`, banks, and `pattern`. Use default title `Untitled Beat`; a new/reset pattern gets a new UUID.
- **Key decisions:** one slot only; no local index, library modal, preset card, or delete-one-of-many UI. Before New/Reset/Import, if `dirty`, show a confirmation with Export and Cancel actions.
- **Acceptance:** reload restores a saved draft. New/Reset with unsaved change does not proceed until confirmed. Clearing browser storage is described as a loss risk in the UI.

### 2. Strict v1.1 JSON import/export (Priority 5)
- **Goal:** share/recover a pattern without corrupting state or accepting old formats.
- **API contract:** `serializePattern(document): Blob`; `parsePatternDocument(text): {ok:true,document}|{ok:false,error}`. Import accepts `.json` only as a convenience check, but validates contents regardless of MIME. Export filename is a safe title slug plus `.stylophone-beat.v1.1.json`.
- **Data model:** accept only `schemaVersion: 3`, `bars:2`, `steps:64`, BPM within existing min/max, title 1–80 text characters, valid UUID/string id, valid banks, all 12 exact pad keys with 64 booleans, and non-overlapping valid bass starts/lengths. Reject schema 1/2 rather than migrate.
- **Key decisions:** parse and fully validate before state/storage mutation. Cap input at 512 KiB. React escapes title text; never use `innerHTML`.
- **Acceptance:** valid export round-trips exactly. Invalid JSON, 32-step legacy JSON, oversized file, invalid pad, invalid bank, or bass overlap show a recoverable error and leave the current draft untouched.

### 3. Remove generator from active surface (Priority 6)
- **Goal:** manual grid authoring is the first and only creation path in v1.1.
- **API contract:** remove SourcePanel/generator launchers and routes from the rendered app; do not delete source files or sidecar code.
- **Data model:** new documents use manual-only data; no `source`, clip, YouTube, or reduction state in schema v3.
- **Key decisions:** do not start FastAPI or expose its upload endpoint in a v1.1 run. Legacy files are retained in the repository only.
- **Acceptance:** there is no upload/generate UI or active localhost processing call. `npm run build` succeeds without the sidecar running.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | One local draft and safe reset/new flow | Done | 2026-07-15 | One local draft restores on reload; edits autosave and New/Reset use explicit in-app replacement protection. |
| 2 | Strict v1.1 JSON import/export | Done | 2026-07-15 | Strict schema-v3 parse, 512 KiB cap, atomic replacement, safe export filename, and recoverable import errors verified. |
| 3 | Remove generator from active surface | Done | 2026-07-15 | Source/generator launcher, processing route, and modal removed from the active workspace; legacy files remain repository-only. |
