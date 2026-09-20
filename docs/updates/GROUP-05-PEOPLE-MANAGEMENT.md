# Group 5 - People Management

## 1. What was built

Contacts to split expenses with, and the calculation that answers the application's
central question: **who owes whom, and how much is still outstanding?**

A `Person` record itself is trivial — a name and optional notes. The substance of this
group is `domain/people/calculations.ts`, which derives a balance from expense splits
and the settlement allocations that reduce them. Nothing about a balance is stored.

Two supporting modules were built here because the balance cannot be computed without
them:

- `domain/settlements/calculations.ts` — how much of a single split has been settled.
- `domain/people/calculations.ts` — obligations and balances per person.

Both are pure and fully unit tested. Groups 8 and 9 will write the records they read.

Delivered: person CRUD and archiving, the balance engine, a person detail page showing
the expenses and settlements behind the balance, and a people list with receivable and
payable totals.

## 2. Files added

### Domain — `src/domain/settlements/calculations.ts`

```ts
indexAllocationsBySplit(allocations) → Map<splitId, SettlementAllocation[]>
calculateAllocatedAmount(split, allocations) → Money
calculateRemainingSplitAmount(split, allocations) → Money
deriveSplitStatus(originalAmount, allocatedAmount) → SplitStatus
summariseSplit(split, allocations) → SplitSettlementSummary
summariseSplits(splits, allocations) → Map<splitId, SplitSettlementSummary>
calculateAllocationTotal(allocations, currency) → Money
```

`SplitStatus` is `"unsettled" | "partially_settled" | "settled"`.

### Domain — `src/domain/people/calculations.ts`

```ts
classifyObligation(transaction, split)
  → { direction, personId } | null

buildPersonObligations(entries, allocations) → PersonObligation[]
calculatePersonBalance(personId, entries, allocations, currency) → PersonBalance
calculatePersonBalanceFromObligations(personId, obligations, currency) → PersonBalance
calculatePersonBalances(entries, allocations, currency, includePersonIds?) → Map
calculatePeopleTotals(balances, currency) → PeopleTotals
unsettledObligationsFor(personId, obligations, direction?) → PersonObligation[]
```

`PersonBalance` carries `personOwesUser`, `userOwesPerson`, `net` (signed),
`netAbsolute`, `direction`, `isSettled`, `unsettledCount`.

`src/domain/people/rules.ts` — `assertPersonUsable()`, `assertAllPeopleResolved()`,
`assertNoDuplicatePeople()`.

Tests: `settlements/calculations.test.ts` (21), `people/calculations.test.ts` (22).

### Server — `src/server/services/people/`

- `person-balances.ts` — `loadObligations()`, `getPersonBalance()`,
  `getPersonBalances()`, `getPeopleTotals()`.
- `person-service.ts` — `createPerson()`, `updatePerson()`, `archivePerson()`,
  `restorePerson()`, `listPeople()`, `getPerson()`, and **`resolveOwnedPeople()`**
  for later groups to validate participant references.

### API

`api/people/route.ts` (GET, POST), `api/people/[id]/route.ts` (GET, PATCH,
DELETE = archive), `api/people/[id]/restore/route.ts`,
`api/people/[id]/balance/route.ts`.

### Feature — `src/features/people/`

`schemas/person-schemas.ts`, `view-models/person-view-model.ts`
(`PersonView`, `PersonBalanceView`, `ObligationView`, `SettlementSummaryView`,
`PersonDetailView`, `PersonOption`), `queries/person-queries.ts`,
`actions/person-actions.ts`, and `components/` (`PersonForm`, `PersonList`,
`PersonObligationList`, `PersonArchiveButton`).

### Pages

`app/(app)/people/` — list, `new`, `[id]`, `[id]/edit`.

### Test helper

`tests/helpers/seed.ts` — writes through the real repositories:
`seedBankAccount`, `seedCashAccount`, `seedCreditCard`, `seedPerson`, `seedCategory`,
`seedSharedExpense`, `seedPersonalExpense`, `seedSettlement`, plus
`splitForPerson()` and `splitForUser()` for locating a specific split.

