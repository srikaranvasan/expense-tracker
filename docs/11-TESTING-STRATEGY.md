# Expense Tracker MVP - Testing Strategy

## 1. Objective

This application handles financial data.

Testing is therefore not only about preventing crashes. It must prove that:

- Money calculations are correct.
- Splits are correct.
- Settlements are correctly allocated.
- Account balances are correct.
- Credit-card payments are not counted as expenses.
- Transfers are not counted as expenses.
- Offline operations do not create duplicates.
- Users cannot access another user's data.
- Financial data remains consistent after retries and synchronization.

Prioritize correctness over test quantity.

---

# 2. Testing Pyramid

Use:

```text
                 E2E
                /   \
          Integration
             /       \
        Domain / Unit
````

Most tests should be unit/domain tests.

Fewer integration tests should verify complete backend workflows.

A smaller number of E2E tests should verify critical user journeys.

---

# 3. Test Structure

Recommended:

```text
src/
├── domain/
│   ├── transactions/
│   │   ├── calculations.ts
│   │   ├── rules.ts
│   │   └── calculations.test.ts
│   │
│   ├── settlements/
│   │   ├── calculations.ts
│   │   ├── rules.ts
│   │   └── calculations.test.ts
│   │
│   └── accounts/
│       ├── calculations.ts
│       └── calculations.test.ts
│
└── ...

tests/
├── integration/
└── e2e/
```

Component tests must render inside the Chakra provider, because Chakra components
read the theme from context. Wrap them with a shared test render helper rather
than repeating the provider in every test file:

```text
tests/helpers/render.tsx
  → renderWithProviders(ui)
```

Assert on accessible output - roles, labels, and visible text - not on class
names. Styling is expected to change; the meaning of a control is not.

---

# 4. Unit Tests

Unit tests should focus heavily on pure domain functions.

Test:

```text
Split calculations
Money calculations
Person balance
Settlement allocation
Account balance
Credit-card outstanding
Validation rules
```

These tests should not require:

* MongoDB
* Browser
* Network
* React
* Authentication

---

# 5. Money Tests

Test basic operations:

```text
Addition
Subtraction
Multiplication
Division
Comparison
Rounding
Percentage
```

Examples:

```text
₹100 + ₹200 = ₹300

₹100 - ₹25 = ₹75

₹1.25 + ₹2.35 = ₹3.60
```

Also test decimal precision.

Do not rely on JavaScript floating-point behavior.

---

# 6. Equal Split Tests

Example:

```text
Total = ₹900
Participants = 3
```

Expected:

```text
₹300
₹300
₹300
```

Test:

```text
₹1000 / 3
```

The final shares must add exactly to:

```text
₹1000
```

Test odd amounts and decimal amounts.

---

# 7. Custom Split Tests

Example:

```text
Total = ₹1,000

User    ₹200
Arun    ₹500
Vijay   ₹300
```

Expected:

```text
Valid
```

Invalid:

```text
₹200 + ₹500 + ₹200 = ₹900
```

Expected:

```text
INVALID_SPLIT_TOTAL
```

Also test over-allocation.

---

# 8. Percentage Split Tests

Example:

```text
Total = ₹1,000

User 50%
Arun 30%
Vijay 20%
```

Expected:

```text
₹500
₹300
₹200
```

Test:

```text
Percentages < 100%
Percentages > 100%
Negative percentage
Zero percentage
Rounding
Many participants
```

The final monetary amounts must equal the transaction total.

---

# 9. Participant Validation

Test:

```text
Duplicate participant
Missing participant
Unknown person
Archived person
Invalid participant type
Missing personId
Unexpected personId for user participant
```

The server must reject invalid combinations.

---

# 10. Personal Expense Tests

Test creation with:

```text
Valid amount
Valid account
Valid category
Valid date
```

Reject:

```text
Zero amount
Negative amount
Unknown account
Another user's account
Unknown category
Another user's category
Malformed date
```

---

# 11. Shared Expense Tests

Test:

```text
User pays
Person pays
Multiple people
Equal split
Custom split
Percentage split
```

Example:

```text
₹1,200
User pays
3 participants
```

Expected:

```text
User share = ₹400
Person A = ₹400
Person B = ₹400
```

---

# 12. Someone-Else-Pays Tests

Example:

```text
Arun pays ₹900
User share = ₹450
Arun share = ₹450
```

Expected:

```text
User owes Arun ₹450
```

Verify that:

```text
User bank balance
```

does not change.

The expense happened, but the user's account was not charged.

---

# 13. Person Balance Tests

Test:

```text
Person owes user
User owes person
Settled
Partially settled
Multiple expenses
Multiple settlements
```

Example:

```text
Arun owes user ₹500
Arun owes user ₹300
```

Expected:

```text
Arun owes user ₹800
```

Then:

```text
Settlement ₹300
```

Expected:

```text
Arun owes user ₹500
```

---

# 14. Settlement Tests

Test:

```text
Full settlement
Partial settlement
Multiple allocations
Multiple settlements
```

Example:

```text
Expense Split = ₹500

