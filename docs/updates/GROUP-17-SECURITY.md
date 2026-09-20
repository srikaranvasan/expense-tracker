# Group 17 — Security

Spec: `docs/12-SECURITY-AND-ERROR-HANDLING.md`. Checklist: `docs/13-MVP-TASK-GROUP.md` group 17.

**Scope note.** From this group on, only the work genuinely needed for development and
staging was done. Production-only tasks are named explicitly in section 6 and their
checkboxes are left unticked rather than quietly ticked.

---

## 1. What was built

Mostly an audit. Groups 1–3 built the security plumbing — `withAuthApi`, `assertOwned`,
the Zod primitives, `redact`, the header set — and groups 4–15 used it consistently. This
group's job was to check that claim route by route, close what was actually open, and leave
tests behind so a regression fails somewhere.

The audit covered all 28 route files, both handler wrappers, the rate limiter, the
authorization helpers, all ten schema modules, the three list repositories, the middleware,
and the Auth.js configuration.

**Four real gaps were found and closed:**

1. **The sign-in endpoint had no rate limit.** `/api/auth/[...nextauth]` was the only route
   with no wrapper at all — `export const { GET, POST } = handlers;`. Credential attempts
   were unlimited, and each one runs a bcrypt comparison. Section 16 forbids this in as many
   words: "Do not implement unlimited authentication attempts."
2. **`RATE_LIMIT_ENABLED` was configuration that nothing read.** Declared in
   `.env.example`, validated by `getServerEnv()`, and set to `"false"` in the test
   environment since group 1 — with no call site. Every suite that thought it was bypassing
   the limiter was in fact subject to it.
3. **The `sync` rate-limit bucket was defined and never used.** The three sync routes
   borrowed `write` and `read`, so a client draining a large offline queue shared the
   interactive write budget and could leave the user unable to save an expense by hand.
4. **`rejectClientUserId()` was dead code.** Written in group 3 for section 4's requirement,
   never called.

Plus the housekeeping the previous two handoffs both flagged: `.env` deleted.

**And two new test files** covering the attack list in section 58.

---

## 2. Files added or changed

### Closed gaps

| File | Change |
| --- | --- |
| `src/app/api/auth/[...nextauth]/route.ts` | Rate-limits credential submissions before delegating to Auth.js. Rewritten from a two-line re-export. |
| `src/server/api/rate-limit.ts` | `enforceRateLimit()` now honours `RATE_LIMIT_ENABLED`, resolving a configuration error to *enabled*. |
| `src/app/api/sync/push/route.ts` | `rateLimit: "write"` → `"sync"`. |
| `src/app/api/sync/pull/route.ts` | `rateLimit: "read"` → `"sync"`. |
| `src/app/api/sync/record/route.ts` | `rateLimit: "read"` → `"sync"`. |
| `src/server/services/sync/operation-dispatch.ts` | Calls `rejectClientUserId(payload)` before dispatching. |

### Configuration

| File | Change |
| --- | --- |
| `.env` | **Deleted.** Redundant with `.env.local`, which Next loads last and therefore wins. |
| `.env.example` | Documents that `.env.local` is the only file to use, and what `RATE_LIMIT_ENABLED` is for. |

### Tests

| File | Purpose |
| --- | --- |
| `src/server/api/rate-limit.test.ts` | **New.** 11 tests: per-identity and per-bucket isolation, window reset, retry delay, the configuration switch in both directions, and the proxy-header identity fallback. |
| `tests/integration/security.test.ts` | **New.** 60 tests: the anonymous sweep, cross-user access for every resource type, malformed ids, client-supplied `userId`, payload and query limits, and error-body sanitisation. |
| `tests/integration/sync.test.ts` | One test updated to the new reject-rather-than-ignore behaviour. |

---

## 3. Key decisions

### Rate-limit only the credential paths of the Auth.js route, not the whole route

