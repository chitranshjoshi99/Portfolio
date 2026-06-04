# CLAUDE.md — Portfolio project context

This file is read by Claude at the start of every session. It captures
architecture decisions, conventions, and gotchas so you don't have to
re-derive them from the code.

---

## What this project is

Chitransh Joshi's personal portfolio — a React 18 + Vite + SWC + TypeScript
single-page app with four routes: Home (`/`), About (`/about`), Labs (`/labs`),
Contact (`/contact`). Design language is pixel-art, muted palette, dark/light theme.

---

## File & folder conventions

Every component and page lives in its own folder with exactly two files:

- `index.tsx` — the component/page
- `style.css` — styles scoped to that component/page only

```
src/
├── components/
│   ├── ExperienceCard/   index.tsx + style.css
│   ├── JourneyProgress/  index.tsx + style.css
│   ├── Magic8Ball/       index.tsx + style.css   ← pixel-art oracle game
│   ├── Navbar/           index.tsx + style.css
│   ├── PixelBorder/      index.tsx + style.css
│   ├── ScrollIndicator/  index.tsx + style.css
│   ├── ScrollToTop/      index.tsx
│   ├── StatCard/         index.tsx + style.css
│   ├── ThemeToggle/      index.tsx
│   └── XPBar/            index.tsx + style.css
├── contexts/
│   └── ThemeContext.tsx   (standalone, no folder needed)
├── data/
│   └── resume.ts          ← single source of truth for all content
├── hooks/
│   └── useTypewriter.ts
├── pages/
│   ├── About/            index.tsx + style.css
│   ├── Contact/          index.tsx + style.css
│   ├── Home/             index.tsx + style.css
│   └── Labs/             index.tsx + style.css   ← experimental playground
├── styles/
│   ├── global.css         reset, utilities, animations
│   └── tokens.css         all CSS custom properties
└── utils/
    └── haptics.ts         ← vibration / haptic feedback helper
```

## Critical files

| File                            | Purpose                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/resume.ts`                  | **Only place resume content lives.** Edit here; pages pick it up automatically.                                                                                            |
| `src/styles/tokens.css`               | All CSS custom properties — palette, spacing, fonts, shadows. Edit colours here, not inline.                                                                               |
| `src/styles/global.css`               | Reset, utility classes (`.pixel-text`, `.vt-text`, animations). **Also owns all `.btn` / `.btn--*` variants** — moved here from Home so Magic8Ball buttons work on Labs too. |
| `src/contexts/ThemeContext.tsx`       | Dark/light theme. Reads `prefers-color-scheme` as default; persists override in `localStorage` under key `cj-portfolio-theme`. Applies `data-theme` attribute to `<html>`. |
| `src/pages/Contact/index.tsx`         | Has `FORMSPREE_ID` constant at the top — set it to enable direct email.                                                                                                    |
| `src/utils/haptics.ts`                | Thin wrapper around `navigator.vibrate` + stub for future haptic patterns. Import `haptics` and call `.tap()`, `.press()`, `.toggle()`, `.reveal()`.                       |
| `src/components/Magic8Ball/index.tsx` | Self-contained pixel-art oracle game. Lives in **Labs → ORACLE_v1.exe** section. See §Magic8Ball below.                                                                    |

---

## Architecture decisions

### CSS custom properties, not Tailwind

All theming is done through CSS variables in `tokens.css`. There is no
Tailwind, no CSS-in-JS. When adding styles, extend tokens first before
hardcoding hex values inline.

### One CSS file per component/page

Each `.tsx` file has a sibling `.css` file. Global utilities live in
`global.css`. Do not add page-specific rules to `global.css`.

### Pixel-art conventions

- Spacing always uses `--px` multiples (`--px2` = 8px, `--px4` = 16px, etc.)
- Borders are `var(--px)` (4px) solid — never `border-radius` except `--radius-sm` (2px) on inputs
- Box shadows use the pixel drop-shadow pattern: `Xpx Xpx 0 <color>` (hard offset, no blur)
- Image rendering: `image-rendering: pixelated` on the avatar

### Company accent colours

Three muted accent colours used throughout the experience cards:

- `--nivoda-gold` (#9E8562) — Nivoda LLP
- `--delhivery-red` (#B87A72) — Delhivery
- `--classplus-purple` (#8B7BA8) — Classplus

These are defined in both light and dark themes in `tokens.css`.

---

## Magic8Ball component

`src/components/Magic8Ball/` — a fully self-contained pixel-art oracle mini-game. Previously rendered in the Home CTA; now lives in the **Labs page** under the `ORACLE_v1.exe` card.

**Canvas approach:**
- Ball is drawn on a `28×28` logical canvas scaled to `168×168` CSS (6× integer scale, `image-rendering: pixelated`).
- Ball body + white inner window circle are on canvas. All *text content* (the 8, countdown, answer) is an HTML overlay (`div.m8b__window`) positioned via CSS to sit exactly over the white circle — so fonts and animations work freely.

**5-tap game loop:**
1. **idle** — shows `8` in the window, blinking `[ TAP TO SHAKE ]` hint below.
2. **tapping** (taps 1-4) — each tap triggers a CSS shake animation (`m8b-shake-1` through `m8b-shake-5`) with escalating intensity set via `data-intensity` attribute. Progress label updates: `TAP MORE` → `KEEP GOING` → `ALMOST THERE` → `SO CLOSE...`.
3. **counting** — 5th tap starts a `3→2→1` countdown inside the window with a blast-in animation per digit and continuous rattle CSS animation on the ball. `navigator.vibrate` pulses escalate each second.
4. **revealed** — answer text appears in the window (currently hardcoded `DON'T / COUNT / ON IT`). After 1.5 s the ball fades out and two buttons appear in its place (`PROVE IT WRONG →` → Contact page; `↺ ASK AGAIN` → reset).

