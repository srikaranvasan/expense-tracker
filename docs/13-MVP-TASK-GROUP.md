# MVP Task Groups

---

# How To Work Through These Groups

## Order

Follow the recommended implementation order at the end of this document. The
groups build on each other: balances cannot be calculated before the records they
are derived from exist.

## Completing a group

A task group is complete only when all of the following hold:

```text
Every checkbox in the group is ticked
tsc --noEmit passes
eslint passes
The unit and integration suites pass
next build succeeds
```

Tick each checkbox as the work lands, not in a batch at the end.

## Required: write an update document

**Every task group must be documented in `docs/updates/` before it is considered
complete.**

Create one file per group:

```text
docs/updates/GROUP-<number>-<SHORT-NAME>.md

docs/updates/GROUP-01-PROJECT-FOUNDATION.md
docs/updates/GROUP-02-AUTHENTICATION.md
docs/updates/GROUP-05-PEOPLE-MANAGEMENT.md
```

Write it for a developer who did not do the work and needs to extend, review, or
debug it. Assume they have read the architecture docs but have never seen this
code.

Each update document must cover:

```text
1. What was built            plain-language summary of the capability delivered
2. Files added or changed     grouped by layer, with the purpose of each
3. Key decisions              what was chosen, what was rejected, and why
4. Business rules enforced    the financial rules this group is responsible for
5. How it was verified        commands run, tests added, what they prove
6. Known gaps                 what is deliberately deferred, and to which group
7. Notes for the next group   anything the following group needs to know
```

Rules for these documents:

* Describe behaviour and reasoning, not just file names. A list of files is not an
  update document.
* Record the reasoning behind any non-obvious choice. Six months later the reason
  is the part nobody can reconstruct.
* Name the exported functions and types another developer will need to call, so
  they do not have to search for the entry points.
* State the deferred work explicitly. Silence reads as "finished".
* Keep it accurate over exhaustive. A wrong document is worse than a short one.

`docs/updates/README.md` holds the index. Add a row for each group as it is
completed.

---

## 1. Project Foundation

* [x] Create Next.js application with TypeScript
* [x] Configure App Router
* [x] Configure ESLint + formatting
* [x] Configure environment variables
* [x] Configure MongoDB connection
* [x] Create development/test environment configuration
* [x] Set up folder architecture
* [x] Set up shared error handling
* [x] Set up API response conventions
* [x] Set up logging
* [x] Set up request IDs
* [x] Set up validation with Zod
* [x] Set up testing framework
* [x] Set up Git hooks/quality checks if required
* [x] Install and configure Chakra UI
* [x] Create the Chakra provider in the app layout
* [x] Define the theme: colour, spacing, radius, and type tokens
* [x] Define semantic tokens for financial meaning (positive, negative, warning, muted)
* [x] Build the shared `components/ui` primitives on Chakra
* [x] Add a component test render helper that includes the provider
* [x] Migrate the existing screens off the previous styling setup
* [x] Remove the previous styling dependencies and config

---

# 2. Authentication

* [x] Choose and configure authentication solution
* [x] Create user model
* [x] Create registration flow
* [x] Create login flow
* [x] Create logout flow
* [x] Create session handling
* [x] Protect authenticated routes
* [x] Create authenticated-user server utility
* [x] Ensure `userId` always comes from the server session
* [x] Add authentication error handling
* [x] Test unauthenticated API access

---

# 3. Database Foundation

* [x] Create MongoDB client
* [x] Create database/repository layer
* [x] Create User collection
* [x] Create Account collection
* [x] Create Person collection
* [x] Create Category collection
* [x] Create Transaction collection
* [x] Create ExpenseSplit collection
* [x] Create Settlement collection
* [x] Create SettlementAllocation collection
* [x] Create SyncOperation collection
* [x] Create indexes
* [x] Add database constraints/validation at application level
* [x] Implement soft-delete conventions
* [x] Implement Decimal128 handling
* [x] Implement timestamp conventions

---

# 4. Account Management

* [x] Create account
* [x] Edit account
* [x] Archive account
* [x] List accounts
* [x] View account details
* [x] Support bank account
* [x] Support cash account
* [x] Support credit card
* [x] Add credit limit
* [x] Add statement day
* [x] Add payment due day
* [x] Calculate account balance
* [x] Calculate credit-card outstanding
* [x] Calculate available credit
* [x] Prevent invalid account operations

---

# 5. People Management

