import type {
  AudienceUser,
  Environment,
  Evaluation,
  FeatureFlag,
  FlagRule,
  FlagState,
  Role,
} from '../feature-flags.types';

/**
 * FNV-1a over `flagKey:userId`, folded to 0–99.
 *
 * Three properties matter, and all three come from it being a *hash of the pair* rather than a
 * random number:
 *
 * - **Sticky** — the same user gets the same bucket on every render, every reload, and on the
 *   server. A rollout that flickers per render is not a rollout, it is a bug users can see.
 * - **Salted by the flag key** — without the salt every 10% rollout picks the same unlucky
 *   cohort, and one user eats every experiment on the site at once.
 * - **Monotonic** — the bucket does not depend on the percentage, so raising 10 → 20 only ever
 *   adds users. Nobody has a feature taken away mid-rollout.
 *
 * `Math.imul` is what keeps the multiply in 32-bit; plain `*` overflows into a float and the
 * distribution stops being uniform. `>>> 0` makes the result unsigned before the modulo.
 */
export const hashBucket = (flagKey: string, userId: string): number => {
  const seed = `${flagKey}:${userId}`;
  let hash = 0x811c9dc5;
  for (let at = 0; at < seed.length; at += 1) {
    hash ^= seed.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
};

/** V2 of the ladder: sticky, but unsalted. Kept so the check file can show the correlation. */
export const hashBucketUnsalted = (_flagKey: string, userId: string): number =>
  hashBucket('', userId);

/**
 * The evaluator. Order is most-specific-first, with one deliberate exception: the kill switch
 * sits above the overrides, because "archived" has to mean off for everyone including the person
 * who forced it on.
 *
 * It returns *why*, not just the boolean. Every real flag system grows this, because the first
 * production question is never "is it on" — it is "why is it on for them and not me".
 */
export const evaluate = (flag: FeatureFlag, environment: Environment, user: AudienceUser): Evaluation => {
  const bucket = hashBucket(flag.key, user.id);
  if (flag.archived) return { enabled: false, reason: 'archived', bucket };

  const rule = flag.rules[environment];

  const override = rule.overrides[user.id];
  if (override !== undefined) return { enabled: override, reason: 'override', bucket };

  if (rule.roles.includes(user.role)) return { enabled: true, reason: 'role', bucket };

  if (rule.percentage >= 100) return { enabled: true, reason: 'default', bucket };
  if (rule.percentage <= 0) return { enabled: false, reason: 'default', bucket };

  // `<` not `<=`: buckets are 0–99, so 25% must mean buckets 0–24, not 0–25.
  return { enabled: bucket < rule.percentage, reason: 'bucket', bucket };
};

/** How many of a known audience the flag is on for — the row's exposure figure. */
export const exposure = (flag: FeatureFlag, environment: Environment, users: AudienceUser[]): number =>
  users.reduce((total, user) => total + (evaluate(flag, environment, user).enabled ? 1 : 0), 0);

/**
 * The headline pill. Describes the rule for an untargeted user with no override — the overrides
 * are per user and cannot be summarised in one word, which is exactly why the row also shows
 * exposure.
 */
export const flagState = (flag: FeatureFlag, environment: Environment): FlagState => {
  if (flag.archived) return 'off';
  const rule = flag.rules[environment];
  if (rule.percentage >= 100) return 'on';
  if (rule.percentage <= 0 && rule.roles.length === 0) return 'off';
  return 'rollout';
};

export const matchesSearch = (flag: FeatureFlag, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return `${flag.key} ${flag.name} ${flag.description} ${flag.owner}`.toLowerCase().includes(needle);
};

export const filterFlags = (
  flags: FeatureFlag[],
  environment: Environment,
  search: string,
  state: FlagState | 'all',
): FeatureFlag[] =>
  flags.filter(
    (flag) => matchesSearch(flag, search) && (state === 'all' || flagState(flag, environment) === state),
  );

// --- writes: pure, immutable, and shared by the fake server and the optimistic client ---------

const clampPercentage = (percentage: number): number =>
  Math.min(100, Math.max(0, Math.round(percentage)));

export const withRule = (
  flag: FeatureFlag,
  environment: Environment,
  patch: Partial<FlagRule>,
  now: string,
): FeatureFlag => ({
  ...flag,
  updatedAt: now,
  rules: {
    ...flag.rules,
    [environment]: {
      ...flag.rules[environment],
      ...patch,
      // Clamped here rather than at the input, so a bad value from any caller — including a
      // hand-written API request — cannot land a 140% rollout in the store.
      ...(patch.percentage === undefined ? {} : { percentage: clampPercentage(patch.percentage) }),
    },
  },
});

export const withRoleTarget = (
  flag: FeatureFlag,
  environment: Environment,
  role: Role,
  now: string,
): FeatureFlag => {
  const { roles } = flag.rules[environment];
  const next = roles.includes(role) ? roles.filter((current) => current !== role) : [...roles, role];
  return withRule(flag, environment, { roles: next }, now);
};

/** `value === null` clears the override and hands the user back to the normal rules. */
export const withOverride = (
  flag: FeatureFlag,
  environment: Environment,
  userId: string,
  value: boolean | null,
  now: string,
): FeatureFlag => {
  const { [userId]: _dropped, ...rest } = flag.rules[environment].overrides;
  const overrides = value === null ? rest : { ...rest, [userId]: value };
  return withRule(flag, environment, { overrides }, now);
};

export const withArchived = (flag: FeatureFlag, archived: boolean, now: string): FeatureFlag => ({
  ...flag,
  archived,
  updatedAt: now,
});

/** Replace one flag in a list by key. O(n) over a page of flags, and immutable. */
export const patchFlag = (
  flags: FeatureFlag[],
  key: string,
  update: (flag: FeatureFlag) => FeatureFlag,
): FeatureFlag[] => flags.map((flag) => (flag.key === key ? update(flag) : flag));
