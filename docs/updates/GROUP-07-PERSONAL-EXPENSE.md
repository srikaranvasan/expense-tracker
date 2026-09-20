# Group 7 - Personal Expense

## 1. What was built

The first write path that moves money: recording an expense the user paid for
themselves, plus the transaction list with filters, search, and pagination.

Two decisions here shape everything that follows.

**A personal expense still gets a split row.** One split, the user, for the full
amount. Nothing forces this — a personal expense has no one to share with — but it
keeps a single invariant true everywhere: *a transaction's active splits always sum to
its amount*. The spending, balance, and settlement code therefore never needs an
"unsplit" special case, and converting a personal expense to a shared one in group 8
becomes a change of split rows rather than a change of shape.

**Spending is separated from money movement.** `domain/transactions/calculations.ts`
answers "how much did I spend?", which is a different question from "how much money
left my account". They differ for every shared expense, and conflating them is the
mistake the module exists to prevent.

Delivered: create, edit, soft-delete, detail view, and a paginated list filterable by
type, account, category, person, date range, shared/personal, and description search.

## 2. Files added or changed

### Domain — `src/domain/transactions/`

**`calculations.ts`** — spending classification, reused by group 12's dashboard:

```ts
isSpending(transaction)                     // expense only
isNonSpendingType(type)
userSpendingFor(transaction, splits)        // the user's share, not what they paid
indexSplitsByTransaction(splits)
calculateTotalSpending(transactions, splits, currency)
calculateSpendingByCategory(transactions, splits, currency)
calculateMonthlySpending(transactions, splits, currency, timezone)
calculateSpendingForMonth(transactions, splits, currency, timezone, reference)
```

**`rules.ts`**:

```ts
assertValidExpenseAmount(amount)
assertValidDescription(description) → normalised string
assertValidExpensePaymentSource(paidBy, account, amount)
assertExpenseNotSettled(allocationCount, action?)
```

Tests: `calculations.test.ts` (30 cases).

### Server — `src/server/services/transactions/expense-service.ts`

```ts
createPersonalExpense(userId, userCurrency, command, deps?)
updatePersonalExpense(userId, expenseId, userCurrency, command, deps?)
deleteExpense(userId, expenseId, deps?)
getExpense(userId, expenseId, deps?)
listExpenses(userId, query, deps?)     // page + the splits for those rows
```

All return `ExpenseWithSplits { transaction, splits }`. Dependencies are
`{ transactions, splits, allocations }`.

### API

`api/expenses/route.ts` (GET list, POST create), `api/expenses/[id]/route.ts`
(GET, PATCH, DELETE).

### Feature — `src/features/transactions/`

- `schemas/expense-schemas.ts` — `createPersonalExpenseSchema`,
  `updatePersonalExpenseSchema`, `listExpensesQuerySchema`, `expenseIdParamSchema`.
- `view-models/expense-view-model.ts` — `TransactionListItem`, `ExpenseDetailView`,
  `ExpenseParticipantView`, `TransactionDayGroup`, `toTransactionListItem`,
  `toExpenseDetailView`, `groupByDay`.
- `queries/expense-queries.ts` — `getTransactionListView`, `getExpenseDetailView`.
- `actions/expense-actions.ts` — `createPersonalExpenseAction`,
  `updatePersonalExpenseAction`, `deleteExpenseAction`.
- `components/` — `ExpenseForm`, `TransactionList` (+ `RecentTransactionList` for the
  dashboard), `TransactionFilters`, `ExpenseDeleteButton`.

### Pages

`app/(app)/transactions/` — list, `new`, `[id]`, `[id]/edit`.

### Changed

`SettlementAllocationRepository.countBySplitIds()` gained an optional
`RepositoryContext`, so group 9 can run the over-allocation check inside its
transaction.

## 3. Key decisions

### A personal expense has one split

Covered above. The cost is one extra row per expense; the benefit is that
`userSpendingFor`, the person-balance code, and the settlement code all read the same
shape regardless of how an expense was created.

`userSpendingFor` still handles the no-split case (returns the full amount) because
data seeded directly, or arriving from an older client, may lack split rows. But
anything this application writes has them.

### Spending uses the user's share, not the amount paid

```text
Paid ₹1,200 for a group dinner, own share ₹400

account movement   ₹1,200
spending           ₹400
```