Auth.js serves sign-in, sign-out, session and CSRF-token endpoints under one catch-all.
Limiting all POSTs to ten per minute would put sign-out and the CSRF token in the same
budget as sign-in attempts, so a user who signed in and out a few times would be locked out
of their own session management. Only `/api/auth/callback` and `/api/auth/signin` are
limited — the two that cost a password verification.

### The limiter is applied directly, not through `withApi`

`withApi` wraps responses in this application's `{ data } | { error }` envelope. Auth.js
must own its own responses: the redirects and cookies it sets are part of the protocol.
So the limiter runs first and the framework handler is called only if the request passes.

### Keyed on caller identity, not the submitted email

Keying on the email would let an attacker rotate addresses for a fresh budget on every
attempt, which is precisely the credential-stuffing pattern.

### A configuration error enables rate limiting

`rateLimitingEnabled()` catches a failure from `getServerEnv()` and returns `true`. Failing
open would turn one missing environment variable into an unprotected sign-in endpoint.

### Reject a client-supplied `userId`, do not ignore it

Section 4 permits either, and the behaviour was "ignore": the command schema stripped the
unknown key and the record was written for the session user. Safe, but silent.

Rejecting was chosen because the silent version means the safety net never fires if a future
service starts spreading a payload into a write — the bug would be invisible until it was a
data problem. The trade-off is real and worth recording: **a future offline-edit flow that
echoes a stored local record back as an update payload will now be rejected**, because
records pulled from the server carry a `userId`. Such a flow must build its payload
explicitly, which is what `queue-expense.ts` already does.

The check lives in the dispatcher because that is the *only* place a payload reaches the
application unfiltered. REST bodies are parsed by Zod, which strips unknown keys before a
handler ever sees them; sync payloads are typed `z.record(z.string(), z.unknown())` at the
envelope level, by design, so the command schemas can own their own shapes.

### A malformed id answers 400, not 404 — and that is correct

The tests were written expecting 404 and had to be corrected, so the reasoning is worth
recording. Routes parse `ctx.params` through `z.object({ id: objectIdString })`, so a
malformed id is a validation failure before anything is looked up.

That leaks nothing. The response depends only on the *shape* of the string, so it is
identical whether or not a record exists and whoever owns it. The distinction that would
leak — a well-formed id belonging to another user — answers 404, exactly as section 7
requires. What must never happen is a 500, which would mean the string reached the driver;
a test asserts every dynamic route stays below 500 for every malformed shape.

### Cookies are left to Auth.js

No explicit cookie block was added. Auth.js v5 defaults to `httpOnly: true`,
`sameSite: "lax"`, `path: "/"`, and derives `secure` (plus the `__Secure-` name prefix) from
whether the configured URL is HTTPS. Writing that out by hand would duplicate framework
behaviour and risk getting it wrong.

**What this means operationally:** setting `AUTH_URL` to an `https://` origin is the whole
of "enable secure cookies" in staging. Over plain HTTP — local development — secure cookies
are impossible and correctly not used.

### The two `npm audit` advisories were assessed, not fixed

Both are the same transitive dependency: `postcss` nested inside `next`.

- PostCSS XSS via an unescaped `</style>` in stringify output
- PostCSS arbitrary `.map` file read via an attacker-controlled `sourceMappingURL`

Both require processing attacker-controlled CSS. This application processes none: PostCSS
runs at build time over the project's own source, and Chakra emits styles at runtime in the
browser without it. The fix `npm audit fix --force` offers is `next@16.3.4`, a major version
jump. Upgrading the framework to resolve a build-time advisory with no exposure is the wrong
trade in a group scoped to what dev and staging need.

Re-assess if the app ever accepts CSS or a theme from a user.

### The always-full list endpoints were left alone

`/api/accounts`, `/api/categories` and `/api/people` accept no `limit` and return every row
the user owns. Bounded in practice by what one person has created, and adding pagination
means touching the view models and the UI that consume them. Deferred — see section 6.

---

## 4. Business rules enforced

This group adds no financial rules; it verifies that the rules cannot be bypassed. What the
new tests now hold in place:

