# Group 10 — Transfers

Status: complete.

---

## 1. What was built

The user can record money moving between two accounts they own: savings to cash,
cash to a wallet, or a cash advance off a credit card. A transfer moves both account
balances and is deliberately **absent from every spending total**.

Concretely:

* `POST /api/transfers` records a transfer, `PATCH` edits one, `DELETE` soft-deletes
  one, `GET /api/transfers` lists them, `GET /api/transfers/:id` returns detail with
  both account names resolved.
* `/transactions/new/transfer` is the form. Entry points were added to the activity
  page header and the add-expense header.
* `/transactions/:id` now renders a transfer with its own layout — a direction rather
  than a category and a participant list — and `/transactions/:id/edit` routes a
  transfer to `TransferForm` instead of redirecting away from it.

The single most important behaviour: **a transfer is one transaction document** with
`fromAccountId` and `toAccountId`, of type `"transfer"`, with **no expense splits**.
Both balance effects are derived from that one row by
`deriveAccountMovements()` (group 4), which already understood `transfer_in` and
`transfer_out`. Nothing new was added to the balance engine.

---

## 2. Files added or changed

### Domain — `src/domain/transactions/`

* **`transfer-rules.ts`** (new) — the business rules:
  * `assertValidTransferAmount(amount)` — positive, within limits, not more precise
    than the currency allows.
  * `assertValidTransferAccounts(from, to, amount)` — the full pairing check, in
    order: not the same account → both usable (not archived) → same currency as each
    other → each matches the amount's currency → destination is not a credit card.
  * `assertDestinationIsNotCreditCard(to)` — separated out because group 11 needs the
    inverse of it.
  * `DEFAULT_TRANSFER_DESCRIPTION = "Transfer"`.
* **`transfer-rules.test.ts`** (new) — 14 unit tests.

### Server — `src/server/services/transactions/`

* **`transfer-service.ts`** (new). Exports:
  * `createTransfer(userId, userCurrency, command, deps?)` → `Transaction`
  * `updateTransfer(userId, transferId, userCurrency, command, deps?)` → `Transaction`
  * `deleteTransfer(userId, transferId, deps?)` → `void`
  * `getTransfer(userId, transferId, deps?)` → `Transaction`
  * `listTransfers(userId, query, deps?)` → `CursorResult<Transaction>`
  * `TransferServiceDependencies = { transactions: TransactionRepository }`

  Note the dependency list: **one repository**. No splits, no allocations, and
  therefore no `withTransaction()`.

### API — `src/app/api/transfers/`

* **`route.ts`** (new) — `GET` (list) and `POST` (create).
* **`[id]/route.ts`** (new) — `GET`, `PATCH`, `DELETE` (→ 204).

### Features — `src/features/transactions/`

* **`schemas/transfer-schemas.ts`** (new) — `createTransferSchema`,
  `updateTransferSchema`, `listTransfersQuerySchema`, `transferIdParamSchema`.
* **`view-models/transfer-view-model.ts`** (new) — `TransferListItem`,
  `TransferDetailView`, `toTransferListItem(transaction, timezone)`,
  `toTransferDetailView(transaction, context)`,
  `formatTransferDirection(from, to)`.
* **`queries/transfer-queries.ts`** (new) — `getTransferListView`,
  `getTransferDetailView`.
* **`queries/transaction-detail.ts`** (new) — `getTransactionDetail()` returning the
  discriminated union `TransactionDetail`. See decisions below.
* **`actions/transfer-actions.ts`** (new) — `createTransferAction`,
  `updateTransferAction`, `deleteTransferAction`. Reuses `ActionState` from
  `expense-actions.ts`.
* **`components/TransferForm.tsx`** (new), **`TransferDeleteButton.tsx`** (new),
  **`TransferDetail.tsx`** (new), **`ExpenseDetail.tsx`** (new — extracted from the
  detail page so the page can branch on type).
* **`components/ExpenseDeleteButton.tsx`** (rewritten as a thin wrapper).
* **`components/TransactionList.tsx`** (changed) — a row with `fromAccountId` /
  `toAccountId` now shows `"HDFC Savings → Cash"` as its meta line instead of nothing.
* **`view-models/expense-view-model.ts`** (changed) — see below.

### Shared UI

* **`src/components/ui/ConfirmDeleteButton.tsx`** (new) — the two-step delete shell,
  extracted from `ExpenseDeleteButton` so expenses, transfers, and card payments in
  group 11 all warn identically.

### Pages — `src/app/(app)/transactions/`

* **`new/transfer/page.tsx`** (new).
* **`[id]/page.tsx`** (rewritten) — branches on `getTransactionDetail()`.
* **`[id]/edit/page.tsx`** (rewritten) — transfers now reach `TransferForm`.
* **`page.tsx`**, **`new/page.tsx`** (changed) — "Transfer" links added.

