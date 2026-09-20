# Expense Tracker MVP - Data Model

## 1. Purpose

This document defines the MongoDB data model and the business invariants that must be respected by the application.

The data model must support:

- Personal expenses
- Shared expenses
- Multiple participants
- Expenses paid by the user
- Expenses paid by another person
- Multiple bank accounts
- Cash
- Multiple credit cards
- Transfers
- Credit-card payments
- Settlements
- Partial settlements
- Settlements against specific expense splits
- Offline synchronization
- Multi-device synchronization

The model must prioritize financial correctness and future extensibility.

---

# 2. Database

Use:

```text
MongoDB
````

Use MongoDB collections rather than trying to represent everything as one document.

The primary collections for MVP are:

```text
users
accounts
people
categories
transactions
expenseSplits
settlements
settlementAllocations
```

Future collections may include:

```text
recurringTransactions
attachments
syncLogs
budgets
```

Do not implement future collections unless required by the MVP.

---

# 3. Core Domain Model

```text
USER
 │
 ├── ACCOUNTS
 │
 ├── PEOPLE
 │
 ├── CATEGORIES
 │
 ├── TRANSACTIONS
 │       │
 │       └── EXPENSE_SPLITS
 │
 └── SETTLEMENTS
         │
         └── SETTLEMENT_ALLOCATIONS
                    │
                    └── EXPENSE_SPLITS