| Rule | Evidence |
| --- | --- |
| No endpoint serves an anonymous caller (except health, register, and the Auth.js routes) | 15-call sweep, each asserting 401 |
| No endpoint returns another user's record | 404 for account, person, person balance, category, expense, settlement, card payment, transfer, sync record |
| No endpoint writes *against* another user's record | expense charged to a foreign account, shared expense naming a foreign person, transfer out of a foreign account, payment to a foreign card, restore of a foreign account — all refused |
| A collection endpoint does not leak across users | four list endpoints serialised and asserted free of the other user's ids |
| Existence is never confirmed to a non-owner | 404 rather than 403 throughout |
| The server, never the client, decides whose record this is | `userId` in a REST body has no effect; in a sync payload it is rejected |
| Amounts must be finite, positive, and within the maximum | six rejected shapes: text, `Infinity`, `NaN`, negative, zero, above `maxTransactionAmount` |
| A client cannot demand unbounded work | page size capped at 100, sync batch at 50, participants at 50, names at 100 characters |
| A financial error never leaks internals | no stack, no `MongoServerError`, no connection string, in three different failure modes |
| Every response is traceable | request id present on success and on failure |

---

## 5. How it was verified

```powershell
npx tsc --noEmit       # clean
npx eslint .           # clean
npx prettier --check . # clean
npx vitest run         # 42 files, 1019 tests
npx next build         # succeeds
npm audit              # 2 advisories, both assessed above
```

Test count went from 948 to 1019 (+71): 60 integration, 11 unit.

### The audit itself

Read, route by route: which wrapper each verb uses, whether a rate-limit bucket is passed,
how `[id]` is validated, whether the body goes through `ctx.body(schema)`, and whether the
query goes through `ctx.query(schema)`.

Findings with **no gaps**, recorded so the next reviewer does not repeat the work:

- **Missing authentication** — none. The only routes without `withAuthApi` are
  `/api/health`, `/api/auth/register` and `/api/auth/[...nextauth]`, which is the intended
  set.
- **Unvalidated `[id]` reaching a query** — none. All 13 dynamic routes validate through
  `objectIdString` before the value reaches a service, and `toObjectId` in the repository
  layer is a second gate.
- **Direct `request.json()` or `searchParams`** — none in any route file. Both appear only
  inside `route-handler.ts`, where they belong.
- **MongoDB injection** — no query is built from a client object. Search terms are passed
  through `escapeRegExp` before reaching a `$regex` filter (`person-repository.ts`,
  `transaction-repository.ts`), and an operator-shaped id is rejected by the schema. Tested
  with `{"$ne":null}` as an id.
- **XSS** — no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` anywhere in
  `src/`. Every user string renders as text through Chakra components.
- **Secrets in logs** — `redact()` removes credentials and drops private financial fields
  by default. The new sign-in rate-limit log records the route and the error code, never the
  submitted credentials.
- **Secrets in the repository** — `.gitignore` covers `.env`, `.env*.local`,
  `.env.development` and `.env.production`, with `.env.example` explicitly re-included.
  Nothing secret was ever committed; the deleted `.env` was ignored. `serverExternalPackages`
  keeps the MongoDB driver and bcrypt out of the browser bundle.
- **Security headers** — the set in `next.config.ts` was confirmed served at runtime
  during group 16: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security`, and no `X-Powered-By`.
- **CSRF** — Auth.js issues and checks its own CSRF token on its routes. Next validates the
  `Origin` header on Server Action POSTs, which is how every mutation from the UI travels.
  The API routes are same-origin JSON with `SameSite=Lax` cookies, and the CSP sets
  `form-action 'self'`. Sign-out is a Server Action, not a GET link, so it cannot be
  triggered by a prefetch or an embedded image.

### One behaviour change to be aware of

