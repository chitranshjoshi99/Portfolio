# Feature Flag Control — Interview Build Guide

Build a feature-flag console with role-based access control: per-environment role grants, a
deterministic percentage rollout, per-user overrides, optimistic writes that roll back on a 403,
and a live "who sees this" preview that explains every decision. Plain JavaScript, fresh
CodeSandbox. Target 45–60 minutes.

This guide is a script for the room: what to ask, what to say, what to type, and where to stop.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Permissions | **Flattened grant table** — role inheritance collapsed once into a `Set` of `"action:environment"` keys, so every check is `O(1)` and lives in one function. |
| Rollout | **`hash(flagKey + userId) % 100`** — sticky, salted per flag, monotonic under an increasing percentage. No randomness anywhere. |
| Authorisation | Client `can()` **disables** controls; the fake server runs the same check and **decides**. The demo switch proves which one matters. |
| Discussed, not built | Permission bitmasks, attribute-based rules (ABAC), consistent hashing for cohort stability across a changing user set, streaming flag updates, audit log. |

The version most candidates write is `Math.random() < percentage` behind a `role === 'admin'`
check. Both are on the ladder, each with the precise reason it loses — a random draw is not sticky,
and a scattered role check is a permission model you cannot audit.

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–6 | Requirements — the RBAC model is the whole conversation |
| 6–12 | HLD, the flag record, the two evaluation questions |
| 12–24 | Permissions: the grant table and the ladder to an `O(1)` index |
| 24–36 | Rollout: the bucketing ladder, sticky and salted |
| 36–46 | The console: optimistic writes, 403 rollback |
| 46–54 | Audience preview with reasons, per-user overrides |
| 54–60 | Demo, and where client-side authorisation stops being security |

---

## 0. Sandbox setup

React + JS, one file, split later.

```text
src/
  App.jsx
  styles.css
```

