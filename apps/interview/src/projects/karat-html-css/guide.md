# HTML & CSS Round (Karat) — Interview Build Guide

The Karat screen splits in two: a JavaScript half and a layout half. The layout half is a blank file, a
screenshot or a sentence, and roughly 10–15 minutes per task. Nothing here is hard. People lose it on five
lines: a flex item that will not shrink, a `<summary>` styled until it loses its marker, a `:hover` rule that shuts out
the keyboard, an `:invalid` selector that paints an untouched form red, and a fixed banner sitting on the
last paragraph of the page.

Seven tasks, all reported: **search bar + button**, **responsive header**, **article with a 30vw image**,
**holy grail**, **image card with a hover overlay**, **fix the broken form validation**, **cookie consent
banner**. Each one runs live in this project inside a sandboxed frame with a width ruler, so the media
queries fire against the frame rather than the window.

**Minute budget (per task, not for the set)**

| Time | Phase |
| --- | --- |
| 0–2 | Read the target out loud; ask the two questions that change the markup |
| 2–4 | Write the HTML: elements that carry their own semantics |
| 4–10 | The layout: one mechanism, not four |
| 10–13 | The states nobody demos: keyboard focus, touch, narrow, long content |
| 13–15 | Say the trap you avoided — that is the part that gets written down |

---

## 0. Sandbox setup

One file, always:

```text
index.html    <!-- <style> in the head, markup in the body, <script> at the end if the task needs one -->
```

This repo keeps the same thing as data so every task can be rendered side by side:

```text
karat-html-css/
  index.tsx                             # task list + preview + source
  karat-html-css.types.ts               # CssTask, FormValues, FormErrors
  karat-html-css.css
  constants/tasks.ts                    # the seven tasks: prompt, checks, traps, html, css, js
  utils/css-tasks.utils.ts              # buildDoc (the demo document), formErrors (pure), clampWidth
  utils/css-tasks.check.ts              # node check
  hooks/use-css-tasks.ts                # selection, frame width, remount key
  components/task-preview.tsx           # sandboxed iframe + width ruler
```

The demo document is built as one string and rendered through `srcdoc` with
`sandbox="allow-scripts allow-forms"` — deliberately **without** `allow-same-origin`, so a task's CSS can
never reach this app and `localStorage` throws inside the frame. That last part is not an accident: the
consent banner has to survive exactly that.

---

## 1. Requirement gathering (2 minutes, every task)

Two questions, then build:

1. **"Mobile too, or desktop only?"** Everything below changes: a hover-only interaction is a desktop
   assumption, a fixed banner needs a safe-area inset, a nav has to collapse somehow.
   *Default: yes, build responsive — they are screening for it.*
2. **"Can I use a framework / library?"** *Default: no, and do not ask twice. This round is checking
   whether you know the platform.*

Per-task third question:

| Task | Ask | Default if unanswered |
| --- | --- | --- |
| Search bar | "Does the button collapse to an icon on mobile?" | no — keep the label, shrink the input |
| Header | "Hamburger, or wrap the links?" | hamburger via `<details>`, no JS |
| Article | "30vw of the viewport or 30% of the container?" | viewport, as stated |
| Holy grail | "Fixed side columns or fluid?" | fixed side columns, fluid centre |
| Hover overlay | "What happens on touch?" | show it outright |
| Form | "Native validation or custom?" | custom, `novalidate`, so the errors are styleable |
| Banner | "Blocking modal or dismissible banner?" | banner: a region, not a dialog |

---

## 2. High-level design (HLD)

```text
       markup            ── carries semantics ──▶  role, focusability, keyboard behaviour for free
          │                                        (button, label+for, details/summary, fieldset)
          ▼
    one layout mechanism  ── flex for a row, grid for a page ──▶  gap, not margins
          │
          ▼
       states            ── :hover  :focus-visible  :focus-within  @media (hover: none)
          │                 [aria-invalid]  [hidden]  prefers-reduced-motion
          ▼
      breakpoints        ── content decides where, not device names
```

Four claims worth saying out loud:

- **The markup does the accessibility work.** `<summary>` is focusable, toggles on Enter and Space, and
  announces expanded state. A `<div onclick>` has none of that and you will not write it back in on a
  15-minute clock.
- **One mechanism per problem.** A row of two things is flex. A page skeleton is grid with named areas.
  Mixing floats into either is how a layout becomes unexplainable.
