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
│   ├── ChannelStatic/    index.tsx + style.css   ← TV static noise canvas (on-demand only)
│   ├── CodePanel/        index.tsx + style.css   ← expandable code window (titlebar + pre)
│   ├── ExperienceCard/   index.tsx + style.css
│   ├── JourneyProgress/  index.tsx + style.css
│   ├── LabsRail/         index.tsx + style.css   ← Labs nav rail (fixed desktop / sticky mobile)
│   ├── Magic8Ball/       index.tsx + style.css   ← pixel-art oracle game (unchanged)
│   ├── Navbar/           index.tsx + style.css
│   ├── PixelBorder/      index.tsx + style.css
│   ├── SceneText/        index.tsx + style.css   ← title + teaser + SHOW LOGIC toggle
│   ├── ScrollIndicator/  index.tsx + style.css
│   ├── ScrollToTop/      index.tsx
│   ├── StatCard/         index.tsx + style.css
│   ├── ThemeToggle/      index.tsx
│   ├── TVScreen/         index.tsx + style.css   ← channel host + static-burst FSM
│   ├── TVSet/            index.tsx + style.css   ← CRT chrome (antennas, knobs, scanlines)
│   ├── XPBar/            index.tsx + style.css
│   └── games/
│       ├── types.ts       GameProps { active: boolean }
│       ├── DinoRun/      index.tsx + style.css
│       ├── Gacha/        index.tsx + style.css
│       ├── LinkPreview/  index.tsx + style.css   ← TV channel: paste a URL → live OG card (calls api/preview)
│       ├── Pong/         index.tsx + style.css
│       └── Snake/        index.tsx + style.css
├── contexts/
│   ├── ScrollProgressContext.tsx  ← shared rAF loop writing --p to scene elements
│   └── ThemeContext.tsx
├── data/
│   ├── labs.ts            ← Labs content (experiments, TV channels, toys)
│   └── resume.ts          ← single source of truth for all content
├── hooks/
│   ├── useScrollProgress.ts  ← registers element with ScrollProgressContext
│   └── useTypewriter.ts
├── pages/
│   ├── About/            index.tsx + style.css
│   ├── Contact/          index.tsx + style.css
│   ├── Home/             index.tsx + style.css
│   └── Labs/             index.tsx + style.css   ← experimental playground (restructured)
├── styles/
│   ├── global.css         reset, utilities, animations
│   └── tokens.css         all CSS custom properties
└── utils/
    └── haptics.ts         ← vibration / haptic feedback helper
