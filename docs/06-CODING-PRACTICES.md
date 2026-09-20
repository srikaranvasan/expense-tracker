# Expense Tracker MVP - Coding Practices

## 1. Core Principle

Build the application as a robust modular monolith.

Prioritize:

1. Financial correctness
2. Clear separation of concerns
3. Type safety
4. Testability
5. Security
6. Offline reliability
7. Maintainability
8. Performance

Do not optimize for writing the least amount of code.

Optimize for code that remains understandable after the application becomes significantly larger.

---

# 2. TypeScript

Use strict TypeScript.

`tsconfig.json` should use strict mode.

Avoid:

```ts
any
````

unless there is a documented and unavoidable reason.

Prefer:

```ts
unknown
```

with explicit narrowing when the type is genuinely unknown.

Do not use type assertions to silence errors unless the assertion is justified.

Bad:

```ts
const user = data as User
```

Better:

```ts
const user = UserSchema.parse(data)
```

---

# 3. Separation of Concerns

Keep these responsibilities separate:

```text
UI
 ↓
Application / Use Case
 ↓
Domain
 ↓
Repository
 ↓
Infrastructure
```

Do not mix them.

For example, this is bad:

```ts
async function ExpenseForm() {
  // React state
  // MongoDB query
  // authentication
  // split calculation
  // settlement calculation
  // database writes
}
```

Instead:

```text
ExpenseForm
    ↓
CreateExpense
    ↓
Domain calculations
    ↓
TransactionRepository
    ↓
MongoDB
```

---

# 4. Business Logic Must Not Live in Components

React components should handle:

* Rendering
* User interaction
* Local UI state
* Form state
* Loading state
* Error presentation

They should not calculate:

* Person balances
* Account balances
* Settlement amounts
* Credit-card outstanding
* Split totals
* Financial projections

Those belong to domain/application code.

---

# 5. Domain Logic Must Be Pure Where Possible

Prefer pure functions.

Example:

```ts
calculateRemainingSplit(
  shareAmount,
  allocatedAmount
)
```

should not:

* query MongoDB
* access IndexedDB
* call an API
* access React state

It should receive values and return a result.

Benefits:

* Easy unit testing
* Deterministic behavior
* Reusable on client and server
* Easier debugging

---

# 6. Centralize Financial Calculations

Do not calculate money in random files.

Create a central money utility.

Example:

```text
src/lib/money/
```

Provide functions such as:

```ts
addMoney()
subtractMoney()
multiplyMoney()
divideMoney()
percentageOf()
compareMoney()
roundMoney()
isZero()
isPositive()
```

All financial calculations should use these utilities.

---

# 7. Never Use Floating Point for Money

Never do:

```ts
const total = 0.1 + 0.2
```

for authoritative financial calculations.

JavaScript floating-point arithmetic is not suitable for money.

Use:

* MongoDB Decimal128
* Decimal arithmetic library
* Centralized money abstraction

Example:

```ts
Money
```

should provide safe operations.

---

# 8. Money Type

Do not pass arbitrary numbers around the domain as monetary values.

Prefer an explicit representation.

For example:

```ts
type Money = {
  amount: Decimal
  currency: string
}
```

or a domain-safe equivalent.

Do not allow different parts of the application to invent their own money representation.

---

# 9. Currency

Every financial amount must have a currency context.

For MVP:

* Default to the user's configured currency.
* Do not implement currency conversion.
* Do not silently convert currencies.

If multi-currency is introduced later, the domain model must be extended deliberately.

---

# 10. Runtime Validation

TypeScript validates code at compile time.

It does not validate data arriving from:

* HTTP requests
* IndexedDB
* MongoDB
* external APIs
* browser storage

Use Zod or equivalent runtime validation.

Example:

```ts
const result = ExpenseSchema.safeParse(input)