- **Hover is not an interaction, it is a hint.** Anything only reachable by hover is unreachable by
  keyboard and by touch.
- **Breakpoints come from the content.** "The links stop fitting at 640px", not "iPad is 768".

---

## 3. Low-level design (LLD)

The five declarations that do the actual work in these tasks:

```css
flex: 0 0 auto;      /* never grow, never shrink — the button, the side column */
flex: 1 1 auto;      /* take the slack — the input, the centre column */
min-width: 0;        /* ...and be allowed to give it back. Flex items default to min-width: auto */
gap: 8px;            /* spacing that belongs to the container, not to the children */
grid-template-areas; /* the layout written as a picture, and it re-draws in the media query */
```

Pure functions (the only JavaScript in the set):

```js
formErrors(values) -> { field: message }   // no DOM, no events — the part a test can hold
buildDoc(task)     -> '<!doctype html>…'   // markup + styles + the injected validator
clampWidth(w, available) -> number         // the preview frame's width
```

`formErrors` is stringified into the demo document, so it must not reference anything outside its own
body. The check file asserts that (`new Function` over its source), because a validator that silently
throws inside a frame looks exactly like a validator that passes.

---

## 4. Data model — the one task that has one

```json
{ "name": "Priya", "email": "priya@example.com",
  "password": "correct-horse-9", "confirm": "correct-horse-9", "terms": true }
```

`terms` is a boolean, not `"on"`: `FormData` gives you `"on"` for a checked box and `null` for an
unchecked one, and comparing `null === false` fails in the direction that silently lets a form through.
Convert at the boundary — `data.get('terms') === 'on'` — and validate a real shape.

---

## 5. Pass 1 — the row (search bar, 6 minutes)

```html
<label for="q">Search</label>
<div class="search__row">
  <input id="q" type="search" placeholder="Search pages, spaces and people">
  <button type="submit">Search</button>
</div>
```

```css
.search__row   { display: flex; gap: 8px; }
.search__field { flex: 1 1 auto; min-width: 0; min-height: 44px; }
.search__submit{ flex: 0 0 auto; white-space: nowrap; min-height: 44px; }
```

**Why `min-width: 0` is the graded line.** A flex item's `min-width` computes to `auto`, which means "at
least my content". A long placeholder or a long word therefore sets a floor the item refuses to go below,
the row overflows its container, and the button leaves the screen. `min-width: 0` removes the floor. The
same line reappears in the article task and in the holy grail, for the same reason.

Demonstrate at 320px: still one row, label still there, focus ring visible.

---

## 6. Pass 2 — the page skeletons (article + holy grail, 10 minutes)

```css
/* article: a fixed share of the viewport beside a fluid column */
.art        { display: flex; gap: 24px; align-items: flex-start; }
.art__media { flex: 0 0 30vw; max-width: 30vw; }
.art__body  { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.art__media img { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; }

/* holy grail: the whole page as one picture */
.hg {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: 200px 1fr 180px;
  grid-template-rows: auto 1fr auto;     /* the middle row absorbs the slack → sticky footer */
  grid-template-areas: "head head head" "nav main aside" "foot foot foot";
}
```

Three things to say while typing:

- `width: 30vw` **alone does not hold**: `flex-shrink` defaults to `1`, so the moment the row is tight the
  image gives up width. `flex: 0 0 30vw` is basis plus a refusal to shrink. Measured in the demo: 270px in
  a 900px frame, exactly 0.30.
- `aspect-ratio` **is the layout-shift fix**: the box is the right size before the image decodes, so the
  paragraph next to it never jumps. Width/height attributes on the `<img>` do the same job for the
  intrinsic case; keep both.
- `grid-template-areas` lets `main` come **first in the DOM** and still sit in the middle of the screen.
  That is the whole accessibility argument for grid over floats: tab order follows the DOM, the picture
  follows the areas. Verified in the demo: `main` is the second child, `nav` paints to its left.

Sticky footer, stated properly: the footer is not pushed down by anything. The middle row is `1fr`, so it
takes every pixel the header and footer do not, and on a short page that pixel count is "the rest of the
viewport". `100dvh` rather than `100vh` because the mobile toolbar is part of `vh` and the footer would sit
under it.

---

## 7. Pass 3 — the states (header, overlay, 10 minutes)

