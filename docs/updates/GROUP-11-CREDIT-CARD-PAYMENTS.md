# Group 11 — Credit Card Payments

Status: complete.

---

## 1. What was built

The user can pay down a credit card. Money leaves a bank or cash account, the card's
outstanding balance falls by the same amount, and available credit rises. The payment
is **not counted as spending** — that was already counted when the card was used.

Concretely:

* `POST /api/credit-card-payments` records a payment, `PATCH` edits one, `DELETE`
  soft-deletes one, `GET /api/credit-card-payments` lists them,
  `GET /api/credit-card-payments/:id` returns detail including **what is still owed on
  the card after this payment**.
* `/transactions/new/card-payment` is the form. It accepts `?cardId=` so arriving from
  a card's own page pre-selects it.
* A **"Pay card"** button appears on every active credit-card detail page, where the
  outstanding balance is already on screen.
* `/transactions/:id` renders a card payment with its own layout, and
  `/transactions/:id/edit` routes it to `CardPaymentForm`.

This group is the deliberate mirror of group 10. Transfers forbid a card as the
destination; card payments require it.

---

## 2. Files added or changed

### Domain — `src/domain/transactions/`

* **`card-payment-rules.ts`** (new):
  * `assertValidCardPaymentAmount(amount)`
  * `assertValidCardPaymentAccounts(from, to, amount)` — not the same account → both
    usable → destination **is** a card → source is **not** a card → same currency →
    both match the amount's currency.
  * `isOverpayment(amount, outstanding)` — a **predicate, not an assertion**. See the
    decision below.
  * `DEFAULT_CARD_PAYMENT_DESCRIPTION = "Credit card payment"`.
* **`card-payment-rules.test.ts`** (new) — 17 unit tests.

### Server — `src/server/services/transactions/`

* **`card-payment-service.ts`** (new). Exports:
  * `createCardPayment(userId, userCurrency, command, deps?)` → `Transaction`
  * `updateCardPayment(userId, paymentId, userCurrency, command, deps?)`
  * `deleteCardPayment(userId, paymentId, deps?)`
  * `getCardPayment(userId, paymentId, deps?)`
  * `listCardPayments(userId, query, deps?)` → `CursorResult<Transaction>`
  * **`getCardOutstanding(userId, card, deps?)` → `Money`** — the card's outstanding
    balance right now, derived from that card's movements. Group 12's dashboard can use
    it directly.

### API — `src/app/api/credit-card-payments/`

* **`route.ts`** (new) — `GET`, `POST`.
* **`[id]/route.ts`** (new) — `GET`, `PATCH`, `DELETE` (→ 204).

### Features — `src/features/transactions/`

* **`schemas/card-payment-schemas.ts`** (new).
* **`view-models/card-payment-view-model.ts`** (new) — `CardPaymentDetailView` with
  `outstandingAfter`, `formattedOutstandingAfter`, `cardInCredit`, `directionLabel`.
* **`view-models/direction.ts`** (new) — `formatAccountDirection(from, to)`, extracted
  from the transfer view model because transfers and card payments both read as
  "source → destination" and must phrase it identically.
* **`queries/card-payment-queries.ts`** (new) — `getCardPaymentListView`,
  `getCardPaymentDetailView`, `getCardOutstandingForForm`.
* **`queries/transaction-detail.ts`** (changed) — a `"card_payment"` arm was added to
  the `TransactionDetail` union.
* **`actions/card-payment-actions.ts`** (new).
* **`components/CardPaymentForm.tsx`**, **`CardPaymentDetail.tsx`**,
  **`CardPaymentDeleteButton.tsx`** (all new).
* **`components/TransactionList.tsx`** (changed) — now imports
  `formatAccountDirection` from its own module. Card payments already render as a
  direction with no further change, because `accountMeta()` keys off
  `fromAccountId`/`toAccountId` rather than the type.

### Accounts

* **`view-models/account-view-model.ts`** (changed) — `AccountOption` gained
  **`outstanding`** (exact decimal string) and **`formattedOutstanding`**. This lets
  the payment form offer "Pay full balance" and warn about an overpayment with no
  extra round trip.

### Pages

* **`(app)/transactions/new/card-payment/page.tsx`** (new).
* **`(app)/transactions/[id]/page.tsx`**, **`[id]/edit/page.tsx`** (changed) — a third
  branch.
* **`(app)/transactions/new/page.tsx`** (changed) — "Pay card" link added.
* **`(app)/accounts/[id]/page.tsx`** (changed) — "Pay card" action on active cards.

### Tests

* **`tests/integration/credit-card-payments.test.ts`** (new) — 40 tests.

---

## 3. Key decisions

### Overpayment is allowed, and warned about, never blocked

