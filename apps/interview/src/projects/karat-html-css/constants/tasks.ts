import type { CssTask } from '../karat-html-css.types';

/**
 * The HTML/CSS half of the Karat screen: a blank file, a screenshot, and 15 minutes per task.
 * Every task here is one that has been reported, written the way it should be handed back.
 */
export const TASKS: CssTask[] = [
  {
    id: 'search-bar',
    title: 'Search bar + button',
    prompt:
      'Build a search input with a button next to it, to a list of constraints: one row, the input at least twice the width of the button, the two flush with no gap between them, and the button never wrapping or shrinking.',
    reported: 'Karat screen, most frequently reported HTML/CSS warm-up',
    checks: [
      'one row at every width, button never wraps under the input',
      'the input grows, the button keeps its label on one line',
      'flush: one shared border between them, no gap',
      'the input stays at least twice the button (flex-grow does it, no magic numbers)',
      'label associated with the field, not a placeholder standing in for it',
      'visible focus ring and a 44px touch target',
    ],
    traps: [
      'flex item with no min-width: 0 refuses to shrink below its content, so a long placeholder pushes the button off-screen',
      'flex: 1 on the button too — now both share the space and the label wraps',
      'placeholder as the only label: it disappears on typing and screen readers get nothing (use a label, visually hidden if the design demands it)',
      'float / inline-block + white-space fiddling — this is a one-line flex row',
      'outline: none with no replacement kills the only keyboard affordance',
    ],
    widths: [520, 320],
    html: `<form class="search" role="search" action="#">
  <label class="search__label" for="q">Search</label>
  <div class="search__row">
    <input id="q" class="search__field" type="search" name="q"
           placeholder="Search pages, spaces and people" autocomplete="off">
    <button class="search__submit" type="submit">Search</button>
  </div>
</form>`,
    css: `
.search { padding: 24px; }
.search__label { display: block; font-size: 12px; font-weight: 600; color: var(--dim);
  letter-spacing: .04em; text-transform: uppercase; margin-bottom: 6px; }

.search__row {
  display: flex;
  /* Flush, as asked: no gap, and the button's left border doubles as the seam. */
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--paper);
}
.search__row:focus-within { border-color: var(--brand); }

.search__field {
  flex: 1 1 auto;     /* takes the leftover width — with a 0 basis it always outgrows the button */
  min-width: 0;       /* ...and is allowed to give it back: without this the row overflows */
  flex-basis: 0;
  min-height: 44px;   /* touch target */
  padding: 0 12px;
  background: transparent;
  border: 0;
  color: inherit;
}
/* Its own focus ring: this snippet has to stand on its own when it is copied out. */
.search__field:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }

.search__submit {
  flex: 0 0 auto;         /* never shrink, never grow */
  white-space: nowrap;    /* "Search" stays on one line */
  min-height: 44px;
  padding: 0 18px;
  background: var(--brand);
  color: #fff;
  border: 0;
  border-left: 1px solid var(--line);   /* the seam, since the two are flush */
  font-weight: 600;
  cursor: pointer;
}
.search__submit:focus-visible { outline: 2px solid var(--ink); outline-offset: -3px; }`,
  },

  {
    id: 'responsive-header',
    title: 'Responsive header',
    prompt: 'A header with a logo, navigation links and a sign-in button. On a phone the links collapse behind a menu toggle. No JavaScript.',
    reported: 'Karat screen and the 30-minute CSS round: "make this header responsive"',
    checks: [
      'one row on desktop: logo left, nav centre, action right',
      'under 640px the links collapse behind a toggle that actually opens',
      'the toggle is keyboard operable and announces its state',
      'nothing overflows at 320px',
    ],
    traps: [
      '<details> content is hidden by the user agent when closed, so the desktop media query has to re-show it — both the legacy `details:not([open]) > *` rule and the modern `::details-content` (content-visibility) one',
      'a display other than list-item on <summary> drops the disclosure marker (the triangle). Current Chrome still toggles, but engines have historically broken the toggle here, so the safe recipe is keep display: list-item, remove the marker deliberately, and wrap the contents if they need their own layout',
      'a div + click handler for the toggle: no role, no aria-expanded, not focusable. <details>/<summary> ships all three',
      'display: none on the nav at mobile removes it from the tab order with no way back — that is the point of the disclosure',
      'justify-content: space-between with no gap: at 700px the logo and the first link touch',
      'a fixed header without padding on the body hides the first paragraph of the page',
    ],
    widths: [900, 375],
    html: `<header class="hdr">
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
  <p>Resize the preview: the links collapse behind the toggle under 640px.</p>
</main>`,
    css: `
.hdr {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}
.hdr__logo { font-weight: 700; text-decoration: none; color: inherit; }
.hdr__menu { flex: 1 1 auto; min-width: 0; }

.hdr__toggle {
  /* Keep display: list-item. Changing it removes the disclosure marker, and engines have broken the
     toggle itself here before now — style the box instead, and wrap the contents if they need a
     layout of their own. list-style: none removes the triangle without touching display. */
  display: list-item;
  list-style: none;                    /* no triangle */
  width: max-content;
  min-height: 40px; padding: 9px 10px;
  border: 1px solid var(--line); border-radius: 8px;
  cursor: pointer;
}
.hdr__toggle::-webkit-details-marker { display: none; }

.hdr__nav ul { display: flex; flex-direction: column; gap: 2px; list-style: none; padding: 8px 0 0; }
.hdr__nav a {
  display: block; padding: 8px 10px; border-radius: 6px;
  color: inherit; text-decoration: none;
}
.hdr__nav a:hover { background: var(--ground); }

.hdr__cta {
  flex: 0 0 auto;
  min-height: 40px; display: inline-flex; align-items: center; padding: 0 14px;
  background: var(--brand); color: #fff; border-radius: 8px;
  text-decoration: none; font-weight: 600;
}

/* Desktop: no toggle, links inline. Both rules are needed — the second is how current Chrome
   hides closed <details> content, the first is how every other engine does. */
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
  .hdr__menu[open] > .hdr__nav {
    position: absolute; left: 0; right: 0;
    background: var(--paper); border-bottom: 1px solid var(--line);
    padding: 8px 12px 12px;
  }
  .hdr__logo { flex: 1 1 auto; }
}

.page { padding: 24px 16px; color: var(--dim); }
.page h1 { color: var(--ink); font-size: 20px; margin-bottom: 6px; }`,
  },

  {
    id: 'article-image',
    title: 'Article: 30vw image, text beside it',
    prompt: 'An article with an image fixed at 30% of the viewport width on the left and the text filling the rest. Below 700px the image goes full width above the text.',
    reported: 'Karat screen, reported verbatim as "image should be 30vw"',
    checks: [
      'the image column measures 30vw at every desktop width',
      'text wraps in the remaining space, long URLs included',
      'no layout shift while the image loads',
      'single column under 700px with the image first',
    ],
    traps: [
      'width: 30vw on a flex item still shrinks — flex-shrink defaults to 1. Write flex: 0 0 30vw',
      'the text column without min-width: 0 cannot wrap an unbroken string, so the row overflows and the image is squeezed',
      'vw includes the scrollbar, so 100vw-wide children overflow by ~15px on desktop Windows',
      'no width/height or aspect-ratio on the image: the text reflows when it loads (CLS)',
      'a percentage instead of vw measures the parent, which is a different number the moment the layout is nested',
    ],
    widths: [900, 640],
    html: `<article class="art">
  <figure class="art__media">
    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%233b5bdb'/%3E%3Ccircle cx='300' cy='80' r='46' fill='%23ffd43b'/%3E%3Cpath d='M0 300 L150 140 L260 300Z' fill='%231864ab'/%3E%3Cpath d='M180 300 L300 170 L400 300Z' fill='%231098ad'/%3E%3C/svg%3E"
         width="400" height="300" alt="Illustration of two peaks under a low sun">
    <figcaption>Fig 1. The column stays at 30vw.</figcaption>
  </figure>

  <div class="art__body">
    <h1>Shipping a layout that survives a paste</h1>
    <p>The image column is a fixed share of the viewport; this column takes whatever is left and
      wraps inside it, including a link nobody shortened:
      <a href="#">https://example.atlassian.net/wiki/spaces/ENG/pages/98213/postmortem-2026-03-11</a>.</p>
    <p>Resize the preview and the proportion holds, because the column is sized against the
      viewport rather than against whatever the parent happens to be this week.</p>
  </div>
</article>`,
    css: `
.art {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  padding: 24px;
  background: var(--paper);
}

.art__media {
  flex: 0 0 30vw;   /* basis AND no shrink — width alone would collapse */
  max-width: 30vw;
}
.art__media img {
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 3;   /* space reserved before the bytes arrive */
  object-fit: cover;
  border-radius: 10px;
}
.art__media figcaption { margin-top: 6px; font-size: 12px; color: var(--dim); }

.art__body {
  flex: 1 1 auto;
  min-width: 0;             /* lets the column wrap instead of overflowing the row */
  overflow-wrap: anywhere;  /* the unbroken URL */
  display: flex; flex-direction: column; gap: 10px;
}
.art__body h1 { font-size: 20px; }
.art__body a { color: var(--brand); }

@media (max-width: 700px) {
  .art { flex-direction: column; }
  .art__media { flex: 0 0 auto; max-width: none; width: 100%; }
}`,
  },

  {
    id: 'holy-grail',
    title: 'Holy grail layout',
    prompt: 'Header, footer, a fixed-width left navigation, a fixed-width right sidebar and a fluid centre. The footer sits at the bottom even when the page is short.',
    reported: 'Karat screen and the CSS round: "holy grail, sticky footer, no JS"',
    checks: [
      'centre column takes all leftover width, side columns hold their width',
      'footer at the bottom of the viewport on a short page, pushed down on a long one',
      'main comes first in the DOM so it comes first in the tab order',
      'one column under 800px, in reading order',
    ],
    traps: [
      'min-height: 100vh on mobile Safari includes the toolbar, so the footer hides under it — 100dvh',
      'a sticky footer built from margin-top: auto or absolute positioning breaks the moment the content grows; grid-template-rows: auto 1fr auto just works',
      'nav written before main in the DOM to get it on the left: keyboard users then tab the whole menu before the content. Place it with grid-area instead',
      'no min-width: 0 on main, so one wide table stretches the centre column and the layout loses its proportions',
      'float-based columns: no equal heights, and clearfix is not an answer in 2026',
    ],
    widths: [960, 420],
    html: `<div class="hg">
  <header class="hg__head">Header</header>
  <main class="hg__main">
    <h1>Main content</h1>
    <p>First in the DOM, second on the screen. Grid puts it where the design wants it without
      making keyboard users walk past the navigation to reach it.</p>
    <p>The footer stays at the bottom on a short page because the middle row is the one that
      absorbs the leftover height.</p>
  </main>
  <nav class="hg__nav" aria-label="Sections">Nav<br>200px</nav>
  <aside class="hg__aside">Aside<br>180px</aside>
  <footer class="hg__foot">Footer</footer>
</div>`,
    css: `
.hg {
  display: grid;
  min-height: 100dvh;                       /* not 100vh: mobile toolbars */
  grid-template-columns: 200px 1fr 180px;
  grid-template-rows: auto 1fr auto;        /* middle row eats the slack — the sticky footer */
  grid-template-areas:
    "head head  head"
    "nav  main  aside"
    "foot foot  foot";
  gap: 1px;
  background: var(--line);                  /* the gap becomes the rule lines */
}

.hg > * { background: var(--paper); padding: 16px; }
.hg__head { grid-area: head; font-weight: 700; }
.hg__nav  { grid-area: nav; color: var(--dim); }
.hg__aside{ grid-area: aside; color: var(--dim); }
.hg__foot { grid-area: foot; color: var(--dim); }
.hg__main {
  grid-area: main;
  min-width: 0;   /* a wide table must scroll, not stretch the column */
}
.hg__main h1 { font-size: 20px; margin-bottom: 8px; }
.hg__main p + p { margin-top: 8px; }

@media (max-width: 800px) {
  .hg {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto auto;
    grid-template-areas: "head" "nav" "main" "aside" "foot";
  }
}`,
  },

  {
    id: 'hover-overlay',
    title: 'Image card with hover overlay',
    prompt: 'A grid of image cards. Hovering a card slides a caption over the image. It must also work for keyboard and touch.',
    reported: 'Karat screen: "show the text on hover over the image"',
    checks: [
      'overlay animates in on hover and on keyboard focus',
      'on a touch device the caption is simply visible — there is no hover to wait for',
      'the whole card is one link, not a link inside a link',
      'animation respected against prefers-reduced-motion',
    ],
    traps: [
      ':hover only — a keyboard user never sees the caption. Pair it with :focus-within',
      'on touch, the first tap fires a synthetic hover and the second one activates the link: use @media (hover: none) to show it outright',
      'opacity: 0 leaves the text in the accessibility tree and focusable; visibility or clip it too if it must really be hidden',
      'transition: all — animates layout properties as well; transition opacity and transform only',
      'text over an image without a scrim fails contrast on a light photo',
    ],
    widths: [720, 360],
    html: `<ul class="cards">
  <li class="card">
    <a class="card__link" href="#">
      <img class="card__img" alt=""
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 220'%3E%3Crect width='300' height='220' fill='%231098ad'/%3E%3Ccircle cx='230' cy='60' r='34' fill='%23ffe066'/%3E%3Cpath d='M0 220 L110 110 L200 220Z' fill='%230b7285'/%3E%3C/svg%3E">
      <span class="card__overlay">
        <span class="card__title">Sprint 42 retro</span>
        <span class="card__meta">12 actions &middot; 3 owners</span>
      </span>
    </a>
  </li>
  <li class="card">
    <a class="card__link" href="#">
      <img class="card__img" alt=""
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 220'%3E%3Crect width='300' height='220' fill='%235f3dc4'/%3E%3Crect x='40' y='120' width='60' height='100' fill='%23d0bfff'/%3E%3Crect x='120' y='70' width='60' height='150' fill='%239775fa'/%3E%3Crect x='200' y='40' width='60' height='180' fill='%23e5dbff'/%3E%3C/svg%3E">
      <span class="card__overlay">
        <span class="card__title">Velocity report</span>
        <span class="card__meta">Updated 2 hours ago</span>
      </span>
    </a>
  </li>
</ul>`,
    css: `
.cards {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 24px;
}

.card__link {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 12px;
  text-decoration: none;
  color: #fff;
}
.card__img { width: 100%; height: auto; aspect-ratio: 15 / 11; object-fit: cover; }

.card__overlay {
  position: absolute; inset: auto 0 0 0;
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px 14px;
  /* a scrim, so the text is legible whatever the image does */
  background: linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.35) 70%, transparent);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity .18s ease, transform .18s ease;   /* not "all" */
}
.card__title { font-weight: 600; }
.card__meta { font-size: 12px; opacity: .85; }

.card__link:hover .card__overlay,
.card__link:focus-visible .card__overlay,
.card:focus-within .card__overlay { opacity: 1; transform: none; }

/* No hover to wait for: show it. */
@media (hover: none) {
  .card__overlay { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .card__overlay { transition: none; }
}`,
  },

  {
    id: 'form-validation',
    title: 'Fix the broken form validation',
    prompt: 'Here is a sign-up form. The errors fire before anyone has typed, the messages are not read out, and the confirm-password check passes when it should not. Fix it.',
    reported: 'Karat screen: a debugging task handed over as working code',
    checks: [
      'nothing is marked invalid until the field has been used or the form submitted',
      'each message is announced by a screen reader and focus lands on the first bad field',
      'confirm compares against the value being submitted, not a stale copy',
      'the red state is never the only signal',
    ],
    traps: [
      'styling :invalid straight away paints every required field red on load — use :user-invalid, or gate it behind a class the form sets on submit',
      'the message rendered next to the field with no aria-describedby: visually obvious, silent to a screen reader',
      'aria-invalid never cleared after a fix, so the field stays "invalid" once it has failed',
      'the confirm field validated in its own blur handler against a captured password value: change the password afterwards and the stale comparison still passes',
      'relying on the browser bubble (no novalidate): you cannot style it, it shows one error at a time, and it disappears on scroll',
      'colour alone for the error: WCAG 1.4.1 needs the text too',
    ],
    widths: [520, 360],
    needsValidator: true,
    html: `<form class="fm" novalidate>
  <h1 class="fm__title">Create your account</h1>

  <div class="fm__row">
    <label for="name">Name</label>
    <input id="name" name="name" autocomplete="name">
    <p class="fm__err" id="name-err"></p>
  </div>
  <div class="fm__row">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email">
    <p class="fm__err" id="email-err"></p>
  </div>
  <div class="fm__row">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="new-password">
    <p class="fm__err" id="password-err"></p>
  </div>
  <div class="fm__row">
    <label for="confirm">Repeat password</label>
    <input id="confirm" name="confirm" type="password" autocomplete="new-password">
    <p class="fm__err" id="confirm-err"></p>
  </div>
  <div class="fm__row fm__row--check">
    <input id="terms" name="terms" type="checkbox">
    <label for="terms">I accept the terms</label>
    <p class="fm__err" id="terms-err"></p>
  </div>

  <button class="fm__submit" type="submit">Create account</button>
  <p class="fm__status" role="status"></p>
</form>`,
    css: `
.fm { display: flex; flex-direction: column; gap: 14px; padding: 24px; background: var(--paper); }
.fm__title { font-size: 18px; }
.fm__row { display: flex; flex-direction: column; gap: 4px; }
.fm__row--check { flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; }
.fm label { font-size: 12px; font-weight: 600; color: var(--dim); }
.fm input:not([type="checkbox"]) {
  min-height: 40px; padding: 0 10px;
  background: var(--ground); border: 1px solid var(--line); border-radius: 8px;
}

/* The red state is driven by aria-invalid, which the script only sets after a real attempt.
   :invalid would paint every empty required field the moment the page loads. */
.fm input[aria-invalid="true"] { border-color: var(--danger); }
.fm__err { display: none; font-size: 12px; color: var(--danger); }
.fm__err::before { content: "\\26A0\\FE0E  "; }   /* the message is text, never colour alone */
.fm__err:not(:empty) { display: block; }
.fm__row--check .fm__err { flex: 1 0 100%; }

.fm__submit {
  align-self: flex-start; min-height: 40px; padding: 0 16px;
  background: var(--brand); color: #fff; border: 0; border-radius: 8px; font-weight: 600; cursor: pointer;
}
.fm__status { font-size: 12px; color: var(--dim); }`,
    js: `
const form = document.querySelector('.fm');
const status = form.querySelector('.fm__status');
const FIELDS = ['name', 'email', 'password', 'confirm', 'terms'];
let submitted = false;

function read() {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || ''),
    email: String(data.get('email') || ''),
    password: String(data.get('password') || ''),
    confirm: String(data.get('confirm') || ''),
    terms: data.get('terms') === 'on',
  };
}

function paint() {
  const errors = formErrors(read());
  for (const name of FIELDS) {
    const input = form.elements[name];
    const message = errors[name] || '';
    const slot = document.getElementById(name + '-err');
    slot.textContent = message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', name + '-err');
    } else {
      input.removeAttribute('aria-invalid');        // cleared, not left behind
      input.removeAttribute('aria-describedby');
    }
  }
  return errors;
}

// Validate a field once it has been used, and re-validate the whole form after the first submit:
// password and confirm depend on each other, so neither can be judged alone.
for (const name of FIELDS) {
  form.elements[name].addEventListener('blur', () => { if (submitted || form.elements[name].value) paint(); });
  form.elements[name].addEventListener('input', () => { if (submitted) paint(); });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  submitted = true;
  const errors = paint();
  const first = FIELDS.find((name) => errors[name]);
  if (first) {
    form.elements[first].focus();
    status.textContent = Object.keys(errors).length + ' field(s) need attention.';
    return;
  }
  status.textContent = 'Account created.';
});`,
  },

  {
    id: 'cookie-banner',
    title: 'Cookie consent banner',
    prompt: 'A consent banner fixed to the bottom of the page. Accept and reject are equally reachable, the choice sticks, and the banner must not cover the page content.',
    reported: 'Karat screen, reported alongside the header task',
    checks: [
      'pinned to the bottom, clear of the home indicator on a phone',
      'the page can still be read to its end while the banner is up',
      'accept and reject are the same size and weight',
      'the choice survives a reload; the banner is a labelled region with focus sent to it',
    ],
    traps: [
      'position: fixed covers the last paragraph of the page — reserve the space (body:has(.cc:not([hidden])) { padding-block-end: … }) or make the banner sticky in flow',
      'a reject button styled as a quiet link: under GDPR refusing must be as easy as accepting, and reviewers do look',
      'z-index: 999999 — pick a scale and keep to it, or the next overlay starts the same war',
      'localStorage throws in a sandboxed frame and in private mode: wrap it, and treat a throw as "no choice recorded"',
      'padding-bottom: 12px on a phone puts the buttons under the home indicator: add env(safe-area-inset-bottom)',
      'a banner that traps focus but is not a dialog: this one is a region, so leave the tab order alone',
    ],
    widths: [720, 375],
    html: `<main class="doc">
  <h1>Release notes</h1>
  <p>Scroll to the end: the last line stays readable because the banner's height is reserved
    on the page rather than painted over it.</p>
  <p>Consent is stored under one key. Clearing it brings the banner back.</p>
  <p class="doc__last">— end of page —</p>
  <button class="doc__reset" type="button">Clear the stored choice</button>
  <p class="doc__note" role="status"></p>
</main>

<section class="cc" role="region" aria-labelledby="cc-title" tabindex="-1" hidden>
  <div class="cc__text">
    <h2 class="cc__title" id="cc-title">Cookies</h2>
    <p>We use cookies to measure which pages get read. Analytics only, no advertising.</p>
  </div>
  <div class="cc__actions">
    <button class="cc__btn" type="button" data-choice="rejected">Reject</button>
    <button class="cc__btn cc__btn--accept" type="button" data-choice="accepted">Accept</button>
  </div>
</section>`,
    css: `
.doc { display: flex; flex-direction: column; gap: 10px; padding: 24px; background: var(--paper); min-height: 60vh; }
.doc h1 { font-size: 20px; }
.doc__last { color: var(--dim); }
.doc__reset { align-self: flex-start; min-height: 36px; padding: 0 12px;
  border: 1px solid var(--line); border-radius: 8px; background: none; cursor: pointer; }
.doc__note { font-size: 12px; color: var(--dim); }

.cc {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 100;                 /* a scale, not 999999 */
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  padding: 14px 16px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));   /* clear of the home indicator */
  background: var(--paper);
  border-top: 1px solid var(--line);
  box-shadow: 0 -8px 24px rgba(0,0,0,.14);
}
.cc__text { flex: 1 1 260px; min-width: 0; }
.cc__title { font-size: 13px; margin-bottom: 2px; }
.cc__text p { font-size: 12px; color: var(--dim); }

.cc__actions { display: flex; gap: 8px; flex: 0 0 auto; }
.cc__btn {
  min-height: 40px; padding: 0 16px;          /* same size for both: refusing is not the quiet option */
  border: 1px solid var(--line); border-radius: 8px;
  background: var(--ground); font-weight: 600; cursor: pointer;
}
.cc__btn--accept { background: var(--brand); color: #fff; border-color: transparent; }

/* Reserve the banner's space instead of painting over the page. */
body:has(.cc:not([hidden])) { padding-bottom: 120px; }
@media (min-width: 640px) { body:has(.cc:not([hidden])) { padding-bottom: 84px; } }`,
    js: `
const KEY = 'cookie-consent';
const banner = document.querySelector('.cc');
const note = document.querySelector('.doc__note');

// Storage is not guaranteed: a sandboxed frame and private mode both throw on access. Falling back
// to memory keeps the page working — the choice just does not outlive the tab.
let memory = null;
let durable = true;
const store = {
  read() { try { return localStorage.getItem(KEY); } catch { durable = false; return memory; } },
  write(value) { memory = value; try { localStorage.setItem(KEY, value); } catch { durable = false; } },
  clear() { memory = null; try { localStorage.removeItem(KEY); } catch { durable = false; } },
};

function show() {
  banner.hidden = false;
  banner.focus();   // a region, not a modal: focus moves here, the tab order stays intact
}

if (!store.read()) show();

for (const button of banner.querySelectorAll('.cc__btn')) {
  button.addEventListener('click', () => {
    store.write(button.dataset.choice);
    banner.hidden = true;
    document.querySelector('.doc__reset').focus();   // never leave focus on a removed element
    note.textContent = durable
      ? 'Choice stored: ' + button.dataset.choice
      : 'Choice kept in memory: storage is blocked in this sandboxed frame, so a reload asks again.';
  });
}

document.querySelector('.doc__reset').addEventListener('click', () => {
  store.clear();
  note.textContent = '';
  show();
});`,
  },
];
