# Group 2 - Authentication

## 1. What was built

Email and password authentication, and the mechanism that makes every later
authorisation check possible: a single trustworthy source for "who is making this
request".

The important rule is in `06-CODING-PRACTICES.md` section 12 — `userId` always comes
from the server session and never from a request body, query string, or header.
Everything in this group exists to make that rule cheap to follow and hard to break.

Delivered: registration, sign-in, sign-out, session handling, route protection, a
`requireUser()` server utility, and the `withAuthApi()` wrapper that every protected
endpoint from group 4 onwards is built on.

## 2. Files added

### Auth core — `src/server/auth/`

| File | Purpose |
| --- | --- |
| `auth-config.ts` | Edge-safe Auth.js config. `authConfig`, `AUTH_ROUTES`, `isPublicPath()` |
| `auth.ts` | Full Auth.js instance. Exports `handlers`, `auth`, `signIn`, `signOut` |
| `session.ts` | `getCurrentUser()`, `requireUser()`, `getCurrentUserId()` |
| `password.ts` | `hashPassword()`, `verifyPassword()`, `fakeVerifyPassword()` |
| `authorization.ts` | `assertOwned()`, `assertFound()`, `rejectClientUserId()` |

### Request handling

- `src/server/api/authenticated-handler.ts` — `withAuthApi({ operation, rateLimit },
  handler)`. Resolves the user before the handler body runs and gives the handler
  `ctx.user`, `ctx.userId`, and a logger already tagged with the user id.
- `src/middleware.ts` — stamps a request id on every request and redirects
  unauthenticated *navigation* to `/login?next=...`. API requests fall through to the
  route wrapper's JSON 401.

### User data

- `src/domain/users/entities.ts` — `User`, `UserSettings`, `UserCredentials`.
- `src/domain/shared/entities.ts` — `EntityBase`, `SyncMeta`, `SoftDeleteMeta`,
  `ArchiveMeta`.
- `src/server/db/object-id.ts` — `toObjectId()` and friends.
- `src/server/db/models/user.ts` — `UserDocument`, `toUserEntity()`,
  `toUserCredentials()`.
- `src/server/repositories/interfaces/user-repository.ts` and
  `mongo/user-repository.ts` — accessor `userRepository()`.
- `src/server/services/users/register-user.ts` — `registerUser()`.

### Feature and UI

- `src/features/auth/schemas/auth-schemas.ts` — `loginSchema`, `registerSchema`,
  `registerRequestSchema`.
- `src/features/auth/options.ts` — `currencyOptions`, `commonTimezones`. Plain
  constants, deliberately separate from the schemas.
- `src/features/auth/actions/auth-actions.ts` — `loginAction`, `registerAction`,
  `logoutAction`, returning `FormState { ok, message, fieldErrors }`.
- `src/features/auth/components/` — `LoginForm`, `RegisterForm`, `SignOutButton`.
- `src/app/(auth)/` — layout plus `login` and `register` pages.
- `src/app/(app)/layout.tsx` — the authoritative gate for authenticated pages.
- `src/app/api/auth/[...nextauth]/route.ts`, `api/auth/register/route.ts`,
  `api/me/route.ts`.

### Test infrastructure — reused by every group after this

- `tests/helpers/api.ts` — `buildRequest`, `callRoute`, `parseResponse`,
  `expectData`, `expectError`, `invokeRoute`.
- `tests/helpers/auth.ts` — `sessionModuleMock()`, `setCurrentTestUser()`,
  `createTestUser()`, `createAndSignInTestUser()`.

## 3. Key decisions

### Auth.js with a Credentials provider, not a hand-rolled session

`05-FOLDER-STRUCTURE.md` section 2 asks for a proven authentication library.
Auth.js owns the cookie flags, the CSRF token, and the session encoding — three
things that are easy to get subtly wrong and expensive to get wrong.

### The JWT carries only the user id

The session token stores `sub` and nothing else. Everything else — currency,
timezone, settings — is read from MongoDB on each request by `getCurrentUser()`.

The alternative was to put the profile in the token and save a database read. That
was rejected because currency and timezone drive financial behaviour: a stale token
would mean amounts recorded in the wrong currency or grouped into the wrong day.
A stale cookie must not be able to influence money.