if (!result.success) {
  // handle validation error
}
```

Never assume incoming data is trustworthy because TypeScript has a type for it.

---

# 11. Validation Layers

Use multiple validation layers intentionally.

## UI validation

For immediate feedback.

Example:

```text
Amount is required.
```

## Schema validation

For request structure.

Example:

```text
amount must be a valid decimal.
```

## Domain validation

For business rules.

Example:

```text
Expense split total must equal expense total.
```

## Database constraints/indexes

For persistence-level guarantees.

Example:

```text
clientId + userId must be unique.
```

---

# 12. Server Is the Authority

Never trust the client for:

* userId
* ownership
* account ownership
* person ownership
* category ownership
* split totals
* settlement amounts
* settlement allocation availability
* transaction effects

The server must independently validate these.

---

# 13. Authentication

Every protected request must establish the authenticated user.

Do not accept:

```json
{
  "userId": "..."
}
```

as the source of identity.

Instead:

```text
Authenticated Session
        ↓
Server determines userId
```

If a request attempts to operate on another user's resource:

```text
Return authorization error
```

Do not reveal whether the resource exists.

---

# 14. Authorization

Every database operation must be scoped to the authenticated user.

Bad:

```ts
db.transactions.findOne({
  _id: transactionId
})
```

Good:

```ts
db.transactions.findOne({
  _id: transactionId,
  userId: authenticatedUserId,
  deletedAt: null
})
```

The same principle applies to:

* accounts
* people
* categories
* settlements
* splits
* allocations

---

# 15. Ownership Verification

When creating a shared expense:

```text
Transaction
 ├── accountId
 ├── categoryId
 └── participant personIds
```

The server must verify that every referenced resource belongs to the current user.

Do not rely on the frontend.

---

# 16. API Design

Route handlers should remain thin.

Preferred:

```text
Route Handler
    ↓
Authentication
    ↓
Request Schema
    ↓
Use Case
    ↓
Domain
    ↓
Repository
```

Avoid putting business logic directly into route handlers.

---

# 17. API Responses

Use consistent response structures.

Success:

```ts
{
  data: ...
}
```

Error:

```ts
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Split amounts must equal the expense total.",
    details?: ...
  }
}
```

Do not expose:

* stack traces
* MongoDB errors
* internal implementation details
* secrets
* database queries

---

# 18. Error Codes

Create application-level error codes.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INVALID_SPLIT
INVALID_SETTLEMENT
INVALID_SETTLEMENT_ALLOCATION
INVALID_ACCOUNT
SYNC_CONFLICT
SYNC_RETRYABLE_ERROR
INTERNAL_ERROR
```

The UI can map these to appropriate messages.

---

# 19. Domain Errors

Create explicit domain errors.

Example:

```ts
class InvalidSplitError extends DomainError {
  code = "INVALID_SPLIT"
}
```

Avoid throwing generic errors for known business failures.

Bad:

```ts
throw new Error("something went wrong")
```

Better:

```ts
throw new InvalidSettlementAllocationError(...)
```

---

# 20. Database Access

Only server-side repository implementations should access MongoDB.

Do not allow:

```text
React component
    ↓
MongoDB
```

or:

```text
Domain function
    ↓
MongoDB
```

Use:

```text
Use Case
    ↓
Repository interface
    ↓
MongoDB implementation
```

---

# 21. MongoDB Transactions

Use MongoDB transactions for operations that modify multiple related documents and must succeed or fail together.

Example:

```text
Create Shared Expense

Transaction
+
Expense Splits
```

Either all are persisted or none are persisted.

Settlement:

```text
Settlement
+
Settlement Allocations
```

must be atomic.

---

# 22. Idempotency

All offline-synchronized write operations must be idempotent.

Every client-created operation should have a stable:

```text
clientId
```

Example:

```text
expense-client-id:
550e8400-e29b-41d4-a716-446655440000
```

If the client sends the same operation twice because of a retry:

```text
Server
 ↓
Recognize existing clientId
 ↓
Do not create duplicate transaction
```

This is mandatory for reliable offline synchronization.

---

# 23. Optimistic UI

The app can optimistically update the UI after writing locally.

Example:

```text
User saves expense
        ↓
IndexedDB write
        ↓
UI updates
        ↓
Background synchronization
```

Do not optimistically modify server state without a durable local record.

The local write should happen first.

---

# 24. Offline Queue

Every server-bound write must be represented in the sync queue.

Example:

```ts
type SyncOperation = {
  id: string

  entityType: string
  entityId: string

  operation:
    | "create"
    | "update"
    | "delete"

  payload: unknown

  createdAt: Date

  retryCount: number

  status:
    | "pending"
    | "processing"
    | "failed"
    | "completed"
}
```