`03-DATA-FLOW.md` section 7 is explicit. The list reflects this: for an expense it
shows the user's share as the headline figure and the full amount underneath when they
differ, because "what did this cost me" is what a spending list answers.

### Transfers and card payments are not spending

`isSpending()` returns true only for `expense`. A transfer moves money between the
user's own accounts — nothing was consumed. A credit-card payment settles a liability
that was *already* counted as spending when the card was used; counting it again would
double every card purchase. Income is money arriving.

This is asserted in the unit tests now, before groups 10 and 11 create those types.

### An account is required when the user paid, forbidden when someone else did

`assertValidExpensePaymentSource()` enforces both halves:

- The user paid → an account is required. Money left somewhere, and without it the
  balance is wrong.
- A person paid → an account must be absent. Recording one would move a balance that
  never moved. The user still owes their share, but that is a person balance
  (`09-DATABASE-SCHEMA.md` section 13).

The second half only fires from group 8, but the rule is written and tested now.

### The transaction and its split are written in one MongoDB transaction

A transaction without its split would appear to have no participants, and every
spending total reading it would report zero. `withTransaction()` makes the pair
atomic.

On delete, splits are soft-deleted *before* the transaction. If the second write
failed, an expense with no splits is a clearer inconsistency to detect than splits
pointing at a live transaction that no longer has them.

### Idempotency is checked before validation

Same pattern established in group 6. `createPersonalExpense()` calls
`findByClientId()` first and returns the existing expense with its splits. A retried
offline create must not create a second expense or move the balance twice — a test
asserts the balance moved exactly once after a duplicate POST.

### Editing the amount rewrites the split rather than patching it

The single user split must keep matching the amount. Rewriting gives one code path —
"the splits of this expense are now exactly these" — which is the same path group 8
will use for a multi-participant edit. Patching in place would need separate logic
for one split versus many.

### A settled expense cannot be edited or deleted

`assertExpenseNotSettled()` refuses when any allocation points at one of the expense's
splits. Changing the amount would leave allocations referencing a share that no longer
exists, and the person balance would silently drift
(`03-DATA-FLOW.md` section 21). The user must remove the settlement first.

This is enforced now, before settlements can be created in group 9, so the guard
cannot be forgotten later. A test seeds a settlement directly and asserts the delete
is refused with `EXPENSE_HAS_SETTLEMENTS`.

### A shared expense reports 404 from the personal-expense endpoints

Rather than a 400 explaining the wrong endpoint was used. `PATCH /api/expenses/:id`
is *the personal expense resource*; a shared expense is not that resource. The edit
page redirects to the detail view instead of rendering a form whose submission would be
rejected.

### Filters live in the URL

`TransactionFilters` pushes to the query string rather than holding state. A filtered
view can be bookmarked and shared and survives a refresh. Changing any filter deletes
the cursor, because a page-two cursor from the previous result set would skip or repeat
rows.

### The page validates its own query string

`app/(app)/transactions/page.tsx` runs `listExpensesQuerySchema` over its
`searchParams` — the same schema the API uses. A hand-edited URL therefore cannot reach
the repository unchecked, and an invalid filter shows a notice rather than a crash.

### Names are resolved in one batch per page

`getTransactionListView()` collects every referenced account, category, and person id
across the page and issues three lookups, returning name maps. Per-row resolution would
mean up to 150 queries for a 50-row page.

### Field order follows how people think about a purchase

Amount, description, account, category, date, notes — with the amount autofocused on
create. Expense entry is the most frequent action in the app, so the field the user
came to type is first.

### The form blocks rather than fails when there are no accounts

An expense requires an account. Rendering the form would produce a submission that
cannot succeed, so `ExpenseForm` shows a message pointing at account creation instead.

## 4. Business rules enforced

```text
An expense amount must be positive and no more precise than the currency allows
An over-precise amount is rejected, never silently rounded
A description is required and whitespace-normalised
An account is required when the user paid
An account is forbidden when another person paid
The account must be active, owned by the user, and in the user's currency
A category is optional, but must be owned, active, and of kind "expense"
Every expense has splits summing exactly to its amount
A personal expense has one split: the user, for the full amount
The transaction and its splits are written atomically
A retried create with the same clientId returns the original and moves no balance twice
Editing the amount rewrites the splits to match
A settled expense cannot be edited or deleted
Expenses are soft-deleted; the row and its splits survive
Only an expense counts as spending
Spending is the user's share, not the amount they paid
Deleting an expense restores the account balance
```

