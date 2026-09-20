# Document Renderer (ADF) — Interview Build Guide

Render a document that arrives as JSON — the shape Confluence and Jira send, nodes with `type`, `attrs`,
`marks` and `content` — into a page: headings with anchors, paragraphs with bold/code/link runs, nested
lists, panels, tables, code blocks, mentions. Handle the two things that separate a renderer from a demo:
**a node type this build has never heard of**, and **a link nobody should be allowed to click**. Plain
JavaScript, fresh sandbox, 45 minutes.

Reported at Atlassian as: *"given a JSON structure representing a document, render it"*, *"render a nested
comment/content tree from an API payload"*, and as the follow-up to the file-explorer question (*"same
recursion, now the node types differ"*). The security half is a standing cross-question: *"the document is
authored by another user — what can go wrong?"*

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements: who authors it, which node types, what about unknown ones |
| 5–10 | The data model, out loud: nodes vs marks |
| 10–22 | Recursion + the **registry** (the design decision being graded) |
| 22–30 | Marks, and **link safety** |
| 30–38 | Unknown-node fallback, headings and anchors |
| 38–45 | Scale, malformed payloads, cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css
```

Target split (this repo):

```text
document-renderer/
  index.tsx                          # outline + page + the paste-your-own-JSON pane
  document-renderer.types.ts         # DocNode, Mark, Heading, DocStats
  document-renderer.css
  constants/sample-doc.ts            # a page with every node type, one unknown node, one hostile link
  utils/adf.utils.ts                 # safeHref, usableMarks, textOf, walk, collectHeadings,
                                     #   documentStats, parseDocument, depthOf
  utils/adf.check.ts
  hooks/use-document.ts              # source, parsed doc, headings, anchors, stats
  components/doc-node.tsx            # the registry + recursive renderer + marks pipeline
```

---

## 1. Requirement gathering (5 minutes)

1. **"Who authors these documents?"** The whole security section hangs on this. *Default: any user in the
   org, so the payload is untrusted input.*
2. **"Which node types must I support?"** *Default: the text set — headings, paragraphs, lists,
   quote, code, panel, rule, table, mention, status.*
3. **"What should happen when the payload contains a type I do not know?"** The question they are hoping
   you ask. *Default: render a visible placeholder naming the type, keep any renderable children.*
4. **"Is the document editable here, or read-only?"** *Default: read-only. An editor is a different
   problem (selection, transactions, collaborative cursors).*
5. **"How large do they get?"** *Default: a page, hundreds of nodes. Thousands means windowing.*
6. **"Do headings need anchors / a table of contents?"** *Default: yes — and duplicate titles must get
   distinct ids.*
7. **"Is the payload guaranteed well-formed?"** *Default: no. Parse defensively and keep the last good
   render on screen.*

Plan in one breath:

> "Recursive render, one registry keyed by node type so adding a type is adding a key. Text nodes get
> their marks wrapped around them, and link marks go through an allow-list of URL schemes, because the
> document is authored by another user. Anything the registry does not know renders as a labelled
> placeholder rather than disappearing. Headings collect into an outline with de-duplicated anchors."

---

## 2. High-level design (HLD)

```text
   JSON  ──parse──▶  DocNode tree ──┬──▶ RENDERERS[node.type] ──▶ element + rendered children
   (untrusted)       {type, attrs,  │        └── missing? → <UnknownNode type> (visible, not silent)
                      marks,        │
                      content[]}    ├──▶ text node → applyMarks(text, usableMarks(marks))
                                    │        └── link mark → safeHref() → allow-listed scheme or no anchor
                                    │
                                    └──▶ walk() ──▶ headings + anchors ──▶ outline
                                                 └─▶ stats: node count, words, unknown types, blocked links
