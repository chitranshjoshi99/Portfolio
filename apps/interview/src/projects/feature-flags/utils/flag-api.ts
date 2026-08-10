import { LATENCY_MS, MESSAGE, ROLES, ROLE_GRANTS } from '../constants/feature-flags.constants';
import { FLAG_SEED } from '../constants/flag-seed';
import type { Environment, FeatureFlag, FlagAction, Role } from '../feature-flags.types';
import { buildPermissionIndex, can } from './rbac.utils';
import { patchFlag, withArchived, withOverride, withRoleTarget, withRule } from './rollout.utils';

/**
 * Stand-in for the flag service. Module state on purpose: a saved change has to survive the
 * next refetch, otherwise the optimistic UI is never actually tested.
 */
let flags: FeatureFlag[] = FLAG_SEED;

/** Thrown when the actor's role does not carry the grant. The UI treats it as final, not retryable. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * The server's own copy of the permission index, built from the same table the client uses but
 * never handed to it.
 */
const permissions = buildPermissionIndex(ROLE_GRANTS, ROLES);

/**
 * The real authorisation check.
 *
 * The client runs the same `can()` — but that call is UX, deciding what to disable. This one
 * decides what is allowed. Anyone can edit the disabled attribute in devtools; nobody can edit
 * this. The demo's "bypass client checks" switch exists to prove the difference is real.
 */
const authorise = (actor: Role, action: FlagAction, environment: Environment): void => {
  if (!can(permissions, actor, action, environment)) {
    throw new ForbiddenError(MESSAGE.forbidden(action, environment));
  }
};

export async function listFlags(): Promise<FeatureFlag[]> {
  await sleep(LATENCY_MS.list);
  return flags;
}

async function commit(
  actor: Role,
  action: FlagAction,
  environment: Environment,
  key: string,
  update: (flag: FeatureFlag) => FeatureFlag,
): Promise<FeatureFlag> {
  await sleep(LATENCY_MS.mutation);
  authorise(actor, action, environment);

  flags = patchFlag(flags, key, update);

  const saved = flags.find((flag) => flag.key === key);
  if (!saved) throw new Error(MESSAGE.mutationFailed);
  return saved;
}

export const setPercentage = (
  actor: Role,
  environment: Environment,
  key: string,
  percentage: number,
): Promise<FeatureFlag> =>
  commit(actor, percentage === 0 || percentage === 100 ? 'toggle' : 'rollout', environment, key, (flag) =>
    withRule(flag, environment, { percentage }, today()),
  );

export const toggleRoleTarget = (
  actor: Role,
  environment: Environment,
  key: string,
  role: Role,
): Promise<FeatureFlag> =>
  commit(actor, 'rollout', environment, key, (flag) => withRoleTarget(flag, environment, role, today()));

export const setOverride = (
  actor: Role,
  environment: Environment,
  key: string,
  userId: string,
  value: boolean | null,
): Promise<FeatureFlag> =>
  commit(actor, 'rollout', environment, key, (flag) =>
    withOverride(flag, environment, userId, value, today()),
  );

export const setArchived = (
  actor: Role,
  environment: Environment,
  key: string,
  archived: boolean,
): Promise<FeatureFlag> =>
  commit(actor, 'archive', environment, key, (flag) => withArchived(flag, archived, today()));

/** Puts the demo data back to its seed state. */
export function resetFlagDb(): void {
  flags = FLAG_SEED;
}
