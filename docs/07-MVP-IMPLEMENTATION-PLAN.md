# Expense Tracker MVP - Implementation Plan

## 1. Objective

Build the MVP as a production-quality Next.js application with:

- Next.js frontend
- Next.js backend
- MongoDB
- IndexedDB for offline-first local storage
- Background synchronization
- Strong financial-domain validation
- Responsive mobile-first UI built with Chakra UI

Do not implement every possible feature at once.

The MVP should establish a reliable financial foundation first.

---

# 2. MVP Scope

The MVP includes:

1. Authentication
2. User profile/settings
3. Accounts
4. People
5. Categories
6. Personal expenses
7. Shared expenses
8. Equal/custom/percentage splits
9. Settlements
10. Specific settlement allocations
11. Partial settlements
12. Transfers
13. Credit-card payments
14. Transaction history
15. Dashboard
16. Offline expense creation
17. Background synchronization
18. Basic search/filtering

---

# 3. Explicitly Out of MVP

Do NOT implement initially:

- Bank API integrations
- Automatic bank transaction imports
- OCR receipt scanning
- AI categorization
- Budgets
- Recurring transactions
- Investment tracking
- Cryptocurrency
- Multi-currency conversion
- Family/shared accounts
- Complex accounting reports
- Subscription management
- Bill reminders
- Automatic settlement optimization
- Social features
- Multi-user collaborative accounts

These can be added later without compromising the MVP architecture.

---

# 4. Implementation Phases

## Phase 0 - Foundation

Set up:

```text
Next.js
TypeScript
ESLint
Prettier
MongoDB
Zod
Testing framework
IndexedDB library
Authentication
Environment configuration
Chakra UI provider and theme
````

Create the folder structure from:

```text
05-FOLDER-STRUCTURE.md
```

Establish the Chakra theme and the shared components in `components/ui/` during
this phase. Feature screens built before the theme exists end up carrying
one-off visual decisions that have to be unpicked later.

Do not start implementing feature-specific UI before the architectural foundation is established.

---

# 5. Phase 1 - Authentication

Implement:

```text
Register
Login
Logout
Session
Protected routes
```

Requirements:

* Server-side authentication
* Secure session handling
* User ownership enforcement
* No client-controlled user IDs

After authentication, all application data belongs to the authenticated user.

---

# 6. Phase 2 - Accounts

Implement:

```text
Create account
Edit account
Archive account
List accounts
Account details
```

Account types:

```text
Bank
Cash
Credit Card
```

For credit cards:

```text
Credit limit
Statement day
Payment due day
```

Calculate:

```text
Outstanding
Available credit
```

from transactions.

Do not store them as independently editable values.

---

# 7. Phase 3 - People

Implement:

```text
Create person
Edit person
Archive person
List people
Person details
```

A person is an external participant.

They do not need an application account.

Example:

```text
Arun
Vijay
Rahul
```

---

# 8. Phase 4 - Categories

Create default categories for new users.

Example:

```text
Food
Transport
Shopping
Bills
Entertainment
Health
Travel
Other
```

Allow:

```text
Create category
Edit category
Archive category
```

Keep the initial category system simple.

---

# 9. Phase 5 - Personal Expenses

Implement the simplest expense flow first.

Example:

```text
Amount
Description
Category
Account
Date
Notes
```

Flow:

```text
UI
 ↓
Schema validation
 ↓
CreateExpenseUseCase
 ↓
Domain validation
 ↓
Local repository
 ↓
Sync queue
 ↓
Server
 ↓
MongoDB
```

The expense should immediately appear in the UI after local persistence.

---

# 10. Phase 6 - Shared Expenses

Add:

```text
Paid by
Participants
Split method
```

Support:

```text
Equal
Custom
Percentage
```

Example:

```text
₹1,200