```

Four claims:

- **React escapes text for you.** `{node.text}` cannot inject markup; the payload only becomes dangerous
  where it stops being text and starts being an *attribute* — `href` above all. That is why this renderer
  has no `dangerouslySetInnerHTML` and no sanitiser: there is no HTML string anywhere in it.
- **A registry, not a switch.** Same runtime cost, different change cost: a new node type is one key, and
  the renderer can be extended by a caller (plugins, per-product node sets) without editing it.
- **Unknown nodes are a product decision, not an edge case.** Clients and editors ship on different
  cycles, so an older renderer meets a newer schema every release. Silently dropping content is the worst
  option: the reader cannot tell the page is incomplete.
- **Derived data comes from one walk.** Outline, word count, unknown-type list and blocked-link list are
  the same traversal, so they cannot disagree with what was rendered.

---

## 3. Low-level design (LLD)

```js
// state
const [source, setSource] = useState(PRETTY_SAMPLE);  // the JSON textarea
const [doc, setDoc]       = useState(SAMPLE_DOC);     // last successfully parsed document
const [error, setError]   = useState(null);           // parse failure, shown WITHOUT dropping `doc`

// derived, one walk each, memoised on `doc`
const headings = useMemo(() => collectHeadings(doc), [doc]);
const stats    = useMemo(() => documentStats(doc), [doc]);
const anchors  = useMemo(() => …, [doc, headings]);   // Map<node, id>
```

```js
safeHref(raw)            -> string | null      // allow-list by parsed protocol
linkRel(href)            -> 'noopener noreferrer' | undefined
usableMarks(marks)       -> Mark[]             // drops marks with no renderer
textOf(node)             -> string             // depth-first text, block nodes separated
walk(node, visit)        -> void
collectHeadings(doc)     -> [{ id, level, text }]   // ids de-duplicated in document order
documentStats(doc)       -> { nodes, words, unknown[], blockedLinks[] }
parseDocument(raw)       -> { doc } | { error }
depthOf(node)            -> number             // capped at MAX_DEPTH
```

---

## 4. The data model — nodes and marks

```json
{ "type": "doc", "content": [
  { "type": "heading", "attrs": { "level": 2 }, "content": [ { "type": "text", "text": "Checklist" } ] },
  { "type": "paragraph", "content": [
      { "type": "text", "text": "ships behind " },
      { "type": "text", "text": "editor.v2", "marks": [ { "type": "code" } ] },
      { "type": "text", "text": "rollout plan",
        "marks": [ { "type": "link", "attrs": { "href": "https://example.atlassian.net/…" } } ] } ] } ] }
```

The single fact worth stating: **a mark is not a node.** Nodes are the tree — they nest and they own
children. Marks are a flat list of formatting applied to one text run: bold-and-a-link is one text node
with two marks, not a `<strong>` wrapping an `<a>` wrapping a text node. That is why bold text can start
mid-link and end after it without the tree ever becoming invalid, and why the renderer needs two code
paths: one that recurses (nodes) and one that wraps (marks).

`attrs` is deliberately `Record<string, unknown>`: it is whatever the server sent. Every read out of it
goes through `String()`/`Number()` with a default, because `attrs.level` arriving as `"2"` or as `null`
must not produce `<h[object Object]>`.

---

## 5. Pass 1 — recursion and the registry (12 minutes)

### The ladder — how the node type picks the element

| Rung | Shape | Add a node type | Extensible by a caller | Risk |
| --- | --- | --- | --- | --- |
| V0 | build an HTML string, `dangerouslySetInnerHTML` | string concat | no | **XSS**, and one bad node breaks the document |
| V1 | `switch (node.type)` in one component | edit the switch | no | grows to 300 lines, every product forks it |
| V2 | **`RENDERERS[node.type]`, children rendered by the recursion** | one key | yes — merge a map | none material |
| V3 | V2 + `React.memo` per node + windowed blocks | one key | yes | only pays off on huge documents |

**Ship V2.** V0 is not a performance choice, it is a vulnerability: the moment a document is authored by
another user, a string-built renderer hands them an injection point, and the fix (a sanitiser) is a
dependency plus a policy to maintain. V1 works and is what most people write; the reason to prefer V2 out
loud is *change* cost, not speed — Confluence, Jira and a dozen internal products render the same document
format with different node sets, and a map can be composed where a switch has to be edited.

```js
const RENDERERS = {
  doc:        ({ children }) => <div className="dr__doc">{children}</div>,
  paragraph:  ({ children }) => <p>{children}</p>,
  heading:    ({ node, children, anchorOf }) => {
    const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);   // never trust attrs
    const Tag = `h${level}`;
    return <Tag id={anchorOf(node)} data-level={level}>{children}</Tag>;
  },
  bulletList: ({ children }) => <ul>{children}</ul>,
  listItem:   ({ children }) => <li>{children}</li>,
  codeBlock:  ({ node, children }) => <pre data-language={String(node.attrs?.language ?? '')}><code>{children}</code></pre>,
  rule:       () => <hr />,
  // …one line per type
};