**Layout trick (no layout shift):**
- `.m8b__stage` is fixed `168×168`. The ball button and the button overlay are both `position: absolute; inset: 0` inside it. When the ball fades to `opacity: 0`, the overlay appears — zero reflow.

**Mobile:** media query at `max-width: 480px` drops to 4× scale (`112×112`) with proportionally adjusted window (`48×48`) and font sizes.

**CSS classes of note:** `.m8b__ball--shake[data-intensity="1-5"]`, `.m8b__ball--counting`, `.m8b__ball--hidden`, `.m8b__btns-overlay`.

**Home CTA section layout:** `.home-cta-inner` is a centered flex column — `PRESS START` pixel-screen above the `VIEW EXPERIENCE` button. (Was previously a two-column grid with Magic8Ball on the left; simplified after Magic8Ball moved to Labs.)

---

## Haptics utility

`src/utils/haptics.ts` — thin wrapper:

```ts
haptics.tap()     // short 40ms buzz — links, nav, minor taps
haptics.press()   // medium 80ms — primary button presses
haptics.toggle()  // double pulse — theme switch
haptics.reveal()  // triple escalating pulse — Magic8Ball reveal
```

All methods are no-ops where `navigator.vibrate` is unsupported (desktop). Every interactive element in Navbar and Home CTAs is wired to haptics.

---

## Labs page — scroll-snap internals

`src/pages/Labs/` — an experimental playground with four full-height scroll-snap sections.

**Sections (in order):**
1. **INIT** — terminal-style boot screen listing experiments with status badges.
2. **ORACLE_v1.exe** — `Magic8Ball` component; badge color `--classplus-purple`.
3. **ARCADE.exe** — 90s retro TV placeholder with canvas static noise; badge color `--delhivery-red`.
4. **BLOG.exe** — Terminal window with animated line-by-line output; badge color `--nivoda-gold`.

**Scroll-snap implementation** (same pattern as About journey, different concerns):

1. **Container** is `div.labs-scroll` — `height: calc(100vh - 56px)`, `overflow-y: scroll`, `scroll-snap-type: y mandatory`. Native scrollbar hidden (side dots replace it).

2. **Each section** is `height: 100%` (exactly 100% of the container). `min-height: 100%` breaks snapping — keep it `height`.

3. **IntersectionObserver uses `root: scrollRef.current`** with `threshold: 0.5`. The same rule as About applies: use the nested container as root, not the viewport.

4. **`scrollToSection`** uses the same manual `container.scrollTo` pattern as About's `scrollToCard` — `scrollIntoView` won't work on the nested container.

5. **`BlogTerminal` replays** whenever its section becomes active (`isActive={activeIdx === 3}`). The `useEffect` keys on `isActive` — when it flips to `true`, it clears timers, resets count to 0, and restarts the line-by-line animation.

6. **`RetroTVScreen`** runs `requestAnimationFrame` continuously to animate canvas static noise. It's a lightweight 60×45 canvas so this is fine; no need to pause on visibility.

7. **Mobile** (`≤768px`): scroll-snap disabled, sections stack vertically with `min-height: calc(100vh - 56px)`. TV controls switch from column to row layout.

8. **Side progress dots** (`labs-progress`) are `position: fixed`, hidden at `≤900px`.

**Adding a new lab experiment:**
1. Add a `{ id, label }` entry to `LABS_SECTIONS` array.
2. Add a new `<section className="labs-section labs-section--yourname">` with a `ref={(el) => { sectionRefs.current[N] = el; }}`.
3. Add the section's background/border rule in `style.css`.
4. Extend the intro list in Section 0 with name, status, and color.

