# Group 12 — Dashboard

Status: complete.

---

## 1. What was built

The dashboard replaced its placeholder. It now answers, in one screen: how much money
do I have, how much do I owe on cards, how much have I spent this month, who owes me,
who do I owe, and what happened recently.

* `/dashboard` — the page. Quick actions, four summary tiles, net position, spending
  with a category breakdown, account positions, the two people panels, recent activity,
  recent settlements.
* `GET /api/dashboard` — the same view as JSON, as specified in
  `docs/10-API-CONTRACT.md` section 25.
* An onboarding state for a user who has recorded nothing yet.

**Not one figure on this screen is stored.** Every number is recomputed from
transactions, splits, settlements and allocations on each load. That was the
requirement (`docs/01-MVP-SCOPE.md` section 4) and it is what the tests verify.

No new calculation was written. The dashboard is an assembly of functions that groups
4, 5, 7, 8, 9, 10 and 11 already shipped and tested.

---

## 2. Files added or changed

### Features — `src/features/dashboard/` (new)

* **`view-models/dashboard-view-model.ts`** — `DashboardView` and its parts:
  * `MoneyFigure` / `toMoneyFigure(money)` — every amount is carried both as an exact
    decimal string and pre-formatted, so no component ever formats money itself.
  * `DashboardTotals` / `toDashboardTotals(totals, accounts)` — adds
    `anyCardOverLimit` and `hasCreditCards`, so the page can hide the card tiles rather
    than showing four zeros to someone with no cards.
  * `DashboardPeopleTotals` / `toDashboardPeopleTotals(totals)` — adds `isSettled`.
  * `DashboardSpending` — this month, last month, a `comparison` word, and
    `topCategories`.
* **`queries/dashboard-queries.ts`** — **`getDashboardView(userId, currency, timezone,
  now?)`**. The `now` parameter is injectable so month-boundary behaviour is testable
  without touching the clock.
* **`components/SummaryTile.tsx`** — one figure, with a label and optional hint.
* **`components/QuickActions.tsx`** — the four create routes.
* **`components/AccountBalances.tsx`** — every active account with its position.
* **`components/SpendingSummary.tsx`** — this month plus the category breakdown.
* **`components/PeopleBalances.tsx`** — one direction per panel.
* **`components/RecentSettlements.tsx`**.

### API

* **`src/app/api/dashboard/route.ts`** (new) — `GET`.

### Pages

* **`src/app/(app)/dashboard/page.tsx`** (rewritten).

### Tests

* **`tests/integration/dashboard.test.ts`** (new) — 27 tests.

---

## 3. Key decisions

### One endpoint, not six

`GET /api/dashboard` returns everything at once. Six separate requests could interleave
with a write, and the user would see a spending total that does not match the
transaction list rendered beside it. Every figure in one response describes one instant.

### Nothing is cached, and the cost is accepted openly

`getDashboardView` issues several full-collection reads per load: accounts, people,
all transactions, all splits, all settlements, all allocations. At MVP scale — thousands
of records, `docs/07-MVP-IMPLEMENTATION-PLAN.md` section 31 — this is fine.

The comment in the query says what to do if it stops being fine: **build a projection
rebuilt from these same events, never a mutable balance column.** A stored aggregate is
the one number that can silently disagree with the list it summarises, and there is a
test asserting the dashboard drops to zero the instant an expense is deleted precisely
to lock that in.

### Two people panels, not one signed list

"Owes you" and "You owe" are separate cards. A single list forces the reader to decode
a sign on every row, and misreading the direction of a debt is the most consequential
mistake available on this screen. The two panels also let each one carry its own empty
message ("Nobody owes you anything right now." / "You are square with everyone.").

### The month comparison is a sentence

`DashboardSpending.comparison` is `"more" | "less" | "same" | "no_previous"` and the UI
renders "₹600 more than last month". Not an arrow and a percentage: a red ▲ 14% is
ambiguous about *what* went up, and it fails entirely without colour
(`docs/06-CODING-PRACTICES.md` section 40).

`"no_previous"` is a distinct case rather than being folded into "more". A first-month
user comparing against zero would otherwise be told their spending is up 100%.

### A credit card leads with what is owed, not a signed balance

`summariseAccount` returns `balance = outstanding.negated()` for a card, which is
correct for summing net position. But `-₹15,000` is the wrong thing to *lead* with: the
question about a card is "how much do I owe and how much can I still spend". So
`AccountBalances` shows `formattedOutstanding` with the word "owed" beneath it, plus
available credit in the meta line.

The signed value is still used, unchanged, for `netPosition`.

### Card tiles are conditional; the "owed to you / you owe" tiles take their place

A user with no credit cards has no card debt and no available credit, and two tiles
reading ₹0.00 are noise. When `hasCreditCards` is false those two slots show the people
totals instead, so the tile row is always four useful figures. Net position is likewise
hidden without a card, because "liquid minus card debt" with no card debt is just the
liquid balance again.

### `isEmpty` is about activity, not accounts

A user who has added a bank account but recorded nothing still gets the onboarding
state — with their account list shown beneath it, so the account they just created is
visibly there. Keying `isEmpty` off account count would have hidden the prompt from
exactly the user who needs it.

### Person balances are computed once and shared

`getDashboardView` builds each `PersonBalance` once, then derives both the per-person
rows and `calculatePeopleTotals()` from that same array. An earlier draft computed them
twice — once for the rows, once for the totals — which is precisely the shape of bug
this project is built to avoid: two paths to one number.

