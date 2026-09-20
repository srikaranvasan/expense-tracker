# Group 9 - Settlement

## 1. What was built

Recording money that actually changes hands to clear a shared-expense balance, allocated
to the specific expense shares it pays down. Partial and full settlement, multiple
expenses per payment, over-settlement prevention, history, and removal.

**This group found and fixed a real concurrency bug.** A test that submits two
settlements for the same share simultaneously showed both succeeding — a genuine
over-settlement. MongoDB's snapshot isolation does not prevent it, and the fix is
described in section 3. That test is the most valuable thing in this group.

A settlement is not an expense and must never be recorded as one
(`00-README.md`, Non-Negotiable Accounting Principle). Nothing here writes a
transaction row.

## 2. Files added or changed

### Domain — `src/domain/settlements/validators.ts`

```ts
type AllocationTarget = {
  expenseSplitId, direction, personId, originalAmount, remainingAmount
}

assertValidSettlementAmount(amount)
requiredDirectionFor(obligation)      obligationDirectionFor(direction)
assertValidAllocations({ settlementAmount, direction, personId, allocations, targets })
assertAllocationsCoverSettlement(settlementAmount, allocations)
assertSettlementWithinOutstanding(settlementAmount, outstanding)
allocateOldestFirst(settlementAmount, targets)
totalRemaining(targets, currency)
```

Tests: `validators.test.ts` (34 cases).

### Server — `src/server/services/settlements/settlement-service.ts`

```ts
createSettlement(userId, userCurrency, command, deps?)  → SettlementWithAllocations
deleteSettlement(userId, settlementId, deps?)
getSettlement(userId, settlementId, deps?)
listSettlements(userId, query, deps?)
```

`AllocationInput` is `{ expenseSplitId: string; amount: string }`. Dependencies are
`{ settlements, allocations, splits, transactions }`.

### API

- `api/settlements/route.ts` — GET (history), POST (create).
- `api/settlements/[id]/route.ts` — GET (detail), DELETE.

### Feature — `src/features/settlements/`

`schemas/settlement-schemas.ts`, `view-models/settlement-view-model.ts`
(`SettlementView`, `SettlementDetailView`, `SettleableObligationView`, `SettleUpView`),
`queries/settlement-queries.ts` (`getSettleUpView`, `getSettlementListView`,
`getSettlementDetailView`), `actions/settlement-actions.ts`, and `components/`
(`SettleUpForm`, `SettlementDeleteButton`).

### Pages

`app/(app)/people/[id]/settle/page.tsx` (the link that existed since group 5 now
works), `app/(app)/settlements/page.tsx`, `app/(app)/settlements/[id]/page.tsx`.

### Changed — repositories

- `TransactionRepository.findManyByIds()` — added, so allocation targets resolve their
  owning transactions in one query instead of one per split.
- **`ExpenseSplitRepository.touchMany()`** — added. Bumps `updatedAt` and `syncVersion`
  without changing values. This is the concurrency fix; see section 3.

## 3. Key decisions

### The concurrency bug, and why snapshot isolation was not enough

The settlement service already read each share's remaining amount *inside* the
`withTransaction` block, which is what `08-OFFLINE-SYNC.md` section 34 asks for. A test
submitting two ₹500 settlements against the same ₹500 share still saw **both return
201**.

The reason is write skew. `withTransaction` uses `readConcern: "snapshot"`, and under
snapshot isolation:

```text
T1 reads allocations for split X   → none
T2 reads allocations for split X   → none        (its own snapshot)
T1 inserts allocation A            → ok
T2 inserts allocation B            → ok          different document, no conflict
both commit
```

Neither transaction wrote a document the other wrote, so MongoDB saw no conflict. The
check was correct; there was simply nothing to serialise on.

**The fix: write to the contended resource.** Both transactions now call
`splits.touchMany()` on the splits being settled, bumping `updatedAt` and `syncVersion`.
That makes them write the *same* documents, so MongoDB raises a `WriteConflict`. The
conflict is a `TransientTransactionError`, which `session.withTransaction` retries
automatically — the loser re-reads, now sees the committed allocation, and fails
validation with `OverSettlementError`.

The result is exactly the desired behaviour: one settlement lands, the other is
rejected with a clear reason rather than being silently dropped.

The touch is not a hack bolted on for locking. The split's settlement state genuinely
changed, so bumping `syncVersion` is also what tells offline clients (group 15) to
re-read it. The same call happens on delete, for the same two reasons.