```

---

# 4. Users

Collection:

```text
users
```

Example:

```ts
type User = {
  _id: ObjectId

  email: string
  name: string

  currency: string
  timezone: string

  settings: {
    defaultAccountId?: ObjectId
    defaultCategoryId?: ObjectId
  }

  createdAt: Date
  updatedAt: Date
}
```

Rules:

* Email must be unique.
* User identity comes from the authenticated session.
* Client must never be trusted to provide authoritative `userId`.

---

# 5. Accounts

Collection:

```text
accounts
```

An account represents a financial location owned by the user.

Supported types:

```text
bank
cash
credit_card
```

Example:

```ts
type Account = {
  _id: ObjectId

  userId: ObjectId

  name: string

  type: "bank" | "cash" | "credit_card"

  currency: string

  openingBalance: Decimal128

  institution?: {
    name?: string
  }

  creditCard?: {
    creditLimit: Decimal128
    statementDay?: number
    paymentDueDay?: number
  }

  isActive: boolean

  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

## Credit cards

Example:

```text
HDFC Credit Card

Credit Limit:       ₹150,000
Outstanding:         ₹18,500
Available Credit:   ₹131,500
```

`creditLimit` is persisted.

`outstanding` and `availableCredit` should be derived from transactions.

Do not allow the client to directly modify outstanding or available credit.

---

# 6. People

Collection:

```text
people
```

A Person is someone the user can split expenses with.

Example:

```ts
type Person = {
  _id: ObjectId

  userId: ObjectId

  name: string

  phone?: string
  email?: string

  isActive: boolean

  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

Important:

A Person is not necessarily an application User.

The user can create:

```text
Arun
Vijay
Rahul
```

without those people having accounts in the application.

---

# 7. Categories

Collection:

```text
categories
```

Example:

```ts
type Category = {
  _id: ObjectId

  userId: ObjectId

  name: string

  parentId?: ObjectId

  icon?: string

  type: "expense" | "income"

  isActive: boolean

  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

Example hierarchy:

```text
Food
 ├── Restaurants
 ├── Groceries
 └── Delivery

Transport
 ├── Fuel
 ├── Uber
 └── Metro
```

---

# 8. Transactions

Collection:

```text
transactions
```

This is the primary collection for financial events.

Supported transaction types:

```text
expense
income
transfer
credit_card_payment
```

Example:

```ts
type Transaction = {
  _id: ObjectId

  clientId: string

  userId: ObjectId

  type:
    | "expense"
    | "income"
    | "transfer"
    | "credit_card_payment"

  amount: Decimal128

  currency: string

  date: Date

  accountId?: ObjectId

  fromAccountId?: ObjectId
  toAccountId?: ObjectId

  categoryId?: ObjectId

  paidBy?: {
    type: "user" | "person"
    personId?: ObjectId
  }

  description?: string
  notes?: string

  createdAt: Date
  updatedAt: Date

  deletedAt?: Date

  syncVersion: number
}
```

---

# 9. Meaning of Account Fields

Do not confuse these fields.

## `accountId`

The financial account used for a normal transaction.

Example:

```text
Dinner ₹500
Paid by: You
Account: HDFC Credit Card
```

```text
accountId = HDFC Credit Card
```

## `fromAccountId`

Used for transfers or credit-card payments.

Example:

```text
HDFC Savings → ICICI Savings
```

```text
fromAccountId = HDFC Savings
```

## `toAccountId`

The destination account.

```text
toAccountId = ICICI Savings
```

## `paidBy`

Identifies who physically paid the expense.

Example:

```text
Arun paid ₹900.
```

```text
paidBy = Arun
```

These concepts must remain separate.

---

# 10. Transaction Rules

## Expense

Required:

```text
type = expense
amount
date
categoryId
paidBy
```

`accountId` is required when the user's tracked financial account was used.

If another person paid, their external bank account does not need to exist in `accounts`.

Shared expenses have `expenseSplits`.

Personal expenses can have a single split belonging to the user.

---

## Income

Required:

```text
type = income
amount
date
accountId
categoryId
```

Income does not have expense splits.

---

## Transfer

Required:

```text
type = transfer
amount
fromAccountId
toAccountId
date
```

Rules:

* Source and destination must be different.
* Both accounts must belong to the user.
* No category.
* No expense splits.
* Must not count as spending.

---

## Credit Card Payment

Required:

```text
type = credit_card_payment
amount
fromAccountId
toAccountId
date
```

Rules:

* `toAccountId` must be a credit-card account.
* `fromAccountId` must belong to the user.
* Must not count as new spending.
* Reduces the credit-card liability.

---

# 11. Paid By

`paidBy` must support:

```ts
{
  type: "user"
}
```

or:

```ts
{
  type: "person",
  personId: ObjectId
}
```

Examples:

```text
You paid
→ paidBy.type = user
```

```text
Arun paid
→ paidBy.type = person
→ paidBy.personId = Arun
```

---

# 12. Expense Splits

Collection:

```text
expenseSplits
```

One transaction can have many splits.

Example:

```text
Dinner ₹1,200

You       ₹400
Arun      ₹400
Vijay     ₹400
```

Data model:

```ts
type ExpenseSplit = {
  _id: ObjectId

  clientId: string

  userId: ObjectId

  transactionId: ObjectId

  participant: {
    type: "user" | "person"
    personId?: ObjectId
  }

  shareAmount: Decimal128

  createdAt: Date
  updatedAt: Date

  deletedAt?: Date
}
```

---

# 13. Split Rules

Every shared expense must satisfy:

```text
sum(active expenseSplit.shareAmount)
=
transaction.amount
```

Example:

```text
Expense = ₹1,000

You       ₹200
Arun      ₹500
Vijay     ₹300

Total = ₹1,000
```

Do not allow:

```text
₹200 + ₹500 + ₹200 = ₹900
```

or:

```text
₹200 + ₹500 + ₹400 = ₹1,100
```

The API must validate this server-side.

---

# 14. Split Types

The UI may support:

```text
Equal
Custom
Percentage
```

However, persist the final monetary result as:

```text
shareAmount
```

Example percentage input:

```text
You       50%
Arun      30%
Vijay     20%
```

For ₹1,000:

```text
You       ₹500
Arun      ₹300
Vijay     ₹200
```

Persist:

```text
You       ₹500
Arun     ₹300
Vijay    ₹200
```

This avoids repeatedly recalculating historical monetary values.

---

# 15. Settlement

Collection:

```text
settlements
```

A settlement represents an actual payment between people.

Example:

```text
You owe Arun ₹500.

You pay Arun ₹500.
```

```ts
type Settlement = {
  _id: ObjectId

  clientId: string

  userId: ObjectId

  from: {
    type: "user" | "person"
    personId?: ObjectId
  }

  to: {
    type: "user" | "person"
    personId?: ObjectId
  }

  amount: Decimal128

  currency: string

  accountId?: ObjectId

  date: Date

  notes?: string

  createdAt: Date
  updatedAt: Date

  deletedAt?: Date
}
```

---

# 16. Settlement Meaning

Settlement means:

> Actual money was transferred between people to reduce an existing shared-expense balance.

It is not an expense.

Example:

```text
Dinner
₹500 owed to Arun

Settlement
You → Arun
₹500
```

Do not create:

```text
Expense: ₹500
```

for the settlement.

---

# 17. Settlement Allocations

Collection:

```text
settlementAllocations
```

This is required because a settlement can apply to specific expense splits.

Example:

```text
You owe Arun:

Dinner       ₹300
Groceries    ₹500
Movie        ₹400
```

You pay Arun ₹300 specifically for Dinner.

Settlement:

```text
You → Arun
₹300
```

Allocation:

```text
Settlement S1
    ↓
Dinner Split
₹300
```

Data model:

```ts
type SettlementAllocation = {
  _id: ObjectId

  clientId: string

  userId: ObjectId

  settlementId: ObjectId

  expenseSplitId: ObjectId

  amount: Decimal128

  createdAt: Date
  updatedAt: Date

  deletedAt?: Date
}
```

---

# 18. Partial Settlement

A split can be partially settled.

Example:

```text
Groceries share = ₹500
```

Settlement:

```text
₹200
```

Allocation:

```text
expenseSplit = Groceries
amount = ₹200
```

Derived:

```text
Original share:  ₹500
Settled:         ₹200
Remaining:       ₹300
```

Do not add a `settledAmount` field to the split as an independently editable value.

Calculate it from settlement allocations.

---

# 19. Balance Calculation

Do not store authoritative fields like:

```text
Arun owes me = ₹2,300
```

as manually mutable database state.

Calculate balances from events.

Conceptually:

```text
Amount A owes B
=
A's relevant expense responsibility
-
A's settlement allocations toward B
```

Similarly:

```text
Amount B owes A
=
B's relevant expense responsibility
-
B's settlement allocations toward A
```

The application can expose the result as a derived balance.

---

# 20. Account Balance

Account balance should be derived from:

```text
Opening Balance
+
Income
+
Transfers In
-
Expenses Paid From Account
-
Transfers Out
-
Credit Card Payments
-
Other applicable account movements
```

Do not allow users to arbitrarily edit the calculated current balance.

If a correction is required, create a proper adjustment mechanism later.

---

# 21. Credit Card Balance

Credit-card outstanding should be derived from:

```text
Card Expenses
-
Card Payments
+
Other applicable adjustments
```

Available credit:

```text
Credit Limit
-
Outstanding
```

Do not independently store available credit as authoritative state.

---

# 22. Monthly Actual Spending

For shared expenses, distinguish:

```text
Amount Paid
```

from:

```text
User's Actual Share
```

Example:

```text
You paid ₹1,200.

Your share = ₹400.

Others owe you = ₹800.
```

Monthly actual spending should count:

```text
₹400
```

not:

```text
₹1,200
```

This is essential for accurate personal spending reports.

---

# 23. Transfers and Credit-Card Payments

Transfers:

```text
HDFC Savings
    ↓
ICICI Savings
₹10,000
```

must not increase spending.

Credit-card payment:

```text
HDFC Savings
    ↓
HDFC Credit Card
₹10,000
```

must not increase spending.

The original credit-card purchases are the expenses.

---

# 24. Soft Deletion

Financial records should normally use:

```ts
deletedAt?: Date
```

instead of physical deletion.

Why:

* Offline synchronization
* Auditability
* Multi-device synchronization
* Recovery
* Preventing data divergence

Normal queries exclude records where:

```text
deletedAt != null
```

---

# 25. Client IDs

Offline-created records require stable client-generated IDs.

Use UUIDs.

Example:

```text
clientId:
550e8400-e29b-41d4-a716-446655440000
```

The client ID must remain stable across retries.

This allows the server to recognize:

```text
"I already processed this operation."
```

and prevent duplicate transactions.

---

# 26. Monetary Precision

Never use JavaScript floating-point arithmetic for financial calculations.

Avoid:

```ts
number
```

as the authoritative representation of money.

Use:

```text
MongoDB Decimal128
```

and a decimal arithmetic library in application/domain code.

All monetary calculations must go through a centralized money utility.

---

# 27. Dates

Store timestamps in UTC.

Display them in the user's configured timezone.

Use the user's timezone for:

* daily grouping
* monthly grouping
* recurring transaction dates
* card statement dates
* due dates

Do not mix local timestamps and UTC timestamps inconsistently.

---

# 28. Recommended Indexes

At minimum:

```text
users:
  email UNIQUE

accounts:
  userId

people:
  userId

categories:
  userId

transactions:
  userId + date
  userId + accountId
  userId + type
  userId + clientId UNIQUE

expenseSplits:
  userId + transactionId
  userId + participant

settlements:
  userId + date
  userId + clientId UNIQUE

settlementAllocations:
  userId + settlementId
  userId + expenseSplitId
```

Add additional indexes only based on real query patterns.

---

# 29. Ownership Rules

Every user-owned collection must include:

```text
userId
```

Server queries must always enforce ownership.

Example:

```ts
{
  _id: transactionId,
  userId: authenticatedUserId
}
```

Never:

```ts
{
  _id: transactionId
}
```

without ownership validation.

---

# 30. Core Invariants

The application must enforce these invariants:

### Expense

```text
amount > 0
```

### Split

```text
sum(splits) = expense.amount
```

### Settlement

```text
amount > 0
```

### Settlement allocation

```text
allocation <= remaining unsettled split amount
```

### Transfer

```text
fromAccount != toAccount
```

### Credit-card payment

```text
toAccount.type = credit_card
```

### Account ownership

```text
Referenced account belongs to current user
```

### Person ownership

```text
Referenced person belongs to current user
```

### Category ownership

```text
Referenced category belongs to current user
```

These rules must be enforced on the server even if the frontend already validates them.

---

# 31. Final Relationship Model

```text
USER
 │
 ├── 1:N ACCOUNTS
 │
 ├── 1:N PEOPLE
 │
 ├── 1:N CATEGORIES
 │
 ├── 1:N TRANSACTIONS
 │             │
 │             └── 1:N EXPENSE_SPLITS
 │
 └── 1:N SETTLEMENTS
                 │
                 └── 1:N SETTLEMENT_ALLOCATIONS
                                │
                                └── N:1 EXPENSE_SPLITS
```

The most important relationship is:

```text
Transaction
    ↓
Expense Splits
    ↓
Settlement Allocations
    ↓
Settlement
```

This allows the system to answer precisely:

* Who paid?
* What was everyone's share?
* Who owes whom?
* How much remains?
* Which exact expense has been settled?
* Which expense has only been partially settled?

That should remain the foundation of the financial domain.
