# URL Shortener — Interview Build Guide

Build a front-end URL shortener: safe destination validation, collision-free short codes, custom
aliases, click counts, copy-to-clipboard, a resolver, and durable `localStorage` state. Plain
JavaScript, fresh CodeSandbox. Target 45–60 minutes.

This guide is a script for the room: what to ask, what to say, what to type, and where to stop.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Code generation | **Base62 of a monotonic counter** — zero collisions by construction, no lookup, no retry loop. |
| Lookups | **Two derived `Map` indexes** (`byCode`, `byLongUrl`) behind one `useMemo` — resolve, dedupe and alias-taken all `O(1)`. |
| Discussed, not built | Random-and-retry generation, bijection-scrambled codes (built *only* if secrecy is required), DB unique index, counter ranges / ticket server. |

Random-code-then-check is the version most candidates write. It is on the ladder with the precise
reason it loses — a collision check is a lookup, and a lookup is a race — not as the plan.

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–6 | Requirements — this one has a genuine system-design conversation up front |
| 6–12 | HLD, record shape, code-generation decision |
| 12–22 | Create + list in memory (the code generator) |
| 22–32 | URL validation as a security boundary |
| 32–40 | Aliases, deduplication, delete |
| 40–48 | Persistence with defensive parsing |
| 48–56 | Copy, visit counts, resolver |
| 56–60 | Demo, scale and uniqueness talk |

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
url-shortener/
  index.tsx
  url-shortener.types.ts             # ShortLink, ShortenerState, FormError
  url-shortener.css
  constants/url-shortener.constants.ts   # alphabet, FIRST_ID, allowed protocols,
                                         # alias rules, reserved words, messages
  utils/url-shortener.utils.ts       # pure: toBase62, parseLongUrl, buildLinkIndex,
                                     #       validateAlias, findByCode, findByLongUrl,
                                     #       extractCode, incrementVisit
  utils/link-storage.ts              # load/save/parse localStorage, defensively
  hooks/use-short-links.ts           # form state, CRUD, persistence, copy feedback
  hooks/use-resolver.ts              # the "paste a short link" lookup panel
  components/shorten-form.tsx
  components/link-row.tsx
  components/resolve-panel.tsx
```

Say: *"Two things here are not really React problems — generating a unique code and deciding what
counts as a safe URL. I'll write both as pure functions so we can talk about them on their own
terms."*

---

## 1. Requirement gathering (6 minutes)

This question hides a system-design interview inside a UI exercise. Ask accordingly.

1. **"Is there a backend, or is this browser-only?"**
   Browser-only means `localStorage` and a resolver panel instead of a real redirect. It also means
   uniqueness is only guaranteed within one browser — say so, don't pretend otherwise.
   *Default: browser-only, with the backend design discussed.*
2. **"Should the short URL actually redirect?"**
   A real `/:code` redirect needs a server. In-app you can only *resolve*.
   *Default: a resolver panel that finds the destination, plus a real anchor to the long URL.*
3. **"Custom aliases?"**
   Brings a second validation path, reserved words, and a taken-check.
   *Default: yes, optional.*
4. **"Same URL shortened twice — one code or two?"**
   A real product usually says "one per user unless they ask for a custom alias", because analytics
   are per code.
   *Default: reuse the existing generated code; a custom alias always mints a new one.*
5. **"Do the codes need to be unguessable?"**
   The pivotal question. Sequential codes are enumerable — anyone can walk `a`, `b`, `c` and read
   every link. If links are private, a counter is the wrong answer and you need randomness.
   *Default: not secret, so a counter is fine — and I'll say what changes if they were.*
6. **"Expiry, edit, click analytics?"**
   *Default: click count and last-visited timestamp. No expiry.*
7. **"Persist across reloads?"**
   *Default: yes, `localStorage`.*

State the plan:

> "Destination input is a trust boundary — the value ends up in an anchor `href`, so I'll parse it
> with the `URL` API and allow only http and https, never a string check. Codes come from a
> monotonic counter encoded in base62, which cannot collide, so there's no retry loop and no
> uniqueness lookup. And I'll treat `localStorage` as untrusted input, because anything can be in it."

---

## 2. High-level design (HLD)

```text
  ┌────────────┐   raw text            ┌─────────────────────────────┐
  │ ShortenForm│ ────────────────────▶ │ parseLongUrl(raw)           │  ← TRUST BOUNDARY
  │  url       │                       │  add scheme if missing      │
  │  alias?    │                       │  new URL() parse            │
  └────────────┘                       │  protocol allowlist         │
                                       │  hostname sanity            │
                                       └──────┬──────────┬───────────┘
                                       error  │          │ { url } normalised
                                    ◀─────────┘          ▼
                                                ┌────────────────────┐
                                    alias? ───▶ │ validateAlias()    │ charset, length,
                                                │                    │ reserved, taken
                                                └─────────┬──────────┘
                                                          ▼
                                                ┌────────────────────┐
                                                │ dedupe by longUrl  │ existing && !alias
                                                └─────────┬──────────┘ → reuse that code
                                                          ▼
                                                ┌────────────────────┐
                                                │ code =             │
                                                │  alias || base62(  │
                                                │    state.nextId )  │
                                                └─────────┬──────────┘
                                                          ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ useShortLinks:  state = { links: [...], nextId }                          │
 │   submit / remove / visit / copy / resolve                                │
 └──────────┬────────────────────────────────────────────┬──────────────────┘
            │ one effect                                 │ props
            ▼                                            ▼
   ┌──────────────────┐                        ┌───────────────────────────┐
   │ localStorage     │  saveState on change   │ <LinkRow> × n             │
   │ loadState() on   │  parseState() drops    │ <ResolvePanel> code → link│
   │ first render     │  malformed rows        └───────────────────────────┘
   └──────────────────┘