### Tests

* **`tests/integration/transfers.test.ts`** (new) — 37 tests.

---

## 3. Key decisions

### A transfer's destination may not be a credit card

This is the decision that shapes the whole group. Money arriving on a credit card is
a **card payment**, which is a different business event: it reduces a liability and
raises available credit, and group 11 owns it.

Allowing a transfer to express "bank → card" would give the user two ways to record
one thing, and a card's outstanding balance would then be reduced by two record types
that mean different things. That directly contradicts the Non-Negotiable Accounting
Principle in `docs/00-README.md`.

Money moving *off* a card is a genuine transfer — a cash advance — so **only the
destination is restricted**. `assertDestinationIsNotCreditCard()` is the whole rule,
and there is an integration test for each direction.

Rejected: allowing both routes to express bank → card and reconciling later. There is
nothing to reconcile it against.

### Currencies are compared to each other *before* they are compared to the amount

The original ordering compared each account to the amount first, which made the
`from.currency !== to.currency` branch unreachable — if both accounts match the
amount, they match each other. It was reordered so a cross-currency pair produces
"Both accounts must use the same currency for a transfer", which names the real
problem, instead of a message about the amount not matching the destination.

The reordering also made the branch testable, which is how it was noticed.

### One document, not two

A transfer could have been modelled as two rows (a debit and a credit). It is one row
with two account fields, because two rows can disagree and one row cannot. There is
no state in which half a transfer exists.

This is also why **`createTransfer` does not use `withTransaction()`**. A single
document write is already atomic; wrapping it would imply there is a second write to
protect and would mislead the next reader. Contrast `createPersonalExpense`, which
genuinely needs it for the transaction-plus-split pair.

### `isSplit` is now guarded by `isSpending()`

`userSpendingFor()` correctly returns **zero** for a transfer. The list item was
computing `isSplit: !userShare.equals(amount)`, which for a transfer meant
`0 ≠ 10,000` → `true`, and the UI would have rendered "₹0.00 of ₹10,000.00".

Changed to `isSpending(transaction) && !userShare.equals(transaction.amount)`. There
is a regression test asserting a transfer reports `userShare = 0` and
`isSplit = false`.

### `getTransactionDetail()` returns a discriminated union

`/transactions/:id` cannot know from the URL what type of record it points at, and the
types need genuinely different screens. The page now calls `getTransactionDetail()`,
which reads the type with one indexed `_id` lookup and delegates to
`getExpenseDetailView()` or `getTransferDetailView()`.

That extra lookup is the cost. It was accepted so each type's loading logic stays in
its own query file rather than being fanned out into a dispatcher — and so the page
branches on a field the compiler checks, instead of rendering an expense layout full
of em dashes for every transfer.

Income and card payments still fall through to the expense layout, which reads
correctly for them (one account, no split). Group 11 will add a `"card_payment"` arm.

### The destination `<select>` hides invalid options

`TransferForm` filters credit cards out of the destination list, and filters out
whichever account is currently the source. Picking a source that was already the
destination pushes the destination to the next available option.

This is a convenience, **not** the guarantee. Both rules are enforced server-side and
tested through the API. A hidden `<option>` protects nobody who posts directly.

### `ConfirmDeleteButton` was extracted rather than duplicated

Transfers needed the same confirm-then-delete shell as expenses, and group 11 will
need a third. The shell moved to `src/components/ui/ConfirmDeleteButton.tsx` taking
`{ label, confirmPrompt, confirmLabel?, onConfirm, redirectTo }`.
`ExpenseDeleteButton` and `TransferDeleteButton` are now ~25 lines each and differ
only in wording.

---

## 4. Business rules enforced

| Rule | Where | Test |
| --- | --- | --- |
| Amount must be positive, in range, and not over-precise | `assertValidTransferAmount` | unit + API |
| Source and destination must differ | `assertValidTransferAccounts` | unit + API (create and edit) |
| Neither account may be archived | `assertAccountUsable` | unit + API (both sides) |
| Both accounts must share a currency | `assertValidTransferAccounts` | unit |
| The amount must be in the accounts' currency | `assertAccountCurrencyMatches` | unit |
| Destination must not be a credit card | `assertDestinationIsNotCreditCard` | unit + API |
| Source **may** be a credit card (cash advance) | same rule, destination only | unit + API |
| A transfer is never spending | `isSpending()` (group 7) + no splits written | API, via `calculateTotalSpending` |
| Both balances move by the full amount | `deriveAccountMovements` (group 4) | API |
| Accounts must belong to the user | `resolveOwnedAccounts` (group 4) | API |
| A repeated `clientId` creates one transfer | `findByClientId` before validation | API |
| Only a `type: "transfer"` row is reachable through these routes | `loadTransfer()` | API, both directions |
| Deleting restores both balances | soft delete + derived balances | API |