You       ₹400
Arun      ₹400
Vijay     ₹400
```

Validation:

```text
sum(splits) === expense.amount
```

must always hold.

---

# 11. Phase 7 - Balance Calculation

Implement domain calculations for:

```text
Person balance
User owes person
Person owes user
```

Do not store manually editable balances.

Calculate them from:

```text
Expense Splits
+
Settlement Allocations
```

The person details page should expose the underlying expenses contributing to the balance.

---

# 12. Phase 8 - Settlements

Implement:

```text
Create settlement
Select person
Select expense splits
Select payment account
Enter amount
Confirm
```

A settlement represents an actual payment.

It is not an expense.

---

# 13. Phase 9 - Settlement Allocations

Support:

```text
Settlement → multiple expense splits
```

Example:

```text
Dinner       ₹300
Groceries    ₹500
Movie        ₹400
```

Settlement:

```text
₹500
```

Allocations:

```text
Dinner       ₹300
Movie        ₹200
```

The remaining amounts must be derived from allocations.

---

# 14. Phase 10 - Partial Settlements

Support:

```text
Original split = ₹500
Settlement = ₹200
Remaining = ₹300
```

Prevent:

```text
Settlement = ₹600
```

because it exceeds the remaining amount.

This validation must happen on the server.

---

# 15. Phase 11 - Transfers

Implement:

```text
Account A
 ↓
Amount
 ↓
Account B
```

Validation:

```text
A != B
```

Transfers:

* affect account balances
* do not affect spending
* do not create expense splits
* do not affect person balances

---

# 16. Phase 12 - Credit Card Payments

Implement:

```text
Bank/Cash Account
 ↓
Credit Card
```

Validation:

```text
destination.type === credit_card
```

Credit-card payment:

* reduces card outstanding
* reduces source account balance
* does not count as spending
* does not create expense splits

---

# 17. Phase 13 - Transactions

Create the transaction history screen.

Display:

```text
Date
Description
Amount
Category
Account
Type
```

For shared transactions also display relevant information:

```text
Paid by
Your share
Settlement status
```

Support:

```text
Search
Date filter
Category filter
Account filter
Person filter
Transaction type
```

---

# 18. Phase 14 - Dashboard

Build dashboard after the underlying domain is stable.

Display:

```text
Total account balance
Credit-card outstanding
Available credit
Monthly actual spending
People owe you
You owe people
Recent transactions
```

All values should be derived from the underlying financial records.

---

# 19. Phase 15 - Offline Storage

Implement IndexedDB persistence.

At minimum cache:

```text
Accounts
People
Categories
Transactions
Expense Splits
Settlements
Settlement Allocations
Sync Queue
```

The UI should read supported data primarily from local storage.

---

# 20. Phase 16 - Sync Engine

Implement:

```text
Pending operation detection
Push
Retry
Idempotency
Server acknowledgement
Local reconciliation
Pull
Conflict handling
```

Basic flow:

```text
Local DB
 ↓
Pending queue
 ↓
Server
 ↓
MongoDB
 ↓
Canonical response
 ↓
