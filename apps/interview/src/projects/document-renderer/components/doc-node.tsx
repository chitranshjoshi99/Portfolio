import type { ReactNode } from 'react';
import type { DocNode, Mark } from '../document-renderer.types';
import { linkRel, MAX_DEPTH, safeHref, usableMarks } from '../utils/adf.utils';

interface NodeProps {
  node: DocNode;
  children: ReactNode;
  /** Heading anchors, resolved once for the whole document so ids stay unique. */
  anchorOf: (node: DocNode) => string | undefined;
}

/**
 * The registry. One entry per node type, each one only responsible for its own element — children are
 * already rendered. Adding a node type is adding a key here; nothing else in the renderer changes.
 */
const RENDERERS: Record<string, (props: NodeProps) => ReactNode> = {
  doc: ({ children }) => <div className="dr__doc">{children}</div>,
  paragraph: ({ children }) => <p className="dr__p">{children}</p>,
  heading: ({ node, children, anchorOf }) => {
    const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
    const Tag = `h${level}` as 'h1';
    return (
      <Tag className="dr__h" id={anchorOf(node)} data-level={level}>
        {children}
      </Tag>
    );
  },
  bulletList: ({ children }) => <ul className="dr__ul">{children}</ul>,
  orderedList: ({ node, children }) => (
    <ol className="dr__ol" start={Number(node.attrs?.order ?? 1)}>
      {children}
    </ol>
  ),
  listItem: ({ children }) => <li className="dr__li">{children}</li>,
  blockquote: ({ children }) => <blockquote className="dr__quote">{children}</blockquote>,
  panel: ({ node, children }) => {
    const kind = String(node.attrs?.panelType ?? 'info');
    return (
      <aside className={`dr__panel dr__panel--${kind}`} aria-label={`${kind} panel`}>
        {children}
      </aside>
    );
  },
  codeBlock: ({ node, children }) => (
    <pre className="dr__code" data-language={String(node.attrs?.language ?? '')}>
      <code>{children}</code>
    </pre>
  ),
  rule: () => <hr className="dr__rule" />,
  hardBreak: () => <br />,
  mention: ({ node }) => <span className="dr__mention">{String(node.attrs?.text ?? '@unknown')}</span>,
  status: ({ node }) => (
    <span className={`dr__status dr__status--${String(node.attrs?.color ?? 'neutral')}`}>
      {String(node.attrs?.text ?? '')}
    </span>
  ),
  table: ({ children }) => (
    <div className="dr__table-wrap">
      <table className="dr__table">
        <tbody>{children}</tbody>
      </table>
    </div>
  ),
  tableRow: ({ children }) => <tr>{children}</tr>,
  tableHeader: ({ children }) => <th scope="col">{children}</th>,
  tableCell: ({ children }) => <td>{children}</td>,
  media: ({ node }) => (
    <figure className="dr__media">
      <div className="dr__media-box" aria-hidden="true">
        {String(node.attrs?.type ?? 'file')}
      </div>
      <figcaption>{String(node.attrs?.alt ?? node.attrs?.id ?? 'Attachment')}</figcaption>
    </figure>
  ),
};

/** Marks wrap the text, innermost first, so a bold link is a link containing bold text. */
function applyMarks(text: ReactNode, marks: Mark[]): ReactNode {
  return marks.reduce<ReactNode>((wrapped, mark) => {
    switch (mark.type) {
      case 'strong':
        return <strong>{wrapped}</strong>;
      case 'em':
        return <em>{wrapped}</em>;
      case 'code':
        return <code className="dr__inline-code">{wrapped}</code>;
      case 'strike':
        return <s>{wrapped}</s>;
      case 'underline':
        return <u>{wrapped}</u>;
      case 'subsup':
        return mark.attrs?.type === 'sub' ? <sub>{wrapped}</sub> : <sup>{wrapped}</sup>;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        // A blocked scheme keeps the text and loses the link: never render a dead anchor that looks live.
        if (!href) {
          return (
            <span className="dr__blocked" title="Link removed: unsafe scheme">
              {wrapped}
            </span>
          );
        }
        return (
          <a className="dr__link" href={href} target="_blank" rel={linkRel(href)}>
            {wrapped}
          </a>
        );
      }
      default:
        return wrapped;
    }
  }, text);
}

interface DocNodeViewProps {
  node: DocNode;
  anchorOf: (node: DocNode) => string | undefined;
  depth?: number;
}

export function DocNodeView({ node, anchorOf, depth = 0 }: DocNodeViewProps) {
  if (depth > MAX_DEPTH) {
    return <p className="dr__unknown">Document nests deeper than {MAX_DEPTH} levels; rendering stopped here.</p>;
  }

  if (node.type === 'text') {
    return <>{applyMarks(node.text ?? '', usableMarks(node.marks))}</>;
  }

  const children = (node.content ?? []).map((child, index) => (
    // Index keys: a document is re-rendered wholesale, never reordered in place.
    <DocNodeView key={index} node={child} anchorOf={anchorOf} depth={depth + 1} />
  ));

  const render = RENDERERS[node.type];
  if (!render) {
    // The fallback that keeps a renderer honest: an older client meets a newer schema every release.
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