* [x] Add person
* [x] Edit person
* [x] Archive person
* [x] List people
* [x] View person details
* [x] Calculate person balance
* [x] Show amount person owes user
* [x] Show amount user owes person
* [x] Show settled state
* [x] Show person's expense history
* [x] Show person's settlement history

---

# 6. Category Management

* [x] Create default categories
* [x] List categories
* [x] Add custom category
* [x] Edit category
* [x] Archive category
* [x] Select category during expense creation

---

# 7. Personal Expense

* [x] Create personal expense
* [x] Select account
* [x] Select category
* [x] Enter amount
* [x] Enter description
* [x] Select date
* [x] Add optional notes
* [x] Edit expense
* [x] Delete/archive expense
* [x] View expense details
* [x] List expenses
* [x] Filter expenses
* [x] Search expenses
* [x] Paginate expenses

---

# 8. Shared Expense

* [x] Create shared expense
* [x] Select who paid
* [x] Add participants
* [x] Support user as participant
* [x] Support people as participants
* [x] Equal split
* [x] Custom amount split
* [x] Percentage split
* [x] Validate split total
* [x] Validate participants
* [x] Calculate each participant's share
* [x] Support another person paying
* [x] Calculate resulting person balance
* [x] View shared expense details
* [x] Edit shared expense safely
* [x] Prevent edits that invalidate settlements

---

# 9. Settlement

* [x] Show outstanding balances
* [x] Start settlement
* [x] Select person
* [x] Select direction
* [x] Select account
* [x] Enter settlement amount
* [x] Select specific expense splits
* [x] Allocate settlement across multiple splits
* [x] Support partial settlement
* [x] Support full settlement
* [x] Validate allocation total
* [x] Prevent over-settlement
* [x] Create settlement atomically
* [x] View settlement history
* [x] View settlement details
* [x] Calculate remaining amount for each split
* [x] Calculate updated person balance

---

# 10. Transfers

* [x] Create transfer
* [x] Select source account
* [x] Select destination account
* [x] Enter amount
* [x] Add date
* [x] Add notes
* [x] Validate source/destination
* [x] Update derived account balances
* [x] Ensure transfer is not counted as spending
* [x] Edit transfer
* [x] Delete/archive transfer

---

# 11. Credit Card Payments

* [x] Create credit-card payment
* [x] Select bank/source account
* [x] Select credit card
* [x] Enter payment amount
* [x] Add date
* [x] Validate destination is credit card
* [x] Reduce credit-card outstanding
* [x] Reduce source account balance
* [x] Increase available credit
* [x] Ensure payment is not counted as spending
* [x] View payment in transaction history

---

# 12. Dashboard

* [x] Build dashboard layout
* [x] Show account balances
* [x] Show credit-card outstanding
* [x] Show available credit
* [x] Show monthly spending
* [x] Show people who owe user
* [x] Show people user owes
* [x] Show recent expenses
* [x] Show recent settlements
* [x] Show quick actions
* [x] Ensure dashboard values are derived from source data

---

# 13. Transaction History

* [x] Create transaction list
* [x] Show transaction type
* [x] Show amount
* [x] Show account
* [x] Show category
* [x] Show date
* [x] Show description
* [x] Show shared-expense indicator
* [x] Show settlement indicator where relevant
* [x] Filter by account
* [x] Filter by category
* [x] Filter by date
* [x] Filter by person
* [x] Search
* [x] Pagination/infinite loading

---

# 14. Offline Storage

* [x] Select client-side storage strategy
* [x] Create local database
* [x] Store cached application data
* [x] Store local expenses
* [x] Store local shared expenses
* [x] Store local settlements
* [x] Store sync operations
* [x] Add local IDs/client IDs
* [x] Add sync status
* [x] Persist data across app restarts
* [x] Detect online/offline state

---

# 15. Offline Sync

* [x] Create sync queue
* [x] Queue offline writes
* [x] Process pending operations
* [x] Retry failed operations
* [x] Implement operation IDs
* [x] Implement idempotency
* [x] Push local changes
* [x] Pull server changes
* [x] Maintain sync cursor
* [x] Handle deleted records
* [x] Handle updated records
* [x] Handle network failures
* [x] Handle server failures
* [x] Handle duplicate requests
* [x] Handle sync conflicts
* [x] Prevent data loss during failed sync

---

# 16. PWA