`getCurrentUser()` is wrapped in React's `cache()`, so one request that touches
several server components performs one read, not several.

### A valid cookie for a deleted account authenticates nothing

`getCurrentUser()` returns `null` when the user row is missing, even though the
signature verified. The session is evidence of a past sign-in, not proof the account
still exists.

### The config is split in two

Middleware runs on the Edge runtime, which cannot load the MongoDB driver or bcrypt.
`auth-config.ts` therefore contains no providers, and `auth.ts` adds the Credentials
provider for the Node runtime. This is the documented Auth.js pattern and the reason
`middleware.ts` imports the former rather than the latter.

### Middleware is UX, the layout is security

`middleware.ts` redirects unauthenticated navigation so the user sees a login form
instead of a broken page. It is explicitly *not* the security boundary. The real
gate is `requireUser()` in `app/(app)/layout.tsx` and in every API route, because
middleware can be bypassed by matcher misconfiguration and does not run for every
server-side entry point.

### Sign-in failures are indistinguishable

An unknown email and a wrong password both return the same message. They also take
roughly the same time: when no user is found, `fakeVerifyPassword()` performs a real
bcrypt hash so the response time does not reveal which addresses are registered.

### Not found rather than forbidden

`NotFoundError` is returned both when a record does not exist and when it belongs to
another user. `403` would confirm the record exists, which is an information leak.
This is why `assertOwned()` throws `NotFoundError`.

### Sign-out is a mutation

`SignOutButton` calls a server action rather than linking to a URL. A GET link can be
triggered by a prefetch or an embedded image, which would sign users out
unexpectedly.

### Registration pre-checks the email but the index decides

`registerUser()` checks `emailExists()` to produce a good form error, but the unique
index on `users.email` is the authority. Two simultaneous registrations cannot both
succeed regardless of what the pre-check saw.

## 4. Business rules enforced

```text
userId always comes from the server session
A session for a deleted account grants nothing
One account per email address, enforced by a unique index
Passwords are bcrypt hashed, cost 12 (4 under test)
Sign-in reveals nothing about which addresses exist
Currency and timezone are captured at sign-up
Ownership failures report "not found", never "forbidden"
Auth endpoints are rate limited
```

## 5. How it was verified

```text
npx tsc --noEmit                       clean
npx eslint .                           clean
npx vitest run --project unit          44 tests
npx vitest run --project integration   16 tests
npx next build                         succeeds
```

Unit tests cover password hashing (salting, failing closed on a malformed hash) and
`isPublicPath` — including that `/logins` does not inherit the public status of
`/login`, which a naive `startsWith` would get wrong.

`tests/integration/auth.test.ts` proves the password is never stored in clear text by
reading the raw document, that emails are normalised, that duplicates conflict, that
a client-supplied `id` or `userId` in the registration body is ignored, that `/api/me`
returns 401 unauthenticated, and that a malformed inbound request id is replaced
rather than echoed into the logs.

### How to test an authenticated route

`auth()` reads a cookie from an ambient request, which does not exist when a handler
is invoked directly. Mock the session module at the top of the file, then import the
route:

```ts
vi.mock("@/server/auth/session", () => sessionModuleMock());
const { GET } = await import("@/app/api/me/route");

const user = await createAndSignInTestUser();
const response = await invokeRoute(GET, "/api/me");
```

Only the session lookup is mocked. Every other layer — including the ownership
checks under test — runs for real against MongoDB.

## 6. Known gaps

- No password reset, email verification, or OAuth providers. None are in MVP scope.
- No account deletion.
- Session revocation is limited by the JWT strategy: a token stays valid until it
  expires. The deleted-account check in `getCurrentUser()` covers the case that
  matters.

## 7. Notes for the next group

- Protected routes use `withAuthApi()`. Read the user from `ctx.user` and never from
  the request payload.
- Server components and actions call `requireUser()`.
- `registerUser()` is where a new user's default categories must be created in
  group 6. The extension point is deliberate.
- The rate-limit identity for authenticated routes is the user id, so one user
  cannot exhaust another's budget.
