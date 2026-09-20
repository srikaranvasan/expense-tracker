# Group 13 — Transaction History

Status: complete.

---

## 1. What was built

The activity list at `/transactions` became a usable history rather than a paginated
dump.

Three things are new:

1. **A settlement indicator on every shared expense row** — "Part settled" or
   "Settled", derived from the actual allocations, computed for a whole page in two
   queries rather than one per row.
2. **Appending pagination.** "Load older" now adds a page below what is already on
   screen instead of navigating and replacing it. The first page still renders on the
   server, so the list works with JavaScript disabled.
3. **A semantic fix to the shared/personal filter**, which was returning transfers as
   "personal expenses".

Everything else the group asked for — type, amount, account, category, date,
description, shared indicator, and the account/category/date/person/search filters —
already existed from groups 7, 8, 10 and 11 and was verified rather than rebuilt. The
group's real contribution is the settlement indicator, the pagination behaviour, and
25 integration tests that pin the filter semantics down.

---

## 2. Files added or changed

### Domain — `src/domain/settlements/`

* **`transaction-status.ts`** (new) — rolls a set of obligations up into one status per
  transaction:
  * `TransactionSettlementStatus = { status: SplitStatus | null; outstandingCount;
    obligationCount }`
  * `NO_SETTLEMENT_STATUS` — the shared "nothing to settle" value.
  * `deriveTransactionSettlementStatus(obligations)` — one expense.
  * `summariseTransactionSettlements(obligations)` — many, grouped in a single pass.
* **`transaction-status.test.ts`** (new) — 8 unit tests.

No new arithmetic. It consumes `PersonObligation` from
`domain/people/calculations.ts`, which group 5 already built and which already knows
that whether a split is a debt depends on who paid.

### Features — `src/features/transactions/`

* **`queries/settlement-status.ts`** (changed) — kept `isExpenseSettled()` and added
  **`getSettlementStatusForTransactions(userId, transactions, splits?)`**, the batched
  version. Accepts already-loaded splits so the list does not fetch them twice.
* **`queries/expense-queries.ts`** (changed) — `getTransactionListView` and
  `getExpenseDetailView` now attach settlement status.
* **`view-models/expense-view-model.ts`** (changed) — `TransactionListItem` gained
  `settlementStatus`, `settlementLabel` and `outstandingShareCount`.
  `toTransactionListItem` takes an optional fourth argument defaulting to
  `NO_SETTLEMENT_STATUS`, so existing callers were unaffected.
* **`components/TransactionHistory.tsx`** (new) — the client component that appends
  pages.
* **`components/TransactionList.tsx`** (changed) — added the `SettlementBadge`.
* **`components/ExpenseDetail.tsx`** (changed) — a settlement badge in the header and
  "N still owing" / "all settled" in the participants subtitle.

### Server

* **`repositories/mongo/transaction-repository.ts`** (changed) — `shared: false` now
  constrains to `type: "expense"`. See decisions.

### API

* **`src/app/api/expenses/route.ts`** (changed) — `GET` now delegates to
  `getTransactionListView` and returns `accountNames`, `categoryNames` and
  `personNames` alongside the rows.

### Pages

* **`src/app/(app)/transactions/page.tsx`** (changed) — renders `TransactionHistory`;
  the server-side `buildNextHref` helper was deleted.

### Tests

* **`tests/integration/transaction-history.test.ts`** (new) — 25 tests.

---

## 3. Key decisions

### `shared: false` was returning transfers, and that was a real bug

The repository implemented "personal" as *everything not in the shared set*. A transfer
has no splits, so it is not in the shared set, so it was a "personal expense".

The effect: toggling the shared/personal control silently changed which **record types**
were listed. A user filtering to "Personal only" saw their transfers appear.

Fixed by taking the complement over `type: "expense"` only. Personal is a property of
an expense; a transfer is neither personal nor shared, it is simply not an expense.

