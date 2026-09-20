# Expense Tracker MVP - Offline & Synchronization

## 1. Objective

The application must work reliably when the user has no internet connection.

The user should be able to:

- Open the application
- View previously synchronized data
- Add expenses
- Add shared expenses
- Create settlements
- Create transfers
- Record credit-card payments

while offline.

When connectivity returns, changes must synchronize automatically.

The user should not need to understand the synchronization mechanism.

---

# 2. Architecture

```text
                    ┌─────────────────┐
                    │       UI        │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │ Feature / Use   │
                    │     Cases       │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │ Local Repository│
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │   IndexedDB     │
                    └────────┬────────┘
                             │
                     Pending Operations
                             ↓
                    ┌─────────────────┐
                    │   Sync Engine   │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │   Next.js API   │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │     MongoDB     │
                    └─────────────────┘
````

---

# 3. Source of Truth

There are two levels of truth.

## Server

MongoDB is the authoritative server source of truth.

```text
MongoDB
    ↓
Canonical financial state
```

## Client

IndexedDB is the authoritative local store while the device is offline.

```text
IndexedDB
    ↓
Current locally known state
```

The UI should not treat React state as the source of truth.

---

# 4. Why IndexedDB

Do not use:

```text
localStorage
```

for the application's financial dataset.

IndexedDB is preferred because it supports:

* Larger storage
* Structured data
* Indexed queries
* Asynchronous operations
* Durable browser storage
* Offline application data

Use a well-maintained IndexedDB abstraction library if appropriate.

Do not directly scatter raw IndexedDB API calls throughout the application.

---

# 5. Local Database

The local database should contain the entities required for offline functionality.

At minimum:

```text
accounts
people
categories
transactions
expenseSplits
settlements
settlementAllocations
syncOperations
syncMetadata
```

---

# 6. Local Record Metadata

Local records should contain synchronization metadata.

Example:

```ts
type LocalEntityMetadata = {
  clientId: string

  syncStatus:
    | "synced"
    | "pending"
    | "failed"

  serverUpdatedAt?: Date

  localUpdatedAt: Date

  syncVersion?: number
}
```

Do not expose synchronization internals unnecessarily in the UI.

---

# 7. Client IDs

Every offline-created entity must have a stable client-generated ID.

Use UUIDs.

Example:

```text
clientId:
550e8400-e29b-41d4-a716-446655440000
```

The same ID must be used when the operation is retried.

Do not generate a new ID for every retry.

Otherwise the server cannot distinguish:

```text
Retry
```

from:

```text
Duplicate transaction
```

---

# 8. Offline Write Flow

Example:

```text
User creates expense
        ↓
Validate locally
        ↓
Generate clientId
        ↓
Create local record
        ↓
Create sync operation
        ↓
IndexedDB transaction commits
        ↓
UI updates
```

The expense is now visible immediately.

The server does not need to be available.

---

# 9. IndexedDB Atomicity

The local entity and its sync operation should be written atomically where possible.

Example:

```text
IndexedDB transaction

    Create Expense
         +
    Create Sync Operation
```

Both should succeed together.

Avoid:

```text
Save expense
   ↓
Browser crashes
   ↓
Sync operation never created
```

That would leave an expense that can never synchronize.

---

# 10. Sync Queue

Use a durable queue.

Example:

```ts
type SyncOperation = {
  id: string

  userId?: string

  entityType:
    | "transaction"
    | "expenseSplit"
    | "settlement"
    | "settlementAllocation"
    | "account"
    | "person"
    | "category"

  entityId: string

  operation:
    | "create"
    | "update"
    | "delete"

  payload: unknown

  status:
    | "pending"
    | "processing"
    | "failed"

  retryCount: number

  nextRetryAt?: Date

  lastError?: string

  createdAt: Date
  updatedAt: Date
}
```

Do not rely on memory or React state for the queue.

---

# 11. Queue Ordering

Operations may have dependencies.

Example:

```text
Create Expense
       ↓
Create Expense Split
```

or:

```text
Create Settlement
       ↓