```

Four claims about the picture:

- **One state object `{ links, nextId }`, not two `useState`s.** They must move together: a link
  created without advancing the counter re-issues a code on the next create. Coupled data belongs in
  one atom.
- **One persistence effect** on `[state]` covers create, delete and click. No action has to remember
  to save, so no action can forget.
- **Validation returns `{ field, message }`**, not a bare string, so the error renders under the input
  that caused it. Two inputs, two possible errors — a single error slot puts the alias error under
  the URL field.
- **`parseLongUrl` is a boundary, not a formatter.** Everything downstream may assume the URL is an
  absolute, http(s), normalised string. That assumption is only safe if exactly one function enforces it.

---

## 3. Low-level design (LLD)

### State

```js
const [state, setState] = useState(loadState);   // lazy initialiser — reads storage ONCE,
                                                 // before first paint: no empty→populated flash,
                                                 // no "hydrate in an effect" round trip
const [url, setUrl]     = useState('');
const [alias, setAlias] = useState('');
const [error, setError] = useState(null);        // { field: 'url' | 'alias', message }
const [copiedCode, setCopiedCode] = useState(null);
const [lastCreatedCode, setLastCreatedCode] = useState(null);   // to highlight the new row
const copyTimer = useRef(null);
```

`useState(loadState)` — pass the *function*, don't call it. `useState(loadState())` re-reads and
re-parses `localStorage` on every single render. That is a one-character bug worth naming out loud.

### Function signatures

```js
toBase62(n)                     -> string
fromBase62(code)                -> number
parseLongUrl(raw)               -> { url } | { error: { field, message } }
buildLinkIndex(links)           -> { byCode, byLongUrl }      // O(n), derived via useMemo
validateAlias(alias, index)     -> { field, message } | null  // O(1) taken check
findByLongUrl(index, longUrl)   -> link | undefined           // O(1) dedupe
findByCode(index, code)         -> link | undefined           // O(1) resolve
extractCode(input)              -> string       // accepts a bare code or a full short URL
incrementVisit(links, code, now)-> newLinks
truncateUrl(url, max)           -> string       // middle-truncate, keep host AND tail readable
```

---

## 4. The data model

```json
{
  "links": [
    {
      "code": "q3f",
      "longUrl": "https://example.com/docs/getting-started?ref=nav",
      "createdAt": 1767225600000,
      "clicks": 3,
      "lastVisitedAt": 1767312000000,
      "isCustom": false
    }
  ],
  "nextId": 250003
}
```

Field notes worth saying:

- **`code` is the primary key**, so a custom alias and a generated code live in the same namespace and
  must be checked against each other. That is why the taken check goes through `byCode`, which holds
  every code, not a separate set of custom ones.
- **`longUrl` is stored normalised** (the output of `new URL(...).toString()`), which is what makes
  deduplication work: `example.com/a` and `https://example.com/a` become the same string.
- **`isCustom`** distinguishes "the user chose this" from "we generated it" — needed for the dedupe
  rule and useful in the UI.
- **`nextId` starts at 250,000**, not 0, so the first code is three characters. `a` as a short code
  looks like a bug; `q3f` looks like a product.
- **Timestamps are epoch numbers**, since they're only ever displayed relatively and compared.

---

## 5. Pass 1 — creating links, and the code-generation ladder (target: 10 minutes)

Frame it: *"Generating the code is the interesting part. There are three approaches and they trade
off uniqueness, guessability and cost differently."*

Let **n** = number of existing links.

### V0 — Brute force: random string, check for collision, retry

```js
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[Math.floor(Math.random() * 62)];
  return code;
}

function createCode(links) {
  let code;
  do { code = randomCode(); } while (links.some((l) => l.code === code));   // O(n) per attempt
  return code;
}
```

It is the version most people write, so name its properties precisely rather than just calling it bad:

- **Cost:** O(n) per collision check, and the loop is unbounded — expected iterations stay near 1
  while the space is sparse, but the check itself is a full scan.
- **The birthday problem is the real story.** With 62⁶ ≈ 5.7×10¹⁰ codes, collisions become likely at
  roughly √(5.7×10¹⁰) ≈ 240,000 links — not at 5.7×10¹⁰. Retries start biting far earlier than
  intuition suggests.
- **It needs a uniqueness check at all**, which means a lookup before every insert. In a distributed
  backend, that check-then-insert is a race unless the database enforces it.
