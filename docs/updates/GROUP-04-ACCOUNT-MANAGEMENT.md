# Group 4 - Account Management

## 1. What was built

The first end-to-end feature: bank, cash, and credit-card accounts with full CRUD,
archiving, and — the substantial part — the balance engine.

`01-MVP-SCOPE.md` section 4 forbids storing a mutable balance. So an account row holds
only two monetary facts: `openingBalance` and, for a card, `creditLimit`. Everything
the user actually looks at is recalculated from the financial events:

```text
current balance          bank and cash
credit-card outstanding
available credit
net position             across all accounts
```

`domain/accounts/calculations.ts` is the module that does this, and it is reused by
the dashboard (group 12) and the transaction list (group 13). It is worth reading
before touching anything financial.

## 2. Files added

### Domain — `src/domain/accounts/`

**`calculations.ts`** — the balance engine.

```ts
type AccountMovementKind =
  | "expense" | "income"
  | "transfer_in" | "transfer_out"
  | "card_payment_in" | "card_payment_out"
  | "settlement_in" | "settlement_out";

deriveAccountMovements(transactions, settlements) → AccountMovement[]
calculateAccountBalance(account, movements) → Money
calculateCreditCardOutstanding(account, movements) → Money
calculateAvailableCredit(creditLimit, outstanding) → Money
summariseAccount(account, movements) → AccountBalanceSummary
summariseAccounts(accounts, movements) → Map<string, AccountBalanceSummary>
calculateAccountTotals(accounts, movements, currency) → AccountTotals
```

**`rules.ts`** — `assertValidAccountDraft()`, `assertAccountUsable()`,
`assertAccountIsCreditCard()`, `assertAccountIsNotCreditCard()`,
`assertAccountCurrencyMatches()`.

Tests: `calculations.test.ts` (18), `rules.test.ts` (18).

### Server — `src/server/services/accounts/`

- `account-balances.ts` — `loadAccountMovements()`, `getAccountSummary()`,
  `getAccountSummaries()`, `getAccountTotals()`.
- `account-service.ts` — `createAccount()`, `updateAccount()`, `archiveAccount()`,
  `restoreAccount()`, `listAccounts()`, `getAccount()`, and
  **`resolveOwnedAccounts()`** which later groups use to validate account references.

### API

`api/accounts/route.ts` (GET list, POST create), `api/accounts/[id]/route.ts`
(GET, PATCH, DELETE = archive), `api/accounts/[id]/restore/route.ts` (POST).

### Feature — `src/features/accounts/`

`schemas/account-schemas.ts`, `view-models/account-view-model.ts`
(`AccountView`, `toAccountView`, `AccountOption`), `queries/account-queries.ts`,
`actions/account-actions.ts`, and `components/` (`AccountForm`, `AccountList`,
`AccountArchiveButton`).

### Pages

`app/(app)/accounts/` — list, `new`, `[id]`, `[id]/edit`.

### Shared UI

`components/ui/Card.tsx`, `components/feedback/EmptyState.tsx`,
`components/layout/PageHeader.tsx`, `lib/utils/client-id.ts` (`newClientId`,
`newOperationId`).

## 3. Key decisions

### Movements as an intermediate representation

Rather than each calculation inspecting transaction types, events are normalised once
into `AccountMovement { accountId, kind, amount, date }`, and two lookup tables decide
the sign:

- `ASSET_DIRECTION` — effect on a bank or cash balance.
- `CARD_OUTSTANDING_DIRECTION` — effect on a card's outstanding amount.

This puts every "does this add or subtract?" answer in one readable place instead of
spread across switch statements. It is also why adding settlements to the balance was
a two-line change.

### An account movement uses the full amount, not the user's share

The single most important rule here. When the user pays ₹1,200 for a group dinner and
their own share is ₹400:

```text
account movement    ₹1,200   the amount that actually left the account
user's spending     ₹400     the amount they are responsible for
```

Conflating them is the classic shared-expense bug. `03-DATA-FLOW.md` section 7 is
explicit about it, and a test asserts it directly.

### An expense paid by another person produces no movement

If Arun pays, no account of the user's was charged, so `accountId` is `null` and
`deriveAccountMovements()` emits nothing. The user still owes their share — but that
is a person balance, not an account balance. Group 5 handles it.

### Settlements affect account balances

`02-DATA-MODEL.md` section 20 does not list settlements in the balance formula, but a
settlement is real money moving. Paying Arun ₹450 from HDFC reduces HDFC by ₹450.
Omitting it would leave the displayed balance disagreeing with the bank.

So `deriveAccountMovements()` takes settlements as well, mapping `user_to_person` to
`settlement_out` and `person_to_user` to `settlement_in`. A settlement with no
`accountId` (cash, untracked) produces no movement.

