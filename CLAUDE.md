# CLAUDE.md — Portfolio project context

This file is read by Claude at the start of every session. It captures
architecture decisions, conventions, and gotchas so you don't have to
re-derive them from the code.

---

## What this project is

Chitransh Joshi's personal portfolio — a React 18 + Vite + SWC + TypeScript
single-page app with three routes: Home (`/`), About (`/about`), Contact
(`/contact`). Design language is pixel-art, muted palette, dark/light theme.

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
│   ├── Navbar/           index.tsx + style.css
│   ├── StatCard/         index.tsx + style.css
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
│   └── Home/             index.tsx + style.css
└── styles/
    ├── global.css         reset, utilities, animations
    └── tokens.css         all CSS custom properties
```

## Critical files

| File                            | Purpose                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/resume.ts`            | **Only place resume content lives.** Edit here; pages pick it up automatically.                                                                                            |
| `src/styles/tokens.css`         | All CSS custom properties — palette, spacing, fonts, shadows. Edit colours here, not inline.                                                                               |
| `src/styles/global.css`         | Reset, utility classes (`.pixel-text`, `.vt-text`, `.btn`, animations).                                                                                                    |
| `src/contexts/ThemeContext.tsx` | Dark/light theme. Reads `prefers-color-scheme` as default; persists override in `localStorage` under key `cj-portfolio-theme`. Applies `data-theme` attribute to `<html>`. |
| `src/pages/Contact/index.tsx`   | Has `FORMSPREE_ID` constant at the top — set it to enable direct email.                                                                                                    |

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

## Adding a new section

1. Add content to `src/data/resume.ts` (new export or extend existing).
2. Create `src/pages/NewPage.tsx` + `NewPage.css`.
3. Add the route in `src/App.tsx`.
4. Add a `NavLink` in `src/components/Navbar/Navbar.tsx` (both `NAV_LINKS` array and the mobile menu).

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