`tests/helpers/builders.ts` — in-memory entity builders for unit tests, including
`buildSharedExpense()` and `toSplitEntries()`.

## 3. Key decisions

### Only two split shapes create a user-to-person obligation

This is the rule the whole group turns on. `classifyObligation()` recognises exactly
two:

```text
the user paid  and a person has a share    →  person owes user
a person paid  and the user has a share    →  user owes person
```

Everything else yields `null`:

- The payer's own share is not a debt to themselves.
- A non-expense transaction has no splits that mean anything here.
- **A split where person A paid and person B consumed is ignored.** That is an
  obligation between two other people. The user is not a party to it and
  `01-MVP-SCOPE.md` sections 11-12 only cover user-to-person balances. Tracking it would
  imply the app knows about relationships it has no record of.

An integration test seeds exactly this case (Arun pays, Vijay consumes) and asserts
both balances stay settled.

### A balance is the sum of *remaining* amounts, not original shares

`remaining(split) = shareAmount − Σ allocations against that split`.

Because settlements allocate to specific splits, the balance falls out of the split
remainders with no separate bookkeeping. There is no `settledAmount` column that could
drift from the allocations, and no risk of a settlement being counted twice.

`06-CODING-PRACTICES.md` requires this: nothing stores a mutable authoritative
balance.

### `net` is signed; direction is derived from it

`net = personOwesUser − userOwesPerson`. Positive means the person owes the user.
`direction` is `"person_owes_user" | "user_owes_person" | "settled"`, and the view model
always pairs the amount with a label ("owes you" / "you owe"). A bare "₹450" is
meaningless without knowing who owes whom.

### Both gross figures are kept as well as the net

If Arun owes ₹500 and the user owes Arun ₹200, the person page shows all three: they
owe you ₹500, you owe them ₹200, net ₹300. Showing only the net hides the detail a user
needs to check the number is right.

### Dashboard totals use each person's net, not the gross figures

`calculatePeopleTotals()` takes each person's net position and sorts it into receivable
or payable. Summing the gross figures would report both ₹500 receivable and ₹200 payable
for the same person, overstating both sides. A unit test asserts the ₹300-receivable
result.

### `remaining` is clamped at zero

Over-allocation is rejected on write in group 9, so a negative remainder should be
impossible. `clampNonNegative()` makes the read path defensive anyway: if corrupt data
ever appeared, a negative "remaining" would be meaningless and would corrupt every total
that includes it.

### `summariseSplits()` indexes once

Filtering the full allocation list per split is quadratic, and a person with a long
history would degrade noticeably. Allocations are grouped by split id once, then each
split is a map lookup.

### A split whose transaction is deleted contributes nothing

`loadObligations()` pairs splits with their transactions by id. A soft-deleted
transaction is absent from the projection query, so its splits find no transaction and
are skipped — the balance drops accordingly without needing to cascade the delete to
each split row. An integration test verifies this.

### Archiving a person with an outstanding balance is allowed

The user may simply want them out of the picker. Refusing would be paternalistic, and
silently writing off the balance would be worse — money is still owed.

So: archiving is permitted, the balance and history stay intact and visible on the
person page, and `PersonArchiveButton` shows a warning naming the amount before
confirming. An integration test asserts the ₹500 balance survives archiving.

### Names are whitespace-normalised, and duplicates are allowed

`normalizeWhitespace()` collapses runs of spaces, so `"  Arun    Kumar  "` becomes
`"Arun Kumar"`. Two people may share a name — real contact lists have two people called
Arun, and forcing uniqueness would be wrong.

### Search terms are escaped

`listPeople` passes the term through `escapeRegExp()`. A test searches for `.*` and
asserts zero matches, proving it is treated as a literal rather than a wildcard.

### `getPeopleTotals()` reuses one obligation pass

The list endpoint loads obligations once and computes every person's balance from that
one pass, rather than issuing a query per person.

## 4. Business rules enforced

