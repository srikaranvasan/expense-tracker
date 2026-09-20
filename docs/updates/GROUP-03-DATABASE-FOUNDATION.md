# Group 3 - Database Foundation

## 1. What was built

All nine MongoDB collections, their document types, domain entities, repository
interfaces and implementations, indexes, and the four persistence conventions every
collection follows.

The conventions matter more than the collections. Each one closes a specific failure
mode:

| Convention | Failure it prevents |
| --- | --- |
| Decimal128 for money | A double silently rounding an amount |
| `createdAt` / `updatedAt` / `syncVersion` | Undetectable concurrent edits, no sync ordering |
| Soft delete and archive | Deleted records resurrected by an offline device; destroyed history |
| `userId` first on every method | An unscoped query returning another user's data |

Plus a fifth that only pays off in group 15: a unique `(userId, clientId)` index on
every synced collection, which is what makes a retried offline write idempotent.

## 2. Files added

### Persistence conventions — `src/server/db/`

| File | Purpose |
| --- | --- |
| `decimal128.ts` | `toDecimal128()`, `fromDecimal128()`, optional variants |
| `conventions.ts` | `creationMeta()`, `updateMeta()`, `owned()`, `ownedById()`, `notDeleted()`, `notArchived()`, `softDeleteUpdate()`, `archiveUpdate()`, `restoreUpdate()` |
| `collections.ts` | Typed accessors: `collections.accounts()`, `collections.transactions()`, … |
| `object-id.ts` | Conversion helpers (added in group 2, used everywhere here) |

### Domain entities — `src/domain/`

- `accounts/entities.ts` — `Account`, `CreditCardTerms`, `isCreditCard`,
  `isAssetAccount`, `ACCOUNT_TYPE_LABELS`.
- `people/entities.ts` — `Person`.
- `categories/entities.ts` — `Category`, `CategoryTreeNode`,
  `buildCategoryTree()`.
- `transactions/entities.ts` — `Transaction`, `PaidBy`, `ExpenseSplit`,
  `paidByUser()`, `paidByPerson()`, `participantKey()`, `isSharedExpense()`.
- `settlements/entities.ts` — `Settlement`, `SettlementAllocation`.
- `shared/errors.ts` — every named domain error, listed in section 4.
- `shared/invariants.ts` — `assertPositiveAmount`, `assertNonNegativeAmount`,
  `assertRoundedToCurrency`, `assertSameCurrencyAll`, `assertPercentageInRange`,
  `assertWithinCollectionLimit`.

### Documents and mappers — `src/server/db/models/`

`account.ts`, `person.ts`, `category.ts`, `transaction.ts` (both
`TransactionDocument` and `ExpenseSplitDocument`), `settlement.ts` (settlement and
allocation), `sync-operation.ts`, `user.ts`.

Each exports a `to<Entity>Entity()` mapper. Documents never cross a layer boundary.

### Repositories

Interfaces in `src/server/repositories/interfaces/`, MongoDB implementations in
`mongo/`, each with a singleton accessor:

```text
accountRepository()      personRepository()       categoryRepository()
transactionRepository()  expenseSplitRepository() settlementRepository()
settlementAllocationRepository()  syncOperationRepository()  userRepository()
```

`interfaces/common.ts` defines the shared vocabulary: `RepositoryContext` (carries a
`ClientSession`), `CursorResult`, `SyncedCreateMeta`, `OptimisticUpdateMeta`,
`ChangeFeedQuery`.

`mongo/cursor.ts` implements keyset pagination: `encodeDateCursor`,
`decodeDateCursor`, `afterDateCursor`, `buildPage`.

### Support

`src/lib/utils/text.ts` — `escapeRegExp` (used by every search query),
`normalizeWhitespace`, `truncate`, `initials`.

## 3. Key decisions

### Money is stored as Decimal128, and a double is treated as corruption

`fromDecimal128()` throws `InternalError` if it receives a JS number. A double in a
monetary field means something bypassed this module, and continuing would mean
serving a value that may already have lost precision. Failing loudly is the safer
outcome. An integration test asserts this.

Splits and allocations store a denormalised `currency` alongside the amount, because
`Decimal128` carries no currency and a split is sometimes read without its parent
transaction.

### Soft delete for financial records, archive for reference data

Two different situations, two different mechanisms:

- **Transactions, splits, settlements, allocations** get `deletedAt`. Physical
  deletion would let an offline device recreate the row on its next sync, and would
  destroy the settlement history that explains a balance.
- **Accounts, people, categories** get `archivedAt`. They are still referenced by
  historical records, so they cannot be removed; archiving only takes them out of the
  pickers.

`restoreUpdate()` exists for archived reference data. There is deliberately no
undelete for financial records.

### Every repository method takes `userId` first

Not decoration. `owned(userId)` and `ownedById(userId, id)` make the scoped filter the
path of least resistance, so writing an unscoped query requires going out of your
way. A lookup by `_id` alone would return another user's record.

### A duplicate `clientId` returns the existing record

When `create()` hits the unique `(userId, clientId)` index, it does not throw — it
re-reads and returns the record already there.