function DocNodeView({ node, anchorOf, depth = 0 }) {
  if (depth > MAX_DEPTH) return <p className="dr__unknown">Document nests too deeply; stopped here.</p>;
  if (node.type === 'text') return <>{applyMarks(node.text ?? '', usableMarks(node.marks))}</>;

  const children = (node.content ?? []).map((child, i) =>
    <DocNodeView key={i} node={child} anchorOf={anchorOf} depth={depth + 1} />);

  const render = RENDERERS[node.type];
  if (!render) return <UnknownNode type={node.type}>{children}</UnknownNode>;
  return <>{render({ node, children, anchorOf })}</>;
}
```

Three deliberate lines:

- **`children` is computed before the lookup**, so every renderer receives rendered children and none of
  them has to know how to recurse. That is what keeps the registry entries one-liners.
- **Index keys are correct here.** Keys exist to match elements across renders of a *reordering* list; a
  document is replaced wholesale, never spliced, so there is no identity to preserve and no id in the
  payload to use. Say this rather than reaching for `crypto.randomUUID()`, which would remount the whole
  page on every render.
- **The depth cap.** A cyclic or adversarial payload recurses until the stack dies and takes the tab with
  it. Forty levels is far past any real document.

---

## 6. Pass 2 — marks, and the link that is trying to hurt you (8 minutes)

```js
function applyMarks(text, marks) {
  return marks.reduce((wrapped, mark) => {
    switch (mark.type) {
      case 'strong': return <strong>{wrapped}</strong>;
      case 'em':     return <em>{wrapped}</em>;
      case 'code':   return <code>{wrapped}</code>;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        if (!href) return <span className="dr__blocked" title="Link removed: unsafe scheme">{wrapped}</span>;
        return <a href={href} target="_blank" rel={linkRel(href)}>{wrapped}</a>;
      }
      default: return wrapped;         // an unknown mark is dropped, never applied blindly
    }
  }, text);
}
```

### The ladder — deciding whether an href is safe

| Rung | Check | `javascript:alert(1)` | `JaVaScRiPt:` | `java\tscript:` | `data:text/html,…` | `//evil.com` |
| --- | --- | --- | --- | --- | --- | --- |
| V0 | render `href` as sent | **runs** | runs | runs | runs | leaves the origin |
| V1 | `!href.startsWith('javascript:')` | blocked | **runs** | **runs** | runs | leaves |
| V2 | lowercase + `includes('javascript')` | blocked | blocked | **runs** | runs | leaves |
| V3 | **`new URL()` + scheme allow-list** | blocked | blocked | blocked | blocked | blocked |

```js
const SAFE = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function safeHref(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return null;        // protocol-relative: inherits https, leaves the origin
  if (/^[/#?]/.test(trimmed)) return trimmed;        // same-origin relative href
  try {
    const url = new URL(trimmed, 'https://example.invalid');
    return SAFE.has(url.protocol) ? url.href : null;
  } catch { return null; }
}
```

**Why parsing beats matching**, in one sentence you should say out loud: the browser strips control
characters before resolving a URL, so `java\tscript:alert(1)` is a `javascript:` URL to the browser and
*not* to any string test you write — only a parser sees the same URL the browser will. The allow-list then
makes the check positive rather than negative: new dangerous schemes do not need a new rule.

Two more lines that belong to the same idea:

- `target="_blank"` without `rel="noopener"` hands the opened page a live `window.opener` handle to yours
  (and leaks the referrer). Add it for `http(s)` links.
