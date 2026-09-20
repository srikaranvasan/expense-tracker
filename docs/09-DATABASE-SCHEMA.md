# Expense Tracker MVP - Database Schema

## 1. Database

Database:

```text
MongoDB
````

Use MongoDB collections for persistent server-side data.

All application records are scoped to a user.

---

# 2. Core Collections

MVP collections:

```text
users
accounts
people
categories
transactions
expenseSplits
settlements
settlementAllocations
syncOperations
```

---

# 3. User

```text
users
```

Purpose:

Store application-level user information.

```ts
User {
  _id: ObjectId

  email: string

  name: string

  currency: string

  timezone: string

  createdAt: Date
  updatedAt: Date
}
```

Notes:

* Authentication credentials/session data should be handled by the authentication system.
* Do not store passwords directly unless the chosen authentication architecture explicitly requires it.
* Currency defaults to the user's configured currency.
* Timezone is important for transaction dates and synchronization.

---

# 4. Account

```text
accounts
```

Represents where the user's money or liability exists.

Types:

```text
bank
cash
credit_card
```

Schema:

```ts
Account {
  _id: ObjectId

  userId: ObjectId

  name: string

  type: "bank" | "cash" | "credit_card"

  currency: string

  openingBalance: Decimal128

  creditLimit?: Decimal128

  statementDay?: number

  paymentDueDay?: number

  archivedAt?: Date | null

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

---

# 5. Account Rules

## Bank

```text
openingBalance
+
money received
-
expenses
-
transfers out
+
transfers in
-
credit-card payments
```

## Cash

Same basic balance behavior as a bank account.

## Credit Card

Represents a liability.

Conceptually:

```text
credit card spending
→ increases outstanding

credit card payment
→ decreases outstanding
```

Do not treat credit-card payments as new spending.

---

# 6. Person

```text
people
```

Represents someone outside the application.

Example:

```text
Arun
Vijay
Rahul
```

Schema:

```ts
Person {
  _id: ObjectId

  userId: ObjectId

  name: string

  notes?: string

  archivedAt?: Date | null

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

A person does not need an application account.

---

# 7. Category

```text
categories
```

Schema:

```ts
Category {
  _id: ObjectId

  userId: ObjectId

  name: string

  icon?: string

  archivedAt?: Date | null

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

Default categories can be created when the user registers.

---

# 8. Transaction

```text
transactions
```

This is the main financial event.

Types:

```text
expense
transfer
credit_card_payment
```

Schema:

```ts
Transaction {
  _id: ObjectId

  userId: ObjectId

  clientId: string

  type:
    | "expense"
    | "transfer"
    | "credit_card_payment"

  amount: Decimal128

  currency: string

  description: string

  date: Date

  categoryId?: ObjectId

  accountId?: ObjectId

  fromAccountId?: ObjectId

  toAccountId?: ObjectId

  notes?: string

  deletedAt?: Date | null

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

---

# 9. Transaction Type Rules

## Expense

Uses:

```text
accountId
categoryId
```

May have:

```text
expenseSplits
```

if shared.

---

## Transfer

Uses:

```text
fromAccountId
toAccountId
```

Must satisfy:

```text
fromAccountId != toAccountId
```

Does not have:

```text
expenseSplits
category
person balance
```

---

## Credit Card Payment

Uses:

```text
fromAccountId
toAccountId
```

where:

```text
toAccount.type = credit_card
```

Does not:

```text
count as spending
create expense splits
affect person balances
```

---

# 10. Expense Split

```text
expenseSplits
```

Represents each participant's share of an expense.

Example:

```text
Dinner ₹1,200

You       ₹400
Arun      ₹400
Vijay     ₹400
```

Schema:

```ts
ExpenseSplit {
  _id: ObjectId

  userId: ObjectId

  transactionId: ObjectId

  participantType: "user" | "person"

  personId?: ObjectId

  amount: Decimal128

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

---

# 11. Expense Split Rules

If:

```text
participantType = "user"
```

then:

```text
personId = null
```

If:

```text
participantType = "person"
```

then:

```text
personId != null
```

The sum of all splits must equal:

```text
transaction.amount
```

This must be validated server-side.

---

# 12. Shared Expense Example

Transaction:

```text
Transaction
amount = ₹1,200
type = expense
accountId = HDFC Credit Card
```

Splits:

```text
ExpenseSplit
user
₹400

ExpenseSplit
Arun
₹400

ExpenseSplit
Vijay
₹400
```

The user's actual share:

```text
₹400
```

Other people's owed amount:

```text
Arun → ₹400
Vijay → ₹400
```

---

# 13. Someone Else Paid

Example:

```text
Arun paid ₹900
```

The transaction still represents:

```text
₹900 expense
```

Participants:

```text
You       ₹450
Arun      ₹450
```

Because Arun paid, the user's resulting balance is:

```text
You owe Arun ₹450
```

The application does not create an account transaction for the user because their account was not charged.

---

# 14. Paid By Representation

Do not create a separate `paidBy` field that duplicates the accounting model unnecessarily.

The transaction's payment account tells us:

```text
user paid
```

when the user paid from one of their accounts.

For an expense paid by another person, represent the external payer explicitly in the expense model/domain representation.

The database design should keep the distinction clear between:

```text
Who paid
```

and:

```text
Who consumed the expense
```

Do not infer one from the other when the domain requires both.

---

# 15. Settlement

```text
settlements
```

Represents an actual payment between the user and another person.

Schema:

```ts
Settlement {
  _id: ObjectId

  userId: ObjectId

  clientId: string

  personId: ObjectId

  direction: "user_to_person" | "person_to_user"

  amount: Decimal128

  currency: string

  accountId?: ObjectId

  date: Date

  notes?: string

  deletedAt?: Date | null

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

---

# 16. Settlement Meaning

Example:

```text
user owes Arun ₹750
```

Settlement:

```text
direction = user_to_person
amount = ₹750
person = Arun
```

Reverse:

```text
Arun owes user ₹750
```

Settlement:

```text
direction = person_to_user
amount = ₹750
person = Arun
```

---

# 17. Settlement Allocation

```text
settlementAllocations
```

This is what connects an actual settlement to specific expense splits.

Schema:

```ts
SettlementAllocation {
  _id: ObjectId

  userId: ObjectId

  settlementId: ObjectId

  expenseSplitId: ObjectId

  amount: Decimal128

  createdAt: Date
  updatedAt: Date

  syncVersion: number
}
```

This table is essential.

It allows:

```text
One settlement
      ↓
Multiple expense splits
```

and:

```text
One expense split
      ↓
Multiple settlements
```

---

# 18. Settlement Example

Expense:

```text
Dinner
₹500 owed to Arun
```

Split:

```text
ExpenseSplit
₹500
```

User pays Arun:

```text
Settlement
₹200
```

Allocation:

```text
SettlementAllocation
₹200 → Dinner split
```

Remaining:

```text
₹300
```

Later:

```text
Settlement
₹300
```

Allocation:

```text
SettlementAllocation
₹300 → Dinner split
```

Now:

```text
Settled = ₹500
Remaining = ₹0
```

---

# 19. Why Allocations Exist

Do not calculate settlement status only from:

```text
settlement date
```

or:

```text
settlement period
```

A settlement must explicitly identify which expenses it settles.

Otherwise the application cannot correctly handle:

```text
Expense A ₹300
Expense B ₹500

Settlement ₹500
```

where the user wants:

```text
Expense A ₹300
Expense B ₹200
```

The allocation records provide that relationship.

---

# 20. Derived Person Balance

Do not store:

```text
Person.balance
```

as authoritative data.

Calculate it from expense splits and settlement allocations.

Conceptually:

```text
Amount person owes user
-
Amount user owes person
```

with settlement allocations reducing the appropriate outstanding amounts.

The exact calculation must live in the domain layer.

---

# 21. Derived Split Status

Do not store:

```text
isSettled: true
```

as the authoritative value.

Calculate:

```text
allocatedAmount
=
SUM(settlementAllocations.amount)
```

Then:

```text
remainingAmount
=
expenseSplit.amount - allocatedAmount
```

Status:

```text
remaining = 0
→ settled

remaining > 0
AND allocated > 0
→ partially_settled

allocated = 0
→ unsettled
```

---

# 22. Database Relationships

Conceptually:

```text
User
 │
 ├── Accounts
 │
 ├── People
 │
 ├── Categories
 │
 ├── Transactions
 │      │
 │      └── Expense Splits
 │
 └── Settlements
         │
         └── Settlement Allocations
                    │
                    └── Expense Splits
```

---

# 23. Relationship Details

```text
User 1 ──── N Accounts

User 1 ──── N People

User 1 ──── N Categories

User 1 ──── N Transactions

Transaction 1 ──── N ExpenseSplits

User 1 ──── N Settlements

Settlement 1 ──── N SettlementAllocations

ExpenseSplit 1 ──── N SettlementAllocations
```

---

# 24. Referential Integrity

MongoDB does not provide relational foreign-key enforcement in the same way a traditional SQL database does.

Therefore the application must validate references.

Before creating an expense:

```text
accountId belongs to current user
categoryId belongs to current user
personIds belong to current user
```

Before creating a settlement:

```text
personId belongs to current user
accountId belongs to current user
expenseSplitIds belong to current user
```

Never trust client-supplied IDs.

---

# 25. Soft Deletes

Financial entities should generally use:

```ts
deletedAt?: Date | null
```

instead of immediate physical deletion.

Apply this particularly to:

```text
transactions
settlements
accounts
people
categories
```

When a record is deleted:

```text
deletedAt = current timestamp
```

Normal application queries exclude deleted records.

---

# 26. Sync Metadata

Entities that participate in offline synchronization should have:

```text
clientId
syncVersion
createdAt
updatedAt
deletedAt
```

where appropriate.

Do not use MongoDB's `_id` alone as the offline synchronization identifier.

---

# 27. Idempotency Collection

A dedicated collection may be used:

```text
syncOperations
```

Schema:

```ts
SyncOperation {
  _id: ObjectId

  userId: ObjectId

  operationId: string

  operationType: string

  clientId: string

  result?: unknown

  status:
    | "processing"
    | "completed"
    | "failed"

  createdAt: Date
  completedAt?: Date
}
```

Create a unique index on the appropriate combination, such as:

```text
userId + operationId
```

This prevents duplicate processing.

---

# 28. Indexes

Create indexes based on actual query patterns.

Initial indexes should include:

```text
users
email → unique
```

```text
accounts
userId + archivedAt
```

```text
people
userId + archivedAt
```

```text
categories
userId + archivedAt
```

```text
transactions
userId + date
userId + accountId + date
userId + categoryId + date
userId + deletedAt
userId + clientId → unique
```

```text
expenseSplits
userId + transactionId
userId + personId
```

```text
settlements
userId + personId + date
userId + clientId → unique
```

```text
settlementAllocations
userId + settlementId
userId + expenseSplitId
```

```text
syncOperations
userId + operationId → unique
userId + status + createdAt
```

Exact indexes should be reviewed after query patterns are implemented.

---

# 29. Decimal Storage

MongoDB monetary values should use:

```text
Decimal128
```

rather than floating-point doubles.

Example:

```text
amount: Decimal128("1200.50")
```

Never persist JavaScript floating-point results directly as authoritative monetary values.

---

# 30. Dates

Persist timestamps consistently.

Use UTC timestamps for actual event timestamps.

User-facing transaction dates should be interpreted using the user's configured timezone.

Do not mix:

```text
UTC Date
Local Date
String date
```

without an explicit conversion boundary.

---

# 31. Currency

Every monetary record should have a currency.

For MVP:

```text
One user's primary currency
```

can be assumed for normal transactions.

Do not implement currency conversion in the MVP.

---

# 32. Transaction + Split Atomicity

Creating a shared expense must be atomic.

Conceptually:

```text
MongoDB Transaction

Create Transaction
        +
Create Expense Splits
```

If split creation fails:

```text
Transaction must not remain partially created.
```

---

# 33. Settlement + Allocation Atomicity

Creating a settlement must be atomic.

```text
MongoDB Transaction

Create Settlement
        +
Create Settlement Allocations
```

If allocation validation fails:

```text
Neither settlement nor allocations should be committed.
```

---

# 34. Settlement Validation

Before committing:

```text
1. Settlement person exists.
2. Settlement account belongs to user.
3. Every expense split belongs to user.
4. Split is relevant to the selected person.
5. Allocation amount > 0.
6. Allocation does not exceed remaining amount.
7. Allocation totals equal settlement amount.
8. Direction is valid.
```

Perform these checks using current server state.

---

# 35. Important Derived Values

The following should not be stored as independently editable financial facts:

```text
Person balance
Split remaining amount
Split settlement status
Credit-card available credit
Credit-card outstanding
Monthly spending
Total spending
Dashboard totals
```

These are derived from underlying events.

---

# 36. Event Interpretation

The financial meaning of each transaction is:

```text
Expense
→ spending occurred

Transfer
→ money moved between user's accounts

Credit Card Payment
→ credit-card liability was paid

Settlement
→ money moved between user and person
```

Do not collapse these into a generic "money movement" calculation.

Their effects are different.

---

# 37. Example Complete Dataset

User:

```text
Karan
```

Accounts:

```text
HDFC Savings
₹50,000

HDFC Credit Card
₹1,50,000 limit
```

People:

```text
Arun
Vijay
```

Expense:

```text
Dinner
₹1,200
Paid using HDFC Credit Card
```

Splits:

```text
Karan  ₹400
Arun   ₹400
Vijay  ₹400
```

Result:

```text
Credit Card Outstanding
+₹1,200

Arun owes Karan
₹400

Vijay owes Karan
₹400

Karan's actual expense
₹400
```

If Karan settles ₹300 with Arun:

```text
Settlement
Karan → Arun
₹300
```

Allocation:

```text
Dinner split
₹300
```

Remaining:

```text
Arun owes Karan
₹100
```

The original expense remains:

```text
₹1,200
```

because settlement does not modify the original expense amount.

---

# 38. Critical Design Principle

Never mutate an original expense merely because someone settled it.

This:

```text
Expense = ₹1,200
Settlement = ₹300
```

does NOT become:

```text
Expense = ₹900
```

Instead:

```text
Expense
₹1,200

Settled
₹300

Remaining settlement obligation
₹900
```

The financial event and its settlement are separate records.

---

# 39. Future Extensibility

The schema should allow future features without redesigning the core financial model.

Potential future additions:

```text
Recurring transactions
Income
Budgets
Subscriptions
Attachments
Receipts
Bank imports
Multi-currency
Shared application users
Automatic categorization
```

Do not add these fields to MVP collections merely because they might be useful someday.

Keep the MVP schema focused.

---

# 40. Final Database Principle

The database should represent what actually happened.

```text
Transactions
    ↓
What financial events occurred?

Expense Splits
    ↓
Who was responsible for the expense?

Settlements
    ↓
What money was actually paid between people?

Settlement Allocations
    ↓
Which specific obligations did that payment settle?

Accounts
    ↓
Where did money/liability exist?

People
    ↓
Who participated outside the application?
```

Derived balances and dashboard values should be calculated from these records rather than maintained as fragile manually updated numbers.
