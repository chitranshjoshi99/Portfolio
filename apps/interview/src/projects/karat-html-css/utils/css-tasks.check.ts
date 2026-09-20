/**
 * node src/projects/karat-html-css/utils/css-tasks.check.ts
 * The CSS is graded by eye; the validator and the document assembly are the parts a test can hold.
 */
import assert from 'node:assert/strict';
import { TASKS } from '../constants/tasks.ts';
import type { FormValues } from '../karat-html-css.types.ts';
import { buildDoc, clampWidth, formErrors } from './css-tasks.utils.ts';

const valid: FormValues = {
  name: 'Priya',
  email: 'priya@example.com',
  password: 'correct-horse-9',
  confirm: 'correct-horse-9',
  terms: true,
};
const withValues = (patch: Partial<FormValues>): FormValues => ({ ...valid, ...patch });

// --- formErrors -----------------------------------------------------------
assert.deepEqual(formErrors(valid), {}, 'a complete form has no errors');

const empty = formErrors({ name: '', email: '', password: '', confirm: '', terms: false });
assert.deepEqual(Object.keys(empty).sort(), ['confirm', 'email', 'name', 'password', 'terms']);
assert.equal(formErrors(withValues({ name: '   ' })).name, 'Enter your name.', 'whitespace is not a name');

assert.ok(formErrors(withValues({ email: 'priya@example' })).email, 'no TLD');
assert.ok(formErrors(withValues({ email: 'priya example.com' })).email, 'no @');
assert.ok(formErrors(withValues({ email: 'a@b.co' })).email === undefined, 'two-letter TLD is fine');
assert.ok(formErrors(withValues({ email: '  priya@example.com  ' })).email === undefined, 'trimmed before testing');

assert.ok(formErrors(withValues({ password: 'short1', confirm: 'short1' })).password, 'under 8');
assert.ok(formErrors(withValues({ password: 'letters-only', confirm: 'letters-only' })).password, 'no digit');

// The bug the task is about: confirm is judged against the password being submitted.
assert.equal(formErrors(withValues({ confirm: 'correct-horse-8' })).confirm, 'Passwords do not match.');
assert.equal(formErrors(withValues({ password: 'brand-new-p4ss' })).confirm, 'Passwords do not match.',
  'changing the password invalidates a confirm that used to match');
assert.equal(formErrors(withValues({ confirm: '' })).confirm, 'Repeat your password.');
assert.ok(formErrors(withValues({ terms: false })).terms, 'terms are required');

// --- buildDoc -------------------------------------------------------------
for (const task of TASKS) {
  const doc = buildDoc(task);
  assert.ok(doc.startsWith('<!doctype html>'), `${task.id}: standards mode`);
  assert.ok(doc.includes('name="viewport"'), `${task.id}: a responsive demo needs the viewport meta`);
  assert.ok(doc.includes(task.html), `${task.id}: markup present`);
  assert.ok(doc.includes(task.css), `${task.id}: styles present`);
  assert.ok(doc.includes('box-sizing: border-box'), `${task.id}: base reset present`);
  assert.equal(doc.includes('<script>'), Boolean(task.js), `${task.id}: script only when the task has one`);
  assert.ok(!doc.includes('</script>\n'.slice(0, 9) + '>'), `${task.id}: no stray closing tag`);
  assert.ok(task.widths.length > 0 && task.traps.length >= 4, `${task.id}: widths and traps filled in`);
}

const form = TASKS.find((task) => task.id === 'form-validation')!;
const formDoc = buildDoc(form);
assert.ok(formDoc.includes('const formErrors ='), 'the validator is injected, not re-written by hand');
assert.ok(formDoc.includes('Passwords do not match.'), 'and it is the same source this file just tested');
assert.ok(!buildDoc(TASKS[0]).includes('const formErrors ='), 'only the task that asks for it gets it');

// The injected copy has to stand on its own inside the frame: no outer references.
const source = formErrors.toString();
for (const forbidden of ['import', 'require(', 'TASKS', 'BASE_CSS']) {
  assert.ok(!source.includes(forbidden), `validator must be self-contained (found ${forbidden})`);
}
assert.doesNotThrow(() => new Function(`return (${source})`)(), 'validator source parses on its own');
assert.deepEqual((new Function(`return (${source})`)() as typeof formErrors)(valid), {},
  'the injected copy behaves like the imported one');

// --- clampWidth -----------------------------------------------------------
assert.equal(clampWidth(900, 1400), 900);
assert.equal(clampWidth(900, 600), 600, 'never wider than the pane');
assert.equal(clampWidth(100, 1400), 280, 'never narrower than a phone');
assert.equal(clampWidth(900, 120), 280, 'a tiny pane still renders a phone-width frame');
assert.equal(clampWidth(5000, 4000), 1280, 'capped at the widest breakpoint worth showing');

console.log('karat-html-css: all checks passed');