Verified stable across repeated runs, and the test asserts exactly one surviving
allocation row.

### Every settlement must be fully allocated

Balances are derived from `settlementAllocations` alone. An unallocated payment would
move money between accounts while reducing nobody's balance — the user would see a
payment that did nothing. So:

- `allocations` is required and non-empty at the schema level.
- `assertAllocationsCoverSettlement` requires the allocated total to equal the payment
  amount exactly, and reports both figures so the form can show the gap.

`03-DATA-FLOW.md` section 11 prefers fully-allocated settlements for the MVP; this makes
it a hard rule rather than a preference.

### Direction must match the obligation

A person owing the user is cleared by them paying the user, and vice versa. Allowing the
wrong pairing would *increase* the balance it claimed to reduce.

`assertValidAllocations` derives the expected obligation direction from the settlement
direction and rejects any allocation that runs the other way, with a message that names
the mistake ("that expense is money you owe, not money owed to you") rather than a
generic validation failure.

### The over-settlement guard is per share, not per person

Checking only the person's total would allow settling ₹500 against a ₹300 share and a
₹200 share as if it were all against the first. Each allocation is checked against that
specific share's remaining amount, and `OverSettlementError` carries
`{ expenseSplitId, remaining, requested, currency }`.

### `remainingAmount` stays derived

There is no `settledAmount` column on a split. Remaining is always
`shareAmount − Σ allocations`, computed by `summariseSplits` from group 5. A stored
figure could disagree with the allocations, and there would be no way to tell which was
right.

A test asserts the split row's `shareAmount` is unchanged after a partial settlement —
only the allocations differ.

### Deleting a settlement restores the balance

Because balances read allocations, soft-deleting the allocations is what restores them.
The settlement and its allocations are removed in one transaction so a balance can never
be left half-restored.

This is also the documented route out of a settled expense: groups 7 and 8 refuse to
edit or delete one, and removing the settlement is how the user unblocks that. A test
walks the whole path — delete blocked at 409, settlement removed, delete now succeeds.

### The obligation direction comes from the transaction, not the split

A split row does not record who paid. `loadAllocationTargets` resolves each split's
owning transaction and calls `classifyObligation` (group 5) to establish direction and
person. That keeps one definition of "who owes whom" rather than a second copy in the
settlement code.

### The form spreads the payment oldest-first, and stays editable

Making the user allocate manually would be tedious and error-prone. Entering an amount
fills the outstanding expenses oldest-first — the convention people use when clearing a
tab, and it leaves the most recent expenses outstanding rather than fragmenting every
one.

Each line remains editable, and the allocated total is shown against the payment amount
at all times with the submit button disabled while they disagree. Since a mismatch is
rejected outright, the form has to make the gap visible before submission.

`allocateOldestFirst` exists in the domain and is unit tested; the form has a small
local equivalent operating on the view model's decimal strings. Duplication is deliberate
and narrow — the server validates the result regardless — but it is duplication, and it
is noted in section 6.

### Both directions are offered when a person owes and is owed

`getSettleUpView` returns the primary direction (whichever has more outstanding, since
that is almost always the settlement the user came to record) plus the reverse. When both
exist the form shows a direction selector; when only one does, it is stated as text with
a hidden field.

### An account is optional

Cash settlements are real. When an account is given it must be owned, active, and in the
same currency, and the account balance moves — group 4's engine already handles
`settlement_in` / `settlement_out`, so no balance work was needed here. A test asserts
the receiving account rises by exactly the settlement amount.

### Idempotency before validation

Same pattern as groups 6-8. A retried offline settlement returns the original rather than
being re-checked against a balance it already reduced. A test asserts the balance dropped
once and exactly one allocation row exists.

## 4. Business rules enforced

```text
A settlement is never recorded as an expense
Every settlement must be allocated to specific expense shares
The allocated total must equal the payment amount exactly
An allocation may not exceed that share's remaining amount
Remaining is derived: shareAmount minus its allocations
The settlement direction must match each obligation's direction
All allocated shares must involve the named person
The same share cannot be allocated twice in one payment
Allocations are capped at the configured maximum
A settlement amount must be positive and correctly scaled
An account is optional; when given it must be owned, active, and same-currency
The settlement and its allocations are written atomically
Concurrent settlements of the same share cannot both succeed
Deleting a settlement restores the balances it reduced
Deletion is soft; the rows remain as history
A retried create with the same clientId returns the original
Removing a settlement re-enables editing the expense it settled
```

