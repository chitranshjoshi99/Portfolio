import type { MenuNode, Role } from '../nested-menu.types';

/** What GET /menu returns — the full tree; the client prunes by permission. */
export const MENU: MenuNode[] = [
  { id: 'home', label: 'Home', route: '/home' },
  {
    id: 'projects',
    label: 'Projects',
    children: [
      {
        id: 'jira',
        label: 'Jira',
        children: [
          { id: 'jira-board', label: 'Board', route: '/jira/board' },
          { id: 'jira-backlog', label: 'Backlog', route: '/jira/backlog' },
          {
            id: 'jira-reports',
            label: 'Reports',
            permission: 'reports:view',
            children: [
              { id: 'velocity', label: 'Velocity chart', route: '/jira/reports/velocity' },
              { id: 'burndown', label: 'Burndown', route: '/jira/reports/burndown' },
            ],
          },
        ],
      },
      {
        id: 'confluence',
        label: 'Confluence',
        children: [
          { id: 'spaces', label: 'Spaces', route: '/confluence/spaces' },
          { id: 'templates', label: 'Templates', route: '/confluence/templates' },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    permission: 'admin',
    children: [
      { id: 'users', label: 'Users', route: '/admin/users' },
      { id: 'billing', label: 'Billing', route: '/admin/billing', permission: 'billing' },
      {
        id: 'security',
        label: 'Security',
        children: [
          { id: 'sso', label: 'SSO', route: '/admin/security/sso' },
          { id: 'audit', label: 'Audit log', route: '/admin/security/audit', permission: 'audit:view' },
        ],
      },
    ],
  },
  { id: 'help', label: 'Help', route: '/help' },
];

export const ROLES: Role[] = [
  { id: 'viewer', label: 'Viewer', permissions: [] },
  { id: 'lead', label: 'Team lead', permissions: ['reports:view'] },
  { id: 'admin', label: 'Site admin', permissions: ['reports:view', 'admin', 'audit:view'] },
  { id: 'owner', label: 'Org owner', permissions: ['reports:view', 'admin', 'audit:view', 'billing'] },
];

export const DEFAULT_ROUTE = '/jira/reports/velocity';