Target split (this repo's layout):

```text
feature-flags/
  index.tsx
  feature-flags.types.ts                    # Role, Environment, FlagAction, FlagRule, FeatureFlag
  feature-flags.css
  constants/feature-flags.constants.ts      # ROLE_GRANTS, labels, rollout steps, messages
  constants/flag-seed.ts                    # seed flags + the sample audience
  utils/rbac.utils.ts                       # pure: buildPermissionIndex, can, canByWalk
  utils/rollout.utils.ts                    # pure: hashBucket, evaluate, exposure, withRule…
  utils/flag-api.ts                         # fake service: latency + server-side authorisation
  hooks/use-flag-console.ts                 # role/env state, list, optimistic mutations
  hooks/use-audience-preview.ts             # selected flag evaluated across the audience
  components/role-switcher.tsx
  components/flag-toolbar.tsx
  components/flag-row.tsx
  components/rollout-control.tsx
  components/audience-preview.tsx
```

Both interesting parts are pure functions with no React in them: *may this role do this here* and
*does this user see this flag*. Say that out loud — it is the sentence the rest of the hour hangs on.

Note the boundary this repo keeps: `utils/` are pure and import nothing but types, so the grant
table is passed **into** `buildPermissionIndex` rather than imported by it. That is what lets the
whole authorisation model be run and tested outside React, including against a deliberately broken
table.

---

## 1. Requirement gathering (6 minutes)

1. **"What are the roles, and is the hierarchy strict?"**
   Strict inheritance (owner ⊃ admin ⊃ developer ⊃ viewer) means one `inherits` pointer per role.
   Non-strict means an arbitrary grant set per role, and the flattening below gets simpler, not
   harder.
   *Default: viewer / developer / admin / owner, strict.*
2. **"Are permissions per environment, or global?"**
   The pivotal question. "Can toggle" is meaningless on its own — a developer flipping a flag in
   dev is Tuesday, the same developer flipping it in prod is an incident. Per-environment grants
   change the key of the permission index.
   *Default: per environment. Developers write in dev and staging, admins in prod, owners can
   archive.*
3. **"Is a flag on/off, or a percentage?"**
   Percentage means an assignment rule, which means the hashing conversation.
   *Default: percentage, plus role targeting and per-user overrides.*
4. **"Must a user's assignment be stable across reloads and across the server?"**
   If yes — and it always is — randomness is out before it is proposed.
   *Default: yes, stable everywhere, which forces a hash of (flag, user).*
5. **"When we raise 10% to 20%, may anyone lose the feature?"**
   *Default: no. That is a monotonicity requirement, and it falls out of hashing the user rather
   than the rollout.*
6. **"Is the client's permission check load-bearing, or is there a server?"**
   *Default: there is a server; the client check is UX only. I'll show both, and show them
   disagreeing.*
7. **"Do we need an audit trail of who changed what?"**
   *Default: out of scope, mentioned in the data model.*

State the plan:

> "Two pure functions do the work. `can(role, action, environment)` answers permissions off a
> flattened grant table, so there is exactly one place that knows the rules. `evaluate(flag, env,
> user)` answers exposure with a hash of the flag key and the user id, so assignment is sticky,
> uncorrelated between flags, and monotonic when we raise the percentage. The UI disables what the
> role cannot do; the server independently rejects it, and I'll demo the difference."

---

## 2. High-level design (HLD)

```text
  ┌───────────────┐  role, environment
  │ RoleSwitcher  │ ──────────────┐
  └───────────────┘               │
                                  ▼
  ROLE_GRANTS (config)   ┌────────────────────────┐
   viewer  → view        │ buildPermissionIndex() │  flatten inheritance ONCE
   dev     → viewer +…   │  role -> Set(          │  → { "toggle:dev", "rollout:dev", … }
   admin   → dev +…      │      "action:env" )    │
   owner   → admin +…    └───────────┬────────────┘
                                     │ can(index, role, action, env)   O(1)
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
        ┌────────────────────────┐       ┌──────────────────────────────┐
        │ UI: disabled / enabled │       │ flag-api: authorise() → 403  │ ← the real check
        │  (UX, bypassable)      │       │  same table, separate copy   │
        └────────────────────────┘       └──────────────┬───────────────┘
                                                        │ saved flag
  ┌──────────────────────────────────────────────────────┴──────────────────────┐
  │ useFlagConsole:  flags[], pendingKeys, errorByKey                            │
  │   optimistic patch → request → replace with server row | roll back + 403 msg │
  └───────────────┬──────────────────────────────────────────────┬──────────────┘
                  │ props                                        │ selected flag
                  ▼                                              ▼
     ┌──────────────────────────┐                 ┌──────────────────────────────┐
     │ <FlagRow> × n            │                 │ useAudiencePreview           │
     │  RolloutControl (%, roles)│                │  AUDIENCE.map(user =>        │
     └──────────────────────────┘                 │    evaluate(flag, env, user))│
                                                  └──────────────┬───────────────┘
                                                                 ▼
                                            evaluate():  archived → override → role
                                                         → 0/100 → bucket < percentage
```

Four claims about the picture:

- **The grant table is data, not code.** "Developers can now change targeting in staging" is a
  one-line edit to a config object. If that rule lives in JSX, the same change is a hunt through
  components, and the one you miss is the security bug.
- **The permission index is derived, and derived once.** Nothing writes to it, so it cannot drift
  from the table it came from; flattening at build means no check walks the inheritance chain.
- **The client check and the server check are the same function over the same table, deliberately
  called twice.** One decides what to disable, the other decides what happens. Conflating them is
  the classic front-end authorisation bug.
- **Evaluation returns a reason, not a boolean.** The first question in production is never "is it
  on" — it is "why is it on for them and not me". A boolean cannot answer that.

---

## 3. Low-level design (LLD)

### State

```js
const [role, setRole] = useState('developer');          // whose permissions we are viewing with
const [environment, setEnvironment] = useState('prod'); // half of every permission key
const [search, setSearch] = useState('');
const [stateFilter, setStateFilter] = useState('all');

const [allFlags, setAllFlags] = useState([]);           // the server's rows, unfiltered
const [isLoading, setIsLoading] = useState(true);
const [listError, setListError] = useState(null);
const [reloadToken, setReloadToken] = useState(0);      // bump to refetch

const [pendingKeys, setPendingKeys] = useState(new Set());   // per row: a write in flight
const [errorByKey, setErrorByKey] = useState({});             // per row: why the write failed

const latestRequestId = useRef(0);   // only the newest list response may write to state
```

Two notes worth saying while typing them. `pendingKeys` is a `Set` and `errorByKey` is keyed by
flag, not a single global `isSaving` / `error` — two rows can be in flight at once, and a global
slot would show one row's 403 under another row's name. And `permissions` is **not** state: it is
`useMemo(() => buildPermissionIndex(ROLE_GRANTS, ROLES), [])`, because a derived value that is
stored is a derived value that can go stale.

### Function signatures

```js
buildPermissionIndex(grants, roles)          -> { role: Set("action:env") }
can(index, role, action, environment)        -> boolean            // O(1)
canByWalk(grants, role, action, environment) -> boolean            // the oracle, not the read path
grantedActions(index, role, env, actions)    -> action[]           // the matrix in the UI

hashBucket(flagKey, userId)                  -> 0..99              // sticky, salted
evaluate(flag, environment, user)            -> { enabled, reason, bucket }
exposure(flag, environment, users)           -> number
flagState(flag, environment)                 -> 'on' | 'rollout' | 'off'

withRule(flag, env, patch, now)              -> flag               // immutable writes,
withRoleTarget(flag, env, role, now)         -> flag               //   shared by the fake server
withOverride(flag, env, userId, value, now)  -> flag               //   and the optimistic client
withArchived(flag, archived, now)            -> flag
patchFlag(flags, key, update)                -> flags
```

---

## 4. The data model

```json
{
  "key": "checkout-v2",
  "name": "Checkout v2",
  "description": "Rewritten checkout with the single-page address step.",
  "owner": "payments",
  "archived": false,
  "updatedAt": "2026-07-28",
  "rules": {
    "dev":     { "percentage": 100, "roles": [], "overrides": {} },
    "staging": { "percentage": 100, "roles": [], "overrides": {} },
    "prod":    { "percentage": 25,  "roles": ["owner"], "overrides": { "u-03": false } }
  }
}
```

The real fork is **rules nested under the flag** versus **a flat table of `(flagKey, environment)`
rows**:

| | `rules: { dev, staging, prod }` on the flag | Flat `[{ flagKey, env, … }]` rows |
| --- | --- | --- |
| Read one flag everywhere | one object, one fetch | filter or index by `flagKey` |
| Read one environment | `flag.rules[env]` — the console's actual query | index by `env` |
| Promote dev → prod | copy one sub-object | copy a row |
| Add an environment | touches every flag record | insert rows |
| SDK payload | send only `rules[env]` for the environment the SDK is in | same |

Nested wins here because every screen and every SDK is scoped to exactly one environment, so the
lookup is a property access with no index to keep in sync. A flag service with hundreds of
environments per project flips that answer.

Field notes worth saying:

- **`key` is the identity and the hash salt.** It appears in application code as `isOn('checkout-v2')`
  and it seeds the bucket, so renaming a key is not cosmetic — it re-shuffles everybody.
- **`percentage` is per environment, never global.** "The flag is at 25%" is not a fact until you
  say where.
- **`overrides` is a map, not a list**, because the evaluator's first question is "is there one for
  *this* user" — that has to be a lookup, not a scan.
- **`archived` is a flag on the record, not a deletion.** A deleted flag key still exists in shipped
  clients; archiving keeps the key reserved and forces it off.
- **`roles` on a rule is targeting, not permission.** Easy to conflate, and worth separating out
  loud: `rules.prod.roles = ['owner']` means owners *see* the feature; `ROLE_GRANTS.owner` means
  owners can *change* it.

---

## 5. Pass 1 — the permission ladder (target: 12 minutes)

Frame it: *"Permissions are the part that has to be one function. Let me walk the versions."*

Let **r** = roles, **a** = actions, **e** = environments, **d** = inheritance depth.

### V0 — Brute force: inline role checks

```js
{user.role === 'admin' && <button onClick={turnOn}>Turn on</button>}
{(user.role === 'admin' || user.role === 'owner') && <button onClick={archive}>Archive</button>}
```

Cost: `O(1)` per check and zero setup — this is never rejected for speed. It is rejected because
the model is spread across every component that renders a control, so nobody can answer "what can a
developer do?" without grepping, and adding a role means editing every one of those lines. The
`||` chain above is already wrong: it grants admins archive.

**Failure mode:** the rule exists in *n* places, so it is wrong in at least one.

### V1 — One function that walks the hierarchy

```js
const ROLE_GRANTS = {
  viewer:    { grants: { view: ['dev', 'staging', 'prod'] } },
  developer: { inherits: 'viewer', grants: { toggle: ['dev','staging'], rollout: ['dev','staging'] } },
  admin:     { inherits: 'developer', grants: { toggle: ['prod'], rollout: ['prod'] } },
  owner:     { inherits: 'admin', grants: { archive: ['dev','staging','prod'] } },
};

const canByWalk = (grants, role, action, environment) => {
  const seen = new Set();
  for (let current = role; current && !seen.has(current); ) {
    seen.add(current);
    const grant = grants[current];
    if (grant.grants[action]?.includes(environment)) return true;
    current = grant.inherits;   // climb: admin → developer → viewer
  }
  return false;
};
```

The model is now in one object and one function. Cost per check: `O(d × e)` — walk up to `d`
ancestors, `includes` scans the environment list at each. With d = 4 that is nothing.

**Failure mode:** not performance — it is that the answer is recomputed for every control on every
render, and that the shape (`grants[action]?.includes(env)`) makes it awkward to ask the inverse
question the UI also needs: *what can this role do here?*

Keep `canByWalk`. It becomes the oracle the next rung is tested against.

### V2 — Flatten the inheritance once into a Set ← **build this**

```js
const grantKey = (action, environment) => `${action}:${environment}`;

const buildPermissionIndex = (grants, roles) => {
  const index = {};
  for (const role of roles) {
    const keys = new Set();
    const seen = new Set();
    for (let current = role; current && !seen.has(current); ) {
      seen.add(current);
      const grant = grants[current];
      for (const [action, environments] of Object.entries(grant.grants)) {
        for (const environment of environments ?? []) keys.add(grantKey(action, environment));
      }
      current = grant.inherits;
    }
    index[role] = keys;
  }
  return index;
};

const can = (index, role, action, environment) => index[role].has(grantKey(action, environment));
```

Build cost `O(r × d × a × e)` — once, at module load, over a table with four rows. Check cost is a
`Set.has` on a pre-built string key: `O(1)`, and no allocation, so it is safe to call in a render
for every control on the screen.

Two things to say while typing it:

- **The `seen` guard is not ceremony.** The grant table is config. A typo that points two roles at
  each other turns the walk into an infinite loop — an authorisation table that can hang the tab.
  Terminating on a cycle is the difference between a broken config and a broken product.
- **Set-of-strings, not nested objects,** because the question is always the full pair. Storing
  `{ toggle: ['dev'] }` per role would leave every check doing an array scan again.

### V3 — Bitmask capabilities (discuss, do not build)

```js
const ACTION_BIT = { view: 1, toggle: 2, rollout: 4, archive: 8 };
// index[role][environment] = 0b1111
const can = (index, role, action, env) => (index[role][env] & ACTION_BIT[action]) !== 0;
```

One integer per (role, environment) instead of a `Set` of strings, comparisons are a single `&`,
and a whole permission set fits in a column or a JWT claim. It is the right answer when permissions
are checked millions of times per second or shipped inside a token. It is the wrong answer here: it
caps you at 32 actions, and it trades readable keys for a number nobody can debug at 3am.

### Comparison

| Version | Setup | Per check | Model lives in | Verdict |
| --- | --- | --- | --- | --- |
| V0 inline `role ===` | none | `O(1)` | every component | unauditable, wrong in at least one place |
| V1 walk the chain | none | `O(d × e)` | one function | correct, recomputed constantly |
| V2 flattened `Set` | `O(r×d×a×e)` once | `O(1)` | one table + one function | **ship this** |
| V3 bitmask | same | `O(1)`, one `&` | one table | for tokens and hot paths, not for a console |

**Why V2 wins:** what actually changed between V1 and V2 is not the complexity class of a four-row
walk — it is *when* the work happens. Inheritance is resolved at build time, so the read path stops
knowing that inheritance exists. That is also what makes `grantedActions` (the permission matrix in
the UI) a filter over a `Set` rather than a second traversal.

**In a 45-minute interview: ship V2**, and say the sentence that earns the rung: "the index is
derived from the table and rebuilt from it, never edited, so it cannot drift."

Verify the rung before moving on — the flattened index has to agree with the obvious walk:

```js
for (const role of ROLES)
  for (const action of ACTIONS)
    for (const env of ENVIRONMENTS)
      assert(can(index, role, action, env) === canByWalk(ROLE_GRANTS, role, action, env));
```

---

## 6. Pass 2 — the rollout ladder (target: 12 minutes)

Frame it: *"Now the other question: given a flag at 25%, does this user see it? The naive version
is one character away from looking right."*

Let **u** = users, **f** = flags.

### V0 — `Math.random() < percentage / 100`

```js
const isOn = (rule) => Math.random() < rule.percentage / 100;   // wrong
```

`O(1)` and exactly the right *proportion*. It is still wrong, because the assignment is not a
property of the user: the flag flips on every render, so a component that checks it twice renders
two different UIs, and a reload puts the user in a different cohort. The proportion is right and
the product is broken.

**Failure mode:** not sticky. Any per-user requirement — analytics, support ("why did it vanish?"),
a funnel measured over a session — is unsatisfiable.

### V1 — Store the assignment per user

```js
if (!assignments[userId]) assignments[userId] = Math.random() < pct;   // persist somewhere
```

Sticky, and honest. But now assignment is *state*: it needs storage, it needs to be readable from
every service that evaluates the flag, and raising the percentage means walking the stored set and
promoting some fraction of it. You have turned a computation into a database table.

**Failure mode:** the assignment must be recomputed identically on the server, in the browser, and
in an offline mobile client. Shared mutable state cannot do that; a pure function can.

### V2 — Hash the user id ← **almost right**

```js
const hashBucket = (userId) => {          // unsalted
  let hash = 0x811c9dc5;                  // FNV-1a
  for (let at = 0; at < userId.length; at += 1) {
    hash ^= userId.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
};
const isOn = (rule, userId) => hashBucket(userId) < rule.percentage;
```

Sticky and stateless — same answer everywhere, forever, with no storage. `O(len(id))`, which is
`O(1)` for real ids.

**Failure mode:** every flag picks the *same* cohort. The user in bucket 3 is in the first 10% of
every experiment on the site; the user in bucket 97 never gets anything. Rollouts that should be
independent are perfectly correlated, and your "10% canary" is always the same unlucky tenth.

### V3 — Salt the hash with the flag key ← **build this**

```js
const hashBucket = (flagKey, userId) => {
  const seed = `${flagKey}:${userId}`;
  let hash = 0x811c9dc5;
  for (let at = 0; at < seed.length; at += 1) {
    hash ^= seed.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);   // imul keeps the multiply in 32 bits
  }
  return (hash >>> 0) % 100;              // >>> 0 makes it unsigned before the modulo
};
```

Same cost, and now the three properties the requirements asked for all hold:

- **Sticky** — a pure function of (flag, user), so browser, server and the check file agree.
- **Uncorrelated** — changing the salt re-shuffles the population, so two flags at 10% overlap at
  roughly 1%, not 100%.
- **Monotonic** — the bucket does not depend on the percentage, so 10 → 20 only ever adds users.
  This is the property that makes `<` rather than `<=` matter: buckets are `0..99`, so `n%` must
  cover buckets `0..n-1`.

`Math.imul` is the line to narrate. Plain `*` on two 32-bit-ish numbers produces a float above
2⁵³, the low bits get rounded away, and the distribution quietly stops being uniform — a bug that
passes every functional test and shows up as a rollout that is 8% instead of 10%.

### Comparison

| Version | Sticky | Uncorrelated | Monotonic | Storage | Verdict |
| --- | --- | --- | --- | --- | --- |
| V0 `Math.random()` | ✕ | ✓ | ✕ | none | flips per render |
| V1 stored assignment | ✓ | ✓ | needs a promotion job | a table | state where a function suffices |
| V2 hash(userId) | ✓ | ✕ | ✓ | none | one cohort gets every experiment |
| V3 hash(flagKey + userId) | ✓ | ✓ | ✓ | none | **ship this** |

**Why V3 wins:** what changed from V0 to V3 is not speed — every rung is `O(1)`. It is *what the
answer is a function of*. Once the answer depends only on the pair (flag, user), stickiness,
independence and monotonicity stop being features you maintain and become facts you cannot break.

**In a 45-minute interview: ship V3.** It is six lines and it is the whole question.

Then assemble the evaluator, and defend the order:

```js
const evaluate = (flag, environment, user) => {
  const bucket = hashBucket(flag.key, user.id);
  if (flag.archived) return { enabled: false, reason: 'archived', bucket };   // kill switch first

  const rule = flag.rules[environment];

  const override = rule.overrides[user.id];
  if (override !== undefined) return { enabled: override, reason: 'override', bucket };

  if (rule.roles.includes(user.role)) return { enabled: true, reason: 'role', bucket };

  if (rule.percentage >= 100) return { enabled: true, reason: 'default', bucket };
  if (rule.percentage <= 0) return { enabled: false, reason: 'default', bucket };

  return { enabled: bucket < rule.percentage, reason: 'bucket', bucket };
};
```

Most specific rule first — except the kill switch, which is deliberately *above* the overrides.
`override !== undefined`, not `if (override)`, or a forced-**off** is indistinguishable from no
override at all. And it returns the reason, which is what turns the preview from a list of dots
into something you can debug with.

---

## 7. Pass 3 — the console: optimistic writes and the 403 (target: 10 minutes)

The mutation shape is one function, reused by all four actions:

```js
const mutate = async (key, optimistic, request) => {
  const previous = allFlags.find((flag) => flag.key === key);
  if (!previous) return;

  setAllFlags((current) => patchFlag(current, key, optimistic));   // move now
  togglePending(key, true);
  dismissError(key);

  try {
    const saved = await request();
    setAllFlags((current) => patchFlag(current, key, () => saved)); // server is the truth
  } catch (error) {
    setAllFlags((current) => patchFlag(current, key, () => previous));  // put it back
    setErrorByKey((current) => ({ ...current, [key]: error.message }));
  } finally {
    togglePending(key, false);
  }
};
```

Three things to say:

- **`previous` is captured before the optimistic patch**, so the rollback restores the row that was
  actually there, not a re-read of state that the patch has already changed.
- **Success replaces the row with the server's copy**, not the optimistic guess. The server sets
  `updatedAt` and clamps the percentage; keeping the guess means the UI and the store disagree by
  one field until the next refetch.
- **There is no Retry button on a 403.** Retrying the same request as the same role gets the same
  answer. A failed *network* write deserves retry; a failed *authorisation* deserves a different
  role. Distinguishing them in the UI is the point of typing the error (`ForbiddenError`) rather
  than matching on a string.

And the security line, which is the reason this project exists:

```js
// client — decides what to disable
const allows = (action) => bypassClientChecks || can(permissions, role, action, environment);

// server — decides what happens
const authorise = (actor, action, environment) => {
  if (!can(permissions, actor, action, environment)) throw new ForbiddenError(...);
};
```

Same function, same table, two independent calls. The demo switch turns the first one off so the
buttons all light up — and every forbidden write still bounces off the second one and rolls back.
That is the difference between a disabled attribute and authorisation, demonstrated rather than
asserted.

---

## 8. Pass 4 — the audience preview (target: 8 minutes)

```js
const rows = useMemo(
  () => AUDIENCE.map((user) => ({
    user,
    evaluation: evaluate(selected, environment, user),
    override: selected.rules[environment].overrides[user.id],
  })),
  [environment, selected],
);
```

`O(u)` per selected flag, and a memo rather than state — it is a pure derivation of the flag, so
storing it would just create a way for it to be wrong. The selection itself is held **by key, not
by object**: a mutation replaces the flag object, and a selection holding the old reference would
keep rendering pre-save numbers.

The row exposure figure (`7/12 sample users`) is `exposure()` over the same audience, computed in
the list render. That is `O(f × u)` per render — 72 evaluations here, each a short string hash. Say
the number rather than reaching for a memo: with a real audience you would not evaluate a sample in
the browser at all, you would read a count the service already computed.

---

## 9. The single-file version

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ───────────── constants/feature-flags.constants.js ───────────── */

const ROLES = ['viewer', 'developer', 'admin', 'owner'];
const ENVIRONMENTS = ['dev', 'staging', 'prod'];
const ACTIONS = ['view', 'toggle', 'rollout', 'archive'];
const ROLLOUT_STEPS = [0, 5, 10, 25, 50, 75, 100];

// the entire authorisation model, as data
const ROLE_GRANTS = {
  viewer: { grants: { view: ENVIRONMENTS } },
  developer: { inherits: 'viewer', grants: { toggle: ['dev', 'staging'], rollout: ['dev', 'staging'] } },
  admin: { inherits: 'developer', grants: { toggle: ['prod'], rollout: ['prod'] } },
  owner: { inherits: 'admin', grants: { archive: ENVIRONMENTS } },
};

const AUDIENCE = [
  { id: 'u-01', name: 'Anita R.', role: 'viewer' },
  { id: 'u-02', name: 'Bhavesh K.', role: 'viewer' },
  { id: 'u-03', name: 'Chen L.', role: 'viewer' },
  { id: 'u-05', name: 'Eshan M.', role: 'developer' },
  { id: 'u-08', name: 'Hana W.', role: 'admin' },
  { id: 'u-10', name: 'Jaya N.', role: 'owner' },
];

const FLAG_SEED = [
  {
    key: 'checkout-v2', name: 'Checkout v2', owner: 'payments', archived: false, updatedAt: '2026-07-28',
    rules: {
      dev: { percentage: 100, roles: [], overrides: {} },
      staging: { percentage: 100, roles: [], overrides: {} },
      prod: { percentage: 25, roles: ['owner'], overrides: {} },
    },
  },
  {
    key: 'ai-reply-drafts', name: 'AI reply drafts', owner: 'support', archived: false, updatedAt: '2026-08-07',
    rules: {
      dev: { percentage: 100, roles: [], overrides: {} },
      staging: { percentage: 10, roles: ['developer'], overrides: {} },
      prod: { percentage: 0, roles: ['owner'], overrides: { 'u-05': true } },
    },
  },
];

/* ───────────── utils/rbac.utils.js — pure ───────────── */

const grantKey = (action, environment) => `${action}:${environment}`;

// flatten inheritance ONCE; every check afterwards is a Set.has
const buildPermissionIndex = (grants, roles) => {
  const index = {};
  for (const role of roles) {
    const keys = new Set();
    const seen = new Set();                 // config can have a cycle; a hung tab is a bad failure
    for (let current = role; current && !seen.has(current); ) {
      seen.add(current);
      const grant = grants[current];
      for (const [action, environments] of Object.entries(grant.grants)) {
        for (const environment of environments ?? []) keys.add(grantKey(action, environment));
      }
      current = grant.inherits;
    }
    index[role] = keys;
  }
  return index;
};

const can = (index, role, action, environment) => index[role].has(grantKey(action, environment));

const grantedActions = (index, role, environment) =>
  ACTIONS.filter((action) => can(index, role, action, environment));

/* ───────────── utils/rollout.utils.js — pure ───────────── */

// FNV-1a over "flagKey:userId": sticky, salted per flag, monotonic in the percentage
const hashBucket = (flagKey, userId) => {
  const seed = `${flagKey}:${userId}`;
  let hash = 0x811c9dc5;
  for (let at = 0; at < seed.length; at += 1) {
    hash ^= seed.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);   // plain * overflows to float and skews the distribution
  }
  return (hash >>> 0) % 100;
};