Do not lose pending operations if the browser is closed.

---

# 25. Retry Strategy

Retry temporary failures.

Examples:

```text
Network unavailable
Timeout
Temporary server failure
```

Use bounded retries with exponential backoff.

Do not retry permanent validation errors indefinitely.

Example:

```text
Invalid split
```

should not retry forever.

---

# 26. Conflict Handling

The application must distinguish:

```text
Retryable failure
```

from:

```text
Business conflict
```

Examples:

### Retryable

```text
No internet
```

### Conflict

```text
Expense was modified on another device.
```

Conflict behavior must be explicit.

Do not silently overwrite financial data.

---

# 27. Soft Delete

Use soft deletion for financial records.

Example:

```ts
deletedAt: new Date()
```

Avoid physical deletion because offline devices may still have the record.

Normal queries should exclude deleted records.

---

# 28. Editing Financial Records

Editing an expense must recalculate dependent projections.

For example:

```text
Expense
 ↓
Expense Splits
 ↓
Balances
 ↓
Settlement status
```

If an already-settled expense is edited, the application must carefully validate whether the existing settlement allocations are still valid.

Do not casually allow changes that invalidate historical settlements.

---

# 29. Deleting Financial Records

Deleting a financial record is not equivalent to deleting a normal CRUD object.

Before deletion:

* Check settlement allocations.
* Check dependencies.
* Preserve synchronization metadata.
* Preserve auditability.

If deletion would invalidate existing settlement history, prefer a controlled correction/reversal workflow.

---

# 30. Immutable Financial Events

Prefer treating completed financial events as immutable where practical.

If correction is necessary:

```text
Original event
      ↓
Correction / replacement
```

rather than silently changing historical facts.

For MVP, normal edits can be supported, but the domain must protect against invalidating settlements.

---

# 31. Account Balance

Do not manually increment/decrement balances in unrelated UI code.

Bad:

```ts
account.balance -= expense.amount
```

Use a centralized account calculation/projection.

Example:

```text
Account
 ↓
Relevant financial events
 ↓
Account balance calculation
```

If performance later requires cached balances, treat them as derived projections that can be rebuilt.

---

# 32. Person Balance

Never manually maintain:

```text
person.balance
```

as authoritative state.

Calculate it from:

```text
Expense Splits
+
Settlement Allocations
```

This guarantees the application can explain where a balance came from.

---

# 33. Settlement Integrity

Before saving a settlement:

1. Verify both participants.
2. Verify the direction.
3. Verify the payment account if supplied.
4. Verify allocation ownership.
5. Calculate remaining split amounts.
6. Ensure allocations do not exceed remaining amounts.
7. Ensure allocation total matches settlement amount.
8. Persist atomically.

---

# 34. Transfer Integrity

A transfer must:

```text
fromAccount != toAccount
```

Both accounts must belong to the user.

A transfer must not:

* create expense splits
* affect shared balances
* count toward spending

---

# 35. Credit-Card Payment Integrity

A credit-card payment must:

```text
fromAccount = user's source account
toAccount.type = credit_card
```

It must not:

* create expense splits
* increase spending
* create a person balance

It reduces the credit-card liability.

---

# 36. React State

Avoid duplicating server/domain state unnecessarily.

Do not maintain multiple independent copies of:

```text
transactions
balances
accounts
```

Use a clear data-access/state strategy.

Local IndexedDB is the durable client store for offline-supported entities.

UI state should contain temporary presentation state such as:

```text
selected participants
open dialog
form values
selected filters
```

---

# 37. Form Handling

Use a dedicated form library if it meaningfully simplifies complex forms.

The expense form should have:

```text
Form State
 ↓
Schema Validation
 ↓
Domain Input
 ↓
Use Case
```

Do not let form components know how MongoDB works.

---

# 38. Avoid Prop Drilling

If a deeply nested feature needs significant shared state:

* use feature-level context
* use a state store where justified
* restructure the component tree

Do not create huge prop chains.

However, do not introduce global state merely because two components share a value.

---

# 39. Reusable Components

Build generic UI components:

```text
Button
Input
Dialog
Select
DatePicker
CurrencyInput
Tabs
Card
List
EmptyState
ErrorState
```

Feature components can compose these.

Generic components should not know about financial domain concepts unless intentionally designed as domain UI components.

---

# 40. Accessibility

All interactive UI must support:

* Keyboard navigation
* Focus management
* Labels
* Screen-reader-friendly controls
* Appropriate semantic HTML
* Sufficient touch target size

This matters especially for the iPhone PWA.

Do not make every interaction depend on hover.

Chakra UI's interactive components handle focus trapping, `aria` wiring, and
keyboard behaviour. Use them instead of rebuilding a dialog, menu, or popover
from a `div`.

Chakra is a starting point, not a guarantee. Still verify:

```text
Every input has a real label, not just a placeholder
Every validation error is announced, not only coloured
Focus is visible at every step
Touch targets are large enough for one-handed use
```

Colour must never be the only carrier of meaning. An amount the user owes and an
amount owed to them must differ in text as well as in colour.

---

# 41. Mobile First

The primary frequent-use experience is mobile.

Design for:

```text
Phone first
 ↓
Tablet
 ↓
Desktop
```

Expense entry should be comfortable with one hand.

Important controls should be easy to tap.

Avoid tiny buttons.

## Styling

Chakra UI is the styling system. Express layout and spacing through Chakra props
and theme tokens rather than stylesheets.

Chakra's responsive array/object syntax is mobile-first by default: the first
value is the phone, later values are wider screens.

```text
<Stack direction={{ base: "column", md: "row" }}>
  base → phone
  md   → tablet and up
```

Write the phone case first and add breakpoints only where the layout genuinely
needs to change. A layout that needs a breakpoint at every property is usually
the wrong layout.

## Styling rules

```text
Use theme tokens for colour, spacing, radius, and type
Use Chakra layout primitives instead of custom flex/grid CSS
Keep one styling system - no utility classes or CSS modules alongside it
Put repeated visual patterns in components/ui, not in copied prop lists
Never encode a financial rule in a style prop
```

Amounts are the one place typography matters for correctness: render them with
tabular figures so a column of numbers lines up and is easy to scan.

---

# 42. Performance

Optimize where useful, not everywhere.

Priorities:

1. Fast initial load
2. Fast expense entry
3. Fast local reads
4. Efficient transaction lists
5. Avoid unnecessary re-renders
6. Paginate large transaction histories

Do not prematurely optimize MongoDB queries before query patterns are known.

---

# 43. Pagination

Transaction history should support pagination.

Do not load thousands of transactions into the browser by default.

Prefer cursor-based pagination where appropriate.

Example:

```text
GET /api/transactions?cursor=...
```

---

# 44. Query Design

Queries should request only required fields when practical.

For example, a transaction list does not need every field from every related entity.

Use view models to shape data for the UI.

---

# 45. Logging

Use structured server-side logging.

Log useful information such as:

```text
requestId
userId
operation
entityId
errorCode
duration
```

Do not log:

* passwords
* authentication tokens
* sensitive personal data unnecessarily
* full financial payloads unless required for debugging

---

# 46. Request IDs

Each server request should have a request/correlation ID where practical.

This makes debugging easier:

```text
Client error
 ↓
Request ID
 ↓
Server logs
 ↓
Root cause
```

---

# 47. Environment Variables

Never commit secrets.

Examples:

```text
MONGODB_URI
AUTH_SECRET
DATABASE_NAME
```

should come from environment configuration.

Validate environment variables at startup.

---

# 48. Git Practices

Use small, meaningful commits.

Examples:

```text
feat: add shared expense creation
feat: add settlement allocation
fix: prevent over-allocation of settlement
feat: add offline transaction queue
test: add balance calculation tests
```

Avoid giant commits containing unrelated changes.

---

# 49. Code Review Checklist

Before considering a feature complete, check:

### Architecture

* Is responsibility in the correct layer?
* Is business logic outside UI?
* Is database access behind repositories?

### Security

* Is authentication enforced?
* Is ownership verified?
* Is user input validated?

### Financial correctness

* Are monetary calculations decimal-safe?
* Are split totals validated?
* Are settlements validated?
* Are transfers excluded from spending?
* Are card payments excluded from spending?