```

## Critical files

| File                                     | Purpose                                                                                                                                                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/resume.ts`                     | **Only place resume content lives.** Edit here; pages pick it up automatically.                                                                                                                                                                       |
| `src/data/labs.ts`                       | **Only place Labs content lives.** All experiments, channels, teasers, code snippets. See §Labs internals.                                                                                                                                            |
| `src/styles/tokens.css`                  | All CSS custom properties — palette, spacing, fonts, shadows. Edit colours here, not inline.                                                                                                                                                          |
| `src/styles/global.css`                  | Reset, utility classes (`.pixel-text`, `.vt-text`, animations), **all `.btn` / `.btn--*` variants**, and two blink keyframes: `blink` (step-end, for cursors/CTAs) and `blink-soft` (ease-in-out fade, for persistent chrome like the navbar cursor). |
| `src/contexts/ThemeContext.tsx`          | Dark/light theme. Reads `prefers-color-scheme` as default; persists override in `localStorage` under key `cj-portfolio-theme`. Applies `data-theme` attribute to `<html>`.                                                                            |
| `src/contexts/ScrollProgressContext.tsx` | One shared rAF loop writing `--p` (0→1) onto registered scene elements. Used by Labs SceneText for entry animations.                                                                                                                                  |
| `src/pages/Contact/index.tsx`            | Has `FORMSPREE_ID` constant at the top — set it to enable direct email.                                                                                                                                                                               |
| `src/utils/haptics.ts`                   | Thin wrapper around `navigator.vibrate` + stub for future haptic patterns. Import `haptics` and call `.tap()`, `.press()`, `.toggle()`, `.reveal()`.                                                                                                  |
| `src/components/Magic8Ball/index.tsx`    | Self-contained pixel-art oracle game. Lives in **Labs → magic8ball toy scene**. See §Magic8Ball below.                                                                                                                                                |
| `src/components/TVScreen/index.tsx`      | Channel host FSM (`live` / `static`). `GAME_MAP` here maps `GameKey → Component`. Add new TV games here.                                                                                                                                              |

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
- Ball body + white inner window circle are on canvas. All _text content_ (the 8, countdown, answer) is an HTML overlay (`div.m8b__window`) positioned via CSS to sit exactly over the white circle — so fonts and animations work freely.

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
haptics.tap(); // short 40ms buzz — links, nav, minor taps
haptics.press(); // medium 80ms — primary button presses
haptics.toggle(); // double pulse — theme switch
haptics.reveal(); // triple escalating pulse — Magic8Ball reveal
```

All methods are no-ops where `navigator.vibrate` is unsupported (desktop). Every interactive element in Navbar and Home CTAs is wired to haptics.

---

## Labs page — scroll-snap internals (restructured)

`src/pages/Labs/` — a content-driven scroll journey with a **shared sticky CRT TV** for game channels and standalone toy scenes.

### Content model

`src/data/labs.ts` is the single source of truth (mirrors `resume.ts`). Each `LabExperiment` has:

- `render: 'tv' | 'standalone'` — determines scene type
- `game: GameKey` — maps to a game component in `src/components/games/`
- `code: string` — the core-logic snippet shown in the expandable `CodePanel`
- **Invariant**: all `render: 'tv'` entries must be contiguous before `standalone` entries. A dev-mode assertion in `labs.ts` throws if violated.

### Component tree

```
Labs (page)
├── LabsRail           floating pill menu (left-center desktop / bottom dock mobile; names on hover)
│                      hidden on hero (activeIdx === 0), slides in on scroll
└── labs-stage         scroll container (root for IntersectionObserver)
     ├── HeroScene     boot intro (section idx 0)
     ├── .tv-zone      two-column flex; height = TV_COUNT × (100vh − 56px)
     │    ├── .tv-zone__left   scrollable TEXT column (TVBlogScene × TV_COUNT)
     │    └── .tv-zone__right  sticky CRT column (TVSet → TVScreen → active game)
     └── ToyScene × N  standalone toys — text left, toy right (section idx TV_COUNT+1 …)