### The ladder — collapsing a nav without JavaScript

| Rung | Mechanism | Keyboard | Announces state | Cost |
| --- | --- | --- | --- | --- |
| V0 | links always visible, wrap to a second row | fine | n/a | looks unfinished at 320px |
| V1 | `<div class="burger" onclick>` + a class | **not focusable, no role** | no | you rebuild `button` badly |
| V2 | checkbox hack: `input:checked ~ nav` | focusable | reads as a checkbox | a lie in the accessibility tree |
| V3 | **`<details><summary>`** | focusable, Enter/Space | **yes, natively** | two lines of media query |

V3 ships. It is the only rung where the disclosure semantics are real rather than imitated, and it costs
less code than the other three.

**Two traps worth knowing:**

```css
.hdr__toggle {
  display: list-item;   /* NOT flex/inline-flex */
  list-style: none;     /* removes the triangle without touching display */
}

@media (min-width: 640px) {         /* desktop: no toggle, links inline */
  .hdr__toggle { display: none; }
  .hdr__menu:not([open]) > .hdr__nav { display: block; }          /* legacy engines */
  .hdr__menu::details-content { content-visibility: visible; block-size: auto; }  /* current Chrome */
}
```

1. A `display` other than `list-item` on `<summary>` **drops the disclosure marker**. Current Chrome still
   toggles — test it before repeating the folklore — but engines have broken the toggle itself here in the
   past, and the marker loss alone is enough reason to leave `display` alone. Style the box, keep
   `display: list-item`, remove the triangle with `list-style: none`, and wrap the contents in a span if
   they need their own layout.
2. A closed `<details>` hides its content, so a desktop layout that shows the links inline has to
   *un*-hide it. Chrome now does that hiding through `::details-content` with `content-visibility`, other
   engines through a `display: none` rule on the non-summary children. Write both.

### Hover that is not hover-only

```css
.card__overlay { opacity: 0; transform: translateY(12px);
                 transition: opacity .18s ease, transform .18s ease; }   /* never `all` */
.card__link:hover  .card__overlay,
.card:focus-within .card__overlay { opacity: 1; transform: none; }
@media (hover: none)              { .card__overlay { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .card__overlay { transition: none; } }
```

`:focus-within` on the card, not `:focus` on the link, because the overlay may contain its own focusable
things later. `@media (hover: none)` exists because on touch the first tap only fires a synthetic hover:
without it, the caption appears on tap one and the link opens on tap two, which reads as a broken link.

---

## 8. Pass 4 — the form nobody gets right (8 minutes)

The task arrives as working code with three defects: errors on load, errors not announced, and a confirm
field that passes when it should not.

```css
/* WRONG: paints every empty required field red before anyone has typed */
input:invalid { border-color: red; }

/* RIGHT: the state is set by the script, only after a real attempt */
input[aria-invalid="true"] { border-color: var(--danger); }
```

`:user-invalid` is the native version of the same idea (it waits for interaction) and is worth naming;
driving it from `aria-invalid` gets the announcement for free at the same time.

```js
function paint() {
  const errors = formErrors(read());               // the whole form, every time
  for (const name of FIELDS) {
    const input = form.elements[name];
    const message = errors[name] || '';
    document.getElementById(name + '-err').textContent = message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', name + '-err');
    } else {
      input.removeAttribute('aria-invalid');       // cleared, not left behind
      input.removeAttribute('aria-describedby');
    }
  }
  return errors;
}
```

**Why the whole form and not the blurred field.** `confirm` is not a property of `confirm` — it is a
relationship between two fields. Validate it in its own blur handler against a captured password and the
classic bug appears: type a matching pair, go back and change the password, and the stale comparison still
says "match". Re-deriving from the current values makes that impossible. The check file pins it:
`formErrors({ ...valid, password: 'brand-new-p4ss' }).confirm === 'Passwords do not match.'`

On submit: `preventDefault`, paint, focus the **first** invalid field, and put a count in a `role="status"`
line. `novalidate` on the form because the native bubble cannot be styled, shows one error at a time and
vanishes on scroll.

---

## 9. Pass 5 — the banner (6 minutes)

```css
.cc {
  position: fixed; inset: auto 0 0 0; z-index: 100;
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
}
body:has(.cc:not([hidden])) { padding-bottom: 120px; }
@media (min-width: 640px) { body:has(.cc:not([hidden])) { padding-bottom: 84px; } }
```

