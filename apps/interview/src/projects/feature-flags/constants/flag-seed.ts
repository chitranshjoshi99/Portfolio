import type { AudienceUser, FeatureFlag, FlagRule } from '../feature-flags.types';

const rule = (percentage: number, roles: FlagRule['roles'] = [], overrides: FlagRule['overrides'] = {}): FlagRule => ({
  percentage,
  roles,
  overrides,
});

/**
 * Six flags covering every shape the evaluator has to handle: fully on, fully off, a partial
 * rollout that differs per environment, a role-targeted internal tool, a flag with a user
 * override, and an archived one.
 */
export const FLAG_SEED: FeatureFlag[] = [
  {
    key: 'checkout-v2',
    name: 'Checkout v2',
    description: 'Rewritten checkout with the single-page address step.',
    owner: 'payments',
    archived: false,
    updatedAt: '2026-07-28',
    rules: {
      dev: rule(100),
      staging: rule(100),
      prod: rule(25, ['owner']),
    },
  },
  {
    key: 'bulk-refunds',
    name: 'Bulk refunds',
    description: 'Refund an entire order batch from the ops console.',
    owner: 'ops-tools',
    archived: false,
    updatedAt: '2026-08-02',
    rules: {
      dev: rule(100),
      staging: rule(50),
      prod: rule(0, ['admin', 'owner']),
    },
  },
  {
    key: 'seller-analytics',
    name: 'Seller analytics tab',
    description: 'Revenue and traffic breakdown in the seller dashboard.',
    owner: 'growth',
    archived: false,
    updatedAt: '2026-08-05',
    rules: {
      dev: rule(100),
      staging: rule(100),
      prod: rule(50, [], { 'u-03': false }),
    },
  },
  {
    key: 'ai-reply-drafts',
    name: 'AI reply drafts',
    description: 'Suggested replies to buyer messages. Internal only for now.',
    owner: 'support',
    archived: false,
    updatedAt: '2026-08-07',
    rules: {
      dev: rule(100),
      staging: rule(10, ['developer', 'admin', 'owner']),
      prod: rule(0, ['owner'], { 'u-07': true }),
    },
  },
  {
    key: 'dark-mode',
    name: 'Dark mode',
    description: 'Theme toggle in account settings.',
    owner: 'design-systems',
    archived: false,
    updatedAt: '2026-06-19',
    rules: {
      dev: rule(100),
      staging: rule(100),
      prod: rule(100),
    },
  },
  {
    key: 'legacy-search',
    name: 'Legacy search fallback',
    description: 'Old search backend, kept behind a flag during the migration.',
    owner: 'search',
    archived: true,
    updatedAt: '2026-05-11',
    rules: {
      dev: rule(0),
      staging: rule(0),
      prod: rule(100, ['owner']),
    },
  },
];

/**
 * The sample audience the preview evaluates against. Small and fixed, so the same user always
 * lands in the same bucket and the demo is reproducible.
 */
export const AUDIENCE: AudienceUser[] = [
  { id: 'u-01', name: 'Anita R.', role: 'viewer' },
  { id: 'u-02', name: 'Bhavesh K.', role: 'viewer' },
  { id: 'u-03', name: 'Chen L.', role: 'viewer' },
  { id: 'u-04', name: 'Divya S.', role: 'viewer' },
  { id: 'u-05', name: 'Eshan M.', role: 'developer' },
  { id: 'u-06', name: 'Farah A.', role: 'developer' },
  { id: 'u-07', name: 'Gaurav T.', role: 'developer' },
  { id: 'u-08', name: 'Hana W.', role: 'admin' },
  { id: 'u-09', name: 'Ishan P.', role: 'admin' },
  { id: 'u-10', name: 'Jaya N.', role: 'owner' },
  { id: 'u-11', name: 'Kabir V.', role: 'viewer' },
  { id: 'u-12', name: 'Leena G.', role: 'viewer' },
];
