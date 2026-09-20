export interface MenuNode {
  id: string;
  label: string;
  /** Leaves (and optionally parents) navigate somewhere. */
  route?: string;
  /** Permission needed to see this node. Absent = visible to everyone who can see the parent. */
  permission?: string;
  children?: MenuNode[];
}

/** Built once per (tree, permissions). Every lookup after that is O(1) or O(depth). */
export interface MenuIndex {
  byId: Map<string, MenuNode>;
  parentOf: Map<string, string | null>;
  byRoute: Map<string, string>;
}

export interface Role {
  id: string;
  label: string;
  permissions: string[];
}

export type RouteResult =
  | { kind: 'ok'; id: string }
  | { kind: 'forbidden'; route: string }
  | { kind: 'not-found'; route: string };