- **Reserve the space.** A fixed banner paints over the end of the page; `:has()` lets the page pad itself
  for exactly as long as the banner is up, with no JavaScript and no measurement.
- **`env(safe-area-inset-bottom)`** or the buttons sit under the home indicator on a phone.
- **Equal buttons.** Refusing must be as easy as accepting: same size, same weight, same row. A reject
  styled as a quiet link is a compliance finding, and interviewers who work on consent flows notice.
- **A region, not a dialog.** Move focus to it on show (`tabindex="-1"` + `.focus()`), leave the tab order
  alone, and on dismiss move focus somewhere real — never leave it on the element you just hid.

```js
const store = {
  read() { try { return localStorage.getItem(KEY); } catch { durable = false; return memory; } },
  write(v) { memory = v; try { localStorage.setItem(KEY, v); } catch { durable = false; } },
};
```

Storage access **throws** in a sandboxed frame and in some private modes — not returns null, throws. Wrap
every call, fall back to memory, and tell the user the truth ("this choice lasts until reload"). The demo
here runs in exactly that situation, so the fallback is visible rather than theoretical.

---

## 10. The single-file version — what you actually type

One file per task. This is the header, the hardest of the seven, complete:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Responsive header</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; }
  body { font: 14px/1.5 system-ui, sans-serif; background: #f3f4f8; color: #1a1c22; }
  :focus-visible { outline: 2px solid #3b5bdb; outline-offset: 2px; }

  .hdr { display: flex; align-items: center; gap: 16px; padding: 10px 16px;
         background: #fff; border-bottom: 1px solid #d7dae2; }
  .hdr__logo { font-weight: 700; text-decoration: none; color: inherit; }
  .hdr__menu { flex: 1 1 auto; min-width: 0; }

  /* Keep display: list-item — changing it drops the disclosure marker. */
  /* display stays list-item: changing it drops the disclosure marker. */
  .hdr__toggle { display: list-item; list-style: none; width: max-content;
                 min-height: 40px; padding: 9px 10px;
                 border: 1px solid #d7dae2; border-radius: 8px; cursor: pointer; }
  .hdr__toggle::-webkit-details-marker { display: none; }

  .hdr__nav ul { display: flex; flex-direction: column; gap: 2px; list-style: none; padding: 8px 0 0; }
  .hdr__nav a { display: block; padding: 8px 10px; border-radius: 6px;
                color: inherit; text-decoration: none; }
  .hdr__nav a:hover { background: #f3f4f8; }

  .hdr__cta { flex: 0 0 auto; display: inline-flex; align-items: center;
              min-height: 40px; padding: 0 14px; border-radius: 8px;
              background: #3b5bdb; color: #fff; text-decoration: none; font-weight: 600; }

  /* Desktop: hide the toggle, force the closed panel open. Both rules, two engines. */
  @media (min-width: 640px) {
    .hdr__toggle { display: none; }
    .hdr__menu:not([open]) > .hdr__nav { display: block; }
    .hdr__menu::details-content { content-visibility: visible; block-size: auto; }
    .hdr__nav ul { flex-direction: row; padding: 0; gap: 4px; }
  }

  /* Mobile: the open panel drops under the bar instead of squeezing into it. */
  @media (max-width: 639px) {
    .hdr { flex-wrap: wrap; }
    .hdr__menu { flex: 0 0 auto; order: 2; }
    .hdr__logo { flex: 1 1 auto; }
    .hdr__menu[open] > .hdr__nav {
      position: absolute; left: 0; right: 0;
      background: #fff; border-bottom: 1px solid #d7dae2; padding: 8px 12px 12px;
    }
  }

  .page { padding: 24px 16px; }
</style>
</head>
<body>
  <header class="hdr">
    <a class="hdr__logo" href="#">&#9650; Atlas</a>

    <details class="hdr__menu">
      <summary class="hdr__toggle">Menu</summary>
      <nav class="hdr__nav" aria-label="Main">
        <ul>
          <li><a href="#">Work</a></li>
          <li><a href="#">Projects</a></li>
          <li><a href="#">Goals</a></li>
          <li><a href="#">Teams</a></li>
        </ul>
      </nav>
    </details>

    <a class="hdr__cta" href="#">Sign in</a>
  </header>

  <main class="page">
    <h1>Your work</h1>
    <p>The links collapse behind the toggle under 640px.</p>
  </main>
</body>
</html>
```

**Build it in this order:** semantic markup first (header, details/summary, nav, list, links) → the desktop
row with flex and `gap` → the media query that hides the toggle and re-shows the panel → the mobile
dropdown → focus ring and touch targets. The other six tasks are in `constants/tasks.ts`, each complete and
runnable.

Narrate two lines while typing: `display: list-item` on the summary (*"anything else loses the disclosure
marker"*) and the pair of desktop rules (*"a closed details hides its content, so the desktop layout
has to un-hide it — one rule per engine"*).

---

## 11. Verification

```bash
node src/projects/karat-html-css/utils/css-tasks.check.ts
```

Asserts `formErrors` (empty form, whitespace name, four email shapes, length and digit rules, both
directions of the stale-confirm bug, terms), that every task's document is standards-mode with a viewport
meta and carries its own markup and styles, that a script is emitted only for the tasks that have one, that
the validator is injected into the form task and **only** that one, that its source is self-contained and
parses on its own, and that `clampWidth` holds its floor and ceiling.

Demo script, per task:

1. **Search bar** — drag to 320px: one row, button intact, label present.
2. **Header** — 900px: links inline, no toggle. 375px: toggle appears, opens on Enter, panel drops under
   the bar. (Measured here: summary `tabIndex` 0, `details.open` flips on click.)
3. **Article** — the image column measures exactly 0.30 × the frame (270px at 900px), the unbroken URL
   wraps, and `document.scrollWidth === innerWidth`: nothing overflows.
4. **Holy grail** — side columns 200px and 180px, centre fluid, footer bottom exactly at the viewport
   height on a short page, `main` first in the DOM and second on screen.
5. **Hover overlay** — focus the first card with the keyboard: its overlay goes to opacity 1 while the
   second stays at 0.
6. **Form** — nothing red on load; submit empty → 5 fields marked, focus on `name`, each message linked by
   `aria-describedby`; fill a matching pair, then change the password → confirm goes invalid again; fix it
   → `Account created.`, zero `aria-invalid` left behind.
7. **Banner** — page padding reserved (84px desktop / 120px mobile) so the last line stays above the bar,
   focus lands on the region, accept hides it and moves focus to a real control, reset brings it back.

---

## 12. Cross-questions and answers

**"Why `<details>` instead of a button and a class?"** Because the button version is three attributes and
two event listeners away from correct (`aria-expanded`, `aria-controls`, Enter, Space, Escape), and the
disclosure ships all of it. In a component library with an existing Disclosure primitive, use that instead.

**"When does grid beat flex?"** Flex lays out one axis and the children decide their sizes; grid defines
the tracks first and places children into them. A toolbar row is flex. A page skeleton where the rows and
columns must line up across sections is grid — and `grid-template-areas` is also the only version of the
layout a reviewer can read at a glance.

**"Container queries?"** For a component reused in a sidebar and in a main column, yes: the media query
asks the viewport a question about a box it does not contain. `container-type: inline-size` plus
`@container (min-width: …)`. These seven tasks are page-level, so media queries are honest.

**"How do you pick breakpoints?"** By resizing until the content breaks. 640 is where four links plus a
logo plus a CTA stop fitting at this type size, not because a phone is 640.

**"`rem` or `px`?"** `rem` for type and anything that should grow when someone raises their browser font
size; `px` for hairlines and for things that must stay pixel-exact. A layout that breaks at 200% zoom is a
WCAG 1.4.4 failure, so check it once.

**"Dark mode?"** Tokens on `:root`, redefined under `prefers-color-scheme: dark`, and `color-scheme` set so
form controls and scrollbars follow. Never a second stylesheet.

**"How do you test CSS?"** The logic under it with a unit test (`formErrors` here), the layout with a
snapshot of computed geometry — the same measurements as the demo script above: a column's width ratio, the
footer's bottom against the viewport, `scrollWidth === innerWidth` for "nothing overflows". Visual
regression (Playwright screenshots) on top of that, not instead of it.

**"What would you add with more time?"** For the banner: a proper preferences dialog behind "Manage", and
the consent state exposed so analytics can start without a reload. For the header: `aria-current` on the
active link. For the form: server-side validation, since everything here is a convenience for the person
typing, not a guarantee.