- **`Math.random()` is not cryptographically random**, so if the reason for randomness was
  unguessability, this doesn't deliver it — you'd need `crypto.getRandomValues`.

*"So: it works, it needs a lookup and a retry loop, and it's only worth that price if the codes must
be unguessable. Let me ask — do they?"* (You asked in requirements. This is where it pays off.)

### V1 — Monotonic counter in base62 ← **build this**

```js
function toBase62(value) {
  if (value === 0) return ALPHABET[0];
  let remaining = value;
  let code = '';
  while (remaining > 0) {
    code = ALPHABET[remaining % 62] + code;    // build right-to-left
    remaining = Math.floor(remaining / 62);
  }
  return code;
}

function fromBase62(code) {
  return [...code].reduce((total, ch) => total * 62 + ALPHABET.indexOf(ch), 0);
}
```

**O(log₆₂ n) to encode — about 6 iterations for 50 billion links — and zero collisions by
construction.** No lookup before insert, no retry loop, no uniqueness check at all.

Why base62 and not the raw number: `250000` is 6 characters, `q3f` is 3. Base62 is the largest
alphabet that stays URL-safe without encoding, case-sensitive and free of `/ ? # &`. Base64 would be
shorter still but its `+` and `/` need percent-encoding, which defeats the point.

The trade-off, stated plainly: **codes are sequential, therefore enumerable.** Anyone can visit
`q3g`, `q3h` and read other people's links. Acceptable for public short links, unacceptable for
anything private — which is why "must codes be unguessable?" was a requirements question, and why
the answer to it decides between this rung and the next.

```js
function submit() {
  const link = {
    code: toBase62(state.nextId),
    longUrl: parsed.url,
    createdAt: Date.now(),
    clicks: 0,
    lastVisitedAt: null,
    isCustom: false,
  };
  setState((current) => ({ links: [link, ...current.links], nextId: current.nextId + 1 }));
}
```

**Advance `nextId` even when a custom alias was used.** It costs nothing, and it means a generated
code can never later land on a number the counter skipped.

### V1b — bijection over the counter (build only if secrecy was a requirement)

If the interviewer says codes must not be guessable, do **not** fall back to V0. Keep the
collision-free counter and make its output look random by encoding `f(id)` where `f` is a bijection
over the id space:

```js
// multiply by a large odd number coprime with 62^n, modulo the space — reversible, no collisions
const SPACE = 62 ** 6;
const KNUTH = 2654435769;            // any value coprime with SPACE works
const scramble   = (id) => (id * KNUTH) % SPACE;
const unscramble = (code) => (fromBase62(code) * modInverse(KNUTH, SPACE)) % SPACE;
```

Still `O(1)`, still zero collisions, no longer sequential. This answer lands because it refuses the
false choice between "unique" and "opaque" — a Feistel network is the same trick with better
diffusion if pressed.

### V2 — Index the read paths ← **build this too**

Creation is now `O(1)`, but three read paths would still be linear scans over the array:

```js
findByCode(links, code)        // resolver:    O(n), on every lookup
findByLongUrl(links, longUrl)  // dedupe:      O(n), on every submit
validateAlias(...)             // taken check: O(n), on every submit with an alias
```

A shortener is a read-heavy system — this is the half that actually runs billions of times. Index it,
exactly as a database would with a unique index on `code`:

```js
function buildLinkIndex(links) {
  const byCode = new Map();
  const byLongUrl = new Map();
  for (const link of links) {
    byCode.set(link.code.toLowerCase(), link);          // lower-cased: lookups are case-insensitive
    if (!byLongUrl.has(link.longUrl)) byLongUrl.set(link.longUrl, link);   // newest-first wins
  }
  return { byCode, byLongUrl };
}

const findByCode    = (index, code)    => index.byCode.get(code.trim().toLowerCase());
const findByLongUrl = (index, longUrl) => index.byLongUrl.get(longUrl);
```

Wire it with one `useMemo` so it is derived, never maintained:

```js
const index = useMemo(() => buildLinkIndex(state.links), [state.links]);
```

Three points worth making while typing it:

1. **Derived, not duplicated.** The array stays the single source of truth and the index is
   recomputed from it. Maintaining two structures in parallel on every add/remove is the version that
   drifts, and drift here means a resolver that returns a deleted link.
2. **Key on the lower-cased code.** The resolver and the alias-taken check are both case-insensitive.
   Key on the raw code and `AbC` and `abc` can both exist, after which which one resolves is luck.
3. **`useMemo` makes the rebuild O(n) per change, not per read.** Creating a link is O(n) again for
   the rebuild — say so, and say why it is the right trade: writes are rare, reads are not.

### V3 — How a real backend guarantees uniqueness

State clearly that a client-side uniqueness check is **not** a guarantee — two tabs, or two users,
can both pass it:

- **Unique index on `code`.** The database is the only thing that can enforce it. Generate, insert,
  and on a duplicate-key error retry with a new code. For counter codes the error never fires; the
  constraint is there because "never" isn't a guarantee you get to make.