Settlement = ₹500
```

Expected:

```text
Remaining = ₹0
Status = settled
```

---

# 15. Partial Settlement Tests

Example:

```text
Split = ₹500
Settlement = ₹200
```

Expected:

```text
Allocated = ₹200
Remaining = ₹300
```

Then:

```text
Settlement = ₹300
```

Expected:

```text
Allocated = ₹500
Remaining = ₹0
```

---

# 16. Settlement Over-Allocation Tests

Example:

```text
Split = ₹500
Already settled = ₹300
Remaining = ₹200
```

Attempt:

```text
Settlement allocation = ₹250
```

Expected:

```text
Reject
OVER_SETTLEMENT
```

The database must remain unchanged.

---

# 17. Multiple Settlement Allocation Tests

Example:

```text
Dinner ₹300
Movie ₹400
Groceries ₹500
```

Settlement:

```text
₹500
```

Allocations:

```text
Dinner ₹300
Movie ₹200
```

Expected:

```text
Dinner remaining = ₹0
Movie remaining = ₹200
Groceries remaining = ₹500
```

---

# 18. Settlement Direction Tests

Test both:

```text
user → person
person → user
```

Example:

```text
User owes Arun ₹500
```

User → Arun:

```text
balance decreases by ₹500
```

Reverse:

```text
Arun owes user ₹500
```

Arun → User:

```text
balance decreases by ₹500
```

Do not accidentally treat both directions identically.

---

# 19. Transfer Tests

Example:

```text
HDFC Savings = ₹10,000
Cash = ₹2,000
```

Transfer:

```text
HDFC → Cash
₹1,000
```

Expected:

```text
HDFC = ₹9,000
Cash = ₹3,000
```

Monthly spending:

```text
unchanged
```

Person balances:

```text
unchanged
```

---

# 20. Credit-Card Payment Tests

Example:

```text
Bank = ₹20,000
Credit Card Outstanding = ₹5,000
```

Payment:

```text
₹2,000
```

Expected:

```text
Bank = ₹18,000
Credit Card Outstanding = ₹3,000
```

Spending:

```text
unchanged
```

Person balances:

```text
unchanged
```

---

# 21. Credit Limit Tests

Example:

```text
Credit Limit = ₹100,000
Outstanding = ₹20,000
```

Expected:

```text
Available Credit = ₹80,000
```

After:

```text
Expense = ₹5,000
```

Expected:

```text
Outstanding = ₹25,000
Available = ₹75,000
```

After:

```text
Payment = ₹10,000
```

Expected:

```text
Outstanding = ₹15,000
Available = ₹85,000
```

---

# 22. Transaction Classification Tests

Verify:

```text
expense → spending
transfer → not spending
credit_card_payment → not spending
settlement → not normal spending
```

This distinction must be enforced at the domain level.

---

# 23. Account Balance Tests

Test combinations of:

```text
Opening balance
Expense
Transfer in
Transfer out
Credit-card payment
```

Example:

```text
Opening = ₹50,000

Expense = ₹2,000
Transfer out = ₹5,000
Transfer in = ₹3,000
```

Expected:

```text
₹46,000
```

---

# 24. Editing Tests

Test:

```text
Edit personal expense
Edit shared expense
Edit amount
Edit participants
Edit account
Edit category
```

Especially test expenses that already have settlements.

Example:

```text
Expense split = ₹500
Settled = ₹300