Two of these deserve emphasis.

**"Not spending" is verified from source data, not from a view model.** The test seeds
a ₹450 expense, asserts `calculateTotalSpending()` over the raw projection is
`450.00`, records a ₹10,000 transfer, and asserts it is *still* `450.00`. That is the
same function the group 12 dashboard will call.

**The type guard runs in both directions.** A transfer id sent to
`PATCH /api/expenses/:id` returns 404, and an expense id sent to
`PATCH /api/transfers/:id` returns 404. Without this, one route could rewrite the
other's records and an expense could silently become a transfer.

---

## 5. How it was verified

```text
npx tsc --noEmit                        clean
npx eslint .                            clean
npx prettier --check                    clean
npx vitest run                          595 tests passed (25 files)
npx next build                          succeeded
```

Group 9 finished at 544 tests; this group added 51 (14 unit + 37 integration).

The integration suite covers, among other cases:

* Both balances move, and their **sum is unchanged** — the arithmetic proof that
  nothing was consumed.
* Transfer excluded from spending, recomputed from the projection.
* No `expenseSplit` rows are written.
* Description defaults to `"Transfer"`; a supplied description is whitespace-normalised.
* Card destination rejected **and the card's outstanding balance verified still zero**,
  so the rejection did not half-apply.
* Card source accepted: outstanding `5000`, available credit `145000`.
* Archived source and archived destination both rejected.
* Repeated `clientId` → one transfer, balance moved once. A retry after the source was
  archived still returns the original record rather than failing.
* Edit changing the amount, and edit changing the destination — the old destination is
  verified back at its original balance.
* Delete restores both balances; the row is confirmed still on disk with `deletedAt`
  set.
* Cross-user isolation on create, get, patch, delete, and list.

---

## 6. Known gaps

* **No transfer between different currencies.** Rejected with a clear message. Needs
  an exchange rate, which is outside MVP scope.
* **Recreating a deleted transfer via its `clientId` returns the deleted row.**
  `findByClientId` intentionally ignores `deletedAt`, so a replayed offline create
  returns the soft-deleted record with a 201 rather than inserting a duplicate. This
  matches `createPersonalExpense` exactly; it was not changed here because it should
  be decided for all types at once, in group 15.
* **No dedicated transfer list page.** `GET /api/transfers` exists and is tested, but
  the UI surfaces transfers through the shared activity list. Group 13 owns
  transaction history and filtering by type.
* **`TransactionFilters` has no "transfers only" toggle.** The `type` query parameter
  supports it and the API honours it; the control is group 13's.
* **Transfers are not on the dashboard.** Group 12.
* **`updateTransfer` writes `fromAccountId` and `toAccountId` unconditionally**, even
  when unchanged. Harmless — the values are re-validated and identical — but it means
  an edit of only the notes still touches those two fields.
* **No E2E test.** Group 19 lists "Transfer money" as an E2E case.

---

## 7. Notes for the next group

Group 11 (Credit Card Payments) is the mirror image of this group, and most of the
scaffolding is now reusable.

**Use `assertDestinationIsNotCreditCard`'s counterparts, which already exist:**

* `assertAccountIsCreditCard(account)` — for the destination.
* `assertAccountIsNotCreditCard(account, reason)` — for the source. A card cannot pay
  a card.

Both are in `src/domain/accounts/rules.ts` and are currently unused by transfers.

**What carries over unchanged:**

* `deriveAccountMovements()` already handles `card_payment_in` and `card_payment_out`.
  A `type: "credit_card_payment"` row with `fromAccountId` + `toAccountId` will reduce
  the card's outstanding balance and the bank balance with no changes to the balance
  engine. `CARD_OUTSTANDING_DIRECTION.card_payment_in` is `-1`.
* `isSpending()` already excludes `credit_card_payment`, so a payment will not be
  counted — the card purchase was already counted when the card was used. Prove it
  with the same `calculateTotalSpending()` assertion used here.
* `transfer-service.ts` is the template: `findByClientId` first, no
  `withTransaction()`, `loadTransfer`-style type guard.
* `ConfirmDeleteButton` for the delete control.
* `getTransactionDetail()` in `queries/transaction-detail.ts` — **add a
  `"card_payment"` arm to the union** and a `CardPaymentDetail` component. Right now
  card payments fall through to the expense layout.

**Watch for:**

* A payment amount larger than the outstanding balance is an **overpayment**, which is
  legitimate (it leaves a credit balance). Decide explicitly whether to allow it, and
  say so in the update document. Do not silently clamp it.
* `TransferForm` excludes cards from its destination list. The card-payment form needs
  the opposite: cards only in the destination, and cards excluded from the source.
* Reuse `accountMeta()` in `TransactionList.tsx` — it already renders any row with
  `fromAccountId`/`toAccountId` as a direction, so card payments will display
  correctly with no change.
