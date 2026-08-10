import type {
  Environment,
  EvaluationReason,
  FlagAction,
  FlagState,
  Role,
  RoleGrant,
} from '../feature-flags.types';

export const ROLES: Role[] = ['viewer', 'developer', 'admin', 'owner'];

export const ENVIRONMENTS: Environment[] = ['dev', 'staging', 'prod'];

export const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Viewer',
  developer: 'Developer',
  admin: 'Admin',
  owner: 'Owner',
};

export const ENV_LABEL: Record<Environment, string> = {
  dev: 'Dev',
  staging: 'Staging',
  prod: 'Production',
};

export const ACTION_LABEL: Record<FlagAction, string> = {
  view: 'View flags',
  toggle: 'Turn on / off',
  rollout: 'Change targeting',
  archive: 'Archive',
};

/**
 * The whole authorisation model, as data.
 *
 * Two things make it worth writing this way. `inherits` means a role is defined by what it adds,
 * so "developers can now do X in staging" is a one-line edit that cannot miss a subclass. And a
 * grant carries the environments it applies in, because "can toggle" is meaningless on its own —
 * a developer toggling in dev is normal, the same developer toggling in prod is an incident.
 */
export const ROLE_GRANTS: Record<Role, RoleGrant> = {
  viewer: {
    grants: { view: ENVIRONMENTS },
  },
  developer: {
    inherits: 'viewer',
    grants: { toggle: ['dev', 'staging'], rollout: ['dev', 'staging'] },
  },
  admin: {
    inherits: 'developer',
    grants: { toggle: ['prod'], rollout: ['prod'] },
  },
  owner: {
    inherits: 'admin',
    grants: { archive: ENVIRONMENTS },
  },
};

export const STATE_FILTERS: { value: FlagState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'on', label: 'On' },
  { value: 'rollout', label: 'Rolling out' },
  { value: 'off', label: 'Off' },
];

export const STATE_LABEL: Record<FlagState, string> = {
  on: 'On',
  rollout: 'Rollout',
  off: 'Off',
};

export const REASON_LABEL: Record<EvaluationReason, string> = {
  archived: 'flag archived',
  override: 'user override',
  role: 'role targeted',
  bucket: 'rollout bucket',
  default: 'rule default',
};

/** Percentage presets. Discrete steps mean one write per click — see `RolloutControl`. */
export const ROLLOUT_STEPS = [0, 5, 10, 25, 50, 75, 100];

export const MESSAGE = {
  listFailed: 'Could not load flags.',
  empty: 'No flags match these filters.',
  forbidden: (action: FlagAction, environment: Environment) =>
    `Rejected by the server: your role cannot ${ACTION_LABEL[action].toLowerCase()} in ${ENV_LABEL[environment]}.`,
  mutationFailed: 'Could not save that change.',
  noPermission: (action: FlagAction, environment: Environment) =>
    `${ACTION_LABEL[action]} in ${ENV_LABEL[environment]} needs a higher role.`,
};

export const LATENCY_MS = { list: 400, mutation: 550 };
