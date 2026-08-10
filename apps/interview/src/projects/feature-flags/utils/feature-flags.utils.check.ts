/**
 * ponytail: no test framework installed — run with
 * `node src/projects/feature-flags/utils/feature-flags.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { ENVIRONMENTS, ROLES, ROLE_GRANTS } from '../constants/feature-flags.constants.ts';
import { AUDIENCE, FLAG_SEED } from '../constants/flag-seed.ts';
import type { AudienceUser, FeatureFlag, FlagAction, Role, RoleGrant } from '../feature-flags.types.ts';
import {
  buildPermissionIndex,
  can,
  canByWalk,
  grantedActions,
  writableEnvironments,
} from './rbac.utils.ts';
import {
  evaluate,
  exposure,
  filterFlags,
  flagState,
  hashBucket,
  hashBucketUnsalted,
  patchFlag,
  withArchived,
  withOverride,
  withRoleTarget,
  withRule,
} from './rollout.utils.ts';

const ACTIONS: FlagAction[] = ['view', 'toggle', 'rollout', 'archive'];
const NOW = '2026-08-10';
const PERMISSIONS = buildPermissionIndex(ROLE_GRANTS, ROLES);
const flagBy = (key: string): FeatureFlag => FLAG_SEED.find((flag) => flag.key === key)!;
const userBy = (id: string): AudienceUser => AUDIENCE.find((user) => user.id === id)!;

// --- RBAC ------------------------------------------------------------------------------------

// the model, stated as assertions: this is the table an interviewer will read first
assert.equal(can(PERMISSIONS, 'viewer', 'view', 'prod'), true);
assert.equal(can(PERMISSIONS, 'viewer', 'toggle', 'dev'), false);
assert.equal(can(PERMISSIONS, 'developer', 'toggle', 'staging'), true);
assert.equal(can(PERMISSIONS, 'developer', 'toggle', 'prod'), false); // the whole point of per-env grants
assert.equal(can(PERMISSIONS, 'admin', 'toggle', 'prod'), true);
assert.equal(can(PERMISSIONS, 'admin', 'archive', 'prod'), false);
assert.equal(can(PERMISSIONS, 'owner', 'archive', 'prod'), true);

// differential test: the flattened index must agree with walking the chain on every check
let checks = 0;
for (const role of ROLES) {
  for (const action of ACTIONS) {
    for (const environment of ENVIRONMENTS) {
      assert.equal(
        can(PERMISSIONS, role, action, environment),
        canByWalk(ROLE_GRANTS, role, action, environment),
        `index ≠ walk for ${role}/${action}/${environment}`,
      );
      checks += 1;
    }
  }
}
console.log(`differential: ${checks} permission checks, index === walk`);

// inheritance really is a superset relation — a role can never lose a grant by being promoted
const supersets: [Role, Role][] = [
  ['developer', 'viewer'],
  ['admin', 'developer'],
  ['owner', 'admin'],
];
for (const [higher, lower] of supersets) {
  for (const key of PERMISSIONS[lower]) {
    assert.ok(PERMISSIONS[higher].has(key), `${higher} is missing ${key} held by ${lower}`);
  }
  assert.ok(PERMISSIONS[higher].size > PERMISSIONS[lower].size, `${higher} adds nothing over ${lower}`);
}

// the index is derived, not stateful: rebuilding produces the same sets
const rebuilt = buildPermissionIndex(ROLE_GRANTS, ROLES);
for (const role of ROLES) assert.deepEqual([...rebuilt[role]].sort(), [...PERMISSIONS[role]].sort());

assert.deepEqual(grantedActions(PERMISSIONS, 'developer', 'prod', ACTIONS), ['view']);
assert.deepEqual(grantedActions(PERMISSIONS, 'admin', 'prod', ACTIONS), ['view', 'toggle', 'rollout']);
assert.deepEqual(writableEnvironments(PERMISSIONS, 'developer', ENVIRONMENTS), ['dev', 'staging']);
assert.deepEqual(writableEnvironments(PERMISSIONS, 'viewer', ENVIRONMENTS), []);

// a cyclic grant table must terminate rather than hang — config is data, and data has typos
const cyclic = {
  viewer: { inherits: 'owner', grants: { view: ['dev'] } },
  developer: { inherits: 'viewer', grants: {} },
  admin: { inherits: 'developer', grants: {} },
  owner: { inherits: 'admin', grants: { archive: ['dev'] } },
} as Record<Role, RoleGrant>;
const cyclicIndex = buildPermissionIndex(cyclic, ROLES);
assert.equal(can(cyclicIndex, 'viewer', 'archive', 'dev'), true);
assert.equal(canByWalk(cyclic, 'developer', 'view', 'staging'), false);

// --- bucketing -------------------------------------------------------------------------------

// sticky: the same pair always lands in the same bucket, in range
for (const user of AUDIENCE) {
  const first = hashBucket('checkout-v2', user.id);
  assert.equal(first, hashBucket('checkout-v2', user.id));
  assert.ok(first >= 0 && first < 100 && Number.isInteger(first));
}

// uniform: 10k ids over 100 buckets should land near 100 each, and hit every bucket
const counts: number[] = Array.from({ length: 100 }, () => 0);
for (let at = 0; at < 10_000; at += 1) counts[hashBucket('checkout-v2', `user-${at}`)] += 1;
assert.ok(Math.min(...counts) > 55, `some bucket is starved: ${Math.min(...counts)}`);
assert.ok(Math.max(...counts) < 155, `some bucket is crowded: ${Math.max(...counts)}`);

// salted: two flags must not pick the same cohort. unsalted, they always do.
let sameSalted = 0;
let sameUnsalted = 0;
for (let at = 0; at < 1_000; at += 1) {
  const id = `user-${at}`;
  if (hashBucket('checkout-v2', id) === hashBucket('bulk-refunds', id)) sameSalted += 1;
  if (hashBucketUnsalted('checkout-v2', id) === hashBucketUnsalted('bulk-refunds', id)) sameUnsalted += 1;
}
assert.equal(sameUnsalted, 1_000); // every user, every flag, the same bucket — the bug
assert.ok(sameSalted < 40, `salt is not decorrelating: ${sameSalted}/1000 collide`);

// monotonic: raising the percentage only ever adds users, never removes one mid-rollout
const monotonic = flagBy('seller-analytics');
let previous = new Set<string>();
for (let percentage = 0; percentage <= 100; percentage += 5) {
  const staged = withRule(monotonic, 'prod', { percentage, roles: [], overrides: {} }, NOW);
  const enabled = new Set(
    AUDIENCE.filter((user) => evaluate(staged, 'prod', user).enabled).map((user) => user.id),
  );
  for (const id of previous) assert.ok(enabled.has(id), `${id} lost the flag at ${percentage}%`);
  previous = enabled;
}
assert.equal(previous.size, AUDIENCE.length);

// --- evaluation order --------------------------------------------------------------------------

const analytics = flagBy('seller-analytics');
const chen = userBy('u-03'); // seeded with an override of false against a 50% rollout

// override beats the bucket, in both directions
assert.deepEqual(evaluate(analytics, 'prod', chen), { enabled: false, reason: 'override', bucket: hashBucket('seller-analytics', 'u-03') });
const forcedOn = withOverride(analytics, 'prod', 'u-03', true, NOW);
assert.equal(evaluate(forcedOn, 'prod', chen).enabled, true);
assert.equal(evaluate(forcedOn, 'prod', chen).reason, 'override');

// clearing hands the user back to the normal rules
const cleared = withOverride(forcedOn, 'prod', 'u-03', null, NOW);
assert.notEqual(evaluate(cleared, 'prod', chen).reason, 'override');

// the kill switch sits above the override — archived means off for everyone, including forced-on
assert.equal(evaluate(withArchived(forcedOn, true, NOW), 'prod', chen).enabled, false);
assert.equal(evaluate(withArchived(forcedOn, true, NOW), 'prod', chen).reason, 'archived');
assert.ok(AUDIENCE.every((user) => !evaluate(flagBy('legacy-search'), 'prod', user).enabled));

// role targeting beats a 0% rollout
const aiDrafts = flagBy('ai-reply-drafts');
const owner = evaluate(aiDrafts, 'prod', userBy('u-10'));
assert.equal(owner.enabled, true);
assert.equal(owner.reason, 'role');
assert.equal(evaluate(aiDrafts, 'prod', userBy('u-01')).enabled, false);
assert.equal(evaluate(aiDrafts, 'prod', userBy('u-07')).reason, 'override'); // seeded force-on

// the boundary is `<`, not `<=`: 0–99 buckets mean n% covers buckets 0..n-1
const kabir = userBy('u-11');
const kabirBucket = hashBucket('seller-analytics', 'u-11');
const atBoundary = withRule(analytics, 'prod', { percentage: kabirBucket, roles: [], overrides: {} }, NOW);
const oneMore = withRule(analytics, 'prod', { percentage: kabirBucket + 1, roles: [], overrides: {} }, NOW);
assert.equal(evaluate(atBoundary, 'prod', kabir).enabled, false);
assert.equal(evaluate(oneMore, 'prod', kabir).enabled, true);

// 0 and 100 short-circuit to the rule default rather than consulting a bucket
assert.equal(evaluate(flagBy('dark-mode'), 'prod', kabir).reason, 'default');
assert.equal(evaluate(flagBy('dark-mode'), 'prod', kabir).enabled, true);

// environments are independent: the same flag, the same user, two answers
const checkout = flagBy('checkout-v2');
assert.equal(evaluate(checkout, 'dev', kabir).enabled, true);
assert.equal(
  evaluate(checkout, 'prod', kabir).enabled,
  hashBucket('checkout-v2', 'u-11') < 25,
);

// --- derived views ------------------------------------------------------------------------------

assert.equal(exposure(flagBy('dark-mode'), 'prod', AUDIENCE), AUDIENCE.length);
assert.equal(exposure(flagBy('legacy-search'), 'prod', AUDIENCE), 0);
assert.equal(
  exposure(checkout, 'prod', AUDIENCE),
  AUDIENCE.filter((user) => evaluate(checkout, 'prod', user).enabled).length,
);

assert.equal(flagState(flagBy('dark-mode'), 'prod'), 'on');
assert.equal(flagState(checkout, 'prod'), 'rollout');
assert.equal(flagState(flagBy('bulk-refunds'), 'prod'), 'rollout'); // 0%, but role-targeted
assert.equal(flagState(flagBy('legacy-search'), 'prod'), 'off'); // archived, despite 100%

assert.equal(filterFlags(FLAG_SEED, 'prod', 'refund', 'all').length, 1);
assert.equal(filterFlags(FLAG_SEED, 'prod', '  PAYMENTS ', 'all')[0].key, 'checkout-v2');
assert.equal(filterFlags(FLAG_SEED, 'prod', '', 'on').every((flag) => flagState(flag, 'prod') === 'on'), true);
assert.equal(filterFlags(FLAG_SEED, 'prod', '', 'all').length, FLAG_SEED.length);

// --- writes are immutable and clamped -------------------------------------------------------------

const raised = withRule(checkout, 'prod', { percentage: 140 }, NOW);
assert.equal(raised.rules.prod.percentage, 100); // clamped at the store, not at the input
assert.equal(withRule(checkout, 'prod', { percentage: -5 }, NOW).rules.prod.percentage, 0);
assert.equal(checkout.rules.prod.percentage, 25); // the seed is untouched
assert.equal(raised.rules.dev, checkout.rules.dev); // other environments are shared, not copied
assert.equal(raised.updatedAt, NOW);

const targeted = withRoleTarget(checkout, 'prod', 'admin', NOW);
assert.deepEqual(targeted.rules.prod.roles, ['owner', 'admin']);
assert.deepEqual(withRoleTarget(targeted, 'prod', 'admin', NOW).rules.prod.roles, ['owner']); // toggles off
assert.deepEqual(checkout.rules.prod.roles, ['owner']);

const patched = patchFlag(FLAG_SEED, 'checkout-v2', (flag) => withArchived(flag, true, NOW));
assert.equal(patched.find((flag) => flag.key === 'checkout-v2')!.archived, true);
assert.equal(FLAG_SEED.find((flag) => flag.key === 'checkout-v2')!.archived, false);
assert.equal(patched.filter((flag, at) => flag !== FLAG_SEED[at]).length, 1); // exactly one row changed

console.log('feature-flags utils: all checks passed');
