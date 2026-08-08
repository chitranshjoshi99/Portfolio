# EPIC 1: Rebrand

Cross the Stylophone trademark boundary that blocked v1.1 from ever going public. Rename
the product to something a stranger can find, without redesigning anything the app does.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As the product owner, I want the app renamed away from "Stylophone" so that it can legally go live without trading on a trademark it has no rights to. | Critical | Low | 1 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

- **Tech stack:** React 18 + TypeScript + Vite + Tone.js/Web Audio (unchanged from v1.1).
- **Project structure:** see `README.md` — this epic touches no new files, text-only edits
  to existing ones.
- **Architecture:** no architectural surface — pure content/copy change.
- **Deployment:** N/A this epic (see EPIC 3, deferred).
- **Security:** N/A this epic.
- **Design:** plain text swap only — no new logo/wordmark. Keeps v1.1's "quiet branding"
  header treatment intact (Design-girl, v1.2).
- **Legal/compliance:** name is **"Beats Drum Machine Coach"** (plural "Beats", not
  singular "BEAT" — singular mirrors the hardware's own sub-brand name too closely).
  This is a risk-reduction choice, not a cleared trademark — no attorney/clearance search
  was performed. Add an explicit "not affiliated with or endorsed by Dubreq Ltd"
  disclaimer visible in-app (footer/about) regardless of name (Legal-bro, v1.2).
- **Data/market basis:** N/A — Finance-bro skipped this cycle, no revenue model, no
  market-sizing gate (prototype release, same call v1.1 made).

## Execution instructions (priority order)

### 1. Rename to "Beats Drum Machine Coach"  (Priority 1)
- **Goal:** every visible instance of "Stylophone" is gone from the shipped app and its
  public-facing docs; a non-affiliation disclaimer is visible in-app.
- **Files to touch:** `index.html` (`<title>`), `src/components/Header.tsx` (title
  string/prop), `README.md` (product name), plus wherever the disclaimer line renders
  (footer/about — pick the existing quiet-branding location in `Header.tsx`).
- **Key decisions:** text-only. No new component, no new asset, no logo work.
- **Acceptance:** grep the built app and `README.md` for "Stylophone" — zero matches
  outside historical `docs/product/v1/` and `v1.1/` archives (those stay as-is, they're
  historical record). Disclaimer text is visible without scrolling on the primary screen
  at the supported desktop floor (1280×720).

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Rename to Beats Drum Machine Coach | Done | 2026-07-16 | Renamed across index.html, Header.tsx, theme.css, StepGrid.tsx, constants.ts, package.json. Dubreq non-affiliation disclaimer added under header brand. Grep clean, verified live at 1280×720. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching net
> tracker in every build session.
