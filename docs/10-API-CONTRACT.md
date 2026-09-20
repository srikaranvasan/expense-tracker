# Expense Tracker MVP - API Contract

## 1. Purpose

Define a consistent API boundary between the Next.js frontend and backend.

The API should expose business operations, not raw database operations.

Prefer:

POST /api/expenses

over exposing low-level endpoints such as:

POST /api/transactions
POST /api/expense-splits
POST /api/expense-splits/123

for a single shared-expense workflow.

---

# 2. API Principles

All protected endpoints must:

1. Authenticate the request.
2. Validate the request body.
3. Verify resource ownership.
4. Execute a domain/application use case.
5. Return a consistent response.
6. Avoid leaking internal errors.
7. Support idempotency for offline writes where applicable.

---

# 3. Response Format

## Success

```json
{
  "data": {}
}
````

## Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Split amounts must equal the expense amount.",
    "details": {}
  }
}
```

Do not expose stack traces or database errors.

---

# 4. Authentication

The server determines the current user from the authenticated session.

Never accept the user's identity from the request body.

Bad:

```json
{
  "userId": "123"
}
```

Good:

```text
Authenticated Session
        ↓
Server obtains userId
```

---

# 5. Accounts

## GET `/api/accounts`

Return the user's active accounts.

Optional query parameters:

```text
type
includeArchived
```

---

## POST `/api/accounts`

Create an account.

Request:

```json
{
  "name": "HDFC Savings",
  "type": "bank",
  "currency": "INR",
  "openingBalance": "50000"
}
```

For credit cards:

```json
{
  "name": "HDFC Credit Card",
  "type": "credit_card",
  "currency": "INR",
  "openingBalance": "0",
  "creditLimit": "150000",
  "statementDay": 5,
  "paymentDueDay": 25
}
```

---

## GET `/api/accounts/:id`

Return account details and derived balance information.

---

## PATCH `/api/accounts/:id`

Update editable account information.

Do not allow arbitrary modification of derived financial values.

---

## DELETE `/api/accounts/:id`

Prefer soft deletion/archive behavior.

Before deletion:

* Verify ownership.
* Check whether the account has transactions.
* Do not destroy financial history.

---

# 6. People

## GET `/api/people`

Return the user's people.

---

## POST `/api/people`

Request:

```json
{
  "name": "Arun",
  "notes": "Office"
}
```

---

## GET `/api/people/:id`

Return:

```text
Person
Current balance
Relevant expenses
Settlement history
```

Balance is derived, not stored as authoritative state.

---

## PATCH `/api/people/:id`

Update person.

---

## DELETE `/api/people/:id`

Archive person.

Do not physically delete historical references.

---

# 7. Categories

## GET `/api/categories`

Return categories.

---

## POST `/api/categories`

Request:

```json
{
  "name": "Food",
  "icon": "food"
}
```

---

## PATCH `/api/categories/:id`

Update category.

---

## DELETE `/api/categories/:id`

Archive category.

Historical transactions should continue to retain their category reference.

---

# 8. Create Personal Expense

## POST `/api/expenses`

Request:

```json
{
  "operationId": "op_123",
  "clientId": "expense_123",

  "amount": "450.50",
  "currency": "INR",

  "description": "Dinner",

  "date": "2026-08-31T19:30:00.000Z",

  "accountId": "account_123",

  "categoryId": "category_123",

  "notes": "Dinner with friends"
}
```

Server validates:

```text
amount > 0
account belongs to user
category belongs to user
currency is valid
date is valid
```

---

# 9. Create Shared Expense

## POST `/api/expenses/shared`

Request:

```json
{
  "operationId": "op_456",
  "clientId": "expense_456",

  "amount": "1200",
  "currency": "INR",

  "description": "Dinner",

  "date": "2026-08-31T19:30:00.000Z",

  "accountId": "account_123",

  "categoryId": "category_food",

  "paidBy": {
    "type": "user"
  },

  "splitMethod": "equal",

  "participants": [
    {
      "type": "user"
    },
    {
      "type": "person",
      "personId": "person_arun"
    },
    {
      "type": "person",
      "personId": "person_vijay"
    }
  ]
}
```

For custom split:

```json
{
  "splitMethod": "custom",
  "participants": [
    {
      "type": "user",
      "amount": "400"
    },
    {
      "type": "person",
      "personId": "person_arun",
      "amount": "500"
    },
    {
      "type": "person",
      "personId": "person_vijay",
      "amount": "300"
    }
  ]
}
```

For percentage split:

```json
{
  "splitMethod": "percentage",
  "participants": [
    {
      "type": "user",
      "percentage": "33.33"
    },
    {
      "type": "person",
      "personId": "person_arun",
      "percentage": "33.33"
    },
    {
      "type": "person",
      "personId": "person_vijay",
      "percentage": "33.34"
    }
  ]
}
```

The server calculates the final monetary split.

---

# 10. Someone Else Paid

If another person paid for the expense, the request must explicitly represent the external payer.

Example:

```json
{
  "paidBy": {
    "type": "person",
    "personId": "person_arun"
  }
}
```

Example:

```text
Expense = ₹900

Arun paid
Karan share = ₹450
Arun share = ₹450
```

Result:

```text
Karan owes Arun ₹450
```

Do not pretend that Karan's bank/card account was charged.

---

# 11. Shared Expense Validation

The server must validate:

```text
At least one participant

Every participant belongs to user

No duplicate participant

Exactly one user participant where required

Every person participant exists

Split amounts are positive

Percentage values are valid

Final split total = expense amount
```

The exact participant rules should be defined by the domain model.

---

# 12. Get Expense

## GET `/api/expenses/:id`

Return:

```text
Transaction
Category
Account
Splits
Settlement status
```

Do not return raw MongoDB documents directly.

Use an API view model.

---

# 13. List Expenses

## GET `/api/expenses`

Supported query parameters:

```text
cursor
limit
from
to
categoryId
accountId
personId
type
search
```

Example:

```text
GET /api/expenses?from=2026-08-01&to=2026-08-31&limit=50
```

Use pagination.

Do not load the entire transaction history by default.

---

# 14. Update Expense

## PATCH `/api/expenses/:id`

Request:

```json
{
  "amount": "500",
  "description": "Dinner",
  "categoryId": "category_food",
  "accountId": "account_123"
}
```

For shared expenses, updating the amount or participants must recalculate/replace the relevant splits safely.

If existing settlements are affected:

```text
Reject
```

or require a controlled correction flow.

Do not silently invalidate settlement history.

---

# 15. Delete Expense

## DELETE `/api/expenses/:id`

Use soft deletion.

Before deletion:

```text
Check settlement allocations
Check dependent records
```

The delete must also be synchronization-safe.

---

# 16. Settlements

## GET `/api/settlements`

Return the user's settlements.

Filters:

```text
personId
from
to
```

---

# 17. Create Settlement

## POST `/api/settlements`

Request:

```json
{
  "operationId": "op_789",
  "clientId": "settlement_789",

  "personId": "person_arun",

  "direction": "user_to_person",

  "amount": "500",

  "currency": "INR",

  "accountId": "account_123",

  "date": "2026-08-31T20:00:00.000Z",

  "allocations": [
    {
      "expenseSplitId": "split_123",
      "amount": "300"
    },
    {
      "expenseSplitId": "split_456",
      "amount": "200"
    }
  ]
}
```

---

# 18. Settlement Validation

The server must verify:

```text
person belongs to user

account belongs to user

expense splits belong to user

expense splits belong to the selected person

allocation amount > 0

allocation does not exceed remaining split amount

sum(allocation amounts) = settlement amount

settlement direction is valid
```

Perform these checks against current server state.

---

# 19. Settlement Atomicity

The following must be committed atomically:

```text
Settlement
+
Settlement Allocations
```

If any allocation fails:

```text
Nothing is committed.
```

---

# 20. Settlement Allocation Example

Existing:

```text
Dinner split
₹500
```

User settles:

```text
₹200
```

Request:

```json
{
  "expenseSplitId": "split_123",
  "amount": "200"
}
```

Result:

```text
Original = ₹500
Settled = ₹200
Remaining = ₹300
```

Later another settlement can allocate:

```text
₹300
```

to the same split.

---

# 21. Transfer

## POST `/api/transfers`

Request:

```json
{
  "operationId": "op_transfer_123",
  "clientId": "transfer_123",

  "fromAccountId": "account_bank",

  "toAccountId": "account_cash",

  "amount": "1000",

  "currency": "INR",

  "date": "2026-08-31T10:00:00.000Z",

  "notes": "ATM withdrawal"
}
```

Validation:

```text
Both accounts belong to user
Accounts are different
Amount > 0
```

Transfer must not:

```text
Create expense splits
Affect person balances
Count as spending
```

---

# 22. Credit Card Payment

## POST `/api/credit-card-payments`

Request:

```json
{
  "operationId": "op_cc_payment_123",
  "clientId": "cc_payment_123",

  "fromAccountId": "account_bank",

  "toAccountId": "account_credit_card",

  "amount": "5000",

  "currency": "INR",

  "date": "2026-08-31T10:00:00.000Z"
}
```

Server validates:

```text
Source account belongs to user
Destination account belongs to user
Destination is credit_card
Amount > 0
```

This is a liability payment, not an expense.

---

# 23. Balances

## GET `/api/people/:id/balance`

Return:

```json
{
  "data": {
    "personId": "person_arun",
    "balance": "450",
    "direction": "person_owes_user"
  }
}
```

Possible directions:

```text
person_owes_user
user_owes_person
settled
```

The balance must be calculated from underlying financial records.

---

# 24. Split Details

## GET `/api/expense-splits/:id`

Return:

```json
{
  "data": {
    "id": "split_123",
    "originalAmount": "500",
    "allocatedAmount": "200",
    "remainingAmount": "300",
    "status": "partially_settled",
    "allocations": []
  }
}
```

Status is derived.

Do not store it as an independently authoritative field.

---

# 25. Dashboard

## GET `/api/dashboard`

Return only the data required by the dashboard.

Example:

```json
{
  "data": {
    "accountBalance": "50000",
    "creditCardOutstanding": "12000",
    "availableCredit": "138000",
    "monthlySpending": "24500",
    "peopleOweYou": "4500",
    "youOwePeople": "1200",
    "recentTransactions": []
  }
}
```

All financial values are derived.

---

# 26. Sync Endpoint

## POST `/api/sync/push`

Used for offline operations.

Request:

```json
{
  "operations": [
    {
      "operationId": "op_123",
      "type": "CREATE_EXPENSE",
      "clientId": "expense_123",
      "payload": {}
    }
  ]
}
```

The server processes operations independently and returns results.

---

# 27. Sync Response

Example:

```json
{
  "data": {
    "results": [
      {
        "operationId": "op_123",
        "status": "completed",
        "entityId": "transaction_123"
      }
    ]
  }
}
```

Conflict:

```json
{
  "operationId": "op_456",
  "status": "conflict",
  "error": {
    "code": "SYNC_CONFLICT",
    "message": "The expense was modified elsewhere."
  }
}
```

---

# 28. Pull Sync

## GET `/api/sync/pull`

Request:

```text
GET /api/sync/pull?cursor=abc123
```

Response:

```json
{
  "data": {
    "changes": [],
    "nextCursor": "abc456"
  }
}
```

Only return changes belonging to the authenticated user.

---

# 29. Idempotency

Every write that can be retried must include:

```text
operationId
clientId
```

The server must recognize already-processed operations.

Example:

```text
Request 1
CREATE_EXPENSE
operationId = op123
→ created

Request 2
CREATE_EXPENSE
operationId = op123
→ return existing result
```

No duplicate record should be created.

---

# 30. HTTP Status Codes

Use conventional status codes.

```text
200 OK
```

Successful read/update.

```text
201 Created
```

Successful creation.

```text
400 Bad Request
```

Malformed request.

```text
401 Unauthorized
```

No valid authentication.

```text
403 Forbidden
```

Authenticated but not allowed.

```text
404 Not Found
```

Resource unavailable to the user.

```text
409 Conflict
```

Business/data conflict.

```text
422 Unprocessable Entity
```

Optional for semantically invalid input if the API convention uses it consistently.

```text
500 Internal Server Error
```

Unexpected server failure.

```text
503 Service Unavailable
```

Temporary infrastructure failure where appropriate.

---

# 31. Error Codes

Use stable application error codes.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT

INVALID_AMOUNT
INVALID_SPLIT
INVALID_SPLIT_TOTAL
INVALID_PARTICIPANT

INVALID_SETTLEMENT
INVALID_SETTLEMENT_ALLOCATION
OVER_SETTLEMENT

INVALID_TRANSFER
INVALID_ACCOUNT
INVALID_CREDIT_CARD_PAYMENT

SYNC_CONFLICT
SYNC_RETRYABLE_ERROR
DUPLICATE_OPERATION

INTERNAL_ERROR
```

Frontend behavior should depend on error codes rather than parsing error messages.

---

# 32. API Versioning

For MVP, versioning can be avoided if the API is internal to the application.

If a public API is introduced later:

```text
/api/v1/...
```

can be introduced deliberately.

Do not add versioning complexity without a real need.

---

# 33. API Security

Every endpoint must verify:

```text
Authentication
 ↓
Resource ownership
 ↓
Business authorization
```

Never trust:

```text
userId
accountId
personId
expenseSplitId
settlementId
```

from the client without server-side verification.

---

# 34. API and Offline Design

The API should be designed so that the same business operation can be invoked by:

```text
Online UI
Offline Sync Engine
```

For example:

```text
Online:
UI → POST /api/expenses/shared

Offline:
IndexedDB → Sync Queue → POST /api/expenses/shared
```

The business logic remains the same.

Do not create a separate "offline business logic" implementation.

---

# 35. API Layer Structure

Recommended:

```text
app/api/
    ↓
route handler
    ↓
request schema
    ↓
authentication
    ↓
use case
    ↓
domain
    ↓
repository
```

Example:

```text
POST /api/settlements
        ↓
settlement route
        ↓
CreateSettlementSchema
        ↓
authenticated user
        ↓
CreateSettlementUseCase
        ↓
SettlementDomain
        ↓
SettlementRepository
        ↓
MongoDB transaction
```

---

# 36. API Anti-Patterns

Do not:

```text
Expose MongoDB queries directly
```

Do not:

```text
Accept calculated balances from the client
```

Do not:

```text
Allow client-provided userId
```

Do not:

```text
Trust client-calculated settlement amounts
```

Do not:

```text
Create related financial records in separate requests when they must be atomic
```

Do not:

```text
Return raw database documents
```

Do not:

```text
Use HTTP status 200 for every failure
```

---

# 37. Final API Principle

The API represents actions the user performs.

Examples:

```text
Create Expense
Create Shared Expense
Create Settlement
Create Transfer
Pay Credit Card
Update Expense
Delete Expense
```

The server decides whether the action is valid.

The client requests an action.

The server owns the financial rules.

The database stores the resulting financial events.

That boundary should remain intact as the application grows.