```text
A person balance is always derived from splits and allocations, never stored
The user paying + a person's share      → that person owes the user
A person paying + the user's share      → the user owes that person
The payer's own share creates no debt
An obligation between two other people is not tracked
A balance sums remaining amounts, after settlement allocations
Remaining amount is never negative
A split is unsettled / partially settled / settled, derived from its allocations
net = personOwesUser − userOwesPerson; direction follows the sign
People totals use each person's net position, not both gross figures
A deleted expense drops out of the balance
Archiving a person preserves their balance and history
An archived person cannot be added to a new expense
Person names are whitespace-normalised; duplicates are permitted
Every person reference is verified to belong to the requesting user
```

## 5. How it was verified

```text
npx tsc --noEmit                       clean
npx eslint .                           clean
npx vitest run --project unit          173 tests
npx vitest run --project integration   118 tests
npx vitest run --project ui            9 tests
npx next build                         succeeds
```

### Unit tests

`people/calculations.test.ts` follows the running example from the architecture docs:
Arun owes ₹500 then ₹300 (₹800 total); a ₹300 settlement leaves ₹500. It also covers
bidirectional netting, the ignored A-pays-B-consumes case, the uneven three-way split
(333.34 / 333.33 / 333.33), and totals using net rather than gross.

`settlements/calculations.test.ts` covers a ₹500 settlement paying one split in full and
part of another, two settlements against the same split reaching zero, deleted
allocations being ignored, and the clamp at zero.

### Integration tests

`tests/integration/people.test.ts` (36 tests) exercises the real API against MongoDB:
person CRUD, `clientId` idempotency, whitespace normalisation, regex escaping, archive
and restore, stale `syncVersion` conflicts, and cross-user isolation on every endpoint
including `/balance`.

The balance cases seed real transactions, splits, settlements and allocations:

- User pays ₹1,200 split three ways → each person owes ₹400.
- Arun pays ₹900 → user owes ₹450 and **no account of the user's is charged**.
- Bidirectional netting → ₹300.
- Partial settlement → ₹200 remaining, `partially_settled`.
- Full settlement → settled, `unsettledCount` 0.
- The final test is the one worth reading: Arun pays, so the expense charges no account;
  the user then settles ₹450 from HDFC. The account balance drops by exactly ₹450 (not
  ₹900, not twice) and the person balance becomes settled. That checks the account
  engine and the person engine agree on the same events.

## 6. Known gaps

- **No settlement creation UI.** `/people/[id]/settle` is linked from the person page
  but the route arrives in group 9. Integration tests seed settlements directly through
  the repositories.
- **No expense creation UI.** Obligations only exist for seeded data until groups 7
  and 8.
- `/transactions/[id]` is linked from each obligation row; that route arrives in
  group 13.
- No people search box on the page. The API and service support `search`, and the page
  reads `?q=`, but no input is rendered yet.
- `Person` has no phone or email. `09-DATABASE-SCHEMA.md` defines only `notes`, and
  section 39 asks for a focused MVP schema.
- Balances assume a single currency, matching the MVP constraint that an account's
  currency equals the user's.

## 7. Notes for the next group

- Use `resolveOwnedPeople(userId, personIds)` to validate participants. It rejects
  duplicates and throws `InvalidPersonError` for an unknown or foreign id, so the
  returned `Map` is safe to index.
- Call `assertPersonUsable()` before adding someone to a new expense; archived people
  must not be selectable.
- Group 8 must set `paidBy` correctly — the entire balance model reads it. When a person
  paid, `accountId` must be `null`, or the account balance will be wrong.
- Group 9 must allocate every settlement to specific splits. `loadObligations()` derives
  balances purely from allocations, so an unallocated settlement would move money without
  reducing any balance. `unsettledObligationsFor()` is the intended source for the
  settlement picker.
- Reuse `loadObligations()` for the dashboard in group 12. Do not write a second balance
  calculation.
- `tests/helpers/seed.ts` is the fastest way to set up financial scenarios in
  integration tests.
