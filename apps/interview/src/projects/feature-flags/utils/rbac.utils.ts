import type {
  Environment,
  FlagAction,
  PermissionIndex,
  Role,
  RoleGrant,
} from '../feature-flags.types';

/** The index key. One string per (action, environment) pair, so a check is a `Set.has`. */
const grantKey = (action: FlagAction, environment: Environment): string => `${action}:${environment}`;

/**
 * Flattens the inheritance chain once into a `Set` per role.
 *
 * The grant table is a parameter, not an import: these functions stay pure, so the whole
 * authorisation model can be exercised against a made-up table in the check file.
 *
 * The `seen` guard is not defensive noise. The table is config, and a config typo that points two
 * roles at each other would otherwise hang the tab rather than fail — an authorisation table that
 * can loop is an authorisation table that can take the console down.
 */
export const buildPermissionIndex = (
  grants: Record<Role, RoleGrant>,
  roles: Role[],
): PermissionIndex => {
  const index = {} as PermissionIndex;

  for (const role of roles) {
    const keys = new Set<string>();
    const seen = new Set<Role>();

    for (let current: Role | undefined = role; current && !seen.has(current); ) {
      seen.add(current);
      const grant: RoleGrant = grants[current];
      for (const [action, environments] of Object.entries(grant.grants)) {
        for (const environment of environments ?? []) {
          keys.add(grantKey(action as FlagAction, environment));
        }
      }
      current = grant.inherits;
    }

    index[role] = keys;
  }

  return index;
};

/**
 * The single question the whole UI asks: may this role do this thing here?
 *
 * O(1), and — more importantly — there is exactly one of these. Scattering `role === 'admin'`
 * through components is how a screen ends up with a hidden button that still works.
 */
export const can = (
  index: PermissionIndex,
  role: Role,
  action: FlagAction,
  environment: Environment,
): boolean => index[role].has(grantKey(action, environment));

/**
 * V1 of the ladder, kept as the oracle the flattened index is tested against: walk the
 * inheritance chain on every check. Obviously correct, and re-derives the same answer forever.
 */
export const canByWalk = (
  grants: Record<Role, RoleGrant>,
  role: Role,
  action: FlagAction,
  environment: Environment,
): boolean => {
  const seen = new Set<Role>();
  for (let current: Role | undefined = role; current && !seen.has(current); ) {
    seen.add(current);
    const grant: RoleGrant = grants[current];
    if (grant.grants[action]?.includes(environment)) return true;
    current = grant.inherits;
  }
  return false;
};

/** Every action a role holds in one environment — the matrix under the role switcher. */
export const grantedActions = (
  index: PermissionIndex,
  role: Role,
  environment: Environment,
  actions: FlagAction[],
): FlagAction[] => actions.filter((action) => can(index, role, action, environment));

/** Environments where the role can do more than look — drives the "read-only here" hint. */
export const writableEnvironments = (
  index: PermissionIndex,
  role: Role,
  environments: Environment[],
): Environment[] =>
  environments.filter(
    (environment) =>
      can(index, role, 'toggle', environment) || can(index, role, 'rollout', environment),
  );