### For a card, `openingBalance` is the opening outstanding

A card is a liability, so the field means "how much you already owe". Outstanding is
therefore `openingBalance + charges − payments`, and `assertValidAccountDraft()`
requires it to be non-negative for a card while allowing a negative opening balance on
a bank account (an overdraft is legitimate).

### A card's `balance` is reported as negative

`summariseAccount()` returns `balance = −outstanding` for a card, so summing every
account's `balance` yields net position directly. `outstanding` remains available as a
positive number for display, since "you owe ₹18,500" reads better than "−₹18,500".

### `type` and `currency` are immutable

`updateAccountSchema` omits both. Changing the currency would reinterpret every amount
already recorded; changing bank to credit card would invert the sign of the entire
history. The API silently ignores them rather than erroring, and a test asserts an
attempt to change them has no effect.

### An account currency must match the user's

Multi-currency conversion is out of scope. Allowing a second currency would produce
totals that cannot legitimately be added. Rejected with `INVALID_ACCOUNT` and a message
naming the user's currency.

### Card fields on a non-card account are rejected, not ignored

A client sending `creditLimit` for a bank account has a bug. Silently discarding it
hides the bug; the service returns a validation error. The repository still drops the
fields as a second line of defence.

### Archiving, never deleting

`DELETE /api/accounts/:id` archives. Every transaction recorded against the account
still refers to it. Archiving is idempotent — calling it twice succeeds both times —
and an archived account still contributes to totals, because it still holds money.
Editing an archived account is refused with a message telling the user to restore it
first.

### `updateAccount` validates the merged result

A partial edit is merged with the current values and the whole draft is re-validated.
Validating only the changed fields would let a card end up with `creditLimit: null` via
an update that looked individually valid.

### Full-scan projection, accepted deliberately

`loadAccountMovements()` reads every non-deleted transaction and settlement for the
user. At the scale `07-MVP-IMPLEMENTATION-PLAN.md` section 31 targets (thousands of
records) this is fine, and it guarantees the displayed number matches the data.

If it stops being fine, the fix is a cached projection rebuilt from these same events —
not a mutable balance column. The moment a balance becomes independently writable it
can disagree with the transactions, and there is no way to tell which is right.

## 4. Business rules enforced

```text
Balances are always derived, never stored
An account movement uses the full transaction amount
An expense paid by another person moves none of the user's accounts
Settlements move the account they were paid from or into
A credit card requires a positive credit limit
A card's opening outstanding must be non-negative
Statement day and payment due day fall between 1 and 31
Card-only fields are rejected on bank and cash accounts
An account's currency must match the user's
type and currency cannot be changed after creation
An archived account cannot be edited or used for new transactions
Archived accounts still count toward totals
Accounts are archived, never deleted
Over-precise amounts are rejected, not rounded
```

## 5. How it was verified

```text
npx tsc --noEmit                       clean
npx eslint .                           clean
npx vitest run --project unit          87 tests
npx vitest run --project integration   82 tests
npx next build                         succeeds
```

Unit tests worth reading — `calculations.test.ts` covers the shared-expense case
(₹1,200 leaves the account, not ₹400), the paid-by-a-person case (no movement),
settlement direction, card payment reducing outstanding while reducing the bank
balance, cash advance off a card, over-limit detection, ten `0.1` movements summing
exactly to `1.00`, and other-currency accounts being skipped rather than added.

`tests/integration/accounts.test.ts` (38 tests) covers creation of all three types,
every validation rejection, `clientId` idempotency, cross-user isolation on read,
update, and archive, stale `syncVersion` conflicts, and balances derived through the
real API including settlements.

## 6. Known gaps

- No account reordering, colour, or icon.
- No statement-period view. Statement day is stored but only displayed; using it to
  compute a billing cycle is out of MVP scope.
- No transfer or card-payment creation yet, so `transfer_*` and `card_payment_*`
  movements are exercised only by unit tests until groups 10 and 11.
- `/transactions?accountId=…` is linked from the account page but that route arrives
  in group 13.

## 7. Notes for the next group

- Use `resolveOwnedAccounts(userId, ids)` to validate account references. It throws
  `InvalidAccountError` for an unknown or foreign id, so a `Map` lookup afterwards is
  safe.
- Reuse `loadAccountMovements()` + `summariseAccounts()` for anything that needs
  balances. Do not write a second balance calculation.
- `assertAccountUsable()` before recording against an account; `assertAccountIsCreditCard()`
  and `assertAccountIsNotCreditCard()` are there for group 11.
- Forms generate their `clientId` once via `useMemo(newClientId)`, so resubmitting after
  a validation failure reuses it and cannot create a duplicate. Follow this in every
  create form.