Create Settlement Allocation
```

The sync engine must respect dependencies.

Prefer syncing a complete business operation as one server-side command where practical.

For example:

```text
CreateSharedExpense
```

should ideally create:

```text
Transaction
+
ExpenseSplits
```

atomically on the server.

This is safer than independently syncing every database document.

---

# 12. Recommended Sync Unit

Prefer syncing domain operations rather than exposing raw database mutations.

Example:

```text
CreateSharedExpense
```

instead of:

```text
INSERT transaction
INSERT split
INSERT split
```

Similarly:

```text
CreateSettlement
```

should contain:

```text
Settlement
+
Settlement Allocations
```

as one logical operation.

This reduces partial synchronization problems.

---

# 13. Sync Operation Example

```json
{
  "operationId": "op_123",
  "type": "CREATE_SHARED_EXPENSE",
  "clientId": "expense_abc",
  "payload": {
    "amount": "1200",
    "description": "Dinner",
    "paidBy": {
      "type": "user"
    },
    "accountId": "account_123",
    "splits": [
      {
        "participant": {
          "type": "user"
        },
        "amount": "400"
      },
      {
        "participant": {
          "type": "person",
          "personId": "person_arun"
        },
        "amount": "400"
      },
      {
        "participant": {
          "type": "person",
          "personId": "person_vijay"
        },
        "amount": "400"
      }
    ]
  }
}
```

The server validates and persists the entire operation atomically.

---

# 14. Sync Trigger

Synchronization should happen when appropriate.

Triggers include:

```text
Application startup
Network becomes available
User returns to the application
After local write
Periodic background attempt
Manual sync action
```

Do not depend on browser background execution always being available.

Browsers are wonderfully capable of deciding that your carefully planned background task is now none of their business.

---

# 15. Network Detection

Use browser network state as a hint.

For example:

```text
navigator.onLine
```

can indicate likely connectivity.

However:

```text
online ≠ server reachable
```

The sync engine must still handle actual request failures.

---

# 16. Sync Process

Basic flow:

```text
Start Sync
    ↓
Find pending operations
    ↓
Process operation
    ↓
Authenticate
    ↓
Validate request
    ↓
Check idempotency
    ↓
Execute use case
    ↓
MongoDB transaction
    ↓
Return canonical result
    ↓
Update local entity
    ↓
Mark operation completed
```

---

# 17. Idempotency

Every sync operation must be idempotent.

The server should store or otherwise enforce a unique operation/client identifier.

Example:

```text
clientId = expense_abc
```

First request:

```text
Create expense
→ success
```

Second request due to retry:

```text
clientId = expense_abc
→ already processed
→ return existing result
```

Do not create a second expense.

---

# 18. Server Idempotency

Use a unique constraint or equivalent mechanism.

Example conceptual index:

```text
(userId, operationId)
```

or:

```text
(userId, clientId, operationType)
```

The exact implementation may vary.

The important requirement is:

```text
Same logical operation
+
Same client identifier
=
Same server result
```

---

# 19. Retry Strategy

Temporary failures should be retried.

Examples:

```text
Network unavailable
Request timeout
Temporary server failure
503 response
```

Use exponential backoff.

Example:

```text
Attempt 1 → immediately
Attempt 2 → short delay
Attempt 3 → longer delay
Attempt 4 → longer delay
...
```

Add jitter to avoid synchronized retry storms if many clients reconnect simultaneously.

---

# 20. Permanent Failures

Do not retry permanently invalid operations forever.

Examples:

```text
Invalid split
Unauthorized
Referenced account deleted
Referenced person deleted
Settlement allocation exceeds remaining amount
```

Mark the operation as:

```text
failed
```

and preserve the local record.

The user should be informed that action is required.

---

# 21. Sync Status

The UI can show a small status indicator.

Possible states:

```text
Synced
Saving...
Saved offline
Syncing...
Sync failed
```

Example:

```text
✓ Synced
```

or:

```text
Offline · Will sync later
```

Do not make the synchronization UI dominate the application.

---

# 22. Pull Synchronization

The client also needs to receive changes made elsewhere.

Example:

```text
iPhone
   ↓
MongoDB
   ↓
Desktop
```

Pull changes using a cursor/version mechanism.

Example:

```text
GET /api/sync?cursor=abc
```

Server returns changes after that cursor.

---

# 23. Sync Cursor

Maintain local synchronization metadata.

Example:

```ts
type SyncMetadata = {
  deviceId: string

  lastPulledCursor?: string

  lastSyncAt?: Date
}
```

After successfully processing a pull:

```text
Save new cursor
```

Do this carefully so the cursor does not advance past changes that were not successfully applied locally.

---

# 24. Pull Flow

```text
Local cursor
    ↓
