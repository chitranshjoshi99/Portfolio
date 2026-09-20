import type { CssTask, FormErrors, FormValues } from '../karat-html-css.types.ts';

/**
 * Validation for the "fix the broken form" task.
 *
 * Self-contained on purpose: its own source is stringified into the demo document, so it must not
 * reference anything outside its own body (no imported constants, no helpers) or the copy that runs
 * inside the iframe would throw on a name the iframe has never heard of.
 */
export function formErrors(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = 'Enter your name.';

  const email = values.email.trim();
  if (!email) errors.email = 'Enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Use the form name@example.com.';

  if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (!/\d/.test(values.password)) errors.password = 'Include at least one number.';

  // Compared to the value being submitted, never to a copy captured when the field was last blurred.
  if (!values.confirm) errors.confirm = 'Repeat your password.';
  else if (values.confirm !== values.password) errors.confirm = 'Passwords do not match.';

  if (!values.terms) errors.terms = 'Accept the terms to continue.';
  return errors;
}

/** Reset + neutral page chrome shared by every demo document, so each task's CSS is only its own idea. */
const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
:root {
  color-scheme: light dark;
  --ink: #1a1c22; --dim: #5b6070; --line: #d7dae2; --paper: #ffffff; --ground: #f3f4f8;
  --brand: #3b5bdb; --danger: #c92a2a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #e6e8ee; --dim: #9aa0b0; --line: #333846; --paper: #1b1e26; --ground: #14161c;
    --brand: #91a7ff; --danger: #ff8787;
  }
}
body { background: var(--ground); color: var(--ink); font-size: 14px; line-height: 1.5; }
img { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
`;

/**
 * The demo document. One string, no bundler, no framework: exactly the blank file the round starts
 * from. Rendered through `srcdoc` in a sandboxed iframe so a task's CSS can never reach this app.
 */
export function buildDoc(task: CssTask): string {
  const script = task.needsValidator
    ? `const formErrors = ${formErrors.toString()};\n${task.js ?? ''}`
    : task.js ?? '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${task.title}</title>
<style>${BASE_CSS}${task.css}</style>
</head>
<body>
${task.html}
${script ? `<script>${script}<\/script>` : ''}
</body>
</html>`;
}

/** A page-relative anchor the demo can reach: the parent's URL would navigate the whole app. */
export const DEMO_MIN_WIDTH = 280;
export const DEMO_MAX_WIDTH = 1280;

/** Clamp a dragged width so the preview can never be narrower than a phone or wider than the pane. */
export function clampWidth(width: number, available: number): number {
  const ceiling = Math.min(DEMO_MAX_WIDTH, Math.max(DEMO_MIN_WIDTH, Math.floor(available)));
  return Math.max(DEMO_MIN_WIDTH, Math.min(Math.round(width), ceiling));
}