## 5. How it was verified

```text
npx tsc --noEmit         clean
npx eslint .             clean
npx prettier --check .   clean
npx vitest run           396 tests across unit, integration, ui
npx next build           succeeds
```

### Unit tests — `domain/transactions/calculations.test.ts`

The cases that matter:

- A shared expense paid at ₹1,200 with a ₹400 own share reports ₹400 of spending.
- The same holds when someone else paid.
- Spending is zero when the user has no share (they paid for others only).
- Transfers, card payments, and income are all zero.
- Deleted expenses and deleted splits are excluded.
- Ten `0.1` expenses total exactly `1.00`.
- A 2026-07-31 20:00 UTC expense falls in **August** for an Asia/Kolkata user, not
  July. Grouping in UTC would file it in the wrong month.

### Integration tests — `tests/integration/expenses.test.ts` (47 tests)

Create: balance drops by the amount; exactly one user split is written for the full
amount; a card expense raises outstanding and lowers available credit; every validation
rejection (zero, negative, over-precise, non-numeric, empty description, missing
account, foreign account, archived account, foreign category, archived category,
invalid date).

Idempotency: a duplicate POST returns the same id, writes one transaction and one
split, and leaves the balance moved once.

List: newest first; cursor pagination across three pages with no repeated ids and
`hasMore` / `nextCursor` correct at the end; malformed cursor rejected; filters by
account, category, date range, person, and `shared=true|false`; description search;
`.*` treated as a literal; deleted expenses excluded; cross-user isolation.

Detail: resolved account, category and payer names; participants named for a shared
expense; `paidByName` is the person and `accountName` is null when someone else paid.

Update: amount change rewrites the split and the balance reflects only the new amount;
moving accounts restores the old balance and charges the new one; category cleared with
`null`; empty update rejected; stale `syncVersion` conflicts; a shared expense reports
404.

Delete: balance restored, row retains `deletedAt`, splits removed, second delete 404s,
and a settled expense is refused with `EXPENSE_HAS_SETTLEMENTS`.

## 6. Known gaps

- **No shared expense creation.** The service, rules, and view models all handle
  shared expenses on read; creating and editing one is group 8. Integration tests use
  `seedSharedExpense` to produce them.
- **No income, transfer, or card-payment creation.** The list renders all four types
  and the filter offers them, but only expenses can be created. Groups 10 and 11.
- **No infinite scroll.** Pagination is a "Load older" link that advances the cursor in
  the URL. It works without JavaScript and is honest about where you are; an infinite
  list can be layered on later.
- **`defaultAccountId` is read but never set.** `ExpenseForm` honours
  `user.settings.defaultAccountId`, but no settings screen writes it, so it is always
  null.
- **No quick-add.** `04-USER-FLOWS.md` wants a prominent `+`; the bottom navigation does
  not yet have one, and `/transactions/new` is a full page.
- No receipt attachments, recurring expenses, or bulk edit. None are in MVP scope.
- The `income` type has no creation path anywhere, by design — no task group asks for
  one.

## 7. Notes for the next group

Group 8 (Shared Expense) should extend, not replace, what is here:

- `createPersonalExpense` is deliberately narrow. Add `createSharedExpense` alongside
  it and let both write through the same transaction-plus-splits pattern.
- **The split total must equal the transaction amount.** That invariant is already
  relied on by `userSpendingFor`, the person balance, and the settlement code. Use
  `allocateMoney` / `splitEqually` from `lib/money` so the parts sum exactly.
- `assertValidExpensePaymentSource(paidBy, account, amount)` already encodes the
  paid-by rule. When a person paid, pass `null` for the account — do not work around
  it.
- `assertExpenseNotSettled()` must guard the shared edit path too. The personal path
  already calls it.
- `updatePersonalExpense` refuses shared expenses via `assertNotShared`. Group 8's
  update should mirror that in reverse, and the edit page's redirect can then be
  removed.
- `ExpenseDetailView.participants` already renders a split breakdown, and
  `TransactionListItem.isShared` / `isSplit` already drive the list badges. Both work
  as soon as person splits exist.
- `resolveOwnedPeople()` (group 5) validates participants and rejects duplicates.
