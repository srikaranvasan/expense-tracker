# Group 19 — Testing

Spec: `docs/11-TESTING-STRATEGY.md`. Checklist: `docs/13-MVP-TASK-GROUP.md` group 19.

**Scope note.** Dev/staging scope. Four of the eight E2E checkboxes are left unticked with
reasons in section 6, rather than ticked on the strength of integration coverage.

---

## 1. What was built

Three things: a verification pass over the existing suite, one genuine coverage gap filled,
and an E2E layer that did not exist.

### The unit and integration checklists were already met

Every item was checked against real test titles rather than assumed. All nineteen were
covered — including the three most easily claimed and least often written:

- **Atomic transactions** — "writes no transaction when the split is invalid", "rejects an
  invalid new split and leaves the old one intact", "writes nothing when the allocation is
  rejected".
- **Settlement concurrency** — "holds under two concurrent settlements of the same share".
- **Idempotency** — "returns the original expense for a repeated clientId", and the
  equivalent for settlements, accounts, people and categories.

The section 51 financial edge cases are covered too: odd-number equal splits, percentage
rounding, over-settlement, duplicate settlement within one payment, multiple settlements
against one split, editing and deleting a settled expense.

### One real gap: the Zod primitives had no direct test

`src/lib/validation/helpers.ts` is the first thing every request meets, and it was verified
only indirectly. It now has 70 tests of its own — including the case that matters most,
`moneyString` normalising a JavaScript number to a decimal string so no float ever becomes
the authoritative value.

### An end-to-end layer

There was none, beyond the PWA specs group 16 added. Now:

| Spec | Covers |
| --- | --- |
| `tests/e2e/journeys.spec.ts` | register, sign out, sign back in; wrong password; unknown address; record an expense and see the balance fall; a rejected form; cross-user isolation; the in-app not-found page |
| `tests/e2e/offline-expense.spec.ts` | record an expense with no connection, confirm it is durable, reconnect, watch it sync, confirm the server applied it; and that offline *editing* is correctly refused |
| `tests/e2e/pwa-offline.spec.ts` | from group 16, unchanged in behaviour |

Seventeen browser tests in total, run against a production build and a disposable database.

### Three bugs found, all by the E2E tests

1. **Sign-out did not end the session.** A group 16 regression: awaiting
   `clearPrivateCaches()` before calling `logoutAction()` moved the action outside the React
   transition, so its `Set-Cookie` was never applied. The user was redirected to `/login`
   still holding a valid session and bounced straight back to the dashboard. **Nothing else
   in the project would have caught this** — there is no integration test for a server action
   and no unit test can see a cookie round-trip.
2. **Saving an expense offline landed the user on the offline page.** The form navigated to
   `/transactions?saved=offline`; the service worker caches by exact URL, so the one
   navigation guaranteed to happen offline was guaranteed to miss the cache. Nothing read the
   query parameter, so it was removed.
3. **`isoDate` accepts an impossible calendar date** and rolls it forward — 30 February
   becomes 2 March. Found while writing the primitive tests. Pinned by a test that documents
   the behaviour rather than endorsing it; see section 6.

---

## 2. Files added or changed

### Tests

| File | Purpose |
| --- | --- |
| `src/lib/validation/helpers.test.ts` | **New.** 70 tests over the Zod primitives. |
| `tests/e2e/journeys.spec.ts` | **New.** 7 journey tests. |
| `tests/e2e/offline-expense.spec.ts` | **New.** 2 offline tests. |
| `tests/e2e/helpers/app.ts` | **New.** Register, sign in, sign out, create an account, record an expense. |
| `tests/e2e/helpers/pwa.ts` | **New.** Worker readiness, cache warming, connectivity control. |
| `tests/e2e/pwa-offline.spec.ts` | Local readiness helpers moved into `helpers/pwa.ts`. No behaviour change. |

### Harness

| File | Purpose |
| --- | --- |
| `scripts/run-e2e.ts` | **New.** Boots an in-memory replica set, runs Playwright against it, tears it down. |
| `package.json` | `test:e2e` now runs the wrapper; `test:e2e:pwa` added for the database-free specs. |
| `playwright.config.ts` | Comment recording that the wrapper is the intended entry point. |

### Fixes

| File | Change |
| --- | --- |
| `src/features/auth/components/SignOutButton.tsx` | Cache clearing is no longer awaited, and `logoutAction()` runs inside the transition. Fixes sign-out. |
| `src/features/transactions/components/ExpenseForm.tsx` | Offline save navigates to `/transactions`, not `/transactions?saved=offline`. |

---

## 3. Key decisions

### E2E runs against a disposable in-memory replica set, not a real database

The journeys sign up users and create expenses, so they need a writable database with
transaction support. Pointing them at `.env.local` would write test data into the cluster the
developer is working against, and **a suite that can damage real data is a suite people stop
running**.

