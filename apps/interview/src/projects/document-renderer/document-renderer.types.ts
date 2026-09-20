/** A document in the shape Confluence and Jira actually send: nodes, marks, attrs. */
export interface DocNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: DocNode[];
}

export interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface Heading {
  id: string;
  level: number;
  text: string;
}

export interface DocStats {
  nodes: number;
  words: number;
  /** Node types with no renderer registered — the ones that would silently vanish. */
  unknown: string[];
  /** Links rewritten or dropped because the scheme is not safe. */
  blockedLinks: string[];
}
