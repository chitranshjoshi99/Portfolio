import type { NodeType } from '../file-explorer.types';

export const NODE_ICON: Record<NodeType, string> = { folder: '📁', file: '📄' };

export const CHEVRON = { expanded: '▾', collapsed: '▸' };

export const ERROR = {
  empty: 'Name cannot be empty.',
  slash: 'Name cannot contain "/".',
  duplicate: (name: string) => `"${name}" already exists here.`,
};

export const CONFIRM_DELETE = (name: string) => `Delete "${name}" and everything inside it?`;

export const DRAFT_PLACEHOLDER: Record<NodeType, string> = {
  folder: 'New folder name',
  file: 'New file name',
};
