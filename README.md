# Chitransh Joshi — Portfolio

Personal portfolio site built with **React 18 + Vite + SWC + TypeScript**.  
Pixel-art design language, muted colour palette, dark/light theme, animated experience journey.

---

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

```bash
npm run build   # production build → dist/
npm run preview # preview the production build locally
```

---

## Project structure

Each component and page is a self-contained folder with `index.tsx` + `style.css`.

```
src/
├── components/
│   ├── ExperienceCard/   # Scroll-snap company card (forwardRef, per-company accent)
│   ├── JourneyProgress/  # Right-side dot progress indicator
│   ├── Navbar/           # Fixed nav bar + pixel theme toggle
│   ├── StatCard/         # Animated before/after performance metric card
│   └── XPBar/            # Segmented pixel XP progress bar
├── contexts/
│   └── ThemeContext.tsx   # Dark/light theme, OS-preference default, localStorage
├── data/
│   └── resume.ts         # ← Single source of truth for all portfolio content
├── hooks/
│   └── useTypewriter.ts
├── pages/
│   ├── About/            # Experience journey with scroll-snap cards
│   ├── Contact/          # WhatsApp + Formspree contact form
│   └── Home/             # Hero, stat cards, skill XP bars
└── styles/
    ├── tokens.css        # All CSS custom properties — palette, spacing, fonts
    └── global.css        # Reset, typography, utility classes, animations
public/
├── profile.jpeg          # Pixel-art avatar
└── favicon.svg
```

---

## Customising content

**All resume data lives in one file:** `src/data/resume.ts`

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
4. Open `src/pages/Contact.tsx` and set:

```ts
const FORMSPREE_ID = "xpzgkwqr"; // ← your ID here
```

The form will now `fetch()` directly to Formspree and deliver to your inbox.  
The **WHATSAPP** button always works with zero setup.

---

## Theme

The default theme follows the user's OS preference (`prefers-color-scheme`).  
The toggle in the navbar overrides it and persists the choice in `localStorage`.

Colour tokens are in `src/styles/tokens.css` under `[data-theme="light"]` and `[data-theme="dark"]`.  
Company accent colours (`--nivoda-gold`, `--delhivery-red`, `--classplus-purple`) are also defined there.

---

## Fonts

Loaded from Google Fonts in `index.html`:

| Font           | Use                                 |
| -------------- | ----------------------------------- |
| Press Start 2P | Headings, labels, pixel UI elements |
| VT323          | Large display numbers / metrics     |
| Inter          | Body copy, descriptions             |

---

## Deployment

The output of `npm run build` is a static site in `dist/` — deploy to any static host:

```bash
# Vercel (recommended)
npx vercel --prod

# Netlify
netlify deploy --dir=dist --prod

# GitHub Pages — set base in vite.config.ts first:
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
