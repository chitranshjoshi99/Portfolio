/** Ordered least → most privileged. The order itself is not the rule — `ROLE_GRANTS` is. */
export type Role = 'viewer' | 'developer' | 'admin' | 'owner';

export type Environment = 'dev' | 'staging' | 'prod';

/** Everything a role can be allowed to do. Permissions are per action *and* per environment. */
export type FlagAction = 'view' | 'toggle' | 'rollout' | 'archive';

/** Declarative grant table entry. `inherits` is flattened once, never walked per check. */
export interface RoleGrant {
  inherits?: Role;
  /** action -> environments in which this role may perform it. */
  grants: Partial<Record<FlagAction, Environment[]>>;
}

/** `role -> Set<"action:environment">`. Built once from `ROLE_GRANTS`; every check is O(1). */
export type PermissionIndex = Record<Role, Set<string>>;

/** Targeting for one flag in one environment. A flag is never "on" globally. */
export interface FlagRule {
  /** Roles that get the flag regardless of the percentage — internal dogfooding. */
  roles: Role[];
  /** 0–100. Share of everyone else, chosen deterministically, not randomly. */
  percentage: number;
  /** userId -> forced value. Beats the roles and the percentage, not the kill switch. */
  overrides: Record<string, boolean>;
}

export interface FeatureFlag {
  /** Stable key used in code (`isOn('checkout-v2')`) and as the hash salt. Never renamed. */
  key: string;
  name: string;
  description: string;
  owner: string;
  /** Kill switch. An archived flag evaluates off everywhere, whatever the rules say. */
  archived: boolean;
  /** ISO date — kept as a string so it stays serialisable. */
  updatedAt: string;
  /** One rule set per environment. Promoting a rollout means copying rules, not flipping a bit. */
  rules: Record<Environment, FlagRule>;
}

export interface AudienceUser {
  id: string;
  name: string;
  role: Role;
}

/** Why the evaluator decided what it decided. The UI shows this, not just the boolean. */
export type EvaluationReason = 'archived' | 'override' | 'role' | 'bucket' | 'default';

export interface Evaluation {
  enabled: boolean;
  reason: EvaluationReason;
  /** 0–99, stable for this (flag, user) pair. Shown so the bucket rule is inspectable. */
  bucket: number;
}

/** The pill on a row: what the rule does for an untargeted user with no override. */
export type FlagState = 'on' | 'rollout' | 'off';