Local DB
```

---

# 21. MVP Sync Strategy

Do not attempt an extremely sophisticated distributed database system.

The initial model should be:

```text
Local-first
+
Server-authoritative
+
Idempotent operations
+
Soft deletion
+
Last-known local state
```

When conflicts occur, do not silently destroy financial data.

---

# 22. Development Order

The recommended implementation order is:

```text
1. Project foundation
2. Authentication
3. MongoDB connection
4. Domain models
5. Repository layer
6. Accounts
7. People
8. Categories
9. Personal expenses
10. Shared expenses
11. Balance calculations
12. Settlements
13. Transfers
14. Credit-card payments
15. Transactions screen
16. Dashboard
17. IndexedDB
18. Sync queue
19. Background sync
20. Conflict handling
21. Tests
22. UX polish
```

Do not start with the dashboard.

The dashboard is a pretty window into the accounting engine. Building the window first is classic human behavior, and not particularly useful.

---

# 23. Definition of Done

A feature is not complete merely because the UI works.

Every financial feature must have:

```text
UI
Schema validation
Use case
Domain rules
Repository
Server API
Authorization
Error handling
Offline behavior where applicable
Tests
```

---

# 24. Expense Definition of Done

Personal expense must support:

```text
Create
Read
Edit
Soft delete
Offline creation
Sync
```

Validation:

```text
amount > 0
valid account
valid category
valid date
user owns referenced entities
```

---

# 25. Shared Expense Definition of Done

Must support:

```text
Paid by user
Paid by person
Multiple participants
Equal split
Custom split
Percentage split
```

Validation:

```text
sum(splits) = expense.amount
```

Test:

```text
3 participants
Odd amount
Decimal amount
Different split amounts
```

---

# 26. Settlement Definition of Done

Must support:

```text
Full settlement
Partial settlement
Multiple expense allocations
```

Validation:

```text
allocation <= remaining split
sum(allocations) = settlement amount
```

Test:

```text
One split
Multiple splits
Partial settlement
Fully settled split
Attempted over-settlement
Duplicate sync
```

---

# 27. Account Definition of Done

Must support:

```text
Bank
Cash
Credit Card
```

Balance calculations must correctly account for:

```text
Income
Expenses
Transfers
Card payments
```

Transfers and card payments must not accidentally inflate spending.

---

# 28. Testing Gate

Before release, all of these must pass:

```text
Domain unit tests
Repository tests
API integration tests
Critical E2E flows
Offline sync tests
```

Minimum critical E2E flows:

```text
Create personal expense
Create shared expense
Someone else pays
User pays for others
Create settlement
Partially settle expense
Transfer between accounts
Pay credit card
Offline expense → sync
```

---

# 29. Security Gate

Before production deployment:

```text
Authentication verified
Authorization verified
User ownership verified
Input validation verified
No secrets in client bundle
No sensitive data in logs
API errors sanitized
Database indexes reviewed
```

Attempt explicit cross-user access tests.

Example:

```text
User A
 ↓
requests User B transaction
```

Expected:

```text
Denied
```

---

# 30. Financial Correctness Gate

Before release, manually verify:

```text
Account balance
Credit-card outstanding
Available credit
Monthly spending
Person balances
Settlement status
Partial settlement
Transfers
Credit-card payments
```

Use a small known dataset and calculate the expected values independently.

---

# 31. Performance Gate

The MVP should remain responsive with:

```text
1,000+ transactions
100+ people
100+ accounts
Thousands of split records
```

Do not load the entire dataset into the UI unnecessarily.

Use:

```text
Pagination
Indexes
Efficient queries
Local projections
```

where appropriate.

---

# 32. Deployment Preparation

Before deployment:

```text
Production MongoDB
Environment variables
Authentication configuration
HTTPS
Error monitoring
Logging
Database indexes
Backup strategy
```

Hosting decisions are intentionally kept separate from application architecture.

The application should not be tightly coupled to a particular hosting provider.

---

# 33. MVP Success Criteria

The MVP is successful if the user can use it as their actual daily expense tracker.

Typical flow:

```text
Spend money
 ↓
Open app
 ↓
Add expense
 ↓
Continue with life
```

For shared spending:

```text
Pay
 ↓
Add expense
 ↓
Select participants
 ↓
Application calculates balances
 ↓
Later settle
 ↓
Select exact expenses
 ↓
Application marks them settled
```

The user should never need a spreadsheet to reconcile the application.

---

# 34. Architectural Success Criteria

The codebase should make future additions possible without rewriting the core:

```text
Expenses
Splits
Accounts
Settlements
Balances
Sync
```

Future functionality should plug into the existing domain rather than bypassing it.

The most important rule:

```text
UI is not the source of truth.

MongoDB is the server source of truth.
IndexedDB is the local source of truth while offline.
Domain rules determine what financial states are valid.
Derived balances come from financial events.
```

This separation should remain intact throughout the project.
