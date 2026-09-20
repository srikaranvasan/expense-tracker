# Group 8 - Shared Expense

## 1. What was built

Splitting an expense between the user and other people, with three split methods, and
support for someone else having paid.

This is the group the whole application is really for, and it turns on two rules that
are easy to state and easy to get wrong:

**The shares must sum exactly to the total.** Every downstream figure — spending
totals, person balances, settlement remainders — is derived from the split rows. An
inexact split is not a rounding nuisance; it is an error that cannot be detected or
repaired from the data afterwards.

**Who paid is separate from which account was used.** When Arun pays for dinner, no
account of the user's moved, so `accountId` must be null. The user still owes their
share, but that is a person balance, not an account movement.

Delivered: `domain/transactions/splits.ts` (equal, custom, percentage), the shared
expense service, two API routes, a live split editor, and the create/edit pages.

## 2. Files added or changed

### Domain — `src/domain/transactions/splits.ts`

```ts
type ParticipantRef = { type: "user"; personId: null }
                    | { type: "person"; personId: string }

userParticipant()  personParticipant(personId)  participantRefKey(ref)

calculateSplitShares(total, request) → ComputedShare[]
  request: { method: "equal";      participants: ParticipantRef[] }
         | { method: "custom";     participants: { participant, amount }[] }
         | { method: "percentage"; participants: { participant, percentage }[] }

assertSharesMatchTotal(total, shares)
assertValidParticipantList(participants)
assertIsSharedSplit(participants)
assertPayerIsKnown(paidBy, resolvedPersonIds)
hasPersonParticipant(participants)
userShareOf(shares, currency)
```

Tests: `splits.test.ts` (47 cases).

### Server — `src/server/services/transactions/shared-expense-service.ts`

```ts
createSharedExpense(userId, userCurrency, command, deps?)
updateSharedExpense(userId, expenseId, userCurrency, command, deps?)
```

Both return the same `ExpenseWithSplits` as the personal service. `ParticipantInput`
is `{ personId: string | null; amount?: string; percentage?: string }`.

### API

- `api/expenses/shared/route.ts` — POST.
- `api/expenses/shared/[id]/route.ts` — PATCH.

Deletion continues to use `DELETE /api/expenses/:id`, which already handles both kinds.

### Feature — `src/features/transactions/`

- `schemas/shared-expense-schemas.ts` — `createSharedExpenseSchema`,
  `updateSharedExpenseSchema`.
- `hooks/use-split-draft.ts` — `useSplitDraft()`, the live split preview.
- `components/SplitEditor.tsx` — participant rows, method selector, running total.
- `components/SharedExpenseForm.tsx` — the full form.
- `actions/shared-expense-actions.ts` — `createSharedExpenseAction`,
  `updateSharedExpenseAction`.
- `queries/settlement-status.ts` — `isExpenseSettled()`, so the UI can avoid offering
  an edit the service would reject.

### Pages

- `app/(app)/transactions/new/shared/page.tsx` — new.
- `app/(app)/transactions/[id]/edit/page.tsx` — **rewritten**. Now picks the right form
  instead of redirecting shared expenses away, and shows an explanation when the expense
  is settled.
- `app/(app)/transactions/new/page.tsx` and `page.tsx` — "Split" links added.

## 3. Key decisions

### Every method routes through largest-remainder allocation

```text
equal        splitEqually(total, n)
percentage   allocateMoney(total, percentages)   percentages as weights
custom       amounts taken as entered, then the total is checked
```

`splitEqually` and `allocateMoney` come from `lib/money` (group 1) and distribute the
remainder one minor unit at a time. So ₹1,000 three ways is 333.34 / 333.33 / 333.33,
not three 333.33s that lose a rupee.

Using the percentages as *weights* rather than computing each share independently is
what keeps a percentage split exact. 33.33% of ₹1,000 is not a whole number of paise;
computing each share and rounding would drift.

### A bad custom split is rejected, never absorbed

If custom amounts do not sum to the total, the service throws `InvalidSplitTotalError`
with `expectedTotal`, `actualTotal`, and `currency` in `details`, so the form can show
the gap.

The alternative — adjusting the largest share to make it fit — was rejected. It would
record something the user did not enter, and `06-CODING-PRACTICES.md` section 55
forbids silent data mutation. Only the user can decide which figure was wrong.

### Percentages must total exactly 100