```

**Column order (TV zone):** TEXT is LEFT, TV is RIGHT. This is the opposite of the original spec — text fills the wide left column, the CRT TV sticks on the right.

New components: `LabsRail`, `TVSet`, `TVScreen`, `ChannelStatic`, `CodePanel`, `SceneText`, `games/Snake`, `games/Pong`, `games/DinoRun`, `games/Gacha`.

### Sticky TV pattern

`.tv-zone__right` has `flex: 0 0 46%` and `align-self: stretch` (default), so it grows to match the left column's total height (`TV_COUNT × (100vh−56px)`). Inside it, `.tv-set-wrapper` is `position: sticky; top: 0; height: calc(100vh−56px)` — this keeps the CRT pinned while the text scrolls.

**`scrollIntoView` will NOT work** on the nested scroll container — use the manual `stageRef.current.scrollTo` pattern.

### Scroll-snap

- `scroll-snap-type: y mandatory` on `.labs-stage`.
- Snap targets are `height: calc(100vh−56px)` with `scroll-snap-align: start`. **Never `min-height`** — that breaks snap.
- Snap targets: HeroScene, each TVBlogScene (inside `.tv-zone__left`), each ToyScene.
- CSS scroll-snap-align works on descendants of the scroll container — TVBlogScenes don't need to be direct children.

### LabsRail — floating pill (names expand on hover)

- **Always visible** (including on the hero) — no hide-on-scroll. The old hero experiment-list was removed so the rail is the single index.
- **Collapsed = dots only.** Each item is a 10px dot; the label (`CH0X`/`TOY`/`INIT` tag + experiment name + status glyph) is `max-width: 0; opacity: 0` and slides open on `.labs-rail:hover` / `:focus-within`. This is the icon-rail-expands-on-hover pattern.
- Active item tracked by `activeIdx`; dot fills with the item's accent (`--row-accent` set inline), active name tints to the accent. Groups separated by a thin `.labs-rail__sep` line whose `TV` / `TOYS` micro-label also reveals on hover.
- **Desktop:** detached pill `position: fixed; left: 20px; top: 50%`, rounded (`border-radius: 20px`), pixel drop-shadow. `.labs-page` has `padding-left: 76px` so content clears the _collapsed_ pill (expanded labels overlay transiently on hover).
- **Mobile (≤899px):** becomes a floating bottom dock (`left: 50%; bottom: 16px; flex-direction: row`). No hover on touch, so it stays dots-only except the **active** item, which shows its name inline.
- Props: `{ activeIdx, experiments, onJump }`. (No `progress` fill / `isVisible` / `totalSections` — removed.)

### IntersectionObserver

Uses `root: stageRef.current` on desktop, `root: null` (viewport) on mobile (where `.labs-stage` becomes `overflow-y: visible`). The observer fires on the same `sectionRefs` array covering all 6 scenes.

- `activeIdx` (0–5) drives the rail dot highlight and toy `active` prop.
- `activeChannel` (1–3) is only updated when `activeIdx` is in the TV range (1–TV_COUNT).

### TVScreen channel-change FSM

```
states: 'live' | 'static'
on activeChannel change:
  set status = 'static'  → mount ChannelStatic + flash "CH 0X"
  after 280ms:
    set displayChannel = activeChannel
    set status = 'live'  → mount new game (key=channel, fresh state)