- **Counter ranges / ticket server.** Each app instance is handed a block of ids (say 10,000) and
  hands them out locally. No coordination per write, no collisions across instances — the classic
  answer, and the same idea as a Snowflake id.
- **Hash-and-truncate** (`sha256(longUrl)` → first 7 base62 chars) gives dedupe for free since the
  same URL maps to the same code, but truncation *can* collide, so you still need the unique index
  and a retry with a longer prefix.

| | Create | Read | Uniqueness | Guessable | Verdict |
| --- | --- | --- | --- | --- | --- |
| V0 random + check | `O(n)` per attempt, retries | `O(n)` | needs a lookup | no | discussed only |
| **V1 counter + base62** | **`O(log n)`**, no lookup | — | by construction | yes | **built** |
| V1b + bijection | `O(log n)` | — | by construction | no | build if secrecy is required |
| **V2 Map indexes** | `O(n)` rebuild | **`O(1)`** | same | same | **built** |
| V3 unique index / ranges | `O(1)` amortised | `O(1)` | enforced by DB | depends | server-side, discussed |

**Why the counter wins:** uniqueness becomes a property of the *generator* rather than something
verified after the fact. Removing check-then-insert removes the lookup, the retry loop, and an entire
class of race condition — you cannot have a race over a step you no longer perform. It stops winning
the instant codes must be unguessable, which is what V1b is for.

**Why the index wins:** a shortener is read-heavy by orders of magnitude. Moving the cost from every
read to every write, on a workload where writes are the rare event, is the whole trade — and it is
the same reasoning a database applies when you add an index to a column you filter on.

---

## 6. Pass 2 — URL validation as a security boundary (target: 10 minutes)

Say the words "trust boundary" before writing anything. This value ends up in `<a href>`.

### The wrong version, and why it is wrong

```js
if (!url.startsWith('http')) return error;   // ✗
```

Accepts `httpfoo`, rejects a bare `example.com` that any user expects to work, and — the one that
matters — a `javascript:alert(1)` payload only has to reach the href to become stored XSS. String
inspection is not parsing.

### The right version

```js
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

function parseLongUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { error: { field: 'url', message: 'Enter a URL to shorten.' } };

  // A bare "example.com" is what users type. Only prepend when there is no scheme at all.
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: { field: 'url', message: 'That is not a valid URL.' } };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { error: { field: 'url', message: 'Only http:// and https:// links can be shortened.' } };
  }
  // "https://" alone parses successfully but has no host.
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { error: { field: 'url', message: 'That is not a valid URL.' } };
  }

  return { url: parsed.toString() };   // normalised — this is what gets stored
}
```

Four points, each earning its line:

1. **`new URL()` is the parser; the allowlist is the policy.** `new URL('javascript:alert(1)')`
   succeeds — parsing is not validation. The check that matters is `protocol`.
2. **Allowlist, never blocklist.** A blocklist of `javascript:` and `data:` misses `vbscript:`,
   `blob:`, and whatever ships next. Enumerate what is safe.
3. **The scheme regex must match a scheme, not a colon.** `/^[a-zA-Z][a-zA-Z\d+\-.]*:/` is the RFC
   3986 shape. Testing `includes(':')` would treat `example.com:8080/x` as already-schemed and then
   fail to parse it.
4. **Return the normalised `toString()`.** That is what makes dedupe work at all, and it is why
   `parseLongUrl` returns a value rather than a boolean.

Anywhere the destination is rendered: `target="_blank" rel="noopener noreferrer"` — without
`noopener`, the opened page gets a handle on `window.opener` and can navigate your tab away.

Aliases get their own validator, returning the field so the message lands in the right place:

```js
const ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;
const RESERVED = new Set(['api', 'admin', 'login', 'signup', 'stats', 'new', 'projects']);

function validateAlias(alias, index) {
  const value = alias.trim();
  if (value.length < 3 || value.length > 24) return { field: 'alias', message: 'Alias must be 3–24 characters.' };
  if (!ALIAS_PATTERN.test(value))            return { field: 'alias', message: 'Letters, numbers, hyphen and underscore only.' };
  if (RESERVED.has(value.toLowerCase()))     return { field: 'alias', message: 'That alias is reserved.' };
  if (index.byCode.has(value.toLowerCase()))  // O(1), and the reason codes are keyed lower-case
    return { field: 'alias', message: 'That alias is already in use.' };
  return null;
}
```

The **reserved list** is the detail that signals product thinking: if this service lives at
`short.ly/:code`, then an alias of `admin` shadows `short.ly/admin`. Routing collisions are a real
outage, not a hypothetical.

```bash
node src/projects/url-shortener/utils/url-shortener.utils.check.ts
```

---

## 7. Pass 3 — submit, dedupe, delete (target: 8 minutes)

Order matters: parse, then validate the alias, then dedupe, then create.