## 5. How it was verified

```text
npx tsc --noEmit         clean
npx eslint .             clean
npx prettier --check .   clean
npx vitest run           544 tests across unit, integration, ui
npx next build           succeeds
```

### Unit tests — `domain/settlements/validators.test.ts` (34 cases)

Full and partial settlement, spreading across several shares, over-settlement (including
against an already-settled share), wrong direction in both directions, duplicate share,
zero allocation, unknown share, share belonging to another person, over-precise amounts,
allocation cap, one-paisa shortfall, and `allocateOldestFirst` behaviour (fills oldest
first, stops when exhausted, skips settled shares, sums to the payment).

### Integration tests — `tests/integration/settlements.test.ts` (36 tests)

- Full settlement clears the balance; the receiving account rises by exactly the amount;
  a user-pays settlement lowers the paying account; a cash settlement clears the balance
  with no account movement.
- Partial settlement leaves the remainder; a second payment clears it; a third is
  rejected with `OVER_SETTLEMENT`.
- One ₹500 payment across a ₹300 and a ₹400 share leaves ₹200 outstanding, and the detail
  view names both expenses.
- Over-settlement rejected, with `remaining` and `requested` in the error; the check
  accounts for an earlier partial settlement; **nothing is written on rejection** — no
  settlement row, balance untouched.
- **The concurrency test**: two simultaneous full settlements of the same share; exactly
  one returns 201, the other ≥400, the share is settled once, and exactly one allocation
  row exists.
- Validation: empty allocations, mismatched total, wrong direction, another person's
  expense, duplicate share, unknown share, another user's share, zero/negative/over-precise
  amounts, another user's person, another user's account, archived account,
  unauthenticated.
- Idempotency: repeated `clientId` returns the original, balance reduced once, one
  allocation row.
- History: newest first with resolved person and account names; filter by person;
  cross-user isolation.
- Delete: balance restored and account movement undone; row retains `deletedAt`; second
  delete 404s; **the settled expense becomes deletable again**; another user's settlement
  cannot be deleted.
- A partially settled share reports `partially_settled` with the correct remaining, while
  the split row's `shareAmount` is unchanged.

## 6. Known gaps

- **Settlements cannot be edited, only deleted and re-created.** Editing would mean
  re-validating every allocation against remaining amounts that the settlement itself
  affects, and the delete-and-recreate path is unambiguous. Not in the task list.
- **`allocateOldestFirst` is duplicated in the form.** The domain function operates on
  `Money`; the form has a local equivalent on decimal strings. They must stay in step. A
  better fix is to expose the suggestion from the server as part of `SettleUpView`.
- **No "settle everything" shortcut** beyond the amount defaulting to the full
  outstanding total.
- **No settlement suggestion on the expense or dashboard.** The person page links to
  settle-up, but nothing prompts "Arun owes you ₹400, settle now?".
- **`allocationClientIds` is accepted by the API but never sent by the UI.** It exists for
  group 15 so a retried offline settlement reuses the same allocation row ids.
- **No minimal-transfer optimisation** across multiple people. Out of MVP scope.
- The settlements list has no date-range or direction filter in the UI, though the API
  supports `from`/`to`.
- `assertSettlementWithinOutstanding` and `requiredDirectionFor` are written and tested
  but not yet called by the service — the per-share checks already cover correctness. They
  exist for a friendlier pre-check the form could use.

## 7. Notes for the next group

Groups 10 and 11 (Transfers, Credit Card Payments) are simpler than this one — no splits,
no people — but share the same shape:

- Both are transaction types that already exist in the union and are already handled by
  the account balance engine (`transfer_in` / `transfer_out` / `card_payment_in` /
  `card_payment_out` in `domain/accounts/calculations.ts`, group 4).
- Both are **not spending**. `isSpending()` already returns false for them and
  `calculations.test.ts` already asserts it. Do not add them to any spending total.
- Neither has splits, so neither needs `withTransaction` for multi-document atomicity —
  a single transaction row is the whole write.
- `assertAccountIsNotCreditCard` and `assertAccountIsCreditCard` (group 4) are there for
  group 11's destination validation.
- Follow the established create-service shape: `findByClientId` first, then validate,
  then write.

For group 12 (Dashboard):

- `loadObligations()` (group 5) and `calculatePeopleTotals()` give the receivable/payable
  figures; do not write a second balance calculation.
- `getSettlementListView` supports a small recent-settlements panel.
