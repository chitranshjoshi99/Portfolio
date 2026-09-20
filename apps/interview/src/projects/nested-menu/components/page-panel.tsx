import type { MenuNode, RouteResult } from '../nested-menu.types';

interface PagePanelProps {
  route: RouteResult;
  breadcrumb: MenuNode[];
}

export function PagePanel({ route, breadcrumb }: PagePanelProps) {
  if (route.kind === 'forbidden') {
    return (
      <div className="nm__page nm__page--error" role="alert">
        <h2>403 — no access</h2>
        <p>
          <code>{route.route}</code> exists, but your role cannot open it. The menu hides it; the guard blocks
          a typed URL too.
        </p>
      </div>
    );
  }
  if (route.kind === 'not-found') {
    return (
      <div className="nm__page nm__page--error" role="alert">
        <h2>404</h2>
        <p>
          No page at <code>{route.route}</code>.
        </p>
      </div>
    );
  }
  const page = breadcrumb[breadcrumb.length - 1];
  return (
    <div className="nm__page">
      <nav aria-label="Breadcrumb" className="nm__crumbs">
        {breadcrumb.map((node) => node.label).join(' / ')}
      </nav>
      <h2>{page?.label}</h2>
      <p>
        <code>{page?.route}</code>
      </p>
    </div>
  );
}