```js
function submit() {
  const parsed = parseLongUrl(url);
  if ('error' in parsed) return setError(parsed.error);

  const trimmedAlias = alias.trim();
  if (trimmedAlias) {
    const aliasError = validateAlias(trimmedAlias, index);
    if (aliasError) return setError(aliasError);
  }

  // Same destination, no custom alias requested: hand back the existing code instead of
  // minting a second one for the same page (clicks would otherwise split across two codes).
  const existing = findByLongUrl(index, parsed.url);
  if (existing && !trimmedAlias) {
    setError(null);
    setLastCreatedCode(existing.code);   // highlight the row that already exists
    setUrl('');
    return;
  }

  const link = {
    code: trimmedAlias || toBase62(state.nextId),
    longUrl: parsed.url,
    createdAt: Date.now(),
    clicks: 0,
    lastVisitedAt: null,
    isCustom: Boolean(trimmedAlias),
  };

  setState((current) => ({ links: [link, ...current.links], nextId: current.nextId + 1 }));
  setLastCreatedCode(link.code);
  setError(null);
  setUrl('');
  setAlias('');
}
```

Highlighting the existing row instead of silently doing nothing is the difference between "the button
is broken" and "we already have that one". Small, and interviewers notice.

Delete and visit are immutable so unchanged rows keep their references:

```js
const remove = (code) =>
  setState((c) => ({ ...c, links: c.links.filter((l) => l.code !== code) }));

const incrementVisit = (links, code, now) =>
  links.map((l) => (l.code === code ? { ...l, clicks: l.clicks + 1, lastVisitedAt: now } : l));
```

Note that `remove` does **not** decrement `nextId`. Reusing a freed id would re-issue a code that
someone may already have copied — deletion must not resurrect a code.

---

## 8. Pass 4 — persistence, defensively (target: 8 minutes)

`localStorage` is untrusted input. It can hold another app's key collision, a half-written value from
a crashed tab, or a shape from a previous version of your own code. Parsing must never throw and
never trust the payload.

```js
const emptyState = () => ({ links: [], nextId: FIRST_ID });

const isShortLink = (v) =>
  v && typeof v === 'object' &&
  typeof v.code === 'string' && v.code.length > 0 &&
  typeof v.longUrl === 'string' &&
  typeof v.createdAt === 'number' &&
  typeof v.clicks === 'number' &&
  typeof v.isCustom === 'boolean' &&
  (v.lastVisitedAt === null || typeof v.lastVisitedAt === 'number');

function parseState(raw) {
  if (!raw) return emptyState();

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return emptyState(); }   // corrupt JSON

  if (typeof parsed !== 'object' || parsed === null) return emptyState();
  if (!Array.isArray(parsed.links)) return emptyState();             // wrong shape

  const links = parsed.links.filter(isShortLink);                    // drop bad ROWS,
                                                                     // keep the good ones
  const nextId = Number.isFinite(parsed.nextId) ? parsed.nextId : FIRST_ID;

  // A stored nextId lower than the codes already issued would re-issue a code.
  return { links, nextId: Math.max(nextId, FIRST_ID + links.length) };
}

function loadState() {
  try { return parseState(localStorage.getItem(STORAGE_KEY)); }
  catch { return emptyState(); }   // Safari private mode / blocked storage THROWS on access
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* quota exceeded or storage disabled — the app still works this session */ }
}

useEffect(() => { saveState(state); }, [state]);   // one effect covers every mutation path
```

Three things to say:

- **A bad row is dropped; a bad document is discarded.** Partial recovery beats losing everything to
  one malformed entry.
- **`Math.max(nextId, FIRST_ID + links.length)`** is the repair rule: if the counter got rolled back
  or truncated, it is pushed past anything already issued. Re-issuing a code would point two links at
  one destination — a silent, permanent data bug.
- **Reading `localStorage` can throw**, not just return null. Safari private browsing and
  blocked-storage settings raise on access, so the try/catch wraps the access, not just the parse.
- **Version the key** (`interview-prep:url-shortener:v1`). When the shape changes, bump it and the
  old data is ignored rather than half-parsed.

---

## 9. Pass 5 — copy, visit, resolve (target: 8 minutes)

```js
function copy(code) {
  // Fire and forget: a rejected clipboard permission must not break the app or throw unhandled.
  void navigator.clipboard?.writeText(shortUrl(code)).catch(() => undefined);
  setCopiedCode(code);
  clearTimeout(copyTimer.current);
  copyTimer.current = setTimeout(() => setCopiedCode(null), 1500);
}

useEffect(() => () => clearTimeout(copyTimer.current), []);   // clear on unmount: setting state
                                                              // after unmount is a leak
```

`navigator.clipboard?.` — optional chaining because the API is undefined on insecure origins. It also
requires a user gesture, which a click already is.

The resolver accepts either a bare code or a pasted full short URL:

```js
const extractCode = (input) => input.trim().replace(/\/+$/, '').split('/').pop() ?? '';

const findByCode = (index, code) => index.byCode.get(code.trim().toLowerCase());
```

Stripping trailing slashes before `split('/')` is the whole trick — without it, `short.ly/q3f/`
yields an empty last segment and resolves to nothing. Users paste with trailing slashes constantly.

Display polish that is worth the two lines: middle-truncate long URLs so both the host and the tail
stay readable.