* [x] Configure web app manifest
* [x] Configure service worker
* [x] Cache application shell
* [x] Support installation on iPhone
* [x] Support installation on desktop
* [x] Verify offline app startup
* [x] Verify cached resources
* [x] Verify reconnect behavior
* [x] Add appropriate icons/metadata

---

# 17. Security

* [x] Protect all API routes
* [x] Validate ownership for every resource
* [x] Prevent IDOR
* [x] Validate all request bodies
* [x] Validate query parameters
* [x] Validate route parameters
* [x] Protect MongoDB credentials
* [x] Configure secure environment variables
* [ ] Configure HTTPS in production — deployment task, out of dev/staging scope
* [x] Configure secure cookies
* [x] Add security headers
* [x] Add rate limiting where necessary
* [x] Prevent MongoDB injection
* [x] Prevent XSS
* [x] Add CSRF protection where applicable
* [x] Prevent sensitive information in logs
* [x] Review third-party dependencies

---

# 18. Error Handling

* [x] Create application error classes
* [x] Create stable error codes
* [x] Create consistent API error response
* [x] Add frontend error handling
* [x] Add React error boundaries
* [x] Handle network failures
* [x] Handle API failures
* [x] Handle database failures
* [x] Handle validation failures
* [x] Handle authorization failures
* [x] Handle sync failures
* [x] Handle unknown errors
* [x] Add request IDs
* [x] Add structured server logging

---

# 19. Testing

### Unit Tests

* [ ] Money calculations
* [ ] Equal split
* [ ] Custom split
* [ ] Percentage split
* [ ] Person balance
* [ ] Settlement allocation
* [ ] Account balance
* [ ] Credit-card calculations
* [ ] Transaction classification
* [ ] Validation rules

### Integration Tests

* [ ] Create expense
* [ ] Create shared expense
* [ ] Create settlement
* [ ] Create transfer
* [ ] Create credit-card payment
* [ ] Atomic transactions
* [ ] Authorization
* [ ] Idempotency
* [ ] Settlement concurrency

### E2E Tests

* [ ] Login
* [ ] Create personal expense
* [ ] Create shared expense
* [ ] Settle expense
* [ ] Transfer money
* [ ] Pay credit card
* [ ] Offline expense
* [ ] Offline sync

---

# 20. Final MVP Hardening

* [ ] Review all API endpoints
* [ ] Review authorization
* [ ] Review financial calculations
* [ ] Review settlement logic
* [ ] Review offline sync
* [ ] Review database indexes
* [ ] Review error handling
* [ ] Review logging
* [ ] Review theme usage: no hard-coded colours, spacing, or font sizes
* [ ] Verify only one styling system is present
* [ ] Verify colour is never the only signal for a financial meaning
* [ ] Remove debug code
* [ ] Remove unused dependencies
* [ ] Run type checking
* [ ] Run lint
* [ ] Run unit tests
* [ ] Run integration tests
* [ ] Run E2E tests
* [ ] Run production build
* [ ] Test PWA installation
* [ ] Test on iPhone
* [ ] Test on desktop
* [ ] Configure production environment
* [ ] Configure MongoDB backups
* [ ] Verify restore procedure
* [ ] Deploy MVP

---

# Recommended Implementation Order

Do NOT implement these randomly.

Use this order:

```text
1. Project Foundation
        ↓
2. Authentication
        ↓
3. Database Foundation
        ↓
4. Accounts
        ↓
5. People
        ↓
6. Categories
        ↓
7. Personal Expenses
        ↓
8. Shared Expenses
        ↓
9. Settlements
        ↓
10. Transfers
        ↓
11. Credit Card Payments
        ↓
12. Dashboard
        ↓
13. Transaction History
        ↓
14. Offline Storage
        ↓
15. Offline Sync
        ↓
16. PWA
        ↓
17. Security Hardening
        ↓
18. Testing
        ↓
19. Final Hardening
        ↓
20. Deployment
```

## Definition of MVP Complete

The MVP is complete when a user can:

```text
Create account
      ↓
Add bank account / cash / credit card
      ↓
Add people
      ↓
Record expenses
      ↓
Split expenses with people
      ↓
See who owes whom
      ↓
Settle specific expense splits
      ↓
Track transfers
      ↓
Track credit-card payments
      ↓
See dashboard + history
      ↓
Use the app offline
      ↓
Reconnect and sync safely
```

And, critically:

```text
No duplicate expenses
No incorrect split totals
No over-settlements
No cross-user data access
No accidental counting of transfers/payments as expenses
No silent loss of offline data
```