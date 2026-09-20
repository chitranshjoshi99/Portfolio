import { useCallback, useMemo, useState } from 'react';
import { SAMPLE_DOC } from '../constants/sample-doc';
import type { DocNode } from '../document-renderer.types';
import { collectHeadings, documentStats, parseDocument } from '../utils/adf.utils';

const PRETTY_SAMPLE = JSON.stringify(SAMPLE_DOC, null, 2);

export function useDocument() {
  const [source, setSource] = useState(PRETTY_SAMPLE);
  const [doc, setDoc] = useState<DocNode>(SAMPLE_DOC);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  const headings = useMemo(() => collectHeadings(doc), [doc]);
  const stats = useMemo(() => documentStats(doc), [doc]);

  /**
   * Heading ids are assigned by document order, so the anchor for a node is looked up by its position
   * in that list rather than recomputed per heading — two headings named "Overview" get distinct ids.
   */
  const anchors = useMemo(() => {
    const byNode = new Map<DocNode, string>();
    const queue = [...headings];
    const visit = (node: DocNode) => {
      if (node.type === 'heading') {
        const next = queue.shift();
        if (next) byNode.set(node, next.id);
      }
      for (const child of node.content ?? []) visit(child);
    };
    visit(doc);
    return byNode;
  }, [doc, headings]);

  const anchorOf = useCallback((node: DocNode) => anchors.get(node), [anchors]);

  const apply = useCallback(() => {
    const result = parseDocument(source);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setDoc(result.doc);
  }, [source]);

  const reset = useCallback(() => {
    setSource(PRETTY_SAMPLE);
    setDoc(SAMPLE_DOC);
    setError(null);
  }, []);

  return {
    source,
    setSource,
    doc,
    error,
    headings,
    stats,
    anchorOf,
    apply,
    reset,
    showSource,
    toggleSource: () => setShowSource((open) => !open),
  };
}