This was the open question flagged at the end of group 10, and the answer is: permit
it.

Paying ₹20,000 against a ₹15,000 balance happens for real reasons — a refund lands
after the payment was scheduled, or the user rounds up. **The money genuinely left
their bank account.** Refusing to record it would make the app disagree with the bank
statement, which is a worse failure than a card showing a credit balance.

The result is a **negative outstanding balance**, which
`calculateCreditCardOutstanding()` (group 4) already produces with no changes, and
which `calculateAvailableCredit()` correctly reports as *more* than the credit limit.
There is an integration test asserting outstanding `-5000` and available credit
`155000` on a `150000` limit, with `overLimit === false`.

`isOverpayment()` exists purely so the **UI can warn**. `CardPaymentForm` shows a
`tone="warning"` alert explaining the card will be left in credit; it does not disable
the submit button. `CardPaymentDetail` labels the row "Card is in credit" rather than
relying on the minus sign, because sign and colour must never be the only signal
(`docs/06-CODING-PRACTICES.md` section 40).

Rejected: clamping the amount to the outstanding balance. That would silently record
something the user did not do.

### A card may not pay a card

`assertAccountIsNotCreditCard(from, ...)` blocks it. Moving one debt onto another
discharges no liability, yet it would reduce the destination card's outstanding
balance as though money had been paid to someone. A balance transfer between cards is
a real product, but it is a *different event* with its own fee and promotional-rate
behaviour, and it is out of MVP scope.

Both cards are asserted untouched in the test for this case, not just the error code —
a rejection that half-applied would be worse than no rejection.

### The card's outstanding balance is recomputed, never stored on the payment

`CardPaymentDetailView.outstandingAfter` comes from `getCardOutstanding()`, which
re-derives the figure from the card's movements at read time. It is not a snapshot
written when the payment was created.

A stored snapshot would be wrong the moment any earlier transaction was edited or
deleted, and the user would be looking at two numbers — this one and the accounts
screen — that disagree with no way to tell which is right.

### `AccountOption.outstanding` is a string

It is money. The form compares it to the typed amount with `Number()` **only** to
decide whether to show a hint; every authoritative comparison is decimal and happens
server-side. The comment in `CardPaymentForm` says so explicitly, so nobody later
mistakes the float comparison for the real check.

### The form's two lists are complementary, not filtered copies

`cards = options.filter(type === "credit_card")` for the destination;
`sources = options.filter(type !== "credit_card")` for the source. Between them they
partition the account list, which makes it structurally impossible for the form to
offer a card-pays-card combination.

As with transfers, this is convenience only. Both rules are enforced server-side and
tested through the API.

### `formatAccountDirection` was extracted

`formatTransferDirection` was renamed and moved to
`features/transactions/view-models/direction.ts`. Two record types now describe
themselves as "A → B", and a second copy of that string template would eventually
drift.

---

## 4. Business rules enforced

| Rule | Where | Test |
| --- | --- | --- |
| Amount positive, in range, correctly scaled | `assertValidCardPaymentAmount` | unit + API |
| Destination **must** be a credit card | `assertAccountIsCreditCard` | unit + API |
| Source must **not** be a credit card | `assertAccountIsNotCreditCard` | unit + API |
| A card may not pay itself | `assertValidCardPaymentAccounts` | unit + API |
| Neither account may be archived | `assertAccountUsable` | unit + API (both sides) |
| Both accounts must share a currency | `assertValidCardPaymentAccounts` | unit |
| Payment reduces card outstanding | `deriveAccountMovements` (`card_payment_in` = −1) | API |
| Payment reduces the source balance | `deriveAccountMovements` (`card_payment_out` = −1) | API |
| Payment raises available credit | `calculateAvailableCredit` | API |
| Overpayment permitted, card left in credit | no assertion, by design | API |
| A payment is never spending | `isSpending()` excludes the type | API, via `calculateTotalSpending` |
| Accounts must belong to the user | `resolveOwnedAccounts` | API |
| Repeated `clientId` pays once | `findByClientId` before validation | API |
| Only a `credit_card_payment` row is reachable through these routes | `loadCardPayment()` | API, three directions |
| Deleting puts the debt back on the card | soft delete + derived balances | API |

**The double-counting guard is the rule this group exists to protect.** The test seeds
a ₹1,200 purchase *on the card*, asserts total spending is `1200.00`, pays the card
₹1,200, and asserts spending is **still** `1200.00`. If a card payment were ever
classified as spending, every card purchase in the app would be counted twice.

**Type isolation is tested in three directions**: a card payment id sent to
`PATCH /api/transfers/:id` → 404; a transfer id sent to
`PATCH /api/credit-card-payments/:id` → 404; an expense id sent to the card payment
route → 404.