const evaluate = (flag, environment, user) => {
  const bucket = hashBucket(flag.key, user.id);
  if (flag.archived) return { enabled: false, reason: 'archived', bucket };

  const rule = flag.rules[environment];

  const override = rule.overrides[user.id];
  if (override !== undefined) return { enabled: override, reason: 'override', bucket };  // not `if (override)`
  if (rule.roles.includes(user.role)) return { enabled: true, reason: 'role', bucket };
  if (rule.percentage >= 100) return { enabled: true, reason: 'default', bucket };
  if (rule.percentage <= 0) return { enabled: false, reason: 'default', bucket };

  return { enabled: bucket < rule.percentage, reason: 'bucket', bucket };   // `<`: buckets are 0..99
};

const exposure = (flag, environment, users) =>
  users.reduce((total, user) => total + (evaluate(flag, environment, user).enabled ? 1 : 0), 0);

const flagState = (flag, environment) => {
  if (flag.archived) return 'off';
  const rule = flag.rules[environment];
  if (rule.percentage >= 100) return 'on';
  if (rule.percentage <= 0 && rule.roles.length === 0) return 'off';
  return 'rollout';
};

const withRule = (flag, environment, patch, now) => ({
  ...flag,
  updatedAt: now,
  rules: { ...flag.rules, [environment]: { ...flag.rules[environment], ...patch } },
});