```

Inactive TV games are **unmounted** (via `key={displayChannel}` conditional). No off-screen rAF loops.

### Game component contract

All games in `src/components/games/` implement `GameProps { active: boolean }`:

- rAF loops must **not run** when `active` is false.
- DinoRun shows a "SPACE / TAP TO START" overlay until first input (avoids auto-death on channel switch).
- Keep game state in `useRef`, not `useState`, inside the loop — zero re-renders per frame.

### SceneText + CodePanel

`SceneText` has **no `max-width`** — it fills its parent column. `CodePanel` has no `max-height` / `overflow-y` — the code expands fully without internal scroll. On mobile, `CodePanel` sets `max-width: 100%; min-width: 0` to prevent horizontal layout shift.

### ScrollProgressContext

`src/contexts/ScrollProgressContext.tsx` runs **one shared rAF loop** that writes `--p` (0→1) as a CSS custom property onto each registered scene element, based on distance from stage center. Disabled when `prefers-reduced-motion: reduce` (the loop returns early, so `--p` is never written and CSS falls back to `var(--p, 1)` = fully-visible/static).

**Registration is required for any of this to animate.** Each scene (`HeroScene`, `TVBlogScene`, `ToyScene`) creates an internal ref and calls `useScrollProgress(ref)` to register itself; for the forwardRef scenes the internal ref is merged with the parent's section ref via `assignRef`. `--p` is set on the section and inherits to descendants. Consumers: `SceneText` (`.scene-text__title` / `.scene-text__teaser` → `translateY` + `opacity`) and `.toy-scene__game` (parallax `translateX` + `scale`). Do **not** add an `@supports (animation-timeline: view())` block that zeroes these transforms unless you also define a real native scroll-timeline animation — an earlier version did and silently disabled the effect on modern Chrome/Safari.

### Mobile (≤768px)

- `.labs-stage` → `height: auto; overflow-y: visible; scroll-snap-type: none`
- `.tv-zone` → `flex-direction: column`; TV column (`tv-zone__right`) renders first (order: 0), text column second (order: 1); `.tv-set-wrapper` → `position: static`
- `LabsRail` → `display: none` (no mobile rail at all)
- Toy scene: stacks to column; game centered

### Adding a new lab experiment

1. Add an entry to `LAB_EXPERIMENTS` in `src/data/labs.ts` (keep all `tv` entries before `standalone`).
2. If it's a TV game, create `src/components/games/YourGame/index.tsx + style.css` implementing `GameProps`, then add it to `GAME_MAP` in `TVScreen/index.tsx`.
3. If it's a toy, add a `game === 'yourkey'` branch in the `ToyScene` component inside `Labs/index.tsx`.
4. No section ref wiring needed — the Labs page maps `LAB_EXPERIMENTS` dynamically.

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

5. **Dock-before-scroll (desktop):** a `scroll`/`resize` effect in `About`
   toggles `journey-scroll`'s inline `overflow-y` — `hidden` until the container
   is docked under the sticky `.journey-header` (so the wheel bubbles to the page
   and finishes scrolling the section into view), then `scroll` so the cards take
   over. Without this the nested container "captures" the wheel while the intro
   is still visible. The effect clears the inline style on mobile so the
   `overflow-y: visible` media query wins. `scrollToCard` also docks the section
   (via `window.scrollTo`) before placing a card when a tab is clicked undocked.

---

## Home page — ENTER key on CTA

The "PRESS START" pixel screen block triggers navigation to `/about` on ENTER
when the block is ≥60% visible in the viewport. Implementation in `Home.tsx`:

- `ctaRef` → the pixel-screen div
- `ctaInView` state via IntersectionObserver
- `keydown` listener on `window` that checks `ctaInView && !ctaPressed`
- 320ms delay before `navigate('/about')` for the press animation to complete

---

## BlogPost — back navigation

The back button in `src/pages/BlogPost/index.tsx` is a `<button>` (not a `<Link>`) that calls `navigate(-1)` from React Router's `useNavigate`. If `window.history.length <= 1` (direct URL, no history), it falls back to `navigate("/blogs")`.

Do not change this back to `<Link to="/labs">` — blog posts are reachable from both `/blogs` (BlogIndex) and `/labs` (SceneText "READ FULL POST →"), so a static link destination is always wrong for one of those entry paths.

---

## Contact page — send modes

Two send paths, both declared at the top of `Contact.tsx`:

```ts
const FORMSPREE_ID = ""; // empty = mailto fallback
const WA_NUMBER = "918126196827";
```

- **WhatsApp**: opens `https://wa.me/${WA_NUMBER}?text=...` in a new tab, then sets status to `"whatsapp-opened"` (NOT `"sent"`). The `WhatsAppOpenedState` component renders, telling the user to finish in WhatsApp. The form is **not** auto-reset — the user must click "SEND ANOTHER" to clear it.
- **Email (Formspree)**: `fetch` POST to `https://formspree.io/f/${FORMSPREE_ID}`. On HTTP 200, sets status to `"sent"` and renders `SuccessState`. When `FORMSPREE_ID` is empty, falls back to `mailto:`.

**`FormStatus` values:** `"idle" | "sending" | "sent" | "whatsapp-opened" | "error"`

**`ContactLinkProps.href` is optional.** When omitted (or left out), the component renders a `<span>` instead of `<a>` — this is intentional for the Location entry which has no URL. External links (`external: true`) automatically get `aria-label="text (opens in new tab)"`.

