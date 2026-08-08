# EPIC 3: Go-live readiness

Move the app from personal/local-only to a live, publicly reachable URL, with the minimum
security re-review and instrumentation that reaching anonymous internet traffic requires.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As the product owner, I want the app deployed to a live hosted URL so that anyone can try it without my involvement. | Critical | Low–Medium | 4 |
| 2 | As the product owner, I want the existing trust boundaries (import validation, local draft handling) re-reviewed for anonymous/public exposure so that a boundary designed for one trusted user still holds for strangers. | High | Low | 5 |
| 3 | As the product owner, I want cookieless, pageview-only analytics so that I know whether anyone is opening the app, without adding a consent-banner requirement. | Medium | Low | 6 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

- **Tech stack:** React 18 + TypeScript + Vite (unchanged). App remains 100% client-side —
  no server, no accounts, no backend — this was true in v1.1 and nothing in v1.2 changes it.
- **Project structure:** N/A — this epic is infra/deploy, not app code, unless the analytics
  snippet requires a small init call (placement TBD with the tool pick below).
- **Architecture:** unchanged — static single-page app, `localStorage`/`Blob`/file-input
  only.
- **Deployment:** **not locked — Story 1 is explicitly deferred.** Product owner is running
  a separate session with Security-master and DevOps to make the hosting pick and the
  security re-review; this doc does not pre-empt that call.
- **Security:** **not locked — Story 2 is explicitly deferred**, same reason as above.
- **Design:** N/A this epic.
- **Legal/compliance:** analytics tool must explicitly document cookieless/consent-exempt
  operation (e.g. the Plausible/Vercel-Web-Analytics class of tool) — a "no cookie banner"
  marketing claim isn't enough; must be a real GDPR/ePrivacy-exempt design, not just a
  vendor's opinion of itself (Legal-bro/Product-head, v1.2). Story 3's exact tool pick is
  deferred alongside Story 1 since it naturally pairs with the hosting choice (e.g. a
  Vercel deploy makes Vercel Web Analytics the zero-friction pick).
- **Data/market basis:** N/A — no traction bar this cycle (Product-head, v1.2); analytics
  exists to know if anyone opens the app, not to hit a growth target.

## Execution instructions (priority order)

### 1. Deploy to a live hosted URL  (Priority 4) — **Blocked**
- **Status:** deferred to a separate DevOps session, per explicit product-owner request
  (2026-07-16). Do not pick a host or deploy without that session's sign-off.

### 2. Public-exposure security re-review  (Priority 5) — **Blocked**
- **Status:** deferred to the same separate Security-master session. The specific thing
  that needs re-checking: v1.1's import-JSON validation and local-draft-loss guards were
  designed assuming one trusted user; confirm they still hold for anonymous strangers
  before going live.

### 3. Cookieless pageview-only analytics  (Priority 6) — **Blocked**
- **Status:** tool pick deferred alongside Story 1 (pairs naturally with the hosting
  choice). Requirement is locked regardless of tool: pageview/open counts only, no
  interaction or session-level tracking, no cookie, no consent banner required.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Deploy to live URL | Blocked | — | Deferred to separate Security-master/DevOps session per user request, 2026-07-16. |
| 2 | Public-exposure security re-review | Blocked | — | Same deferral. |
| 3 | Cookieless pageview analytics | Blocked | — | Tool pick pairs with Story 1's hosting choice; same deferral. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching net
> tracker in every build session. **Do not unblock these without the deferred session's
> input** — that's the whole point of the deferral.