Request server changes
    ↓
Server returns changes
    ↓
Validate changes
    ↓
Apply to IndexedDB
    ↓
Update cursor
```

The local database update and cursor advancement should be atomic where practical.

---

# 25. Multi-Device Example

User has:

```text
iPhone
Desktop
```

On iPhone:

```text
Create ₹500 expense
      ↓
IndexedDB
      ↓
MongoDB
```

Later desktop synchronizes:

```text
Desktop
      ↓
Pull changes
      ↓
IndexedDB
      ↓
UI
```

The expense appears on both devices.

---

# 26. Update Conflicts

Example:

```text
iPhone edits Expense A
Desktop edits Expense A
```

before synchronization.

The system must detect the conflict.

Do not silently overwrite financial data.

---

# 27. MVP Conflict Strategy

For MVP, use a simple server-authoritative versioning strategy.

Each server record can have:

```text
syncVersion
```

or:

```text
updatedAt
```

with appropriate conflict checks.

A client update should include the version it was based on.

Example:

```text
Client version = 4
Server version = 5
```

The server detects:

```text
Conflict
```

instead of blindly overwriting.

---

# 28. Conflict Response

Example:

```json
{
  "error": {
    "code": "SYNC_CONFLICT",
    "message": "This expense was modified elsewhere.",
    "serverVersion": 5
  }
}
```

The client can then:

```text
Fetch canonical server version
 ↓
Compare with local changes
 ↓
Ask user to resolve where necessary
```

For MVP, do not build an elaborate merge engine.

---

# 29. Financial Conflict Principle

Never automatically merge financial values in a way that could create incorrect accounting.

Dangerous:

```text
Local amount = ₹500
Server amount = ₹700

Automatically merge → ₹1,200
```

This is unacceptable.

Financial records require explicit rules.

---

# 30. Deletion Synchronization

Use soft deletion.

Example:

```text
User deletes expense offline
        ↓
deletedAt = local timestamp
        ↓
Queue delete operation
        ↓
Server marks deletedAt
```

Do not immediately physically remove the record from IndexedDB.

The deletion itself must synchronize.

---

# 31. Offline Reads

The app should remain useful offline.

Available offline:

```text
Dashboard
Transactions
Accounts
People
Categories
Expense creation
Shared expense creation
Settlement creation
```

Data shown offline should be clearly understood as:

```text
Last synchronized + local changes
```

not necessarily globally current.

---

# 32. Offline Expense Editing

If an expense was created offline:

```text
Create
 ↓
Edit
 ↓
Edit again
 ↓
Sync
```

The sync engine should avoid sending unnecessary intermediate operations where possible.

For example, if:

```text
Create expense
Update expense
```

both exist locally before synchronization, they can potentially be collapsed into:

```text
Create final expense
```

provided this does not violate domain/audit requirements.

---

# 33. Offline Delete After Create

Example:

```text
Create expense offline
 ↓
Delete expense offline
```

Before synchronization, there is no reason to send:

```text
CREATE
DELETE
```

to the server if the entity never existed remotely.

The sync engine can discard the unsynchronized create and local record according to the local data lifecycle rules.

This optimization is optional but desirable.

---

# 34. Settlement Synchronization

Settlement creation should synchronize as one logical operation:

```text
CreateSettlement
    ↓
Settlement
+
Settlement Allocations
```

The server should validate:

```text
allocation <= remaining split
```

against current server state.

This is critical because another device may have settled the same split.

---

# 35. Duplicate Settlement Protection

Example:

```text
Device A
settles Dinner ₹300

Device B
also tries to settle Dinner ₹300
```

The server must prevent total allocations from exceeding the original split.

The second operation should receive an appropriate conflict/error response.

---

# 36. Local Balance Calculation

The local application can calculate balances using:

```text
Local transactions
+
Local splits
-
Local settlement allocations
```

This allows the UI to remain responsive offline.

However, the local result may be provisional until synchronization completes.

---

# 37. Server Balance Calculation

The server must independently calculate authoritative balances from server data.

Never accept:

```text
clientBalance = ₹2,500
```

as a financial fact.

The client may send actions.

The server calculates resulting financial state.

---

# 38. Sync and Authentication

Sync requests must be authenticated.

Never trust:

```text
userId
```

from the sync payload.

The server determines:

```text
authenticated user
```

and only processes operations belonging to that user.

---

# 39. Device Identity

Each installation/device can have a stable local device ID.

Example:

```text
deviceId:
device_550e8400
```

Use it for:

* Sync diagnostics
* Conflict identification
* Sync metadata
* Debugging

Do not use device ID as a security credential.

---

# 40. Data Versioning

If the schema changes later:

```text
IndexedDB v1
 ↓