`mongodb-memory-server` is already a dependency and provides a single-node *replica set*,
which is required because every financial write uses `withTransaction()`. A standalone mongod
would fail on the first expense.

### Why a wrapper script rather than Playwright's `globalSetup`

Playwright launches `webServer` **before** global setup runs, so a URI created in
`globalSetup` would not exist when Next started. Starting the database first, then spawning
Playwright with the URI in its environment, is the only ordering that works. Hence
`scripts/run-e2e.ts`.

The wrapper also sets `RATE_LIMIT_ENABLED=false` — the suite signs in repeatedly and would
otherwise exhaust the ten-per-minute budget group 17 added. That is precisely what the flag
was made real for.

### Tests run against a production build

`webServer` runs `npm run build` first. `next dev` disables some caching and serves unminified
chunks, so a service worker verified there is not the one that ships. It costs about forty
seconds per run.

### The E2E suite is deliberately small

The integration suite already proves every financial rule from the route handler down to
MongoDB. Repeating those assertions in a browser would be slow and would make one cause fail
twice. What only a browser can prove is the layer above: that forms post the fields they
claim to, that a server action's result reaches the screen, and that navigation works.

That is why the four remaining journeys are unticked rather than hurried — and it is worth
noting that all three bugs found here were in exactly that layer, not in the business logic.

### Form fields are located by id, not by label

`getByLabel("Name", { exact: true })` does not work: `Field` renders the required marker
inside the label, so the label's text is "Name *" while its accessible name is "Name". Exact
matching sees the asterisk; non-exact matching makes "Password" ambiguous with "Confirm
password". `getByRole` would use the accessible name correctly but `input[type=password]` has
no ARIA role, so half the fields would need a second strategy.

Every field already carries a stable `id` that its label points at, so that is used
throughout. Buttons, headings and visible content are still matched by role and text, which is
where "test like a user" earns its keep.

### `navigator.onLine` is overridden in the journey spec, and not in the PWA spec

`context.setOffline(true)` genuinely cuts the network, but in Chromium it does **not** flip
`navigator.onLine` — which is what `useConnectivity()` reads. Without an override the app
believes it is online while every request fails, so the expense form offers "Record expense"
instead of "Save on this device" and the offline path is unreachable from a test. (Group 16
hit the same thing: the offline page announced "You are back online" while nothing could
load.)

`installConnectivityControl()` therefore makes `navigator.onLine` controllable, **paired with
a real `setOffline`**, so both halves of being offline are true at once — which is the
situation a user is actually in. The flag lives in `localStorage` because `addInitScript` runs
afresh per document and these tests navigate while offline.

The PWA specs deliberately do *not* use it: what they test is the worker, which reacts to
requests failing rather than to the browser's hint. And the awkward case the architecture
warns about — `onLine === true` with an unreachable server (section 15) — is covered by the
reconnect spec through `useServerReachable`.

### Offline tests warm the page cache first, and that is the contract

`warmPageCache()` visits `/transactions` and `/transactions/new` online before going offline.
Not a workaround: the worker caches pages as they are visited rather than precaching the
application, so offline support means "somewhere you have been before". A user who has never
opened the expense form cannot open it offline, and the test reflects that rather than
pretending otherwise.

### The rejected-form test does not assert the typed value survives

It does not survive — the inputs are uncontrolled with no `defaultValue` on a new expense, so
a rejected submission clears them. The test asserts what matters (the error is announced on
the field, the boundary did not trip) and the value loss is recorded in section 6 rather than
pinned, because the current behaviour is not the behaviour worth locking in.

### The date rollover is pinned rather than fixed

`new Date("2026-02-30")` yields 2 March rather than `NaN`, so `isoDate`'s finite check cannot
catch it. A date picker cannot produce 30 February, but the REST and sync paths can. Changing
date parsing this late, for an input no UI can generate, is not a dev/staging need — so the
behaviour is pinned by a test that says plainly it is a limitation, making any future change
deliberate.

---

## 4. Business rules enforced

No new rules. What the new tests hold in place:

| Rule | Where |
| --- | --- |
| A monetary amount is never carried as a float | `moneyString` normalises a number to a decimal string |
| An amount must be finite, within the maximum, and no more precise than six places | 12 rejection cases |
| An expense amount must be greater than zero | `positiveMoneyString`, plus the browser test that the form says so |
| A `clientId` survives validation byte-for-byte, so a retry is recognised as a retry | `clientIdString` |
| A client cannot demand an unbounded page | `paginationQuery` caps at 100 |
| An offline expense is durable before the connection returns | IndexedDB asserted non-empty while offline |
| An offline expense reaches the server, and the server moves the balance | balance re-checked after sync: 50000 − 725.25 = 49274.75 |
| Offline editing is refused rather than queued, because a version check needs the server | button disabled, reason shown |
| Signing out really ends the session | dashboard redirects to sign-in afterwards |
| One user's data never appears for another | second account sees none of the first's |
| A sign-in failure does not reveal whether the address exists | message asserted not to distinguish |