const withOverride = (flag, environment, userId, value, now) => {
  const { [userId]: dropped, ...rest } = flag.rules[environment].overrides;
  return withRule(flag, environment, { overrides: value === null ? rest : { ...rest, [userId]: value } }, now);
};

const patchFlag = (flags, key, update) => flags.map((flag) => (flag.key === key ? update(flag) : flag));

/* ───────────── utils/flag-api.js — the server, with its own authorisation ───────────── */

let db = FLAG_SEED;
const serverPermissions = buildPermissionIndex(ROLE_GRANTS, ROLES);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ForbiddenError extends Error {}

const listFlags = async () => { await sleep(400); return db; };

const commit = async (actor, action, environment, key, update) => {
  await sleep(550);
  if (!can(serverPermissions, actor, action, environment)) {
    throw new ForbiddenError(`Rejected by the server: ${actor} cannot ${action} in ${environment}.`);
  }
  db = patchFlag(db, key, update);
  return db.find((flag) => flag.key === key);
};

/* ───────────── hooks/use-flag-console.js ───────────── */

function useFlagConsole() {
  const [role, setRole] = useState('developer');
  const [environment, setEnvironment] = useState('prod');
  const [allFlags, setAllFlags] = useState([]);
  const [pendingKeys, setPendingKeys] = useState(new Set());
  const [errorByKey, setErrorByKey] = useState({});
  const [bypass, setBypass] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const latestRequestId = useRef(0);

  // derived, not state: rebuilt from the table, never edited
  const permissions = useMemo(() => buildPermissionIndex(ROLE_GRANTS, ROLES), []);

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    listFlags().then((rows) => {
      if (requestId === latestRequestId.current) setAllFlags(rows);   // drop stale responses
    });
  }, [reloadToken]);

  const allows = (action) => bypass || can(permissions, role, action, environment);

  const togglePending = (key, isPending) =>
    setPendingKeys((current) => {
      const next = new Set(current);
      if (isPending) next.add(key); else next.delete(key);
      return next;
    });

  const mutate = async (key, action, optimistic, update) => {
    const previous = allFlags.find((flag) => flag.key === key);
    if (!previous) return;

    setAllFlags((current) => patchFlag(current, key, optimistic));   // optimistic
    togglePending(key, true);

    try {
      const saved = await commit(role, action, environment, key, update);
      setAllFlags((current) => patchFlag(current, key, () => saved));
    } catch (error) {
      setAllFlags((current) => patchFlag(current, key, () => previous));   // roll back
      setErrorByKey((current) => ({ ...current, [key]: error.message }));
    } finally {
      togglePending(key, false);
    }
  };

  const now = () => new Date().toISOString().slice(0, 10);

  const setPercentage = (key, percentage) =>
    mutate(
      key,
      percentage === 0 || percentage === 100 ? 'toggle' : 'rollout',
      (flag) => withRule(flag, environment, { percentage }, now()),
      (flag) => withRule(flag, environment, { percentage }, now()),
    );

  const setOverride = (key, userId, value) =>
    mutate(
      key,
      'rollout',
      (flag) => withOverride(flag, environment, userId, value, now()),
      (flag) => withOverride(flag, environment, userId, value, now()),
    );

  return {
    role, setRole, environment, setEnvironment, permissions, allows,
    flags: allFlags, pendingKeys, errorByKey,
    setPercentage, setOverride,
    bypass, toggleBypass: () => setBypass((current) => !current),
    reload: () => setReloadToken((token) => token + 1),
  };
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const console_ = useFlagConsole();
  const [selectedKey, setSelectedKey] = useState(null);
  const selected = console_.flags.find((flag) => flag.key === selectedKey) ?? console_.flags[0] ?? null;

  const rows = useMemo(
    () => (selected ? AUDIENCE.map((user) => ({ user, evaluation: evaluate(selected, console_.environment, user) })) : []),
    [selected, console_.environment],
  );

  return (
    <section className="ff">
      <div className="ff__switcher">
        <select value={console_.role} onChange={(event) => console_.setRole(event.target.value)}>
          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>

        {ENVIRONMENTS.map((environment) => (
          <button
            key={environment}
            aria-pressed={environment === console_.environment}
            onClick={() => console_.setEnvironment(environment)}
          >
            {environment}
          </button>
        ))}

        <span>can: {grantedActions(console_.permissions, console_.role, console_.environment).join(', ')}</span>

        <label>
          <input type="checkbox" checked={console_.bypass} onChange={console_.toggleBypass} />
          bypass client checks
        </label>
      </div>

      <ul className="ff__list">
        {console_.flags.map((flag) => {
          const rule = flag.rules[console_.environment];
          const isPending = console_.pendingKeys.has(flag.key);
          return (
            <li key={flag.key} className="ff__row">
              <button onClick={() => setSelectedKey(flag.key)}>{flag.key}</button>
              <span>{flagState(flag, console_.environment)}</span>
              <span>{exposure(flag, console_.environment, AUDIENCE)}/{AUDIENCE.length} users</span>

              {ROLLOUT_STEPS.map((step) => (
                <button
                  key={step}
                  disabled={!console_.allows('rollout') || isPending}
                  onClick={() => console_.setPercentage(flag.key, step)}
                >
                  {step}%
                </button>
              ))}
              <span>{rule.percentage}%</span>

              {console_.errorByKey[flag.key] && <p role="alert">{console_.errorByKey[flag.key]}</p>}
            </li>
          );
        })}
      </ul>

      {selected && (
        <ul className="ff__audience-list">
          {rows.map(({ user, evaluation }) => (
            <li key={user.id}>
              {user.name} ({user.role}) — {evaluation.enabled ? 'on' : 'off'} via {evaluation.reason} #{evaluation.bucket}
              <button
                disabled={!console_.allows('rollout')}
                onClick={() => console_.setOverride(selected.key, user.id, true)}
              >
                force on
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

**Build it in this order:** `ROLE_GRANTS` + `buildPermissionIndex` + `can`, and render the
permission matrix so the model is visible in the first five minutes → `hashBucket` and `evaluate`
with the audience list, so exposure is visible before anything is editable → the rollout buttons
wired straight through (no optimism yet) → the fake server with `authorise`, then the optimistic
patch and rollback → overrides and the bypass switch. If time runs out you stop with a console that
evaluates correctly and refuses correctly, which is the question; the optimistic layer is polish.

Three lines to narrate while typing, because they are what is being graded: `Math.imul` in
`hashBucket` (why a plain multiply skews the rollout), `override !== undefined` in `evaluate` (why
`if (override)` breaks forced-off), and the second `can()` call inside the fake server (why the
first one is not security).

---

## 10. Verification

```bash
node src/projects/feature-flags/utils/feature-flags.utils.check.ts
```

That file is a differential test (`can` vs `canByWalk` over every role × action × environment) plus
property checks on the hash: stickiness, uniformity over 10,000 ids, salt decorrelation, and
monotonicity as the percentage climbs 0 → 100.

Demo script:

1. Acting as **Developer**, environment **Production** — the rollout and toggle controls are
   disabled, and the matrix shows `✓ View` only.
2. Switch to **Dev**. The same controls light up. Say: "the grant is per environment, not per role."
3. Back in Production, switch to **Admin** — toggles enabled, Archive still disabled. Switch to
   **Owner** — Archive enabled.
4. As Developer in Production, tick **Bypass client permission checks**. Every control lights up.
   Press `50%` on any flag: the row moves optimistically, then snaps back with "Rejected by the
   server". That is the demo the whole project is for.
5. Untick the bypass. As Admin, set `checkout-v2` to `50%` in Production and watch the audience
   preview: users move from off to on, and nobody who was on turns off.
6. Set it to `10%`, then `25%`, then `50%` in sequence — the enabled set only grows.
7. Select `checkout-v2`, then `ai-reply-drafts`, and compare the bucket numbers for the same user.
   Different flags, different buckets — that is the salt.
8. Force a user **on**, then look at their reason: `user override`. Force them **off** while the
   flag is at 100% — still off. Clear it and they return to `rule default`.
9. Archive a flag as Owner → every audience row goes off with reason `flag archived`, including the
   forced-on user.
10. Reload the page. Buckets are identical — assignment is computed, not stored.

---

## 11. Cross-questions and answers

**"Why not just check `user.role === 'admin'` in the component?"**
Because then the model lives in every component that renders a control, and the answer to "what can
a developer do in staging?" is a grep. One table, one `can()`, and the UI asks a question instead of
knowing a rule. It also makes the server able to run the identical check.

**"Your client disables the button. Is that security?"**
No. It is UX. `disabled` is one devtools edit away, and the request is one `fetch` away regardless.
Authorisation happens where the state changes — on the server, on every request, from the session's
role and never from a role sent by the client. The bypass switch in this demo exists to make that
concrete: with client checks off, every forbidden write still fails.

**"RBAC or ABAC?"**
RBAC when permissions follow job function and the list of roles is short — this. ABAC when the
decision depends on attributes of the actor *and* the resource ("can edit flags owned by their own
team"), which no role table can express. The migration path is to keep `can()` as the interface and
change what it consults, which is a second reason not to scatter role checks.

**"How would you handle 200 roles and per-team scoping?"**
The grant table stops being static config and becomes data fetched per session, and the key gains a
scope segment (`toggle:prod:team-payments`). The index shape does not change — it is still a `Set`
of keys built once per session — which is the sign the structure was right.

**"Why hash rather than store the assignment?"**
Because the answer has to be identical in the browser, on the server, and in an offline client, and
no shared table can be guaranteed to be identical everywhere at once. A pure function of (flag,
user) is. Storage also makes raising the percentage a migration instead of a number change.

**"Is `% 100` on a 32-bit hash biased?"**
Slightly: 2³² is not divisible by 100, so 96 of the 100 buckets are favoured by one value out of
~42.9 million. That is a bias of about 2 × 10⁻⁸ — irrelevant for a rollout, and worth saying
precisely rather than hand-waving. Where it would matter (a lottery, a payout) you reject the
overhanging range and re-draw.

**"A user's bucket must survive them changing their id."**
Then hash something stable: an internal account id, not an email or a session id. Anything you hash
becomes the identity of the experiment, so it must be as long-lived as the experiment.

**"Two admins edit the same flag at once. What happens?"**
Last write wins, and the loser's change vanishes silently. Fix with an `updatedAt`/version on the
record and a conditional write — reject if the version moved, and re-render with the newer row.
That is the same fix as any optimistic-concurrency problem; the flag part is not special.

**"What does the SDK ship to the browser?"**
Only the rules for the current environment, and ideally only evaluated results for the current user
— sending every rule leaks unreleased feature names and targeting to anyone who opens devtools.
Kill-switch flags should also be pushed (SSE or a poll), not cached for an hour: the point of a kill
switch is the speed at which it takes effect.

**"Where does this design break?"**
When targeting stops being expressible as (role, percentage, override) — for example "users in the
EU on iOS with more than 5 orders". That is a rule engine, and the evaluator becomes a small
interpreter over a condition tree. When cohort stability across a *changing* percentage is not
enough and you need stability across a changing *user set*, which is consistent hashing. And when
the audience is real, the preview stops being a client-side `map` and becomes a number the service
computes.
