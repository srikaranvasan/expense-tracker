# Expense Tracker MVP - Data Flow

## 1. Purpose

This document defines how data moves through the application.

The application is a Next.js modular monolith with:

- Next.js frontend
- Next.js backend/API
- MongoDB server database
- IndexedDB local database
- Offline synchronization layer

The main architectural goal is:

> The UI should be fast and simple, while all financial operations remain correct, validated, and recoverable.

---

# 2. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │       User          │
                         │   iPhone / Desktop  │
                         └──────────┬──────────┘
                                    │
                                    ↓
                         ┌─────────────────────┐
                         │      Next.js UI     │
                         │ React Components     │
                         └──────────┬──────────┘
                                    │
                                    ↓
                         ┌─────────────────────┐
                         │ Feature / Use Case  │
                         │       Layer         │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
          ┌──────────────────┐             ┌──────────────────┐
          │ Local Repository │             │   Server API     │
          │   IndexedDB      │             │  Route Handler   │
          └────────┬─────────┘             └────────┬─────────┘
                   │                                │
                   ↓                                ↓
          ┌──────────────────┐             ┌──────────────────┐
          │    Sync Queue    │────────────→│ Domain / Service │
          └──────────────────┘             └────────┬─────────┘
                                                    │
                                                    ↓
                                           ┌──────────────────┐
                                           │    Repository    │
                                           └────────┬─────────┘
                                                    │
                                                    ↓
                                           ┌──────────────────┐
                                           │     MongoDB      │
                                           └──────────────────┘
````

---

# 3. Architectural Responsibility

## UI

Responsible for:

* Collecting input
* Displaying state
* User interaction
* Loading/error states
* Calling application/use-case functions

UI must not contain financial business rules.

---

## Feature / Use Case Layer

Responsible for:

* Coordinating user actions
* Calling domain logic
* Choosing local/server behavior
* Handling application-level workflows

Examples:

```text
CreateExpense
CreateSettlement
CreateTransfer
PayCreditCard
GetPersonBalance
```

---

## Domain Layer

Responsible for financial rules.

Examples:

```text
calculateEqualSplit()
validateSplitTotal()
calculateRemainingSplit()
calculatePersonBalance()
validateSettlementAllocation()
calculateAccountBalance()
calculateCreditCardOutstanding()
```

Domain functions should be pure wherever possible.

They must not depend on:

* React
* Next.js
* MongoDB
* IndexedDB
* HTTP

---

## Repository Layer

Responsible for persistence.

Examples:

```text
TransactionRepository
AccountRepository
ExpenseSplitRepository
SettlementRepository
SettlementAllocationRepository
```

The application should depend on repository interfaces rather than directly depending on MongoDB.

---

# 4. Personal Expense Flow

Example:

```text
User
 ↓
Add Expense
 ↓
₹500
 ↓
Food
 ↓
HDFC Credit Card
 ↓
Save
```

Application flow:

```text
UI
 ↓
CreateExpenseUseCase
 ↓
Validate input
 ↓
Create Transaction
 ↓
Create ExpenseSplit for user
 ↓
Save locally
 ↓
Queue synchronization
 ↓
Server validation
 ↓
MongoDB
```

The UI should show the expense immediately after local persistence.

---

# 5. Shared Expense Flow

Example:

```text
Dinner
₹1,200

Paid by: You

Participants:
You
Arun
Vijay
```

Equal split:

```text
You       ₹400
Arun      ₹400
Vijay     ₹400
```

Flow:

```text
UI
 ↓
CreateExpenseUseCase
 ↓
Validate transaction
 ↓
Calculate splits
 ↓
Validate sum(splits) = transaction amount
 ↓
Create transaction
 ↓
Create expense splits
 ↓
Save locally
 ↓
Sync
 ↓
Server validates again
 ↓
Persist atomically
```

Never trust calculated values from the client.

The server must recalculate or independently validate the financial result.

---

# 6. Expense Paid by Another Person

Example:

```text
Arun paid ₹900.

Participants:
You
Arun
```

Split:

```text
You      ₹450
Arun     ₹450
```

Stored information:

```text
Transaction:
  amount = ₹900
  paidBy = Arun

ExpenseSplit:
  You = ₹450
  Arun = ₹450
```

The system derives:

```text
You owe Arun ₹450
```

Do not create a separate debt transaction.

The debt is a projection of the underlying expense.

---

# 7. User Pays for Others

Example:

```text
You paid ₹1,200.

Your share = ₹400.
Others' shares = ₹800.
```

Stored:

```text
Transaction:
  amount = ₹1,200
  paidBy = user

ExpenseSplits:
  user = ₹400
  Arun = ₹400
  Vijay = ₹400
```

Derived:

```text
Your actual expense = ₹400

Arun owes you = ₹400
Vijay owes you = ₹400
```

The bank/card account movement is ₹1,200.

The user's actual spending is ₹400.

These are different metrics.

---

# 8. Balance Calculation

Never maintain a manually editable balance such as:

```text
Arun owes me = ₹2,500
```

Instead calculate it.

Conceptually:

```text
Gross amount owed
-
Settled amount
=
Remaining balance
```

For specific split settlement:

```text
Split amount
-
sum(settlement allocations)
=
remaining split amount
```

For a person:

```text
All relevant unsettled amounts
+
direction
=
current person balance
```

The UI can cache/project this value for performance, but it must not become an independently editable source of truth.

---

# 9. Settlement Flow

Example:

```text
You owe Arun:

Dinner       ₹300
Groceries    ₹500
Movie        ₹400
```

User selects:

```text
Dinner       ₹300
Movie        ₹200
```

Settlement:

```text
You → Arun
₹500
```

Allocations:

```text
Dinner split → ₹300
Movie split  → ₹200
```

Flow:

```text
People
 ↓
Person Details
 ↓
Unsettled Expenses
 ↓
Select Specific Splits
 ↓
Calculate selected amount
 ↓
Select payment account
 ↓
Create Settlement
 ↓
Create Settlement Allocations
 ↓
Validate allocations
 ↓
Persist atomically
 ↓
Recalculate balances
```

---

# 10. Partial Settlement Flow

Example:

```text
Groceries share = ₹500
```

User pays:

```text
₹200
```

Create:

```text
Settlement = ₹200

Allocation:
Groceries split = ₹200
```

Derived state:

```text
Original = ₹500
Settled  = ₹200
Remaining = ₹300
```

The split remains unsettled until the remaining amount reaches zero.

---

# 11. Settlement Validation

Before creating settlement allocations:

```text
For each selected split:

remaining =
shareAmount
-
existing allocations
```

Then:

```text
newAllocation <= remaining
```

Reject:

```text
newAllocation > remaining
```

Also validate:

```text
sum(all settlement allocations)
=
settlement amount
```

unless the product explicitly supports unallocated settlement amounts.

For the MVP, prefer fully allocated settlements.

---

# 12. Account Transfer Flow

Example:

```text
HDFC Savings
     ↓
₹10,000
     ↓
ICICI Savings
```

Flow:

```text
UI
 ↓
CreateTransferUseCase
 ↓
Validate accounts
 ↓
Validate ownership
 ↓
Validate source != destination
 ↓
Create transfer transaction
 ↓
Persist atomically
 ↓
Update local projection
```

Result:

```text
HDFC Savings  -₹10,000
ICICI Savings +₹10,000
```

Spending:

```text
No change
```

---

# 13. Credit-Card Payment Flow

Example:

```text
HDFC Savings
     ↓
₹15,000
     ↓
HDFC Credit Card
```

Flow:

```text
UI
 ↓
PayCreditCardUseCase
 ↓
Validate source account
 ↓
Validate destination is credit card
 ↓
Create credit_card_payment transaction
 ↓
Persist
 ↓
Recalculate balances
```

Result:

```text
Bank balance              -₹15,000
Credit-card outstanding   -₹15,000
Monthly spending           ₹0 change
```

The underlying credit-card expenses remain unchanged.

---

# 14. Account Balance Flow

When displaying an account balance:

```text
Account
 ↓
Opening balance
 ↓
Find applicable transactions
 ↓
Apply transaction effects
 ↓
Calculate current balance
```

Do not rely on a client-submitted current balance.

---

# 15. Credit-Card Outstanding Flow

```text
Credit Card
 ↓
Find card transactions
 ↓
Calculate expenses charged
 ↓
Subtract card payments
 ↓
Calculate outstanding
```

Then:

```text
Available Credit =
Credit Limit - Outstanding
```

Do not let the client directly set outstanding or available credit.

---

# 16. Dashboard Data Flow

Dashboard is a projection of underlying data.

```text
MongoDB / Local DB
       ↓
Queries / Aggregations
       ↓
Domain calculations
       ↓
Dashboard View Model
       ↓
UI
```

Dashboard values include:

```text
Monthly actual spending
Bank + cash balance
Credit-card outstanding
Available credit
People owe user
User owes people
Recent transactions
```

Dashboard must not become another source of truth.

---

# 17. Offline Write Flow

The app is offline-first.

When the user creates an expense:

