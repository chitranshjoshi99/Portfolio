export type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** What GET /pages/:id/children returns per child. `hasChildren` lets the UI show a chevron without fetching. */
export interface PageSummary {
  id: string;
  title: string;
  hasChildren: boolean;
}

/** Normalised store entry. `childIds` is null until the children have been fetched. */
export interface PageNode extends PageSummary {
  parentId: string | null;
  childIds: string[] | null;
  load: LoadState;
}

export type PageStore = Record<string, PageNode>;

/** One rendered line of the FLAT tree. Everything ARIA needs is precomputed here. */
export interface TreeRow {
  kind: 'page' | 'loading' | 'error';
  id: string; // page id, or `${parentId}:loading` / `${parentId}:error`
  pageId: string; // the page this row is, or the parent it belongs to
  depth: number; // 1-based aria-level
  posInSet: number;
  setSize: number;
}

export interface RowWindow {
  start: number;
  end: number; // exclusive
  offsetTop: number;
}
