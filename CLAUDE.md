# CLAUDE.md — Portfolio project context

This file is read by Claude at the start of every session. It captures
architecture decisions, conventions, and gotchas so you don't have to
re-derive them from the code.

**Last updated:** 2026-08-10

---

## What this project is

Chitransh Joshi's Nx workspace. The portfolio is a React 18 + Vite + SWC +
TypeScript app with routes for Home (`/`), About (`/about`), Labs (`/labs`),
Apps (`/apps`), Blogs (`/blogs`), and Contact (`/contact`). Design language is
pixel-art, muted palette, dark/light theme. The workspace also contains the
standalone static Learn Python app, the Stylophone React app, and the Frontend
Interview Prep React app (`apps/interview`).

Published workspace apps are configured in `apps/catalog.json`. The Vercel
build bundles the portfolio at `/` and each catalogue entry at `/apps/<slug>/`.

**Sub-app that has its own router** (currently only `interview`): it must pass
`basename={import.meta.env.BASE_URL}` to `BrowserRouter` so its routes resolve
under `/apps/<slug>/`, and `vercel.json` needs the
`/apps/:app/(.*) → /apps/:app/index.html` rewrite (already there) so deep links
don't fall through to the portfolio SPA.

The Navbar's CJ logo is the home link; do not add a separate HOME navigation
entry unless the navigation layout is intentionally redesigned.

---

## File & folder conventions

Portfolio source is now rooted at `apps/portfolio`. Unless a path explicitly
names another app, every `src/...` path in this document means
`apps/portfolio/src/...`.

Every component and page lives in its own folder with exactly two files:

- `index.tsx` — the component/page
- `style.css` — styles scoped to that component/page only

```
src/
├── components/
│   ├── AvatarEyes/       index.tsx + style.css   ← hero profile pic with cursor-tracking pixel pupils
│   ├── ChannelStatic/    index.tsx + style.css   ← TV static noise canvas (on-demand only)
│   ├── CodePanel/        index.tsx + style.css   ← expandable code window (titlebar + pre)
│   ├── CodePopup/        index.tsx + style.css   ← mobile "Show Code" popup; iOS-style zoom open/close (reuses CodePanel)
│   ├── CursorRocket/     index.tsx + style.css   ← app-wide custom cursor: pixel rocket, rotates toward mouse-travel direction
│   ├── ExperienceCard/   index.tsx + style.css
│   ├── Handheld/         index.tsx + style.css   ← mobile "See in Action" brick-game console modal (HH games)
│   ├── JourneyProgress/  index.tsx + style.css
│   ├── LabsRail/         index.tsx + style.css   ← Labs nav rail (fixed desktop / sticky mobile)
│   ├── Magic8Ball/       index.tsx + style.css   ← pixel-art oracle game (unchanged)
│   ├── Navbar/           index.tsx + style.css
│   ├── PixelBorder/      index.tsx + style.css
│   ├── PixelIcon/        index.tsx + style.css   ← 8×8 rect-grid SVG icon set (replaces all emoji)
│   ├── SceneText/        index.tsx + style.css   ← title + teaser + SHOW LOGIC toggle
│   ├── ScrollIndicator/  index.tsx + style.css
│   ├── ScrollToTop/      index.tsx
│   ├── SpaceBackground/  index.tsx + style.css   ← app-wide fixed bg layer: dark = pixel space (stars/moon), light = pixel sky (clouds/sun)
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
│   ├── useIsMobile.ts        ← matchMedia mobile flag (≤768px or coarse-pointer ≤899px); drives Labs mobile branch
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

| File                                       | Purpose                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/resume.ts`                       | **Only place resume content lives.** Edit here; pages pick it up automatically.                                                                                                                                                                                                                                                 |
| `src/data/labs.ts`                         | **Only place Labs content lives.** All experiments, channels, teasers, code snippets. See §Labs internals.                                                                                                                                                                                                                      |
| `src/styles/tokens.css`                    | All CSS custom properties — palette, spacing, fonts, shadows. Edit colours here, not inline.                                                                                                                                                                                                                                    |
| `src/styles/global.css`                    | Reset, utility classes (`.pixel-text`, `.vt-text`, animations), **all `.btn` / `.btn--*` variants** (each sets `--btn-shadow` for the 3D-press mechanic — see §Button system), and two blink keyframes: `blink` (step-end, for cursors/CTAs) and `blink-soft` (ease-in-out fade, for persistent chrome like the navbar cursor). |
| `src/contexts/ThemeContext.tsx`            | Dark/light theme. Reads `prefers-color-scheme` as default; persists override in `localStorage` under key `cj-portfolio-theme`. Applies `data-theme` attribute to `<html>`.                                                                                                                                                      |
| `src/contexts/ScrollProgressContext.tsx`   | One shared rAF loop writing `--p` (0→1) onto registered scene elements. Used by Labs SceneText for entry animations.                                                                                                                                                                                                            |
| `src/pages/Contact/index.tsx`              | Has `FORMSPREE_ID` constant at the top — set it to enable direct email.                                                                                                                                                                                                                                                         |
| `src/utils/haptics.ts`                     | Thin wrapper around `navigator.vibrate` + stub for future haptic patterns. Import `haptics` and call `.tap()`, `.press()`, `.toggle()`, `.reveal()`.                                                                                                                                                                            |
| `src/components/Magic8Ball/index.tsx`      | Self-contained pixel-art oracle game. Lives in **Labs → magic8ball toy scene**. See §Magic8Ball below.                                                                                                                                                                                                                          |
| `src/components/TVScreen/index.tsx`        | Channel host FSM (`live` / `static`). `GAME_MAP` here maps `GameKey → Component`. Add new TV games here.                                                                                                                                                                                                                        |
| `src/components/CursorRocket/index.tsx`    | App-wide custom cursor. Mounted once in `App.tsx`. See §Cursor & background layers below.                                                                                                                                                                                                                                       |
| `src/components/SpaceBackground/index.tsx` | App-wide fixed background layer (space/sky). Mounted once in `App.tsx`. See §Cursor & background layers below.                                                                                                                                                                                                                  |

