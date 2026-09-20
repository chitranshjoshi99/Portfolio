import type { DocNode, DocStats, Heading, Mark } from '../document-renderer.types.ts';

/** Every node type the renderer knows. Anything else falls through to the unknown-node placeholder. */
export const KNOWN_NODES = new Set([
  'doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem',
  'codeBlock', 'blockquote', 'panel', 'rule', 'hardBreak', 'mention', 'status',
  'table', 'tableRow', 'tableHeader', 'tableCell', 'media',
]);

export const KNOWN_MARKS = new Set(['strong', 'em', 'code', 'strike', 'underline', 'link', 'subsup']);

/** Schemes that are safe to put in an href. Everything else is a script vector or a download. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Anchors carry executable schemes (`javascript:`, `data:`, `vbscript:`) that run on click with the
 * page's own origin. The href is attacker-controlled the moment a document can be authored by anyone,
 * so it is parsed and allow-listed, never pattern-matched for the word "javascript".
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A relative href has no scheme and stays on this origin: allowed, but never protocol-relative.
  if (trimmed.startsWith('//')) return null;
  if (/^[/#?]/.test(trimmed)) return trimmed;
  try {
    // Control characters are stripped by the URL parser, which is exactly why parsing beats a regex:
    // "java\tscript:alert(1)" is a javascript: URL to the browser and not to a naive string test.
    const url = new URL(trimmed, 'https://example.invalid');
    if (!SAFE_SCHEMES.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** External links need the rel: `noopener` closes window.opener, `noreferrer` stops the leak. */
export function linkRel(href: string): string | undefined {
  return /^https?:/i.test(href) ? 'noopener noreferrer' : undefined;
}

export const isKnownNode = (type: string): boolean => KNOWN_NODES.has(type);

/** Marks the renderer does not know are dropped, not applied blindly. */
export function usableMarks(marks: Mark[] | undefined): Mark[] {
  return (marks ?? []).filter((mark) => KNOWN_MARKS.has(mark.type));
}

/** Depth-first text, used for headings, the outline, word counts and search previews. */
export function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  if (node.type === 'mention') return String(node.attrs?.text ?? '');
  const parts = (node.content ?? []).map(textOf);
  // Block-level nodes are separated so two paragraphs do not glue into one word.
  return parts.join(node.type === 'paragraph' || node.type === 'text' ? '' : ' ');
}

export function walk(node: DocNode, visit: (node: DocNode) => void): void {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

/** Stable, unique, readable ids: two "Overview" headings must not both own #overview. */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'section';
}

export function collectHeadings(doc: DocNode): Heading[] {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  walk(doc, (node) => {
    if (node.type !== 'heading') return;
    const text = textOf(node).trim();
    const base = slugify(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    headings.push({
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      level: Number(node.attrs?.level ?? 1),
      text,
    });
  });
  return headings;
}

export function documentStats(doc: DocNode): DocStats {
  const stats: DocStats = { nodes: 0, words: 0, unknown: [], blockedLinks: [] };
  const unknown = new Set<string>();
  walk(doc, (node) => {
    stats.nodes += 1;
    if (!isKnownNode(node.type)) unknown.add(node.type);
    for (const mark of node.marks ?? []) {
      if (mark.type !== 'link') continue;
      const raw = mark.attrs?.href;
      if (!safeHref(raw)) stats.blockedLinks.push(String(raw));
    }
  });
  stats.unknown = [...unknown].sort();
  stats.words = textOf(doc).trim().split(/\s+/).filter(Boolean).length;
  return stats;
}

/** Parse a pasted payload without letting a bad one take the page down. */
export function parseDocument(raw: string): { doc: DocNode } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
  if (!value || typeof value !== 'object') return { error: 'Expected an object at the root.' };
  const doc = value as DocNode;
  if (typeof doc.type !== 'string') return { error: 'Root node has no "type".' };
  if (doc.type !== 'doc') return { error: `Root node is "${doc.type}", expected "doc".` };
  if (doc.content !== undefined && !Array.isArray(doc.content)) return { error: '"content" must be an array.' };
  return { doc };
}

/** Guard against a cyclic or pathological payload: React would recurse until the stack dies. */
export const MAX_DEPTH = 40;

export function depthOf(node: DocNode, depth = 0): number {
  if (depth >= MAX_DEPTH) return depth;
  let deepest = depth;
  for (const child of node.content ?? []) {
    deepest = Math.max(deepest, depthOf(child, depth + 1));
    if (deepest >= MAX_DEPTH) break;
  }
  return deepest;
}