Attempt to change split to ₹200
```

Expected:

```text
Reject
```

unless the application has an explicit correction/reconciliation workflow.

---

# 25. Deletion Tests

Test:

```text
Delete unsettled expense
Delete settled expense
Delete expense with partial settlement
```

Verify:

```text
Soft deletion
Settlement history preserved
No accidental balance corruption
Sync operation created
```

---

# 26. Authentication Tests

Test:

```text
Register
Login
Logout
Expired session
Invalid credentials
Protected endpoint without session
```

Expected:

```text
401 Unauthorized
```

where appropriate.

---

# 27. Authorization Tests

These are mandatory.

Create:

```text
User A
User B
```

User A attempts to access:

```text
User B account
User B transaction
User B person
User B settlement
User B category
```

Every attempt must be denied.

Do not merely test UI hiding.

Call the API directly.

---

# 28. IDOR Tests

Explicitly test insecure direct object reference scenarios.

Example:

```text
User A
GET /api/expenses/<User-B-expense-id>
```

Expected:

```text
404
```

or the application's chosen safe authorization response.

The API must never expose User B's data.

---

# 29. Input Validation Tests

Test malicious and malformed input:

```text
Missing fields
Unexpected fields
Wrong data types
Invalid IDs
Negative values
Extremely large values
Invalid dates
Invalid enums
Invalid decimals
```

The server must validate independently of frontend validation.

---

# 30. Repository Tests

Repository tests should verify:

```text
Create
Read
Update
Soft delete
List
Pagination
Filtering
Ownership
Indexes/query behavior where practical
```

Repository tests may use a test MongoDB instance.

Do not run repository tests against production.

---

# 31. Integration Tests

Integration tests should verify complete use cases.

Example:

```text
POST /api/expenses/shared
        ↓
Authentication
        ↓
Validation
        ↓
Use Case
        ↓
Domain
        ↓
Repository
        ↓
MongoDB
```

Verify the final database state.

---

# 32. Atomicity Tests

Critical.

Simulate a failure during:

```text
Create shared expense
```

Verify:

```text
Transaction is not created
OR
Transaction + all splits are created
```

Never:

```text
Transaction created
Split creation failed
```

with incomplete data.

Same for:

```text
Settlement + allocations
```

---

# 33. Idempotency Tests

Send the exact same request twice.

Example:

```text
operationId = op_123
```

Request 1:

```text
success
```

Request 2:

```text
same operationId
```

Expected:

```text
same result
no duplicate financial record
```

---

# 34. Offline Tests

Simulate:

```text
Offline
 ↓
Create expense
 ↓
Close application
 ↓
Reopen
```

Expected:

```text
Expense still exists locally
Sync operation still exists
```

Then:

```text
Internet restored
 ↓
Sync
```

Expected:

```text
Server record created
Local record marked synced
Queue operation completed
```

---

# 35. Offline Retry Tests

Simulate:

```text
Create expense
 ↓
Sync attempt
 ↓
Network failure
```

Expected:

```text
Operation remains pending
```

Later:

```text
Network restored
 ↓
Retry
```

Expected:

```text
Successfully synchronized
```

---

# 36. Duplicate Sync Tests

Simulate:

```text
Client sends operation
 ↓
Server creates record
 ↓
Response is lost
 ↓
Client retries
```

Expected:

```text
Exactly one record
```

This is one of the most important offline tests.

---

# 37. Offline Conflict Tests

Simulate:

```text
Device A edits expense
Device B edits same expense
Both offline
Both synchronize
```

Expected:

```text
Conflict detected
```

The system must not silently combine monetary values.

---

# 38. Pull Sync Tests

Test:

```text
Device A creates expense
 ↓
Server
 ↓
Device B pulls changes
```

Expected:

```text
Expense appears on Device B
```

Also test:

```text
Deleted record
Updated record
Multiple changes
Pagination/cursors
```

---

# 39. Sync Cursor Tests

Test:

```text
Pull changes
 ↓
Save cursor
 ↓
Pull again
```

Expected:

```text
Previously processed changes are not repeatedly applied.
```

Also test failure during local application of changes.

The cursor must not advance past changes that were not successfully applied.

---

# 40. Local Database Tests

Test:

```text
Create local entity
Create sync operation
Update entity
Delete entity
Read after application restart
Migration
```

Especially verify that:

```text
entity + sync operation
```

are persisted atomically.

---

# 41. PWA Tests

Verify:

```text
Application loads with cached shell
Application can open offline
Previously cached data is available
Expense creation works offline
Sync resumes after connectivity returns
```

Do not assume a service worker behaves identically across every browser.

Test the actual supported browser/device matrix.

---

# 42. E2E Test: Personal Expense

```text
Login
 ↓
Open dashboard
 ↓
Add expense
 ↓
Enter amount
 ↓
Select account
 ↓
Select category
 ↓
Save
 ↓
Open transactions
 ↓
Verify expense
```

---

# 43. E2E Test: Shared Expense

```text
Login
 ↓
Add shared expense
 ↓
Enter amount
 ↓
Select account
 ↓
Select participants
 ↓
Select equal split
 ↓
Save
 ↓
Open person
 ↓
Verify balance
```

---

# 44. E2E Test: Settlement

```text
Create shared expense
 ↓
Open person
 ↓
Select settlement
 ↓
Select specific expense
 ↓
Enter settlement amount
 ↓
Confirm
 ↓