**`beforeunload` protection:** a `useEffect` registers a `beforeunload` listener whenever any form field is non-empty, preventing accidental navigation from wiping in-progress messages.

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
- **Labs page has no mobile navigation.** `LabsRail` is `display: none` on mobile (≤768px). Users scroll through labs sections with no section index or jump nav. A future fix would be a fixed bottom dot-strip using the existing `activeIdx` state.
- Fonts load from Google Fonts CDN — add a local fallback or `font-display: swap` if offline performance matters.
- No analytics, no cookie banner, no service worker. Add those if deploying to production.

---

## SEO / Social preview

Deploys to **Vercel** (framework preset: Vite, `base: "/"`, router `basename="/"`).
The base URL is centralized in `VITE_SITE_URL`:

- `index.html` uses the `%VITE_SITE_URL%` build-time token in canonical, all
  `og:*` / `twitter:*`, and the JSON-LD `@id`/`url`/image fields — Vite
  substitutes it at build from `VITE_SITE_URL` (`.env` locally, Vercel env in
  prod). `src/config/site.ts` exposes the same value to app code.
- `public/sitemap.xml` and `public/robots.txt` are **static** (Vite does NOT
  substitute tokens there) — they carry a placeholder host.

**When the real domain is chosen:** set `VITE_SITE_URL` (locally + Vercel) and
update the host in `public/sitemap.xml` + `public/robots.txt`. That's it.

### Blogs + LinkedIn link previews

- Posts are **MDX** in `src/blogs/posts/<slug>.mdx` (can import & embed the live
  Labs game). Metadata is shared in root `blogs.config.ts` — imported by BOTH the
  app and the Vercel functions, which is why it's a typed `.ts`, not JSON.
- Routes: `/blogs` (`BlogIndex`) and `/blogs/:slug` (`BlogPost`, lazy-loads the
  MDX body via `src/blogs/content.ts`). `useDocumentMeta` mirrors per-route meta
  into the head for users + Google.
- **Social crawlers don't run JS.** `vercel.json` rewrites the page routes
  (`/about`, `/labs`, `/blogs`, `/blogs/:slug`, `/contact`) to `api/page.ts`,
  which fetches the static `index.html` and swaps the `<!--SEO-->…<!--/SEO-->`
  block for route-specific tags (incl. a generated `og:image`). `page.ts`
  resolves a post by `?slug=` (from inline `BLOGS`) or a section page by
  `?route=` (from the inline `PAGES` map) — both inlined because the function
  can't import shared TS. `/` stays static (its default meta is the
  home/profile card). Humans + Google still get the SPA.
- `api/og.tsx` (`@vercel/og`, edge runtime) renders a 1200×630 pixel-art card per
  post. It's **self-contained** — reads `title`/`tag`/`accent` from query params
  (built by `ogImageUrl()` in `blogs.config.ts`), so the edge bundle has no
  cross-module imports to choke on. `api/tsconfig.json` enables JSX
  (`jsx: react-jsx`) for the function build. Refresh LinkedIn's cache via the
  Post Inspector after each deploy.
- **Add a post:** create the `.mdx`, add an entry to `blogs.config.ts` (set
  `gameKey` to match a Lab experiment's `game` to get the "READ FULL POST →"
  button in Labs) **and the same entry to the inlined `BLOGS` in `api/page.ts`**
  (the function can't import the shared config), then add a `<loc>` to
  `public/sitemap.xml`.
- There is one post per Lab feature. The `spa-seo-without-ssr` post (top of the
  list) is tied to the `linkpreview` channel. That channel (`games/LinkPreview`)
  takes a pasted URL, calls the `api/preview.ts` edge function which fetches the
  page and scrapes its `og:`/`twitter:` tags, and renders the card live in the
  CRT — a working demo of the meta the SEO post is about.

The MDX toolchain is `@mdx-js/rollup` (vite plugin, `enforce: 'pre'`, before the
SWC react plugin) + `@mdx-js/react` + `remark-gfm`. `*.mdx` is typed in
`src/vite-env.d.ts`.

---

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
npm run lint     # ESLint
```