```js
function truncateUrl(url, max = 58) {
  if (url.length <= max) return url;
  const head = Math.ceil((max - 1) / 2);
  return `${url.slice(0, head)}…${url.slice(url.length - (max - head - 1))}`;
}
```

CSS `text-overflow: ellipsis` cuts the *end*, which hides exactly the part that distinguishes two
long URLs from the same site. Say that — it is a real reason to do it in JS.

---

## 10. The single-file version — what you actually type

Everything above is the conversation. This is the code. In a real 45-minute slot you build it
top-to-bottom in `App.jsx` and say *"in a repo this splits into utils / storage / hook / components
along these comment banners."*

Assumes the CSS classes already exist. No styles here.

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ───────────── constants ───────────── */

const STORAGE_KEY = 'url-shortener:v1';
const FIRST_ID = 250_000;                  // so the first code is 3 chars, not 'a'
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ALLOWED_PROTOCOLS = ['http:', 'https:'];   // allowlist, never a blocklist
const ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;
const RESERVED = new Set(['api', 'admin', 'login', 'signup', 'stats', 'new', 'projects']);
const SHORT_ORIGIN = 'short.ly';
const COPIED_MS = 1500;

/* ───────────── utils/url-shortener.utils.js — pure ───────────── */

// base62 of a monotonic counter: cannot collide, so no lookup and no retry loop
const toBase62 = (value) => {
  if (value === 0) return ALPHABET[0];
  let remaining = value;
  let code = '';
  while (remaining > 0) {
    code = ALPHABET[remaining % 62] + code;
    remaining = Math.floor(remaining / 62);
  }
  return code;
};

// TRUST BOUNDARY: this value ends up in an anchor href
const parseLongUrl = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return { error: { field: 'url', message: 'Enter a URL to shorten.' } };

  // a bare "example.com" is what users type; only prepend when there is no scheme at all
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: { field: 'url', message: 'That is not a valid URL.' } };
  }

  // new URL('javascript:alert(1)') SUCCEEDS — parsing is not validation
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { error: { field: 'url', message: 'Only http:// and https:// links can be shortened.' } };
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { error: { field: 'url', message: 'That is not a valid URL.' } };
  }

  return { url: parsed.toString() };  // normalised — this is what gets stored and compared
};

// derived read indexes: build O(n) on change, every lookup O(1). the array stays the source of truth
const buildLinkIndex = (links) => {
  const byCode = new Map();
  const byLongUrl = new Map();
  for (const link of links) {
    byCode.set(link.code.toLowerCase(), link);   // lower-cased: lookups are case-insensitive
    if (!byLongUrl.has(link.longUrl)) byLongUrl.set(link.longUrl, link);
  }
  return { byCode, byLongUrl };
};

const findByCode = (index, code) => index.byCode.get(code.trim().toLowerCase());
const findByLongUrl = (index, longUrl) => index.byLongUrl.get(longUrl);

const validateAlias = (alias, index) => {
  const value = alias.trim();
  if (value.length < 3 || value.length > 24)
    return { field: 'alias', message: 'Alias must be 3–24 characters.' };
  if (!ALIAS_PATTERN.test(value))
    return { field: 'alias', message: 'Letters, numbers, hyphen and underscore only.' };
  if (RESERVED.has(value.toLowerCase()))     // an alias of "admin" would shadow short.ly/admin
    return { field: 'alias', message: 'That alias is reserved.' };
  if (index.byCode.has(value.toLowerCase()))                 // O(1) instead of a scan
    return { field: 'alias', message: 'That alias is already in use.' };
  return null;
};

// strip trailing slashes first, or "short.ly/q3f/" yields an empty segment
const extractCode = (input) => input.trim().replace(/\/+$/, '').split('/').pop() ?? '';

const incrementVisit = (links, code, now) =>
  links.map((link) =>
    link.code === code ? { ...link, clicks: link.clicks + 1, lastVisitedAt: now } : link);

// middle-truncate: CSS ellipsis cuts the end, which is the part that distinguishes two URLs
const truncateUrl = (url, max = 58) => {
  if (url.length <= max) return url;
  const head = Math.ceil((max - 1) / 2);
  return `${url.slice(0, head)}…${url.slice(url.length - (max - head - 1))}`;
};

/* ───────────── utils/link-storage.js — localStorage is untrusted input ───────────── */

const emptyState = () => ({ links: [], nextId: FIRST_ID });

const isShortLink = (v) =>
  v && typeof v === 'object' &&
  typeof v.code === 'string' && v.code.length > 0 &&
  typeof v.longUrl === 'string' &&
  typeof v.createdAt === 'number' &&
  typeof v.clicks === 'number' &&
  typeof v.isCustom === 'boolean' &&
  (v.lastVisitedAt === null || typeof v.lastVisitedAt === 'number');

const parseState = (raw) => {
  if (!raw) return emptyState();

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return emptyState(); }   // corrupt JSON

  if (typeof parsed !== 'object' || parsed === null) return emptyState();
  if (!Array.isArray(parsed.links)) return emptyState();

  const links = parsed.links.filter(isShortLink);                    // drop bad rows, keep good
  const nextId = Number.isFinite(parsed.nextId) ? parsed.nextId : FIRST_ID;

  // a stored nextId below the codes already issued would RE-ISSUE a code
  return { links, nextId: Math.max(nextId, FIRST_ID + links.length) };
};