Verify remaining amount
```

Also test partial settlement.

---

# 45. E2E Test: Transfer

```text
Create two accounts
 ↓
Create transfer
 ↓
Verify source balance
 ↓
Verify destination balance
 ↓
Verify monthly spending unchanged
```

---

# 46. E2E Test: Credit Card

```text
Create bank account
 ↓
Create credit card
 ↓
Create credit-card expense
 ↓
Verify outstanding
 ↓
Pay credit card
 ↓
Verify outstanding reduced
 ↓
Verify bank balance reduced
 ↓
Verify spending did not increase because of payment
```

---

# 47. E2E Test: Offline

```text
Open app online
 ↓
Load data
 ↓
Disable network
 ↓
Create expense
 ↓
Reload app
 ↓
Verify expense remains
 ↓
Enable network
 ↓
Sync
 ↓
Verify server state
```

---

# 48. Regression Test Dataset

Maintain a deterministic test dataset.

Example:

```text
Accounts

Bank       ₹50,000
Cash       ₹2,000
Card       Limit ₹100,000
```

People:

```text
Arun
Vijay
```

Transactions:

```text
Dinner ₹1,200
Groceries ₹900
Movie ₹600
```

Settlements:

```text
₹300
₹200
```

Use this dataset to verify calculated balances after changes to the financial engine.

---

# 49. Property-Based Testing

Where practical, use property-based tests for split calculations.

Important properties:

```text
sum(all splits) = total

no split < 0

percentage split total = 100%

settled amount <= original amount

remaining amount >= 0
```

For arbitrary valid inputs, these properties must always hold.

---

# 50. Invariants

The following invariants must always be true.

## Expense

```text
sum(expenseSplits) = expense.amount
```

for shared expenses.

## Settlement

```text
sum(settlementAllocations) = settlement.amount
```

## Split

```text
allocatedAmount <= originalAmount
```

## Remaining

```text
remainingAmount >= 0
```

## Transfer

```text
fromAccount != toAccount
```

## Credit Card Payment

```text
destinationAccount.type = credit_card
```

These should be encoded into automated tests.

---

# 51. Test Financial Invariants After Writes

After every critical integration test, verify relevant invariants.

For example:

```text
Create shared expense
 ↓
Fetch transaction
 ↓
Fetch splits
 ↓
Assert split total
```

Settlement:

```text
Create settlement
 ↓
Fetch allocations
 ↓
Assert allocation total
 ↓
Assert remaining split
```

---

# 52. Error Testing

Do not only test successful flows.

For every important API operation test:

```text
Valid request
Invalid request
Unauthorized request
Unauthorized resource
Business rule violation
Duplicate request
Database failure
Network failure where applicable
```

---

# 53. Test Naming

Use descriptive test names.

Bad:

```text
test expense
```

Good:

```text
should reject a shared expense when split amounts exceed the transaction total
```

Tests should explain the expected behavior.

---

# 54. Mocking

Do not mock everything.

Mock:

```text
External services
Network boundaries
Unstable infrastructure
```

Avoid mocking the domain logic being tested.

For repository/integration tests, use a real isolated test database where practical.

---

# 55. Test Isolation

Each test should be independent.

Do not rely on:

```text
test A
 ↓
creates data
 ↓
test B assumes data exists
```

Each test should establish its own required state.

---

# 56. CI Requirements

Every pull request should run:

```text
TypeScript check
Lint
Unit tests
Integration tests
```

E2E tests should run in CI at an appropriate stage.

A build should not be considered valid if financial-domain tests fail.

---

# 57. Pre-Release Test Checklist

Before releasing MVP:

```text
[ ] TypeScript passes
[ ] Lint passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E critical flows pass
[ ] Authorization tests pass
[ ] Offline tests pass
[ ] Idempotency tests pass
[ ] Settlement tests pass
[ ] Financial invariant tests pass
[ ] Production build passes
```

---

# 58. Minimum Coverage Philosophy

Do not chase an arbitrary percentage such as:

```text
"90% coverage"
```

while leaving critical financial logic poorly tested.

Prioritize high coverage for:

```text
Money calculations
Split calculations
Balance calculations
Settlement calculations
Account calculations
Sync/idempotency logic
Authorization
```

A boring 100% tested settlement calculation is far more valuable than 100% coverage of a decorative settings screen.

---

# 59. Final Testing Principle

The most important question is not:

```text
"Does the button work?"
```

It is:

```text
"Can this operation ever produce an incorrect financial state?"
```

Every financial operation must have tests proving that invalid states are rejected and valid states produce deterministic results.

The application should fail safely.

It should never silently invent, duplicate, lose, or corrupt money-related records.