---

## About page — scroll-snap internals

The experience journey uses a **nested scroll container** (`div.journey-scroll`),
not the document scroll. This has two important consequences:

1. **`scrollIntoView` will not work** for programmatic scrolling to cards.
   Use `container.scrollTo({ top: cardRect - containerRect + scrollTop, behavior: 'smooth' })`.
   The `scrollToCard` function in `About.tsx` implements this correctly.

2. **IntersectionObserver must use `root: journeyRef.current`** (the scroll
   container), not the default viewport root. Otherwise `activeIdx` will never
   update past 0 and achievements for Delhivery/Classplus won't appear.

3. **`ref` on `ExperienceCard` requires `forwardRef`**. React 18 silently drops
   `ref` passed as a plain prop to a function component. `ExperienceCard` is
   wrapped in `React.forwardRef` — keep it that way. Do not refactor it back
   to a regular function with a `cardRef` plain prop without testing.

4. **Card height must be exactly `100%`** of the `journey-scroll` container
   (which is `height: calc(100vh - 56px)`). `min-height: 100%` breaks snap
   because the container can't identify fixed snap targets.

---

## Home page — ENTER key on CTA

The "PRESS START" pixel screen block triggers navigation to `/about` on ENTER
when the block is ≥60% visible in the viewport. Implementation in `Home.tsx`:

- `ctaRef` → the pixel-screen div
- `ctaInView` state via IntersectionObserver
- `keydown` listener on `window` that checks `ctaInView && !ctaPressed`
- 320ms delay before `navigate('/about')` for the press animation to complete

---

## Contact page — send modes

Two send paths, both declared at the top of `Contact.tsx`:

```ts
const FORMSPREE_ID = ""; // empty = mailto fallback
const WA_NUMBER = "918126196827";
```

- **WhatsApp**: always works, opens `https://wa.me/${WA_NUMBER}?text=...`
- **Email (Formspree)**: `fetch` POST to `https://formspree.io/f/${FORMSPREE_ID}`.
  When `FORMSPREE_ID` is empty, falls back to `mailto:`.

---

## Adding a new page

1. Create `src/pages/NewPage/index.tsx` + `style.css`.
2. Add the route in `src/App.tsx`.
3. Add `{ to: "/newpage", label: "> LABEL", key: "newpage" }` to `NAV_LINKS` in `src/components/Navbar/index.tsx` — the mobile dropdown renders from the same array automatically.
4. If the page has content driven by data, add an export to `src/data/resume.ts`.
5. Update `CLAUDE.md` (required by pre-commit hook if you commit `src/` changes).

---

## Pre-commit hook — CLAUDE.md enforcement

A git hook at `.githooks/pre-commit` (tracked) blocks commits that stage `src/` changes without also staging `CLAUDE.md`. This enforces the doc-with-feature contract.

**One-time setup** (already added to `package.json` `prepare` script, runs after `npm install`):
```bash
npm install   # triggers prepare → git config core.hooksPath .githooks
# or manually:
git config core.hooksPath .githooks
```

**To bypass** (intentionally skip the doc check):
```bash
git commit --no-verify -m "chore: ..."
```

**What triggers the check:** any staged file matching `src/**` — `.tsx`, `.ts`, `.css`, anything.

---

## Known limitations / future work

- No backend. Email delivery requires Formspree (free tier covers ~50/month).
- The right-side progress dots (`journey-progress`) are hidden on screens ≤900px via `display: none`.
- The scroll-snap journey disables on mobile (`scroll-snap-type: none`) because full-height snap cards feel wrong on small screens. Cards stack vertically instead.
- Fonts load from Google Fonts CDN — add a local fallback or `font-display: swap` if offline performance matters.
- No analytics, no cookie banner, no service worker. Add those if deploying to production.

---

## SEO / Social preview

All meta lives in `index.html`. The deployed base URL is hard-coded as
`https://chitranshjoshi99.github.io/Portfolio` in:
- `<link rel="canonical">`
- All `og:url` / `og:image` / `twitter:image` tags
- The JSON-LD `@id` and `url` fields
- `public/robots.txt` Sitemap pointer
- `public/sitemap.xml` `<loc>` entries

**If the domain changes**, do a global find-replace on
`chitranshjoshi99.github.io/Portfolio` across `index.html`,
`public/robots.txt`, and `public/sitemap.xml`.

The OG share image is `public/profile.jpeg` (served at `/profile.jpeg`).
WhatsApp, iMessage, LinkedIn, Twitter/X and Slack all read the OG tags and
will show the profile photo + name + description as the link preview.

---

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
npm run lint     # ESLint
```