Migration
 ↓
IndexedDB v2
```

Create explicit local database migrations.

Do not simply delete the user's local database when the schema changes.

That could destroy unsynchronized financial data.

---

# 41. Sync Telemetry

Track enough information to debug synchronization.

Useful metadata:

```text
operationId
entityId
operationType
retryCount
lastAttemptAt
lastErrorCode
deviceId
```

Do not store unnecessary sensitive financial payloads in logs.

---

# 42. Sync Recovery

If the sync engine crashes:

```text
processing operation
        ↓
browser closes
```

the operation must remain recoverable.

On next startup:

```text
Find processing operations
        ↓
Reset/recover them
        ↓
Retry safely
```

Because operations are idempotent, retrying must be safe.

---

# 43. Sync Ordering

When operations depend on one another, preserve logical ordering.

Example:

```text
Create Person
      ↓
Create Shared Expense referencing Person
```

The person must exist on the server before the expense can reference it.

Possible approaches:

1. Sync dependencies first.
2. Represent the complete operation in one command.
3. Use temporary client IDs that the server resolves.

Prefer the simplest approach that keeps the operation atomic.

---

# 44. Recommended MVP Approach

For financial operations, prefer domain commands:

```text
CreateExpense
CreateSharedExpense
CreateSettlement
CreateTransfer
PayCreditCard
UpdateExpense
DeleteExpense
```

rather than generic CRUD synchronization.

This gives the server a clear business operation to validate.

---

# 45. Sync Engine Responsibilities

The sync engine should:

```text
Read queue
 ↓
Select eligible operation
 ↓
Check dependencies
 ↓
Send request
 ↓
Handle response
 ↓
Retry if temporary failure
 ↓
Handle conflict
 ↓
Update local records
 ↓
Mark operation complete
```

It should not contain financial calculations.

Financial calculations belong to the domain layer.

---

# 46. Offline Repository Responsibilities

Offline repositories should provide operations such as:

```text
getTransaction()
listTransactions()
createTransaction()
updateTransaction()
deleteTransaction()

getAccount()
listAccounts()

getPerson()
listPeople()

getPendingSyncOperations()
```

They should not contain business rules such as:

```text
calculatePersonBalance()
```

Those belong in domain/application services.

---

# 47. Browser Storage Limits

The application must not assume unlimited IndexedDB storage.

Avoid storing:

* unnecessary duplicated server responses
* large files
* excessive historical metadata

Receipts and attachments should be a future feature with dedicated storage.

---

# 48. PWA Requirements

The PWA should include:

* Service worker
* Application shell caching
* Offline app loading
* IndexedDB persistence
* Network-aware sync

The service worker is responsible primarily for application/network caching.

IndexedDB is responsible for application data.

Do not use the service worker as the financial database.

---

# 49. Offline UX Principle

Offline mode should feel normal.

Bad:

```text
NETWORK ERROR!!!
```

Good:

```text
Saved offline
Will sync automatically
```

The user should still be able to continue recording expenses.

---

# 50. Final Sync Architecture

```text
                         SERVER
                    ┌─────────────┐
                    │  MongoDB    │
                    └──────┬──────┘
                           ↑↓
                    ┌─────────────┐
                    │ Next.js API │
                    └──────┬──────┘
                           ↑↓
                    ┌─────────────┐
                    │ Sync Engine │
                    └──────┬──────┘
                           ↑↓
                    ┌─────────────┐
                    │  IndexedDB  │
                    └──────┬──────┘
                           ↑
                    ┌─────────────┐
                    │    UI       │
                    └─────────────┘
```

The essential rules are:

```text
1. Local writes must be durable.
2. Every server-bound operation must be retryable.
3. Every operation must be idempotent.
4. Server validates every financial operation.
5. MongoDB is the authoritative server state.
6. IndexedDB is the local state.
7. Financial conflicts must never be silently merged.
8. Synchronization failures must never delete local financial data.
9. Settlement allocations must be validated against current server state.
10. The UI must remain useful while offline.
```