const loadState = () => {
  try { return parseState(localStorage.getItem(STORAGE_KEY)); }
  catch { return emptyState(); }        // Safari private mode THROWS on access
};

const saveState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* quota exceeded or storage disabled — the session still works */ }
};

/* ───────────── hooks/use-short-links.js ───────────── */

function useShortLinks() {
  // pass the FUNCTION: useState(loadState()) re-reads storage on every render
  const [state, setState] = useState(loadState);
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState(null);          // { field, message }
  const [copiedCode, setCopiedCode] = useState(null);
  const [lastCreatedCode, setLastCreatedCode] = useState(null);
  const copyTimer = useRef(null);

  // one effect covers create, delete and clicks — no action can forget to save
  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const shortUrl = useCallback((code) => `https://${SHORT_ORIGIN}/${code}`, []);

  // rebuilt only when links change — every read below is O(1), and it can never drift from the array
  const index = useMemo(() => buildLinkIndex(state.links), [state.links]);

  const submit = useCallback(() => {
    const parsed = parseLongUrl(url);
    if ('error' in parsed) return setError(parsed.error);

    const trimmedAlias = alias.trim();
    if (trimmedAlias) {
      const aliasError = validateAlias(trimmedAlias, index);
      if (aliasError) return setError(aliasError);
    }

    // same destination, no alias asked for: reuse the code so clicks don't split across two
    const existing = findByLongUrl(index, parsed.url);
    if (existing && !trimmedAlias) {
      setError(null);
      setLastCreatedCode(existing.code);
      setUrl('');
      return;
    }

    const link = {
      code: trimmedAlias || toBase62(state.nextId),
      longUrl: parsed.url,
      createdAt: Date.now(),
      clicks: 0,
      lastVisitedAt: null,
      isCustom: Boolean(trimmedAlias),
    };

    setState((current) => ({
      links: [link, ...current.links],
      nextId: current.nextId + 1,   // advance even for an alias, so no id is ever revisited
    }));
    setLastCreatedCode(link.code);
    setError(null);
    setUrl('');
    setAlias('');
  }, [alias, index, state.nextId, url]);

  const remove = useCallback((code) => {
    // note: nextId is NOT decremented — a freed id would re-issue a copied code
    setState((current) => ({ ...current, links: current.links.filter((l) => l.code !== code) }));
    setLastCreatedCode((current) => (current === code ? null : current));
  }, []);

  const visit = useCallback((code) => {
    setState((current) => ({ ...current, links: incrementVisit(current.links, code, Date.now()) }));
  }, []);

  const copy = useCallback(
    (code) => {
      // fire and forget: a denied clipboard permission must not break the app
      void navigator.clipboard?.writeText(shortUrl(code)).catch(() => undefined);
      setCopiedCode(code);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedCode(null), COPIED_MS);
    },
    [shortUrl],
  );

  const resolve = useCallback((input) => findByCode(index, extractCode(input)), [index]);

  const totalClicks = useMemo(
    () => state.links.reduce((total, link) => total + link.clicks, 0),
    [state.links],
  );

  return {
    url, setUrl, alias, setAlias, error, links: state.links, totalClicks,
    lastCreatedCode, submit, remove, visit, copy, copiedCode, shortUrl, resolve,
  };
}

/* ───────────── components ───────────── */

function ResolvePanel({ resolve, shortUrl }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(undefined);
  const [searched, setSearched] = useState(false);

  return (
    <div className="shortener__resolve">
      <input
        placeholder="Paste a short link or code…"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <button onClick={() => { setResult(resolve(input)); setSearched(true); }}>Resolve</button>

      {searched && (result
        ? <p>{shortUrl(result.code)} → <a href={result.longUrl} target="_blank" rel="noopener noreferrer">{result.longUrl}</a></p>
        : <p role="alert">No link found for that code.</p>)}
    </div>
  );
}