This is the foundation of offline idempotency. A client that creates an expense, loses
the response, and retries must end up with one expense. Note that the *first* write
wins: the retry's field values are discarded, because the client is re-sending the
same logical operation, not requesting an update.

Two different users may reuse the same `clientId`; the index is compound.

### A malformed ObjectId is "not found", not a 500

`toObjectId()` throws `NotFoundError` for anything that is not 24 hex characters. A
malformed id is untrusted input, not a server fault, and it must never reach a query.

### Optimistic concurrency via `syncVersion`

Every write increments `syncVersion`. Update methods accept an optional
`expectedSyncVersion` and throw `ConflictError` on mismatch, with the server's
current version in `details` so a client can reconcile. This is what group 15 uses to
detect a conflicting offline edit.

### Keyset pagination, not offset

A transaction list is something the user is actively adding to. With `skip`/`limit`, a
new row inserted mid-scroll shifts every subsequent page, so the user sees a record
twice or misses one. The cursor encodes the last `(date, _id)` pair and the query
continues from there.

### Search terms are regex-escaped

Search reaches MongoDB as `$regex`. Unescaped, a user typing `.*` runs an unbounded
pattern scan and `(` is a syntax error. Every search path calls `escapeRegExp()`.

### Card terms are only persisted for cards

The account repository writes `creditLimit`, `statementDay`, and `paymentDueDay` as
`null` unless `type === "credit_card"`. Defence in depth: group 4 rejects those fields
on a non-card account, and this ensures a bad write cannot leave a stale credit limit
on a bank account.

### `$jsonSchema` validators were rejected

Considered for structural guarantees. Rejected as brittle relative to their value:
they duplicate the Zod schemas, drift from them silently, and turn a schema mismatch
into an opaque write failure. Unique indexes plus application validation cover the
requirement in `13-MVP-TASK-GROUP.md`.

## 4. Business rules enforced

The named errors in `domain/shared/errors.ts`, each with a stable code:

```text
InvalidAmountError                 InvalidCurrencyError
InvalidAccountError                InvalidCategoryError
InvalidPersonError                 InvalidSplitError
InvalidSplitTotalError             InvalidParticipantError
InvalidSettlementError             InvalidSettlementAllocationError
OverSettlementError                InvalidTransferError
InvalidCreditCardPaymentError      ExpenseHasSettlementsError
```

Most are thrown by later groups. They are defined here so the vocabulary is settled
before the rules that use it are written.

Invariants available to every group:

```text
Financial events have a strictly positive amount
Amounts stay within the configured maximum
Amounts are not more precise than the currency allows - rejected, never rounded silently
Every amount in one operation shares a currency
Percentages fall between 0 and 100
Array payloads are size-bounded
```

`assertRoundedToCurrency` rejecting rather than rounding is deliberate: silently
rounding changes what the user recorded.

## 5. How it was verified

```text
npx tsc --noEmit                       clean
npx eslint .                           clean
npx vitest run --project unit          44 tests
npx vitest run --project integration   44 tests
```

`tests/integration/database-foundation.test.ts` (28 tests) covers each convention
against a real MongoDB replica set:

- Decimal128 round-trips exactly for `0.01`, `1234.56`, `100000000.01`; a stored
  double is rejected; `0.1` survives a write and read.
- `syncVersion` starts at 1 and increments on update and archive; a stale
  `expectedSyncVersion` conflicts.
- A soft-deleted transaction disappears from reads but the row and its `deletedAt`
  remain; deleting twice reports not found.
- User A cannot read, list, or update User B's records; two users may share a
  `clientId`.
- Creating the same `clientId` twice yields one record and returns the original.
- Card terms are stored for a card and dropped for a bank account.
- The unique indexes actually exist on all seven synced collections, on
  `users.email`, and on `syncOperations.operationId`.

Also added `tests/helpers/fixtures.ts` — `inr()`, `clientId()`, `operationId()`,
`fixedDate()`.

## 6. Known gaps

- The sync-operation ledger exists and is tested, but nothing calls it until
  group 15.
- `changesSince()` is implemented on every synced repository; the pull endpoint that
  uses it arrives in group 15.
- The text index on `transactions.description` is created but the transaction list
  uses an escaped `$regex`. Regex is correct for the substring matching the UI needs;
  the text index is there if ranked search is wanted later.
- Transactions carry an `income` type in the union and it is handled by the balance
  calculations, but no group in the task list builds an income creation flow. The
  type is present so the balance formula in `02-DATA-MODEL.md` section 20 stays
  honest.

## 7. Notes for the next group

- Read and write money only through `toDecimal128()` / `fromDecimal128()`.
- Build filters from `owned()` / `ownedById()` combined with `notDeleted()` or
  `notArchived()`. Do not write `{ _id }` alone.
- Multi-document financial writes must use `withTransaction()` and thread the
  `ClientSession` through via `RepositoryContext`. Groups 8 and 9 depend on this.
- `resolveOwnedAccounts()` (group 4) and `resolveOwnedPeople()` (group 5) are the
  intended way to validate references before a write.
- Integration tests clear documents between cases but keep indexes, so unique-index
  behaviour is testable.