Making `RATE_LIMIT_ENABLED` real means the integration suite is now genuinely unlimited,
where before it was silently subject to the limits. This is what the flag was always meant
to do; it is called out because a suite that used to pass near a limit boundary is no longer
testing that boundary. `rate-limit.test.ts` switches the flag back on for itself, which also
exercises both directions of the switch.

---

## 6. Known gaps

### Deliberately out of scope — production tasks

| Item | Why deferred |
| --- | --- |
| **Configure HTTPS in production** (checkbox left unticked) | A deployment concern with nothing to implement in this repository. `Strict-Transport-Security` is already sent, and `AUTH_URL` drives secure cookies. Local development is HTTP by necessity. |
| Least-privilege database user, separate production credentials (section 26) | Belongs to whoever provisions the cluster. |
| Backups and a tested restore (section 27) | Group 20 checkboxes, left unticked. |

### Real gaps, deferred with reasons

| Gap | Deferred to |
| --- | --- |
| **`/api/accounts`, `/api/categories`, `/api/people` return every row.** No `limit` accepted and none applied by the repository. Each also triggers a full derived-balance pass. Bounded by one person's own data, so not a dev/staging concern; it becomes one if a user accumulates thousands of records. | Post-MVP |
| **Rate limiting is per process.** `windows` is a module-level `Map`, so on a multi-instance deployment every limit multiplies by the instance count. Permitted by section 17, and the file has said so since group 1. | Post-MVP, or the hosting platform's limiter |
| **The anonymous rate-limit identity collapses to `"unknown"`** when no proxy header is present, so all anonymous callers share one bucket and one client can exhaust the registration budget for everyone. The failure mode is availability, not abuse, and the fallback is deliberate — returning nothing would disable limiting entirely. | Post-MVP, once the deployment's forwarding headers are known |
| **`AUTH_TRUST_HOST` is another declared-but-unread variable.** `auth-config.ts` hard-codes `trustHost: true`. Not wired up because `auth-config.ts` is loaded by Edge middleware, where importing `getServerEnv()` would run full environment validation — including `MONGODB_URI`, which middleware does not need — and throw on an incomplete environment. | Post-MVP |
| **No session-revocation list.** JWT sessions mean a stolen token is valid until it expires (30 days). Signing out clears the cookie and the page cache but cannot invalidate the token itself. | Post-MVP |
| **`postcss` advisories** unresolved pending a `next` major upgrade. Assessed as no exposure; see section 3. | Post-MVP |
| **No rate-limit E2E test.** The limiter is covered by unit tests against the function, not by a browser test that gets locked out. Little extra value for the cost. | Not planned |

---

## 7. Notes for the next group

**Group 18 is error handling**, and this group already touched its territory:

- The error taxonomy, the codes, the `{ error: { code, message, details } }` envelope,
  `toApiError`, request ids and structured logging all exist and were audited here. Group 18
  should verify rather than rebuild, and concentrate on what is genuinely missing: **there
  are no React error boundaries.** No `error.tsx`, no `global-error.tsx`, no `not-found.tsx`.
  A render crash currently takes the whole app down, which section 45 forbids.
- `tests/integration/security.test.ts` already asserts error bodies carry no internals and
  every response carries a request id. Extend that file rather than duplicating it.

**Practical notes:**

- **Use `.env.local` and nothing else.** `.env` is gone; recreating it will shadow nothing
  and confuse everyone, because Next loads `.env.local` last.
- **`RATE_LIMIT_ENABLED=false` in the test environment now actually disables the limiter.**
  If you write a test that expects a 429, stub the variable to `"true"` and call
  `resetServerEnvCache()`, as `rate-limit.test.ts` does.
- **New route? Add a row to the anonymous sweep** in `tests/integration/security.test.ts`,
  and an ownership case if it takes an id. That sweep is the cheapest possible guard against
  forgetting `withAuthApi`.
- **New sync command? It gets `rejectClientUserId` for free** — the check is at the top of
  the dispatcher, not per case.
- **Do not add `dangerouslySetInnerHTML`.** There is currently none, and the CSP is tight
  enough that adding one would need the policy loosened too.