export default function App() {
  const s = useShortLinks();

  return (
    <section className="shortener">
      <h1>URL shortener</h1>

      <form
        className="shortener__form"
        onSubmit={(event) => { event.preventDefault(); s.submit(); }}
      >
        <label>
          Long URL
          <input value={s.url} onChange={(event) => s.setUrl(event.target.value)} placeholder="example.com/page" />
          {s.error?.field === 'url' && <span role="alert">{s.error.message}</span>}
        </label>

        <label>
          Custom alias (optional)
          <input value={s.alias} onChange={(event) => s.setAlias(event.target.value)} placeholder="my-link" />
          {s.error?.field === 'alias' && <span role="alert">{s.error.message}</span>}
        </label>

        <button type="submit">Shorten</button>
      </form>

      <p className="shortener__meta">{s.links.length} links · {s.totalClicks} clicks</p>

      <ul className="shortener__list">
        {s.links.map((link) => (
          <li
            key={link.code}
            className={link.code === s.lastCreatedCode ? 'shortener__row is-new' : 'shortener__row'}
          >
            <span className="shortener__code">{s.shortUrl(link.code)}</span>
            {link.isCustom && <span className="tag">custom</span>}

            <a
              href={link.longUrl}
              target="_blank"
              rel="noopener noreferrer"   // without noopener the target page gets window.opener
              onClick={() => s.visit(link.code)}
              title={link.longUrl}
            >
              {truncateUrl(link.longUrl)}
            </a>

            <span>{link.clicks} clicks</span>
            <button onClick={() => s.copy(link.code)}>
              {s.copiedCode === link.code ? 'Copied' : 'Copy'}
            </button>
            <button aria-label={`Delete ${link.code}`} onClick={() => s.remove(link.code)}>Delete</button>
          </li>
        ))}
      </ul>

      {s.links.length === 0 && <p className="shortener__empty">No links yet.</p>}

      <ResolvePanel resolve={s.resolve} shortUrl={s.shortUrl} />
    </section>
  );
}
```

**Build it in this order:** `toBase62` + create/list in memory (working shortener in 12 minutes) →
`buildLinkIndex` + the `useMemo`, and route every lookup through it → `parseLongUrl` with the protocol
allowlist → aliases and dedupe → `localStorage` with defensive parsing → copy, clicks, resolver. If
time runs out you stop on a shortener that is safe rather than one that persists but accepts
`javascript:`.

Three lines to narrate while typing, because they are the ones being graded: the protocol allowlist
in `parseLongUrl` (the XSS fix), `Math.max(nextId, FIRST_ID + links.length)` in `parseState` (what
stops corrupt storage from re-issuing a code already in someone's chat history), and
`byCode.set(link.code.toLowerCase(), …)` (why the index is keyed lower-case, and what breaks if it
isn't).

## 11. Verification

```bash
node src/projects/url-shortener/utils/url-shortener.utils.check.ts
```

Demo script:

1. Submit `example.com/docs` → stored and shown as `https://example.com/docs`.
2. Submit `javascript:alert(1)`, `data:text/html,x`, `ftp://host/f` → all rejected with the protocol
   message. Say "this is the XSS case" while doing it.
3. Submit empty, and `https://` alone → distinct errors.
4. Create a custom alias; then try `ab` (too short), `my alias` (charset), `admin` (reserved), and a
   duplicate → four errors, each under the alias field.
5. Submit the same destination twice → no second code; the existing row highlights.
6. Copy a code → "Copied" appears and clears after 1.5s.
7. Resolve by bare code, by upper-casing it, and by pasting `https://short.ly/q3f/` with the
   trailing slash — all three hit the same `byCode` entry.
8. Click a link twice → count increments, last-visited updates.
9. Reload the page → everything is still there.
10. In devtools, set the storage value to `{"links":"garbage"}` and reload → the app comes up empty
    instead of crashing.

---

## 12. Cross-questions and answers

**"Counter or hash?"**
Counter: collision-free by construction, no lookup before insert, no retry. A truncated hash dedupes
identical URLs for free but can collide, so it still needs a unique index and a retry path. Use a
hash when content-identity matters; use a counter when uniqueness matters.

**"Sequential codes are enumerable. Fix it without losing the guarantee."**
Keep the counter, publish a bijection of it — multiply by a large coprime modulo 62ⁿ, or run a small
Feistel network over the id. Output looks random, is still one-to-one, so collisions remain
impossible. If links must be genuinely secret, that's a different requirement: use
`crypto.getRandomValues`, longer codes, a unique index, and treat the code as a capability.

**"Why can't the short link actually redirect here?"**
There is no server owning `/:code`. A real one responds 302 (not 301) — a permanent redirect gets
cached by browsers and CDNs, and then click analytics stop counting. Say the status code; it is the
detail that shows you have shipped one.

**"Two tabs open. What breaks?"**
Both hold their own state and the last write wins, so one tab's links vanish. Fix: listen for the
`storage` event and reload state on change, and/or merge by `code` on write. The real fix is a
backend with a unique constraint — client-side uniqueness across tabs is unachievable.

**"How does a backend guarantee uniqueness at scale?"**
Unique index on `code` as the backstop; per-instance counter ranges (a ticket server or Snowflake-style
ids) so no coordination is needed per write; retry on duplicate-key for random codes. Never rely on
"check then insert" — it is a race in every distributed system.

**"Expiry?"**
Store `expiresAt`. The resolver and redirect path reject expired codes; the list shows them as
expired rather than hiding them. Do not delete the row — a deleted code could be reissued, and an
expired link should say "expired", not "not found".

**"Rate limiting / abuse?"**
Shorteners are used to disguise malicious destinations. Real ones check the destination against a
safe-browsing list at creation and again at resolve time (a domain can go bad after shortening),
rate-limit creation per account and IP, and show an interstitial for flagged links.

**"Where does this design break?"**
When links become private (sequential codes leak), when there are multiple writers (client-side
uniqueness is not enforceable), and when storage exceeds ~5MB of `localStorage`. All three are the
same conclusion: it needs a server, and the pure functions written here move there unchanged.
