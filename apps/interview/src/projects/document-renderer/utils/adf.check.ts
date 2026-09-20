/**
 * node src/projects/document-renderer/utils/adf.check.ts
 * The renderer is React; the parts that decide what is safe and what a document says are not.
 */
import assert from 'node:assert/strict';
import { SAMPLE_DOC } from '../constants/sample-doc.ts';
import type { DocNode } from '../document-renderer.types.ts';
import {
  collectHeadings, depthOf, documentStats, isKnownNode, parseDocument, safeHref, slugify, textOf, usableMarks, walk,
} from './adf.utils.ts';

// --- safeHref: the whole security story of a document renderer ------------
for (const ok of [
  'https://team.atlassian.net/wiki/x',
  'http://example.com',
  'mailto:sam@example.com',
  'tel:+441632960961',
  '/wiki/spaces/ENG',
  '#anchor',
  '?query=1',
]) {
  assert.ok(safeHref(ok), `should allow ${ok}`);
}

for (const bad of [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  '  javascript:alert(1)  ',
  'java\tscript:alert(1)',      // the URL parser strips the tab; a regex on the raw string does not
  'java\nscript:alert(1)',
  'jAvAsCrIpT:alert(1)',
  'data:text/html;base64,PHNjcmlwdD4=',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//evil.example.com',         // protocol-relative: inherits https and leaves the origin
  '',
  '   ',
  null,
  undefined,
  42,
]) {
  assert.equal(safeHref(bad), null, `should block ${String(bad)}`);
}
assert.equal(safeHref('/wiki/spaces/ENG'), '/wiki/spaces/ENG', 'a relative href is kept as written');
assert.ok(safeHref('https://x.test/a b')?.includes('%20'), 'absolute hrefs come back normalised');

// --- marks and unknown nodes ----------------------------------------------
assert.deepEqual(
  usableMarks([{ type: 'strong' }, { type: 'evil' }, { type: 'link', attrs: { href: '#a' } }]).map((m) => m.type),
  ['strong', 'link'],
  'unknown marks are dropped, not applied',
);
assert.deepEqual(usableMarks(undefined), []);
assert.equal(isKnownNode('paragraph'), true);
assert.equal(isKnownNode('expand'), false, 'a node nobody registered must be reported, not rendered');

// --- textOf ----------------------------------------------------------------
const para = (text: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });
assert.equal(textOf(para('hello')), 'hello');
assert.equal(
  textOf({ type: 'doc', content: [para('one'), para('two')] }),
  'one two',
  'block nodes are separated, so two paragraphs do not glue into "onetwo"',
);
assert.equal(
  textOf({ type: 'paragraph', content: [{ type: 'text', text: 'bold' }, { type: 'text', text: 'face' }] }),
  'boldface',
  'inline runs inside one paragraph are not separated',
);
assert.equal(textOf({ type: 'mention', attrs: { id: 'u1', text: '@Priya' } }), '@Priya');
assert.equal(textOf({ type: 'text' }), '', 'a text node with no text is empty, not "undefined"');

// --- headings, slugs, anchors ---------------------------------------------
const headingDoc: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Overview' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollout — phase 2' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '???' }] },
  ],
};
const headings = collectHeadings(headingDoc);
assert.deepEqual(headings.map((h) => h.id), ['overview', 'overview-2', 'rollout-phase-2', 'section'],
  'duplicate titles get distinct anchors');
assert.deepEqual(headings.map((h) => h.level), [1, 2, 2, 3]);
assert.equal(slugify('Déjà vu 2026'), 'déjà-vu-2026', 'unicode letters survive slugging');
assert.equal(slugify('---'), 'section', 'a heading of punctuation still gets an id');
assert.deepEqual(collectHeadings(para('no headings here')), []);

// --- stats -----------------------------------------------------------------
const hostile: DocNode = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'expand', attrs: { title: 'from a newer editor' }, content: [para('hidden')] },
  ],
};
const stats = documentStats(hostile);
assert.deepEqual(stats.unknown, ['expand'], 'unknown node types are surfaced');
assert.deepEqual(stats.blockedLinks, ['javascript:alert(1)']);
assert.equal(stats.words, 2, 'text from an unknown node still counts');

const sampleStats = documentStats(SAMPLE_DOC);
assert.ok(sampleStats.nodes > 30, 'the sample exercises the renderer');
assert.ok(sampleStats.unknown.length > 0, 'the sample includes a node from a newer schema on purpose');
assert.ok(sampleStats.blockedLinks.length > 0, 'and a hostile link');
assert.ok(collectHeadings(SAMPLE_DOC).length >= 3, 'and enough headings for an outline');

let visited = 0;
walk(SAMPLE_DOC, () => { visited += 1; });
assert.equal(visited, sampleStats.nodes, 'walk and stats agree on the node count');

// --- parseDocument ---------------------------------------------------------
assert.ok('doc' in parseDocument(JSON.stringify(SAMPLE_DOC)));
assert.ok('error' in parseDocument('{'), 'malformed JSON is an error, not a crash');
assert.ok('error' in parseDocument('null'));
assert.ok('error' in parseDocument('[]'), 'an array root is rejected');
assert.ok('error' in parseDocument('{"content":[]}'), 'a root with no type is rejected');
assert.match((parseDocument('{"type":"paragraph"}') as { error: string }).error, /expected "doc"/);
assert.match((parseDocument('{"type":"doc","content":{}}') as { error: string }).error, /must be an array/);
assert.ok('doc' in parseDocument('{"type":"doc"}'), 'an empty document is valid');

// --- depth guard -----------------------------------------------------------
let deep: DocNode = { type: 'paragraph', content: [{ type: 'text', text: 'bottom' }] };
for (let i = 0; i < 60; i += 1) deep = { type: 'blockquote', content: [deep] };
assert.equal(depthOf(deep), 40, 'depth is capped so a pathological payload cannot blow the stack');
assert.equal(depthOf(para('flat')), 1);

console.log('document-renderer: all checks passed');