- A blocked link keeps its **text** and loses its anchor. Dropping the text hides that anything was there;
  rendering a dead `<a>` invites the click you just prevented.

---

## 7. Pass 3 — unknown nodes, headings, malformed payloads (8 minutes)

```js
function UnknownNode({ type, children }) {
  return (
    <div className="dr__unknown" role="note">
      <span className="dr__unknown-tag">{type}</span>
      <span>Unsupported content. Open this page in Confluence to see it.</span>
      {children.length > 0 && <div className="dr__unknown-body">{children}</div>}
    </div>
  );
}
```

Rendering the *children* of an unknown node is the detail worth arguing for: an `expand` block this build
has never seen still contains paragraphs it knows perfectly well, so the reader loses the affordance, not
the content.

Anchors are assigned **in document order with a running count**, so two headings called "Overview" become
`#overview` and `#overview-2`, and the outline links match the ids on the page:

```js
const base = slugify(textOf(node).trim());
const seen = used.get(base) ?? 0;
used.set(base, seen + 1);
const id = seen === 0 ? base : `${base}-${seen + 1}`;
```

`slugify` keeps unicode letters (`\p{Letter}` with the `u` flag) — stripping to ASCII turns every heading
in a non-English page into `section`, `section-2`, `section-3`.

Parsing never throws into the render tree, and a failed parse **keeps the last good document on screen**:

```js
const result = parseDocument(source);
if ('error' in result) { setError(result.error); return; }   // page still shows the previous render
setError(null); setDoc(result.doc);
```

Blanking the page on a bad payload loses the reader's place to tell them something they can already see in
the error line.

---

## 8. The single-file version — what you actually type