---

## 5. How it was verified

```powershell
npx tsc --noEmit       # clean
npx eslint .           # clean
npx prettier --check . # clean
npx vitest run         # 44 files, 1096 tests
npm run test:e2e       # 17 tests, chromium, production build, disposable database
npx next build         # succeeds
```

Test count went from 1026 to 1096 (+70 unit), plus 9 new browser tests (8 → 17).

### How the checklist was verified rather than assumed

Test titles were extracted from all 44 files and read against each checklist item. This is
worth recording because "Atomic transactions" is the kind of box that gets ticked because
transactions are *used*, not because a rollback is *asserted*. In this project it genuinely
is asserted, in three places.

### What was not verified

- **Only Chromium.** `npx playwright install webkit` would add Safari's engine. Worth doing
  before trusting the PWA behaviour on iOS, where the cache quota is smaller and eviction more
  aggressive.
- **No mobile viewport run.** The UI is mobile-first, but every E2E test runs at desktop
  Chrome's size. A layout that breaks one-handed use would not fail anything.
- **No accessibility assertions beyond roles and labels.** Locating by role exercises some of
  it incidentally. There is no axe pass, and per section 40 full validation needs manual
  testing with assistive technology and expert review regardless.
- **No performance or load testing.** Out of MVP scope.

---

## 6. Known gaps

### E2E journeys left unticked

| Journey | Why |
| --- | --- |
| Create shared expense | The split editor is the most complex form in the app, and a browser test for it is worth writing properly rather than quickly. Covered at the API level by 41 integration tests. |
| Settle expense | Covered by 36 integration tests including over-settlement and concurrency. |
| Transfer money | Covered by 37 integration tests. |
| Pay credit card | Covered by 40 integration tests. |

The harness and the helper pattern are in place, so each is a short spec rather than new
infrastructure. Section 7 says how.

### Other gaps

| Gap | Deferred to |
| --- | --- |
| **A rejected expense form clears the amount and description.** Uncontrolled inputs with no `defaultValue` on a new expense. For a form meant to be fast one-handed entry, retyping after a validation error is a real annoyance. | Post-MVP |
| **`isoDate` rolls an impossible calendar date forward** instead of rejecting it. Unreachable from the UI; reachable from REST and sync. | Post-MVP |
| **Chromium only, desktop viewport only.** | Post-MVP |
| **No coverage reporting.** Section 52 suggests thresholds; none are configured, so a gap in a new module is noticed by review rather than by CI. | Post-MVP |
| **The error boundaries are still not triggered by a real crash.** Group 18's gap. The 404 page is now covered, but provoking a render failure would need a deliberate throwing route. | Post-MVP |
| **E2E specs share one database across the run.** Each test registers a fresh user, so they are isolated by ownership rather than by a clean database, and `workers: 1` keeps them serial. Fine now; worth revisiting before parallelising. | Post-MVP |

---

## 7. Notes for the next group

**Group 20 is final hardening.** What it needs to know:

- **Every suite passes and the counts are above.** Group 20's "run type checking / lint /
  unit / integration / E2E / production build" boxes can be ticked by running the six commands
  in section 5.
- **Two fixes in this group were product bugs, not test bugs** — sign-out and the offline
  redirect. Both are worth a second look during the review pass, since both came from group 16
  and suggest that group's interaction with existing flows deserves scrutiny.
- **`docs/updates/GROUP-18-ERROR-HANDLING.md` asked for the boundaries to be exercised.** The
  404 page now is; `error.tsx` and `global-error.tsx` still are not.

**Adding one of the four remaining journeys:**

1. Add a helper to `tests/e2e/helpers/app.ts` following `recordPersonalExpense`.
2. Locate fields by `id` via `formField(page, id)`; use `selectOptionByText` for a `<select>`.
3. Wait for a URL that cannot match the form's own path — `/\/transactions\/[a-f\d]{24}$/`,
   not `/\/transactions/`. That mistake cost an hour here: it passed instantly while the form
   sat on screen with a validation error, and surfaced later as a confusing "row not found".
4. Assert a **balance**, not just that a row appeared. A UI that records an expense without
   moving the account is the failure worth catching.

**Practical notes:**

- **`npm run test:e2e`, not `npx playwright test`.** The wrapper provides the disposable
  database. Running Playwright directly points the journey specs at `.env.local`, which is a
  real cluster. `npm run test:e2e:pwa` is safe either way — those specs need no database.
- **Arguments forward:** `npm run test:e2e -- --headed`, `-- --ui`, or a single spec path.
- **Each run rebuilds** (about forty seconds) so a stale `.next` cannot silently test the
  previous revision.
- **Going offline in a test needs both halves:** `goOffline(page, context)` cuts the network
  *and* tells the application. `context.setOffline` alone leaves the app believing it is
  online.
- **Warm the cache before going offline.** An unvisited page is not available offline, by
  design.