Not "approximately". The error names the actual total ("They currently add up to
120%"), which is the information needed to fix it.

### The user need not be a participant

"I paid ₹600 for Arun and Vijay" is a legitimate expense: the user's own share is zero,
₹600 leaves their account, and both people owe ₹300. `assertIsSharedSplit` requires at
least one *other* person, not the user.

### An expense with only the user is rejected

That is a personal expense, and it belongs on the personal path where the payload is
simpler. Reported as `INVALID_PARTICIPANT` with a message naming the alternative.

### Zero shares are rejected when entered, allowed when computed

A custom amount of `0` or a percentage of `0` is rejected — a participant who owes
nothing should be removed from the list, not recorded with nothing.

But `splitEqually(₹0.01, 3)` legitimately produces `0.01, 0, 0`. That is arithmetic
reality, not user error, so computed zeros pass. The distinction is between what the
user typed and what the allocation produced.

### The participant list is validated before any database lookup

An integration test originally expected `INVALID_PERSON` for a duplicate participant
and got `INVALID_PARTICIPANT`. Investigating showed why: `resolvePaymentAndPeople`
collects person ids into a `Set`, so duplicates collapse before
`resolveOwnedPeople`'s duplicate check ever sees them, and the error surfaced later
from `assertValidParticipantList`.

`INVALID_PARTICIPANT` is the better code — a duplicate is a problem with the *list*,
not with a person — so the ordering was made explicit instead: `assertValidParticipantList`
and `assertIsSharedSplit` now run first, before any lookup. Malformed input fails
without a database round trip, and the error code no longer depends on evaluation
order.

### Changing the amount requires re-stating the split

`PATCH` refuses an amount change unless `participants` is also supplied. The existing
shares sum to the *old* total; keeping them against a new total would break the core
invariant.

The server could redistribute — but on what basis? Proportionally? Equally? Adjusting
only the user's share? Each is a different, defensible answer, and guessing would
silently change what somebody owes. The client must say.

### The split is replaced wholesale, never diffed

An edit soft-deletes every split row and writes new ones. One code path — "the splits
are now exactly these" — is far easier to reason about than matching participants
between an old and new list, and the old rows survive as soft-deleted history.

### A settled expense cannot be edited at all

`assertExpenseNotSettled` runs before anything else in `updateSharedExpense`.
Re-splitting a settled expense would leave allocations pointing at shares that no
longer exist, and the person balance would drift with nothing in the data to reveal it
(`03-DATA-FLOW.md` section 21).

The edit *page* also checks, via `isExpenseSettled()`, and shows an explanation rather
than a form whose submission would fail. The service check remains the authority; the
page check only avoids a pointless round trip.

### Choosing a person as payer hides the account picker

Not just disables — removes, and submits an explicit empty `accountId`. This makes the
rule visible in the interface rather than only in an error message, and the explicit
clear means switching payer mid-edit cannot leave a stale account behind.

### The client preview runs the server's own calculation

`useSplitDraft` imports `calculateSplitShares` from the domain and runs it on every
keystroke. Re-implementing the arithmetic for the client would be a second source of
truth that eventually disagrees with the first
(`06-CODING-PRACTICES.md` section 9).

The domain layer is framework-free, so importing it into a client component is
allowed — the dependency runs inward, which is the direction the architecture permits.
The server still validates everything on submit; this is a preview, not a substitute.

Incomplete input yields no preview rather than an error. Someone halfway through typing
a custom split has not made a mistake yet.

### Separate route for shared creation

`POST /api/expenses/shared` rather than a `mode` flag on `POST /api/expenses`. The
payloads are genuinely different — a split method and a participant list, and an
optional account — and one endpoint validating two shapes would need a discriminated
union in the schema and branching in the handler. Two routes with two schemas is
clearer to read and to test.

### `INVALID_SPLIT` errors map to the participants field

`shared-expense-actions.ts` maps `INVALID_SPLIT`, `INVALID_SPLIT_TOTAL`,
`INVALID_PARTICIPANT`, and `INVALID_PERSON` onto the `participants` field so the split
editor shows them, rather than a banner at the top of a long form.

## 4. Business rules enforced

```text
Split shares must sum exactly to the expense total
Equal splits distribute the remainder so nothing is lost or invented
Percentages must total exactly 100
Percentage shares are allocated by weight, keeping the sum exact
Custom amounts are used as entered; a mismatch is rejected, never adjusted
An entered share or percentage of zero is rejected
A computed share of zero is allowed
A shared expense needs at least one person other than the user
The user need not be a participant
The same participant cannot appear twice
Participants are capped at the configured maximum
Every participant and the payer must be the user's own, active person
An account is required when the user paid
An account is forbidden when another person paid
An obligation between two other people is not tracked as the user's
Changing the amount requires re-stating the split
A settled expense cannot be edited or deleted
Editing replaces the splits wholesale; old rows remain as soft-deleted history
The transaction and all split rows are written atomically
A retried create with the same clientId returns the original
The account is charged the full amount; spending is the user's share
```

## 5. How it was verified

```text
npx tsc --noEmit         clean
npx eslint .             clean
npx prettier --check .   clean
npx vitest run           474 tests across unit, integration, ui
npx next build           succeeds
```

### Unit tests — `domain/transactions/splits.test.ts` (47 cases)

The important ones:

- ₹1,000 / 3 → 333.34 / 333.33 / 333.33, summing to exactly ₹1,000.
- A loop over seven awkward amounts × five participant counts asserting the total is
  preserved every time.
- 50/30/20 of ₹1,000 → 500/300/200.
- 33.33/33.33/33.34 and 0.01/0.01/99.98 of ₹999.99 both sum exactly.
- Custom shortfall and overage both rejected; the error carries `expectedTotal` and
  `actualTotal`.
- A one-paisa mismatch is rejected — the check is exact, not tolerant.
- Zero and negative shares, over-precise shares, zero and >100 percentages all
  rejected.
- Duplicate participants (person *and* user), empty list, over-limit list.
- A list of only other people is accepted; a list of only the user is not.

### Integration tests — `tests/integration/shared-expenses.test.ts` (41 tests)

Verified against a real MongoDB, checking the stored split rows and the derived
balances:

- Equal, custom, and percentage splits produce the expected per-participant rows.
- **₹1,200 split three ways charges the account ₹1,200 and reports the user's spending
  as ₹400.** The distinction that matters most.
- Each participant's person balance shows their share.
- Paying entirely for others gives the user a zero share and still charges the account.
- Someone else paying: payer recorded, `accountId` null, the user's account untouched,
  and the balance direction flips to `user_owes_person`.
- Supplying an account when a person paid is rejected; omitting one when the user paid
  is rejected.
- Arun pays and only Vijay consumes → both balances stay settled, because that
  obligation is between two other people.
- Foreign and archived people rejected as participant and as payer.
- Idempotency: a repeated `clientId` returns the original, leaves three split rows, and
  moves the balance once.
- **An invalid split writes nothing** — the balance is untouched, proving the
  transaction rolled back.
- Editing: re-split with a new amount; amount-only change rejected; participant removal
  clears that person's balance; switching payer restores the account and flips the
  balance; an invalid new split leaves the old shares intact.
- A settled expense refuses both edit and delete with `EXPENSE_HAS_SETTLEMENTS`.
- `PATCH /api/expenses/:id` reports 404 for a shared expense and
  `PATCH /api/expenses/shared/:id` reports 404 for a personal one.
- A loop over five amounts × three participant counts asserting the stored shares sum
  to the total.
- Settling exactly the stored share clears the balance — confirming the split writer
  and the settlement reader agree.

## 6. Known gaps

- **No settlement creation.** `/people/[id]/settle` is still unbuilt; group 9. Tests
  seed settlements through `seedSettlement`.
- **No "everyone owes equally except me" shortcut**, and no per-person adjustment on top
  of an equal split. The three documented methods are implemented; nothing more.
- **`splitClientIds` is accepted by the API but the UI never sends it.** It exists for
  group 15, so a retried offline shared-expense create reuses the same split row ids.
  Without it, a retry currently relies on the transaction's `clientId` short-circuit,
  which is sufficient but means the split ids are server-generated.
- **The edit form always starts in "custom" mode**, pre-filled with the current shares.
  It does not remember whether the expense was originally split equally, because the
  split method is not stored — only the resulting amounts are. Storing the method was
  considered and rejected as a derived value that could disagree with the shares; the
  consequence is that re-splitting equally after an edit needs the method re-selected.
- No group or trip concept. Each expense names its participants individually.
- No settlement suggestions ("Arun owes you ₹400, settle now?") on the expense page.

## 7. Notes for the next group

Group 9 (Settlement) is the counterpart to this group and depends directly on it:

- **Every settlement must be allocated to specific splits.** `loadObligations()`
  (group 5) derives balances purely from `settlementAllocations`, so an unallocated
  settlement would move money without reducing any balance.
- `unsettledObligationsFor(personId, obligations, direction?)` from
  `domain/people/calculations.ts` is the intended source for the settlement picker. It
  already returns only obligations with something outstanding.
- `calculateRemainingSplitAmount` / `summariseSplits` from
  `domain/settlements/calculations.ts` give the per-split remaining amount.
  **Read allocations inside the settlement transaction** — `listBySplitIds` and
  `countBySplitIds` both accept a `RepositoryContext` — or two concurrent settlements
  could each pass an over-allocation check that neither would pass afterwards.
- The over-settlement guard is `OverSettlementError`, already defined with
  `{ expenseSplitId, remaining, requested, currency }` in its details.
- `assertExpenseNotSettled` is what makes settlements safe: once group 9 can create
  them, the edit and delete refusals in groups 7 and 8 become reachable through the UI.
  Their tests already cover it via seeded settlements.
- A settlement with an `accountId` moves that account's balance — the account engine
  already handles `settlement_in` / `settlement_out` movements (group 4), so no balance
  work is needed there.
