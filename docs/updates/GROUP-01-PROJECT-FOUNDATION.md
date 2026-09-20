# Group 1 - Project Foundation

## 1. What was built

The skeleton every later group depends on: a Next.js application, the layer
structure from `05-FOLDER-STRUCTURE.md`, and the four cross-cutting concerns that
had to exist before any financial code could be written.

Those four are worth naming, because getting them wrong later is expensive:

- **Money arithmetic.** A decimal money type with a currency attached, and a split
  algorithm whose parts always sum exactly to the total.
- **Errors.** One error hierarchy with stable machine-readable codes, so the API and
  the UI never branch on message strings.
- **Validation.** Zod schemas at every boundary, because TypeScript cannot check
  data arriving from HTTP, MongoDB, or IndexedDB.
- **Observability.** Structured logging with a request id on every line and every
  response.

Nothing user-facing ships in this group. The only route is a health probe.

## 2. Files added

### Configuration

| File | Purpose |
| --- | --- |
| `package.json` | Pinned exact versions. Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `test:integration`, `test:all`, `verify`, `db:indexes` |
| `tsconfig.json` | `strict` plus `noUncheckedIndexedAccess`. Paths `@/*` → `src/*`, `@tests/*` → `tests/*` |
| `next.config.ts` | Security headers and CSP, `serverExternalPackages` so the Mongo driver never reaches the browser bundle |
| `eslint.config.mjs` | Layer boundaries enforced as lint rules (see decisions) |
| `vitest.config.mts` | Three projects: `unit`, `integration`, `ui` |
| `.env.example`, `.env.local`, `.env.test` | Every variable the app reads |
| `.husky/pre-commit`, `.husky/pre-push` | lint-staged on commit; typecheck and unit tests on push |

### `src/config/`

- `constants.ts` — `COLLECTIONS`, `CURRENCY_SCALES`, `LIMITS`, `PAGINATION`,
  `RATE_LIMITS`, `SYNC`, `DEFAULT_CATEGORIES`, `REQUEST_ID_HEADER`.
- `env.ts` — `getServerEnv()` validates `process.env` through a Zod schema and
  caches it. `resetServerEnvCache()` exists for tests. `publicConfig` holds the only
  values safe to render into the client bundle.

### `src/lib/money/` — the most important module in the codebase

- `decimal.ts` — a configured `Decimal` constructor (34 digits, half-up) with
  exponential notation pushed out of range, plus `toDecimal()` which rejects
  anything that is not a plain decimal number.
- `money.ts` — the immutable `Money` class: `{ amount: Decimal, currency: string }`.
  `Money.of()`, `Money.zero()`, `toString()`, `toFixedString()`, `toJSON()`.
- `arithmetic.ts` — `addMoney`, `subtractMoney`, `multiplyMoney`, `divideMoney`,
  `percentageOf`, `compareMoney`, `sumMoney`, `minMoney`, `maxMoney`,
  `clampNonNegative`. Every one asserts matching currencies.
- `rounding.ts` — `roundMoney`, `allocateMoney`, `splitEqually`.
- `format.ts` — `formatMoney`, `currencySymbol`. Display only.

### `src/lib/errors/`

- `error-codes.ts` — `ERROR_CODES` and `RETRYABLE_ERROR_CODES`.
- `app-error.ts` — `AppError` base carrying `code`, `httpStatus`, `details`, and a
  `userMessage` that is safe to show. Subclasses: `DomainError`, `ValidationError`,
  `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`,
  `RateLimitedError`, `ServiceUnavailableError`, `InternalError`.
- `error-utils.ts` — `fromZodError()` (produces per-field messages the UI can attach
  to inputs), `toAppError()`, `describeError()`.

### `src/lib/` other

- `logging/logger.ts` — levelled structured logger with `child()` for per-request
  context.
- `logging/redact.ts` — strips secrets and drops private financial fields from log
  payloads.
- `logging/request-id.ts` — `generateRequestId()`, `resolveRequestId()` (validates
  any inbound value before trusting it).
- `dates/date-utils.ts` — timezone-aware helpers. UTC storage, user-timezone
  grouping.
- `validation/helpers.ts` — reusable Zod primitives: `objectIdString`,
  `clientIdString`, `moneyString`, `positiveMoneyString`, `currencyCode`, `isoDate`,
  `entityName`, `paginationQuery`, `searchParamsToObject`.

### `src/server/`

- `db/client.ts` — `getMongoClient()`, `getDb()`, `withTransaction()`,
  `closeMongoClient()`. Client cached on `globalThis` so hot reload and serverless
  invocations reuse one connection pool.