---

## 5. How it was verified

```text
npx tsc --noEmit                        clean
npx eslint .                            clean
npx prettier --check                    clean
npx vitest run                          652 tests passed (27 files)
npx next build                          succeeded
```

Group 10 finished at 595 tests; this group added 57 (17 unit + 40 integration).

Notable cases beyond the table above:

* Card seeded with `openingBalance: 15000` (the amount already owed) against a
  `150000` limit, so every assertion checks a real reduction rather than a move from
  zero.
* Available credit verified before (`135000`) and after (`145000`) a ₹10,000 payment.
* Partial payment, then a second payment that clears the balance exactly to `0` with
  available credit back to the full `150000`.
* Paying from cash as well as from a bank account.
* Edit changing the amount (card and source both re-checked) and edit changing the
  source account (the old source verified back at its original balance).
* Edits that would make the destination a bank account, or the source another card,
  both rejected with the card's position asserted unchanged.
* Delete restores the card to `15000` outstanding and `135000` available.
* Cross-user isolation on create, get, patch, delete and list.
* **A mixed-activity scenario**: opening `15000`, plus a `2000` purchase on the card,
  plus a `3000` cash advance *off* the card (a transfer, from group 10), minus a `5000`
  payment → outstanding `15000`, available `135000`, and total spending `2000.00`. This
  is the one test that exercises all three record types against a single card at once.

---

## 6. Known gaps

* **No statement-cycle awareness.** `statementDay` and `paymentDueDay` are stored on
  the account (group 4) but nothing uses them. There is no "minimum due", no statement
  period grouping, and no due-date reminder. Out of MVP scope; the dashboard in group
  12 may surface the due day as plain text.
* **No balance transfer between cards.** Explicitly rejected, see decisions.
* **No dedicated card-payment list page.** `GET /api/credit-card-payments` exists and
  is tested; the UI surfaces payments through the shared activity list and through
  each card's `/transactions?accountId=` link. Group 13 owns history and type
  filtering.
* **`getCardOutstandingForForm()` is written and exported but not yet called.** The
  form gets the outstanding figure from `AccountOption` instead, which needs no extra
  request. It is kept because group 12's dashboard needs the same shape.
* **Overpayment is not surfaced anywhere except the card and the payment detail.** A
  card sitting in credit is not called out on the accounts list.
* **`updateCardPayment` writes both account fields unconditionally**, even when
  unchanged — same harmless behaviour as `updateTransfer`.
* **Recreating a deleted payment via its `clientId` returns the deleted row**, the
  same open question noted in group 10. To be decided for all types together in group
  15.
* **No E2E test.** Group 19 lists "Pay credit card".

---

## 7. Notes for the next group

Group 12 (Dashboard) has everything it needs already derived. **Do not add new
calculations for it.**

**Account figures** — `src/server/services/accounts/account-balances.ts` +
`domain/accounts/calculations.ts`:

* `loadAccountMovements(userId)` then `summariseAccounts(accounts, movements)` gives
  every account's `balance`, `outstanding`, `creditLimit`, `availableCredit`,
  `overLimit` in one pass.
* `calculateAccountTotals(accounts, movements, currency)` gives `liquidBalance`,
  `creditCardOutstanding`, `availableCredit`, `netPosition` — that is four of the
  dashboard's tiles in one call.
* All four transaction types now feed these correctly. Groups 10 and 11 added no new
  movement kinds; the eight in `AccountMovementKind` were already complete.

**Monthly spending** — `domain/transactions/calculations.ts`:

* `calculateSpendingForMonth(transactions, splits, currency, timezone, reference)`.
  Pass the user's timezone, not the server's: grouping in UTC puts a late-evening
  expense in the wrong month east of UTC.
* It already excludes transfers, card payments and income, and already uses the user's
  *share* of a shared expense rather than what they paid. Both are verified by the
  integration tests in groups 10 and 11.

**People** — `getPersonBalances()` / `getPeopleTotals()` from group 5 answer "who owes
me" and "who I owe".

**Recent activity** — `RecentTransactionList` in
`features/transactions/components/TransactionList.tsx` is built for this and now
renders all four types correctly, transfers and card payments included, because
`accountMeta()` keys off `fromAccountId`/`toAccountId` rather than the type.

**Quick actions** should point at the four create routes that now exist:
`/transactions/new`, `/transactions/new/shared`, `/transactions/new/transfer`,
`/transactions/new/card-payment`.

**One thing to be careful about:** the dashboard must not sum `balance` across
currencies. `calculateAccountTotals` already filters to a single currency and skips
accounts that do not match — keep that behaviour rather than reimplementing the sum.