### The category breakdown is filtered to the displayed month

`calculateSpendingByCategory` runs over only this month's expenses, not all of them, so
the breakdown sums to the headline figure above it. There is a test asserting exactly
that: the category totals add up to `spending.total`.

---

## 4. Business rules enforced

The dashboard enforces no new rules — it is a read model. What it must not do is
*misreport* the rules the other groups enforce, and that is what the tests check.

| Invariant | Test |
| --- | --- |
| Transfers are not spending | ₹450 expense + ₹10,000 transfer → spending `450`, liquid total unchanged at `49550` |
| Card payments are not spending | ₹1,200 card purchase + ₹1,200 payment → spending `1200`, not `2400` |
| Shared expense counts the user's **share** | ₹1,200 dinner, ₹400 own share → spending `400`, account down `1200` |
| Card liability is separate from liquid balance | card owing `15000` → liquid stays `50000`, outstanding `15000`, available `135000` |
| Net position = liquid − card debt | `50000 − 15000` → `35000` |
| Over-limit is surfaced | `10000` limit, `12000` spent → `anyCardOverLimit` true |
| Months boundary in the **user's** timezone | expenses seeded at 20:30 UTC with `Asia/Kolkata`; last month's `9999` stays out of this month's `450` |
| Settling removes a person from the outstanding list | full settlement → `peopleOwingUser` empty, `peopleOweUser` = `0` |
| Archived accounts are excluded | archived cash account absent from `accounts` |
| Deleting an expense updates every figure | spending `450` → `0`, balance restored to `50000` |
| No cross-user data | second user sees `isEmpty`, no accounts, zero everywhere |

---

## 5. How it was verified

```text
npx tsc --noEmit                        clean
npx eslint .                            clean
npx prettier --check                    clean
npx vitest run                          679 tests passed (28 files)
npx next build                          succeeded
```

Group 11 finished at 652 tests; this group added 27, all integration.

The tests exercise the route handler, so they cover the whole path: auth wrapper →
query → repositories → MongoDB → domain calculations → view model.

Two details worth knowing about the test setup:

* Expenses are seeded at **20:30 UTC** with the user on `Asia/Kolkata`. That is 02:00
  the next day locally, so any code that grouped months in UTC would put them in the
  wrong month and the assertions would fail.
* The category-breakdown test asserts the parts sum to the whole, rather than only
  checking each part. That catches a filtering mistake that per-row assertions would
  miss.

---

## 6. Known gaps

* **No spending chart or trend line.** The figures and a four-row category breakdown
  only. A chart is not in the MVP scope list.
* **No budget or target.** "Spent ₹24,500 this month" has nothing to be compared
  against except last month.
* **`topCategories` is capped at four and parent categories are not rolled up.** A
  child category reports on its own; its spending is not added to its parent's. Worth
  revisiting if category trees get deep.
* **Statement and due dates are not surfaced.** `statementDay` / `paymentDueDay` are
  stored (group 4) and shown on the card's own page, but the dashboard does not warn
  that a payment is due. Deliberately out of MVP scope.
* **A card sitting in credit is not called out.** Group 11 allows overpayment, and the
  card's own page says so, but the dashboard tile just shows a negative outstanding
  figure.
* **Single currency only.** `calculateAccountTotals` filters to the user's currency and
  skips accounts that do not match, so an account in another currency is silently
  absent from the totals. Multi-currency is out of MVP scope, and accounts are already
  constrained to the user's currency at creation, so this is currently unreachable.
* **No client-side refresh.** The page is a server component and revalidates through
  `revalidatePath("/dashboard")`, which every write action already calls. There is no
  polling and no optimistic update.
* **No UI component tests.** The dashboard components are covered only through the
  integration tests of the data they render. Group 19 owns the component and E2E
  layers.

---

## 7. Notes for the next group

Group 13 (Transaction History) extends the activity list. Most of it already exists.

**What is already built:**

* `getTransactionListView(userId, timezone, query)` in
  `features/transactions/queries/expense-queries.ts` returns `{ items, groups,
  nextCursor, hasMore, accountNames, categoryNames, personNames }`.
* `ListTransactionsQuery` already supports `types[]`, `accountId` (matching plain,
  source **and** destination), `categoryId`, `personId`, `from`, `to`, `search`, and
  `shared`. The repository implements all of them; `listExpensesQuerySchema` validates
  all of them; and `TransactionFilters` already exposes a control for each.
* `TransactionList` renders every one of the four types correctly, including the
  direction line for transfers and card payments via `accountMeta()`.
* Pagination is keyset, not offset — `cursor` + `hasMore`. Keep it that way: offset
  pagination skips or repeats rows when the user records something mid-scroll.

**What group 13 actually has to add:**

* A **settlement indicator** on rows whose splits have allocations.
  `settlementAllocationRepository().countBySplitIds()` is the primitive;
  `isExpenseSettled()` in `features/transactions/queries/settlement-status.ts` does it
  for one expense. A batched version will be needed to avoid a query per row.
* **Infinite loading** or a nicer "load older" than the current link, which resubmits
  the whole query string.
* The task list asks to "show transaction type" — the badge exists for non-expense rows
  already, so check it against the intent rather than adding a second one.

**Do not** add a new list query. Extend `getTransactionListView`; the dashboard calls it
too, and two list read models would drift.