### Offline

* Is local data durable?
* Is the operation idempotent?
* Can it safely retry?

### UX

* Does it work on mobile?
* Are loading states handled?
* Are errors understandable?
* Does the user receive immediate feedback?

### Testing

* Are domain calculations tested?
* Are important API workflows tested?
* Are edge cases covered?

---

# 50. Testing Strategy

Prioritize tests in this order:

## Unit tests

Test domain calculations heavily.

Examples:

```text
Equal split
Custom split
Percentage split
Rounding
Person balance
Partial settlement
Settlement allocation
Account balance
Credit-card outstanding
```

## Integration tests

Test:

```text
API
 ↓
Use Case
 ↓
Repository
 ↓
MongoDB
```

## E2E tests

Test critical user journeys:

```text
Create personal expense
Create shared expense
Settle specific split
Partial settlement
Transfer
Credit-card payment
Offline expense synchronization
```

---

# 51. Financial Edge Cases

Explicitly test:

```text
₹0
Negative amounts
Very large amounts
Decimal amounts
Odd-number equal splits
Percentage rounding
Fully settled split
Partially settled split
Over-settlement
Duplicate settlement
Duplicate offline operation
Deleted expense with settlement
Editing settled expense
Multiple settlements against one split
Multiple settlements involving one person
```

Financial edge cases are not optional. Money has a remarkable ability to become important precisely when someone claims "that case probably won't happen."

---

# 52. Comments

Write comments only when they explain:

* Why something exists
* Why a non-obvious decision was made
* Why a seemingly strange implementation is required

Do not write comments that merely restate the code.

Bad:

```ts
// Add amount to total
total = total + amount
```

Good:

```ts
// Use Decimal arithmetic because JavaScript floating-point
// arithmetic cannot safely represent arbitrary monetary values.
```

---

# 53. Documentation

Document important architectural decisions.

Keep this architecture documentation updated when:

* Domain model changes
* Sync strategy changes
* Authentication changes
* Major infrastructure changes
* Financial rules change

Do not let documentation describe an architecture that no longer exists.

---

# 54. No Magic Numbers

Avoid:

```ts
if (amount > 100000)
```

Use named constants when the value has domain meaning.

```ts
MAX_TRANSACTION_AMOUNT
```

If there is no real business limit, do not invent one merely to make code look tidy.

---

# 55. No Silent Data Mutation

Do not silently change financial input.

Bad:

```text
User entered ₹1000
System silently changes it to ₹999.99
```

If rounding is required:

```text
Show the resulting split
```

and make the rule explicit.

---

# 56. No Hidden Side Effects

Functions should make their side effects obvious.

Avoid:

```ts
calculateBalance()
```

that secretly writes to MongoDB.

A function named `calculate...` should generally calculate.

A function named `save...` should generally persist.

Naming should communicate behavior.

---

# 57. Prefer Explicit Use Cases

Prefer:

```text
createExpense()
createSettlement()
createTransfer()
payCreditCard()
```

over a generic:

```text
processTransaction()
```

when the business behavior is meaningfully different.

Financial operations should be explicit because ambiguity is where accounting bugs breed.

---

# 58. Dependency Injection

Use dependency injection where it provides a real benefit.

Example:

```ts
CreateSettlementUseCase({
  settlementRepository,
  splitRepository,
  accountRepository,
})
```

This makes testing easier.

Do not build a giant dependency-injection framework for a small application.

Simple constructor/function injection is sufficient.

---

# 59. No Circular Dependencies

Maintain a clean dependency graph.

Especially avoid:

```text
domain A
 ↓
domain B
 ↓
domain A
```

If two domains need shared logic, extract the genuinely shared concept into an appropriate lower-level module.

---

# 60. Final Coding Rule

Every new piece of code should answer:

```text
What responsibility does this have?
Which layer owns that responsibility?
Can this be tested independently?
Can this be reused?
Does it introduce hidden financial side effects?
Does it remain correct offline?
Does the server independently validate it?
```

If these questions cannot be answered clearly, the implementation is probably mixing responsibilities.

The goal is not to create the most sophisticated architecture.

The goal is to create an architecture where financial mistakes are difficult to make and easy to detect.