```jsx
import { useMemo, useState } from 'react';

/* ───────────── utils/adf.utils.js — pure ───────────── */

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const MAX_DEPTH = 40;

function safeHref(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;
  if (/^[/#?]/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, 'https://example.invalid');
    return SAFE_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const KNOWN_MARKS = new Set(['strong', 'em', 'code', 'strike', 'link']);
const usableMarks = (marks) => (marks ?? []).filter((m) => KNOWN_MARKS.has(m.type));

function textOf(node) {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'mention') return String(node.attrs?.text ?? '');
  const parts = (node.content ?? []).map(textOf);
  return parts.join(node.type === 'paragraph' ? '' : ' ');
}

function walk(node, visit) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

const slugify = (text) =>
  text.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';

function collectHeadings(doc) {
  const headings = [];
  const used = new Map();
  walk(doc, (node) => {
    if (node.type !== 'heading') return;
    const text = textOf(node).trim();
    const base = slugify(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    headings.push({ id: seen === 0 ? base : `${base}-${seen + 1}`, level: Number(node.attrs?.level ?? 1), text });
  });
  return headings;
}

function parseDocument(raw) {
  let value;
  try { value = JSON.parse(raw); } catch (error) { return { error: error.message }; }
  if (!value || typeof value !== 'object') return { error: 'Expected an object at the root.' };
  if (value.type !== 'doc') return { error: `Root node is "${value.type}", expected "doc".` };
  if (value.content !== undefined && !Array.isArray(value.content)) return { error: '"content" must be an array.' };
  return { doc: value };
}

/* ───────────── components/doc-node.jsx — the registry ───────────── */

const RENDERERS = {
  doc: ({ children }) => <div className="dr__doc">{children}</div>,
  paragraph: ({ children }) => <p className="dr__p">{children}</p>,
  heading: ({ node, children, anchorOf }) => {
    const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
    const Tag = `h${level}`;
    return <Tag id={anchorOf(node)} data-level={level}>{children}</Tag>;
  },
  bulletList: ({ children }) => <ul className="dr__ul">{children}</ul>,
  orderedList: ({ node, children }) => <ol start={Number(node.attrs?.order ?? 1)}>{children}</ol>,
  listItem: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  panel: ({ node, children }) => (
    <aside className={`dr__panel dr__panel--${String(node.attrs?.panelType ?? 'info')}`}>{children}</aside>
  ),
  codeBlock: ({ node, children }) => (
    <pre data-language={String(node.attrs?.language ?? '')}><code>{children}</code></pre>
  ),
  rule: () => <hr />,
  hardBreak: () => <br />,
  mention: ({ node }) => <span className="dr__mention">{String(node.attrs?.text ?? '@unknown')}</span>,
  table: ({ children }) => <table className="dr__table"><tbody>{children}</tbody></table>,
  tableRow: ({ children }) => <tr>{children}</tr>,
  tableHeader: ({ children }) => <th scope="col">{children}</th>,
  tableCell: ({ children }) => <td>{children}</td>,
};

function applyMarks(text, marks) {
  return marks.reduce((wrapped, mark) => {
    switch (mark.type) {
      case 'strong': return <strong>{wrapped}</strong>;
      case 'em': return <em>{wrapped}</em>;
      case 'code': return <code className="dr__inline-code">{wrapped}</code>;
      case 'strike': return <s>{wrapped}</s>;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        if (!href) return <span className="dr__blocked" title="Link removed: unsafe scheme">{wrapped}</span>;
        const rel = /^https?:/i.test(href) ? 'noopener noreferrer' : undefined;
        return <a href={href} target="_blank" rel={rel}>{wrapped}</a>;
      }
      default: return wrapped;
    }
  }, text);
}

function DocNodeView({ node, anchorOf, depth = 0 }) {
  if (depth > MAX_DEPTH) return <p className="dr__unknown">Document nests too deeply; stopped here.</p>;
  if (node.type === 'text') return <>{applyMarks(node.text ?? '', usableMarks(node.marks))}</>;

  const children = (node.content ?? []).map((child, index) => (
    <DocNodeView key={index} node={child} anchorOf={anchorOf} depth={depth + 1} />
  ));

  const render = RENDERERS[node.type];
  if (!render) {
    return (
      <div className="dr__unknown" role="note">
        <span className="dr__unknown-tag">{node.type}</span>
        <span>Unsupported content. Open this page in Confluence to see it.</span>
        {children.length > 0 && <div className="dr__unknown-body">{children}</div>}
      </div>
    );
  }
  return <>{render({ node, children, anchorOf })}</>;
}

/* ───────────── constants/sample-doc.js ───────────── */

const SAMPLE_DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Editor rollout' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Ships behind ' },
      { type: 'text', text: 'editor.v2', marks: [{ type: 'code' }] },
      { type: 'text', text: '. Read the ' },
      { type: 'text', text: 'rollout plan', marks: [{ type: 'link', attrs: { href: 'https://example.com/plan' } }] },
      { type: 'text', text: '.' },
    ] },
    { type: 'expand', attrs: { title: 'From a newer editor' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Still readable.' }] }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'click here', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
    ] },
  ],
};

/* ───────────── App.jsx ───────────── */

export default function App() {
  const [source, setSource] = useState(() => JSON.stringify(SAMPLE_DOC, null, 2));
  const [doc, setDoc] = useState(SAMPLE_DOC);
  const [error, setError] = useState(null);

  const headings = useMemo(() => collectHeadings(doc), [doc]);
  const anchors = useMemo(() => {
    const byNode = new Map();
    const queue = [...headings];
    walk(doc, (node) => { if (node.type === 'heading') { const next = queue.shift(); if (next) byNode.set(node, next.id); } });
    return byNode;
  }, [doc, headings]);

  const apply = () => {
    const result = parseDocument(source);
    if ('error' in result) return setError(result.error);   // keep the last good render on screen
    setError(null);
    setDoc(result.doc);
  };

  return (
    <main>
      <textarea value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} />
      <button type="button" onClick={apply}>Render</button>
      {error && <p role="alert">{error}</p>}

      <nav aria-label="On this page">
        <ul>
          {headings.map((heading) => (
            <li key={heading.id} data-level={heading.level}><a href={`#${heading.id}`}>{heading.text}</a></li>
          ))}
        </ul>
      </nav>

      <article>
        <DocNodeView node={doc} anchorOf={(node) => anchors.get(node)} />
      </article>
    </main>
  );
}
```

**Build it in this order:** `DocNodeView` with three registry entries (doc, paragraph, text) → marks →
`safeHref` and the link mark → the unknown-node fallback → headings, slugs and the outline → the rest of
the registry → the paste pane with `parseDocument`.

Narrate two lines: *"children are rendered before the lookup, so every registry entry is one line"* and
*"the href goes through `new URL` and an allow-list, because a string test does not see the same URL the
browser does."*

---

## 9. Verification

```bash
node src/projects/document-renderer/utils/adf.check.ts
```

Asserts: six safe href shapes pass and fifteen hostile ones are blocked, including three casings of
`javascript:`, tab- and newline-obfuscated variants, `data:`, `vbscript:`, `file:`, protocol-relative,
empty and non-string; unknown marks dropped; `textOf` separating block nodes but not inline runs;
duplicate headings getting distinct anchors and a punctuation-only heading still getting one; unicode
slugs surviving; stats agreeing with `walk` on the node count and reporting unknown types and blocked
links; `parseDocument` rejecting malformed JSON, a non-object root, an array root, a missing type, a
non-`doc` root and a non-array `content`, while accepting an empty document; and the depth cap holding at
40 on a 60-deep payload.

Demo script:

1. The sample renders: heading anchors, a nested bullet list, a table, a code block with its language, a
   mention, a status lozenge.
2. The toolbar reads **97 nodes · 105 words · 1 unsupported: expand · 1 link blocked**.
3. The `expand` node shows as a labelled placeholder — **with its paragraph still readable underneath**.
4. The phishing link renders as plain text with a dashed underline; the legitimate one is an anchor with
   `rel="noopener noreferrer"`.
5. Open the JSON pane, type `{ oops`, press Render: an error line appears and **the document stays on
   screen**.
6. Paste a document with two headings called "Overview": the outline links `#overview` and `#overview-2`,
   and both resolve.

---

## 10. Cross-questions and answers

**"Why not `dangerouslySetInnerHTML` with a sanitiser?"** Because there is no HTML in this problem: the
payload is a tree, and building an HTML string out of it only to sanitise it back is inventing an
injection point and then buying a dependency to defend it. Sanitisers are for when a string of HTML is
what you were handed.

**"So there is no XSS risk at all?"** There is exactly one class: attributes. `href` (done), plus `src`
for media, `style` if any node carries one (never accept it), and any `target`/`rel` pair. Text is escaped
by React.

**"A 5,000-node document is slow."** Measure first — the usual cost is not the recursion, it is layout of
thousands of DOM nodes. Then: `React.memo` on the node component (`node` identity is stable if the
document object is), render block-level children in a windowed list, and lazy-render below-the-fold blocks
with `content-visibility: auto`. Collapse the derived walks into one pass while you are there.

**"What about streaming or partial documents?"** Render what has arrived — the recursion is naturally
resumable — and show a skeleton for the tail. `parseDocument` becomes a streaming parser or the server
sends whole blocks.

**"How would a plugin add a node type?"** `{ ...RENDERERS, ...pluginRenderers }` passed through context.
The reason the registry beats the switch, stated concretely.

**"Server-side rendering?"** The renderer is pure and has no effects, so it renders on the server
unchanged. Keep `safeHref` on the server too: the check belongs to the data, not to the browser.

**"Tables with merged cells, or media?"** `colspan`/`rowspan` come out of `attrs` and go straight onto the
cell. Media renders a placeholder with the right aspect ratio and resolves the real URL through the media
API — the payload's `id` is not a URL, and treating it as one is how a renderer leaks tokens.

**"Accessibility?"** Real elements do most of it: `<h2>` for headings, `<ul>/<li>` for lists, `<th
scope="col">` for header cells, `<blockquote>`, `<pre><code>`. The pieces to add are `scroll-margin-top`
so an anchor jump does not hide the heading under a sticky bar, and a `role="note"` on the unknown-node
placeholder so it is announced as an aside rather than read as body text.

**"How do you test this?"** The pure layer as above. The renderer with Testing Library over a fixture
document: assert the blocked link is not an `<a>`, that the unknown placeholder names its type, and that
`getAllByRole('heading')` matches the outline. Snapshot tests on rendered documents rot fast — assert
behaviour, not markup.