---

## Architecture decisions

### CSS custom properties, not Tailwind

All theming is done through CSS variables in `tokens.css`. There is no
Tailwind, no CSS-in-JS. When adding styles, extend tokens first before
hardcoding hex values inline.

### Scrollbar — floating + stable gutter

`global.css` sets `html { scrollbar-gutter: stable }` so the scrollbar's space is
always reserved. Without it, content shifts horizontally when navigating between
document-scrolling pages (Home/About/Contact) and Labs (a full-height nested
scroller where the document doesn't overflow, so the root scrollbar vanishes).
The `::-webkit-scrollbar` styling is a **floating overlay** look: transparent
track, and a thumb inset via `border: 3px solid transparent` + `background-clip:
padding-box` so it reads as a slim pill over the content. Firefox uses
`scrollbar-width: thin` + `scrollbar-color: thumb transparent`. These rules are
global (universal selector), so they also style the nested Labs/About scrollers.

### One CSS file per component/page

Each `.tsx` file has a sibling `.css` file. Global utilities live in
`global.css`. Do not add page-specific rules to `global.css`.

### Pixel-art conventions — the four uniformity rules

Everything visual resolves to one of four token families. If you find yourself
typing a raw `px` value for any of these, reach for the token instead.

| Axis | Token | Rule |
| ---- | ----- | ---- |
| **Spacing** | `--px` … `--px24` | Always a `--px` multiple (`--px2` = 8px, `--px4` = 16px, …). |
| **Borders** | `--border-width` (4px), `--border-thin` (1px) | Every content border is `--border-width`. `--border-thin` is only for hairlines inside dense chrome (XP-bar segments, terminal dots). Never `border-radius` except `--radius-sm` (2px) on inputs. |
| **Elevation** | `--shadow-depth` (4px), `--shadow-depth-lg` (8px) | One resting depth for the whole page; the deeper step is reserved for modals and hover lifts. Prebuilt: `--shadow-pixel`, `--shadow-pixel-strong` (accent-coloured), `--shadow-pixel-lg`. Hard offset, no blur. |
| **Pixel type** | `--fs-pixel-2xs` … `--fs-pixel-xl` | 8 / 9 / 10 / 11 / 13 / 16 px. Tuned tight on purpose: "Press Start 2P" is a 5x7 grid font with no descenders, so it reads a size or two larger than its nominal value. **8px is the floor.** Prose keeps the rem-based `--font-size-*` scale. |

### Prose style

No em dashes in user-facing copy. Use a colon, a comma, a semicolon or
parentheses instead, whichever the sentence actually wants. This applies to
everything a reader sees: `resume.ts`, `labs.ts`, page copy, `aria-label`s,
blog frontmatter and MDX bodies, and the head meta in `index.html`. En dashes
in numeric ranges ("May 2024 – Apr 2026", "200–500") are fine. Title
separators use "·".

`.pixel-surface` in `global.css` is the single card/panel recipe (bg + border +
shadow) — use it rather than re-declaring the trio.

Image rendering: `image-rendering: pixelated` on the avatar and pixel icons.

### Navbar theme toggle — icon only

`.theme-toggle__label` in `Navbar/style.css` has `display: none` — the "DARK"/"LIGHT" text label is hidden. Only the toggle track (sun/moon icons + sliding thumb) renders. Do not restore the label unless you also check that it fits in the navbar bar on narrow desktops.

### Colour, one ramp per theme and no brand accents

The per-company accents (`--nivoda-gold`, `--delhivery-red`,
`--classplus-purple`) **were removed**. Each theme now has exactly one shared
accent ramp: do not reintroduce a colour that means "a particular company,
blog post, or lab experiment". Identity is carried by copy, numbering and
layout, not hue.

**The two themes deliberately use different hues**, because they sit on
different backdrops:

| Theme | Ramp | Why |
| ----- | ---- | --- |
| Dark | Purple (`#bfaee4` -> `#9689bc` -> `#7d719e`) | Sits on the near-black night sky. |
| Light | Sand (`#6b4f22` -> `#7a5b24` -> `#8e723c`) | Warm accent against the blue daytime sky. Only the accent is warm: backgrounds, text and borders stay cool blue-tinted paper. |

The light sand ramp runs dark on purpose. `--bg-sky` (`#bfe3f5`) is bright, and
sand is a light hue, so anything lighter than these values drops under 4.5:1
against the sky. If you want a sunnier accent, you must darken the sky first.

Keep them in step: a change to one theme's ramp does not imply the same change
to the other, but both must stay a single hue in three steps.

What exists, all in `tokens.css`:

- **Accent ramp**: `--accent-primary` -> `--accent-secondary` ->
  `--accent-muted`. One hue, three steps. `--accent-glow` is the translucent
  wash. Backgrounds and text are tinted toward the same hue so the surface
  reads as one temperature rather than grey.
- **Status signals**: `--signal-ok`, `--signal-warn`, `--signal-danger`.
  Desaturated, and reserved for genuine state (availability, form errors,
  experiment status, POWER-off). Per WCAG 1.4.1 they always ride alongside a
  glyph or a word, never carrying meaning alone.
- **Sky scene**: `--bg-sky`, `--sky-sun`, `--sky-cloud`, `--sky-moon`. This is
  the one place with real, non-purple colour: a blue daytime sky with a warm
  sun and white clouds, a near-black night sky with a pale moon. Keep the
  decor out of the UI ramp and vice versa.
- **CRT tokens**: `--crt-bg` / `--crt-fg` / `--crt-dim` are **theme-independent
  on purpose**. The TV screen, handheld screen and gacha reels are dark surfaces
  in *both* themes, so anything drawn on them must use these; a themed text
  token would render near-black on near-black in light mode. This is the single
  easiest mistake to make in this codebase.

**Contrast is a contract.** Every foreground/background pair in `tokens.css` is
verified against WCAG 2.0 AA (4.5:1 text, 3:1 borders and UI boundaries) and
the ratios are noted in the comments.

The pair to check is against **`--bg-sky`, not `--bg-primary`**: `body`'s
background propagates to the viewport canvas, and `.space-bg` (at the negative
`--z-bg`) paints above it, so the sky is what actually sits behind page copy.
The light sky is the brightest backdrop in the app and is therefore the binding
constraint on `--accent-secondary`, `--accent-muted` and `--border-primary`.
When you change a colour, re-check it: the app is audited to zero failures
across all six routes in both themes.

### Button system — `--btn-shadow` and 3D press

All `.btn` variants in `global.css` carry a `--btn-shadow` CSS custom property that controls both the resting drop-shadow colour **and** the 3D press collapse. The pattern:

```css
.btn {
  --btn-shadow: var(--border-primary); /* base default */
  box-shadow: var(--shadow-depth) var(--shadow-depth) 0 var(--btn-shadow);
}
/* On hover, set --btn-shadow to the hover colour too, so :active collapses the right shade */
.btn--primary:hover { --btn-shadow: var(--accent-primary); ... }

/* 3D press: translate exactly the shadow depth, collapse shadow to 0 */
.btn:active {
  transform: translate(var(--shadow-depth), var(--shadow-depth));
  box-shadow: 0 0 0 var(--btn-shadow) !important;
}
```

Shadow depth is **`--shadow-depth` (4px)** — not 8px. A 4px shadow + 4px translate means the button shifts into the exact space the shadow occupied, giving a clean physical press with no floating artifact. The `@keyframes btn-press` animation (used for the ENTER-key CTA trigger) animates the same translate + shadow collapse + restore.

The base `.btn` also owns padding (`--px3`/`--px6`), `min-height: 40px`,
`--fs-pixel-md` type and the disabled state. Variants (`--primary`,
`--outline`, `--ghost`) change **colour only**; `--sm` / `--lg` change padding
and min-height only. **Do not add a bespoke button** — the old
`.btn--whatsapp` / `.btn--email` one-offs on Contact were deleted for exactly
this reason; that page now uses `.btn--primary` and `.btn--outline`.

### Button system — `--btn-shadow` and 3D press

All `.btn` variants in `global.css` carry a `--btn-shadow` CSS custom property that controls both the resting drop-shadow colour **and** the 3D press collapse. The pattern:

```css
.btn {
  --btn-shadow: var(--border-primary); /* base default */
}
.btn--primary { --btn-shadow: var(--accent-primary); box-shadow: var(--px) var(--px) 0 var(--btn-shadow); }
/* On hover, set --btn-shadow to the hover colour too, so :active collapses the right shade */
.btn--primary:hover { --btn-shadow: var(--accent-secondary); ... }

/* 3D press: translate exactly the shadow depth (4px = var(--px)), collapse shadow to 0 */
.btn:active {
  transform: translate(var(--px), var(--px));
  box-shadow: 0 0 0 var(--btn-shadow) !important;
}
```

Shadow depth is **4px (`var(--px)`)** — not 8px. A 4px shadow + 4px translate means the button shifts into the exact space the shadow occupied, giving a clean physical press with no floating artifact. The `@keyframes btn-press` animation (used for the ENTER-key CTA trigger) animates the same translate + shadow collapse + restore.

**Contact-page buttons** (`.btn--whatsapp`, `.btn--email`) in `Contact/style.css` are custom variants that follow the same 4px shadow and `translate(var(--px), var(--px))` active rule — they don't extend `.btn` but mirror the pattern.

---

## StatCard component

`src/components/StatCard/` — displays a single impact metric. The component accepts `before`, `after`, `pct`, `unit`, `label`, and `delay` props but **renders only the `after` value** as the headline metric — the before/after comparison row was removed. The `before` prop is destructured as `_before` (satisfies no-unused-vars) and intentionally ignored.

Layout: metric number (`vt-text`, 2.2rem) → label → XP-style fill bar → percentage. No strikethrough "before" figure.

`StatCard` and `XPBar` **no longer take a `color` prop** — both draw from
`--accent-primary`. The old per-category / per-index colour maps in `Home` and
`About` are gone; don't reintroduce them.

---

## PixelIcon component

`src/components/PixelIcon/` — the app's icon set. **There are no emoji anywhere
in the app**; emoji render in the OS colour font, so they ignored the theme,
broke the monochrome palette and changed shape per platform.

Each icon is a list of `[x, y, w, h]` rects on an 8×8 grid, drawn with
`fill="currentColor"` and `shapeRendering="crispEdges"` — so it inherits text
colour, re-themes for free, and stays crisp at any integer size. Names:
`calendar`, `pin`/`location`, `cap`, `phone`, `mail`, `code`.

```tsx
<PixelIcon name="calendar" size={12} />          // decorative (aria-hidden)
<PixelIcon name="mail" size={16} title="Email" /> // pass title only when the icon alone carries meaning
```

Keep `size` a multiple of 8 where practical so pixels stay square. To add an
icon, add a rect list to `ICONS` and its name to `PixelIconName`.

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

**Home closing section:** see §Section 3 below — the old `PRESS START`
pixel-screen and 4-card nav grid were replaced by the `.home-outro` directory.

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

## Cursor & background layers (added 2026-07-01)

Two shared, app-wide fixed-position layers, each mounted **once** in `src/App.tsx` (inside `ThemeProvider`, outside/alongside `<Routes>` so they persist across route changes without remounting):

### `CursorRocket`

`src/components/CursorRocket/` replaces the native OS cursor everywhere with a small pixel-art rocket (inline SVG, `shapeRendering="crispEdges"`) that rotates to point in the direction of mouse travel.

- Global `cursor: none !important` rule lives in `global.css` (one rule, not scattered per-component).
- Position/rotation are written directly to `style.transform` inside a `requestAnimationFrame` loop, driven by refs — **not** `useState` — mirroring `ScrollProgressContext`'s no-re-render discipline. Rotation = `atan2(dy, dx) + 90deg` (rocket is drawn nose-up/north in its own coordinate space), smoothed with a lerp, snapping to nose-up after ~150ms idle.
- Respects `prefers-reduced-motion`: skips the lerp and snaps directly to the target angle instead of easing.
- Rocket body/flame use `var(--accent-primary)` / `var(--accent-secondary)` — no hardcoded colors, so it re-themes automatically with dark/light.
- The cursor element is `pointer-events: none` and sits at the new `--z-cursor: 400` token (tokens.css), above `--z-modal: 300` so it renders over the Handheld/CodePopup modals.

### `SpaceBackground`

`src/components/SpaceBackground/` renders one fixed, full-viewport decorative layer behind all page content, branching on `useTheme().isDark`:

- Both variants paint `var(--bg-sky)` and draw their decor from the `--sky-*` tokens, never the purple UI ramp. This is deliberately the one colourful surface in the app.
- **Dark theme**: near-black night sky, a deterministic star field (fixed positions, not `Math.random()`, so layout never shifts) with a few twinkling stars, plus a small pixel-art moon (blocky SVG rect-cluster) in `--sky-moon`.
- **Light theme**: blue pixel sky, a warm `--sky-sun` and white `--sky-cloud` rect-clusters. The decor sits top-right, clear of the content column. If you move it over body copy, re-check contrast: text is measured against `--bg-sky`, and a solid shape behind it changes the local ratio.
- Both variants respect `prefers-reduced-motion` (twinkle/drift animations disabled, decor stays visible) via the same `matchMedia` + `change`-listener pattern used elsewhere in the codebase.
- Sits at the new `--z-bg: -1` token (tokens.css) — intentionally **negative** so it paints behind all normal in-flow page content without requiring every page to add explicit `position`/`z-index` just to sit above it (CSS paints negative-z-index descendants before non-positioned in-flow boxes).
- `pointer-events: none` throughout — never blocks clicks or Labs game input.

**Gotcha for future pages:** any page/section that sets its own **opaque** `background: var(--bg-primary)` on a root/full-height container will fully hide `SpaceBackground` on that route, because normal in-flow content paints after negative-z-index layers. This was already fixed for `Labs` (`.labs-section`, `.tv-set-wrapper`), `BlogIndex` (`.blog-index`), and `BlogPost` (`.blog-post`) by removing that declaration — they now rely on the shared layer (or `body`'s `--bg-primary`) showing through instead. **When adding a new page, don't set an opaque background on its root container** — let `SpaceBackground` show through, same as Home/About/Contact already do.

---

## Labs page — scroll-snap internals (restructured)

`src/pages/Labs/` — a content-driven scroll journey with a **shared sticky CRT TV** for game channels and standalone toy scenes.

### Content model

`src/data/labs.ts` is the single source of truth (mirrors `resume.ts`). Each `LabExperiment` has:

- `render: 'tv' | 'standalone'` — determines scene type
- `game: GameKey` — maps to a game component in `src/components/games/`
- `code: string` — the core-logic snippet shown in the expandable `CodePanel`
- **Invariant**: all `render: 'tv'` entries must be contiguous before `standalone` entries. A dev-mode assertion in `labs.ts` throws if violated.
- There is **no `accent` field** — it was a per-experiment brand colour and is gone. `SceneText` derives the status badge colour from `status` via its `STATUS_COLORS` map (`RUNNING` → `--signal-ok`, `WRITING` → `--signal-warn`, `OFFLINE` → `--text-muted`); the rail, CRT and code popup all use `--accent-primary`. Likewise `Experience` in `resume.ts` has no `accentVar` / `accentHex` / `bgHex`.

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

**ToyScene mirrors the TV zone** so the layout stays uniform when scrolling from channels into toys: `.toy-scene__inner` is a full-width row (no `max-width`/centering), `.toy-scene__text` is `flex: 1` with the same `var(--px12) var(--px8)` padding as `.tv-blog-scene`, and `.toy-scene__game` is `flex: 0 0 46%` (matching `.tv-zone__right`) so the toy's horizontal centre lines up with the CRT. On mobile the inner stacks (`align-items: stretch`) and the toy is re-centred via `align-self: center` (`flex: none`).

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
- Active item tracked by `activeIdx`; the dot fills with `--accent-primary` and the active name tints to it. (The old per-experiment `--row-accent` inline style is gone.) Groups separated by a thin `.labs-rail__sep` line whose `TV` / `TOYS` micro-label also reveals on hover.
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

All games in `src/components/games/` implement `GameProps { active: boolean; controlRef?: MutableRefObject<GameHandle | null> }` (see `games/types.ts`):

- rAF loops must **not run** when `active` is false. The mobile `Handheld` uses this as **pause/resume**: START/STOP just flips `active`. Because all game state lives in `useRef`, toggling `active` off then on freezes and resumes without losing state (the component is never unmounted).
- DinoRun shows a "SPACE / TAP TO START" overlay until first input (avoids auto-death on channel switch).
- Keep game state in `useRef`, not `useState`, inside the loop — zero re-renders per frame.
- **`controlRef` (touch input):** arcade games (Snake, Pong, DinoRun) publish a `GameHandle { input(action, phase) }` onto `controlRef` so the `Handheld` console can drive them with on-screen buttons. The handler is a single stable (`useCallback([])`, refs-only) `press`/`setKey` function shared with the keyboard listener — **keyboard behaviour is unchanged**. Momentary games react to `phase === 'down'`; Pong (held paddle) uses both `down`/`up`. `controlRef` is optional and ignored on desktop and by LinkPreview.

### SceneText + CodePanel

`SceneText` has **no `max-width`** — it fills its parent column. `CodePanel` has no `max-height` / `overflow-y` — the code expands fully without internal scroll. On mobile, `CodePanel` sets `max-width: 100%; min-width: 0` to prevent horizontal layout shift.

### ScrollProgressContext

`src/contexts/ScrollProgressContext.tsx` runs **one shared rAF loop** that writes `--p` (0→1) as a CSS custom property onto each registered scene element, based on distance from stage center. Disabled when `prefers-reduced-motion: reduce` (the loop returns early, so `--p` is never written and CSS falls back to `var(--p, 1)` = fully-visible/static).

**Registration is required for any of this to animate.** Each scene (`HeroScene`, `TVBlogScene`, `ToyScene`) creates an internal ref and calls `useScrollProgress(ref)` to register itself; for the forwardRef scenes the internal ref is merged with the parent's section ref via `assignRef`. `--p` is set on the section and inherits to descendants. Consumers: `SceneText` (`.scene-text__title` / `.scene-text__teaser` → `translateY` + `opacity`) and `.toy-scene__game` (parallax `translateX` + `scale`). Do **not** add an `@supports (animation-timeline: view())` block that zeroes these transforms unless you also define a real native scroll-timeline animation — an earlier version did and silently disabled the effect on modern Chrome/Safari.

### Mobile experience (rebuilt — `device` routing)

The old mobile layout just stacked the sticky CRT into the page so it scrolled
away and games stayed keyboard-only (unplayable on touch). Mobile is now a
distinct, touch-first experience driven by a per-experiment **`device` field**
in `labs.ts` — `'TV' | 'HH' | 'NONE'` — that says where the interactive piece
renders on small screens. **Desktop is untouched**: it always uses `render` +
the shared sticky CRT.

Mobile detection is `useIsMobile()` (`src/hooks/useIsMobile.ts`): matches
`(max-width: 768px) OR ((pointer: coarse) and (max-width: 899px))`. The Labs
`style.css` mobile block uses the **same** media-query string so CSS and JS flip
together; the IntersectionObserver root also keys off `isMobile`.

On mobile (`useIsMobile()` true):

- `Labs/index.tsx` **does not render** the shared `.tv-zone__right` CRT (gated by `!isMobile`), so it can't scroll away.
- `SceneText` hides the inline `CodePanel` and renders two buttons: **`</> SHOW CODE`** (all experiments) and **`▶ SEE IN ACTION`** (only `device === 'HH'`).
- **`device: 'HH'`** (Snake, Pong, Dino) → "See in Action" opens `Handheld` — a brick-game console modal that mounts the _real_ game in its screen and drives it via `controlRef`. Buttons come from `experiment.controls` (`'dpad' | 'updown' | 'single'`). START/STOP = pause/resume (`active`), POWER (`OFF`) closes the modal.
- **`device: 'TV'`** (LinkPreview) → renders a single-channel inline `<TVSet activeChannel={exp.channel}>` inside `TVBlogScene` (`.tv-blog-scene__mobile-tv`). It's already touch-friendly (paste a URL), so no handheld.
- **`device: 'NONE'`** (Magic8Ball, Gacha) → the toy renders inline in `ToyScene` exactly as before (already tap-driven). Only "Show Code" is added.
- `LabsRail` → still `display: none`.

New mobile components (each own folder + `style.css`):

- `Handheld/` — the retro console modal. Game map (`HH_GAMES`) for snake/pong/dino lives here. Lock body scroll + Esc-to-close while open.
- `CodePopup/` — the "Show Code" terminal. Opens with an **iOS-style zoom** (scale `0.32 → 1` from `transform-origin: 50% 100%`, spring ease, backdrop fade) — _not_ a 3D flip — and plays a reverse **close** animation before unmounting. The exit is driven by a `closing` state + a `CLOSE_MS` timeout that must stay in sync with the `cp-close` duration in `style.css`; backdrop tap, ✕ CLOSE, and Esc all route through `requestClose()`. Code lines still stagger in (`cp-line`). Reuses `CodePanel` for the body.

### Adding a new lab experiment

1. Add an entry to `LAB_EXPERIMENTS` in `src/data/labs.ts` (keep all `tv` entries before `standalone`). **Set `device`** (`'TV' | 'HH' | 'NONE'`); if `'HH'`, also set `controls`.
2. If it's a TV game, create `src/components/games/YourGame/index.tsx + style.css` implementing `GameProps`, then add it to `GAME_MAP` in `TVScreen/index.tsx`. If it should be playable on mobile via the handheld (`device: 'HH'`), expose a `controlRef` `GameHandle` and add it to `HH_GAMES` in `Handheld/index.tsx`.
3. If it's a toy, add a `game === 'yourkey'` branch in the `ToyScene` component inside `Labs/index.tsx`.
4. No section ref wiring needed — the Labs page maps `LAB_EXPERIMENTS` dynamically.

---

## About page — scroll-snap internals

The About experience now uses a **single full-height snap stage** (`.about-stage`) on the page itself. The intro section and each experience card are treated as snap sections, and the page scrolls through them in one continuous flow.

Key behaviors:

1. The intro section should fill the viewport height (`min-height: calc(100dvh - 56px)`) so it feels like a true first screen.
2. The page-level scroll container uses `scroll-snap-type: y mandatory` on `.about-stage`; each section uses `scroll-snap-align: start`.
3. Programmatic section jumps use the stage container directly via `container.scrollTo({ top: target.offsetTop, behavior: "smooth" })` rather than `scrollIntoView`.
4. `IntersectionObserver` watches the intro and each card section from the same root container so `activeIdx` updates as the user scrolls through the page.
5. The journey progress rail is shown for the intro and every experience card. Its tooltip appears only for the active section, with a 1s delay after the section becomes active and a 2s display duration before it hides again.
6. The old separate journey header and nested journey scroller were removed; the progress rail now serves as the primary section navigator.

---

## Home page — layout and interactions

### Snap-scroll architecture (3 sections)

`src/pages/Home/` uses a **nested scroll container** (`div.home-snap`) for
scroll-snap, keeping the snap isolated to the home route.

```
main.home-page
├── div.hero__deco          ← floating pixel symbols, position: fixed (desktop)
└── div.home-snap           ← height: calc(100vh−56px), overflow-y: scroll,
                               scroll-snap-type: y mandatory, scrollbar hidden
     ├── section.hero.home-snap__section           ← Hero
     ├── section.impact-skills-section.home-snap__section  ← Stats + Skills
     └── section.home-outro.home-snap__section             ← Directory + contact
```

Key rules:

- `.home-page`: `height: calc(100vh−56px); overflow: hidden` — clips the snap container to the viewport.
- `.home-snap__section`: `height: calc(100vh−56px); scroll-snap-align: start; scroll-snap-stop: always; z-index: 1`. **Never `min-height`** — that breaks snap.
- `scrollDown` (the ▼ scroll prompt) calls `snapRef.current.scrollTo({ top: snapRef.current.clientHeight, behavior: "smooth" })`. Do **not** use `scrollIntoView` — it doesn't work on a nested scroll container.
- **No section divider borders or alternate backgrounds** — all three sections share the same `--bg-primary` background for a seamless look.

### Section 1, Hero

Two-column layout: text left, avatar right. (The old floating `div.hero__deco`
pixel-symbol layer was removed; `SpaceBackground` already provides the drifting
backdrop.)

**Typewriter lines must not shift the page.** `.hero__role` and
`.hero__location` both use the `.hero__type` pattern: a `.hero__type-ghost`
span holds the *full* string at `visibility: hidden`, and `.hero__type-live`
is absolutely positioned over it with the typed characters. The ghost defines
the height and wraps exactly as the finished text will, so the bio and CTAs
below never move while the text types in.

Do not swap this back to `min-height` on the paragraph. `min-height` was what
caused the original jump: it can't know how many lines the finished string
takes, and it was also set smaller than the paragraph's own `line-height`, so
the box grew the moment the first character landed.

### Section 2 — Impact + Skills

`.impact-skills-section` merges what were previously separate stats and skills sections. Layout: centered flex column with `overflow-y: auto` (scrollable within snap if content overflows on small screens). Contains two `.impact-block` divs — `IMPACT.log` (all `STATS`) and `SKILL_TREE` (first 8 `SKILLS`).

### Section 3 — `.home-outro` (directory + contact)

Replaced the old `PRESS START` pixel-screen + 4-card nav grid. Four cramped
cards competing with a blinking arcade screen gave the page two focal points
and no clear exit; the section is now one quiet index with a single primary
action.

```
section.home-outro
└── div.home-outro__inner        ← flex column, gap --px8
     ├── header.home-outro__head        eyebrow "// NEXT" + title + lede
     ├── nav.home-outro__list           4 × a.outro-row
     └── div.home-outro__bar            availability + RESUME + GET IN TOUCH
```

- **`.outro-row`** is a full-width `grid-template-columns: var(--px8) 1fr var(--px5)` — index number, title + description, and a `>` chevron that nudges right on hover. Uses the standard surface recipe (`--border-width`, `--shadow-pixel`, `--shadow-pixel-strong` on hover) and presses in like a button on `:active`.
- Destinations live in the **`NEXT_LINKS`** array at the top of `Home/index.tsx` — add a row there, not in JSX.
- `.home-outro__bar` is the closing action strip: availability status (`--signal-ok` + blinking square) on the left, `RESUME` (`.btn--outline`) and `GET IN TOUCH` (`.btn--primary`) on the right.
- **Mobile (≤768px):** the bar stacks, buttons go full-width (`flex: 1`), `.outro-row__num` is hidden, and the `ENTER` key hint is `display: none` (no physical keyboard).

### ENTER key on the closing CTA

ENTER navigates to `/contact` while `.home-outro__inner` is ≥40% visible. Implementation in `Home.tsx`:

- `ctaRef` → `.home-outro__inner`
- `ctaInView` state via IntersectionObserver (`threshold: 0.4`)
- `keydown` listener on `window` that checks `ctaInView && !ctaPressed`, **and bails if `document.activeElement` isn't `body`** — otherwise ENTER on a focused link or input would hijack the user's own keypress
- 320ms delay before `navigate('/contact')` so the `.btn--pressed` animation completes

**Mobile hero CTAs:** at `≤768px` only the **↓ RESUME** download button is shown — `Home/style.css` hides the others with `.hero__ctas .btn:not(.btn--resume) { display: none }`. VIEW JOURNEY / HIRE ME stay reachable from the nav, so the mobile hero isn't cluttered with buttons. Keep this selector keyed off `.btn--resume`, not button order.

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

1. Create `apps/portfolio/src/pages/NewPage/index.tsx` + `style.css`.
2. Add the route in `apps/portfolio/src/App.tsx`.
3. Add `{ to: "/newpage", label: "> LABEL", key: "newpage" }` to `NAV_LINKS` in `apps/portfolio/src/components/Navbar/index.tsx` — the mobile dropdown renders from the same array automatically.
4. If the page has content driven by data, add an export to `apps/portfolio/src/data/resume.ts`.
5. Do not set an opaque `background: var(--bg-primary)` on the page's root container — see §Cursor & background layers, it will hide the shared `SpaceBackground` layer on that route.
6. Update `CLAUDE.md` (required by pre-commit hook if you commit portfolio source changes).

---

## Pre-commit hook — CLAUDE.md enforcement

A git hook at `.githooks/pre-commit` (tracked) blocks commits that stage `apps/portfolio/src/` changes without also staging `CLAUDE.md`. This enforces the doc-with-feature contract.

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

**What triggers the check:** any staged file matching `apps/portfolio/src/**` — `.tsx`, `.ts`, `.css`, anything.

---

## Mobile behaviour — exceptions index

Single place that lists every spot where mobile diverges from desktop. **Detail
lives in each feature's own section; this is the lookup.** "Mobile" is whatever
`useIsMobile()` matches — `(max-width: 768px) OR ((pointer: coarse) and (max-width: 899px))` — and the relevant CSS media queries use the **same** string so JS and CSS flip together.

| Area                         | Desktop                                                                                                             | Mobile exception                                                                                                                                                                               | Where                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Labs interactive surface** | Shared sticky CRT cycles channels; inline `CodePanel` under each scene                                              | Shared CRT not rendered. Per-experiment `device` routes it: `HH` → `</> SHOW CODE` + `▶ SEE IN ACTION` buttons; `TV` → inline single-channel CRT; `NONE` → toy inline. See §Mobile experience. | `Labs/index.tsx`, `SceneText`, `labs.ts` (`device`/`controls`) |
| **Show Code**                | Inline `CodePanel`                                                                                                  | `CodePopup` modal — iOS-style zoom open + animated close                                                                                                                                       | `CodePopup/`                                                   |
| **See in Action (HH games)** | Game plays in the CRT, keyboard input                                                                               | `Handheld` console modal; touch D-pad/up-down/single drives the real game via `controlRef`; START/STOP = pause/resume, POWER = close                                                           | `Handheld/`, `games/*` `GameHandle`                            |
| **Toy scenes**               | text left / toy right, mirrors TV zone                                                                              | inner stacks; toy re-centred (`align-self: center`, `flex: none`)                                                                                                                              | `Labs/style.css`                                               |
| **LabsRail**                 | left floating pill index                                                                                            | `display: none` (no section nav)                                                                                                                                                               | `LabsRail/style.css`                                           |
| **Labs scroll-snap**         | `scroll-snap-type: y mandatory`, nested scroll container                                                            | snap off; `.labs-stage` `overflow: visible`, sections stack                                                                                                                                    | `Labs/style.css`                                               |
| **Home snap-scroll**         | 3-section `div.home-snap` nested scroll container with `scroll-snap-type: y mandatory`; hero deco `position: fixed` | snap off (`scroll-snap-type: none`); sections stack with `min-height: 100svh`; deco reverts to `position: absolute`                                                                            | `Home/style.css`                                               |
| **Home hero CTAs**           | RESUME + VIEW JOURNEY + HIRE ME                                                                                     | only **↓ RESUME**; others hidden via `.hero__ctas .btn:not(.btn--resume)`                                                                                                                      | `Home/style.css`                                               |
| **Home closing section**     | `.home-outro__bar` is a single row; `.outro-row__num` visible; `ENTER` hint shown in the primary CTA                | bar stacks and buttons go full-width (`flex: 1`); `.outro-row__num` hidden; `ENTER` hint `display: none` (no physical keyboard)                                                                 | `Home/style.css`                                               |
| **About journey**            | nested scroll-snap journey + right-side `journey-progress` dots                                                     | snap disabled, cards stack; progress dots hidden `≤900px`                                                                                                                                      | `About/`, `JourneyProgress`                                    |

When you add a new mobile divergence, add a row here **and** document the detail in the feature's own section.

## Known limitations / future work

- No backend. Email delivery requires Formspree (free tier covers ~50/month).
- The right-side progress dots (`journey-progress`) are hidden on screens ≤900px via `display: none`.
- The scroll-snap journey disables on mobile (`scroll-snap-type: none`) because full-height snap cards feel wrong on small screens. Cards stack vertically instead.
- **Labs page has no mobile section navigation.** `LabsRail` is `display: none` on mobile. The mobile experience is now interactive (per-`device` handheld / code-popup / inline surfaces — see §Mobile experience), but there's still no section index or jump nav; users scroll. A future fix would be a fixed bottom dot-strip using the existing `activeIdx` state.
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
  Labs game). **The MDX file is the single source of truth** — its YAML
  frontmatter holds all the metadata. Required: `title`, `description`, `date`,
  `tag`, `accent`. Optional: `order` (sort hint) and `gameKey` (omit it for posts
  not tied to a Lab game — it defaults to `""` so `getBlogByGame` never matches
  them). There is **no `blogs.config.ts`** anymore.
  - **The app** reads metadata from the `virtual:blogs` module, produced by
    `vite-plugin-blogs.mjs` (it scans `src/blogs/posts/*.mdx` frontmatter via
    `scripts/lib/blogs.mjs` → `loadBlogs()`, sorts by `order`, and ships **only
    metadata** — no post bodies — to the client; HMR re-runs it when a post is
    added/edited/removed). `src/blogs/meta.ts` re-exports `BLOGS` + the
    `BlogMeta` type from it and hosts `getBlog`, `getBlogByGame`, `ogImageUrl`.
    `virtual:blogs` is typed in `src/blogs/virtual-blogs.d.ts`.
  - **The edge crawler** (`api/page.ts`) can't import shared TS, so its inlined
    `BLOGS` array (between the `// <blogs:start>` / `// <blogs:end>` markers) is
    **auto-generated** from the same frontmatter by
    `scripts/gen-blog-manifest.mjs` (`pnpm gen:blogs`, also runs in `predev` +
    `prebuild`). Never hand-edit that block.
  - `scripts/lib/blogs.mjs`, `vite-plugin-blogs.mjs`, and the two scripts are
    plain **`.mjs`** on purpose: `gray-matter` (the frontmatter parser) stays out
    of the app's TypeScript graph — the app only ever sees typed `virtual:blogs`.
  - `order` preserves the **curated** list order (not date-sorted). `loadBlogs`
    sorts by `order`, then newest `date`, then slug.
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
  (built by `ogImageUrl()` in `src/blogs/meta.ts`), so the edge bundle has no
  cross-module imports to choke on. `api/tsconfig.json` enables JSX
  (`jsx: react-jsx`) for the function build. Refresh LinkedIn's cache via the
  Post Inspector after each deploy.
- **Add a post:** run `pnpm new:blog --title "My Post Title"` — it slugifies the
  title, refuses to overwrite an existing slug, and scaffolds
  `src/blogs/posts/<slug>.mdx` with frontmatter boilerplate (`date` = today,
  `order` = max + 1, placeholder `tag`/`accent`/`gameKey`). Then fill in the
  frontmatter + body (set `gameKey` to match a Lab experiment's `game` to get the
  "READ FULL POST →" button in Labs). The listing/routing pick it up
  automatically; `api/page.ts` re-syncs on the next `pnpm gen:blogs`/build. Add a
  `<loc>` to `public/sitemap.xml` (still manual).
- There is one post per Lab feature. The `spa-seo-without-ssr` post (top of the
  list) is tied to the `linkpreview` channel. That channel (`games/LinkPreview`)
  takes a pasted URL, calls the `api/preview.ts` edge function which fetches the
  page and scrapes its `og:`/`twitter:` tags, and renders the card live in the
  CRT — a working demo of the meta the SEO post is about.

The MDX toolchain is `@mdx-js/rollup` (vite plugin, `enforce: 'pre'`, before the
SWC react plugin) + `@mdx-js/react` + `remark-gfm` + **`remark-frontmatter`**
(strips the YAML `---` block out of the rendered body) + **`remark-mdx-frontmatter`**
(also exposes it as a `frontmatter` named export — the eager-glob fallback path to
`virtual:blogs`). `*.mdx` is typed in `src/vite-env.d.ts`.

---

## Commands

```bash
pnpm dev                       # portfolio dev server on :5173
pnpm dev:learn-python          # Learn Python dev server
pnpm dev:interview             # Frontend Interview Prep dev server
pnpm build                     # portfolio build → dist/apps/portfolio
pnpm nx build learn-python     # Learn Python build → dist/apps/learn-python
pnpm build:all                 # build every Nx app
pnpm preview                   # preview the portfolio build
pnpm lint                      # ESLint
pnpm gen:blogs                 # regenerate api/page.ts BLOGS from MDX frontmatter
pnpm new:blog --title "..."    # scaffold a new apps/portfolio/src/blogs/posts/<slug>.mdx
```
