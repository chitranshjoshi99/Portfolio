# Chitransh Joshi — Portfolio

Nx workspace containing the portfolio and standalone projects, built with **React 18 + Vite + SWC + TypeScript**.
Pixel-art design language, muted colour palette, dark/light theme, animated experience journey.

---

## Quick start

```bash
pnpm install
pnpm dev                  # portfolio at http://localhost:5173
pnpm dev:learn-python     # Learn Python app
pnpm dev:stylophone       # Stylophone Groove Coach
```

Opens at `http://localhost:5173`.

```bash
pnpm build                 # portfolio → dist/apps/portfolio/
pnpm nx build learn-python # Learn Python → dist/apps/learn-python/
pnpm build:all             # build every workspace app
```

---

## Project structure

Each component and page is a self-contained folder with `index.tsx` + `style.css`.

```
apps/
├── portfolio/
│   ├── src/
│   │   ├── components/   # Self-contained component folders
│   │   ├── contexts/     # Theme and scroll state
│   │   ├── data/         # Resume and Labs content
│   │   ├── hooks/        # Shared React hooks
│   │   ├── pages/        # Portfolio routes
│   └── styles/
│       ├── tokens.css    # All CSS custom properties — palette, spacing, fonts
│       └── global.css    # Reset, typography, utility classes, animations
│   ├── public/           # Portfolio assets deployed to chitransh.dev
│   └── project.json      # Nx targets
├── learn-python/
    ├── index.html        # Standalone static learning app
    ├── public/           # Learn Python assets and course data
    └── project.json      # Nx targets
└── stylophone/
    ├── src/              # Drum-and-bass groove coach
    ├── public/           # Instrument samples and social assets
    └── project.json      # Nx targets
```

---

## Customising content

**All resume data lives in one file:** `apps/portfolio/src/data/resume.ts`

- `PERSON` — name, role, bio, contact details
- `STATS` — the four performance metric cards on the Home page
- `SKILLS` — XP bar values on Home and About
- `EXPERIENCE` — the three scroll-snap experience cards on About
- `EDUCATION` — shown on the About intro

Edit that file and every page updates automatically.

---

## Enabling direct email (Formspree)

By default the **EMAIL** button on the Contact page opens your mail client as a fallback.  
To send email directly to your inbox without the user needing a mail app:

1. Create a free account at [formspree.io](https://formspree.io)
2. Create a new form → point it at `chitransh.joshi99@gmail.com`
3. Copy the form ID (e.g. `xpzgkwqr`)
4. Open `apps/portfolio/src/pages/Contact.tsx` and set:

```ts
const FORMSPREE_ID = "xpzgkwqr"; // ← your ID here
```

The form will now `fetch()` directly to Formspree and deliver to your inbox.  
The **WHATSAPP** button always works with zero setup.

---

## Theme

The default theme follows the user's OS preference (`prefers-color-scheme`).  
The toggle in the navbar overrides it and persists the choice in `localStorage`.

Colour tokens are in `apps/portfolio/src/styles/tokens.css` under `[data-theme="light"]` and `[data-theme="dark"]`.
Company accent colours (`--nivoda-gold`, `--delhivery-red`, `--classplus-purple`) are also defined there.

---

## Fonts

Loaded from Google Fonts in `apps/portfolio/index.html`:

| Font           | Use                                 |
| -------------- | ----------------------------------- |
| Press Start 2P | Headings, labels, pixel UI elements |
| VT323          | Large display numbers / metrics     |
| Inter          | Body copy, descriptions             |

---

## Deployment

The Vercel deployment builds the portfolio and every published workspace app into one static deployment bundle.

## Publishing an app on chitransh.dev

`pnpm build` creates one Vercel deployment bundle. The portfolio is served from
the domain root and every app listed in `apps/catalog.json` is copied to
`/apps/<slug>/` and shown at `https://chitransh.dev/apps`.

To publish a future app:

1. Add its Nx project under `apps/<project>/` with a `build` target that writes to `dist/apps/<project>/`.
2. Add its project name, URL slug, title, label, description, and accent colour to `apps/catalog.json`.
3. Run `pnpm build` and deploy as usual.

Published apps are Learn Python at `/apps/learn-python/` and Stylophone Groove
Coach at `/apps/stylophone/`.

```bash
# Vercel (recommended)
npx vercel --prod

# Netlify
netlify deploy --dir=dist --prod

# GitHub Pages — set the portfolio base in apps/portfolio/vite.config.ts first:
# base: '/your-repo-name/'
```

---

## Tech stack

|            |                                                 |
| ---------- | ----------------------------------------------- |
| Framework  | React 18                                        |
| Build tool | Vite 5 + SWC                                    |
| Language   | TypeScript 5                                    |
| Routing    | React Router v6                                 |
| Styling    | Plain CSS with custom properties (no CSS-in-JS) |
| Fonts      | Google Fonts (Press Start 2P, VT323, Inter)     |
| Email      | Formspree (optional)                            |
| Messaging  | WhatsApp wa.me API                              |