Found because a test asserted 2 rows and got 3. It is now pinned by
`filters to shared expenses only`.

### A transaction's settlement status is a strict roll-up

`settled` requires **every** obligation on the expense to be fully settled. A dinner
split three ways with one person paid up reports `partially_settled`, not `settled`.

Reporting "settled" while a participant still owes is the most misleading thing this
badge could do — the user would stop chasing a debt that is still outstanding. There is
a dedicated unit test and a dedicated integration test for exactly this case.

### Only two of the three states get a badge

Every shared expense begins unsettled, so a badge saying so on every row is noise that
makes the two informative states harder to find. `SettlementBadge` renders for
`settled` and `partially_settled` and returns `null` otherwise.

A personal expense gets `settlementStatus: null` — not `"unsettled"` — because there is
genuinely nothing to settle. The distinction is in the type, so a component cannot
accidentally treat "nothing owed" as "owed and unpaid".

### The status is computed per page, in two queries

The obvious implementation calls `isExpenseSettled()` per row: fifty round trips to
render fifty badges. Instead `getSettlementStatusForTransactions` fetches the page's
splits once (or reuses the ones the list already loaded), their allocations once, and
rolls up in memory.

It also filters to expenses before doing any of that, so a page of transfers costs zero
extra queries.

### Pagination appends; it does not navigate

The previous "Load older" was a link that re-rendered the page with a cursor, replacing
what was on screen. Scrolling back through a month meant losing everything already read.

`TransactionHistory` is a client component that fetches `/api/expenses` and appends. The
first page is still server-rendered and passed in as props, so the list is present and
readable before any JavaScript runs.

Deliberately **not** on-scroll. An automatic fetch fights the user's scroll position,
makes any footer unreachable, and is invisible to keyboard users. An explicit button is
focusable and its loading state is announced.

### Appended pages are de-duplicated by id

If a write lands between two page fetches, a row can appear in both. Rendering it twice
would look like a duplicate expense — the one failure mode this application must never
appear to have (`docs/13-MVP-TASK-GROUP.md`, "No duplicate expenses"). The append
filters against the ids already held.

Cursor paging makes this rare; the guard makes it impossible to see.

### `GET /api/expenses` now returns the name maps, and uses the page's read model

Appended rows need account, category and person names. Two options: send them with the
page, or carry resolved names on every row.

Sending them with the page won, and the route was switched from `listExpenses` +
manual mapping to `getTransactionListView` — the same read model the page uses. Two list
shapes would eventually disagree about something, and the settlement badge was already
going to be the first thing they disagreed about.

Client-side the maps are **merged**, not replaced: each page only carries names for the
rows it contains.

The change is additive, so the existing expense integration tests were unaffected.

---

## 4. Business rules enforced

This group is a read model and enforces no writes. What it must do is report the other
groups' rules honestly.

| Behaviour | Test |
| --- | --- |
| A personal expense has no settlement state | `settlementStatus` is `null`, not `"unsettled"` |
| A fresh shared expense is unsettled | `unsettled`, `outstandingShareCount` 1 |
| A part payment reports part settled | `partially_settled` after allocating 200 of 600 |
| A full payment reports settled | `settled`, `outstandingShareCount` 0 |
| One paid participant out of two is **not** settled | `partially_settled`, `outstandingCount` 1 |
| A debt the **user** owes is tracked too | person paid → obligation exists and is unsettled |
| Transfers have no settlement state | `null` |
| A shared row shows the user's share, not the amount | ₹800 paid by Arun, ₹300 own share → `userShare` 300, `isSplit` true |
| A transfer row exposes both accounts | `fromAccountId` and `toAccountId` both present with names |
| `shared=false` excludes transfers | 2 personal expenses, not 3 rows |
| `accountId` matches either side of a transfer | filtering by the destination returns the transfer |
| Filters survive pagination | page 2 of a searched list contains only matches, no repeats |
| Cursor paging neither skips nor repeats | 12 rows walked in pages of 5 → exactly 12 unique, newest first |
| No cross-user rows or names | second user sees zero rows and an empty `accountNames` |