- `db/indexes.ts` — `createIndexes()` and the full index set.
- `api/response.ts` — `apiSuccess`, `apiCreated`, `apiNoContent`, `apiError`.
- `api/rate-limit.ts` — in-process fixed-window limiter.
- `api/route-handler.ts` — `withApi()`, the wrapper every route uses.
- `errors/api-error.ts` — `toApiError()` maps driver failures to safe responses.

### `src/types/`

`common.ts` (shared unions and `MoneyDto`), `api.ts` (the response envelope),
`sync.ts` (the sync protocol vocabulary, used from group 15).

## 3. Key decisions

### Money is a class with a currency, not a number

An amount without a currency is a bug waiting to happen: it can be added to an
amount in another currency and nothing complains. Every arithmetic helper asserts
matching currencies and throws `CurrencyMismatchError` otherwise.

Multi-currency conversion is out of MVP scope, but carrying the currency costs
almost nothing now and removes a whole class of silent error.

### Splits use largest-remainder allocation

This is the single most consequential decision in the group.

Rounding each share independently loses or invents money. `₹1000` across three
people gives three shares of `₹333.33`, totalling `₹999.99` — a rupee has vanished.

`allocateMoney()` works in integer minor units, floors each share, then hands the
leftover units to the parts with the largest fractional remainders:

```text
₹1000 / 3  →  333.34, 333.33, 333.33   sum = 1000.00 exactly
```

Ties break by index order, so the same input always produces the same split. The
test suite asserts the sum is preserved across many awkward amount and participant
combinations.

### Errors carry codes, not just messages

`10-API-CONTRACT.md` requires the client to branch on a stable code. A message is a
presentation string that will be reworded; a code is a contract. `AppError` also
separates `message` (for logs) from `userMessage` (safe to display), so an internal
detail cannot leak by accident.

### Layer boundaries are lint rules, not documentation

`05-FOLDER-STRUCTURE.md` section 19 lists forbidden dependencies. Documentation
alone gets violated. `eslint.config.mjs` turns each one into a
`no-restricted-imports` rule, so `domain/` importing MongoDB or React fails CI.

`eslint-plugin-boundaries` was considered and rejected: `no-restricted-imports` with
per-directory overrides expresses the same constraints with no extra dependency and
no configuration to get subtly wrong.

### Three Vitest projects

Domain tests must run in milliseconds with no I/O, so they are separated from
integration tests that boot a real MongoDB. The `integration` project runs serially
because a shared in-memory replica set is expensive to start.

### Logger reads its level per write

Initially the level was captured at module load. That is wrong twice: it cannot be
changed without a restart, and in tests the environment is configured after imports
are hoisted, so `LOG_LEVEL=error` was ignored and the suite was noisy. Two
`process.env` lookups per log line is a fair price.

## 4. Business rules enforced

This group owns the arithmetic rules, not the domain rules:

```text
Monetary values are decimal, never binary floating point
Amounts in one operation must share a currency
A split's parts must sum exactly to the total
Amounts are rounded only at explicit, named points
Amounts crossing a boundary are decimal strings, never JS numbers
```

## 5. How it was verified

```text
npx tsc --noEmit      clean
npx eslint .          clean
npx vitest run        34 tests in src/lib/money/money.test.ts
npx next build         succeeds
```

The money tests are the ones worth reading. They cover float drift
(`0.1 + 0.2 === 0.3` exactly, ten `0.1` values summing to `1`), currency mismatch
rejection, exponential-notation avoidance, and split-total preservation across a
matrix of amounts and participant counts.

## 6. Known gaps

- No MongoDB `$jsonSchema` collection validators. Unique indexes plus application
  validation cover the requirement; schema validators were judged brittle for the
  value they add.
- The rate limiter is per-process, so on a multi-instance deployment it becomes
  per-instance. Acceptable for the MVP; the hosting platform provides the outer
  limit.
- `types/sync.ts` defines the protocol but nothing implements it until group 15.

## 7. Notes for the next group

- Never construct a monetary value outside `lib/money`. Never use `Number()` on an
  amount; a lint rule blocks the obvious cases.
- Every route handler goes through `withApi()` or `withAuthApi()`. Do not hand-roll
  a response; use the `api*` helpers so the request id and envelope are consistent.
- Environment variables are read only in `config/env.ts`.
- `next build` takes several minutes in this environment. Run it in the background
  rather than assuming it hung.