```text
User
 ↓
UI
 ↓
Local validation
 ↓
Domain logic
 ↓
IndexedDB
 ↓
UI updates immediately
 ↓
Sync queue
```

Do not wait for MongoDB before confirming the expense to the user.

---

# 18. Online Write Flow

Even when online, prefer:

```text
UI
 ↓
Local write
 ↓
Immediate UI update
 ↓
Background sync
 ↓
Server
 ↓
MongoDB
```

This provides consistent UX regardless of network conditions.

---

# 19. Synchronization Flow

```text
IndexedDB
 ↓
Find pending operations
 ↓
Send to server
 ↓
Authenticate
 ↓
Validate ownership
 ↓
Validate business rules
 ↓
Check idempotency
 ↓
Apply operation
 ↓
MongoDB
 ↓
Return canonical result
 ↓
Update IndexedDB
 ↓
Mark synced
```

---

# 20. Failed Synchronization

If synchronization fails because of temporary network problems:

```text
Local record
   ↓
remains saved
   ↓
status = pending/failed
   ↓
retry later
```

Never remove the user's local expense because synchronization failed.

If failure is caused by invalid business data:

```text
status = failed
error = actionable
```

The UI should tell the user what needs attention.

---

# 21. Multi-Device Flow

Example:

```text
             MongoDB
             /     \
            /       \
       iPhone       Desktop
         ↓             ↓
    IndexedDB      IndexedDB
```

If an expense is created on iPhone:

```text
iPhone
 ↓
IndexedDB
 ↓
MongoDB
 ↓
Desktop sync
 ↓
Desktop IndexedDB
```

Both devices eventually converge on the server state.

---

# 22. Read Strategy

For normal interactive screens:

```text
UI
 ↓
IndexedDB
 ↓
Immediate rendering
```

Then:

```text
Background sync
 ↓
Updated local data
 ↓
UI refresh
```

For server-required operations:

```text
UI
 ↓
API
 ↓
MongoDB
```

Use server reads when authoritative or cross-device freshness is required.

---

# 23. Atomic Financial Operations

Operations involving multiple related records should be atomic.

Examples:

### Shared expense

```text
Transaction
+
ExpenseSplits
```

### Settlement

```text
Settlement
+
SettlementAllocations
```

### Transfer

```text
Transfer transaction
```

### Credit-card payment

```text
Credit-card payment transaction
```

If a multi-document operation fails, the database must not be left in a partial state.

Use MongoDB transactions where appropriate.

---

# 24. Server vs Client Responsibilities

## Client

Can:

* Calculate UI previews
* Calculate equal/custom split previews
* Validate basic forms
* Store local records
* Queue sync operations
* Display derived balances

## Server

Must:

* Authenticate
* Authorize
* Validate ownership
* Validate financial rules
* Validate monetary amounts
* Validate split totals
* Validate settlement allocations
* Validate account relationships
* Enforce idempotency
* Persist financial operations atomically

The server is the final authority.

---

# 25. Business Rule Duplication

Client and server may both implement validation for good UX.

However:

```text
Client validation = convenience
Server validation = authority
```

Do not rely on the client.

Where practical, share pure domain functions between client and server.

Do not duplicate financial formulas in unrelated files.

---

# 26. Error Flow

Example:

```text
User
 ↓
Invalid split
 ↓
Client validation
 ↓
Show error immediately
```

If somehow invalid data reaches the server:

```text
API
 ↓
Domain validation
 ↓
Domain error
 ↓
HTTP error response
 ↓
UI displays actionable message
```

Never expose raw MongoDB or stack-trace errors.

---

# 27. Data Consistency Rules

The following must always remain true:

```text
Expense total = sum of expense splits
```

```text
Settled split amount <= original split amount
```

```text
Settlement allocation <= remaining split amount
```

```text
Transfer source != destination
```

```text
Credit-card payment destination = credit-card account
```

```text
All referenced resources belong to authenticated user
```

```text
Transfers are not expenses
```

```text
Credit-card payments are not expenses
```

```text
Settlements are not expenses
```

---

# 28. Important Design Principle

The database stores **events and facts**.

The application derives:

* balances
* outstanding amounts
* available credit
* monthly spending
* receivables
* payables
* settlement status

Do not turn derived values into independent mutable financial facts unless there is a deliberate caching strategy.

The core flow should always remain:

```text
Financial Events
      ↓
Domain Calculations
      ↓
Derived Financial State
      ↓
UI
```

This keeps the system explainable.

If the dashboard says:

```text
Arun owes you ₹650
```

the application must always be able to trace that ₹650 back to the underlying expenses, splits, and settlements.