---

## 5. How it was verified

```text
npx tsc --noEmit                        clean
npx eslint .                            clean
npx prettier --check                    clean
npx vitest run                          712 tests passed (30 files)
npx next build                          succeeded
```

Group 12 finished at 679 tests; this group added 33 (8 unit + 25 integration).

The pagination test is worth describing because it is the one that would catch a
regression in the cursor implementation: twelve expenses are seeded on consecutive days,
then walked in pages of five until `hasMore` is false, collecting every description. It
asserts twelve rows, twelve **unique** rows, and that the first is the newest and the
last is the oldest. An off-by-one in the cursor shows up as a duplicate or a missing
row, not as an error.

---

## 6. Known gaps

* **No settlement indicator on the settlement side.** The badge tells you an expense is
  settled; it does not link to the settlement that did it. `/settlements/:id` shows the
  reverse direction already.
* **Category filtering does not include child categories.** Filtering by a parent
  returns only expenses tagged with the parent itself. `getParentCategoryOptions` and
  `siblingsOf` exist from group 6, so the tree is available if this is wanted.
* **No amount-range filter**, and no sort other than newest-first.
* **`from`/`to` are compared against the stored UTC instant**, not against day
  boundaries in the user's timezone. Picking "to: 31 Aug" therefore excludes an expense
  recorded late on the 31st local time for a user east of UTC.
  `endOfDayInTimezone()` exists in `lib/dates` and is the fix; it was left alone because
  it changes the query contract shared with the dashboard and offline sync.
* **No virtualisation.** Appending indefinitely keeps every row in the DOM. Fine for the
  MVP's scale, and the page size cap limits it.
* **Appended pages are lost on navigation.** Going into a transaction and back re-renders
  only the first page. Fixing it properly means putting loaded pages in a cache, which is
  group 14's territory.
* **No component or E2E tests** for the append behaviour — the API path it uses is
  covered, the React interaction is not. Group 19.

---

## 7. Notes for the next group

Group 14 (Offline Storage) is the first group that is not a variation on what already
exists. Some things it should know:

**Every record already has a `clientId`.** It is generated by the client, unique per
user, and every create service looks it up **before validating anything** — the pattern
established in group 6 and repeated in every service since. That is the hook offline
creation hangs on: a queued create can be replayed safely any number of times.

**Every record already has `syncVersion` and `updatedAt`**, and every repository has a
`changesSince(userId, query)` method (group 3) for the pull side.

**`SyncOperation` collection and repository already exist** (group 3) and are unused so
far. `syncOperationRepository()`.

**Soft delete is universal.** Nothing is ever removed, which is deliberate: a hard
delete lets an offline device resurrect a record on its next sync
(`docs/09-DATABASE-SCHEMA.md` section 25). Note the consequence already visible in
groups 10 and 11 — `findByClientId` intentionally *does* return soft-deleted rows, so
replaying a create for a deleted record returns the deleted row rather than inserting a
second one. **This is the open question to settle in group 14 or 15, for all record
types at once.** It is listed as a known gap in three update documents now.

**Amounts must stay strings in local storage.** `Money` serialises via `toJSON()` to
`{ amount: string, currency: string }`. Storing a JavaScript number in IndexedDB would
reintroduce float error at exactly the boundary the whole money layer exists to protect
(`docs/06-CODING-PRACTICES.md` section 55).

**What to cache first.** The dashboard read model (`getDashboardView`) and the first page
of the transaction list are what the app needs to open usefully offline. Both are pure
reads with no local computation, so caching their outputs is enough — do not try to
recompute balances on the client. The domain layer is framework-free and importable from
client code if that changes, but the arithmetic should stay in one place.

**One thing group 13 leaves behind for group 14:** appended pages are dropped on
navigation because there is no client cache. If group 14 introduces one, that is where
the fix belongs.
